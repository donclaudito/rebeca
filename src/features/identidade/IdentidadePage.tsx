import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Lock, Palette as PaletteIcon, RefreshCw, Sparkles, Users } from 'lucide-react';
import { AiAction } from '@/components/ai/AiAction';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  ArtSlot,
  Button,
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
import { api, qk } from '@/data/client';
import { useBrandKit, useChannel, useCharacters } from '@/data/hooks';
import type { AiResult } from '@/ai/contract';
import type { Character, CharacterProposal } from '@/data/types';
import { formatDayMonth, formatDayMonthTime } from '@/lib/date';

/* =============================================================================
   Rótulos e leituras
   ============================================================================= */

const STATUS_LABEL: Record<
  Character['status'],
  { label: string; tone: 'ok' | 'warn' | 'neutral' }
> = {
  oficial: { label: 'Oficial', tone: 'ok' },
  em_aprovacao: { label: 'Em aprovação', tone: 'warn' },
  rascunho: { label: 'Rascunho', tone: 'neutral' },
  substituido: { label: 'Substituído', tone: 'neutral' },
};

/**
 * De onde a ficha veio, em uma linha.
 *
 * A distinção existe porque **proposta simulada apresentada como geração real é mentira de produto**:
 * sem chave de provedor configurada, o que a IA devolve é simulação com a mesma forma da resposta real,
 * e a ficha que ficar gravada disso precisa dizer isso em vez de parecer um personagem "gerado".
 */
function origemDaFicha(character: Character): string {
  if (character.sheetOrigin.promptId === '') return 'ficha de exemplo (não veio de IA)';
  return character.sheetOrigin.simulated
    ? 'proposta simulada — sem chave de provedor configurada'
    : 'proposta de modelo real';
}

function textoDe(valor: unknown, fallback = ''): string {
  return typeof valor === 'string' ? valor : fallback;
}

function textoLista(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Lê as opções da resposta da IA **sem confiar na forma**.
 *
 * A resposta é dado externo: um servidor de versão anterior, ou uma rota que caiu no fallback de SPA,
 * devolveria outra coisa. `docs/04` §5 pede estado vazio explícito, não tela quebrada — então forma
 * inesperada vira **lista vazia** e a tela diz que não veio opção nenhuma. O que **não** se faz aqui é
 * inventar campo que faltou: quem recusa ficha incompleta é a camada de dados, com mensagem própria.
 */
function opcoesDaResposta(dados: unknown): CharacterProposal[] {
  const lista = (dados as { opcoes?: unknown } | null | undefined)?.opcoes;
  if (!Array.isArray(lista)) return [];

  return lista.slice(0, 3).map((item) => {
    const registro = (item ?? {}) as Record<string, unknown>;
    const seed = registro['seed'];
    return {
      nome: textoDe(registro['nome']),
      papel: textoDe(registro['papel']),
      descricaoVisual: textoDe(registro['descricaoVisual']),
      tracos: textoLista(registro['tracos']),
      promptImagem: textoDe(registro['promptImagem']),
      negativePrompt: textoDe(registro['negativePrompt']),
      // Seed ausente vira `NaN` de propósito: `saveCharacterDraft` recusa com mensagem clara em vez de
      // gravar a seed 0, que seria um número inventado.
      seed: typeof seed === 'number' && Number.isFinite(seed) ? seed : Number.NaN,
      notasConsistencia: textoDe(registro['notasConsistencia']),
    };
  });
}

/** A ficha guardada, na forma que a função de IA espera como ficha de origem do refino. */
function propostaDaFicha(character: Character): CharacterProposal {
  return {
    nome: character.name,
    papel: character.role,
    descricaoVisual: character.sheet.descricaoVisual,
    tracos: [...character.sheet.tracos],
    promptImagem: character.sheet.promptImagem,
    negativePrompt: character.sheet.negativePrompt,
    seed: character.sheet.seed,
    notasConsistencia: character.sheet.notasConsistencia,
  };
}

/** Ficha em leitura — o que a IA propôs e o que ficou gravado se leem igual. */
function FichaDetalhe({ ficha }: { ficha: CharacterProposal }) {
  return (
    <dl className="flex flex-col gap-2 mt-2">
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Como ele é</dt>
        <dd className="text-[12px] text-ink-2 leading-relaxed mt-0.5">{ficha.descricaoVisual}</dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
          Traços que não podem mudar
        </dt>
        <dd className="flex flex-wrap gap-1.5 mt-1">
          {ficha.tracos.map((traco) => (
            <Pill key={traco} tone="neutral" dot={false}>
              {traco}
            </Pill>
          ))}
        </dd>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
          Prompt de imagem
        </dt>
        <dd className="text-[11.5px] text-ink-3 leading-relaxed mt-0.5 break-words">
          {ficha.promptImagem}
        </dd>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">O que evitar</dt>
          <dd className="text-[11.5px] text-ink-3 leading-relaxed mt-0.5">
            {ficha.negativePrompt.trim() === '' ? 'nada registrado nesta ficha' : ficha.negativePrompt}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">Seed</dt>
          <dd className="text-[11.5px] text-ink-2 ams-num mt-0.5">
            {Number.isFinite(ficha.seed) ? ficha.seed : 'não veio na resposta'}
          </dd>
        </div>
      </div>
      <div>
        <dt className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
          Notas de consistência
        </dt>
        <dd className="text-[11.5px] text-ink-3 leading-relaxed mt-0.5">{ficha.notasConsistencia}</dd>
      </div>
    </dl>
  );
}

/* =============================================================================
   Tela
   ============================================================================= */

/** Identidade — Brand Kit e Character Sheet do canal (docs/00-visao-produto.md §5). */
export function IdentidadePage() {
  const channelId = useChannelId();
  const queryClient = useQueryClient();
  const channel = useChannel(channelId);
  const brand = useBrandKit(channelId);
  const characters = useCharacters(channelId);

  /**
   * O pedido do personagem em português — é a entrada da função `identidade-personagem`.
   *
   * O `AiAction` não aceita `disabled`, então o botão é liberado pelo `fieldset` que o envolve: o
   * mínimo de 5 caracteres é o mesmo mínimo do schema de entrada, e abaixo disso a chamada nem sai.
   */
  const [pedido, setPedido] = useState('');
  const pedidoLimpo = pedido.trim();
  const pedidoValido = pedidoLimpo.length >= 5;

  /** O refino da ficha escolhida ("gostei desse, mas quero as orelhas maiores e sem coleira"). */
  const [ajuste, setAjuste] = useState('');
  const ajusteLimpo = ajuste.trim();
  const ajusteValido = ajusteLimpo.length >= 5;

  /**
   * Estado local do ciclo: as opções propostas, a ficha apontada para refino e o retorno da última
   * decisão. **Nada disto é gravação** — as opções só existem na tela até o humano escolher uma, e é
   * o clique em "Escolher esta opção" que chama a camada de dados.
   */
  const [opcoesCriacao, setOpcoesCriacao] = useState<CharacterProposal[]>([]);
  const [respostaCriacao, setRespostaCriacao] = useState<AiResult | null>(null);
  const [opcoesRefino, setOpcoesRefino] = useState<CharacterProposal[]>([]);
  const [respostaRefino, setRespostaRefino] = useState<AiResult | null>(null);
  const [fichaParaRefinarId, setFichaParaRefinarId] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  /*
   * Onde mora o isolamento entre canais **nesta tela**.
   *
   * Aqui havia um `useEffect` que zerava o ciclo a cada troca de `channelId`. A prova por mutação
   * mostrou que apagá-lo não mudava nada — e o motivo é estrutural: `src/app/AppShell.tsx:30` remonta
   * a subárvore da tela com `key={channelId}`, então todo estado local já nasce zerado no canal novo.
   *
   * Guarda que nunca dispara não é guarda; é legenda. O efeito saiu em vez de ficar como enfeite, e o
   * que protege o invariante nº 2 é o teste `trocar de canal limpa o ciclo` desta mesma pasta: ele
   * percorre o ciclo num canal e falha se qualquer coisa do canal anterior sobreviver à troca —
   * inclusive texto digitado, opção proposta e mensagem de decisão.
   */

  const channelData = channel.data;
  const paleta = (brand.data?.palette ?? []).map((color) => color.hex).slice(0, 8);
  const estiloVisual = brand.data?.tone ?? '';
  const lista = characters.data ?? [];
  const personagensExistentes = lista.map((character) => character.name).slice(0, 20);
  const fichaParaRefinar = lista.find((character) => character.id === fichaParaRefinarId) ?? null;
  const oficiais = lista.filter((character) => character.status === 'oficial');

  /**
   * O pedido que acompanha o refino.
   *
   * O schema exige `pedido` com pelo menos 5 caracteres em **toda** chamada, e o refino acontece com o
   * campo de criação possivelmente vazio (quem já descreveu o personagem não precisa repetir). Quando
   * falta, entra a ficha guardada — dado real do canal, não texto inventado.
   */
  const pedidoDoRefino =
    pedidoLimpo.length >= 5
      ? pedidoLimpo.slice(0, 800)
      : `Refinar ${fichaParaRefinar?.name ?? 'o personagem'}: ${fichaParaRefinar?.sheet.descricaoVisual ?? ''}`.slice(
          0,
          800,
        );

  /* ---------------------------------------------------------------- gravação */

  const escolherOpcao = useMutation({
    mutationFn: (dados: {
      proposal: CharacterProposal;
      derivedFromId: string | null;
      origin: { promptId: string; promptVersion: number; simulated: boolean };
    }) => api.saveCharacterDraft(channelId, dados),
    onSuccess: async (criado) => {
      setFichaParaRefinarId(criado.id);
      setFeedback(
        criado.derivedFromId === null
          ? `“${criado.name}” entrou na lista como rascunho ${criado.sheetVersion}. Nada é oficial enquanto você não aprovar — e o rascunho não é usado em episódio nenhum.`
          : `“${criado.name}” ganhou a versão ${criado.sheetVersion} como rascunho, derivada da ficha que você escolheu. A versão anterior continua intacta e ainda é a oficial até você aprovar esta.`,
      );
      await queryClient.invalidateQueries({ queryKey: qk.characters(channelId) });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  const aprovar = useMutation({
    mutationFn: (character: Character) => api.approveCharacter(channelId, character.id),
    onSuccess: async ({ character, superseded }) => {
      setFeedback(
        superseded.length > 0
          ? `“${character.name}” agora é oficial na ${character.sheetVersion}. A versão anterior (${superseded
              .map((item) => item.sheetVersion)
              .join(', ')}) deixou de ser oficial e continua registrada — os episódios já gerados usaram a ficha dela.`
          : `“${character.name}” agora é oficial na ${character.sheetVersion}. É esta ficha que a plataforma passa a usar em todo episódio deste canal.`,
      );
      await queryClient.invalidateQueries({ queryKey: qk.characters(channelId) });
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  /* ---------------------------------------------------------------- pedaços */

  const procedencia = (resultado: AiResult): string =>
    resultado.simulated
      ? 'Estas opções vieram de simulação (sem chave de provedor configurada). A ficha gravada registra isso — não é geração real.'
      : 'Estas opções vieram de geração real; a procedência fica registrada na ficha.';

  const cartaoDeOpcao = (
    opcao: CharacterProposal,
    indice: number,
    resposta: AiResult,
    derivedFromId: string | null,
  ) => (
    <li key={`${indice}-${opcao.nome}`}>
      <Card className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">
              Opção {indice + 1}: {opcao.nome || 'sem nome na resposta'}
            </p>
            <p className="text-[11px] text-ink-3">{opcao.papel || 'sem papel na resposta'}</p>
          </div>
          <Button
            variant="primary"
            aria-label={`Escolher a opção ${indice + 1}: ${opcao.nome}`}
            disabled={escolherOpcao.isPending}
            onClick={() =>
              escolherOpcao.mutate({
                proposal: opcao,
                derivedFromId,
                origin: {
                  promptId: resposta.promptId,
                  promptVersion: resposta.promptVersion,
                  simulated: resposta.simulated,
                },
              })
            }
          >
            <Check size={14} aria-hidden="true" />
            {escolherOpcao.isPending ? 'Gravando…' : 'Escolher esta opção'}
          </Button>
        </div>
        <FichaDetalhe ficha={opcao} />
      </Card>
    </li>
  );

  return (
    <>
      <PageHeader
        title="Identidade"
        subtitle="A marca e os personagens deste canal. É daqui que sai a consistência entre episódios."
      />

      <div className="ams-split grid lg:grid-cols-12 gap-4" data-split="lg">
        <div className="ams-split__main lg:col-span-7 flex flex-col gap-4">
          <Card className="p-4">
            <SectionHead step={1} title="Brand Kit" hint="cores, tipografia, voz e tom" />

            {brand.isLoading && <Skeleton className="h-[220px]" />}
            {brand.isError && (
              <ErrorState message="Este canal ainda não tem Brand Kit." onRetry={brand.refetch} />
            )}
            {brand.data && (
              <>
                <p className="ams-stat__label mb-2">Paleta</p>
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  {brand.data.palette.map((color) => (
                    <li key={color.hex}>
                      <span
                        className="block h-[54px] rounded-[12px] border border-line"
                        style={{ background: color.hex }}
                        aria-hidden="true"
                      />
                      <span className="block text-[11px] font-semibold text-ink mt-1.5">{color.name}</span>
                      <span className="block text-[10px] text-ink-3 ams-num">{color.hex}</span>
                    </li>
                  ))}
                </ul>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="ams-stat__label mb-2">Tipografia</p>
                    <ul className="flex flex-col gap-1.5">
                      {brand.data.fonts.map((font) => (
                        <li key={font.role} className="text-[12px] text-ink-2">
                          <span className="text-ink-3">{font.role}: </span>
                          {font.family}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="ams-stat__label mb-2">Voz e tom</p>
                    <p className="text-[12px] text-ink-2">{brand.data.voice}</p>
                    <p className="text-[12px] text-ink-3 mt-1">{brand.data.tone}</p>
                  </div>
                </div>

                <p className="text-[10px] text-ink-3 mt-4 border-t border-line pt-2">
                  Atualizado em {formatDayMonth(new Date(brand.data.updatedAt))}
                </p>
              </>
            )}
          </Card>

          <Card className="p-4">
            <SectionHead step={2} title="Personagens" hint="cada um com seu Character Sheet canônico" />

            {characters.isLoading && <Skeleton className="h-[200px]" />}
            {characters.isError && (
              <ErrorState
                message="Não conseguimos carregar os personagens deste canal."
                onRetry={characters.refetch}
              />
            )}

            {characters.data && lista.length === 0 && (
              <EmptyState
                icon={<Users size={18} />}
                title="Este canal ainda não tem personagem nenhum"
                description="Descreva o personagem no passo 3, escolha uma das opções e aprove: só então ele vira oficial e passa a valer em episódio."
              />
            )}

            {characters.data && lista.length > 0 && (
              <ul className="flex flex-col gap-3" aria-label="Personagens deste canal">
                {lista.map((character) => {
                  const meta = STATUS_LABEL[character.status];
                  const podeAprovar = character.status === 'rascunho' || character.status === 'em_aprovacao';
                  return (
                    <li key={character.id}>
                      <Card className="p-3 flex gap-3">
                        <span className="w-[64px] shrink-0">
                          <ArtSlot
                            label={character.name}
                            alt={`Referência visual do personagem ${character.name}`}
                            ratio="1x1"
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold text-ink">{character.name}</span>
                          <span className="block text-[11px] text-ink-3">{character.role}</span>
                          <span className="flex items-center gap-1.5 flex-wrap mt-2">
                            <Pill tone={meta.tone}>{meta.label}</Pill>
                            <Pill tone="neutral" dot={false}>
                              sheet {character.sheetVersion}
                            </Pill>
                            <Pill tone="neutral" dot={false}>
                              {origemDaFicha(character)}
                            </Pill>
                          </span>
                          {character.approvedAt !== undefined && (
                            <span className="block text-[10px] text-ink-3 mt-1.5">
                              Aprovado por uma pessoa em {formatDayMonthTime(new Date(character.approvedAt))}
                              {' · '}
                              quem aprovou não é registrado: não há login neste protótipo.
                            </span>
                          )}
                          {character.derivedFromId !== null && (
                            <span className="block text-[10px] text-ink-3 mt-1.5">
                              Derivado de{' '}
                              {lista.find((item) => item.id === character.derivedFromId)?.name ??
                                character.derivedFromId}
                            </span>
                          )}
                          <span className="flex items-center gap-2 flex-wrap mt-2">
                            {podeAprovar && (
                              <Button
                                variant="primary"
                                aria-label={`Aprovar ${character.name} (${character.sheetVersion}) como oficial`}
                                disabled={aprovar.isPending}
                                onClick={() => aprovar.mutate(character)}
                              >
                                <Check size={14} aria-hidden="true" />
                                {aprovar.isPending && aprovar.variables?.id === character.id
                                  ? 'Aprovando…'
                                  : 'Aprovar como oficial'}
                              </Button>
                            )}
                            <Button
                              aria-label={`Refinar ${character.name} (${character.sheetVersion})`}
                              onClick={() => {
                                setFichaParaRefinarId(character.id);
                                setOpcoesRefino([]);
                                setRespostaRefino(null);
                                setFeedback(
                                  `Ficha de “${character.name}” (${character.sheetVersion}) escolhida para refino: descreva o que mudar no passo 3.`,
                                );
                              }}
                            >
                              <RefreshCw size={14} aria-hidden="true" />
                              Refinar
                            </Button>
                          </span>
                        </span>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="text-[11px] text-ink-3 mt-3 flex items-start gap-1.5 border-t border-line pt-3">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Um personagem só entra em produção depois de virar oficial. Enquanto está em aprovação,
              rascunho ou substituído, ele não é usado em episódio nenhum. A prancha de arte de cada um
              ainda não existe: ela é do Brand Kit, não deste protótipo.
            </p>
          </Card>

          {/*
            O ciclo do personagem, nas quatro batidas do PDF do cliente: **opções → escolha → refino →
            aprovação**. A IA propõe; escolher, refinar e aprovar é do humano — nenhuma chamada desta
            tela grava personagem sozinha, e nenhuma ficha nasce oficial.
          */}
          <Card className="p-4">
            <SectionHead
              step={3}
              title="Criar ou refinar personagem com a IA"
              hint="opções → escolha → refino → aprovação"
            />

            {/* Batida 1 — opções */}
            <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="pedido-personagem">
              Como é o personagem?
            </label>
            <textarea
              id="pedido-personagem"
              value={pedido}
              onChange={(event) => setPedido(event.target.value)}
              rows={3}
              placeholder="Ex.: um cachorro pequeno, curioso, orelhas grandes, sem coleira."
              className="w-full px-3 py-2 rounded-md bg-bg border border-line text-[14px] text-ink outline-none focus:border-accent resize-y"
            />
            <p className="text-[10px] text-ink-3 mt-1.5">
              Descreva aparência, jeito e o que evitar. A IA devolve <strong>duas ou três opções</strong>{' '}
              de ficha — nada é gravado antes de você escolher uma, e nenhuma opção já vem escolhida.
            </p>

            {!pedidoValido && (
              <p className="text-[11px] text-ink-3 mt-2" role="status">
                O botão libera quando a descrição tiver pelo menos 5 caracteres.
              </p>
            )}

            {channelData && (
              /*
                `AiAction` não expõe prop de desabilitado; o `fieldset` desabilita de verdade o botão
                gerado por ele enquanto a descrição não atinge o mínimo do schema de entrada.
                `estiloVisual` vai **sempre**, mesmo vazio: o schema exige a chave, e mandar o campo só
                quando há tom no Brand Kit fazia a chamada voltar como inválida quando não havia.
              */
              <fieldset
                disabled={!pedidoValido}
                className={cn('mt-3 min-w-0', !pedidoValido && 'opacity-60')}
              >
                <AiAction
                  functionId="identidade-personagem"
                  channelId={channelId}
                  input={() => ({
                    pedido: pedidoLimpo.slice(0, 800),
                    canalNome: channelData.name.slice(0, 120),
                    personagensExistentes,
                    paleta,
                    estiloVisual: estiloVisual.slice(0, 300),
                    ajuste: '',
                    personagemBase: [],
                  })}
                  label="Gerar opções de ficha"
                  hint="Converte a sua descrição em opções de ficha consistente: papel, traços, prompt de imagem e notas para repetir o personagem em todo episódio."
                  onResult={(resultado) => {
                    setRespostaCriacao(resultado);
                    setOpcoesCriacao(opcoesDaResposta(resultado.data));
                  }}
                />
              </fieldset>
            )}

            {/* Batida 2 — escolha */}
            {respostaCriacao && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="text-[11px] font-semibold text-ink-2">Opções geradas</p>
                <p className="text-[10px] text-ink-3 mt-0.5 mb-2">{procedencia(respostaCriacao)}</p>

                {opcoesCriacao.length === 0 ? (
                  <p className="text-[11.5px] text-warn" role="status">
                    A resposta não trouxe nenhuma opção legível — nada foi gravado. Gere de novo.
                  </p>
                ) : (
                  <ul
                    className="flex flex-col gap-2"
                    aria-label="Opções de personagem propostas pela IA"
                  >
                    {opcoesCriacao.map((opcao, indice) =>
                      cartaoDeOpcao(opcao, indice, respostaCriacao, null),
                    )}
                  </ul>
                )}
              </div>
            )}

            {!respostaCriacao && (
              <p className="text-[11px] text-ink-3 mt-3" role="status">
                Nenhuma opção foi gerada ainda — a lista de personagens acima é a que existe hoje.
              </p>
            )}

            {/* Batida 3 — refino */}
            <div className="mt-4 border-t border-line pt-3">
              <p className="text-[11px] font-semibold text-ink-2">Refinar a ficha escolhida</p>
              <p className="text-[10px] text-ink-3 mt-0.5 mb-2">
                Refinar <strong>não</strong> edita a ficha que existe: gera uma versão nova derivada dela.
                A anterior continua registrada, porque os episódios já gerados usaram a ficha dela.
              </p>

              <label className="block text-[11px] font-semibold text-ink-3 mb-1.5" htmlFor="personagem-a-refinar">
                Personagem a refinar
              </label>
              <select
                id="personagem-a-refinar"
                value={fichaParaRefinarId}
                onChange={(event) => {
                  setFichaParaRefinarId(event.target.value);
                  setOpcoesRefino([]);
                  setRespostaRefino(null);
                }}
                className="w-full px-3 py-2 rounded-md bg-bg border border-line text-[13px] text-ink outline-none focus:border-accent"
              >
                <option value="">— escolha um personagem —</option>
                {lista.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name} · {STATUS_LABEL[character.status].label} · sheet{' '}
                    {character.sheetVersion}
                  </option>
                ))}
              </select>

              <label className="block text-[11px] font-semibold text-ink-3 mt-3 mb-1.5" htmlFor="ajuste-personagem">
                O que você quer mudar?
              </label>
              <textarea
                id="ajuste-personagem"
                value={ajuste}
                onChange={(event) => setAjuste(event.target.value)}
                rows={2}
                placeholder="Ex.: gostei desse, mas quero as orelhas maiores e sem coleira."
                className="w-full px-3 py-2 rounded-md bg-bg border border-line text-[14px] text-ink outline-none focus:border-accent resize-y"
              />

              {fichaParaRefinar === null && (
                <p className="text-[11px] text-ink-3 mt-2" role="status">
                  Escolha acima (ou no cartão da lista) qual ficha será refinada.
                </p>
              )}
              {fichaParaRefinar !== null && !ajusteValido && (
                <p className="text-[11px] text-ink-3 mt-2" role="status">
                  O botão libera quando o ajuste tiver pelo menos 5 caracteres. A ficha de origem vai
                  junto na chamada: é o que faz a IA refinar em vez de recomeçar.
                </p>
              )}

              {channelData && fichaParaRefinar !== null && (
                <fieldset
                  disabled={!ajusteValido}
                  className={cn('mt-3 min-w-0', !ajusteValido && 'opacity-60')}
                >
                  {/*
                    `key` pela ficha de origem: trocar o personagem a refinar zera o resultado anterior
                    do `AiAction` — sem isto, as opções do refino antigo continuariam na tela como se
                    fossem do personagem novo.
                  */}
                  <AiAction
                    key={fichaParaRefinar.id}
                    functionId="identidade-personagem"
                    channelId={channelId}
                    input={() => ({
                      pedido: pedidoDoRefino,
                      canalNome: channelData.name.slice(0, 120),
                      personagensExistentes,
                      paleta,
                      estiloVisual: estiloVisual.slice(0, 300),
                      ajuste: ajusteLimpo.slice(0, 400),
                      personagemBase: [propostaDaFicha(fichaParaRefinar)],
                    })}
                    label="Gerar versões refinadas"
                    hint="Deriva novas opções da ficha escolhida, mudando só o que você pediu e mantendo o que já foi aceito."
                    onResult={(resultado) => {
                      setRespostaRefino(resultado);
                      setOpcoesRefino(opcoesDaResposta(resultado.data));
                    }}
                  />
                </fieldset>
              )}

              {respostaRefino && (
                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-ink-2">
                    Versões derivadas de “{fichaParaRefinar?.name ?? '—'}”
                  </p>
                  <p className="text-[10px] text-ink-3 mt-0.5 mb-2">{procedencia(respostaRefino)}</p>

                  {opcoesRefino.length === 0 ? (
                    <p className="text-[11.5px] text-warn" role="status">
                      A resposta não trouxe nenhuma opção legível — nada foi gravado. Gere de novo.
                    </p>
                  ) : (
                    <ul
                      className="flex flex-col gap-2"
                      aria-label="Opções refinadas propostas pela IA"
                    >
                      {opcoesRefino.map((opcao, indice) =>
                        cartaoDeOpcao(opcao, indice, respostaRefino, fichaParaRefinar?.id ?? null),
                      )}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Decisão */}
            {feedback !== null && (
              <p
                className="text-[11.5px] text-ink-2 mt-4 border-t border-line pt-3"
                role="status"
                aria-live="polite"
              >
                {feedback}
              </p>
            )}

            <p className="text-[10px] text-ink-3 mt-3">
              A aprovação de personagem é humana e fica registrada com data, canal e versão da ficha.
              Quem aprovou não é registrado porque não existe login neste protótipo — a tela não inventa
              um nome de usuário.
            </p>
          </Card>
        </div>

        <div id="barra-lateral-direita" className="ams-split__aside lg:col-span-5 flex flex-col gap-4">
          <Card variant="strong" className="p-4">
            <SectionHead title="Consistência de personagem" hint="requisito, não estética" />
            <p className="text-[12px] text-ink-2">
              &ldquo;{channel.data?.name ?? 'O canal'}&rdquo; precisa parecer o mesmo em todos os episódios. O
              Character Sheet é a fonte disso: toda geração de imagem parte dele, e qualquer desvio é
              tratado como defeito.
            </p>

            {/*
              A ficha canônica **existe ou não existe** — e a tela diz qual dos dois. Antes, este bloco
              afirmava consistência sem ter onde consultá-la; agora ele lê as fichas oficiais do canal.
            */}
            <p className="text-[12px] text-ink-2 mt-3 border-t border-line pt-3" role="status">
              {oficiais.length > 0 ? (
                <>
                  Este canal tem {oficiais.length === 1 ? '1 ficha canônica' : `${oficiais.length} fichas canônicas`}:{' '}
                  {oficiais
                    .map((character) => `${character.name} (${character.sheetVersion})`)
                    .join(', ')}
                  .
                </>
              ) : (
                <>Este canal ainda não tem personagem oficial: nenhuma ficha canônica existe por aqui.</>
              )}
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4">
              <ArtSlot label="Referência" alt="Prancha de referência do personagem principal" ratio="1x1" />
              <ArtSlot label="Expressões" alt="Prancha de expressões do personagem principal" ratio="1x1" />
              <ArtSlot label="Ângulos" alt="Prancha de ângulos do personagem principal" ratio="1x1" />
            </div>
            <p className="text-[10px] text-ink-3 mt-2">
              As pranchas de arte ainda não existem: elas vêm do Brand Kit, não do protótipo. O que existe
              hoje é a ficha em texto de cada personagem oficial.
            </p>
          </Card>

          <Card className="p-4">
            <SectionHead title="Materiais de divulgação" hint="saem do mesmo Brand Kit" />
            <ul className="flex flex-col gap-2 text-[12px] text-ink-2">
              {['Thumbnail do vídeo', 'Short derivado', 'Post de Instagram', 'Story', 'Capa de Reel', 'Post na comunidade'].map(
                (material) => (
                  <li key={material} className="flex items-center gap-2">
                    <IconTile tone="violet" size="sm">
                      <Sparkles size={13} />
                    </IconTile>
                    {material}
                  </li>
                ),
              )}
            </ul>
          </Card>

          <Card className="p-4">
            <SectionHead title="Ferramentas de identidade" hint="o que existe hoje" />
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center gap-2.5 text-[12px] text-ink-2">
                <IconTile tone="pink" size="sm">
                  <PaletteIcon size={14} />
                </IconTile>
                Paleta, tipografia e tom por canal
              </li>
              <li className="flex items-center gap-2.5 text-[12px] text-ink-2">
                <IconTile tone="amber" size="sm">
                  <Users size={14} />
                </IconTile>
                Personagens com versão de Character Sheet
              </li>
            </ul>
            <p className="text-[11px] text-ink-3 mt-3 border-t border-line pt-3">
              A IA gera opções de ficha, você escolhe, refina e aprova: o personagem aprovado vira oficial
              com a ficha gravada no canal. O que ainda não existe é a arte — prancha de referência,
              expressões e ângulos —, e o manifesto de mídia continua dizendo que a ficha está ausente.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
