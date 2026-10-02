/**
 * Tipos de domínio do AI Media Studio.
 *
 * Regra estrutural: **todo tipo que o usuário vê carrega `channelId`**. Se um tipo de dado de
 * produto não tem `channelId`, ele não pode existir — é o caminho mais curto para vazar dado entre
 * canais (invariante nº 2 do AGENTS.md).
 */

export type ChannelId = string;

/** Tom do ícone-tile / categoria visual (docs/03-design-system.md §6). */
export type TileTone =
  | 'cyan'
  | 'blue'
  | 'violet'
  | 'green'
  | 'amber'
  | 'rose'
  | 'pink'
  | 'teal';

/**
 * As 10 etapas canônicas do ciclo (`docs/00-visao-produto.md` §3).
 *
 * Vocabulário apenas: a **ordem** e os **rótulos** vivem em `src/data/cycle.ts`, e é de lá que a
 * interface e os testes leem. Esta união existe para o compilador recusar qualquer etapa inventada.
 *
 * `agendar` e `publicar` são etapas distintas de propósito: agendar é o conteúdo aprovado ganhar
 * data e horário; publicar é o envio pela integração oficial. Fundir as duas apagava a diferença
 * entre "pronto e com data marcada" e "no ar" — que é justamente onde o usuário precisa enxergar
 * o que ainda dá para mudar.
 */
export type CycleStage =
  | 'pesquisar'
  | 'planejar'
  | 'criar'
  | 'revisar'
  | 'aprovar'
  | 'agendar'
  | 'publicar'
  | 'medir'
  | 'aprender'
  | 'melhorar';

export type ContentFormat = 'video' | 'short';

/** Estado do conteúdo na máquina do ciclo (docs/00-visao-produto.md §3). */
export type ContentStatus =
  | 'gerando'
  | 'revisao'
  | 'aprovado'
  | 'agendado'
  | 'publicado'
  | 'falhou';

export type PillTone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface Channel {
  id: ChannelId;
  name: string;
  /** "Canal Infantil", "Canal de Curiosidades", ... — aparece sempre ao lado do nome. */
  kind: string;
  niche: string;
  language: string;
  subscribers: number;
  totalViews: number;
  /** Iniciais usadas no avatar enquanto o Brand Kit não entrega a arte. */
  initials: string;
  tone: TileTone;
  /** Conexão com o YouTube (OAuth) — nunca expõe token na interface. */
  connected: boolean;
  /**
   * `true` quando o conteúdo do canal é dirigido a crianças.
   *
   * Não é rótulo decorativo: é o que aciona o gate de canal infantil. Define quais fornecedores de IA
   * podem atender o canal (allow-list por canal do `ADR-005`), se a tela de Revisão oferece a checagem
   * pedagógica e se a publicação exige a declaração "made for kids".
   *
   * Quem decide de verdade é o **servidor** (`server/ai/channels.ts`) — este campo existe para a
   * interface mostrar a regra certa. Cliente que "opina" sobre isso não muda a decisão do servidor.
   */
  childDirected: boolean;
}

/** KPIs do canal, sempre com período explícito. Nunca exibir número sem período. */
export interface ChannelKpis {
  channelId: ChannelId;
  periodDays: number;
  views: number;
  viewsDeltaPct: number;
  revenueBrl: number;
  revenueDeltaPct: number;
  published: number;
  publishedDeltaPct: number;
  watchHours: number;
  ctrPct: number;
  rpmBrl: number;
  /** Custo real de produção no período — a outra metade de "esse conteúdo valeu a pena?". */
  productionCostUsd: number;
  updatedAt: string;
}

export interface SeoPack {
  title: string;
  description: string;
  tags: string[];
}

export interface ThumbnailOption {
  id: string;
  label: string;
  /** O que a arte mostra — vira o texto alternativo acessível. */
  alt: string;
  /** Sugestão da IA, nunca pré-selecionada (invariante de aprovação). */
  suggested: boolean;
}

export interface ContentMetrics {
  views: number;
  impressions: number;
  ctrPct: number;
  retentionPct: number;
  watchHours: number;
  revenueBrl: number;
  /** Comparação explícita com a média do canal, em %. */
  vsChannelAvgPct: number;
  measuredAt: string;
}

/**
 * Registro da aprovação humana — a prova de que **um humano** liberou **esta versão** do conteúdo.
 *
 * Existe porque "aprovado" sozinho não é prova de nada: sem a impressão do que foi aprovado, dá para
 * aprovar um vídeo e trocar o título, a descrição e a thumbnail antes de ele ir ao ar, e a aprovação
 * continua parecendo válida. O campo `snapshot` fecha essa porta — o portão de publicação compara o
 * conteúdo atual com a versão aprovada e recusa se forem diferentes.
 *
 * `channelId` está aqui de propósito: uma aprovação nunca vale fora do canal em que foi dada
 * (AGENTS.md, invariante nº 2). O tipo carrega o canal porque a aprovação é dado de canal.
 *
 * NÃO VERIFICADO / pendente de F1: `approvedBy` (identidade de quem aprovou) depende do modelo de
 * acesso (D3) e da persistência real. Enquanto não existir autenticação, registrar um nome de
 * usuário seria inventar um dado — o que o app grava é o **fato** da aprovação, com data, canal e
 * versão, e a interface diz isso com todas as letras.
 */
export interface ApprovalRecord {
  /** ISO 8601 do instante da aprovação. */
  approvedAt: string;
  channelId: ChannelId;
  contentId: string;
  /** Impressão exata da versão aprovada (`contentSnapshot` em `src/data/client.ts`). */
  snapshot: string;
  /** Data e hora aprovadas. `null` = aprovado sem agendar. */
  scheduledAt: string | null;
}

/**
 * Um bloco do roteiro — a saída de `criar-roteiro`, gravada no conteúdo.
 *
 * Existe porque a etapa **Criar** não tinha onde guardar o que a IA escreve: `ContentItem` só tinha SEO
 * e thumbnails, então "gerar o vídeo" não tinha de onde partir. Sem roteiro e sem cena, **nenhum**
 * provedor de vídeo tem o que animar — e a tela de Revisão dizia "nenhum vídeo foi gerado ainda" sem
 * dizer que o que faltava era o roteiro.
 */
export interface RoteiroBloco {
  ordem: number;
  tempoInicioSeg: number;
  tempoFimSeg: number;
  narracao: string;
  acao: string;
  emocao: string;
}

/**
 * O roteiro em blocos, com **procedência**.
 *
 * `simulated` e `promptId` viajam junto de propósito: uma proposta gerada sem chave configurada é
 * simulação com a mesma forma da real, e a tela precisa poder dizer isso. Roteiro simulado apresentado
 * como roteiro real seria mentira de produto — e este é o insumo do vídeo.
 */
export interface Roteiro {
  titulo: string;
  logline: string;
  moral: string;
  blocos: RoteiroBloco[];
  /** ISO 8601 do instante em que a IA respondeu. */
  geradoEm: string;
  promptId: string;
  simulated: boolean;
}

/**
 * Uma cena do storyboard — saída de `criar-cena`.
 *
 * É a **entrada** que o pipeline de mídia vai consumir (imagem → animação → montagem): `promptImagem` e
 * `seed` são exatamente o que a etapa de imagem precisa para ser determinística. Enquanto isto não
 * existir, a Fase 1 não começa.
 */
export interface Cena {
  numero: number;
  duracaoSeg: number;
  descricao: string;
  enquadramento: string;
  paleta: string[];
  promptImagem: string;
  negativePrompt: string;
  seed: number;
}

/** O storyboard inteiro, com a mesma procedência do roteiro que o originou. */
export interface Storyboard {
  cenas: Cena[];
  geradoEm: string;
  promptId: string;
  simulated: boolean;
}

export interface ContentItem {
  id: string;
  channelId: ChannelId;
  title: string;
  hook: string;
  format: ContentFormat;
  durationSec: number;
  status: ContentStatus;
  theme: string;
  stage: CycleStage;
  /** ISO 8601. `null` = ainda não agendado. */
  scheduledAt: string | null;
  publishedAt: string | null;
  seo: SeoPack;
  thumbnails: ThumbnailOption[];
  /** Escolha do humano. `null` = a IA não escolheu por ele. */
  selectedThumbnailId: string | null;
  /** Custo real do ativo — obrigatório em tudo que é gerado (invariante nº 4). */
  costUsd: number;
  metrics: ContentMetrics | null;
  /** Motivo da última rejeição humana — alimenta o "aprender com rejeições". */
  rejectedReason: string | null;
  /**
   * O episódio de mídia gerado **deste** conteúdo, quando existe.
   *
   * É o elo que faltava entre a etapa Criar (mídia) e o conteúdo: sem ele, o cartão "O que existe neste
   * conteúdo" não tinha como saber se a mídia já saiu do pipeline, e **afirmava "nenhum vídeo gerado"
   * mesmo com 13 ativos no disco**. O elo é declarado, nunca inferido: ligar conteúdo e episódio por
   * semelhança de nome faria a tela afirmar uma linhagem que ninguém declarou.
   *
   * **Ausente hoje, e isso é a verdade:** o único episódio gerado (`luna-ep-001`) é o episódio sintético
   * da Fase 0, que o próprio spec descreve como "não é conteúdo do canal". Nenhum conteúdo da biblioteca
   * tem episódio — enquanto isso, o cartão diz exatamente isso em vez de fingir.
   */
  episodeId?: string;
  /**
   * O roteiro que a IA escreveu para este conteúdo, quando já existe.
   *
   * Opcional e **ausente em todo o dado de exemplo**, de propósito: nenhum conteúdo da biblioteca teve
   * roteiro gerado, e inventar um faria a tela afirmar que a etapa Criar aconteceu. Ausente = não gerado,
   * e a tela diz exatamente isso em vez de mostrar um roteiro de mentira.
   */
  roteiro?: Roteiro;
  /** O storyboard derivado do roteiro. Mesma regra: ausente = não gerado. */
  storyboard?: Storyboard;
  /**
   * Aprovação humana vigente. `null` = nada aprovado, ou a aprovação foi invalidada porque o
   * conteúdo mudou depois dela. Sem aprovação vigente, `assertPublishable` recusa publicar.
   */
  approval: ApprovalRecord | null;
}

/**
 * Semente de conteúdo: o que existe **antes** de qualquer aprovação.
 *
 * `mock/db.ts` declara `ContentSeed[]` (não `ContentItem[]`) para o compilador cobrar que ninguém
 * invente uma aprovação em dado de exemplo. Quem promove semente a `ContentItem` é o `client`, que
 * grava `approval: null` — nenhum conteúdo nasce aprovado.
 */
export type ContentSeed = Omit<ContentItem, 'approval'>;

export interface Character {
  id: string;
  channelId: ChannelId;
  name: string;
  role: string;
  /** Revisão do Character Sheet canônico — garante "a Luna parece a Luna". */
  sheetVersion: string;
  status: 'oficial' | 'em_aprovacao' | 'rascunho';
  tone: TileTone;
}

export interface BrandKit {
  channelId: ChannelId;
  palette: { name: string; hex: string }[];
  fonts: { role: string; family: string }[];
  voice: string;
  tone: string;
  updatedAt: string;
}

/** Estado real do canal em um módulo do ciclo (docs/03 §7). */
export interface ModuleState {
  id: string;
  channelId: ChannelId;
  name: string;
  description: string;
  stage: CycleStage;
  tone: TileTone;
  /** Texto curto do estado atual, ex. "3 temas em análise". */
  status: string;
  href: (channelId: ChannelId) => string;
  pending: boolean;
}

export interface WeeklySlot {
  /** 0 = domingo, 1 = segunda, ... 6 = sábado. */
  weekday: number;
  date: string;
  content: ContentItem | null;
}

export interface Recommendation {
  id: string;
  channelId: ChannelId;
  title: string;
  rationale: string;
  confidencePct: number;
  tone: TileTone;
}

export interface PortfolioRow {
  channel: Channel;
  kpis: ChannelKpis;
}
