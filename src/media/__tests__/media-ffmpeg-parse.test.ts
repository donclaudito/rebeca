/**
 * Leitura do log do ffmpeg — regressão dos dois defeitos medidos nesta sessão.
 *
 * O resumo do `loudnorm` é **texto de log**, não API: o formato é contrato frágil, e quando ele muda (ou
 * quando um sinal `+` aparece) o pipeline não quebra — ele simplesmente deixa de reconhecer e cai para o
 * modo degradado, em silêncio. Foi o que aconteceu duas vezes:
 *
 * 1. o LRA vem em `LU`, não em `LUFS` — exigir `LUFS` fazia a leitura falhar e o relatório dizer
 *    "não foi possível medir loudness" sobre um áudio perfeitamente medível;
 * 2. o `Target Offset` vem com sinal explícito (`+0.0 LU`) — regex que só aceitava `-` derrubava a análise
 *    e o render caía para `loudnorm` de passe único sem avisar.
 *
 * Nenhum teste aqui chama o ffmpeg: são funções puras sobre o texto do log.
 */

import { describe, expect, it } from 'vitest';
import {
  escapeFilterOptionValue,
  parseFrameRate,
  parseLoudnormAnalysis,
  parseLoudnessSummary,
  FfmpegError,
  assertFilterSafe,
} from '../../../server/media/ffmpeg.js';

/** Resumo real capturado do ffmpeg 8.1.2 nesta máquina (sinal `+` incluso de propósito). */
const RESUMO_REAL = `
[Parsed_loudnorm_0 @ 000001feb889f940]
Input Integrated:    -46.3 LUFS
Input True Peak:     -42.3 dBTP
Input LRA:             0.0 LU
Input Threshold:     -56.3 LUFS

Output Integrated:   -14.0 LUFS
Output True Peak:     -10.1 dBTP
Output LRA:            0.1 LU
Output Threshold:    -24.0 LUFS

Normalization Type:   Dynamic
Target Offset:        +0.0 LU
`;

describe('leitura do resumo do loudnorm', () => {
  it('lê os cinco números do passe 1 — inclusive o LRA em LU e o offset com sinal +', () => {
    const analysis = parseLoudnormAnalysis(RESUMO_REAL);

    expect(analysis).not.toBeNull();
    expect(analysis?.inputIntegratedLufs).toBeCloseTo(-46.3, 6);
    expect(analysis?.inputTruePeakDb).toBeCloseTo(-42.3, 6);
    expect(analysis?.inputLra).toBeCloseTo(0, 6);
    expect(analysis?.inputThresholdLufs).toBeCloseTo(-56.3, 6);
    expect(analysis?.targetOffsetLu).toBeCloseTo(0, 6);
  });

  it('o resumo do arquivo renderizado também é lido (mesmo formato)', () => {
    const resumo = `
Input Integrated:    -14.0 LUFS
Input True Peak:      -5.0 dBTP
Input LRA:             0.4 LU
Input Threshold:     -24.0 LUFS
Target Offset:        -0.3 LU
`;
    expect(parseLoudnessSummary(resumo)).toEqual({ integratedLufs: -14, truePeakDb: -5, lra: 0.4 });
  });

  it('devolve null quando o log não traz o resumo — degradar é melhor que inventar número', () => {
    expect(parseLoudnormAnalysis('frame= 100 fps=30\n')).toBeNull();
    expect(parseLoudnessSummary('sem áudio neste arquivo')).toBeNull();
    // Resumo pela metade também é null: sem os cinco valores o passe 2 seria chute.
    expect(parseLoudnormAnalysis('Input Integrated: -14.0 LUFS\n')).toBeNull();
  });
});

describe('escape de valor de filtro do ffmpeg', () => {
  it('escapa o dois-pontos de caminho do Windows (o filtro não aceita "C:")', () => {
    expect(escapeFilterOptionValue('C:/Windows/Fonts/arial.ttf')).toBe('C\\\\:/Windows/Fonts/arial.ttf');
    expect(escapeFilterOptionValue('C:\\Windows\\Fonts\\arial.ttf')).toBe('C\\\\:/Windows/Fonts/arial.ttf');
  });

  it('recusa valor que não dá para escapar com segurança', () => {
    for (const ruim of ["a,b", "a'b", 'a;b', 'a[b]', 'a\nb', 'a%b']) {
      expect(() => assertFilterSafe(ruim, 'caminho')).toThrowError(FfmpegError);
    }
  });

  it('lê a taxa de quadros no formato do ffprobe', () => {
    expect(parseFrameRate('30/1')).toBe(30);
    expect(parseFrameRate('30000/1001')).toBeCloseTo(29.97, 2);
    expect(parseFrameRate('0/0')).toBeNull();
    expect(parseFrameRate(undefined)).toBeNull();
  });
});
