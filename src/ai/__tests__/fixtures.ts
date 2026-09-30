/**
 * Entradas válidas de cada função de IA — usadas pelos testes.
 *
 * Ficam em arquivo próprio (e não copiadas em cada teste) porque a lista de funções vai crescer, e
 * entrada duplicada em três testes é garantia de que um deles vai ficar para trás sem ninguém notar.
 * O teste `simulado.test.ts` percorre **todas** as funções do registro e falha se alguma não tiver
 * fixture — assim não existe função nova sem prova de que ela responde no contrato.
 */

import type { AiFunctionId } from '../contract';

export const CHANNEL_CHILD = 'luna';
export const CHANNEL_ADULT = 'arquivo';

type Input = Record<string, unknown>;

const FIXTURES: Record<AiFunctionId, Input> = {
  'pesquisar-tendencia': {
    niche: 'Animação educativa para crianças de 3 a 5 anos',
    audience: 'Pais e responsáveis que colocam vídeo curto para criança pequena',
    recentThemes: ['borboletas', 'cores'],
    rejectedThemes: ['dinossauros assustadores'],
  },

  'planejar-pauta': {
    niche: 'Animação educativa para crianças de 3 a 5 anos',
    audience: 'Pais e responsáveis',
    weekStart: '2026-09-28',
    historico: ['Luna e as Borboletas Coloridas', 'Luna e o Cachorro'],
    temasFortes: ['cores', 'animais'],
    videosPorSemana: 4,
  },

  'criar-roteiro': {
    tema: 'Luna e as Borboletas Coloridas',
    angulo: 'Cada borboleta traz uma cor e a Luna aprende a nomear',
    gancho: 'Uma borboleta azul pousa no nariz da Luna.',
    formato: 'video',
    duracaoSeg: 300,
    idadeAlvo: '3 a 5 anos',
    personagens: ['Luna', 'Tico'],
    valores: ['amizade', 'curiosidade'],
  },

  'criar-cena': {
    tema: 'Luna e as Borboletas Coloridas',
    formato: 'video',
    personagens: ['Luna'],
    estiloVisual: 'flat 2D children animation, soft shapes',
    blocos: [
      { ordem: 1, narracao: 'A Luna chega ao jardim.', acao: 'Luna entra em cena.' },
      { ordem: 2, narracao: 'Uma borboleta pousa.', acao: 'A borboleta pousa no nariz.' },
      { ordem: 3, narracao: 'Ela conta as cores.', acao: 'Luna aponta para cada cor.' },
    ],
  },

  'criar-thumbnail': {
    tema: 'Luna e as Borboletas Coloridas',
    titulo: 'Luna e as Borboletas Coloridas',
    personagemPrincipal: 'Luna',
    paleta: ['#F472B6', '#FBBF24', '#34D399'],
    estilo: 'flat 2D children illustration',
  },

  'criar-seo': {
    titulo: 'Luna e as Borboletas Coloridas',
    tema: 'cores',
    roteiroResumo: 'A Luna encontra borboletas de várias cores no jardim e aprende a nomeá-las.',
    canalNome: 'Luna e o Jardim das Cores',
    publico: 'Crianças de 3 a 5 anos',
  },

  'revisar-qualidade': {
    titulo: 'Luna e as Borboletas Coloridas',
    roteiroResumo: 'A Luna encontra borboletas de várias cores e aprende a nomeá-las no jardim.',
    formato: 'video',
    idadeAlvo: '3 a 5 anos',
  },

  'revisar-infantil': {
    titulo: 'Luna e as Borboletas Coloridas',
    roteiroResumo: 'A Luna encontra borboletas de várias cores e aprende a nomeá-las no jardim.',
    idadeAlvo: '3 a 5 anos',
  },

  'agendar-horario': {
    publico: 'Pais e responsáveis',
    fusoHorario: 'America/Sao_Paulo',
    formato: 'video',
    historicoHorarios: [
      { horario: '2026-09-01T17:00:00-03:00', retencaoPct: 62 },
      { horario: '2026-09-04T17:00:00-03:00', retencaoPct: 58 },
      { horario: '2026-09-08T19:00:00-03:00', retencaoPct: 44 },
    ],
  },

  'medir-analise': {
    titulo: 'Luna e as Borboletas Coloridas',
    formato: 'video',
    views: 250000,
    ctrPct: 6.4,
    retencaoPct: 51,
    watchHours: 18200,
    receitaBrl: 5940,
    custoUsd: 80,
    cambioBrlPorUsd: 5.4,
    mediaCanal: { views: 180000, ctrPct: 5.1, retencaoPct: 46 },
  },

  'aprender-insight': {
    canalNome: 'Luna e o Jardim das Cores',
    itens: [
      { titulo: 'Luna e as Borboletas Coloridas', tema: 'cores', formato: 'video', duracaoSeg: 300, horario: '17:00', ctrPct: 6.4, retencaoPct: 51, views: 250000 },
      { titulo: 'Luna e o Cachorro', tema: 'animais', formato: 'video', duracaoSeg: 280, horario: '17:00', ctrPct: 5.9, retencaoPct: 48, views: 210000 },
      { titulo: 'Luna e a Abelhinha', tema: 'animais', formato: 'short', duracaoSeg: 45, horario: '12:00', ctrPct: 4.2, retencaoPct: 39, views: 90000 },
    ],
    rejeicoes: ['ritmo lento demais para 3 a 5 anos'],
  },

  'melhorar-plano': {
    canalNome: 'Luna e o Jardim das Cores',
    padroes: ['Abertura com ação retém mais'],
    pautaAtual: ['cores', 'animais'],
    temasSaturados: ['dinossauros'],
    rejeicoes: ['ritmo lento demais'],
  },

  'identidade-personagem': {
    pedido: 'Quero um cachorro pequeno, divertido e curioso para ser amigo da Luna, com orelhas maiores e sem coleira.',
    canalNome: 'Luna e o Jardim das Cores',
    personagensExistentes: ['Luna'],
    paleta: ['#F472B6', '#FBBF24'],
    estiloVisual: 'flat 2D children illustration',
  },

  'monetizacao-veredito': {
    titulo: 'Luna e as Borboletas Coloridas',
    custoProducaoUsd: 80,
    receitaBrl: 5940,
    views: 250000,
    cambioBrlPorUsd: 5.4,
    mediaCustoUsdCanal: 60,
  },

  'marketing-derivados': {
    titulo: 'Luna e as Borboletas Coloridas',
    tema: 'cores',
    personagem: 'Luna',
    canalNome: 'Luna e o Jardim das Cores',
    tom: 'alegre e calmo',
    idadeAlvo: '3 a 5 anos',
  },
};

/** Entrada válida para a função. A cópia evita que um teste contamine o outro. */
export function validInput(functionId: AiFunctionId): Input {
  const fixture = FIXTURES[functionId];
  if (!fixture) throw new Error(`Sem fixture para a função "${functionId}" — acrescente uma.`);
  return structuredClone(fixture);
}

export function allFunctionIds(): AiFunctionId[] {
  return Object.keys(FIXTURES) as AiFunctionId[];
}
