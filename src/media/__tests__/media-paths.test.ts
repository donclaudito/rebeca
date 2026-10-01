/**
 * Isolamento entre canais — invariante nº 2 do projeto, verificado onde ele pode falhar.
 *
 * Convenção de pastas não é defesa: quem monta caminho com `join()` pode montar o caminho do outro canal.
 * Estes testes provam que o módulo de caminhos **recusa** em vez de confiar — no canal dono, no caminho
 * resolvido e no próprio segmento (`..`, barra, dois-pontos de unidade do Windows).
 */

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assetsRelativePath,
  assetsRoot,
  assertSafeSegment,
  assertWithinChannel,
  ChannelScopeError,
  channelAssetsDir,
  episodeDir,
  assetPath,
  renderPath,
  workPath,
} from '../../../server/media/paths.js';

const LUNA = { scopeChannelId: 'luna', channelId: 'luna', episodeId: 'luna-ep-001' };

describe('escrita escopada por canal', () => {
  it('recusa ativo de outro canal: o pipeline roda em "luna" e o ativo é de "arquivo"', () => {
    expect(() =>
      assetPath({
        scopeChannelId: 'luna',
        channelId: 'arquivo',
        episodeId: 'arq-ep-001',
        stage: 'imagem',
        slug: 'cena-01',
        hash8: 'deadbeef',
        ext: 'png',
      }),
    ).toThrowError(ChannelScopeError);

    try {
      episodeDir('luna', 'arquivo', 'arq-ep-001');
      throw new Error('deveria ter recusado');
    } catch (error) {
      expect(error).toBeInstanceOf(ChannelScopeError);
      expect((error as ChannelScopeError).code).toBe('canal-fora-de-escopo');
    }
  });

  it('recusa caminho já resolvido que caia na pasta de outro canal', () => {
    const outroCanal = join(assetsRoot(), 'arquivo', 'arq-ep-001', 'imagem', 'cena-01-deadbeef.png');

    expect(() => assertWithinChannel('luna', outroCanal)).toThrowError(/fora da pasta do canal/);
    expect(() => assertWithinChannel('luna', join(assetsRoot(), '..', 'custos.csv'))).toThrowError(ChannelScopeError);
  });

  it('aceita o caminho do próprio canal e devolve o caminho resolvido', () => {
    const dentro = join(channelAssetsDir('luna'), 'luna-ep-001', 'imagem', 'cena-01-deadbeef.png');

    expect(assertWithinChannel('luna', dentro)).toBe(dentro);
  });

  it('recusa segmento com travessia, separador ou dois-pontos', () => {
    for (const ruim of ['..', 'a/b', 'a\\b', 'C:', 'Luna', 'cena 01', '']) {
      expect(() => assertSafeSegment(ruim, 'canal')).toThrowError(ChannelScopeError);
    }
    expect(assertSafeSegment('luna-ep-001', 'episódio')).toBe('luna-ep-001');
  });

  it('monta o caminho dentro da pasta do canal, com etapa e versão no lugar', () => {
    const imagem = assetPath({ ...LUNA, stage: 'imagem', slug: 'cena-01', hash8: 'a1b2c3d4', ext: 'png' });
    const clip = assetPath({ ...LUNA, stage: 'animacao', slug: 'cena-01', hash8: 'a1b2c3d4', ext: 'mp4' });
    const render = renderPath('luna', 'luna', 'luna-ep-001', 2, 'luna-ep-001-16x9-v2.mp4');
    const montagem = workPath('luna', 'luna', 'luna-ep-001', 'clipes.txt');

    expect(imagem.replaceAll('\\', '/')).toContain('/luna/luna-ep-001/imagem/cena-01-a1b2c3d4.png');
    expect(clip.replaceAll('\\', '/')).toContain('/luna/luna-ep-001/animacao/cena-01-a1b2c3d4.mp4');
    expect(render.replaceAll('\\', '/')).toContain('/luna/luna-ep-001/render/v2/luna-ep-001-16x9-v2.mp4');
    expect(montagem.replaceAll('\\', '/')).toContain('/luna/luna-ep-001/_montagem/clipes.txt');
  });

  it('recusa versão de render inválida (nada de v0 nem v-1)', () => {
    expect(() => renderPath('luna', 'luna', 'luna-ep-001', 0, 'x-16x9-v0.mp4')).toThrowError(ChannelScopeError);
    expect(() => renderPath('luna', 'luna', 'luna-ep-001', -1, 'x-16x9-v-1.mp4')).toThrowError(ChannelScopeError);
  });

  it('recusa caminho relativo fora da raiz de ativos (é o que entra no hash)', () => {
    expect(() => assetsRelativePath(join(assetsRoot(), '..', 'custos.csv'))).toThrowError(ChannelScopeError);
    expect(assetsRelativePath(join(channelAssetsDir('luna'), 'ep', 'voz', 'x.wav'))).toBe('luna/ep/voz/x.wav');
  });
});
