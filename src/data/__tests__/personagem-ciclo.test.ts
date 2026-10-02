/**
 * O ciclo do personagem na camada de dados: **opções → escolha → refino → aprovação**.
 *
 * É o que o PDF do cliente pede (`.rebeca/fontes/ideabeba-extraido.txt`, *Identidade e branding*):
 * *"O sistema gera opções. Eu escolho uma. Depois digo: 'Gostei desse, mas quero as orelhas maiores e
 * sem coleira.' Ela gera novamente. Quando eu aprovar o personagem, ele vira um personagem oficial."*
 *
 * O teste tenta **refutar** quatro garantias:
 *
 * 1. personagem novo nasce `rascunho` — e não existe caminho para `oficial` fora de `approveCharacter`;
 * 2. refinar cria versão nova e **não** mexe na ficha de origem (episódios já gerados usaram ela);
 * 3. aprovar o refino de uma ficha oficial **não deixa oficial para trás** (uma identidade canônica só);
 * 4. personagem de outro canal é recusado com a mesma mensagem de "não existe" (invariante nº 2).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { api, nextSheetVersion, resetStore } from '@/data/client';
import type { CharacterProposal, CharacterSheetOrigin } from '@/data/types';

const ORIGEM: CharacterSheetOrigin = {
  promptId: 'identidade-personagem',
  promptVersion: 2,
  simulated: true,
};

/** Uma ficha proposta pela IA — a mesma forma que a função `identidade-personagem` devolve. */
function ficha(overrides: Partial<CharacterProposal> = {}): CharacterProposal {
  return {
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
    ...overrides,
  };
}

/** As opções que a IA devolveu — três leituras distintas do mesmo pedido. */
const OPCOES: readonly CharacterProposal[] = [
  ficha(),
  ficha({
    nome: 'Nino',
    descricaoVisual: 'Personagem esguio de pernas longas, corpo bege uniforme, orelhas pequenas em pé.',
    tracos: ['orelhas pequenas em pé', 'cauda curta em pompom'],
    seed: 4301,
  }),
  ficha({
    nome: 'Pip',
    descricaoVisual: 'Personagem bem pequeno e compacto, corpo cinza-claro, mancha escura no olho esquerdo.',
    tracos: ['mancha escura no olho esquerdo', 'orelhas assimétricas'],
    seed: 4388,
  }),
];

const oficiaisDe = async (channelId: string) =>
  (await api.getCharacters(channelId)).filter((character) => character.status === 'oficial');

describe('ciclo do personagem', () => {
  beforeEach(() => {
    resetStore();
  });

  it('percorre opções → escolha → refino → aprovação, subindo a revisão da ficha', async () => {
    // 1 e 2 — a escolha do humano entre as opções vira rascunho do canal.
    const escolhido = await api.saveCharacterDraft('luna', {
      proposal: OPCOES[0] as CharacterProposal,
      origin: ORIGEM,
    });

    expect(escolhido).toMatchObject({
      channelId: 'luna',
      name: 'Bento',
      status: 'rascunho',
      sheetVersion: 'v1',
      derivedFromId: null,
      sheetOrigin: ORIGEM,
    });
    expect(escolhido.sheet).toEqual({
      descricaoVisual: (OPCOES[0] as CharacterProposal).descricaoVisual,
      tracos: [...(OPCOES[0] as CharacterProposal).tracos],
      promptImagem: (OPCOES[0] as CharacterProposal).promptImagem,
      negativePrompt: (OPCOES[0] as CharacterProposal).negativePrompt,
      seed: 4242,
      notasConsistencia: (OPCOES[0] as CharacterProposal).notasConsistencia,
    });
    expect(escolhido.approvedAt).toBeUndefined();

    const depoisDaEscolha = await api.getCharacters('luna');
    expect(depoisDaEscolha.filter((c) => c.name === 'Bento')).toHaveLength(1);
    expect(depoisDaEscolha.find((c) => c.id === escolhido.id)?.status).toBe('rascunho');

    // 3 — o refino: nova versão **derivada**, com o ajuste pedido.
    const refinado = await api.saveCharacterDraft('luna', {
      proposal: ficha({
        descricaoVisual:
          'Cachorro pequeno e arredondado, corpo branco, orelhas grandes, caídas e maiores que na ficha anterior, sem coleira, patas curtas.',
      }),
      derivedFromId: escolhido.id,
      origin: ORIGEM,
    });

    expect(refinado.sheetVersion).toBe(nextSheetVersion(escolhido.sheetVersion));
    expect(refinado.sheetVersion).toBe('v2');
    expect(refinado.derivedFromId).toBe(escolhido.id);
    expect(refinado.status).toBe('rascunho');

    // A ficha de origem continua intacta: refino não edita o que já foi gerado.
    const origemIntacta = (await api.getCharacters('luna')).find((c) => c.id === escolhido.id);
    expect(origemIntacta?.sheet.descricaoVisual).toBe(escolhido.sheet.descricaoVisual);
    expect(origemIntacta?.status).toBe('rascunho');

    // 4 — a aprovação é o único caminho para oficial.
    const { character, superseded } = await api.approveCharacter('luna', refinado.id);
    expect(character.status).toBe('oficial');
    expect(character.sheetVersion).toBe('v2');
    expect(character.approvedAt).toEqual(expect.any(String));
    // A base era rascunho, então não havia ficha oficial a substituir — e a resposta diz isso.
    expect(superseded).toEqual([]);

    const lista = await api.getCharacters('luna');
    expect(lista.find((c) => c.id === refinado.id)?.status).toBe('oficial');
    expect(lista.find((c) => c.id === escolhido.id)?.status).toBe('rascunho');
  });

  it('personagem novo nasce rascunho e nem um status forçado vindo de fora o torna oficial', async () => {
    const antes = await oficiaisDe('luna');

    // O status extra é ignorado: quem grava decide o estado, e a proposta é dado externo.
    const comStatusForcado = { ...ficha({ nome: 'Forçado' }), status: 'oficial' } as unknown as CharacterProposal;
    const criado = await api.saveCharacterDraft('luna', { proposal: comStatusForcado, origin: ORIGEM });

    expect(criado.status).toBe('rascunho');
    expect(criado.name).toBe('Forçado');
    expect(await oficiaisDe('luna')).toHaveLength(antes.length);
  });

  it('refino de ficha oficial não deixa oficial para trás', async () => {
    const antes = await api.getCharacters('luna');
    const lunaV4 = antes.find((c) => c.id === 'luna-hero');
    expect(lunaV4).toMatchObject({ name: 'Luna', status: 'oficial', sheetVersion: 'v4' });

    const nova = await api.saveCharacterDraft('luna', {
      proposal: ficha({
        nome: 'Luna',
        papel: 'Protagonista',
        descricaoVisual:
          'Menina de 6 anos, silhueta arredondada, cabelo castanho com mecha rosa presa por grampo de margarida, vestido azul-céu.',
        tracos: ['grampo de margarida no cabelo', 'mecha rosa à frente da orelha'],
        seed: 1105,
      }),
      derivedFromId: 'luna-hero',
      origin: ORIGEM,
    });
    expect(nova.sheetVersion).toBe('v5');

    // Enquanto o refino não é aprovado, a v4 continua sendo a oficial.
    expect((await api.getCharacters('luna')).find((c) => c.id === 'luna-hero')?.status).toBe('oficial');

    const { superseded } = await api.approveCharacter('luna', nova.id);
    expect(superseded.map((c) => c.sheetVersion)).toEqual(['v4']);

    const lista = await api.getCharacters('luna');
    const lunaOficiais = lista.filter((c) => c.name === 'Luna' && c.status === 'oficial');
    expect(lunaOficiais.map((c) => c.sheetVersion)).toEqual(['v5']);

    // A v4 não foi apagada: ela deixa de ser oficial e continua registrada, porque os episódios já
    // gerados usaram a ficha dela.
    const aposentada = lista.find((c) => c.id === 'luna-hero');
    expect(aposentada?.status).toBe('substituido');
    expect(aposentada?.sheet.descricaoVisual).toBe(lunaV4?.sheet.descricaoVisual);
  });

  it('recusa personagem de outro canal com a mesma mensagem de "não existe"', async () => {
    // `luna-hero` existe — mas não no canal `arquivo`.
    await expect(
      api.saveCharacterDraft('arquivo', {
        proposal: ficha({ nome: 'Intruso' }),
        derivedFromId: 'luna-hero',
        origin: ORIGEM,
      }),
    ).rejects.toThrow('Personagem não encontrado neste canal.');

    await expect(api.approveCharacter('arquivo', 'luna-hero')).rejects.toThrow(
      'Personagem não encontrado neste canal.',
    );

    // A mensagem é a mesma para "não é seu" e para "não existe": a tela não denuncia o dado alheio.
    await expect(api.approveCharacter('luna', 'arq-host')).rejects.toThrow(
      'Personagem não encontrado neste canal.',
    );
  });

  it('personagem de um canal nunca aparece na lista de outro', async () => {
    const criado = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Só do canal Luna' }),
      origin: ORIGEM,
    });

    for (const outro of ['arquivo', 'aims']) {
      const lista = await api.getCharacters(outro);
      expect(lista.some((character) => character.id === criado.id)).toBe(false);
      expect(lista.every((character) => character.channelId === outro)).toBe(true);
    }

    const daLuna = await api.getCharacters('luna');
    expect(daLuna.some((character) => character.id === criado.id)).toBe(true);
    expect(daLuna.every((character) => character.channelId === 'luna')).toBe(true);
  });

  it('nem a segunda aprovação nem a volta de um substituído passam', async () => {
    const primeira = await api.saveCharacterDraft('luna', { proposal: ficha(), origin: ORIGEM });
    await api.approveCharacter('luna', primeira.id);

    await expect(api.approveCharacter('luna', primeira.id)).rejects.toThrow(/já é oficial/i);

    const refinada = await api.saveCharacterDraft('luna', {
      proposal: ficha({ seed: 5150 }),
      derivedFromId: primeira.id,
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', refinada.id);

    // A versão substituída não volta a ser oficial: quem decide isso é a aprovação da versão vigente.
    await expect(api.approveCharacter('luna', primeira.id)).rejects.toThrow(/substituída/i);
    expect((await oficiaisDe('luna')).filter((c) => c.name === 'Bento')).toHaveLength(1);
  });

  it('recusa ficha incompleta em vez de gravar um "canônico" que não descreve nada', async () => {
    const antes = await api.getCharacters('luna');

    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha({ tracos: [] }), origin: ORIGEM }),
    ).rejects.toThrow(/traço/i);
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha({ descricaoVisual: 'curto demais' }), origin: ORIGEM }),
    ).rejects.toThrow(/descrição visual/i);
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha({ promptImagem: 'pouco' }), origin: ORIGEM }),
    ).rejects.toThrow(/prompt de imagem/i);
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha({ seed: Number.NaN }), origin: ORIGEM }),
    ).rejects.toThrow(/seed/i);
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha({ nome: '   ' }), origin: ORIGEM }),
    ).rejects.toThrow(/nome/i);

    // Nenhuma recusa deixou rascunho para trás.
    expect(await api.getCharacters('luna')).toHaveLength(antes.length);
  });

  it('exige procedência: ficha sem origem registrada não entra no canal', async () => {
    const semPrompt = { promptId: '', promptVersion: 2, simulated: true } as CharacterSheetOrigin;
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha(), origin: semPrompt }),
    ).rejects.toThrow(/procedência/i);

    const semSimulado = { promptId: 'identidade-personagem', promptVersion: 2 } as unknown as CharacterSheetOrigin;
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha(), origin: semSimulado }),
    ).rejects.toThrow(/procedência/i);
  });

  it('corta o que passa do teto e recusa o que o schema não permitiria', async () => {
    const criado = await api.saveCharacterDraft('luna', {
      proposal: ficha({
        tracos: Array.from({ length: 20 }, (_, index) => `traço ${index} ${'x'.repeat(120)}`),
      }),
      origin: ORIGEM,
    });

    expect(criado.sheet.tracos.length).toBeLessThanOrEqual(12);
    expect(criado.sheet.tracos.every((traco) => traco.length <= 80)).toBe(true);

    // Nome acima do teto do schema é **recusado**, não cortado: um nome cortado seria outro nome.
    await expect(
      api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'N'.repeat(200) }), origin: ORIGEM }),
    ).rejects.toThrow(/nome do personagem/i);
  });
});

describe('revisão da ficha (sheetVersion)', () => {
  // Os dois primeiros casos são puros (só a função de versão), mas os dois últimos gravam personagem
  // e por isso precisam do estado de exemplo limpo — sem isto eles herdam o `Bento` do teste anterior
  // deste mesmo arquivo e a numeração começa mais alta.
  beforeEach(() => {
    resetStore();
  });

  it('sobe de um em um', () => {
    expect(nextSheetVersion('v1')).toBe('v2');
    expect(nextSheetVersion('v4')).toBe('v5');
    expect(nextSheetVersion('v10')).toBe('v11');
  });

  it('recusa versão ilegível em vez de renumerar por conta própria', () => {
    // Renumerar em silêncio apagaria a diferença entre duas fichas: melhor recusar o refino.
    expect(() => nextSheetVersion('')).toThrow(/revisão nova/i);
    expect(() => nextSheetVersion('V4')).toThrow(/revisão nova/i);
    expect(() => nextSheetVersion('v0')).toThrow(/revisão nova/i);
    expect(() => nextSheetVersion('sheet-4')).toThrow(/revisão nova/i);
  });

  /*
   * Os dois casos abaixo vieram do `rebeca-qa` (`docs/qa/QA-015-fases-1-e-2.md`, achados 2 e 3). Ficam
   * aqui, e não só no arquivo dele, porque garantia que mora apenas no teste de quem revisa desaparece
   * no dia em que o arquivo da revisão sai.
   */

  it('a revisão sobe do TOPO da identidade — refinar versão substituída não reemite número vivo', async () => {
    const v1 = await api.saveCharacterDraft('luna', { proposal: ficha(), origin: ORIGEM });
    await api.approveCharacter('luna', v1.id);
    const v2 = await api.saveCharacterDraft('luna', {
      proposal: ficha({ seed: 2 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', v2.id);

    // Refinar a v1 (agora `substituido`) tem de produzir `v3`, e não repetir a `v2` viva.
    const reemissao = await api.saveCharacterDraft('luna', {
      proposal: ficha({ seed: 3 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    expect(reemissao.sheetVersion).toBe('v3');

    // Duas ramificações da mesma base também recebem rótulos diferentes.
    const ramoA = await api.saveCharacterDraft('luna', {
      proposal: ficha({ seed: 11 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    const ramoB = await api.saveCharacterDraft('luna', {
      proposal: ficha({ seed: 22 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    expect([ramoA.sheetVersion, ramoB.sheetVersion]).toEqual(['v4', 'v5']);

    // A promessa do ADR-015, verificada: **por nome**, cada rótulo aponta para UMA ficha.
    const versoes = (await api.getCharacters('luna'))
      .filter((character) => character.name === 'Bento')
      .map((character) => character.sheetVersion);
    expect(new Set(versoes).size).toBe(versoes.length);
  });

  /*
   * O limite que o ADR-015 **declara** (achado 2 do `docs/qa/QA-016-correcoes-fases-1-e-2.md`): a
   * vizinhança de identidade é de **um passo**, não o fecho transitivo. O teste fica aqui para que
   * mudar o cálculo obrigue a mudar o texto — e vice-versa. Se um dia o fecho for implementado, este
   * caso fica vermelho e o ADR tem de ser reescrito com ele.
   */
  it('a vizinhança de identidade é de um passo, não o fecho — o limite declarado no ADR-015', async () => {
    const a = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    // B nasce da linhagem de A, com outro nome.
    const b = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Pip', seed: 21 }),
      derivedFromId: a.id,
      origin: ORIGEM,
    });
    // C é criada do zero, com o nome de A.
    const c = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });

    expect([a.sheetVersion, b.sheetVersion, c.sheetVersion]).toEqual(['v1', 'v2', 'v2']);

    // B ~ A (linhagem) e A ~ C (nome), mas B e C não se olham: o rótulo sozinho NÃO identifica uma
    // ficha entre identidades diferentes — quem identifica é o par `id` + `sheetVersion`.
    expect(b.id).not.toBe(c.id);
    expect(b.sheetVersion).toBe(c.sheetVersion);
  });

  it('acento, caixa e separador não criam duas identidades canônicas', async () => {
    const primeiro = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', primeiro.id);

    // "Bentó" (acento) e "Ben  to" (separador interno) são o mesmo personagem que "Bento".
    const comAcento = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bentó', seed: 7 }),
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', comAcento.id);
    const espacado = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: '  Ben  to  ', seed: 9 }),
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', espacado.id);

    const lista = await api.getCharacters('luna');
    const bentosOficiais = lista.filter(
      (character) => character.status === 'oficial' && /^ben\s*to$/i.test(character.name),
    );
    expect(bentosOficiais.map((character) => character.id)).toEqual([espacado.id]);
    expect(lista.find((character) => character.id === primeiro.id)?.status).toBe('substituido');
    expect(lista.find((character) => character.id === comAcento.id)?.status).toBe('substituido');
  });
});
