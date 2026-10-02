/**
 * Teste de tela da "Mídia gerada".
 *
 * Existe por causa de um relato concreto do dono do produto: **"ele gerou mas não apareceu"**. O pipeline
 * da Fase 0 escreveu 13 arquivos reais no disco e a interface continuou dizendo "nenhum vídeo foi gerado
 * ainda", porque nada no app lia o manifesto. Sem teste de render não havia como distinguir as causas
 * possíveis: (a) a tela não monta, (b) a lista chega vazia sem explicação, (c) a leitura falha e a tela
 * mostra uma frase genérica, ou (d) a tela mostra os ativos mas **esquece de dizer que são simulados**.
 *
 * A (d) é a mais perigosa das quatro: não é um erro visível, é uma tela que afirma mais do que existe —
 * exatamente o defeito que a tela de Revisão já teve, quando listava "narração e montagem prontas" com
 * checkmark verde sobre arquivos que não existiam. Por isso ela é asserção explícita aqui.
 *
 * A rede é substituída: nenhum teste toca o disco do projeto.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MidiaPage } from '../MidiaPage';
import type { MediaAssetView, MediaEpisodeView, MediaLibraryView } from '@/media/view';

/* --- respostas do servidor, com a forma real --------------------------------- */

function asset(overrides: Partial<MediaAssetView> = {}): MediaAssetView {
  return {
    stage: 'animacao',
    key: 'cena-01',
    version: 1,
    kind: 'video',
    pathFromAssets: 'luna/luna-ep-001/animacao/cena-01-b0a60c3f.mp4',
    hash: 'b0a60c3f',
    durationMs: 10_267,
    bytes: 1_220_964,
    providerId: 'simulado-animacao',
    model: 'ffmpeg-zoompan-1',
    promptVersion: 'criar-cena@v1',
    costUsd: 0,
    simulated: true,
    reference: 'sintetica',
    approved: false,
    recordedAt: '2026-10-01T09:13:03.532Z',
    existsOnDisk: true,
    ...overrides,
  };
}

function episodeView(overrides: Partial<MediaEpisodeView> = {}): MediaEpisodeView {
  const assets = overrides.assets ?? [asset()];
  return {
    channelId: 'luna',
    episodeId: 'luna-ep-001',
    slug: 'luna-ep-001',
    updatedAt: '2026-10-01T09:14:51.761Z',
    assetCount: assets.length,
    missingCount: assets.filter((item) => !item.existsOnDisk).length,
    totalBytes: assets.reduce((total, item) => total + item.bytes, 0),
    totalDurationMs: assets.reduce((total, item) => total + item.durationMs, 0),
    totalCostUsd: assets.reduce((total, item) => total + item.costUsd, 0),
    simulatedCount: assets.filter((item) => item.simulated).length,
    renderVersion: null,
    characterSheet: 'ausente',
    limits: {
      tetoPorMinutoUsd: 12,
      limiteMensalUsd: 60,
      aprovadoPor: 'humano:dono-do-produto',
      aprovadoEm: '2026-10-01',
      loudnessAlvo: {
        integratedLufs: -14,
        truePeakDb: -1.5,
        lra: 11,
        verificado: false,
        nota: 'NÃO VERIFICADO',
      },
    },
    referenciaVisual: {
      characterSheet: 'ausente',
      tipo: 'sintetica',
      nota: 'Character Sheet da Luna NÃO existe no repositório.',
    },
    assets,
    ...overrides,
  };
}

const LIBRARY_COM_EPISODIO: MediaLibraryView = {
  channelId: 'luna',
  available: true,
  reason: null,
  episodes: [episodeView()],
};

/** Responde por rota, com a mesma forma que `server/media/http.ts` devolve. */
function stubMedia(input: { library: unknown; episode?: unknown; libraryStatus?: number }) {
  const fetchMock = vi.fn(async (url: string) => {
    const target = String(url);
    if (target.includes('/episodes')) {
      return new Response(JSON.stringify(input.library), {
        status: input.libraryStatus ?? 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(JSON.stringify(input.episode ?? episodeView()), {
      status: input.episode === undefined && input.libraryStatus === 404 ? 404 : 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderMidia() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/c/luna/midia']}>
        <Routes>
          <Route path="/c/:channelId/midia" element={<MidiaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tela "Mídia gerada"', () => {
  it('mostra os ativos que o pipeline gerou — o defeito "gerou e não apareceu"', async () => {
    stubMedia({ library: LIBRARY_COM_EPISODIO });
    renderMidia();

    expect(await screen.findByText('cena-01')).toBeInTheDocument();
    expect(screen.getByText(/simulado\/animacao|simulado-animacao/)).toBeInTheDocument();
    // O caminho relativo aparece: é como o humano acha o arquivo no disco.
    expect(screen.getByText(/luna\/luna-ep-001\/animacao\/cena-01-b0a60c3f\.mp4/)).toBeInTheDocument();
  });

  /**
   * A asserção que mais importa: a tela tem de dizer que isto **não é arte publicável**. Sem ela, a tela
   * apresenta a Fase 0 como se já houvesse material do canal pronto para revisão.
   */
  it('avisa que ativo de provedor simulado é prova de máquina, não arte publicável', async () => {
    stubMedia({ library: LIBRARY_COM_EPISODIO });
    renderMidia();

    expect(await screen.findByText(/prova de máquina, não arte publicável/i)).toBeInTheDocument();
    expect(screen.getByText(/1 de 1 ativos vieram de provedor simulado/i)).toBeInTheDocument();
    // Sem Character Sheet, não há como afirmar consistência de personagem (invariante nº 3).
    expect(screen.getByText(/referência visual é/i)).toBeInTheDocument();
  });

  it('marca o ativo quando o manifesto aponta para arquivo que não está mais no disco', async () => {
    const ausente = asset({ existsOnDisk: false, bytes: 0 });
    stubMedia({
      library: LIBRARY_COM_EPISODIO,
      episode: episodeView({ assets: [ausente] }),
    });
    renderMidia();

    expect(await screen.findByText('arquivo ausente')).toBeInTheDocument();
    expect(screen.getByText(/1 ativo\(s\) do manifesto não estão mais no disco/i)).toBeInTheDocument();
  });

  it('explica por que não há mídia — e não mostra lista vazia sem motivo', async () => {
    stubMedia({
      library: {
        channelId: 'luna',
        available: false,
        reason: 'Este ambiente não tem mídia gerada para este canal. O pipeline grava em .rebeca/assets/, e essa pasta está no .gitignore.',
        episodes: [],
      } satisfies MediaLibraryView,
    });
    renderMidia();

    expect(await screen.findByText(/Nenhuma mídia gerada neste ambiente/i)).toBeInTheDocument();
    expect(screen.getByText(/está no \.gitignore/i)).toBeInTheDocument();
    // A saída também está na tela: vazio com o que fazer não é beco sem saída.
    expect(screen.getByText(/render-episodio\.mjs/i)).toBeInTheDocument();
  });

  it('mostra a mensagem do servidor quando a leitura falha, em vez de uma frase genérica', async () => {
    stubMedia({
      library: { code: 'leitura-de-midia', message: 'A leitura de mídia falhou no servidor de desenvolvimento.' },
      libraryStatus: 500,
    });
    renderMidia();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/A leitura de mídia falhou no servidor de desenvolvimento\./)).toBeInTheDocument();
  });

  it('não pede episódio nenhum quando o canal não tem mídia', async () => {
    const fetchMock = stubMedia({
      library: { channelId: 'luna', available: false, reason: 'sem mídia', episodes: [] } satisfies MediaLibraryView,
    });
    renderMidia();

    await screen.findByText(/Nenhuma mídia gerada neste ambiente/i);
    // Nenhuma chamada a `/episode`: pedir "o episódio de ninguém" seria uma chamada sem canal de verdade.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/episode?'))).toBe(false);
  });
});
