/**
 * Adapter real da MiniMax para thumbnail — `image-01`, text-to-image, 16:9.
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
 * 2026-10-01). O valor é **declarado no provedor** e o portão de entrada o usa antes de gerar.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import type {
  AssetPlan,
  GeneratedAsset,
  ThumbnailProvider,
  ThumbnailRequest,
} from '../../../src/media/contract.js';
import { assetFingerprint } from '../hash.js';
import { assetPath, ensureParentDir } from '../paths.js';
import { miniMaxApiKey, miniMaxBaseUrl } from '../config.js';

export const MINIMAX_PROVIDER_ID = 'minimax';
export const MINIMAX_THUMBNAIL_MODEL = 'image-01';
/** Preço oficial por imagem. Fonte: platform.minimax.io/docs/guides/pricing-paygo (2026-10-01). */
export const MINIMAX_COST_PER_IMAGE_USD = 0.0035;

/** Assinaturas que provam que o arquivo gravado é mesmo uma imagem, e não bytes de erro. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

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

function assertImageBytes(path: string): void {
  const head = readFileSync(path).subarray(0, 3);
  const isPng = head.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE.subarray(0, 3));
  const isJpeg = head.equals(JPEG_SIGNATURE);
  if (!isPng && !isJpeg) {
    throw new MiniMaxError(
      'resposta-invalida',
      `O arquivo gravado em "${path}" não é uma imagem (assinatura PNG/JPEG ausente). A resposta do provedor ` +
        'foi aceita como imagem sem ser — melhor falhar aqui do que entregar um arquivo corrompido ao humano.',
    );
  }
}

interface MiniMaxResponse {
  readonly id?: string;
  readonly data?: { readonly image_base64?: unknown; readonly image_urls?: unknown };
  readonly metadata?: { readonly success_count?: unknown; readonly failed_count?: unknown };
  readonly base_resp?: { readonly status_code?: unknown; readonly status_msg?: unknown };
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
    if (apiKey === null) {
      /*
       * A mensagem dizia "Cole a chave em Configurações" — e **não existe campo da MiniMax na
       * interface** (a tela de Configurações de IA conhece só os provedores de texto, e o arquivo de
       * mídia é separado de propósito, ver `server/media/config.ts`). Instrução impossível é o mesmo
       * defeito que o dono do produto já relatou duas vezes nesta sessão: a tela manda fazer o que ela
       * não permite. Aqui vão os dois caminhos que existem de fato.
       */
      throw new MiniMaxError(
        'sem-chave',
        'Não há chave da MiniMax configurada. Ainda não existe campo para ela na interface: use a ' +
          'variável de ambiente REBECA_MINIMAX_API_KEY ou o arquivo .rebeca/segredos/midia.json ' +
          '({"minimax":{"apiKey":"..."}} — ignorado pelo git, e lido a cada chamada, então vale sem ' +
          'reiniciar o servidor). O atalho é `node .tools/instalar-chave-midia.mjs <arquivo>`. ' +
          'Nada foi gerado e nada foi gasto.',
      );
    }

    const { hash, path } = planMiniMaxThumbnail(input);

    // Mesmo hash ⇒ mesmo arquivo ⇒ não paga de novo. É a idempotência antes do gasto (ADR-010, item 5).
    if (fileExists(path)) {
      return {
        path,
        providerId: MINIMAX_PROVIDER_ID,
        model: MINIMAX_THUMBNAIL_MODEL,
        costUsd: 0,
        hash,
        simulated: false,
      };
    }

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
      const falhas = typeof parsed.metadata?.failed_count === 'number' ? parsed.metadata.failed_count : null;
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

    ensureParentDir(path);
    writeFileSync(path, bytes);
    assertImageBytes(path);

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

function fileExists(path: string): boolean {
  try {
    return readFileSync(path).length > 0;
  } catch {
    return false;
  }
}
