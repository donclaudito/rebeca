/**
 * Spec de mídia do canal — `.rebeca/canais/<canal>/spec-midia.json`.
 *
 * O formato de saída é **contrato do canal** (a skill é explícita: "formato é contrato, não preferência").
 * Por isso a spec vive no canal e o pipeline a **lê e confere** contra os valores que estão em código:
 *
 * - valores de **formato** (largura, altura, fps, codec, loudness) têm de bater com `src/media/limits.ts`.
 *   Divergiu ⇒ **erro**, não obediência silenciosa: mudar formato é mudança que exige revisão de código, e
 *   um JSON editado à mão não pode afrouxar o que o código fixou;
 * - valores **editoriais** (duração alvo do longo, teto do Short) vêm da spec, porque são escolha de canal
 *   e não regra técnica;
 * - o que **não foi verificado** está escrito no arquivo, no campo `naoVerificado`. Um arquivo de spec que
 *   apresenta loudness não conferido como se fosse exigência oficial é pior que não ter spec.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LONG_RENDER_SPEC, MEDIA_LIMITS, SHORT_RENDER_SPEC } from '../../src/media/limits.js';
import { assertSafeSegment, repoRoot } from './paths.js';

export interface ChannelMediaSpec {
  readonly canal: string;
  readonly nome: string;
  readonly aprovadoPor: string;
  readonly aprovadoEm: string;
  readonly referencia: string;
  readonly fps: number;
  readonly longo: {
    readonly largura: number;
    readonly altura: number;
    readonly codec: string;
    readonly crf: number;
    readonly preset: string;
    readonly pixelFormat: string;
    readonly audioCodec: string;
    readonly audioBitrate: string;
  };
  readonly short: {
    readonly largura: number;
    readonly altura: number;
    readonly recorte: string;
    readonly codec: string;
    readonly crf: number;
    readonly audioCodec: string;
    readonly audioBitrate: string;
  };
  readonly loudness: {
    readonly integratedLufs: number;
    readonly truePeakDb: number;
    readonly lra: number;
    readonly trilhaGanho: number;
    readonly verificado: boolean;
    readonly nota: string;
  };
  readonly duracao: {
    readonly longoAlvoSeg: number;
    readonly shortMaxSeg: number;
    readonly verificado: boolean;
    readonly nota: string;
  };
  readonly custos: {
    readonly tetoPorMinutoUsd: number;
    readonly limiteMensalUsd: number;
  };
  readonly naoVerificado: readonly string[];
}

export function channelSpecPath(channelId: string): string {
  return join(repoRoot(), '.rebeca', 'canais', assertSafeSegment(channelId, 'canal'), 'spec-midia.json');
}

/**
 * Lê a spec do canal. Devolve `null` quando o canal ainda não tem arquivo — ausência de spec não pode
 * derrubar o pipeline, mas também não pode liberar formato inventado (os padrões de código valem).
 */
export function loadChannelMediaSpec(channelId: string): ChannelMediaSpec | null {
  const path = channelSpecPath(channelId);
  if (!existsSync(path)) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `A spec de mídia de "${channelId}" não é JSON válido (${path}): ${error instanceof Error ? error.message : 'erro de leitura'}.`,
    );
  }
  return validateSpec(channelId, parsed, path);
}

function validateSpec(channelId: string, parsed: unknown, path: string): ChannelMediaSpec {
  const fail = (why: string): never => {
    throw new Error(`Spec de mídia inválida em ${path}: ${why}`);
  };
  if (typeof parsed !== 'object' || parsed === null) fail('o conteúdo não é um objeto');

  const spec = parsed as Partial<ChannelMediaSpec>;
  if (spec.canal !== channelId) fail(`o campo "canal" é "${String(spec.canal)}" e deveria ser "${channelId}"`);
  if (typeof spec.fps !== 'number' || spec.fps <= 0) fail('"fps" ausente ou inválido');
  if (!spec.longo || typeof spec.longo !== 'object') fail('bloco "longo" ausente');
  if (!spec.short || typeof spec.short !== 'object') fail('bloco "short" ausente');
  if (!spec.loudness || typeof spec.loudness !== 'object') fail('bloco "loudness" ausente');
  if (!spec.duracao || typeof spec.duracao !== 'object') fail('bloco "duracao" ausente');
  if (!Array.isArray(spec.naoVerificado) || spec.naoVerificado.length === 0) {
    // Exigir o campo é proposital: obriga quem escreve a spec a dizer, por escrito, o que não foi
    // conferido. Spec sem essa lista aparenta estar toda verificada.
    fail('"naoVerificado" precisa listar explicitamente o que não foi conferido');
  }

  return spec as ChannelMediaSpec;
}

/**
 * Confere a spec contra o código.
 *
 * A comparação é de **formato**, não de intenção: se o JSON e o código discordarem, o pipeline para. O
 * contrário — obedecer ao JSON — faria de um arquivo de dados o lugar onde se afrouxa loudness ou se troca
 * a resolução, sem revisão e sem registro.
 */
export function assertSpecMatchesCode(spec: ChannelMediaSpec): void {
  const divergencias: string[] = [];
  const check = (what: string, fromSpec: unknown, fromCode: unknown) => {
    if (fromSpec !== fromCode) divergencias.push(`${what}: spec=${String(fromSpec)} código=${String(fromCode)}`);
  };

  check('fps', spec.fps, LONG_RENDER_SPEC.fps);
  check('longo.largura', spec.longo.largura, LONG_RENDER_SPEC.width);
  check('longo.altura', spec.longo.altura, LONG_RENDER_SPEC.height);
  check('longo.codec', spec.longo.codec, LONG_RENDER_SPEC.videoCodec);
  check('longo.crf', spec.longo.crf, LONG_RENDER_SPEC.crf);
  check('longo.pixelFormat', spec.longo.pixelFormat, LONG_RENDER_SPEC.pixelFormat);
  check('longo.audioCodec', spec.longo.audioCodec, LONG_RENDER_SPEC.audioCodec);
  check('longo.audioBitrate', spec.longo.audioBitrate, LONG_RENDER_SPEC.audioBitrate);
  check('short.largura', spec.short.largura, SHORT_RENDER_SPEC.width);
  check('short.altura', spec.short.altura, SHORT_RENDER_SPEC.height);
  check('loudness.integratedLufs', spec.loudness.integratedLufs, LONG_RENDER_SPEC.loudness.integratedLufs);
  check('loudness.truePeakDb', spec.loudness.truePeakDb, LONG_RENDER_SPEC.loudness.truePeakDb);
  check('loudness.lra', spec.loudness.lra, LONG_RENDER_SPEC.loudness.lra);
  check('loudness.trilhaGanho', spec.loudness.trilhaGanho, LONG_RENDER_SPEC.musicGain);
  check('custos.tetoPorMinutoUsd', spec.custos?.tetoPorMinutoUsd, MEDIA_LIMITS.perMinuteUsd);
  check('custos.limiteMensalUsd', spec.custos?.limiteMensalUsd, MEDIA_LIMITS.monthlyUsd);
  if (spec.duracao.shortMaxSeg > MEDIA_LIMITS.shortMaxSeconds) {
    divergencias.push(
      `duracao.shortMaxSeg: spec=${spec.duracao.shortMaxSeg} acima do teto de código=${MEDIA_LIMITS.shortMaxSeconds}`,
    );
  }

  if (divergencias.length > 0) {
    throw new Error(
      `A spec de mídia do canal diverge do código em: ${divergencias.join(' | ')}. ` +
        'Formato e teto são fixados em código (src/media/limits.ts) e mudá-los exige revisão — editar o JSON não é caminho.',
    );
  }
}
