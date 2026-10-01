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

**Não verificado (declarado, não maquiado):**

1. **O runtime da Vercel não foi executado** — exige o push e o deploy. O que falta medir é o **HTTP 200**
   em `https://rebeca-odda.vercel.app/api/ai/status`.
2. **O log de runtime da Vercel** (stack trace do 500) não foi lido: não há credencial nesta sessão. A
   conclusão vem do código do builder, da reprodução local e do sintoma.
3. **Um segundo erro, ainda aberto e de outra natureza:** o dono relatou **504 em
   `POST /api/ai/generate`** com o dev server em `localhost:5173`. O Vite **não tem timeout de
   requisição** (os únicos 504 dele são de otimizador de dependências, e só para requisições de módulo
   JS — que não é o caso de `/api/ai/*`), então a origem do 504 **não foi identificada** e o dev server
   já estava fora do ar quando fui olhar. Fica como defeito aberto, com o livro de custos mostrando que
   **as duas gerações foram concluídas no servidor** (e pagas) enquanto o navegador via 504 — ou seja, o
   dinheiro foi gasto e o resultado não chegou à tela.

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
| D11 | **Qual fornecedor de LLM pode atender o canal infantil?** O Google está **vedado** por cláusula literal (Gemini Additional Terms, "Age Requirements"); a DeepSeek tem cláusula (§3.4(8)) que pode alcançar o caso da Luna e a **leitura jurídica está pendente**; a Anthropic permite com salvaguardas. Enquanto não houver leitura jurídica, o default do produto é conservador. Ver `ADR-006` | `rebeca-lgpd`, `rebeca-infantil`, `rebeca-seguranca` | humano |
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

