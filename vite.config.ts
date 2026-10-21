/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aiDevServer } from './server/ai/vite-plugin';
import { mediaDevServer } from './server/media/vite-plugin';
import { authDevServer } from './server/auth/vite-plugin';

/**
 * O watcher do Vite **derruba o processo** quando `fs.watch` falha com `EBUSY`/`EPERM`: o erro é
 * emitido como evento `error` no `FSWatcher` e, sem listener, o Node encerra.
 *
 * Neste projeto isso não é hipótese — aconteceu duas vezes, com o dev server no ar:
 *   1. gravando `.rebeca/estado.md` (arquivo temporário dentro de `.rebeca/`);
 *   2. gravando `.gitignore` (diretório temporário na **raiz**).
 *
 * A raiz guarda muito mais que o app (memória durável, orquestra, ferramentas, docs, imagens, store
 * do pnpm) e várias ferramentas gravam de forma atômica, criando `.tmpdir` no meio do caminho. Ignorar
 * pastas resolve o caso conhecido; este listener garante que **qualquer** falha futura de watcher vire
 * aviso em vez de queda do servidor.
 */
function watchErrorGuard(): Plugin {
  return {
    name: 'ams-watch-error-guard',
    configureServer(server) {
      server.watcher.on('error', (error: Error) => {
        server.config.logger.warn(
          `[watcher] ${error.message} — erro de observação ignorado; o servidor continua no ar.`,
        );
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), authDevServer(), aiDevServer(), mediaDevServer(), watchErrorGuard()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      watch: {
        ignored: [
          '**/.rebeca/**',
          '**/.dsh/**',
          '**/.tools/**',
          '**/.pnpm-store/**',
          '**/docs/**',
          '**/imagens/**',
          '**/dist/**',
          '**/coverage/**',
          // Gravação atômica: a ferramenta cria `<arquivo>.<pid>.<guid>.tmpdir/` ao lado do original.
          // Sem esta linha, qualquer arquivo escrito na raiz ou em `src/` derruba o servidor.
          '**/*.tmpdir/**',
        ],
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./vitest.setup.ts'],
      css: false,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      // Os testes de tela (jsdom + React 19 + userEvent) levam de 3 a 5s **por teste** nesta máquina —
      // o padrão de 5s deixava a suíte instável: rodadas seguidas falhavam em testes diferentes
      // ("trocar de canal limpa o DOM…" 5.327ms numa, "não deixa aprovar sem thumbnail…" 4.509ms na
      // seguinte) sem nenhuma asserção quebrada. Suíte que falha por tempo ensina o time a ignorar o
      // vermelho, então o limite explícito é maior — e continua sendo um limite, não uma espera eterna.
      testTimeout: 30_000,
      hookTimeout: 30_000,
      // `threads` em vez de `forks`: os testes não precisam de processo separado e o pool de threads
      // dispensa IPC entre processos, que é o que trava em ambiente confinado.
      pool: 'threads',
      /*
       * Teto de workers e tempo das consultas assíncronas — calibrados por medição, não por palpite.
       *
       * Esta máquina tem **6 processadores lógicos**. A suíte cresceu de 13 para **44 arquivos**, e o
       * que era um teto suficiente passou a não ser: o render de jsdom + React 19 que leva ~1,5 s com a
       * máquina ociosa passa de 5 s com quatro ambientes pesados disputando CPU, e o `findBy*` estoura.
       *
       * Sintoma medido (não conjectura): rodadas seguidas da suíte completa falhavam em **arquivos
       * diferentes**, sempre por tempo — `Test timed out in 20000ms` e `Unable to find role="button"` —
       * e **cada arquivo passava isolado** (30/30 em `identidade` + `revisao`, 23/23 em `revisao` +
       * `components/ai`). É contenção, não defeito de produto.
       *
       * Os dois ajustes atacam a causa: menos ambientes simultâneos (3 em vez de 4) e mais folga para a
       * consulta assíncrona. **Nenhum dos dois afrouxa asserção** — continuam sendo limites, e um produto
       * que de fato não responde continua falhando. O que sai é a falha aleatória.
       */
      maxWorkers: 3,
      // Padrão do Testing Library é 1s para `findBy*`; 8s tolera a máquina ocupada sem esconder travamento
      // real (que ficaria evidente pelo `testTimeout` de 30s).
      // O valor é aplicado em `vitest.setup.ts` (`configure({ asyncUtilTimeout })`).
    },
  };
});
