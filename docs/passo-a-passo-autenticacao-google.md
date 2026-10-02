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

## Parte 2 — No código (eu faço)

Tudo isto é implementação minha, listada aqui para você ver o caminho completo:

1. **Servidor** — `server/auth/`: um único ponto de verificação.
   - assinatura conferida com as chaves públicas do Google (`https://www.googleapis.com/oauth2/v3/certs`,
     respeitando `Cache-Control`, porque as chaves rotacionam);
   - `aud` = `GOOGLE_CLIENT_ID`; `iss` ∈ {`accounts.google.com`, `https://accounts.google.com`};
     `exp` válido;
   - identidade = **`sub`**, conferida contra `REBECA_ALLOWED_SUBS`;
   - guarda aplicada nas **8 rotas** (`api/ai/*` e `api/media/*`): sem token → **401**; token de
     fora da lista → **403**; e no 403 **nada é cobrado**;
   - rate limit por `sub` + registro de auditoria de quem chamou cada geração paga.
2. **Cliente** — botão do Google (Google Identity Services) e o token mantido **em memória**
   (nunca em `localStorage`), anexado como `Authorization: Bearer …` em cada chamada.
3. **`vercel.json` — duas correções que a doc oficial obriga** (e que hoje quebrariam a integração):

   | Header | Hoje | Precisa ficar |
   |---|---|---|
   | `Content-Security-Policy` → `script-src` | `'self' 'sha256-…'` | **+ `https://accounts.google.com/gsi/client`**, senão a biblioteca do Google é **bloqueada** |
   | `Content-Security-Policy` → `style-src` | `'self'` | **+ `https://accounts.google.com/gsi/style`** |
   | `Content-Security-Policy` → `frame-src` | ausente | **`https://accounts.google.com/gsi/`** (o botão é um iframe) |
   | `Content-Security-Policy` → `connect-src` | `'self'` | **+ `https://accounts.google.com/gsi/`** |
   | `Cross-Origin-Opener-Policy` | `same-origin` | **`same-origin-allow-popups`** — a doc avisa que `same-origin` puro quebra a comunicação entre janelas e dá pop-up em branco |

   A doc é explícita: **não** hospede a biblioteca do Google por conta própria ("self-hosting … is
   not a supported use case"); ela tem de vir de `https://accounts.google.com/gsi/client`.

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

> Não use o **e-mail** na lista. O `ADR-014` decidiu por `sub` porque a própria documentação do Google
> avisa que uma conta pode ter e-mails diferentes ao longo do tempo.

---

## Parte 4 — Como saber que funcionou

Na ordem, e cada item é verificável:

1. `pnpm dev` → `http://localhost:5173` → o botão do Google aparece e o login conclui.
2. Sem login, uma ação de IA mostra a recusa de acesso — não gera e **não** cobra.
3. Com login, a mesma ação gera de verdade, e a linha de custo aparece em `.rebeca/custos.csv`.
4. Na versão publicada: `https://rebeca-odda.vercel.app/api/ai/status` continua respondendo **200**,
   mas as rotas de geração passam a exigir token (**401** sem ele).
5. `node .tools/scan_secrets.py --history` limpo (nenhum token de teste versionado).

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
