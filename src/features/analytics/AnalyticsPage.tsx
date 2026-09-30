import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChartColumn, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { AiAction } from '@/components/ai/AiAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import {
  Card,
  EmptyState,
  ErrorState,
  IconTile,
  Pill,
  SectionHead,
  Skeleton,
  cn,
} from '@/components/ui/primitives';
import { useChannelId } from '@/app/useChannel';
import { useContents, useKpis } from '@/data/hooks';
import { CAMBIO_EXEMPLO_BRL_POR_USD } from '@/data/mock/db';
import { formatBrl, formatCompact, formatPct, formatRatio, formatUsd } from '@/lib/format';
import { formatDayMonth } from '@/lib/date';
import type { ContentItem, ContentMetrics } from '@/data/types';

/**
 * Analytics — a tela responde **uma** pergunta: *esse conteúdo valeu a pena?*
 *
 * Por isso custo e receita aparecem no mesmo bloco, com o mesmo período. Views sozinhas não decidem
 * nada (docs/00-visao-produto.md §8).
 */
export function AnalyticsPage() {
  const channelId = useChannelId();
  const kpis = useKpis(channelId);
  const contents = useContents(channelId);

  /**
   * Só conteúdo medido entra na conta — e o tipo carrega a métrica junto, para a leitura da IA nunca
   * receber `null` no lugar de um número.
   */
  const measured = useMemo(
    () =>
      (contents.data ?? []).filter(
        (item): item is ContentItem & { metrics: ContentMetrics } => item.metrics !== null,
      ),
    [contents.data],
  );

  /** Conteúdo escolhido na tela; sem escolha, o primeiro medido — que é o mais recente da lista. */
  const [analisadoId, setAnalisadoId] = useState<string | null>(null);
  const analisado = useMemo(
    () => measured.find((item) => item.id === analisadoId) ?? measured[0],
    [measured, analisadoId],
  );

  /**
   * Média do canal: média simples dos conteúdos **deste** canal com métrica medida. É a base da
   * comparação — sem ela a análise da IA não teria com o que comparar, e por isso o bloco não aparece.
   */
  const mediaCanal = useMemo(() => {
    let views = 0;
    let ctrPct = 0;
    let retencaoPct = 0;
    let quantidade = 0;
    for (const item of measured) {
      views += item.metrics.views;
      ctrPct += item.metrics.ctrPct;
      retencaoPct += item.metrics.retentionPct;
      quantidade += 1;
    }
    if (quantidade === 0) return null;
    return {
      views: views / quantidade,
      ctrPct: ctrPct / quantidade,
      retencaoPct: retencaoPct / quantidade,
    };
  }, [measured]);

  const totals = useMemo(() => {
    const revenue = measured.reduce((sum, item) => sum + (item.metrics?.revenueBrl ?? 0), 0);
    const costBrl = measured.reduce(
      (sum, item) => sum + item.costUsd * CAMBIO_EXEMPLO_BRL_POR_USD,
      0,
    );
    const retention =
      measured.length > 0
        ? measured.reduce((sum, item) => sum + (item.metrics?.retentionPct ?? 0), 0) / measured.length
        : 0;
    return { revenue, costBrl, result: revenue - costBrl, retention };
  }, [measured]);

  const best = useMemo(
    () =>
      [...measured].sort(
        (a, b) =>
          (b.metrics?.revenueBrl ?? 0) / Math.max(b.costUsd, 0.01) -
          (a.metrics?.revenueBrl ?? 0) / Math.max(a.costUsd, 0.01),
      )[0],
    [measured],
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Cada número vem com período, canal e data de medição. E com o custo ao lado — a pergunta é se valeu a pena, não se teve views."
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
            label="Retenção média"
            value={formatPct(totals.retention)}
            period={`${measured.length} ${measured.length === 1 ? 'conteúdo medido' : 'conteúdos medidos'}`}
            scope="Média simples dos conteúdos publicados deste canal"
            icon={<IconTile tone="cyan" size="sm"><ChartColumn size={15} /></IconTile>}
          />
          <StatCard
            label="Receita medida"
            value={formatBrl(totals.revenue)}
            period="conteúdos medidos"
            scope={`Estimativa do YouTube · ${measured.length} conteúdos`}
            icon={<IconTile tone="green" size="sm"><Wallet size={15} /></IconTile>}
          />
          <StatCard
            label="Custo de produção"
            value={formatBrl(totals.costBrl)}
            period="conteúdos medidos"
            scope={`Câmbio de exemplo ${CAMBIO_EXEMPLO_BRL_POR_USD.toFixed(2)} — não é cotação real`}
            icon={<IconTile tone="amber" size="sm"><Wallet size={15} /></IconTile>}
          />
          <StatCard
            label="Resultado"
            value={formatBrl(totals.result)}
            period="conteúdos medidos"
            scope={totals.result >= 0 ? 'Receita acima do custo' : 'Custo acima da receita'}
            icon={
              <IconTile tone={totals.result >= 0 ? 'green' : 'rose'} size="sm">
                {totals.result >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              </IconTile>
            }
          />
        </div>
      )}

      {contents.isLoading && <Skeleton className="h-[320px]" />}

      {contents.isError && (
        <Card className="p-4">
          <ErrorState message="Não conseguimos carregar os conteúdos deste canal." onRetry={contents.refetch} />
        </Card>
      )}

      {contents.data && measured.length === 0 && (
        <Card className="p-4">
          <EmptyState
            icon={<ChartColumn size={22} />}
            title="Ainda não há o que medir"
            description="Nenhum conteúdo deste canal foi publicado com dados suficientes. Sem medida não existe média do canal — e sem média a leitura da IA não teria com o que comparar. Assim que houver, ela aparece aqui."
            action={
              <Link to={`/c/${channelId}/conteudo`} className="ams-btn">
                Ver conteúdos do canal
              </Link>
            }
          />
        </Card>
      )}

      {measured.length > 0 && (
        <>
          <Card className="p-4 mb-4">
            <SectionHead
              step={1}
              title="Esse conteúdo valeu a pena?"
              hint="receita e custo no mesmo bloco, mesmo período"
            />
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="ams-table">
                <caption className="sr-only">
                  Comparação de receita, custo e desempenho por conteúdo publicado deste canal
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Conteúdo</th>
                    <th scope="col">Medido em</th>
                    <th scope="col">Views</th>
                    <th scope="col">CTR</th>
                    <th scope="col">Retenção</th>
                    <th scope="col">Custo</th>
                    <th scope="col">Receita</th>
                    <th scope="col">Retorno</th>
                    <th scope="col">Vs. média do canal</th>
                  </tr>
                </thead>
                <tbody>
                  {measured.map((item) => (
                    <AnalyticsRow key={item.id} item={item} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-ink-3 mt-3">
              Retorno = receita em R$ dividida pelo custo convertido pelo câmbio de exemplo. Número de
              exemplo do protótipo, não é cotação real.
            </p>
          </Card>

          {/*
            Leitura da IA sobre **um** conteúdo medido, comparado com a média dos conteúdos medidos
            deste canal. O câmbio é o mesmo `CAMBIO_EXEMPLO_BRL_POR_USD` usado na tabela — um número
            só, para a tela não explicar a conta de dois jeitos. A função é somente-leitura: ela não
            altera métrica, não aprova e não publica nada.
          */}
          {analisado && mediaCanal && (
            <Card className="p-4 mb-4">
              <SectionHead
                step={2}
                title="A IA lê este resultado"
                hint="compara com a média do canal e responde se valeu a pena"
              />

              <label
                className="block text-[11px] font-semibold text-ink-3 mb-1.5"
                htmlFor="analise-conteudo"
              >
                Conteúdo a analisar
              </label>
              <select
                id="analise-conteudo"
                value={analisado.id}
                onChange={(event) => setAnalisadoId(event.target.value)}
                className="w-full min-h-[40px] px-3 rounded-md bg-sunken border border-line text-[14px] text-ink outline-none focus:border-accent"
              >
                {measured.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-ink-3 mt-1.5">
                Comparação contra a média de {measured.length}{' '}
                {measured.length === 1 ? 'conteúdo medido' : 'conteúdos medidos'} deste canal.
              </p>

              <AiAction
                className="mt-3"
                functionId="medir-analise"
                channelId={channelId}
                contentId={analisado.id}
                input={() => ({
                  titulo: analisado.title.slice(0, 200),
                  formato: analisado.format,
                  views: Math.round(analisado.metrics.views),
                  ctrPct: analisado.metrics.ctrPct,
                  retencaoPct: analisado.metrics.retentionPct,
                  watchHours: analisado.metrics.watchHours,
                  receitaBrl: analisado.metrics.revenueBrl,
                  custoUsd: analisado.costUsd,
                  cambioBrlPorUsd: CAMBIO_EXEMPLO_BRL_POR_USD,
                  mediaCanal,
                })}
                label="Ler o desempenho deste conteúdo"
                hint="Cruza views, CTR, retenção, receita e custo real com a média do canal. Só leitura: nada é gravado."
              />
            </Card>
          )}

          {best && (
            <Card variant="strong" className="p-4">
              <SectionHead step={3} title="O que isso muda na próxima semana" hint="aprendizado, não relatório" />
              <p className="text-[13px] text-ink-2">
                <strong className="text-ink">{best.title}</strong> foi o conteúdo com melhor retorno do
                canal: {formatCompact(best.metrics?.views ?? 0)} views, CTR de{' '}
                {formatPct(best.metrics?.ctrPct ?? 0)} e{' '}
                {best.metrics ? formatSigned(best.metrics.vsChannelAvgPct) : '—'} de desempenho contra a
                média do canal, com custo de {formatUsd(best.costUsd)}.
              </p>
              <p className="text-[12px] text-ink-3 mt-2">
                Recomendação: repetir o tema &ldquo;{best.theme}&rdquo; mantendo o formato e o tempo de
                duração antes de testar uma variação nova.
              </p>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function AnalyticsRow({ item }: { item: ContentItem }) {
  const metrics = item.metrics;
  if (!metrics) return null;

  const costBrl = item.costUsd * CAMBIO_EXEMPLO_BRL_POR_USD;
  const returnRatio = costBrl > 0 ? metrics.revenueBrl / costBrl : 0;
  const worth = returnRatio >= 1;

  return (
    <tr>
      <td>
        <span className="block text-[12px] font-semibold text-ink max-w-[260px]">{item.title}</span>
        <span className="block text-[10px] text-ink-3">{item.theme}</span>
      </td>
      <td className="text-[11px] text-ink-3 whitespace-nowrap">
        {formatDayMonth(new Date(metrics.measuredAt))}
      </td>
      <td className="ams-num">{formatCompact(metrics.views)}</td>
      <td className="ams-num">{formatPct(metrics.ctrPct)}</td>
      <td className="ams-num">{formatPct(metrics.retentionPct)}</td>
      <td className="ams-num">{formatUsd(item.costUsd)}</td>
      <td className="ams-num">{formatBrl(metrics.revenueBrl)}</td>
      <td>
        <span
          className={cn(
            'text-[12px] font-semibold ams-num',
            worth ? 'text-ok' : 'text-danger',
          )}
        >
          {formatRatio(returnRatio)}
        </span>
      </td>
      <td>
        <span className="flex items-center gap-2">
          <Pill tone={metrics.vsChannelAvgPct >= 0 ? 'ok' : 'danger'} dot={false}>
            {formatSigned(metrics.vsChannelAvgPct)}
          </Pill>
          <span className="text-[11px] text-ink-3">{worth ? 'valeu a pena' : 'não se pagou'}</span>
        </span>
      </td>
    </tr>
  );
}

function formatSigned(value: number): string {
  if (value === 0) return 'na média';
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}%`;
}
