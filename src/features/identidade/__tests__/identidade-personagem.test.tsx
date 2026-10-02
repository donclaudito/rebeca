/**
 * O ciclo do personagem **na tela**: opções → escolha → refino → aprovação.
 *
 * Os quatro critérios de aceite da fase, percorridos de ponta a ponta na tela de Identidade, e as
 * duas coisas que o teste tenta **refutar**:
 *
 * 1. **nada é gravado sem clique humano** — gerar opções não cria personagem nenhum (a IA propõe, o
 *    humano decide; AGENTS.md, invariante nº 1), e nenhuma opção vem pré-escolhida;
 * 2. **trocar de canal limpa o ciclo** — opção proposta, ficha apontada e mensagem de decisão não
 *    podem sobreviver à troca (invariante nº 2).
 *
 * A rede é substituída: nenhum teste aqui chama servidor de verdade, e menos ainda um provedor pago.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { resetSessionForTests, setAccessToken } from '@/auth/token';
import { api, resetStore } from '@/data/client';
import { IdentidadePage } from '@/features/identidade/IdentidadePage';
import type { AiResult } from '@/ai/contract';
import type { CharacterProposal, CharacterSheetOrigin } from '@/data/types';

/** Procedência usada nos setups que gravam pela camada de dados. */
const ORIGEM: CharacterSheetOrigin = {
  promptId: 'identidade-personagem',
  promptVersion: 2,
  simulated: true,
};

/* =============================================================================
   Dublês
   ============================================================================= */

function ficha(overrides: Partial<CharacterProposal> = {}): CharacterProposal {
  return {
    nome: 'Bento',
    papel: 'Cachorro curioso, melhor amigo',
    descricaoVisual:
      'Cachorro pequeno e arredondado, corpo branco, orelhas grandes e caídas, sem coleira, patas curtas.',
    tracos: ['orelhas grandes e caídas', 'sem coleira'],
    promptImagem: 'small rounded white cartoon dog, large floppy ears, no collar, neutral background',
    negativePrompt: 'collar, extra limbs, text, watermark',
    seed: 4242,
    notasConsistencia: 'Não alterar: orelhas, ausência de coleira e cor do corpo.',
    ...overrides,
  };
}

const OPCOES_DE_CRIACAO: CharacterProposal[] = [
  ficha(),
  ficha({ nome: 'Nino', tracos: ['orelhas pequenas em pé', 'cauda em pompom'], seed: 4301 }),
  ficha({ nome: 'Pip', tracos: ['mancha no olho esquerdo', 'orelhas assimétricas'], seed: 4388 }),
];

const OPCOES_DE_REFINO: CharacterProposal[] = [
  ficha({
    descricaoVisual:
      'Cachorro pequeno e arredondado, corpo branco, orelhas grandes, caídas e maiores, sem coleira.',
    tracos: ['orelhas grandes, caídas e maiores', 'sem coleira'],
    seed: 4243,
  }),
];

const OPCOES_DE_REFINO_DA_LUNA: CharacterProposal[] = [
  ficha({
    nome: 'Luna',
    papel: 'Protagonista',
    descricaoVisual:
      'Menina de 6 anos, silhueta arredondada, cabelo castanho com mecha rosa e grampo de margarida.',
    tracos: ['grampo de margarida no cabelo', 'mecha rosa à frente da orelha'],
    seed: 1105,
  }),
];

/** Resposta da camada de IA, com a mesma forma que o servidor devolve. */
function respostaComOpcoes(opcoes: CharacterProposal[]): AiResult {
  return {
    functionId: 'identidade-personagem',
    channelId: 'luna',
    promptId: 'identidade-personagem',
    promptVersion: 2,
    tier: 'criativo',
    provider: 'simulado',
    model: 'simulado',
    simulated: true,
    data: { opcoes },
    usage: { tokensIn: 0, tokensOut: 0 },
    costUsd: 0,
    costSource: 'nao-verificado',
    costRecorded: 'nenhum',
    latencyMs: 12,
    createdAt: '2026-10-02T12:00:00.000Z',
    attempts: 1,
  };
}

/** Cada chamada de geração recebe a próxima resposta da fila (a última se repete). */
function stubIa(respostas: AiResult[]) {
  let chamada = 0;
  const fetchMock = vi.fn(async (url: string) => {
    const corpo = String(url).includes('/api/ai/generate')
      ? respostas[Math.min(chamada++, respostas.length - 1)]
      : {};
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * Duas cascas, escolhidas pelo que o caso realmente precisa.
 *
 * `renderCasca` monta o app inteiro (`AppRoutes`: topbar, barra lateral, provedores). Só o caso que
 * usa o **seletor de canal** precisa disso. `renderTela` monta a tela de Identidade pela rota, com os
 * mesmos provedores — o custo de render da casca não é o que estes casos medem, e sob a suíte inteira
 * carregada ele era a diferença entre passar e estourar: o caso das quatro batidas levou **21257 ms**
 * com a casca contra um teto de 20 s, mesmo depois de `delay: null` e colagem.
 */
function montar(arvore: ReactElement, canal: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/c/${canal}/identidade`]}>{arvore}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** A tela de Identidade sozinha (sem a casca) — para tudo que não usa o seletor de canal. */
function renderTela(canal = 'luna') {
  return montar(
    <Routes>
      <Route path="/c/:channelId/identidade" element={<IdentidadePage />} />
    </Routes>,
    canal,
  );
}

/** O app inteiro — necessário só para trocar de canal pelo seletor da barra superior. */
function renderCasca(canal = 'luna') {
  return montar(<AppRoutes />, canal);
}

/**
 * Usuário de teste **sem atraso entre eventos**.
 *
 * O `setup()` padrão do `userEvent` espera um tick real entre cada evento. Num caso que percorre
 * quatro batidas e escreve em dois campos, esses ticks somam segundos — e o caso das quatro batidas
 * estourava o teto de 20 s sob árvore carregada (medido: 20136 ms por 136 ms, pelo `rebeca-qa`).
 * Nada do que este arquivo verifica depende do intervalo entre eventos.
 */
const criarUsuario = () => userEvent.setup({ delay: null });

/**
 * Escreve num campo do jeito barato: foco e **colagem**.
 *
 * `user.type` dispara um evento por caractere, e cada caractere re-renderiza a tela inteira — com a
 * ficha das opções montada, isso é caro. `paste` é ação humana de verdade e produz **um** evento de
 * entrada. O que os casos medem é o que acontece depois do clique, não a digitação caractere a
 * caractere.
 */
async function escrever(
  user: ReturnType<typeof userEvent.setup>,
  campo: HTMLElement,
  texto: string,
) {
  await user.click(campo);
  await user.paste(texto);
}

/** Descreve o personagem e manda gerar as opções. */
async function gerarCriacao(user: ReturnType<typeof userEvent.setup>) {
  await escrever(user, await screen.findByLabelText('Como é o personagem?'), 'Cachorro curioso para a Luna');
  // `findByRole` e não `getByRole`: o botão só existe depois que a consulta do canal resolve (o
  // `fieldset` do `AiAction` é condicionado a `channelData`). Com a digitação lenta isso passava por
  // acidente — o tempo de escrever 58 caracteres cobria a consulta; a colagem instantânea expôs a
  // dependência, que era do teste e não da tela.
  await user.click(await screen.findByRole('button', { name: /Gerar opções de ficha/i }));
}

/** A lista de personagens do canal — assíncrona porque a consulta chega depois do primeiro render. */
const listaDePersonagens = () => screen.findByRole('list', { name: 'Personagens deste canal' });

beforeEach(() => {
  resetStore();
  // A camada de IA recusa mandar pedido anônimo (ADR-014); o teste entra com uma sessão de mentira.
  setAccessToken('token-de-teste');
});

afterEach(() => {
  resetStore();
  resetSessionForTests();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/* =============================================================================
   Critérios de aceite
   ============================================================================= */

describe('ciclo do personagem na tela de Identidade', () => {
  it('descrever devolve opções e nada é gravado sem clique humano', async () => {
    const user = criarUsuario();
    const salvar = vi.spyOn(api, 'saveCharacterDraft');
    const aprovar = vi.spyOn(api, 'approveCharacter');
    const antes = (await api.getCharacters('luna')).map((character) => character.id);
    stubIa([respostaComOpcoes(OPCOES_DE_CRIACAO)]);

    renderTela();
    await gerarCriacao(user);

    const opcoes = await screen.findByRole('list', {
      name: 'Opções de personagem propostas pela IA',
    });
    expect(within(opcoes).getAllByRole('button', { name: /Escolher a opção/ })).toHaveLength(3);

    // A IA propôs; ninguém escolheu por você — e nada foi gravado.
    expect(salvar).not.toHaveBeenCalled();
    expect(aprovar).not.toHaveBeenCalled();
    expect((await api.getCharacters('luna')).map((character) => character.id)).toEqual(antes);
    expect(screen.queryByText(/Escolhida por você/i)).not.toBeInTheDocument();

    // A procedência da resposta é dita em voz alta: simulação não se passa por geração real.
    expect(screen.getAllByText(/vieram de simulação/i).length).toBeGreaterThan(0);
  });

  it('escolher uma opção grava o rascunho do canal, e ele não nasce oficial', async () => {
    const user = criarUsuario();
    stubIa([respostaComOpcoes(OPCOES_DE_CRIACAO)]);

    renderTela();
    await gerarCriacao(user);

    const opcoes = await screen.findByRole('list', { name: 'Opções de personagem propostas pela IA' });
    await user.click(within(opcoes).getAllByRole('button', { name: /Escolher a opção 1/ })[0] as HTMLElement);

    expect(await screen.findByText(/entrou na lista como rascunho v1/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Aprovar Bento (v1) como oficial' })).toBeInTheDocument();

    // Rascunho não é usado em episódio nenhum: ainda não é oficial.
    const lista = await api.getCharacters('luna');
    expect(lista).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Bento', status: 'rascunho' })]),
    );
    expect(
      lista.filter((character) => character.name === 'Bento' && character.status === 'oficial'),
    ).toHaveLength(0);

    // A ficha recém-escolhida já vem apontada para o refino — é o encadeamento das batidas.
    expect((screen.getByLabelText('Personagem a refinar') as HTMLSelectElement).value).toBe(
      lista.find((character) => character.name === 'Bento')?.id ?? '',
    );
  });

  it('refinar a ficha escolhida cria a versão seguinte, derivada e ainda não oficial', async () => {
    const user = criarUsuario();
    stubIa([respostaComOpcoes(OPCOES_DE_REFINO)]);
    // A ficha de origem entra pela camada de dados: o que este caso mede é a batida do **refino**, e o
    // caminho de escolha pela tela tem caso próprio logo acima. Setup por API aqui é deliberado — é o
    // que mantém cada caso pequeno o bastante para não estourar o teto sob carga.
    const base = await api.saveCharacterDraft('luna', { proposal: ficha(), origin: ORIGEM });
    expect(base.sheetVersion).toBe('v1');

    renderTela();
    // Espera a lista do canal: o `<select>` existe antes das opções, e selecionar um id que ainda não
    // está entre elas falha. É a consulta que traz a ficha, não o clique.
    await listaDePersonagens();
    await user.selectOptions(screen.getByLabelText('Personagem a refinar'), base.id);
    await escrever(user, screen.getByLabelText('O que você quer mudar?'), 'orelhas maiores e sem coleira');
    await user.click(await screen.findByRole('button', { name: /Gerar versões refinadas/i }));

    const refino = await screen.findByRole('list', { name: 'Opções refinadas propostas pela IA' });
    expect(within(refino).getAllByRole('button', { name: /Escolher a opção/ }).length).toBeGreaterThan(0);
    await user.click(within(refino).getAllByRole('button', { name: /Escolher a opção 1/ })[0] as HTMLElement);

    expect(await screen.findByText(/ganhou a versão v2 como rascunho/)).toBeInTheDocument();
    /*
     * A lista do canal só mostra a versão nova **depois** que a consulta invalidada volta. Esta espera
     * não é decorativa: era aqui que o caso terminava com a atualização de estado ainda em voo — o
     * `An update to IdentidadePage inside a test was not wrapped in act(...)` que o vitest registrava,
     * e a mesma família do estouro de tempo (o caso não pode depender de *quando* o estado assenta).
     */
    expect(
      await screen.findByRole('button', { name: 'Aprovar Bento (v2) como oficial' }),
    ).toBeInTheDocument();

    // Enquanto não aprovar, a versão nova não é a oficial — e a ficha de origem continua intacta.
    const lista = await api.getCharacters('luna');
    expect(lista.filter((character) => character.name === 'Bento')).toHaveLength(2);
    expect(
      lista.filter((character) => character.name === 'Bento' && character.status === 'oficial'),
    ).toHaveLength(0);
    expect(lista.find((character) => character.id === base.id)?.sheet.descricaoVisual).toBe(
      base.sheet.descricaoVisual,
    );
  });

  it('aprovar é o que torna oficial — e nada antes disso chega lá', async () => {
    const user = criarUsuario();
    // Batida da aprovação: a ficha entra pela camada de dados (o clique humano é o que está sob teste).
    const base = await api.saveCharacterDraft('luna', { proposal: ficha(), origin: ORIGEM });

    renderTela();
    await user.click(await screen.findByRole('button', { name: 'Aprovar Bento (v1) como oficial' }));

    expect(await screen.findByText(/agora é oficial na v1/)).toBeInTheDocument();
    // O botão de aprovar só desaparece quando a lista volta dizendo que ele é oficial: esperar por isso
    // fecha o caso **depois** de o estado assentar, em vez de deixar a atualização cair fora do `act`.
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Aprovar Bento (v1) como oficial' }),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Refinar Bento (v1)' })).toBeInTheDocument();

    const oficiais = (await api.getCharacters('luna')).filter(
      (character) => character.name === 'Bento' && character.status === 'oficial',
    );
    expect(oficiais.map((character) => character.id)).toEqual([base.id]);
  });

  it('refinar uma ficha oficial e aprovar substitui a anterior, e a tela diz qual caiu', async () => {
    const user = criarUsuario();
    stubIa([respostaComOpcoes(OPCOES_DE_REFINO_DA_LUNA)]);

    renderTela();

    // A ficha de origem é a Luna v4, oficial.
    expect(within(await listaDePersonagens()).getAllByText('Oficial').length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Personagem a refinar'), 'luna-hero');
    await escrever(user, screen.getByLabelText('O que você quer mudar?'), 'quero a mecha rosa mais visível');
    await user.click(await screen.findByRole('button', { name: /Gerar versões refinadas/i }));

    const refino = await screen.findByRole('list', { name: 'Opções refinadas propostas pela IA' });
    await user.click(within(refino).getAllByRole('button', { name: /Escolher a opção 1/ })[0] as HTMLElement);
    expect(await screen.findByText(/ganhou a versão v5 como rascunho/)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'Aprovar Luna (v5) como oficial' }));

    expect(await screen.findByText(/A versão anterior \(v4\) deixou de ser oficial/)).toBeInTheDocument();
    // A versão caiu, mas continua no registro: os episódios já gerados usaram a ficha dela.
    await waitFor(() => {
      expect(
        within(screen.getByRole('list', { name: 'Personagens deste canal' })).getAllByText('Substituído')
          .length,
      ).toBeGreaterThan(0);
    });
    expect(await screen.findByRole('button', { name: 'Refinar Luna (v4)' })).toBeInTheDocument();

    const lunas = (await api.getCharacters('luna')).filter((character) => character.name === 'Luna');
    expect(lunas.filter((character) => character.status === 'oficial').map((c) => c.sheetVersion)).toEqual([
      'v5',
    ]);
  });

  it('a tela diz que o canal tem ficha canônica — ou diz que não tem', async () => {
    renderTela();
    expect(await screen.findByText(/Este canal tem 2 fichas canônicas/)).toBeInTheDocument();
    expect(screen.getByText(/Luna \(v4\)/)).toBeInTheDocument();
  });

  it('trocar de canal limpa o ciclo: nada do canal anterior fica na tela', async () => {
    const user = criarUsuario();
    stubIa([respostaComOpcoes(OPCOES_DE_CRIACAO)]);

    // Este é o único caso que precisa da casca inteira: a troca de canal é feita no seletor da barra
    // superior, que só existe em `AppRoutes`.
    renderCasca();
    await gerarCriacao(user);

    const opcoes = await screen.findByRole('list', {
      name: 'Opções de personagem propostas pela IA',
    });
    await user.click(within(opcoes).getAllByRole('button', { name: /Escolher a opção 1/ })[0] as HTMLElement);
    expect(await screen.findByText(/entrou na lista como rascunho v1/)).toBeInTheDocument();

    // Troca de canal pelo seletor da barra superior.
    await user.click(screen.getByRole('button', { name: /Canal ativo: Luna e o Jardim das Cores/i }));
    const canais = await screen.findByRole('listbox', { name: 'Canais' });
    await user.click(within(canais).getByRole('option', { name: /Arquivo Curioso/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole('list', { name: 'Opções de personagem propostas pela IA' }),
      ).not.toBeInTheDocument();
    });
    /*
     * O canal novo não tem resposta de IA nenhuma — e a tela tem de dizer **isso**, não herdar a
     * resposta do canal anterior nem fingir que a resposta dele voltou sem opções.
     *
     * Esta parte do teste existe porque a mutação provou que a versão anterior não mordia: apagar só
     * o `setRespostaCriacao(null)` do efeito de troca deixava o bloco "Opções geradas" na tela dizendo
     * "não trouxe nenhuma opção legível" — mentira sobre o canal novo — e o teste continuava verde,
     * porque olhava apenas para a lista, que sumia por outro motivo.
     */
    expect(screen.queryByText(/Opções geradas/)).not.toBeInTheDocument();
    expect(screen.queryByText(/não trouxe nenhuma opção legível/)).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhuma opção foi gerada ainda/)).toBeInTheDocument();
    expect((screen.getByLabelText('Como é o personagem?') as HTMLTextAreaElement).value).toBe('');
    // Nem a opção proposta, nem a ficha escolhida, nem a mensagem de decisão sobrevivem à troca.
    expect(screen.queryByText(/entrou na lista como rascunho/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Opção 1: Bento/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar Bento (v1) como oficial' })).not.toBeInTheDocument();
    // E a lista é a do canal novo. (O nome aparece duas vezes por personagem: no cartão e no rótulo
    // do espaço reservado da arte — por isso `getAllByText`.)
    expect(
      within(await listaDePersonagens()).getAllByText('Narrador do Arquivo').length,
    ).toBeGreaterThan(0);
  });

  it('resposta sem opções legíveis não vira tela quebrada nem gravação', async () => {
    const user = criarUsuario();
    const salvar = vi.spyOn(api, 'saveCharacterDraft');
    stubIa([respostaComOpcoes([])]);

    renderTela();
    await gerarCriacao(user);

    expect(await screen.findByText(/não trouxe nenhuma opção legível/)).toBeInTheDocument();
    expect(salvar).not.toHaveBeenCalled();
  });
});
