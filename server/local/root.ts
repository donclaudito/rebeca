/**
 * Raiz do app instalado.
 *
 * ## Por que este arquivo existe
 *
 * Em produção na nuvem, "onde está o app" não é pergunta: o bundle é a raiz e não há disco. Instalado
 * na máquina de alguém, a pergunta passa a ter consequência — `.rebeca/assets`, `.rebeca/custos.csv`,
 * `.rebeca/segredos` e `.rebeca/canais` precisam estar **ao lado do app**, e é isso que faz "copiar a
 * pasta" ser backup suficiente.
 *
 * O resto do servidor descobre a raiz por `repoRoot()` (`server/media/paths.ts`), que lê
 * `REBECA_ROOT` do ambiente e cai para `process.cwd()` quando a variável não existe. As duas fontes
 * são ruins para o app instalado: `process.cwd()` depende de **como** o atalho foi criado — arrastar o
 * `Rebeca.cmd` para a área de trabalho e clicar nele costuma abrir com o diretório do sistema, e o app
 * passaria a ler e gravar `.rebeca/` no lugar errado (ou a não achar `.rebeca/canais/`, e o pipeline
 * morreria dizendo que o canal não existe).
 *
 * Aqui a raiz é **derivada da posição do próprio arquivo compilado**, e não de como o processo foi
 * iniciado:
 *
 *   `<app>/build/server/local/root.js`  →  `..` `..` `..`  →  `<app>`
 *
 * Consequência aceita de propósito: **este módulo só funciona compilado** por
 * `tsc -p tsconfig.server.json` (o caminho acima é o layout de `build/`). Rodar `server/local/cli.ts`
 * direto no Node não é um caminho suportado — e não poderia ser: os imports do servidor usam o
 * specifier `.js`, exigência do ESM da Vercel (ver "Correção — HTTP 500" em `.rebeca/estado.md`), e o
 * Node não resolve `.js` para `.ts`.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A pasta do app: onde vivem `dist/`, `build/`, `.rebeca/` e `vercel.json`. */
export function appRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}
