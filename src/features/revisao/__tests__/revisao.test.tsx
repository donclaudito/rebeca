/**
 * Teste do fluxo crítico: revisar → escolher thumbnail → aprovar.
 *
 * Tenta refutar três coisas que doem no produto:
 * 1. aprovar sem escolher thumbnail (a IA não escolhe pelo humano);
 * 2. aprovar duas vezes (dupla submissão = publicação duplicada);
 * 3. rejeitar sem dizer o motivo (sem motivo não há aprendizado).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { getFunctionSchema, validateSchema } from '@/ai/schemas';
import { api, resetStore } from '@/data/client';
import { contents } from '@/data/mock/db';

/**
 * O cartão "O que existe neste conteúdo" passou a **consultar** o estado da mídia gerada em vez de
 * afirmar strings fixas. Sem resposta determinística, o teste mediria falha de rede em vez do cartão —
 * e o cartão tem três estados que precisam ser provados separadamente: **não existe**, **existe** e
 * **não sei**. O padrão aqui é o estado real da biblioteca de exemplo: nenhum conteúdo tem episódio.
 */
const SEM_MIDIA = { channelId: 'luna', available: false, reason: 'sem mídia neste ambiente', episodes: [] };

function stubMedia(payload: unknown, status = 200) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Um episódio gerado, com a forma que `server/media/library.ts` devolve. */
function episodioGerado(overrides: Record<string, unknown> = {}) {
  return {
    episodeId: 'luna-ep-001',
    slug: 'luna-ep-001',
    updatedAt: '2026-10-01T09:14:51.761Z',
    assetCount: 13,
    missingCount: 0,
    totalBytes: 15_254_021,
    totalDurationMs: 162_201,
    totalCostUsd: 0,
    simulatedCount: 13,
    renderVersion: 1,
    characterSheet: 'ausente',
    ...overrides,
  };
}

function renderReview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/c/luna/revisao/luna-borboletas']}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('tela de revisão', () => {
  beforeEach(() => {
    resetStore();
    stubMedia(SEM_MIDIA);
  });

  afterEach(() => {
    /*
     * O elo conteúdo → episódio é declarado por um teste **no dado de exemplo**, nunca no produto:
     * a biblioteca de exemplo não tem nenhum conteúdo com episódio ligado, e isso é a verdade. Apagar
     * aqui impede que o elo de um teste vaze para o próximo e faça o cartão parecer ligado sem ser.
     */
    for (const item of contents) delete item.episodeId;
    resetStore();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('não deixa aprovar sem thumbnail escolhida, e nenhuma opção vem pré-marcada', async () => {
    renderReview();

    const aprovar = await screen.findByRole('button', { name: /Aprovar e agendar/i });
    expect(aprovar).toBeDisabled();

    const grupo = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });

    // A sugestão da IA aparece rotulada como sugestão dentro do grupo de opções...
    expect(within(grupo).getAllByText(/sugestão da IA/i).length).toBeGreaterThan(0);
    // ...mas nenhuma opção vem marcada como escolha do humano.
    expect(within(grupo).queryByText(/Escolhida por você/i)).not.toBeInTheDocument();

    for (const radio of within(grupo).getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('aprova uma única vez mesmo com dois cliques seguidos', async () => {
    const user = userEvent.setup();
    const approveSpy = vi.spyOn(api, 'approve');

    renderReview();

    const grupo = await screen.findByRole('radiogroup', { name: /Opções de thumbnail/i });
    await user.click(within(grupo).getAllByRole('radio')[0] as HTMLElement);

    const aprovar = await screen.findByRole('button', { name: /Aprovar e agendar/i });
    await waitFor(() => expect(aprovar).toBeEnabled());

    await user.click(aprovar);
    await user.click(aprovar);

    await waitFor(() => expect(approveSpy).toHaveBeenCalledTimes(1));
  });

  it('rejeitar exige motivo, e o motivo vira o registro de aprendizado', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(await screen.findByRole('button', { name: /Substituir conteúdo/i }));

    const confirmar = screen.getByRole('button', { name: /Confirmar substituição/i });
    expect(confirmar).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Por que este conteúdo não serve\?/i),
      'O ritmo está lento demais para 3 a 5 anos.',
    );

    await waitFor(() => expect(confirmar).toBeEnabled());

    const rejectSpy = vi.spyOn(api, 'reject');
    await user.click(confirmar);

    await waitFor(() => expect(rejectSpy).toHaveBeenCalledTimes(1));

    // A gravação é assíncrona: espera o motivo chegar no registro do conteúdo.
    await waitFor(async () => {
      const atualizado = await api.getContent('luna', 'luna-borboletas');
      expect(atualizado.rejectedReason).toBe('O ritmo está lento demais para 3 a 5 anos.');
      expect(atualizado.status).toBe('gerando');
    });
  });

  it('a camada de dados recusa aprovar sem thumbnail mesmo que a tela falhe', async () => {
    await expect(api.approve('arquivo', 'arq-ceu-laranja', null)).rejects.toThrow(
      'Escolha uma thumbnail antes de aprovar.',
    );
  });

  it('a tela diz o que EXISTE, e não afirma mídia que nunca foi gerada', async () => {
    /*
     * Relato do dono do produto ao ler o subtítulo da tela ("Assista, escolha a thumbnail…"): "não
     * parece que funciona". Ele estava certo: o cartão "O que a IA fez aqui" listava, com checkmarks
     * verdes, "Roteiro, cenas, narração e montagem prontos" e "opções de thumbnail geradas" — e não
     * existe um único arquivo de vídeo no repositório, nem narração, nem arte de thumbnail (o quadro é
     * um `ArtSlot`). A tela afirmava trabalho que nunca aconteceu.
     *
     * Este teste fixa a honestidade: nada de "prontos" para o que não foi gerado, o estado pendente
     * escrito com todas as letras, e as três decisões preservadas — consertar a verdade não pode
     * remover o fluxo.
     */
    renderReview();

    expect(await screen.findByText('O que existe neste conteúdo')).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum vídeo, narração ou montagem deste conteúdo foi gerado ainda/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/a arte ainda não existe/i)).toBeInTheDocument();
    // As afirmações falsas não podem voltar.
    expect(screen.queryByText(/narração e montagem prontos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/opções de thumbnail geradas/i)).not.toBeInTheDocument();
    // As três decisões continuam existindo.
    expect(screen.getByRole('button', { name: /Aprovar e agendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gerar nova versão/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Substituir conteúdo/i })).toBeInTheDocument();
  });

  /*
   * O relato que gerou estes três testes: *"ele gerou mas não apareceu… não completou a sequência"*.
   *
   * O cartão afirmava "nenhum vídeo gerado" com 13 ativos no disco, porque as linhas eram strings fixas
   * escritas quando a afirmação ainda era verdadeira. Um cartão de estado que não consulta estado é
   * legenda — e legenda envelhece mentindo. Os três testes abaixo fixam os três estados possíveis.
   */

  it('não nega a mídia que existe: nomeia o episódio do canal e diz que ele NÃO está ligado ao conteúdo', async () => {
    /*
     * O caso de hoje, e o que o dono do produto viu: o canal TEM mídia gerada (`luna-ep-001`, 13 ativos)
     * e nenhum conteúdo da biblioteca tem episódio ligado — porque o episódio da Fase 0 é sintético e o
     * próprio spec o descreve como "não é conteúdo do canal". O cartão tem de dizer as duas coisas:
     * que a mídia do canal existe, e que ela **não** é deste conteúdo. Dizer só a primeira seria se
     * apropriar do episódio de ninguém; dizer só a segunda seria negar o trabalho que existe.
     */
    stubMedia({ channelId: 'luna', available: true, reason: null, episodes: [episodioGerado()] });
    renderReview();

    expect(await screen.findByText(/Nenhum vídeo, narração ou montagem deste conteúdo/i)).toBeInTheDocument();
    expect(screen.getByText(/O pipeline já gerou 13 ativos neste canal \(luna-ep-001\)/i)).toBeInTheDocument();
    expect(screen.getByText(/não está ligado a este conteúdo/i)).toBeInTheDocument();
    // E o caminho para ver a mídia de verdade, que antes não existia em lugar nenhum.
    expect(screen.getAllByRole('link', { name: /ver mídia/i }).length).toBeGreaterThan(0);
  });

  it('mostra os números reais quando o conteúdo TEM episódio ligado', async () => {
    // O elo é declarado **no dado de exemplo do teste**, não no produto: a biblioteca de exemplo não
    // tem nenhum conteúdo com episódio, e inventar um no produto seria afirmar linhagem que ninguém
    // declarou. Aqui ele existe só para provar que o cartão acende quando o vínculo existir.
    const alvo = contents.find((item) => item.id === 'luna-borboletas');
    expect(alvo).toBeDefined();
    alvo!.episodeId = 'luna-ep-001';
    resetStore();
    stubMedia({ channelId: 'luna', available: true, reason: null, episodes: [episodioGerado()] });

    renderReview();

    expect(
      await screen.findByText(/Mídia gerada: 13 ativos, 13 de provedor simulado · render v1/i),
    ).toBeInTheDocument();
    // O ramo "ligado" substitui o aviso de ausência — não convive com ele.
    expect(
      screen.queryByText(/Nenhum vídeo, narração ou montagem deste conteúdo foi gerado ainda/i),
    ).not.toBeInTheDocument();
  });

  it('quando a leitura da mídia falha, diz que NÃO SABE — nunca que não existe', async () => {
    /*
     * A regressão mais fácil de reintroduzir: se a leitura falhar e o cartão cair no texto de ausência,
     * ele volta a afirmar "nenhum vídeo gerado" sem saber. Este teste é a rede.
     */
    stubMedia({ code: 'leitura-de-midia', message: 'Falha ao ler a mídia gerada.' }, 500);
    renderReview();

    expect(await screen.findByText(/Não foi possível ler a mídia gerada deste canal agora/i)).toBeInTheDocument();
    expect(screen.getByText(/esta linha não afirma que não há vídeo/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Nenhum vídeo, narração ou montagem deste conteúdo foi gerado ainda/i),
    ).not.toBeInTheDocument();
  });

  it('diz quando o episódio declarado não tem manifesto neste ambiente', async () => {
    const alvo = contents.find((item) => item.id === 'luna-borboletas');
    expect(alvo).toBeDefined();
    alvo!.episodeId = 'luna-ep-777';
    resetStore();
    // O canal tem mídia, mas não esse episódio.
    stubMedia({ channelId: 'luna', available: true, reason: null, episodes: [episodioGerado()] });

    renderReview();

    expect(
      await screen.findByText(/aponta para o episódio luna-ep-777, mas não há manifesto dele neste ambiente/i),
    ).toBeInTheDocument();
  });

  it('o espaço do player diz o que FALTA — derivado do estado, não string fixa', async () => {
    renderReview();

    /*
     * A frase era `note="nenhum vídeo foi gerado ainda"` — string fixa, verdadeira no dia em que foi
     * escrita. O dono do produto olhou para ela e disse *"esta função não funciona"*: além de não haver
     * botão nenhum ali, a frase não dizia **o que** faltava.
     *
     * Agora ela é derivada. `luna-borboletas` não tem roteiro nem storyboard gerados, então a tela nomeia
     * as duas peças ausentes **e** a terceira, que nenhum dado de exemplo resolve: o provedor de vídeo
     * real. Se alguém voltar a escrever a frase à mão, este teste fica vermelho.
     */
    expect(
      await screen.findByText(
        /nenhum vídeo foi gerado — falta o roteiro; as cenas do storyboard; um provedor de vídeo real/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/planejados/i)).toBeInTheDocument();
    // O rótulo antigo prometia um player que não existe.
    expect(screen.queryByText(/^Player ·/)).not.toBeInTheDocument();
  });

  it('dá para PEDIR opções de thumbnail à IA e aplicar as propostas', async () => {
    /*
     * Lacuna apontada pelo dono do produto: "não dá opção de gerar". A função `criar-thumbnail`
     * estava registrada no contrato desde a camada de LLM e **nenhuma tela a chamava** — a etapa
     * "Escolha a thumbnail" só mostrava o que já existisse, sem forma de pedir novas.
     *
     * Aqui o fluxo inteiro roda: pedir → a IA propõe conceitos → o humano aplica → as opções passam a
     * existir para escolha. O que a IA devolve é **conceito** (rótulo + o que a arte deve mostrar),
     * não imagem: gerar arte é do pipeline de mídia, e o teste não pode fingir que ela existe.
     */
    const propostas = {
      opcoes: [
        {
          id: 'p1',
          label: 'Close na Luna',
          alt: 'Primeiro plano da Luna com o arco-íris ao fundo',
          conceito: 'Rosto grande, expressão de espanto, fundo desfocado.',
          textoNaArte: 'SETE CORES',
          promptImagem: 'flat 2D children illustration, menina olhando o arco-íris',
          sugestao: true,
        },
        {
          id: 'p2',
          label: 'Arco-íris no céu',
          alt: 'Arco-íris completo sobre o jardim visto de longe',
          conceito: 'Plano aberto do jardim inteiro com o arco-íris.',
          textoNaArte: '',
          promptImagem: 'flat 2D children illustration, jardim com arco-íris',
          sugestao: false,
        },
        {
          id: 'p3',
          label: 'Luna apontando',
          alt: 'Luna apontando para uma das cores do arco-íris',
          conceito: 'Ação de apontar, dedo na cor.',
          textoNaArte: 'QUAL É A SUA?',
          promptImagem: 'flat 2D children illustration, menina apontando para o céu',
          sugestao: false,
        },
      ],
    };

    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            functionId: 'criar-thumbnail',
            channelId: 'luna',
            promptId: 'criar-thumbnail',
            promptVersion: 1,
            tier: 'criativo',
            provider: 'openai',
            model: 'gpt-6-luna',
            simulated: false,
            data: propostas,
            usage: { tokensIn: 200, tokensOut: 300 },
            costUsd: 0.0002,
            costSource: 'real',
            costRecorded: 'csv',
            latencyMs: 800,
            createdAt: '2026-10-01T12:00:00.000Z',
            attempts: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderReview();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: /Gerar opções de thumbnail com a IA/i }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    /*
     * Procura a chamada **da IA**, não "a primeira". Antes esta linha lia `calls[0]` e passava porque o
     * único `fetch` da tela era o da IA; depois que o cartão passou a ler a mídia do canal, a primeira
     * chamada virou um GET sem corpo. O teste estava medindo a ordem das consultas, não o que ele diz
     * medir.
     */
    const chamadaDaIA = fetchMock.mock.calls.find(([, init]) =>
      String(init?.body ?? '').includes('criar-thumbnail'),
    );
    expect(chamadaDaIA, 'a tela não pediu criar-thumbnail à IA').toBeDefined();

    // Nada é aplicado sem o clique humano (invariante nº 1). O `AiAction` **mostra** a proposta —
    // isso é dele e tem teste próprio —, mas as opções da tela continuam as antigas até o clique.
    const grupoAntes = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });
    expect(within(grupoAntes).queryByText('Close na Luna')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Usar estas opções/i }));

    // Espera a regravação CHEGAR À TELA: as 4 opções do dado de exemplo dão lugar às 3 propostas.
    // (Sem este `waitFor`, a asserção casaria com a prévia da resposta da IA, que é outra coisa.)
    await waitFor(() => {
      const grupoAtual = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });
      expect(within(grupoAtual).getAllByRole('radio')).toHaveLength(3);
    });

    const grupo = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });
    // O rótulo aparece duas vezes dentro do cartão (no quadro reservado e embaixo dele) — por isso
    // `getAllByText`, e não `getByText`.
    expect(within(grupo).getAllByText('Close na Luna').length).toBeGreaterThan(0);
    // Nenhuma vem marcada: a sugestão da IA é informativa, escolher é do humano.
    for (const opcao of within(grupo).getAllByRole('radio')) {
      expect(opcao).toHaveAttribute('aria-checked', 'false');
    }
  });

  /* ==========================================================================
     Custo real e a etapa Criar

     Dois defeitos relatados pelo dono na mesma tela, na mesma sessão:

     1. **"Custo real US$ 42,80"** era o `costUsd` do arquivo de **exemplo** (`src/data/mock/db.ts`).
        O livro de custos somava **US$ 0,3956** para o mesmo conteúdo — 108× de diferença, com rótulo de
        verdade, na tela em que a decisão é humana.
     2. **"esta função não funciona, usa ai para gerar video"**: o espaço do vídeo não tinha botão, e o
        insumo de qualquer gerador de vídeo — roteiro e cenas — não existia em lugar nenhum.
     ========================================================================== */

  /**
   * Stub que responde **por rota**.
   *
   * A tela passou a consultar `/api/media/custos` além da mídia. Um mock que devolve a mesma coisa para
   * toda URL faria o custo cair no ramo "não foi possível ler" — e o teste mediria o mock, não a tela.
   */
  function stubPorRota(rotas: Record<string, unknown>) {
    const fetchMock = vi.fn(async (url: string) => {
      const alvo = Object.keys(rotas).find((chave) => String(url).includes(chave));
      if (alvo === undefined) {
        return new Response(JSON.stringify({ code: 'sem-stub', message: 'rota sem stub neste teste' }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify(rotas[alvo]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('o "Custo real" vem do LIVRO, não do dado de exemplo', async () => {
    stubPorRota({
      '/api/media/custos': {
        contentId: 'luna-borboletas',
        channelName: 'Luna e o Jardim das Cores',
        ledgerAvailable: true,
        totalUsd: 0.395613,
        rows: 67,
        byStage: [
          { etapa: 'thumbnail', usd: 0.394, linhas: 4 },
          { etapa: 'criar', usd: 0.001613, linhas: 63 },
        ],
      },
      '/api/media/episodes': SEM_MIDIA,
    });

    renderReview();

    // O dado de exemplo diz 42,80. O livro diz 0,40. A tela tem de mostrar o do livro.
    expect(await screen.findByText('US$ 0,40')).toBeInTheDocument();
    expect(screen.queryByText('US$ 42,80')).not.toBeInTheDocument();
    // E tem de dizer DE ONDE veio: "custo real" sem procedência foi exatamente o rótulo que mentiu.
    expect(screen.getByText(/Somado do livro de custos real/i)).toBeInTheDocument();
    expect(screen.getByText(/thumbnail: US\$ 0,39 em 4 lançamentos/i)).toBeInTheDocument();
  });

  it('sem livro durável, o custo diz "não verificável aqui" — nunca zero', async () => {
    stubPorRota({
      '/api/media/custos': {
        contentId: 'luna-borboletas',
        channelName: null,
        ledgerAvailable: false,
        totalUsd: 0,
        rows: 0,
        byStage: [],
        motivo: 'O canal não tem spec de mídia; sem o nome não dá para somar.',
      },
      '/api/media/episodes': SEM_MIDIA,
    });

    renderReview();

    expect(await screen.findByText('não verificável aqui')).toBeInTheDocument();
    expect(screen.getByText(/não tem spec de mídia/i)).toBeInTheDocument();
    // "Não sei" não pode virar "US$ 0,00": seria trocar um número inventado por outro.
    expect(screen.queryByText('US$ 0,00')).not.toBeInTheDocument();
  });

  it('a etapa Criar tem botão de roteiro — e diz que ele falta', async () => {
    renderReview();

    expect(await screen.findByRole('button', { name: /Escrever o roteiro com a IA/i })).toBeInTheDocument();
    expect(screen.getByText(/ainda não tem roteiro/i)).toBeInTheDocument();
    // Sem roteiro, o botão de cenas não aparece: `criar-cena` exige os blocos como entrada.
    expect(screen.queryByRole('button', { name: /Gerar as cenas com a IA/i })).not.toBeInTheDocument();
  });

  it('com roteiro gravado, a tela mostra os blocos e libera as cenas', async () => {
    await api.saveRoteiro('luna', 'luna-borboletas', {
      titulo: 'Luna e as Borboletas Coloridas',
      logline: 'Cada borboleta traz uma cor, e cada cor tem um som.',
      moral: 'Toda cor tem seu lugar no jardim.',
      blocos: [
        {
          ordem: 1,
          tempoInicioSeg: 0,
          tempoFimSeg: 12,
          narracao: 'Uma borboleta azul pousa no nariz da Luna.',
          acao: 'Luna arregala os olhos.',
          emocao: 'surpresa',
        },
        {
          ordem: 2,
          tempoInicioSeg: 12,
          tempoFimSeg: 26,
          narracao: 'Ela descobre que cada cor tem um som diferente.',
          acao: 'Luna gira devagar no jardim.',
          emocao: 'alegria',
        },
      ],
      geradoEm: '2026-10-01T12:00:00.000Z',
      promptId: 'criar-roteiro@v1',
      simulated: true,
    });

    renderReview();

    expect(await screen.findByText('Cada borboleta traz uma cor, e cada cor tem um som.')).toBeInTheDocument();
    expect(screen.getByText(/Uma borboleta azul pousa no nariz da Luna\./)).toBeInTheDocument();
    // Roteiro simulado é dito em voz alta: ele vira prompt de imagem depois.
    expect(screen.getByText(/simulado — sem chave configurada/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gerar as cenas com a IA/i })).toBeInTheDocument();
  });

  it('gera o storyboard POR LOTES: uma chamada por 3 blocos, gravando cada lote', async () => {
    /*
     * O teste que prova o conserto do HTTP 502 medido em 2026-10-02. Com o roteiro inteiro numa chamada
     * só, o teto de saída truncava o JSON e a resposta era `502 schema-invalido` depois de ~120 s, com a
     * linha do livro somando `2 × 3000` tokens; e quando "passava", passava com **uma cena**.
     *
     * Aqui o roteiro tem 7 blocos de propósito: divide em três lotes (3, 3, 1) e prova que a tela
     * encadeia — sem depender de o servidor aceitar lote grande.
     */
    await api.saveRoteiro('luna', 'luna-borboletas', {
      titulo: 'Roteiro de sete blocos',
      logline: 'Sete blocos para forçar três lotes de storyboard.',
      moral: 'Lote pequeno cabe no orçamento da chamada.',
      blocos: Array.from({ length: 7 }, (_, indice) => ({
        ordem: indice + 1,
        tempoInicioSeg: indice * 10,
        tempoFimSeg: indice * 10 + 10,
        narracao: `Narração do bloco ${indice + 1}.`,
        acao: `Ação do bloco ${indice + 1}.`,
        emocao: 'curiosidade',
      })),
      geradoEm: '2026-10-02T12:00:00.000Z',
      promptId: 'criar-roteiro@v1',
      simulated: false,
    });

    const corposDaIA: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/ai/generate')) {
        const corpo = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
        corposDaIA.push(corpo);
        const blocos = ((corpo['input'] as Record<string, unknown>)['blocos'] ?? []) as unknown[];
        return new Response(
          JSON.stringify({
            functionId: 'criar-cena',
            channelId: 'luna',
            promptId: 'criar-cena',
            promptVersion: 2,
            tier: 'criativo',
            provider: 'openai',
            model: 'gpt-6.1-sol',
            simulated: false,
            data: {
              cenas: blocos.map((_, indice) => ({
                numero: indice + 1,
                duracaoSeg: 10,
                descricao: 'Luna caminha entre flores.',
                enquadramento: 'plano médio',
                paleta: ['#7DD3FC'],
                promptImagem: 'a small round character walking among flowers, soft light',
                negativePrompt: 'text, watermark',
                seed: 100 + indice,
              })),
            },
            usage: { tokensIn: 120, tokensOut: 300 },
            costUsd: 0.001,
            costSource: 'real',
            costRecorded: 'csv',
            latencyMs: 900,
            createdAt: '2026-10-02T12:00:00.000Z',
            attempts: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify(SEM_MIDIA), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const user = userEvent.setup();
    renderReview();

    await user.click(await screen.findByRole('button', { name: /Gerar as cenas com a IA/i }));

    // 7 blocos ÷ 3 por lote = 3 chamadas. Nenhuma leva mais que o teto do schema de entrada.
    await waitFor(() => expect(corposDaIA).toHaveLength(3));

    /*
     * **A conferência que faltava, e o defeito que ela teria pegado.**
     *
     * O teste antigo só contava as chamadas — e passou verde enquanto o servidor recusava **todas** com
     * *"A entrada da função não está no formato esperado"*, porque o bloco do roteiro ia inteiro (com
     * `tempoInicioSeg`, `tempoFimSeg` e `emocao`) e `obj()` emite `additionalProperties: false`.
     * Contar chamadas mede o disparo; validar o corpo contra o **schema real** mede o conteúdo. Sem isto,
     * a tela pode chamar a função errada com o argumento errado e a suíte continua verde.
     */
    const schemaDaCena = getFunctionSchema('criar-cena');
    expect(schemaDaCena, 'criar-cena não está no registro de schemas').not.toBeNull();

    for (const corpo of corposDaIA) {
      const erros = validateSchema(schemaDaCena!.input, corpo['input']);
      expect(erros, `o corpo enviado não passa no schema de criar-cena: ${erros.join('; ')}`).toEqual([]);
      const blocos = (corpo['input'] as Record<string, unknown>)['blocos'] as Array<Record<string, unknown>>;
      expect(blocos.length).toBeGreaterThan(0);
      expect(blocos.length, 'um lote passou do teto de 3 blocos do schema').toBeLessThanOrEqual(3);
      // O bloco vai **reduzido** ao contrato: campo a mais derruba a chamada antes de sair do servidor.
      for (const bloco of blocos) {
        expect(Object.keys(bloco).sort()).toEqual(['acao', 'narracao', 'ordem']);
      }
    }

    // O storyboard acumulado chega inteiro ao conteúdo: 7 blocos → 7 cenas.
    await waitFor(async () => {
      const atual = await api.getContent('luna', 'luna-borboletas');
      expect(atual.storyboard?.cenas).toHaveLength(7);
    });

    // E `numero` é reatribuído pela posição: dois lotes devolveriam `numero: 1` cada, e chave repetida
    // quebraria a lista na tela.
    const atual = await api.getContent('luna', 'luna-borboletas');
    expect(atual.storyboard?.cenas.map((cena) => cena.numero)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    expect(await screen.findByText(/7 cenas gravadas/i)).toBeInTheDocument();
  });
});
