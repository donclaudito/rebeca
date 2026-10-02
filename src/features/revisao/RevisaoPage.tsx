import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
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
import { generate } from '@/ai/client';
import type { AiResult } from '@/ai/contract';
import { useChannelId } from '@/app/useChannel';
import { api, isApprovalValid, qk } from '@/data/client';
import { useBrandKit, useChannel, useCharacters, useContent } from '@/data/hooks';
import { useMediaLibrary, useMediaEpisode, useGenerateThumbnails, useContentCost, mediaKeys } from '@/media/hooks';
import { mediaFileUrl } from '@/media/client';
import { MediaImage } from '@/auth/MediaImage';
import { formatDayMonthTime } from '@/lib/date';
import { formatDuration, formatUsdCost } from '@/lib/format';
import type { Cena, ContentItem, Roteiro, ThumbnailOption } from '@/data/types';

/**
 * Revisão — o coração do produto (docs/00-visao-produto.md §3.4).
 *
 * Uma tela = um conteúdo. O humano assiste, escolhe a thumbnail, ajusta o título e toma **uma** das
 * três decisões. A IA pode sugerir a melhor thumbnail, mas **nunca** deixa ela marcada: escolher é
 * do humano (AGENTS.md, invariante nº 1).
 */

/**
 * Leitura defensiva de um campo vindo da IA.
 *
 * O schema do servidor já valida a forma, mas a tela **não confia** nisso: uma resposta fora do contrato
 * (versão antiga do servidor, provedor que devolveu outra coisa) viraria `undefined` dentro do JSX e
 * quebraria a renderização inteira em vez de mostrar um campo vazio. A mesma decisão de
 * `proposeThumbnails`: normalizar na fronteira, não no meio da tela.
 */
function textoDe(bruto: Record<string, unknown>, chave: string): string {
  const valor = bruto[chave];
  return typeof valor === 'string' ? valor : '';
}

function numeroDe(bruto: Record<string, unknown>, chave: string, padrao: number): number {
  const valor = bruto[chave];
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : padrao;
}

/**
 * Blocos por chamada de `criar-cena`.
 *
 * **3 é o teto do schema de entrada** (`src/ai/schemas.ts`) — o número daqui não pode divergir dele, ou
 * a chamada é recusada antes de sair. O motivo do lote está medido no contrato (`src/ai/contract.ts`):
 * com o roteiro inteiro numa chamada, o teto de saída truncava o JSON e a resposta era HTTP 502.
 */
const BLOCOS_POR_LOTE = 3;

/** Fatia uma lista em lotes. A última pode ser menor. */
function emLotes<T>(itens: readonly T[], tamanho: number): T[][] {
  const lotes: T[][] = [];
  for (let inicio = 0; inicio < itens.length; inicio += tamanho) {
    lotes.push(itens.slice(inicio, inicio + tamanho));
  }
  return lotes;
}

/**
 * Lê as cenas de **um lote** da resposta da IA, sem confiar na forma.
 *
 * `numero` é reatribuído pela posição no storyboard acumulado, e não lido da resposta: dois lotes podem
 * devolver `numero: 1` cada um, e chave repetida quebraria a lista na tela. A mesma defesa de fronteira
 * de `proposeThumbnails` — o schema do servidor valida, mas a tela não aposta a renderização nisso.
 */
function lerCenas(data: unknown, jaGravadas: number): Cena[] {
  const bruto = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  const lista = Array.isArray(bruto['cenas']) ? bruto['cenas'] : [];
  return lista.flatMap((linha, indice) => {
    const cena = (typeof linha === 'object' && linha !== null ? linha : {}) as Record<string, unknown>;
    const promptImagem = textoDe(cena, 'promptImagem');
    // Cena sem prompt de imagem não é cena: é um registro que a etapa de imagem não consegue usar.
    if (promptImagem.trim() === '') return [];
    const paleta = Array.isArray(cena['paleta'])
      ? cena['paleta'].filter((cor): cor is string => typeof cor === 'string')
      : [];
    return [
      {
        numero: jaGravadas + indice + 1,
        duracaoSeg: numeroDe(cena, 'duracaoSeg', 5),
        descricao: textoDe(cena, 'descricao'),
        enquadramento: textoDe(cena, 'enquadramento'),
        paleta,
        promptImagem,
        negativePrompt: textoDe(cena, 'negativePrompt'),
        seed: numeroDe(cena, 'seed', jaGravadas + indice + 1),
      },
    ];
  });
}

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
  /*
   * Contexto de marca para a proposta de thumbnail: personagem oficial e paleta do canal.
   *
   * Isto não é enfeite: `criar-thumbnail` recebe `personagemPrincipal`, `paleta` e `estilo`, e sem
   * eles a proposta sairia genérica. O `estilo` é o único que o Brand Kit ainda **não** carrega (a
   * arte é dívida do `rebeca-branding`), então ele é composto do que existe — tom e tipografia — e o
   * campo é preenchido com o que é verdade, em vez de inventar um estilo que ninguém definiu.
   */
  const brandKit = useBrandKit(channelId).data;
  const characters = useCharacters(channelId).data;
  const protagonista = characters?.find(
    (character) => character.status === 'oficial' && /protagon/i.test(character.role),
  );

  /*
   * Mídia que o pipeline realmente gerou neste canal.
   *
   * **Por que esta consulta existe.** O cartão "O que existe neste conteúdo" era um bloco de strings
   * fixas. Ele afirmava "nenhum vídeo, narração ou montagem gerados ainda" — verdade quando foi escrito,
   * mentira depois que o pipeline da Fase 0 gravou 13 ativos no disco. O dono do produto foi quem
   * percebeu: *"não completou a sequência"*. Cartão de estado que não consulta estado não é estado, é
   * legenda.
   *
   * A consulta é escopada pelo canal ativo (a chave de cache carrega o `channelId`), e a ausência de
   * mídia **não** é erro: `available: false` vem com motivo.
   */
  const midia = useMediaLibrary(channelId);

  /*
   * O episódio deste conteúdo **é o próprio conteúdo**: o `episodeId` da mídia é o `contentId`.
   *
   * É uma convenção declarada, não um vínculo inventado. O episódio sintético da Fase 0
   * (`luna-ep-001`) ficou de fora de propósito: o spec dele diz "não é conteúdo do canal", e ligá-lo a um
   * item da biblioteca seria afirmar uma linhagem que ninguém declarou. Já a mídia gerada **a partir
   * desta tela** nasce para este conteúdo, e o nome da pasta é o id dele — o vínculo existe porque foi
   * criado aqui, não porque alguém o deduziu.
   */
  /*
   * O contexto do conteúdo vai para o servidor montar o prompt: **personagens oficiais do canal**, tema,
   * título e paleta.
   *
   * Antes disto o prompt era texto fixo no servidor e descrevia "a small round friendly girl" alegando
   * ainda que a ficha não existia — enquanto o canal já tinha personagem oficial cadastrado. O dono do
   * produto viu o resultado: *"ele criou o personagem mas não gerou a thumb"*.
   *
   * Só `oficial` entra: personagem em rascunho ou em aprovação não pode virar arte publicável sem o
   * portão humano (skill `rebeca-branding`, item 4).
   */
  const gerarArte = useGenerateThumbnails(channelId, contentId, {
    personagens: (characters ?? [])
      .filter((personagem) => personagem.status === 'oficial')
      .map((personagem) => ({
        name: personagem.name,
        role: personagem.role,
        sheetVersion: personagem.sheetVersion,
      })),
    ...(item?.theme !== undefined ? { tema: item.theme } : {}),
    ...(item?.title !== undefined ? { titulo: item.title } : {}),
    paleta: (brandKit?.palette ?? []).map((cor) => cor.hex),
  });

  /*
   * A arte gerada **deste conteúdo**, para os cartões de escolha mostrarem imagem em vez de "arte
   * pendente".
   *
   * O relato foi: *"Propor thumbnails… esta função ainda não está funcionando"* — com quatro cartões
   * dizendo "arte pendente" enquanto quatro PNGs de verdade estavam no disco. Eram **duas listas sem
   * ligação**: o LLM propõe *conceitos* (`item.thumbnails`) e o gerador produz *arquivos*
   * (`opcao-a`…`opcao-d`). Nada unia as duas, então a tela mostrava a metade abstrata e escondia a real.
   *
   * **O pareamento é por posição, e isso é declarado:** a geração cria exatamente quatro opções na ordem
   * `a b c d`; o cartão de índice `n` recebe `opcao-<letra n>`. Não é um vínculo semântico inventado — é a
   * ordem em que a própria geração numerou. Quando existir vínculo por id, ele substitui isto.
   */
  const episodioDeMidia = useMediaEpisode(channelId, contentId);
  const artePorOpcao = new Map(
    (episodioDeMidia.data?.assets ?? [])
      .filter((asset) => asset.stage === 'thumbnail' && asset.kind === 'imagem' && asset.existsOnDisk)
      .map((asset) => [asset.key, asset] as const),
  );

  /*
   * O que dá para saber sem perguntar a ninguém: o SEO do próprio conteúdo e o elo declarado
   * conteúdo → episódio. O resto (existe mídia? quantos ativos? é simulado?) vem da consulta acima.
   */
  const episodiosDoCanal = midia.data?.episodes ?? [];
  const episodioDoConteudo =
    item?.episodeId !== undefined
      ? (episodiosDoCanal.find((episode) => episode.episodeId === item?.episodeId) ?? null)
      : null;
  const ativosDoCanal = episodiosDoCanal.reduce((total, episode) => total + episode.assetCount, 0);
  const seoPreparado =
    item !== undefined &&
    item.seo.title.trim().length > 0 &&
    item.seo.description.trim().length > 0 &&
    item.seo.tags.length > 0;

  /*
   * O que falta para este conteúdo virar vídeo — **derivado do estado**, nunca string fixa.
   *
   * O slot dizia `note="nenhum vídeo foi gerado ainda"`: frase escrita à mão, verdadeira no dia em que foi
   * escrita e mentira em qualquer outra situação. O dono olhou para ela e disse *"esta função não
   * funciona"* — e estava certo por dois motivos: não havia botão nenhum ali, e a frase não dizia **o que**
   * faltava. Cartão de estado que não consulta estado é legenda, e esse defeito já apareceu duas vezes
   * nesta tela.
   */
  const faltaParaOVideo: readonly string[] = (() => {
    if (item === undefined || item.episodeId !== undefined) return [];
    const faltas: string[] = [];
    if (item.roteiro === undefined) faltas.push('o roteiro');
    if (item.storyboard === undefined) faltas.push('as cenas do storyboard');
    faltas.push('um provedor de vídeo real (o pipeline de hoje só produz prova de máquina, não desenho animado)');
    return faltas;
  })();

  const notaDoVideo =
    item?.episodeId !== undefined && episodioDoConteudo !== null
      ? `${episodioDoConteudo.assetCount} ativos de mídia deste conteúdo · ${episodioDoConteudo.simulatedCount} de provedor simulado`
      : `nenhum vídeo foi gerado — falta ${faltaParaOVideo.join('; ')}`;

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

  /**
   * O resultado cru da IA para roteiro e cenas.
   *
   * Guardado porque a **procedência** pertence ao resultado, não ao texto: só ele sabe dizer se a
   * resposta foi simulação (`simulated`) e se o custo é real ou não verificado. Sem isso, um roteiro
   * simulado entraria no conteúdo como se fosse geração de verdade — e roteiro vira prompt de imagem
   * depois, então a simulação contaminaria toda a cadeia seguinte sem ninguém perceber.
   */
  const [resultadoRoteiro, setResultadoRoteiro] = useState<AiResult | null>(null);

  /**
   * Progresso do storyboard, que passou a ser gerado **por lotes**.
   *
   * `criar-cena` não devolve mais o episódio inteiro numa resposta: a tela encadeia os lotes. Um job que
   * não diz onde está é um job que parece travado — a `rebeca-react` pede progresso com etapa legível em
   * pt-BR, opção de sair e voltar sem perder o que já foi feito, e falha com ação.
   */
  const [progressoCenas, setProgressoCenas] = useState<{ feito: number; total: number } | null>(null);

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

  /**
   * Aplica as opções de thumbnail propostas pela IA.
   *
   * A chamada de IA é do `AiAction`; o que passa por aqui é só a **gravação** do que o humano aceitou
   * ao clicar em "Usar estas opções" — a IA nunca escreve no conteúdo sozinha (invariante nº 1).
   */
  const proporThumbs = useMutation({
    mutationFn: (options: readonly ThumbnailOption[]) =>
      api.proposeThumbnails(channelId, contentId, options),
    onSuccess: async (updated: ContentItem) => {
      setSelectedThumb(null);
      setFeedback(
        updated.status === 'revisao'
          ? 'Opções propostas aplicadas. A escolha anterior foi limpa e a aprovação caiu — escolha uma e aprove de novo.'
          : 'Opções propostas aplicadas. Escolha uma para liberar a aprovação.',
      );
      await invalidate();
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  /**
   * Custo **real** deste conteúdo, somado do livro no servidor.
   *
   * A tela mostrava "Custo real US$ 42,80" — valor de `src/data/mock/db.ts` — enquanto o livro somava
   * **US$ 0,3956** para o mesmo conteúdo. Cento e oito vezes de diferença, com rótulo de verdade, na tela
   * em que a decisão é humana. Número inventado em lugar de decisão é pior que nenhum número: o dono já
   * aprovou conteúdo olhando para ele.
   */
  const custoReal = useContentCost(channelId, contentId || null);

  /** Cada chamada de IA lança linha no livro **na hora**. Sem recarregar, a tela mentiria por omissão. */
  const recarregarCusto = () => {
    void queryClient.invalidateQueries({ queryKey: mediaKeys.cost(channelId, contentId) });
  };

  /*
   * Normalização na fronteira. A resposta do servidor é dado externo, e uma forma inesperada — servidor de
   * versão anterior, rota que caiu no fallback de SPA e devolveu HTML — não pode derrubar a tela inteira.
   * Aconteceu exatamente isso no primeiro teste: `byStage` veio ausente, o `.length` estourou dentro do
   * render e a Revisão ficou **em branco** com oito testes vermelhos por consequência. O `docs/04` §5 pede
   * quatro estados explícitos por consulta; "quebrou o render" não é nenhum deles.
   */
  const custo = custoReal.data;
  const custoDisponivel = custo !== undefined && custo.ledgerAvailable === true;
  const custoEtapas = Array.isArray(custo?.byStage) ? custo.byStage : [];

  /**
   * Grava o roteiro que a IA escreveu. A chamada é do `AiAction`; aqui entra só a **gravação** do que o
   * humano aceitou ao clicar em "Usar este roteiro" — a IA nunca escreve no conteúdo sozinha.
   */
  const salvarRoteiro = useMutation({
    mutationFn: (roteiro: Roteiro) => api.saveRoteiro(channelId, contentId, roteiro),
    onSuccess: async (updated: ContentItem) => {
      setFeedback(
        updated.status === 'revisao'
          ? 'Roteiro gravado. A aprovação anterior caiu e o storyboard foi descartado — ele era derivado do roteiro anterior. Gere as cenas e aprove de novo.'
          : 'Roteiro gravado. Agora gere as cenas para o pipeline de mídia ter de onde partir.',
      );
      await invalidate();
      recarregarCusto();
    },
    onError: (error: Error) => setFeedback(error.message),
  });

  /**
   * Gera o storyboard **por lotes** — o conserto do HTTP 502.
   *
   * O motivo está medido, não suposto (`.rebeca/evidencias/502-criar-cena-teto-de-tokens.txt`): com o
   * roteiro inteiro numa chamada, o teto de saída truncava o JSON (`tokens_out: 6000` = as duas
   * tentativas somadas), a correção automática truncava de novo, e a resposta era **502
   * `schema-invalido`** depois de ~120 s — três falhas custaram US$ 0,21 e não produziram nada. Quando
   * "passava", passava com **uma cena** para um vídeo de 492 s.
   *
   * Agora cada chamada leva até 3 blocos e devolve até 4 cenas, então a resposta cabe no orçamento e
   * nenhuma chamada chega perto dos 90 s.
   *
   * **Cada lote é gravado assim que chega.** Se o quarto lote falhar, as três cenas já geradas e já pagas
   * estão no conteúdo em vez de virarem prejuízo — o mesmo princípio do manifesto de mídia, que grava os
   * ativos pagos antes do render. E é o que permite sair da tela e voltar.
   */
  const gerarCenas = useMutation({
    mutationFn: async () => {
      const blocos = item?.roteiro?.blocos ?? [];
      if (blocos.length === 0) throw new Error('Gere o roteiro antes das cenas.');

      const lotes = emLotes(blocos, BLOCOS_POR_LOTE);
      const acumuladas: Cena[] = [...(item?.storyboard?.cenas ?? [])];
      const jaGravadas = acumuladas.length;
      let algumLoteSimulado = false;
      setProgressoCenas({ feito: 0, total: lotes.length });

      for (const [indice, lote] of lotes.entries()) {
        const resultado = await generate({
          functionId: 'criar-cena',
          channelId,
          contentId,
          input: {
            tema: item?.theme ?? '',
            formato: item?.format ?? 'video',
            personagens: (characters ?? [])
              .filter((personagem) => personagem.status === 'oficial')
              .map((personagem) => personagem.name),
            /*
             * O Brand Kit ainda não carrega estilo de ilustração (dívida do `rebeca-branding`): vai o que
             * existe — tom e tipografia — em vez de um estilo inventado. Mesma decisão da thumbnail.
             */
            estiloVisual:
              [brandKit?.tone, ...(brandKit?.fonts ?? []).map((fonte) => fonte.family)]
                .filter((parte) => Boolean(parte))
                .join(' · ') || 'estilo visual ainda não definido no Brand Kit',
            /*
             * **Só os três campos do contrato.**
             *
             * `obj()` em `src/ai/schemas.ts` emite `additionalProperties: false`, então o bloco do roteiro
             * **inteiro** (`tempoInicioSeg`, `tempoFimSeg`, `emocao`) faz a chamada ser recusada com
             * *"A entrada da função não está no formato esperado"* — antes de sair do servidor. A versão
             * anterior mapeava os três campos; ao trocar para o laço de lotes eu passei o objeto cru, e o
             * defeito só apareceu na tela. O teste da tela não pegou porque ele conferia *quantas* chamadas
             * saíram, não *o que* saiu — agora ele valida o corpo contra o schema real.
             */
            blocos: lote.map((bloco) => ({
              ordem: bloco.ordem,
              narracao: bloco.narracao,
              acao: bloco.acao,
            })),
          },
        });

        if (resultado.simulated) algumLoteSimulado = true;

        const novas = lerCenas(resultado.data, acumuladas.length);
        if (novas.length === 0) {
          throw new Error(
            `O lote ${indice + 1} de ${lotes.length} voltou sem nenhuma cena aproveitável — o que já foi ` +
              'gerado nos lotes anteriores está gravado e não se perdeu.',
          );
        }
        acumuladas.push(...novas);

        await api.saveStoryboard(channelId, contentId, {
          cenas: acumuladas,
          geradoEm: new Date().toISOString(),
          promptId: 'criar-cena@v2',
          simulated: algumLoteSimulado,
        });
        setProgressoCenas({ feito: indice + 1, total: lotes.length });
      }

      return { cenas: acumuladas.length, novas: acumuladas.length - jaGravadas, lotes: lotes.length };
    },
    onSuccess: async (resumo) => {
      await invalidate();
      recarregarCusto();
      setFeedback(
        `Storyboard gravado: ${resumo.cenas} cenas em ${resumo.lotes} lotes` +
          (resumo.novas > 0 ? ` (${resumo.novas} novas).` : '.') +
          ' Revise e aprove de novo — o vídeo em si ainda depende de um provedor de vídeo real.',
      );
    },
    onError: async (error: Error) => {
      setFeedback(error.message);
      // O que os lotes anteriores gravaram é estado real: a tela recarrega para mostrar o que sobrou.
      await invalidate();
      recarregarCusto();
    },
  });

  const approve = useMutation({
    mutationFn: () => api.approve(channelId, contentId, when ? new Date(when).toISOString() : null),    onSuccess: async (updated: ContentItem) => {
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
        subtitle="Escolha a thumbnail, ajuste o título se quiser. Depois, uma das três decisões — a prévia do vídeo aparece aqui quando o vídeo existir."
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
                label={`Prévia do vídeo · ${formatDuration(item.durationSec)} planejados`}
                alt={`Espaço da prévia do vídeo ${item.title}; a duração de ${formatDuration(item.durationSec)} é a planejada`}
                note={notaDoVideo}
                className="!rounded-none !border-0"
              />
            </div>

            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <Meta label="Formato" value={item.format === 'video' ? 'Vídeo longo' : 'Short'} />
              <Meta label="Duração" value={formatDuration(item.durationSec)} />
              <Meta label="Tema" value={item.theme} />
              <Meta
                label="Custo real"
                value={
                  custoReal.isLoading
                    ? 'lendo o livro…'
                    : custo === undefined || typeof custo.totalUsd !== 'number' || typeof custo.rows !== 'number'
                      ? 'não foi possível ler'
                      : !custoDisponivel
                        ? 'não verificável aqui'
                        : custo.rows === 0
                          ? 'nada lançado ainda'
                          : formatUsdCost(custo.totalUsd)
                }
              />
            </dl>

            {/*
              A procedência do número acima, dita em uma linha. "Custo real" sem dizer de onde veio é
              exatamente o rótulo que já mentiu nesta tela: o valor vinha do arquivo de exemplo.
            */}
            <p className="text-[11px] text-ink-3 mt-2">
              {custo !== undefined && !custoDisponivel
                ? (custo.motivo ?? 'Sem livro de custos neste ambiente, o gasto real não pode ser somado.')
                : 'Somado do livro de custos real (.rebeca/custos.csv) — gasto efetivo, não estimativa.'}
            </p>
            {custoEtapas.length > 0 && (
              <ul className="flex flex-wrap gap-1.5 mt-2">
                {custoEtapas.map((etapa) => (
                  <li key={etapa.etapa}>
                    <Pill tone="neutral" dot={false}>
                      {etapa.etapa}: {formatUsdCost(etapa.usd)} em {etapa.linhas}{' '}
                      {etapa.linhas === 1 ? 'lançamento' : 'lançamentos'}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Roteiro e cenas ------------------------------------------------- */}
          {/*
            A peça que faltava para "gerar o vídeo" significar alguma coisa.

            `criar-roteiro` e `criar-cena` estavam registradas no contrato desde a camada de LLM e
            **nenhuma tela as chamava** — duas das cinco lacunas já registradas no estado. Sem roteiro e sem
            cena, nenhum provedor de vídeo tem o que animar, e era exatamente isso que estava por trás do
            relato *"esta função não funciona"*: não havia função, e o insumo da função não existia.
          */}
          <Card className="p-4">
            <SectionHead
              step={1}
              title="Roteiro e cenas"
              hint="é daqui que o vídeo nasce — sem roteiro e sem cenas, nenhum provedor de vídeo tem o que animar"
            />

            {item.roteiro === undefined ? (
              <p className="text-[12px] text-ink-3">
                Este conteúdo ainda não tem roteiro. O botão abaixo pede os blocos à IA — com narração,
                ação, emoção e tempo — e o roteiro fica gravado neste conteúdo. É o insumo que hoje não
                existe: sem ele, nenhum gerador de vídeo tem o que animar.
              </p>
            ) : (
              <div className="rounded-[12px] bg-sunken border border-line p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">{item.roteiro.titulo}</p>
                    <p className="text-[12px] text-ink-2 mt-1">{item.roteiro.logline}</p>
                    <p className="text-[11.5px] text-ink-3 mt-1">
                      Moral: {item.roteiro.moral} · {item.roteiro.blocos.length} blocos · gerado em{' '}
                      {formatDayMonthTime(new Date(item.roteiro.geradoEm))}
                    </p>
                  </div>
                  {item.roteiro.simulated && (
                    <Pill tone="warn" dot={false}>
                      simulado — sem chave configurada
                    </Pill>
                  )}
                </div>
                <ol className="flex flex-col gap-2 mt-3">
                  {item.roteiro.blocos.map((bloco) => (
                    <li key={bloco.ordem} className="rounded-[10px] border border-line bg-surface p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                        Bloco {bloco.ordem} · {bloco.tempoInicioSeg}s–{bloco.tempoFimSeg}s · {bloco.emocao}
                      </p>
                      <p className="text-[12.5px] text-ink-2 mt-1 whitespace-pre-wrap">{bloco.narracao}</p>
                      <p className="text-[11.5px] text-ink-3 mt-1">Ação: {bloco.acao}</p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <AiAction
              className="mt-3"
              functionId="criar-roteiro"
              channelId={channelId}
              contentId={item.id}
              input={() => ({
                tema: item.theme,
                /*
                 * O conteúdo não tem campo de "ângulo" — e a função exige um. Vai o **gancho**, que é o que
                 * a tela de fato tem. A alternativa seria inventar um ângulo a partir de nada, e prompt
                 * com dado fabricado produz roteiro que ninguém pediu.
                 */
                angulo: item.hook,
                gancho: item.hook,
                formato: item.format,
                duracaoSeg: item.durationSec,
                idadeAlvo,
                personagens: (characters ?? [])
                  .filter((personagem) => personagem.status === 'oficial')
                  .map((personagem) => personagem.name),
                valores: [],
              })}
              label="Escrever o roteiro com a IA"
              hint="Escreve os blocos do roteiro e mostra a proposta. Nada é gravado até você clicar em usar — e gravar derruba uma aprovação anterior."
              onResult={(result) => {
                setResultadoRoteiro(result);
                recarregarCusto();
              }}
              onApply={(data) => {
                const bruto = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
                const brutos = Array.isArray(bruto['blocos']) ? bruto['blocos'] : [];
                const blocos = brutos.flatMap((linha, index) => {
                  const bloco = (typeof linha === 'object' && linha !== null ? linha : {}) as Record<string, unknown>;
                  const narracao = textoDe(bloco, 'narracao');
                  if (narracao.trim() === '') return [];
                  return [
                    {
                      ordem: numeroDe(bloco, 'ordem', index + 1),
                      tempoInicioSeg: numeroDe(bloco, 'tempoInicioSeg', 0),
                      tempoFimSeg: numeroDe(bloco, 'tempoFimSeg', 1),
                      narracao,
                      acao: textoDe(bloco, 'acao'),
                      emocao: textoDe(bloco, 'emocao'),
                    },
                  ];
                });
                if (blocos.length === 0) return;
                salvarRoteiro.mutate({
                  titulo: textoDe(bruto, 'titulo') || item.title,
                  logline: textoDe(bruto, 'logline'),
                  moral: textoDe(bruto, 'moral'),
                  blocos,
                  geradoEm: new Date().toISOString(),
                  promptId: 'criar-roteiro@v1',
                  simulated: resultadoRoteiro?.simulated ?? false,
                });
              }}
              applyLabel="Usar este roteiro"
            />

            {item.roteiro !== undefined && (
              <>
                {item.storyboard === undefined ? (
                  <p className="text-[12px] text-ink-3 mt-4 border-t border-line pt-3">
                    Ainda não há cenas. O storyboard quebra o roteiro em cenas com enquadramento, paleta e
                    prompt de imagem — é o que a etapa de imagem vai consumir.
                  </p>
                ) : (
                  <div className="mt-4 border-t border-line pt-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <p className="text-[12px] font-semibold text-ink">
                        Storyboard · {item.storyboard.cenas.length} cenas
                      </p>
                      {item.storyboard.simulated && (
                        <Pill tone="warn" dot={false}>
                          simulado — sem chave configurada
                        </Pill>
                      )}
                    </div>
                    <ol className="grid sm:grid-cols-2 gap-2 mt-2">
                      {item.storyboard.cenas.map((cena: Cena) => (
                        <li key={cena.numero} className="rounded-[10px] border border-line bg-sunken p-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-3">
                            Cena {cena.numero} · {cena.duracaoSeg}s · {cena.enquadramento}
                          </p>
                          <p className="text-[12px] text-ink-2 mt-1">{cena.descricao}</p>
                          {cena.paleta.length > 0 && (
                            <p className="text-[11px] text-ink-3 mt-1">Paleta: {cena.paleta.join(', ')}</p>
                          )}
                          <p className="text-[11px] text-ink-3 mt-1">Prompt de imagem: {cena.promptImagem}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <div className="mt-4 border-t border-line pt-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-ink">Cenas (storyboard)</p>
                      <p className="text-[11px] text-ink-3 mt-0.5 max-w-[520px]">
                        A IA quebra o roteiro em cenas <strong>{BLOCOS_POR_LOTE} blocos por vez</strong>. Foi
                        assim que o erro 502 saiu: com o roteiro inteiro numa resposta só, a saída não cabia
                        no orçamento e a chamada falhava depois de dois minutos. Cada lote é gravado assim
                        que chega, então dá para sair desta tela e voltar depois.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      onClick={() => gerarCenas.mutate()}
                      disabled={gerarCenas.isPending}
                    >
                      {gerarCenas.isPending
                        ? `Gerando lote ${Math.min((progressoCenas?.feito ?? 0) + 1, progressoCenas?.total ?? 1)} de ${progressoCenas?.total ?? '…'}…`
                        : item.storyboard === undefined
                          ? 'Gerar as cenas com a IA'
                          : 'Gerar as cenas de novo'}
                    </Button>
                  </div>

                  {gerarCenas.isPending && progressoCenas !== null && (
                    <p className="text-[11px] text-ink-3 mt-2" role="status" aria-live="polite">
                      {progressoCenas.feito} de {progressoCenas.total} lotes concluídos. O que já foi gerado
                      está gravado neste conteúdo.
                    </p>
                  )}

                  {gerarCenas.isError && (
                    <p className="text-[12px] text-danger mt-3" role="alert">
                      {gerarCenas.error instanceof Error
                        ? gerarCenas.error.message
                        : 'Não foi possível gerar as cenas.'}
                    </p>
                  )}

                  {gerarCenas.isSuccess && !gerarCenas.isPending && (
                    <p className="text-[12px] text-ink-2 mt-3" role="status">
                      {gerarCenas.data.cenas} cenas gravadas ({gerarCenas.data.novas} novas em{' '}
                      {gerarCenas.data.lotes} lotes).
                    </p>
                  )}
                </div>
              </>
            )}
          </Card>

          {/* Thumbnails ------------------------------------------------------ */}
          <Card className="p-4">
            <SectionHead
              step={2}
              title="Escolha a thumbnail"
              hint="a sugestão da IA vem marcada como sugestão, nunca escolhida por você"
            />
            {options.length === 0 ? (
              <p className="text-[12px] text-ink-3">
                Este conteúdo ainda não tem opções de thumbnail — o botão abaixo pede os conceitos à
                IA. A arte em si depende do pipeline de mídia.
              </p>
            ) : (
              <ul className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3" role="radiogroup" aria-label="Opções de thumbnail">
                {options.map((option, index) => {
                  const active = selectedThumb === option.id;
                  /*
                   * A arte real desta opção, quando ela existe. `opcao-a` é o índice 0, `opcao-b` o 1 —
                   * a mesma ordem em que o gerador numerou as quatro.
                   */
                  const letra = String.fromCharCode(97 + index);
                  const arte = artePorOpcao.get(`opcao-${letra}`);
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
                        {arte !== undefined ? (
                          <MediaImage
                            src={mediaFileUrl(channelId, contentId, arte.pathFromAssets)}
                            alt={`Arte da opção ${letra}: ${option.alt}`}
                            className="w-full aspect-video object-cover rounded-md border border-line bg-sunken"
                          />
                        ) : (
                          <ArtSlot label={option.label} alt={option.alt} />
                        )}
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

            {/*
              O ponto de entrada que faltava. `criar-thumbnail` está registrada no contrato desde a
              camada de LLM e **nenhuma tela a chamava** — por isso a etapa "Escolha a thumbnail" só
              oferecia opções que já existissem, sem forma de pedir novas. O dono do produto notou:
              "não dá opção de gerar".
            */}
            <AiAction
              className="mt-3"
              functionId="criar-thumbnail"
              channelId={channelId}
              contentId={item.id}
              input={() => ({
                tema: item.theme,
                titulo: item.title,
                personagemPrincipal: protagonista?.name ?? '',
                paleta: (brandKit?.palette ?? []).map((cor) => cor.hex),
                // O Brand Kit ainda não carrega estilo de ilustração (dívida do `rebeca-branding`):
                // vai o que existe — tom e tipografia — em vez de um estilo inventado.
                estilo:
                  [brandKit?.tone, ...(brandKit?.fonts ?? []).map((fonte) => fonte.family)]
                    .filter((parte) => Boolean(parte))
                    .join(' · ') || 'estilo visual ainda não definido no Brand Kit',
              })}
              label="Gerar opções de thumbnail com a IA"
              hint="Propõe de 3 a 4 conceitos: o rótulo, o que a arte deve mostrar e o texto que entra nela. Isto NÃO gera imagem — a arte sai no bloco abaixo, pelo pipeline de mídia."
              onApply={(data) => {
                const proposta = data as { opcoes?: unknown };
                if (!Array.isArray(proposta.opcoes)) return;
                const opcoes: ThumbnailOption[] = proposta.opcoes.flatMap((bruta) => {
                  const candidata = bruta as Record<string, unknown>;
                  const { id, label, alt } = candidata;
                  if (typeof id !== 'string' || typeof label !== 'string' || typeof alt !== 'string') {
                    return [];
                  }
                  return [{ id, label, alt, suggested: candidata['sugestao'] === true }];
                });
                if (opcoes.length > 0) proporThumbs.mutate(opcoes);
              }}
              applyLabel="Usar estas opções"
            />

            {/*
              A ARTE — o bloco que faltava, e a causa do relato "não está produzindo, não gera".

              O botão acima é da camada de LLM: ele devolve **conceito em texto**. O dono do produto leu o
              rótulo "Gerar opções de thumbnail com a IA", clicou, e não apareceu imagem nenhuma — com
              razão, porque aquele caminho nunca gerou imagem. Ele produz **arquivos 1280×720** aqui, pelo
              pipeline de mídia (`server/media/thumbnails.ts`), com allow-list de fornecedor por canal,
              idempotência e custo real lançado no livro.

              `contentId` é o `episodeId` da mídia: a pasta nasce com o id deste conteúdo, e é isso que
              torna o vínculo declarado em vez de deduzido.
            */}
            <div className="mt-4 border-t border-line pt-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-ink">Arte das opções (imagem 1280×720)</p>
                  <p className="text-[11px] text-ink-3 mt-0.5 max-w-[460px]">
                    Gera quatro opções com hipóteses diferentes — foco no personagem, no objeto, no contraste
                    e na expressão. São <strong>arquivos de verdade</strong>, gravados na pasta deste
                    conteúdo.
                  </p>
                </div>
                <Button
                  variant="primary"
                  onClick={() => gerarArte.mutate()}
                  disabled={gerarArte.isPending}
                  aria-label="Gerar as quatro artes de thumbnail"
                >
                  {gerarArte.isPending ? 'Gerando a arte…' : 'Gerar as 4 artes'}
                </Button>
              </div>

              {gerarArte.isError && (
                <p className="text-[12px] text-danger mt-3" role="alert">
                  {gerarArte.error instanceof Error
                    ? gerarArte.error.message
                    : 'Não foi possível gerar a arte. Nada foi gravado.'}
                </p>
              )}

              {gerarArte.data && (
                <>
                  {/*
                    O aviso que impede a tela de vender prova de máquina como arte. Sem chave configurada,
                    `simulated` é true e o motivo diz o que aconteceu — cair no simulado em silêncio faria o
                    humano achar que tem arte quando tem texto sobre fundo chapado.
                  */}
                  <p
                    className={cn(
                      'text-[11px] mt-3 flex items-start gap-1.5',
                      gerarArte.data.simulated ? 'text-warn' : 'text-ink-3',
                    )}
                  >
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      {gerarArte.data.motivoDoProvedor}{' '}
                      <span className="ams-num">
                        ({gerarArte.data.created} gerada(s), {gerarArte.data.reused} reusada(s) ·{' '}
                        {formatUsdCost(gerarArte.data.cost.spentNowUsd)} nesta execução)
                      </span>
                    </span>
                  </p>

                  <ul className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-3">
                    {gerarArte.data.options.map((option) => (
                      <li key={option.optionId}>
                        <MediaImage
                          src={mediaFileUrl(channelId, gerarArte.data.episodeId, option.pathFromAssets)}
                          alt={`Opção ${option.optionId}: ${option.hypothesis}${option.simulated ? ' — arte simulada, não publicável' : ''}`}
                          className="w-full aspect-video object-cover rounded-md border border-line bg-sunken"
                        />
                        <span className="flex items-center justify-between gap-2 mt-1.5">
                          <span className="text-[11px] font-semibold text-ink ams-num">opção {option.optionId}</span>
                          {option.simulated && <Pill tone="warn">simulada</Pill>}
                        </span>
                        <p className="text-[10px] text-ink-3 mt-0.5">{option.hypothesis}</p>
                        <p className="text-[10px] text-ink-3 ams-num">“{option.textOnImage}”</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </Card>

          {/* Título e descrição --------------------------------------------- */}
          <Card className="p-4">
            <SectionHead step={3} title="Título e SEO" hint="edite se quiser — o rascunho é salvo antes de decidir" />
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
            <SectionHead step={4} title="Sua decisão" hint="nada é publicado sem você" />

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
            <SectionHead
              title="O que existe neste conteúdo"
              hint="lido do estado real — sem afirmar o que ainda não foi gerado"
            />
            {/*
              Este bloco listava, com três checkmarks verdes, "Roteiro, cenas, narração e montagem
              prontos" e "{n} opções de thumbnail geradas". **Nada disso existia**: não há um único
              arquivo de vídeo no repositório, não há narração e a arte das thumbnails é placeholder.
              O dono do produto olhou a tela e concluiu "não parece que funciona" — com razão: a tela
              afirmava trabalho que nunca aconteceu.

              A correção seguinte trocou as afirmações falsas por strings fixas honestas — e criou um
              defeito novo, do tipo oposto: depois que o pipeline da Fase 0 gravou 13 ativos no disco,
              o cartão continuou dizendo "nenhum vídeo gerado ainda". Foi de novo o dono do produto
              quem viu: *"não completou a sequência"*.

              **Cartão de estado que não consulta estado é legenda.** Agora cada linha é derivada:
              o SEO vem do próprio conteúdo, a mídia vem da leitura do manifesto (`useMediaLibrary`), e
              o que não dá para saber é dito como não sabido — nunca como "não existe".
            */}
            <ul className="flex flex-col gap-2 text-[12px] text-ink-2">
              <li className="flex items-start gap-2">
                {seoPreparado ? (
                  <BadgeCheck size={14} className="text-ok shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <TriangleAlert size={14} className="text-warn shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>
                  {seoPreparado
                    ? 'Título, descrição e tags preparados'
                    : 'Título, descrição ou tags ainda incompletos neste conteúdo'}
                </span>
              </li>

              <li className="flex items-start gap-2">
                <TriangleAlert size={14} className="text-warn shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  {options.length} {options.length === 1 ? 'opção' : 'opções'} de thumbnail no plano — a
                  arte ainda não existe
                </span>
              </li>

              {/*
                A mídia. Três estados distintos, e a diferença entre eles é o ponto:
                  · não sei            → a leitura falhou (não afirma ausência);
                  · sei que existe     → o conteúdo tem episódio ligado, com números reais;
                  · sei que não existe → nenhum episódio gerado para ESTE conteúdo.
                O terceiro estado é o que antes era chute; o primeiro é o que impede a tela de voltar a
                mentir quando o servidor não responde.
              */}
              {midia.isPending && (
                <li className="flex items-start gap-2">
                  <Info size={14} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Lendo a mídia gerada deste canal…</span>
                </li>
              )}

              {midia.isError && (
                <li className="flex items-start gap-2">
                  <TriangleAlert size={14} className="text-warn shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Não foi possível ler a mídia gerada deste canal agora. O que existe no disco é
                    desconhecido — esta linha não afirma que não há vídeo.
                  </span>
                </li>
              )}

              {midia.isSuccess && episodioDoConteudo !== null && (
                <li className="flex items-start gap-2">
                  <BadgeCheck size={14} className="text-ok shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Mídia gerada: {episodioDoConteudo.assetCount}{' '}
                    {episodioDoConteudo.assetCount === 1 ? 'ativo' : 'ativos'}
                    {episodioDoConteudo.simulatedCount > 0
                      ? `, ${episodioDoConteudo.simulatedCount} de provedor simulado`
                      : ''}
                    {episodioDoConteudo.renderVersion !== null
                      ? ` · render v${episodioDoConteudo.renderVersion}`
                      : ''}
                  </span>
                  <Link to={`/c/${channelId}/midia`} className="text-accent shrink-0">
                    ver mídia
                  </Link>
                </li>
              )}

              {midia.isSuccess && episodioDoConteudo === null && item.episodeId !== undefined && (
                <li className="flex items-start gap-2">
                  <TriangleAlert size={14} className="text-warn shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Este conteúdo aponta para o episódio {item.episodeId}, mas não há manifesto dele neste
                    ambiente — a mídia dele não está aqui.
                  </span>
                </li>
              )}

              {midia.isSuccess && item.episodeId === undefined && (
                <li className="flex items-start gap-2">
                  <TriangleAlert size={14} className="text-warn shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Nenhum vídeo, narração ou montagem deste conteúdo foi gerado ainda</span>
                </li>
              )}

              {midia.isSuccess && item.episodeId === undefined && episodiosDoCanal.length > 0 && (
                <li className="flex items-start gap-2">
                  <Info size={14} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    O pipeline já gerou {ativosDoCanal} {ativosDoCanal === 1 ? 'ativo' : 'ativos'} neste
                    canal ({episodiosDoCanal.map((episode) => episode.episodeId).join(', ')}). É episódio
                    sintético de prova de máquina e não está ligado a este conteúdo
                  </span>
                  <Link to={`/c/${channelId}/midia`} className="text-accent shrink-0">
                    ver mídia
                  </Link>
                </li>
              )}

              <li className="flex items-start gap-2">
                <Info size={14} className="text-info shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  A sua decisão vale sobre o que já existe. A mídia passa a constar aqui quando este
                  conteúdo tiver um episódio gerado e ligado a ele.
                </span>
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
