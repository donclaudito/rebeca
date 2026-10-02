/**
 * Adapter real da OpenAI para thumbnail — `gpt-image-2.5-sunburst`, geração de imagem.
 *
 * **Por que a OpenAI, e não a MiniMax.** A MiniMax tem preço fixo por imagem (US$ 0,0035) e já estava na
 * allow-list, mas exige uma chave que não existe nesta máquina. A OpenAI tem **chave que funciona aqui** e
 * uma página oficial — *Under-18 guidance* — que **prevê e orienta** quem serve público menor de 18 anos,
 * em vez de proibir. É o oposto da cláusula do Google, que é o motivo de o `ADR-005` tê-lo bloqueado.
 *
 * **Schema verificado, não inventado** (`developers.openai.com/api/docs/guides/image-generation`, lido em
 * 2026-10-01):
 *
 * - `POST https://api.openai.com/v1/images/generations`, `Authorization: Bearer <chave>`
 * - corpo `{ model, prompt, size, quality }`; resposta `{ data: [{ b64_json }], usage }`
 * - `size` aceita **dimensão customizada** `WIDTHxHEIGHT` em múltiplos de 16, proporção entre 1:3 e 3:1,
 *   nenhum lado acima de 3840. **`1280x720` é válido** — o tamanho exato da thumbnail, sem recorte.
 * - erro de conteúdo vem como `error.code = "moderation_blocked"` com `moderation_details`.
 *
 * **Custo — e a honestidade sobre ele.** A página de preços cobra **por token** (imagem de saída
 * US$ 30,00/1M no `gpt-image-2.5`), não por imagem; não existe valor fixo publicado. Então este arquivo
 * declara um **teto conservador** (`TETO_POR_IMAGEM_USD`) para o portão de entrada poder recusar antes de
 * gastar, e grava no livro o custo **real** calculado dos tokens que a resposta devolve — quando ela
 * devolve. Teto e custo real são coisas diferentes, e o código não confunde as duas.
 *
 * O que este adapter **não** faz: manter o personagem consistente entre episódios. Isso exige imagem de
 * referência, e a arte do personagem ainda não existe no canal.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AssetPlan,
  GeneratedAsset,
  ThumbnailProvider,
  ThumbnailRequest,
} from '../../../src/media/contract.js';
import { assetFingerprint } from '../hash.js';
import { assetPath, ensureParentDir, repoRoot } from '../paths.js';

export const OPENAI_PROVIDER_ID = 'openai';
export const OPENAI_THUMBNAIL_MODEL = 'gpt-image-2.5-sunburst';

/**
 * Teto conservador por imagem, em USD — para o **portão de entrada**, não para o livro.
 *
 * Derivado das tarifas oficiais por token (saída US$ 30,00/1M no `gpt-image-2.5`), não de um preço fixo
 * publicado — que não existe. `quality: 'low'` mantém o gasto real muito abaixo disto; o teto existe para
 * que o pior caso caiba no limite mensal e para que o portão tenha **o que comparar antes de gerar**
 * (`ADR-010`). Se algum dia a resposta vier com `usage`, o custo real é calculado e gravado no lugar.
 */
export const TETO_POR_IMAGEM_USD = 0.2;

const PRECO_SAIDA_POR_TOKEN = 30.0 / 1_000_000;
const PRECO_ENTRADA_TEXTO_POR_TOKEN = 5.0 / 1_000_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class OpenAiImageError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OpenAiImageError';
    this.code = code;
  }
}

/**
 * A chave vem do **mesmo arquivo da camada de IA** — uma fonte só de segredo por ambiente.
 *
 * Ler o segredo aqui, e não duplicá-lo em outro arquivo, é o que impede duas verdades sobre a mesma
 * credencial. Nada nesta função devolve a chave para fora do servidor.
 */
export function openAiApiKey(): string | null {
  const fromEnv = process.env['OPENAI_API_KEY'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();

  const path = join(repoRoot(), '.rebeca', 'segredos', 'llm.json');
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as {
      providers?: { openai?: { apiKey?: unknown } };
    };
    const key = raw.providers?.openai?.apiKey;
    return typeof key === 'string' && key.trim().length > 0 ? key.trim() : null;
  } catch {
    return null;
  }
}

export function hasOpenAiKey(): boolean {
  return openAiApiKey() !== null;
}

export function planOpenAiThumbnail(input: ThumbnailRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'thumbnail',
    promptVersion: input.promptVersion,
    providerId: OPENAI_PROVIDER_ID,
    model: OPENAI_THUMBNAIL_MODEL,
    input: { optionId: input.optionId, prompt: input.prompt, textOnImage: input.textOnImage },
    params: { width: input.width, height: input.height, seed: input.seed, quality: 'low' },
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

interface OpenAiImageResponse {
  readonly data?: ReadonlyArray<{ readonly b64_json?: unknown }>;
  readonly usage?: {
    readonly input_tokens?: unknown;
    readonly output_tokens?: unknown;
  };
  readonly error?: { readonly code?: unknown; readonly message?: unknown };
}

/** Custo real a partir do `usage`, quando ele vem. Sem `usage`, cai no teto e **declara** que caiu. */
function custoReal(resposta: OpenAiImageResponse): { usd: number; fonte: 'usage' | 'teto' } {
  const entrada = typeof resposta.usage?.input_tokens === 'number' ? resposta.usage.input_tokens : null;
  const saida = typeof resposta.usage?.output_tokens === 'number' ? resposta.usage.output_tokens : null;
  if (entrada === null || saida === null) return { usd: TETO_POR_IMAGEM_USD, fonte: 'teto' };
  return {
    usd: entrada * PRECO_ENTRADA_TEXTO_POR_TOKEN + saida * PRECO_SAIDA_POR_TOKEN,
    fonte: 'usage',
  };
}

export const openAiThumbnailProvider: ThumbnailProvider = {
  id: OPENAI_PROVIDER_ID,
  model: OPENAI_THUMBNAIL_MODEL,
  simulated: false,
  costPerImageUsd: TETO_POR_IMAGEM_USD,

  plan: planOpenAiThumbnail,

  async generate(input: ThumbnailRequest): Promise<GeneratedAsset> {
    const apiKey = openAiApiKey();
    if (apiKey === null) {
      throw new OpenAiImageError(
        'sem-chave',
        'Não há chave da OpenAI configurada. Configure em Configurações → Inteligência artificial. ' +
          'Nada foi gerado e nada foi gasto.',
      );
    }

    const { hash, path } = planOpenAiThumbnail(input);
    if (existsSync(path)) {
      return {
        path,
        providerId: OPENAI_PROVIDER_ID,
        model: OPENAI_THUMBNAIL_MODEL,
        costUsd: 0,
        hash,
        simulated: false,
      };
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: OPENAI_THUMBNAIL_MODEL,
          prompt: input.prompt,
          // 1280×720 é múltiplo de 16 nas duas dimensões e 16:9 — o tamanho exato da thumbnail.
          size: `${input.width}x${input.height}`,
          // `low` de propósito: thumbnail é avaliada a 168×94 px, e o custo é por token de saída.
          quality: 'low',
        }),
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      const motivo = error instanceof Error && error.name === 'TimeoutError' ? 'tempo esgotado' : 'falha de rede';
      throw new OpenAiImageError(
        'rede',
        `Não foi possível falar com a OpenAI (${motivo}). Se o gasto ocorreu do lado do provedor, ele não foi ` +
          'registrado aqui — confira o painel antes de repetir.',
      );
    }

    let parsed: OpenAiImageResponse | null = null;
    try {
      parsed = (await response.json()) as OpenAiImageResponse;
    } catch {
      parsed = null;
    }

    if (!response.ok || parsed === null) {
      const codigo = typeof parsed?.error?.code === 'string' ? parsed.error.code : `http-${response.status}`;
      const mensagem = typeof parsed?.error?.message === 'string' ? parsed.error.message : '';

      if (codigo === 'moderation_blocked') {
        throw new OpenAiImageError(
          'conteudo-bloqueado',
          'A OpenAI bloqueou este prompt por política de conteúdo. Nada foi gravado. Reveja o texto da arte ' +
            `antes de tentar de novo.${mensagem ? ` (${mensagem})` : ''}`,
        );
      }
      if (response.status === 403 || /verif/i.test(mensagem)) {
        throw new OpenAiImageError(
          'organizacao-nao-verificada',
          'A conta parece não ter a verificação de organização exigida para os modelos GPT Image. Complete a ' +
            'verificação no painel da OpenAI e tente de novo. Nada foi gravado.',
        );
      }
      throw new OpenAiImageError(
        'provedor',
        `A OpenAI respondeu ${response.status}${codigo ? ` (${codigo})` : ''}${mensagem ? `: ${mensagem}` : ''}. Nada foi gravado.`,
      );
    }

    const b64 = parsed.data?.[0]?.b64_json;
    if (typeof b64 !== 'string' || b64.length === 0) {
      throw new OpenAiImageError(
        'sem-imagem',
        'A OpenAI respondeu sem imagem em `data[0].b64_json`. Nada foi gravado.',
      );
    }

    const bytes = Buffer.from(b64, 'base64');
    ensureParentDir(path);
    writeFileSync(path, bytes);

    if (!readFileSync(path).subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      throw new OpenAiImageError(
        'resposta-invalida',
        `O arquivo gravado em "${path}" não é um PNG (assinatura ausente). Melhor falhar aqui do que entregar ` +
          'arquivo corrompido ao humano.',
      );
    }

    const custo = custoReal(parsed);
    return {
      path,
      providerId: OPENAI_PROVIDER_ID,
      model: OPENAI_THUMBNAIL_MODEL,
      costUsd: custo.usd,
      hash,
      simulated: false,
    };
  },
};
