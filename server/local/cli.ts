/**
 * Ponto de entrada do app instalado.
 *
 *     node build/server/local/cli.js
 *
 * Este arquivo é o que transforma "código no repositório" em "aplicativo que abre na máquina de
 * alguém". Ele não serve requisição: faz as quatro coisas que precisam acontecer **antes** da primeira
 * — e cada uma delas existe por causa de um jeito concreto de o app abrir errado:
 *
 * 1. **`process.chdir(appRoot())`.** O `.env` desta máquina (com `GOOGLE_CLIENT_ID` e
 *    `REBECA_ALLOWED_SUBS`) é lido de `process.cwd()` — ver `server/dev-env.ts`. Um atalho na área de
 *    trabalho costuma iniciar o processo com o diretório do sistema, e o app abriria **sem login
 *    configurado**: 503 em tudo, com a mensagem falando de variável de ambiente enquanto o arquivo
 *    estava lá, do lado do executável. O diretório de trabalho passa a ser a pasta do app.
 * 2. **`REBECA_ROOT`** (feito dentro de `createLocalServer`, a partir do mesmo `appRoot()`) para que
 *    `.rebeca/assets`, `.rebeca/custos.csv` e `.rebeca/segredos` fiquem na pasta do app, e não onde o
 *    processo foi iniciado.
 * 3. **Recusa explícita quando o app não foi construído.** Sem `dist/index.html` não há casca: o
 *    servidor subiria, responderia 404 em tudo e a pessoa procuraria o defeito no lugar errado. A
 *    mensagem diz o comando.
 * 4. **Escuta em `127.0.0.1`.** Este servidor carrega a chave paga dos provedores e o token do Google.
 *    `REBECA_HOST` existe para quem realmente precisa expor na rede — e nesse caso o aviso é impresso,
 *    porque a consequência (qualquer um na rede gasta a sua chave) não é óbvia.
 *
 * Depois disso, ele só entrega: porta, URL e o estado do que o app precisa para funcionar de verdade
 * (`ffmpeg` para o pipeline de mídia; chave do Google para entrar).
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { valorDoEnvDeDesenvolvimento } from '../dev-env.js';
import { ffmpegAvailable } from '../media/ffmpeg.js';
import { isLoopback, readHost, readPort } from './defaults.js';
import { appRoot } from './root.js';
import { createLocalServer } from './server.js';

const root = appRoot();
const host = readHost(process.env['REBECA_HOST']);

let port: number;
try {
  port = readPort(process.env['REBECA_PORT']);
} catch (error) {
  console.error(`[rebeca] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

if (!existsSync(join(root, 'dist', 'index.html'))) {
  console.error(
    `[rebeca] Não encontrei a casca do app em ${join(root, 'dist', 'index.html')}.\n` +
      '         Construa antes de subir:  pnpm run build:app\n' +
      '         (o pacote portátil já vem construído — esta mensagem aparece quando alguém roda o ' +
      'servidor a partir do código-fonte sem construir).',
  );
  process.exit(1);
}

/*
 * O `.env` desta máquina é lido de `process.cwd()` (ver o comentário de topo). Mudar o diretório de
 * trabalho é o que faz o atalho funcionar de qualquer lugar. Falha aqui não é fatal: `REBECA_ROOT`
 * (fixado em `createLocalServer`) é quem governa os dados, e o `.env` é lido por caminho relativo
 * apenas neste ponto do projeto.
 */
try {
  process.chdir(root);
} catch {
  console.warn(`[rebeca] Não consegui mudar o diretório de trabalho para ${root}; sigo com o atual.`);
}

const server = createLocalServer({ root });

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[rebeca] A porta ${port} já está em uso. O app já está aberto em outra janela? ` +
        'Se não estiver, escolha outra porta:  $env:REBECA_PORT=8788; pnpm run start:local',
    );
  } else if (error.code === 'EACCES') {
    console.error(`[rebeca] Sem permissão para escutar em ${host}:${port}. Portas abaixo de 1024 exigem privilégio.`);
  } else {
    console.error(`[rebeca] Falha ao subir o servidor: ${error.message}`);
  }
  process.exit(1);
});

server.listen(port, host, () => {
  const url = `http://${isLoopback(host) ? '127.0.0.1' : host}:${port}`;
  console.log('');
  console.log('  Rebeca — app local');
  console.log(`  Abra: ${url}`);
  console.log(`  Dados (ativos, custos e segredos): ${join(root, '.rebeca')}`);
  console.log('');

  /*
   * Abrir o navegador é opt-in por variável, e não comportamento padrão: o servidor é a mesma peça nos
   * testes, e um teste que abrisse o navegador da máquina de quem roda a suíte seria inaceitável.
   * Quem liga isso é o `Rebeca.cmd` do pacote portátil.
   */
  if (process.env['REBECA_OPEN_BROWSER'] === '1') {
    try {
      // `stdio: 'ignore'` de propósito: em ambiente confinado o processo não pode abrir named pipe, e
      // canalizar a saída faria isto falhar com EPERM (a mesma armadilha documentada em `ffmpeg.ts`).
      spawn('cmd', ['/c', 'start', '', url], { stdio: 'ignore', detached: true, windowsHide: true }).unref();
    } catch {
      console.warn(`  [aviso] Não consegui abrir o navegador sozinho. Abra ${url} na mão.`);
    }
  }

  if (!isLoopback(host)) {
    console.warn(
      `  [atenção] Escutando em ${host}, fora do local. Qualquer pessoa que alcançar esta máquina na ` +
        'rede usa a sua chave paga e o seu acesso. Use 127.0.0.1 se não souber por que abriu.',
    );
  }

  const clientId = valorDoEnvDeDesenvolvimento('GOOGLE_CLIENT_ID') ?? process.env['GOOGLE_CLIENT_ID'] ?? '';
  if (clientId.trim().length === 0) {
    console.warn(
      '  [atenção] GOOGLE_CLIENT_ID não está configurado. O app abre a tela de entrada e responde 503 ' +
        'em tudo — falha fechada de propósito. Veja docs/passo-a-passo-autenticacao-google.md.',
    );
  }

  if (!ffmpegAvailable()) {
    console.warn(
      '  [atenção] ffmpeg não encontrado. O app funciona, mas o pipeline de mídia (imagem, voz, render) ' +
        'recusa gerar. No pacote portátil ele vem em runtime/ffmpeg/bin.',
    );
  }

  console.log('  Pare com Ctrl+C.');
  console.log('');
});

/** Encerramento limpo: sem isto, o `Ctrl+C` deixa a porta presa por alguns segundos e confunde. */
for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, () => {
    server.close(() => process.exit(0));
  });
}
