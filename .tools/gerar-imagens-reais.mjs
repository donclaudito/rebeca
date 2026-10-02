/**
 * Geração **REAL** de imagem pelo pipeline — a medição que a Fase 2 não pôde fazer.
 *
 * Por que existe: o plano `.rebeca/planos/fase-2-imagens.md` exige *"uma geração real medida"* e a
 * entrega ficou **parcial** porque não havia chave da MiniMax nesta máquina. Sem ela, preço, latência,
 * tamanho e — principalmente — **a resolução que o provedor devolve de fato** seguiam não verificados.
 *
 * O que ele NÃO faz: não inventa atalho. Chama o pipeline inteiro (`runSimulatedEpisode`) com
 * `imageProvider: 'auto'`, então passam pelo caminho de verdade o portão de allow-list, a idempotência,
 * o teto de gasto, o livro de custos e o manifesto.
 *
 * Uso:  node .tools/gerar-imagens-reais.mjs
 */
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// O mesmo resolvedor `.js` → `.ts` que `.tools/render-episodio.mjs` usa: os módulos do servidor
// importam com extensão `.js` (exigência do ESM na Vercel) e aqui o que existe no disco é `.ts`.
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

const { runSimulatedEpisode } = await import(
  new URL('../server/media/simulated-episode.ts', import.meta.url).href
);

const linha = '─'.repeat(78);
console.log(`\n${linha}\nGERAÇÃO REAL DE IMAGEM — pipeline com imageProvider: 'auto'\n${linha}`);

const antes = Date.now();
let resultado;
try {
  resultado = await runSimulatedEpisode(undefined, { imageProvider: 'auto' });
} catch (erro) {
  console.error('\nRECUSADO ANTES DE GERAR:');
  console.error(`  ${erro?.name ?? 'erro'}: ${erro?.message ?? erro}`);
  if (erro?.code) console.error(`  code: ${erro.code}`);
  process.exitCode = 1;
  throw erro;
}
const segundos = ((Date.now() - antes) / 1000).toFixed(2);

console.log('\nPROVEDOR DE IMAGEM');
console.log(JSON.stringify(resultado.imageProvider, null, 2));

console.log('\nIMAGENS DE CENA');
for (const ativo of resultado.assets.filter((a) => a.stage === 'imagem')) {
  console.log(
    `  ${String(ativo.key).padEnd(10)} ${String(ativo.imageSize ?? '(sem imageSize)').padEnd(12)} ` +
      `${String(ativo.bytes ?? '?').padStart(9)} B  US$ ${ativo.costUsd.toFixed(6)}  ` +
      `simulado=${ativo.simulated}  ${ativo.providerId}/${ativo.model}`,
  );
  console.log(`             ${ativo.path}`);
}

console.log('\nCUSTO E ESTADO');
console.log(`  tempo de parede ....... ${segundos} s`);
console.log(`  gerados / reusados .... ${resultado.created} / ${resultado.reused}`);
console.log(`  custo do episódio ..... US$ ${resultado.cost.totalUsd.toFixed(6)}  (simulado=${resultado.cost.simulated})`);
console.log(`  linhas no livro ....... ${resultado.cost.ledgerRows}`);
console.log(`  manifestPath .......... ${resultado.manifestPath}`);
console.log(`\n${linha}\n`);
