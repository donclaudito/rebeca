/**
 * CLI das opções de thumbnail — a etapa que faltava no pipeline.
 *
 * Uso:
 *
 *   node .tools/gerar-thumbnails.mjs                 # provedor simulado: arquivos reais, custo zero
 *   node .tools/gerar-thumbnails.mjs --real          # MiniMax image-01 (exige chave; gasta US$ 0,0035/imagem)
 *   node .tools/gerar-thumbnails.mjs --real --sem-simulado
 *
 * Rodar duas vezes **não** cria arquivo nem linha nova no livro de custos — é o que a seção
 * "idempotência" da saída mostra.
 *
 * O resolvedor de módulos abaixo é o mesmo do `render-episodio.mjs` e existe pelo mesmo motivo: o
 * projeto tem `"type": "module"`, os imports relativos terminam em `.js` e os arquivos são `.ts` — o
 * Node puro não remapeia, o `registerHooks` remapeia só quando o `.js` não existe e o `.ts` irmão existe.
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (typeof registerHooks !== 'function') {
  console.error(
    `Esta CLI precisa do Node 22.15 ou mais novo (registerHooks não existe no ${process.version}). ` +
      'Atualize o Node, ou rode os testes: `pnpm exec vitest run src/media`.',
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

const usarSimulado = process.argv.includes('--simulado');

const { generateThumbnails, providerForThumbnails } = await import(new URL('../server/media/thumbnails.ts', import.meta.url).href);
const { SIMULATED_PROVIDERS } = await import(new URL('../server/media/providers/simulated.ts', import.meta.url).href);
const { hasMiniMaxKey, maskedMiniMaxKey, miniMaxBaseUrl } = await import(
  new URL('../server/media/config.ts', import.meta.url).href
);
const { hasOpenAiKey, openAiApiKey } = await import(new URL('../server/media/providers/openai.ts', import.meta.url).href);
const { ProviderNotAllowedError } = await import(new URL('../server/media/allow-list.ts', import.meta.url).href);
const { MediaBudgetError, MEDIA_LIMITS } = await import(new URL('../src/media/limits.ts', import.meta.url).href);

const LINE = '─'.repeat(78);
const section = (title) => console.log(`\n${LINE}\n${title}\n${LINE}`);
const usd = (value) => `US$ ${value.toFixed(6)}`;

/**
 * Quatro opções, quatro hipóteses diferentes.
 *
 * Não são quatro variações do mesmo desenho: a skill `rebeca-branding` pede 3–4 opções com **hipóteses
 * distintas** (foco no personagem, no objeto, no contraste, na expressão), porque quatro apostas iguais
 * não informam nada quando o CTR voltar. O texto fica em pt-BR e com no máximo 3 palavras, pela régua de
 * legibilidade a 168×94.
 *
 * O prompt descreve **referência sintética**: o Character Sheet da Luna ainda não existe, e pedir "a
 * Luna" a um modelo sem referência daria quatro personagens diferentes. Isso está escrito no manifesto.
 */
const OPCOES = [
  {
    optionId: 'a',
    hypothesis: 'Foco no personagem: rosto grande e expressão de descoberta',
    textOnImage: 'OLHA ISSO!',
    prompt:
      'Flat 2D children illustration for ages 3-5. A small round friendly girl character with big eyes, ' +
      'close-up of her surprised happy face, soft shapes, bright cheerful garden palette, thick clean outlines, ' +
      'no text anywhere. Note: reference art is synthetic, the official character sheet does not exist yet.',
  },
  {
    optionId: 'b',
    hypothesis: 'Foco no objeto: a cor/elemento que o episódio ensina, em destaque',
    textOnImage: 'SETE CORES',
    prompt:
      'Flat 2D children illustration for ages 3-5. A big friendly rainbow arc over a bright garden, ' +
      'bold saturated colors, simple shapes, high contrast against a soft sky, centered composition, no characters, ' +
      'no text anywhere.',
  },
  {
    optionId: 'c',
    hypothesis: 'Contraste: fundo escuro com o elemento claro, para furar a rolagem',
    textOnImage: 'ACHOU!',
    prompt:
      'Flat 2D children illustration for ages 3-5. A dark blue night garden with a single glowing object in the ' +
      'center emitting warm light, strong contrast, simple bold shapes, cozy and not scary, no text anywhere.',
  },
  {
    optionId: 'd',
    hypothesis: 'Expressão: ação de apontar, com o gesto legível mesmo pequeno',
    textOnImage: 'QUAL E A SUA?',
    prompt:
      'Flat 2D children illustration for ages 3-5. A small round friendly girl character pointing up with one arm, ' +
      'clear readable silhouette, bright flat colors, simple background, the pointing hand large in frame, ' +
      'no text anywhere. Note: reference art is synthetic, the official character sheet does not exist yet.',
  },
];

try {
  /*
   * **A CLI passa a usar o mesmo seletor da tela** (`providerForThumbnails`).
   *
   * Antes ela estava fixada no simulado, e por isso o episódio sintético saía marcado "simulado" na tela
   * de Mídia gerada mesmo com uma chave de IA configurada — o dono do produto viu isso e perguntou se
   * haveria como gerar com a IA cadastrada. Duas regras de escolha de provedor para a mesma tarefa é como
   * a CLI e a tela passam a produzir coisas diferentes. Agora é uma regra só.
   *
   * `--simulado` força a Fase 0 (custo zero) para provar encanamento sem gastar.
   */
  const escolha = providerForThumbnails();
  const provider = usarSimulado ? SIMULATED_PROVIDERS.thumbnail : escolha.provider;

  section('REBECA · opções de thumbnail');
  console.log(`canal .......... luna`);
  console.log(`episódio ....... luna-ep-001 · ${OPCOES.length} opções`);
  console.log(
    `provedor ....... ${provider.id}/${provider.model} · ${provider.simulated ? 'SIMULADO (custo zero)' : `pago (${usd(provider.costPerImageUsd)}/imagem)`}`,
  );
  if (provider.simulated) {
    console.log('note ........... arte simulada: fundo e texto locais, SEM personagem — prova o encanamento, não publica');
  } else {
    console.log(`motivo ......... ${escolha.motivo}`);
    console.log(`chave .......... ${hasOpenAiKey() || hasMiniMaxKey() ? 'configurada' : 'AUSENTE — a geração vai falhar'}`);
  }

  const result = await generateThumbnails({
    channelId: 'luna',
    episodeId: 'luna-ep-001',
    promptVersion: 'criar-thumbnail@v1',
    options: OPCOES,
    provider,
  });

  section('OPÇÕES');
  for (const option of result.options) {
    console.log(`[${option.reused ? 'reusado' : 'gerado '}] opcao-${option.optionId}  ${usd(option.costUsd)}  ${option.providerId}/${option.model}`);
    console.log(`           hipótese: ${option.hypothesis}`);
    console.log(`           ${option.pathFromAssets}`);
  }
  console.log(`\ngeradas nesta execução: ${result.created} · reusadas do manifesto: ${result.reused}`);

  section('CUSTO');
  console.log(`gasto desta execução ..... ${usd(result.cost.spentNowUsd)}`);
  console.log(`total do episódio (livro)  ${usd(result.cost.episodeTotalUsd)}`);
  console.log(`preço por imagem ......... ${usd(result.cost.perImageUsd)}`);
  console.log(`limite mensal (D5) ....... ${usd(result.cost.monthlyLimitUsd)}`);
  console.log(`livro de custos .......... ${result.cost.ledgerPath ?? '(sem livro durável neste ambiente)'}`);
  console.log(`linhas de dado no livro .. ${result.cost.ledgerRows}`);

  section('MANIFESTO');
  console.log(result.manifestPath);
  console.log(
    '\nidempotência: rode de novo — "geradas nesta execução" tem de vir 0 e as linhas do livro não podem subir.',
  );
  console.log('\nOK — nada foi publicado; nenhuma aprovação humana foi simulada.\n');
  process.exit(0);
} catch (error) {
  if (error instanceof ProviderNotAllowedError) {
    console.error(`\n${LINE}\nPARE — FORNECEDOR RECUSADO PELA ALLOW-LIST (${error.code})\n${LINE}`);
    console.error(error.message);
    if (error.entry) {
      console.error(`\nEntrada: ${error.entry.fornecedor}/${error.entry.modelo} (${error.entry.finalidade}) → ${error.entry.status}`);
      console.error(`Fonte lida em ${error.entry.lidoEm}: ${error.entry.fonteUrl}`);
    }
    console.error('\nNada foi gerado e nada foi gasto. Liberar exige leitura do termo e revisão da lista.\n');
    process.exit(4);
  }
  if (error instanceof MediaBudgetError) {
    console.error(`\n${LINE}\nPARE — PORTÃO DE GASTO ACIONADO (${error.code})\n${LINE}`);
    console.error(error.message);
    console.error(
      `\nLimite mensal aprovado: ${usd(MEDIA_LIMITS.monthlyUsd)} (${MEDIA_LIMITS.approvedBy}, ${MEDIA_LIMITS.approvedAt}).`,
    );
    console.error('Nada mais foi gerado. Esta decisão é do humano.\n');
    process.exit(2);
  }
  console.error(`\n${LINE}\nFALHOU\n${LINE}`);
  console.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
}
