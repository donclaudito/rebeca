import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { AiAction } from '@/components/ai/AiAction';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  ArtSlot,
  Button,
  Card,
  ErrorState,
  IconTile,
  SectionHead,
  Skeleton,
  cn,
} from '@/components/ui/primitives';
import { StatusPill } from '@/components/content/ContentCard';
import { useChannelId } from '@/app/useChannel';
import { api, qk } from '@/data/client';
import { useChannel, useContents, useWeek } from '@/data/hooks';
import { formatDayMonth, isToday } from '@/lib/date';
import { WEEKDAY_SHORT, formatDuration } from '@/lib/format';
import type { ContentItem } from '@/data/types';

/** Calendário — a semana editorial do canal, com reagendamento explícito. */
export function CalendarioPage() {
  const channelId = useChannelId();
  const week = useWeek(channelId);
  const channel = useChannel(channelId);
  const contents = useContents(channelId);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [editing, setEditing] = useState<string | null>(null);

  /**
   * Sugestão de horário: só para conteúdo que **já passou pela aprovação humana** desta semana.
   * A IA sugere; quem muda a data é o botão "Reagendar" deste mesmo cartão.
   */
  const [sugestaoId, setSugestaoId] = useState<string | null>(null);

  const candidatos = useMemo(
    () =>
      (week.data ?? [])
        .map((slot) => slot.content)
        .filter(
          (item): item is ContentItem =>
            item !== null && (item.status === 'aprovado' || item.status === 'agendado'),
        ),
    [week.data],
  );

  const alvo = candidatos.find((item) => item.id === sugestaoId) ?? candidatos[0];

  /**
   * Histórico real de horários deste canal: só o que foi medido, com a data em que foi ao ar.
   * Histórico vazio é resposta válida — a função foi escrita para lidar com isso.
   */
  const historicoHorarios = (contents.data ?? [])
    .flatMap((item) => {
      const horario = item.publishedAt ?? item.scheduledAt;
      if (!item.metrics || !horario) return [];
      return [{ horario: horario.slice(0, 40), retencaoPct: item.metrics.retentionPct }];
    })
    .slice(0, 60);

  const fusoHorario = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const moved = params.get('reagendado');

  const reschedule = useMutation({
    mutationFn: ({ contentId, iso }: { contentId: string; iso: string }) =>
      api.reschedule(channelId, contentId, iso),
    onSuccess: async () => {
      setEditing(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: qk.week(channelId) }),
        queryClient.invalidateQueries({ queryKey: qk.contents(channelId) }),
        queryClient.invalidateQueries({ queryKey: qk.modules(channelId) }),
      ]);
    },
  });

  const slots = week.data ?? [];
  const scheduled = slots.filter((slot) => slot.content).length;

  return (
    <>
      <PageHeader
        title="Calendário"
        subtitle="O plano da semana deste canal. Reagendar é sempre uma ação sua — nada muda sozinho."
      />

      {moved === '1' && (
        <p className="ams-ribbon mb-3" role="status">
          Horário atualizado.
        </p>
      )}

      {week.isLoading && <Skeleton className="h-[420px]" />}

      {week.isError && (
        <Card className="p-4">
          <ErrorState message="Não conseguimos carregar a semana deste canal." onRetry={week.refetch} />
        </Card>
      )}

      {week.data && (
        <>
          <Card className="p-4 mb-4">
            <SectionHead
              title="Semana atual"
              hint={`${scheduled} de 7 dias com publicação`}
              action={
                <span className="flex items-center gap-1.5 text-ink-3">
                  <Button className="!min-h-[30px] !px-2" aria-label="Semana anterior (indisponível no protótipo)" disabled>
                    <ChevronLeft size={14} />
                  </Button>
                  <Button className="!min-h-[30px] !px-2" aria-label="Próxima semana (indisponível no protótipo)" disabled>
                    <ChevronRight size={14} />
                  </Button>
                </span>
              }
            />
            <p className="text-[11px] text-ink-3">
              A navegação entre semanas ainda não existe neste protótipo — a semana mostrada é sempre a
              corrente.
            </p>
          </Card>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
            {slots.map((slot) => {
              const date = new Date(`${slot.date}T12:00:00`);
              const today = isToday(date);
              const content = slot.content;

              return (
                <Card
                  key={slot.date}
                  variant={today ? 'strong' : 'glass'}
                  className={cn('p-3 flex flex-col gap-2.5 min-h-[190px]')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-bold text-ink">{WEEKDAY_SHORT[slot.weekday]}</p>
                      <p className="text-[10px] text-ink-3">{formatDayMonth(date)}</p>
                    </div>
                    {today && (
                      <span className="ams-pill ams-pill--info">hoje</span>
                    )}
                  </div>

                  {content ? (
                    <>
                      <ArtSlot
                        label={content.format === 'video' ? 'Vídeo' : 'Short'}
                        alt={`Thumbnail de ${content.title}`}
                      />
                      <Link
                        to={
                          content.status === 'revisao'
                            ? `/c/${channelId}/revisao/${content.id}`
                            : `/c/${channelId}/conteudo?aberto=${content.id}`
                        }
                        className="text-[12px] font-semibold text-ink leading-snug hover:underline"
                      >
                        {content.title}
                      </Link>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <StatusPill status={content.status} />
                        <span className="text-[10px] text-ink-3">{formatDuration(content.durationSec)}</span>
                      </div>

                      {editing === content.id ? (
                        <div className="flex flex-col gap-1.5 mt-auto" role="group" aria-label={`Reagendar ${content.title}`}>
                          <label className="text-[10px] text-ink-3" htmlFor={`quando-${content.id}`}>
                            Nova data e hora
                          </label>
                          <input
                            id={`quando-${content.id}`}
                            type="datetime-local"
                            defaultValue={content.scheduledAt ? content.scheduledAt.slice(0, 16) : ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) return;
                              reschedule.mutate({ contentId: content.id, iso: new Date(value).toISOString() });
                            }}
                            className="w-full min-h-[32px] px-2 rounded-md bg-sunken border border-line text-[12px] text-ink outline-none focus:border-accent"
                          />
                          <Button
                            className="!min-h-[30px] !text-[11px]"
                            onClick={() => setEditing(null)}
                          >
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          className="!min-h-[30px] !text-[11px] mt-auto"
                          onClick={() => setEditing(content.id)}
                          disabled={reschedule.isPending || content.status === 'publicado'}
                        >
                          {content.status === 'publicado' ? 'Já publicado' : 'Reagendar'}
                        </Button>
                      )}
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-4">
                      <IconTile tone="violet" size="sm">
                        <CalendarDays size={14} />
                      </IconTile>
                      <p className="text-[11px] text-ink-3">Sem publicação</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          <Card className="p-4 mt-4">
            <SectionHead title="Como o horário é escolhido" hint="a IA sugere, você decide" />
            <p className="text-[12px] text-ink-2">
              O melhor horário sai dos dados reais deste canal — não de uma regra genérica. Enquanto não
              houver dado suficiente, a sugestão vem marcada como sugestão e não altera nada sozinha.
            </p>

            {/*
              `agendar-horario` só sugere. Ele não toca em `scheduledAt` e não chama a ação de
              reagendar — quem muda a data continua sendo o clique humano no botão "Reagendar" do
              cartão do dia. O histórico vem dos conteúdos já medidos deste canal (pode vir vazio).
            */}
            {alvo ? (
              <div className="mt-3">
                <label
                  className="block text-[11px] font-semibold text-ink-3 mb-1.5"
                  htmlFor="sugestao-conteudo"
                >
                  Conteúdo a agendar
                </label>
                <select
                  id="sugestao-conteudo"
                  value={alvo.id}
                  onChange={(event) => setSugestaoId(event.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-md bg-sunken border border-line text-[14px] text-ink outline-none focus:border-accent"
                >
                  {candidatos.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} — {item.status === 'agendado' ? 'agendado' : 'aprovado'}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-ink-3 mt-1.5">
                  {historicoHorarios.length > 0
                    ? `Histórico usado: ${historicoHorarios.length} ${
                        historicoHorarios.length === 1 ? 'publicação medida' : 'publicações medidas'
                      } deste canal.`
                    : 'Este canal ainda não tem publicação medida: a sugestão vai sair sem histórico.'}
                </p>

                <AiAction
                  className="mt-3"
                  functionId="agendar-horario"
                  channelId={channelId}
                  contentId={alvo.id}
                  input={() => ({
                    ...(channel.data?.kind ? { publico: channel.data.kind.slice(0, 200) } : {}),
                    fusoHorario,
                    formato: alvo.format,
                    historicoHorarios,
                  })}
                  label="Sugerir melhor horário"
                  hint="Compara o histórico de horários deste canal e recomenda quando publicar. Não muda a data nem agenda nada."
                />
              </div>
            ) : (
              <p className="text-[11px] text-ink-3 mt-3 border-t border-line pt-3">
                Nenhum conteúdo aprovado ou agendado nesta semana para receber sugestão de horário. A
                sugestão parte de um conteúdo que já passou pela sua aprovação.
              </p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
