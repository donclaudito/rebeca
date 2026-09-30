import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CalendarClock,
  Info,
  RefreshCw,
  Save,
  TriangleAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  ArtSlot,
  Button,
  Card,
  ErrorState,
  Pill,
  SectionHead,
  Skeleton,
  cn,
} from '@/components/ui/primitives';
import { StatusPill } from '@/components/content/ContentCard';
import { useChannelId } from '@/app/useChannel';
import { api, qk } from '@/data/client';
import { useContent } from '@/data/hooks';
import { formatDuration, formatUsd } from '@/lib/format';
import type { ContentItem, ThumbnailOption } from '@/data/types';

/**
 * Revisão — o coração do produto (docs/00-visao-produto.md §3.4).
 *
 * Uma tela = um conteúdo. O humano assiste, escolhe a thumbnail, ajusta o título e toma **uma** das
 * três decisões. A IA pode sugerir a melhor thumbnail, mas **nunca** deixa ela marcada: escolher é
 * do humano (AGENTS.md, invariante nº 1).
 */
export function RevisaoPage() {
  const channelId = useChannelId();
  const { contentId = '' } = useParams<{ contentId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const query = useContent(channelId, contentId);
  const item = query.data;

  const [title, setTitle] = useState('');
  const [selectedThumb, setSelectedThumb] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // O rascunho nasce do servidor, nunca de estado herdado da tela anterior.
  useEffect(() => {
    if (!item) return;
    setTitle(item.seo.title);
    setSelectedThumb(item.selectedThumbnailId);
    setWhen(item.scheduledAt ? toLocalInput(item.scheduledAt) : '');
    setRejectReason('');
    setShowReject(false);
  }, [item]);

  // Trocar de conteúdo (ou de canal) limpa a mensagem da decisão anterior.
  useEffect(() => {
    setFeedback(null);
  }, [channelId, contentId]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.content(channelId, contentId) }),
      queryClient.invalidateQueries({ queryKey: qk.contents(channelId) }),
      queryClient.invalidateQueries({ queryKey: qk.reviewQueue(channelId) }),
      queryClient.invalidateQueries({ queryKey: qk.modules(channelId) }),
      queryClient.invalidateQueries({ queryKey: qk.week(channelId) }),
    ]);
  };

  const chooseThumb = useMutation({
    mutationFn: (thumbnailId: string) => api.selectThumbnail(channelId, contentId, thumbnailId),
    onSuccess: async () => {
      setFeedback('Thumbnail escolhida. Nada foi publicado ainda.');
      await invalidate();
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const saveTitle = useMutation({
    mutationFn: () => api.saveTitle(channelId, contentId, title),
    onSuccess: async () => {
      setFeedback('Título salvo.');
      await invalidate();
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const approve = useMutation({
    mutationFn: () => api.approve(channelId, contentId, when ? new Date(when).toISOString() : null),
    onSuccess: async (updated: ContentItem) => {
      await invalidate();
      setFeedback(
        updated.status === 'agendado'
          ? 'Aprovado e agendado. O sistema publica no horário definido.'
          : 'Aprovado. Escolha o horário no calendário para publicar.',
      );
      navigate(`/c/${channelId}/conteudo`);
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const newVersion = useMutation({
    mutationFn: () => api.requestNewVersion(channelId, contentId),
    onSuccess: async () => {
      await invalidate();
      setFeedback('Pedido registrado: a IA vai gerar uma nova versão deste conteúdo.');
      navigate(`/c/${channelId}/conteudo`);
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const reject = useMutation({
    mutationFn: () => api.reject(channelId, contentId, rejectReason),
    onSuccess: async () => {
      await invalidate();
      setFeedback('Conteúdo substituído. O motivo vira aprendizado para a próxima pauta.');
      navigate(`/c/${channelId}/conteudo`);
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const busy =
    chooseThumb.isPending || saveTitle.isPending || approve.isPending || newVersion.isPending || reject.isPending;

  const titleDirty = Boolean(item) && title.trim() !== item?.seo.title;
  const canApprove = Boolean(selectedThumb) && !busy;

  const options = useMemo<ThumbnailOption[]>(() => item?.thumbnails ?? [], [item]);

  if (query.isLoading) {
    return (
      <>
        <PageHeader title="Revisão" subtitle="Carregando o conteúdo deste canal…" />
        <div className="grid lg:grid-cols-12 gap-4">
          <Skeleton className="lg:col-span-8 h-[420px]" />
          <Skeleton className="lg:col-span-4 h-[420px]" />
        </div>
      </>
    );
  }

  if (query.isError || !item) {
    return (
      <>
        <PageHeader title="Revisão" subtitle="Conteúdo do canal" />
        <Card className="p-4">
          <ErrorState
            title="Conteúdo não encontrado neste canal"
            message="Ou ele não existe, ou não pertence ao canal que está aberto. Nada de outro canal é exibido aqui."
            onRetry={query.refetch}
          />
          <div className="flex justify-center pb-6">
            <Link to={`/c/${channelId}/conteudo`} className="ams-btn">
              <ArrowLeft size={15} aria-hidden="true" />
              Voltar para Conteúdo
            </Link>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Revisão"
        subtitle="Assista, escolha a thumbnail, ajuste o título se quiser. Depois, uma das três decisões."
        actions={
          <Link to={`/c/${channelId}/conteudo`} className="ams-btn">
            <ArrowLeft size={15} aria-hidden="true" />
            Voltar
          </Link>
        }
      />

      <div className="grid lg:grid-cols-12 gap-4">
        {/* Player + metadados ------------------------------------------------ */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
              <div className="min-w-0">
                <h2 className="text-[18px] leading-snug">{item.title}</h2>
                <p className="text-[12px] text-ink-3 mt-1">{item.hook}</p>
              </div>
              <StatusPill status={item.status} />
            </div>

            <div className="ams-card ams-card--sunken p-0 overflow-hidden">
              <ArtSlot
                label={`Player · ${formatDuration(item.durationSec)}`}
                alt={`Prévia do vídeo ${item.title}, duração ${formatDuration(item.durationSec)}`}
                className="!rounded-none !border-0"
              />
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Meta label="Formato" value={item.format === 'video' ? 'Vídeo longo' : 'Short'} />
              <Meta label="Duração" value={formatDuration(item.durationSec)} />
              <Meta label="Tema" value={item.theme} />
              <Meta label="Custo real" value={formatUsd(item.costUsd)} />
            </dl>
          </Card>

          {/* Thumbnails ------------------------------------------------------ */}
          <Card className="p-4">
            <SectionHead
              step={1}
              title="Escolha a thumbnail"
              hint="a sugestão da IA vem marcada como sugestão, nunca escolhida por você"
            />
            {options.length === 0 ? (
              <p className="text-[12px] text-ink-3">
                Este conteúdo ainda não tem opções de thumbnail — elas aparecem quando a geração terminar.
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3" role="radiogroup" aria-label="Opções de thumbnail">
                {options.map((option) => {
                  const active = selectedThumb === option.id;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setSelectedThumb(option.id);
                          chooseThumb.mutate(option.id);
                        }}
                        disabled={busy}
                        className={cn(
                          'w-full text-left rounded-[14px] p-2 border transition-colors',
                          active
                            ? 'border-[color:var(--ams-cyan)] bg-surface-strong'
                            : 'border-line bg-surface hover:bg-surface-strong',
                        )}
                      >
                        <ArtSlot label={option.label} alt={option.alt} />
                        <span className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[11px] font-semibold text-ink truncate">{option.label}</span>
                          {option.suggested && (
                            <Pill tone="info" dot={false}>
                              sugestão da IA
                            </Pill>
                          )}
                        </span>
                        {active && (
                          <span className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-cyan">
                            <BadgeCheck size={12} aria-hidden="true" />
                            Escolhida por você
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Título e descrição --------------------------------------------- */}
          <Card className="p-4">
            <SectionHead step={2} title="Título e SEO" hint="edite se quiser — o rascunho é salvo antes de decidir" />
            <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="titulo">
              Título do vídeo
            </label>
            <div className="flex gap-2 flex-wrap">
              <input
                id="titulo"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={100}
                className="flex-1 min-w-[240px] min-h-[38px] px-3 rounded-[12px] bg-[color:var(--ams-glass-sunken)] border border-line text-[13px] text-ink outline-none focus:border-[color:var(--ams-cyan)]"
              />
              <Button
                onClick={() => saveTitle.mutate()}
                disabled={!titleDirty || busy || title.trim().length < 3}
              >
                <Save size={15} aria-hidden="true" />
                {saveTitle.isPending ? 'Salvando…' : 'Salvar título'}
              </Button>
            </div>
            <p className="text-[10px] text-ink-3 mt-1.5 ams-num">{title.length}/100 caracteres</p>

            <div className="mt-4">
              <p className="text-[11px] font-semibold text-ink-3 mb-1">Descrição gerada</p>
              <p className="text-[12px] text-ink-2 leading-relaxed">{item.seo.description}</p>
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold text-ink-3 mb-1.5">Tags</p>
              <ul className="flex flex-wrap gap-1.5">
                {item.seo.tags.map((tag) => (
                  <li key={tag}>
                    <Pill tone="neutral" dot={false}>
                      {tag}
                    </Pill>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>

        {/* Decisões ---------------------------------------------------------- */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card variant="strong" className="p-4">
            <SectionHead step={3} title="Sua decisão" hint="nada é publicado sem você" />

            <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="quando">
              Publicar em
            </label>
            <input
              id="quando"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="w-full min-h-[38px] px-3 rounded-[12px] bg-[color:var(--ams-glass-sunken)] border border-line text-[13px] text-ink outline-none focus:border-[color:var(--ams-cyan)]"
            />
            <p className="text-[10px] text-ink-3 mt-1.5">
              Deixe vazio para aprovar sem agendar e escolher o horário depois.
            </p>

            {!selectedThumb && (
              <p className="text-[11px] text-warn mt-3 flex items-center gap-1.5" role="status">
                <Info size={13} aria-hidden="true" />
                Escolha uma thumbnail para liberar a aprovação.
              </p>
            )}

            <div className="flex flex-col gap-2.5 mt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => approve.mutate()}
                disabled={!canApprove}
              >
                <BadgeCheck size={17} aria-hidden="true" />
                {approve.isPending ? 'Aprovando…' : 'Aprovar e agendar'}
              </Button>

              <Button
                onClick={() => newVersion.mutate()}
                disabled={busy}
                className="w-full"
                size="lg"
              >
                <RefreshCw size={16} aria-hidden="true" />
                {newVersion.isPending ? 'Pedindo nova versão…' : 'Gostei da ideia, gerar nova versão'}
              </Button>

              <Button
                variant="danger"
                onClick={() => setShowReject((value) => !value)}
                disabled={busy}
                className="w-full"
                size="lg"
                aria-expanded={showReject}
              >
                <Ban size={16} aria-hidden="true" />
                Substituir conteúdo
              </Button>
            </div>

            {showReject && (
              <div className="mt-3 p-3 rounded-[12px] bg-[color:var(--ams-glass-sunken)] border border-line">
                <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="motivo">
                  Por que este conteúdo não serve?
                </label>
                <textarea
                  id="motivo"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={3}
                  placeholder="Ex.: o ritmo está lento demais para 3 a 5 anos."
                  className="w-full px-3 py-2 rounded-[10px] bg-[color:var(--ams-bg-deep)] border border-line text-[12px] text-ink outline-none focus:border-[color:var(--ams-cyan)] resize-y"
                />
                <p className="text-[10px] text-ink-3 mt-1.5">
                  O motivo é obrigatório: é assim que a IA aprende o que você não quer ver de novo.
                </p>
                <Button
                  variant="danger"
                  className="w-full mt-2.5"
                  onClick={() => reject.mutate()}
                  disabled={busy || rejectReason.trim().length < 3}
                >
                  {reject.isPending ? 'Substituindo…' : 'Confirmar substituição'}
                </Button>
              </div>
            )}

            {feedback && (
              <p className="text-[11px] text-ink-2 mt-3 border-t border-line pt-3" role="status">
                {feedback}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <SectionHead title="O que a IA fez aqui" hint="por trás, sem aparecer para você" />
            <ul className="flex flex-col gap-2 text-[12px] text-ink-2">
              <li className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-ok shrink-0" aria-hidden="true" />
                Roteiro, cenas, narração e montagem prontos
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-ok shrink-0" aria-hidden="true" />
                {options.length} opções de thumbnail geradas
              </li>
              <li className="flex items-center gap-2">
                <BadgeCheck size={14} className="text-ok shrink-0" aria-hidden="true" />
                Título, descrição e tags preparados
              </li>
              <li className="flex items-center gap-2">
                <CalendarClock size={14} className="text-info shrink-0" aria-hidden="true" />
                Aguardando somente a sua decisão
              </li>
            </ul>
            {item.rejectedReason && (
              <p className="text-[11px] text-warn mt-3 flex items-start gap-1.5 border-t border-line pt-3">
                <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                Última rejeição sua: {item.rejectedReason}
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ams-stat__label">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** ISO → valor de `<input type="datetime-local">` no fuso local, sem passar por UTC. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
