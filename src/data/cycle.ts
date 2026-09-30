/**
 * Ciclo canônico do produto — fonte única da ordem e dos rótulos das etapas.
 *
 * A fonte de verdade do produto é `docs/00-visao-produto.md` §3:
 *
 *   Pesquisar → Planejar → Criar → Revisar → Aprovar → Agendar → Publicar → Medir → Aprender → Melhorar
 *
 * Este arquivo é a tradução executável dessa linha. Nenhum lugar do código deve repetir a lista à
 * mão: quem precisa das etapas em ordem lê `CYCLE_ORDER`; quem precisa do nome que aparece na tela
 * lê `CYCLE_LABEL`. O teste `src/data/__tests__/cycle.test.ts` lê o próprio `docs/00` e refuta a
 * divergência entre documento e código — que é exatamente o defeito que existia aqui (a lista do
 * código tinha 9 etapas, sem `agendar`, e chamava a última de `ajustar`).
 *
 * `CycleStage` (em `./types`) é só o vocabulário; aqui ficam a ordem e o texto pt-BR.
 */

import type { CycleStage } from './types';

/** As 10 etapas, na ordem em que acontecem. A ordem é requisito, não estética. */
export const CYCLE_ORDER: readonly CycleStage[] = [
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

/**
 * Rótulo em pt-BR de cada etapa — o texto que o usuário vê.
 *
 * `Record<CycleStage, string>` é intencional: se alguém acrescentar uma etapa em `CycleStage` sem
 * descrevê-la aqui, o `tsc` quebra. Tipo incompleto não passa.
 */
export const CYCLE_LABEL: Record<CycleStage, string> = {
  pesquisar: 'Pesquisar',
  planejar: 'Planejar',
  criar: 'Criar',
  revisar: 'Revisar',
  aprovar: 'Aprovar',
  agendar: 'Agendar',
  publicar: 'Publicar',
  medir: 'Medir',
  aprender: 'Aprender',
  melhorar: 'Melhorar',
};

/**
 * A etapa que **só o humano** pode executar (AGENTS.md, invariante nº 1).
 *
 * Vive aqui, e não como número solto na interface, para que "o passo 5 é humano" continue verdade
 * se a ordem do ciclo mudar.
 */
export const HUMANS_ONLY_STAGE: CycleStage = 'aprovar';

/** Posição 1-based de uma etapa no ciclo — a numeração que aparece na tela. */
export function cyclePosition(stage: CycleStage): number {
  return CYCLE_ORDER.indexOf(stage) + 1;
}
