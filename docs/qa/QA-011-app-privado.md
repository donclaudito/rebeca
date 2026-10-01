# QA-011 — Verificação adversarial da entrega "app privado" (ADR-011, camada 2)

**Revisor:** `rebeca-qa` (subagente) · **Data:** 2026-10-01, 06:20–06:45 (-03:00)
**Ambiente:** Windows · Node v26.7.0 · pnpm 11.25.0 · vercel CLI no PATH (`C:\Users\clauo\AppData\Roaming\npm\vercel.ps1`), **sem** `~/.vercel/auth.json` e **sem** `.vercel/` linkado → não há como ligar a camada 1 daqui.
**Escopo revisado (hashes dos arquivos que eu efetivamente verifiquei):**

| Arquivo | sha256 (medido) |
|---|---|
| `vercel.json` | `577B747F3AF2DF6E56A5720E5277A0081C2FD325FFC9DCB246000CB7B87CACBE` |
| `index.html` | `5FCB98D3502B6AC259635AAD23D31D5B4EA49754F29D2F5ADBDF50529CEA1991` |
| `public/robots.txt` | `D8E55997A9F4555DFF1680A1CD30CB09EF83A6CC4F9AA01B4DFBC29B7D6D65C8` |
| `src/__tests__/headers.test.ts` | `FFAB5C430D7D9832518AC1C90B869D234DD746E0A9D3D4187BBEEC9ABEC84AF9` |
| `README.md` | `4B556E821813363D3C46A10A36920F3F24D836143FF59087A0D04248B8009089` |

Head do git: `f25e1a3`. `git diff --numstat` da entrega: `README.md 9/0`, `index.html 7/0`, `vercel.json 5/0`, `headers.test.ts 27/1` — **puramente aditivo**, nenhuma linha de configuração de segurança foi removida.

---

## 0. Limite de ferramenta — como eu rodei o que rodei (declarado, não maquiado)

O brief previa `spawn EPERM` e ele se confirmou, **duas vezes**:

```text
> pnpm run build
OK: prompts em sincronia com .rebeca/prompts/.
failed to load config from E:\pojeto rebeca\vite.config.ts
Error: spawn EPERM at optimizeSafeRealPathSync (.../vite/dist/node/chunks/node.js:2458:2)
EXITCODE=1

> pnpm exec vitest run src/__tests__/headers.test.ts
Startup Error ... Error: spawn EPERM (mesmo ponto: windowsSafeRealPathSync → optimizeSafeRealPathSync)
EXITCODE=1
```

Causa medida, não suposta: o Vite chama `exec("net use")` para montar o mapa de unidades de rede do Windows, e **neste sandbox todo `spawn` com stdio em pipe é bloqueado**:

```text
> node -e "try{require('child_process').execSync('cmd /c echo hi')}catch(e){console.log('execSync FAIL',e.code)}"
execSync FAIL EPERM
> node -e "const fs=require('fs');console.log(fs.realpathSync.native('E:/pojeto rebeca'))"
E:\pojeto rebeca      <-- E: é unidade LOCAL; o `net use` não teria nada a mapear
```

**Sou subagente com escopo fixo e as aprovações estão desabilitadas nesta sessão** — o único caminho que o brief autoriza (repetir com `sandbox_permissions: danger-full-access`) seria rejeitado automaticamente, então **não o usei**. Em vez disso, reestruturei os comandos para **não capturar saída de processo filho**, que é o que a própria documentação do harness permite:

1. **Testes:** config mínima própria (`pool: 'threads'`, `isolate: false`, sem o plugin do Tailwind) apontando para **o arquivo de teste real**. O teste exercitado é exatamente o do repositório, com as mesmas asserções; só o carregador é diferente. Harness recriável, apagado no fim.
2. **Build:** neutralizei **uma** chamada em `node_modules/.../vite/dist/node/chunks/node.js:2458` (`exec("net use", …)` → `if (false) exec(…)`), com **backup e restauração conferidos por sha256**. A build rodada é a real (`vite.config.ts` do produto, plugins do produto). Restauração provada:
   ```text
   RESTORE: patched=dfba20bb… restored=5a604cb8f97126675dbdf9044c919b0fd1fe1280bfa4077de225e6adfa213e4a
            backup=5a604cb8… identical=true
   ```
   O hash final do arquivo de dependência no fecho deste relatório é `5a604cb8f97126675dbdf9044c919b0fd1fe1280bfa4077de225e6adfa213e4a` (idêntico ao original medido antes da intervenção). `node_modules` não é versionado e nada do produto foi tocado.

**A árvore está sendo escrita por outra sessão enquanto eu auditava** (D9 cobrando o preço de novo): entre o início e o fim da auditoria apareceram como modificados `server/media/ffmpeg.ts`, `server/media/ledger.ts`, `server/media/providers/simulated.ts`, `server/media/simulated-episode.ts`, `src/media/contract.ts`, `src/media/limits.ts`, `src/media/__tests__/media-{custo,render}.test.ts`. Isso importa para o achado A3 e está registrado aqui de propósito.

---

## 1. Veredito

**REFUTADO — em escopo restrito.**

- A **camada 2** (as três marcas: cabeçalho, `robots.txt`, meta tag) **chega ao artefato**, os **três testes novos mordem** (mutação uma a uma) e o **contrato do ADR-008 sobrevive** (o hash do script inline continua batendo). Não consegui refutar nenhum desses pontos, e os reproduzi de forma independente.
- O que **cai** é uma **afirmação de estado** no `README.md`: ele apresenta a camada 1 (proteção de deploy) como o que "fecha a porta", **sem marcá-la como pendente de ação do dono** — ao contrário do ADR-011 e do `estado.md`, que trazem `⏳`. Medido agora: **a produção continua respondendo 200 sem credencial nenhuma**. O README é o arquivo que o dono lê primeiro, e é o único lugar em que a camada 1 não está marcada como não ligada. O projeto proíbe "fingir que a aprovação aconteceu"; aqui o risco é o inverso e igualmente caro: o dono ler "privado" e não clicar.

Também caem (gravidade média) duas coisas que andam junto: a evidência de `tsc` citada pelo ADR está **vazia** e na árvore de hoje o `tsc` **falha** — ou seja, se esta árvore for publicada como está, o `buildCommand` do `vercel.json` **quebra o deploy**.

---

## 2. Achados (gravidade, comando + resultado observado)

| # | Gravidade | Achado | Evidência |
|---|---|---|---|
| **A1** | **alta** | `README.md` afirma o deploy privado e **não marca a camada 1 como pendente do dono**; a produção segue pública | §3.1 |
| **A2** | **média** | `.rebeca/evidencias/tsc-privado.txt` está **vazio (0 bytes)** e `pnpm exec tsc --noEmit` hoje **falha** (2 erros) — a linha "Tipos ✅ exit 0" não tem evidência nem se reproduz | §3.2 |
| **A3** | **média** | `pnpm run build` — que é o `buildCommand` do `vercel.json` — **falha na árvore atual**: publicar esta árvore quebra o deploy (causa: frente de mídia em edição concorrente, **não** esta entrega) | §3.2 |
| **A4** | **média** | `README.md:102` diz que a aplicação em produção é o projeto **`ai-media-studio`**; medido, esse domínio é de **terceiro** e o app do dono está em `rebeca-odda.vercel.app` (o QA-003 A1 já apontara o mesmo texto no ADR-003; nunca foi corrigido) | §3.5 |
| **A5** | baixa | `public/robots.txt` termina com uma diretiva `Sitemap:` **sem valor** — não declara nada e não é URL absoluta; inofensiva (RFC 9309 §2.2.4), mas é ruído | §3.6 |
| **A6** | baixa | `estado.md` apresenta como **citação** da Vercel o texto `"all URLs, including production domains"`, que não é literal | §3.5 |
| **A7** | baixa / **não verificado** | "vale para os deploys existentes **no ato**" (README:107, ADR-011 §Decisão) é inferência: a doc diz que *All Deployments* protege "all URLs"; não afirma cobertura de deploys já existentes nem imediatez | §3.5 |
| **A8** | baixa | Título da seção do `estado.md`: "App publicado é privado" no afirmativo (atenuado pelo `⏳` da tabela e pelo parágrafo seguinte) | §3.5 |
| **A9** | baixa | Os 3 testes novos são **mais estritos que as especificações que codificam**: HTML válido com atributos em outra ordem, `User-Agent:` com maiúscula e `Disallow: / ` com espaço final são reprovados | §3.4 |
| **A10** | baixa / **não verificado** | A interação `Disallow: /` × `noindex` (o rastreador que respeita o `Disallow` não busca a página, logo não lê a meta tag nem o cabeçalho) **não foi confirmada em fonte** nesta sessão | §3.6 |

**Nenhum achado de gravidade alta no código.** O único achado alto é de texto/afirmação.

---

## 3. Achados detalhados

### 3.1 A1 — alta: o README diz "privado" sem dizer "ainda não está ligado"

```text
> Select-String -Path README.md -Pattern 'privad|All Deployments' -Context 0,3
README.md:105: **O deploy é privado por decisão, não por sorte** (`ADR-011`). Duas camadas, e a primeira é a que fecha
README.md:106: a porta: **Deployment Protection → Vercel Authentication com escopo _All Deployments_** — gratuita no
README.md:107: plano Hobby, cobre **todas** as requisições, inclusive `/api/*`, e vale para os deploys existentes no
README.md:108: ato. Ela é **por projeto**: se houver mais de um projeto recebendo este repositório, ligue em todos.
```

O parágrafo descreve a camada 1 no presente, com o artigo definido ("**a** primeira é **a que fecha** a
porta"), dentro da seção **"Onde roda (nuvem)"**, cuja tabela acima descreve o estado **atual** de
produção. Não há em nenhuma linha do README a marca `⏳`, a frase "o dono precisa ligar" nem "enquanto
isso o app continua público". A única pista de que não está ligada é um imperativo genérico ("ligue em
todos") que pode ser lido como recomendação para o futuro, não como pendência atual.

O contraste com os outros documentos é o que caracteriza o defeito — não é interpretação minha, é
comparação dentro da própria entrega:

| Documento | Camada 1 marcada como pendente? |
|---|---|
| `ADR-011-app-privado.md:33` | ✅ `⏳ ação do dono (1 clique por projeto)` |
| `.rebeca/estado.md` (tabela nova) | ✅ `⏳ **ação do dono**` + "Enquanto o dono não ligar, o app **continua público**" |
| `public/robots.txt` | ✅ "Quem fecha a porta é a proteção de deploy" (futuro) |
| `README.md` | ❌ **não marca** |

O dano não é estético: o dono pediu "fazer ele privado", recebe o resumo de que a entrega está pronta e
lê no README que o deploy é privado. **A porta continua aberta e a rota que gasta dinheiro continua
alcançável.** Medido agora, contra produção:

```text
> node -e "fetch('https://rebeca-odda.vercel.app/api/ai/status').then(async r=>console.log(r.status, await r.text()))"
200 {"ready":true,"hasAnyKey":false,"simulated":true,"providers":…}
> headers de /api/ai/status:
  content-security-policy: default-src 'self'; script-src 'self' 'sha256-qpRjRiAY…'; …
  x-robots-tag: (ausente)
  x-vercel-cache: MISS      x-vercel-id: gru1::iad1::…
```

`200` **sem credencial** e **sem `X-Robots-Tag`** = camada 1 desligada **e** camada 2 ainda não publicada
(nada foi commitado/pushado, como o próprio `estado.md` declara). As duas coisas estão coerentes com o
ADR; o que não está coerente é o README.

**Correção sugerida (uma frase, não aplicada — QA relata, não conserta):** no README, trocar o presente
por estado explícito — *"camada 1: ⏳ **ainda não ligada** (ação do dono); até então o app continua
público"*.

### 3.2 A2/A3 — média: a evidência de `tsc` está vazia e o `buildCommand` do deploy falha hoje

```text
> (Get-Item .rebeca/evidencias/tsc-privado.txt).Length
0
```

O arquivo que o ADR-011 §Verificação apresenta como prova de "Tipos: `pnpm exec tsc --noEmit` → exit 0"
tem **zero bytes**. Pela regra do projeto ("evidência é comando + saída", AGENTS.md), ele não é
evidência. E o comando, hoje, não fecha:

```text
> pnpm exec tsc --noEmit
server/media/simulated-episode.ts(317,7): error TS2345: Argument of type '"estimativa-obrigatoria"' is not assignable to parameter of type '"custo-invalido" | "teto-mensal" | "teto-por-minuto"'.
src/media/__tests__/media-render.test.ts(100,49): error TS2307: Cannot find module '../../limits.js' or its corresponding type declarations.
TSC_EXIT=1
```

Os dois erros estão na **frente de mídia** (arquivos listados como modificados por outra sessão no mesmo
minuto), não em arquivo desta entrega — `vercel.json`, `index.html`, `public/robots.txt` e
`headers.test.ts` não têm nenhuma relação com eles. Mesmo assim, o efeito é material e precisa ficar
escrito: **`pnpm run build` é literalmente o `buildCommand` do `vercel.json`** —

```text
> pnpm run build
OK: prompts em sincronia com .rebeca/prompts/.
server/media/simulated-episode.ts(317,7): error TS2345: …
src/media/__tests__/media-render.test.ts(100,49): error TS2307: …
EXITCODE=1
```

ou seja, **um `git push` da árvore como ela está hoje derruba o deploy** (e a camada 2 nunca chega ao ar,
o que transformaria a entrega em decoração por um motivo diferente do previsto). Isto **não** é defeito
desta entrega, mas é a resposta honesta à pergunta "o app continua buildando?": **o build do produto
passa; o `buildCommand` completo da árvore atual, não.** Ver §4 (E1) para a prova de que o produto em si
builda.

### 3.3 E1/E3/E4 — o que eu **não** consegui refutar (com reprodução independente)

Ver as tabelas de §4. Resumo: artefato publicado contém as três marcas; cada camada mutada deixa
exatamente o seu teste vermelho; CSP intacto.

### 3.4 A9 — baixa: os testes novos são mais estritos que o HTML/ABNF válidos

Os três casos novos usam regex ancorados na forma canônica. Consequência: **documento válido reprovado**.

```text
> node .qa-tmp/regex-probe.mjs
meta com atributos em outra ordem (HTML válido): false
robots com "User-Agent: *" (ABNF é case-insensitive): false
robots com "Disallow: / " (WS no fim é permitido): false
```

- `<meta content="noindex, nofollow" name="robots" />` é HTML válido (a ordem dos atributos não importa)
  e o regex `/<meta\s+name="robots"\s+content="[^"]*noindex/` o reprova.
- A ABNF do RFC 9309 usa literais com semântica **case-insensitive** (RFC 5234 §2.3), logo
  `User-Agent: *` é equivalente a `user-agent: *`; o teste exige a minúscula.
- `rule = *WS ("allow" / "disallow") *WS ":" *WS (path-pattern / empty-pattern) EOL` com
  `EOL = *WS [comment] NL` admite espaço no fim; o teste exige `Disallow: /$`.

**Direção do erro:** é falso **vermelho**, não falso verde — o teste não dá confiança indevida, ele
apenas reprova formas equivalentes. Por isso a gravidade é baixa; não é motivo para bloquear, é motivo
para escrever a asserção sobre o significado (ex.: parsear as diretivas) em vez da forma.

### 3.5 A4/A6/A7/A8 — baixa/média: afirmações contra a fonte e contra o estado real

**(a) A fonte da Vercel está correta — conferi as duas páginas citadas pelo ADR-011 e pelo `estado.md`:**

```text
> web_fetch https://vercel.com/docs/deployment-protection(.md)   last_updated: 2026-09-15
"Deployment Protection requires authentication for all requests, including those to Routing Middleware."
"Select **All Deployments** to secure all deployments (both preview and production), restricting public access entirely."
"Password Protection … Not available on Hobby" · "Available on Pro for $20 per month per protected project"
> web_fetch https://vercel.com/docs/deployment-protection/usage-and-pricing(.md)   last_updated: 2026-09-15
| Vercel Authentication | Included | Included | Included |
| Standard Protection   | Included | Included | Included |
| All Deployments       | Included | Included | Included |
| Password Protection   | Not available | $20 per month per protected project | Included … |
```

**Veredito:** as citações literais do `ADR-011` §Fato de fonte são **exatas** e o quadro de plano/preço
está **correto** (Hobby inclui Vercel Authentication e All Deployments; Password Protection não existe no
Hobby e custa US$ 20/mês por projeto no Pro). Nada inventado aqui.

**(b) A6 — citação não literal (`estado.md`):** o texto entre aspas é
`*All Deployments* protege "all URLs, including production domains"`. A doc diz: *"With this
configuration, all URLs are protected, including your production domain `example.com` and generated URLs
like `my-project-1234.vercel.app`"*. O sentido é o mesmo; a forma, não. Baixa, mas o projeto trata
citação como citação.

**(c) A7 — "vale para os deploys existentes no ato": NÃO VERIFICADO.** A doc descreve *All Deployments*
como "all URLs are protected" e só as variantes **legadas** explicam explicitamente o que **não** fica
protegido ("(Legacy) Pre-Production Deployments … Does not protect past production deployments"), o que
**sugere** que a variante atual cobre deploys antigos — sugestão, não frase. Imediatez ("no ato") não
está documentada em lugar nenhum que eu tenha lido. Fica como inferência declarada, não como fato.

**(d) A4 — o projeto em produção não é o que o README diz:**

```text
> web_fetch https://ai-media-studio.vercel.app   → HTTP 200
AI Media Studio — Explore Image Video Audio Canvas Edit Character Marketing Studio … Wan 2.2 I2V …
"⚠ Wan 2.2 takes 3–8 min — may timeout on free Vercel."
> node -e "fetch('https://rebeca-odda.vercel.app/api/ai/status')" → 200 (é ESTE o app do dono)
```

`README.md:102` (`| Aplicação em produção | **Vercel**, projeto \`ai-media-studio\` … |`) aponta para o
produto **de terceiro** que o QA-003 A1 já tinha documentado como bloqueante de afirmação no ADR-003. O
arquivo foi editado nesta entrega e a linha errada continuou lá — a entrega nova, no parágrafo
seguinte, fala em "mais de um projeto recebendo este repositório" sem nunca nomear `rebeca-odda`.
Gravidade média: quem seguir o README para conferir a proteção abre a URL errada.

**(e) A8 —** o título "App publicado é privado — decisão tomada, camada de código entregue" é
afirmativo no sujeito e correto no predicado (a tabela logo abaixo marca `⏳` e o texto diz "o app
continua público"). Fica registrado como imprecisão de manchete, não como defeito.

### 3.6 A5/A10 — baixa: `Sitemap:` vazio e a interação `Disallow` × `noindex`

`public/robots.txt` termina com:

```text
# Sem convite a rastrear o que não é público.
Sitemap:
```

RFC 9309 §2.2.4: *"Crawlers MAY interpret other records that are not part of the robots.txt protocol —
for example, 'Sitemaps' … Parsing of other records MUST NOT interfere with the parsing of explicitly
defined records"*. Ou seja: **não quebra nada** — a diretiva simplesmente não declara sitemap algum (o
protocolo de sitemaps exige URL absoluta). É ruído; o comentário acima dela já diz o que se pretendia.

**A10 — NÃO VERIFICADO:** com `Disallow: /`, um rastreador que respeite o protocolo **não busca** as
páginas — e, se não busca, não lê a meta tag nem o `X-Robots-Tag`. Se esse comportamento se confirmar, a
camada "noindex" não é aditiva ao `Disallow` para o rastreador educado (o RFC 9309 §1 é explícito no que
importa para o veredito: *"These rules are not a form of access authorization"*). Tentei confirmar na
documentação da Google nesta sessão e as páginas vieram truncadas (só navegação) — **não afirmo nem
nego**. Não muda o veredito: o ADR já declara, em texto, que a camada 2 não é controle de acesso.

---

## 4. Veredito por critério (os ataques que o brief pediu), com comando + resultado

| # | Critério / ataque | Veredito | Evidência (comando → resultado observado) |
|---|---|---|---|
| **E1** | A camada 2 chega ao artefato publicado (`dist/robots.txt` + meta em `dist/index.html`) | **confirmado** | `pnpm run build` **falha no `tsc`** (A3) → rodei o passo de build do produto: `pnpm exec vite build` → **exit 0**, `1979 modules transformed`, `dist/index.html 2,01 kB`. `Test-Path dist/robots.txt` → **True**, **734 bytes**, `sha256 = D8E55997…D65C8` **idêntico** ao de `public/robots.txt` → o Vite copiou `public/` byte a byte. `dist/index.html:13: <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />` presente |
| **E2** | O `robots.txt` sobrevive ao rewrite de SPA `/(.*) → /index.html` | **confirmado (por medição em produção)** | contra o deploy real: `/icone-32.png` → **200 `image/png`** e `/icone-96.png` → **200 `image/png`** (arquivos de `public/`, mesma origem e mesmo caminho de cópia do `robots.txt`), **apesar** do rewrite catch-all; `/marcador-inexistente-qa.txt` → **200 `text/html`** (o rewrite só age quando não existe arquivo). `/robots.txt` → 200 `text/html` **porque o arquivo ainda não está no deploy** (nada foi pushado), não porque o rewrite o engula. Fonte do comportamento: [Vercel — Routing](https://vercel.com/docs/routing) ("Vercel's CDN evaluates routing rules on every request…") + [Rewrites](https://vercel.com/docs/routing/rewrites). **Não verificado:** o `GET /robots.txt` **depois** do push (depende do deploy) |
| **E3** | Os testes mordem? Mutar cada camada, uma por vez, e restaurar byte a byte | **confirmado** | `node .qa-tmp/mutate.mjs <caso> on; pnpm exec vitest run --config .qa-tmp/vitest.qa.config.mts` → `header`: `1 failed \| 10 passed (11)`, `AssertionError: expected '' to contain 'noindex'`; `robots` (arquivo removido): `expected false to be true`; `meta`: `expected '<!doctype html>…' to match /<meta\s+name="robots"…/`. **Cada mutação derruba exatamente o seu caso** (e só ele) — 3 rodadas, exit 1 em todas. Restauração: `RESTAURADO … igual_ao_original=true` nos três, e `sha256` final dos três arquivos **idêntico** ao da linha de base (`577B747F…`, `D8E55997…`, `5FCB98D3…`). Árvore não ficou mutada (`git status` sem arquivo de produto alterado por mim; `.qa-tmp/` removido) |
| **E4** | O contrato do ADR-008 (hash do script inline do CSP) sobreviveu | **confirmado** | recalculei o hash do zero, sem usar o teste do autor: `sha256` do único `<script>` sem `src` do `index.html` = `qpRjRiAYTMBLET8G9KOyANYuFR15hjD791gTZufxShc=`, **presente** no `script-src`; `unsafe-inline` = false, `unsafe-eval` = false. O corpo do script inline é **byte a byte igual ao do HEAD** (comparação normalizando CRLF). Na suíte: `✓ autoriza por hash cada script inline que o documento carrega`. **Nada quebrou** |
| **E5** | Alguma afirmação do README/ADR/estado é falsa? Plano/preço da Vercel conferem com a fonte? | **refutado (parcialmente)** | Vercel: **conferido e correto** (ver §3.5a) — citações literais exatas, tabela Hobby/Pro exata. **README: A1 (camada 1 não marcada como pendente), A4 (projeto `ai-media-studio`)**; **estado.md: A6 (citação não literal)**; **A7 (inferência não verificada)**. Nenhum outro documento sugere que o app já está privado (varredura por `privad|noindex|All Deployments|robots` em `*.md`: 7 ocorrências, só o README afirma estado) |
| **E6** | Sem segredo exposto, CSP não afrouxado, `vercel.json` válido, app buildando | **confirmado, com ressalva (A3)** | `JSON.parse(vercel.json)` → OK; conferência estrutural contra o schema oficial (`https://openapi.vercel.sh/vercel.json`, `additionalProperties:false`): **sem erros** (chaves de topo permitidas; `headers[].{key,value}`; `rewrites[].{source,destination}`). Diff `IGUAL` em **todos** os cabeçalhos existentes, `CSP idêntico ao HEAD: true`, `rewrites idênticos: true`, `+X-Robots-Tag` é a única mudança. Varredura do diff por `sk-…/ghp_/AIza/GOCSPX/eyJ…/PRIVATE KEY/refresh_token/client_secret/api_key` → **nenhum match**. "App builda": **produto sim** (`vite build` exit 0); **`pnpm run build` não** (A3, causa externa) |

**Suíte do arquivo de teste, verde, reproduzida por mim:**

```text
> pnpm exec vitest run --config .qa-tmp/vitest.qa.config.mts --reporter=verbose
✓ 11 testes (11) · Test Files 1 passed (1) · EXITCODE=0
```

Nenhum `it.skip`/`it.todo` no arquivo. `.rebeca/custos.csv` continua legível (`Import-Csv` → 119 linhas,
14 colunas) e **nada foi gerado nem gasto** nesta entrega.

---

## 5. O que eu tentei refutar e **não** consegui

1. **Que o Vite não copia `public/`.** Refutação falhou no ato: `dist/robots.txt` existe, com o **mesmo
   sha256** do original — não é uma paráfrase, é o byte.
2. **Que o rewrite catch-all engole `/robots.txt`.** Refutação falhou **por medição em produção**:
   `/icone-32.png` e `/icone-96.png` (mesmo diretório de origem, mesmo caminho de cópia) são servidos
   como `image/png` com o rewrite ativo; só caminho **inexistente** cai no `index.html`.
3. **Que os testes são decorativos.** Refutação falhou: três mutações, três vermelhos, cada um no caso
   certo, com os arquivos restaurados byte a byte. Também tentei a via "o teste não olha o arquivo
   certo": ele resolve `public/robots.txt` a partir de `process.cwd()` e falha quando o arquivo
   desaparece — o caminho exercitado é o real.
4. **Que a entrega afrouxou o CSP ou removeu cabeçalho.** Refutação falhou: todo cabeçalho anterior
   continua idêntico ao HEAD, o `CSP` é idêntico caractere a caractere e o hash do script inline bate.
5. **Que a entrega inventou fato sobre a Vercel.** Refutação falhou nas duas páginas citadas: as
   citações são literais e a tabela de planos está correta.
6. **Que a árvore foi deixada mutada por mim.** Refutação falhou: hashes finais dos quatro arquivos da
   entrega iguais aos da linha de base, `.qa-tmp/` removido, dependência restaurada com hash conferido.
   (Registro honesto: minha **primeira** rodada de mutação não mutou nada — `createHash` importado de
   `node:fs` derrubou o script com `SyntaxError`, e as três rodadas verdes daquela tentativa **não
   provavam nada**. Corrigido o import, refiz as três. Nenhum arquivo foi tocado na rodada inválida.)

---

## 6. Não verificado (declarado, não maquiado)

1. **A camada 1 não existe no ar.** `GET https://rebeca-odda.vercel.app/api/ai/status` → **200 sem
   credencial**, sem `x-robots-tag`, medido nesta sessão (01/10/2026 09:26 GMT). O CLI da Vercel existe
   no PATH, mas **não há `~/.vercel/auth.json` nem `.vercel/`** — o agente não tem credencial e **não**
   ligou nada. A decisão continua **proposta**, não implementada na camada que importa.
2. **A camada 2 não está publicada.** Nada foi commitado nem pushado (`estado.md` declara; a produção
   prova: `x-robots-tag` ausente). O `GET /robots.txt` **do deploy novo** — o teste definitivo do
   ataque 2 — só pode ser feito **depois do push**.
3. **`pnpm run build` / `pnpm exec vitest run` com a configuração completa do repositório não rodam
   neste sandbox** (`spawn EPERM`; causa e workaround em §0). O que rodou foi o **arquivo de teste
   real** com config mínima e o **build real** com uma chamada de dependência neutralizada e restaurada.
   O `tsc` completo **rodou e falhou** (A3, causa externa a esta entrega).
4. **A árvore está se movendo.** Outra sessão gravou arquivos de mídia durante a auditoria (lista em
   §0). Os achados A2/A3 valem para a árvore **no instante da medição**; o A3 pode fechar sozinho
   quando a frente de mídia terminar.
5. **`vercel.json` aceito pela Vercel em deploy real.** JSON válido e estruturalmente conforme o schema
   oficial, mas a aceitação pelo builder não foi observada (exige deploy/credencial).
6. **A interação `Disallow: /` × `noindex`/`X-Robots-Tag`** (A10) — não confirmada em fonte nesta
   sessão.
7. **"Vale para os deploys existentes no ato"** (A7) — inferência, sem frase na documentação lida.
8. **Se existe mais de um projeto na Vercel recebendo este repositório.** O ADR-011 registra dois
   (`rebeca-odda` e `rebeca`); eu **só** consegui medir `rebeca-odda` (200 público). A proteção vale por
   projeto — ligar em um só deixa o outro aberto, e isso **continua não verificado**.

---

## 7. Invariantes do projeto (AGENTS.md)

| Invariante | Veredito | Evidência |
|---|---|---|
| 1. Aprovação humana antes de publicar | **não violado** | nada foi ao YouTube; a entrega não toca conteúdo |
| 2. Isolamento entre canais | **não violado** | a entrega mexe em cabeçalhos, `robots.txt` e `<head>`; nenhuma consulta, cache ou dado é tocado |
| 3. Consistência de marca | **não violado (com pendência antiga)** | A4: o README ainda aponta o projeto `ai-media-studio`, de terceiro — D7/D6 em aberto |
| 4. Custo é requisito | **não violado / nada gasto** | nenhuma geração; `.rebeca/custos.csv` legível (119 linhas) |
| 5. Multi-canal desde o design | **não violado** | `robots.txt`/meta/cabeçalho são globais, não por canal — e o ADR-011 §Consequências declara que isso não substitui o `channel_id` |
| 6. Conteúdo infantil | **N/A** | nenhum conteúdo gerado |
| 7. Provedores substituíveis | **N/A** | sem integração de IA nesta entrega |
| "Segredos nunca em texto claro" | **não violado** | varredura do diff e dos arquivos novos por 8 padrões de segredo → nenhum match |
| "Nada de fato externo inventado" | **violado em um ponto** | A6 (citação não literal no `estado.md`) e A7 (inferência apresentada como fato no README/ADR). O núcleo (plano e preço) está correto e citado com data |

---

## 8. Veredito final

**REFUTADO** — a refutação é **cirúrgica, não estrutural**.

- **Alta (1):** **A1** — o `README.md` apresenta o deploy como privado e é o **único** documento da
  entrega que não marca a camada 1 como pendente de ação do dono. Medido: a produção responde **200 sem
  credencial**. Enquanto o dono não clicar, **o app continua público** e a rota que gasta dinheiro
  continua alcançável — que é exatamente o problema que a entrega existe para resolver.
- **Média (3):** A2 (evidência `tsc-privado.txt` **vazia** + `tsc` vermelho hoje), A3 (`pnpm run build`
  = `buildCommand` do deploy **falha** nesta árvore, por trabalho concorrente da frente de mídia), A4
  (README aponta projeto Vercel de terceiro).
- **Baixa (6):** A5 (`Sitemap:` vazio), A6 (citação não literal), A7 ("no ato" — não verificado), A8
  (manchete afirmativa no `estado.md`), A9 (regex dos testes mais estritos que o HTML/ABNF), A10
  (`Disallow` × `noindex` — não verificado).
- **Não refutado (o miolo da entrega):** o `robots.txt` **chega** ao `dist` byte a byte; a meta tag
  **está** no HTML construído; o rewrite de SPA **não** engole arquivo existente (provado em produção);
  os três testes novos **mordem** um por um; o contrato de hash do ADR-008 **sobrevive**; o
  `vercel.json` continua **válido** e sem afrouxamento de CSP; **nenhum segredo** apareceu.
- **O que a aprovação desta entrega NÃO autoriza:** publicar como "app privado". A camada 2 é
  **descoberta**, não controle de acesso — como o próprio ADR e o próprio `robots.txt` escrevem.

**Handoff:** `rebeca-seguranca` (dono do `ADR-011`) para corrigir A1/A4/A7 e decidir sobre A9; o texto
A2/A6 é de quem mantém a evidência e o `estado.md`. **A camada 1 continua dependendo do dono** (1 clique
por projeto, em **todos** os projetos que recebem este repositório) e a verificação dela é
`GET /api/ai/status` **sem sessão** deixando de devolver 200. O A3 é da frente de mídia: **não publique
esta árvore antes de `pnpm run build` fechar**, ou o deploy quebra antes de a camada 2 chegar ao ar.

> QA relata e não conserta: **nenhuma linha do produto foi alterada por mim**. As únicas mutações foram
> as três de propósito (`vercel.json`, `public/robots.txt`, `index.html`), restauradas com sha256
> idêntico, e a neutralização temporária de uma chamada em `node_modules` (fora do versionamento),
> restaurada com hash conferido. `dist/` foi reconstruído do zero e é ignorado pelo git
> (`.gitignore:2`); pode ser apagado sem perda.
