/**
 * Refuta a divergência entre o ciclo **documentado** e o ciclo **codificado**.
 *
 * O defeito que originou este teste: `docs/00-visao-produto.md` §3 declara 10 verbos
 * (… → Aprovar → **Agendar** → **Publicar** → … → **Melhorar**), mas o código tinha 9 etapas — sem
 * `agendar` — e chamava a última de `ajustar`. Duas fontes de verdade, uma errada.
 *
 * Aqui `docs/00` é lido do disco: se alguém mudar o documento ou a lista do código sem alinhar o
 * outro, o teste quebra. É de propósito que ele leia o arquivo em vez de repetir a lista.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CYCLE_LABEL, CYCLE_ORDER, HUMANS_ONLY_STAGE, cyclePosition } from '@/data/cycle';
import { channels, contents, modulesFor } from '@/data/mock/db';
import type { CycleStage } from '@/data/types';

/** As 10 etapas, transcritas do que o dono do produto declarou — a referência externa ao código. */
const CANONICO: CycleStage[] = [
  'pesquisar',
  'planejar',
  'criar',
  'revisar',
  'aprovar',
  'agendar',
  'publicar',
  'medir',
  'aprender',
  'melhorar',
];

describe('ciclo canônico', () => {
  it('tem 10 etapas, na ordem declarada pelo dono do produto', () => {
    expect(CYCLE_ORDER).toEqual(CANONICO);
  });

  it('não repete etapa nem deixa nenhuma sem rótulo em pt-BR', () => {
    expect(new Set(CYCLE_ORDER).size).toBe(CYCLE_ORDER.length);
    expect([...CYCLE_ORDER].sort()).toEqual(Object.keys(CYCLE_LABEL).sort());

    for (const stage of CYCLE_ORDER) {
      // Rótulo capitalizado, uma palavra, sem termo interno.
      expect(CYCLE_LABEL[stage]).toMatch(/^[A-Z][a-z]+$/);
    }
  });

  it('separa Agendar de Publicar, e agendar vem antes', () => {
    const agendar = CYCLE_ORDER.indexOf('agendar');
    const publicar = CYCLE_ORDER.indexOf('publicar');

    expect(agendar).toBeGreaterThan(-1);
    expect(publicar).toBeGreaterThan(-1);
    expect(agendar).toBeLessThan(publicar);
  });

  it('não usa mais "Ajustar" como nome da etapa que fecha o ciclo', () => {
    // `'ajustar'` não pertence a `CycleStage` — é exatamente o nome antigo que este teste vigia.
    expect(CYCLE_ORDER as readonly string[]).not.toContain('ajustar');
    expect(CYCLE_LABEL.melhorar).toBe('Melhorar');
  });

  it('mantém a aprovação como a etapa humana — e ela continua sendo a 5ª', () => {
    expect(HUMANS_ONLY_STAGE).toBe('aprovar');
    expect(cyclePosition(HUMANS_ONLY_STAGE)).toBe(5);
    expect(CYCLE_LABEL[HUMANS_ONLY_STAGE]).toBe('Aprovar');
  });

  it('conta a mesma história que docs/00-visao-produto.md §3', () => {
    const doc = readFileSync(resolve(process.cwd(), 'docs/00-visao-produto.md'), 'utf8');
    const linhaDoDoc = CYCLE_ORDER.map((stage) => CYCLE_LABEL[stage]).join(' → ');

    expect(doc).toContain(linhaDoDoc);
  });

  it('não deixa conteúdo nem módulo de exemplo numa etapa fora do ciclo', () => {
    expect(contents.length).toBeGreaterThan(0);

    for (const item of contents) {
      expect(CYCLE_ORDER, `conteúdo ${item.id}`).toContain(item.stage);
    }

    for (const channel of channels) {
      const modulos = modulesFor(channel.id);
      expect(modulos.length).toBeGreaterThan(0);
      for (const modulo of modulos) {
        expect(CYCLE_ORDER, `módulo ${modulo.id} do canal ${channel.id}`).toContain(modulo.stage);
      }
    }
  });

  it('não deixa nenhum módulo de agendamento apontando para a etapa de publicar', () => {
    for (const channel of channels) {
      const agendamento = modulesFor(channel.id).find((modulo) => modulo.id === 'agendamento');
      expect(agendamento?.stage).toBe('agendar');
    }
  });
});
