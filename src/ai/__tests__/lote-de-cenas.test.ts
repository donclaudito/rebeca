/**
 * O lote do storyboard é **contrato**, não estilo — este teste é o cadeado do HTTP 502.
 *
 * O que aconteceu, medido em 2026-10-02 (`.rebeca/evidencias/502-criar-cena-teto-de-tokens.txt`): o
 * schema de `criar-cena` aceitava `blocos` até 40 e `cenas` até 60 — o episódio inteiro numa resposta só.
 * Com o teto de saída da função, um roteiro de 24 blocos **não cabia**: o modelo truncava o JSON, a
 * correção automática truncava de novo, e a resposta era **HTTP 502 `schema-invalido`** depois de ~120 s.
 * A linha do livro registrou `tokens_out: 6000` — as duas tentativas somadas, teto batendo dos dois lados.
 *
 * Pior: quando "passava", passava com **uma cena** para um vídeo de 492 s. O mesmo teto produzia o erro
 * e o resultado vazio.
 *
 * Agora a entrada é de 1 a 3 blocos e a saída de 1 a 4 cenas, e quem encadeia os lotes é a tela. Estes
 * testes prendem os dois tetos: se alguém "relaxar" o schema para aceitar o roteiro inteiro de novo, o
 * defeito volta inteiro — e volta em silêncio, porque só aparece com roteiro longo.
 */

import { describe, expect, it } from 'vitest';
import { getFunctionSchema, validateSchema } from '../schemas';

const schema = getFunctionSchema('criar-cena');

function bloco(ordem: number) {
  return { ordem, narracao: `Narração ${ordem}.`, acao: `Ação ${ordem}.` };
}

function entrada(quantidadeDeBlocos: number) {
  return {
    tema: 'Borboletas e cores',
    formato: 'video',
    personagens: ['Luna'],
    estiloVisual: 'flat 2D children illustration',
    blocos: Array.from({ length: quantidadeDeBlocos }, (_, indice) => bloco(indice + 1)),
  };
}

function cena(numero: number) {
  return {
    numero,
    duracaoSeg: 14,
    descricao: 'Luna no jardim.',
    enquadramento: 'plano médio',
    paleta: ['#7DD3FC'],
    promptImagem: 'a small round character standing in a bright garden, soft light',
    negativePrompt: 'text, watermark',
    seed: 100 + numero,
  };
}

describe('criar-cena trabalha por lote', () => {
  it('o schema existe e é o da função registrada', () => {
    expect(schema, 'criar-cena não está no registro de schemas').not.toBeNull();
    expect(schema?.input).toBeDefined();
    expect(schema?.output).toBeDefined();
  });

  it('**recusa** o lote de 24 blocos que causou o 502', () => {
    const erros = validateSchema(schema!.input, entrada(24));
    expect(erros.length, 'o roteiro inteiro voltou a ser aceito numa chamada só').toBeGreaterThan(0);
  });

  it('aceita o lote de 3 blocos — o tamanho que a tela envia', () => {
    expect(validateSchema(schema!.input, entrada(3))).toEqual([]);
  });

  it('aceita um lote de 1 bloco (o resto da divisão)', () => {
    expect(validateSchema(schema!.input, entrada(1))).toEqual([]);
  });

  /*
   * O defeito que chegou à tela do dono como **"A entrada da função não está no formato esperado."**
   *
   * O bloco do roteiro (`RoteiroBloco`) tem seis campos: `ordem`, `tempoInicioSeg`, `tempoFimSeg`,
   * `narracao`, `acao`, `emocao`. O bloco de `criar-cena` tem **três**. Como `obj()` emite
   * `additionalProperties: false`, mandar o bloco inteiro é recusado **antes** de qualquer chamada ao
   * provedor — a mensagem que aparece na tela é a da validação de entrada.
   *
   * Estes dois casos prendem os dois lados: o cru é recusado, o reduzido é aceito. Se alguém "facilitar"
   * o schema para aceitar o cru, o primeiro fica vermelho; se alguém voltar a mandar o cru, o teste da
   * tela (`revisao.test.tsx`) valida o corpo contra este mesmo schema e fica vermelho também.
   */
  it('**recusa** bloco com campo a mais — o defeito "não está no formato esperado"', () => {
    const cru = {
      tema: 'Borboletas e cores',
      formato: 'video',
      personagens: ['Luna'],
      estiloVisual: 'flat 2D children illustration',
      blocos: [
        { ordem: 1, tempoInicioSeg: 0, tempoFimSeg: 10, narracao: 'n', acao: 'a', emocao: 'alegria' },
      ],
    };
    expect(validateSchema(schema!.input, cru).length).toBeGreaterThan(0);
  });

  it('aceita o mesmo bloco reduzido a ordem, narracao e acao', () => {
    const reduzido = {
      tema: 'Borboletas e cores',
      formato: 'video',
      personagens: ['Luna'],
      estiloVisual: 'flat 2D children illustration',
      blocos: [{ ordem: 1, narracao: 'n', acao: 'a' }],
    };
    expect(validateSchema(schema!.input, reduzido)).toEqual([]);
  });

  it('recusa lote vazio — chamada sem bloco nenhum não tem o que virar cena', () => {
    expect(validateSchema(schema!.input, entrada(0)).length).toBeGreaterThan(0);
  });

  it('recusa resposta com mais de 4 cenas — é o teto que faz a saída caber no orçamento', () => {
    const cinco = { cenas: [1, 2, 3, 4, 5].map(cena) };
    expect(validateSchema(schema!.output, cinco).length).toBeGreaterThan(0);
  });

  it('aceita resposta com 4 cenas — a folga para uma cena de transição', () => {
    const quatro = { cenas: [1, 2, 3, 4].map(cena) };
    expect(validateSchema(schema!.output, quatro)).toEqual([]);
  });
});
