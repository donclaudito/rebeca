#!/usr/bin/env node
/**
 * Gera `server/ai/prompts.generated.ts` a partir de `.rebeca/prompts/<id>@vN.md`.
 *
 * Por que existe: a skill `rebeca-prompt-eng` exige que o prompt seja **arquivo versionado em disco**
 * (`@vN.md`, nunca editado no lugar), mas o servidor precisa do texto em memória — e a função
 * serverless da Vercel não enxerga a pasta `.rebeca/`. Este script mantém as duas coisas verdadeiras:
 * o `.md` é a fonte, o `.ts` é derivado e traz o **hash do arquivo de origem**.
 *
 * O hash é o que impede a divergência: o teste `src/ai/__tests__/prompts.test.ts` recalcula o sha256
 * de cada `.md` e compara com o que está gravado aqui. Editou o prompt e não rodou o gerador? O CI
 * fica vermelho. Assim o prompt que roda em produção é, comprovadamente, o prompt versionado.
 *
 * Uso:
 *   node .tools/build_prompts.mjs           # gera
 *   node .tools/build_prompts.mjs --check   # só verifica (usado no CI); exit 1 se estiver fora de sincronia
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const PROMPTS_DIR = join(ROOT, '.rebeca', 'prompts');
const TARGET = join(ROOT, 'server', 'ai', 'prompts.generated.ts');

/** Níveis de modelo aceitos — mantidos em sincronia com `AiTier` em `src/ai/contract.ts`. */
const TIERS = ['raciocinio', 'criativo', 'rapido', 'visao'];

function fail(message) {
  process.stderr.write(`ERRO: ${message}\n`);
  process.exit(1);
}

/** Lê o bloco `---\nchave: valor\n---` do topo do arquivo. */
function parseFrontmatter(text, file) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!match) fail(`${file}: frontmatter ausente (esperado bloco --- no topo).`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf(':');
    if (separator === -1) fail(`${file}: linha de frontmatter inválida: "${trimmed}"`);
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    meta[key] = raw.replace(/^["']|["']$/g, '');
  }
  return { meta, body: text.slice(match[0].length) };
}

/** Extrai o conteúdo de `## <titulo>` até a próxima seção de nível 2. */
function section(body, title, file) {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${title}`.toLowerCase());
  if (start === -1) fail(`${file}: seção "## ${title}" não encontrada.`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const content = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  if (!content) fail(`${file}: seção "## ${title}" está vazia.`);
  return content;
}

function build() {
  let files;
  try {
    files = readdirSync(PROMPTS_DIR).filter((name) => name.endsWith('.md'));
  } catch {
    fail(`não consegui ler ${PROMPTS_DIR}.`);
  }
  if (files.length === 0) fail(`nenhum prompt em ${PROMPTS_DIR}.`);

  const entries = [];
  const seen = new Set();

  for (const name of files.sort()) {
    const full = join(PROMPTS_DIR, name);
    const text = readFileSync(full, 'utf8');
    const { meta, body } = parseFrontmatter(text, name);

    const promptId = meta.prompt_id;
    const version = Number.parseInt(meta.version ?? '', 10);
    const tier = meta.model_tier;
    const channelScope = meta.channel_scope;
    const maxOutputTokens = Number.parseInt(meta.max_output_tokens ?? '', 10);

    if (!promptId) fail(`${name}: frontmatter sem "prompt_id".`);
    if (!Number.isInteger(version) || version < 1) fail(`${name}: "version" precisa ser inteiro ≥ 1.`);
    if (!TIERS.includes(tier)) fail(`${name}: "model_tier" deve ser um de ${TIERS.join(', ')}.`);
    if (!channelScope) fail(`${name}: frontmatter sem "channel_scope".`);
    if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 64) {
      fail(`${name}: "max_output_tokens" precisa ser inteiro ≥ 64.`);
    }
    if (name !== `${promptId}@v${version}.md`) {
      fail(`${name}: o nome do arquivo tem de ser "${promptId}@v${version}.md" — é o que garante que a versão no disco é a versão do frontmatter.`);
    }
    if (seen.has(promptId)) fail(`${name}: "${promptId}" aparece em dois arquivos; só uma versão pode estar ativa.`);
    seen.add(promptId);

    const system = section(body, 'Sistema', name);
    const instruction = section(body, 'Instrução', name);
    // A seção de guardrails é OBRIGATÓRIA e entra dentro do system prompt.
    //
    // Isto já foi defeito: a primeira versão deste gerador extraía só "Sistema" e "Instrução" e
    // descartava "Guardrails" em silêncio — ou seja, a defesa contra injeção de prompt, o "você não
    // aprova nem publica" e o "não invente número" simplesmente não chegavam ao modelo. O teste
    // `registry.test.ts` pegou. Guardrail que não é enviado não é guardrail; é texto decorativo no
    // repositório.
    const guardrails = section(body, 'Guardrails', name);
    const sha256 = createHash('sha256').update(text, 'utf8').digest('hex');

    entries.push({
      promptId,
      version,
      tier,
      channelScope,
      maxOutputTokens,
      // A ordem importa: papel e regras primeiro, guardrails por último — é a parte que o modelo lê
      // imediatamente antes da mensagem do usuário.
      system: `${system}\n\n## Guardrails (obrigatórios)\n\n${guardrails}`,
      instruction,
      sha256,
      source: name,
    });
  }

  const records = entries
    .map((entry) => {
      const key = JSON.stringify(entry.promptId);
      return [
        `  ${key}: {`,
        `    promptId: ${key},`,
        `    version: ${entry.version},`,
        `    tier: ${JSON.stringify(entry.tier)},`,
        `    channelScope: ${JSON.stringify(entry.channelScope)},`,
        `    maxOutputTokens: ${entry.maxOutputTokens},`,
        `    source: ${JSON.stringify(entry.source)},`,
        `    sha256: ${JSON.stringify(entry.sha256)},`,
        `    system: ${JSON.stringify(entry.system)},`,
        `    instruction: ${JSON.stringify(entry.instruction)},`,
        `  },`,
      ].join('\n');
    })
    .join('\n');

  return `/**
 * ARQUIVO GERADO — NÃO EDITE À MÃO.
 *
 * Fonte: \`.rebeca/prompts/<prompt_id>@v<N>.md\`
 * Gerador: \`node .tools/build_prompts.mjs\`
 *
 * O campo \`sha256\` é o hash do arquivo .md de origem. O teste \`src/ai/__tests__/prompts.test.ts\`
 * recalcula e compara: prompt editado sem rodar o gerador quebra o CI, o que garante que o texto que
 * roda em produção é exatamente o texto versionado.
 */

export interface LoadedPrompt {
  readonly promptId: string;
  readonly version: number;
  readonly tier: string;
  readonly channelScope: string;
  readonly maxOutputTokens: number;
  readonly source: string;
  readonly sha256: string;
  readonly system: string;
  readonly instruction: string;
}

export const PROMPTS: Readonly<Record<string, LoadedPrompt>> = {
${records}
};
`;
}

const generated = build();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(TARGET, 'utf8');
  } catch {
    fail(`${TARGET} não existe. Rode: node .tools/build_prompts.mjs`);
  }
  if (current !== generated) {
    fail('prompts fora de sincronia com .rebeca/prompts/. Rode: node .tools/build_prompts.mjs');
  }
  process.stdout.write('OK: prompts em sincronia com .rebeca/prompts/.\n');
  process.exit(0);
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, generated, 'utf8');
const count = (generated.match(/^  "/gm) ?? []).length;
process.stdout.write(`OK: ${count} prompts gerados em server/ai/prompts.generated.ts\n`);
