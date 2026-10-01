/**
 * Timeline e legenda — a fala medida manda, e a legenda sai da MESMA timeline.
 *
 * Dois critérios da skill são verificados aqui, sem ffmpeg:
 *
 * 1. **nenhum bloco de legenda começa depois do fim do vídeo** (nem termina além dele);
 * 2. **desvio fala↔legenda ≤ 200 ms** — inclusive no caso ruim: muitas cenas com duração quebrada, que é
 *    onde o arredondamento por quadro acumularia erro se fosse feito do jeito ingênuo.
 *
 * O `SpokenLine` falso existe de propósito: o que está sob teste é a aritmética da timeline, não a
 * geração da voz. O caminho com arquivo real é coberto em `media-render.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import type { GeneratedAsset, SceneSpec, SpokenLine } from '../contract.js';
import {
  assertSrtWithinVideo,
  buildTimeline,
  planFrames,
  renderSrt,
  sanitizeCaptionText,
  srtBlocks,
  srtTimestamp,
} from '../../../server/media/timeline.js';

const FPS = 30;

function scene(id: string, index: number, narration: string): SceneSpec {
  return { id, index, narration, onScreenText: narration, imagePrompt: narration, emotion: 'neutra', seed: index };
}

const ASSET: GeneratedAsset = {
  path: 'C:/fake/imagem.png',
  providerId: 'simulado-imagem',
  model: 'teste',
  costUsd: 0,
  hash: 'aaaaaaaa',
  simulated: true,
};

function spoken(durationMs: number): SpokenLine {
  return { ...ASSET, durationMs };
}

function timelineOf(durations: readonly number[]) {
  return buildTimeline({
    channelId: 'luna',
    episodeId: 'luna-ep-001',
    slug: 'luna-ep-001',
    fps: FPS,
    scenes: durations.map((durationMs, index) => ({
      spec: scene(
        `cena-0${index + 1}`,
        index + 1,
        `Luna observa o jardim pela janela e percebe que cada folha mudou de cor depois da chuva da manhã.`,
      ),
      spoken: spoken(durationMs),
      image: ASSET,
      clip: ASSET,
    })),
  });
}

describe('timeline a partir da fala medida', () => {
  it('a duração das cenas vem das falas medidas, quantizada em quadros inteiros', () => {
    const timeline = timelineOf([3714, 2880, 4501]);

    // 3714 ms = 111,42 quadros → a fronteira acumulada arredonda para 111 quadros (3700 ms).
    expect(timeline.scenes[0]?.startFrame).toBe(0);
    expect(timeline.scenes[0]?.endFrame).toBe(Math.round(3714 / (1000 / FPS)));
    expect(timeline.totalFrames).toBe(Math.round((3714 + 2880 + 4501) / (1000 / FPS)));
    expect(timeline.totalMs).toBe(Math.round(timeline.totalFrames * (1000 / FPS)));
    // Cada cena tem duração inteira em quadros e as fronteiras encostam uma na outra.
    for (const cena of timeline.scenes) {
      expect(Number.isInteger(cena.durationFrames)).toBe(true);
      expect(cena.durationMs).toBe(Math.round(cena.durationFrames * (1000 / FPS)));
    }
    expect(timeline.scenes[1]?.startFrame).toBe(timeline.scenes[0]?.endFrame);
  });

  it('o desvio fala↔legenda fica dentro de 200 ms mesmo com 17 cenas de duração quebrada', () => {
    const durations = Array.from({ length: 17 }, (_, index) => 1234 + index * 37);
    const timeline = timelineOf(durations);

    expect(timeline.maxDriftMs).toBeLessThanOrEqual(200);

    // Mede de novo, a partir do texto do `.srt`, contra a soma bruta das falas: é o que o humano veria.
    let bruto = 0;
    srtBlocks(timeline).forEach((block, position) => {
      expect(Math.abs(block.startMs - bruto)).toBeLessThanOrEqual(200);
      bruto += durations[position] ?? 0;
    });
    expect(Math.abs(timeline.totalMs - bruto)).toBeLessThanOrEqual(200);
  });

  it('quantizar o acumulado (e não cada duração) mantém o erro constante em vez de somar', () => {
    const durations = Array.from({ length: 40 }, () => 1013);
    const plan = planFrames(durations, FPS);

    // Sem a correção, 40 cenas × até 33 ms dariam mais de 1 s de atraso no fim.
    expect(plan.maxDriftMs).toBeLessThanOrEqual(1000 / FPS / 2 + 1);
  });

  it('recusa cena sem duração medida (não inventa tempo)', () => {
    expect(() => timelineOf([3000, 0])).toThrowError(/não tem duração medida/);
    expect(() => timelineOf([3000, Number.NaN])).toThrowError(/não tem duração medida/);
  });

  it('recusa timeline sem cena', () => {
    expect(() => timelineOf([])).toThrowError(/sem cenas/);
  });
});

describe('legenda (.srt) da mesma timeline', () => {
  it('nenhum bloco começa depois do fim do vídeo nem termina além dele', () => {
    const timeline = timelineOf([3714, 2880, 4501]);
    const srt = renderSrt(timeline);

    // Lê o arquivo gerado, não a estrutura em memória: é o texto que vai para o player.
    const blocos = [...srt.matchAll(/(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/g)].map(
      (match) => ({
        startMs:
          Number(match[1]) * 3_600_000 + Number(match[2]) * 60_000 + Number(match[3]) * 1000 + Number(match[4]),
        endMs:
          Number(match[5]) * 3_600_000 + Number(match[6]) * 60_000 + Number(match[7]) * 1000 + Number(match[8]),
      }),
    );

    expect(blocos).toHaveLength(3);
    for (const bloco of blocos) {
      expect(bloco.startMs).toBeLessThan(timeline.totalMs);
      expect(bloco.endMs).toBeLessThanOrEqual(timeline.totalMs);
      expect(bloco.endMs).toBeGreaterThan(bloco.startMs);
    }
    expect(blocos.at(-1)?.endMs).toBe(timeline.totalMs);
    expect(() => assertSrtWithinVideo(srtBlocks(timeline), timeline.totalMs)).not.toThrow();
  });

  it('o texto da legenda não pode conter "-->" nem quebra de linha crua', () => {
    const timeline = buildTimeline({
      channelId: 'luna',
      episodeId: 'luna-ep-001',
      slug: 'luna-ep-001',
      fps: FPS,
      scenes: [
        {
          spec: scene('cena-01', 1, 'Luna viu a seta --> e o sinal --> no jardim com uma frase bem longa mesmo'),
          spoken: spoken(3000),
          image: ASSET,
          clip: ASSET,
        },
      ],
    });

    const srt = renderSrt(timeline);
    const linhas = srt.split('\n').filter((linha) => linha.includes('-->'));

    expect(linhas).toHaveLength(1); // só a linha de tempo
    expect(sanitizeCaptionText('a --> b')).toBe('a → b');
    expect(srt).not.toContain('-->\n--');
  });

  it('formata o tempo no padrão SubRip (vírgula, não ponto)', () => {
    expect(srtTimestamp(0)).toBe('00:00:00,000');
    expect(srtTimestamp(3_714)).toBe('00:00:03,714');
    expect(srtTimestamp(3_661_001)).toBe('01:01:01,001');
  });

  it('a legenda quebra linha em vez de virar uma faixa ilegível', () => {
    const timeline = timelineOf([9000]);
    const bloco = srtBlocks(timeline)[0];

    expect(bloco?.text.split('\n').length).toBeGreaterThan(1);
    for (const linha of bloco?.text.split('\n') ?? []) {
      expect(linha.length).toBeLessThanOrEqual(42);
    }
  });
});
