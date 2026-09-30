# Threat model — Rebeca / AI Media Studio

> **Estado:** protótipo (F0.5 → F1). Não há backend real, não há OAuth, não há credencial de ninguém,
> não há dado pessoal. Este documento descreve **o que já está de pé**, **o que foi corrigido nesta
> auditoria** e **o que ainda não existe** — sem tratar promessa como controle.
>
> Última revisão: auditoria de segurança da sessão de 2026-09-30 (skill `rebeca-seguranca`).
> Próxima revisão obrigatória: antes de ligar OAuth do YouTube ou geração paga (F1).

## 1. Escopo e limite honesto deste documento

O que existe hoje é um **app cliente com dados de exemplo** (`src/data/mock/db.ts`) e um **esqueleto
de servidor de IA** em construção (`api/`, `server/ai/`). Consequências:

- Não existe token OAuth, chave de provedor, banco, RLS nem usuário. Nada disso pode ser "testado"
  aqui — só especificado como requisito de F1.
- Os controles marcados **FECHADO** têm teste executável neste repositório.
- Os marcados **ABERTO** têm responsável e o motivo de não estar fechado.
- Os marcados **NÃO VERIFICADO** dependem de ambiente que ainda não existe (URL de produção, banco,
  API do YouTube). Não são "ok por omissão".

## 2. Ativos, na ordem em que doem

| # | Ativo | Por que é o mais crítico que existe na frente dele |
|---|---|---|
| A1 | **Token OAuth / refresh token do canal do YouTube** | Quem tem o refresh token **publica em nome daquele canal**. Não é leitura de dado: é falar com a audiência de outra pessoa. Ainda não existe. |
| A2 | **Chave de provedor de IA** (`server/ai/`) | Gasta dinheiro real por chamada e, em alguns provedores, vai na URL. Existe no ambiente de quem configura — não no repositório. |
| A3 | **Artefato aprovado** (título, descrição, thumbnail, vídeo) | É o que a criança vai assistir e o que o dono do canal assina. Se o aprovado ≠ o publicado, o invariante nº 1 do `AGENTS.md` virou enfeite. |
| A4 | **Isolamento entre canais** | Vazamento entre canais é prioridade máxima por invariante. Um canal infantil e um canal adulto não podem se enxergar. |
| A5 | **Trilha de aprovação** | Sem ela não há como responder "quem liberou isso e a partir de qual versão?" — nem para o dono, nem para uma auditoria do YouTube. |
| A6 | **Custo** | Geração paga sem trava é dívida silenciosa; `AGENTS.md` faz do custo um requisito, não uma métrica. |

## 3. Fronteiras de confiança

| Fronteira | Quem está de um lado | O que atravessa |
|---|---|---|
| Navegador ↔ app | usuário (dono do canal) | cliques, texto digitado (título, motivo da rejeição), URL |
| Navegador ↔ `/api/ai` | qualquer origem que alcance o deploy | corpo JSON; hoje sem autenticação (**ABERTO**, ver T9) |
| Servidor ↔ provedor de IA | `server/ai/providers*.ts` | prompt e **corpo de erro devolvido pelo provedor** (ver T2) |
| Servidor ↔ YouTube | futuro (`rebeca-youtube`) | upload, metadados, métricas |
| Conteúdo externo → prompt | títulos, descrições, comentários, resultados de pesquisa | texto não confiável dentro do prompt (ver T7) |

## 4. Ameaças, controle e teste

### T1 — **Aprovação humana decorativa** (FECHADO nesta auditoria)

**Ataque:** aprovar um conteúdo e, **depois**, trocar o título, a descrição ou a thumbnail. O estado
continuava `agendado`, então o que iria ao ar não era o que o humano aprovou — e nenhuma tela
mostrava isso. A aprovação era um carimbo sem vínculo com a versão.

**Causa encontrada:** `approve()` gravava `status: 'agendado'` e **nada** prendia a aprovação ao
conteúdo aprovado; `saveTitle()` e `selectThumbnail()` mutavam o item preservando o estado.

**Controle:** `ApprovalRecord` (`src/data/types.ts`) com `approvedAt`, `channelId`, `contentId`,
`scheduledAt` e **`snapshot`** — a impressão exata da parte que chega ao YouTube
(`contentSnapshot`, `src/data/client.ts`).
- Editar título ou thumbnail **derruba a aprovação** e devolve o conteúdo para `revisao`/`revisar`.
- Reagendar **não** derruba (o vídeo aprovado não mudou; só a data) e atualiza a data no registro.
- `assertPublishable(channelId, contentId)` é o portão: recusa publicar sem aprovação vigente cuja
  impressão bata com o conteúdo atual. É a defesa em profundidade — mesmo que uma tela, job ou
  agente publique por fora, a chamada é recusada antes de falar com o YouTube.
- A tela de revisão mostra o fato ("Aprovação humana registrada em …" / "Sem aprovação vigente"),
  não a intenção.

**Teste:** `src/data/__tests__/aprovacao.test.ts` — 15 casos, incluindo "editar DEPOIS de aprovado
invalida", "adulterar a versão é detectável" e "o portão não atravessa canal".
Evidência: `.rebeca/evidencias/seguranca-aprovacao-red.txt` (12 falhas antes) e
`seguranca-aprovacao-green.txt` (15/15 depois).

**Residual:** a identidade de quem aprovou (`approvedBy`) **não** é registrada — não existe
autenticação (D3). Registrar um nome de usuário agora seria inventar dado. O que está provado é
**o quê**, **quando** e **em que canal**.

---

### T2 — **Chave do provedor de IA vazando na mensagem de erro** (FECHADO nesta auditoria)

**Ataque:** a API do provedor devolve `401` e o corpo de erro ecoa o cabeçalho da requisição. Se esse
texto chega ao `AiError.detail` sem tratamento, `AiError.toBody()` entrega o `detail` ao navegador
(`server/ai/http.ts`) — **a chave sai do servidor pela resposta HTTP**.

**Estado em que foi encontrado:** o `redact()` existia (`server/ai/handler.ts`) e era aplicado no
ramo de "erro inesperado", mas **não** no `AiError` reemitido como está — e é justamente o `AiError`
que `providerError()` produz a partir de `safeProviderMessage()`, que devolve até 300 caracteres da
mensagem do provedor sem filtro (`server/ai/providers.ts:83`).

Foi assim que o sintoma apareceu — um teste do autor, vermelho, e depois **verde sem que o furo
estivesse fechado**:

```
FAIL > não vaza chave nem corpo cru do provedor na mensagem de erro
  expected 'OpenAI disse: 401 com Authorization: …' not to contain
           'chave-secreta-que-nao-pode-vazar'
```

**Correção aplicada:** o `AiError` que sai de `handleGenerate` é reemitido com `message` e `detail`
passando por `redact()` (`server/ai/handler.ts`). O filtro entrou **no ponto de saída**, e não em
`safeProviderMessage`, de propósito: assim vale para todo adaptador — inclusive os que ainda não
existem — e também para quem consome `handleGenerate` sem ser HTTP (log, job). Não exigiu mover
`redact` para módulo próprio, portanto não criou ciclo de import (`handler` importa `providers`).

**O verde era falso — e isso é o achado de processo.** O teste do autor passou a passar, mas
plantava a chave com um `Error` **comum** lançado do `transport` injetado, que cai no ramo de "erro
inesperado" (esse sim filtrado). O caminho real do adaptador continuava vazando. Foi preciso
**refutar o teste verde** para achar o furo:

```
src/ai/__tests__/vazamento-provedor.test.ts   (2 casos, falharam antes da correção)
  → fetch injetado devolve 401 ecoando o Authorization
  → pelo adaptador OpenAI REAL (sem transporte de teste)
  → corpo que o http.ts serializa:
     {"code":"provedor", …,
      "detail":"HTTP 401 — invalid_api_key: Incorrect API key provided: Authorization: Bearer sk-chaveDeTeste…"}
```

**Evidência:** `.rebeca/evidencias/seguranca-vazamento-provedor.txt` — 2/2 falharam antes; 2/2
passam depois, e os 30 testes do autor seguem verdes.

**Regra que fica:** mensagem de erro é superfície de vazamento; `detail` só sai do servidor depois de
passar por `redact`. E **teste verde que exercita o caminho errado é pior que teste ausente** — ele
certifica uma garantia que não existe. Quem revisa pergunta *por onde o ataque entra de verdade*,
não só se a asserção passa.

---

### T3 — **Scanner de segredo que diz "limpo" sem ter olhado** (FECHADO nesta auditoria)

**Dois furos reais, os dois silenciosos:**

1. `git grep -I` pulava arquivo com byte NUL (UTF-16LE do PowerShell). Fechado antes desta auditoria,
   com `--history` e decodificação por BOM/NUL.
2. **Padrão sem a Anthropic.** `sk-[A-Za-z0-9]{32,}` não casa `sk-ant-api03-…`, porque o hífen depois
   de `sk-` interrompe a classe de caracteres. Provado nesta auditoria: a mesma string é detectada
   como `openai-key` quando escrita sem hífen e **ignorada** no formato real da Anthropic.

**Controle:** padrão `anthropic-key` (`sk-ant-…`, formato confirmado na documentação oficial do
Provedor — [platform.claude.com/docs/en/manage-claude/authentication](https://platform.claude.com/docs/en/manage-claude/authentication),
lido em 2026-09-30: "Static `sk-ant-api...` secret sent as a bearer token in the `Authorization`
header"). Arquivo rastreado acima de 2 MB deixa de ser pulado em silêncio: vira **AVISO** na saída.

**Prova:** `.tools/test_scan_secrets.py` — 12 positivos (formato real, valor inventado), 5 negativos
(a prosa do próprio repositório, que cita `AIza`, `sk-ant-api...`, `refresh_token`) e o caso UTF-16LE.
Rodado no CI **antes** do scanner. Remover o padrão `anthropic-key` faz o teste falhar (provado):
```
FALHOU na prova do scanner:
  positivo NAO detectado: [anthropic-key] em anthropic
```
Varredura real da árvore + histórico: **269 blobs, limpo**, 2 achados ignorados pelo baseline
revisado (`docs/qa/QA-003-publicacao-nuvem.md`, fixtures documentadas).

**Residual:** token da Vercel não tem prefixo publicamente estável — não foi inventado padrão para
ele (`NÃO VERIFICADO`). Se um dia existir, entra com fonte e caso de teste.

---

### T4 — **XSS e injeção no deploy** (FECHADO parcialmente nesta auditoria)

**Estado anterior:** `vercel.json` tinha `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy` e `Permissions-Policy`, mas **nenhum `Content-Security-Policy`** e nenhum
`Strict-Transport-Security`. Sem CSP, a defesa contra XSS era só o escape automático do React — que é
bom, mas é uma camada só. O `index.html` ganhou (sessão paralela) um **script inline** de tema, que é
exatamente o caso em que um CSP estrito precisa de decisão: `'unsafe-inline'` (fraco) ou hash.

**Controle:** CSP estrito **por hash**, `Strict-Transport-Security` e `Cross-Origin-Opener-Policy`.

```
default-src 'self'; script-src 'self' 'sha256-qpRjRiAYTMBLET8G9KOyANYuFR15hjD791gTZufxShc=';
style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
upgrade-insecure-requests
```

**Prova:** o hash foi calculado do **artefato de produção** (`pnpm exec vite build`), não do fonte —
e o script inline é byte a byte idêntico nos dois (524 bytes, mesmo sha256). `dist/index.html` não
tem `<style>` nem atributo `style=` (0 e 0), só o `<script type="module" src>` externo.
`src/__tests__/headers.test.ts` (8 casos) lê `index.html` e `vercel.json` do disco e **falha se o
hash autorizado divergir do script que o documento carrega**, e recusa `'unsafe-inline'`/`'unsafe-eval'`
em `script-src`. Provado adversarialmente: trocar um caractere do hash deixa o teste vermelho.
Decisão e trade-off em `ADR-008` (nasceu como ADR-007 e cedeu o número — ver §7).

**NÃO VERIFICADO:** a aplicação real dos cabeçalhos **não foi observada** — não existe URL de
produção (o import na Vercel é do dono). O rewrite de SPA e a ausência de quebra por CSP também não
foram provados com HTTP 200 em rota profunda. O que está provado é que o hash casa com o artefato.

**Cuidado para quem vier depois:** quando os provedores de mídia/Storage entrarem, `img-src` e
`connect-src` vão precisar das origens reais. Apertar primeiro e esquecer de soltar depois quebra a
tela; soltar `*` por conveniência desfaz o controle. A lista é curta de propósito.

---

### T5 — **Vazamento entre canais** (FECHADO no que existe hoje)

**Controle:** o canal vive na URL (`/c/:channelId/…`), toda chave de cache começa em
`['channel', channelId]`, o `ChannelLayout` remove consultas de outros canais a cada troca e o
`AppShell` remonta por `key={channelId}`. A camada de dados recusa recurso de outro canal com a
**mesma** mensagem de "não existe" (não vaza nem a existência).

**Teste:** `src/data/__tests__/channel-scope.test.tsx` (4/4) — troca de canal pelo seletor e prova
que nada do canal anterior sobra no DOM nem no cache.

**Residual (F1):** isto é isolamento **de cliente**. Sem RLS e sem autenticação, quem controla a URL
controla o `channelId`. Em backend real, o `channelId` **não pode** ser aceito do cliente: tem de ser
derivado do contexto autenticado, com RLS como última linha. `api.getPortfolio()` já é a única
leitura que cruza canais (agregada, somente leitura) e é a primeira que precisará de autorização.
Depende de D3 (modelo de acesso) e da skill `rebeca-supabase`.

---

### T6 — **SSRF no download de mídia** (NÃO EXISTE — requisito de F1)

O produto vai baixar mídia de provedores e aceitar upload do usuário. Nada disso existe ainda.
Requisito registrado para quem implementar: allowlist de host, redirecionamento não seguido
cegamente, bloqueio de faixa interna (loopback, link-local, rede privada, metadata de nuvem), teto de
tamanho e de tempo, tipo real por magic bytes (não por extensão), nome de arquivo nunca usado como
caminho, armazenamento fora do servidor de aplicação com URL assinada curta.

---

### T7 — **Injeção de prompt por conteúdo externo** (PARCIAL)

`src/ai/schemas.ts` valida a **saída** de cada função contra JSON Schema (`additionalProperties:
false`, limites de tamanho, enums) e `src/ai/contract.ts` marca `requiresHumanApproval: true` em
todas as funções que produzem conteúdo — a IA propõe, o humano decide. Isso limita o dano.

O que **não** está de pé: delimitação explícita de conteúdo externo no prompt e casos de avaliação
de injeção. O motivo da rejeição digitado pelo humano vai para o prompt como contexto — por isso ele
tem teto de 400 caracteres na camada de dados (mesmo teto do schema de IA), e não é instrução de
sistema. Título/descrição/comentário do YouTube entram nisso quando a integração existir.
Responsável: `rebeca-prompt-eng`.

---

### T8 — **Idempotência de publicação** (NÃO EXISTE — requisito de F1)

Retry não pode gerar vídeo nem publicação duplicada. Hoje `approve()` é local e idempotente por
natureza (a dupla submissão já é barrada na tela: `revisao.test.tsx` prova uma única chamada com dois
cliques). Quando o upload existir, a chave de idempotência é obrigatória, com o `snapshot` aprovado
como parte da chave — reaproveitando T1.

---

### T9 — **Rate limit, teto de custo e abuso** (PARCIAL — o que resta é autenticação)

`server/ai/http.ts` limita o tamanho do corpo e devolve erro sem stack. Os três testes que estavam
vermelhos **foram corrigidos pela sessão paralela** durante esta auditoria, e eu **verifiquei no
código e na suíte** (30/30 do `handler.test.ts`):

- teto diário aplicado **antes** de enviar ao provedor (`handler.ts:382`, erro `teto-diario`);
- custo da tentativa que falhou passa a ser registrado (`(falhou)` no livro) — sem custo fantasma;
- o override de ambiente deixou de furar o gate do canal infantil (`catalog.ts:352` + a mensagem
  explícita em `handler.ts:198`).

**O que continua aberto — e é o bloqueante real:** **nenhuma rota `/api/ai` tem autenticação.**
Qualquer um que alcance o deploy consome a chave configurada. O teto diário (US$ 1,00) **limita o
dano, não substitui autenticação** — ele é a diferença entre uma fatura ruim e uma fatura péssima.
**Bloqueia ligar geração paga em ambiente público.**

---

### T10 — **Aprovação registrada em `.rebeca/estado.md`** (PARCIAL)

O invariante nº 1 exige aprovação **registrada em `.rebeca/estado.md`**. Hoje a aprovação existe só
na memória da sessão do navegador — o `ConfiguracoesPage` diz isso ao usuário com todas as letras, e
nenhuma publicação acontece. O `ApprovalRecord` de T1 é o formato do registro; persistir e escrever o
espelho em `.rebeca/` é trabalho de F1, junto com a trilha de auditoria de publicação (canal, vídeo,
versão de roteiro/prompt/thumbnail, aprovador, data, credencial, resultado da API).

## 5. O que fica aberto, com dono

| # | Achado | Severidade | Dono | Bloqueia |
|---|---|---|---|---|
| T9 | **`/api/ai` sem autenticação** — o teto diário limita o dano, não substitui auth | **alta** | `rebeca-backend`, `rebeca-seguranca` | ligar geração paga em ambiente público |
| T5 | `channelId` do cliente sem RLS/autenticação | alta | `rebeca-supabase` (D3) | F1 |
| T4 | cabeçalhos não observados em produção | média | `rebeca-github` | — |
| T7 | injeção de prompt sem casos de avaliação | média | `rebeca-prompt-eng` | F1 |
| T8 | idempotência de publicação | média | `rebeca-backend` | publicar de verdade |
| T6 | SSRF no download de mídia | média | `rebeca-backend` | gerar mídia |
| T10 | aprovação não persistida / sem `approvedBy` | média | `rebeca-supabase` (D3) | publicar de verdade |
| S8 | `.env.example` contradiz o gate do canal infantil | média | **dono do produto** (conformidade com menor) | publicar conteúdo infantil |

**Fechados nesta auditoria:** T1 (aprovação decorativa), T2 (chave do provedor no `detail`),
T3 (scanner cego para a Anthropic), T4 (CSP e HSTS declarados), S4/T9-custo (teto diário, custo
fantasma e gate infantil — corrigidos pela sessão paralela e verificados aqui).

## 6. Verificação desta auditoria (comando + resultado observado)

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Suíte de aprovação (antes) | `pnpm exec vitest run src/data/__tests__/aprovacao.test.ts` | ❌ **12 falhas / 15** — `.rebeca/evidencias/seguranca-aprovacao-red.txt` |
| Suíte de aprovação (depois) | idem | ✅ **15/15** — `seguranca-aprovacao-green.txt` |
| Cabeçalhos e CSP | `pnpm exec vitest run src/__tests__/headers.test.ts` | ✅ **8/8** — `seguranca-headers.txt`; provado adversarialmente (hash trocado → 1 falha) |
| Teste do scanner | `python .tools/test_scan_secrets.py` | ✅ 12 positivos, 5 negativos, UTF-16LE; provado adversarialmente (padrão removido → 3 falhas) |
| Varredura real | `python .tools/scan_secrets.py --history` | ✅ limpo em **269 blobs** |
| Hash do CSP contra o artefato | `pnpm exec vite build` + sha256 do script inline | ✅ `sha256-qpRjRiAM…` idêntico em `index.html` e `dist/index.html` (524 bytes) |
| Vulnerabilidade em dependência | `pnpm audit --audit-level=moderate` | ✅ nenhuma conhecida |
| Vazamento T2 (antes) | `pnpm exec vitest run src/ai/__tests__/vazamento-provedor.test.ts` | ❌ **2/2 falharam** com a chave no corpo enviado ao navegador — `seguranca-vazamento-provedor.txt` |
| Vazamento T2 (depois) | idem + `handler.test.ts` | ✅ **32/32** (2 do vazamento + 30 do autor) |
| Suíte completa | `pnpm exec vitest run` | ⚠️ **93/95** — 2 falhas **por tempo** com a máquina sob contenção; em isolamento passaram **8/8** (9,1 s e 19,5 s contra 22,7 s e 53,7 s sob carga). Não é defeito do produto: é a intermitência já registrada, e o limite de 20 s está na borda nesta máquina |
| As 3 suítes de segurança desta auditoria | `vitest run headers + aprovacao + vazamento-provedor` | ✅ **25/25** — `seguranca-final.txt` |

**Ressalva de leitura (importa):** `tsc` esteve **exit 0 às 18:27**, com todas as mudanças desta
auditoria aplicadas. Depois disso a sessão paralela começou uma refatoração em `src/ai/contract.ts` e
o `tsc` voltou a acusar erro — trabalho em andamento dela (§7), não desta auditoria. De passagem,
detectei nesse arquivo um **byte `0xFF` órfão** que fazia o `tsc` tratá-lo como binário
(`TS1490`) e quebrava o `pnpm build` — varri a árvore inteira e era o único arquivo afetado; a sessão
paralela o regravou antes de eu intervir. **Enquanto a D9 estiver aberta, o estado do build pode
mudar a qualquer instante por escrita alheia: confira você mesmo antes de confiar nesta tabela.**


## 7. Concorrência (não é ameaça, é condição)

Durante esta auditoria **duas sessões de agente escreveram na mesma pasta**. Consequência medida: a
sessão paralela regravou `src/features/revisao/RevisaoPage.tsx` entre a leitura e a edição deste
agente (a ferramenta recusou a edição e exigiu releitura), adicionou `api/`, `server/`, `src/ai/`,
`public/` e reescreveu `index.html`, `Topbar`, `Sidebar`, `AppShell`, `tsconfig.json`,
`vite.config.ts` e `docs/03-design-system.md`.

Três danos concretos, além da lentidão que já estava registrada:

1. **Numeração de ADR colidiu duas vezes.** A sessão paralela criou dois `ADR-006`; ao renomear um
   deles para 007, colidiu com o meu 007 do mesmo minuto. Resolvido cedendo o número, e o resultado
   final só se estabilizou depois de **três** renomeações: `ADR-006-camada-de-llm-por-funcao`,
   `ADR-008-csp-e-hash-do-script-inline` (este), `ADR-009-linguagem-visual-youtube`. O `ADR-007`
   ficou **vazio de propósito**, como registro do número disputado.
2. **Referências quebradas em documento.** A renomeação deixou `docs/03-design-system.md` apontando
   para um arquivo que não existia mais (corrigido — hoje ele cita `ADR-009` e, para o contrato de
   CSP, o `ADR-008`).
3. **Falha de teste por contenção.** Duas suítes falharam por `Test timed out in 20000ms` na rodada
   completa e passaram em isolamento logo depois (22,7 s → 9,1 s; 53,7 s → 19,5 s). O limite está na
   borda nesta máquina.

Um efeito colateral **positivo**, que vale registrar: as duas sessões convergiram. `docs/03` passou a
documentar o contrato de CSP deste ADR, e a sessão paralela corrigiu os achados de custo e de gate
infantil enquanto eu provava o vazamento de credencial. Auditoria em paralelo funciona — o que não
funciona é **editar o mesmo arquivo** em paralelo.

É a decisão **D9** cobrando o preço de novo, e a razão de o commit desta auditoria ter de ser feito
com a pasta quieta.
