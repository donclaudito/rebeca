/**
 * A etapa de imagem: **qual provedor**, **onde o arquivo nasce** e **o que o arquivo é de fato**.
 *
 * Este arquivo é a ponte entre o provedor e o pipeline, e existe por três motivos concretos:
 *
 * 1. **O contrato não tem `plan` em `ImageProvider`.** O `ThumbnailProvider` declara `plan()`; as quatro
 *    interfaces de mídia não. Enquanto o único provedor de imagem era o simulado, o pipeline chamava
 *    `planImage` direto de `providers/simulated.ts` — ou seja, **o pipeline conhecia o provedor**. No dia
 *    em que um segundo provedor entrasse, o hash e o nome do arquivo continuariam sendo os do ffmpeg: a
 *    arte real nasceria com nome de arte simulada e a reexecução reusaria o PNG do ffmpeg achando que era
 *    a imagem paga. `planImageFor` resolve isso perguntando ao provedor, sem `if` de fornecedor espalhado
 *    pelo pipeline (invariante nº 7).
 * 2. **A escolha do provedor tem de ser auditável.** `resolveImageProvider` devolve o provedor **e** o
 *    motivo em pt-BR. "Sem chave cai no simulado" só é honesto se a resposta **disser** que caiu — senão a
 *    tela apresenta texto do ffmpeg sobre fundo chapado como se fosse arte do canal.
 * 3. **O arquivo tem de poder ser medido.** `pngSize` lê o cabeçalho do PNG em disco: é como o relatório
 *    diz a resolução **real** do que o provedor entregou, em vez de repetir a resolução que foi pedida.
 *    Isso importa porque a doc da MiniMax declara que `16:9` entrega **1280x720** nativo — quem pediu
 *    1920x1080 recebe 720p e o render amplia, e o humano precisa poder ver isso.
 *
 * O que este arquivo **não** faz: chamar a rede, gastar dinheiro, decidir allow-list. O portão de
 * fornecedor roda no topo do pipeline (`simulated-episode.ts`), antes de qualquer coisa.
 */

import { readFileSync } from 'node:fs';
import type {
  AssetPlan,
  ImageProvider,
  ImageRequest,
  ProviderIdentity,
} from '../../../src/media/contract.js';
import { hasMiniMaxKey } from '../config.js';
import { ChannelScopeError, assertWithinChannel } from '../paths.js';
import {
  MINIMAX_COST_PER_IMAGE_USD,
  MINIMAX_DEEP_SYNTHESIS,
  MINIMAX_PROVIDER_ID,
  miniMaxImageProvider,
  type DeepSynthesisNotice,
} from './minimax.js';
import { planImage, simulatedImageProvider } from './simulated.js';

/**
 * O que a tela e o relatório precisam saber sobre a arte que foi gerada.
 *
 * `motivo` está aqui, e não só o booleano `simulated`, porque o defeito que este projeto já pagou duas
 * vezes é **apresentar prova de máquina como arte**: um `true/false` na tela não impede isso — uma frase
 * que diz "isto é o ffmpeg desenhando texto, não arte publicável" impede.
 */
export interface ImageProviderNotice {
  readonly providerId: string;
  readonly model: string;
  readonly simulated: boolean;
  /** Preço por imagem declarado pelo provedor. `null` = **NÃO VERIFICADO** (provedor pago sem preço declarado). */
  readonly costPerImageUsd: number | null;
  /** Frase em pt-BR: o que foi usado, com que custo, e o que isso significa para quem revisa. */
  readonly motivo: string;
  /** `ADR-005`: obrigação de rótulo de *deep synthesis*. Só a MiniMax exige hoje. */
  readonly deepSynthesis: DeepSynthesisNotice;
}

/** Não há obrigação de rótulo: o ativo não é conteúdo sintético de terceiro, é desenho local do ffmpeg. */
const SEM_ROTULO: DeepSynthesisNotice = {
  required: false,
  text: null,
  source: '',
  note: 'Não se aplica: o ativo é gerado localmente pelo ffmpeg, sem provedor de IA e sem terceiro.',
};

/** Assinatura de PNG — os 8 bytes que provam que o arquivo é PNG antes de ler o cabeçalho. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Lê largura e altura **do arquivo em disco** (cabeçalho `IHDR` do PNG), sem `ffprobe`.
 *
 * Devolve `null` quando o arquivo não existe, não é PNG, ou não tem cabeçalho legível — e `null` aqui
 * significa "não medido", nunca "zero". A diferença importa: o relatório do episódio mostra a resolução
 * medida do arquivo, e uma célula "0x0" seria pior que uma célula vazia.
 */
export function pngSize(path: string): ImageSize | null {
  let head: Buffer;
  try {
    head = readFileSync(path).subarray(0, 33);
  } catch {
    return null;
  }
  if (head.length < 24 || !head.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  // Os 4 bytes do tipo do primeiro chunk têm de ser `IHDR`: sem checar isso, qualquer PNG truncado ou
  // reordenado seria lido como se tivesse dimensão.
  if (head.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
  const width = head.readUInt32BE(16);
  const height = head.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/**
 * Preço por ativo que o provedor **declara** — `null` quando ele não declara.
 *
 * `null` não é "de graça": é **NÃO VERIFICADO**, e o pipeline trata os dois de forma oposta. O simulado
 * declara zero porque zero é a verdade (ffmpeg local não cobra); um provedor pago que não declare preço
 * faz a estimativa da execução virar zero, e o portão de entrada então **exige** uma estimativa explícita
 * em vez de comparar zero com o teto e liberar a geração inteira — o furo que o `rebeca-qa` reproduziu no
 * `ADR-010` (21 arquivos e US$ 200 lançados antes de qualquer bloqueio).
 */
export function declaredUnitPriceUsd(
  provider: ProviderIdentity & { readonly simulated: boolean },
): number | null {
  const declared = (provider as { readonly costPerImageUsd?: unknown }).costPerImageUsd;
  if (typeof declared === 'number' && Number.isFinite(declared) && declared >= 0) return declared;
  return provider.simulated ? 0 : null;
}

/**
 * A frase que diz **qual** arte o humano está vendo.
 *
 * Três casos, e os três são declarados: arte real da MiniMax, prova de máquina do ffmpeg, e provedor real
 * desconhecido. O terceiro existe para o dia em que alguém plugar outro adapter: ele **não** herda a frase
 * da MiniMax nem a do simulado — vira "real, com rótulo e preço não verificados", que é a verdade.
 */
export function imageProviderNotice(provider: ImageProvider): ImageProviderNotice {
  const preco = declaredUnitPriceUsd(provider);

  if (provider.simulated) {
    return {
      providerId: provider.id,
      model: provider.model,
      simulated: true,
      costPerImageUsd: preco ?? 0,
      deepSynthesis: SEM_ROTULO,
      motivo:
        'Prova de máquina, NÃO arte: a cena foi desenhada localmente pelo ffmpeg (fundo chapado com o texto ' +
        'da cena), custo zero, sem provedor de IA e sem rede. Serve para provar o encanamento e para o humano ' +
        'conferir a composição — não para publicar. Configure a chave da MiniMax (image-01) para gerar arte real.',
    };
  }

  if (provider.id === MINIMAX_PROVIDER_ID) {
    return {
      providerId: provider.id,
      model: provider.model,
      simulated: false,
      costPerImageUsd: preco,
      deepSynthesis: MINIMAX_DEEP_SYNTHESIS,
      motivo:
        `Arte gerada de verdade pela MiniMax (${provider.model}), ao preço publicado de US$ ` +
        `${MINIMAX_COST_PER_IMAGE_USD.toFixed(4)} por imagem (platform.minimax.io/docs/guides/pricing-paygo, ` +
        'relida em 2026-10-02). Dois fatos declarados que a revisão precisa saber: (1) a doc informa que ' +
        '`16:9` entrega 1280x720 nativo — o render amplia para 1920x1080, e a resolução REAL do arquivo ' +
        'aparece medida no relatório do episódio; (2) o `ADR-005` exige rótulo de deep synthesis no conteúdo ' +
        'gerado, e a redação do rótulo segue NÃO VERIFICADA em fonte primária.',
    };
  }

  return {
    providerId: provider.id,
    model: provider.model,
    simulated: false,
    costPerImageUsd: preco,
    deepSynthesis: SEM_ROTULO,
    motivo:
      `Provedor de imagem real "${provider.id}" (${provider.model}). Este adapter não tem aviso próprio: ` +
      'preço por imagem e obrigação de rótulo estão NÃO VERIFICADOS, e o default é não afirmar o que não foi ' +
      'lido. Confira a allow-list do canal e a fonte de preço antes de tratar o custo como conhecido.',
  };
}

export interface ResolvedImageProvider {
  readonly provider: ImageProvider;
  readonly notice: ImageProviderNotice;
  /** De onde veio a decisão — escrito para que o humano possa discordar dela. */
  readonly origem: string;
}

/**
 * Escolhe o provedor de imagem **por configuração** (chave presente ou não) — nunca por `if` no pipeline.
 *
 * Sem chave **não é erro**: é a Fase 0 continuando executável, com o resultado dizendo em voz alta que a
 * imagem é prova de máquina. Com chave, o adapter real entra, e o portão de allow-list do canal ainda
 * precisa permitir `minimax / image-01 / imagem` — a chave não substitui a política.
 */
export function resolveImageProvider(): ResolvedImageProvider {
  if (hasMiniMaxKey()) {
    return {
      provider: miniMaxImageProvider,
      notice: imageProviderNotice(miniMaxImageProvider),
      origem:
        'Há chave da MiniMax neste ambiente (REBECA_MINIMAX_API_KEY ou .rebeca/segredos/midia.json): a arte ' +
        'das cenas é gerada de verdade e cobrada por imagem.',
    };
  }
  return {
    provider: simulatedImageProvider,
    notice: imageProviderNotice(simulatedImageProvider),
    origem:
      'Não há chave da MiniMax neste ambiente: as cenas caem no simulado (ffmpeg local, custo zero, prova de ' +
      'máquina). Nada foi cobrado e nada aqui é arte publicável.',
  };
}

/**
 * Onde o ativo vai nascer e qual é o hash da entrada — perguntando **ao provedor**.
 *
 * ## O que este ponto de extensão garante por si (achados 4 e 5 do `QA-015`)
 *
 * O `plan` de um provedor é **código de terceiro** para este módulo: pode montar o próprio caminho, ou
 * simplesmente não saber planejar. As duas garantias que o `AssetPlan` precisa carregar não podem depender
 * de sorte do provedor que existe hoje:
 *
 * 1. **O plano do simulado é do simulado — por identidade, não pela flag `simulated`** (achado 4). Antes o
 *    ramo de fallback era `if (provider.simulated) return planImage(input)`, e `planImage` fixa
 *    `providerId: 'simulado-imagem'` e o caminho do ffmpeg. Um **segundo** gerador local declarando
 *    `simulated: true` sem `plan` herdava hash **e caminho** do primeiro: escreveria no arquivo do outro e a
 *    reexecução serviria a arte alheia achando que é a sua. É o mesmo defeito que a Fase 2 existe para
 *    impedir, só que um nível acima.
 * 2. **O caminho devolvido é conferido contra o escopo do canal** (achado 5). `assertWithinChannel` era a
 *    "segunda rede" do isolamento, mas só rodava dentro de `assetPath` — ou seja, só nos planos do
 *    simulado e da MiniMax. Um adapter que monte o próprio caminho podia devolver algo fora de
 *    `.rebeca/assets/<canal>/` e o pipeline gravaria (e registraria no manifesto) um ativo de outro lugar.
 *    Agora a rede cobre **todo** plano que entra no pipeline, venha de onde vier.
 *
 * O provedor **real** que não saiba planejar continua recusado: sem `plan` o pipeline não sabe o nome do
 * arquivo antes de gerar, e com provedor pago isso significa pagar para descobrir.
 */
export function planImageFor(provider: ImageProvider, input: ImageRequest): AssetPlan {
  const planner = (provider as { readonly plan?: unknown }).plan;

  let plano: AssetPlan;
  if (typeof planner === 'function') {
    plano = (planner as (pedido: ImageRequest) => AssetPlan).call(provider, input);
  } else if (provider.id === simulatedImageProvider.id && provider.model === simulatedImageProvider.model) {
    // O plano canônico do simulado continua sendo o `planImage` dele — a fórmula do hash não foi reescrita
    // em dois lugares. O que mudou é a **chave** do reconhecimento: id **e** modelo, os mesmos que a
    // allow-list usa para autorizar. Um simulado diferente cai no `throw` abaixo.
    plano = planImage(input);
  } else {
    throw new Error(
      `O provedor de imagem "${provider.id}" (${provider.model}) não declara \`plan()\`: não há como saber o ` +
        'nome e o hash do ativo antes de gerar, e é essa checagem que impede pagar duas vezes pela mesma ' +
        `cena. O plano do provedor simulado "${simulatedImageProvider.id}" não vale para outro provedor — ` +
        'declarar `simulated: true` não empresta o caminho de ninguém. Nada foi gerado.',
    );
  }

  return assertPlanWithinScope(plano, input, provider);
}

/**
 * O plano é um ativo **deste** canal, com hash de verdade?
 *
 * `assertWithinChannel` resolve o caminho e recusa o que estiver fora de `.rebeca/assets/<canal>/` — a
 * mesma checagem que `assetPath` faz para os planos que passam por ele, agora aplicada a qualquer plano.
 * A forma do `hash`/`sha256` também é conferida porque é ela que vira **nome de arquivo** e chave de
 * manifesto: um provedor que devolva `hash: 'x'` produziria um ativo que nenhuma reexecução reconhece.
 */
function assertPlanWithinScope(plano: AssetPlan, input: ImageRequest, provider: ImageProvider): AssetPlan {
  if (typeof plano?.path !== 'string' || plano.path.length === 0) {
    throw new Error(`O provedor de imagem "${provider.id}" devolveu um plano sem caminho. Nada foi gerado.`);
  }
  try {
    assertWithinChannel(input.scopeChannelId, plano.path);
  } catch (error) {
    throw new ChannelScopeError(
      'caminho-fora-do-canal',
      `O plano do provedor de imagem "${provider.id}" aponta para "${plano.path}", que está fora da pasta do ` +
        `canal "${input.scopeChannelId}". Todo ativo tem de nascer em .rebeca/assets/<canal>/<episodio>/ ` +
        '(invariante nº 2) — o caminho do provedor não é exceção. Nada foi gerado. ' +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }
  if (!/^[0-9a-f]{8}$/.test(plano.hash) || !/^[0-9a-f]{64}$/.test(plano.sha256)) {
    throw new Error(
      `O plano do provedor de imagem "${provider.id}" tem hash fora do formato do projeto ` +
        `(hash="${plano.hash}", sha256 com ${plano.sha256?.length ?? 0} caracteres). O hash entra no nome do ` +
        'arquivo e no manifesto: fora do formato, a reexecução não reconhece o próprio ativo. Nada foi gerado.',
    );
  }
  return plano;
}
