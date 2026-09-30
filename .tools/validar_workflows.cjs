// Valida a sintaxe dos script bodies de workflow.
// Os scripts sao escritos para o motor de workflow: top-level await e top-level return.
// Para checar sintaxe sem executar, envolvemos o corpo em uma funcao async e compilamos.
//
// Extensao .cjs de proposito: o package.json do prototipo (frente paralela) define
// "type": "module", o que tornaria um .js deste diretorio um ES module e quebraria o require.
//
// Uso: node .tools/validar_workflows.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const raiz = path.dirname(__dirname);
const dir = path.join(raiz, '.dsh', 'workflows');

if (!fs.existsSync(dir)) {
  console.error(`ERRO: pasta nao encontrada: ${dir}`);
  process.exit(1);
}

const arquivos = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
let falhas = 0;

for (const arquivo of arquivos) {
  const caminho = path.join(dir, arquivo);
  const codigo = fs.readFileSync(caminho, 'utf8');

  // 1. Sintaxe (top-level await/return sao validos dentro da funcao async de teste).
  try {
    new vm.Script(`(async () => {\n${codigo}\n})`, { filename: caminho });
  } catch (erro) {
    console.error(`X ${arquivo}: erro de sintaxe -> ${erro.message}`);
    falhas += 1;
    continue;
  }

  // 2. Contrato de workflow: termina com return e nao exporta meta no corpo.
  const problemas = [];
  if (!/^\s*return\b/m.test(codigo)) problemas.push('nao tem `return` no corpo');
  if (/export\s+const\s+meta/.test(codigo)) problemas.push('contem `export const meta` (deve ir no parametro meta)');

  // 3. Hooks permitidos pelo motor.
  const hooks = ['agent', 'pipeline', 'parallel', 'phase', 'log'];
  const usados = hooks.filter((h) => new RegExp(`\\b${h}\\s*\\(`).test(codigo));

  // 4. Palavras-chave de schema fora do conjunto suportado.
  const proibidas = ['pattern', 'format', 'minimum', 'maximum', 'minLength', 'maxLength', 'minItems', 'maxItems'];
  const encontradas = proibidas.filter((k) => new RegExp(`\\b${k}\\s*:`).test(codigo));
  if (encontradas.length) problemas.push(`schema usa chave nao suportada: ${encontradas.join(', ')}`);

  if (problemas.length) {
    console.error(`X ${arquivo}: ${problemas.join('; ')}`);
    falhas += 1;
  } else {
    console.log(`OK ${arquivo} (hooks: ${usados.join(', ') || 'nenhum'})`);
  }
}

console.log(falhas ? `\nResultado: ${falhas} workflow(s) com problema.` : '\nResultado: todos os workflows validos.');
process.exit(falhas ? 1 : 0);
