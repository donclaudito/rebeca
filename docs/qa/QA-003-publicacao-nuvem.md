# QA-003 — Verificação adversarial da publicação na nuvem (GitHub + Vercel)

- **Agente:** `rebeca-qa`
- **Data:** 2026-09-30
- **Entrega sob revisão:** `donclaudito/rebeca` (`main`), commits `4c49743`, `bc37d53` — e, na prática,
  **também `fc9ca29`**, que é o tip publicado (ver A6)
- **Artefatos:** `vercel.json`, `.github/workflows/ci.yml`, `.github/pull_request_template.md`,
  `.github/dependabot.yml`, `.gitignore`, `.gitattributes`, `package.json`, `README.md`,
  `.rebeca/decisoes/ADR-003-onde-roda-github-vercel.md`, seção "Publicação na nuvem" de `.rebeca/estado.md`
- **Veredito:** **refutado** — 1 achado bloqueante de afirmação (A1) + 1 bloqueante de processo (A2) +
  8 achados não bloqueantes. O CI e o build estão confirmados; a *publicação* não está provada.

## 1. Veredito por critério

| # | Critério (o que a entrega afirma) | Veredito | Evidência |
|---|---|---|---|
| 1 | `vercel.json` aceito pela Vercel (chaves, `headers`, `rewrites`) | **parcial / não verificável até o fim** | schema oficial: `rewrites` exige `source`+`destination`, `headers` exige `source`+`headers[].key/value` — o arquivo casa. A busca do schema truncou em 100 KB (`buildCommand`/`outputDirectory` não apareceram por truncamento, **não** por ausência) |
| 2 | Rewrite catch-all `/index.html` funciona e `/assets/*` continua vindo do disco | **não verificável** | não existe deploy: `gh api repos/donclaudito/rebeca/deployments` → `[]`; a URL não responde pelo protótipo (A1). O próprio ADR-003 já declarava isto como premissa |
| 3 | `installCommand` com `--frozen-lockfile` funciona com o lockfile commitado | **confirmado no CI, NÃO VERIFICADO na Vercel** | `pnpm install --frozen-lockfile` local → exit 0 (`Already up to date`); CI: `Lockfile is up to date, resolution step is skipped`; **mas a Vercel usará pnpm 10.x** (A2) |
| 4 | `framework: "vite"` + `buildCommand` explícito não se conflitam | **não verificável** (sem deploy) | `dist/index.html` usa `/assets/...` absolutos → o output é o que o `vercel.json` descreve; conflito de preset não é observável sem build na Vercel |
| 5 | `engines.node: ">=22.12.0"` é aceito pela Vercel e resolve para Node 24.x | **confirmado** | `getSupportedNodeVersion('>=22.12.0')` → `major 24 (24.x, nodejs24.x)` (executado; ver R2) |
| 6 | `pnpm/setup@v3`, `actions/checkout@v7`, `actions/upload-artifact@v7`, `runtime: node@22` corretos | **confirmado** | job `110055571280`: `Installing runtime node@22...` → `+ node 22.23.3`; `Downloading pnpm 11.28.3`; 8/8 steps `success` (R1) |
| 7 | Varredura de segredo sem falso negativo | **refutado** | A3 (UTF-16, formatos não cobertos, histórico) |
| 8 | Varredura sem falso positivo contra os docs do projeto | **refutado como escrito nos docs** | A4/A5 |
| 9 | Higiene: nenhum segredo/build/mídia pesada no índice | **confirmado** | `git ls-files` (126), sem `.env`/`*.pem`/`*.key`/`dist/`/`node_modules/`/`.vercel/`; 2,37 MB no total |
| 10 | `.gitattributes` não corrompe `.jpeg`/`.pdf`/`pnpm-lock.yaml` | **confirmado** | `git check-attr -a` (R4) |
| 11 | Coerência das afirmações de `estado.md`/ADR-003 | **refutado** | A1, A5, A7, A8, A9 |
| 12 | Invariantes do projeto (AGENTS.md) | **não violados** | §4 |
| 13 | Testes e build no snapshot (19/19, exit 0) | **confirmado** | CI: `Tests 19 passed (19)`, `Test Files 4 passed (4)`; artefato `dist` confere (R3) |

## 2. Achados com reprodução

### A1 — BLOQUEANTE (afirmação): `ai-media-studio.vercel.app` já pertence a terceiro

`ADR-003` §Decisão item 2 afirma, como decidido: *"publicando em `ai-media-studio.vercel.app`"*.

```text
> web_fetch https://ai-media-studio.vercel.app
Fetched https://ai-media-studio.vercel.app/ (HTTP 200)
AI Media Studio
Explore Image Video Audio Canvas NEW Edit Character Marketing Studio NEW Cinema Studio ...
⚠ Wan 2.2 takes 3–8 min — may timeout on free Vercel. Switch to LTX-Video for fast results.
```

É um produto de geração de vídeo com IA **de terceiro**, não o protótipo do dono. Subdomínio
`*.vercel.app` é único globalmente: o dono **não** publicará nessa URL — o import vai gerar outro
subdomínio (ou exigir outro nome de projeto). A afirmação não está sustentada por evidência alguma
(no ADR ela aparece como fato, não como `NÃO VERIFICADO`), e o efeito colateral é de marca: o nome
"AI Media Studio" já está ocupado na Vercel, o que alimenta a decisão aberta **D7** (Rebeca × AI Media Studio).

**Bloqueante para a afirmação do ADR.** Não bloqueia o código nem o CI.

### A2 — BLOQUEANTE (processo): a Vercel vai instalar com **pnpm 10.x**; CI e máquina local usam pnpm 11.x

Nada no repositório fixa a versão do pnpm (`package.json` sem `packageManager`; `git ls-files` não tem
`.npmrc` nem `pnpm-workspace.yaml`). A Vercel então decide pela **data de criação do projeto**:

```text
> node -e "import('@vercel/build-utils').then(m=>console.log(JSON.stringify(
    m.detectPackageManager('pnpm', 9, new Date('2026-09-30').getTime(), {major:24}), null, 2)))"
{
  "path": "/pnpm10/node_modules/.bin",
  "detectedLockfile": "pnpm-lock.yaml",
  "detectedPackageManager": "pnpm@10.x",
  "pnpmVersionRange": "10.x"
}
```

Fonte lida em `@vercel/build-utils@14.13.2/dist/fs/run-user-scripts.js`: `detectPnpmVersion()` devolve
`pnpm 10` quando `lockfileVersion === 9` e o projeto foi criado depois de `PNPM_10_PREFERRED_AT`
(2025-02-27) e antes de `PNPM_11_PREFERRED_AT` (2027-03-01). O próprio código avisa:
*"Detected `pnpm-lock.yaml` 9 which may be generated by pnpm@9.x, pnpm@10.x, or pnpm@11.x — Using pnpm
based on project creation date. To use a different version, set package.json#packageManager"*.

Prova de que CI e máquina local divergem:

```text
> (log do job 110055571280, CI)   Downloading pnpm 11.28.3 from the npm registry
                                 Done in 550ms using pnpm v11.28.3
> pnpm -v (Windows, dono)        11.25.0
```

Consequência: **o "CI verde" não cobre o comando de instalação que a Vercel executa** —
`pnpm install --frozen-lockfile` com um lockfile gerado por pnpm 11.25 sobre pnpm 10 é
**NÃO VERIFICADO**, e o modo de falha conhecido é `ERR_PNPM_OUTDATED_LOCKFILE` no primeiro build.
Correção de uma linha (não aplicada, porque QA relata e não conserta): `"packageManager": "pnpm@11.25.0"`.
O ADR e o `ci.yml` verificaram o **Node** da Vercel e nunca o **pnpm** — a verificação está incompleta
justamente onde o build começa.

### A3 — NÃO BLOQUEANTE: a varredura de segredo tem três falsos negativos reais

Em repositório git isolado, com o **comando exato do CI**:

```text
# (1) mesmo segredo, dois encodings
> git grep -nEI '(ghp_...[AIza[0-9A-Za-z_-]{35}|...|sk-[A-Za-z0-9]{20,})' -- .
utf8.txt:1:GOOGLE_API_KEY=AIzaSyD9k3Lm2Qp7Rt5Vw8Xy1Za4Bc6De0Fg9Hi      <-- UTF-8: PEGA
> git grep -nI --text 'AIza' -- utf16.txt
( sem saída, exit 1 )                                                   <-- UTF-16LE: NÃO PEGA
> git ls-files --eol utf16.txt utf8.txt
i/-text w/-text   utf16.txt     <-- git trata como binário
```

Isso não é hipótese: **6 arquivos `.rebeca/evidencias/*.txt` do repositório são UTF-16LE com BOM**
(`FF FE`), e `ci.yml` usa `git grep -I`, que ignora binário:

```text
> git ls-files ".rebeca/evidencias/*.txt" | % { bytes/NUL/first4 }
build.txt                        bytes=1504  NUL=746  first4=FF FE 6E 00
build-ciclo.txt                  bytes=2352  NUL=1170 first4=FF FE 6E 00
build-ciclo-final.txt            bytes=1504  NUL=746  first4=FF FE 6E 00
vitest.txt                       bytes=1900  NUL=938  first4=FF FE 0D 00
vitest-ciclo.txt                 bytes=5528  NUL=2743 first4=FF FE 0D 00
vitest-ciclo-2.txt               bytes=5526  NUL=2742 first4=FF FE 0D 00
vitest-ciclo-final.txt           bytes=5520  NUL=2739 first4=FF FE 0D 00
```

```text
# (2) formatos de segredo que o regex não cobre (todos no arquivo, nenhum casado)
> git grep -nEI '(...)' -- outros.txt
( sem saída )
> git grep -nI 'GOCSPX' -- outros.txt          # controle: o arquivo É varrido
outros.txt:2:GOOGLE_CLIENT_SECRET=GOCSPX-Ab3xY9zQ7wL2mN5pR8sT1vW4
```

Não cobertos: `GOCSPX-` (client secret do Google), JWT `eyJ...` (service_role do Supabase),
`AKIA...` (AWS), `xoxb-...` (Slack), `1//...` (refresh token do YouTube). O `refresh_token` aparece
literalmente em 8 arquivos do repositório, mas **nunca é varrido como valor**.

```text
# (3) histórico não é varrido
> git commit segredo; git rm segredo; git commit
> git grep -nEI '(ghp_[0-9A-Za-z]{36})' -- .     -> sem saída, exit 1
> git log -p --all | Select-String 'ghp_ABCDEF'  -> encontra a linha
```
E o CI vê **um** commit: `actions/checkout@v7` roda com `fetch-depth: 1` (log do job).

### A4 — NÃO BLOQUEANTE: falso positivo latente do regex (`sk-[A-Za-z0-9]{20,}`)

```text
> echo '...disk-usage-report-generation... risk-assessmentandmitigationgate' > doc.md
> git grep -nEI '(AIza[0-9A-Za-z_-]{35}|sk-[A-Za-z0-9]{20,})' -- .
doc.md:1:Ver rotina de disk-usage-report-generation no pipeline e o risk-assessmentandmitigationgate.
```
Prosa legítima deixa o CI vermelho. Hoje não há ocorrência no repositório (o comando exato do CI sai 1),
mas o padrão é frágil em documentação técnica em inglês.

### A5 — NÃO BLOQUEANTE: a linha de evidência `estado.md:295` é falsa **como escrita**

`estado.md:295` diz: `| Segredo no index | git grep --cached por ghp_/gho_/AIza/PRIVATE KEY/sk- | ✅ nenhum match |`.

```text
> git grep --cached -n -e 'ghp_' -e 'gho_' -e 'AIza' -e 'PRIVATE KEY' -e 'sk-' -- .
.dsh/skills/rebeca-github/SKILL.md:113:... 'sk-|ghp_|AIza|eyJ' ...
.dsh/skills/rebeca-react/SKILL.md:104:... "sk-|SUPABASE_SERVICE|service_role" ...
.dsh/skills/rebeca-seguranca/SKILL.md:62:... 'eyJ|AIza|refresh_token|client_secret' ...
.github/pull_request_template.md:43:(`git diff --cached` filtrado por `ghp_|gho_|AIza|PRIVATE KEY|sk-`...)
.github/workflows/ci.yml:40:if git grep -nEI '(ghp_...[AIza[0-9A-Za-z_-]{35}...' -- .; then
.rebeca/estado.md:295:| Segredo no index | `git grep --cached` por `ghp_`/... | ✅ nenhum match |
.rebeca/evidencias/qa-dossie-d2.md:335:... `SAFETY.INPUT.*` ...
.rebeca/pesquisa/_partes/video.md:71:... task-failures/ ...
.rebeca/pesquisa/d2-provedores-ia-midia.md:976:... task-failures/ ...
Binary file imagens/modelo1.jpeg matches
(10 arquivos com match)
```
O comando citado casa **10 arquivos**, inclusive um JPEG e a própria linha que faz a afirmação. O que
de fato retorna vazio é o regex com limite de comprimento do `ci.yml` (`git grep -nEI '(...)'` → exit 1).
Ou seja: a evidência registrada não corresponde ao comando que produz o resultado. O mesmo comando
comandado aparece no `pull_request_template.md` como checklist obrigatório — e é um checklist que
**nunca passa** neste repositório.

### A6 — NÃO BLOQUEANTE: o escopo revisado não é o escopo publicado

```text
> git log --format='%h %ad %s' --date=iso -3
fc9ca29 2026-09-30 16:18:15 -0300 docs(adr-003): verifica na implementacao da Vercel qual Node o build usa
bc37d53 2026-09-30 16:17:08 -0300 docs(estado): registra publicação na nuvem (D6 fechada), CI verde e...
4c49743 2026-09-30 16:14:17 -0300 chore(deploy): versionar o protótipo e configurar publicação via...
> git rev-parse HEAD; git rev-parse origin/main
fc9ca2917704062700e517dd07e1a49f7f6d1444
fc9ca2917704062700e517dd07e1a49f7f6d1444   (idênticos)
```
O brief de revisão cita dois commits; o tip publicado tem **três**, e o terceiro altera justamente
`ADR-003` (12 linhas) e `estado.md`. Verificá-lo exigiu reabrir o ADR; um revisor que confiasse na lista
de commits revisaria o texto errado. (Registro honesto: o amend de `4c49743` **não** força-push —
`gh api repos/donclaudito/rebeca/commits/b418116` → `422 No commit found`, e `git branch -a --contains b418116`
→ vazio, então o amend ocorreu antes do primeiro push.)

### A7 — NÃO BLOQUEANTE: `dependabot.yml` referencia labels inexistentes

```text
> gh api repos/donclaudito/rebeca/labels | jq -r '.[].name'
accessibility / bug / documentation / duplicate / enhancement / good first issue /
help wanted / invalid / question / wontfix
```
`area:infra` e `risco:dependencia` (usadas nas duas entradas de `dependabot.yml`) não existem. O
Dependabot roda verde (2 runs `success`), mas `gh pr list --state all` está vazio: nem a rotulagem nem
PRs foram observados — o "✅ já ativo" de `estado.md` está sustentado apenas pelo workflow estar ativo.

### A8 — NÃO BLOQUEANTE: as evidências de build começam com um banner de erro e não têm exit code

```text
> Get-Content .rebeca/evidencias/build.txt -Encoding Unicode | Select -First 6
node.exe : $ tsc --noEmit && vite build
No C:\Users\cla...\pnpm.ps1:24 caractere:5
+     & "node$exe"  "$basedir/node_modules/pnpm/bin/pnpm.mjs" $args
+     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
+ CategoryInfo          : (...String) [], RemoteException
+ FullyQualifiedErrorId : NativeCommandError
```
O arquivo só mostra o `✓ 1969 modules transformed` / `dist/index.html 0.64 kB ...` **depois** desse
banner (artefato de `2>&1` no PowerShell 5.1, que embrulha stderr como erro). Não há `exit 0` registrado.
Pela regra "evidência é comando + saída", a evidência de build é ambígua para quem audita depois.

### A9 — NÃO BLOQUEANTE (imprecisão factual): o range do `vitest@5` citado está incompleto

```text
> node -e "console.log(JSON.stringify(require('./node_modules/vitest/package.json').engines))"
{"node":"^22.12.0 || ^24.0.0 || >=26.0.0"}
> node -e "console.log(JSON.stringify(require('./node_modules/vite/package.json').engines))"
{"node":"^20.19.0 || >=22.12.0"}
```
`ADR-003` e o comentário do `ci.yml` dizem "`vitest@5` exige `^22.12.0`". O engine real do
`vitest@5.0.2` é `^22.12.0 || ^24.0.0 || >=26.0.0` (o do `vite@8.3.1` está correto). A conclusão
(piso 22.12.0) não muda; a citação está errada.

## 3. Afirmações que eu **não** consegui refutar (tentei)

- **R1 — versões e inputs das Actions.** Tentei derrubar `pnpm/setup@v3`, `actions/checkout@v7`,
  `actions/upload-artifact@v7`, `runtime: node@22`, `version: 11`, `cache: true` como inexistentes ou
  ignorados. O log do job `110055571280` mostra `Download action repository 'pnpm/setup@v3'
  (SHA:fbda4c85...)`, `Installing runtime node@22...` → `+ node 22.23.3`, `Downloading pnpm 11.28.3`, e
  8/8 steps `success`; o `action.yml` de `pnpm/setup@v3` documenta exatamente `version`, `runtime`,
  `cache`. A lógica `if git grep ...; then ... exit 1; fi` está correta (não invertida), o shell default
  `bash -e` não aborta na condição, e `permissions: contents: read` + ausência de qualquer step de
  deploy confirmam que o CI não publica nada. **Não refutado.**
- **R2 — `engines.node` em faixa.** Tentei provar que a Vercel exige `22.x`. Refutação falhou, e o
  contrário ficou provado:
  `getSupportedNodeVersion('>=22.12.0')` → `major 24 (range 24.x, runtime nodejs24.x)`;
  `'22.x'` → 22; `'>=26.0.0'` → `Found invalid or discontinued Node.js Version`; `'20.x'` → aviso
  `Deployments created on or after 2026-10-01 will fail to build`. A afirmação do ADR-003 §Decisão 5 e
  §Verificação 5 está **correta e reproduzível** (`@vercel/build-utils@14.13.2`).
- **R3 — testes, build e tamanhos.** `gh run list` → runs `36764392338` e `36764628814`, ambos
  `success`; log: `Test Files 4 passed (4)`, `Tests 19 passed (19)`. Baixei o artefato do CI e os
  números de `estado.md` batem byte a byte: `index.html` 640 B (0,64 kB),
  `assets/index-CYHdAstY.css` 29.981 B (29,98 kB), `assets/index-CFwInN9n.js` 424.161 B (424,16 kB).
- **R4 — `.gitattributes` corrompendo binário/lockfile.** `git check-attr -a imagens/modelo1.jpeg` →
  `binary: set`, `text: unset`; `git check-attr -a "O APP.pdf"` → idem (a regra `*.pdf binary` vem
  **depois** de `* text=auto` e vence). `pnpm-lock.yaml` tem `text: auto`, mas tem **CRLF=0** e
  `git status --porcelain` volta vazio → não há normalização pendente nem corrupção. **Não refutado.**
- **R5 — trancamento de branch "exige plano pago".** Tentei refutar com a hipótese de que o GitHub
  liberou para repo privado. A API refuta a hipótese: `gh api repos/donclaudito/rebeca/branches/main/protection`
  → `403 {"message":"Upgrade to GitHub Pro or make this repository public to enable this feature."}`.
  A afirmação de `estado.md` ("Não verificado" #3) está **correta**.
- **R6 — `spawn EPERM` local.** `pnpm build` e `pnpm test` falham **neste ambiente** com
  `Error: spawn EPERM at optimizeSafeRealPathSync (.../vite/dist/node/chunks/node.js:2458)` —
  é o limite do meu sandbox (spawn de filho com stdio em pipe), não defeito do produto. Reporto como
  **NÃO VERIFICADO localmente**; o critério está coberto pelo CI em Node 22.23.3 e pelo artefato do build.

## 4. Invariantes do projeto (AGENTS.md)

| Invariante | Veredito | Evidência |
|---|---|---|
| 1. Aprovação humana antes de publicar | **não violado** | `ci.yml` não tem step de deploy; `permissions: contents: read`; nada foi ao YouTube. O "dist" do CI é artefato interno de 7 dias, não publicação de conteúdo |
| 2. Isolamento entre canais | **não violado** | a entrega não toca dados; os testes de escopo (`a camada de dados recusa conteúdo que pertence a outro canal`, `a fila de revisão nunca devolve conteúdo de outro canal`) passam no CI |
| 3. Consistência de marca | **não violado, mas com pendência declarada** | o artefato publicado diz "AI Media Studio"; D7 (Rebeca × AI Media Studio) segue **aberto** em `estado.md`, não resolvido em silêncio |
| 4. Custo é requisito | **N/A / nada lançado** | nenhuma geração paga nesta entrega; `.rebeca/custos.csv` coerente |
| 5. Multi-canal desde o design | **não violado** | nenhum artefato codifica canal único |
| 6. Conteúdo infantil tem regra própria | **N/A** | nenhum conteúdo gerado |
| 7. Provedores substituíveis | **N/A** | sem integração de IA nesta entrega |
| Segredos nunca em texto claro | **não violado no que o índice mostra** | `git ls-files` sem `.env`/`*.pem`/`*.key`; 3 commits de histórico varridos sem segredo real. **Ressalva A3**: o *scanner* é que é fraco, não o índice |
| "O CI publica algo?" | **não** | workflow acima; log sem nenhum secret de deploy |
| "O repo privado expõe dado pessoal?" | **não** | `gh api` → `.private: true`; busca por e-mail/CPF só casou nomes de artefato (`pauta@v2.md`); metadados do PDF do cliente: `/Title (Untitled)`, `/Creator (TextEdit)`, `/Producer (macOS ... Quartz PDFContext)`, sem nome. **Risco declarado**: a Vercel passa a ter leitura do repo privado (o ADR assume) e o protótipo, quando publicado, será indexável — não há decisão de `noindex`/`robots.txt` no ADR |
| Trabalho da sessão irmã declarado com honestidade | **sim** | `estado.md` "Não verificado" #4: *"O commit `4c49743` carrega trabalho da sessão irmã (D2, ciclo canônico, telas) que **não passou por `rebeca-qa`** nesta sessão — o CI prova que compila, testa e builda; não prova que o produto está correto."* A declaração é precisa. (O que muda é A6: o tip real é `fc9ca29`, não `4c49743`.) |

## 5. O que `estado.md` diz que ainda depende do dono

Resposta direta à pergunta "alguma coisa foi declarada como pronta que ainda depende do dono?" — **sim, uma,
e ela está declarada em outra linha do mesmo documento**:

- D6 aparece como **✅ fechada em 2026-09-30** (`estado.md:190`) e o título da seção é "Publicação na
  nuvem (D6 fechada nesta sessão)", mas a linha "Projeto na Vercel" é **⏳ o dono faz o import em
  `vercel.com/new`**. Não há deploy (`deployments` → `[]`), não há URL, o rewrite e os headers nunca
  viram HTTP 200 em rota profunda (o ADR-003 §Verificação 3 é explícito: *"é isso que refuta (ou
  confirma) o item 4 da Decisão"*), e o domínio decidido está ocupado (A1).
- Leitura dos dois trechos juntos é honesta; a leitura só da linha ✅ de D6 e do título da seção não é.
  Uma linha de `status:` no topo da seção ("publicação: repositório ✅ / build ✅ / deploy ⏳ dono")
  eliminaria a ambiguidade.
- Adicionalmente, o `commit 4c49743` citado na tabela é o commit de código, não o tip publicado (`fc9ca29`).

## 6. Veredito final

**`refutado`.**

- **Bloqueante (afirmação):** A1 — `ADR-003` registra como decidida uma URL que pertence a terceiro.
  O dono, ao importar, não publica nela. Corrigir o ADR antes de repetir a instrução ao dono.
- **Bloqueante (processo):** A2 — o `--frozen-lockfile` da Vercel vai rodar em pnpm 10.x enquanto o CI
  prova o build em pnpm 11.x; nada fixa a versão. Fixar `packageManager` **antes** do import (uma linha).
- **Não bloqueante:** A3–A9 (scanner de segredo fraco em 3 eixos; falso positivo latente; evidência de
  `estado.md:295` que não corresponde ao comando; escopo publicado ≠ escopo revisado; labels do
  Dependabot inexistentes; evidências UTF-16 com banner de erro; range do `vitest@5` citado incompleto).
- **Não verificado:** comportamento do rewrite/headers/preset na Vercel (exige deploy), schema do
  `vercel.json` checado só parcialmente (fetch truncado), `pnpm 10 + --frozen-lockfile`, e o build local
  (bloqueado pelo meu sandbox, não pelo produto).
- Aprovar esta entrega **não** autoriza publicar: publicação continua dependendo de aprovação humana
  registrada, e o deploy na Vercel continua dependendo do dono.
