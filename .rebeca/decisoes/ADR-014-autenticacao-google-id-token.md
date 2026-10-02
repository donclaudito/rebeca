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
