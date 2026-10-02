# Diagnóstico GSI — o login do Rebeca que "não entra"

Data: 2026-10-02 · Escopo: leitura de código (sem editar produção), documentação oficial do
Google Identity Services, fontes primárias (W3C / Chromium) e fóruns.
Arquivo pedido: `.rebeca/pesquisa/gsis-diagnostico-2026-10-02.md`.

---

## 0. Veredito em sete linhas

1. **Você está parcialmente errado sobre o COOP.** Segundo a documentação oficial, o aviso é o
   sintoma do caminho *sem* FedCM e esse caminho tem modo de falha documentado ("blank pop-up window
   or similar bugs"). Não é "ruído inofensivo" por decreto. Mas **ele não é a causa provada** do que
   você está vendo hoje — e há um fato no seu próprio histórico que enfraquece essa hipótese (as duas
   vezes em que a credencial chegou, o aviso provavelmente já estava lá). Seção 1.
2. **`use_fedcm_for_button: true` é opção real e documentada, mas não é "a resposta certa"** — é
   opcional, `default: false`, e traz uma contradição documental que pode *explicar* "clique e nada
   acontece". Seção 2.
3. **`use_fedcm_for_prompt` está OBSOLETA e é ignorada** (doc literal). Não é o caso de vocês, mas
   se algum dia entrar no código, não faz nada.
4. **A causa mais provável não é o Google: é o servidor/lista de acesso** — porque
   `/api/auth/me` (api/auth/me.ts → `authenticateRequest`, não `authorizeRequest`) responde **200**
   para conta fora da lista, e a tela mostra "conta ainda não autorizada" + o `sub`. Isso produz
   **exatamente** o sintoma "não entra e não há nada em vermelho no console". O `403` só aparece nas
   rotas de `api/ai/*` e `api/media/*`, que o app nem chega a chamar sem autorização.
5. **Detalhe que muda a leitura do seu sintoma 2:** "a tela mostrou o e-mail e o `sub` reais" é a tela
   de conta **NÃO** autorizada (`src/auth/LoginGate.tsx`, linhas 156-204). A tela de sucesso é o app —
   ela não mostra `sub`. Ou seja: as duas vezes provaram que o *encanamento* funciona; elas não
   provaram que o acesso foi concedido.
6. **`use_fedcm_for_button` é a única variável que mudou** entre "a credencial chegou duas vezes" e
   "não entra". Reverter é uma linha e é o teste mais informativo disponível. Seção 4.
7. A lista de acesso em `.env` está bem tratada contra separador errado (`server/auth/access.ts`
   quebra em `/[\s,;]+/` e faz `trim`), então "vírgula com espaço" **não** é a explicação.

---

## 1. O aviso de COOP impede a entrega da credencial no fluxo do botão?

### O que a documentação oficial diz, literalmente

Página **Setup** do Sign in with Google (seção "Cross Origin Opener Policy", atualizada
**2026-04-06**): `<https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#cross_origin_opener_policy>`

> "The Sign In With Google button and Google One Tap may require changes to your
> `Cross-Origin-Opener-Policy` (COOP) in order to successfully create popups.
> **When FedCM is enabled the browser directly renders popups and no changes are necessary.**
> However, when FedCM is disabled, set the COOP header: to `same-origin` and include
> `same-origin-allow-popups`. **Failing to set the proper header breaks communication between
> windows, leading to a blank pop-up window or similar bugs.**"

Página **Supported browsers** (atualizada **2026-09-01**): entre os problemas encontrados nos testes
da API, `<https://developers.google.com/identity/gsi/web/guides/supported-browsers>`

> "Although not yet widely deployed, some sites may use CSP and COOP. In these cases, sites may have
> to make changes to direct browsers to allow popups and to load cross-site resources."

Fonte primária (W3C WebAppSec, "Understanding COOP Breakages"):
`<https://w3c.github.io/webappsec/mitigation-guidance/COOP/breakages.html>`

> "COOP can break things… COOP can only cause a breakage if there is a popup involved… Another good
> first step when debugging a breakage is to change the COOP policy to `same-origin-allow-popups` and
> see whether this fixes it. Oftentimes this policy is necessary…"

### Onde você está certo, e onde você está errado

**Você está errado em tratar o aviso como "ruído inofensivo" por definição.** A doc acima trata
comunicação entre janelas quebrada como falha real e documentada do fluxo de pop-up, com o sintoma
"blank pop-up window or similar bugs" — que é primo próximo do "clique e nada acontece".

**Você está certo em duvidar que ele seja *a* causa no seu caso**, por três razões verificáveis:

- O texto do aviso é condicional — *"**would** block"*, não *"blocked"*. Ele é emitido no mesmo
  vocabulário dos relatórios de acesso do COOP (disposição de *reporting*), não como erro fatal.
  **NÃO VERIFICADO**: tentei abrir o arquivo-fonte do Blink que emite a mensagem
  (`coop_access_monitor.cc`) e o caminho não existe no ramo `main` atual (404 em duas tentativas);
  a linha exata não pôde ser lida. Portanto **não** afirmo "é inofensivo" — afirmo que a redação não
  sustenta "está bloqueando".
- O seu servidor de desenvolvimento **não envia COOP nenhum**. Ausente = `unsafe-none`, a política
  mais permissiva, que **não** corta a relação `window.opener` — e a credencial chegou ao callback
  duas vezes nesse mesmo ambiente. Se COOP bloqueasse a entrega de forma determinística, aquelas duas
  vezes não teriam acontecido.
- O aviso aparece **duas vezes** por tentativa — isto é, ele acompanha o fluxo normal (o pop-up faz
  mais de uma chamada de `postMessage`), não o momento da falha.

**Um ponto onde a própria doc do Google é contraditória** (não invente um valor com base nela):
ela manda "set the COOP header: to `same-origin` **and** include `same-origin-allow-popups`". O
header aceita **um** valor; `same-origin` sozinho corta o opener e é justamente o que quebra o
fluxo. O valor que preserva o pop-up é **`same-origin-allow-popups`** — que já é o que o
`vercel.json` manda em produção. **NÃO VERIFICADO** qual token único a doc pretendia.

### O que fazer com o COOP (barato, e o resultado é diagnóstico)

1. **Produção (`vercel.json`)**: já está `same-origin-allow-popups`. Nada a fazer. ✔
2. **Desenvolvimento (`vite.config.ts`, `server.headers`)**: hoje não envia nada. Coloque
   `Cross-Origin-Opener-Policy: same-origin-allow-popups` para o dev ficar igual ao ambiente que a
   doc descreve. Aproveite e adicione `Referrer-Policy: no-referrer-when-downgrade`, que a mesma
   página de Setup recomenda explicitamente para http+localhost.
3. **Leia o resultado como experimento** — e note que os três desfechos são informativos:

   | Depois de adicionar o header | Leitura |
   |---|---|
   | O aviso **some** e o login passa a funcionar | Era (também) COOP |
   | O aviso **some** e o clique continua sem produzir nada | COOP **nunca** foi a causa — vá para a seção 5, caso (b) |
   | O aviso **persiste** e o login funciona quando a conta está autorizada | Nesse arranjo, o aviso é ruído — mas não por decreto, e sim medido |

Não gaste mais nenhuma hora tentando "calar" esse aviso antes de saber em qual das quatro caixas da
seção 5 a tentativa termina.

---

## 2. `use_fedcm_for_button: true` é a resposta certa?

### O que a documentação confirma (Referência da API JavaScript, lida hoje)

- `use_fedcm_for_prompt` — **"Deprecated: This attribute is no longer available and is ignored if
  used."** (idem no HTML API, `data-use_fedcm_for_prompt`). Ou seja: a opção que a internet de 2023
  ensinava **não faz mais nada**. `<https://developers.google.com/identity/gsi/web/reference/js-reference>`
- `use_fedcm_for_button` — **não** está deprecada: *"determines if FedCM button UX should be used on
  Chrome (desktop M125+ and Android M128+). Defaults to `false`."*
- O próprio guia de migração diz que o passo é **opcional**: *"This step is optional. If you choose not
  to enable FedCM for the Button flow, it will continue to use the existing non-FedCM flow."*
  `<https://developers.google.com/identity/gsi/web/guides/fedcm-migration>`
- `button_auto_select` — *"You need to explicitly enable button auto sign-in during the opt-in
  launch."* **NÃO VERIFICADO** o que é esse "opt-in launch" (não achei a página de inscrição). Não
  conflita com `auto_select: false`: `auto_select` é do One Tap, `button_auto_select` é do botão
  FedCM, e o default de ambos é `false`. Manter `auto_select: false` está **certo** e não é a causa
  de nada aqui.

### Pré-requisitos (guia "Migrate to FedCM", atualizado 2026-02-10)

- FedCM API: **Chrome 117+**; o fluxo **de botão** com FedCM: **Chrome desktop M125+ / Android M128+**.
- Contexto seguro. `http://localhost` é aceito para desenvolvimento (é o que a página de Setup manda
  adicionar em *Authorized JavaScript origins*). *FedCM é API de contexto seguro — **NÃO
  VERIFICADO** na doc do GSI se há exigência textual de HTTPS para o FedCM do botão.*
- `allow="identity-credentials-get"` em **todo** iframe pai, se o botão for chamado de dentro de
  iframe cross-origin. Sem isso, o erro literal é:
  `[GSI_LOGGER]: FedCM get() rejects with NotAllowedError: The 'identity-credentials-get' feature is not enabled in this document.`
- CSP tem de permitir `https://accounts.google.com/gsi/` em `connect-src`/`frame-src`. Sem isso:
  `[GSI_LOGGER]: FedCM get() rejects with NetworkError: Failed to execute 'get' on 'CredentialsContainer': Refused to connect to 'https://accounts.google.com/gsi/fedcm.json' because it violates the document's Content Security Policy.`
  (O `vercel.json` já tem `connect-src … https://accounts.google.com/gsi/` e `frame-src` iguais. ✔)
- A configuração *Third-party sign-in* do Chrome: o guia manda conferir que está ligada e, na frase
  seguinte, diz que ela **"only affects One Tap and has no impact on the FedCM button flow"**. E na
  página do botão: *"The cooldown status and Third-party sign-in settings in Chrome have no impact on
  the FedCM button flow."* → contradição interna da doc; não perca tempo com essa configuração.

### O que muda para o usuário (doc do botão personalizado)

- O diálogo é **renderizado pelo navegador**; o One Tap passa a mostrar o **domínio de topo** em vez
  do nome do app.
- `isDisplayMoment()`, `isDisplayed()`, `isNotDisplayed()`, `getNotDisplayedReason()` deixam de ser
  suportados; `getSkippedReason()` também não devolve o motivo detalhado (só `isSkippedMoment()`).
  `isDismissedMoment()`/`getDismissedReason()` continuam.
- **Contas Family Link não são suportadas com o botão em FedCM**: *"Sign in with Google Button with
  FedCM enabled doesn't support Family Link accounts at the moment."* (não é o caso do dono, mas é
  bom saber que existe).
- Você ganha: botão personalizado mesmo com cookies de terceiros bloqueados e `button_auto_select`.
  Nenhum dos dois importa para um app local de duas contas.

### Pegadinha conhecida que pode ser exatamente o seu "clique e nada acontece"

A doc do botão descreve as jornadas do FedCM assim (as quatro variantes, texto idêntico):

> "The second last screen in the flow is the loading screen, which **automatically redirects users to
> your login endpoint** without action from users."
> `<https://developers.google.com/identity/gsi/web/guides/personalized-button>`

Mas a doc de exibição do botão diz o contrário para o modo JavaScript:

> "You must specify a `callback`, popup mode does not support redirects when rending the button in
> JavaScript. **If set, `login_uri` is ignored.**"
> `<https://developers.google.com/identity/gsi/web/guides/display-button>`

E a referência HTML reforça: `data-login_uri` é *"Ignored when `data-ux_mode="popup"` and
`data-callback` is set"*; se **não** houver callback, *"the credential is posted to this page by
default"* — ou seja, um POST para a própria página atual.

Consequência prática: **se** o fluxo FedCM do botão entregar a credencial por POST ao *login
endpoint* (e não pela função `callback`), então neste app — que só registra `callback`, sem
`login_uri` e sem endpoint que aceite POST — a credencial vai para `POST http://localhost:5173/`,
o Vite devolve 404/405, não há `callback`, e **não há nenhum erro em vermelho no console**. É uma
descrição exata do sintoma. **NÃO VERIFICADO** se, na API JavaScript em modo popup, o FedCM
substitui a entrega por `callback` por um redirect/POST — a doc se contradiz e eu não tenho como
testar navegador daqui. É por isso que a seção 5 começa por medir isso.

**Outro modo de falha do mesmo tipo, que vale descartar em 5 segundos:** a biblioteca GIS é
**desativada em webviews** e **não é suportada em extensões do Chrome** ("Due to security concerns,
users shouldn't add Google sessions into webviews. Thus, GIS are disabled in webviews" / "This
library does not support Chrome extensions", página *Supported browsers*; e *"Is One Tap and Sign in
with Google button available in webviews? No."*, página *Integration considerations*). Se o dono
estiver testando no navegador embutido de um editor/IDE ou num app Electron, o clique não produz
nada e o console fica limpo. **Tem de ser uma janela real do Chrome.**

### Veredito sobre o FedCM

Ligar `use_fedcm_for_button` é legítimo e documentado — mas no seu estado atual ele é **risco sem
benefício**: o benefício declarado (botão personalizado sem cookies de terceiros, auto-select) não
importa para um app local, e o caminho novo tem um passo documentado que o seu código não implementa.
Além disso a doc **não** afirma em nenhum lugar que, sem suporte a FedCM, o navegador cai sozinho no
pop-up com a flag ligada — o comentário do `google.ts` que diz isso está **NÃO VERIFICADO** (o guia
só diz isso para *automatic sign-in*: "GIS JavaScript won't trigger FedCM on an older Chrome (before
M121), even if your website chooses to opt-in").

---

## 3. Checklist do Google Cloud Console, tela por tela

Onde abrir, o que tem de estar escrito, e o sintoma exato quando está errado. Itens sem fonte
oficial lida nesta passagem estão marcados **NÃO VERIFICADO** — confira no balcão, não acredite em mim.

### 3.1 Página de clientes — `https://console.developers.google.com/auth/clients`

| O que conferir | Valor correto | Sintoma quando está errado |
|---|---|---|
| **Projeto** (seletor no topo) | O mesmo projeto de onde saiu o Client ID que está no `.env` **e** na Vercel | Client ID de outro projeto: o `aud` do token ≠ `GOOGLE_CLIENT_ID` → `/api/auth/me` responde **401** (`token-invalido`) e a tela mostra a mensagem de credencial recusada. No console aparece `Failed to load resource: … 401`. |
| **Tipo do cliente** | **Web application** | Só cliente *Web application* tem campo *Authorized JavaScript origins*. Tipo errado ⇒ o botão falha com erro de origem (abaixo). Os outros tipos existem para fluxos nativos. **NÃO VERIFICADO** o texto literal do erro por tipo errado. |
| **Authorized JavaScript origins** | Esquema + host, **sem caminho e sem barra no fim**: `http://localhost:5173`, `http://localhost` (a doc manda adicionar os dois para dev) e `https://rebeca-odda.vercel.app` | Erro literal no console (não na tela): `[GSI_LOGGER]: The given origin is not allowed for the given client ID.` Junto dele, **nenhum pop-up abre** e a tela não muda — indistinguível de "clique e nada acontece". *Literal confirmado em fórum de desenvolvedores e Stack Overflow (links na seção 7); não achei essa string nas páginas oficiais que li.* |
| Propagação de mudança de origem | — | **NÃO VERIFICADO** se leva minutos. Ao editar, feche a aba, espere, reabra. |
| **Authorized redirect URIs** | **Vazio hoje** (fluxo com callback JS) | Vazio está certo *para o desenho atual*. Passa a ser obrigatório se adotarmos a seção 4(a)/(b). Se um `login_uri` for usado sem estar aqui: `[GSI_LOGGER]: The given login_uri is not allowed for the given client ID.` (*reportado pela comunidade; não achei nas páginas oficiais*). |
| **Chave secreta** (`GOCSPX-…`) | **Irrelevante para este app.** Não é pedida em fluxo de ID token | Se alguém colou a chave secreta em algum lugar, o risco não é o login — é a credencial. Confirme com `node .tools/scan_secrets.py --history` (Parte 4 do runbook). |

### 3.2 Tela de consentimento — `https://console.developers.google.com/auth/branding`

| O que conferir | Valor correto | Sintoma quando está errado |
|---|---|---|
| **Application name / e-mail de suporte** | Preenchidos | A tela de consentimento não aparece ou o console recusa salvar. |
| **Authorized domains / Domínios autorizados** | **Só o host**, sem esquema e sem caminho: `rebeca-odda.vercel.app` | A própria tela de branding acusa `Domínio ausente: <domínio>` e **não salva** (já está no runbook). Um login com conta fora da lista de teste falha antes de emitir credencial. |
| **Homepage / Política de Privacidade / Termos** | Obrigatórios para app público; opcionais em **Status de teste** | Se o formulário recusar, é preciso publicar as páginas no domínio autorizado. **NÃO VERIFICADO** quais desses campos o console exige hoje em cada status. |
| **Escopos (Data Access)** | Nenhum escopo sensível. A doc é literal: *"For the authentication, default scope (email, profile, openid) is sufficient, you don't need to add any sensitive scopes."* | Escopo sensível/restrito adicionado ⇒ verificação obrigatória, e é aí que aparecem os bloqueios com texto "verification". Se alguém adicionou escopo por engano, **remova**: é o que transforma este app num app que precisa de verificação. |
| **Verification Status** | Só precisa de verificação se houver escopo sensível/restrito | **NÃO VERIFICADO** o texto literal do console. A página de Setup só diz: *"Check 'Verification Status', if your application needs verification then click the 'Submit For Verification' button"*. |

### 3.3 Status de publicação e usuários de teste (o item que eu não consigo ver)

- **O que abrir**: a mesma área *Google Auth Platform* (a doc atual chama de *Branding*/*Audience*;
  os rótulos mudam entre versões do console).
- **O que precisa estar escrito**: ou o dono está em **"In production"** (publicado), ou a conta que
  ele usa está na lista de **Test users**.
- **Sintoma exato quando está errado**: a *janela do Google* — pop-up, ou a janela do fluxo —
  mostra uma página inteira de erro do Google começando com **`Access blocked:`**, nomeando o app e
  dizendo que ele *"has not completed the Google verification process"* / que só pode ser usada pelos
  test users cadastrados. **A credencial não é emitida.** No console do navegador não há nada de
  novo: o erro está na janela do Google, que quem fecha rápido nem lê.
  *O prefixo literal `Access blocked:` e a frase `has not completed the Google verification process`
  aparecem em relatos de comunidade e em fóruns (links na seção 7). Nas páginas oficiais que li hoje
  (`support.google.com/cloud/answer/13463073` e `9110914`) o conteúdo não renderizou para leitura —
  então **NÃO VERIFICADO** o texto exato e a regra de "100 test users".*
- **Ação recomendada** (e o único item deste relatório que é decisão de produto, não de código):
  como os escopos pedidos são só `openid email profile`, **publicar o app em "In production" evita o
  problema de usuários de teste de uma vez** — a lista de acesso real do Rebeca é
  `REBECA_ALLOWED_SUBS`, não a lista de test users do Google. Confirme no console que "publicar" não
  exige verificação com esses escopos antes de clicar (a doc de Setup sugere que não, ao dizer que o
  escopo padrão basta para autenticação).

### 3.4 O que **não** é problema (para não gastar mais tempo)

- **CSP**: o `vercel.json` já autoriza `script-src …/gsi/client`, `style-src …/gsi/style`,
  `frame-src` e `connect-src …/gsi/`, exatamente como a seção "Content Security Policy" da doc pede.
  Em dev não há CSP nenhum. Se a CSP estivesse errada, o botão **não existiria** na tela (e o próprio
  `google.ts` já traduz isso numa mensagem em pt-BR).
- **`REBECA_ALLOWED_SUBS` com separador errado**: `server/auth/access.ts` quebra em `/[\s,;]+/` e faz
  `trim`. Vírgula com espaço funciona.
- **`iss`/`aud`/`exp`**: o `verify.ts` cobre os três, com a biblioteca oficial.

---

## 4. Se o caminho do botão for comprovadamente frágil, qual é a alternativa robusta?

Antes das alternativas: **a primeira ação não é trocar de fluxo, é reverter a flag do FedCM**
(uma linha em `src/auth/google.ts`) e medir pela seção 5. Toda a evidência disponível diz que o
último estado conhecido-bom era o fluxo de pop-up sem FedCM.

### (a) `ux_mode: "redirect"` + `login_uri` apontando para uma função nossa — **RECOMENDADA**

- **O que muda no código**: em `initialize`, `ux_mode: 'redirect'` e
  `login_uri: '<origem>/api/auth/google'`. A função nova recebe `POST` com `credential` (o mesmo ID
  token), verifica com o `server/auth/verify.ts` que já existe (nada de verificação nova), aplica a
  mesma lista `REBECA_ALLOWED_SUBS` e **estabelece sessão** — porque sem `callback` JS não existe
  token em memória: é preciso cookie de sessão (`HttpOnly`, `Secure`, `SameSite`), com o `sub` dentro.
  Em seguida responde `303` de volta para a rota que o usuário queria.
- **O que o dono muda no console**: adicionar às **Authorized redirect URIs** os dois endpoints —
  `http://localhost:5173/api/auth/google` e `https://rebeca-odda.vercel.app/api/auth/google`.
  Nada mais (nada de escopo novo, nada de verificação).
- **Por que é robusto**: tira do caminho crítico *tudo* que está sob suspeita hoje — pop-up, COOP,
  `postMessage`, FedCM e `initialize`. É um POST de página inteira, mediado pelo navegador, sem canal
  entre janelas. A doc é explícita: *"This is generally a more intrusive experience for users, but is
  considered to be the most secure sign-in method."*
- **Riscos**: (1) CSRF — a doc manda validar o padrão *double-submit cookie* `g_csrf_token`
  (cookie vs. corpo), que o próprio GIS injeta no POST quando não há callback; (2) sessão em cookie é
  uma superfície nova (e o app hoje não tem nenhuma); (3) o `vercel.json` tem `form-action 'none'` —
  ele restringe formulários **da nossa** página, não o POST que o Google faz contra a nossa função,
  mas isso tem de ser **verificado empiricamente** antes de considerar pronto; (4) o rewrite catch-all
  `/(.*)` do `vercel.json` não engole `/api/*` (o filesystem tem precedência), mas confirme em
  produção com um POST real.
- **Custo**: função nova + sessão. Reaproveita 100% da verificação existente.

### (b) Authorization code + PKCE, trocando o código no servidor — **não agora**

- **O que muda no código**: `/api/auth/start` (gera `state` + `code_verifier`/`code_challenge`),
  `/api/auth/callback` (troca o código por tokens), sessão em cookie, e aposentar o botão GSI.
- **O que o dono muda no console**: as mesmas *Authorized redirect URIs* da opção (a) — e só isso.
- **Risco que eu **não** consegui verificar e que pode invalidar o "sem client secret"**: em cliente
  do tipo **Web application**, não é seguro presumir que a troca de código dispensa
  `client_secret`. **NÃO VERIFICADO** (não li a página de OAuth 2.0 for Web Server nesta passagem).
  Se o segredo for exigido, este desenho deixa de ser "sem client secret" e passa a exigir guardar um
  segredo no servidor — decisão de segurança separada, que o `rebeca-seguranca` tem de assinar.
- **Custo/benefício**: é o fluxo mais padrão e portável, e o maior volume de código novo — para um
  caso de uso de *autenticação* (não autorização), a própria doc do Google diz que a complexidade do
  OAuth 2.0 "is no longer necessary to sign users into your site".

### (c) One Tap / `prompt()` com FedCM — **não como caminho principal**

- `prompt()` hoje já usa FedCM embutido (`use_fedcm_for_prompt` está obsoleta porque virou padrão);
  os momentos de exibição não são mais notificados.
- A doc de *Integration considerations* desaconselha explicitamente depender só dele:
  *"Don't try to display only the One Tap UI on a button click event. The One Tap UI may not display
  due to listed reasons, and users may have a broken UX, since nothing displays after the user
  action."* No seu caso, "nada aparece depois da ação do usuário" é literalmente o bug que estamos
  caçando. **Serve como segunda chance ao lado do botão, nunca como substituto.**

### Recomendação

1. **Agora**: reverter `use_fedcm_for_button` e, em paralelo, o teste da seção 5. Custo: minutos.
2. **Se o pop-up continuar frágil**: opção (a). É o menor delta sobre o desenho atual, reaproveita a
   verificação que já existe e é a única alternativa que a doc chama de "most secure sign-in method".
3. **(b) só se o projeto precisar de tokens do Google (YouTube) no mesmo fluxo** — aí o código de
   autorização passa a ter um motivo próprio, e o desenho de sessão se paga.

---

## 5. Teste de diagnóstico de 1 minuto, **na tela**, que separa "o Google não devolveu credencial" de "o servidor recusou a conta"

Boa notícia: **o app já tem o instrumento pronto.** O `LoginGate.tsx` tem um relógio de 15 s ligado
ao `click_listener` (opção documentada do `renderButton`), e o `/api/auth/me` responde **200** mesmo
para conta fora da lista. Logo, os desfechos são mutuamente exclusivos e todos aparecem na tela.

**Como fazer (F12 fechado):**

1. Abra `http://localhost:5173` numa **janela real do Chrome** (não no navegador embutido de editor,
   não em webview). Clique no botão e escolha a conta.
2. Leia **qual** das cinco caixas aparece e o que ela diz:

| # | O que aparece na tela | Conclusão | Ação |
|---|---|---|---|
| **A** | "conta ainda não autorizada" + **"O servidor tem N conta(s) autorizada(s), e esta não é uma delas"** + um `sub` | **O Google entregou E o servidor verificou a assinatura.** O problema está na lista de acesso. | Se **N=0** → o servidor está lendo a lista vazia (problema de `.env`/ambiente). Se **N≥1** → compare caractere a caractere o `sub` da tela com o valor em `REBECA_ALLOWED_SUBS`; o seletor do Google troca de conta entre tentativas (já aconteceu neste projeto, está escrito no runbook). |
| **B** | "O Google não devolveu a credencial…" (aparece **só 15 s depois** do clique) | **O Google não entregou** nada ao callback. | Ordem: (1) alguma janela do Google abriu? Se não abriu, é bloqueio de pop-up/FedCM/origem; (2) veja se a página recarregou/ficou em branco (→ hipótese do redirect do FedCM, seção 2); (3) confira *Authorized JavaScript origins* no console. |
| **C** | Página inteira do Google começando com **`Access blocked:`** na janela que abriu | **Bloqueio no Cloud Console** (test users / verificação). O Google nem chegou a emitir credencial. | Seção 3.3. |
| **D** | Aviso em pt-BR no topo do card dizendo que a credencial foi recusada / sessão inválida | O Google entregou; **o servidor recusou a verificação** (401). | Quase sempre: Client ID diferente entre `.env` e Vercel, ou projeto errado no console. |
| **E** | Nada por 20 s e nenhuma janela abriu | O clique não produziu nem janela. | Pop-up bloqueado, webview, Chrome antigo (>2 versões) ou origem não autorizada (erro literal só no console). |

3. Confirmação cruzada de 10 segundos (**sem console**), numa aba nova:
   `http://localhost:5173/api/auth/config` → deve devolver o JSON com o Client ID. Compare os
   **últimos dígitos** com o Client ID que o console do Google mostra em *Clients*. Se não bater, o
   desfecho **D** é o seu — e nenhuma configuração de FedCM/COOP vai resolver.

**Para o implementador (fora do escopo desta tarefa, não editei nada):** enquanto o desfecho for
ambíguo, vale a pena a tela imprimir o `status` cru de `/api/auth/me` e o `detail` do
`AuthRequestError` — hoje o 401 e o 403/`authorized:false` chegam à tela com a mesma aparência de
"não entrou", e é exatamente essa ambiguidade que consumiu as horas do dono.

---

## 6. NÃO VERIFICADO (não invente, e é isto que falta medir)

1. Semântica interna da mensagem de COOP ("would block" = relatório vs. bloqueio). Fonte-filha
   pretendida (`coop_access_monitor.cc` no Blink) não existe no ramo `main` — 404.
2. Se o FedCM do botão, na API JavaScript em modo popup, entrega a credencial pelo `callback` ou por
   redirect/POST ao `login_uri`. **A doc se contradiz.** É a medição de maior valor pendente.
3. Se, sem suporte a FedCM, a biblioteca cai sozinha no fluxo de pop-up com a flag ligada (o
   comentário atual do `google.ts` afirma isso; a doc só afirma isso para *automatic sign-in*).
4. Texto literal e regra dos usuários de teste em modo *Testing* (as páginas de suporte não
   renderizaram para leitura) e se publicar com apenas `openid email profile` dispensa verificação.
5. Se cliente *Web application* pode trocar *authorization code* **sem** `client_secret` (opção 4(b)).
6. Prazo de propagação de mudança em *Authorized JavaScript origins*.
7. Se o "opt-in launch" de `button_auto_select` é uma inscrição formal e onde se faz.

---

## 7. Fontes

Documentação oficial (todas lidas em 2026-10-02, e a data de "last updated" da página vai indicada):

- Setup (origens, consentimento, CSP, **COOP**) — atualizada 2026-04-06:
  <https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid>
- Migrate to FedCM (flag do botão, pré-requisitos, erros literais do FedCM) — 2026-02-10:
  <https://developers.google.com/identity/gsi/web/guides/fedcm-migration>
- Supported browsers (webviews, extensões, últimas 2 versões, CSP/COOP) — 2026-09-01:
  <https://developers.google.com/identity/gsi/web/guides/supported-browsers>
- Sign in with Google button UX (jornadas do FedCM, `login endpoint`, Family Link) — 2025-05-19:
  <https://developers.google.com/identity/gsi/web/guides/personalized-button>
- Display the button (callback vs. `login_uri`, modos popup/redirect) — 2025-05-19:
  <https://developers.google.com/identity/gsi/web/guides/display-button>
- Integration considerations (One Tap só no clique é desaconselhado; webviews) — 2025-05-19:
  <https://developers.google.com/identity/gsi/web/guides/integrate>
- JavaScript API reference (`use_fedcm_for_prompt` obsoleta; `use_fedcm_for_button`;
  `button_auto_select`) — <https://developers.google.com/identity/gsi/web/reference/js-reference>
- HTML API reference (`data-login_uri` ignorado em popup+callback) —
  <https://developers.google.com/identity/gsi/web/reference/html-reference>
- Verify the Google ID token on your server side (`g_csrf_token`, critérios) — 2025-12-22:
  <https://developers.google.com/identity/gsi/web/guides/verify-google-id-token>
- Migrate from Google Sign-In (tipo *Web application*, HTTPS nas origens) — 2025-05-23:
  <https://developers.google.com/identity/gsi/web/guides/migration>
- Release notes (última entrada 2025-03-17; nenhuma dizendo que o FedCM virou padrão no botão) —
  <https://developers.google.com/identity/gsi/web/reference/release-notes>

Fontes primárias / comunidade:

- W3C WebAppSec — Understanding COOP Breakages:
  <https://w3c.github.io/webappsec/mitigation-guidance/COOP/breakages.html>
- Chromium — "COOP access reporting: Add console warning messages and events to the
  ReportingObserver" (issue 40142690): <https://issues.chromium.org/issues/40142690>
- Stack Overflow 77177788 — aviso de COOP com flag de FedCM ligada, e a resposta do autor
  (via API pública do Stack Exchange): <https://stackoverflow.com/questions/77177788>
- Fórum de desenvolvedores Google Cloud — `[GSI_LOGGER]: The given origin is not allowed for the
  given client ID`: <https://discuss.google.dev/t/sign-in-with-google-ends-with-gsi-logger-the-given-origin-is-not-allowed-for-the-given-client-id/108239>
- Relatos do bloqueio `Access blocked: … has not completed the Google verification process` (modo de
  teste/verificação): <https://wordpress.org/support/topic/access-blocked-wpmailsmtp-com-has-not-completed-the-google-verification-process-7/>

Código lido (nenhum arquivo de produção foi alterado): `src/auth/google.ts`, `src/auth/LoginGate.tsx`,
`src/auth/context.tsx`, `src/auth/client.ts`, `api/auth/me.ts`, `server/auth/access.ts`,
`server/auth/guard.ts`, `vercel.json`, `vite.config.ts`, `package.json`, `.env` (só os nomes das
chaves), `docs/passo-a-passo-autenticacao-google.md`. Não rodei a suíte de testes (não era necessária
para o diagnóstico e o pedido era não tocar em produção).

---

## Contrato de entrega

- **Status**: diagnóstico concluído, com duas hipóteses ranqueadas e um teste de 1 minuto que decide
  entre elas na tela. Nenhuma alteração de código de produção.
- **Entregáveis**: este relatório (`.rebeca/pesquisa/gsis-diagnostico-2026-10-02.md`).
- **Evidência**: código lido linha a linha (citações com arquivo/linha); 12 páginas oficiais do
  Google Identity lidas em 2026-10-02 com data de atualização registrada; 1 fonte W3C; 1 issue do
  Chromium; 1 resposta de Stack Overflow via API pública; 2 documentos de suporte do Google que
  **não** renderizaram (registrados como NÃO VERIFICADO).
- **Decisões propostas** (quem implementa é você): (1) reverter `use_fedcm_for_button`; (2) enviar
  `Cross-Origin-Opener-Policy: same-origin-allow-popups` também no dev server; (3) expor na tela o
  `status` cru de `/api/auth/me` enquanto o diagnóstico estiver aberto; (4) se o pop-up continuar
  frágil, adotar `ux_mode: 'redirect'` + `login_uri` com sessão em cookie.
- **Riscos**: reverter a flag não custa nada e não fecha nenhuma porta; a opção 4(a) introduz cookie
  de sessão (superfície nova) e exige conferir `form-action 'none'` e o rewrite do `vercel.json`
  com um POST real antes de considerar pronto.
- **Próximo**: rodar o teste da seção 5 e reportar **qual letra (A–E)** apareceu. Com uma letra, o
  diagnóstico fecha em um passo; sem ela, qualquer mudança de configuração é chute.
