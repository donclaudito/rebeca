/**
 * Contrato de entrada e saída de cada função de IA, em JSON Schema.
 *
 * Por que JSON Schema e não "pedir JSON por favor":
 *
 * 1. A saída alimenta **código** (a tela, o rascunho do conteúdo). A skill `rebeca-prompt-eng` é
 *    explícita: saída que alimenta código é estruturada e **validada por schema**, nunca texto livre
 *    com regex.
 * 2. O mesmo schema é enviado ao provedor que suporta saída estruturada e, **independente disso**,
 *    validado aqui. Provedor que ignora o parâmetro não vira furo: a validação local é a que manda.
 * 3. Schema é contrato legível por humano — é o que permite discutir a saída sem ler o prompt.
 *
 * O validador abaixo é um subconjunto deliberado de JSON Schema (o que este produto usa). Escrever
 * um validador pequeno e **testado** vale mais que aceitar uma dependência nova para validar 15
 * objetos — e não adiciona superfície de supply chain (skill `rebeca-seguranca`, princípio 10).
 */

/* =============================================================================
   Subconjunto de JSON Schema usado no produto
   ============================================================================= */

export type JsonSchema =
  | {
      readonly type: 'object';
      readonly properties: Readonly<Record<string, JsonSchema>>;
      readonly required?: readonly string[];
      readonly additionalProperties?: boolean;
    }
  | {
      readonly type: 'array';
      readonly items: JsonSchema;
      readonly minItems?: number;
      readonly maxItems?: number;
    }
  | {
      readonly type: 'string';
      readonly minLength?: number;
      readonly maxLength?: number;
      readonly enum?: readonly string[];
    }
  | { readonly type: 'number'; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'integer'; readonly minimum?: number; readonly maximum?: number }
  | { readonly type: 'boolean' };

/* --- Construtores, só para o registro abaixo ficar legível ------------------ */

const str = (extra: Omit<Extract<JsonSchema, { type: 'string' }>, 'type'> = {}): JsonSchema => ({
  type: 'string',
  ...extra,
});
const num = (extra: Omit<Extract<JsonSchema, { type: 'number' }>, 'type'> = {}): JsonSchema => ({
  type: 'number',
  ...extra,
});
const int = (extra: Omit<Extract<JsonSchema, { type: 'integer' }>, 'type'> = {}): JsonSchema => ({
  type: 'integer',
  ...extra,
});
const bool = (): JsonSchema => ({ type: 'boolean' });
const arr = (items: JsonSchema, extra: { minItems?: number; maxItems?: number } = {}): JsonSchema => ({
  type: 'array',
  items,
  ...extra,
});
/**
 * Objeto de schema.
 *
 * **Toda** propriedade declarada entra em `required`, e isto não é estilo: no modo `strict` da OpenAI
 * a API **recusa a requisição** quando alguma propriedade não está em `required`. Descoberto com uma
 * chamada real — `HTTP 400: Invalid schema for response_format 'resposta': 'required' is required to
 * be supplied and to be an array including every key in properties. Missing 'hashtags'.` O contrato
 * do provedor passou a ser o contrato do schema.
 *
 * Consequência de projeto, e ela é boa: "campo sem valor" passa a ser expresso por **valor vazio**
 * (lista vazia, texto vazio), nunca por ausência de chave. A ambiguidade entre "não há capítulos" e
 * "o modelo esqueceu de dizer" desaparece.
 */
const obj = (properties: Readonly<Record<string, JsonSchema>>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const SEVERITY = ['alta', 'media', 'baixa'] as const;
const FORMAT = ['video', 'short'] as const;

/* =============================================================================
   Validador
   ============================================================================= */

function typeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateNode(schema: JsonSchema, value: unknown, path: string, errors: string[]): void {
  switch (schema.type) {
    case 'object': {
      if (typeName(value) !== 'object') {
        errors.push(`${path}: esperado objeto, veio ${typeName(value)}`);
        return;
      }
      const record = value as Record<string, unknown>;
      for (const key of schema.required ?? []) {
        // `hasOwnProperty` de novo: com `in`, uma chave chamada `__proto__` ou `constructor` no
        // schema seria satisfeita pela cadeia de protótipos sem existir no dado.
        if (!Object.prototype.hasOwnProperty.call(record, key) || record[key] === undefined) {
          errors.push(`${path}.${key}: campo obrigatório ausente`);
        }
      }
      for (const [key, child] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined) {
          validateNode(child, record[key], `${path}.${key}`, errors);
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(record)) {
          // `hasOwnProperty` e não `in`: o operador `in` percorre a cadeia de protótipos, então
          // `'__proto__' in schema.properties` devolve `true` (é propriedade de `Object.prototype`) e
          // a chave `__proto__` vinda do modelo passava como se fosse prevista. Também confere que a
          // chave é própria do objeto de propriedades, e não herdada. O `rebeca-qa` levantou o furo.
          if (!Object.prototype.hasOwnProperty.call(schema.properties, key)) {
            errors.push(`${path}.${key}: campo não previsto no schema`);
          }
        }
      }
      return;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${path}: esperado array, veio ${typeName(value)}`);
        return;
      }
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path}: precisa de pelo menos ${schema.minItems} item(ns), veio ${value.length}`);
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path}: no máximo ${schema.maxItems} item(ns), veio ${value.length}`);
      }
      value.forEach((item, index) => validateNode(schema.items, item, `${path}[${index}]`, errors));
      return;
    }

    case 'string': {
      if (typeof value !== 'string') {
        errors.push(`${path}: esperado texto, veio ${typeName(value)}`);
        return;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push(`${path}: "${value}" não é um dos valores aceitos (${schema.enum.join(', ')})`);
      }
      if (schema.minLength !== undefined && value.trim().length < schema.minLength) {
        errors.push(`${path}: texto curto demais (mínimo ${schema.minLength} caracteres)`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`${path}: texto longo demais (máximo ${schema.maxLength} caracteres)`);
      }
      return;
    }

    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${path}: esperado número, veio ${typeName(value)}`);
        return;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: ${value} abaixo do mínimo ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: ${value} acima do máximo ${schema.maximum}`);
      }
      return;
    }

    case 'integer': {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push(`${path}: esperado inteiro, veio ${typeName(value)}`);
        return;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: ${value} abaixo do mínimo ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: ${value} acima do máximo ${schema.maximum}`);
      }
      return;
    }

    case 'boolean': {
      if (typeof value !== 'boolean') {
        errors.push(`${path}: esperado booleano, veio ${typeName(value)}`);
      }
      return;
    }
  }
}

/**
 * Valida `value` contra `schema`. Devolve a lista de problemas — **vazia significa válido**.
 *
 * Devolver a lista (em vez de `boolean`) é deliberado: a mensagem de erro alimenta a tentativa de
 * correção do modelo e o log de diagnóstico. "Inválido" sem dizer por quê não é diagnosticável.
 */
export function validateSchema(schema: JsonSchema, value: unknown): string[] {
  const errors: string[] = [];
  validateNode(schema, value, '$', errors);
  return errors;
}

/* =============================================================================
   Registro: entrada e saída de cada função
   ============================================================================= */

interface FunctionSchema {
  readonly input: JsonSchema;
  readonly output: JsonSchema;
}

export const FUNCTION_SCHEMAS: Record<string, FunctionSchema> = {
  'pesquisar-tendencia': {
    input: obj(
      {
        niche: str({ minLength: 2, maxLength: 200 }),
        audience: str({ minLength: 2, maxLength: 200 }),
        recentThemes: arr(str({ maxLength: 120 }), { maxItems: 30 }),
        rejectedThemes: arr(str({ maxLength: 120 }), { maxItems: 30 }),
      }
    ),
    output: obj(
      {
        temas: arr(
          obj(
            {
              tema: str({ minLength: 3, maxLength: 120 }),
              porQue: str({ minLength: 10, maxLength: 400 }),
              saturacao: str({ enum: ['baixa', 'media', 'alta'] }),
              oportunidade: int({ minimum: 0, maximum: 100 }),
              evidencia: str({ minLength: 5, maxLength: 400 }),
            }
          ),
          { minItems: 3, maxItems: 6 },
        ),
      }
    ),
  },

  'planejar-pauta': {
    input: obj(
      {
        niche: str({ minLength: 2, maxLength: 200 }),
        audience: str({ minLength: 2, maxLength: 200 }),
        weekStart: str({ minLength: 8, maxLength: 40 }),
        historico: arr(str({ maxLength: 200 }), { maxItems: 40 }),
        temasFortes: arr(str({ maxLength: 120 }), { maxItems: 20 }),
        videosPorSemana: int({ minimum: 1, maximum: 14 }),
      }
    ),
    output: obj(
      {
        resumo: str({ minLength: 10, maxLength: 400 }),
        pauta: arr(
          obj(
            {
              dia: str({ minLength: 3, maxLength: 20 }),
              formato: str({ enum: FORMAT }),
              tema: str({ minLength: 3, maxLength: 120 }),
              angulo: str({ minLength: 10, maxLength: 300 }),
              gancho: str({ minLength: 10, maxLength: 300 }),
              duracaoSeg: int({ minimum: 15, maximum: 1800 }),
            }
          ),
          { minItems: 1, maxItems: 14 },
        ),
      }
    ),
  },

  'criar-roteiro': {
    input: obj(
      {
        tema: str({ minLength: 3, maxLength: 200 }),
        angulo: str({ minLength: 3, maxLength: 300 }),
        gancho: str({ minLength: 3, maxLength: 300 }),
        formato: str({ enum: FORMAT }),
        duracaoSeg: int({ minimum: 15, maximum: 1800 }),
        idadeAlvo: str({ maxLength: 40 }),
        personagens: arr(str({ maxLength: 80 }), { maxItems: 10 }),
        valores: arr(str({ maxLength: 80 }), { maxItems: 10 }),
      }
    ),
    output: obj(
      {
        titulo: str({ minLength: 3, maxLength: 100 }),
        logline: str({ minLength: 10, maxLength: 400 }),
        moral: str({ minLength: 3, maxLength: 200 }),
        blocos: arr(
          obj(
            {
              ordem: int({ minimum: 1, maximum: 60 }),
              tempoInicioSeg: int({ minimum: 0, maximum: 1800 }),
              tempoFimSeg: int({ minimum: 1, maximum: 1800 }),
              narracao: str({ minLength: 1, maxLength: 1200 }),
              acao: str({ minLength: 1, maxLength: 600 }),
              emocao: str({ minLength: 2, maxLength: 60 }),
            }
          ),
          { minItems: 3, maxItems: 40 },
        ),
      }
    ),
  },

  'criar-cena': {
    input: obj(
      {
        tema: str({ minLength: 3, maxLength: 200 }),
        formato: str({ enum: FORMAT }),
        personagens: arr(str({ maxLength: 80 }), { maxItems: 10 }),
        estiloVisual: str({ maxLength: 300 }),
        blocos: arr(
          obj({ ordem: int(), narracao: str({ maxLength: 1200 }), acao: str({ maxLength: 600 }) }),
          { minItems: 1, maxItems: 40 },
        ),
      }
    ),
    output: obj(
      {
        cenas: arr(
          obj(
            {
              numero: int({ minimum: 1, maximum: 60 }),
              duracaoSeg: int({ minimum: 1, maximum: 120 }),
              descricao: str({ minLength: 5, maxLength: 500 }),
              enquadramento: str({ minLength: 2, maxLength: 80 }),
              paleta: arr(str({ maxLength: 40 }), { maxItems: 6 }),
              promptImagem: str({ minLength: 20, maxLength: 1200 }),
              negativePrompt: str({ maxLength: 600 }),
              seed: int({ minimum: 0, maximum: 2147483647 }),
            }
          ),
          { minItems: 1, maxItems: 60 },
        ),
      }
    ),
  },

  'criar-thumbnail': {
    input: obj(
      {
        tema: str({ minLength: 3, maxLength: 200 }),
        titulo: str({ minLength: 3, maxLength: 120 }),
        personagemPrincipal: str({ maxLength: 80 }),
        paleta: arr(str({ maxLength: 40 }), { maxItems: 8 }),
        estilo: str({ maxLength: 300 }),
      }
    ),
    output: obj(
      {
        opcoes: arr(
          obj(
            {
              id: str({ minLength: 1, maxLength: 40 }),
              label: str({ minLength: 2, maxLength: 60 }),
              alt: str({ minLength: 10, maxLength: 300 }),
              conceito: str({ minLength: 10, maxLength: 400 }),
              textoNaArte: str({ maxLength: 40 }),
              promptImagem: str({ minLength: 20, maxLength: 1200 }),
              /**
               * `sugestao` é **informativo**: diz qual a IA acha mais forte. Ela nunca vem
               * pré-selecionada na tela — escolher thumbnail é ato humano (invariante nº 1).
               */
              sugestao: bool(),
            }
          ),
          { minItems: 3, maxItems: 4 },
        ),
      }
    ),
  },

  'criar-seo': {
    input: obj(
      {
        titulo: str({ minLength: 3, maxLength: 200 }),
        tema: str({ minLength: 2, maxLength: 200 }),
        roteiroResumo: str({ minLength: 10, maxLength: 2000 }),
        canalNome: str({ minLength: 2, maxLength: 120 }),
        publico: str({ maxLength: 200 }),
      }
    ),
    output: obj(
      {
        titulo: str({ minLength: 3, maxLength: 100 }),
        descricao: str({ minLength: 20, maxLength: 5000 }),
        tags: arr(str({ maxLength: 40 }), { minItems: 3, maxItems: 20 }),
        hashtags: arr(str({ maxLength: 40 }), { maxItems: 8 }),
        capitulos: arr(
          obj({ tempo: str({ maxLength: 10 }), rotulo: str({ maxLength: 100 }) }),
          { maxItems: 20 },
        ),
      }
    ),
  },

  'revisar-qualidade': {
    input: obj(
      {
        titulo: str({ minLength: 3, maxLength: 200 }),
        roteiroResumo: str({ minLength: 10, maxLength: 4000 }),
        formato: str({ enum: FORMAT }),
        idadeAlvo: str({ maxLength: 40 }),
      }
    ),
    output: obj(
      {
        veredito: str({ enum: ['aprovavel', 'precisa-ajuste', 'reprovavel'] }),
        nota: int({ minimum: 0, maximum: 100 }),
        rubrica: obj(
          {
            originalidade: int({ minimum: 0, maximum: 100 }),
            gancho: int({ minimum: 0, maximum: 100 }),
            clareza: int({ minimum: 0, maximum: 100 }),
            adequacaoEtaria: int({ minimum: 0, maximum: 100 }),
          }
        ),
        achados: arr(
          obj(
            {
              gravidade: str({ enum: SEVERITY }),
              criterio: str({ minLength: 3, maxLength: 80 }),
              evidencia: str({ minLength: 5, maxLength: 400 }),
              sugestao: str({ minLength: 5, maxLength: 400 }),
            }
          ),
          { maxItems: 12 },
        ),
      }
    ),
  },

  'revisar-infantil': {
    input: obj(
      {
        titulo: str({ minLength: 3, maxLength: 200 }),
        roteiroResumo: str({ minLength: 10, maxLength: 4000 }),
        idadeAlvo: str({ maxLength: 40 }),
      }
    ),
    output: obj(
      {
        adequado: bool(),
        bloqueante: bool(),
        faixaEtariaRecomendada: str({ minLength: 2, maxLength: 40 }),
        ritmoSegPorCena: int({ minimum: 1, maximum: 120 }),
        vocabulario: arr(str({ maxLength: 60 }), { maxItems: 20 }),
        valores: arr(str({ maxLength: 80 }), { maxItems: 10 }),
        achados: arr(
          obj(
            {
              gravidade: str({ enum: SEVERITY }),
              criterio: str({ minLength: 3, maxLength: 80 }),
              evidencia: str({ minLength: 5, maxLength: 400 }),
              sugestao: str({ minLength: 5, maxLength: 400 }),
            }
          ),
          { maxItems: 12 },
        ),
      }
    ),
  },

  'agendar-horario': {
    input: obj(
      {
        publico: str({ maxLength: 200 }),
        fusoHorario: str({ minLength: 3, maxLength: 60 }),
        formato: str({ enum: FORMAT }),
        historicoHorarios: arr(
          obj({ horario: str({ maxLength: 40 }), retencaoPct: num({ minimum: 0, maximum: 100 }) }),
          { maxItems: 60 },
        ),
      }
    ),
    output: obj(
      {
        recomendacao: obj(
          {
            diaSemana: str({ minLength: 3, maxLength: 20 }),
            hora: str({ minLength: 4, maxLength: 6 }),
            justificativa: str({ minLength: 10, maxLength: 400 }),
            confiancaPct: int({ minimum: 0, maximum: 100 }),
          }
        ),
        alternativas: arr(
          obj(
            { diaSemana: str({ maxLength: 20 }), hora: str({ maxLength: 6 }), justificativa: str({ maxLength: 300 }) }
          ),
          { maxItems: 3 },
        ),
      }
    ),
  },

  'medir-analise': {
    input: obj(
      {
        titulo: str({ minLength: 3, maxLength: 200 }),
        formato: str({ enum: FORMAT }),
        views: int({ minimum: 0 }),
        ctrPct: num({ minimum: 0, maximum: 100 }),
        retencaoPct: num({ minimum: 0, maximum: 100 }),
        watchHours: num({ minimum: 0 }),
        receitaBrl: num({ minimum: 0 }),
        custoUsd: num({ minimum: 0 }),
        cambioBrlPorUsd: num({ minimum: 0.01, maximum: 100 }),
        mediaCanal: obj(
          {
            views: num({ minimum: 0 }),
            ctrPct: num({ minimum: 0, maximum: 100 }),
            retencaoPct: num({ minimum: 0, maximum: 100 }),
          }
        ),
      }
    ),
    output: obj(
      {
        valeuAPena: str({ enum: ['sim', 'nao', 'empate'] }),
        roiPct: num({ minimum: -100, maximum: 100000 }),
        comparacaoVsMediaPct: num({ minimum: -100, maximum: 10000 }),
        leitura: str({ minLength: 20, maxLength: 1200 }),
        alertas: arr(str({ maxLength: 300 }), { maxItems: 8 }),
      }
    ),
  },

  'aprender-insight': {
    input: obj(
      {
        canalNome: str({ minLength: 2, maxLength: 120 }),
        itens: arr(
          obj(
            {
              titulo: str({ maxLength: 200 }),
              tema: str({ maxLength: 120 }),
              formato: str({ enum: FORMAT }),
              duracaoSeg: int({ minimum: 0, maximum: 7200 }),
              horario: str({ maxLength: 40 }),
              ctrPct: num({ minimum: 0, maximum: 100 }),
              retencaoPct: num({ minimum: 0, maximum: 100 }),
              views: int({ minimum: 0 }),
            }
          ),
          { minItems: 2, maxItems: 60 },
        ),
        rejeicoes: arr(str({ maxLength: 400 }), { maxItems: 40 }),
      }
    ),
    output: obj(
      {
        padroes: arr(
          obj(
            {
              padrao: str({ minLength: 10, maxLength: 400 }),
              forca: str({ enum: ['forte', 'moderada', 'fraca'] }),
              evidencia: str({ minLength: 5, maxLength: 400 }),
              acao: str({ minLength: 5, maxLength: 400 }),
            }
          ),
          { maxItems: 10 },
        ),
        evitar: arr(str({ maxLength: 300 }), { maxItems: 10 }),
      }
    ),
  },

  'melhorar-plano': {
    input: obj(
      {
        canalNome: str({ minLength: 2, maxLength: 120 }),
        padroes: arr(str({ maxLength: 400 }), { maxItems: 20 }),
        pautaAtual: arr(str({ maxLength: 200 }), { maxItems: 20 }),
        temasSaturados: arr(str({ maxLength: 120 }), { maxItems: 20 }),
        rejeicoes: arr(str({ maxLength: 400 }), { maxItems: 20 }),
      }
    ),
    output: obj(
      {
        mudancas: arr(
          obj(
            {
              de: str({ minLength: 3, maxLength: 300 }),
              para: str({ minLength: 3, maxLength: 300 }),
              porQue: str({ minLength: 10, maxLength: 400 }),
            }
          ),
          { maxItems: 10 },
        ),
        proximaSemana: arr(
          obj(
            {
              dia: str({ minLength: 3, maxLength: 20 }),
              formato: str({ enum: FORMAT }),
              tema: str({ minLength: 3, maxLength: 120 }),
              angulo: str({ minLength: 10, maxLength: 300 }),
            }
          ),
          { maxItems: 14 },
        ),
        confiancaPct: int({ minimum: 0, maximum: 100 }),
      }
    ),
  },

  'identidade-personagem': {
    input: obj(
      {
        pedido: str({ minLength: 5, maxLength: 800 }),
        canalNome: str({ minLength: 2, maxLength: 120 }),
        personagensExistentes: arr(str({ maxLength: 80 }), { maxItems: 20 }),
        paleta: arr(str({ maxLength: 40 }), { maxItems: 8 }),
        estiloVisual: str({ maxLength: 300 }),
      }
    ),
    output: obj(
      {
        nome: str({ minLength: 1, maxLength: 60 }),
        papel: str({ minLength: 3, maxLength: 120 }),
        descricaoVisual: str({ minLength: 20, maxLength: 900 }),
        tracos: arr(str({ maxLength: 80 }), { maxItems: 12 }),
        promptImagem: str({ minLength: 20, maxLength: 1200 }),
        negativePrompt: str({ maxLength: 600 }),
        seed: int({ minimum: 0, maximum: 2147483647 }),
        notasConsistencia: str({ minLength: 10, maxLength: 800 }),
      }
    ),
  },

  'monetizacao-veredito': {
    input: obj(
      {
        titulo: str({ minLength: 3, maxLength: 200 }),
        custoProducaoUsd: num({ minimum: 0 }),
        receitaBrl: num({ minimum: 0 }),
        views: int({ minimum: 0 }),
        cambioBrlPorUsd: num({ minimum: 0.01, maximum: 100 }),
        mediaCustoUsdCanal: num({ minimum: 0 }),
      }
    ),
    output: obj(
      {
        veredito: str({ enum: ['valeu', 'nao-valeu', 'empate'] }),
        margemUsd: num({ minimum: -1000000, maximum: 1000000 }),
        margemPct: num({ minimum: -10000, maximum: 1000000 }),
        custoPorMilViewsUsd: num({ minimum: 0, maximum: 1000000 }),
        recomendacao: str({ minLength: 20, maxLength: 1000 }),
        riscos: arr(str({ maxLength: 300 }), { maxItems: 8 }),
      }
    ),
  },

  'marketing-derivados': {
    input: obj(
      {
        titulo: str({ minLength: 3, maxLength: 200 }),
        tema: str({ minLength: 2, maxLength: 200 }),
        personagem: str({ maxLength: 80 }),
        canalNome: str({ minLength: 2, maxLength: 120 }),
        tom: str({ maxLength: 200 }),
        idadeAlvo: str({ maxLength: 40 }),
      }
    ),
    output: obj(
      {
        short: obj({ gancho: str({ minLength: 5, maxLength: 300 }), texto: str({ minLength: 5, maxLength: 800 }) }),
        instagram: obj(
          { legenda: str({ minLength: 5, maxLength: 1500 }), hashtags: arr(str({ maxLength: 40 }), { maxItems: 15 }) }
        ),
        tiktok: obj({ texto: str({ minLength: 5, maxLength: 800 }) }),
        comunidadeYoutube: obj({ texto: str({ minLength: 5, maxLength: 1000 }) }),
        story: obj({ texto: str({ minLength: 3, maxLength: 400 }) }),
      }
    ),
  },
};

export function getFunctionSchema(id: string): FunctionSchema | null {
  return Object.prototype.hasOwnProperty.call(FUNCTION_SCHEMAS, id)
    ? (FUNCTION_SCHEMAS[id] as FunctionSchema)
    : null;
}
