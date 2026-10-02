/**
 * A função `identidade-personagem` devolvendo **opções** — e o refino derivando da ficha escolhida.
 *
 * A lacuna que este teste fecha: o schema antigo devolvia **uma** ficha, e o PDF do cliente pede *"o
 * sistema gera opções. Eu escolho uma"*. Com saída única não havia escolha a oferecer.
 *
 * Aqui a saída do provedor simulado é validada contra o **mesmo schema** que a saída real precisa
 * cumprir (é a regra do `registry.test.ts`, aplicada ao caminho de refino, que a fixture não cobre).
 */

import { describe, expect, it } from 'vitest';
import { AI_FUNCTIONS } from '@/ai/contract';
import { getFunctionSchema, validateSchema } from '@/ai/schemas';
import { simulate } from '../../../../server/ai/simulated';

const ENTRADA_BASE: Record<string, unknown> = {
  pedido: 'Quero um cachorro pequeno, divertido e curioso para ser amigo da Luna.',
  canalNome: 'Luna e o Jardim das Cores',
  personagensExistentes: ['Luna', 'Tico'],
  paleta: ['#F472B6', '#FBBF24'],
  estiloVisual: 'flat 2D children illustration',
  ajuste: '',
  personagemBase: [],
};

/** A ficha já oficial do canal — é ela que o humano aponta quando pede refino. */
const FICHA_DE_ORIGEM = {
  nome: 'Tico',
  papel: 'Cachorro curioso, melhor amigo',
  descricaoVisual:
    'Cachorro pequeno e arredondado, corpo branco com mancha caramelo na orelha direita, orelhas grandes e caídas, sem coleira.',
  tracos: ['orelhas grandes e caídas', 'sem coleira', 'mancha caramelo na orelha direita'],
  promptImagem: 'small rounded white cartoon dog, large floppy ears, no collar, neutral background, full body',
  negativePrompt: 'collar, extra limbs, text, watermark',
  seed: 2210,
  notasConsistencia: 'Não alterar: ausência de coleira e a mancha caramelo na orelha direita.',
};

function simular(input: Record<string, unknown>): { opcoes: Record<string, unknown>[] } {
  const response = simulate('identidade-personagem', {
    channelId: 'luna',
    channelName: 'Luna e o Jardim das Cores',
    childDirected: true,
    ageRange: '3 a 5 anos',
    input,
  });
  return JSON.parse(response.raw) as { opcoes: Record<string, unknown>[] };
}

function errosDeSchema(dados: unknown): string[] {
  const schema = getFunctionSchema('identidade-personagem');
  expect(schema).not.toBeNull();
  if (!schema) return ['sem schema'];
  return validateSchema(schema.output, dados);
}

describe('identidade-personagem: opções', () => {
  it('a criação devolve 2 ou 3 opções distintas, e todas passam no schema', () => {
    const { opcoes } = simular(ENTRADA_BASE);

    expect(opcoes.length).toBeGreaterThanOrEqual(2);
    expect(opcoes.length).toBeLessThanOrEqual(3);

    // Opções iguais não seriam escolha: nome e seed têm de ser distintos.
    expect(new Set(opcoes.map((opcao) => opcao['nome'])).size).toBe(opcoes.length);
    expect(new Set(opcoes.map((opcao) => opcao['seed'])).size).toBe(opcoes.length);

    expect(errosDeSchema({ opcoes })).toEqual([]);
  });

  it('o refino deriva da ficha escolhida: mantém o que já foi aceito e registra o ajuste', () => {
    const ajuste = 'orelhas maiores e sem coleira';
    const { opcoes } = simular({
      ...ENTRADA_BASE,
      ajuste,
      personagemBase: [FICHA_DE_ORIGEM],
    });

    expect(opcoes.length).toBeGreaterThanOrEqual(2);
    expect(errosDeSchema({ opcoes })).toEqual([]);

    for (const opcao of opcoes) {
      // Nome, papel e traços da ficha de origem sobrevivem ao refino — é isso que faz dele um refino
      // e não um personagem novo.
      expect(opcao['nome']).toBe(FICHA_DE_ORIGEM.nome);
      expect(opcao['papel']).toBe(FICHA_DE_ORIGEM.papel);
      expect(opcao['tracos'] as string[]).toEqual(expect.arrayContaining(FICHA_DE_ORIGEM.tracos));

      // O ajuste pedido fica registrado na descrição e nas notas de consistência.
      expect(String(opcao['descricaoVisual'])).toContain(ajuste);
      expect(String(opcao['notasConsistencia'])).toContain(ajuste);
    }

    // E não é a criação do zero: sem `personagemBase`, as opções são outras.
    const criacao = simular(ENTRADA_BASE);
    expect(criacao.opcoes.map((opcao) => opcao['nome'])).not.toContain(FICHA_DE_ORIGEM.nome);
  });

  it('o schema recusa menos de duas opções — "escolha" com uma só seria decorativa', () => {
    const umaOpcao = [simular(ENTRADA_BASE).opcoes[0]];
    const erros = errosDeSchema({ opcoes: umaOpcao });
    expect(erros.join(' ')).toMatch(/pelo menos 2/);
  });

  it('o schema recusa mais de três opções', () => {
    const base = simular(ENTRADA_BASE).opcoes[0];
    const quatro = [base, base, base, base];
    const erros = errosDeSchema({ opcoes: quatro });
    expect(erros.join(' ')).toMatch(/no máximo 3/);
  });

  it('a saída antiga (ficha única) não passa mais no schema', () => {
    // Prova de que a mudança de contrato é real: quem ainda devolver `{nome, papel, …}` é recusado.
    const fichaUnica = simular(ENTRADA_BASE).opcoes[0] as Record<string, unknown>;
    const erros = errosDeSchema(fichaUnica);
    expect(erros.join(' ')).toMatch(/opcoes/);
  });

  it('a função continua sem poder aprovar ou gravar nada', () => {
    expect(AI_FUNCTIONS['identidade-personagem'].effect).toBe('propoe-rascunho');
    expect(AI_FUNCTIONS['identidade-personagem'].requiresHumanApproval).toBe(true);
    expect(AI_FUNCTIONS['identidade-personagem'].promptVersion).toBe(2);
  });
});
