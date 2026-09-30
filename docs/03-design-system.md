# 03 — Design System do AI Media Studio

> **Fonte:** a linguagem visual do **YouTube**. Os valores vêm de `[YT-1]`
> <https://www.sokosumi.com/tools/design-md/analysis/youtube> (extração dos tokens do youtube.com em
> 25/09/2026) e `[YT-2]` <https://youtube-skins.com/youtube-dark-mode> (guia de 09/2026 com os
> códigos do tema escuro). A procedência de **cada** token está na §11.
>
> Este documento é o contrato visual: **"esta cara"** virou token executável em
> `src/styles/tokens.css` e primitivos em `src/components/ui/` + `src/styles/components.css`.
> Um componente novo que precise de cor, raio, sombra ou espaçamento usa o token; **valor solto no
> meio do JSX é bug de design system.**
>
> **Mudança de linguagem:** até esta sessão o contrato era o "painel noturno azul" extraído de
> `imagens/modelo1.jpeg` e `imagens/modelo2.jpeg`. O dono do produto pediu a linguagem do YouTube e a
> decisão (com as alternativas descartadas) está em **`ADR-009-linguagem-visual-youtube.md`**. Os dois
> modelos seguem no repositório como **insumo histórico**, não como contrato.

## 1. Princípio visual

O app é uma **ferramenta profissional para operar um canal do YouTube** — e fala a língua visual da
plataforma que opera, para que quem já usa o YouTube Studio não aprenda uma segunda gramática.

Três regras governam tudo:

1. **Flat-first.** A superfície é plana. Profundidade só aparece quando algo é interativo (hover) ou
   quando algo flutua sobre o conteúdo (menu, diálogo). Não há gradiente de fundo, blob ou vidro.
2. **O conteúdo é a cor.** A superfície é branca (ou preta) e neutra; o que carrega cor é a thumbnail,
   o número e o estado. **O vermelho é da ação, não da decoração** (`[YT-1]`: "must never be diluted
   or used decoratively").
3. **Forma funcional.** Ação, chip e campo são **pill** — a forma diz "isto se toca". Card e
   contêiner são **quadrados de 8px** — a forma diz "isto se lê".

O app **não** é o feed do YouTube. Copiar o feed apagaria a fila de aprovação, que é o coração do
produto (`docs/00-visao-produto.md` §6): a diferença entre este app e o YouTube está no conteúdo, não
na pele.

## 2. Paleta

### 2.1 Superfícies (fundo)

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--ams-bg` | `#FFFFFF` | `#0F0F0F` | base da página |
| `--ams-bg-soft` | `#F9F9F9` | `#161616` | faixa levemente destacada |
| `--ams-surface` | `#FFFFFF` | `#212121` | fundo de card |
| `--ams-surface-hover` | `#F2F2F2` | `#272727` | hover padrão |
| `--ams-surface-strong` | `#E8E8E8` | `#3F3F3F` | item selecionado / pressionado |
| `--ams-surface-sunken` | `#F2F2F2` | `#181818` | poço: player, gráfico, campo de formulário |
| `--ams-chip` | `#F2F2F2` | `#272727` | chip não selecionado |
| `--ams-border` | `#DBDBDB` | `#303030` | contorno padrão |
| `--ams-border-strong` | `#9B9B9B` | `#555555` | contorno de destaque |
| `--ams-divider` | `#E5E5E5` | `#272727` | linha divisória interna |

O fundo **não rola e não tem gradiente**: é uma cor só ([YT-1], "flat-first with subtle shadows").

### 2.2 Superfície e contorno (cards)

| Token | Valor | Uso |
|---|---|---|
| `--ams-r-md` | `8px` | raio de card e contêiner |
| `--ams-r-lg` | `12px` | raio de painel |
| `--ams-r-thumb` | `12px` | raio de thumbnail — **escolha nossa**, não medida na fonte |
| `--ams-shadow-card` | `0 4px 12px rgba(0,0,0,.08)` | card em **hover** |
| `--ams-shadow-pop` | `0 16px 40px rgba(0,0,0,.12)` | menu, diálogo, card em destaque |
| `--ams-overlay` | `rgba(0,0,0,.8)` | badge de duração sobre a thumbnail |
| `--ams-shadow-text` | `0 2px 4px rgba(0,0,0,.3)` | rótulo sobre imagem |

Card em repouso é `background: var(--ams-surface)` + `1px solid var(--ams-border)` + raio 8px, **sem
sombra**. A sombra entra no hover — é o que sinaliza que o card é clicável.

### 2.3 Ação e acento

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--ams-red` | `#FF0000` | `#FF0000` | **marca**: logo e barra de progresso. Decorativo |
| `--ams-primary` | `#E1002D` | `#E1002D` | ação primária (botão). Branco sobre ele = **4,95:1** |
| `--ams-primary-hover` | `#C41E3A` | `#FF2B4D` | hover do primário |
| `--ams-accent` | `#065FD4` | `#3EA6FF` | link, item ativo, anel de foco |

**Por que dois vermelhos e não um:** o botão primário do YouTube usa `#FF0000`, e branco sobre
`#FF0000` dá **4,00:1** — reprova em AA para texto de 14px. `#E1002D` é o `primary` que a `[YT-1]`
registra e entrega **4,95:1**. A marca continua `#FF0000` onde não há texto sobre ela (logo, barra de
progresso). Ver `ADR-009`, "Alternativas descartadas".

### 2.4 Semântica de estado (nunca usar cor sem rótulo)

| Token | Claro (fundo / texto) | Contraste | Escuro (fundo / texto) | Significa |
|---|---|---|---|---|
| `--ams-ok` | `#C8E6C9` / `#1B5E20` | 5,9:1 | `#12401C` / `#A5D6A7` | aprovado, publicado |
| `--ams-warn` | `#FFE0B2` / `#6B3D00` | 7,3:1 | `#4A3000` / `#FFD79A` | aguardando aprovação |
| `--ams-danger` | `#FFCCCC` / `#8B0000` | 7,0:1 | `#4A1100` / `#FFB4A1` | falhou, rejeitado |
| `--ams-info` | `#B3E5FC` / `#01579B` | 5,5:1 | `#0B2D40` / `#81D4FA` | agendado, em produção |

Cada estado aparece **sempre** como pílula com texto em pt-BR ("Aguardando aprovação", "Agendado",
"Publicado", "Falhou") — o par rótulo+tom vive em `src/components/status.ts`, que é a única fonte
dele. Cor sozinha é proibida.

### 2.5 Texto

| Token | Claro | Escuro | Contraste no claro | Uso |
|---|---|---|---|---|
| `--ams-text` | `#0F0F0F` | `#F1F1F1` | 19,2:1 | título, número-herói |
| `--ams-text-2` | `#3F3F3F` | `#D0D0D0` | 10,5:1 | corpo |
| `--ams-text-3` | `#606060` | `#AAAAAA` | 6,3:1 | rótulo, legenda, eixo de gráfico |

`--ams-text-3` é o piso: nada mais claro que isso para texto sobre superfície.

## 3. Tipografia

| Papel | Tamanho / peso | Onde |
|---|---|---|
| Título de tela | 24/600, `-0.01em` | `.ams-page-title` ("Início", "Calendário") |
| Título de seção | 20/600, `-0.01em` | cabeçalho de card |
| Título de card / item | 14/500 | nome do conteúdo, item do guide ativo |
| Número-herói | 32/600, tabular | KPI (`4,8 M`, `R$ 2.450`) |
| Corpo | 14/400, `1.5` | descrição, texto de UI |
| Rótulo | 12/500 | rótulo de KPI, metadado, cabeçalho de tabela |

Escala derivada da `[YT-1]`: `title-lg` 20/600, `body-md` 16/400, `label-md` 14/500, `label-sm`
12/500. O app usa 14px como corpo de UI e reserva 16px para leitura longa.

Números usam `font-variant-numeric: tabular-nums` (classe `.ams-num`) para não "dançar" ao atualizar.

### Fonte — o que dá para usar e o que não dá

Pilha: `Roboto, 'Segoe UI', Arial, system-ui, sans-serif` (`--ams-font` e `--ams-font-display`).

- **Roboto** (Apache-2.0) é a fonte que o YouTube usa no corpo. **Auto-hospedar é o caminho** — e o
  motivo é LGPD, não performance: carregar do CDN do Google entregaria o IP de cada usuário ao Google
  sem base legal mapeada (skill `lgpd-internacional`).
  **PENDENTE:** o host desta sessão não tem saída de rede, então os `.woff2` **não** foram baixados e
  **não há `@font-face`** no `tokens.css` — uma regra apontando para arquivo inexistente só produziria
  404. Enquanto isso o app cai para Segoe UI/Arial, que é o fallback declarado pela própria `[YT-1]`.
  Dono da pendência: `rebeca-branding`.
- **YouTube Sans** é **proprietária** e **não pode ser redistribuída**. A pilha a cita primeiro
  apenas para quem já a tem instalada; o app nunca vai baixá-la.

## 4. Forma e espaço

| Token | Valor |
|---|---|
| `--ams-r-sm` | `8px` — chip interno |
| `--ams-r-md` | `8px` — card, botão secundário |
| `--ams-r-lg` | `12px` — painel |
| `--ams-r-xl` | `16px` — gaveta, modal |
| `--ams-r-pill` | `999px` — botão, chip, pílula, avatar |

Espaçamento na unidade de **8px** da `[YT-1]`: 8 entre elementos irmãos, 12–16 dentro do card, 24
entre seções. Contêiner máximo: `--ams-content-max` = **1440px**.

## 5. Estrutura da casca (masthead + duas barras laterais)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ☰  ▣ AI Media Studio   [ 🔍 Buscar conteúdo do canal   ]  🔔  ▥  ▼  🌙  (EU) │ ← masthead 56px
├──────────────┬───────────────────────────────────────────┬───────────────────┤
│ Navegação  × │                                           │  painel lateral   │
│ ───────────  │   Título da tela                          │  ┌─────────────┐  │
│ ▭ Início     │   subtítulo curto                         │  │ plano da    │  │
│ ▤ Conteúdo   │                                           │  │ semana      │  │
│ ▦ Calendário │   ┌─ KPI ─┐ ┌─ KPI ─┐ ┌─ KPI ─┐ ┌─ KPI ─┐   │  └─────────────┘  │
│ ✦ Identidade │   └───────┘ └───────┘ └───────┘ └───────┘   │  ┌─────────────┐  │
│ ◔ Analytics  │   ┌───────────────────────────────┐       │  │ o que a IA  │  │
│ ◈ Monetização│   │ conteúdo principal            │       │  │ aprendeu    │  │
│ ───────────  │   └───────────────────────────────┘       │  └─────────────┘  │
│ ◈ Portfólio  │                                           │                   │
│ ◔ Como funciona                                          │                   │
│ ───────────  │                                           │                   │
│ ⚙ Config.    │                                           │                   │
└──────────────┴───────────────────────────────────────────┴───────────────────┘
  barra esquerda: 240px, ou fechada (some)   │   barra direita: aberta/fechada
```

- **Masthead (56px, fixo):** ☰ (barra esquerda) · marca (o ícone do app) · **busca no centro** ·
  aprovações · ▥ (barra direita) · tema · seletor de canal.
  O seletor é o botão de conta do YouTube, mas mantém o que o produto exige: **avatar, nome, tipo e
  inscritos visíveis sem clicar** — o usuário precisa saber em que canal está (docs/00 §4). No celular
  ele vira só o avatar.
- **As duas barras laterais abrem e fecham**, e esse é o contrato do §5:
  - **Esquerda** — aberta (240px) ou **fechada, e aí ela some**: não vira trilho de ícones. O ☰ do
    masthead e o **×** dentro da própria barra fazem o mesmo. Em `< 1024px` ela é **gaveta** sobre o
    conteúdo, fechada também ao navegar.
  - **Direita** — a coluna de contexto das telas de canal (plano da semana, decisão da revisão,
    indicadores, lado a lado). O botão **▥** do masthead abre e fecha.
  - O estado das duas é preferência de **apresentação** e vive em `localStorage`
    (`ams-barra-esquerda`, `ams-barra-direita`) — **nunca** carrega `channelId` (invariante nº 2).
  - Os botões usam nome acessível **constante** + `aria-expanded` (padrão de divulgação) e
    `aria-controls` apontando para um alvo que **existe sempre** no DOM, mesmo fechado.
- **Por que a barra direita não fecha no celular:** abaixo de `lg`/`xl` aquela coluna não é barra
  lateral, é conteúdo empilhado — e na Revisão ela contém o botão de aprovar. Esconder no celular a
  coluna que tem a ação principal seria armadilha, não preferência. O fechamento vale só a partir do
  ponto em que a coluna é de fato lateral.
- **Como a barra direita fecha (implementação):** a coluna é escrita por **cada tela**, não pela
  casca. Então a casca publica `data-rail-right` no `<html>` e o CSS de `components.css` esconde
  `.ams-split__aside` e alarga `.ams-split__main` para 12 colunas. A tela só marca o grid com
  `.ams-split` + `data-split="lg" | "xl"`. Telas que usam o grid 12 sem ser "principal + lateral"
  (a "Como funciona", com 5+7) **não** entram nesse contrato.
- **A busca não é enfeite.** Ela escreve `?busca=` em `/c/:channelId/conteudo` e filtra de verdade
  (título, gancho, tema, descrição e tags, sem acento e sem caixa). Caixa de busca que não busca é
  bug, não decoração.
- **Item da barra esquerda:** 40px, raio 10px; o **ativo é preenchido** (`--ams-surface-hover`) e
  ganha peso 500 — o YouTube não usa barra lateral colorida. Grupos separados por `--ams-divider`.
- **Conteúdo:** centralizado em até 1440px, padding 24px em telas largas.

Em telas `< 1024px` a navegação principal é a **barra inferior** com os 5 destinos, porque o celular
é o modo principal de revisão e aprovação (`rebeca-react`, §10).

### Tema

O `<html>` carrega `data-theme="light" | "dark"`, que é o seletor dos tokens. O padrão é **claro**
(a cara do youtube.com); o botão da topbar alterna e grava a preferência em `localStorage`
(`ams-tema`). Um script inline no `index.html` aplica o tema **antes da primeira pintura**, para a
tela não piscar clara antes de virar escura.

**Isto não fere o invariante nº 2:** a única coisa que mora no navegador é preferência de
apresentação. O **canal ativo continua apenas na URL** — nenhum token de tema carrega `channelId`.

**Contrato com o CSP (`ADR-008`):** o deploy manda `script-src` estrito, **sem `'unsafe-inline'`**, e
autoriza esse script por **hash sha256**. Logo, **editar o script inline — até um comentário — exige
atualizar o hash no `vercel.json`**, senão o navegador bloqueia o script e o sintoma é só uma piscada
clara na tela (nenhum erro no console óbvio). `src/__tests__/headers.test.ts` lê `index.html` e
`vercel.json` do disco e recusa a divergência; ele passa com o script atual.

## 6. Componentes primitivos

Nomeados em `src/components/ui/` (React) e `src/styles/components.css` (classe):

| Componente | Classe | Aparência | Regra |
|---|---|---|---|
| `Card` | `.ams-card` | superfície + contorno 8px, sem sombra | `variant="glass" \| "strong" \| "sunken" \| "flush"` |
| `SectionHead` | `.ams-section-head` | número discreto + título 20/600 + apoio | número é ordem de leitura, não decoração |
| `IconTile` | `.ams-tile` | quadrado 40px, tom a 14% sobre a superfície | sem gradiente e sem brilho; substitui o ícone 3D até o Brand Kit entregar arte |
| `StatCard` | `.ams-stat` | rótulo 12/500 + número-herói + delta | **exige** período e canal no rodapé |
| `Pill` | `.ams-pill` | pílula com ponto + texto | `tone="ok"\|"warn"\|"danger"\|"info"\|"neutral"` |
| **`Chip`** | `.ams-chip` | pílula 32px, fundo neutro; ativo inverte para `--ams-chip-active` | filtro selecionável; sempre com a contagem ao lado |
| `ModuleCard` | `.ams-module` | `IconTile` + título 14/500 + descrição + `Pill` | é o bloco do diagrama de módulos |
| `ProgressBar` | `.ams-progress` | trilho 4px + preenchimento `--ams-red` | sempre com rótulo da etapa em pt-BR |
| `ChannelAvatar` | `.ams-avatar` | círculo `--ams-accent-soft` + inicial | nunca sem `alt` descritivo (5,1:1) |
| **`Thumb`** | `.ams-thumb` | 16:9 com raio 12px + badge de duração | badge sobre `--ams-overlay`; `alt` descreve a cena |
| **busca** | `.ams-search` | campo pill 40px colado ao botão | só existe onde filtra algo |
| `EmptyState` | — | ícone + frase + **botão da ação que resolve** | tela vazia sem ação é bug |
| `ArtSlot` | `.ams-art` | retângulo tracejado com a proporção certa | placeholder honesto (§8) |

## 7. O diagrama de módulos (o "mapa do produto" dentro do app)

O ciclo aparece como uma fileira de módulos ligados — é a tela **Como funciona** e a faixa de status
no Início. Ordem canônica (a mesma de `docs/00-visao-produto.md` §3 e de `src/data/cycle.ts`):

`Pesquisar → Planejar → Criar → Revisar → Aprovar → Agendar → Publicar → Medir → Aprender → Melhorar`

Cada `ModuleCard` mostra em que estado do ciclo o canal está **agora**, e o card de Aprovação é o
único que pode ficar com badge de pendência — é onde o humano é necessário.

## 8. Iconografia e ilustração — lacuna declarada

O produto **não** produz arte. A personagem Luna e os ícones ilustrados são do `rebeca-branding`
(Brand Kit + Character Sheet). No protótipo:

- ícones são `lucide-react` dentro de `IconTile`, com o tom da categoria;
- slots de arte (avatar do canal, thumbnail, player) são `ArtSlot` — placeholder com proporção e
  rótulo corretos, para a arte entrar sem mudar layout.

### A marca do produto e a marca do YouTube

O dono do produto entregou o **ícone do app** nesta sessão: um anel menta `#A5E3DD` com uma linha de
pulso que desenha "Ai", sobre um bloco azul-marinho `#213454`. Ele é a marca do produto — no
masthead, no favicon e no ícone de atalho.

| Item | Onde | Observação |
|---|---|---|
| Master intocado | `imagens/icone-app-original.png` | 95×97, **sem transparência** e com ~2px de branco nos cantos (herança de captura de tela) |
| Favicon 32 / 96 | `public/icone-32.png`, `public/icone-96.png` | gerados do master |
| Ícone de atalho | `public/icone-180.png` | ⚠️ **ampliado** de 93px — ver pendência abaixo |
| Masthead | `.ams-logo-mark` em `components.css` | 32px, recortado por `border-radius` + `overflow: hidden` |

Os arquivos servidos são recortados para **quadrado exato** (93×93) e desenhados com 1px de sangria,
para não sobrar a borda branca do master nem um anel semitransparente de reamostragem — verificado:
alpha mínimo = 255 em todos.

O play-button branco dentro do retângulo vermelho **não** é usado como logo deste produto:
reproduzir a marca do YouTube como identidade do AI Media Studio seria se passar por outro produto e
contraria o `ADR-002` (a marca da interface é AI Media Studio). O glifo do YouTube existe em
`src/components/icons.tsx` e é usado em **uso nominativo** — na tela de Configurações, para indicar a
conexão da conta da plataforma.

**PENDENTE:** o master tem só 93px de lado. O `icone-180.png` é ampliação de ~1,9× e **não** existe
`192`/`512` — um ícone de app instalável precisa de arte vetorial ou de um PNG grande, senão fica
borrado na tela inicial do celular. O `rebeca-branding` deve pedir/gerar o vetor; o `rebeca-pwa`
não deve publicar manifest sem ele.

**NÃO VERIFICADO:** a licença de uso das ilustrações de `imagens/modelo1.jpeg` e `modelo2.jpeg` para
produção, e a questão de uso de marca do glifo nominativo, seguem abertas. Tratar em
`rebeca-branding` (com `rebeca-lgpd`/jurídico) antes de publicar qualquer tela.

## 9. Acessibilidade (não é enfeite)

- **Contraste AA demonstrado por cálculo** para todo par texto/fundo: o pior caso do tema claro é
  `--ams-info` em pílula (**5,5:1**) e o pior do escuro é `--ams-danger` em pílula (**~5,1:1**) —
  ambos acima do 4,5:1 exigido para texto normal.
- **Foco visível:** anel de 2px em `--ams-accent` (`:focus-visible`), mais `--ams-ring` para
  superfícies escuras. O foco é nosso porque o anel padrão do navegador não conversa com a superfície.
- **Alvos de toque:** masthead, guide e barra inferior usam 40px; o mínimo de 44px no celular segue
  o alvo para as ações de aprovação.
- Todo gráfico tem o número em texto ao lado (nunca só a barra).
- Nenhum estado é comunicado só por cor: sempre há rótulo em pt-BR (§2.4).
- `prefers-reduced-motion`: desliga shimmer de skeleton e transição de card.

## 10. Verificação deste documento

Resultado **observado** nesta sessão (comando + saída, não promessa):

| Verificação | Comando | Resultado |
|---|---|---|
| Nenhum componente pendurado em token removido | `Select-String -Path src\*.tsx,src\**\*.tsx -Pattern 'var\(--ams-(glass\|grad-action\|glow-cyan\|cyan\|bg-deep\|sidebar-w)'` | ✅ **0 ocorrências** |
| Nenhuma cor solta no componente | `Select-String -Path src\*.tsx,src\**\*.tsx -Pattern '#[0-9a-fA-F]{3,8}\b'` | ✅ **0 ocorrências** |
| Nenhuma cor solta no CSS de primitivo | `Select-String -Path src\styles\components.css -Pattern '#[0-9a-fA-F]{3,8}\b\|rgba?\('` | ✅ **0 ocorrências** |
| Testes das telas tocadas por este layout | `pnpm exec vitest run src/features src/data/__tests__/channel-scope.test.tsx src/app/__tests__` | ✅ **15/15 em 4 arquivos**, exit 0 — é o alvo real desta mudança |
| Barras laterais abrem/fecham | `pnpm exec vitest run src/app/__tests__/barras-laterais.test.tsx` | ✅ **4/4** — §5 |
| Suíte completa | `pnpm exec vitest run --reporter=verbose` | ✅ **106/106 em 11 arquivos**, exit 0, 46s, em janela quieta — `.rebeca/evidencias/vitest-layout-youtube.txt` |
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro |
| Build de produção | `pnpm run build` (tsc + vite) | ✅ exit 0 — html 1,58 kB · **css 35,90 kB** (gzip 7,96) · js 462,51 kB (gzip 137,01) |
| Tokens no bundle | `Select-String` em `dist/assets/*.css` | ✅ `[data-theme=dark]`, `data-rail-right` (4×), `.ams-split__aside/__main` e `data-split` presentes; `color-mix` em 7 pontos |
| Ícones do app | inspeção de alpha nos PNG gerados | ✅ alpha mínimo = 255 (sem anel semitransparente) e 0 px quase-branco nos cantos |

Evidência das rodadas de teste: `.rebeca/evidencias/vitest-layout-youtube.txt`.

`fill` de SVG **não** aceita `var()` em atributo de apresentação — por isso a cor do glifo
(`.ams-yt-glyph__*`) é classe CSS, e não `fill="var(--ams-red)"`.

**Pendente (não maquiado):**

1. `axe-core` nas telas Início, Revisão, Calendário e Portfólio → 0 violações `serious`/`critical`.
   **Não rodou:** não há navegador automatizado nesta sessão; o contraste foi conferido por cálculo.
2. Inspeção **visual** contra o youtube.com e viewport 390×844. **Não rodou**, pelo mesmo motivo.
3. **A suíte completa é intermitente sob concorrência (D9).** Na rodada final ela ficou **verde
   (106/106, 11 arquivos, 46s)**. Mas antes disso, com 10 arquivos, ela reprovou
   `revisao > rejeitar exige motivo` com `Test timed out in 20000ms`, **sem nenhuma falha de
   asserção**. O runner entregou o diagnóstico: `~21.67s startup each` para 10 workers — o tempo é
   gasto subindo ambiente jsdom, e o *startup* de um worker pode superar o `testTimeout` de 20s
   quando a máquina está ocupada por uma segunda sessão de agente. Não era o produto: **as suítes de
   UI passaram 15/15 isoladas**, incluindo o teste que estourou.
   O `testTimeout` de 20s foi calibrado quando a suíte tinha 4 arquivos; com 11, a margem é fina.
   **Correção concreta (não aplicada aqui):** o runner sugere `isolate: false` — "at least ~21.67s
   faster". Mexer em `vite.config.ts` é decisão de quem o possui; esta sessão não alterou a config de
   teste para não mascarar falha real nem colidir com a outra frente.

## 11. Procedência dos valores

| Marca | Significado |
|---|---|
| `[YT-1]` | `sokosumi.com/tools/design-md/analysis/youtube` — extração dos tokens do youtube.com, 25/09/2026 |
| `[YT-2]` | `youtube-skins.com/youtube-dark-mode` — guia de 09/2026, códigos do tema escuro |
| `derivado` | **não** vem das fontes: foi calculado para fechar contraste AA onde a fonte não publica o par |

| Token | Origem |
|---|---|
| `--ams-red` | `[YT-2]` ("YouTube red (logo, progress bar)") |
| `--ams-primary`, `--ams-primary-hover` | `[YT-1]` (`primary`, hover) |
| `--ams-accent` (claro) | `[YT-1]` — azul de link do tema claro |
| `--ams-accent` (escuro) | `[YT-2]` (`#3EA6FF`) |
| `--ams-bg`, `--ams-surface`, `--ams-border`, `--ams-text`, `--ams-text-3` | `[YT-1]` |
| `--ams-bg`, `--ams-surface`, `--ams-surface-hover`, `--ams-chip`, `--ams-text` (escuro) | `[YT-2]` |
| `--ams-ok` / `--ams-ok-soft` | `[YT-1]` (`on-secondary-container` / `secondary-container`) |
| `--ams-danger` / `--ams-danger-soft` | `[YT-1]` (`on-error-container` / `error-container`) |
| `--ams-info` / `--ams-info-soft` | `[YT-1]` (`on-tertiary-container` / `tertiary-container`) |
| `--ams-warn` / `--ams-warn-soft` | **derivado** — a fonte não publica par âmbar |
| `--ams-text-2` | **derivado** — passo entre `on-surface` e `on-surface-variant` |
| `--ams-r-md`, `--ams-r-pill`, `--ams-shadow-*`, `--ams-content-max`, `--ams-guide-w` (240px) | `[YT-1]` |
| `--ams-r-thumb` (12px) | **escolha nossa** — a fonte diz 8px; 12px é o que a thumbnail do YouTube usa hoje |
| `--ams-topbar-h` (56px) | **escolha nossa** — a `[YT-1]` não publica a altura do masthead |

**Regra:** token novo entra nesta tabela **e** no `tokens.css` com a marca da origem no comentário.
Sem procedência, o valor é chute — e chute em design system vira dívida que ninguém sabe pagar.
