import { Link } from 'react-router-dom';
import { ArrowRight, Info, Layers } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Card,
  ChannelAvatar,
  EmptyState,
  ErrorState,
  Pill,
  SectionHead,
  Skeleton,
  cn,
} from '@/components/ui/primitives';
import { usePortfolio } from '@/data/hooks';
import { CAMBIO_EXEMPLO_BRL_POR_USD } from '@/data/mock/db';
import { formatBrl, formatCompact, formatPct, formatRatio } from '@/lib/format';

/**
 * Portfólio — a **única** tela que cruza canais, e ela é somente leitura.
 * Não existe aqui aprovar, publicar ou editar: toda linha é rotulada pelo canal.
 */
export function PortfolioPage() {
  const portfolio = usePortfolio();
  const rows = portfolio.data ?? [];

  const totals = rows.reduce(
    (acc, row) => ({
      views: acc.views + row.kpis.views,
      revenue: acc.revenue + row.kpis.revenueBrl,
      cost: acc.cost + row.kpis.productionCostUsd * CAMBIO_EXEMPLO_BRL_POR_USD,
      published: acc.published + row.kpis.published,
    }),
    { views: 0, revenue: 0, cost: 0, published: 0 },
  );

  return (
    <>
      <PageHeader
        title="Portfólio"
        subtitle="Comparação entre os canais, no mesmo período. Tela de leitura: nenhuma ação de canal acontece aqui."
      />

      {portfolio.isLoading && <Skeleton className="h-[280px]" />}

      {portfolio.isError && (
        <Card className="p-4">
          <ErrorState message="Não conseguimos carregar o portfólio." onRetry={portfolio.refetch} />
        </Card>
      )}

      {portfolio.data && rows.length === 0 && (
        <Card className="p-4">
          <EmptyState
            icon={<Layers size={22} />}
            title="Nenhum canal no portfólio"
            description="Conecte um canal para ver a comparação consolidada."
          />
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <Card className="p-4 mb-4">
            <SectionHead step={1} title="Todos os canais" hint="últimos 28 dias" />
            <div className="overflow-x-auto -mx-4 px-4">
              <table className="ams-table">
                <caption className="sr-only">
                  Comparação de desempenho e custo entre todos os canais, últimos 28 dias
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Canal</th>
                    <th scope="col">Inscritos</th>
                    <th scope="col">Views no período</th>
                    <th scope="col">Variação</th>
                    <th scope="col">Publicações</th>
                    <th scope="col">Receita</th>
                    <th scope="col">Custo</th>
                    <th scope="col">Retorno</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const costBrl = row.kpis.productionCostUsd * CAMBIO_EXEMPLO_BRL_POR_USD;
                    const ratio = costBrl > 0 ? row.kpis.revenueBrl / costBrl : 0;
                    const healthy = ratio >= 1;
                    return (
                      <tr key={row.channel.id}>
                        <td>
                          <span className="flex items-center gap-2.5">
                            <ChannelAvatar
                              initials={row.channel.initials}
                              size={30}
                              label={`Avatar do canal ${row.channel.name}`}
                            />
                            <span className="min-w-0">
                              <span className="block text-[12px] font-semibold text-ink">
                                {row.channel.name}
                              </span>
                              <span className="block text-[10px] text-ink-3">{row.channel.kind}</span>
                            </span>
                          </span>
                        </td>
                        <td className="ams-num">{formatCompact(row.channel.subscribers)}</td>
                        <td className="ams-num">{formatCompact(row.kpis.views)}</td>
                        <td>
                          <Pill tone={row.kpis.viewsDeltaPct >= 0 ? 'ok' : 'danger'} dot={false}>
                            {row.kpis.viewsDeltaPct >= 0 ? '+' : '−'}
                            {Math.abs(row.kpis.viewsDeltaPct)}%
                          </Pill>
                        </td>
                        <td className="ams-num">{row.kpis.published}</td>
                        <td className="ams-num">{formatBrl(row.kpis.revenueBrl)}</td>
                        <td className="ams-num">{formatBrl(costBrl)}</td>
                        <td>
                          <span
                            className={cn(
                              'text-[12px] font-semibold ams-num',
                              healthy ? 'text-ok' : 'text-danger',
                            )}
                          >
                            {formatRatio(ratio)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="text-[12px] font-semibold text-ink">Total do portfólio</td>
                    <td>—</td>
                    <td className="ams-num font-semibold text-ink">{formatCompact(totals.views)}</td>
                    <td>—</td>
                    <td className="ams-num font-semibold text-ink">{totals.published}</td>
                    <td className="ams-num font-semibold text-ink">{formatBrl(totals.revenue)}</td>
                    <td className="ams-num font-semibold text-ink">{formatBrl(totals.cost)}</td>
                    <td>
                      <span
                        className={cn(
                          'text-[12px] font-semibold ams-num',
                          totals.revenue >= totals.cost ? 'text-ok' : 'text-danger',
                        )}
                      >
                        {formatRatio(totals.cost > 0 ? totals.revenue / totals.cost : 0)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-[10px] text-ink-3 mt-3 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
              Retorno = receita em R$ sobre custo convertido pelo câmbio de exemplo (
              {CAMBIO_EXEMPLO_BRL_POR_USD.toFixed(2)}), que não é cotação real.
            </p>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {rows.map((row) => (
              <Card key={row.channel.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <ChannelAvatar
                    initials={row.channel.initials}
                    size={38}
                    label={`Avatar do canal ${row.channel.name}`}
                  />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{row.channel.name}</p>
                    <p className="text-[11px] text-ink-3 truncate">{row.channel.niche}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="ams-stat__label">CTR</dt>
                    <dd className="text-[15px] font-bold text-ink ams-num">
                      {formatPct(row.kpis.ctrPct)}
                    </dd>
                  </div>
                  <div>
                    <dt className="ams-stat__label">Watch time</dt>
                    <dd className="text-[15px] font-bold text-ink ams-num">
                      {formatCompact(row.kpis.watchHours)} h
                    </dd>
                  </div>
                </dl>
                <Link
                  to={`/c/${row.channel.id}/inicio`}
                  className="ams-btn w-full !min-h-[34px] !text-[12px] mt-auto"
                >
                  Abrir este canal
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}
