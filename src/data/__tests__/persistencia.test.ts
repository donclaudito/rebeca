/**
 * Persistência do que a IA gera — o teste do relato *"não permite salvar, tendo que refazer todo de novo,
 * consumindo LLM no mesmo vídeo"*.
 *
 * ## O defeito que este arquivo refuta
 *
 * `src/data/client.ts` guardava tudo em `let store: ContentItem[]` — memória do navegador. O botão de
 * gravar existia (`saveRoteiro` → `patchArtifact` → `patchContent`) e funcionava, mas o resultado morria
 * no primeiro F5. Como cada geração de roteiro/cena é **paga**, perder o resultado significa pagar duas
 * vezes pelo mesmo vídeo.
 *
 * ## Como se simula um F5 aqui
 *
 * `vi.resetModules()` + `import()` dinâmico reexecuta o módulo do zero, exatamente como uma página nova
 * faria. É o único jeito honesto de testar isso: chamar a função de leitura no **mesmo** módulo provaria
 * apenas que a variável em memória continua lá — que era justamente o caso antes do conserto.
 *
 * ## Isolamento entre canais (invariante nº 2)
 *
 * A gravação é por chave de canal. O teste confere o **conteúdo da chave**: o que foi gravado no canal
 * `luna` não pode conter um item de `arquivo`. Isolamento que não é conferido no dado é decoração.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Roteiro, Storyboard } from '@/data/types';

const CANAL = 'luna';
const CONTEUDO = 'luna-arcoiris';
const OUTRO_CANAL = 'arquivo';
const OUTRO_CONTEUDO = 'arq-ceu-laranja';

const CHAVE_LUNA = 'rebeca:v1:conteudos:luna';
const CHAVE_ARQUIVO = 'rebeca:v1:conteudos:arquivo';

const ROTEIRO: Roteiro = {
  titulo: 'Luna e o Arco-íris',
  logline: 'A Luna descobre que o arco-íris junta todas as cores que ela já conhece.',
  moral: 'Toda cor tem seu lugar.',
  blocos: [
    {
      ordem: 1,
      tempoInicioSeg: 0,
      tempoFimSeg: 12,
      narracao: 'A chuva para e o sol volta a brilhar no jardim.',
      acao: 'Luna abre a janela e aponta para o céu.',
      emocao: 'surpresa',
    },
    {
      ordem: 2,
      tempoInicioSeg: 12,
      tempoFimSeg: 28,
      narracao: 'Ela conta as cores do arco-íris, uma por uma.',
      acao: 'Luna desenha o arco no chão de terra.',
      emocao: 'alegria',
    },
  ],
  geradoEm: '2026-10-02T12:00:00.000Z',
  promptId: 'criar-roteiro@v1',
  simulated: false,
};

const STORYBOARD: Storyboard = {
  cenas: [
    {
      numero: 1,
      duracaoSeg: 12,
      descricao: 'Luna abre a janela e o jardim aparece molhado de chuva.',
      enquadramento: 'plano médio',
      paleta: ['#F2C94C', '#56CCF2'],
      promptImagem: 'jardim molhado com arco-íris ao fundo, estilo infantil',
      negativePrompt: 'assustador',
      seed: 11,
    },
  ],
  geradoEm: '2026-10-02T12:05:00.000Z',
  promptId: 'criar-cena@v2',
  simulated: false,
};

/** Reexecuta o módulo do zero — o equivalente a um F5 para a camada de dados. */
async function recarregar() {
  vi.resetModules();
  return import('@/data/client');
}

/** Armazenamento que aceita ler mas falha ao gravar — janela privada / cota cheia. */
function armazenamentoQueFalhaAoGravar(): Storage {
  return {
    length: 0,
    clear: () => undefined,
    getItem: () => null,
    key: () => null,
    removeItem: () => undefined,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  } as unknown as Storage;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  globalThis.localStorage.clear();
  vi.resetModules();
});

describe('o que a IA gerou sobrevive a recarregar a página', () => {
  it('o roteiro pago continua no conteúdo depois do F5', async () => {
    const antes = await recarregar();
    await antes.api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);

    const depois = await recarregar();
    const item = await depois.api.getContent(CANAL, CONTEUDO);

    expect(item.roteiro?.titulo).toBe(ROTEIRO.titulo);
    expect(item.roteiro?.blocos).toHaveLength(2);
    expect(item.roteiro?.blocos[1]?.narracao).toBe(ROTEIRO.blocos[1]?.narracao);
  });

  it('o storyboard também sobrevive — e continua ligado ao roteiro', async () => {
    const antes = await recarregar();
    await antes.api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    await antes.api.saveStoryboard(CANAL, CONTEUDO, STORYBOARD);

    const depois = await recarregar();
    const item = await depois.api.getContent(CANAL, CONTEUDO);

    expect(item.roteiro).toBeDefined();
    expect(item.storyboard?.cenas).toHaveLength(1);
    expect(item.storyboard?.cenas[0]?.promptImagem).toBe(STORYBOARD.cenas[0]?.promptImagem);
    // A seed da cena é o que torna a imagem determinística — perder isso é perder reprodutibilidade.
    expect(item.storyboard?.cenas[0]?.seed).toBe(11);
  });

  it('a ficha de personagem aprovada sobrevive', async () => {
    const antes = await recarregar();
    const criado = await antes.api.saveCharacterDraft(CANAL, {
      proposal: {
        nome: 'Bento',
        papel: 'Cachorro curioso, melhor amigo',
        descricaoVisual:
          'Cachorro pequeno e arredondado, corpo branco, orelhas grandes e caídas, olhos redondos e escuros, sem coleira, patas curtas.',
        tracos: ['orelhas grandes e caídas', 'sem coleira', 'corpo branco arredondado'],
        promptImagem:
          'small rounded white cartoon dog, large floppy ears, big round dark eyes, no collar, neutral background, full body',
        negativePrompt: 'collar, extra limbs, text, watermark, realistic photo',
        seed: 4242,
        notasConsistencia: 'Não alterar: orelhas, ausência de coleira e cor do corpo.',
      },
      origin: { promptId: 'identidade-personagem', promptVersion: 2, simulated: true },
    });
    await antes.api.approveCharacter(CANAL, criado.id);

    const depois = await recarregar();
    const personagens = await depois.api.getCharacters(CANAL);
    const aprovada = personagens.find((p) => p.id === criado.id);

    expect(aprovada?.status).toBe('oficial');
    expect(aprovada?.approvedAt).toBeTruthy();
  });
});

describe('isolamento entre canais na gravação', () => {
  it('o que foi gravado num canal não aparece no outro, nem na chave do outro', async () => {
    const antes = await recarregar();
    await antes.api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    await antes.api.saveRoteiro(OUTRO_CANAL, OUTRO_CONTEUDO, {
      ...ROTEIRO,
      titulo: 'O céu cor de laranja',
    });

    const depois = await recarregar();

    const doLuna = await depois.api.getContent(CANAL, CONTEUDO);
    const doArquivo = await depois.api.getContent(OUTRO_CANAL, OUTRO_CONTEUDO);

    expect(doLuna.roteiro?.titulo).toBe('Luna e o Arco-íris');
    expect(doArquivo.roteiro?.titulo).toBe('O céu cor de laranja');

    // O dado dentro da chave de cada canal é só daquele canal.
    const gravadoLuna = JSON.parse(localStorage.getItem(CHAVE_LUNA) ?? '[]') as { channelId: string }[];
    const gravadoArquivo = JSON.parse(localStorage.getItem(CHAVE_ARQUIVO) ?? '[]') as {
      channelId: string;
    }[];

    expect(gravadoLuna.length).toBeGreaterThan(0);
    expect(gravadoArquivo.length).toBeGreaterThan(0);
    expect(gravadoLuna.every((item) => item.channelId === CANAL)).toBe(true);
    expect(gravadoArquivo.every((item) => item.channelId === OUTRO_CANAL)).toBe(true);
    expect(gravadoLuna.some((item) => item.channelId === OUTRO_CANAL)).toBe(false);
  });

  it('um canal sem gravação continua com o dado de exemplo', async () => {
    const antes = await recarregar();
    await antes.api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);

    const depois = await recarregar();
    const outro = await depois.api.getContent(OUTRO_CANAL, OUTRO_CONTEUDO);

    expect(outro.roteiro).toBeUndefined();
    expect(outro.channelId).toBe(OUTRO_CANAL);
  });
});

describe('o "reiniciar exemplo" não mente', () => {
  it('apaga também o que estava gravado no navegador', async () => {
    const antes = await recarregar();
    await antes.api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    expect(localStorage.getItem(CHAVE_LUNA)).not.toBeNull();

    antes.resetStore();

    const depois = await recarregar();
    const item = await depois.api.getContent(CANAL, CONTEUDO);

    expect(item.roteiro).toBeUndefined();
    expect(localStorage.getItem(CHAVE_LUNA)).toBeNull();
  });
});

describe('quando a gravação não funciona, o app não quebra nem esconde', () => {
  it('declara a durabilidade como falsa, com motivo, e segue funcionando em memória', async () => {
    vi.stubGlobal('localStorage', armazenamentoQueFalhaAoGravar());

    const { api } = await recarregar();
    const { durability } = await import('@/data/persist');

    const estado = durability();
    expect(estado.durable).toBe(false);
    expect(estado.reason).toBeTruthy();

    // A gravação falha em silêncio **na escrita**, mas não derruba a operação nem o app.
    await expect(api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO)).resolves.toBeDefined();
    const item = await api.getContent(CANAL, CONTEUDO);
    expect(item.roteiro?.titulo).toBe(ROTEIRO.titulo);
  });

  it('dado corrompido na chave cai na semente em vez de derrubar a tela', async () => {
    localStorage.setItem(CHAVE_LUNA, '{isto não é json');

    const { api } = await recarregar();
    const item = await api.getContent(CANAL, CONTEUDO);

    expect(item.roteiro).toBeUndefined();
    expect(item.id).toBe(CONTEUDO);
    // E a semente foi regravada por cima do lixo, ao primeiro salvamento.
    await api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    expect(() => JSON.parse(localStorage.getItem(CHAVE_LUNA) ?? '')).not.toThrow();
  });
});
