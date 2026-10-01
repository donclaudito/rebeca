import { Link } from 'react-router-dom';
import { CalendarClock, ClipboardCheck, X } from 'lucide-react';
import { ArtSlot, Button, Card, Pill, SectionHead } from '@/components/ui/primitives';
import { STATUS_META, formatLabel } from '@/components/status';
import { formatCompact, formatDuration, formatUsd } from '@/lib/format';
import { formatDayMonthTime } from '@/lib/date';
import type { ChannelId, ContentItem } from '@/data/types';

interface ContentDetailProps {
  item: ContentItem;
  channelId: ChannelId;
  onClose: () => void;
}

/**
 * O conteúdo **aberto**: o destino do clique no cartão da biblioteca, do calendário e do início.
 *
 * Por que este componente existe: os três lugares já apontavam para `/c/:canal/conteudo?aberto=<id>`
 * e a tela de destino **nunca leu o parâmetro** — o clique levava para a mesma página, sem abrir nada.
 * Do lado de quem usa, o cartão "parecia sem função". O conserto é honrar o contrato que já existia,
 * em vez de inventar outra rota.
 *
 * O que ele mostra, e o que ele **não** faz:
 * - Mostra os fatos do conteúdo: thumbnail escolhida, estado, agendamento, custo real, SEO, as opções
 *   de thumbnail, a aprovação vigente e o motivo da última rejeição.
 * - **Não decide nada.** Aprovar, gerar nova versão e substituir continuam na tela de Revisão — é lá
 *   que fica o portão humano (invariante nº 1). Aqui só se lê, e há um atalho para a Revisão.
 * - Nada de dado inventado: campo ausente aparece como ausente ("custo não lançado", "Sem aprovação
 *   vigente"), nunca como zero fingido.
 */
export function ContentDetail({ item, channelId, onClose }: ContentDetailProps) {
  const meta = STATUS_META[item.status];
  const chosen = item.thumbnails.find((thumb) => thumb.id === item.selectedThumbnailId) ?? null;
  const capa = chosen ?? item.thumbnails[0] ?? null;

  return (
    <Card className="p-4 mb-4">
      <div role="region" aria-label={`Conteúdo aberto: ${item.title}`}>
        <SectionHead
          step={1}
          title="Conteúdo aberto"
          hint="o que este conteúdo é, hoje, sem sair da biblioteca"
          action={
            <Button onClick={onClose} aria-label="Fechar o conteúdo aberto">
              <X size={14} aria-hidden="true" />
              Fechar
            </Button>
          }
        />

        <div className="grid md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 mt-3">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="relative">
              <ArtSlot
                label={capa ? `Thumbnail: ${capa.label}` : 'Thumbnail'}
                alt={capa ? capa.alt : `Espaço da thumbnail de ${item.title}`}
              />
              <span className="ams-thumb__badge">{formatDuration(item.durationSec)}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone={meta.tone}>{meta.label}</Pill>
              <span className="text-[12px] text-ink-3">{formatLabel(item.format)}</span>
              <span className="text-[12px] text-ink-3" aria-hidden="true">
                ·
              </span>
              <span className="text-[12px] text-ink-2 truncate">{item.theme}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-0">
            <div>
              <h3 className="text-[16px] font-semibold text-ink leading-snug m-0">{item.title}</h3>
              <p className="text-[13px] text-ink-3 mt-1 mb-0">{item.hook}</p>
            </div>

            <dl className="grid sm:grid-cols-2 gap-x-4 gap-y-2 m-0 text-[12.5px]">
              <Fato
                rotulo="Agendamento"
                valor={
                  item.scheduledAt
                    ? formatDayMonthTime(new Date(item.scheduledAt))
                    : 'Sem data definida'
                }
              />
              <Fato
                rotulo="Custo real do ativo"
                valor={item.costUsd > 0 ? formatUsd(item.costUsd) : 'custo não lançado'}
              />
              {item.metrics && (
                <>
                  <Fato rotulo="Views" valor={formatCompact(item.metrics.views)} />
                  <Fato
                    rotulo="Retenção"
                    valor={`${item.metrics.retentionPct.toLocaleString('pt-BR')}% · ${item.metrics.vsChannelAvgPct >= 0 ? '+' : ''}${item.metrics.vsChannelAvgPct.toLocaleString('pt-BR')}% vs. média do canal`}
                  />
                </>
              )}
            </dl>

            <p className="text-[12px] text-ink-3 m-0 flex items-start gap-1.5">
              <ClipboardCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              {item.approval
                ? `Aprovação humana registrada em ${formatDayMonthTime(new Date(item.approval.approvedAt))}${item.approval.scheduledAt ? `, para ${formatDayMonthTime(new Date(item.approval.scheduledAt))}` : ''}.`
                : 'Sem aprovação vigente: esta versão não pode ser publicada.'}
            </p>

            {item.rejectedReason && (
              <p className="text-[12px] text-warn m-0">
                Última rejeição humana: {item.rejectedReason}
              </p>
            )}

            <div>
              <p className="text-[11px] font-semibold text-ink-2 mb-1">Título e SEO preparados</p>
              <p className="text-[12.5px] text-ink m-0">{item.seo.title}</p>
              <p className="text-[12px] text-ink-3 mt-1 mb-0">{item.seo.description}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {item.seo.tags.map((tag) => (
                  <span key={tag} className="ams-chip">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-ink-2 mb-1">
                Opções de thumbnail ({item.thumbnails.length})
              </p>
              {item.thumbnails.length === 0 ? (
                <p className="text-[12px] text-ink-3 m-0">
                  Nenhuma arte foi gerada para este conteúdo ainda.
                </p>
              ) : (
                <ul className="flex flex-col gap-1.5 m-0 p-0 list-none">
                  {item.thumbnails.map((thumb) => (
                    <li key={thumb.id} className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12.5px] text-ink">{thumb.label}</span>
                      {thumb.id === item.selectedThumbnailId ? (
                        <Pill tone="ok" dot={false}>
                          escolhida
                        </Pill>
                      ) : thumb.suggested ? (
                        <Pill tone="info" dot={false}>
                          sugerida pela IA
                        </Pill>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-divider">
              <Link to={`/c/${channelId}/revisao/${item.id}`} className="ams-btn">
                <CalendarClock size={14} aria-hidden="true" />
                Abrir na revisão
              </Link>
              <span className="text-[11.5px] text-ink-3">
                Aprovar, gerar nova versão e substituir ficam na tela de Revisão — aqui só se lê.
              </span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Fato({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] text-ink-3">{rotulo}</dt>
      <dd className="text-ink m-0 truncate">{valor}</dd>
    </div>
  );
}
