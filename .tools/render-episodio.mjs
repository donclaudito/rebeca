/**
 * CLI do render de um episódio sintético — a prova ponta a ponta da Fase 0, sem rede e sem gasto.
 *
 * Uso:
 *
 *   node .tools/render-episodio.mjs
 *
 * Roda o episódio de exemplo (3 cenas, ~30 s) com os provedores simulados e imprime: caminhos gerados,
 * o `ffprobe` de cada render, o loudness medido, o custo total e o `usd_por_minuto` contra os tetos
 * aprovados. Rodar duas vezes **não** cria arquivo novo nem linha nova no livro de custos — é isso que a
 * saída mostra na seção "idempotência".
 *
 * Por que existe um resolvedor de módulos aqui dentro:
 *
 * O projeto tem `"type": "module"`, então todo import relativo do código que o Node executa termina em
 * `.js` — foi o defeito que derrubou a função na Vercel (`ERR_MODULE_NOT_FOUND` no cold start). Só que os
 * arquivos deste repositório são `.ts`, e o Node **não** remapeia `.js` → `.ts` (medido nesta sessão: o
 * import com `.js` falha). O `vitest` resolve isso pelo Vite; o `node` puro, não. O `registerHooks` abaixo
 * faz esse remapeamento apenas quando o `.js` não existe e o `.ts` irmão existe — assim a CLI roda com
 * `node` puro, sem dependência nova, sem build e sem renomear import nenhum.
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * `registerHooks` existe desde o Node 22.15 (e 23.5). O `engines` do projeto declara `>=22.12`, então há
 * uma faixa estreita em que esta CLI não conseguiria resolver `.js` → `.ts`. Falhar alto e dizer o que
 * fazer é melhor que um `ERR_MODULE_NOT_FOUND` sobre um arquivo que existe.
 */
if (typeof registerHooks !== 'function') {
  console.error(
    `Esta CLI precisa do Node 22.15 ou mais novo (o módulo registerHooks não existe no ${process.version}). ` +
      'Atualize o Node, ou rode o pipeline pelos testes: `pnpm exec vitest run src/media`.',
  );
  process.exit(3);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && specifier.endsWith('.js') && context.parentURL) {
      const asJs = fileURLToPath(new URL(specifier, context.parentURL));
      const asTs = asJs.replace(/\.js$/, '.ts');
      if (!existsSync(asJs) && existsSync(asTs)) {
        return { url: pathToFileURL(asTs).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});

const entry = new URL('../server/media/simulated-episode.ts', import.meta.url).href;
const limitsModule = await import(new URL('../src/media/limits.ts', import.meta.url).href);

const { runSimulatedEpisode } = await import(entry);
const { MediaBudgetError, MEDIA_LIMITS, LOUDNESS_TARGET } = limitsModule;

const LINE = '─'.repeat(78);

function section(title) {
  console.log(`\n${LINE}\n${title}\n${LINE}`);
}

function usd(value) {
  return `US$ ${value.toFixed(6)}`;
}

function shortPath(path, root) {
  const normalized = path.replaceAll('\\', '/');
  const marker = '/.rebeca/';
  const index = normalized.lastIndexOf(marker);
  return index === -1 ? normalized.replace(`${root.replaceAll('\\', '/')}/`, '') : `.rebeca/${normalized.slice(index + marker.length)}`;
}

try {
  const root = process.cwd();
  const result = await runSimulatedEpisode();

  section('REBECA · Fase 0 — episódio sintético renderizado (provedores simulados, custo zero)');
  console.log(`canal .......... ${result.channelId} (${result.channelName})`);
  console.log(`episódio ....... ${result.episodeId} · ${result.sceneCount} cenas · versão do render v${result.version}`);
  console.log(`título ......... ${result.title}`);
  console.log(
    `provedores ..... simulados (ffmpeg local, simulated=true, custo 0) — trocar pelo real da Stack A ` +
      '(MiniMax/FLUX/Azure/Suno) é trocar o adapter, sem mudar o pipeline',
  );
  console.log(
    `referência ..... sintética (Character Sheet da Luna NÃO existe no repositório — nada aqui prova ` +
      'consistência de personagem)',
  );

  section('ATIVOS');
  for (const asset of result.assets) {
    const marca = asset.reused ? 'reusado ' : 'gerado  ';
    console.log(
      `[${marca}] ${asset.stage.padEnd(9)} ${asset.key.padEnd(10)} ${String(asset.durationMs).padStart(7)} ms  ` +
        `${usd(asset.costUsd)}  ${asset.providerId}/${asset.model}`,
    );
    console.log(`           ${shortPath(asset.path, root)}`);
  }
  console.log(`\ngerados nesta execução: ${result.created} · reusados do manifesto: ${result.reused}`);

  section('RENDERS (medidos com ffprobe)');
  for (const [rotulo, file] of [
    ['longo  16:9', result.renders.long],
    ['short  9:16', result.renders.short],
    ['legenda srt', result.renders.captions],
  ]) {
    const dimensao =
      file.width === null ? 'texto' : `${file.width},${file.height},${file.fps === null ? '?' : `${file.fps}/1`}`;
    console.log(
      `${rotulo}  ${dimensao.padEnd(16)} ${String(file.durationMs).padStart(7)} ms  ` +
        `${String(file.frames ?? '-').padStart(5)} quadros  ${(file.bytes / 1024).toFixed(1).padStart(7)} KiB  hash ${file.hash8}`,
    );
    console.log(`           ${shortPath(file.path, root)}`);
  }
  console.log(
    `\nffprobe do longo: ${result.probes.long.width},${result.probes.long.height},` +
      `${result.probes.long.fps === null ? '?' : `${result.probes.long.fps}/1`} · ` +
      `${result.probes.long.frames} quadros · ${(result.probes.long.durationMs / 1000).toFixed(3)} s`,
  );
  console.log(
    `ffprobe do short: ${result.probes.short.width},${result.probes.short.height} · ` +
      `${result.probes.short.frames} quadros · ${(result.probes.short.durationMs / 1000).toFixed(3)} s`,
  );

  section('LEGENDA × TIMELINE');
  const info = result.captionsInfo;
  console.log(`blocos ................. ${info.blocks}`);
  console.log(`primeiro bloco começa .. ${info.firstStartMs} ms`);
  console.log(`último bloco termina ... ${info.lastEndMs} ms`);
  console.log(`duração do vídeo ....... ${info.videoMs} ms`);
  console.log(
    `desvio fala↔legenda .... ${info.maxDriftMs} ms  ${info.maxDriftMs <= 200 ? 'OK (≤ 200 ms)' : 'ACIMA DO TETO'}`,
  );

  section('ÁUDIO (loudness medido no arquivo renderizado)');
  if (result.loudness === null) {
    console.log('não foi possível medir (sem áudio legível) — nada é afirmado sobre loudness.');
  } else {
    const voz = result.voiceLoudness;
    console.log(
      voz === null || voz === undefined
        ? 'passe 1 (voz) ..... não reconhecido — o render caiu para loudnorm de passe único'
        : `passe 1 (voz) ..... ${voz.inputIntegratedLufs} LUFS medidos na faixa de voz; passe 2 aplica ` +
            `ganho LINEAR com esses números para chegar ao alvo ${LOUDNESS_TARGET.integratedLufs} LUFS`,
    );
    console.log(
      `integrado ... ${result.loudness.integratedLufs} LUFS   (alvo declarado ${LOUDNESS_TARGET.integratedLufs})`,
    );
    console.log(`true peak ... ${result.loudness.truePeakDb} dBTP   (alvo declarado ${LOUDNESS_TARGET.truePeakDb})`);
    console.log(`LRA ......... ${result.loudness.lra} LU       (alvo declarado ${LOUDNESS_TARGET.lra})`);
    const delta = Math.abs(result.loudness.integratedLufs - LOUDNESS_TARGET.integratedLufs);
    console.log(
      `desvio do alvo: ${delta.toFixed(1)} LU. O alvo é DECLARADO e NÃO VERIFICADO na doc oficial ` +
        '(spec-midia.json → naoVerificado); o valor medido acima é o que o arquivo tem de fato.',
    );
  }

  section('CUSTO');
  console.log(`custo total do episódio ... ${usd(result.cost.totalUsd)} (provedores simulados: custo real 0)`);
  console.log(`duração do arquivo longo .. ${result.cost.durationMs} ms (ffprobe — não é "tempo_min")`);
  console.log(`usd_por_minuto ............ ${usd(result.cost.usdPerMinute)}/min`);
  console.log(
    `teto por minuto (D2) ...... ${usd(result.cost.perMinuteLimitUsd)}/min — aprovado por ` +
      `${result.cost.approvedBy} em ${result.cost.approvedAt}`,
  );
  console.log(
    `gasto do mês (D5) ......... ${usd(result.cost.monthlyUsd)} de ${usd(result.cost.monthlyLimitUsd)}`,
  );
  console.log(`livro de custos ........... ${result.cost.ledgerPath ?? '(sem livro durável neste ambiente)'}`);
  console.log(`linhas de dado no livro ... ${result.cost.ledgerRows}`);
  console.log(
    '\nidempotência: rode este comando de novo — "gerados nesta execução" tem de vir 0, e o número de ' +
      'linhas do livro tem de ser o mesmo.',
  );

  section('MANIFESTO');
  console.log(shortPath(result.manifestPath, root));
  if (result.channelSpec !== null) {
    console.log(
      `spec do canal conferida contra o código: ${result.channelSpec.canal} · ` +
        `${result.channelSpec.longo.largura}x${result.channelSpec.longo.altura}@${result.channelSpec.fps} · ` +
        `short até ${result.channelSpec.duracao.shortMaxSeg}s · ` +
        `${result.channelSpec.naoVerificado.length} item(ns) NÃO VERIFICADO(S) declarados`,
    );
  }

  console.log('\nOK — nenhuma chamada de rede, nenhum provedor pago, nenhuma dependência nova.\n');
  process.exit(0);
} catch (error) {
  if (error instanceof MediaBudgetError) {
    console.error(`\n${LINE}\nPARE — PORTÃO DE GASTO ACIONADO (${error.code})\n${LINE}`);
    console.error(error.message);
    console.error(
      `\nTeto por minuto aprovado: ${usd(MEDIA_LIMITS.perMinuteUsd)}/min · limite mensal aprovado: ` +
        `${usd(MEDIA_LIMITS.monthlyUsd)} (${MEDIA_LIMITS.approvedBy}, ${MEDIA_LIMITS.approvedAt}).`,
    );
    console.error('Nada mais foi gerado. Esta decisão é do humano — não do pipeline.\n');
    process.exit(2);
  }
  console.error(`\n${LINE}\nFALHOU\n${LINE}`);
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
