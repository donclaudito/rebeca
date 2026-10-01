/**
 * Nome determinístico por hash — a base da idempotência.
 *
 * O que estes testes protegem: **mesma entrada ⇒ mesmo nome**. Se isso quebrar, o pipeline passa a pagar
 * duas vezes pelo mesmo ativo (não reconhece o que já gerou) e o nome do arquivo deixa de dizer o que o
 * arquivo é. Nenhum teste aqui toca rede, disco de mídia ou ffmpeg.
 */

import { describe, expect, it } from 'vitest';
import { assetFingerprint, assetHash, canonicalJson } from '../../../server/media/hash.js';
import { assetPath } from '../../../server/media/paths.js';

const BASE = {
  stage: 'imagem',
  promptVersion: 'criar-cena@v1',
  providerId: 'simulado-imagem',
  model: 'ffmpeg-lavfi-drawtext-1',
  input: { sceneId: 'cena-01', prompt: 'jardim claro' },
  params: { width: 1920, height: 1080, seed: 101 },
};

describe('hash de entrada de ativo', () => {
  it('devolve 8 hexadecimais e é estável para a mesma entrada', () => {
    const first = assetHash(BASE);
    const second = assetHash({ ...BASE, input: { sceneId: 'cena-01', prompt: 'jardim claro' } });

    expect(first).toMatch(/^[0-9a-f]{8}$/);
    expect(second).toBe(first);
  });

  it('separa as entradas por versão de prompt, provedor, modelo, entrada e parâmetros', () => {
    const hashes = [
      assetHash(BASE),
      assetHash({ ...BASE, promptVersion: 'criar-cena@v2' }),
      assetHash({ ...BASE, providerId: 'minimax-h3' }),
      assetHash({ ...BASE, model: 'ffmpeg-lavfi-drawtext-2' }),
      assetHash({ ...BASE, input: { sceneId: 'cena-01', prompt: 'jardim escuro' } }),
      assetHash({ ...BASE, params: { width: 1080, height: 1920, seed: 101 } }),
    ];

    // Seis entradas diferentes: nenhuma pode colidir. Colisão aqui é reuso do ativo errado.
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('ignora a ordem das chaves (o mesmo pedido escrito em outra ordem é o mesmo pedido)', () => {
    const reordered = assetHash({
      ...BASE,
      input: { prompt: 'jardim claro', sceneId: 'cena-01' },
      params: { seed: 101, height: 1080, width: 1920 },
    });

    expect(reordered).toBe(assetHash(BASE));
    expect(canonicalJson({ a: 1, b: { d: 2, c: 3 } })).toBe(canonicalJson({ b: { c: 3, d: 2 }, a: 1 }));
  });

  it('a ordem de uma lista importa (cena 1→2 não é cena 2→1)', () => {
    const forward = assetHash({ ...BASE, input: { scenes: ['cena-01', 'cena-02'] } });
    const backward = assetHash({ ...BASE, input: { scenes: ['cena-02', 'cena-01'] } });

    expect(forward).not.toBe(backward);
  });

  it('o hash curto é o começo do fingerprint completo (o manifesto guarda os dois)', () => {
    const fingerprint = assetFingerprint(BASE);

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(assetHash(BASE)).toBe(fingerprint.slice(0, 8));
  });
});

describe('nome do arquivo determinístico', () => {
  const pathFor = (hash8: string) =>
    assetPath({
      scopeChannelId: 'luna',
      channelId: 'luna',
      episodeId: 'luna-ep-001',
      stage: 'imagem',
      slug: 'cena-01',
      hash8,
      ext: 'png',
    });

  it('mesma entrada ⇒ mesmo caminho; entrada diferente ⇒ caminho diferente', () => {
    const hash = assetHash(BASE);
    expect(pathFor(hash)).toBe(pathFor(hash));
    expect(pathFor(hash)).not.toBe(pathFor(assetHash({ ...BASE, promptVersion: 'criar-cena@v9' })));
  });

  it('o caminho segue o formato da skill: <canal>/<episodio>/<etapa>/<slug>-<hash8>.<ext>', () => {
    const path = pathFor('deadbeef');

    expect(path.replaceAll('\\', '/')).toMatch(
      /\/assets\/luna\/luna-ep-001\/imagem\/cena-01-deadbeef\.png$/,
    );
  });
});
