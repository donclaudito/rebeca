/**
 * QA-015 — refutação independente da **Fase 1** (o ciclo do personagem).
 *
 * Escrito pelo `rebeca-qa`. Não corrige nada: cada teste abaixo existe para tentar **derrubar** uma
 * garantia que a entrega afirma, e o comentário de cada um diz se conseguiu ou não.
 *
 * Os alvos são os quatro que o próprio autor indicou:
 *   1. oficialidade única (dois `oficial` com o mesmo nome);
 *   2. o refino não edita — cria versão nova e a anterior vira `substituido`;
 *   3. isolamento por canal, na camada de dados;
 *   4. a IA nunca grava nem aprova.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetStore } from '@/data/client';
import type { CharacterProposal, CharacterSheetOrigin } from '@/data/types';

const ORIGEM: CharacterSheetOrigin = {
  promptId: 'identidade-personagem',
  promptVersion: 2,
  simulated: true,
};

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

const personagens = async (channelId: string) => api.getCharacters(channelId);
const oficiais = async (channelId: string) =>
  (await personagens(channelId)).filter((character) => character.status === 'oficial');

describe('QA Fase 1 — oficialidade única', () => {
  beforeEach(() => {
    resetStore();
  });

  it('tenta deixar DOIS oficiais com o mesmo nome pela via direta (criação do zero)', async () => {
    const primeiro = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', primeiro.id);

    // Segunda ficha, criada do zero (sem `derivedFromId`): linhagem diferente, MESMO nome.
    const segundo = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 999 }),
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', segundo.id);

    const bentos = (await personagens('luna')).filter(
      (character) => character.name === 'Bento' && character.status === 'oficial',
    );
    // NÃO consegui refutar: a substituição também casa por nome (`mesmaIdentidade`), não só por linhagem.
    expect(bentos).toHaveLength(1);
    expect(bentos[0]?.id).toBe(segundo.id);
  });

  it('tenta deixar dois oficiais com o mesmo nome por variação de caixa/espaço', async () => {
    const primeiro = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', primeiro.id);

    const variantes = ['BENTO', 'bento', '  Bento  '];
    for (const nome of variantes) {
      const outro = await api.saveCharacterDraft('luna', { proposal: ficha({ nome, seed: 1 }), origin: ORIGEM });
      await api.approveCharacter('luna', outro.id);
    }

    const oficiaisBento = (await personagens('luna')).filter(
      (character) => character.status === 'oficial' && character.name.toLowerCase() === 'bento',
    );
    // NÃO consegui refutar: caixa e espaço nas pontas colapsam em `normalizeSingleLine`/`mesmaIdentidade`.
    expect(oficiaisBento).toHaveLength(1);
  });

  it('CORRIGIDO: espaço INTERNO não cria uma segunda identidade canônica', async () => {
    const primeiro = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', primeiro.id);

    // "Ben  to" e "Bento" são a MESMA identidade desde a correção do achado 3: `identidadeDoNome` tira
    // separador, acento e caixa, e é a única regra de comparação de nome na camada de dados.
    const espacado = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Ben  to', seed: 5 }), origin: ORIGEM });
    await api.approveCharacter('luna', espacado.id);

    const oficiais = (await personagens('luna')).filter(
      (character) => character.status === 'oficial' && character.name.replace(/\s/g, '').toLowerCase() === 'bento',
    );
    // ASSERÇÃO INVERTIDA após a correção. A versão original deste teste (que documentava o defeito, com
    // `['Bento', 'Ben to']`) está registrada em docs/qa/QA-015-fases-1-e-2.md, achado 3.
    expect(oficiais.map((character) => character.name)).toEqual(['Ben to']);
    expect((await personagens('luna')).find((character) => character.id === primeiro.id)?.status).toBe(
      'substituido',
    );
  });

  it('CORRIGIDO: acento não separa identidades que o humano lê como o mesmo nome', async () => {
    const semAcento = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', semAcento.id);

    // O gerador de `id` sempre tirou o acento; agora a comparação de identidade tira também, pela
    // MESMA função — antes eram duas regras diferentes para a mesma pergunta.
    const comAcento = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bentó', seed: 7 }), origin: ORIGEM });
    await api.approveCharacter('luna', comAcento.id);

    const semDiacritico = (nome: string) => nome.normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const oficiaisBento = (await personagens('luna')).filter(
      (character) => character.status === 'oficial' && semDiacritico(character.name) === 'Bento',
    );
    // ASSERÇÃO INVERTIDA após a correção (achado 3 do QA-015): sobrou UMA identidade canônica — a
    // última aprovada — e a anterior virou `substituido`, em vez de as duas ficarem oficiais.
    expect(oficiaisBento.map((character) => character.name)).toEqual(['Bentó']);
    expect((await personagens('luna')).find((character) => character.id === semAcento.id)?.status).toBe(
      'substituido',
    );
    // O slug do id prova que o próprio código já tratava os dois nomes como o mesmo identificador.
    expect(comAcento.id.startsWith('luna-bento')).toBe(true);
  });

  it('a aprovação substitui DE FATO: nenhum consumidor que filtra `oficial` vê a versão antiga', async () => {
    const antes = (await personagens('luna')).find((character) => character.id === 'luna-hero');
    expect(antes?.status).toBe('oficial');

    const nova = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Luna', papel: 'Protagonista', seed: 1105 }),
      derivedFromId: 'luna-hero',
      origin: ORIGEM,
    });
    const { superseded } = await api.approveCharacter('luna', nova.id);

    expect(superseded.map((character) => character.id)).toEqual(['luna-hero']);
    // O filtro que a Revisão usa (`status === 'oficial'`) só encontra a versão nova.
    const oficiaisLuna = (await oficiais('luna')).filter((character) => character.name === 'Luna');
    expect(oficiaisLuna.map((character) => character.sheetVersion)).toEqual(['v5']);
    // E o substituto NÃO foi apagado: continua no canal, com a ficha que os episódios usaram.
    const aposentada = (await personagens('luna')).find((character) => character.id === 'luna-hero');
    expect(aposentada?.status).toBe('substituido');
    expect(aposentada?.sheet.descricaoVisual).toBe(antes?.sheet.descricaoVisual);
  });

  it('tenta ressuscitar a versão substituída (aprovar de novo / refinar por cima)', async () => {
    const v1 = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', v1.id);
    const v2 = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 2 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', v2.id);

    await expect(api.approveCharacter('luna', v1.id)).rejects.toThrow(/substituída/i);
    // NÃO consegui refutar: `substituido` é terminal no caminho de aprovação.
    const oficiaisBento = (await personagens('luna')).filter(
      (character) => character.name === 'Bento' && character.status === 'oficial',
    );
    expect(oficiaisBento.map((character) => character.sheetVersion)).toEqual(['v2']);
  });
});

describe('QA Fase 1 — o refino não edita a ficha existente', () => {
  beforeEach(() => {
    resetStore();
  });

  it('refinar cria versão nova e deixa a ficha de origem intacta', async () => {
    const base = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const derivada = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', descricaoVisual: ficha().descricaoVisual.replace('patas curtas', 'patas longas') }),
      derivedFromId: base.id,
      origin: ORIGEM,
    });

    expect(derivada.id).not.toBe(base.id);
    expect(derivada.sheetVersion).toBe('v2');
    const baseDepois = (await personagens('luna')).find((character) => character.id === base.id);
    expect(baseDepois?.sheet.descricaoVisual).toBe(base.sheet.descricaoVisual);
    expect(baseDepois?.status).toBe('rascunho');
  });

  it('CORRIGIDO: o número da revisão é único — refinar uma versão substituída sobe do TOPO da identidade', async () => {
    const v1 = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    await api.approveCharacter('luna', v1.id); // v1 é a OFICIAL
    const v2 = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 2 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', v2.id); // v2 assume; v1 vira `substituido`

    const v1Aposentada = (await personagens('luna')).find((character) => character.id === v1.id);
    expect(v1Aposentada?.status).toBe('substituido');

    // A tela oferece "Refinar" no cartão de uma versão `substituido`, e a camada de dados aceita:
    const reemissao = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 3 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });

    // ASSERÇÃO INVERTIDA após a correção (achado 2 do QA-015): a revisão sobe do **topo da identidade**
    // (`v2` viva), não da base (`v1`), então a ficha nova nasce `v3` em vez de reemitir o `v2`.
    expect(reemissao.sheetVersion).toBe('v3');
    expect(reemissao.id).not.toBe(v2.id);
    expect(reemissao.sheet.seed).not.toBe(v2.sheet.seed);

    const v2Vivas = (await personagens('luna')).filter(
      (character) => character.name === 'Bento' && character.sheetVersion === 'v2',
    );
    expect(v2Vivas).toHaveLength(1);

    /*
     * O que o ADR-015 promete — e o que ele **promete** é `sheetVersion` único **por nome**, não
     * "dentro de uma identidade" (a correção do achado 2 do QA-016 tirou a segunda frase, porque o
     * cálculo é vizinhança de um passo e não fecho transitivo). Aqui a asserção é exatamente o que a
     * frase corrigida diz, e é por isso que ela mede as versões **de um nome**.
     */
    const versoes = (await personagens('luna'))
      .filter((character) => character.name === 'Bento')
      .map((character) => character.sheetVersion);
    expect(new Set(versoes).size).toBe(versoes.length);
  });

  it('CORRIGIDO: duas ramificações do mesmo refino recebem números diferentes', async () => {
    const v1 = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const ramoA = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 11 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    const ramoB = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 22 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });

    // ASSERÇÃO INVERTIDA após a correção (achado 2): com o cálculo no topo da identidade, o segundo
    // ramo não reemite o rótulo do primeiro.
    expect([ramoA.sheetVersion, ramoB.sheetVersion]).toEqual(['v2', 'v3']);
    expect(ramoA.id).not.toBe(ramoB.id);
    // Nada foi apagado nem substituído — a diferença continua sendo a seed, e agora o rótulo separa
    // as duas: quem lê "o episódio usou a ficha v2" sabe qual das duas.
  });

  it('tenta provar que aprovar a reemissão deixa dois oficiais para trás', async () => {
    const v1 = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const v2 = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 2 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    await api.approveCharacter('luna', v2.id);

    const reemissao = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 3 }),
      derivedFromId: v1.id,
      origin: ORIGEM,
    });
    const { superseded } = await api.approveCharacter('luna', reemissao.id);

    // NÃO consegui refutar a oficialidade única: a versão viva foi substituída, mesmo com o número igual.
    expect(superseded.map((character) => character.id)).toEqual([v2.id]);
    const oficiaisBento = (await personagens('luna')).filter(
      (character) => character.name === 'Bento' && character.status === 'oficial',
    );
    expect(oficiaisBento.map((character) => character.id)).toEqual([reemissao.id]);
  });
});

describe('QA Fase 1 — isolamento por canal na camada de dados', () => {
  beforeEach(() => {
    resetStore();
  });

  it('tenta vazar personagem de um canal para outro por cada porta da API', async () => {
    const criado = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Só da Luna' }), origin: ORIGEM });

    // 1. leitura cruzada
    for (const outro of ['arquivo', 'aims']) {
      const lista = await personagens(outro);
      expect(lista.some((character) => character.id === criado.id)).toBe(false);
      expect(lista.some((character) => character.name === 'Só da Luna')).toBe(false);
    }
    // 2. aprovação cruzada
    await expect(api.approveCharacter('arquivo', criado.id)).rejects.toThrow('Personagem não encontrado neste canal.');
    // 3. refino cruzado
    await expect(
      api.saveCharacterDraft('arquivo', {
        proposal: ficha({ nome: 'Intruso' }),
        derivedFromId: criado.id,
        origin: ORIGEM,
      }),
    ).rejects.toThrow('Personagem não encontrado neste canal.');
    // NADA foi criado no canal alvo pelas tentativas recusadas.
    expect((await personagens('arquivo')).some((character) => character.name === 'Intruso')).toBe(false);
  });

  it('tenta fazer a aprovação de um canal derrubar a ficha oficial de outro canal com o mesmo nome', async () => {
    const antesArquivo = await oficiais('arquivo');
    expect(antesArquivo.map((character) => character.id)).toContain('arq-host');

    // "Narrador do Arquivo" é oficial no canal `arquivo`; cria e aprova o MESMO nome no canal `luna`.
    const doLuna = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Narrador do Arquivo' }),
      origin: ORIGEM,
    });
    const { superseded } = await api.approveCharacter('luna', doLuna.id);

    // NÃO consegui refutar: a substituição é escopada pelo canal.
    expect(superseded).toEqual([]);
    expect((await oficiais('arquivo')).map((character) => character.id)).toContain('arq-host');
    // E a Luna tem o seu, oficial e próprio.
    const lunaOficiais = (await personagens('luna')).filter((character) => character.id === doLuna.id);
    expect(lunaOficiais[0]?.status).toBe('oficial');
    expect(lunaOficiais[0]?.channelId).toBe('luna');
  });

  it('tenta forjar o canal/versão/status pela proposta (resposta de IA é dado externo)', async () => {
    const forjada = {
      ...ficha({ nome: 'Forjado' }),
      id: 'arq-host',
      channelId: 'arquivo',
      sheetVersion: 'v99',
      status: 'oficial',
      approvedAt: '1999-01-01T00:00:00.000Z',
      derivedFromId: 'luna-hero',
    } as unknown as CharacterProposal;

    const criado = await api.saveCharacterDraft('luna', { proposal: forjada, origin: ORIGEM });

    // NÃO consegui refutar: a proposta é lida campo a campo, e o resto é descartado.
    expect(criado.id).not.toBe('arq-host');
    expect(criado.channelId).toBe('luna');
    expect(criado.sheetVersion).toBe('v1');
    expect(criado.status).toBe('rascunho');
    expect(criado.approvedAt).toBeUndefined();
    expect(criado.derivedFromId).toBeNull();
    // O personagem de `arquivo` continua oficial no canal dele — nada vazou para lá.
    expect((await personagens('luna')).find((character) => character.id === 'arq-host')).toBeUndefined();
    expect((await oficiais('arquivo')).some((character) => character.id === 'arq-host')).toBe(true);
  });
});

describe('QA Fase 1 — a IA nunca grava nem aprova', () => {
  beforeEach(() => {
    resetStore();
  });

  it('nenhum método exportado da camada de dados leva uma ficha a `oficial` sem `approveCharacter`', async () => {
    const antes = await personagens('luna');
    const nomesDeMetodos = Object.keys(api);
    // A camada de dados não expõe criação direta de personagem nem mudança de status: só o par
    // `saveCharacterDraft`/`approveCharacter`. Este teste trava a superfície contra um atalho futuro.
    expect(nomesDeMetodos).not.toContain('createCharacter');
    expect(nomesDeMetodos).not.toContain('setCharacterStatus');
    expect(nomesDeMetodos).not.toContain('approveCharacterWithoutReview');

    const criado = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const depoisDeGravar = await personagens('luna');
    expect(depoisDeGravar).toHaveLength(antes.length + 1);
    expect(depoisDeGravar.filter((character) => character.status === 'oficial')).toHaveLength(
      antes.filter((character) => character.status === 'oficial').length,
    );
    expect(criado.status).toBe('rascunho');
  });

  it('a proposta com `origin.simulated` mentiroso continua sendo rascunho — procedência não promove', async () => {
    const criado = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento' }),
      origin: { promptId: 'identidade-personagem', promptVersion: 2, simulated: false },
    });
    expect(criado.sheetOrigin.simulated).toBe(false);
    expect(criado.status).toBe('rascunho');
  });
});

/* =============================================================================
   QA-016 — a redação NOVA do ADR-015 ("sheetVersion único dentro da identidade")
   ============================================================================= */

describe('QA Fase 1 — a nova redação do ADR-015 bate com o código?', () => {
  beforeEach(() => {
    resetStore();
  });

  const versoesDe = async (channelId: string, nome: string) =>
    (await personagens(channelId))
      .filter((character) => character.name === nome)
      .map((character) => character.sheetVersion);

  it('CONFIRMADO: dentro de um MESMO nome, a revisão nunca se repete (varredura de 12 fichas)', async () => {
    const raiz = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    let base: string | null = raiz.id;
    // Doze passos alternando refino da ficha mais recente e refino da raiz já aposentada — o caminho que
    // reemitiu `v2` na primeira rodada.
    for (let passo = 0; passo < 12; passo += 1) {
      const alvo = (await personagens('luna'))
        .filter((character) => character.name === 'Bento')
        .at(passo % 2 === 0 ? -1 : 0);
      const nova = await api.saveCharacterDraft('luna', {
        proposal: ficha({ nome: 'Bento', seed: 100 + passo }),
        derivedFromId: alvo?.id ?? null,
        origin: ORIGEM,
      });
      if (passo === 0) await api.approveCharacter('luna', nova.id);
      base = nova.id;
    }
    expect(base).not.toBeNull();

    const versoes = await versoesDe('luna', 'Bento');
    expect(versoes.length).toBeGreaterThanOrEqual(13);
    expect(new Set(versoes).size).toBe(versoes.length);
  });

  it('CONFIRMADO: entre identidades DIFERENTES o número coincide — o limite que o ADR declara', async () => {
    const um = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const outro = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Nino' }), origin: ORIGEM });
    // Cada personagem novo começa em `v1`: é exatamente o que a seção "Limite declarado" admite.
    expect(um.sheetVersion).toBe('v1');
    expect(outro.sheetVersion).toBe('v1');
  });

  it('REFUTADO (novo): a identidade do cálculo NÃO é fechada — renomear cria duas fichas no mesmo número', async () => {
    /*
     * O ADR-015 (redação nova) define: *"Identidade aqui é o nome normalizado MAIS a linhagem da base"* e
     * promete `sheetVersion` **único dentro de uma identidade do canal**. Lido como a união das duas
     * relações — que é o que a frase diz —, a identidade é o fecho transitivo, e o código **não** o
     * calcula: `proximaVersaoDaIdentidade` olha só `(mesmo nome) ∪ (linhagem da MINHA base)`.
     *
     * Reprodução: A("Bento") → refino renomeado B("Tico", linhagem de A) → e uma ficha NOVA "Bento"
     * criada do zero. B e C ficam com o MESMO número, e pertencem ao mesmo conjunto fechado: B ~ A
     * (linhagem) e A ~ C (nome).
     */
    const a = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const b = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Pip', seed: 11 }),
      derivedFromId: a.id,
      origin: ORIGEM,
    });
    const c = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento', seed: 22 }), origin: ORIGEM });

    // B nasceu da linhagem de A (que é v1) e C nasceu do zero casando pelo nome com A (que é v1):
    expect(Number.parseInt(a.sheetVersion.slice(1), 10)).toBe(1);
    expect(b.sheetVersion).toBe('v2');
    expect(c.sheetVersion).toBe('v2');
    expect(b.id).not.toBe(c.id);
    // A leitura literal do ADR ("nome MAIS linhagem") põe B e C na MESMA identidade — e os dois são `v2`.
    // A chave `id` + `sheetVersion` continua desambiguando, mas a frase "único dentro da identidade" só é
    // verdadeira na leitura por NOME; falta a palavra "por nome" (ou o fecho transitivo no código).
  });

  it('CONFIRMADO: dentro da LINHAGEM o número sobe mesmo com renomeação (o caso que eu esperava derrubar)', async () => {
    /*
     * Segunda metade da frase do ADR: "único e **crescente** dentro de uma identidade". Esta era a minha
     * aposta de refutação — renomear a ficha no meio do caminho faria a identidade por NOME reiniciar a
     * contagem. Não se sustenta: o cálculo também inclui a linhagem da base, então a linhagem A→B→C fica
     * v1, v2, v3.
     */
    const a = await api.saveCharacterDraft('luna', { proposal: ficha({ nome: 'Bento' }), origin: ORIGEM });
    const b = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Pip', seed: 11 }),
      derivedFromId: a.id,
      origin: ORIGEM,
    });
    const c = await api.saveCharacterDraft('luna', {
      proposal: ficha({ nome: 'Bento', seed: 33 }),
      derivedFromId: b.id,
      origin: ORIGEM,
    });

    expect([a.sheetVersion, b.sheetVersion, c.sheetVersion]).toEqual(['v1', 'v2', 'v3']);
    expect(c.derivedFromId).toBe(b.id);
  });
});
