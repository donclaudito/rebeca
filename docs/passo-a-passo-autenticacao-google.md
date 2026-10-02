# Passo a passo — ligar a autenticação com o Google

Runbook de `ADR-014`. Escrito para ser executado por outra pessoa, não para ficar na cabeça de
ninguém.

Fontes oficiais usadas (lidas em 2026-10-02):

- [Setup — Sign in with Google for Web](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
  (atualizada 2026-04-06) — criação do Client ID, consentimento, CSP e COOP;
- [Verify the Google ID token on your server side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
  (atualizada 2025-12-22) — critério de verificação do token.

---

## Antes de começar: por que isto é seguro

- O **Client ID é público**. Ele vai no bundle do navegador de propósito. Não é segredo.
- O que autoriza alguém a gastar sua chave é a lista de **`sub`** (`REBECA_ALLOWED_SUBS`), que fica
  **só no servidor**.
- A chave do provedor (`OPENAI_API_KEY`) **nunca** vai para o navegador: ela vive em variável de
  ambiente do servidor e é usada pela função.
- **`REBECA_SETTINGS_WRITE` continua desligado.** Autenticar permite *usar* a chave, não *ver* nem
  *trocar* pelo app publicado.

---

## Parte 1 — No Google Cloud (só você pode fazer)

### 1.1 Criar o Client ID

1. Abra a página de clientes: <https://console.developers.google.com/auth/clients>
2. Crie ou selecione um **projeto** no Cloud Console.
3. Clique em **Create client** e, em **Application type**, escolha **Web application**.
4. Em **Authorized JavaScript origins**, adicione as duas origens (a doc pede o *scheme* e o host
   qualificado, **sem caminho**):
   - `http://localhost:5173` — o app local
   - `https://rebeca-odda.vercel.app` — o app publicado
   - A doc recomenda também adicionar `http://localhost` sem porta para testes locais.
5. **Não** é preciso preencher *Authorized redirect URIs*: o nosso fluxo recebe o token por callback
   JavaScript, não por redirecionamento.
6. Copie o **Client ID**. Ele tem este formato: `1234567890-abc123def456.apps.googleusercontent.com`

> **Pegadinha real:** `Authorized JavaScript origins` **não aceita caminho nem barra no fim**.
> `https://rebeca-odda.vercel.app/` (com barra) é recusado ou não casa. Use sem barra.

### 1.2 Tela de consentimento (OAuth consent screen)

1. Abra a página de branding: <https://console.developers.google.com/auth/branding>
2. Selecione o mesmo projeto e preencha: **nome do app**, e-mail de suporte, domínios autorizados,
   link da página inicial e link da política de privacidade.
3. Em <https://console.developers.google.com/auth/scopes> (Data Access), **não adicione escopo
   sensível**: a doc diz que o escopo padrão (`email`, `profile`, `openid`) já basta para
   autenticação. Pedir mais do que isso contraria o princípio de escopo mínimo.
4. Confira o **Verification Status**.

> O app é de uso próprio (um punhado de `sub`s). Enquanto o app estiver em modo de teste, só as
> contas cadastradas como usuários de teste conseguem entrar — que é exatamente o que queremos.
> *(Este ponto sobre teste/produção não veio da doc que consultei; é prática corrente do console.
> Confirme os rótulos na tela.)*

#### Duas armadilhas desta tela, encontradas na prática (2026-10-02)

**a) `Domínios autorizados` NÃO é o mesmo campo que `Authorized JavaScript origins`.** São telas
diferentes e ambos são obrigatórios:

| Campo | Onde fica | Formato | Valor aqui |
|---|---|---|---|
| **Authorized JavaScript origins** | página de **Clientes** | esquema + host, sem caminho e **sem barra no fim** | `http://localhost:5173`, `https://rebeca-odda.vercel.app` |
| **Domínios autorizados** | página de **Branding** | **só o host**, sem esquema e sem caminho | `rebeca-odda.vercel.app` |

Preencher só um dos dois dá erro em momento diferente: sem o primeiro, o login é recusado por origem;
sem o segundo, a própria tela de consentimento acusa `Domínio ausente: <domínio>` e **não salva**.

**b) `Dados de contato do desenvolvedor` recusa e-mail repetido.** A tela acusa
`E-mails duplicados não são permitidos`. Costuma acontecer quando o campo autocompleta e a mesma
conta é escolhida duas vezes: apague uma das entradas antes de salvar.

**c) Página inicial, Política de Privacidade e Termos.** A página inicial deve ficar no domínio
autorizado (ex.: `https://rebeca-odda.vercel.app/portfolio`). Os outros dois links o console marca
como exigidos para app **público**; em **Status de teste**, tente salvar sem eles. Se o formulário
recusar, é preciso publicar essas páginas no domínio autorizado — e, pela regra do projeto
(`rebeca-lgpd`), texto de política de privacidade **passa por revisão jurídica antes de ir ao ar**.

---

### 1.3 A tela mostra DUAS credenciais — só uma serve

Ao criar o cliente, o console abre um diálogo com dois valores. Eles não são a mesma coisa:

| O que aparece | Serve para este desenho? |
|---|---|
| **ID do cliente** (`…apps.googleusercontent.com`) | ✅ **Sim.** É público, vai no bundle do navegador e é o `aud` que o servidor verifica. |
| **Chave secreta do cliente** (`GOCSPX-…`) | ❌ **Não, para nada.** Existe para trocar *authorization code* no servidor. O fluxo do Google Identity Services com ID token **não a usa**. |

**Não copie, não cole e não fotografe a chave secreta.** O diálogo some quando você fecha, e a chave
secretada só é pedida em fluxo confidencial de servidor — que não é o nosso.

**Se ela vazar** (print, chat, issue, log): na página de clientes, abra o cliente e use
**Redefinir chave secreta** (*Reset secret*). A que vazou deixa de valer. Não é preciso guardar a nova,
porque este projeto não a consome.

---

## Parte 2 — No código (feito em 2026-10-02)

Tudo isto é implementação minha, listada aqui para você ver o caminho completo:

1. **Servidor** — `server/auth/`: um único ponto de verificação.
   - assinatura conferida com as chaves públicas do Google (pela biblioteca oficial
     `google-auth-library`, que faz a busca com respeito ao `Cache-Control` das chaves);
   - `aud` = `GOOGLE_CLIENT_ID`; `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`};
     `exp` válido;
   - identidade = **`sub`**, conferida contra `REBECA_ALLOWED_SUBS`;
   - guarda aplicada a **todas** as rotas de `api/ai/*` (4) e `api/media/*` (5, incluindo a que serve
     o arquivo da arte): sem token → **401**; token de fora da lista → **403**; e no 401/403 **nada é
     cobrado** (há teste que confere o livro de custos);   - rate limit por `sub` + registro de auditoria de quem chamou cada geração paga (coluna
     `identidade_sub` no livro de custos).
2. **Cliente** — botão do Google (Google Identity Services) e o token mantido **em memória**
   (nunca em `localStorage`), anexado como `Authorization: Bearer …` em cada chamada. Sem login, o
   app mostra a tela de entrada **em vez** das telas: nenhuma consulta sai antes de haver identidade.
3. **`vercel.json` — as duas correções que a doc oficial obriga** (feitas e conferidas na doc de
   2026-04-06):

   | Header | Antes | Agora |
   |---|---|---|
   | `Content-Security-Policy` → `script-src` | `'self' 'sha256-…'` | **+ `https://accounts.google.com/gsi/client`** |
   | `Content-Security-Policy` → `style-src` | `'self'` | **+ `https://accounts.google.com/gsi/style`** |
   | `Content-Security-Policy` → `frame-src` | ausente | **`https://accounts.google.com/gsi/`** (o botão é um iframe) |
   | `Content-Security-Policy` → `connect-src` | `'self'` | **+ `https://accounts.google.com/gsi/`** |
   | `Cross-Origin-Opener-Policy` | `same-origin` | **`same-origin-allow-popups`** |

   A doc é explícita: **não** hospede a biblioteca do Google por conta própria ("self-hosting … is
   not a supported use case"); ela tem de vir de `https://accounts.google.com/gsi/client`.

### Três consequências que não estavam previstas (e o que foi feito)

1. **A arte gerada não pode mais ir direto num `<img src>`.** A rota que serve o arquivo passou a
   exigir o cabeçalho, e uma tag `<img>` não consegue enviá-lo. O app passou a buscar a imagem com
   `fetch`, transformar em `blob:` e exibir (`src/auth/MediaImage.tsx`). Sem isso, as prévias de
   thumbnail apareceriam quebradas — sem erro nenhum na tela.
2. **A rota do arquivo não existia em produção.** `GET /api/media/file` era atendido **só** pelo
   plugin do servidor de desenvolvimento: não havia `api/media/file.ts`, então na Vercel a requisição
   cairia no rewrite de SPA e devolveria **HTML com status 200** — o navegador tentaria ler HTML como
   imagem. É a divergência dev↔produção na direção contrária à habitual (rota que o cliente usa e que
   nunca virou função). Criada, e entrou na guarda de imports
   (`src/__tests__/serverless-imports.test.ts`).
3. **`/api/ai/status` também exige token.** A versão anterior deste runbook dizia que essa rota
   continuaria pública; não continua. Com a autenticação ligada, **toda** rota de `api/ai/*` responde
   **401** sem credencial. A única pública é `GET /api/auth/config`.

---

## Parte 3 — Na Vercel (só você pode fazer)

Projeto → **Settings** → **Environment Variables**. Três variáveis para o ambiente **Production**
(e, se quiser, Preview):

| Nome | Valor | É segredo? |
|---|---|---|
| `GOOGLE_CLIENT_ID` | o Client ID da Parte 1 | não |
| `REBECA_ALLOWED_SUBS` | o(s) `sub`(s) autorizado(s), separados por vírgula | **sim, é o controle de acesso** |
| `OPENAI_API_KEY` | sua chave paga | **sim** |

**Como descobrir o seu `sub`:** depois que o código estiver no ar, faça login no app e abra a tela de
Configurações — ela mostra a identidade autenticada (o `sub` e o e-mail). Antes disso, uma alternativa
é decodificar o `credential` devolvido pelo botão do Google no console do navegador: o campo `sub` do
payload é o valor.

> **Localmente, o caminho mais curto:** faça login — a **própria tela de entrada** mostra o `sub` quando
> a conta ainda não está autorizada, num quadrinho selecionável. Copie, cole na linha
> `REBECA_ALLOWED_SUBS` do `.env`, salve e **recarregue a página**: o valor novo passa a valer na
> requisição seguinte, **sem reiniciar o `pnpm dev`** (`server/dev-env.ts` lê o arquivo na hora; em
> teste e em produção ele é ignorado de propósito). Separe vários `sub` por vírgula.
>
> **NUNCA DIGITE o `sub` à mão, e nunca o transcreva de uma captura de tela.** Vinte e um dígitos em
> fonte pequena é exatamente o tipo de dado que a vista completa sem perceber — e foi assim que este
> runbook foi seguido errado uma vez: a lista ficou com dois números válidos, porém de outras contas, e
> a tela recusava a conta "com o `sub` certo na mão". **Copie** (do quadrinho da tela, ou do log
> abaixo). Há um teste no projeto que cobre o caso irmão (caractere invisível colado junto), mas ele
> não salva de dígito trocado.
>
> **O `sub` de uma conta nova sai no terminal do `pnpm dev`**, pronto para copiar: quando uma conta é
> recusada, o servidor de desenvolvimento imprime
> `[auth] CONTA RECUSADA … sub recebido : "…"` com o identificador e a lista em vigor. É só copiar a
> linha para o `.env`. (Isso existe **apenas** no servidor de desenvolvimento — a função de produção
> não conhece esse instrumento.)
>
> Se você editar o `.env` e a tela continuar recusando a conta por mais de um ou dois segundos, o
> problema **não** é a lista: confira se o `sub` que você colou é o mesmo que aparece no log (o seletor
> do Google pode ter trocado de conta entre uma tentativa e outra — foi exatamente o que aconteceu na
> primeira vez em que este runbook foi seguido).

> Não use o **e-mail** na lista. O `ADR-014` decidiu por `sub` porque a própria documentação do Google
> avisa que uma conta pode ter e-mails diferentes ao longo do tempo.

---

## Parte 4 — Como saber que funcionou

Na ordem, e cada item é verificável:

1. `pnpm dev` → `http://localhost:5173` → sem login aparece a **tela de entrada** com o botão do
   Google, e o login conclui.
2. Sem login, **nenhuma** tela do app aparece e nenhuma consulta de IA ou de mídia é feita — o
   portão fecha antes de qualquer requisição.
3. Com login de conta **fora** da lista: a tela mostra o seu `sub` para copiar. É o caminho para
   autorizar a primeira conta.
4. `https://rebeca-odda.vercel.app/api/ai/status` **sem** credencial → **401** (era 200). A única
   rota pública é `/api/auth/config`. Com o app publicado, para conferir por linha de comando é
   preciso enviar `Authorization: Bearer <ID token>`, que só existe dentro da sessão do navegador —
   ou seja, a conferência prática é pela tela.
5. Com login de conta **autorizada**: a mesma ação de IA gera de verdade, e a linha de custo aparece
   em `.rebeca/custos.csv` **com o `sub`** na última coluna.
6. `node .tools/scan_secrets.py --history` limpo (nenhum token de teste versionado, e nenhuma chave
   secreta do cliente do Google — `GOCSPX-…` — em lugar nenhum).

---

## Ordem de execução (resumo)

| # | Quem | O quê |
|---|---|---|
| 1 | você | pausar a outra sessão de agente e avisar |
| 2 | você | criar o Client ID e configurar a tela de consentimento (Parte 1) |
| 3 | eu | implementar servidor + cliente + corrigir CSP/COOP + testes |
| 4 | eu | rodar o `rebeca-qa` para tentar refutar |
| 5 | **você** | definir as 3 variáveis na Vercel (Parte 3) |
| 6 | você | fazer login e conferir a Parte 4 |

Os passos 1 e 2 são **seus e são pré-requisitos**: sem o Client ID eu não tenho `aud` para verificar,
e sem a pausa eu não tenho árvore estável para escrever.
