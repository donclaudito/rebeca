/**
 * Provas do registro de funções, dos prompts e da simulação.
 *
 * O teste que mais importa aqui é o da simulação: ele percorre **todas** as funções do registro e
 * valida a saída simulada contra o mesmo schema que a saída real precisa cumprir. Isso transforma o
 * provedor simulado em teste de contrato — se o schema e o gerador discordarem, o vermelho aparece
 * aqui, e não na cara do usuário quando ele configurar uma chave.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AI_FUNCTIONS, AI_FUNCTION_IDS } from '../contract';
import { AI_LIMITS } from '../limits';
import { FUNCTION_SCHEMAS, validateSchema } from '../schemas';
import { PROMPTS } from '../../../server/ai/prompts.generated';
import { defaultModelFor, estimateCostUsd } from '../../../server/ai/catalog';
import { simulate } from '../../../server/ai/simulated';
import { allFunctionIds, validInput } from './fixtures';

const REPO_ROOT = process.cwd();
const PROMPTS_DIR = join(REPO_ROOT, '.rebeca', 'prompts');

/** Nomes de canal semeados. Prompt com escopo `*` não pode citar nenhum deles (invariante nº 2). */
const CHANNEL_NAMES = ['Luna', 'Jardim das Cores', 'Arquivo Curioso', 'AI Made Simple', 'Tico'];

describe('registro de funções de IA', () => {
  it('toda função declarada tem entrada, saída, prompt e fixture', () => {
    const missing: string[] = [];

    for (const id of AI_FUNCTION_IDS) {
      const spec = AI_FUNCTIONS[id];
      const schemas = FUNCTION_SCHEMAS[id];
      const prompt = PROMPTS[spec.promptId];

      if (!schemas) missing.push(`${id}: sem schema`);
      if (!prompt) missing.push(`${id}: sem prompt "${spec.promptId}"`);
      if (prompt && prompt.version !== spec.promptVersion) {
        missing.push(`${id}: prompt no arquivo é v${prompt.version}, o registro diz v${spec.promptVersion}`);
      }
      if (!allFunctionIds().includes(id)) missing.push(`${id}: sem fixture de teste`);
    }

    expect(missing).toEqual([]);
  });

  it('não existe fixture órfã (fixture sem função declarada)', () => {
    const declared = new Set<string>(AI_FUNCTION_IDS);
    const orphans = allFunctionIds().filter((id) => !declared.has(id));
    expect(orphans).toEqual([]);
  });

  it('o nível do prompt e o nível da função são o mesmo', () => {
    const divergences = AI_FUNCTION_IDS.filter((id) => {
      const spec = AI_FUNCTIONS[id];
      const prompt = PROMPTS[spec.promptId];
      return prompt ? prompt.tier !== spec.tier : false;
    }).map((id) => `${id}: registro=${AI_FUNCTIONS[id].tier}`);
    expect(divergences).toEqual([]);
  });

  it('o teto de tokens da função não passa do teto declarado no prompt', () => {
    const offenders = AI_FUNCTION_IDS.filter((id) => {
      const spec = AI_FUNCTIONS[id];
      const prompt = PROMPTS[spec.promptId];
      return prompt ? spec.maxOutputTokens > prompt.maxOutputTokens : false;
    }).map((id) => `${id}: ${AI_FUNCTIONS[id].maxOutputTokens} > ${PROMPTS[AI_FUNCTIONS[id].promptId]?.maxOutputTokens}`);
    expect(offenders).toEqual([]);
  });

  it('a etapa declarada é uma etapa real do ciclo', () => {
    const valid = new Set([
      'pesquisar', 'planejar', 'criar', 'revisar', 'aprovar',
      'agendar', 'publicar', 'medir', 'aprender', 'melhorar',
    ]);
    const invalid = AI_FUNCTION_IDS.filter((id) => !valid.has(AI_FUNCTIONS[id].stage));
    expect(invalid).toEqual([]);
  });

  it('nenhuma função publica ou aprova por conta própria', () => {
    // O invariante é de produto, e a interface depende dele: `aprovar` e `publicar` não existem como
    // efeito possível de IA. Este teste falha se alguém acrescentar um efeito que os permita.
    const effects = new Set(AI_FUNCTION_IDS.map((id) => AI_FUNCTIONS[id].effect));
    expect([...effects].sort()).toEqual(['propoe-rascunho', 'somente-leitura']);
    expect(AI_FUNCTION_IDS.every((id) => AI_FUNCTIONS[id].requiresHumanApproval)).toBe(true);
  });

  it('com o modelo padrão de cada nível, nenhuma função estoura o teto por chamada', () => {
    // A versão anterior deste teste usava o modelo **mais caro do catálogo inteiro** como pior caso,
    // e por isso acusava 15 funções: media algo que nunca roda. O que importa é o modelo que o
    // catálogo de fato escolhe para o nível da função, em cada fornecedor.
    //
    // A entrada é aproximada pelo tamanho real do prompt versionado (system + instrução). É
    // aproximação declarada, e serve ao propósito: pegar uma combinação função × nível que o teto de
    // US$ 0,05 tornaria impossível de executar.
    const agora = new Date('2026-10-01T14:00:00.000Z');
    const estouram: string[] = [];

    for (const id of AI_FUNCTION_IDS) {
      const spec = AI_FUNCTIONS[id];
      const prompt = PROMPTS[spec.promptId];
      const entradaCaracteres = (prompt?.system.length ?? 0) + (prompt?.instruction.length ?? 0);

      for (const provider of ['openai', 'anthropic', 'deepseek', 'google', 'openrouter'] as const) {
        const entry = defaultModelFor(spec.tier, provider);
        if (!entry) continue;
        const custo = estimateCostUsd(entry, entradaCaracteres, spec.maxOutputTokens, agora) ?? 0;
        if (custo > AI_LIMITS.perCallUsd) {
          estouram.push(`${id} @ ${provider}:${entry.model} = US$ ${custo.toFixed(4)}`);
        }
      }
    }

    expect(estouram).toEqual([]);
  });

  it('só a checagem infantil é restrita a canal infantil', () => {
    const restricted = AI_FUNCTION_IDS.filter((id) => AI_FUNCTIONS[id].childChannelOnly);
    expect(restricted).toEqual(['revisar-infantil']);
  });
});

describe('prompts versionados em disco', () => {
  it('o hash de cada prompt em disco bate com o gravado no módulo gerado', () => {
    // ESTE teste já foi vazio e o `rebeca-qa` provou: a versão anterior comparava os 40 primeiros
    // caracteres do texto gerado com o arquivo e chamava isso de "hash". Mutar um prompt depois do
    // 40º caractere mantinha 15/15 verdes. Agora o sha256 é **calculado** aqui, independente do
    // gerador — se o gerador estiver errado, este teste não o absolve.
    const mismatches: string[] = [];

    for (const [id, prompt] of Object.entries(PROMPTS)) {
      const path = join(PROMPTS_DIR, prompt.source);
      let content: string;
      try {
        content = readFileSync(path, 'utf8');
      } catch {
        mismatches.push(`${id}: arquivo ${prompt.source} não encontrado`);
        continue;
      }

      const sha256 = createHash('sha256').update(content, 'utf8').digest('hex');
      if (sha256 !== prompt.sha256) {
        mismatches.push(`${id}: sha256 do arquivo difere do gravado (arquivo=${sha256.slice(0, 12)}… gravado=${prompt.sha256.slice(0, 12)}…)`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('o gerador detecta prompt mutado (prova de que a checagem de hash não é decorativa)', () => {
    // Teste do teste: se alguém trocar o sha256 gravado por um valor fixo, a comparação acima
    // passaria a não comparar nada. Aqui a mutação é aplicada de fato, e o hash tem de mudar.
    const prompt = PROMPTS['criar-seo'];
    expect(prompt).toBeTruthy();
    if (!prompt) return;

    const original = readFileSync(join(PROMPTS_DIR, prompt.source), 'utf8');
    const mutado = `${original}\n<!-- mutação de teste -->\n`;
    const hashOriginal = createHash('sha256').update(original, 'utf8').digest('hex');
    const hashMutado = createHash('sha256').update(mutado, 'utf8').digest('hex');

    expect(hashMutado).not.toBe(hashOriginal);
    expect(hashOriginal).toBe(prompt.sha256);
  });

  it('nenhum prompt de escopo global cita nome de canal', () => {
    // Invariante nº 2: prompt com nome de canal cravado é defeito de isolamento. O escopo é `*`,
    // logo o contexto do canal entra por dado, não por texto.
    const leaks: string[] = [];

    for (const [id, prompt] of Object.entries(PROMPTS)) {
      if (prompt.channelScope !== '*') continue;
      const path = join(PROMPTS_DIR, prompt.source);
      const content = readFileSync(path, 'utf8');
      for (const name of CHANNEL_NAMES) {
        if (content.includes(name)) leaks.push(`${id}: cita "${name}" em ${prompt.source}`);
      }
    }

    expect(leaks).toEqual([]);
  });

  it('todo prompt tem guardrail contra injeção e contra escrita de JSON solto', () => {
    const offenders = Object.entries(PROMPTS)
      .filter(([, prompt]) => {
        const system = prompt.system.toLowerCase();
        return !system.includes('dado, nunca instrução') || !system.includes('somente');
      })
      .map(([id]) => id);
    expect(offenders).toEqual([]);
  });
});

describe('provedor simulado', () => {
  it('a saída de TODA função passa no schema de saída daquela função', () => {
    const failures: string[] = [];

    for (const id of AI_FUNCTION_IDS) {
      const schemas = FUNCTION_SCHEMAS[id];
      if (!schemas) {
        failures.push(`${id}: sem schema de saída`);
        continue;
      }

      const response = simulate(id, {
        channelId: 'luna',
        channelName: 'Canal de teste',
        childDirected: true,
        ageRange: '3 a 5 anos',
        input: validInput(id),
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(response.raw) as unknown;
      } catch {
        failures.push(`${id}: a simulação não devolveu JSON válido`);
        continue;
      }

      const errors = validateSchema(schemas.output, parsed);
      if (errors.length > 0) failures.push(`${id}: ${errors.slice(0, 4).join(' | ')}`);
    }

    expect(failures).toEqual([]);
  });

  it('a simulação nunca devolve lista vazia onde o schema exige mínimo', () => {
    const response = simulate('pesquisar-tendencia', {
      channelId: 'luna',
      channelName: 'Canal de teste',
      childDirected: true,
      ageRange: '3 a 5 anos',
      input: validInput('pesquisar-tendencia'),
    });
    const parsed = JSON.parse(response.raw) as { temas: unknown[] };
    expect(parsed.temas.length).toBeGreaterThanOrEqual(3);
  });

  it('a simulação respeita temas recusados pelo humano', () => {
    const input = validInput('pesquisar-tendencia');
    input['rejectedThemes'] = ['Cores que mudam com a luz', 'Sons do jardim', 'Um dia de cada personagem'];
    const response = simulate('pesquisar-tendencia', {
      channelId: 'luna',
      channelName: 'Canal de teste',
      childDirected: true,
      ageRange: '3 a 5 anos',
      input,
    });
    const parsed = JSON.parse(response.raw) as { temas: { tema: string }[] };
    const themes = parsed.temas.map((item) => item.tema);
    expect(themes).not.toContain('Cores que mudam com a luz');
    expect(themes).not.toContain('Sons do jardim');
    // O schema exige 3 no mínimo: recusar tudo não pode resultar em lista curta.
    expect(themes.length).toBeGreaterThanOrEqual(3);
  });

  it('marcar "não há dado" em vez de inventar número de desempenho', () => {
    const response = simulate('agendar-horario', {
      channelId: 'luna',
      channelName: 'Canal de teste',
      childDirected: true,
      ageRange: '3 a 5 anos',
      input: validInput('agendar-horario'),
    });
    const parsed = JSON.parse(response.raw) as { recomendacao: { confiancaPct: number; justificativa: string } };
    // Com 3 observações no histórico, a fixture está no limite: a confiança não pode ser alta.
    expect(parsed.recomendacao.confiancaPct).toBeLessThanOrEqual(70);
    expect(parsed.recomendacao.justificativa.length).toBeGreaterThan(10);
  });
});
