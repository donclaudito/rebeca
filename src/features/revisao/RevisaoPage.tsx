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
  ShieldCheck,
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
import { AiAction } from '@/components/ai/AiAction';
import { useChannelId } from '@/app/useChannel';
import { api, isApprovalValid, qk } from '@/data/client';
import { useChannel, useContent } from '@/data/hooks';
import { formatDayMonthTime } from '@/lib/date';
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
  // O canal diz se este conteúdo é dirigido a crianças — é o que libera (ou não) o gate pedagógico.
  const channel = useChannel(channelId).data;
  const idadeAlvo = ageRangeFrom(channel);

  const [title, setTitle] = useState('');
  const [selectedThumb, setSelectedThumb] = useState<string | null>(null);
  const [when, setWhen] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  /**
   * Veredito bloqueante do gate infantil. Enquanto for `true`, a aprovação fica travada nesta tela.
   * O `rebeca-qa` mostrou que o parecer existia mas ninguém o lia — gate que não bloqueia é parecer
   * com nome bonito. O veredito vive no estado da tela, então não sobrevive a recarregamento;
   * persistir o resultado no conteúdo é da camada de dados e está registrado como lacuna no ADR-006.
   */
  const [gateBloqueante, setGateBloqueante] = useState(false);

  // O rascunho nasce do servidor, nunca de estado herdado da tela anterior.
  useEffect(() => {
    if (!item) return;
    setTitle(item.seo.title);
    setSelectedThumb(item.selectedThumbnailId);
    setWhen(item.scheduledAt ? toLocalInput(item.scheduledAt) : '');
    setRejectReason('');
    setShowReject(false);
  }, [item]);

  // Trocar de conteúdo (ou de canal) limpa a mensagem da decisão anterior — e o veredito do gate,
  // que pertence ao conteúdo anterior e não ao que está aberto agora.
  useEffect(() => {
    setFeedback(null);
    setGateBloqueante(false);
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
    onSuccess: async (updated: ContentItem) => {
      setFeedback(
        updated.status === 'revisao'
          ? 'Thumbnail trocada. A aprovação anterior caiu — o conteúdo voltou para revisão: o que iria ao ar deixou de ser o que você aprovou.'
          : 'Thumbnail escolhida. Nada foi publicado ainda.',
      );
      await invalidate();
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const saveTitle = useMutation({
    mutationFn: () => api.saveTitle(channelId, contentId, title),
    onSuccess: async (updated: ContentItem) => {
      setFeedback(
        updated.status === 'revisao'
          ? 'Título salvo. A aprovação anterior caiu — revise e aprove de novo antes de publicar.'
          : 'Título salvo.',
      );
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
  const canApprove = Boolean(selectedThumb) && !busy && !gateBloqueante;

  const options = useMemo<ThumbnailOption[]>(() => item?.thumbnails ?? [], [item]);

  /** Aprovação vigente (ou `null`): a tela mostra o fato, não a intenção. */
  const aprovacaoVigente = item && isApprovalValid(item) ? item.approval : null;

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

      <div className="ams-split grid lg:grid-cols-12 gap-4" data-split="lg">
        {/* Player + metadados ------------------------------------------------ */}
        <div className="ams-split__main lg:col-span-8 flex flex-col gap-4">
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
                          'w-full text-left rounded-lg p-2 border transition-colors',
                          active
                            ? 'border-accent bg-surface-strong'
                            : 'border-line bg-surface hover:bg-surface-hover',
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
                          <span className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-accent">
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
                className="flex-1 min-w-[240px] min-h-[40px] px-3 rounded-md bg-sunken border border-line text-[14px] text-ink outline-none focus:border-accent"
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

            {/*
              Título, descrição e tags são funções mecânicas — é por isso que o nível de modelo desta
              função é o mais barato (skill `rebeca-prompt-eng`, princípio 7). O resultado só preenche
              o campo de título; salvar continua exigindo o clique em "Salvar título".
            */}
            <AiAction
              className="mt-4"
              functionId="criar-seo"
              channelId={channelId}
              contentId={item.id}
              input={() => ({
                titulo: item.title,
                tema: item.theme,
                roteiroResumo: `${item.hook} ${item.seo.description}`.trim(),
                canalNome: channel?.name ?? 'o canal',
                publico: channel?.niche ?? 'público do canal',
              })}
              label="Reescrever com a IA"
              hint="Gera título, descrição, tags e capítulos a partir deste conteúdo. Preenche o campo de título — salvar é decisão sua."
              onApply={(data) => {
                const proposta = data as { titulo?: unknown };
                if (typeof proposta.titulo === 'string') setTitle(proposta.titulo.slice(0, 100));
              }}
              applyLabel="Usar este título"
            />
          </Card>

          {/*
            Revisão assistida. Duas funções, dois papéis:
            - `revisar-qualidade` roda em qualquer canal e aplica a rubrica geral.
            - `revisar-infantil` só existe em canal dirigido a crianças e é o gate pedagógico
              (ECA Digital / LGPD). Ambas são **consultivas**: nenhuma das duas aprova, e por isso
              nenhuma delas mexe no estado deste conteúdo.
          */}
          <Card className="p-4">
            <SectionHead
              title="Peça uma segunda opinião"
              hint="a IA revisa e aponta o que corrigir — quem decide continua sendo você"
            />
            <div className="flex flex-col gap-3">
              <AiAction
                functionId="revisar-qualidade"
                channelId={channelId}
                contentId={item.id}
                input={() => ({
                  titulo: item.title,
                  roteiroResumo: `${item.hook} ${item.seo.description}`.trim(),
                  formato: item.format,
                  idadeAlvo,
                })}
                label="Revisar qualidade"
                hint="Originalidade, gancho, clareza e adequação etária, com o trecho que sustenta cada achado."
              />

              {channel?.childDirected && (
                <AiAction
                  functionId="revisar-infantil"
                  channelId={channelId}
                  contentId={item.id}
                  input={() => ({
                    titulo: item.title,
                    roteiroResumo: `${item.hook} ${item.seo.description}`.trim(),
                    idadeAlvo,
                  })}
                  label="Checar adequação infantil"
                  hint="Gate de canal infantil: faixa etária, ritmo, vocabulário, valores e conteúdo bloqueante."
                  onResult={(result) => {
                    // O veredito passa a **valer**: bloqueante trava a aprovação logo abaixo.
                    const data = result.data as { bloqueante?: unknown };
                    setGateBloqueante(data?.bloqueante === true);
                  }}
                />
              )}
            </div>
          </Card>
        </div>

        {/* Decisões ---------------------------------------------------------- */}
        <div id="barra-lateral-direita" className="ams-split__aside lg:col-span-4 flex flex-col gap-4">
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
              className="w-full min-h-[40px] px-3 rounded-md bg-sunken border border-line text-[14px] text-ink outline-none focus:border-accent"
            />
            <p className="text-[10px] text-ink-3 mt-1.5">
              Deixe vazio para aprovar sem agendar e escolher o horário depois.
            </p>

            {/*
              Estado da aprovação, visível: "aprovado" sem registro vigente é justamente o engano
              que este bloco existe para impedir. O humano precisa ver se a liberação vale para a
              versão que está na tela.
            */}
            <p
              className={cn(
                'text-[11px] mt-3 flex items-start gap-1.5',
                aprovacaoVigente ? 'text-ok' : 'text-ink-3',
              )}
              role="status"
            >
              <ShieldCheck size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              {aprovacaoVigente
                ? `Aprovação humana registrada em ${formatDayMonthTime(
                    new Date(aprovacaoVigente.approvedAt),
                  )} para esta versão.`
                : 'Sem aprovação vigente: esta versão não pode ser publicada.'}
            </p>

            {!selectedThumb && (
              <p className="text-[11px] text-warn mt-3 flex items-center gap-1.5" role="status">
                <Info size={13} aria-hidden="true" />
                Escolha uma thumbnail para liberar a aprovação.
              </p>
            )}

            {gateBloqueante && (
              <p
                className="text-[11.5px] text-danger mt-3 flex items-start gap-1.5 p-2.5 rounded-md border border-line bg-[color:var(--ams-glass-sunken)]"
                role="alert"
              >
                <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  A checagem de adequação infantil encontrou conteúdo <strong>bloqueante</strong> para
                  a faixa etária. A aprovação está travada até você trocar o conteúdo ou gerar nova
                  versão. Nada foi publicado.
                </span>
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
              <div className="mt-3 p-3 rounded-md bg-sunken border border-line">
                <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="motivo">
                  Por que este conteúdo não serve?
                </label>
                <textarea
                  id="motivo"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  rows={3}
                  placeholder="Ex.: o ritmo está lento demais para 3 a 5 anos."
                  className="w-full px-3 py-2 rounded-md bg-bg border border-line text-[14px] text-ink outline-none focus:border-accent resize-y"
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

/**
 * Faixa etária declarada pelo canal, quando ela existe no dado do canal.
 *
 * Não inventa faixa: canal não infantil recebe "público geral", e canal infantil cujo nicho não
 * declare a faixa recebe "crianças pequenas" — texto neutro em vez de número chutado. O prompt de
 * revisão usa esse valor como referência, então um número inventado aqui viraria critério errado lá.
 */
function ageRangeFrom(channel: { childDirected: boolean; niche: string } | undefined): string {
  if (!channel || !channel.childDirected) return 'público geral';
  const match = /(\d+\s*a\s*\d+\s*anos)/i.exec(channel.niche);
  return match?.[1] ?? 'crianças pequenas';
}
