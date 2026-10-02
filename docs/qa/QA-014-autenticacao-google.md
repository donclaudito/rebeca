# QA-014 — Revisão adversarial da autenticação por ID token do Google

> ## Resposta do produtor (2026-10-02, depois desta revisão)
>
> **Veredito aceito: REFUTADO PARCIALMENTE.** Os 2 achados de gravidade média foram corrigidos, e as 4
> observações de gravidade baixa também — nenhuma foi descartada como "não é bem assim". O que mudou,
> e a prova de cada mudança:
>
> | # | Achado | Correção | Prova |
> |---|---|---|---|
> | 1 | A guarda não era a primeira checagem nas cascas que leem corpo | O corpo passou a ser passado como **função** (`() => readJsonBody(req)`), lida **dentro** do roteador, depois de `authorizeRequest`. Vale para as 4 cascas, os 2 plugins do Vite e as 3 assinaturas de roteador | `qa-refutacao.test.tsx` (parte 1) fica **verde**; `rotas.test.ts` ganhou "o corpo NÃO é lido quando a identidade é recusada" e "com identidade, corpo grande demais preserva o **413** — não vira 400" |
> | 2 | `MediaImage` aceitava `200 text/html` como imagem | Passou a exigir `content-type: image/...` antes de `createObjectURL` | `qa-refutacao.test.tsx` fica verde; `cliente.test.tsx` declara o `content-type` explicitamente no caminho de sucesso |
> | 3 | O rate limit contava leitura junto com geração | **Duas cotas independentes**: leitura **240/min** e geração **20/min**, com chaves de contador separadas. Quem decide "gasta" é o **roteador** (conhece o caminho), nunca o corpo | `rotas.test.ts` → "as duas cotas são independentes" e "a cota de geração é mais apertada" |
> | 4 | `default-src` sem o pai do GIS | `default-src 'self' https://accounts.google.com/gsi/`, como a doc pede para o caso de fallback | `headers.test.ts` afirma as duas fontes em `default-src` |
> | 5 | A contagem de autorizados era pública | `allowedIdentities` **saiu** de `/api/auth/config` (segue em `/api/auth/me`, depois de o token ser verificado) e a mensagem de 403 deixou de dizer **quantas** entradas da lista não parecem `sub` | `rotas.test.ts` → "a configuração pública não devolve a lista **nem a contagem**" |
> | 6 | `api/ai/settings.ts` ecoava `error.message` sem `redact` | Passou a higienizar a mensagem, como as outras saídas | leitura do arquivo + suíte verde |
>
> **O que mudou de estado por causa da correção 1:** o `413` do `readJsonBody` deixou de ser reescrito
> como `400` — o `AiError` nasce dentro do roteador e o status é preservado. Isso não estava na lista
> de achados como item próprio, mas era o efeito colateral apontado no texto do achado 1.
>
> **Árvore no momento desta resposta:** ainda **não commitada**, e as outras sessões de agente seguem
> ativas na mesma pasta. A suíte foi re-medida na árvore parada depois destas correções — os números
> estão em `.rebeca/evidencias/autenticacao-google.txt` (que é o arquivo de evidência desta entrega).
> **Recomendação a quem for publicar:** re-medir antes do commit, pela regra que este projeto já pagou
> caro para aprender.

**Alvo:** "Parte 2" do `docs/passo-a-passo-autenticacao-google.md` + `ADR-014` (e o adendo de implementação).
**Revisor:** `rebeca-qa` (segunda opinião independente — quem produziu não aprova).
**Data da medição:** 2026-10-02, entre 10:54 e 11:10 (horário local).
**Estado medido:** árvore de trabalho **não commitada** (`git status`: `api/auth/`, `api/media/`, `server/auth/`,
`src/auth/` como *untracked*; `api/ai/*`, `vercel.json`, `package.json`, `vitest.setup.ts` e dois testes
modificados). Nada foi commitado nem alterado por mim além dos dois caminhos que me cabem
(`docs/qa/QA-014-autenticacao-google.md` e `src/auth/__tests__/qa-refutacao.test.tsx`).

> **A árvore mudou durante a revisão.** Às 10:54 `api/media/file.ts` **não existia** (o
> `src/__tests__/serverless-imports.test.ts` já o exigia, o que deixava a suíte vermelha e a prévia de arte sem
> função em produção). Às **11:01:57** o arquivo apareceu — criado pela outra sessão de agente, que trabalha na
> mesma pasta. Re-medido às 11:09: existe, entra na guarda via `routeMediaRequest` e a suíte passa a ficar verde.
> Esse achado foi **descartado** depois da re-medição, e está registrado aqui porque foi real por ~7 minutos e
> porque é a prova de que este relatório não pode ser lido como "medido uma vez".

---

## 1. Veredito

# REFUTADO PARCIALMENTE

O que **resistiu a todos os ataques** é o que importa para o risco que o `ADR-014` existe para fechar: **não se
gasta a chave paga sem identidade válida e autorizada**. Os critérios 2 a 8 estão confirmados com comando e
saída. Nenhum caminho de cobrança sem autorização foi encontrado; nenhuma forma de header testada furou a
guarda; nenhum token vazou em corpo de resposta; o livro de custos ficou intacto em 401/403/429; e a suíte do
produtor está verde (33 arquivos, 375 testes) com o scanner de segredos limpo.

Duas afirmações **específicas** da entrega são falsas, e são elas que sustentam a refutação parcial:

1. **"Sem header `Authorization` → 401 em todas as rotas"** é falso para 5 formas concretas de requisição: nas
   quatro cascas serverless que leem corpo, um corpo inválido sem credencial nenhuma recebe **400** (e um corpo
   acima do teto recebe 400 em vez de 413). A guarda não é a primeira coisa executada ali.
2. **A prévia de arte (`MediaImage`) pode falhar em silêncio** — exatamente o sintoma que ela foi escrita para
   eliminar: uma resposta **200 com corpo que não é imagem** (o `index.html` do rewrite de SPA é o caso clássico
   deste projeto) passa pela checagem `response.ok`, vira `blob:` e é entregue ao `<img>`.

Nenhuma das duas gasta dinheiro ou vaza dado. Ambas são de **contrato e robustez** (gravidade **média**), e as
duas têm reprodução mínima que falha hoje — ver §3 e o arquivo de teste entregue.

---

## 2. Critério de aceite, um por um

| # | Critério (`ADR-014` §Verificação) | Veredito | Evidência |
|---|---|---|---|
| 1 | Sem `Authorization` → 401 em todas as rotas de `api/**` | **REFUTADO (parcial)** | harness §B: as 9 rotas protegidas dão `401/token-ausente`; **mas** as 4 cascas que leem corpo dão `400` sem credencial quando o corpo é inválido (§3, achado 1) |
| 2 | Assinatura/`aud`/`iss`/`exp` inválidos → 401, um caso por item | **CONFIRMADO** | `guard.test.ts` (20 testes, verde) um caso por item; + prova **com as chaves reais do Google**: token forjado com `kid` real é recusado (`Invalid token signature: …`) em 199 ms. `aud`/`iss`/`exp` só são exercitáveis com verificador injetado (não há token legítimo sem login) |
| 3 | `sub` fora da lista → 403, e a geração não acontece | **CONFIRMADO** | harness §B (9 rotas: `403/conta-nao-autorizada`), §C (livro não é criado), §G (não consome cota); `rotas.test.ts` verde |
| 4 | `sub` na lista → a rota responde como antes | **CONFIRMADO** | harness §B/§F: `GET /api/ai/status` 200, `GET /api/media/episodes` 200, `GET /api/media/custos` 200; rota inexistente com identidade continua 404 e método errado continua 405 |
| 5 | Prova de não-cobrança: casos 1–3 não geram linha no livro | **CONFIRMADO** | harness §C: `REBECA_COST_LEDGER` apontado para arquivo inexistente → 401/403 e `existsSync(livro) === false`; **controle positivo**: `recordCost(...)` cria o arquivo e grava a linha com `identidade_sub` (a asserção não é vácua) |
| 6 | Rate limit excedido → 429, sem chamada paga | **CONFIRMADO** | harness §G: 60 passam, a 61ª dá `429/limite-de-uso`; a guarda retorna antes do handler e o livro não ganha linha. `guard.test.ts` e `rotas.test.ts` verdes |
| 7 | Sem login não dispara geração; token nunca em `localStorage`/`sessionStorage`/URL | **CONFIRMADO (em jsdom)** | `cliente.test.tsx` (13 testes, verde): sem sessão nenhuma URL `/api/ai` ou `/api/media` é chamada e nenhuma escrita em `localStorage`/`sessionStorage`; `main.tsx` renderiza só `<App/>` e o portão (`PortaoDeEntrada`) só monta as telas com `status === 'autorizado'`. **Não observado em navegador real** |
| 8 | Suíte verde + `python .tools/scan_secrets.py --history` limpo | **CONFIRMADO** | `Test Files 33 passed (33) / Tests 375 passed (375)` (excluindo o meu arquivo de refutação); `scan_secrets.py --history` → `limpo: nenhum segredo em texto claro em 659 blobs (arvore + historico)`, exit 0 (6 achados ignorados pelo baseline revisado, todos de valor de teste com hash — conferido) |

---

## 3. Achados

### Achado 1 — a guarda **não** é a primeira checagem nas cascas serverless que leem corpo

**Gravidade: média.** Refuta o critério 1 como ele está escrito ("sem header → 401 em **todas** as rotas").

**O que está errado.** Em `api/ai/generate.ts`, `api/ai/test.ts`, `api/ai/settings.ts` e
`api/media/thumbnails.ts`, `readJsonBody(req)` é chamado **antes** de `routeAiRequest`/`routeMediaRequest`. Quem
decide a resposta de um corpo inválido é a leitura do corpo, não a guarda. Consequências medidas:

| Requisição (sem `Authorization`) | Esperado pelo ADR | Observado |
|---|---|---|
| `POST /api/ai/generate` com `{nao-e-json` | 401 `token-ausente` | **400** `entrada-invalida` |
| `POST /api/ai/test` com `{nao-e-json` | 401 | **400** `entrada-invalida` |
| `PUT /api/ai/settings` com `{nao-e-json` | 401 | **400** `entrada-invalida` |
| `POST /api/media/thumbnails` com `{nao-e-json` | 401 | **400** `corpo-invalido` |
| `POST /api/ai/generate` com 300 KB de corpo | 401 | **400** (o `413` do `AiError` é reescrito para `400` no `catch` do próprio handler) |

**Reprodução mínima** (`src/auth/__tests__/qa-refutacao.test.tsx`, casos `REFUTA (defeito 1)`):

```
node --import "file:///…/qa-shim.mjs" node_modules/vitest/vitest.mjs run src/auth/__tests__/qa-refutacao.test.tsx
# ou, fora do sandbox:  pnpm exec vitest run src/auth/__tests__/qa-refutacao.test.tsx
```

Resultado observado (antes): `Tests 6 failed | 6 passed (12)` — `AssertionError: expected 400 to be 401` em 5
casos; o 6º caso (mesma casca, requisição **sem** corpo) dá 401 e é o controle que isola a causa: **é a ordem**.

Por que importa, mesmo sem cobrar nada: (a) o contrato publicado deixa de ser "401 sem identidade" e passa a
depender do corpo; (b) quem não se identificou faz o processo ler, alocar e analisar até 256 KB antes de
qualquer checagem — superfície de trabalho não autenticada que não precisa existir.

**O que deveria ser.** A guarda antes da leitura do corpo: ler o corpo **depois** de
`authorizeRequest`/`authenticateRequest` (mover `readJsonBody` para dentro de `server/ai/http.ts` e
`server/media/http.ts`, que já têm o `req`, ou expor uma checagem prévia de identidade na casca). O `413`
também deveria preservar o status do `AiError` em vez de virar 400.

---

### Achado 2 — a prévia da arte trata **200 com HTML** como imagem válida (falha silenciosa)

**Gravidade: média.** Contraria diretamente a razão de existir do componente (adendo do ADR, item 1) e a
consequência nº 1 do runbook ("as prévias apareceriam quebradas — sem erro nenhum na tela").

**O que está errado.** `src/auth/MediaImage.tsx` decide sucesso apenas por `response.ok`:

```ts
const response = await fetch(src, { headers: { ...authHeaders() }, cache: 'no-store' });
if (!response.ok) { /* estado de falha */ return; }
const blob = await response.blob();
criada = URL.createObjectURL(blob);   // qualquer corpo passa: HTML, JSON, página de erro
```

O corpo que **não é imagem** com status 200 é o caso clássico deste projeto: o rewrite `/(.*) → /index.html` do
`vercel.json` devolve o documento do app com 200 quando a função não existe (foi exatamente o que acontecia com
`/api/media/file` até 11:01 de hoje). O usuário vê o ícone de imagem quebrada do navegador, **sem** o aviso
"não foi possível carregar esta imagem" que o componente implementa para esse fim.

O contraste que mostra que o projeto sabe fazer isso: `src/auth/client.ts` e `src/media/client.ts` conferem
`content-type: text/html` e lançam `sem-json` com texto acionável. `MediaImage` não confere tipo nenhum.

**Reprodução mínima** (`qa-refutacao.test.tsx`, caso `REFUTA (defeito 2)`): `fetch` mockado devolvendo
`200` com `content-type: text/html` e corpo `<!doctype html>…`.

Resultado observado (antes): `TestingLibraryElementError: Unable to find role="img" and name
/não foi possível carregar/i` — o componente renderizou `<img src="blob:conteudo-nao-imagem">` para um blob de
HTML. **Esperado:** cair no estado de falha.

**O que deveria ser.** Exigir tipo de imagem antes de `createObjectURL`:

```ts
const tipo = response.headers.get('content-type') ?? '';
if (!tipo.startsWith('image/')) { setState({ url: null, failed: true }); return; }
```

(e, de preferência, a mesma mensagem `sem-json`/`sem-imagem` que os outros dois clientes já dão, para o
diagnóstico apontar "a rota respondeu a página do app" em vez de um genérico "não foi possível carregar").

---

### Observações de risco (não bloqueantes, sem reprodução de defeito)

| # | Gravidade | Observação | Evidência |
|---|---|---|---|
| 3 | baixa | **O rate limit conta leitura junto com geração.** `checkRateLimit` roda em `authorizeRequest`, que é chamado por **toda** rota — inclusive `GET /api/media/file` (uma prévia de 13 ativos = 13 chamadas) e `GET /api/ai/status`. Medido: a 61ª chamada em 60 s recebe 429, mesmo sendo leitura pura. Um lote de gerações somado às leituras da tela pode dar 429 no meio do trabalho. O texto do 429 ("Nada foi gerado e nada foi cobrado") continua honesto. Política é decisão de produto: 60/min por identidade é folgado para um punhado de leituras, apertado para telas com muitos ativos. | harness §G |
| 4 | baixa | **`default-src 'self'` sem `https://accounts.google.com/gsi/`.** A doc oficial condiciona: "`default-src` directive, if used, … add `https://accounts.google.com/gsi/`". Hoje **não quebra** nada, porque `script-src`, `style-src`, `connect-src` e `frame-src` estão todos declarados explicitamente. É armadilha latente: no dia em que alguém remover uma dessas quatro, o login cai para o `default-src` e é bloqueado — com o sintoma "o botão não aparece", que não aponta para CSP. | `vercel.json` + doc oficial (lida em 2026-10-02, "Last updated 2026-04-06") |
| 5 | baixa | **A contagem de identidades autorizadas é pública.** `GET /api/auth/config` (pública por desenho) devolve `allowedIdentities`; `GET /api/auth/me` devolve o mesmo número a qualquer conta Google autenticada; e a mensagem de 403 informa **quantas** entradas da lista não parecem `sub`. Nada disso revela **quem** está autorizado (conferido: a lista nunca aparece — harness §E), e o ADR declara a contagem de propósito. Registro porque é divulgação de estado de configuração para não autorizados. | harness §E |
| 6 | baixa | **`api/ai/settings.ts` ecoa `error.message.slice(0,300)` sem `redact`.** É o único ponto de saída que não passa pelo `redact` que `handleGenerate` e `handleTestProvider` aplicam. Não encontrei caminho que vaze valor de chave — as mensagens de `saveConfig` não interpolam o valor recebido (só "curta demais"/"com espaço"/"longa demais") —, então isto é defesa em profundidade para o próximo erro que alguém escrever ali, não um vazamento atual. | leitura de `server/ai/secrets.ts` (mensagens) + `api/ai/settings.ts` (catch) |

**Sobre o COOP** (para não deixar dúvida): a doc oficial diz "set the COOP header: to `same-origin` **and**
include `same-origin-allow-popups`" — redação que não é implementável literalmente, já que COOP aceita um único
token. O valor entregue (`same-origin-allow-popups`) é o que a própria doc descreve como o que evita o pop-up em
branco, e é o padrão da indústria. **Não é achado.**

---

## 4. O que eu tentei e **não** consegui refutar

Cada linha foi executada; o resultado é o observado, não a intenção do código.

**Guarda e header (`Authorization`)** — harness §A/§B
- `Bearer` com caixa mista, vários espaços, tab, espaços em volta e `\n` final: aceitos (correto, RFC 6750).
- **Duplicidade de header** (o Node junta como `Bearer a, Bearer b`): recusado. **Array** em
  `req.headers.authorization`: recusado. **Espaço não-quebrável** no lugar do separador: recusado. `Basic`,
  token cru, `Bearer` vazio: recusados com 401.
- Token de **9005 caracteres**: recusado **sem consultar o verificador** (o teto de 8192 vem antes de qualquer
  trabalho de rede).
- **A guarda precede o roteamento**: rota inexistente sem token dá 401 (não 404) — não se revela o contrato a
  quem não se identificou.

**Todas as rotas protegidas** — harness §B: as 9 rotas (`ai/status`, `ai/generate`, `ai/settings`, `ai/test`,
`media/episodes`, `media/episode`, `media/custos`, `media/file`, `media/thumbnails`) dão
`401/token-ausente` sem token e `403/conta-nao-autorizada` com token de `sub` fora da lista. Percorri `api/**`
arquivo por arquivo (11 funções) e confirmei que **todas** chamam `routeAiRequest`/`routeMediaRequest`, que
chamam `authorizeRequest` **antes** do roteamento. `GET /api/auth/config` é a única pública (declarada no
adendo). Os dois plugins de desenvolvimento (`server/*/vite-plugin.ts`) repassam `req.headers.authorization` —
o defeito "em localhost funciona" não existe aqui, na direção perigosa.

**Falha fechada** — harness §B: sem `GOOGLE_CLIENT_ID` → **503** em IA e mídia (nunca libera);
`/api/auth/config` responde `clientId: null` (o app mostra "não está configurada"). Sem `REBECA_ALLOWED_SUBS` →
lista vazia → **403** para todo mundo. Não encontrei caminho em que a ausência de configuração **libere** algo.

**Isolamento das rotas de auth** — harness §E: `/api/auth/config` devolve apenas `clientId`,
`googleScriptUrl` e a contagem. `/api/auth/me` devolve **somente** a identidade do próprio token apresentado
(`sub`, `email`, `name`, `picture` do portador) — nenhum dado de terceiro, nenhuma entrada da lista. A mensagem
de 403 ecoa o `sub`/e-mail **de quem perguntou** (é o caminho de destravar o acesso) e **não** ecoa nenhuma
entrada de `REBECA_ALLOWED_SUBS`, nem quando a lista está "suja" com um e-mail (conferido com o teste do tipo
"os dois valores precisam ser diferentes para a asserção poder falhar").

**Vazamento de token** — harness §H + prova com a biblioteca real: forcei o caminho de erro da
`google-auth-library@11.1.0` e confirmei que **ela ecoa o valor recebido** ("Wrong number of segments in token:
nao-e-jwt", "Invalid token signature: `<token>`"). A guarda substitui **toda** falha por motivo fixo: o corpo
serializado da resposta 401 não contém o token nem a mensagem original, em nenhum dos caminhos testados. Também
não há token em URL (só header), nem em `localStorage`/`sessionStorage` por qualquer código meu ou da entrega
(grep em `src/**`: `localStorage` só para tema e estado de barras).

**Assinatura contra as chaves reais do Google** — o `ADR` declara isso como não provado. Eu avancei o que dá
para avançar sem login:
- `https://www.googleapis.com/oauth2/v3/certs` → **HTTP 200 em 150 ms, 2 chaves**, `cache-control: public,
  max-age=20154, must-revalidate` (a biblioteca respeita esse cache — é o que o ADR afirma);
- token **forjado** com `kid` real do Google e assinatura inventada → recusado em 199 ms com
  `Invalid token signature: <token>` → **a assinatura é de fato conferida com o JWK do Google**;
- `google-auth-library@11.1.0` (a versão do lockfile) carrega no runtime Node e expõe `OAuth2Client.verifyIdToken`.
- **O que continua não provado:** que um token **legítimo** seja aceito — isso exige um login real (ver §5).

**Cobrança sem autorização** — harness §C: livro apontado para arquivo novo; 401 (IA e mídia) e 403 não criam
o arquivo. **Controle positivo** para a asserção não ser vácua: `recordCost` grava a linha com
`identidade_sub = <sub>` na última coluna — ou seja, o mecanismo funciona e o "não há linha" é resultado, não
ausência de instrumento.

**Rate limit** — harness §G: exatamente 60 chamadas passam e a 61ª dá `429/limite-de-uso`; **enxurrada de 712
identidades distintas não zera o contador do abusador** (a poda do mapa só remove quem não tem chamada na
janela — o ataque que o enunciado pede para tentar falhou); a cota é por `sub` (a conta A não consome a de B);
quem está fora da lista **não** consome cota (a lista é conferida antes do contador).

**Migração aditiva do livro de custos** — harness §F, sobre cópia do `.rebeca/custos.csv` real (235 linhas de
dado, 6 comentários, 15 colunas):
- linha **no formato antigo** (11 células, sem `identidade_sub`) acrescentada ao arquivo novo: `monthlySpendUsd`
  passa de `0.8528410` para `1.3528410` (exatamente +0,50) e `contentSpend` do conteúdo legado dá `0.5`;
- cenário real de migração (cabeçalho de 11 colunas + todas as linhas truncadas para 11 células) → `recordCost`
  → cabeçalho passa a 15 colunas, **todas** as 236 linhas com 15 células, **ordem preservada** (nenhuma linha
  perdida ou reordenada), soma do mês preservada (`0.8528410` + 1,50 = `2.3528410`), linha nova com o `sub` no
  fim. Migração aditiva confirmada, sem corrupção.

**Dependência no bundle do navegador** — `dist/assets/index-*.js` (530 KB, build de 10:55): **nenhuma** ocorrência
de `gaxios`, `OAuth2Client` ou `google-auth-library`; o bundle contém o cliente novo (`/api/auth`, `gsi/client`,
`sem-sessao`, a mensagem do `MediaImage`). Confirmado estruturalmente: no repositório inteiro só
`server/auth/verify.ts` importa o pacote (dinamicamente), e **nenhum** arquivo de produção em `src/**` importa
`server/**` (só testes importam). O pacote está em `dependencies` (não em `devDependencies`) e no lockfile.
Ressalva declarada: o bundle de 10:55 é 4 minutos anterior a três arquivos de `src/auth/` e não foi reconstruído
por mim.

**CSP / COOP / cabeçalhos** — recalculei o hash do script inline do `index.html` com `node:crypto`:
`sha256-qpRjRiAYTMBLET8G9KOyANYuFR15hjD791gTZufxShc=` — **idêntico** ao declarado no `vercel.json`. Os quatro
endereços e o COOP conferem **exatamente** com a documentação oficial relida agora
([Setup — Sign in with Google for Web](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid),
"Last updated 2026-04-06"): `script-src …/gsi/client`, `style-src …/gsi/style`, `frame-src …/gsi/`,
`connect-src …/gsi/`, COOP `same-origin-allow-popups`. E o CSP **não** quebra o que já funcionava: `img-src`
inclui `blob:`, que é justamente o esquema que a prévia de arte usa depois do `createObjectURL`; não há
`<video>`/`<audio>` no app que dependesse de `media-src` (que ficaria no `default-src`).

**Portão do navegador** — `main.tsx` renderiza apenas `<App/>`; `PortaoDeEntrada` (em `src/App.tsx`) só monta
`AppRoutes` com `status === 'autorizado'`, e nos outros quatro estados mostra o `LoginGate`. O teste do produtor
("sem sessão mostra a entrada e NÃO chama nenhuma rota de IA ou de mídia") está verde, e a checagem é sobre as
URLs chamadas, não sobre a aparência da tela. O `vitest.setup.ts` dá sessão global à suíte — o que **poderia**
esconder defeito —, mas o arquivo de fronteira (`cliente.test.tsx`) limpa a sessão antes de cada caso e prova o
comportamento sem ela; não encontrei tela que só funcione por causa da sessão de teste.

**Suíte e segredos** — `Test Files 33 passed (33)`, `Tests 375 passed (375)` (excluindo o meu arquivo de
refutação, que falha de propósito) e `python .tools/scan_secrets.py --history` → exit 0, `limpo: nenhum segredo
em texto claro em 659 blobs (arvore + historico)`.

---

## 5. O que eu **não** consegui verificar (declarado, sem maquiagem)

1. **Login real no navegador.** Não abri o pop-up do Google, não vi o botão renderizar, não observei COOP/CSP em
   ação. Toda a evidência de UI é jsdom. O ADR já declara isso; eu **não** consegui mudar esse estado.
2. **Token legítimo do Google aceito de ponta a ponta.** Não tenho login. Provei que a assinatura é conferida
   contra as chaves reais (token forjado recusado) e que a **política** (`aud`/`iss`/`exp`/`sub`) está correta
   com verificador injetado — mas "o token de verdade do dono entra" continua sendo verificação do dono.
3. **Runtime da Vercel.** Não executei a função lá. Especificamente **não verificado**: (a) se o `@vercel/nft`
   traça o `await import('google-auth-library')` **dinâmico** para dentro do bundle da função (se não traçar,
   o cold start quebra com `ERR_MODULE_NOT_FOUND` — a classe de defeito que já derrubou a IA uma vez);
   (b) se `/api/media/file` responde como função (o rewrite `/(.*) → /index.html` tem precedência *depois* do
   filesystem na Vercel — inferido do comportamento observado em produção, não medido por mim); (c) aplicação
   real dos cabeçalhos.
4. **Chamada paga de verdade.** Não há chave de provedor nesta máquina/sessão. A prova de não-cobrança é
   estrutural + livro de custos + controle positivo do mecanismo de gravação; nenhuma chamada real a provedor
   foi feita por mim (nem por 401/403/429, que é o que importa, nem por identidade autorizada, que eu não
   exercitei até o provedor).
5. **`pnpm exec vitest` direto.** Neste sandbox confinado o comando morre com `spawn EPERM` dentro do
   `optimizeSafeRealPathSync` do Vite. Rodei a suíte com um *shim* de ambiente que intercepta o
   `child_process.exec('net use')` (arquivo em `%TEMP%`, **não** versionado, não é alteração de produto) —
   comando exato em §6. O produtor deve confirmar com `pnpm test` puro; os números que reporto são da suíte
   real, mas o **caminho** até ela passou por esse desvio.
6. **Rate limit entre instâncias.** Declarado no próprio ADR: o contador é de processo. Não medi nada em
   serverless (impossível sem deploy).
7. **`REBECA_SETTINGS_WRITE`.** Não testei o comportamento da escrita de segredo ligada/desligada em produção
   (fora do escopo do ADR-014, adjacente ao item 5 da decisão).

---

## 6. Como reproduzir

Fora do sandbox (ambiente normal do projeto):

```powershell
pnpm exec vitest run src/auth/__tests__/qa-refutacao.test.tsx   # 6 falham de propósito (os 2 defeitos), 6 passam
pnpm test                                                       # suíte do produtor: 33 arquivos / 375 testes
python .tools/scan_secrets.py --history                         # limpo, exit 0
```

Dentro do sandbox confinado desta revisão (o `exec('net use')` do Vite é bloqueado com EPERM):

```powershell
$shim = "$env:TEMP\qa-shim.mjs"   # intercepta child_process.exec; não é arquivo do produto
node --import "file:///$($shim -replace '\\','/')" node_modules/vitest/vitest.mjs run --exclude "**/qa-refutacao.test.tsx"
node --import "file:///$($shim -replace '\\','/')" node_modules/vitest/vitest.mjs run src/auth/__tests__/qa-refutacao.test.tsx
```

---

## 7. Arquivo entregue como evidência

- `src/auth/__tests__/qa-refutacao.test.tsx` — 12 casos, em duas partes declaradas no cabeçalho:
  - `REFUTA (defeito 1)` e `REFUTA (defeito 2)` — **6 casos que falham** contra o código entregue; cada um é a
    reprodução mínima de um achado e passa a verde quando o defeito for corrigido;
  - `o que NÃO consegui refutar` — **6 casos que passam**, registrando o ataque que resistiu (header, teto de
    token, ordem da guarda em relação ao roteamento, cota de quem está fora da lista, não vazamento da mensagem
    da biblioteca).

**Nota para quem for aceitar a entrega:** enquanto esse arquivo estiver no repositório, `pnpm test` sai
vermelho — de propósito. Ele é a prova do defeito, não parte da suíte do produtor; some (ou fica verde) quando
os dois achados forem corrigidos.
