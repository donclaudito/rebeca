# ADR-014 — Autenticação das rotas de IA e mídia: ID token do Google verificado na função

## Status
aceito

## Data
2026-10-02

## Contexto
O app está publicado (`rebeca-odda.vercel.app`, `ADR-003`) e as **8 rotas** de `api/ai/*`
(`generate`, `settings`, `status`, `test`) e `api/media/*` (`custos`, `episode`, `episodes`,
`thumbnails`) **não têm autenticação nenhuma** — é o achado **T9**, de severidade alta, em
`docs/seguranca/threat-model.md`.

A consequência prática foi medida, não suposta: o dono instalou uma **chave paga real** e ela
**não pode** ir para a Vercel, porque qualquer pessoa que alcançasse o endereço consumiria a chave.
O resultado é a divergência que o dono relatou — **o localhost funciona e a versão publicada não**:
em produção o `/api/ai/status` responde `"hasAnyKey":false, "simulated":true`, ou seja, tudo simulado.

Duas restrições se somam:

1. O **teto diário de gasto não é durável em serverless** (achado QA-006 #1: em `VERCEL=1` o livro de
   custos vive só na memória do processo, então cada invocação nasce com gasto zero). Sem
   autenticação não há sequer **a quem** atribuir o gasto.
2. O `ADR-011` já decidiu manter o app privado (não indexar), mas privacidade por obscuridade não é
   controle de acesso: a URL é pública e adivinhável.

Se nada for decidido, a única forma de manter a chave a salvo é **não publicar IA** — e o produto
publicado continua sendo uma demonstração inerte.

## Decisão
1. **Toda rota de `api/**` passa a exigir `Authorization: Bearer <ID token do Google>`.** Sem token
   válido → **401**; token válido com identidade fora da lista → **403**. A checagem fica em **um
   ponto único** (`server/auth/`), chamado no começo do handler — não replicada em cada rota, para
   não existir rota nova esquecida sem proteção.
2. O cliente obtém o ID token pelo **Google Identity Services** e o mantém **em memória**
   (nunca em `localStorage`/`sessionStorage`), enviando no header a cada chamada.
3. A verificação no servidor segue **exatamente** o critério da documentação oficial
   ([Verify the Google ID token on your server side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token),
   lida em 2026-10-02, atualizada 2025-12-22):
   - assinatura conferida com as **chaves públicas do Google** — JWK em
     `https://www.googleapis.com/oauth2/v3/certs` — respeitando `Cache-Control`, porque as chaves
     rotacionam;
   - `aud` igual ao nosso **Client ID**;
   - `iss` igual a `accounts.google.com` **ou** `https://accounts.google.com`;
   - `exp` não vencido.
   Biblioteca: **`google-auth-library`** (`OAuth2Client.verifyIdToken`), que é a recomendada pela
   própria documentação para Node.js.
4. **A identidade é o `sub`, não o e-mail.** A lista de acesso (`REBECA_ALLOWED_SUBS`) é de `sub`s.
   Motivo literal da documentação: uma Google Account pode ter e-mails diferentes em momentos
   diferentes, e o `sub` é único entre todas as contas e nunca reutilizado. O e-mail entra apenas
   como rótulo de exibição e de auditoria — nunca como chave de autorização.
5. **A chave do provedor continua vindo de variável de ambiente** (`OPENAI_API_KEY`, …) e
   **`REBECA_SETTINGS_WRITE` continua desligado** em produção. Autenticar **não** reabre a escrita de
   segredo pela interface: quem entra passa a **usar** a chave, não a **ver** nem a **trocar**. A
   escotilha que permitiria gravar segredo pela tela pública continua fechada — e agora há um ADR
   dizendo por quê.
6. `GOOGLE_CLIENT_ID` **é público** (vai no bundle do cliente, como manda o fluxo). O que autoriza é
   a lista de `sub`, que vive **só no servidor**.
7. **Defesa em profundidade**, exigida pela skill `rebeca-seguranca` (autenticação não é a única
   camada): (a) conferência de `Origin`/`Referer` contra a origem do app; (b) **rate limit por
   `sub`**, além do teto de gasto; (c) registro de auditoria de quem disparou cada geração paga.
8. **O CSP e o COOP do `vercel.json` têm de mudar — hoje a integração quebraria.** A doc oficial de
   setup é explícita, e cada item abaixo é bloqueante:
   - `script-src` precisa incluir `https://accounts.google.com/gsi/client`, senão o navegador
     **bloqueia a biblioteca do Google** (o CSP atual só permite `'self'` e o hash do script inline);
   - `style-src` precisa incluir `https://accounts.google.com/gsi/style`;
   - `frame-src` precisa incluir `https://accounts.google.com/gsi/` — o botão é servido em iframe;
   - `connect-src` precisa incluir `https://accounts.google.com/gsi/`;
   - `Cross-Origin-Opener-Policy` precisa virar **`same-origin-allow-popups`**: a doc avisa que
     `same-origin` puro quebra a comunicação entre janelas e produz pop-up em branco. O valor atual
     (`same-origin`, herdado do `ADR-008`) é o caso de falha descrito.
   A mesma doc proíbe hospedar a biblioteca por conta própria — ela vem de
   `https://accounts.google.com/gsi/client`.

## Alternativas descartadas
| Alternativa | Por que foi descartada |
|---|---|
| **Supabase Auth (Google) desde já** | É o **destino** do produto — dá RLS, papéis e multi-usuário — mas exige uma conta nova e fecha por consequência a segunda metade do **D1** (stack do backend), que é decisão do dono e está aberta. Custa muito mais trabalho até a produção voltar a funcionar. Fica registrado como destino, não como pré-requisito. |
| **Senha própria ou magic link** | Reinventa o que o Google entrega com assinatura verificável; acrescenta hash, reset de senha e enumeração de usuário sem nenhum ganho. |
| **Basic auth ou segredo compartilhado em header** | Numa SPA, qualquer segredo embutido é público por definição. Não identifica pessoa, não audita e não revoga. |
| **Usar `email` como identidade** | A própria documentação do Google desaconselha, pelo motivo do item 4. Autorizar por e-mail permitiria acesso indevido se o endereço mudasse de dono. |
| **Deixar as rotas abertas e limitar gasto só por IP** | IP é compartilhado (NAT) e trivial de trocar; e o problema real é poder publicar a chave com segurança — limite por IP não resolve isso. |
| **CSP / hash de script como controle de acesso** | `ADR-008` resolve injeção de script, não autenticação. CSP não distingue visitante de dono. |

## Consequências
- Positivas: a chave paga pode ir para a Vercel e a **versão publicada passa a funcionar como o
  localhost**; o gasto ganha dono e trilha de auditoria; o achado **T9 deixa de ser "alta"**; a
  escotilha `REBECA_SETTINGS_WRITE` continua fechada com justificativa escrita.
- Negativas / custo assumido: **o app deixa de abrir para quem não tem login** — é mudança de
  comportamento de produto (o dono pediu, mas é bom que esteja escrito); passa a existir dependência
  de um Client ID no Google Cloud e de uma lista de `sub`s por variável de ambiente; o ID token
  expira (a documentação não fixa o prazo — `NÃO VERIFICADO`, medir na prática) e o cliente precisa
  renovar; e isto **não** é multi-usuário com papéis, que continua sendo a decisão **D3**.
- O que muda para o usuário: ele abre o app, entra com Google, e o **mesmo painel do localhost**
  funciona — chave no servidor, geração real, custo registrado.
- Impacto em isolamento multi-canal: **nenhum**. Autenticação identifica **quem opera**, não
  substitui `channel_id`: o canal continua vindo da URL e a checagem por canal segue sendo a mesma.
  O teste adversarial de vazamento entre canais (`channel-scope.test.tsx`) continua valendo e
  **não** é substituído por este ADR.
- Impacto em custo por vídeo: positivo e indireto. O teto diário continua não durável em serverless,
  mas o gasto passa a ser atribuível a um `sub` e o rate limit por identidade limita abuso.

## Verificação
O critério de aceite é verificável por comando, e cada item vira teste:

1. Sem header `Authorization` → **401** nas 8 rotas.
2. Assinatura inválida, `aud` errado, `iss` errado e `exp` vencido → **401**, um caso por item.
3. Token válido de `sub` **fora** da lista → **403** — e a geração **não** acontece.
4. Token válido de `sub` **na** lista → a rota responde como hoje.
5. **Prova de não-cobrança:** nos casos 1 a 3 o livro de custos **não** ganha linha nova.
6. Rate limit excedido → **429**, sem chamada paga.
7. Na interface publicada: sem login não dispara geração; depois do login, dispara.
8. `pnpm test` verde com a suíte nova e `node .tools/scan_secrets.py --history` limpo.

**Pré-requisito do dono (fora do código):** criar um **OAuth Client ID** (tipo *Web application*) no
Google Cloud Console, com origens autorizadas `http://localhost:5173` e
`https://rebeca-odda.vercel.app`, e definir na Vercel: `GOOGLE_CLIENT_ID`, `REBECA_ALLOWED_SUBS` e a
chave do provedor (`OPENAI_API_KEY`). Sem isso o código fica pronto e desligado — o que é o estado
seguro.

## Quem decidiu
Proposto por `rebeca-arquiteto` + `rebeca-seguranca`. **Aprovado pelo dono do produto nesta sessão**,
nas escolhas: "implementar autenticação, pode ser do Google" e "token do Google verificado na função"
(em vez de Supabase Auth agora).

---

## Adendo — implementação (2026-10-02)

Esta seção foi escrita **depois** de o código existir. Ela registra o que a decisão acima não previa, o
que foi encontrado ao implementar e o que segue sem verificação. Nada aqui muda a decisão; três
pontos a **completam**.

### 1. `/api/media/file` não podia continuar alimentando `<img src>` — e a saída não estava no ADR

A decisão diz "toda rota de `api/**` exige token". Aplicada literalmente, ela quebra as **três**
pré-visualizações de arte do app: uma tag `<img src="/api/media/file?…">` **não consegue** enviar
cabeçalho — quem faz a requisição é o navegador. O sintoma seria imagem quebrada, sem erro, sem log.

Saídas avaliadas: (a) abrir exceção de autenticação nessa rota — recusada, é o caminho que entrega a
arte de um canal a quem tiver o endereço; (b) sessão por cookie — recusada, reabre o CSRF que o
desenho com header não tem, e contraria o item 2 da decisão; (c) **`fetch` com o header → `blob:`** —
escolhida. Está em `src/auth/MediaImage.tsx`, com revogação da URL no desmontar (sem isso, cada blob
segura os bytes na memória da aba).

**Achado no mesmo caminho, e é o defeito clássico deste projeto na direção contrária:**
`GET /api/media/file` **não existia como função serverless**. O caminho era atendido apenas pelo
plugin do servidor de desenvolvimento; na Vercel, sem `api/media/file.ts`, a requisição cairia no
rewrite de SPA e devolveria **HTML com status 200** — o navegador tentaria ler HTML como imagem, e o
sintoma ("a prévia não aparece") apareceria **só em produção**. Criado `api/media/file.ts` (mesma
função compartilhada, mesma guarda) e incluído na guarda de imports, que passou a conferir **11**
entrypoints.

### 2. As rotas de autenticação são **duas exceções declaradas**, e as funções viraram 11
O item 1 da decisão fala em "toda rota de `api/**`". A autenticação precisa de duas portas que a
própria decisão exige, e nenhuma delas podia existir dentro da guarda:

| Rota | Guarda | Por quê |
|---|---|---|
| `GET /api/auth/config` | **nenhuma** | o navegador precisa do Client ID **antes** de ter token; o Client ID é público por definição |
| `GET /api/auth/me` | exige token, **não** exige lista | é por ela que o dono descobre o próprio `sub`; sem isso o primeiro acesso seria um ciclo fechado (para entrar era preciso já estar autorizado) |

`/api/auth/config` devolve a **contagem** de identidades autorizadas, nunca a lista — a contagem é o
que permite a tela distinguir "você ainda não está autorizado" de "ninguém está autorizado ainda".

**Consequência de UX aceita, e escrita para não ser descoberta como surpresa: recarregar a página
desloga.** O token vive em memória (item 2 da decisão), então cada `F5` volta para o botão do Google —
um clique, sem redigitar nada, e o endereço que a pessoa estava abrindo é preservado pelo roteador.
Reobter a credencial **sem interação** (One Tap / FedCM com `auto_select`) foi deliberadamente **não**
implementado nesta entrega: acrescenta um caminho de login silencioso, com comportamento que varia por
navegador e por versão, e o ADR aprovou o desenho com botão explícito. Se o atrito incomodar no uso
real, isso é uma decisão nova — com o FedCM como caminho documentado —, não um ajuste de detalhe.

### 3. A auditoria do item 7(c) virou coluna do livro de custos

`identidade_sub` foi acrescentada ao livro (`.rebeca/custos.csv`), **aditiva e no fim**, no mesmo
padrão da migração das colunas de token: as linhas antigas ganham a célula vazia, e vazio continua
significando "não sei", nunca "ninguém". Quem dispara geração paga pela IA ou pela mídia passa a ser
registrado; os caminhos **sem sessão** (CLI do pipeline, Fase 0, teste de conexão anterior) ficam com
a célula vazia — declarado, não preenchido com valor inventado.

### 4. Defeito encontrado ao ler o código da biblioteca: ela **ecoa o token** na mensagem

`google-auth-library` lança, em caminhos reais, `Wrong number of segments in token: <o token inteiro>`.
Propagar essa mensagem colocaria a credencial no `detail` da resposta HTTP. A verificação agora
substitui **qualquer** falha da biblioteca por um motivo fixo, e há teste que serializa o corpo do erro
e afirma que o token não aparece nele.

### 5. `pnpm dev` não veria o `.env` — e a primeira correção disso **mentia em silêncio**

O Vite **não** injeta `.env` em `process.env` (conferido na implementação instalada,
`vite/dist/node/chunks/node.js`, função `loadEnv`: só três chaves são escritas no processo), e o
middleware de desenvolvimento lê `process.env`. Sem ponte, quem copiasse o `.env.example` veria "falta
`GOOGLE_CLIENT_ID`" **com o valor na frente**.

A primeira correção foi uma ponte no `vite.config.ts` que copiava as duas chaves para o processo,
com a regra "o ambiente real vence o arquivo". **Ela mentia**, e o custo foi o dono do produto não
conseguir entrar no app:

1. Editar o `.env` **não tinha efeito nenhum**. Medido com valor sentinela: sete segundos depois da
   edição, `GET /api/auth/config` ainda devolvia o valor antigo. O Vite **não reavalia** o
   `vite.config.ts` quando o `.env` muda, então a ponte não rodava de novo e o `process.env` do
   processo (já preenchido por ela mesma) nunca era atualizado.
2. O sintoma na tela era **"conta ainda não autorizada"** com o `sub` correto na mão. Ou seja: um
   defeito de encanamento disfarçado de defeito de acesso — o pior tipo, porque manda quem opera
   procurar no lugar errado. Duas idas e voltas com o dono até o mecanismo aparecer.

**O que ficou:** `server/dev-env.ts` lê o **arquivo na hora do uso**, com cache por `mtime` (só relê
quando o arquivo muda). Editar o `.env` passa a valer **na requisição seguinte**, sem reiniciar nada —
verificado ao vivo, valor sentinela aplicado em 3 segundos com o servidor no ar. Em troca, a regra fica
explícita: **em desenvolvimento o `.env` manda** para essas duas chaves. E o arquivo é ignorado em
**teste** (`VITEST`) e em **produção** (`VERCEL`) — um `.env` de máquina de desenvolvimento não pode
mudar o resultado da suíte nem a configuração do host. Seis testes em `src/__tests__/dev-env.test.ts`,
incluindo o que prova que o `.env` real do repositório **não** influencia a suíte.

**A lição, de novo a mesma família:** o defeito não estava no lugar onde o sintoma aparecia. Duas
correções minhas falharam antes de o mecanismo real aparecer — e o que o fez aparecer foi um
**experimento com valor observável** (sentinela + endpoint público), não leitura de código.

### 6. Divergência corrigida no runbook

A Parte 4, item 4 do `docs/passo-a-passo-autenticacao-google.md` afirmava que `/api/ai/status`
continuaria respondendo **200**. Com a decisão aplicada como está escrita, **todas** as rotas de
`api/ai/*` exigem token — inclusive ela. O runbook foi corrigido; a decisão não.

### 7. CSP: o que foi autorizado, e uma autorização que **não** foi precisa

Os quatro endereços do Google entraram no CSP conforme a documentação oficial (Setup — Sign in with
Google for Web, atualizada 2026-04-06, relida em 2026-10-02), e o COOP virou
`same-origin-allow-popups` (a doc: com FedCM desabilitado, o valor precisa incluir
`same-origin-allow-popups`, senão "a comunicação entre janelas quebra" e o pop-up abre em branco).

**A foto de perfil do Google não é renderizada**, de propósito: exibi-la exigiria autorizar
`*.googleusercontent.com` no `img-src`, e a tela mostra nome, e-mail e `sub` — que é o que a operação
precisa. CSP menor sem perda para o usuário.

**Custo assumido do COOP:** `same-origin-allow-popups` é **menos estrito** que `same-origin` — janelas
que *nós* abrimos mantêm referência ao nosso `window`. É o preço de usar o botão do Google no caminho
sem FedCM, e está aqui escrito para não parecer descuido: a alternativa seria manter `same-origin` e
conviver com pop-up em branco quando o FedCM não estiver ativo, que é uma falha de login sem mensagem
nenhuma. O resto da política de isolamento (CSP estrito, `frame-ancestors 'none'`,
`X-Frame-Options: DENY`) não mudou.

### 8. O que esta implementação **não** prova
1. **Nenhum token real do Google foi verificado.** O caminho de assinatura é da biblioteca oficial e
   não foi exercitado (exigiria rede e um login de verdade). O que está provado por teste é a
   **política**: `aud`, `iss`, `exp`, `sub`, lista de acesso, e a recusa de token sem forma de JWT —
   tudo com verificador injetado. **Não verificado:** que a biblioteca, com as chaves reais do Google,
   aceite um token legítimo.
2. **O popup/One Tap em navegador real não foi observado.** O COOP e o CSP foram corrigidos segundo a
   documentação, mas quem confirma é o login do dono no navegador (runbook, Parte 4).
3. **O rate limit é por instância.** Em serverless, cada invocação pode nascer com o contador zerado.
   Está escrito no código; um limite de verdade, compartilhado, exige banco — decisão D1, aberta.
4. **A função serverless com a dependência nova não foi executada na Vercel.** O cold start foi
   simulado localmente (mesmo procedimento do defeito de import que derrubou a IA uma vez), não no
   runtime de produção.

### 9. Correção de uma promessa deste ADR: autenticar **não** basta para o app publicado gerar

A seção "Consequências" afirma que a versão publicada "passa a funcionar como o localhost". Isso está
**incompleto**, e a implementação encontrou o motivo ao ler o caminho de gasto: o **teto diário**
depende de ler quanto já foi gasto, e em serverless o livro de custos não é durável (achado **QA-006
#1**). O efeito prático continua valendo: com `VERCEL=1`, **geração paga é recusada com 403**
(`server/ai/handler.ts`, "livro de custos não durável neste ambiente") até existir banco **ou** até a
decisão explícita em `REBECA_ALLOW_NO_LEDGER=1` — que assume gastar sem teto diário efetivo.

Autenticar não mudou isso, e não podia: são travas diferentes (quem pode gastar × quanto se pode
gastar). O que muda é que agora **existe a quem atribuir** o gasto — a coluna `identidade_sub` —, que é
pré-requisito para um dia o limite ser durável por identidade.

**Consequência para o dono, dita sem enfeite:** publicar `GOOGLE_CLIENT_ID`, `REBECA_ALLOWED_SUBS` e a
chave **não** liga a geração em produção. Faltam, ainda, uma decisão sobre o livro de custos durável
(banco — é a `D1`) ou o aceite explícito de `REBECA_ALLOW_NO_LEDGER=1`.

### 10. Revisão adversarial: veredito REFUTADO PARCIALMENTE — corrigido, e o que ela ensinou

Relatório completo em `docs/qa/QA-014-autenticacao-google.md`, com a resposta do produtor no topo. O
núcleo resistiu a tudo que importava (não se gasta sem identidade válida **e** autorizada; nenhum
ataque de header furou; nenhum token vazou; o livro ficou intacto em 401/403/429). Duas afirmações
**específicas** eram falsas, e as duas eram do tipo que o projeto persegue:

1. **A guarda não era a primeira checagem nas quatro cascas serverless que leem corpo.** Com o corpo
   lido antes da guarda, requisição **sem credencial nenhuma** recebia `400` (corpo inválido) em vez de
   `401`, e o processo ainda analisava até 256 KB de quem não se identificou. Correção: o corpo passou
   a ser passado como **função** (`() => readJsonBody(req)`) e é lido **dentro** do roteador, depois da
   guarda — em todas as cascas, nos dois plugins do Vite e nas três assinaturas de roteador. Efeito
   colateral bom: o `413` de corpo grande demais deixou de ser reescrito como `400`.
2. **`MediaImage` aceitava `200` com `text/html` como imagem.** Um `index.html` do rewrite de SPA virava
   `blob:` e ia para o `<img>` — imagem quebrada **em silêncio**, o sintoma exato que o componente
   existe para eliminar. Correção: exige `content-type: image/...`.

Mais quatro observações de gravidade baixa, todas atendidas: **duas cotas de uso** (leitura 240/min,
geração 20/min — antes uma cota só fazia uma tela com 13 prévias chegar perto do teto e receber `429`
em `GET`); o pai do GIS no `default-src` (fallback que a doc pede); a **contagem** de identidades
autorizadas saiu da rota pública; e o `redact` no único ponto de saída que não o tinha.

**A lição que fica, e não é sobre este código:** o defeito 1 não era um furo de segurança — era a
**ordem** de duas linhas. Ele sobreviveu à minha própria leitura do arquivo, ao `tsc`, à suíte inteira
e a um teste que eu escrevi para "provar o 401": todos os meus casos chamavam o **roteador** direto, e
o defeito morava exatamente no pedaço que eu não exercitei — a **casca**. Testar a camada de baixo e
chamar de prova do caminho de cima é o buraco por onde ele passou. Os testes que o `rebeca-qa`
escreveu passam a cobrir a casca de verdade, e por isso ficaram no repositório em vez de virarem
relatório.

### 11. O console do dono encontrou um defeito que nenhum teste meu via: `initialize` repetido

Ao usar o app, o dono colou o console do navegador. Dois avisos, e só um era nosso:

1. **`google.accounts.id.initialize() is called multiple times. … only the last initialized instance
   will be used.`** — **defeito real deste código.** O `StrictMode` do React 19 (padrão do `main.tsx`)
   monta, desmonta e remonta cada efeito; `renderGoogleButton` chamava `initialize` a cada montagem, e
   `renderButton` **acrescenta** um iframe em vez de substituir — ou seja, a tela de entrada
   inicializava a biblioteca duas vezes por abertura e podia desenhar dois botões sobrepostos.
   Corrigido: `initialize` **uma vez por cliente** (o callback é registrado uma vez e lê o handler
   **atual** numa variável de módulo, para não congelar closure antiga) e `replaceChildren()` antes de
   desenhar. Cinco testes novos em `src/auth/__tests__/google.test.ts`, com um `window.google` falso —
   é o único jeito de medir isso sem navegador.
   **Por que a suíte não pegava:** nenhum dos meus testes exercitava a remontagem do botão. O defeito
   só existia no navegador, e foi o **dono usando o app** que o trouxe.
2. **`Cross-Origin-Opener-Policy policy would block the window.postMessage call.`** — **não é nosso.**
   Medido: o servidor de desenvolvimento **não envia COOP nenhum** (a resposta de `/` não tem o
   cabeçalho; `vercel.json` só vale em produção). O aviso vem do próprio GSI, no caminho de popup/One
   Tap que ele tenta e que o nosso desenho não usa — e o login **funcionou** nas duas tentativas, o que
   é a prova de que o caminho que importa está de pé. Em produção o valor é
   `same-origin-allow-popups`, que é exatamente o que a documentação prescreve para o popup manter a
   comunicação com a janela que o abriu. **Nada a corrigir aqui** — registrado para não virar
   "achismo" na próxima vez que alguém vir a mensagem.

