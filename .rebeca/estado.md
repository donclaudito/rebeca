# Estado da orquestra — Rebeca

> Arquivo de memória durável. Todo agente lê antes de agir e atualiza depois de entregar.
> Última atualização: protótipo navegável do AI Media Studio entregue, testado e rodando (ver
> "Verificação do protótipo").
> **Atualização desta sessão:** o ciclo do produto foi fixado em **10 etapas canônicas**
> (`Agendar` ≠ `Publicar`; `Melhorar` no lugar de `Ajustar`) — ver `ADR-004` e a seção "Verificação
> do ciclo canônico". A lista D1–D9 mais abaixo é anterior ao `ADR-003` e não o reflete.
>
> **Atualização da sessão seguinte — camada de LLM por função (2026-10-01):** o app deixou de ser
> inerte. Existem **15 funções de IA** ligadas às telas, cada uma com provedor/nível escolhido pelo
> servidor, prompts versionados, saída validada por schema, teto de gasto e registro de custo real.
> Ver `ADR-006-camada-de-llm-por-funcao.md` e a seção "Verificação da camada de LLM". **Nenhum token
> foi gasto** — toda a verificação rodou com provedor simulado ou transporte injetado.
>
> **Atualização desta sessão — linguagem visual do YouTube + ícone do app (2026-10-01):** o dono pediu
> "layout moderno, atualizado, seguir modelo e fontes gráficas do YouTube" e depois enviou o **ícone do
> app**. `docs/03-design-system.md` foi **reescrito** para a linguagem do YouTube (tema claro padrão +
> escuro, masthead com busca, chips, cartão de vídeo) e o ícone está no favicon e no masthead. Ver
> `ADR-009-linguagem-visual-youtube.md` e a seção "Verificação — linguagem visual do YouTube".
> **A seção "Frente paralela — resolvida" abaixo está desatualizada quanto ao `docs/03`.**
>
> **Atualização desta sessão — as duas barras laterais abrem e fecham:** pedido literal do dono
> ("as barras laterais têm que ter função de fechar/abrir, tanto da direita quanto da esquerda").
> A barra **esquerda** passou de "recolhe para 72px" a **abre/fecha de verdade** (fechada, some), com
> ☰ no masthead e **×** dentro da barra; a barra **direita** (coluna de contexto das telas de canal)
> ganhou o botão **▥** no masthead. Estado em `src/app/shell.tsx`, fechamento da direita por
> `data-rail-right` + `.ams-split` no CSS, teste próprio em `src/app/__tests__/barras-laterais.test.tsx`.
> Detalhe e trade-offs no adendo do `ADR-009`.
>
> **Atualização desta sessão — "ele gerou mas não apareceu" (2026-10-01):** o pipeline da Fase 0 havia
> gravado 13 ativos reais no disco (com `meta.json` completo) e a interface continuava dizendo que nada
> fora gerado, porque **nenhuma tela lia o disco** — `src/data/client.ts` importa o banco de exemplo e não
> faz um único `fetch`. Foi criada a ponte que faltava (`src/media/view.ts`, `server/media/library.ts`,
> as rotas `GET /api/media/episodes` e `GET /api/media/episode`, e a tela **Mídia gerada** em
> `/c/:canal/midia`). Ver a seção "Ele gerou mas não apareceu" e `.rebeca/evidencias/midia-na-tela.txt`.
>
> **Atualização desta sessão — o gerador de thumbnail (2026-10-01):** o botão "Gerar opções de thumbnail
> com a IA" chamava a camada de **LLM**, que devolve conceito em texto — **nunca gerou imagem**. O dono
> relatou *"não está produzindo, não gera"* e estava certo. Passou a existir o gerador de verdade:
> etapa `thumbnail` no pipeline, **allow-list de fornecedor por canal como dado executável**, adapter real
> **MiniMax `image-01`** (16:9 → 1280×720 nativo, US$ 0,0035/imagem) e o botão **"Gerar as 4 artes"** na
> tela de Revisão. Decisão e alternativas em **`ADR-012`**; evidência em
> `.rebeca/evidencias/gerador-de-thumbnail.txt`.
>
> **Atualização desta sessão — o portão de fornecedor chegou ao caminho de vídeo (2026-10-01):** o dono
> pediu para usar o **Gemini Omni 1.1 Flash** ("Omni 1.1") como motor de vídeo no canal infantil. O
> modelo existe e foi conferido na doc oficial — mas a **allow-list que o próprio dono aprovou o veda**
> (`google / * / * → PROIBIDO`, cláusula literal de *Age Requirements* dos Gemini API Additional Terms,
> relida na fonte). A resposta não foi só "não": a apuração encontrou que **o portão existia e protegia
> apenas a rota de thumbnail** — o caminho de vídeo, ~96% do custo de um episódio, atravessava sem
> consulta. Fechado. Ver `ADR-013` e a seção "O portão de fornecedor chegou ao caminho de vídeo".
>
> **Atualização desta sessão — o custo deixou de ser inventado e o roteiro ganhou botão (2026-10-02):**
> o dono apontou o espaço do vídeo e disse *"esta função não funciona, usa ai para gerar video"*. Estava
> certo duas vezes: não havia botão, e o rótulo **"Custo real US$ 42,80"** era o `costUsd` do arquivo de
> **exemplo** enquanto o livro somava **US$ 0,3956** — 108× de diferença. Agora existe a rota
> `GET /api/media/custos` (soma real do livro, por etapa) e a etapa **Criar** tem os botões de roteiro e
> storyboard. Ver "O custo deixou de ser inventado…". **A `criar-roteiro` não cabia no teto de 90 s** —
> ver a seção seguinte.
>
> **Atualização desta sessão — autenticação implementada (Parte 2 do `ADR-014`, 2026-10-02):** o app
> deixou de ser público. Todas as rotas de `api/**` exigem **ID token do Google** verificado no
> servidor, com lista de acesso por **`sub`** — e **nenhuma** responde quando falta configuração
> (falha fechada). O cliente entra pelo botão do Google, guarda o token **só em memória** e o envia em
> cada chamada; sem login, o portão mostra a tela de entrada no lugar das telas. O CSP e o COOP do
> `vercel.json` foram corrigidos conforme a documentação oficial (a integração **quebraria** com os
> valores antigos). Ver a seção "Autenticação das rotas de IA e mídia — Parte 2 implementada" e o
> adendo do `ADR-014`.

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
| **Camada de LLM por função** | ✅ `src/ai/` (registro + schemas + limites) e `server/ai/` (handler, catálogo, adaptadores, prompt, livro de custos) |
| **Prompts versionados** | ✅ 15 arquivos em `.rebeca/prompts/*.md` + gerador `.tools/build_prompts.mjs` com hash de origem |
| **Proxy de IA** | ✅ mesma função em `api/ai/*` (Vercel) e no middleware do Vite (dev) — chave só no servidor |
| `ADR-006-camada-de-llm-por-funcao.md` | ⚠️ **proposto** — verificado tecnicamente; aguarda aprovação humana dos itens listados e a revisão do `rebeca-qa` |
| **Configuração de IA pela interface** | ✅ `ADR-007` — tela em Configurações → Inteligência artificial: chave, endereço do provedor, teste de conexão e escolha de modelo por nível **e** por função |
| `ADR-007-configuracao-pela-interface.md` | ⚠️ **proposto** — verificado; aguarda aprovação humana (escrita desabilitada em produção) e revisão do `rebeca-qa` |
| Planilha de custo de LLM | ✅ `.rebeca/custos.csv` recebe `tokens_in`, `tokens_out`, `prompt_id` (aditivo) **na primeira chamada paga** — como nenhuma chave existe e nada foi gasto, o arquivo segue com o cabeçalho antigo, intacto |
| Repositório git | ✅ **privado** em `github.com/donclaudito/rebeca`, branch `main` — ver "Publicação na nuvem" |
| **Linguagem visual do YouTube** | ✅ `ADR-009` + `docs/03` reescrito — ver "Verificação — linguagem visual do YouTube" |
| **Ícone do app** | ✅ arte do dono: master em `imagens/icone-app-original.png`, servidos em `public/icone-{32,48,96,180}.png`, favicon e masthead |
| **Mídia gerada visível na tela** | ✅ `/c/:canal/midia` — lê o manifesto real (`.rebeca/assets/<canal>/<episódio>/meta.json`), mede o disco ativo por ativo e rotula o que é simulado. `src/media/view.ts` · `server/media/library.ts` · `server/media/http.ts` · `src/features/midia/MidiaPage.tsx` |
| **Gerador de thumbnail** | ✅ `POST /api/media/thumbnails` — 4 opções com hipóteses distintas, 1280×720, allow-list de fornecedor por canal, idempotência e custo real no livro. Adapter real MiniMax `image-01` (US$ 0,0035/imagem) + Fase 0 local. Botão **"Gerar as 4 artes"** na Revisão. Ver `ADR-012` |
| **Allow-list de fornecedor** | ✅ virou **dado executável**: `.rebeca/canais/luna/allow-list.json` (15 entradas) + `server/media/allow-list.ts`. O `ADR-005` a exigia desde 2026-10-01 e ela só existia em prosa |
| **Portão de fornecedor no caminho de VÍDEO** | ✅ `runSimulatedEpisode` consulta a allow-list **antes do ffmpeg e antes do gasto**, e mesmo com cache quente. Fechou o furo de ~96% do custo do episódio (antes só a rota de thumbnail era protegida). `ProviderIdentity` (`id`+`model`) nas 4 interfaces de mídia. Ver `ADR-013` |

## Verificação — linguagem visual do YouTube + ícone do app (2026-10-01)

Pedido do dono, literal: *"de um layout moderno, atualizado, seguir modelo e fontes gráficas do
YouTube"* e, na sequência, *"usar como ícone do app"* (com a arte anexada). Decisão e alternativas
descartadas em **`ADR-009-linguagem-visual-youtube.md`**; o contrato visual é o `docs/03` reescrito.

**O que mudou:** a identidade "painel noturno azul" (gradiente + vidro + ciano, extraída de
`imagens/modelo*.jpeg`) deu lugar à linguagem do YouTube — superfície plana, card de 8px com contorno,
ação pill, vermelho `#E1002D` no botão (4,95:1 com branco) e `#FF0000` na marca, tipografia Roboto,
**tema claro como padrão** com escuro a um clique. A casca virou **masthead de 56px com busca no
centro** + **guide de 240px↔72px** (gaveta no celular); o cartão de conteúdo virou cartão de vídeo
(16:9 + badge de duração); o filtro virou **chip**; e a busca **filtra de verdade** (`?busca=`).

**De onde vêm os valores (nada inventado):** `[YT-1]`
<https://www.sokosumi.com/tools/design-md/analysis/youtube> (extração dos tokens do youtube.com em
25/09/2026) e `[YT-2]` <https://youtube-skins.com/youtube-dark-mode> (códigos do tema escuro). Cada
token do `tokens.css` cita a origem; o que não veio de fonte está marcado `derivado` e existe para
fechar contraste AA — a tabela completa é a §11 do `docs/03`.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro (depois que a outra frente terminou de editar o arquivo dela) |
| Testes | `pnpm exec vitest run --reporter=verbose` | ✅ **106/106 em 11 arquivos**, exit 0, 46s, em janela quieta — `.rebeca/evidencias/vitest-layout-youtube.txt` |
| Build de produção | `pnpm run build` (tsc + vite) | ✅ exit 0 — html 1,58 kB · **css 35,90 kB** (gzip 7,96) · js 462,51 kB |
| Tokens no bundle | `Select-String` no `dist/assets/*.css` | ✅ `[data-theme=dark]`, `data-rail-right` (4×), `.ams-split__*` e `data-split` presentes; `color-mix` em 7 pontos; `--ams-guide-mini-w` = 0 (token órfão removido) |
| Nenhum token morto | grep `var(--ams-(glass\|grad-action\|glow-cyan\|cyan\|bg-deep\|sidebar-w)` em `src/**/*.tsx` | ✅ **0 ocorrências** |
| Nenhuma cor solta | grep `#hex` em `src/**/*.tsx` e em `components.css` | ✅ **0 ocorrências** |
| CSP × script de tema | `pnpm exec vitest run src/__tests__/headers.test.ts` | ✅ **8/8** — o hash do script inline bate com o `vercel.json` (contrato do `ADR-008`) |
| Ícones do app | inspeção de alpha nos PNG gerados | ✅ alpha mínimo = 255; 0 px quase-branco nos cantos (o master tinha ~2px de branco) |
| **Barras laterais abrem/fecham** | `pnpm exec vitest run src/app/__tests__/barras-laterais.test.tsx` | ✅ **4/4** — as duas abrem e fecham, o × interno fecha, `aria-controls` aponta para alvo existente, `data-rail-right` é publicado, a escolha sobrevive à remontagem |
| **Telas de canal não regrediram** | `pnpm exec vitest run src/features src/data/__tests__/channel-scope.test.tsx src/app/__tests__` | ✅ **15/15 em 4 arquivos** — inclui revisão (com o `ams-split` novo) e o teste de vazamento entre canais |

**Três defeitos/armadilhas encontrados e tratados (não maquiados):**

1. **Dois vermelhos, não um.** Branco sobre o `#FF0000` do botão do YouTube dá **4,00:1** e reprova em
   AA. O botão passou a usar `#E1002D` (**4,95:1**) e o `#FF0000` ficou só onde não há texto sobre ele
   (marca, barra de progresso). Registrar é o que impede alguém de "consertar" isso depois.
2. **A marca do YouTube não é a nossa.** A primeira versão do masthead desenhava um play-button
   vermelho — que é a marca do YouTube. Trocado pelo **ícone do dono**; o glifo do YouTube ficou só em
   uso nominativo (tela de Configurações). Reproduzir a marca de outro produto como logo é problema de
   marca, e o `ADR-002` já diz que a marca da interface é AI Media Studio.
3. **A arte do ícone tinha defeito de origem.** O master é **opaco**, tem só **93px de lado** e trazia
   ~2px de **branco nos cantos** (herança de captura de tela) — que apareceria como entalhe branco
   sobre superfície escura. Os PNG servidos são recortados em quadrado exato (93×93) e desenhados com
   1px de sangria: alpha mínimo 255, nenhum canto branco. **`icone-180.png` é ampliação de ~1,9×** e
   não foram gerados `192`/`512`.

**Não verificado (declarado, não maquiado):**

1. **Fidelidade visual — o item mais importante.** Não há navegador automatizado nesta sessão. A
   conferência foi **estrutural** (tokens presentes no bundle, DOM nos testes), **não visual**.
   Precisa da sua olhada em `pnpm dev`.
2. **axe-core não rodou.** O contraste foi conferido **por cálculo** (pior caso 5,1:1 no escuro), não
   com ferramenta; o alvo de 44px no celular não foi medido em viewport real.
3. **Roboto não foi auto-hospedada.** O host desta sessão não tem saída de rede (o `Invoke-WebRequest`
   e o `curl` falharam antes de baixar um byte). A pilha cai para Segoe UI/Arial — o fallback que a
   própria `[YT-1]` declara. **YouTube Sans é proprietária e não pode ser embarcada.** Pendência do
   `rebeca-branding`.
4. **Ícone instalável incompleto:** sem vetor/PNG grande não há `192`/`512`, e **não existe manifest
   de PWA** — o `rebeca-pwa` não deve publicar manifest antes da arte em resolução.

**Custo de concorrência medido de novo (D9) — agora com três sintomas concretos:**

1. A suíte **cresceu de 49 para 95 testes / 10 arquivos** ao longo das minhas rodadas, com arquivos
   novos aparecendo (`src/ai/`, `src/__tests__/headers.test.ts`) — outra sessão trabalhando ao vivo.
2. **A suíte completa deixou de ser confiável por causa do próprio tamanho, e o motivo foi medido.**
   A rodada completa reprovou `revisao > rejeitar exige motivo` com `Test timed out in 20000ms`, **sem
   falha de asserção**, e o runner reportou `~21.67s startup each` para **10 workers**: o *startup* de
   um worker (ambiente jsdom) já supera o `testTimeout` de 20s. **Não é o produto:** os 3 arquivos que
   este layout toca passam **11/11 isolados**, incluindo o teste que estourou (7,2s). O `testTimeout`
   de 20s foi calibrado com 4 arquivos; a sessão paralela a levou a 10. **Correção sugerida (não
   aplicada):** `isolate: false` — o próprio runner estima "at least ~21.67s faster". Não apliquei
   porque `vite.config.ts` é de outra frente e afrouxar limite de teste para "passar" é maquiar.
3. **Colisão de numeração de ADR por três vezes.** O `ADR-006` já era da camada de LLM; escrevi o meu
   como 006, a sessão de segurança saiu do 007 para o 008 por causa dele, e eu também caí no 008 — o
   meu ficou em **009**. O 008 (CSP) documenta a reorganização; o 009 também. **`ADR-007` ficou vazio**
   de propósito: é o número que duas sessões disputaram no mesmo minuto, e renumerar de novo apagaria
   o rastro.
4. **Achado bom da concorrência:** a sessão de segurança **recomputou o hash do meu script inline** no
   `vercel.json` (gravado 18:09, depois do meu `index.html` de 17:53) e **atualizou as referências do
   `docs/03`** de ADR-006 para ADR-007 acompanhando as minhas renomeações. Nem toda colisão é dano.

**Lição que fica:** o padrão de falha mudou de "teste aleatório estoura sob carga" para "a suíte
cresceu além do limite que ela mesma configurou". Quem for mexer em teste aqui deve primeiro
**medir o silêncio da pasta** e depois decidir; e a próxima ação real é revisar `testTimeout`/
`isolate` com a suíte parada, não continuar repetindo a rodada até sair verde.

**Nada foi commitado.** A árvore tem trabalho não commitado das duas frentes; pela própria regra do
projeto, o commit exige a pasta quieta e a passagem pelo `rebeca-qa`.

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

## Verificação da camada de LLM (15 funções, por função)

Decisão completa em `.rebeca/decisoes/ADR-006-camada-de-llm-por-funcao.md`. Ambiente: Node v26.7.0 ·
pnpm 11.25.0 · Windows.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos (agora inclui `src`, `server` e `api`) | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro |
| Suíte completa | `pnpm exec vitest run` | ✅ **106/106 em 11 arquivos**, 60,47s — `.rebeca/evidencias/vitest-ia.txt` |
| Prompts em sincronia com o disco | `node .tools/build_prompts.mjs --check` | ✅ `OK: prompts em sincronia` |
| Geração ponta a ponta por HTTP | `POST /api/ai/generate` (`medir-analise`) | ✅ 200, saída conforme o schema, com procedência e custo honestos |
| Estado do motor por HTTP | `GET /api/ai/status` | ✅ 200, 5 fornecedores com política de menores, tetos e livro |
| Pedido sem canal | `POST /api/ai/generate` sem `channelId` | ✅ HTTP 400 `canal-obrigatorio` |
| Canal inexistente | `POST` com `canal-fantasma` | ✅ HTTP 400 `canal-desconhecido` |
| Entrada fora do contrato | `POST` com entrada inválida | ✅ HTTP 400 dizendo **qual** campo faltou |
| Gate infantil | `revisar-infantil` em canal adulto | ✅ HTTP 400 |
| **Fornecedor vedado no canal infantil** | `src/ai/__tests__/handler.test.ts` | ✅ Google e DeepSeek recusados; Anthropic e OpenAI aceitos; canal adulto aceita o que o infantil recusa |
| **Teto antes do gasto** | idem | ✅ a chamada é recusada e o provedor **nunca é chamado** |
| **Modelo sem preço verificado** | idem | ✅ recusado por padrão — sem preço não há estimativa e, sem estimativa, a trava por chamada não valeria |
| **Custo real** | idem | ✅ 1M + 1M tokens no modelo barato = US$ 0,60 exatos |
| **Custo de tentativa que falhou** | idem | ✅ linha gravada com `(falhou)` e as tentativas somadas |
| **Injeção de prompt** | idem | ✅ neutralizada tanto pelo recado humano quanto pela **entrada** da função |
| **Segredo em mensagem de erro** | idem | ✅ chave plantada na exceção não aparece |
| **Teto diário com campo entre aspas no livro** | idem | ✅ leitor de CSV respeita aspas — antes lia `0` e liberava a chamada |
| **Geração paga sem livro durável** | idem | ✅ recusada (o teto diário não teria efeito em serverless) |
| **Resposta de revisão infantil contraditória** | idem | ✅ `adequado: true` + `bloqueante: true` é recusado; a tela trava a aprovação |
| **Identificador de conteúdo malicioso** | idem | ✅ vírgula, quebra de linha e 200 KB recusados |
| **Simulação sob contrato** | `src/ai/__tests__/registry.test.ts` | ✅ a saída simulada das 15 funções passa no schema da própria função |
| **Hash do prompt é calculado de verdade** | idem | ✅ sha256 recalculado no teste + teste que prova que a checagem não é decorativa |
| **Tela de IA** | `src/components/ai/__tests__/AiAction.test.tsx` | ✅ 7 casos: avisa simulação, não inventa custo, não aplica sem clique, não mostra nome de fornecedor |
| Isolamento de prompt | `src/ai/__tests__/registry.test.ts` | ✅ nenhum prompt de escopo `*` cita nome de canal |

**Revisão adversarial (`rebeca-qa`) — veredito: REFUTADO, e corrigido.** Relatório em
`docs/qa/QA-006-camada-de-llm.md`. A decisão arquitetural sobreviveu; **as garantias não**. Quatro
achados de gravidade alta, todos corrigidos e cobertos por teste:

| # | O que estava errado | O que ficou |
|---|---|---|
| QA1 | **O teto diário não existia em produção** — em serverless o livro não é durável e cada invocação nascia com gasto zero | Geração paga **recusada** onde não há livro durável; escape explícito `REBECA_ALLOW_NO_LEDGER=1` |
| QA2 | **O leitor do livro era cego ao CSV que o próprio livro escreve** (`split(',')` contra campos citados) — `contentId` com `\n` fazia ler zero e **liberar** a chamada | Parser com aspas + quebra de linha neutralizada na escrita + `contentId` limitado |
| QA3 | **Injeção não era neutralizada no bloco de dados** — só o recado humano era; a entrada ia crua | `neutralize` no payload serializado, com teste pela entrada |
| QA4 | **O gate infantil não bloqueava nada** — ninguém lia `bloqueante`, e o schema aceitava contradição | Regras do prompt viraram verificação executável e a tela **trava a aprovação** com veredito bloqueante |

Mais 9 achados de gravidade média e baixa corrigidos (custo `nao-verificado` gravando zero falso;
fornecedor e modelo aparecendo na interface comum; prompt de SEO que não nomeava campos que o schema
exige; `in` em vez de `hasOwnProperty` no validador; `estimatedCostUsd` morto; e **quatro furos nos
próprios testes** — inclusive um "teste de hash" que não calculava hash algum).

**O que o `rebeca-qa` tentou refutar e não conseguiu:** a recusa de fornecedor vedado no canal
infantil; o gate de preço impedir o POST antes de gastar; o registro de custo de tentativa que falhou;
a redação de segredo em erro; a migração aditiva do cabeçalho do livro.

**Lacuna que a revisão deixou aberta e que importa:** o veredito do gate infantil vive no **estado da
tela**, então recarregar a página destrava a aprovação. Persistir o veredito no conteúdo (e fazer
`approve` consultá-lo) é trabalho da camada de dados — registrado como próximo passo, não como feito.

**Defeitos reais que a própria verificação encontrou e que foram corrigidos** (registro honesto —
nenhum destes estava visível a olho nu):

1. **Os guardrails não chegavam ao modelo.** O gerador de prompt extraía só "Sistema" e "Instrução" e
   **descartava "Guardrails" em silêncio** — a defesa contra injeção, o "não aprove nem publique" e o
   "não invente número" não eram enviados. Pegou no teste de contrato.
2. **Prompt de escopo global citava um canal** (`identidade-personagem@v1.md` dizia "a Luna parece a
   Luna") — defeito de isolamento, invariante nº 2. Pegou no teste de vazamento entre canais.
3. **Override de modelo engolido em silêncio** — a checagem de `REBECA_MODEL_*` usava um mapa que não
   continha Anthropic nem Google.
4. **Erro inesperado não era higienizado** — exceção de rede podia atravessar com a chave dentro.
5. **Preço da DeepSeek invertido** — o catálogo começou com o preço de pico; a doc publica o **dobro**
   em pico, sendo o valor menor o de fora de pico. Subestimar custo furaria o teto diário.
6. **Campo de tokens do Google renomeado** — a doc atual usa `responseTokenCount`; ler só o nome antigo
   faria o custo virar "não verificado".

**Não verificado / não coberto (declarado, não maquiado):**

1. **Nenhuma chamada real a provedor foi feita. Nenhum token foi gasto, nenhuma chave existe no
   ambiente.** Os adaptadores HTTP reais não foram exercitados contra os endpoints de verdade — os
   fatos de endpoint, header e nome de campo vêm da documentação oficial lida em 2026-09-30.
2. **A função serverless da Vercel não foi executada.** O caminho `api/ai/*` foi verificado por tipos e
   compartilha a mesma função do middleware de dev (exercitada por HTTP), mas o runtime da Vercel não
   foi testado com deploy.
3. **Restrição de ambiente encontrada:** `vitest` neste workspace só roda **fora do sandbox
   confinado** — o carregador de config do Vite faz detecção de unidade de rede no Windows (`net use`)
   e o sandbox bloqueia o `spawn` com `EPERM`. Reproduzido também com o `vite.config.ts` original,
   logo **não** é defeito desta entrega, mas é atrito real.
4. **Dois escritores na mesma pasta.** Enquanto esta camada era construída, outra sessão acrescentou o
   registro de aprovação (`ApprovalRecord`, `ContentSeed`, `isApprovalValid`) e refatorou classes de
   estilo em `RevisaoPage`. Nada foi perdido — as mudanças foram aditivas e `tsc` + suíte fecham
   verdes com as duas —, mas **é a decisão D9 cobrando o preço outra vez**. Antes de commitar: conferir
   que a pasta está quieta.
5. **Sem teste de render para o painel de Configurações** — verificação de tipos apenas. O `AiAction`
   tem 7 testes de tela (`src/components/ai/__tests__/AiAction.test.tsx`), incluindo o que prova que a
   tela **avisa** quando a resposta é simulação, que **não** aplica nada sem clique humano e que
   **não** mostra nome de fornecedor.
6. **O veredito do gate infantil não sobrevive a recarregar a página** (vive no estado da tela).
7. **5 das 15 funções não têm ponto de entrada na interface** (`criar-roteiro`, `criar-cena`,
   `criar-thumbnail`, `aprender-insight`, `marketing-derivados`): implementadas, testadas e chamáveis
   pela API, mas sem botão em tela.
8. **`rebeca-qa` pediu reauditoria sobre alvo congelado** — durante a auditoria, arquivos deste
   trabalho foram gravados e três defeitos fecharam antes ele redigir. Pedido justo e registrado.

**Próximo passo imediato desta frente:**

1. **Você decide D11** (qual fornecedor pode atender o canal infantil), com leitura jurídica do §3.4(8)
   da DeepSeek. Enquanto isso, o default é conservador e está testado.
2. **`rebeca-qa` revisa `ADR-006`** — quem produz não aprova. Relatório em `docs/qa/QA-006-*.md`.
3. **Você cola a chave na tela** (Configurações → Inteligência artificial), clica em **testar conexão**
   e faz **uma** geração real de cada nível, para exercitar os adaptadores HTTP que hoje só foram
   verificados na documentação. É o teste que falta — e agora dá para fazer tudo pelo app.
4. Confirmar a mudança aditiva do cabeçalho de `.rebeca/custos.csv` (três colunas novas no fim).

## Verificação — configuração de IA pela interface (ADR-007, 2026-10-01)

Decisão completa em `.rebeca/decisoes/ADR-007-configuracao-pela-interface.md`. O que a tela resolve:
colar a chave, trocar o endereço do provedor, testar a conexão e **diferenciar o modelo de cada
função** — sem editar `.env` e reiniciar o servidor.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Testes da configuração | `pnpm exec vitest run src/ai/__tests__/settings.test.ts` | ✅ **27/27** |
| Suíte completa | `pnpm exec vitest run` | ✅ **133/133 em 12 arquivos** — `.rebeca/evidencias/vitest-ia.txt` |
| **Determinismo da suíte** | `pnpm exec vitest run`, duas rodadas seguidas | ✅ 133/133 nas duas, 57 s cada |
| Build de produção | `pnpm run build` | ✅ exit 0 |
| Leitura da configuração (HTTP real) | `GET /api/ai/settings` | ✅ 5 provedores, 4 níveis, 15 funções, 15 opções de catálogo |
| **A chave volta ao navegador?** | varredura da resposta HTTP pelo valor | ✅ **não aparece**; só `••••7890` e a origem (`configuracao`) |
| **SSRF — metadados de nuvem** | `PUT` com `169.254.169.254` | ✅ HTTP 400 recusado |
| **SSRF — credencial na URL** | `PUT` com `https://user:senha@…` | ✅ HTTP 400 recusado |
| Chave implausível | `PUT` com chave de 3 caracteres | ✅ HTTP 400 recusado |
| Endereço local em modo local | `PUT` com `http://127.0.0.1:5199/mock` | ✅ aceito (modelo local é caso legítimo) |
| Diferenciar por função | `PUT` com `functionModels.criar-roteiro` | ✅ a função passa a resolver aquele modelo, com origem `funcao` |
| O endereço configurado é usado | `POST /api/ai/test` apontando para caminho inexistente | ✅ o servidor chamou o endereço configurado e tratou a falha |
| Arquivo ignorado pelo git | `git check-ignore -v .rebeca/segredos/llm.json` | ✅ casado; nada aparece em `git status` |
| Chave de teste removida do disco | inspeção após a verificação | ✅ arquivo removido; nenhuma chave real existe no ambiente |

**Dois defeitos reais que só o teste ponta a ponta com o servidor no ar pegou** (nenhum teste unitário
pegava):

1. **A chave salva na tela era ignorada na escolha do modelo padrão** — a checagem de "existe chave?"
   consultava só a variável de ambiente. Efeito: o usuário colava a chave, salvava, e o app continuava
   em simulação sem explicar por quê. É exatamente o "não funciona" que esta entrega existe para
   resolver. Corrigido em `providerHasKey`, com teste de regressão.
2. **`PUT /api/ai/settings` chegava vazio no servidor de desenvolvimento** — o middleware do Vite lia o
   corpo só em `POST`. O erro aparecia como "formato inesperado", ou seja, defeito de encanamento
   disfarçado de defeito de validação.

**Instabilidade da suíte — causa encontrada e corrigida (não maquiada).** A suíte falhava em arquivos
**diferentes** a cada rodada, sempre por tempo, e cada arquivo passava isolado em menos de 7 s. Causa:
esta máquina tem **6 processadores lógicos** e a suíte tem **12 arquivos** de teste; sem teto, o pool
sobrecarregava a máquina ~2× e o render de jsdom + React 19 estourava o limite. Corrigido com
`maxWorkers: 4` em `vite.config.ts`. **Duas rodadas verdes seguidas**, e a suíte ficou **mais rápida**
(57 s contra 72 s). Um limite de tempo maior teria escondido o problema em vez de resolvê-lo.

**Não verificado (declarado):** nenhuma chamada real a provedor com credencial **válida** (a mecânica
do teste de conexão está provada; o sucesso contra um provedor de verdade depende de uma chave que não
existe aqui); a recusa de escrita em ambiente publicado foi testada por variável, não em deploy real; a
heurística `VERCEL` não reconhece outro host publicado; não há teste de render do painel; e a revisão
adversarial do `rebeca-qa` sobre o `ADR-007` não foi executada.

## Verificação com chave paga real (2026-10-01) — o app gerou conteúdo de verdade

O dono do produto entregou uma **chave paga da OpenAI**, cadastrada pela tela de Configurações. Foi o
**primeiro gasto real** do projeto e respondeu às duas perguntas que estavam abertas: os adaptadores
HTTP funcionam, e a conta de custo está certa.

A chave foi instalada por `.tools/instalar-chave-ia.mjs`, que grava direto em
`.rebeca/segredos/llm.json` (ignorado pelo git) e imprime **apenas a máscara** — o valor não passou por
contexto de agente nem por log de terminal.

| Verificação | Resultado observado |
|---|---|
| Modelos que a conta enxerga | ✅ `GET /v1/models` → **HTTP 200, 133 modelos** |
| Os IDs do catálogo existem | ✅ `gpt-6.1-sol`, `gpt-6-luna`, `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-5.4-nano`, `gpt-5-nano` — **todos presentes** |
| Teste de conexão real | ✅ `ok=true`, `gpt-6-luna`, 4.326 ms, **custo real US$ 0,0000048** |
| **Geração real com schema** | ✅ `criar-seo` no canal infantil: 929 tokens de entrada, 269 de saída, **1 tentativa**, 3.651 ms, `simulated=false` |
| **A conta do custo confere** | ✅ `929 × 0,10/1M + 269 × 0,50/1M = US$ 0,0002274` — exatamente o valor registrado |
| Livro de custos | ✅ duas linhas reais com `tokens_in`, `tokens_out` e `prompt_id`; cabeçalho migrado de forma aditiva |
| Conteúdo gerado | ✅ título, descrição com gancho de duas linhas, tags e hashtags em pt-BR, `capitulos` como lista vazia (comportamento correto) |

**Gasto total da verificação: menos de US$ 0,001.** Teto diário intacto.

**Defeito de integração que só a API real revelou:** o modo `strict` da OpenAI exige que **toda**
propriedade esteja em `required` — a requisição era recusada com HTTP 400 (`Missing 'hashtags'`).
Vários schemas declaravam campos opcionais. Nenhum teste com provedor simulado pegava, porque o
simulado preenchia tudo. **Corrigido na raiz:** `obj()` passou a derivar `required` das propriedades, e
o segundo argumento deixou de existir. Efeito colateral bom: "campo sem valor" agora é **valor vazio**
(lista vazia), nunca ausência de chave.

**Falha de isolamento nos testes — encontrada e corrigida.** O `handler.test.ts` isolava o livro de
custos mas **não** a configuração de IA: com uma chave real cadastrada na máquina, o teste "sem chave
nenhuma, responde por simulação" passou a falhar. Pior: um teste futuro poderia ter disparado uma
**chamada paga de verdade**. Todo teste agora redireciona `REBECA_SETTINGS_FILE` para temporário.
**Teste não pode depender de credencial real nem gastar dinheiro de ninguém.**

**Continua não verificado:** os outros quatro provedores (só a OpenAI foi exercitada de verdade) e a
função serverless em deploy real.

## Correção — "testei e não funcionou, e não aparecem os modelos" (2026-10-01)

Relato do dono do produto ao usar a tela de Configurações. **Cinco defeitos reais**, todos no
front-end — o servidor estava correto o tempo todo (os endpoints responderam em todos os testes).

| # | Gravidade | O que estava errado | Efeito para o usuário | O que ficou |
|---|---|---|---|---|
| 1 | **bloqueante** | O painel verificava **carregamento antes de erro**, e o rascunho do formulário só nasce quando a resposta chega. Requisição que falhava deixava o rascunho nulo **para sempre** | Tela presa num esqueleto de carregamento **infinito**: nenhum modelo, botão de teste inerte, nenhuma mensagem. É exatamente o que foi relatado | Erro primeiro, carregamento depois |
| 2 | **alta** | O painel **descartava a mensagem de erro do servidor** e mostrava uma frase genérica | Mesmo quando a tela mostrava erro, não dizia o que fazer nem como diagnosticar | A mensagem exibida passa a ser a do servidor, com o que fazer |
| 3 | média | Resposta `200` com HTML (fallback de SPA, quando o servidor de desenvolvimento é anterior às rotas de IA) virava `null` sem erro | Falha silenciosa: a tela caía no estado genérico sem pista | O cliente detecta resposta sem JSON e explica: *"o servidor está rodando uma versão anterior — pare e rode `pnpm dev` de novo"* |
| 4 | média | O mapa de endereços padrão cobria só 3 dos 5 provedores (`PROVIDERS`) | Os campos de endereço de **Anthropic e Google apareciam vazios**, sem nem o padrão no placeholder | Fonte única `DEFAULT_BASE_URL` com os cinco; o campo sempre mostra o oficial |
| 5 | baixa | Resposta de gravação em forma inesperada derrubava o manipulador com `TypeError` dentro do React Query | "Salvar" não dizia nem sucesso nem falha | Guarda contra forma inesperada; resposta estranha vira mensagem |

**A causa provável do relato foi o defeito nº 1**, disparado pelo nº 3: o servidor de desenvolvimento
de quem testou havia sido iniciado **antes** de as rotas de IA existirem, então `/api/ai/settings` não
era atendido pelo middleware e caía no fallback de SPA — devolvendo HTML com status 200. O painel,
então, ficava carregando para sempre.

**O que fazer quando isso acontecer:** pare o servidor, rode `pnpm dev` de novo (as rotas são
registradas na inicialização) e recarregue a página com Ctrl+Shift+R.

**Teste que faltava, agora existente:** `src/features/configuracoes/__tests__/AiSettingsPanel.test.tsx`
— **7 casos**, incluindo "os modelos aparecem nos seletores" e a regressão do carregamento infinito.
Foi este teste que localizou o defeito nº 1: sem ele, a causa ficaria em conjectura.

| Verificação | Resultado |
|---|---|
| Tipos | ✅ `pnpm exec tsc --noEmit` exit 0 |
| Testes do painel | ✅ **7/7** |
| Suíte completa | ✅ **140/140 em 13 arquivos** — `.rebeca/evidencias/vitest-ia.txt` |
| Build de produção | ✅ exit 0 |
| `GET /api/ai/settings` ao vivo | ✅ **15 modelos** no catálogo; endereço padrão preenchido nos **5** provedores |
| `POST /api/ai/test` ao vivo | ✅ `ok=true`, `gpt-6-luna`, 3.261 ms, custo real US$ 0,0000048 |
| Geração real ao vivo | ✅ `provider=openai`, `simulated=false`, 1 tentativa, US$ 0,0002536 |

**Nota de método:** a suíte falhou uma vez em `revisao.test.tsx` **porque eu estava com um servidor de
desenvolvimento rodando ao mesmo tempo**, disputando CPU — 168 s de suíte contra 105 s sem ele. A
suíte limpa passa 140/140. O teto de `maxWorkers: 4` reduz a sensibilidade, mas não elimina a
influência de outro processo pesado na mesma máquina.

## Correção — HTTP 500 das funções serverless em produção (2026-10-01)

**Sintoma medido hoje, não herdado:** `GET /api/ai/status` e `GET /api/ai/generate` devolviam **HTTP 500**
com `x-vercel-error: FUNCTION_INVOCATION_FAILED`, enquanto `/api/inexistente` devolvia **200 com HTML**.
O terceiro dado é o que separa as hipóteses: o rewrite de SPA **não** atropela `/api/*` (o filesystem tem
precedência), a função é alcançada e é ela que quebra. E como `GET /api/ai/generate` — rota que só
devolveria 405, sem corpo, sem disco e sem gasto — falhava igual, a falha estava no **carregamento do
módulo**, não dentro do manipulador.

**Causa-raiz (fonte primária — código do builder, não blog):** o `@vercel/node` **não faz bundle**. Ele
traça o grafo com `@vercel/nft` e transpila **cada `.ts` individualmente**, renomeando para `.js` e
preservando os specifiers de import (`vercel/vercel` `packages/node/src/build.ts`, `renameTStoJS`). Como o
`package.json` tem `"type": "module"`, esse passe **deixa de converter ESM→CJS** (`if (pkg.type === 'module'
&& path.endsWith('.js')) continue`), então vale a regra do loader ESM do Node: **import relativo exige
extensão**. `'../../server/ai/http'` ia literal para `api/ai/status.js` → `ERR_MODULE_NOT_FOUND` no cold
start → 500. O tracer não perde os arquivos: o `@vercel/nft` tem retry `.js` → `.ts`
(`node-file-trace.js`, linhas 208-209 do pacote instalado).

**Correção:** 35 specifiers relativos passaram a ter `.js` — `api/ai/*.ts` (4), `server/ai/*.ts` (8) e
`src/ai/contract.ts` (1), incluindo os **4 `import()` dinâmicos** de `./providers-extra` em `handler.ts`,
que também exigem extensão em ESM. **Nenhuma linha de lógica mudou**; o diff é só de specifiers.

| Verificação | Comando | Resultado |
|---|---|---|
| Reprodução do defeito (JS compilado, imports sem extensão) | `tsc` + `node` invocando o handler | ❌ `ERR_MODULE_NOT_FOUND: Cannot find module '…\server\ai\http' imported from '…\api\ai\status.js'` |
| Prova da correção (mesmo JS, imports com `.js`) | idem | ✅ `STATUS 200` com o JSON de status |
| Primeira reprodução, direta | `node api/ai/status.ts` | ❌ `ERR_MODULE_NOT_FOUND` (mesma regra de ESM) |
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Suíte completa | `pnpm exec vitest run` | ✅ **140/140 em 13 arquivos**, exit 0, 82,51 s — `.rebeca/evidencias/vitest-imports-esm.txt` |
| Build de produção | `pnpm run build` | ✅ exit 0 |
| **Cold start em condição de produção** | JS compilado com `VERCEL=1`, sem chave, sem estado, cwd fora do projeto | ✅ `GET /api/ai/status` **200** · `GET /api/ai/settings` **200** (`writable:false`, `hosted:true`) · `PUT /api/ai/settings` **403** (recusa, não 500) · **nenhuma escrita em disco** |
| Vite resolve `.js` → `.ts` (dev/testes) | leitura de `vite/dist/node/chunks/node.js:29087-29092` | ✅ `isPossibleTsOutput` + `tryResolveRealFile(fileName + '.ts')` |
| Gerador de prompt não reintroduz o defeito | gerado sem `import` (conferido no `.tools/build_prompts.mjs`) | ✅ `prompts.generated.ts` não emite import algum |

**Evidência completa:** `.rebeca/evidencias/vercel-500-imports-esm.txt` (sintoma, fonte, reprodução
antes/depois, cold start e o que segue não verificado).

**Duas armadilhas encontradas no caminho, registradas para quem vier depois:**

1. **Meu próprio experimento poluiu a árvore.** Emitir `tsc` com a configuração **dentro** do repositório
   deixou **74 arquivos `.js`** ao lado dos `.ts` em `api/`, `server/` e `src/` (não rastreados). Se
   alguém tivesse rodado `git add -A`, o deploy levaria **JS obsoleto duplicando as funções** — o
   `api/ai/status.js` solto ao lado do `status.ts` é conflito de rota esperando para acontecer. Removidos;
   a lição é emitir com a configuração e o `outDir` **fora** do repositório, ou conferir
   `git status --porcelain api server src` logo depois.
2. **O nft isolado não parseia TypeScript** (`Unexpected token` em `import type`) — na Vercel quem
   entrega o JS já compilado para o tracer é o passo de TypeScript do builder. Um harness que chame
   `@vercel/nft` direto sobre `.ts` **não reproduz** o pipeline e dá falso negativo.

**Verificado em produção (mesma sessão, depois do push):**

| Verificação | Comando | Resultado |
|---|---|---|
| O 500 acabou | `node -e "fetch('https://rebeca-odda.vercel.app/api/ai/status')"` | ✅ **HTTP 200**, `x-vercel-error: null`, corpo `{"ready":true,"hasAnyKey":false,"simulated":true,…}` |
| Configuração de IA responde | idem para `/api/ai/settings` | ✅ **HTTP 200**, `{"writable":false,"hosted":true,"configPath":null,…}` |
| Commit publicado | `git push origin main` | ✅ `e12e11a..2c9a717 main -> main` |

`hasAnyKey:false` em produção é o correto: a chave vive só na máquina local (`.rebeca/segredos/llm.json`,
não rastreado), então o app publicado roda em **simulação** — e diz isso na tela.

**Revisão adversarial (`rebeca-qa`) — veredito: NÃO CONSEGUI REFUTAR; aprovado para produção.** Ele
reproduziu o defeito de forma mínima e independente, refez a varredura por conta própria (BFS a partir dos
4 entrypoints: **19 arquivos, 35 specifiers, 0 sem extensão, 0 apontando para arquivo inexistente**),
conferiu que o gerador de prompt não reintroduz o defeito, que **nenhum** efeito de módulo toca disco no
topo do arquivo, e que `routeAiRequest` envolve tudo em try/catch — o que **corrobora** o diagnóstico:
como não há erro de runtime possível nos dois GETs, o throw só podia ser no carregamento.

**Achado do QA que virou trabalho (gravidade média, agora fechado):** nada impedia a reintrodução do
defeito. `pnpm build` e a suíte passavam com specifier sem extensão, porque `moduleResolution: "bundler"`
e o Vite aceitam os dois formatos — o defeito voltaria em silêncio e só apareceria no ar. Criado
`src/__tests__/serverless-imports.test.ts`: percorre o grafo real a partir dos 4 entrypoints, segue todo
import relativo (inclusive `import type` e `import()` dinâmico) e exige extensão `.js` + arquivo existente.
**Provado adversarialmente**: com um specifier quebrado de propósito (`server/ai/http.ts` → `'./handler'`),
o teste falha apontando `server/ai/http.ts:19 → './handler'`; restaurado, passa. Suíte: **144/144 em 14
arquivos** (era 140/13) — `.rebeca/evidencias/vitest-guarda-imports.txt`.

**Achado do QA que fica registrado, sem mudança (gravidade baixa):** `src/ai/client.ts` e `src/ai/hooks.ts`
seguem com import sem extensão — são do navegador, o Vite resolve, e **nenhum** arquivo de `api/`/`server/`
os alcança hoje. Não causam 500. A guarda nova cobre o risco futuro: se algum dia um deles entrar no grafo
do servidor, o teste falha na hora.

**Não verificado (declarado, não maquiado):**

1. ~~O runtime da Vercel não foi executado~~ — **executado e verificado nesta sessão** (HTTP 200 nas duas
   rotas, ver a tabela acima). O que o navegador do dono ainda vai mostrar é o app publicado em
   **simulação**, porque não há chave configurada no servidor — comportamento correto e visível na tela.
2. **O log de runtime da Vercel** (stack trace do 500 antigo) não foi lido: não há credencial nesta
   sessão. A conclusão veio do código do builder, da reprodução local e do sintoma — e o fato de o 500
   ter desaparecido exatamente com a correção que a hipótese previa é confirmação empírica.
3. **Um segundo erro, ainda aberto e de outra natureza:** o dono relatou **504 em
   `POST /api/ai/generate`** com o dev server em `localhost:5173`. O Vite **não tem timeout de
   requisição** (os únicos 504 dele são de otimizador de dependências, e só para requisições de módulo
   JS — que não é o caso de `/api/ai/*`), então a origem do 504 **não foi identificada** e o dev server
   já estava fora do ar quando fui olhar. Fica como defeito aberto, com o livro de custos mostrando que
   **as duas gerações foram concluídas no servidor** (e pagas) enquanto o navegador via 504 — ou seja, o
   dinheiro foi gasto e o resultado não chegou à tela.

## Correção — "esta parte parece sem função": o conteúdo aberto (2026-10-01)

Relato do dono ao olhar um cartão da biblioteca (`Luna ensina as cores do arco-íris`, agendado,
thumbnail "Arco-íris inteiro / arte pendente", custo US$ 9,10).

**O defeito era um contrato de um lado só.** Biblioteca, calendário e início montavam o link
`/c/:canal/conteudo?aberto=<id>`; a tela de destino lia `filtro` e `busca` e **nunca** o `aberto`.
Clicar no cartão navegava para uma página que parece a mesma e não abria nada — e, dentro da própria
biblioteca, o cartão apontava para a rota em que o usuário já estava. Do lado de quem usa, o cartão
não tinha função nenhuma. O parâmetro aparecia em **três produtores e zero consumidores**.

**O que ficou:** a tela de Conteúdo cumpre o contrato.

- Painel de leitura do conteúdo aberto (`src/components/content/ContentDetail.tsx`): thumbnail
  escolhida, estado, formato, tema, agendamento, **custo real**, SEO preparado, opções de thumbnail
  (marcando a escolhida e as sugeridas pela IA), aprovação vigente e o motivo da última rejeição.
- **Não decide nada.** Aprovar, gerar nova versão e substituir continuam na tela de Revisão — há um
  atalho para lá. O portão humano segue num lugar só (invariante nº 1).
- O cartão do conteúdo aberto fica marcado (`aria-current` + anel de acento), então o clique tem
  resposta visível mesmo quando o painel está fora da área visível da grade.
- **Nenhum dado inventado:** sem métrica aparece sem métrica, custo zerado aparece como "custo não
  lançado", e a aprovação é mostrada como **fato** (data), não como nome de quem aprovou — isso
  depende da D3.
- **Isolamento entre canais (invariante nº 2):** a busca pelo `id` acontece sempre dentro da lista do
  canal; um `id` de outro canal não casa e a tela diz "não está neste canal" — há teste próprio para
  isso, porque "abrir por id" é exatamente onde um vazamento entre canais nasceria.
- "Não encontrado" só aparece **depois** dos dados chegarem: antes disso seria mentira — o mesmo
  defeito de ordem carregamento/erro que já apareceu nesta tela uma vez.

| Verificação | Comando | Resultado |
|---|---|---|
| Testes do conteúdo aberto | `pnpm exec vitest run src/features/conteudo` | ✅ **5/5** — abre, marca o cartão, recusa id de outro canal, fecha, e o cartão aponta com o parâmetro |
| **Prova adversarial** | devolver `aberto` ao estado ignorado | ✅ **3 dos 5 ficam vermelhos** ("Conteúdo aberto" não é encontrado); restaurado |
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Suíte completa | `pnpm exec vitest run` | ✅ **155/155 em 15 arquivos** — `.rebeca/evidencias/vitest-conteudo-aberto.txt` |
| Build de produção | `pnpm run build` | ✅ exit 0 |
| Vazamento entre canais (regressão) | suíte | ✅ `src/data/__tests__/channel-scope.test.tsx` continua verde |

**Não verificado:** a conferência **visual** do painel (não há navegador automatizado nesta sessão);
o `docs/04-mapa-funcional.md` não descrevia o `?aberto=` — o contrato foi lido do código, não do
mapa funcional, e vale acrescentá-lo lá quando o mapa for revisado.

## Pipeline de mídia — D2 e D5 aprovadas, Fase 0 em construção (2026-10-01)

Pergunta do dono ao ver o "Player · 6:42" na tela de Revisão: *"não aparece nada, está funcionando?"*.
Resposta honesta: **não** — não existe um único arquivo de vídeo no repositório. O slot é um `ArtSlot`
(`RevisaoPage.tsx:225`), espaço reservado cuja duração vem do dado de exemplo, e `docs/03:256` já
declarava que "o produto **não** produz arte". A metade de **texto** da etapa Criar existe (15 prompts);
a metade de **mídia** não existia — nem decisão, nem código.

**Duas decisões do dono, tomadas nesta sessão:**

| # | Decisão | Valor aprovado |
|---|---|---|
| ~~D2~~ | Provedores + teto por vídeo | **Stack A** (MiniMax-H3 768P + FLUX.2 klein + Azure S1 Neural + Suno Pro) · **US$ 12,00/min** — `ADR-005` passou a **aceito** |
| ~~D5~~ | Limite mensal de gasto | **US$ 60,00/mês** (≈ 1 episódio de 7 min): *"validar qualidade antes de escalar"* |

Ordem de grandeza dita sem enfeite: um episódio de 7 min na Stack A custa ≈ **US$ 60**, e vídeo é ~96%
do custo (a voz do episódio inteiro custa centavos). O teto de US$ 12/min é o **limite que para o
pipeline**, não o preço esperado. Os dois números vivem **em código** (`src/media/limits.ts`), no mesmo
padrão da D12: mudar teto exige revisão, não variável de ambiente.

**`ADR-010` (proposto)** decide o que faltava — *como a máquina é construída*, não *qual fornecedor*:
duas fases (F0 simulada com custo zero / F1 provedor real), quatro interfaces de provedor com o mesmo
contrato de retorno, **timeline como fonte da verdade** (a duração da fala medida manda na cena e na
legenda), nome determinístico por hash, idempotência **antes** de gastar, Short como recorte do mesmo
material, e custo por minuto medido com `ffprobe` — nunca com `tempo_min`.

**Fase 0 em implementação:** provedores simulados gerando arquivos **de verdade** com o ffmpeg desta
máquina (8.1.2, confirmado no PATH), render 1920×1080 → Short 1080×1920, legenda, manifesto com hash e
a prova de rodar duas vezes sem linha nova de custo. A evidência entra aqui e no `ADR-010` quando
fechar. **Nada foi gasto.**

**O que a aprovação NÃO resolve** — e agora é o caminho crítico da Fase 1:

1. **O Character Sheet da Luna não existe.** Não há arte de personagem no repositório inteiro
   (`rebeca-branding`). Sem ele, cena real de personagem não começa: o invariante nº 3 (a Luna parecer
   a mesma em todo episódio) é requisito funcional e, pelo `ADR-005`, também elegibilidade de
   monetização.
2. **D1 — onde roda o job longo.** Gerar vídeo dentro de request HTTP é proibido por desenho (é o mesmo
   defeito que produziu o 504 que o dono viu no dev server). Falta decidir fila/worker.
3. As **questões de advogado** listadas no `ADR-005` continuam abertas e são condição de operação, não
   detalhe.

## Revisão — a tela mentia, e a thumbnail não tinha como ser gerada (2026-10-01)

Dois relatos do dono na mesma tela, dois defeitos reais (commits `fbd840b` e `818c393`).

**1. "não parece que funciona".** O cartão "O que a IA fez aqui" listava, com **checkmarks verdes**,
*"Roteiro, cenas, narração e montagem prontos"* e *"N opções de thumbnail geradas"*. **Nada disso
existia:** zero arquivos de vídeo no repositório, nenhuma narração, e a arte das thumbnails é
placeholder (`docs/03:256` já dizia que o produto não produz arte). O subtítulo ainda mandava
**"Assista"**. Corrigido: o subtítulo não promete player; o espaço do vídeo diz *"Prévia do vídeo ·
6:42 planejados / nenhum vídeo foi gerado ainda"*; e o cartão virou **"O que existe neste conteúdo"** —
o que existe (SEO), o que falta (arte, vídeo, narração) e sobre o que a decisão vale. O `ArtSlot`
ganhou um parâmetro `note`, porque "arte pendente" é verdade para arte e **mentira para vídeo**.

**2. "não dá opção de gerar".** A função de IA `criar-thumbnail` estava registrada no contrato desde a
camada de LLM e **nenhuma tela a chamava** — era uma das 5 lacunas já registradas. Agora existe o
botão: a IA propõe 3–4 conceitos (rótulo, o que a arte deve mostrar, texto na arte) usando o contexto
de marca do canal (personagem oficial + paleta; o estilo vai composto do que o Brand Kit tem, sem
inventar). Aplicar passa por `api.proposeThumbnails`, que substitui as opções, **limpa a escolha
anterior** e **derruba a aprovação** de conteúdo já aprovado — mesmo caminho de `selectThumbnail` e
`saveTitle`. **O que a IA devolve é conceito, não imagem**: a arte continua pendente, e a tela diz isso.

| Verificação | Comando | Resultado |
|---|---|---|
| Testes da tela de Revisão | `pnpm exec vitest run src/features/revisao` | ✅ **7** (eram 4): honestidade, player, e o fluxo pedir → aplicar |
| Testes da gravação | `src/data/__tests__/propor-thumbnails.test.ts` | ✅ **5/5** — substitui, limpa escolha, derruba aprovação, recusa outro canal, recusa lista vazia |
| **Prova adversarial (honestidade)** | repor *"Roteiro, cenas, narração e montagem prontos"* | ✅ teste fica **vermelho** e aponta o texto; restaurado |
| **Prova adversarial (player)** | repor o rótulo antigo do slot | ✅ teste fica **vermelho**; restaurado |
| Suíte completa | `pnpm exec vitest run` | ✅ **210/210 em 22 arquivos** — `.rebeca/evidencias/vitest-thumbnail-e-fase0.txt` |
| Build de produção | `pnpm run build` | ✅ exit 0 |

**Lição registrada:** ao restaurar uma mutação de teste, meu próprio script corrigiu a **ocorrência
errada** (o comentário em vez da linha renderizada) e a frase falsa voltou para a tela. **O teste que
eu tinha acabado de escrever pegou** — ficou vermelho na hora e apontou o texto. Teste que não morde
não protege nada.

## Pipeline de mídia — Fase 0 entregue (status **parcial** declarado)

20 arquivos novos (`src/media/`, `server/media/`, `.tools/render-episodio.mjs`,
`.rebeca/canais/luna/spec-midia.json`) + 6 arquivos de teste (47 testes). Nada foi gasto: ffmpeg local
não cobra e os 13 ativos entraram no livro com `custo_usd=0`.

| Verificação | Resultado observado |
|---|---|
| Render real (não é mock de texto) | ✅ longo **1920,1080,30/1** e Short **1080,1920,30/1**, 811 quadros, 27,033 s, mais `.srt` da mesma timeline (desvio fala↔legenda **12 ms**) |
| **Idempotência** | ✅ duas execuções: livro **99 → 99** linhas de dado, **20 → 20** arquivos, segunda rodada "gerados 0 · reusados 13" |
| Loudness | ✅ **−14,0 LUFS** medidos (alvo **declarado**, não verificado na doc da plataforma) |
| Tetos aprovados em código | ✅ `src/media/limits.ts`: **US$ 12,00/min** e **US$ 60,00/mês**, com portão que **para** o pipeline e grava teto + aprovador no `meta.json` do episódio |
| Portões provados por teste | ✅ custo **injetado** (nunca gasto real inventado): 12,01/min → `teto-por-minuto`; 59,99+0,02 → `teto-mensal`; sem livro durável → **recusa**; provedor pago sem estimativa → **recusa antes de escrever** |
| Tipos · suíte · build | ✅ `tsc` exit 0 · 210/210 · build exit 0 |

**Por que "parcial", com todas as letras:** (a) o comando exato `pnpm exec vitest run src/media` **não
roda neste sandbox** (o Vite falha com `spawn EPERM`) — rodou com config node-only equivalente
(47/47); (b) a suíte tinha 1 vermelho que era **meu** (o teste de thumbnail acima), agora corrigido.

**O que a Fase 1 ainda exige** (nada disso está pronto): provedor real atrás das mesmas interfaces
(MiniMax/Luma), upscale 768P→1080p e conformação de fps no render, **rodapé de rótulo *deep synthesis*
obrigatório** quando o provedor for MiniMax, **Character Sheet** (a referência hoje é sintética),
seleção do trecho de gancho para o Short (hoje o Short é o episódio inteiro quando ele é curto) e o
job longo fora do request HTTP (**D1**).

## "Ele gerou mas não apareceu" — a mídia da Fase 0 chegou à tela (2026-10-01)

Relato do dono do produto, depois de citar o que a interface dizia (*"Nenhum vídeo, narração ou montagem
gerados ainda"*): *"ele gerou mas nao apareceu"*. **Estava certo, e a causa foi medida — não era bug de
exibição, era um caminho que não existia.**

O pipeline F0 gravou 13 ativos reais em `.rebeca/assets/luna/luna-ep-001/` e o `meta.json` com provedor,
modelo, hash e duração por ativo. Mas: `src/data/client.ts` importa `./mock/db` e **não faz um único
`fetch`** (grep por `fetch(|/api/` em `src/data/*.ts` → 0); `api/` tinha só as 4 rotas de IA; e o único
caminho que alcançava `server/media/` era a CLI `.tools/render-episodio.mjs`. O pipeline escrevia no
disco e nada no app lia o disco.

**O que passou a existir** (nada foi gasto: os 13 ativos continuam com `custo_usd=0`):

| Camada | Arquivo |
|---|---|
| Contrato (navegador ↔ servidor) | `src/media/view.ts` — `import type` só, sem caminho absoluto |
| Leitura do manifesto, com disco **medido** | `server/media/library.ts` |
| Rota | `server/media/http.ts` → `GET /api/media/episodes` · `GET /api/media/episode` |
| Serverless | `api/media/episodes.ts`, `api/media/episode.ts` (import com `.js`) |
| Dev server | `server/media/vite-plugin.ts` + `vite.config.ts` |
| Navegador | `src/media/client.ts`, `src/media/hooks.ts` |
| Tela | `src/features/midia/MidiaPage.tsx` + rota `/c/:canal/midia` + item **Mídia gerada** na barra lateral |

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 — `.rebeca/evidencias/tsc-midia.txt` |
| Suíte completa | `pnpm exec vitest run` | ✅ **240/240 em 24 arquivos**, exit 0, 100,66 s — `.rebeca/evidencias/vitest-midia.txt` |
| Build | `pnpm run build` | ✅ exit 0 — 1982 módulos · css 38,58 kB · js 499,80 kB |
| **Ao vivo, com os arquivos reais** | `GET /api/media/episode?channelId=luna&episodeId=luna-ep-001` | ✅ **13 ativos, 0 ausentes, 13 simulados, 15.254.021 bytes, 162,201 ms, custo US$ 0** |
| **Caminhos de erro ao vivo** | idem para os 7 pedidos inválidos | ✅ sem canal → **400**; episódio inexistente → **404**; episódio de outro canal → **404** sem revelar que existe lá; `..%2Fetc` → **400**; rota desconhecida → **404**; POST → **405**; canal sem pasta → **200 `available:false` com motivo** |
| **Prova adversarial por mutação** | 3 mutações, restauração conferida por sha256 | ✅ `existsOnDisk` sempre `true` → **3 vermelhos**; sem a checagem de dono do manifesto → **1 vermelho**; sem o aviso de simulado na tela → **1 vermelho**; as três restauradas byte a byte |
| Guarda que faltava | `src/__tests__/serverless-imports.test.ts` | ✅ passou a cobrir **6** entrypoints (era 4) — as rotas novas entraram na rede criada por causa do 500 |

**Decisões que valem registro:**

1. **Nada inventa vínculo entre episódio e conteúdo.** O spec da Fase 0 diz, literalmente, *"Episódio
   sintético da Fase 0 (não é conteúdo do canal)"*. Não existe vínculo declarado com nenhum item da
   biblioteca, e ligar os dois por semelhança de nome seria afirmar linhagem que ninguém declarou. A
   leitura é **por canal**, e a tela diz que o episódio não é conteúdo do canal.
2. **Duas semânticas de total, de propósito:** `bytes` e duração descrevem **o que está no disco agora**
   (só arquivos presentes); custo e procedência descrevem **o que aconteceu** (tudo que foi gerado).
   Apagar um arquivo não devolve o dinheiro gasto. **Esta distinção nasceu de um teste que ficou
   vermelho** — a primeira versão somava a duração de um render apagado, o que faria a tela dizer "27 s
   de vídeo" sem haver vídeo para abrir.
3. **A tela é de leitura.** Aprovar, publicar e escolher thumbnail continuam nas telas de Revisão e
   Conteúdo — aqui não se decide nada (invariante nº 1 intacto).

**Não verificado (declarado):** conferência **visual** (não há navegador automatizado nesta sessão);
`api/media/*` **não** foi executada no runtime da Vercel (compartilha a função exercitada por HTTP, mas o
cold start real não foi medido); em produção **não há mídia alguma** para mostrar, porque
`.rebeca/assets/` está no `.gitignore` — o endpoint responde `available:false` com o motivo, e isso foi
verificado por teste e para um canal sem pasta, **não** em deploy real; e **nenhum ativo não simulado**
(os 13 da Fase 0 são todos `simulated: true`) passou por esta tela. Registro completo em
`.rebeca/evidencias/midia-na-tela.txt`.

**Uma armadilha do ambiente, de novo:** o `pnpm run dev` que iniciei **falhou com "Port 5173 is already in
use"** — já havia um servidor na porta, de sessão anterior. A prova ao vivo funcionou assim mesmo porque
**o Vite recarrega o `vite.config.ts` sozinho** ao detectar a mudança, e o servidor antigo passou a
atender `/api/media/*`. Vale saber: o log de inicialização que importa (`[mídia] rotas locais ativas`) é do
processo que **subiu**, não do que está atendendo.

### Segunda parte — o cartão da Revisão deixou de ser string fixa (mesmo dia)

Relato seguinte do dono, citando o cartão: *"O que existe neste conteúdo … Nenhum vídeo, narração ou
montagem gerados ainda … nao completo a secuencia"*. **Certo de novo, e o defeito era do tipo oposto ao
anterior:** depois que o pipeline gravou 13 ativos, o cartão **continuou dizendo que nada tinha sido
gerado**. A causa era a mesma família da primeira: aquelas linhas eram **strings fixas** no JSX —
verdadeiras quando escritas, mentira depois. Cartão de estado que não consulta estado é legenda.

| Antes (fixo) | Agora (derivado) |
|---|---|
| "Título, descrição e tags preparados" | do `seo` do próprio conteúdo — e avisa quando está incompleto |
| "Nenhum vídeo, narração ou montagem gerados ainda" | **três estados lidos de `GET /api/media/episodes`** (ver abaixo) |
| "a mídia entra quando o pipeline gerar" | "…quando este conteúdo tiver um episódio gerado **e ligado a ele**" |
| "{n} opções de thumbnail — a arte ainda não existe" | mantido: `ThumbnailOption` não tem campo de arte, então a arte não existe mesmo |

**Os estados da linha de mídia — a distinção entre eles é o ponto:**

| Estado | O que a tela diz |
|---|---|
| **Não sei** (leitura falhou) | *"Não foi possível ler a mídia gerada deste canal agora… esta linha não afirma que não há vídeo"* |
| **Existe** (`episodeId` ligado + manifesto) | *"Mídia gerada: 13 ativos, 13 de provedor simulado · render v1"* + link |
| **Existe no canal, não é deste conteúdo** | *"O pipeline já gerou 13 ativos neste canal (luna-ep-001)… não está ligado a este conteúdo"* + link |
| **Não existe** | *"Nenhum vídeo, narração ou montagem deste conteúdo foi gerado ainda"* |
| **Elo quebrado** | *"aponta para o episódio luna-ep-777, mas não há manifesto dele neste ambiente"* |

**O elo que faltava virou contrato:** `ContentItem.episodeId?` (`src/data/types.ts`) — opcional e
**ausente em todos os conteúdos da biblioteca**, porque o único episódio gerado é o sintético da Fase 0,
que o spec descreve como *"não é conteúdo do canal"*. Ligar os dois seria afirmar linhagem que ninguém
declarou — a mesma regra que impede a tela de se apropriar do episódio de ninguém.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos · Tela de Revisão | `pnpm exec tsc --noEmit` · `vitest run src/features/revisao` | ✅ exit 0 · **11/11** (eram 7) |
| Suíte · build | `pnpm exec vitest run` · `pnpm run build` | ✅ **244/244 em 24 arquivos** (eram 240) · build exit 0 — `.rebeca/evidencias/vitest-midia.txt` |
| **Prova adversarial por mutação** | 2 mutações, restauração por sha256 | ✅ cartão ignorando a mídia do canal → **2 vermelhos** (exatamente os testes certos); elo ignorado → **1 vermelho**; ambas restauradas byte a byte |

**Defeito que o próprio trabalho revelou — e era do teste:** o teste de `criar-thumbnail` procurava o
corpo do POST em `fetchMock.mock.calls[0]`. Quando o cartão passou a ler a mídia, a **primeira** chamada
virou um GET sem corpo e o teste caiu com `expected 'undefined' to contain 'criar-thumbnail'`. Ele media
a **ordem** das consultas, não o que dizia medir. Corrigido para achar a chamada da IA pelo corpo.

**Não verificado:** o ramo "ligado" do cartão **não** é exercitado por tela renderizada a partir do
produto (nenhum conteúdo tem episódio — e não deve ter); ele é exercitado por teste que declara o elo no
**dado de exemplo do teste** e o desfaz no `afterEach`, de modo que o produto segue sem vínculo
inventado. E a conferência visual continua pendente do dono.

## "Não está produzindo, não gera" — o gerador de thumbnail (2026-10-01)

Terceiro relato do dono na mesma tela, com captura do botão **"Gerar opções de thumbnail com a IA"**.
Certo de novo, e a causa era estrutural: **aquele botão chama a camada de LLM** (`criar-thumbnail`), que
devolve **conceito em texto** — ele nunca gerou imagem, nem podia. O dono clicava esperando arte.

**O que passou a existir** (decisão e alternativas em **`ADR-012`**, aceito pelo dono nesta sessão;
apuração em `.rebeca/pesquisa/gerador-de-thumbnail-2026-10-01.md`):

| Camada | Arquivo |
|---|---|
| Contrato: etapa `thumbnail`, `ThumbnailProvider` com `plan` e `costPerImageUsd` | `src/media/contract.ts` |
| **Allow-list como dado versionado** (15 entradas) | `.rebeca/canais/luna/allow-list.json` |
| Portão de fornecedor | `server/media/allow-list.ts` |
| Adapter real **MiniMax `image-01`** (16:9 → 1280×720 nativo, US$ 0,0035/imagem) | `server/media/providers/minimax.ts` |
| Fase 0: 4 PNGs locais, custo zero | `server/media/providers/simulated.ts` |
| Orquestração: plano → pendentes → portão → gerar → livro → manifesto | `server/media/thumbnails.ts` |
| `POST /api/media/thumbnails` e `GET /api/media/file` | `server/media/http.ts` + `api/media/*` |
| Botão **"Gerar as 4 artes"** + as 4 imagens na tela | `src/features/revisao/RevisaoPage.tsx` |
| Prévia de cada imagem na listagem | `src/features/midia/MidiaPage.tsx` |
| CLI | `.tools/gerar-thumbnails.mjs` |

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos · suíte · build | `tsc` · `vitest run` · `pnpm run build` | ✅ exit 0 · **265/265 em 25 arquivos** (eram 244) · build exit 0 |
| **Geração real (CLI, simulado)** | `node .tools/gerar-thumbnails.mjs` | ✅ **4 arquivos**, `ffprobe` **1280,720,rgb24**, custo US$ 0 |
| **Idempotência** | rodar de novo | ✅ livro **142 → 142 linhas**, `geradas 0 · reusadas 4` |
| **A rota que o botão chama, ao vivo** | `POST /api/media/thumbnails` | ✅ 200 · `simulated=true` · `created=4` · com o **motivo do provedor** (sem chave → arte simulada, dito na tela) |
| Imagem servida | `GET /api/media/file?...` | ✅ **200 `image/png` 38732 bytes** |
| **Travessia de caminho** | 4 tentativas (`../../segredos/llm.json`, `win.ini`, `C:/…`) | ✅ **404** nas quatro — a defesa é a whitelist do manifesto, não a sanitização |
| **Prova adversarial por mutação** | 3 mutações, restauração por sha256 | ✅ portão da allow-list removido → **1 vermelho**; reuso desligado → **1 vermelho** (o teste de idempotência); `base_resp.status_code` não checado → **2 vermelhos** |

**Três lacunas de processo que a apuração encontrou — e que valem mais que o código:**

1. **A allow-list do `ADR-005` nunca existiu como arquivo.** O ADR dizia "dado versionado, com URL, data de
   leitura, trecho citado e aprovador" — e isso morava só em prosa, sem ninguém conseguir executá-lo.
   Agora existe, e o portão **recusa** `PROIBIDO` e `NAO-VERIFICADO` citando o fundamento na mensagem.
2. **A Stack A aprovada inclui "FLUX.2 klein" para imagem, mas a Black Forest Labs não está na tabela de
   allow-list daquele ADR.** O modelo de imagem da stack aprovada **nunca teve termo lido registrado**.
   Entrou como `NAO-VERIFICADO` — declarado, não presumido.
3. **O portão do provedor simulado é por nome, não por `simulated: true`.** Exceção automática deixaria um
   provedor real passar pela lista declarando-se simulado — o mesmo padrão de furo que o `rebeca-qa` achou
   no `ADR-010`.

**Ruído registrado:** a primeira rodada da suíte completa reprovou **um** teste por tempo (162 s com o dev
server no ar disputando CPU). Em isolamento o arquivo passou **11/11**, e a segunda rodada completa passou
**265/265 em 127 s**. É o mesmo fenômeno de carga já documentado aqui em 2026-10-01 — o dono estava com o
app aberto, e o servidor não foi derrubado.

**Não verificado (declarado):** **nenhuma geração paga aconteceu** — não há chave da MiniMax nesta máquina,
e o adapter real só foi exercitado contra `fetch` simulado (6 casos, incluindo erro de saldo e chave
inválida); o schema **não** foi inventado (vem do OpenAPI oficial lido hoje), mas a chamada real segue
pendente. A qualidade da arte real é desconhecida: não se sabe se o `image-01` desenha texto legível nem se
mantém o personagem. **A consistência de personagem não está resolvida** — `subject_reference` existe no
endpoint image-to-image (não usado) e o Character Sheet continua não existindo. E o portão da allow-list
ainda **não** está no caminho de vídeo (`runSimulatedEpisode`): ele protege a rota que gasta dinheiro hoje.
Registro completo em `.rebeca/evidencias/gerador-de-thumbnail.txt`.

## Verificação independente dos preços — contraprova do `ADR-005` (2026-10-01)

Dossiê em **`.rebeca/pesquisa/provedores-midia-e-voz-2026-10-01.md`**. A coleta **confirmou a Stack A**
(voz Azure a **US$ 0,0135/min**, lida na Azure Retail Prices API oficial, com vozes prebuilt liberadas
comercialmente; vídeo MiniMax H3 a **US$ 0,08/s**; Google vedado para público menor de 18, reconfirmado
em leitura independente) e trouxe quatro achados que passam a valer:

1. **Kling é mais barato (≈ US$ 3,78/min) e continua BLOQUEADO.** A coleta leu preços e `llms.txt`, mas
   **não** releu os dois documentos contratuais que se contradizem sobre uso comercial — o bloqueio do
   `ADR-005` permanece. Deixar o preço justificar o fornecedor é exatamente o que aquele ADR recusa.
2. **`libx264` é GPL.** Hoje **não** há obrigação de distribuição (o Rebeca executa o binário num
   servidor, não distribui), mas a obrigação nasceria se o render fosse embarcado. Registrado no
   `ADR-010` como decisão consciente.
3. **Udio e MusicGen estão fora por licença** (Udio veda uso comercial e distribuição em YouTube;
   MusicGen tem pesos CC-BY-NC). **Suno** só dá direito comercial para download feito **durante
   assinatura ativa** — regra operacional do pipeline.
4. **Portas fechadas:** Sora desligado em 2026-09-24; `gpt-image-1` em fim de vida (2026-10-23) e sem
   16:9/9:16. E o risco de negócio: o YouTube considera não monetizável conteúdo de IA massificado —
   variedade de enredo é elegibilidade, não capricho.

**Revisão adversarial do pipeline (`rebeca-qa`) — veredito: REFUTADO (parcial); achados corrigidos.**
Relatório em `docs/qa/QA-010-pipeline-de-midia.md`. **O que passou:** formatos por `ffprobe`
(1920×1080@30 e 1080×1920, 811 quadros, 27,033 s), legenda dentro da duração, loudness −14,0 LUFS,
idempotência em duas rodadas (113 → 113 linhas de dado), hashes determinísticos, isolamento de canal
(`ChannelScopeError` em 5/5, incluindo `..`, `/`, `C:` e maiúsculas), duração do custo/minuto vinda do
arquivo renderizado (não de `tempo_min`) e nenhum número inventado.

**O que caiu — e era o que mais importava:** o teto de gasto não era confiável. (1) Célula **vazia** de
`custo_usd` era pulada, então "não sei o custo" entrava como "não gastou" — o QA somou 59,00 pagos +
59,00 não verificados e o limite **passou**; pior, o teste do autor **afirmava o comportamento errado**
enquanto o nome dizia o contrário, e **eu repeti essa afirmação falsa aqui no estado**. (2) O portão
pré-gasto usava `estimateUsd ?? 0`: com provedor pago e sem estimativa, o pipeline **gerou tudo** (21
arquivos, US$ 200 na reprodução do QA) antes de o portão de saída disparar.

**Corrigido e provado por mutação:** célula vazia, valor negativo ou com separador pt-BR agora
**lançam**; provedor que cobra passa a **declarar** `simulated: false` no contrato, e sem estimativa o
pipeline **recusa antes de escrever qualquer arquivo** — os dois testes que faltavam existem
(`media-custo` e o primeiro teste de pipeline em `media-render`), e desfazer cada correção deixa o teste
correspondente **vermelho**. Também corrigidos: `renderPath` sem validação de extensão, citação de
arquivo de evidência que não existia, `CHARS_PER_SECOND` sem procedência e a contradição de status no
`ADR-010`. Suíte: **215/215 em 22 arquivos**; `tsc` e build exit 0.

## App publicado — decisão de torná-lo privado: camada 2 entregue, camada 1 **pendente do dono** (2026-10-01)

Pedido literal do dono: *"fazer ele privado"*, na sequência de ter lido o aviso da tela de
Configurações (a chave não pode ser colada no ambiente publicado e **"hoje quem alcançar o endereço
consome a chave"**). Decisão e alternativas descartadas em **`ADR-011-app-privado.md`**.

**O que foi medido antes de decidir (não herdado):** `https://rebeca-odda.vercel.app/api/ai/status`
respondeu **HTTP 200 sem credencial nenhuma** — o app está de fato aberto a qualquer visitante. O
`ADR-007` só barra a **escrita** de segredo; o **uso** das rotas (inclusive `POST /generate`, que
gasta) continuava livre.

**A decisão é em três camadas, com estados diferentes — e a diferença é declarada, não maquiada:**

| # | Camada | Estado |
|---|---|---|
| 1 | **Vercel Authentication + escopo All Deployments** (fecha a porta de verdade; cobre app e `/api/*`) | ⏳ **ação do dono** — 1 clique por projeto; o agente não tem credencial da Vercel nesta sessão |
| 2 | **`X-Robots-Tag` + `public/robots.txt` + `<meta name="robots">`** (não indexar, não arquivar) | ✅ **implementado e verificado** |
| 3 | **Autenticação das rotas de IA** (identidade e trilha; é a F1, `D3`) | ⏳ aberta |

**Fato de fonte (com data, porque preço e plano mudam):** *Vercel Authentication*, *Standard
Protection* e *All Deployments* constam como **"Included" no plano Hobby**; *Password Protection*
**não existe no Hobby** (US$ 20/mês por projeto no Pro). Deployment Protection "requires
authentication for **all** requests, including those to Routing Middleware" e, sobre o escopo *All
Deployments*, a doc diz literalmente: *"With this configuration, all URLs are protected, including
your production domain `example.com` and generated URLs like `my-project-1234.vercel.app`"*. Fonte:
<https://vercel.com/docs/deployment-protection> e
<https://vercel.com/docs/deployment-protection/usage-and-pricing>, ambos `last_updated: 2026-09-15`,
lidos em 2026-10-01. **É por isso que a camada 1 é a recomendada: é gratuita e não exige código.**

| Verificação (camada 2) | Comando | Resultado |
|---|---|---|
| Cabeçalhos, robots e meta | `pnpm exec vitest run src/__tests__/headers.test.ts` | ✅ **11/11** (eram 8; 3 casos novos) |
| **Prova adversarial** | remover as três camadas de propósito e rodar a mesma suíte | ✅ **3 reprovados exatamente** (`expected '' to contain 'noindex'`, `robots.txt` ausente, meta ausente) e arquivos restaurados **byte a byte idênticos** — `.rebeca/evidencias/adversarial-noindex.txt` |
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Sem colisão com o CSP | o `ADR-008` continua verde (o hash do script inline não mudou) | ✅ o mesmo arquivo de teste cobre os dois |

**Não verificado (declarado):** a camada 1 **não foi ligada** — o agente não tem credencial da Vercel
(o CLI existe na máquina mas não está autenticado e não roda sob o sandbox desta sessão). Enquanto o
dono não ligar, o app **continua público**; a camada 2 só reduz descoberta, e o próprio `robots.txt`
diz isso com todas as letras. **Também não verificado:** que exista um único projeto na Vercel — o
`ADR-003` registra **dois** (`rebeca-odda` e `rebeca`), e a proteção vale por projeto, então ligar em
um só deixa o outro aberto.

**Ordem recomendada ao dono:** ligar a proteção de deploy **primeiro** e só depois publicar as mudanças
de código. (*"No ato", isto é, cobrindo deploys já existentes e não só os futuros: é **inferência** da
leitura da doc — a frase que trata explicitamente de "past production deployments" só existe nas
variantes **legadas**, e a doc atual não promete imediatez. Marcado como `NÃO VERIFICADO` pelo
`rebeca-qa`.*)

**Revisão adversarial (`rebeca-qa`) — veredito: REFUTADO, em escopo restrito, e corrigido.** Relatório
em `docs/qa/QA-011-app-privado.md`. O miolo técnico **passou**: `dist/robots.txt` chega ao artefato com
**sha256 idêntico** ao de `public/`, a meta tag está no HTML construído, o rewrite de SPA **não** engole
arquivo existente (provado em produção com `/icone-32.png` → 200 `image/png`), cada uma das três
camadas mutadas derruba **exatamente** o seu teste, e o contrato de hash do CSP (`ADR-008`) sobreviveu.

| # | O que o QA derrubou | O que ficou |
|---|---|---|
| QA-A1 (alta) | O `README.md` apresentava o deploy como privado **sem marcar a camada 1 como pendente** — o único documento da entrega que não trazia o `⏳` | README reescrito: "a camada que fecha a porta ainda **NÃO** está ligada", com o 200 medido e o comando de verificação |
| QA-A4 (média) | O README apontava o projeto Vercel **`ai-media-studio`**, que é **de terceiro** (o `QA-003` já registrara isso e nunca fora corrigido) | Corrigido para `rebeca-odda`, com aviso explícito de que `ai-media-studio.vercel.app` é de outro |
| QA-A5 (baixa) | `Sitemap:` vazio no `robots.txt` — diretiva sem valor (ruído, RFC 9309 §2.2.4) | Linha removida |
| QA-A6 (baixa) | Citação **não literal** da Vercel neste arquivo | Substituída pela frase literal da doc |
| QA-A7 (baixa) | *"vale para os deploys existentes no ato"* apresentado como fato | Marcado como inferência `NÃO VERIFICADO` |
| QA-A8 (baixa) | Manchete afirmativa ("App publicado é privado") | Título passou a declarar o estado real das camadas |
| QA-A9 (baixa) | Os 3 testes novos eram **mais estritos que o HTML/ABNF válidos** (ordem de atributos, caixa, espaço no fim) — falso vermelho | Asserções passaram a ser sobre o **significado** (diretivas parseadas, atributos em qualquer ordem) |

**A2/A3 do QA ficaram obsoletos por medição, não por argumento:** ele viu `tsc` e `pnpm run build`
**vermelhos** por causa de dois erros da frente de mídia, em edição concorrente no mesmo minuto (D9
cobrando o preço outra vez). Medido de novo ao fim: `pnpm exec tsc --noEmit` → **exit 0** e
`pnpm run build` → **exit 0** (`1979 modules transformed`, `dist/index.html` 2,01 kB) —
`.rebeca/evidencias/tsc-check.txt` e `.rebeca/evidencias/build-check.txt`. **A lição operacional fica:**
enquanto duas sessões escreverem na mesma árvore, "o build está quebrado" tem prazo de validade de
minutos — medir de novo antes de publicar, nunca publicar com base em medição alheia.

**Publicado e verificado em produção (2026-10-01, commit `aeaac92`):**

| Verificação | Comando | Resultado |
|---|---|---|
| O push | `git push origin main` | ✅ `2a7ae79..aeaac92` (o commit ficou só com os arquivos desta entrega; o trabalho em andamento da frente de mídia **não** entrou) |
| **`/robots.txt` no ar** | `fetch https://rebeca-odda.vercel.app/robots.txt` | ✅ **200** com `Disallow: /` (antes o caminho devolvia o HTML da SPA) |
| **`X-Robots-Tag` no ar** | cabeçalhos de `/` e de `/robots.txt` | ✅ `noindex, nofollow, noarchive, nosnippet` |
| Meta no documento servido | corpo de `/` | ✅ presente |
| **A camada 1 está ligada?** | `GET /api/ai/status` **sem credencial** | ❌ **200** — segue público, exatamente como o ADR declara |

**Armadilha de EOL encontrada ao verificar (registrada, não maquiada).** O repositório guarda os `.md`
de prompt e o `prompts.generated.ts` com **CRLF no blob** e o gerador compara o **arquivo inteiro**
(`current !== generated`). Consequência medida: num checkout **Windows com `core.autocrlf=true`** o
`pnpm run build` **falha** em "prompts fora de sincronia"; no **Linux** (Vercel/CI) o checkout normaliza
para LF e o build passa — por isso o deploy subiu. **Correção sugerida e NÃO aplicada:** `.gitattributes`
com `eol=lf` para `.md`/`.ts` e um `git add --renormalize .` — não apliquei porque mexe em arquivos de
outra sessão e isso é decisão, não pressa. **Lição de método:** verificar "a árvore builda?" numa árvore
que outra sessão está escrevendo mede a outra sessão; o que vale é reconstruir **a árvore exata do push**
(`HEAD` + os arquivos da entrega) e buildar essa — foi o que fechei aqui (`.rebeca/evidencias/app-privado-verificacao.txt`).

**Camada 1 — o dono informou que ligou; a medição NÃO confirma (2026-10-01).** Depois de o dono
responder "já liguei a proteção de deploy", a verificação foi repetida **4 vezes ao longo de ~80 s**:
`GET https://rebeca-odda.vercel.app/api/ai/status` → **200** com o JSON completo, `x-vercel-mitigated`
**ausente**, nenhum `www-authenticate` e nenhum redirecionamento para login. `/` e `/robots.txt` também
respondem 200. Ou seja: **a URL de produção continua aberta**, apesar do relato. Registrar a divergência
é o ponto — o projeto não aceita aprovação por afirmação, e aqui a diferença entre "liguei" e "está
ligado" é a porta.

**Hipótese principal (o erro seria de escopo, não de intenção):** na Vercel, **Standard Protection**
"protects all deployments **except** production domains" — é o escopo padrão da tela e protege só
preview. O escopo que fecha a produção é **All Deployments**. Quem liga o toggle e vê "protegido"
conclui que protegeu tudo. **Como distinguir:** se o preview pedir login e a produção não, o escopo é
Standard Protection. **Não verificado:** se a proteção foi ligada no **outro** projeto (`rebeca`, ver
`ADR-003`) — os aliases de preview testados deram 404 e o slug do time não é conhecido nesta sessão.

**Nada foi commitado no momento em que este parágrafo foi escrito** — o commit exige a pasta quieta e a
passagem pelo `rebeca-qa`, que foi feita (acima).

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
| ~~D2~~ | ✅ **decidida em 2026-10-01** — **Stack A** (MiniMax-H3 768P + FLUX.2 klein + Azure S1 Neural + Suno Pro) com **teto de US$ 12,00 por minuto** de vídeo. É a única stack cujos modelos têm termo lido e permitido para público infantil; o Google segue **vedado** nas três vias. Ver `ADR-005` (aceito) e `ADR-010` | `rebeca-ia-video`, `rebeca-backend` | humano |
| D3 | Modelo de acesso: só o dono, ou equipe com papéis (editor/revisor)? — **o `ADR-011` não a responde**: ele só fecha a exposição pública (proteção de deploy + noindex). A autenticação de verdade, com identidade e papéis, segue na F1 | `rebeca-supabase` (RLS), `rebeca-produto` | humano |
| D4 | Canal piloto para o primeiro ciclo real (Luna?) e meta de publicação | `rebeca-produto`, `rebeca-analytics` | humano |
| ~~D5~~ | ✅ **decidida em 2026-10-01** — limite de gasto **mensal de US$ 60,00** (≈ 1 episódio de 7 min): *"validar qualidade antes de escalar"*. Os dois tetos vivem **em código** (`src/media/limits.ts`), não em variável de ambiente: mudar exige revisão | `rebeca-backend`, `rebeca-seguranca` | humano |
| ~~D6~~ | ✅ **decidida em 2026-09-30** (GitHub privado + Vercel, ver `ADR-003`): *onde roda* está fechado. A **publicação efetiva** ainda depende do import do dono na Vercel — as duas coisas são separadas de propósito | `rebeca-powershell`, `rebeca-github` | humano |
| D7 | **Nome do produto: "Rebeca" (pasta e PDF) ou "AI Media Studio" (protótipo da frente paralela)?** | todo o código, UI, SEO e comunicação | humano |
| D8 | Ratificar em ADR a stack já presente no `package.json` (Vite + React 19 + React Query + react-router) ou trocar | `rebeca-arquiteto`, `rebeca-react` | humano |
| D9 | A frente paralela continua em paralelo, ou passa a operar **através desta orquestra** (com `rebeca-arquiteto` → `rebeca-qa` antes de merge)? | todo o projeto | humano |
| D10 | **"Medir" (seção 7 do PDF) promete RPM, horários e temas — e a Analytics API não entrega os três.** Derivar dentro do Rebeca (RPM = receita ÷ views; horário e tema por agregação própria) ou mudar a promessa do `docs/00` §3.8? | `rebeca-youtube`, `rebeca-analytics` | humano |
| D11 | **Qual fornecedor de LLM pode atender o canal infantil?** O Google está **vedado** por cláusula literal (Gemini Additional Terms, "Age Requirements"); a DeepSeek tem cláusula (§3.4(8)) que pode alcançar o caso da Luna e a **leitura jurídica está pendente**; a Anthropic permite com salvaguardas. Enquanto não houver leitura jurídica, o default do produto é conservador. Ver `ADR-006`. **Em 2026-10-01 o dono pediu o Gemini Omni 1.1 Flash para vídeo; a resposta foi não, pela mesma cláusula (relida na fonte), e o pedido não alterou a decisão — ver `ADR-013`** | `rebeca-lgpd`, `rebeca-infantil`, `rebeca-seguranca` | humano |
| D12 | **O teto de gasto de LLM aprovado nesta sessão** (US$ 0,05 por chamada, US$ 1,00 por dia) é revogável pelo dono. Está em `src/ai/limits.ts`, não em variável de ambiente, para que mudá-lo exija revisão | toda a camada de IA | humano |

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

## Autenticação das rotas de IA e mídia — Parte 2 implementada (2026-10-02)

O dono entregou o **Client ID** do Google (Parte 1 do runbook) e pediu a **Parte 2**. O `ADR-014` já
estava aceito e o runbook escrito; esta sessão escreveu o código. Nada foi gasto: nenhuma chamada paga
aconteceu (a verificação inteira roda com verificador de token injetado e provedor simulado).

**O que existe agora** (o detalhe e as consequências estão no **adendo do `ADR-014`**):

| Camada | Arquivos |
|---|---|
| Contrato compartilhado | `src/auth/contract.ts` |
| Verificação e política | `server/auth/verify.ts` (biblioteca oficial + `aud`/`iss`/`exp`/`sub`), `server/auth/access.ts` (lista de `sub`), `server/auth/config.ts` |
| Ponto único da guarda | `server/auth/guard.ts` — `authenticateRequest` (401) e `authorizeRequest` (401/403/429/503) |
| Limite de uso | `server/auth/rate-limit.ts` (janela deslizante por `sub`, em código) |
| Rotas de autenticação | `server/auth/http.ts`, `server/auth/vite-plugin.ts`, `api/auth/config.ts`, `api/auth/me.ts` |
| Guarda aplicada | `server/ai/http.ts`, `server/media/http.ts`, os 8 wrappers de `api/**` e os 2 plugins do Vite |
| Cliente | `src/auth/{token,client,google,context,LoginGate,MediaImage}.ts(x)` |
| Ligação na interface | `src/App.tsx` (portão), `src/ai/client.ts`, `src/media/client.ts`, `RevisaoPage`, `MidiaPage`, `ConfiguracoesPage` |
| Cabeçalhos | `vercel.json` — CSP com os quatro endereços do Google + COOP `same-origin-allow-popups` |
| Auditoria de gasto | coluna `identidade_sub` no livro (`server/ai/ledger.ts`, `server/media/ledger.ts`), aditiva e no fim |
| Ambiente | ponte explícita de `.env` em `vite.config.ts` (só as 2 chaves da autenticação) e sessão de teste em `vitest.setup.ts` |
| Dependência nova | `google-auth-library@11.1.0` (a recomendada pela doc oficial para verificar o ID token em Node) |

**Verificação (comando + resultado observado):**

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Suíte completa | `pnpm exec vitest run` | ✅ **391/391 em 34 arquivos**, exit 0 (medida **depois** das correções do `QA-014`) |
| Testes da autenticação | `pnpm exec vitest run src/auth` | ✅ **77/77 em 4 arquivos** — inclui a reprodução do `rebeca-qa`, agora verde |
| Build de produção | `pnpm run build` | ✅ exit 0 — css 39,21 kB (gzip 8,55) · js 530,10 kB (gzip 155,78) |
| **Cold start em condição de produção** | JS compilado com `tsc --ignoreConfig` **fora** do repositório + junção para `node_modules`, `VERCEL=1`, cwd fora do projeto | ✅ **sem `GOOGLE_CLIENT_ID`:** `config` **200** (`clientId:null`) e **503** em IA e mídia (**falha fechada**) · **com** a variável: **401 `token-ausente`** — inclusive nas cascas com corpo inválido (era 400 antes da correção do defeito 1) |
| **A verificação real de assinatura roda** | `fetch` das chaves públicas do Google a partir do JS compilado | ✅ **HTTP 200, 2 chaves** — e o token falso recebeu **401 `token-invalido`** com as chaves de verdade na mão: a recusa foi de **assinatura**, não de rede |
| **Biblioteca do servidor fora do bundle do navegador** | grep em `dist/assets/*.js` | ✅ **0 ocorrências** de `gaxios`, `OAuth2Client` e `google-auth-library`; `accounts.google.com/gsi/client` presente (a constante pública) |
| Segredo em texto claro | `python .tools/scan_secrets.py --history` | ✅ limpo em **659 blobs** (árvore + histórico); 6 achados ignorados pelo baseline revisado |
| Árvore sem `.js` solto | `git status --porcelain api server src` filtrado por `.js` | ✅ nenhum (a armadilha de deixar JS compilado ao lado do TS já custou caro uma vez) |

**Defeitos e armadilhas encontrados durante a implementação** (todos no adendo do ADR, com o detalhe):

1. **`/api/media/file` não podia mais alimentar `<img src>`.** A rota passou a exigir cabeçalho, e o
   navegador não manda cabeçalho em `src`. As três prévias de arte do app quebrariam **em silêncio**.
   Saída: `MediaImage` busca com `fetch`, exibe de `blob:` e revoga no desmonte.
2. **A biblioteca oficial ecoa o token na mensagem de erro** (`Wrong number of segments in token:
   <token>`). Isso poria a credencial no corpo da resposta. Toda falha vira motivo fixo, com teste que
   serializa o corpo e afirma que o token não aparece.
3. **31 testes de tela ficaram vermelhos** — e a causa era o próprio acerto da entrega: as páginas
   chamam as camadas de IA e de mídia, que agora **recusam** sem sessão. Resolvido com uma sessão de
   teste declarada em `vitest.setup.ts`; a fronteira (sem login nada é chamado, 401 derruba, 403 não
   derruba) tem arquivo próprio, que limpa a sessão de propósito.
4. **A coluna nova do livro quebrou um teste que afirmava o cabeçalho exato** (`media-custo.test.ts`).
   Atualizado, e o caso ganhou a asserção que faltava: no caminho sem sessão a célula é **vazia**.
5. **O Vite não injeta `.env` em `process.env`** (conferido na implementação instalada). Sem ponte,
   quem copiasse o `.env.example` veria "falta `GOOGLE_CLIENT_ID`" **com o valor na frente**. A ponte
   copia **duas** chaves, não todas: chave de provedor dentro do processo é como um teste topa com
   credencial paga.
6. **Divergência do runbook corrigida:** ele afirmava que `/api/ai/status` continuaria **200**; com a
   decisão aplicada como está escrita, ela responde **401** como as outras. O runbook foi corrigido.
7. **`GET /api/media/file` não existia como função serverless.** Era atendido só pelo plugin do
   servidor de desenvolvimento: na Vercel a requisição cairia no rewrite de SPA e devolveria **HTML
   com 200** — o navegador tentaria ler HTML como imagem, e o sintoma ("a prévia não aparece") só
   apareceria publicado. CRIADO `api/media/file.ts`, com a mesma função compartilhada e a mesma
   guarda, e incluído na guarda de imports (11 entrypoints conferidos agora).
8. **O dono usou o app e o console dele achou o que a minha suíte não via:** o aviso
   `[GSI_LOGGER] google.accounts.id.initialize() is called multiple times` — o `StrictMode` do React 19
   remonta o efeito e o botão do Google era inicializado a cada montagem, com `renderButton`
   **acrescentando** iframe em vez de substituir. Corrigido (`initialize` uma vez por cliente + o
   callback lendo o handler **atual**; `replaceChildren()` antes de desenhar) e coberto por 5 testes
   novos em `src/auth/__tests__/google.test.ts`. **Nenhum teste meu exercitava a remontagem do botão:**
   o defeito só existia no navegador — quem o trouxe foi o uso real, não a suíte. O outro aviso do
   console (`Cross-Origin-Opener-Policy policy would block the window.postMessage call`) **não é
   nosso**: medido que o servidor de desenvolvimento não envia COOP nenhum, e o login funcionou; em
   produção o valor é `same-origin-allow-popups`, o que a doc prescreve. Registrado para não virar
   achismo.
9. **A ponte do `.env` mentia em silêncio — e o sintoma era "conta não autorizada".** Este é o defeito
   que custou mais caro em idas e voltas com o dono. A ponte copiava `.env` → `process.env` na
   avaliação do `vite.config.ts`, com a regra "o ambiente vence o arquivo". Como o Vite **não reavalia**
   a configuração quando o `.env` muda, editar a lista de acesso **não tinha efeito nenhum**: o
   processo continuava com o valor antigo, escrito pela própria ponte. Medido com valor sentinela:
   `GET /api/auth/config` devolvia o valor antigo 7 s depois da edição. Na tela, isso aparecia como
   **"conta ainda não autorizada"** — defeito de encanamento disfarçado de defeito de acesso, que manda
   procurar no lugar errado. **Corrigido**: `server/dev-env.ts` lê o arquivo **na hora do uso** (cache
   por `mtime`), então editar o `.env` vale na requisição seguinte, sem reiniciar; o arquivo é ignorado
   em teste (`VITEST`) e em produção (`VERCEL`). **Provado ao vivo**: sentinela aplicada em **3 s** com
   o servidor no ar, e restaurada em seguida. 6 testes em `src/__tests__/dev-env.test.ts`.
   **Lição de método:** duas correções minhas falharam antes de o mecanismo real aparecer; o que o fez
   aparecer foi um **experimento com valor observável** (sentinela + endpoint público), não a leitura
   do código.
10. **A CAUSA FINAL ERA MINHA, E ERA A PIOR DE TODAS: eu transcrevi os `sub` errado, a olho, das
   capturas de tela do dono.** Duas listas foram configuradas com números de 21 dígitos que **existem**,
   mas são de outras contas — a lista parecia correta, o servidor respondia "2 contas autorizadas", e a
   tela recusava a conta com o `sub` "certo" na mão. Não era encanamento, não era COOP, não era FedCM,
   não era cache: eram **dois dígitos trocados** por quem escreveu o arquivo.
   **Como apareceu** (e é o método que fica): um instrumento de diagnóstico no plugin de
   desenvolvimento imprimiu, no console do servidor, o `sub` que o Google mandou **com os códigos de
   cada caractere** e a lista comparada. Em uma linha ficou visível:
   `sub recebido "107886939461400534744"` contra `lista "197886939461400534744"` — o segundo dígito,
   `0` contra `9`. A lista foi regravada com os valores **lidos da máquina**, e o instrumento ficou no
   `server/auth/vite-plugin.ts` (só no dev, só quando a conta é recusada): autorizar uma conta nova
   passou a ser **copiar do terminal**, nunca digitar.
   **Regra que entra no projeto:** identificador (`sub`, id, hash, token) **nunca** se transcreve à mão
   de imagem, print ou PDF — copia-se da fonte. Vinte e um dígitos em fonte pequena é exatamente o tipo
   de dado que a vista completa sem perceber.
   **Defesa que ficou no código, independente disso:** `limparIdentificador` (`server/auth/access.ts`)
   remove caracteres invisíveis (largura zero, espaço não separável, BOM) dos **dois lados** da
   comparação — colar um `sub` de um log ou de um PDF é por onde esse lixo entra, e ele tem o mesmo
   efeito de uma recusa inexplicável. Coberto por teste em `guard.test.ts` ("tolera caractere
   INVISÍVEL no sub"), com o contrapeso de que um `sub` desconhecido continua recusado.

**Não verificado (declarado, não maquiado):**

1. **Um token real do Google nunca foi aceito nem recusado aqui.** O lado negativo foi exercitado com
   as chaves públicas reais (token forjado → 401); o lado positivo exige um login de verdade, que só o
   dono faz no navegador. **Não verificado:** que um ID token legítimo seja aceito.
2. **O pop-up/One Tap em navegador real não foi observado.** CSP e COOP foram corrigidos conforme a
   documentação oficial (relida em 2026-10-02), mas quem confirma é o login do dono.
3. **O runtime da Vercel não foi executado.** O cold start foi simulado localmente, com o mesmo
   procedimento que pegou o defeito de import uma vez — não é o runtime de produção.
4. **O rate limit é por instância do processo.** Em serverless, cada invocação pode nascer com o
   contador zerado. Está escrito no código; limite compartilhado exige banco (D1, aberta).
5. **Duas sessões de agente escreveram na mesma árvore durante a implementação** (o dono confirmou que
   a outra estava ativa). Uma delas adaptou `src/media/__tests__/media-custos.test.ts` ao contrato
   novo enquanto eu escrevia o servidor. Nada foi perdido — os arquivos se encaixaram (ela usou o
   mesmo módulo de apoio) —, mas **a árvore não estava quieta**, e por isso **nada foi commitado**.

## Revisão adversarial da autenticação — `rebeca-qa`: REFUTADO PARCIALMENTE, e corrigido (2026-10-02)

Relatório em **`docs/qa/QA-014-autenticacao-google.md`** (com a resposta do produtor no topo) e a
reprodução em `src/auth/__tests__/qa-refutacao.test.tsx`, que ficou no repositório **verde** — os casos
que ele escreveu para falhar passaram a medir a correção.

**O que resistiu a tudo (é o que importa):** não se gasta a chave paga sem identidade válida e
autorizada. Nenhum ataque de header furou (duplicado, array, NBSP, `Basic`, token cru, 9005
caracteres sem tocar o verificador); nenhum token vazou no corpo do erro — inclusive forçando o
caminho em que a `google-auth-library` **ecoa o valor recebido**; token forjado com `kid` real do
Google foi recusado **pelas chaves reais**; o livro de custos ficou intacto em 401/403/429, com
controle positivo de que o mecanismo grava; a migração do livro é aditiva e a soma continua certa; e
uma enxurrada de 712 identidades não zerou o contador de quem abusava.

**Dois defeitos reais (gravidade média), corrigidos:**

1. **A guarda não era a primeira checagem nas quatro cascas serverless que leem corpo**
   (`api/ai/generate.ts`, `api/ai/test.ts`, `api/ai/settings.ts`, `api/media/thumbnails.ts`): com o
   corpo lido **antes** da guarda, requisição **sem credencial nenhuma** recebia `400` em vez de `401`,
   e o processo ainda analisava até 256 KB de quem não se identificou. Correção: o corpo passou a ser
   passado como **função** e é lido **dentro** do roteador, depois de `authorizeRequest` — nas quatro
   cascas, nos dois plugins do Vite e nas três assinaturas de roteador. Efeito colateral bom: o `413`
   de corpo grande demais deixou de ser reescrito como `400`.
2. **`MediaImage` aceitava `200` com `text/html` como imagem** — o `index.html` do rewrite de SPA
   virava `blob:` e ia para o `<img>`, produzindo imagem quebrada **em silêncio**, exatamente o
   sintoma que o componente existe para eliminar. Correção: exige `content-type: image/...`.

**Quatro observações de gravidade baixa, todas atendidas:** duas cotas de uso independentes (leitura
240/min, geração 20/min — antes uma cota só, e uma tela com 13 prévias chegava perto do teto e recebia
`429` em `GET`, que não gasta nada); o pai do GIS no `default-src` (fallback que a doc oficial pede); a
**contagem** de identidades autorizadas saiu da rota pública (ficou só em `/api/auth/me`, depois de o
token ser verificado) e a mensagem de 403 deixou de dizer quantas entradas da lista não parecem `sub`;
e o `redact` no único ponto de saída que não o tinha.

**A lição de método, registrada porque vai se repetir:** o defeito 1 não era furo de segurança — era a
**ordem de duas linhas**, e sobreviveu à minha leitura do arquivo, ao `tsc`, à suíte inteira e a um
teste que eu escrevi para "provar o 401". Todos os meus casos chamavam o **roteador** direto; o defeito
morava no único pedaço que eu não exercitei — a **casca**. Testar a camada de baixo e chamar de prova do
caminho de cima é o buraco por onde ele passou.

## Revisão por especialista em Google Sign-In (2026-10-02) — e onde eu estava errado

O dono pediu, com razão, um especialista. O subagente dedicado entregou
`.rebeca/pesquisa/gsis-diagnostico-2026-10-02.md`, e o resultado **corrigiu três coisas minhas**:

1. **COOP:** eu tratei o aviso como ruído inofensivo por decreto. A doc oficial de Setup diz que, **com
   FedCM desligado**, COOP mal configurado *"breaks communication between windows, leading to a blank
   pop-up window or similar bugs"*. Continua não sendo a causa **provada** aqui (o texto é condicional,
   o dev não enviava COOP nenhum, e a credencial chegou duas vezes), mas eu não tinha base para
   chamá-lo de inofensivo. **Ação:** o dev server passou a mandar
   `Cross-Origin-Opener-Policy: same-origin-allow-popups` e `Referrer-Policy: no-referrer-when-downgrade`
   (os valores que a doc pede para http + localhost) — dev e produção agora dizem a mesma coisa.
2. **`use_fedcm_for_button` foi revertido.** Eu o liguei para fugir do aviso; ele é a **única variável
   que mudou** entre os dois logins que entregaram credencial e o sintoma "clique e nada acontece", e
   tem armadilha documentada (a jornada FedCM termina em POST para o *login endpoint*; no modo popup +
   `callback` o `login_uri` é ignorado, e o padrão vira um POST para a própria página — 404 no Vite,
   **sem erro no console**). Trocar o que funcionava para fugir de um aviso foi o erro.
3. **Eu li o sintoma errado, e isso custou horas:** a tela com e-mail + `sub` é a de conta **NÃO
   autorizada** — o sucesso é o app. As duas vezes em que escrevi "o login funcionou" provaram o
   **encanamento**, não a **autorização**. E como `/api/auth/me` responde **200** para conta fora da
   lista, esse estado aparece **sem nenhum erro vermelho** — o que explica "não entra e o console só tem
   o aviso de COOP".

**Medição que fecha o estado atual:** com um diagnóstico temporário (já removido e conferido), o
servidor no ar respondeu `listaTamanho: 2` e **`probeNaLista: true`** para o `sub` da conta do dono —
os 21 dígitos batem um a um. Ou seja: **a conta dele É autorizada no servidor que está no ar agora**;
o relato de recusa veio de uma tentativa contra o servidor antigo (de ontem) ou anterior à correção da
lista. **Ficou no produto**, como instrumento permanente: o relógio de 15 s do `click_listener` e a
linha de contagem na tela de entrada — o teste de 1 minuto que separa as cinco causas possíveis (A–E),
sem precisar abrir o console.

**Não verificado:** o `rebeca-qa` também não conseguiu (e declarou) que um token **legítimo** seja
aceito — isso exige um login real; e ele mediu a suíte com um desvio de ambiente, pedindo confirmação
com `pnpm test` puro, que foi feito nesta árvore depois das correções (números na tabela de
verificação acima e em `.rebeca/evidencias/autenticacao-google.txt`).

**Próximo passo imediato (é do dono, e nada disso depende de código):**

1. **Parte 3 do runbook** — Vercel → Settings → Environment Variables: `GOOGLE_CLIENT_ID`,
   `REBECA_ALLOWED_SUBS` e a chave do provedor. Sem `GOOGLE_CLIENT_ID` o app publicado responde
   **503** em tudo (falha fechada, de propósito).
2. **Login local** (`pnpm dev`): a tela de entrada mostra o `sub` da conta; ele vai para
   `REBECA_ALLOWED_SUBS` (no `.env` local e na Vercel). É o caminho que destrava o primeiro acesso.
3. **Parte 4** — conferir no navegador: sem login nenhuma tela abre; com login autorizado a geração
   funciona e a linha de custo sai com o `sub` na última coluna.

**Achado que corrige uma promessa do próprio `ADR-014` (registrado no §9 do adendo):** a versão
publicada **não** passa a gerar só por estar autenticada. O teto diário depende de livro de custos
durável, que não existe em serverless (achado `QA-006 #1`), então **a geração paga continua recusada
com 403** em produção até haver banco (decisão **D1**) ou até o aceite explícito de
`REBECA_ALLOW_NO_LEDGER=1` — que significa gastar sem teto diário efetivo. São travas diferentes (quem
pode gastar × quanto se pode gastar), e autenticar resolveu só a primeira.

## Publicação na nuvem — **publicada e verificada em produção** (2026-09-30)

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
| Projeto na Vercel | ✅ **no ar** em `https://rebeca-odda.vercel.app` — o dono importou. ⚠️ há **dois** projetos recebendo este repositório (`rebeca-odda` e `rebeca`): convém manter um só |
| Prova do rewrite de SPA | ✅ `https://rebeca-odda.vercel.app/c/luna/inicio` → **HTTP 200** (`web_fetch`, 2026-09-30). Fecha o item 3 da verificação do `ADR-003` — deixou de ser premissa |
| Funções serverless em produção | ❌ **HTTP 500** em `GET /api/ai/status` e `GET /api/ai/settings` — JSON de erro genérico da Vercel, não o HTML do app. **O rewrite NÃO atropela `/api/*`** (a função é alcançada); a função é que quebra. **Hipótese principal, corrigindo um descarte errado meu:** os imports de `server/` e `api/` são **sem extensão** e o `package.json` é `"type": "module"` — em ESM o Node exige extensão, e a reprodução local com `VERCEL=1` falha com `Cannot find module …`, o **mesmo sintoma**. Confirmar no log da função na Vercel (Functions → Logs). Detalhe no `ADR-003`, item 3 da Verificação |

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
| **CI no GitHub** | run [`36769295864`](https://github.com/donclaudito/rebeca/actions/runs/36769295864) | ✅ **success**, 8/8 steps verdes no `ubuntu-latest` (commit `b03cbb7`): checkout com `fetch-depth: 0`, pnpm (`Downloading pnpm 11.25.0` — o pin do `packageManager` foi lido), varredura de segredo árvore+histórico, tipos, testes, build, artefato |
| Pin do pnpm honrado no runner | log do step `pnpm + Node` | ✅ `Downloading pnpm 11.25.0 from the npm registry` (antes do fix baixava 11.28.3 pelo `version: 11`) — CI, máquina local e o pin da Vercel dizem a mesma versão |

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

1. **RESOLVIDO em 2026-09-30:** a URL existe e o rewrite de SPA **foi provado** com HTTP 200 em rota
   profunda (`/c/luna/inicio`) — ver a tabela acima. O que **substitui** este item como pendência é o
   **HTTP 500 das funções serverless** (`/api/ai/status`, `/api/ai/settings`), cuja causa-raiz segue
   `NÃO VERIFICADO` por exigir o log de runtime da Vercel.
   **Registro do que a previsão acertou:** `ai-media-studio.vercel.app` **é de terceiro** (HTTP 200
   servindo outro produto de vídeo com IA) e por isso a produção acabou em `rebeca-odda.vercel.app`.
   Isso alimenta a decisão **D7** (nome do produto).
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

## Auditoria de segurança — 2026-09-30 (skill `rebeca-seguranca`)

Entregável: **`docs/seguranca/threat-model.md`** — ativos, fronteiras de confiança, 10 ameaças com
controle e teste por ameaça, o que está fechado, o que está aberto com dono, e o que segue
`NÃO VERIFICADO`. Leia lá para o detalhe; aqui fica o resumo e a evidência.

### Fechado nesta auditoria (com teste que refuta)

**S1 — a aprovação humana era decorativa (severidade alta).** `approve()` marcava
`status: 'agendado'` e **nada** prendia a aprovação ao conteúdo aprovado: `saveTitle()` e
`selectThumbnail()` mudavam título, descrição e thumbnail **depois** da aprovação, e o estado
continuava `agendado`. O que iria ao ar não era o que o humano aprovou — o invariante nº 1 era
carimbo, não controle. Corrigido com `ApprovalRecord` (impressão da versão aprovada, canal, data),
invalidação da aprovação em toda edição de artefato e o portão `assertPublishable()`, que recusa
publicar sem aprovação vigente que bata com o conteúdo atual. A tela de revisão passa a mostrar o
fato ("Aprovação humana registrada em …" / "Sem aprovação vigente").

**S2 — entradas sem teto na camada de dados.** `saveTitle` só tinha mínimo (título de 1 MB passava),
`reject` não tinha teto (o motivo vai virar prompt de IA) e `reschedule`/`approve` gravavam
**qualquer string** como data ("amanhã de manhã" virava `scheduledAt`). Agora: título 3–100 (mesmo
teto do campo da tela), motivo 3–400 (mesmo teto do schema de IA em `src/ai/schemas.ts`), data
validada e normalizada para ISO, e caracteres de controle removidos do texto.

**S3 — máquina de estados sem guarda.** Dava para "aprovar" conteúdo já **publicado**, reagendar o
que está no ar e rejeitar um vídeo publicado — o estado local deixava de descrever a realidade. Cada
ação agora declara de onde pode partir.

**S4 — o scanner de segredo não achava a chave da Anthropic (severidade alta).** Provado
empiricamente: `sk-[A-Za-z0-9]{32,}` **não casa** `sk-ant-api03-…`, porque o hífen depois de `sk-`
interrompe a classe de caracteres — a varredura dizia "limpo" com uma credencial da Anthropic
commitada. O formato foi confirmado na fonte oficial
([platform.claude.com/docs/en/manage-claude/authentication](https://platform.claude.com/docs/en/manage-claude/authentication),
lida em 2026-09-30: "Static `sk-ant-api...` secret sent as a bearer token in the `Authorization`
header"). Padrão `anthropic-key` adicionado. Arquivo rastreado acima de 2 MB deixou de ser pulado em
silêncio: virou **AVISO** na saída. E o scanner ganhou prova própria,
`.tools/test_scan_secrets.py` (12 positivos, 5 negativos, UTF-16LE), rodado **no CI antes** do
scanner — um scanner sem teste é afirmação sem prova.

**S5 — deploy sem CSP e sem HSTS.** `vercel.json` não tinha `Content-Security-Policy` nem
`Strict-Transport-Security`: a única defesa contra XSS era o escape do React. Agora tem CSP estrito
autorizando por **hash sha256** o único script inline (o de tema, que a sessão paralela adicionou ao
`index.html`), com `object-src`, `base-uri`, `form-action` e `frame-ancestors` fechados. O hash foi
calculado do **artefato de produção** e confere byte a byte com o fonte (524 bytes, mesmo sha256).
`src/__tests__/headers.test.ts` lê `index.html` e `vercel.json` do disco e falha se o hash divergir.
Decisão e alternativas em **`ADR-008`**.

### S6 — fechado nesta auditoria, mas **exigiu refutar o teste que já existia**

**S6 (alta) — chave do provedor de IA chegando ao navegador pelo caminho real do adaptador.**
O sintoma inicial era um teste do próprio autor, vermelho: "não vaza chave nem corpo cru do provedor
na mensagem de erro". Quando ele ficou verde, **conferi em vez de aceitar** — e o verde era falso.

O teste planta a chave jogando um `Error` **comum** de dentro do `transport` injetado. Esse caminho
cai no ramo de "erro inesperado" de `handleGenerate`, que **aplica** `redact()`. O caminho que roda
de verdade com chave configurada é outro:

```
handleGenerate → callProvider → PROVIDERS[openai].complete → postJson
  → 401 → safeProviderMessage(body)   [providers.ts:83, sem redact]
  → providerError(...) → AiError com o texto do provedor em `detail`
  → catch: `if (error instanceof AiError) throw error;`   ← passava direto, sem filtro
  → http.ts: `error.toBody()`   → resposta HTTP ao navegador
```

**Provado, não deduzido.** `src/ai/__tests__/vazamento-provedor.test.ts` (2 casos) injeta um `fetch`
que devolve 401 ecoando o `Authorization` — pelo **adaptador OpenAI real**, sem transporte de teste —
e reproduz o vazamento com o corpo exato que o `http.ts` serializa:

```
{"code":"provedor","message":"O provedor de IA não respondeu como esperado. …",
 "detail":"HTTP 401 — invalid_api_key: Incorrect API key provided: Authorization: Bearer sk-chaveDeTeste…"}
```

**Correção aplicada** (`server/ai/handler.ts`, no ponto de saída do `AiError`): o erro é reemitido
com `message` e `detail` passando por `redact()`. Escolhi o ponto de saída, e não
`safeProviderMessage`, de propósito: vale para **todo** adaptador — inclusive os que ainda não
existem — e também protege quem consome `handleGenerate` sem ser HTTP (log, job). Não exigiu mover
`redact` para módulo próprio, então não criou ciclo de import.

**Evidência:** `.rebeca/evidencias/seguranca-vazamento-provedor.txt` — **2 falhas antes** (a chave no
corpo), **2/2 depois**, e os **30 testes do autor continuam verdes**.

**Lição que fica registrada:** teste verde que exercita o caminho errado é pior que teste ausente —
ele certifica uma garantia que não existe. Quem revisa tem de perguntar *por onde o ataque entra de
verdade*, não só se a asserção passa.

### S7 — fechado pela sessão paralela (verificado por mim, não presumido)

**S7 (alta) — teto de custo não aplicado, custo fantasma e gate do canal infantil.** Os três testes
estavam vermelhos. A sessão paralela corrigiu durante esta auditoria: `handler.ts:382` recusa com
`teto-diario` antes de enviar ao provedor, o custo da tentativa que falhou passou a ser registrado
(`(falhou)` no livro) e o override de ambiente deixou de furar o gate infantil
(`catalog.ts:352` + a mensagem em `handler.ts:198`). **Verifiquei no código e na suíte**: os 30
testes do `handler.test.ts` passam.

**O que continua aberto em S7:** **nenhuma rota `/api/ai` tem autenticação.** Qualquer um que
alcance o deploy consome a chave configurada, mesmo com o teto diário. O teto limita o dano, não
substitui autenticação. **Continua bloqueando ligar geração paga em ambiente público.**

**S8 (média) — contradição entre `.env.example` e o gate infantil.** `.env.example` documenta
`REBECA_ALLOW_UNVERIFIED_MINOR_POLICY=1` como "permite usar, no canal infantil, fornecedor cujo termo
não foi verificado"; o teste do autor exige que o override **não** fure o gate do canal infantil.
As duas coisas não podem ser verdade ao mesmo tempo. O código hoje faz o que o teste pede (o gate
manda), então o **texto do `.env.example` é que está errado** — mas a decisão de quem cede é do dono
do produto, porque envolve conformidade com menor. Não editei o `.env.example` para não arbitrar
sozinho uma decisão de conformidade.

### Verificação (comando + resultado observado)

| Verificação | Comando | Resultado |
|---|---|---|
| Aprovação — **antes** | `pnpm exec vitest run src/data/__tests__/aprovacao.test.ts` | ❌ **12 falhas / 15** — `.rebeca/evidencias/seguranca-aprovacao-red.txt` |
| Aprovação — **depois** | idem | ✅ **15/15** — `.rebeca/evidencias/seguranca-aprovacao-green.txt` |
| Cabeçalhos e CSP | `pnpm exec vitest run src/__tests__/headers.test.ts` | ✅ **8/8** — `.rebeca/evidencias/seguranca-headers.txt` |
| CSP — prova adversarial | trocar 1 caractere do hash e rodar | ✅ ficou **vermelho** (1 falha), depois restaurado |
| Teste do scanner | `python .tools/test_scan_secrets.py` | ✅ 12 positivos, 5 negativos, UTF-16LE |
| Scanner — prova adversarial | remover o padrão `anthropic-key` e rodar | ✅ **3 falhas** (positivo não detectado), depois restaurado |
| Varredura real | `python .tools/scan_secrets.py --history` | ✅ limpo em **269 blobs** (árvore + histórico) |
| Hash do CSP × artefato | `pnpm exec vite build` + sha256 do script inline | ✅ `sha256-qpRjRiAM…` idêntico em `index.html` e `dist/index.html` |
| Dependências | `pnpm audit --audit-level=moderate` | ✅ nenhuma vulnerabilidade conhecida |
| Vazamento S6 — **antes** | `pnpm exec vitest run src/ai/__tests__/vazamento-provedor.test.ts` | ❌ **2/2 falharam**, com a chave no corpo enviado ao navegador — `seguranca-vazamento-provedor.txt` |
| Vazamento S6 — **depois** | idem + `handler.test.ts` | ✅ **32/32** (2 do vazamento + 30 do autor) |
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 (o erro de `src/ai/hooks.ts` foi corrigido pela sessão paralela) |
| Suíte completa | `pnpm exec vitest run` | ⚠️ **93/95** — 2 falhas **por tempo** (`Test timed out in 20000ms`), ver abaixo |
| **As 3 suítes de segurança desta auditoria** | `pnpm exec vitest run src/__tests__/headers.test.ts src/data/__tests__/aprovacao.test.ts src/ai/__tests__/vazamento-provedor.test.ts` | ✅ **25/25** — `.rebeca/evidencias/seguranca-final.txt` |
| **`pnpm build` no fim da auditoria** | `pnpm build` | ❌ **vermelho, e não por causa desta auditoria** — ver "Estado do build" abaixo |

### Achado de passagem: um byte corrompido quebrava o build inteiro

Durante a verificação final, `tsc` recusou `src/ai/contract.ts` com **`TS1490: File appears to be
binary`**. A causa: um **byte `0xFF` órfão prependido** ao arquivo — UTF-8 inválido, sem BOM, sem NUL.
O `vitest`/esbuild tolerava (por isso a suíte passava), mas `tsc` não: **`pnpm build` estava quebrado**,
e com ele o build da Vercel. Um arquivo de código tratado como binário é o tipo de falha que passa
despercebida até o deploy.

Varri a árvore inteira em busca do mesmo padrão (UTF-8 inválido, NUL, byte alto no início): **só esse
arquivo** estava afetado. A sessão paralela regravou o arquivo e o byte desapareceu antes de eu
precisar intervir — mas, no instante seguinte, ela iniciou uma refatoração em `contract.ts`
(`estimatedCostUsd` removido do registro enquanto a interface ainda o exige), e **o `tsc` voltou a
ficar vermelho**. Isso é trabalho em andamento dela, não desta auditoria: **`tsc` esteve exit 0 às
18:27**, com todas as mudanças desta auditoria já aplicadas.

**Fica o alerta:** enquanto as duas frentes escreverem na mesma pasta, o build pode estar vermelho a
qualquer instante por causa de escrita alheia no meio do caminho. A verificação desta auditoria vale
para o que ela tocou (25/25 nas três suítes, exit 0 medido no `tsc` às 18:27); **não** vale como
atestado do estado do repositório na hora em que você ler isto.


**As 2 falhas da suíte completa não são do produto.** `channel-scope.test.tsx` e `revisao.test.tsx`
falharam por `Test timed out in 20000ms` com a máquina sob contenção (as duas sessões rodando suítes
ao mesmo tempo: 22,7 s e 53,7 s de render). Rodadas **em isolamento logo depois**, passaram —
9,1 s e 19,5 s, **8/8**. É a intermitência já registrada nesta página, e o sintoma é sempre tempo,
nunca asserção. **Atenção:** `revisao.test.tsx` levou 19,5 s com a máquina quase ociosa, contra o
`testTimeout` de 20 s. A suíte está na borda do próprio limite nesta máquina; **subir o limite de
novo esconderia o problema real**, que é rodar duas sessões de agente na mesma pasta (D9).


### Concorrência — terceira vez, agora com dano mensurável

Esta auditoria rodou **em paralelo com outra sessão de agente na mesma pasta**. Dano concreto,
diferente do que já estava registrado (que era só lentidão de teste):

1. `src/features/revisao/RevisaoPage.tsx` foi regravado **entre a leitura e a edição** deste agente —
   a ferramenta recusou a edição e exigiu releitura. O trabalho não se perdeu, mas por pouco.
2. **Numeração de ADR colidiu duas vezes.** A sessão paralela criou `ADR-006-linguagem-visual-youtube.md`
   e, em seguida, `ADR-006-camada-de-llm-por-funcao.md` — **dois ADR-006**. Ao renomear o primeiro
   para 007 (`18:11:35`), colidiu com o **meu** 007 (`18:11:12`), criando **dois ADR-007**. Resolvido
   cedendo o número: o meu virou **`ADR-008-csp-e-hash-do-script-inline.md`**.
3. A renomeação deixou **referências quebradas**: `docs/03-design-system.md` apontava para
   `ADR-006-linguagem-visual-youtube.md`, arquivo que deixou de existir. Corrigido para `ADR-007`
   (linhas 15 e 83) — mas é sintoma, não causa.

> **Atualização (mesma sessão, depois desta auditoria):** o número final do ADR de linguagem visual
> **não é 007**. Ao ceder o 007, a outra sessão caiu no 008 — e o meu arquivo, que já era 008, virou
> **`ADR-009-linguagem-visual-youtube.md`**. As linhas 15 e 83 do `docs/03` **já apontam para ADR-009**.
> O `ADR-007` fica **vazio de propósito**: foi o número disputado no mesmo minuto, e renumerar de novo
> apagaria o rastro da colisão. Se você chegou aqui procurando o ADR da linguagem visual, ele é o
> **009** — e ele mesmo carrega uma nota de numeração.

**Recomendação:** a decisão **D9** (as duas frentes na mesma pasta) deixou de ser questão de higiene
e virou risco de integridade. Enquanto ela estiver aberta, **um escritor só por vez**: ou a frente
paralela entra na orquestra, ou cada frente trabalha em branch própria. Numeração de ADR e o
`estado.md` não são arquivos que aceitam dois escritores simultâneos.

## O portão de fornecedor chegou ao caminho de vídeo — e o Gemini Omni foi recusado (2026-10-01)

**O pedido do dono.** Usar o **Gemini Omni 1.1 Flash** ("Omni 1.1", `gemini-omni-1.1-flash`) como motor de
vídeo, porque o Google o está oferecendo gratuitamente, para desenhos animados 2D/3D no canal infantil.
O objetivo declarado era **não provocar censura** da plataforma.

**A resposta foi não, e o motivo não é opinião de agente.** A allow-list do canal — aprovada pelo próprio
dono em 2026-10-01 — traz `google / * / * → PROIBIDO`, com o fundamento na cláusula literal de *Age
Requirements* dos Gemini API Additional Terms: *"You also will not use the Services as part of a website,
application, or other service … that is directed towards or is likely to be accessed by individuals under
the age of 18."* Relida na fonte oficial nesta sessão; a página traz `last updated 2026-04-28`.
([ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms)) O tier **gratuito piora** o
quadro: em serviço não pago o Google usa o conteúdo enviado e as respostas para treinar, **revisores
humanos podem ler e anotar** entrada e saída, e os termos instruem a não enviar informação sensível.

**Duas correções factuais que valem mais que o código:**

1. **A premissa estava invertida.** "Parecer real" **aumenta** o atrito, não reduz: desde maio/2026 o
   YouTube joga o rótulo de IA **para cima do player** quando o conteúdo é fotorrealista, e o esconde na
   descrição quando é **animação** — além de detectar IA automaticamente e manter a divulgação
   **permanente** para conteúdo de ferramentas próprias (Veo/Dream Screen).
   ([blog.youtube](https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/)) Existe
   pressão ativa para **banir "Made for Kids" gerado por IA**
   ([Fairplay + AFT + MAMA + Haidt, abril/2026](https://me.mashable.com/tech/69197/youtube-ai-slop-is-a-generational-threat-child-safety-experts-warn-in-new-petition)).
   O dono escolheu, na mesma conversa, **personagem estilizado 2D/3D 100% fictício** — o caminho de menor
   risco. Ficou registrado o limite que não se negocia: **nenhuma imagem, semelhança ou voz de criança real
   identificável**, e nada desenhado para escapar de detecção.
2. **O trabalho real não era integrar o Omni — era fechar um furo.** O portão da allow-list existia desde
   o `ADR-012` e protegia **uma única rota: a de thumbnail**. O caminho de vídeo, **~96% do custo de um
   episódio**, atravessava **sem consulta**: trocar o provedor de vídeo por um `PROIBIDO` ou
   `NAO-VERIFICADO` **geraria normalmente, com dinheiro real**. A política valia para a etapa barata e não
   valia para a cara. Este arquivo já registrava a lacuna — ela foi fechada agora.

**Causa-raiz, e por que ela não era óbvia:** as quatro interfaces de mídia declaravam `id` e `simulated`,
mas **não declaravam `model`** — e a allow-list é chaveada por `(fornecedor, modelo, finalidade)`. Sem o
modelo, **o pipeline não tinha como perguntar**. Só `ThumbnailProvider` declarava `model`, e é exatamente
por isso que só o caminho de thumbnail tinha portão.

| Camada | Arquivo |
|---|---|
| `ProviderIdentity` (`id` + `model`) nas quatro interfaces de mídia | `src/media/contract.ts` |
| Os quatro provedores simulados declaram o modelo | `server/media/providers/simulated.ts` |
| Portão no topo de `runSimulatedEpisode`, antes do ffmpeg e antes do gasto | `server/media/simulated-episode.ts` |
| Suíte hermética + 3 testes novos do portão | `src/media/__tests__/media-render.test.ts` |
| Decisão, alternativas e consequências | `.rebeca/decisoes/ADR-013-portao-de-fornecedor-no-caminho-de-video.md` |

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Testes do caminho de vídeo | `pnpm exec vitest run src/media/__tests__/media-render.test.ts --reporter=verbose` | ✅ **6/6** (eram 3) — `.rebeca/evidencias/portao-fornecedor-video.txt` |
| Suíte completa (isolada, sem servidor no ar) | `pnpm exec vitest run` | ✅ **273/273 em 26 arquivos**, exit 0, 149,83 s — `.rebeca/evidencias/vitest-portao-fornecedor.txt` |
| Build de produção | `pnpm run build` | ✅ exit 0 — 1982 módulos · css 38,71 kB · js 505,50 kB — `.rebeca/evidencias/build-portao-fornecedor.txt` |
| **CLI real com a allow-list de PRODUÇÃO** | `node .tools/render-episodio.mjs` | ✅ passou o portão · **0 gerados**, 13 reusados · longo 1920×1080@30, Short 1080×1920 — `.rebeca/evidencias/portao-fornecedor-cli.txt` |
| **Prova adversarial por mutação** | remover o bloco do portão e rodar os testes novos | ✅ **3 vermelhos, os 3 certos**; restaurado **byte a byte** (sha256 `CC508C94…` idêntico) — `.rebeca/evidencias/portao-fornecedor-mutacao.txt` |

**Os três vermelhos da mutação, cada um pelo motivo certo:** (1) fornecedor `PROIBIDO` — o episódio
**gerou** com o Google quando o portão sumiu; (2) canal sem allow-list — "não configurado" virou
"liberado"; (3) cache quente — a reexecução passou como passe livre.

**Duas decisões de desenho que valem registro:**

1. **O portão vem antes do portão de gasto.** O `ADR-005` diz literalmente que a allow-list existe para
   **"impedir o preço de justificar o fornecedor"**. Invertida a ordem, um provedor barato seria
   comparado com o teto antes de alguém perguntar se pode operar naquele canal.
2. **O portão roda mesmo quando tudo seria reusado.** É política, não gasto — e a reexecução é o caminho
   mais comum do pipeline. Um portão que se desliga quando o cache acerta some justamente aí. Há teste
   próprio para isso, com o cache quente de verdade.

**Um teste existente mudou de motivo, e isso foi dito em voz alta.** O teste "recusa gerar com provedor
PAGO e sem estimativa" usava um provedor falso que **não estava** na allow-list; com o portão novo ele
seria recusado por **política**, e o teste ficaria verde **pelo motivo errado**. O provedor falso passou a
ser `PERMITIDO` de propósito, com o comentário explicando por quê.

**Achado que a implementação expôs — e que precisa de decisão do dono.** A allow-list grava a entrada de
vídeo real como `minimax / MiniMax-H3-768P / finalidade **video**`, enquanto a etapa do pipeline se chama
**`animacao`**. Como o casamento é exato, **trocar o provedor de vídeo para a Stack A aprovada hoje é
recusado**. É o default conservador funcionando (recusar > permitir), mas é um bloqueio real: renomear a
entrada ou acrescentar a finalidade `animacao` à mesma aprovação. **Não foi feito** — é dado aprovado por
humano, e corrigir política em silêncio é pior que recusar.

**Não verificado (declarado, não maquiado):**

1. **A revisão adversarial do `rebeca-qa` não foi executada** sobre esta entrega.
2. **O bloqueio do Google não passou por advogado.** A cláusula é literal e foi conferida na fonte, mas é
   interpretação contratual — a **D11** segue aberta, e é dela que depende qualquer reabertura.
3. **Nenhum provedor pago real foi exercitado.** O portão foi provado com provedores simulados e com um
   provedor falso injetado; não há chave da MiniMax nesta máquina.
4. **Não existe rota HTTP que rode o episódio** — o caminho de vídeo só é alcançável pela CLI. O portão
   não foi exercitado por requisição, e ninguém pode disparar geração de vídeo pela interface (é a D1).
5. **A reconciliação `video` × `animacao`** na allow-list é decisão humana pendente.
6. **Duas sessões na mesma árvore (D9):** `server/media/paths.ts` aparece modificado no `git status` e
   **não foi tocado por esta entrega**; `allow-list.ts`, `thumbnails.ts`, `minimax.ts`, `http.ts`,
   `library.ts`, `vite-plugin.ts` e vários testes de mídia seguem **não commitados** de sessões
   anteriores. **Nada foi commitado.**

## O custo deixou de ser inventado, e a etapa Criar ganhou botão (2026-10-02)

**O relato, com captura de tela.** O dono apontou o espaço do vídeo na tela de Revisão — *"Prévia do
vídeo · 8:12 planejados / nenhum vídeo foi gerado ainda"*, com **"Custo real US$ 42,80"** logo abaixo — e
disse: *"esta função nao funciona, usa ai para gerar video"*.

**Ele estava certo por dois motivos, e o segundo é pior que o primeiro.**

1. **Não havia função.** `RevisaoPage.tsx` tinha um `ArtSlot` com `note="nenhum vídeo foi gerado ainda"`:
   string fixa, sem botão, sem player, sem rota. `api/media/` só tinha `episodes`, `episode` e
   `thumbnails` — nenhuma rota gera vídeo.
2. **O "Custo real" era inventado.** `costUsd: 42.8` é literal em `src/data/mock/db.ts:170`. O livro de
   custos, para o mesmo conteúdo, somava **US$ 0,3956**. **108× de diferença**, com rótulo de verdade, na
   tela em que a decisão é humana.

**O que passou a existir:**

| Camada | Arquivo |
|---|---|
| `contentSpend()` — soma real do livro, por etapa | `server/media/ledger.ts` |
| `GET /api/media/custos?channelId=&contentId=` | `server/media/http.ts` + `api/media/custos.ts` (+ guarda em `serverless-imports.test.ts`) |
| `fetchContentCost` / `useContentCost` (chave com canal **e** conteúdo) | `src/media/client.ts` · `src/media/hooks.ts` · `src/media/view.ts` |
| `formatUsdCost` — não arredonda custo de API para "US$ 0,00" | `src/lib/format.ts` |
| Tipos `Roteiro`, `RoteiroBloco`, `Cena`, `Storyboard` no conteúdo | `src/data/types.ts` |
| `saveRoteiro` / `saveStoryboard` (por `patchArtifact`) | `src/data/client.ts` |
| Seção **"Roteiro e cenas"** (etapa 1) com os dois `AiAction` | `src/features/revisao/RevisaoPage.tsx` |

**Três decisões que valem registro:**

1. **"Não sei" continua sendo diferente de "gastei zero".** Sem spec de mídia não dá para filtrar o
   livro (ele guarda o **nome** do canal, não o id), e a resposta é `ledgerAvailable: false` com motivo.
   Trocar isso por zero seria substituir um número inventado por outro.
2. **Gravar roteiro descarta o storyboard.** As cenas foram derivadas de um roteiro que deixou de
   existir; mantê-las seria estado mentiroso — o mesmo motivo pelo qual `proposeThumbnails` limpa a
   escolha anterior. E `saveStoryboard` **recusa** sem roteiro: cena sem narração de origem é linhagem
   inventada.
3. **O slot do vídeo deixou de ser frase fixa.** Agora ele é derivado e nomeia o que falta — *"falta o
   roteiro; as cenas do storyboard; um provedor de vídeo real"*. Era exatamente essa a queixa: a frase
   não dizia **o que** faltava.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Testes novos (livro + roteiro/cenas) | `pnpm exec vitest run src/data/__tests__/roteiro-cenas.test.ts src/media/__tests__/media-custos.test.ts src/__tests__/serverless-imports.test.ts` | ✅ **21/21** — `.rebeca/evidencias/roteiro-cenas-custo.txt` |
| Tela de Revisão | `pnpm exec vitest run src/features/revisao` | ✅ **15/15** (eram 11) — `.rebeca/evidencias/vitest-revisao-custo.txt` |
| **Custo real AO VIVO** | `GET /api/media/custos?channelId=luna&contentId=luna-borboletas` | ✅ `totalUsd 0.42574`, 71 lançamentos, por etapa (`criar` 0,3749 · `revisar` 0,0344 · `thumbnail` 0,0164) |
| Suíte completa, isolada | `pnpm exec vitest run` | ⚠️ **6 falhas** na rodada com a máquina carregada; os **3 arquivos passam 26/26** logo depois, isolados — contenção de CPU, não defeito |

**Defeito real encontrado pelos próprios testes (corrigido):** a primeira versão da tela fazia
`custoReal.data.byStage.length` sem conferir a forma da resposta. Com o servidor devolvendo outra coisa,
o `.length` estourou **dentro do render** e a tela de Revisão ficou **em branco** — oito testes vermelhos
por consequência. Normalizado na fronteira (`custo`, `custoDisponivel`, `custoEtapas`).

**Não verificado:** nenhuma geração de vídeo real (o provedor de vídeo da Stack A continua sem adapter);
o `docs/04` §5 não foi revisado para descrever a nova rota; a reconciliação `video` × `animacao` da
allow-list segue pendente (é o que impede trocar o provedor de vídeo para a Stack A).

## `criar-roteiro` não cabia no teto de 90 s — medido, e corrigido na configuração (2026-10-02)

**O dono clicou no botão novo e recebeu erro.** *"porque nao funcionou?"* — e a resposta não podia ser
conjectura.

**Reprodução pelo HTTP, três vezes, com `curl.exe`:**

```
HTTP=504   tempo=90.241751s
{"code":"provedor","message":"O provedor demorou mais de 90 s e a chamada foi cancelada. Nada foi
 gerado e nada foi cobrado — … escolha um modelo mais rápido para esta função…",
 "detail":"tempo esgotado na chamada ao provedor","retryable":true}
```

**Zero linhas** para `criar-roteiro` no livro — e **zero** linhas `(falhou)` em livro nenhum. O "Nada foi
gerado" da tela era verdade.

**A causa:** o teto de **90 000 ms** (`AI_LIMITS.requestTimeoutMs`, `src/ai/limits.ts:33`, aplicado em
`server/ai/handler.ts:837`) contra a função **mais pesada do registro** — `criar-roteiro` pede o roteiro
inteiro de um episódio de 8:12 numa resposta só (até 40 blocos, narração de 1.200 caracteres cada,
`maxOutputTokens: 4000`) — apontada para o nível `criativo`, que resolve para **`gpt-6.1-sol`, um modelo
de raciocínio**.

**Correção aplicada — configuração, não código** (autorizada pelo dono nesta sessão):

```
PUT /api/ai/settings  {"functionModels":{"criar-roteiro":"openai:gpt-6-luna"}}
→ {"changed":["função criar-roteiro: openai:gpt-6-luna"]}
```

| Verificação | Resultado |
|---|---|
| `criar-roteiro` com `gpt-6-luna` | ✅ **HTTP 200 em 60,03 s** · 24 blocos · 2.140 in / 7.305 out |
| Custo real | ✅ **US$ 0,0038665**, `costSource: real`, gravado como `criar-roteiro@v1` |
| `criar-cena` com o modelo atual (`gpt-6.1-sol`) | ✅ **HTTP 200 em 37,97 s** — **medido, não suposto**: não precisava mudar |

**O que isso NÃO resolve, e é o mais importante:**

1. **60 s de um teto de 90 s** — só 33% de folga. Um episódio mais longo, ou a máquina sob carga, e o
   timeout volta. Isto é paliativo, não conserto: `criar-roteiro` é **job**, não request (D1).
2. **`criar-cena` devolveu UMA cena para um vídeo de 492 s.** O schema permite de 1 a 60 e o modelo
   escolheu 1. O storyboard sai inutilizável — defeito de qualidade, não de tempo.
3. **O próprio modelo denunciou a falta do Character Sheet**, por escrito, na saída: *"Luna é a
   personagem fictícia do canal; seus traços oficiais de cor, formato, roupa e marca não foram
   fornecidos e dependem de referência antes da geração"*, e o `promptImagem` saiu literalmente como
   *"Luna, the fictional channel character **whose appearance requires the missing official
   reference**"*. O bloqueador nº 2 da animação deixou de ser afirmação do projeto e passou a ser
   afirmação do modelo.

**Não verificado:** a mensagem que o dono viu na tela (**"O provedor de IA não respondeu como
esperado"**) vem de um ramo **diferente** (`providers.ts:176`, `catch` que não reconhece o aborto; ou
`:189`, erro HTTP do provedor) — nas três reproduções eu caí sempre no ramo do tempo esgotado. **Não sei
qual ramo a tentativa dele atingiu, e a razão de não saber é um defeito:** a tela esconde o campo
`detail` (`AiComponent/AiAction.tsx` diz, em comentário, que o detalhe "não é exibido"), e é ele que
responde *por quê*. Registro completo em `.rebeca/evidencias/roteiro-nao-funcionou.txt`.

**Configuração da máquina alterada nesta sessão:** `.rebeca/segredos/llm.json` agora tem
`functionModels: {"criar-roteiro":"openai:gpt-6-luna"}`. Desfazer é uma chamada (`…: null`). O backup
temporário do arquivo foi **removido** para não deixar segunda cópia da chave em disco (`.rebeca/segredos/`
é ignorado pelo git — conferido com `git check-ignore`).

## **HTTP 502 em `/api/ai/generate` — a causa raiz é o teto de tokens das funções da etapa Criar (2026-10-02)**

O dono colou o erro do console do navegador: `502 (Bad Gateway)` em `/api/ai/generate`. A tela esconde o
`detail`; capturado por HTTP direto:

```
functionId=criar-cena  →  HTTP 502  em 119,97 s
  code   : schema-invalido
  detail : $: esperado objeto, veio undefined
  message: A resposta não passou na validação do contrato e a correção automática não resolveu.
```

**O número que fecha a conta está no livro:** todas as falhas de `criar-cena` têm
**`tokens_out = 6000`** — e `6000 = 2 × 3000`, porque a linha soma a tentativa que falhou com a de
reparo. Teto batendo, dos dois lados.

| Peça | Valor |
|---|---|
| Teto de saída pedido por `criar-cena` / `criar-roteiro` | **3000** / **4000** (`src/ai/contract.ts`) |
| O orçamento é o menor entre função, prompt e modelo | `server/ai/handler.ts:520` → `outputTokenBudget` (`catalog.ts:459`) |
| O que o schema **exige** | até **60 cenas**, cada uma com `promptImagem` de 1200 e `descricao` de 500 caracteres (`src/ai/schemas.ts:316`) |

Um storyboard de 24 blocos, no formato que o próprio schema manda produzir, **não cabe em 3000 tokens**.
O modelo trunca, o handler tenta reparar, trunca de novo, e sai **502** depois de ~120 s — **cobrando as
duas tentativas**.

**Duas consequências, e a segunda é pior que a primeira:**

1. **Dinheiro queimado.** As três falhas custaram **US$ 0,2127** — 21% do teto diário de US$ 1,00
   (`spentTodayUsd` foi de 0,3794 para 0,4752 durante a reprodução). Nada aproveitado.
2. **Quando "passa", passa errado.** A execução bem-sucedida emitiu **1 cena** em 1388 tokens — o modelo
   "cabe" no teto emitindo quase nada. **Storyboard de uma cena para um vídeo de 492 s é inútil.** O
   mesmo teto produz o erro *e* o resultado vazio; não são dois defeitos.

**Isso reclassifica o conserto anterior:** trocar `criar-roteiro` para `gpt-6-luna` resolveu o **sintoma
de tempo** (o 200 veio com 7305 tokens somados — ele também truncou e reparou, e desta vez a segunda
tentativa fechou o JSON). **O teto continua errado nas duas funções.**

**O conserto de verdade é gerar por lotes:** `criar-cena` recebe poucos blocos e devolve poucas cenas, e a
tela orquestra N chamadas com progresso. Aumentar o teto não resolve — dezenas de milhares de tokens
estouram o teto por chamada (US$ 0,05) e os 90 s. Muda contrato, prompt (`criar-cena@v2`, versionado com
hash), schema e tela — e é o mesmo problema de job longo da D1.

Evidência: `.rebeca/evidencias/502-criar-cena-teto-de-tokens.txt`.

## **`criar-cena` passou a trabalhar por lotes — o 502 fechado, com medição antes e depois (2026-10-02)**

Conserto escolhido pelo dono entre quatro opções. O desenho estava errado, não o número: uma função que
recebe N blocos e devolve N cenas não escala dentro de um teto de saída **e** de tempo.

**O que mudou:**

| Camada | Antes → Depois |
|---|---|
| Schema de entrada (`src/ai/schemas.ts`) | `blocos` até **40** → até **3** |
| Schema de saída | `cenas` até **60** → até **4** |
| Prompt | `criar-cena@v1` → **`criar-cena@v2`** (a v1 foi removida: o gerador recusa duas versões ativas do mesmo `prompt_id`) |
| Contrato (`src/ai/contract.ts`) | `promptVersion: 2`, `maxOutputTokens: 3000 → 4000`, `purpose` declara o lote |
| Tela (`RevisaoPage.tsx`) | `AiAction` de chamada única → **laço de lotes** com progresso em pt-BR e gravação **a cada lote** |

**Medição antes × depois, a mesma função:**

| | Antes | Depois |
|---|---|---|
| Entrada | 24 blocos numa chamada | 3 blocos por chamada |
| Resultado | ❌ **HTTP 502** `schema-invalido` | ✅ **HTTP 200** |
| Tempo | **119,97 s** | **23,47 s** |
| `tokens_out` | **6000** (teto 3000, duas tentativas somadas) | **950** (teto 4000) |
| Cenas devolvidas | **0** — e **1** quando "passava" | **3** (uma por bloco) |
| Custo | **US$ 0,0708 por tentativa falha** | **US$ 0,0124** |

Projeção para o roteiro de 24 blocos: **8 lotes ≈ US$ 0,10 e ~3 min, com 24 cenas**. Antes: US$ 0,21 por
**zero** cenas.

**Três decisões que valem registro:**

1. **A tela grava a cada lote.** Se o quarto lote falhar, as três cenas já pagas estão no conteúdo em vez
   de virarem prejuízo — mesmo princípio do manifesto de mídia, que grava os ativos pagos antes do render.
   É também o que permite sair da tela e voltar.
2. **`numero` é reatribuído pela posição**, não lido da resposta: dois lotes devolveriam `numero: 1` cada,
   e chave repetida quebraria a lista na tela. Há teste para isso.
3. **A v1 do prompt foi apagada, não arquivada ao lado.** `build_prompts.mjs:99` **falha** se o mesmo
   `prompt_id` aparecer em dois arquivos — "só uma versão pode estar ativa". O changelog da v2 preserva a
   história da v1.

| Verificação | Resultado |
|---|---|
| Tipos · prompts em sincronia | ✅ `tsc` exit 0 · `build_prompts.mjs --check` OK (15 prompts) |
| Cadeado do schema | ✅ **7/7** (`src/ai/__tests__/lote-de-cenas.test.ts`) — o lote de 24 blocos que causou o 502 é **recusado**, e o de 3 é aceito |
| Tela por lotes | ✅ **1** teste novo: 7 blocos → **3 chamadas**, nenhuma com mais de 3 blocos; 7 cenas gravadas, `numero` 1..7 |
| Suíte de IA + Revisão + dados | ✅ **122/122** |
| **Ao vivo, um lote de 3 blocos** | ✅ **200 em 23,47 s · 3 cenas · 950 tokens · US$ 0,0124** — `.rebeca/evidencias/lote-ao-vivo.json` |

**Não verificado:** os 8 lotes do roteiro completo em sequência (só um lote foi pago ao vivo); a
qualidade das cenas em si — o `descricao` da v1 denunciava a falta do Character Sheet, e a v2 pede que o
modelo **diga isso na descrição** em vez de inventar traços, o que ainda não foi conferido numa cena real
desta versão; e o custo diário, que com 8 lotes fica perto do teto de US$ 1,00 se o modelo continuar
sendo o de raciocínio (`gpt-6.1-sol`). Trocar `criar-cena` para `gpt-6-luna` — como foi feito em
`criar-roteiro` — derrubaria o custo do lote de US$ 0,0124 para a casa dos milésimos; **não foi feito**,
é decisão do dono.

## Fases 1 e 2 da adaptação ao PDF — o personagem e as imagens (2026-10-02)

O dono pediu para adaptar o app ao `ideabeba.pdf` (texto extraído em `.rebeca/fontes/ideabeba-extraido.txt`)
e escolheu começar pelo **personagem**. Planos em `.rebeca/planos/fase-{1-personagem,2-imagens,3-video}.md`.
As duas primeiras foram executadas por agentes com **conjunto de arquivos disjunto** — a mitigação da D9
que esta sessão aprendeu pagando.

### Fase 1 — o ciclo do personagem (status: concluído)

O PDF pede quatro batidas: *"o sistema gera opções. Eu escolho uma… 'gostei desse, mas quero as orelhas
maiores'… ela gera novamente… quando eu aprovar, ele vira oficial."* Existia só a metade: a tela gerava
**uma** ficha e **não gravava nada**.

| Camada | Arquivo |
|---|---|
| As quatro batidas na tela | `src/features/identidade/IdentidadePage.tsx` |
| `saveCharacterDraft` + `approveCharacter` (única porta para oficial) | `src/data/client.ts` |
| `CharacterSheet`, `CharacterProposal`, status `substituido`, `derivedFromId` | `src/data/types.ts` |
| Saída passa a **2–3 opções**; entrada ganha `ajuste` e `personagemBase` | `src/ai/schemas.ts` + `src/ai/contract.ts` (promptVersion 2, teto 1600→2400) |
| Prompt v2 (v1 apagada — o gerador recusa duas versões ativas) | `.rebeca/prompts/identidade-personagem@v2.md` |
| Decisão e alternativas descartadas | `.rebeca/decisoes/ADR-015-ciclo-do-personagem.md` |

**Decisão central (ADR-015):** refinar **não edita** a ficha — cria versão nova (`sheetVersion+1`), e a
anterior só perde a oficialidade quando a nova é aprovada, virando `substituido`. Duas oficiais com o
mesmo nome tornariam *"qual é a identidade canônica?"* uma pergunta sem resposta, e episódio já gerado
usou a ficha antiga. Descartados: rebaixar para `em_aprovacao` (estado mentiroso) e apagar (perde
rastreabilidade).

### Fase 2 — o provedor de imagem real (status: **parcial**, e o motivo importa)

`ImageProvider` real (MiniMax `image-01`) **ao lado** do simulado, atrás da mesma interface. O cliente
HTTP foi **extraído e compartilhado** entre thumbnail e cena em vez de duplicado; o plano da imagem passa
a vir do provedor (sem `if` de fornecedor no pipeline); a resolução real é **medida do arquivo** (IHDR)
em vez de repetida do pedido; e o padrão continua simulado porque escolher provedor pago por padrão faria
`pnpm exec vitest run` **gastar dinheiro**.

**Allow-list — a segunda reconciliação pendente foi fechada, a primeira não.** Autorizado pelo dono nesta
sessão: `minimax / image-01 / imagem` = PERMITIDO (o portão do `ADR-013` chaveia por finalidade, e sem
essa entrada a Fase 2 inteira era recusada). **Continua pendente** a de vídeo: `MiniMax-H3-768P` está
gravado com finalidade `video` enquanto a etapa se chama `animacao` — é o portão nº 1 da Fase 3.

**Por que parcial, com todas as letras:** o plano exigia *"uma geração real medida"* e **não existe chave
da MiniMax nesta máquina** (`REBECA_MINIMAX_API_KEY` ausente; `.rebeca/segredos/` só tem `llm.json`, com
anthropic/deepseek/google/openai). O agente **declarou** em vez de fabricar o número. Preço, latência,
tamanho e resolução reais entregues seguem `NÃO VERIFICADOS na prática`.

| Verificação (independente, feita pelo orquestrador) | Resultado |
|---|---|
| `pnpm exec tsc --noEmit` na árvore inteira | ✅ **exit 0** |
| `node .tools/build_prompts.mjs --check` | ✅ prompts em sincronia |
| Arquivos das duas entregas no disco; v1 do prompt apagada | ✅ 7/7 conferidos |
| `ADR-015` sem colisão de número | ✅ único |
| `.rebeca/custos.csv` intocado pelas duas | ✅ última gravação 15:49:06 |

**Defeito que a prova adversarial do próprio autor encontrou (Fase 1):** o teste de troca de canal
**passava verde** com a mutação, porque o mecanismo real de isolamento é `src/app/AppShell.tsx:30`
(`key={channelId}` remonta a subárvore) — o `useEffect` que ele havia escrito era código decorativo.
Removeu o efeito, corrigiu o teste e reaplicou a mutação onde ela morde. **Guarda que nunca dispara é
legenda.**

**Incidente declarado (Fase 1), e vale como aviso:** a primeira mutação usou `Get-Content`/`Set-Content`
do PowerShell 5.1, que lê e grava em ANSI; corrompeu `src/data/client.ts` com BOM + mojibake e abortou
antes de restaurar. Foi reparado byte a byte (sha256 igual ao pré-mutação) e o método trocado para
`System.IO` UTF-8 sem BOM. **Eu mesmo quase repeti isso agora**: o tail deste arquivo aparece como
mojibake ao ser lido com `Get-Content` — é artefato de leitura, não corrupção, mas o caminho de ida e
volta é o que corrompe.

### Não verificado nas duas fases

1. **Nenhuma chamada paga de IA ou de mídia** em nenhuma das duas — só provedor simulado e dublê de rede.
2. **A arte do Character Sheet continua ausente.** As fichas existem; a prancha ilustrada não. E
   `server/media/manifest.ts:53` **ainda fixa `characterSheet: 'ausente'`**, mesmo com a Luna `oficial`.
3. **A camada de mídia ainda não consome a ficha** (a Revisão passa só `name/role/sheetVersion`), e o
   `negativePrompt` do storyboard **não chega ao provedor de imagem** (`ImageRequest` não tem o campo).
4. **Nenhuma das duas tocou a tela de Revisão** para mostrar arte real × prova de máquina.
5. **Versões `substituido` não têm caminho de descarte** — a lista cresce a cada refino aprovado.
6. **Revisão adversarial do `rebeca-qa` não foi executada** sobre nenhuma das duas; a prova por mutação
   foi feita pelos próprios autores.
7. **O shim do runner** (`node_modules/.cache/dsh-vitest-sandbox-shim.cjs`, troca só `net use` por
   resposta vazia) está declarado na evidência. `tsc`, que não usa shim, dá exit 0 como corroboração.

### Fase 3 — o vídeo: **bloqueada**, e não por código

Três portões, nenhum técnico: (1) a entrada `animacao` da allow-list; (2) a **D1** — onde roda o job
longo, aberta desde o 504; (3) autorização de gasto — **~US$ 39 por episódio** contra teto de
**US$ 60/mês**, ou seja **um episódio por mês**. Nenhum agente pode abrir os três. Ver
`.rebeca/planos/fase-3-video.md`.

