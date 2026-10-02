/**
 * Contrato da camada de IA — compartilhado entre o navegador e o servidor.
 *
 * Este arquivo é a **fonte única** de "qual função do app usa qual LLM". Nenhuma tela escolhe
 * modelo, e nenhum componente importa SDK de fornecedor (AGENTS.md, invariante nº 7: provedores são
 * substituíveis; o usuário vê uma ferramenta só).
 *
 * Regras estruturais que este arquivo faz valer:
 *
 * 1. Toda função declara a **etapa do ciclo** a que pertence (`src/data/cycle.ts` é a espinha).
 * 2. Toda função declara o **nível de modelo** (`AiTier`) — não um nome de modelo. O nome concreto
 *    vem do catálogo do servidor (`server/ai/catalog.ts`), que é configurável por ambiente. Trocar
 *    de fornecedor não muda este arquivo nem a UI.
 * 3. Toda função é **escopada por canal**: `channelId` é argumento obrigatório do pedido.
 * 4. Nenhuma função aprova, agenda ou publica — `requiresHumanApproval` é `true` em tudo que produz
 *    conteúdo que pode ir ao ar (AGENTS.md, invariante nº 1).
 *
 * IMPORTANTE (para quem for editar): este módulo é importado pelo `api/` (serverless) com caminho
 * **relativo**. Não use o alias `@/` em import de valor aqui — só `import type`.
 */

import type { ChannelId, CycleStage } from '../data/types.js';

/* =============================================================================
   Níveis de modelo
   ============================================================================= */

/**
 * Nível de capacidade, não nome de modelo.
 *
 * | nível       | para quê                                              | por que não usar o maior sempre |
 * |---|---|---|
 * | `raciocinio`| analisar, comparar, planejar, julgar, revisar           | caro e lento; ganho real em julgamento |
 * | `criativo`  | escrever roteiro, cena, personagem, texto de divulgação | prosa e voz, não cálculo |
 * | `rapido`    | extrair, classificar, normalizar, formatar metadados    | 10× mais barato; a tarefa é mecânica |
 * | `visao`     | ler imagem (thumbnails concorrentes, frame gerado)      | só quando há imagem na entrada |
 *
 * A regra que evita queimar orçamento (skill `rebeca-prompt-eng`, princípio 7): **modelo grande para
 * julgar e criar, modelo pequeno para classificar e extrair**.
 */
export type AiTier = 'raciocinio' | 'criativo' | 'rapido' | 'visao';

/* =============================================================================
   Identificadores das funções do app
   ============================================================================= */

/**
 * Cada item é uma função **visível no produto** — não uma chamada técnica.
 *
 * O nome é `<etapa>-<o que ela entrega>` e fica em pt-BR porque é vocabulário do produto
 * (`docs/00-visao-produto.md` §3). Código e identificadores em inglês; **vocabulário de produto não
 * é identificador de código** — é o nome da coisa que o usuário vê.
 */
export type AiFunctionId =
  | 'pesquisar-tendencia'
  | 'planejar-pauta'
  | 'criar-roteiro'
  | 'criar-cena'
  | 'criar-thumbnail'
  | 'criar-seo'
  | 'revisar-qualidade'
  | 'revisar-infantil'
  | 'agendar-horario'
  | 'medir-analise'
  | 'aprender-insight'
  | 'melhorar-plano'
  | 'identidade-personagem'
  | 'monetizacao-veredito'
  | 'marketing-derivados';

/* =============================================================================
   Especificação de uma função
   ============================================================================= */

/** O que a função devolve para o app quando termina (e o que ela nunca faz sozinha). */
export type AiEffect =
  /** Só devolve texto/estrutura para a tela. Nada é gravado no conteúdo. */
  | 'somente-leitura'
  /** Propõe um rascunho; quem grava é o humano, clicando. */
  | 'propoe-rascunho';

export interface AiFunctionSpec {
  readonly id: AiFunctionId;
  /** Nome que aparece na interface, em pt-BR. */
  readonly label: string;
  /** Uma linha explicando ao usuário o que esta função faz — usada em tooltip/estado. */
  readonly purpose: string;
  /** Etapa canônica do ciclo a que a função pertence. */
  readonly stage: CycleStage;
  /** Identificador do prompt versionado em `.rebeca/prompts/<promptId>@vN.md`. */
  readonly promptId: string;
  readonly promptVersion: number;
  /** Nível de modelo. O nome concreto é decisão do catálogo do servidor. */
  readonly tier: AiTier;
  /** Nome do schema de saída (ver `src/ai/schemas.ts`) — a saída é validada, nunca "texto com regex". */
  readonly outputSchema: string;
  /** Teto de tokens de saída: segunda trava de custo, além do teto em dólar. */
  readonly maxOutputTokens: number;
  readonly effect: AiEffect;
  /**
   * `true` quando a saída pode virar conteúdo que vai ao ar e por isso **exige decisão humana**
   * depois. Não existe função com `false` que publique — publicar não é função de IA aqui.
   */
  readonly requiresHumanApproval: boolean;
  /**
   * `true` quando a função só se aplica a canal cujo conteúdo é dirigido a crianças. Reforça a
   * allow-list **por canal** do `ADR-005` (canal infantil tem regra própria; canal adulto não).
   */
  readonly childChannelOnly: boolean;
}

/**
 * Registro completo. `Record<AiFunctionId, AiFunctionSpec>` é intencional: acrescentar uma função em
 * `AiFunctionId` sem descrevê-la aqui quebra o `tsc`. Tipo incompleto não passa.
 */
export const AI_FUNCTIONS: Record<AiFunctionId, AiFunctionSpec> = {
  'pesquisar-tendencia': {
    id: 'pesquisar-tendencia',
    label: 'Pesquisar tendências',
    purpose: 'Lê o nicho e devolve temas com potencial, saturacao estimada e por que apostar neles.',
    stage: 'pesquisar',
    promptId: 'pesquisar-tendencia',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'pesquisar-tendencia',
    maxOutputTokens: 1800,
    effect: 'somente-leitura',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'planejar-pauta': {
    id: 'planejar-pauta',
    label: 'Planejar a semana',
    purpose: 'Monta a pauta da semana cruzando o que funcionou, o que você recusou e a frequência.',
    stage: 'planejar',
    promptId: 'planejar-pauta',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'planejar-pauta',
    maxOutputTokens: 2000,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'criar-roteiro': {
    id: 'criar-roteiro',
    label: 'Escrever o roteiro',
    purpose: 'Transforma a pauta aprovada em roteiro em blocos, com narração, ação e tempo por cena.',
    stage: 'criar',
    promptId: 'criar-roteiro',
    promptVersion: 1,
    tier: 'criativo',
    outputSchema: 'criar-roteiro',
    maxOutputTokens: 4000,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'criar-cena': {
    id: 'criar-cena',
    label: 'Gerar o storyboard',
    /*
     * **Por lote, e isso é contrato, não preferência.**
     *
     * A v1 recebia o roteiro inteiro (`blocos` até 40) e devolvia o storyboard inteiro (`cenas` até 60).
     * Medido em 2026-10-02: com o teto de saída, um roteiro de 24 blocos **não cabia**. O modelo truncava
     * o JSON (a linha do livro registrou `tokens_out: 6000` = `2 × 3000`, as duas tentativas somadas), a
     * correção automática truncava de novo, e a resposta era **HTTP 502 `schema-invalido`** depois de
     * ~120 s. Três falhas custaram US$ 0,21 e não produziram nada.
     *
     * Pior: quando "passava", passava com **uma cena** para um vídeo de 492 s — o modelo caber no teto
     * emitindo quase nada. O mesmo teto produzia o erro e o resultado vazio.
     *
     * Agora a entrada é de 1 a 3 blocos e a saída de 1 a 4 cenas (`src/ai/schemas.ts`), e **quem encadeia
     * os lotes é a tela**. Cada resposta cabe no orçamento com folga para o raciocínio do modelo, e
     * nenhuma chamada chega perto do teto de 90 s.
     */
    purpose:
      'Quebra UM LOTE de até 3 blocos do roteiro em cenas, com enquadramento, paleta e prompt de imagem. A tela encadeia os lotes do episódio.',
    stage: 'criar',
    promptId: 'criar-cena',
    promptVersion: 2,
    tier: 'criativo',
    outputSchema: 'criar-cena',
    maxOutputTokens: 4000,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'criar-thumbnail': {
    id: 'criar-thumbnail',
    label: 'Propor thumbnails',
    purpose: 'Gera 4 conceitos de thumbnail com texto na arte e prompt de imagem. NÃO escolhe a vencedora.',
    stage: 'criar',
    promptId: 'criar-thumbnail',
    promptVersion: 1,
    tier: 'criativo',
    outputSchema: 'criar-thumbnail',
    maxOutputTokens: 2200,
    effect: 'propoe-rascunho',
    // Escolher a thumbnail é ato humano (invariante nº 1). Esta função propõe; ela jamais marca
    // uma opção como escolhida — o campo `sugestao` é informativo e a UI não pré-seleciona.
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'criar-seo': {
    id: 'criar-seo',
    label: 'Preparar título, descrição e tags',
    purpose: 'Escreve os metadados do vídeo a partir do roteiro e da identidade do canal.',
    stage: 'criar',
    promptId: 'criar-seo',
    promptVersion: 1,
    tier: 'rapido',
    outputSchema: 'criar-seo',
    maxOutputTokens: 1200,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'revisar-qualidade': {
    id: 'revisar-qualidade',
    label: 'Revisar a qualidade',
    purpose:
      'Aplica a rubrica (originalidade, gancho, clareza, adequação etária) e aponta o que corrigir. Não aprova.',
    stage: 'revisar',
    promptId: 'revisar-qualidade',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'revisar-qualidade',
    maxOutputTokens: 2000,
    effect: 'somente-leitura',
    // A função revisa; quem aprova é o humano. `requiresHumanApproval` é `true` para deixar
    // explícito que o veredito da IA não substitui a decisão.
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'revisar-infantil': {
    id: 'revisar-infantil',
    label: 'Checar adequação infantil',
    purpose:
      'Gate de canal infantil: faixa etária, ritmo, vocabulário, valores e conteúdo bloqueante (ECA Digital/LGPD).',
    stage: 'revisar',
    promptId: 'revisar-infantil',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'revisar-infantil',
    maxOutputTokens: 2000,
    effect: 'somente-leitura',
    requiresHumanApproval: true,
    childChannelOnly: true,
  },

  'agendar-horario': {
    id: 'agendar-horario',
    label: 'Sugerir melhor horário',
    purpose: 'Compara o histórico de horários do canal e recomenda quando publicar. Só sugere.',
    stage: 'agendar',
    promptId: 'agendar-horario',
    promptVersion: 1,
    tier: 'rapido',
    outputSchema: 'agendar-horario',
    maxOutputTokens: 900,
    effect: 'somente-leitura',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'medir-analise': {
    id: 'medir-analise',
    label: 'Ler o desempenho',
    purpose: 'Compara o vídeo com a média do canal e responde "esse conteúdo valeu a pena?".',
    stage: 'medir',
    promptId: 'medir-analise',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'medir-analise',
    maxOutputTokens: 1600,
    effect: 'somente-leitura',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'aprender-insight': {
    id: 'aprender-insight',
    label: 'Extrair aprendizados',
    purpose: 'Encontra padrões no que foi publicado e no que você recusou, com a evidência de cada um.',
    stage: 'aprender',
    promptId: 'aprender-insight',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'aprender-insight',
    maxOutputTokens: 2000,
    effect: 'somente-leitura',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'melhorar-plano': {
    id: 'melhorar-plano',
    label: 'Melhorar a próxima semana',
    purpose: 'Transforma o aprendizado em mudanças concretas de pauta para a semana seguinte.',
    stage: 'melhorar',
    promptId: 'melhorar-plano',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'melhorar-plano',
    maxOutputTokens: 2000,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'identidade-personagem': {
    id: 'identidade-personagem',
    label: 'Criar personagem',
    purpose:
      'Converte o pedido em português ("um cachorro curioso, orelhas grandes") em ficha de personagem consistente.',
    stage: 'criar',
    promptId: 'identidade-personagem',
    promptVersion: 1,
    tier: 'criativo',
    outputSchema: 'identidade-personagem',
    maxOutputTokens: 1600,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'monetizacao-veredito': {
    id: 'monetizacao-veredito',
    label: 'Julgar custo contra receita',
    purpose: 'Cruza custo real de produção com receita e diz se o conteúdo se pagou.',
    stage: 'medir',
    promptId: 'monetizacao-veredito',
    promptVersion: 1,
    tier: 'raciocinio',
    outputSchema: 'monetizacao-veredito',
    maxOutputTokens: 1400,
    effect: 'somente-leitura',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },

  'marketing-derivados': {
    id: 'marketing-derivados',
    label: 'Gerar material de divulgação',
    purpose: 'Deriva Short, legenda de Instagram, TikTok, story e post de comunidade a partir do episódio.',
    stage: 'criar',
    promptId: 'marketing-derivados',
    promptVersion: 1,
    tier: 'criativo',
    outputSchema: 'marketing-derivados',
    maxOutputTokens: 2000,
    effect: 'propoe-rascunho',
    requiresHumanApproval: true,
    childChannelOnly: false,
  },
};

/** Ordem estável para a interface listar as funções (segue o ciclo, depois a ordem de declaração). */
export const AI_FUNCTION_IDS = Object.keys(AI_FUNCTIONS) as AiFunctionId[];

export function getAiFunction(id: string): AiFunctionSpec | null {
  return Object.prototype.hasOwnProperty.call(AI_FUNCTIONS, id)
    ? AI_FUNCTIONS[id as AiFunctionId]
    : null;
}

/* =============================================================================
   Pedido e resposta
   ============================================================================= */

export interface AiRequest {
  readonly functionId: AiFunctionId;
  /**
   * Canal dono da chamada. **Obrigatório**: é o que impede um prompt de um canal receber o contexto
   * de outro (AGENTS.md, invariante nº 2).
   */
  readonly channelId: ChannelId;
  /**
   * Conteúdo a que a chamada se refere, quando houver. Serve para o livro de custos
   * (`.rebeca/custos.csv`, invariante nº 4) conseguir responder "quanto custou este conteúdo?".
   */
  readonly contentId?: string;
  /** Entrada da função. A forma exata é validada pelo schema de entrada no servidor. */
  readonly input: Readonly<Record<string, unknown>>;
  /** Recado do humano (ex.: motivo da rejeição) — vira contexto do prompt, nunca instrução de sistema. */
  readonly note?: string;
}

export interface AiUsage {
  readonly tokensIn: number;
  readonly tokensOut: number;
}

/**
 * De onde veio o número de custo.
 *
 * `nao-verificado` existe para nunca inventar preço: se o modelo configurado não estiver na tabela
 * de preços com fonte e data, o app **mostra o custo como não verificado** em vez de exibir um valor
 * inventado (regra do projeto: nada de fato externo inventado).
 */
export type AiCostSource = 'real' | 'nao-verificado';

export interface AiResult<TData = unknown> {
  readonly functionId: AiFunctionId;
  readonly channelId: ChannelId;
  readonly promptId: string;
  readonly promptVersion: number;
  readonly tier: AiTier;
  /** Fornecedor que atendeu a chamada (`deepseek`, `openai`, `anthropic`, `google`, `openrouter`, `simulado`). */
  readonly provider: string;
  readonly model: string;
  /** `true` quando não havia chave configurada e o provedor simulado respondeu. A UI precisa dizer isso. */
  readonly simulated: boolean;
  readonly data: TData;
  readonly usage: AiUsage;
  readonly costUsd: number;
  readonly costSource: AiCostSource;
  /**
   * Onde o registro durável deste custo ficou.
   *
   * `csv` = linha gravada em `.rebeca/custos.csv` (o que o invariante nº 4 exige).
   * `memoria` = só no processo, **não durável** — é o caso da função serverless da Vercel, cujo
   * sistema de arquivos é somente-leitura.
   * `nenhum` = nada foi gasto, logo não há custo a registrar. É o caso da resposta simulada, que não
   * chama provedor pago. Gravar uma linha de custo zero no livro por causa de uma simulação poluiria
   * o registro com eventos que não são gasto e faria "quantas gerações pagas tivemos?" mentir.
   *
   * O campo existe porque prometer registro durável na nuvem sem ter onde gravar seria mentira: a
   * memória durável de produção exige banco (Supabase), que é decisão ainda aberta (D1).
   */
  readonly costRecorded: 'csv' | 'memoria' | 'nenhum';
  readonly latencyMs: number;
  readonly createdAt: string;
  /** Quantas tentativas foram necessárias (1 = acertou o schema de primeira). */
  readonly attempts: number;
}

/* =============================================================================
   Tela de Configurações — segredos, endereços e escolha de modelo
   ============================================================================= */

/** Rótulo em pt-BR de cada nível, para a interface não repetir o identificador técnico. */
export const AI_TIER_LABEL: Record<AiTier, string> = {
  raciocinio: 'Raciocínio e análise',
  criativo: 'Escrita e criação',
  rapido: 'Tarefas rápidas e baratas',
  visao: 'Leitura de imagem',
};

export const AI_TIER_PURPOSE: Record<AiTier, string> = {
  raciocinio: 'Revisar, comparar, planejar e julgar. É o nível que decide se um conteúdo presta.',
  criativo: 'Escrever roteiro, cena, personagem e texto de divulgação.',
  rapido: 'Extrair, classificar e formatar metadados — trabalho mecânico, modelo barato.',
  visao: 'Ler imagem. Hoje nenhuma função usa este nível.',
};

/** Uma opção de modelo oferecida nos seletores. */
export interface AiCatalogOption {
  /** `provedor:modelo` — o valor que o seletor devolve. */
  readonly spec: string;
  readonly provider: string;
  readonly model: string;
  readonly label: string;
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
  readonly minorPolicy: 'permitido' | 'restrito-menores' | 'nao-verificado';
  readonly allowsChildChannel: boolean;
}

export interface AiProviderSettingsView {
  readonly provider: string;
  /** Nome da variável de ambiente equivalente — o caminho de quem publica o app. */
  readonly envVar: string;
  readonly configured: boolean;
  /** Só o suficiente para o humano reconhecer a chave. **Nunca** o valor. */
  readonly keyMask: string;
  readonly keySource: 'configuracao' | 'ambiente' | 'ausente';
  readonly baseUrl: string;
  readonly defaultBaseUrl: string;
  readonly baseUrlCustomized: boolean;
  readonly minorPolicy: 'permitido' | 'restrito-menores' | 'nao-verificado';
  readonly allowedForChildDirected: boolean;
}

export interface AiFunctionModelView {
  readonly functionId: AiFunctionId;
  readonly label: string;
  readonly tier: AiTier;
  /** `provedor:modelo` que de fato atende esta função agora. */
  readonly resolved: string;
  readonly source: 'funcao' | 'nivel' | 'ambiente' | 'catalogo' | 'simulacao';
}

export interface AiTierSettingsView {
  readonly tier: AiTier;
  readonly label: string;
  readonly purpose: string;
  /** Sobreposição salva, ou `null` quando vale o padrão do catálogo. */
  readonly override: string | null;
  readonly resolved: string;
}

export interface AiSettingsView {
  /** `false` significa: este ambiente não aceita gravar segredo pela interface. */
  readonly writable: boolean;
  /** `true` quando o app está publicado — contexto em que o segredo vem do gerenciador de segredos. */
  readonly hosted: boolean;
  readonly configPath: string | null;
  readonly providers: readonly AiProviderSettingsView[];
  readonly tiers: readonly AiTierSettingsView[];
  readonly functions: readonly AiFunctionModelView[];
  readonly flags: {
    readonly allowUnverifiedMinorPolicy: boolean;
    readonly allowUnpricedModel: boolean;
    readonly allowNoLedger: boolean;
  };
  readonly catalog: readonly AiCatalogOption[];
  readonly updatedAt: string | null;
  /** Onde o custo está sendo registrado agora. */
  readonly ledger: 'csv' | 'memoria';
}

export interface AiSettingsPatch {
  readonly providers?: Readonly<
    Record<string, { apiKey?: string | null; baseUrl?: string | null }>
  >;
  readonly models?: Readonly<Partial<Record<AiTier, string | null>>>;
  readonly functionModels?: Readonly<Record<string, string | null>>;
  readonly allowUnverifiedMinorPolicy?: boolean;
  readonly allowUnpricedModel?: boolean;
  readonly allowNoLedger?: boolean;
}

export interface AiSettingsSaveResult {
  readonly changed: readonly string[];
  readonly updatedAt: string;
  /** A configuração como ficou — a tela se atualiza sem uma segunda requisição. */
  readonly settings: AiSettingsView;
}

/** Resultado de "testar conexão": uma chamada mínima real, com custo e latência medidos. */
export interface ProviderTestResult {
  readonly provider: string;
  readonly ok: boolean;
  /** Mensagem em pt-BR pronta para a tela, sem chave e sem corpo cru do provedor. */
  readonly message: string;
  readonly model: string;
  readonly latencyMs: number;
  readonly costUsd: number;
  readonly costSource: AiCostSource;
}

/* =============================================================================
   Erros
   ============================================================================= */

export type AiErrorCode =
  | 'funcao-desconhecida'
  | 'canal-obrigatorio'
  | 'canal-desconhecido'
  | 'entrada-invalida'
  | 'sem-provedor'
  | 'teto-por-chamada'
  | 'teto-diario'
  | 'schema-invalido'
  | 'provedor'
  | 'nao-autorizado';

export interface AiErrorBody {
  readonly code: AiErrorCode;
  /** Mensagem em pt-BR, pronta para a tela. Nunca contém chave, token ou corpo do provedor. */
  readonly message: string;
  /** Detalhe técnico sem segredo — ajuda a diagnosticar sem vazar credencial. */
  readonly detail?: string;
  /** Quando `true`, tentar de novo mais tarde faz sentido. */
  readonly retryable: boolean;
}

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly detail: string | undefined;
  readonly retryable: boolean;
  readonly status: number;

  constructor(body: AiErrorBody, status = 400) {
    super(body.message);
    this.name = 'AiError';
    this.code = body.code;
    this.detail = body.detail;
    this.retryable = body.retryable;
    this.status = status;
  }

  toBody(): AiErrorBody {
    return this.detail === undefined
      ? { code: this.code, message: this.message, retryable: this.retryable }
      : { code: this.code, message: this.message, detail: this.detail, retryable: this.retryable };
  }
}

/* =============================================================================
   Estado do provedor (o que a UI mostra em "Configurações")
   ============================================================================= */

export interface AiProviderStatus {
  readonly provider: string;
  /** `true` quando existe chave configurada no ambiente do servidor. Nunca devolve a chave. */
  readonly configured: boolean;
  readonly envVar: string;
  /** O que o termo do fornecedor diz sobre serviço dirigido a menores de 18 anos. */
  readonly minorPolicy: 'permitido' | 'restrito-menores' | 'nao-verificado';
  /** `false` quando o fornecedor está fora da allow-list do canal infantil. */
  readonly allowedForChildDirected: boolean;
}

export interface AiStatus {
  readonly ready: boolean;
  /** `false` quando NENHUMA chave existe: o app roda, mas com provedor simulado. */
  readonly hasAnyKey: boolean;
  /** `true` quando o app está respondendo por simulação (nenhuma chave, ou nenhuma permitida). */
  readonly simulated: boolean;
  readonly providers: readonly AiProviderStatus[];
  /** `provider:model` efetivo por nível, para canal não dirigido a crianças. */
  readonly models: Readonly<Record<AiTier, string>>;
  /**
   * `provider:model` por nível para **canal dirigido a crianças**. Diverge de `models` sempre que a
   * allow-list por canal exclui o fornecedor preferido — é a prova visível de que a restrição
   * contratual é aplicada, e não apenas documentada.
   */
  readonly childDirectedModels: Readonly<Record<AiTier, string>>;
  /** `true` quando o canal infantil NÃO tem fornecedor permitido com chave e cai na simulação. */
  readonly childDirectedFallsBackToSimulation: boolean;
  /** `true` quando o dono assumiu explicitamente usar fornecedor de política não verificada. */
  readonly policyOverride: boolean;
  readonly budget: {
    readonly perCallUsd: number;
    readonly dailyUsd: number;
    readonly spentTodayUsd: number;
    /** Onde o livro de custos está sendo gravado de fato. */
    readonly ledger: 'csv' | 'memoria';
    readonly ledgerPath: string | null;
  };
}
