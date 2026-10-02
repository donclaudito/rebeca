/**
 * Mídia gerada — o que o pipeline escreveu no disco, com o rótulo que cada ativo merece.
 *
 * **Por que esta tela existe.** O dono do produto rodou o pipeline da Fase 0, os 13 arquivos foram
 * gerados de verdade em `.rebeca/assets/luna/luna-ep-001/`, e a interface continuou dizendo "nenhum
 * vídeo foi gerado ainda". Nada no app lia o manifesto: a camada de dados mostra o banco de exemplo e o
 * pipeline escreve no disco. Ele gerou — e não apareceu.
 *
 * Três decisões de honestidade que moldam a tela:
 *
 * 1. **Ela diz o que o ativo é, não o que seria bom que fosse.** Todo ativo de provedor simulado aparece
 *    com o rótulo "simulado" e a tela deixa escrito, sem rodeio, que isto é **prova de máquina e não arte
 *    publicável**. Foi exatamente esse o defeito corrigido antes, quando a tela de Revisão listava
 *    "narração e montagem prontas" com checkmark verde sobre arquivos que não existiam.
 * 2. **Ela não liga episódio a conteúdo.** O episódio da Fase 0 chama-se `luna-ep-001` e o próprio spec o
 *    descreve como "não é conteúdo do canal". Não existe vínculo declarado com nenhum item da biblioteca,
 *    e inventar um por semelhança de nome seria afirmar linhagem que ninguém declarou. Por isso a leitura
 *    é por canal, e o vínculo fica para quando existir de fato.
 * 3. **Ausência tem motivo, não lista vazia.** Em ambiente publicado não há mídia nenhuma — `.rebeca/assets/`
 *    está no `.gitignore`. A tela explica isso e diz o comando que gera localmente, em vez de mostrar uma
 *    lista vazia que parece defeito.
 */

import { useMemo, useState } from 'react';
import { CircleAlert, CircleCheck, Film, HardDrive, Terminal, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card, EmptyState, ErrorState, IconTile, Pill, SectionHead, Skeleton } from '@/components/ui/primitives';
import { useChannelId } from '@/app/useChannel';
import { useMediaEpisode, useMediaLibrary } from '@/media/hooks';
import { mediaFileUrl } from '@/media/client';
import { MediaImage } from '@/auth/MediaImage';
import type { MediaAssetView, MediaEpisodeView } from '@/media/view';
import type { MediaStage } from '@/media/contract';
import { formatDuration, formatInt, formatUsd } from '@/lib/format';

/** KB/MB legível. Tamanho é o que diz se o arquivo existe de verdade, não um número decorativo. */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/** Ordem de leitura da cadeia de produção (`rebeca-ia-video`), não ordem alfabética. */
const STAGE_ORDER: readonly MediaStage[] = ['thumbnail', 'imagem', 'animacao', 'voz', 'musica', 'legenda', 'render'];

const STAGE_LABEL: Readonly<Record<MediaStage, string>> = {
  thumbnail: 'Thumbnail',
  imagem: 'Imagem',
  animacao: 'Animação',
  voz: 'Voz',
  musica: 'Música',
  legenda: 'Legenda',
  render: 'Render',
};

function groupByStage(assets: readonly MediaAssetView[]): Array<[MediaStage, MediaAssetView[]]> {
  return STAGE_ORDER.map((stage) => [stage, assets.filter((asset) => asset.stage === stage)] as [MediaStage, MediaAssetView[]]).filter(
    ([, list]) => list.length > 0,
  );
}

export function MidiaPage() {
  const channelId = useChannelId();
  const library = useMediaLibrary(channelId);
  const [escolhido, setEscolhido] = useState<string | null>(null);

  const episodes = library.data?.episodes ?? [];

  /*
   * A escolha cai para o primeiro episódio quando o `escolhido` não pertence a este canal.
   * Isso não é detalhe: sem esta linha, trocar de canal manteria o id do canal anterior e a tela
   * pediria um episódio de outro canal — que o servidor recusa (e o recusa é o comportamento correto,
   * invariante nº 2). O que não pode é a tela *pedir*.
   */
  const episodioId =
    escolhido !== null && episodes.some((episode) => episode.episodeId === escolhido)
      ? escolhido
      : (episodes[0]?.episodeId ?? null);

  const episode = useMediaEpisode(channelId, episodioId);

  const dados: MediaEpisodeView | undefined = episode.data;
  const grupos = useMemo(() => (dados ? groupByStage(dados.assets) : []), [dados]);

  return (
    <>
      <PageHeader
        title="Mídia gerada"
        subtitle="Os arquivos que o pipeline realmente escreveu no disco, com o provedor e o custo real de cada um. O que veio de provedor simulado está marcado como simulado."
      />

      {library.isLoading && <Skeleton className="h-[280px]" />}

      {library.isError && (
        <Card className="p-4">
          <ErrorState
            message={library.error instanceof Error ? library.error.message : 'Não conseguimos ler a mídia deste canal.'}
            onRetry={() => void library.refetch()}
          />
        </Card>
      )}

      {library.data && !library.data.available && (
        <Card className="p-4">
          <EmptyState
            icon={<Film size={22} />}
            title="Nenhuma mídia gerada neste ambiente"
            description={library.data.reason ?? 'Não há mídia gerada para este canal.'}
            action={
              <span className="inline-flex items-center gap-2 text-[12px] text-ink-3 ams-num">
                <Terminal size={14} aria-hidden="true" />
                node .tools/render-episodio.mjs
              </span>
            }
          />
        </Card>
      )}

      {library.data?.available && (
        <>
          {episodes.length > 1 && (
            <Card className="p-4 mb-4">
              <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="episodio-midia">
                Episódio
              </label>
              <select
                id="episodio-midia"
                value={episodioId ?? ''}
                onChange={(event) => setEscolhido(event.target.value)}
                className="w-full min-h-[40px] px-3 rounded-md bg-sunken border border-line text-[14px] text-ink outline-none focus:border-accent"
              >
                {episodes.map((item) => (
                  <option key={item.episodeId} value={item.episodeId}>
                    {item.episodeId} · {item.assetCount} ativos
                  </option>
                ))}
              </select>
            </Card>
          )}

          {episode.isLoading && <Skeleton className="h-[320px]" />}

          {episode.isError && (
            <Card className="p-4">
              <ErrorState
                message={episode.error instanceof Error ? episode.error.message : 'Não conseguimos ler este episódio.'}
                onRetry={() => void episode.refetch()}
              />
            </Card>
          )}

          {dados && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <StatCard
                  label="Ativos gerados"
                  value={formatInt(dados.assetCount)}
                  period={dados.simulatedCount > 0 ? `${dados.simulatedCount} por provedor simulado` : 'provedor real'}
                  scope="Arquivos registrados no manifesto do episódio"
                  icon={
                    <IconTile tone="cyan" size="sm">
                      <Film size={15} />
                    </IconTile>
                  }
                />
                <StatCard
                  label="Duração medida"
                  value={formatDuration(dados.totalDurationMs / 1000)}
                  period="soma dos arquivos presentes"
                  scope="Vem do ffprobe de cada arquivo, não do tempo de geração"
                  icon={
                    <IconTile tone="blue" size="sm">
                      <HardDrive size={15} />
                    </IconTile>
                  }
                />
                <StatCard
                  label="Tamanho no disco"
                  value={formatBytes(dados.totalBytes)}
                  period={`${dados.assetCount - dados.missingCount} de ${dados.assetCount} arquivos presentes`}
                  scope="Medido agora, a cada leitura"
                  icon={
                    <IconTile tone="violet" size="sm">
                      <HardDrive size={15} />
                    </IconTile>
                  }
                />
                <StatCard
                  label="Custo real"
                  value={formatUsd(dados.totalCostUsd)}
                  period="somado por ativo"
                  scope="Lançado no livro — conta mesmo se o arquivo sumiu"
                  icon={
                    <IconTile tone="amber" size="sm">
                      <HardDrive size={15} />
                    </IconTile>
                  }
                />
              </div>

              {/*
                O aviso que impede a tela de mentir. A Fase 0 roda com provedores simulados: os arquivos
                existem de verdade (o ffmpeg gerou), mas o conteúdo NÃO é arte do canal. Sem esta faixa, a
                tela passaria a impressão de que já existe vídeo pronto para publicar.
              */}
              {dados.simulatedCount > 0 && (
                <Card variant="strong" className="p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <IconTile tone="amber" size="sm">
                      <TriangleAlert size={15} />
                    </IconTile>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">
                        {dados.simulatedCount} de {dados.assetCount} ativos vieram de provedor simulado
                      </p>
                      <p className="text-[12px] text-ink-2 mt-1">
                        Os arquivos existem — o ffmpeg local os gerou e o hash confere. Mas isto é{' '}
                        <strong>prova de máquina, não arte publicável</strong>: nenhum provedor da Stack A
                        (MiniMax, FLUX, Azure, Suno) foi chamado, e nada foi gasto. É o que o `ADR-010`
                        chama de Fase 0.
                      </p>
                      {dados.characterSheet === 'ausente' && (
                        <p className="text-[12px] text-ink-3 mt-2 flex items-start gap-1.5">
                          <CircleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>
                            A referência visual é <strong>sintética</strong>: o Character Sheet da Luna não
                            existe no repositório (dívida do `rebeca-branding`). Nada aqui prova consistência
                            de personagem — invariante nº 3.
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {dados.missingCount > 0 && (
                <Card className="p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <IconTile tone="rose" size="sm">
                      <CircleAlert size={15} />
                    </IconTile>
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {dados.missingCount} ativo(s) do manifesto não estão mais no disco
                      </p>
                      <p className="text-[12px] text-ink-2 mt-1">
                        O manifesto registra o que foi gerado; o arquivo pode ter sido movido ou apagado
                        depois. Estes estão marcados abaixo e o tamanho somado não os inclui.
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <div className="ams-split grid lg:grid-cols-12 gap-4" data-split="lg">
                <div className="ams-split__main lg:col-span-8 flex flex-col gap-4">
                  {grupos.map(([stage, list]) => (
                    <Card key={stage} className="p-4">
                      <SectionHead title={STAGE_LABEL[stage]} hint={`${list.length} ativo(s)`} />
                      <ul className="flex flex-col gap-3">
                        {list.map((asset) => (
                          <li key={`${asset.stage}-${asset.key}-${asset.version}`} className="border-b border-line pb-3 last:border-0 last:pb-0">
                            <div className="flex items-baseline justify-between gap-2 flex-wrap">
                              <span className="text-[12px] font-semibold text-ink ams-num">
                                {asset.key}
                                {asset.version > 1 && ` · v${asset.version}`}
                              </span>
                              <span className="flex items-center gap-2">
                                {asset.simulated && <Pill tone="warn">simulado</Pill>}
                                {asset.approved && <Pill tone="ok">aprovado</Pill>}
                                {!asset.existsOnDisk && <Pill tone="danger">arquivo ausente</Pill>}
                              </span>
                            </div>
                            <p className="text-[11px] text-ink-3 mt-1 ams-num break-all">{asset.pathFromAssets}</p>
                            <p className="text-[10px] text-ink-3 mt-1 ams-num">
                              {asset.durationMs > 0 ? `${(asset.durationMs / 1000).toFixed(2)} s · ` : ''}
                              {formatBytes(asset.bytes)} · {asset.providerId}/{asset.model} ·{' '}
                              {asset.promptVersion} · hash {asset.hash} · custo {formatUsd(asset.costUsd)}
                            </p>
                            {/*
                              A prévia existe porque **thumbnail que não se vê não é thumbnail**. Antes desta
                              linha, a etapa de thumbnail teria sido construída e o resultado continuaria
                              invisível — que é exatamente o defeito que originou esta tela ("ele gerou mas não
                              apareceu"). O `alt` carrega o rótulo de simulado: leitor de tela também precisa
                              saber que a arte não é publicável.
                            */}
                            {asset.kind === 'imagem' && asset.existsOnDisk && (
                              <MediaImage
                                src={mediaFileUrl(channelId, dados.episodeId, asset.pathFromAssets)}
                                alt={
                                  asset.simulated
                                    ? `Prévia de ${asset.key} — arte simulada, não publicável`
                                    : `Prévia de ${asset.key}`
                                }
                                className="mt-2 w-full max-w-[420px] aspect-video object-cover rounded-md border border-line bg-sunken"
                              />
                            )}
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>

                <div id="barra-lateral-direita" className="ams-split__aside lg:col-span-4 flex flex-col gap-4">
                  <Card className="p-4">
                    <SectionHead title="O que este episódio é" hint="e o que não é" />
                    <ul className="flex flex-col gap-2 text-[12px] text-ink-2">
                      <li className="flex items-start gap-2">
                        <CircleCheck size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        <span>
                          Gerado por <span className="ams-num">{episodioId}</span>, com manifesto em{' '}
                          <span className="ams-num">meta.json</span> (provedor, modelo, hash e duração por
                          ativo).
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CircleAlert size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        <span>
                          <strong>Não é conteúdo do canal.</strong> O spec da Fase 0 descreve este episódio
                          como episódio sintético — não existe vínculo declarado entre ele e nenhum item da
                          biblioteca.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CircleAlert size={14} className="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
                        <span>
                          <strong>Não passa pelo portão de aprovação.</strong> Aprovar, publicar e escolher
                          thumbnail continuam nas telas de Revisão e Conteúdo — aqui só se lê o que existe.
                        </span>
                      </li>
                    </ul>
                  </Card>

                  <Card className="p-4">
                    <SectionHead title="Tetos em vigor na geração" hint="gravados no manifesto" />
                    <ul className="flex flex-col gap-1.5 text-[12px] text-ink-2 ams-num">
                      <li className="flex justify-between gap-2">
                        <span>Por minuto (D2)</span>
                        <span className="font-semibold text-ink">
                          {formatUsd(dados.limits.tetoPorMinutoUsd)}/min
                        </span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>Mensal (D5)</span>
                        <span className="font-semibold text-ink">{formatUsd(dados.limits.limiteMensalUsd)}</span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span>Aprovado por</span>
                        <span className="text-ink-3">{dados.limits.aprovadoPor}</span>
                      </li>
                    </ul>
                    <p className="text-[10px] text-ink-3 mt-3 border-t border-line pt-3">
                      Os tetos vêm do <strong>manifesto</strong>, não do código de agora: um gasto só é
                      auditável contra o teto que valia quando ele aconteceu.
                    </p>
                  </Card>

                  <Card className="p-4">
                    <SectionHead title="Atualizado" hint="quando o pipeline rodou" />
                    <p className="text-[12px] text-ink-2 ams-num">
                      {new Date(dados.updatedAt).toLocaleString('pt-BR')}
                    </p>
                    <p className="text-[10px] text-ink-3 mt-2">
                      O tamanho em disco e a presença de cada arquivo são medidos a cada leitura — não vêm
                      do manifesto.
                    </p>
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
