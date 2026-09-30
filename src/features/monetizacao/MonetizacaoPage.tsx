import { useMemo } from 'react';
import { Coins, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, ErrorState, IconTile, SectionHead, Skeleton } from '@/components/ui/primitives';
import { useChannelId } from '@/app/useChannel';
import { useContents, useKpis } from '@/data/hooks';
import { CAMBIO_EXEMPLO_BRL_POR_USD } from '@/data/mock/db';
import { formatBrl, formatRatio, formatUsd } from '@/lib/format';
import type { ContentItem } from '@/data/types';

/** Monetização — quanto o canal ganha, quanto custa e onde está a margem. */
export function MonetizacaoPage() {
  const channelId = useChannelId();
  const kpis = useKpis(channelId);
  const contents = useContents(channelId);

  const spent = useMemo(
    () => (contents.data ?? []).reduce((sum, item) => sum + item.costUsd, 0),
    [contents.data],
  );

  const byTheme = useMemo(() => {
    const map = new Map<string, { cost: number; revenue: number; count: number }>();
    for (const item of contents.data ?? []) {
      const entry = map.get(item.theme) ?? { cost: 0, revenue: 0, count: 0 };
      entry.cost += item.costUsd * CAMBIO_EXEMPLO_BRL_POR_USD;
      entry.revenue += item.metrics?.revenueBrl ?? 0;
      entry.count += 1;
      map.set(item.theme, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [contents.data]);

  const maxRevenue = Math.max(1, ...byTheme.map(([, value]) => value.revenue));

  return (
    <>
      <PageHeader
        title="Monetização"
        subtitle="Receita, custo real de produção e margem por tema. É aqui que o negócio responde se o canal se paga."
      />

      {kpis.isLoading && <Skeleton className="h-[124px] mb-4" />}
      {kpis.isError && (
        <Card className="p-4 mb-4">
          <ErrorState message="Não conseguimos carregar os indicadores deste canal." onRetry={kpis.refetch} />
        </Card>
      )}

      {kpis.data && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Receita no período"
            value={formatBrl(kpis.data.revenueBrl)}
            deltaPct={kpis.data.revenueDeltaPct}
            period={`${kpis.data.periodDays} dias`}
            scope="Estimativa do YouTube"
            icon={<IconTile tone="green" size="sm"><Coins size={15} /></IconTile>}
          />
          <StatCard
            label="RPM"
            value={formatBrl(kpis.data.rpmBrl)}
            period={`${kpis.data.periodDays} dias`}
            scope="Receita por mil visualizações"
            icon={<IconTile tone="cyan" size="sm"><TrendingUp size={15} /></IconTile>}
          />
          <StatCard
            label="Custo de produção"
            value={formatBrl(spent * CAMBIO_EXEMPLO_BRL_POR_USD)}
            period="conteúdos na semana"
            scope={`Câmbio de exemplo ${CAMBIO_EXEMPLO_BRL_POR_USD.toFixed(2)} — não é cotação real`}
            icon={<IconTile tone="amber" size="sm"><Wallet size={15} /></IconTile>}
          />
          <StatCard
            label="Margem no período"
            value={formatBrl(kpis.data.revenueBrl - spent * CAMBIO_EXEMPLO_BRL_POR_USD)}
            period={`${kpis.data.periodDays} dias`}
            scope="Receita menos custo de produção"
            icon={<IconTile tone="violet" size="sm"><PiggyBank size={15} /></IconTile>}
          />
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7">
          <Card className="p-4">
            <SectionHead title="Receita por tema" hint="onde o dinheiro entra" />
            {contents.isLoading && <Skeleton className="h-[240px]" />}
            {contents.isError && (
              <ErrorState message="Não conseguimos carregar os conteúdos deste canal." onRetry={contents.refetch} />
            )}
            {byTheme.length > 0 && (
              <ul className="flex flex-col gap-3">
                {byTheme.map(([theme, value]) => (
                  <li key={theme}>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[12px] font-semibold text-ink">{theme}</span>
                      <span className="text-[11px] text-ink-3">
                        {formatBrl(value.revenue)} · {value.count}{' '}
                        {value.count === 1 ? 'conteúdo' : 'conteúdos'}
                      </span>
                    </div>
                    <div className="ams-bar-track" aria-hidden="true">
                      <div
                        className="ams-bar-fill"
                        style={{ width: `${Math.max(3, (value.revenue / maxRevenue) * 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-ink-3 mt-1 ams-num">
                      custo {formatBrl(value.cost)} · retorno{' '}
                      {value.cost > 0 ? formatRatio(value.revenue / value.cost) : 'sem custo lançado'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="p-4">
            <SectionHead title="Custo por conteúdo" hint="nada é gerado sem custo lançado" />
            {contents.data && (
              <ul className="flex flex-col gap-2">
                {[...(contents.data ?? [])]
                  .sort((a, b) => b.costUsd - a.costUsd)
                  .slice(0, 6)
                  .map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3">
                      <span className="text-[12px] text-ink-2 min-w-0 truncate">{item.title}</span>
                      <span className="text-[12px] font-semibold text-ink ams-num shrink-0">
                        {item.costUsd > 0 ? formatUsd(item.costUsd) : '—'}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <p className="text-[10px] text-ink-3 mt-3 border-t border-line pt-3">
              O custo real por ativo é o que permite responder &ldquo;esse conteúdo valeu a pena?&rdquo;.
              Sem ele, a decisão fica pela metade.
            </p>
          </Card>

          <Card variant="strong" className="p-4">
            <SectionHead title="Onde cortar custo" hint="sugestão da IA" />
            <p className="text-[12px] text-ink-2">
              Reaproveitar cenário e trilha entre episódios do mesmo tema costuma reduzir o custo por
              vídeo sem mexer na qualidade percebida.
            </p>
            <p className="text-[11px] text-ink-3 mt-2">
              {contents.data
                ? `${(contents.data ?? []).filter((item: ContentItem) => item.costUsd > 40).length} conteúdos deste canal passaram de US$ 40.`
                : 'Carregando conteúdos…'}
            </p>
          </Card>

          <Card className="p-4">
            <SectionHead title="Crescimento de inscritos" hint="ainda não disponível" />
            <p className="text-[12px] text-ink-2">
              Este protótipo não traz a série de inscritos por dia. O número de inscritos do canal aparece
              no seletor de canal, mas o crescimento no período depende do YouTube Analytics e só entra
              quando a integração real existir.
            </p>
            <p className="text-[10px] text-ink-3 mt-2">NÃO VERIFICADO — dado ausente, não estimado.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
