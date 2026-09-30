import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  ChartColumn,
  Coins,
  Eye,
  Lightbulb,
  Sparkles,
  Upload,
} from 'lucide-react';
import { AiAction } from '@/components/ai/AiAction';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModuleCard } from '@/components/ui/ModuleCard';
import { StatCard } from '@/components/ui/StatCard';
import {
  ArtSlot,
  Card,
  ChannelAvatar,
  EmptyState,
  ErrorState,
  IconTile,
  Pill,
  ProgressBar,
  SectionHead,
  Skeleton,
} from '@/components/ui/primitives';
import { StatusPill } from '@/components/content/ContentCard';
import { useChannelId } from '@/app/useChannel';
import {
  useChannel,
  useContents,
  useKpis,
  useModules,
  useRecommendations,
  useReviewQueue,
  useWeek,
} from '@/data/hooks';
import { formatBrl, formatCompact, formatPct, formatUsd } from '@/lib/format';
import { formatDayMonth, startOfWeek, toIsoDate } from '@/lib/date';
import { WEEKDAY_SHORT } from '@/lib/format';
import type { ContentItem } from '@/data/types';

/**
 * Início — "veja o que a IA preparou" (docs/00-visao-produto.md §6).
 *
 * A ordem da tela é intencional: **primeiro o que espera decisão humana**, depois os números, depois
 * o resto. O usuário abre o app para decidir, não para admirar gráfico.
 */
export function InicioPage() {
  const channelId = useChannelId();

  const kpis = useKpis(channelId);
  const queue = useReviewQueue(channelId);
  const modules = useModules(channelId);
  const week = useWeek(channelId);
  const contents = useContents(channelId);
  const recommendations = useRecommendations(channelId);
  const channel = useChannel(channelId);

  const generating = (contents.data ?? []).filter((item) => item.status === 'gerando');
  const failed = (contents.data ?? []).filter((item) => item.status === 'falhou');

  /* ------------------------------------------------------------------ IA --
     Contexto real do canal para as funções de IA. Nada aqui é inventado: os temas saem do que já
     existe no canal, as rejeições são motivos que o humano registrou e o "público" é o tipo de canal
     declarado. A saturação de tema NÃO é enviada — ela é saída de uma pesquisa anterior e não fica
     guardada em lugar nenhum; estimá-la aqui seria inventar número.
  */
  const channelData = channel.data;
  const channelContents = contents.data ?? [];

  const recentThemes = [...new Set(channelContents.map((item) => item.theme))]
    .slice(0, 30)
    .map((theme) => theme.slice(0, 120));

  const rejectionReasons = channelContents
    .map((item) => item.rejectedReason)
    .filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0);

  const rejectedThemes = rejectionReasons.slice(0, 30).map((reason) => reason.slice(0, 120));
  const rejeicoes = rejectionReasons.slice(0, 20).map((reason) => reason.slice(0, 400));

  const historico = channelContents.map((item) => item.title.slice(0, 200)).slice(0, 40);

  /** Temas fortes = temas de conteúdos medidos que ficaram na média do canal ou acima dela. */
  const temasFortes = [
    ...new Set(
      channelContents
        .filter((item) => item.metrics !== null && item.metrics.vsChannelAvgPct >= 0)
        .map((item) => item.theme),
    ),
  ]
    .slice(0, 20)
    .map((theme) => theme.slice(0, 120));

  const pautaAtual = (week.data ?? [])
    .map((slot) => slot.content)
    .filter((item): item is ContentItem => item !== null)
    .slice(0, 20)
    .map((item) => item.title.slice(0, 200));

  const padroes = (recommendations.data ?? [])
    .slice(0, 20)
    .map((rec) => `${rec.title} — ${rec.rationale}`.slice(0, 400));

  /** Frequência observada na semana corrente; sem dia ocupado não há número a enviar. */
  const videosPorSemana = (week.data ?? []).filter((slot) => slot.content !== null).length;
  const weekStart = week.data?.[0]?.date ?? toIsoDate(startOfWeek());

  return (
    <>
      <PageHeader
        title="Início"
        subtitle="O que a IA preparou para o seu canal, o plano da semana e o que ela aprendeu com os resultados."
      />

      <div className="ams-split grid grid-cols-1 xl:grid-cols-12 gap-4" data-split="xl">
        <div className="ams-split__main xl:col-span-8 flex flex-col gap-4">
          {/* 1. Fila de aprovação — o coração do produto */}
          <Card variant="strong" className="p-4">
            {queue.isLoading && <Skeleton className="h-[132px]" />}

            {queue.isError && (
              <ErrorState
                message="Não conseguimos carregar a fila de aprovação deste canal."
                onRetry={queue.refetch}
              />
            )}

            {queue.data && queue.data.length === 0 && (
              <EmptyState
                icon={<BadgeCheck size={22} />}
                title="Nada aguardando você"
                description="Nenhum conteúdo esperando aprovação neste canal. Quando a IA terminar o próximo, ele aparece aqui."
                action={
                  <Link to={`/c/${channelId}/conteudo`} className="ams-btn">
                    Ver todos os conteúdos
                  </Link>
                }
              />
            )}

            {queue.data && queue.data.length > 0 && (
              <>
                <SectionHead
                  step={1}
                  title="Seu trabalho agora: revisar e aprovar"
                  hint={`${queue.data.length} ${
                    queue.data.length === 1 ? 'conteúdo aguardando' : 'conteúdos aguardando'
                  } você`}
                />
                <ul className="grid sm:grid-cols-2 gap-3">
                  {queue.data.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/c/${channelId}/revisao/${item.id}`}
                        className="ams-module"
                        aria-label={`Revisar ${item.title}`}
                      >
                        <span className="w-[84px] shrink-0">
                          <ArtSlot label="Thumb" alt={`Espaço da thumbnail de ${item.title}`} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="ams-module__title truncate">{item.title}</span>
                          <span className="ams-module__desc block">
                            {item.thumbnails.length} opções de thumbnail · {item.theme}
                          </span>
                          <span className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <StatusPill status={item.status} />
                            <Pill tone="neutral" dot={false}>
                              custo {formatUsd(item.costUsd)}
                            </Pill>
                          </span>
                        </span>
                        <ArrowRight size={16} className="text-ink-3 shrink-0 mt-1" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          {/* 2. Trabalho em andamento (job longo) */}
          {generating.length > 0 && (
            <Card className="p-4">
              <SectionHead
                step={2}
                title="Trabalho em andamento"
                hint="você pode sair desta tela — o trabalho continua"
              />
              <ul className="flex flex-col gap-3">
                {generating.map((item) => (
                  <li key={item.id} className="flex items-center gap-3">
                    <IconTile tone="violet">
                      <Sparkles size={18} />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink truncate">{item.title}</p>
                      <ProgressBar value={62} label="Gerando cenas 5 de 8" />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* 3. Números do canal */}
          <section aria-label="Indicadores do canal">
            <SectionHead
              step={3}
              title="Como o canal está"
              hint="últimos 28 dias"
              action={
                <Link
                  to={`/c/${channelId}/analytics`}
                  className="ams-btn !min-h-[32px] !px-3 !text-[12px]"
                >
                  Ver analytics
                </Link>
              }
            />

            {kpis.isLoading && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-[124px]" />
                ))}
              </div>
            )}

            {kpis.isError && (
              <Card className="p-4">
                <ErrorState
                  message="Não conseguimos carregar os indicadores deste canal."
                  onRetry={kpis.refetch}
                />
              </Card>
            )}

            {kpis.data && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  label="Visualizações"
                  value={formatCompact(kpis.data.views)}
                  deltaPct={kpis.data.viewsDeltaPct}
                  period={`${kpis.data.periodDays} dias`}
                  scope="Canal inteiro · contra os 28 dias anteriores"
                  icon={
                    <IconTile tone="cyan" size="sm">
                      <Eye size={15} />
                    </IconTile>
                  }
                />
                <StatCard
                  label="Receita"
                  value={formatBrl(kpis.data.revenueBrl)}
                  deltaPct={kpis.data.revenueDeltaPct}
                  period={`${kpis.data.periodDays} dias`}
                  scope="Estimativa do YouTube no período"
                  icon={
                    <IconTile tone="green" size="sm">
                      <Coins size={15} />
                    </IconTile>
                  }
                />
                <StatCard
                  label="Publicações"
                  value={String(kpis.data.published)}
                  deltaPct={kpis.data.publishedDeltaPct}
                  period={`${kpis.data.periodDays} dias`}
                  scope="Vídeos longos e Shorts somados"
                  icon={
                    <IconTile tone="violet" size="sm">
                      <Upload size={15} />
                    </IconTile>
                  }
                />
                <StatCard
                  label="CTR médio"
                  value={formatPct(kpis.data.ctrPct)}
                  period={`${kpis.data.periodDays} dias`}
                  scope={`RPM ${formatBrl(kpis.data.rpmBrl)} por mil views`}
                  icon={
                    <IconTile tone="amber" size="sm">
                      <ChartColumn size={15} />
                    </IconTile>
                  }
                />
              </div>
            )}
          </section>

          {/* 4. O que a IA pode fazer agora -------------------------------------
              Três funções de leitura/planejamento, com o contexto real deste canal. Nenhuma delas
              grava, aprova ou publica: a saída aparece para ser lida e a decisão continua humana.
              O bloco só existe depois que o canal carregou — sem `niche`/`kind` não há entrada. */}
          {channelData && (
            <section aria-label="O que a IA pode fazer agora">
              <SectionHead
                step={4}
                title="O que a IA pode fazer agora"
                hint="três leituras deste canal — nenhuma delas grava, aprova ou publica"
              />
              <div className="grid gap-3">
                <AiAction
                  functionId="pesquisar-tendencia"
                  channelId={channelId}
                  input={() => ({
                    niche: channelData.niche.slice(0, 200),
                    audience: channelData.kind.slice(0, 200),
                    recentThemes,
                    rejectedThemes,
                  })}
                  label="Pesquisar tendências do nicho"
                  hint="Lê o nicho, o que o canal já fez e o que você recusou, e devolve temas com potencial e saturação estimada."
                />

                <AiAction
                  functionId="planejar-pauta"
                  channelId={channelId}
                  input={() => ({
                    niche: channelData.niche.slice(0, 200),
                    audience: channelData.kind.slice(0, 200),
                    weekStart: weekStart.slice(0, 40),
                    historico,
                    temasFortes,
                    ...(videosPorSemana > 0 ? { videosPorSemana: Math.min(videosPorSemana, 14) } : {}),
                  })}
                  label="Planejar a semana"
                  hint="Monta a pauta da semana cruzando o que funcionou, o que você recusou e a sua frequência. É proposta, não agenda."
                />

                <AiAction
                  functionId="melhorar-plano"
                  channelId={channelId}
                  input={() => ({
                    canalNome: channelData.name.slice(0, 120),
                    padroes,
                    pautaAtual,
                    rejeicoes,
                  })}
                  label="Melhorar a próxima semana"
                  hint="Transforma o aprendizado do canal em mudanças concretas de pauta para a semana seguinte."
                />
              </div>
            </section>
          )}

          {/* 5. Módulos do ciclo */}
          <section aria-label="Módulos do ciclo">
            <SectionHead step={5} title="O ciclo do canal" hint="cada módulo mostra onde o canal está agora" />
            {modules.isLoading && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-[84px]" />
                ))}
              </div>
            )}
            {modules.isError && (
              <Card className="p-4">
                <ErrorState message="Não conseguimos carregar o ciclo deste canal." onRetry={modules.refetch} />
              </Card>
            )}
            {modules.data && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {modules.data.map((mod) => (
                  <ModuleCard key={mod.id} module={mod} channelId={channelId} />
                ))}
              </div>
            )}
          </section>

          {/* 6. Falhas que precisam de você */}
          {failed.length > 0 && (
            <Card className="p-4">
              <SectionHead step={6} title="Precisa da sua atenção" hint="conteúdos que falharam" />
              <ul className="flex flex-col gap-2">
                {failed.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="text-[13px] text-ink-2 min-w-0 truncate">{item.title}</span>
                    <span className="flex items-center gap-2">
                      <StatusPill status={item.status} />
                      <Link
                        to={`/c/${channelId}/conteudo?aberto=${item.id}`}
                        className="ams-btn !min-h-[32px] !px-3 !text-[12px]"
                      >
                        Ver o que houve
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* Coluna lateral ---------------------------------------------------- */}
        <div id="barra-lateral-direita" className="ams-split__aside xl:col-span-4 flex flex-col gap-4">
          <Card className="p-4">
            <SectionHead
              title="Plano da semana"
              hint="segunda a domingo"
              action={
                <Link
                  to={`/c/${channelId}/calendario`}
                  className="ams-section-hint hover:text-ink inline-flex items-center gap-1"
                >
                  Ver tudo <ArrowRight size={12} aria-hidden="true" />
                </Link>
              }
            />

            {week.isLoading && <Skeleton className="h-[240px]" />}
            {week.isError && (
              <ErrorState message="Não conseguimos carregar a semana deste canal." onRetry={week.refetch} />
            )}
            {week.data && (
              <ul className="flex flex-col gap-2">
                {week.data.map((slot) => {
                  const date = new Date(`${slot.date}T12:00:00`);
                  return (
                    <li key={slot.date} className="flex items-center gap-2.5">
                      <span className="w-11 shrink-0 text-[11px] font-semibold text-ink-3">
                        <span className="block text-ink-2">{WEEKDAY_SHORT[slot.weekday]}</span>
                        {formatDayMonth(date)}
                      </span>
                      {slot.content ? (
                        <Link
                          to={
                            slot.content.status === 'revisao'
                              ? `/c/${channelId}/revisao/${slot.content.id}`
                              : `/c/${channelId}/conteudo?aberto=${slot.content.id}`
                          }
                          className="flex-1 min-w-0 flex items-center gap-2 p-1.5 rounded-md hover:bg-surface-hover"
                          aria-label={`${slot.content.title}, ${WEEKDAY_SHORT[slot.weekday]}`}
                        >
                          <span className="w-[46px] shrink-0">
                            <ArtSlot label="" alt={`Miniatura de ${slot.content.title}`} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-semibold text-ink truncate">
                              {slot.content.title}
                            </span>
                            <span className="block text-[10px] text-ink-3">
                              {slot.content.scheduledAt
                                ? `${String(new Date(slot.content.scheduledAt).getHours()).padStart(2, '0')}h`
                                : 'sem horário'}
                            </span>
                          </span>
                          <StatusPill status={slot.content.status} />
                        </Link>
                      ) : (
                        <span className="flex-1 text-[11px] text-ink-3 py-2">Sem publicação</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <Link
              to={`/c/${channelId}/calendario`}
              className="ams-btn w-full mt-3 !min-h-[34px] !text-[12px]"
            >
              <CalendarDays size={14} aria-hidden="true" />
              Ver calendário completo
            </Link>
          </Card>

          <Card className="p-4">
            <SectionHead title="O que a IA aprendeu" hint="muda a pauta da próxima semana" />
            {recommendations.isLoading && <Skeleton className="h-[180px]" />}
            {recommendations.isError && (
              <ErrorState
                message="Não conseguimos carregar os aprendizados deste canal."
                onRetry={recommendations.refetch}
              />
            )}
            {recommendations.data && recommendations.data.length === 0 && (
              <EmptyState
                icon={<Lightbulb size={20} />}
                title="Ainda sem aprendizado"
                description="Assim que houver vídeos publicados com dados suficientes, o que funcionou aparece aqui."
              />
            )}
            {recommendations.data && recommendations.data.length > 0 && (
              <ul className="flex flex-col gap-2.5">
                {recommendations.data.map((rec) => (
                  <li key={rec.id} className="flex gap-2.5">
                    <IconTile tone={rec.tone} size="sm">
                      <Lightbulb size={15} />
                    </IconTile>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-ink leading-snug">{rec.title}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">{rec.rationale}</p>
                      <p className="text-[10px] text-ink-3 mt-1 ams-num">confiança {rec.confidencePct}%</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <SectionHead title="É simples assim" hint="o app faz o trabalho pesado" />
            <ol className="flex flex-col gap-2.5">
              {[
                { icon: <Sparkles size={15} />, text: 'A IA cria todo o conteúdo.' },
                { icon: <Eye size={15} />, text: 'Você revisa no painel.' },
                { icon: <Bell size={15} />, text: 'Clica em aprovar.' },
                { icon: <Upload size={15} />, text: 'O sistema agenda e publica.' },
                { icon: <Lightbulb size={15} />, text: 'A IA aprende e traz os resultados.' },
              ].map((step, index) => (
                <li key={step.text} className="flex items-center gap-2.5">
                  <span className="ams-section-num shrink-0" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="text-[12px] text-ink-2 flex items-center gap-2">
                    <span className="text-ink-3" aria-hidden="true">
                      {step.icon}
                    </span>
                    {step.text}
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          <ChannelIdentityCard channelId={channelId} />
        </div>
      </div>
    </>
  );
}

/** Bloco de identidade do canal — o cartão que os modelos mostram no topo direito. */
function ChannelIdentityCard({ channelId }: { channelId: string }) {
  const channel = useChannel(channelId);
  const kpis = useKpis(channelId);
  const contents = useContents(channelId);
  const queue = useReviewQueue(channelId);

  const published = (contents.data ?? []).filter((item) => item.status === 'publicado').length;
  const inReview = queue.data?.length ?? 0;

  return (
    <Card variant="strong" className="p-4">
      <SectionHead title="Este canal" hint="um canal por vez, como no YouTube Studio" />

      {channel.isLoading && <Skeleton className="h-[92px]" />}
      {channel.isError && (
        <ErrorState message="Não conseguimos carregar os dados deste canal." onRetry={channel.refetch} />
      )}
      {channel.data && (
        <>
          <div className="flex items-center gap-3 mb-3">
            <ChannelAvatar
              initials={channel.data.initials}
              size={44}
              label={`Avatar do canal ${channel.data.name}`}
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink truncate">{channel.data.name}</p>
              <p className="text-[11px] text-ink-3 truncate">
                {channel.data.kind} · {formatCompact(channel.data.subscribers)} inscritos
              </p>
              <p className="text-[11px] text-ink-3 mt-0.5">
                {inReview} aguardando · {published} publicados medidos
              </p>
            </div>
          </div>

          {kpis.data && (
            <dl className="grid grid-cols-2 gap-2.5">
              <div>
                <dt className="ams-stat__label">Views totais</dt>
                <dd className="text-[16px] font-bold text-ink ams-num">
                  {formatCompact(channel.data.totalViews)}
                </dd>
                <dd className="text-[10px] text-ink-3">histórico do canal</dd>
              </div>
              <div>
                <dt className="ams-stat__label">Custo de produção</dt>
                <dd className="text-[16px] font-bold text-ink ams-num">
                  {formatUsd(kpis.data.productionCostUsd)}
                </dd>
                <dd className="text-[10px] text-ink-3">últimos {kpis.data.periodDays} dias</dd>
              </div>
            </dl>
          )}

          <p className="text-[10px] text-ink-3 mt-3 border-t border-line pt-2">
            Dados atualizados em{' '}
            {kpis.data
              ? `${formatDayMonth(new Date(kpis.data.updatedAt))} às ${String(
                  new Date(kpis.data.updatedAt).getHours(),
                ).padStart(2, '0')}h`
              : '—'}
          </p>
        </>
      )}
    </Card>
  );
}
