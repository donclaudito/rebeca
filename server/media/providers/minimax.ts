/**
 * Adapter real da MiniMax — `image-01`, text-to-image, **duas finalidades**: thumbnail (Fase 1) e imagem
 * de cena (Fase 2, `decisão do dono em 2026-10-02`).
 *
 * **Este é o primeiro provedor de mídia do projeto que gasta dinheiro de verdade.** Por isso o arquivo é
 * explícito em três pontos:
 *
 * 1. **O schema não foi inventado.** Ele vem do OpenAPI publicado em
 *    `https://platform.minimax.io/docs/api-reference/image-generation-t2i`, lido em 2026-10-01: endpoint
 *    `POST /v1/image_generation`, auth `Authorization: Bearer <API_key>`, corpo
 *    `{ model, prompt, aspect_ratio, response_format, seed, n, prompt_optimizer }` e resposta
 *    `{ id, data: { image_urls? , image_base64? }, metadata: { success_count, failed_count }, base_resp: { status_code, status_msg } }`.
 *    Nada de "provavelmente é assim".
 * 2. **`response_format: 'base64'`, não `url`.** A doc avisa que a URL **expira em 24 horas**. Um
 *    pipeline cujo ativo é um link que morre no dia seguinte não tem idempotência: a segunda execução
 *    encontraria o hash no manifesto e reusaria um caminho quebrado. O base64 é gravado em disco na
 *    hora.
 * 3. **`base_resp.status_code` é checado antes de qualquer coisa.** A MiniMax devolve HTTP 200 com o
 *    erro dentro do corpo — tratar `response.ok` como sucesso faria "saldo insuficiente" (1008) virar
 *    "imagem gerada".
 *
 * Preço: US$ 0,0035 por imagem (https://platform.minimax.io/docs/guides/pricing-paygo, lido em
 * 2026-10-01 e **relido em 2026-10-02** — a Fase 2 não fixa número de preço sem conferir de novo). O valor
 * é **declarado no provedor** e o portão de entrada o usa antes de gerar.
 *
 * O que a releitura de 2026-10-02 acrescentou, e que vale para as **duas** finalidades (fonte: OpenAPI
 * oficial `api-reference/image-generation-t2i`):
 *
 * - `prompt` tem **máximo de 1500 caracteres** — este arquivo recusa antes da rede em vez de truncar em
 *   silêncio;
 * - `aspect_ratio` aceita 8 valores, cada um com tamanho **fixo** (`16:9` → 1280x720, `9:16` → 720x1280).
 *   Ou seja: pedir 1920x1080 devolve 1280x720, e é o render que amplia. Isso é fato documentado, não
 *   suposição — e está declarado no aviso do provedor (`image-provider.ts`), porque um arquivo de 720p
 *   apresentado como 1080p seria exatamente o tipo de número inventado que este projeto recusa;
 * - `width`/`height` existem para o `image-01`, mas **`aspect_ratio` tem prioridade** quando os dois vão
 *   juntos — logo, mandar os dois seria mandar o segundo sem efeito. A escolha está comentada em
 *   `miniMaxAspectRatioFor`;
 * - `metadata.failed_count` é o contador de imagem barrada por segurança de conteúdo.
 */

import { rmSync } from 'node:fs';
import type {
  AssetPlan,
  GeneratedAsset,
  ImageProvider,
  ImageRequest,
  ThumbnailProvider,
  ThumbnailRequest,
} from '../../../src/media/contract.js';
import { assetFingerprint } from '../hash.js';
import { assetPath } from '../paths.js';
import { createImageIntegrity } from './image-integrity.js';
import { miniMaxApiKey, miniMaxBaseUrl } from '../config.js';

export const MINIMAX_PROVIDER_ID = 'minimax';
export const MINIMAX_THUMBNAIL_MODEL = 'image-01';
/**
 * O mesmo modelo para a imagem de cena — **de propósito**.
 *
 * A allow-list do `ADR-005` é chaveada por `(fornecedor, modelo, finalidade)`, então `image-01` serve
 * thumbnail e cena sem abrir fornecedor novo: a leitura de termos não muda com o tamanho da saída nem com
 * o destino do arquivo (é o que a entrada `imagem` da allow-list da Luna registra, aprovada em 2026-10-02).
 * O que separa as duas na prática é a **etapa** — ela entra no hash (`stage: 'imagem'` × `'thumbnail'`),
 * no diretório do ativo e na consulta do portão.
 */
export const MINIMAX_IMAGE_MODEL = 'image-01';
/** Preço oficial por imagem. Fonte: platform.minimax.io/docs/guides/pricing-paygo (2026-10-01). */
export const MINIMAX_COST_PER_IMAGE_USD = 0.0035;

/**
 * Limite documentado de `prompt` no `POST /v1/image_generation` (OpenAPI oficial, lido em 2026-10-02).
 *
 * Existe como constante para ser **recusado antes da rede**: a MiniMax devolveria `2013` (parâmetro
 * inválido) depois de a requisição sair, e truncar em silêncio mudaria a arte sem ninguém saber.
 */
export const MINIMAX_PROMPT_MAX_CHARS = 1500;

/**
 * Tamanho nativo de cada `aspect_ratio` aceito — **valores da doc**, não escolha nossa.
 *
 * A tabela entra no código porque é ela que responde "que arquivo a MiniMax realmente entrega quando
 * pedimos 1920x1080?" — a resposta é 1280x720, e o pipeline tem de poder dizer isso em vez de supor.
 */
const MINIMAX_ASPECT_RATIOS = [
  { ratio: '1:1', width: 1024, height: 1024 },
  { ratio: '16:9', width: 1280, height: 720 },
  { ratio: '4:3', width: 1152, height: 864 },
  { ratio: '3:2', width: 1248, height: 832 },
  { ratio: '2:3', width: 832, height: 1248 },
  { ratio: '3:4', width: 864, height: 1152 },
  { ratio: '9:16', width: 720, height: 1280 },
  { ratio: '21:9', width: 1344, height: 576 },
] as const;

/**
 * Traduz a largura×altura do pedido numa proporção que a API aceita — ou **recusa**.
 *
 * Por que não mandar `width`/`height` e pedir 1920x1080 exato: a doc diz que, quando os dois vão juntos,
 * `aspect_ratio` tem **prioridade**. Mandar os dois seria mandar `width`/`height` sem efeito. E mandar só
 * `width`/`height` depende de o servidor não tratar o default `1:1` do `aspect_ratio` como valor
 * informado — hipótese que ninguém verificou com chave real, e que erraria para uma imagem quadrada.
 * Entre uma hipótese e um enum documentado, fica o enum documentado. A consequência (16:9 entrega
 * 1280x720, e o render amplia para 1920x1080) é **declarada**, não escondida.
 */
export function miniMaxAspectRatioFor(width: number, height: number): string {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new MiniMaxError(
      'parametro-invalido',
      `Dimensão inválida para a imagem: ${String(width)}x${String(height)}. Nada foi gerado.`,
    );
  }
  const alvo = width / height;
  const casada = MINIMAX_ASPECT_RATIOS.find((item) => Math.abs(item.width / item.height - alvo) < 0.005);
  if (casada === undefined) {
    throw new MiniMaxError(
      'parametro-invalido',
      `A proporção ${String(width)}x${String(height)} não corresponde a nenhuma das que a MiniMax aceita ` +
        `(${MINIMAX_ASPECT_RATIOS.map((item) => item.ratio).join(', ')}). Nada foi gerado e nada foi gasto — ` +
        'uma proporção inventada só produziria erro do provedor depois da chamada.',
    );
  }
  return casada.ratio;
}

/**
 * Obrigação de rótulo que o `ADR-005` anexou ao uso da MiniMax.
 *
 * `text: null` **não é esquecimento**: a redação exata do rótulo nunca foi lida em fonte primária — está
 * registrado como `NÃO VERIFICADO` no `spec-midia.json` do canal e a releitura direta da ToS em
 * 2026-10-02 devolveu corpo ilegível (página renderizada por JS). Então o código afirma o que sabe — *há*
 * exigência de rótulo, e ela não foi dispensada — e **não inventa o texto**. Quem redige o rodapé tem de
 * ler a cláusula antes de fixá-lo.
 */
export interface DeepSynthesisNotice {
  readonly required: boolean;
  /** `null` = redação NÃO VERIFICADA em fonte primária. Não invente o texto do rótulo. */
  readonly text: string | null;
  readonly source: string;
  readonly note: string;
}

export const MINIMAX_DEEP_SYNTHESIS: DeepSynthesisNotice = {
  required: true,
  text: null,
  source:
    'https://platform.minimax.io/protocol/terms-of-service (trecho citado em .rebeca/pesquisa/d2-termos-pendentes-menores.md; ' +
    'releitura direta em 2026-10-02 devolveu corpo ilegível — página renderizada por JS) + ADR-005',
  note:
    'A cláusula exige marca proeminente de uso de deep synthesis no conteúdo gerado. O TEXTO do rótulo do ' +
    'rodapé segue NÃO VERIFICADO (spec-midia.json → naoVerificado). Enquanto isso, a arte real da MiniMax ' +
    'não pode ir ao ar sem que alguém leia a cláusula e escreva o rótulo.',
};

export class MiniMaxError extends Error {
  readonly code: string;
  readonly statusCode: number | null;

  constructor(code: string, message: string, statusCode: number | null = null) {
    super(message);
    this.name = 'MiniMaxError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Integridade do ativo — **implementação compartilhada** (`image-integrity.ts`), com o erro deste adapter.
 *
 * As três funções moraram neste arquivo até o `QA-016` mostrar o custo de tê-las aqui: o adapter da
 * **OpenAI**, que é o caminho pago de thumbnail em uso, ficou sem nenhuma delas e manteve o defeito do
 * `QA-015` intacto (gravava antes de validar; `existsSync` como reuso). Uma implementação, dois adapters.
 *
 * O `criarErro` preserva o que já era observável aqui: mesma classe (`MiniMaxError`), mesmo
 * `code` (`resposta-invalida`) e **as mesmas mensagens** de antes da extração.
 */
const { isUsableImage, writeValidatedImage } = createImageIntegrity({
  criarErro: (mensagem) => new MiniMaxError('resposta-invalida', mensagem),
  // A MiniMax devolve `base64` sem o formato documentado: PNG ou JPEG são aceitos (era o comportamento
  // antes da extração, e ampliar ou reduzir isso aqui mudaria o que este adapter aceita).
  formatos: 'png-ou-jpeg',
});

/**
 * Traduz o `status_code` da MiniMax em mensagem acionável.
 *
 * A tabela é literal da doc (`errorcode` / `BaseResp.status_code`). O ponto não é o código: é a mensagem
 * dizer **o que fazer**. "Erro 1008" não ajuda ninguém; "saldo insuficiente, nada foi gerado" sim.
 */
function explainStatus(statusCode: number, statusMsg: string): MiniMaxError {
  const sufixo = statusMsg.length > 0 ? ` (${statusMsg})` : '';
  switch (statusCode) {
    case 1002:
      return new MiniMaxError('rate-limit', `A MiniMax recusou por limite de requisições${sufixo}. Tente de novo em instantes.`, statusCode);
    case 1004:
    case 2049:
      return new MiniMaxError('autenticacao', `A MiniMax recusou a chave de API${sufixo}. Confira a chave em Configurações. Nada foi gerado.`, statusCode);
    case 1008:
      return new MiniMaxError('saldo', `Saldo insuficiente na conta MiniMax${sufixo}. Nada foi gerado — recarregue ou reduza o número de opções.`, statusCode);
    case 1026:
      return new MiniMaxError('conteudo-sensivel', `A MiniMax bloqueou o prompt por conteúdo sensível${sufixo}. Nada foi gerado. Reveja o texto da arte antes de tentar de novo.`, statusCode);
    case 2013:
      return new MiniMaxError('parametro-invalido', `A MiniMax recusou os parâmetros${sufixo}. Nada foi gerado.`, statusCode);
    default:
      return new MiniMaxError('provedor', `A MiniMax devolveu status ${statusCode}${sufixo}. Nada foi gerado.`, statusCode);
  }
}

/**
 * Onde a opção vai nascer e qual é o hash da entrada.
 *
 * O hash inclui `providerId` e `model`: trocar de provedor muda o nome do arquivo, e é isso que impede a
 * Fase 1 de sobrescrever um ativo da Fase 0 (ou de reusar um PNG simulado achando que é arte real).
 * `seed` entra porque ele muda a imagem — sem ele no hash, duas seeds diferentes apontariam para o mesmo
 * arquivo e a segunda seria servida com a arte da primeira.
 */
export function planMiniMaxThumbnail(input: ThumbnailRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'thumbnail',
    promptVersion: input.promptVersion,
    providerId: MINIMAX_PROVIDER_ID,
    model: MINIMAX_THUMBNAIL_MODEL,
    input: { optionId: input.optionId, prompt: input.prompt, textOnImage: input.textOnImage },
    params: { width: input.width, height: input.height, seed: input.seed, aspectRatio: '16:9' },
  });
  const hash = sha256.slice(0, 8);
  return {
    hash,
    sha256,
    path: assetPath({
      scopeChannelId: input.scopeChannelId,
      channelId: input.channelId,
      episodeId: input.episodeId,
      stage: 'thumbnail',
      slug: `opcao-${input.optionId}`,
      hash8: hash,
      ext: 'png',
    }),
  };
}

interface MiniMaxResponse {
  readonly id?: string;
  readonly data?: { readonly image_base64?: unknown; readonly image_urls?: unknown };
  readonly metadata?: { readonly success_count?: unknown; readonly failed_count?: unknown };
  readonly base_resp?: { readonly status_code?: unknown; readonly status_msg?: unknown };
}

/**
 * A mensagem de "sem chave" — **uma só**, para as duas finalidades.
 *
 * Ela existia só no caminho da thumbnail e dizia "Cole a chave em Configurações" — e **não existe campo da
 * MiniMax na interface** (a tela de Configurações de IA conhece só os provedores de texto, e o arquivo de
 * mídia é separado de propósito, ver `server/media/config.ts`). Instrução impossível é o defeito que o dono
 * do produto já relatou: a tela manda fazer o que ela não permite. Aqui vão os dois caminhos que existem.
 *
 * A mesma chave cobre thumbnail e imagem de cena: é o mesmo modelo (`image-01`), com finalidades
 * diferentes na allow-list do canal.
 */
const SEM_CHAVE_MESSAGE =
  'Não há chave da MiniMax configurada. Ainda não existe campo para ela na interface: use a ' +
  'variável de ambiente REBECA_MINIMAX_API_KEY ou o arquivo .rebeca/segredos/midia.json ' +
  '({"minimax":{"apiKey":"..."}} — ignorado pelo git, e lido a cada chamada, então vale sem ' +
  'reiniciar o servidor). O atalho é `node .tools/instalar-chave-midia.mjs <arquivo>`. ' +
  'Nada foi gerado e nada foi gasto.';

/**
 * A chamada crua e a leitura da resposta — **uma implementação para as duas finalidades**.
 *
 * Estava escrita dentro do caminho da thumbnail. Duplicá-la para a imagem de cena faria o dia do conserto
 * chegar duas vezes: o `base_resp` que a MiniMax devolve dentro de HTTP 200, o `data.image_base64` vazio e
 * o `failed_count` são **semântica do provedor**, não da etapa. Um lugar só.
 *
 * O que ela garante, e cada item veio de um modo de falha real:
 * - `response.ok` **não** é sucesso: a MiniMax responde HTTP 200 com o erro em `base_resp`;
 * - resposta sem `base_resp.status_code` é recusada (tratar como sucesso gravaria imagem inexistente);
 * - sucesso sem imagem em `data.image_base64` é recusado, com o `failed_count` na mensagem quando existe
 *   (é o contador de imagem barrada por segurança de conteúdo);
 * - base64 que decodifica para zero byte é recusado.
 */
async function requestImageGeneration(apiKey: string, body: Readonly<Record<string, unknown>>): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(`${miniMaxBaseUrl()}/v1/image_generation`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (error) {
    // A mensagem NÃO ecoa a exceção crua: ela pode conter a URL com credencial em casos de proxy.
    const reason = error instanceof Error && error.name === 'TimeoutError' ? 'tempo esgotado' : 'falha de rede';
    throw new MiniMaxError(
      'rede',
      `Não foi possível falar com a MiniMax (${reason}). Nada foi gerado. Se o gasto já ocorreu do lado do ` +
        'provedor, ele não foi registrado aqui — confira o painel da MiniMax antes de repetir.',
    );
  }

  // HTTP 200 com erro dentro do corpo é o comportamento documentado: `base_resp` manda.
  let parsed: MiniMaxResponse | null = null;
  try {
    parsed = (await response.json()) as MiniMaxResponse;
  } catch {
    parsed = null;
  }

  if (!response.ok || parsed === null) {
    throw new MiniMaxError(
      'resposta-invalida',
      `A MiniMax respondeu HTTP ${response.status} sem JSON utilizável. Nada foi gravado.`,
      response.status,
    );
  }

  const statusCode = typeof parsed.base_resp?.status_code === 'number' ? parsed.base_resp.status_code : null;
  const statusMsg = typeof parsed.base_resp?.status_msg === 'string' ? parsed.base_resp.status_msg : '';

  if (statusCode === null) {
    throw new MiniMaxError(
      'resposta-invalida',
      'A resposta da MiniMax veio sem `base_resp.status_code`. Sem esse campo não dá para distinguir sucesso de ' +
        'erro, e tratar como sucesso gravaria imagem inexistente. Nada foi gravado.',
    );
  }
  if (statusCode !== 0) throw explainStatus(statusCode, statusMsg);

  const images = parsed.data?.image_base64;
  if (!Array.isArray(images) || images.length === 0 || typeof images[0] !== 'string') {
    /*
     * `failed_count` é lido como número **ou** como string (achado 7 do `QA-015`).
     *
     * O schema do OpenAPI declara `integer`, mas o **exemplo** do mesmo documento devolve
     * `failed_count: '0'` e `success_count: '3'` — string. Aceitar só número fazia a mensagem perder
     * justamente a pista que explica a imagem ausente ("pode ter sido bloqueio de segurança"), que é o
     * contador de conteúdo barrado. A recusa acontece igual; o que se perde é o diagnóstico.
     */
    const bruto = parsed.metadata?.failed_count;
    const falhas =
      typeof bruto === 'number' && Number.isFinite(bruto)
        ? bruto
        : typeof bruto === 'string' && /^\d+$/.test(bruto.trim())
          ? Number.parseInt(bruto.trim(), 10)
          : null;
    throw new MiniMaxError(
      'sem-imagem',
      'A MiniMax respondeu sucesso mas não devolveu imagem em `data.image_base64`' +
        (falhas !== null ? ` (failed_count=${falhas} — pode ter sido bloqueio de segurança)` : '') +
        '. Nada foi gravado.',
    );
  }

  const bytes = Buffer.from(images[0], 'base64');
  if (bytes.length === 0) {
    throw new MiniMaxError('sem-imagem', 'A MiniMax devolveu imagem em base64 que decodifica para zero bytes. Nada foi gravado.');
  }
  return bytes;
}

/**
 * Provedor real. Só é construído quando há chave — e o gate de allow-list roda **antes**, no chamador.
 */
export const miniMaxThumbnailProvider: ThumbnailProvider = {
  id: MINIMAX_PROVIDER_ID,
  model: MINIMAX_THUMBNAIL_MODEL,
  simulated: false,
  costPerImageUsd: MINIMAX_COST_PER_IMAGE_USD,

  plan: planMiniMaxThumbnail,

  async generate(input: ThumbnailRequest): Promise<GeneratedAsset> {
    const apiKey = miniMaxApiKey();
    if (apiKey === null) throw new MiniMaxError('sem-chave', SEM_CHAVE_MESSAGE);

    const { hash, path } = planMiniMaxThumbnail(input);

    /*
     * Mesmo hash ⇒ mesmo arquivo ⇒ não paga de novo (idempotência antes do gasto, `ADR-010` item 5).
     *
     * O que NÃO vale mais é tratar "existe qualquer coisa com esse nome" como pronto: `isUsableImage`
     * exige que o arquivo seja uma imagem decodificável. Se o que está lá é lixo (resposta ruim de uma
     * execução anterior, arquivo cortado no meio), ele é **apagado** e a arte é gerada de novo — em vez de
     * virar "sucesso com custo zero" sobre um arquivo que não abre (achado 1 do `QA-015`).
     */
    if (isUsableImage(path)) {
      return {
        path,
        providerId: MINIMAX_PROVIDER_ID,
        model: MINIMAX_THUMBNAIL_MODEL,
        costUsd: 0,
        hash,
        simulated: false,
      };
    }
    rmSync(path, { force: true });

    // O corpo é o mesmo contrato para as duas finalidades; o que muda é o prompt e a etapa do ativo.
    const body = {
      model: MINIMAX_THUMBNAIL_MODEL,
      // O texto na arte entra no prompt porque é o que a arte precisa mostrar; a legibilidade real
      // (3–4 palavras, contraste ≥ 4,5:1) é conferida depois, na tela — a doc da MiniMax não promete
      // renderização de texto, então nada aqui afirma que o texto sai correto.
      prompt: montarPrompt(input),
      aspect_ratio: '16:9',
      response_format: 'base64',
      n: 1,
      seed: input.seed,
      prompt_optimizer: false,
    };

    const bytes = await requestImageGeneration(apiKey, body);

    // Valida em arquivo de passagem e só então promove: falha não deixa ativo no disco.
    writeValidatedImage(path, bytes, `thumbnail opção ${input.optionId}`);

    return {
      path,
      providerId: MINIMAX_PROVIDER_ID,
      model: MINIMAX_THUMBNAIL_MODEL,
      // Custo REAL: a MiniMax cobra por imagem gerada, e esta foi gerada agora.
      costUsd: MINIMAX_COST_PER_IMAGE_USD,
      hash,
      simulated: false,
    };
  },
};

/**
 * Monta o prompt final.
 *
 * Inclui o texto da arte entre aspas porque a thumbnail precisa dele **legível**, e o pedido de "sem
 * texto extra" porque modelo de imagem tende a inventar letras — e letra inventada em thumbnail infantil
 * é defeito visível a 168×94 px.
 */
function montarPrompt(input: ThumbnailRequest): string {
  const partes = [input.prompt.trim()];
  if (input.textOnImage.trim().length > 0) {
    partes.push(`Include the text "${input.textOnImage.trim()}" rendered large and perfectly legible.`);
  }
  partes.push('Do not add any other text, letters, numbers or watermarks.');
  partes.push('Wide 16:9 composition, keep the main subject out of the bottom-right corner.');
  return partes.join(' ');
}

/* =============================================================================
   Imagem de cena (Fase 2) — a mesma máquina, outra finalidade
   ============================================================================= */

/**
 * Onde a imagem da cena vai nascer e qual é o hash da entrada — **sem tocar a rede**.
 *
 * A forma do hash é **idêntica** à do plano simulado (`planImage` em `providers/simulated.ts`): mesmos
 * campos de entrada, mesmos parâmetros. O que muda é `providerId` e `model`. Isso é deliberado — é o que
 * faz a mesma cena, pedida a outro provedor, nascer com **outro nome de arquivo** em vez de reusar o PNG
 * do ffmpeg achando que é arte real (e é o que impede o inverso, que é pior).
 *
 * `onScreenText` entra no hash mesmo sem entrar no prompt: o rótulo da cena é parte da identidade do
 * pedido, e o pipeline não pode reusar o arquivo de uma cena cujo rótulo mudou. O custo disso é regerar
 * uma imagem quando só o rótulo muda — e o custo do outro lado (servir arte do rótulo errado) é pior.
 */
export function planMiniMaxImage(input: ImageRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'imagem',
    promptVersion: input.promptVersion,
    providerId: MINIMAX_PROVIDER_ID,
    model: MINIMAX_IMAGE_MODEL,
    input: { sceneId: input.sceneId, prompt: input.prompt, onScreenText: input.onScreenText },
    params: { width: input.width, height: input.height, seed: input.seed },
  });
  const hash = sha256.slice(0, 8);
  return {
    hash,
    sha256,
    path: assetPath({
      scopeChannelId: input.scopeChannelId,
      channelId: input.channelId,
      episodeId: input.episodeId,
      stage: 'imagem',
      slug: input.sceneId,
      hash8: hash,
      ext: 'png',
    }),
  };
}

/**
 * Monta o prompt da cena.
 *
 * **O `onScreenText` NÃO entra aqui, ao contrário do que acontece na thumbnail.** O texto de tela de uma
 * cena é rótulo do ativo (na Fase 0 ele diz literalmente "Cena 1 — referência sintética"): desenhá-lo
 * dentro da ilustração colocaria uma legenda de bastidor na arte final. O que entra é o que a arte precisa
 * respeitar — sem letra inventada, porque letra inventada em vídeo infantil é defeito visível.
 *
 * O tamanho é conferido **antes** da rede: acima de `MINIMAX_PROMPT_MAX_CHARS` a MiniMax devolveria `2013`
 * depois da chamada, e truncar em silêncio trocaria a cena por outra sem que ninguém soubesse.
 */
function montarPromptDeCena(input: ImageRequest): string {
  const prompt = [
    input.prompt.trim(),
    'Do not add any text, letters, numbers, captions, speech bubbles or watermarks anywhere in the image.',
  ].join(' ');
  if (prompt.length > MINIMAX_PROMPT_MAX_CHARS) {
    throw new MiniMaxError(
      'parametro-invalido',
      `O prompt da cena "${input.sceneId}" tem ${prompt.length} caracteres e o limite documentado da MiniMax é ` +
        `${MINIMAX_PROMPT_MAX_CHARS} (api-reference/image-generation-t2i). Nada foi gerado e nada foi gasto — ` +
        'encurte a descrição da cena em vez de deixar o provedor truncar a arte em silêncio.',
    );
  }
  return prompt;
}

/**
 * O provedor **real** de imagem de cena, ao lado do simulado e atrás da mesma interface.
 *
 * Quatro coisas acontecem nesta ordem, e a ordem é o desenho (`ADR-010` → `ADR-013`):
 *
 * 1. **Sem chave, recusa** — quem cai para o simulado é a **seleção** (`resolveImageProvider`), não este
 *    adapter. Um adapter real que "se vira" sozinho é como a tela passa a mostrar ffmpeg sem dizer que é
 *    ffmpeg.
 * 2. **Idempotência antes do gasto** — o hash vem do `plan()`, que não toca a rede; arquivo já existente
 *    **e decodificável** devolve `costUsd: 0` e **nenhuma requisição sai**. Reexecutar não paga de novo nem
 *    se apoia só no manifesto: a prova é o arquivo existir *e abrir*. Arquivo presente que não abre é
 *    apagado e regerado (achado 1 do `QA-015`) — senão a retentativa transformaria falha em sucesso.
 * 3. **Parâmetros conferidos antes da chamada** — proporção que a API não aceita e prompt acima de 1500
 *    caracteres falham aqui, com a rede intacta.
 * 4. **Custo REAL, do preço publicado** — a MiniMax cobra por imagem gerada, e esta foi gerada agora. O
 *    `render` devolve `costUsd = MINIMAX_COST_PER_IMAGE_USD` e quem lança no livro é o pipeline.
 * 5. **Grava validando** — os bytes vão para um arquivo de passagem, são decodificados por `ffmpeg` e só
 *    então promovidos por `rename`. Falha não deixa ativo no disco, e não existe janela de arquivo pela
 *    metade.
 *
 * O portão de allow-list (`minimax / image-01 / imagem`) **não** roda dentro do adapter: ele roda no topo
 * do pipeline, antes de tudo. Aqui há uma segunda rede, de escopo: `assetPath` recusa gravar ativo de um
 * canal na pasta de outro (invariante nº 2), e essa checagem acontece no `plan()` — antes do gasto.
 */
export const miniMaxImageProvider: ImageProvider & {
  readonly plan: (input: ImageRequest) => AssetPlan;
  /**
   * Preço por imagem, declarado **no provedor** (como no `ThumbnailProvider`).
   *
   * A interface `ImageProvider` do contrato não pede este campo, e ele é declarado aqui de propósito: é o
   * que permite ao portão de entrada estimar o gasto de N cenas **antes** de gerar. O pipeline o lê por
   * tipo estrutural (`declaredUnitPriceUsd`, em `image-provider.ts`) — nunca por `if` no meio do pipeline.
   */
  readonly costPerImageUsd: number;
} = {
  id: MINIMAX_PROVIDER_ID,
  model: MINIMAX_IMAGE_MODEL,
  simulated: false,
  costPerImageUsd: MINIMAX_COST_PER_IMAGE_USD,

  plan: planMiniMaxImage,

  async render(input: ImageRequest): Promise<GeneratedAsset> {
    const apiKey = miniMaxApiKey();
    if (apiKey === null) throw new MiniMaxError('sem-chave', SEM_CHAVE_MESSAGE);

    const { hash, path } = planMiniMaxImage(input);

    // Mesmo hash ⇒ mesmo arquivo ⇒ não paga de novo. A idempotência é verificada **no disco**, e não só no
    // manifesto: é o que faz um retry depois de falha no meio do pipeline não custar nada. O arquivo tem
    // de ser uma imagem que ABRE — "existe um arquivo com esse nome" não é ativo (achado 1 do `QA-015`).
    if (isUsableImage(path)) {
      return { path, providerId: MINIMAX_PROVIDER_ID, model: MINIMAX_IMAGE_MODEL, costUsd: 0, hash, simulated: false };
    }
    rmSync(path, { force: true });

    const aspectRatio = miniMaxAspectRatioFor(input.width, input.height);
    const prompt = montarPromptDeCena(input);

    const bytes = await requestImageGeneration(apiKey, {
      model: MINIMAX_IMAGE_MODEL,
      prompt,
      aspect_ratio: aspectRatio,
      response_format: 'base64',
      n: 1,
      seed: input.seed,
      prompt_optimizer: false,
    });

    // Valida em arquivo de passagem e só então promove: falha aqui não deixa ativo no disco.
    writeValidatedImage(path, bytes, `cena ${input.sceneId}`);

    return {
      path,
      providerId: MINIMAX_PROVIDER_ID,
      model: MINIMAX_IMAGE_MODEL,
      // Custo REAL: imagem gerada agora, cobrada por imagem pelo preço publicado.
      costUsd: MINIMAX_COST_PER_IMAGE_USD,
      hash,
      simulated: false,
    };
  },
};
