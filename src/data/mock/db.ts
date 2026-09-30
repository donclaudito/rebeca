/**
 * =============================================================================
 * DADOS DE EXEMPLO — protótipo, não é dado real de canal nenhum.
 * =============================================================================
 *
 * Este arquivo é o "banco" do protótipo: existe para o dono do produto ver a cara e o fluxo antes
 * de existir backend. Tudo aqui é fictício e a interface marca isso com a faixa "dados de exemplo".
 *
 * Quando o backend real existir, este arquivo morre e `src/data/client.ts` passa a chamar a API —
 * sem que nenhum componente mude.
 *
 * REGRA: todo registro carrega `channelId`. Nenhum dado "global" de conteúdo.
 */

import { atTime, currentWeek, toIsoDate } from '@/lib/date';
import type {
  BrandKit,
  Channel,
  ChannelKpis,
  Character,
  ContentItem,
  ModuleState,
  Recommendation,
} from '../types';

/** Segunda a domingo da semana corrente. */
const WEEK = currentWeek();
/** A semana anterior, usada para o que já foi publicado. */
const PREV_WEEK = currentWeek(new Date(Date.now() - 7 * 86_400_000));

const day = (week: Date[], index: number, hours: number, minutes = 0): string =>
  atTime(week[index] ?? new Date(), hours, minutes).toISOString();

const iso = (week: Date[], index: number): string => toIsoDate(week[index] ?? new Date());

/* =============================================================================
   Canais
   ============================================================================= */

export const channels: Channel[] = [
  {
    id: 'luna',
    name: 'Luna e o Jardim das Cores',
    kind: 'Canal Infantil',
    niche: 'Animação educativa para crianças de 3 a 5 anos',
    language: 'Português (Brasil)',
    subscribers: 723_000,
    totalViews: 123_000_000,
    initials: 'LJ',
    tone: 'pink',
    connected: true,
  },
  {
    id: 'arquivo',
    name: 'Arquivo Curioso',
    kind: 'Canal de Curiosidades',
    niche: 'Ciência e curiosidades em formato longo',
    language: 'Português (Brasil)',
    subscribers: 482_000,
    totalViews: 61_400_000,
    initials: 'AC',
    tone: 'amber',
    connected: true,
  },
  {
    id: 'aims',
    name: 'AI Made Simple',
    kind: 'Canal de Tecnologia',
    niche: 'Inteligência artificial explicada para não especialistas',
    language: 'Português (Brasil)',
    subscribers: 701_000,
    totalViews: 88_200_000,
    initials: 'AI',
    tone: 'cyan',
    connected: true,
  },
];

/* =============================================================================
   KPIs — sempre com período explícito (28 dias)
   ============================================================================= */

export const kpis: ChannelKpis[] = [
  {
    channelId: 'luna',
    periodDays: 28,
    views: 4_800_000,
    viewsDeltaPct: 12,
    revenueBrl: 2_450,
    revenueDeltaPct: 31,
    published: 7,
    publishedDeltaPct: 3,
    watchHours: 21_400,
    ctrPct: 6.4,
    rpmBrl: 0.51,
    productionCostUsd: 318.4,
    updatedAt: day(WEEK, 0, 6, 0),
  },
  {
    channelId: 'arquivo',
    periodDays: 28,
    views: 1_950_000,
    viewsDeltaPct: 4,
    revenueBrl: 3_180,
    revenueDeltaPct: 8,
    published: 5,
    publishedDeltaPct: -2,
    watchHours: 38_900,
    ctrPct: 4.1,
    rpmBrl: 1.63,
    productionCostUsd: 512.9,
    updatedAt: day(WEEK, 0, 6, 5),
  },
  {
    channelId: 'aims',
    periodDays: 28,
    views: 2_640_000,
    viewsDeltaPct: 21,
    revenueBrl: 1_720,
    revenueDeltaPct: 14,
    published: 9,
    publishedDeltaPct: 5,
    watchHours: 12_600,
    ctrPct: 5.2,
    rpmBrl: 0.65,
    productionCostUsd: 204.15,
    updatedAt: day(WEEK, 0, 6, 12),
  },
];

/* =============================================================================
   Conteúdos
   ============================================================================= */

export const contents: ContentItem[] = [
  /* ---------------------------------------------------------------- Luna -- */
  {
    id: 'luna-borboletas',
    channelId: 'luna',
    title: 'Luna e as Borboletas Coloridas',
    hook: 'Uma borboleta pousa no nariz da Luna e ela descobre que cada cor tem um som.',
    format: 'video',
    durationSec: 492,
    status: 'revisao',
    theme: 'Borboletas e cores',
    stage: 'revisar',
    scheduledAt: day(WEEK, 0, 17, 0),
    publishedAt: null,
    seo: {
      title: 'Luna e as Borboletas Coloridas 🦋 | Aventura das Cores',
      description:
        'A Luna encontra borboletas de todas as cores no Jardim e aprende que cada cor tem um som diferente. Episódio educativo para crianças de 3 a 5 anos.',
      tags: ['luna', 'borboletas', 'cores', 'infantil', 'educativo'],
    },
    thumbnails: [
      { id: 't1', label: 'Borboleta grande', alt: 'Luna sorrindo com uma borboleta azul grande na frente do rosto', suggested: true },
      { id: 't2', label: 'Luna em close', alt: 'Rosto da Luna em close, olhando surpresa para a câmera', suggested: false },
      { id: 't3', label: 'Jardim inteiro', alt: 'Luna no meio do jardim colorido com várias borboletas ao redor', suggested: false },
      { id: 't4', label: 'Contagem 1-2-3', alt: 'Luna contando nos dedos com números grandes na tela', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 42.8,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'luna-cachorro',
    channelId: 'luna',
    title: 'Luna e o Cachorro Curioso',
    hook: 'Um cachorrinho novo chega ao Jardim e a Luna ensina como fazer amigos.',
    format: 'video',
    durationSec: 465,
    status: 'revisao',
    theme: 'Amizade e animais',
    stage: 'revisar',
    scheduledAt: day(WEEK, 3, 17, 0),
    publishedAt: null,
    seo: {
      title: 'Luna e o Cachorro Curioso 🐶 | Como fazer amigos',
      description:
        'Um cachorrinho curioso chega ao Jardim das Cores e a Luna mostra que fazer amigos começa com um "oi".',
      tags: ['luna', 'cachorro', 'amizade', 'infantil'],
    },
    thumbnails: [
      { id: 't1', label: 'Luna e o cachorro', alt: 'Luna abraçando um cachorro pequeno e branco', suggested: true },
      { id: 't2', label: 'Cachorro sozinho', alt: 'Cachorro pequeno sentado sozinho no jardim', suggested: false },
      { id: 't3', label: 'Coração na tela', alt: 'Luna e o cachorro com um coração grande desenhado entre eles', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 39.1,
    metrics: null,
    rejectedReason: 'Ritmo um pouco lento no primeiro minuto',
  },
  {
    id: 'luna-abelhinha',
    channelId: 'luna',
    title: 'Luna e a Abelhinha Amiga',
    hook: 'Shorts de 30 segundos: a abelhinha mostra por que as flores precisam dela.',
    format: 'short',
    durationSec: 32,
    status: 'aprovado',
    theme: 'Borboletas e cores',
    stage: 'aprovar',
    scheduledAt: day(WEEK, 1, 12, 0),
    publishedAt: null,
    seo: {
      title: 'Luna e a Abelhinha Amiga 🐝 #shorts',
      description: 'Um minuto no Jardim das Cores para descobrir o que a abelhinha faz.',
      tags: ['luna', 'abelha', 'shorts', 'infantil'],
    },
    thumbnails: [
      { id: 't1', label: 'Abelhinha em close', alt: 'Abelhinha amarela sorrindo com a Luna ao fundo', suggested: true },
      { id: 't2', label: 'Flor gigante', alt: 'Flor gigante com a abelhinha pousada', suggested: false },
    ],
    selectedThumbnailId: 't1',
    costUsd: 8.4,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'luna-estrelas',
    channelId: 'luna',
    title: 'Luna e o Jardim das Estrelas',
    hook: 'A Luna descobre que as estrelas também têm cores.',
    format: 'video',
    durationSec: 508,
    status: 'publicado',
    theme: 'Céu e estrelas',
    stage: 'medir',
    scheduledAt: day(PREV_WEEK, 4, 17, 0),
    publishedAt: day(PREV_WEEK, 4, 17, 0),
    seo: {
      title: 'Luna e o Jardim das Estrelas ⭐ | As cores do céu',
      description: 'A Luna olha o céu e aprende que cada estrela tem uma cor diferente.',
      tags: ['luna', 'estrelas', 'cores', 'infantil'],
    },
    thumbnails: [
      { id: 't1', label: 'Luna olhando o céu', alt: 'Luna deitada na grama olhando estrelas coloridas', suggested: true },
      { id: 't2', label: 'Estrela gigante', alt: 'Estrela amarela gigante com a Luna pequena ao lado', suggested: false },
    ],
    selectedThumbnailId: 't1',
    costUsd: 44.2,
    metrics: {
      views: 312_400,
      impressions: 4_120_000,
      ctrPct: 7.6,
      retentionPct: 54,
      watchHours: 4_780,
      revenueBrl: 168,
      vsChannelAvgPct: 42,
      measuredAt: day(WEEK, 0, 6, 0),
    },
    rejectedReason: null,
  },
  {
    id: 'luna-frutas',
    channelId: 'luna',
    title: 'Luna e as Frutas Falantes',
    hook: 'As frutas do Jardim ganham voz e ensinam os nomes.',
    format: 'video',
    durationSec: 402,
    status: 'revisao',
    theme: 'Frutas e nomes',
    stage: 'revisar',
    scheduledAt: null,
    publishedAt: null,
    seo: {
      title: 'Luna e as Frutas Falantes 🍎 | Aprender os nomes',
      description: 'Cada fruta do Jardim fala o próprio nome e a Luna repete junto.',
      tags: ['luna', 'frutas', 'nomes', 'infantil'],
    },
    thumbnails: [
      { id: 't1', label: 'Maçã falante', alt: 'Maçã vermelha com olhinhos, ao lado da Luna', suggested: true },
      { id: 't2', label: 'Cesta de frutas', alt: 'Cesta cheia de frutas coloridas no jardim', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 37.6,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'luna-chuva',
    channelId: 'luna',
    title: 'Luna e o Dia de Chuva',
    hook: 'Shorts: o que fazer quando a chuva chega no Jardim.',
    format: 'short',
    durationSec: 29,
    status: 'gerando',
    theme: 'Clima e estações',
    stage: 'criar',
    scheduledAt: null,
    publishedAt: null,
    seo: {
      title: 'Luna e o Dia de Chuva 🌧️ #shorts',
      description: 'A chuva chega no Jardim das Cores e a Luna encontra uma brincadeira nova.',
      tags: ['luna', 'chuva', 'shorts', 'infantil'],
    },
    thumbnails: [],
    selectedThumbnailId: null,
    costUsd: 0,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'luna-arcoiris',
    channelId: 'luna',
    title: 'Luna ensina as cores do arco-íris',
    hook: 'Sete cores, sete paradas no Jardim.',
    format: 'short',
    durationSec: 34,
    status: 'agendado',
    theme: 'Borboletas e cores',
    stage: 'agendar',
    scheduledAt: day(WEEK, 2, 12, 0),
    publishedAt: null,
    seo: {
      title: 'Luna ensina as cores do arco-íris 🌈 #shorts',
      description: 'Um passeio curto pelas sete cores do arco-íris com a Luna.',
      tags: ['luna', 'arco-iris', 'cores', 'shorts'],
    },
    thumbnails: [
      { id: 't1', label: 'Arco-íris inteiro', alt: 'Arco-íris completo sobre o jardim com a Luna embaixo', suggested: true },
    ],
    selectedThumbnailId: 't1',
    costUsd: 9.1,
    metrics: null,
    rejectedReason: null,
  },

  /* ------------------------------------------------------------- Arquivo -- */
  {
    id: 'arq-ceu-laranja',
    channelId: 'arquivo',
    title: 'Por que o céu fica laranja no fim da tarde?',
    hook: 'A resposta está no tamanho das ondas de luz — e no caminho que elas fazem.',
    format: 'video',
    durationSec: 742,
    status: 'revisao',
    theme: 'Física do dia a dia',
    stage: 'revisar',
    scheduledAt: day(WEEK, 2, 19, 0),
    publishedAt: null,
    seo: {
      title: 'Por que o céu fica laranja no fim da tarde?',
      description:
        'Dispersão de Rayleigh explicada sem fórmula: por que o azul do meio-dia vira laranja no pôr do sol.',
      tags: ['dispersão', 'luz', 'pôr do sol', 'física'],
    },
    thumbnails: [
      { id: 't1', label: 'Sol dividindo a luz', alt: 'Sol no horizonte com um feixe de luz se dividindo em cores', suggested: true },
      { id: 't2', label: 'Comparação lado a lado', alt: 'Metade da imagem com céu azul e metade com céu laranja', suggested: false },
      { id: 't3', label: 'Terra e atmosfera', alt: 'Ilustração da Terra com a atmosfera destacada', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 61.3,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'arq-antes-big-bang',
    channelId: 'arquivo',
    title: 'O que existia antes do Big Bang?',
    hook: 'A pergunta não tem resposta simples — e isso é a parte interessante.',
    format: 'video',
    durationSec: 968,
    status: 'revisao',
    theme: 'Cosmologia',
    stage: 'revisar',
    scheduledAt: null,
    publishedAt: null,
    seo: {
      title: 'O que existia antes do Big Bang? | Arquivo Curioso',
      description: 'Tempo, espaço e a pergunta que a física ainda não consegue responder por completo.',
      tags: ['big bang', 'cosmologia', 'universo', 'tempo'],
    },
    thumbnails: [
      { id: 't1', label: 'Ponto de luz', alt: 'Ponto de luz minúsculo em fundo totalmente preto', suggested: true },
      { id: 't2', label: 'Relógio derretendo', alt: 'Relógio derretendo sobre um fundo de galáxias', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 74.9,
    metrics: null,
    rejectedReason: 'Thumbnail anterior não deixou claro que é ciência',
  },
  {
    id: 'arq-formigas',
    channelId: 'arquivo',
    title: 'As formigas contam os próprios passos',
    hook: 'Elas literalmente medem a distância andando.',
    format: 'short',
    durationSec: 47,
    status: 'agendado',
    theme: 'Biologia',
    stage: 'agendar',
    scheduledAt: day(WEEK, 4, 18, 30),
    publishedAt: null,
    seo: {
      title: 'As formigas contam os próprios passos 🐜',
      description: 'Como as formigas do deserto voltam para casa em linha reta.',
      tags: ['formigas', 'biologia', 'curiosidades'],
    },
    thumbnails: [
      { id: 't1', label: 'Formiga com trilha', alt: 'Formiga seguindo uma trilha pontilhada no deserto', suggested: true },
    ],
    selectedThumbnailId: 't1',
    costUsd: 6.8,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'arq-gelo-quente',
    channelId: 'arquivo',
    title: 'Por que o gelo quente existe?',
    hook: 'Água quente congela mais rápido que a fria — e ninguém sabe explicar direito.',
    format: 'video',
    durationSec: 806,
    status: 'publicado',
    theme: 'Física do dia a dia',
    stage: 'medir',
    scheduledAt: day(PREV_WEEK, 2, 19, 0),
    publishedAt: day(PREV_WEEK, 2, 19, 0),
    seo: {
      title: 'Por que o gelo quente existe? | Efeito Mpemba',
      description: 'O efeito Mpemba: quando a água quente congela antes da fria.',
      tags: ['mpemba', 'gelo', 'física', 'curiosidades'],
    },
    thumbnails: [
      { id: 't1', label: 'Dois copos', alt: 'Dois copos, um fumegando e outro já congelado', suggested: false },
    ],
    selectedThumbnailId: 't1',
    costUsd: 58.2,
    metrics: {
      views: 96_800,
      impressions: 2_310_000,
      ctrPct: 4.0,
      retentionPct: 38,
      watchHours: 1_290,
      revenueBrl: 141,
      vsChannelAvgPct: -8,
      measuredAt: day(WEEK, 0, 6, 5),
    },
    rejectedReason: null,
  },
  {
    id: 'arq-sono',
    channelId: 'arquivo',
    title: 'Por que bocejamos quando alguém boceja?',
    hook: 'Contágio não é o que os livros diziam.',
    format: 'short',
    durationSec: 41,
    status: 'falhou',
    theme: 'Biologia',
    stage: 'criar',
    scheduledAt: null,
    publishedAt: null,
    seo: {
      title: 'Por que bocejamos quando alguém boceja? 🥱',
      description: 'A explicação do contágio do bocejo mudou nos últimos anos.',
      tags: ['bocejo', 'cérebro', 'curiosidades'],
    },
    thumbnails: [],
    selectedThumbnailId: null,
    costUsd: 4.2,
    metrics: null,
    rejectedReason: null,
  },

  /* ---------------------------------------------------------------- AIMS -- */
  {
    id: 'aims-llm',
    channelId: 'aims',
    title: 'O que é um modelo de linguagem, sem enrolação',
    hook: 'Ele não "sabe" nada: ele prevê a próxima palavra muito bem.',
    format: 'video',
    durationSec: 634,
    status: 'revisao',
    theme: 'Fundamentos de IA',
    stage: 'revisar',
    scheduledAt: day(WEEK, 1, 20, 0),
    publishedAt: null,
    seo: {
      title: 'O que é um modelo de linguagem, sem enrolação',
      description: 'Previsão da próxima palavra, tokens e por que isso parece inteligência.',
      tags: ['llm', 'ia', 'modelo de linguagem', 'iniciantes'],
    },
    thumbnails: [
      { id: 't1', label: 'Palavras em cascata', alt: 'Palavras caindo em cascata até formar uma frase', suggested: true },
      { id: 't2', label: 'Cérebro e chip', alt: 'Metade cérebro, metade chip de computador', suggested: false },
      { id: 't3', label: 'Autocomplete gigante', alt: 'Barra de autocomplete gigante ocupando a tela', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 33.5,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'aims-prompt',
    channelId: 'aims',
    title: '3 erros que fazem sua IA responder mal',
    hook: 'Contexto, formato e exemplo — nessa ordem.',
    format: 'video',
    durationSec: 588,
    status: 'aprovado',
    theme: 'Prática com IA',
    stage: 'aprovar',
    scheduledAt: day(WEEK, 5, 20, 0),
    publishedAt: null,
    seo: {
      title: '3 erros que fazem sua IA responder mal',
      description: 'Contexto, formato de saída e exemplo: o que muda a qualidade da resposta.',
      tags: ['prompt', 'ia', 'produtividade'],
    },
    thumbnails: [
      { id: 't1', label: '3 erros numerados', alt: 'Números 1, 2 e 3 grandes com um X vermelho sobre cada um', suggested: true },
      { id: 't2', label: 'Antes e depois', alt: 'Tela dividida com resposta ruim à esquerda e boa à direita', suggested: false },
    ],
    selectedThumbnailId: 't2',
    costUsd: 30.1,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'aims-agentes',
    channelId: 'aims',
    title: 'Agentes de IA em 40 segundos',
    hook: 'A diferença entre responder e agir.',
    format: 'short',
    durationSec: 38,
    status: 'agendado',
    theme: 'Fundamentos de IA',
    stage: 'agendar',
    scheduledAt: day(WEEK, 3, 12, 30),
    publishedAt: null,
    seo: {
      title: 'Agentes de IA em 40 segundos 🤖 #shorts',
      description: 'Responder versus agir: o que muda quando a IA usa ferramentas.',
      tags: ['agentes', 'ia', 'shorts'],
    },
    thumbnails: [
      { id: 't1', label: 'Robô com ferramentas', alt: 'Robô simples segurando três ferramentas diferentes', suggested: true },
    ],
    selectedThumbnailId: 't1',
    costUsd: 5.9,
    metrics: null,
    rejectedReason: null,
  },
  {
    id: 'aims-custo',
    channelId: 'aims',
    title: 'Quanto custa rodar IA de verdade',
    hook: 'A conta que ninguém mostra: token, latência e retrabalho.',
    format: 'video',
    durationSec: 712,
    status: 'publicado',
    theme: 'Custo e negócio',
    stage: 'medir',
    scheduledAt: day(PREV_WEEK, 1, 20, 0),
    publishedAt: day(PREV_WEEK, 1, 20, 0),
    seo: {
      title: 'Quanto custa rodar IA de verdade',
      description: 'Custo por token, latência e o retrabalho que ninguém coloca na planilha.',
      tags: ['custo', 'ia', 'negócio'],
    },
    thumbnails: [
      { id: 't1', label: 'Nota fiscal', alt: 'Nota fiscal longa saindo de um servidor', suggested: true },
      { id: 't2', label: 'Gráfico subindo', alt: 'Gráfico de custo subindo em vermelho', suggested: false },
    ],
    selectedThumbnailId: 't2',
    costUsd: 36.7,
    metrics: {
      views: 187_300,
      impressions: 3_040_000,
      ctrPct: 5.9,
      retentionPct: 44,
      watchHours: 2_060,
      revenueBrl: 122,
      vsChannelAvgPct: 19,
      measuredAt: day(WEEK, 0, 6, 12),
    },
    rejectedReason: null,
  },
  {
    id: 'aims-ruido',
    channelId: 'aims',
    title: 'Alucinação não é bug, é consequência',
    hook: 'Se o modelo prevê a próxima palavra, ele vai inventar quando não sabe.',
    format: 'video',
    durationSec: 502,
    status: 'revisao',
    theme: 'Fundamentos de IA',
    stage: 'revisar',
    scheduledAt: null,
    publishedAt: null,
    seo: {
      title: 'Alucinação não é bug, é consequência',
      description: 'Por que modelos de linguagem inventam e como reduzir o risco na prática.',
      tags: ['alucinação', 'ia', 'confiabilidade'],
    },
    thumbnails: [
      { id: 't1', label: 'Frase quebrada', alt: 'Frase com uma palavra trocada por um borrão', suggested: true },
      { id: 't2', label: 'Duas versões', alt: 'Duas versões da mesma frase lado a lado, uma correta', suggested: false },
    ],
    selectedThumbnailId: null,
    costUsd: 28.3,
    metrics: null,
    rejectedReason: null,
  },
];

/* =============================================================================
   Personagens e Brand Kit
   ============================================================================= */

export const characters: Character[] = [
  { id: 'luna-hero', channelId: 'luna', name: 'Luna', role: 'Protagonista', sheetVersion: 'v4', status: 'oficial', tone: 'pink' },
  { id: 'luna-dog', channelId: 'luna', name: 'Tico', role: 'Cachorro curioso, melhor amigo', sheetVersion: 'v2', status: 'oficial', tone: 'amber' },
  { id: 'luna-bee', channelId: 'luna', name: 'Zum', role: 'Abelhinha amiga', sheetVersion: 'v1', status: 'em_aprovacao', tone: 'teal' },
  { id: 'arq-host', channelId: 'arquivo', name: 'Narrador do Arquivo', role: 'Voz e apresentação', sheetVersion: 'v3', status: 'oficial', tone: 'amber' },
  { id: 'aims-host', channelId: 'aims', name: 'Apresentador simples', role: 'Voz e apresentação', sheetVersion: 'v2', status: 'oficial', tone: 'cyan' },
  { id: 'aims-bot', channelId: 'aims', name: 'Bit', role: 'Mascote didático', sheetVersion: 'v1', status: 'rascunho', tone: 'violet' },
];

export const brandKits: BrandKit[] = [
  {
    channelId: 'luna',
    palette: [
      { name: 'Rosa Luna', hex: '#F472B6' },
      { name: 'Amarelo Sol', hex: '#FBBF24' },
      { name: 'Verde Jardim', hex: '#34D399' },
      { name: 'Azul Céu', hex: '#38BDF8' },
    ],
    fonts: [
      { role: 'Título', family: 'Baloo 2' },
      { role: 'Corpo', family: 'Nunito' },
    ],
    voice: 'Feminina, calorosa, ritmo pausado',
    tone: 'Afetivo, curioso, sem ironia',
    updatedAt: day(PREV_WEEK, 0, 10, 0),
  },
  {
    channelId: 'arquivo',
    palette: [
      { name: 'Âmbar Arquivo', hex: '#F59E0B' },
      { name: 'Grafite', hex: '#334155' },
      { name: 'Papel', hex: '#F8FAFC' },
      { name: 'Vermelho Carimbo', hex: '#DC2626' },
    ],
    fonts: [
      { role: 'Título', family: 'Archivo Black' },
      { role: 'Corpo', family: 'Inter' },
    ],
    voice: 'Masculina, grave, ritmo de documentário',
    tone: 'Instigante, direto, sem sensacionalismo',
    updatedAt: day(PREV_WEEK, 0, 11, 30),
  },
  {
    channelId: 'aims',
    palette: [
      { name: 'Ciano AIMS', hex: '#22D3EE' },
      { name: 'Azul Profundo', hex: '#1D4ED8' },
      { name: 'Violeta', hex: '#8B5CF6' },
      { name: ' Cinza Código', hex: '#94A3B8' },
    ],
    fonts: [
      { role: 'Título', family: 'Space Grotesk' },
      { role: 'Corpo', family: 'Inter' },
    ],
    voice: 'Neutra, clara, ritmo médio',
    tone: 'Didático, sem jargão, sem hype',
    updatedAt: day(PREV_WEEK, 0, 9, 15),
  },
];

/* =============================================================================
   Estado dos módulos do ciclo, por canal (docs/03 §7)
   ============================================================================= */

type ModuleSeed = Omit<ModuleState, 'channelId' | 'status' | 'pending'>;

const moduleSeeds: ModuleSeed[] = [
  {
    id: 'estrategia',
    name: 'Estratégia',
    description: 'Pesquisa de mercado e oportunidades do nicho.',
    stage: 'pesquisar',
    tone: 'cyan',
    href: (c) => `/c/${c}/inicio`,
  },
  {
    id: 'personagens',
    name: 'Personagens',
    description: 'Criação e consistência de personagens.',
    stage: 'criar',
    tone: 'pink',
    href: (c) => `/c/${c}/identidade`,
  },
  {
    id: 'roteiro',
    name: 'Roteiro',
    description: 'Roteiros com IA para vídeos e Shorts.',
    stage: 'criar',
    tone: 'violet',
    href: (c) => `/c/${c}/conteudo`,
  },
  {
    id: 'geracao',
    name: 'Geração de vídeo',
    description: 'Cenas, narração e montagem automáticas.',
    stage: 'criar',
    tone: 'blue',
    href: (c) => `/c/${c}/conteudo`,
  },
  {
    id: 'thumbnail',
    name: 'Thumbnail',
    description: '3 a 4 opções por vídeo, escolha do humano.',
    stage: 'revisar',
    tone: 'rose',
    href: (c) => `/c/${c}/conteudo`,
  },
  {
    id: 'seo',
    name: 'SEO',
    description: 'Títulos, descrições, tags e thumbnail.',
    stage: 'revisar',
    tone: 'green',
    href: (c) => `/c/${c}/conteudo`,
  },
  {
    id: 'aprovacao',
    name: 'Aprovação',
    description: 'Você revisa e decide antes de publicar.',
    stage: 'aprovar',
    tone: 'amber',
    href: (c) => `/c/${c}/conteudo?filtro=revisao`,
  },
  {
    id: 'agendamento',
    name: 'Agendamento',
    description: 'Melhor horário definido por dados.',
    stage: 'agendar',
    tone: 'teal',
    href: (c) => `/c/${c}/calendario`,
  },
  {
    id: 'upload',
    name: 'Upload no YouTube',
    description: 'Publicação automática, sem upload manual.',
    stage: 'publicar',
    tone: 'rose',
    href: (c) => `/c/${c}/calendario`,
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Views, CTR, retenção, receita e custo.',
    stage: 'medir',
    tone: 'cyan',
    href: (c) => `/c/${c}/analytics`,
  },
  {
    id: 'aprendizado',
    name: 'Aprendizado',
    description: 'O que funcionou volta como recomendação.',
    stage: 'melhorar',
    tone: 'violet',
    href: (c) => `/c/${c}/inicio`,
  },
];

/** Módulos resolvidos por canal — o `status` só pode ser calculado com o dado do canal. */
export function modulesFor(channelId: string): ModuleState[] {
  const mine = contents.filter((item) => item.channelId === channelId);
  const inReview = mine.filter((item) => item.status === 'revisao').length;
  const generating = mine.filter((item) => item.status === 'gerando').length;
  const scheduled = mine.filter((item) => item.status === 'agendado' || item.status === 'aprovado').length;
  const published = mine.filter((item) => item.status === 'publicado').length;

  const statusById: Record<string, { status: string; pending: boolean }> = {
    estrategia: { status: '4 temas em análise', pending: false },
    personagens: { status: '3 personagens oficiais', pending: false },
    roteiro: { status: `${mine.length} conteúdos na semana`, pending: false },
    geracao: { status: generating > 0 ? `${generating} em geração` : 'fila vazia', pending: false },
    thumbnail: { status: '3 opções por vídeo', pending: false },
    seo: { status: 'pacote pronto por conteúdo', pending: false },
    aprovacao: {
      status: inReview > 0 ? `${inReview} aguardando você` : 'nada pendente',
      pending: inReview > 0,
    },
    agendamento: { status: `${scheduled} agendados`, pending: false },
    upload: { status: 'conexão ativa', pending: false },
    analytics: { status: `${published} publicados medidos`, pending: false },
    aprendizado: { status: '3 aprendizados da semana', pending: false },
  };

  return moduleSeeds.map((seed) => {
    const extra = statusById[seed.id] ?? { status: '', pending: false };
    return { ...seed, channelId, status: extra.status, pending: extra.pending };
  });
}

/* =============================================================================
   Recomendações do ciclo "Melhorar" — o que a IA aprendeu
   ============================================================================= */

export const recommendations: Recommendation[] = [
  {
    id: 'luna-r1',
    channelId: 'luna',
    title: 'Produzir mais dois episódios sobre cores e animais',
    rationale: 'Vídeos sobre animais tiveram 37% mais retenção que a média do canal nas últimas 4 semanas.',
    confidencePct: 82,
    tone: 'green',
  },
  {
    id: 'luna-r2',
    channelId: 'luna',
    title: 'Usar thumbnail com o personagem maior',
    rationale: 'As 6 thumbnails com o personagem ocupando mais de 40% da área tiveram CTR 2,1 pontos acima.',
    confidencePct: 74,
    tone: 'cyan',
  },
  {
    id: 'luna-r3',
    channelId: 'luna',
    title: 'Evitar histórias sobre amizade por enquanto',
    rationale: 'Você rejeitou 3 dos últimos 4 conteúdos desse tema. Ele saiu da prioridade da próxima pauta.',
    confidencePct: 68,
    tone: 'amber',
  },
  {
    id: 'arq-r1',
    channelId: 'arquivo',
    title: 'Manter vídeos entre 12 e 16 minutos',
    rationale: 'Os três vídeos dessa faixa tiveram watch time 22% acima da média do canal.',
    confidencePct: 79,
    tone: 'green',
  },
  {
    id: 'arq-r2',
    channelId: 'arquivo',
    title: 'Trocar a abertura: 15 segundos até a pergunta',
    rationale: 'A retenção cai 18% no primeiro minuto dos vídeos de 2026. A abertura é a suspeita principal.',
    confidencePct: 61,
    tone: 'amber',
  },
  {
    id: 'aims-r1',
    channelId: 'aims',
    title: 'Publicar às 20h em vez de 18h',
    rationale: 'Publicações às 20h tiveram 31% mais views nas primeiras 48 horas.',
    confidencePct: 85,
    tone: 'green',
  },
  {
    id: 'aims-r2',
    channelId: 'aims',
    title: 'Reduzir custo por vídeo em 30% sem perder qualidade',
    rationale: 'Dois vídeos recentes custaram 40% acima do necessário reutilizando cenas do episódio anterior.',
    confidencePct: 72,
    tone: 'violet',
  },
];

/* =============================================================================
   Helpers de leitura — sempre por canal
   ============================================================================= */

export function channelById(id: string): Channel | undefined {
  return channels.find((channel) => channel.id === id);
}

export function kpisFor(channelId: string): ChannelKpis | undefined {
  return kpis.find((row) => row.channelId === channelId);
}

export function contentsFor(channelId: string): ContentItem[] {
  return contents.filter((item) => item.channelId === channelId);
}

export function contentById(channelId: string, contentId: string): ContentItem | undefined {
  return contents.find((item) => item.channelId === channelId && item.id === contentId);
}

export function charactersFor(channelId: string): Character[] {
  return characters.filter((item) => item.channelId === channelId);
}

export function brandKitFor(channelId: string): BrandKit | undefined {
  return brandKits.find((item) => item.channelId === channelId);
}

export function recommendationsFor(channelId: string): Recommendation[] {
  return recommendations.filter((item) => item.channelId === channelId);
}

/** Data ISO de hoje — usada só para destacar "hoje" na semana. */
export const todayIso = toIsoDate(new Date());

/**
 * Câmbio usado **apenas** para comparar custo (lançado em US$) com receita (em R$) neste protótipo.
 *
 * NÃO VERIFICADO — número de exemplo, não é cotação real. A taxa real precisa vir de fonte
 * verificável antes de qualquer decisão de negócio (AGENTS.md, "nada de fato externo inventado").
 */
export const CAMBIO_EXEMPLO_BRL_POR_USD = 5.4;

export { WEEK as currentWeekDays, PREV_WEEK as previousWeekDays, iso as isoOfDay, day as dateOfDay };
