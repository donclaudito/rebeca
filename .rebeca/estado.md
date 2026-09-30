# Estado da orquestra — Rebeca

> Arquivo de memória durável. Todo agente lê antes de agir e atualiza depois de entregar.
> Última atualização: protótipo navegável do AI Media Studio entregue, testado e rodando (ver
> "Verificação do protótipo").
> **Atualização desta sessão:** o ciclo do produto foi fixado em **10 etapas canônicas**
> (`Agendar` ≠ `Publicar`; `Melhorar` no lugar de `Ajustar`) — ver `ADR-004` e a seção "Verificação
> do ciclo canônico". A lista D1–D9 mais abaixo é anterior ao `ADR-003` e não o reflete.

## Fase atual

**F0 — Fundação da orquestra** (concluída): visão de produto documentada, 18 especialistas
definidos, workflows de orquestração disponíveis, memória durável criada.

**F0.5 — Protótipo navegável do AI Media Studio** (concluída nesta sessão): as telas dos dois
modelos existem, são navegáveis, passam por 8 testes (incluindo o de vazamento entre canais) e o
build de produção fecha. Ainda roda com **dados de exemplo**.

**F1 — Fundação do produto** (não iniciada): decisões D2–D6 e D9 abertas, schema com RLS, integração
real com o YouTube e o primeiro caminho vertical ponta a ponta com dado de verdade.

## O que existe hoje

| Artefato | Status |
|---|---|
| `docs/00-visao-produto.md` | ✅ visão de produto completa (fonte de verdade) |
| `docs/01-orquestra-de-agentes.md` | ✅ roster, handoffs, DoD |
| `docs/02-fluxos.md`, `docs/modelo-skill.md` | ✅ manual de operação e modelo de skill |
| `docs/03-design-system.md` | ✅ **fonte de verdade visual** — implementada em `src/styles/tokens.css` |
| `docs/04-mapa-funcional.md` | ✅ **fonte de verdade funcional** — rotas implementadas conforme §2 |
| `.dsh/skills/*` (18 especialistas) | ✅ escritos e validados (ver "Verificação da F0") |
| `.dsh/workflows/*.js` (3 fluxos) | ✅ sintaxe validada; ⚠️ nunca executados ponta a ponta |
| `AGENTS.md`, `README.md` | ✅ carregados pelo harness |
| `.rebeca/` (estado, custos, ADRs, evidências) | ✅ ADR-000/001/002 + `.rebeca/evidencias/` |
| **Código da aplicação** | ✅ `src/` completo: 10 telas, design system executável, camada de dados escopada por canal, 3 suítes de teste |
| `src/data/cycle.ts` | ✅ **fonte única do ciclo** — `CYCLE_ORDER` (10 etapas) e `CYCLE_LABEL` (pt-BR) |
| Ciclo canônico de **10 etapas** | ✅ `ADR-004-ciclo-canonico-10-etapas.md` (aceito pelo dono na sessão) |
| Ciclo literal do PDF | ✅ `.rebeca/fontes/ciclo-no-pdf.md` — **9 seções, todas recebidas** |
| Decisão de stack do **front** | ✅ `ADR-001-stack-front.md` (aceito pelo dono na sessão) |
| Marca da **interface** | ✅ `ADR-002-marca-ai-media-studio.md` (aceito pelo dono na sessão) |
| Decisão de stack do **backend** | ❌ aberta (segunda metade de D1) |
| Repositório git | ✅ **privado** em `github.com/donclaudito/rebeca`, branch `main` — ver "Publicação na nuvem" |

## Frente paralela — resolvida

A frente paralela que montou o scaffold **concluiu a entrega nesta sessão**, junto com esta orquestra.
O conflito de propriedade de caminhos ficou assim:

| Caminho | Dono |
|---|---|
| `.dsh/`, `AGENTS.md`, `docs/00`–`02`, `docs/modelo-skill.md` | esta orquestra |
| `src/`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html` | protótipo |
| `docs/03-design-system.md` | **fonte de verdade visual** — `rebeca-branding` e `rebeca-react` seguem |
| `docs/04-mapa-funcional.md` | **fonte de verdade funcional** — `rebeca-produto` não reescreve |
| `imagens/modelo*.jpeg` | insumo do dono do produto |

**O que o protótipo não fez** (e por que isso é o correto): nenhuma chamada a provedor de IA, nenhum
custo lançado (`.rebeca/custos.csv` segue intocado — o protótipo não gasta dinheiro), nenhuma
publicação no YouTube, nenhum dado pessoal tratado. Nenhum invariante foi violado.

**Consequências para a orquestra:**

1. `docs/03-design-system.md` passa a ser a **fonte de verdade visual**; o `rebeca-branding` e o
   `rebeca-react` devem segui-lo em vez de inventar paleta ou componente.
2. `docs/04-mapa-funcional.md` passa a ser a **fonte de verdade funcional** (rotas, donos, aceite);
   o `rebeca-produto` não deve reescrever histórico já mapeado.
3. A stack já está **ratificada em ADR-001** (era o item 3 desta lista) e a marca da interface em
   **ADR-002** — os dois aceitos pelo dono do produto nesta sessão.

## Verificação do protótipo (comando + resultado observado)

Ambiente: Node v26.7.0 · pnpm 11.25.0 · Windows.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro (TypeScript 7, `strict`) |
| Testes | `pnpm exec vitest run` | ✅ **8/8 em 2 arquivos**, exit 0 — log em `.rebeca/evidencias/vitest.txt` |
| Build de produção | `pnpm run build` | ✅ exit 0 — `dist/index.html` 0,64 kB · CSS 29,86 kB (gzip 7,03) · JS 423,63 kB (gzip 125,67) |
| Servidor local | `pnpm run dev` (job `pwsh-48`) | ✅ `http://127.0.0.1:5173/` → HTTP 200; `/c/luna/inicio` → HTTP 200 (fallback de SPA) |
| Nenhuma cor solta em componente | inspeção de `src/**/*.tsx` | ✅ toda cor vem de `src/styles/tokens.css` |
| Nenhum nome de projeto na tela | inspeção de `src/**/*.tsx` | ✅ zero ocorrências de "Rebeca" na interface (ADR-002) |

**O teste que importa:** `src/data/__tests__/channel-scope.test.tsx` troca de canal pelo seletor e prova
que, depois da troca, (a) o conteúdo do canal novo aparece, (b) nada do canal anterior sobra no DOM,
(c) nenhuma chave de cache com outro `channelId` permanece no `queryClient` e (d) a camada de dados
recusa pedir conteúdo de outro canal. Ele foi escrito para **refutar** a entrega — e refutou de
verdade: a primeira versão do seletor fechava o menu entre o `mousedown` e o `click`, e a troca de
canal simplesmente não acontecia. O defeito foi encontrado pelo teste e corrigido (backdrop no lugar
de listener no documento; limpeza de cache movida para o `ChannelLayout`).

**Segundo defeito, encontrado rodando o app:** `pnpm run dev` morria com
`EBUSY: resource busy or locked, watch ...tmpdir`. O watcher do Vite observava diretórios temporários
de gravação atômica (em `.rebeca/` e na raiz) e, sem listener de `error` no `FSWatcher`, o Node
encerrava o processo. Corrigido em `vite.config.ts`: `server.watch.ignored` para as pastas que não são
app, `**/*.tmpdir/**`, e um plugin `watchErrorGuard` que transforma falha de watcher em aviso.
Verificado com o servidor no ar: gravação atômica na raiz + 3 requisições seguidas → HTTP 200.
Detalhamento em `.rebeca/evidencias/README.md`.

**Não verificado (declarado, não maquiado):**

1. **Fidelidade visual pixel a pixel** aos modelos. Não há navegador automatizado nesta sessão: a
   conferência foi estrutural (tokens, classes, DOM), **não visual**. Precisa da sua olhada.
2. **A arte dos modelos** — ícones 3D e a personagem Luna não foram reproduzidos. O protótipo usa
   ícones de biblioteca em tiles com gradiente e slots rotulados ("arte pendente"). A arte é do
   `rebeca-branding`, e a **licença das ilustrações dos modelos segue `NÃO VERIFICADA`**.
3. **Acessibilidade** — rótulos e navegação por teclado foram escritos, mas **não** rodou axe-core nem
   teste em viewport 390×844. Os dois itens seguem abertos no checklist da skill `rebeca-react`.
4. **Câmbio** usado para comparar custo (US$) com receita (R$) é `CAMBIO_EXEMPLO_BRL_POR_USD = 5.4`,
   marcado no código **e na tela** como exemplo, não cotação real.
5. **Benchmark de canais do mesmo segmento** aparece em "Como funciona" como promessa de produto, não
   como função ligada: depende de quota e dos Termos da YouTube API (ver `rebeca-youtube`).

## Verificação do ciclo canônico (10 etapas)

O dono do produto declarou o ciclo como
`Pesquisar → Planejar → Criar → Revisar → Aprovar → Agendar → Publicar → Medir → Aprender → Melhorar`
e escolheu **corrigir o código e os docs** (não só registrar). O que foi encontrado e o que mudou:

| Verificação | Comando | Resultado |
|---|---|---|
| Divergência encontrada | leitura de `src/data/types.ts` | ⚠️ 9 etapas: **sem `agendar`**, com `ajustar` no lugar de `melhorar` |
| Consequência em código | leitura de `src/data/client.ts` | ⚠️ agendar gravava `stage: 'publicar'` — "agendado" era indistinguível de "no ar" |
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Testes (1ª rodada) | `pnpm exec vitest run` | ✅ **19/19 em 4 arquivos**, 26,04s — `.rebeca/evidencias/vitest-ciclo.txt` |
| Testes (2ª rodada) | idem | ✅ **19/19 em 4 arquivos**, 32,75s — `.rebeca/evidencias/vitest-ciclo-2.txt` |
| Testes (rodada final, **depois** de editar o `docs/00` que o teste lê) | `pnpm exec vitest run` | ✅ **19/19 em 4 arquivos**, 15,24s — `.rebeca/evidencias/vitest-ciclo-final.txt` |
| Build de produção (final) | `pnpm run build` | ✅ exit 0 — `.rebeca/evidencias/build-ciclo-final.txt` |
| Doc × código | `src/data/__tests__/cycle.test.ts` | ✅ o teste **lê `docs/00` do disco** e falha se a linha do ciclo divergir |

**Instabilidade da suíte — encontrada e corrigida (não maquiada).** Três rodadas seguidas falharam em
testes **diferentes**, sempre por tempo, nunca por asserção lógica:

1. rodada 1 — `revisao.test.tsx` ("Unable to find role=button …/Aprovar e agendar/i") e
   `channel-scope.test.tsx` (`Test timed out in 5000ms`);
2. rodada 2 — só `channel-scope.test.tsx` (`Test timed out in 5000ms`, 5.327ms);
3. rodada 3 — só `revisao.test.tsx` (mesma falha de `findByRole`).

Causa: **dois** limites diferentes, não um. `testTimeout` de 5s (padrão) para o teste inteiro, e
`asyncUtilTimeout` de 1s (padrão do `findBy*` do Testing Library) para cada consulta assíncrona.
Nesta máquina, renderizar uma tela com React 19 + jsdom passa de 1s com folga. Corrigidos em
`vite.config.ts` (`testTimeout: 20_000`) e `vitest.setup.ts` (`configure({ asyncUtilTimeout: 5_000 })`).
**Isso não afrouxou nenhuma asserção** — os limites continuam existindo e continuam falhando quando o
produto de fato não responde; o que saiu foi a falha aleatória. **Quatro** rodadas verdes seguidas, a
última já **depois** de editar o `docs/00` (arquivo que o teste lê), são a evidência (acima).

**Fato de fonte — agora confirmado pelo texto literal:** o PDF tem **9 seções numeradas**, não 10. A
seção 6 chama-se literalmente **"Agendar e publicar"** e trata as duas coisas num bloco só; a seção 7 é
"Medir"; a 9ª é "Melhorar automaticamente". Logo a lista de **10 verbos é refinamento do dono**, não
transcrição do PDF — e o `docs/00`, o `docs/04` e o `ADR-004` dizem isso com todas as letras. O texto
da seção 6 **é compatível** com a separação (já lista data e horário como insumos e "publica" como o
ato), mas quem decidiu separar foi o dono. Registro completo em `.rebeca/fontes/ciclo-no-pdf.md`.

**Não verificado:** nada do ciclo foi exercitado contra o YouTube real (não há integração). A
conferência da decisão de separar `Agendar` de `Publicar` contra o texto literal **já foi feita** e o
`ADR-004` se mantém.

**Achado novo que virou decisão pendente (D10):** a seção 7 do PDF ("Medir") pede RPM, horários e
temas, e a pesquisa verificada da API do YouTube (registrada mais acima nesta página) mostra que esses
três **não existem** na Analytics API — impressões/CTR de thumbnail só saem em relatório em massa. A
promessa do PDF é maior que a fonte de dados oficial. Ver D10 na tabela de decisões pendentes.

## Verificação da F0 (o que foi realmente checado)

| Verificação | Comando | Resultado |
|---|---|---|
| 18 skills válidas (frontmatter, nome kebab-case igual à pasta, tamanho, 8 seções) | `python .tools/validar_skills.py` | ✅ exit 0, 18/18 OK |
| Encoding limpo (sem mojibake) | idem | ✅ nenhum arquivo corrompido |
| 3 workflows compilam | `node .tools/validar_workflows.cjs` | ✅ exit 0 |
| Descoberta pelo harness | catálogo de skills da sessão | ✅ as 18 aparecem com o `description` do frontmatter |
| Conteúdo crítico (mecânica de delegação, RLS, orquestração lgpd-*) | leitura direta | ✅ conferido |

**Não verificado:** nenhum workflow foi executado de ponta a ponta; nenhuma skill foi exercitada
contra código real (não existe código); os fatos externos marcados `NÃO VERIFICADO` nas skills
seguem sem fonte.

**Risco residual:** as 18 skills foram escritas por 6 subagentes e validadas estruturalmente +
inspecionadas por amostragem, mas **não passaram pelo `rebeca-qa`** em revisão adversarial
completa. Pela própria regra do projeto (quem produz não aprova), isso deve acontecer antes de a
orquestra ser considerada confiável para trabalho de produção.

## Decisões pendentes de aprovação humana

| # | Decisão | Bloqueia | Dono |
|---|---|---|---|
| D1 | Stack do front (React + Vite + TypeScript?) e do backend (Supabase puro vs. serviço Node separado?) | toda a F1 | humano |
| D2 | Provedores de IA de vídeo/imagem/voz e teto de custo por vídeo (US$/min) | `rebeca-ia-video`, `rebeca-backend` | humano |
| D3 | Modelo de acesso: só o dono, ou equipe com papéis (editor/revisor)? | `rebeca-supabase` (RLS), `rebeca-produto` | humano |
| D4 | Canal piloto para o primeiro ciclo real (Luna?) e meta de publicação | `rebeca-produto`, `rebeca-analytics` | humano |
| D5 | Limite mensal de gasto em geração e o que fazer ao atingir | `rebeca-backend`, `rebeca-seguranca` | humano |
| ~~D6~~ | ✅ **decidida em 2026-09-30** (GitHub privado + Vercel, ver `ADR-003`): *onde roda* está fechado. A **publicação efetiva** ainda depende do import do dono na Vercel — as duas coisas são separadas de propósito | `rebeca-powershell`, `rebeca-github` | humano |
| D7 | **Nome do produto: "Rebeca" (pasta e PDF) ou "AI Media Studio" (protótipo da frente paralela)?** | todo o código, UI, SEO e comunicação | humano |
| D8 | Ratificar em ADR a stack já presente no `package.json` (Vite + React 19 + React Query + react-router) ou trocar | `rebeca-arquiteto`, `rebeca-react` | humano |
| D9 | A frente paralela continua em paralelo, ou passa a operar **através desta orquestra** (com `rebeca-arquiteto` → `rebeca-qa` antes de merge)? | todo o projeto | humano |
| D10 | **"Medir" (seção 7 do PDF) promete RPM, horários e temas — e a Analytics API não entrega os três.** Derivar dentro do Rebeca (RPM = receita ÷ views; horário e tema por agregação própria) ou mudar a promessa do `docs/00` §3.8? | `rebeca-youtube`, `rebeca-analytics` | humano |

## Aprovações pendentes

Nenhuma no momento.

## Bloqueios

Nenhum no momento.

## Pesquisa verificada — API oficial do YouTube (por `rebeca-youtube`)

Entregável: **`.rebeca/pesquisa/youtube-api-publicacao-spec.md`** (levantamento com citação literal,
URL e data de cada página oficial). **Nenhum código escrito, nenhuma chamada de API feita.**

Fatos que passam a valer (fonte: `developers.google.com/youtube/v3/determine_quota_cost`,
Last updated 2026-09-15 UTC; `.../guides/quota_and_compliance_audits`, 2026-09-14):

- Quota default **do projeto**: "100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units
  per day combined for all other endpoints"; `videos.insert` = **1 unidade**, em **balde próprio de
  100/dia**; reset à meia-noite **PT**.
- `videos.insert`: **256 GB** máximo; MIME `video/*` ou `application/octet-stream`; escopos
  `youtube.upload` / `youtube` / `youtubepartner` / `youtube.force-ssl`.
- `thumbnails.set`: **50 MB**, `image/jpeg`/`image/png`, custo **~50**. `playlistItems.insert`: **50**,
  e **não aceita** `youtube.upload` (exige `youtube.force-ssl`/`youtube`).
- Upload resumível: `POST /upload/youtube/v3/videos?uploadType=resumable&part=…`; chunk múltiplo de
  **256 KB**; retomada por **308 + `Range`**; backoff só em **500/502/503/504**; sessão expira (404).

**Bloqueador nº 1 do §3.6 (certo, não hipotético):** "All videos uploaded via the `videos.insert`
endpoint from unverified API projects created after 28 July 2020 will be **restricted to private
viewing mode**." Sem **auditoria do projeto** (`support.google.com/youtube/contact/yt_api_form`), o
Rebeca **não publica** — só sobe vídeo privado. Exige decisão humana (Y2).

**Bloqueador nº 2 — REPORTADO COMO INVIABILIDADE, MAS O TEXTO NÃO SUSTENTA ISSO.** A leitura
inicial registrou que o §9.1(iii) tornaria o §3.6 impossível no canal infantil. Conferido o texto
primário (`developers.google.com/youtube/terms/api-services-terms-of-service`, Last updated
2026-09-14), o parágrafo diz:

> "…(b) no YouTube API Services write-based actions (such as, but not limited to, uploading content,
> commenting and creating/sharing playlists) **taken by users** of Known Child-Directed API Client
> will be implemented on YouTube…"

Três correções: (i) o gatilho é o API Client **"targets or directs itself to children"** como
*usuárias* — não o conteúdo ser infantil; (ii) a restrição recai sobre ações **tomadas por usuários**
do client, não sobre o dono adulto operando uma ferramenta profissional; (iii) **prova de que o caso é
previsto e permitido**: o §9.1(iv) **exige** que API Clients *não* infantis ofereçam ao usuário
designar o conteúdo como "Made for Kids" **antes** do upload — o YouTube pressupõe clientes que sobem
conteúdo infantil. O Rebeca cai no (iv), não no (iii). Segue sendo **interpretação contratual** e vai
para revisão jurídica (Y1) — mas **não** como inviabilidade do produto.

**Obrigação concreta que de fato nasce do §9.1(i):** a tela em que o usuário clica "upload" deve
exibir o aviso literal de certificação ("By clicking 'upload,' you certify that the content you are
uploading complies with the YouTube Terms of Service…"), com a URL correta por tipo de dispositivo.
Isso é requisito de UI da tela de aprovação/publicação, não detalhe de implementação.

**Achados que corrigem/refutam promessas do produto:** "RPM", "horários" e "temas" **não existem** na
Analytics API; impressões/CTR de thumbnail só saem em **relatório em massa** (Reach reports = bulk),
não por `reports.query`; latência declarada de **"48 to 72 hours"** invalida a janela de **24h**; a API
**não** tem controle de Shorts (classificação só é **lida** por `creatorContentType=SHORTS`).

**Lacuna L1 FECHADA — regras de monetização de conteúdo de IA.** O corpo de
`support.google.com/youtube/answer/1311392` foi lido (via extrator de terceiro sobre a URL oficial —
reler no navegador antes de virar requisito). Detalhe em
`.rebeca/pesquisa/ypp-monetizacao-conteudo-ia.md`. Três fatos que mudam o produto: (1) conteúdo
infantil gerado por IA **é monetizável** e a política **nomeia** o caso ("using AI to visualize a
unique character and narrative you invented"); (2) o que reprova é **repetir o mesmo esqueleto de
história** — a série com personagem fixa é permitida se "each video has a distinct storyline", logo
variedade de enredo é **requisito de elegibilidade**, não qualidade editorial; (3) "deceptively
educational" cita literalmente **"colors or numbers"**, e o canal piloto ensina cores — **correção
factual do conteúdo educativo passa a ser critério de monetização**. A sanção é **suspensão do canal
no YPP**, não perda de um vídeo. Consistência de personagem (invariante 3) e clareza de
início-meio-fim ganham consequência financeira direta.

**Lacunas (`NÃO VERIFICADO`) relevantes:** `status.publishAt` (privacidade obrigatória, ISO 8601/UTC,
antecedência, comportamento no disparo), duração máxima de vídeo, resolução de thumbnail, semântica de
`defaultLanguage`/`defaultAudioLanguage`, `categoryId` de educação infantil no BR, limite de itens de
playlist, o que o YouTube faz com a declaração MFK, e **o corpo da maioria das páginas
`support.google.com`** — o fetch direto devolve só o título; a de monetização foi obtida por extrator
de terceiro e as demais (`/answer/10774223`, `/answer/6162278`, `/answer/9528076`) seguem não lidas.

## Publicação na nuvem (D6 decidida nesta sessão; publicação pendente do import do dono)

O dono pediu para publicar o protótipo na nuvem com **GitHub + Vercel**. Decisão e trade-offs em
`ADR-003-onde-roda-github-vercel.md`. O que existe agora:

| Item | Estado |
|---|---|
| Repositório | ✅ **privado** `github.com/donclaudito/rebeca`, branch `main`, commit `4c49743`, **126 arquivos** |
| `vercel.json` | ✅ build estático, rewrite de SPA para `/index.html`, headers de segurança |
| CI (`.github/workflows/ci.yml`) | ✅ varredura de segredo + tipos + testes + build no piso Node 22; **não publica e não gasta API paga** |
| `pull_request_template.md`, `dependabot.yml` | ✅ contrato de PR do projeto; Dependabot **já ativo** no repositório |
| `.gitignore` / `.gitattributes` | ✅ segredo, mídia pesada e normalização de fim de linha (Windows → build em Linux) |
| `package.json` | ✅ `engines.node: ">=22.12.0"` — piso real de `vitest@5` e `vite@8` |
| Projeto na Vercel | ⏳ **o dono faz o import em `vercel.com/new`** (opção escolhida: sem token compartilhado) |

**Evidência (snapshot congelado, máquina ociosa):**

| Verificação | Comando | Resultado |
|---|---|---|
| Testes no snapshot | `pnpm test` | ✅ **19/19 em 4 arquivos**, 17,07s, exit 0 (`testTimeout`/`asyncUtilTimeout` do ADR acima) |
| Build de produção | `pnpm build` | ✅ exit 0 — 0,64 kB html · 29,98 kB css · 424,16 kB js |
| Segredo em texto claro | `python .tools/scan_secrets.py --history` | ✅ limpo em 126 blobs (árvore **+ histórico**), sem falso positivo contra os docs do projeto (que citam `AIza`, `eyJ`, `refresh_token`) |
| Scanner provado adversarialmente | segredo falso plantado em UTF-8 **e** em UTF-16LE | ✅ achou **os dois** e mascara o valor. O `git grep -I` que estava no CI achava **só o de UTF-8**: a falha era real e foi corrigida |
| Segredo/build rastreado | `git ls-files` filtrado | ✅ nenhum `.env`, `*.pem`, `*.key`, `node_modules/`, `dist/`, `.vercel/` |
| Regras de ignore | `git check-ignore -v <caminho>` | ✅ os 11 caminhos sensíveis testados voltaram **ignorados**; app, `imagens/`, PDF e `.rebeca/` rastreados |
| Push | `git push -u origin main` | ✅ `main` rastreando `origin/main` (hash remoto = local) |
| **Node que a Vercel vai usar** | leitura de `packages/build-utils/src/fs/node-version.ts` (`vercel/vercel`) | ✅ `engines: ">=22.12.0"` resolve para **Node 24.x** (a lista é percorrida do mais novo ao mais antigo e vence o primeiro que intersecta). Node 20 tem `discontinueDate: 2026-10-01` — o piso 22 evita a versão descontinuada **sem** ajuste manual no painel |
| **CI no GitHub** | run [`36764392338`](https://github.com/donclaudito/rebeca/actions/runs/36764392338) | ✅ **success**, 8/8 steps verdes no `ubuntu-latest`: checkout, pnpm+Node 22, varredura de segredo, tipos, testes, build, artefato |

**Revisão adversarial (`rebeca-qa`) — veredito: REFUTADO. Os dois bloqueantes foram corrigidos.**
Relatório completo em `docs/qa/QA-003-publicacao-nuvem.md`.

| # | Gravidade | O que estava errado | O que ficou |
|---|---|---|---|
| A1 | **bloqueante** | o `ADR-003` afirmava que publicaríamos em `ai-media-studio.vercel.app` — sem verificar | **o domínio é de terceiro** (conferido: HTTP 200 servindo outro produto de vídeo com IA, Wan 2.2/LTX/FLUX). O ADR não afirma mais URL: ela entra só depois de observada. **Efeito de produto:** "AI Media Studio" já está ocupado como subdomínio → insumo direto para **D7** (nome do produto) |
| A2 | **bloqueante** | o CI provava o build com **pnpm 11**; a Vercel instalaria com **pnpm 10** — política dela: `PNPM_11_PREFERRED_AT = 2027-03-01` (adiado porque o pnpm 11 liga `minimumReleaseAge` de 1 dia) | `"packageManager": "pnpm@11.25.0"` no `package.json`; o workflow deixou de passar `version` e passa a ler o pin. Ressalva registrada no ADR: o pin só vale se `/pnpm11` existir na imagem; senão cai para 10 sem erro (lockfile 9.0 é aceito pelos dois) |
| A3 | não bloqueante, corrigido | `git grep -I` pulava arquivos UTF-16LE — e **este repo tem**: `.rebeca/evidencias/*.txt` são UTF-16LE no Windows; e não varria o histórico | `.tools/scan_secrets.py`: lê em bytes, decide encoding por BOM/NUL, varre árvore **e histórico** (`fetch-depth: 0`), **mascara** o valor. Antes disso, o próprio scanner novo falhou no meu teste (decodificava UTF-16LE como UTF-8 com sucesso e nunca tentava UTF-16) — corrigido e re-provado |
| A4/A5 | não bloqueante, corrigido | a linha de evidência citava o comando **sem** o `-I`, o que a tornava falsa como escrita; `sk-`+20 casava prosa (`disk-…`); o mesmo comando era checklist do PR template e nunca passaria | evidência agora cita o comando real; padrões exigem formato de credencial; `sk-` ganhou guarda `(?<![A-Za-z0-9])`; PR template aponta para o scanner |
| A7 | não bloqueante, corrigido | labels `area:infra` e `risco:dependencia` do Dependabot não existiam no repositório | labels criadas no repo |
| A9 | não bloqueante, corrigido | range do `vitest@5` citado incompleto | corrigido para `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` no CI e no ADR |

**O que o `rebeca-qa` tentou refutar e NÃO conseguiu** (também é resultado): as versões de action
(`pnpm/setup@v3`, `checkout@v7`, `upload-artifact@v7` com `runtime: node@22`); a resolução do Node
como faixa na Vercel; os tamanhos do `dist` do artefato do CI, que batem byte a byte com esta página;
o `.gitattributes` (não corrompe `.jpeg`/`.pdf` — `git check-attr` confirma `binary: set`); o
repositório privado sem PII real; e o CI que não publica nada.

**Falha de processo admitida (A6):** a revisão começou sobre o commit `bc37d53` e o `main` recebeu
`fc9ca29` durante a auditoria — escopo revisado ≠ escopo publicado. Foi obra minha (não de terceiro),
mas o correto era congelar antes de mandar revisar. É o mesmo preço do D9 já registrado abaixo.

**Achado de concorrência (importa para quem vier depois):** durante esta sessão **duas sessões de
agente escreveram na mesma pasta ao mesmo tempo**. Consequência medida: a suíte ficou intermitente —
o mesmo commit falhava em testes **diferentes** a cada rodada, sempre por tempo, com um render de
jsdom levando 4–9 s sob contenção contra **2,4 s com a máquina ociosa** (build: 7,5 s → 2,4 s).
Não era defeito do produto. O commit só foi feito depois de **3+ minutos sem gravação** e com
**19/19 verdes** medidos nesse instante. **Regra prática: antes de commitar ou publicar, confirme que
a pasta está quieta.** Isto é a decisão **D9** (as duas frentes na mesma pasta) cobrando o preço.

**Não verificado (declarado, não maquiado):**

1. **A URL de produção não existe ainda** — depende do import do dono. Logo o rewrite de SPA e os
   headers **não** foram provados com HTTP 200 em rota profunda (`/c/luna/inicio`), que é exatamente a
   prova exigida no `ADR-003`. Até esse teste, o item 4 da Decisão daquele ADR segue como premissa.
2. **Custo/limite do plano da Vercel** (`NÃO VERIFICADO`) — conferir na conta antes de assumir.
3. **Proteção de branch em `main` não foi aplicada**: exige plano pago em repositório privado
   (`NÃO VERIFICADO` quanto ao plano atual) e, com uma única pessoa no projeto, a revisão obrigatória
   do `rebeca-qa` ainda não tem um segundo aprovador humano. Fica pendente.
4. O commit `4c49743` carrega trabalho da sessão irmã (D2, ciclo canônico, telas) que **não passou por
   `rebeca-qa`** nesta sessão — o CI prova que compila, testa e builda; não prova que o produto está
   correto.

## Próximo passo sugerido

1. **Você decide D10** — a seção 7 do PDF ("Medir") promete RPM, horários e temas, e a Analytics API
   não entrega os três. Ou o Rebeca **deriva** (RPM de `receita ÷ views`; horário e tema por agregação
   própria), ou a promessa do `docs/00` §3.8 **muda**. Enquanto não decidir, "Medir" fica com escopo
   NÃO VERIFICADO no que depende desses campos.
2. **Você decide D1–D9** (a lista acima) — principalmente **D7 (nome do produto)** e **D9 (a frente
   paralela passa a operar por esta orquestra?)**, porque elas mudam o que os agentes podem tocar.
   *(A lista D1–D9 é anterior ao `ADR-003`, que já fechou D6.)*
3. `rebeca-arquiteto` ratifica a stack em `ADR-001` (D8) e define o contrato mínimo entre front e
   dados, já alinhado a `docs/03-design-system.md` e `docs/04-mapa-funcional.md`.
4. `rebeca-supabase` escreve o schema multi-canal com RLS + teste adversarial de vazamento entre
   canais (o primeiro item que dá para provar com evidência hoje).
5. Só então o primeiro caminho vertical (revisar → aprovar) via `rebeca-sprint.js`.
6. Antes de considerar a F0 confiável: rodar `rebeca-qa` sobre as 18 skills (elas foram validadas
   estruturalmente, mas nunca passaram por revisão adversarial completa).
