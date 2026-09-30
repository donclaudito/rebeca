# 03 — Design System do AI Media Studio

> **Fonte:** `imagens/modelo1.jpeg` e `imagens/modelo2.jpeg` (modelos entregues pelo dono do
> produto). Este documento é o contrato visual: **"esta cara"** virou token executável em
> `src/styles/tokens.css` e primitivos em `src/components/ui/`.
> Um componente novo que precise de cor, raio, sombra ou espaçamento usa o token; **valor solto no
> meio do JSX é bug de design system.**

## 1. Princípio visual

O app é um **painel noturno de estúdio**: fundo azul-marinho profundo, cards de vidro iluminados por
borda ciano, e o conteúdo (o vídeo, o número, o personagem) é a única coisa saturada da tela. A
sensação alvo é "sala de controle sofisticada que não dá medo" — coerente com o §6 da visão de
produto (o app não pode parecer complexo).

Regra prática: **o fundo é escuro e calmo; o dado é claro; a ação é ciano.**

## 2. Paleta

### 2.1 Superfícies (fundo)

| Token | Valor | Uso |
|---|---|---|
| `--ams-bg-deep` | `#050B1F` | base absoluta, atrás de tudo |
| `--ams-bg-mid` | `#0A1B4A` | meio do gradiente da casca |
| `--ams-bg-top` | `#14307E` | topo do gradiente, atrás do cabeçalho |
| `--ams-blob-blue` | `#2563EB` | blob radial difuso (canto superior esquerdo) |
| `--ams-blob-violet` | `#7C3AED` | blob radial difuso (canto inferior direito) |
| `--ams-blob-cyan` | `#06B6D4` | blob radial difuso (topo direito) |

O fundo da aplicação é **um** gradiente fixo (`linear-gradient(180deg, top 0%, mid 45%, deep 100%)`)
com três blobs radiais de baixa opacidade (8–14%) e `filter: blur(80px)`. Ele não rola com o
conteúdo — é a "sala", não a página.

### 2.2 Vidro (cards)

| Token | Valor | Uso |
|---|---|---|
| `--ams-glass` | `rgba(255,255,255,0.055)` | fundo padrão de card |
| `--ams-glass-strong` | `rgba(255,255,255,0.09)` | card em destaque / hover |
| `--ams-glass-sunken` | `rgba(3,10,30,0.55)` | poço interno (player, gráfico) |
| `--ams-border` | `rgba(125,180,255,0.20)` | borda padrão |
| `--ams-border-strong` | `rgba(56,189,248,0.55)` | borda de card ativo/selecionado |
| `--ams-blur` | `18px` | `backdrop-filter` |

Todo card tem `border: 1px solid var(--ams-border)`, `border-radius: var(--ams-r-lg)` e um brilho
interno no topo (`inset 0 1px 0 rgba(255,255,255,0.08)`) — é isso que dá o aspecto de vidro.

### 2.3 Ação e acento

| Token | Valor | Uso |
|---|---|---|
| `--ams-cyan` | `#22D3EE` | **ação primária**, foco, item ativo |
| `--ams-blue` | `#3B82F6` | ação secundária, preenchimento de gráfico |
| `--ams-violet` | `#8B5CF6` | terceiro passo de gradiente, categoria |
| `--ams-grad-action` | `linear-gradient(135deg,#22D3EE,#3B82F6 55%,#8B5CF6)` | botão primário, barra de progresso |

### 2.4 Semântica de estado (nunca usar cor sem rótulo)

| Token | Valor | Significa | Nunca significa |
|---|---|---|---|
| `--ams-ok` | `#22C55E` | crescimento, aprovado, publicado | "está tudo bem" genérico |
| `--ams-warn` | `#F59E0B` | aguardando aprovação, atenção | erro |
| `--ams-danger` | `#EF4444` | falha, dor/problema, rejeitado | ação destrutiva sem confirmação |
| `--ams-info` | `#38BDF8` | agendado, informativo | sucesso |

Cada estado aparece **sempre** como pílula com ícone + texto em pt-BR ("Aguardando aprovação",
"Agendado", "Publicado", "Falhou"). Cor sozinha é proibida (§9 da skill `rebeca-react`).

### 2.5 Texto

| Token | Valor | Uso |
|---|---|---|
| `--ams-text` | `#FFFFFF` | título, número-herói |
| `--ams-text-2` | `#C7D7F0` | corpo |
| `--ams-text-3` | `#8FA6C9` | rótulo, legenda, eixo de gráfico |

Contraste mínimo AA sobre `--ams-bg-mid`: `--ams-text-3` é o piso — nada mais claro que isso para
texto sobre vidro.

## 3. Tipografia

| Papel | Tamanho / peso | Onde |
|---|---|---|
| Display | 40/700, `-0.02em` | título da tela ("Início", "Calendário") |
| Título de seção | 20/700 | nome do card grande |
| Título de card | 15/600 | cabeçalho de card de módulo |
| Número-herói | 30/700, tabular | KPI (`4,8 M`, `R$ 2.450`) |
| Corpo | 13/400, `1.5` | descrição |
| Rótulo | 11/600, `0.06em`, caixa alta | rótulo de KPI, cabeçalho de coluna |

Fonte: pilha do sistema com preferência por **Inter** — `Inter, "Segoe UI", system-ui, sans-serif`.
Números usam `font-variant-numeric: tabular-nums` para não "dançar" ao atualizar.

## 4. Forma e espaço

| Token | Valor |
|---|---|
| `--ams-r-sm` | `8px` — pílula interna, chip |
| `--ams-r-md` | `12px` — botão, ícone-tile |
| `--ams-r-lg` | `18px` — card |
| `--ams-r-xl` | `24px` — painel, sidebar |
| `--ams-r-pill` | `999px` — pílula de estado, avatar |
| `--ams-sp-1..6` | `4, 8, 12, 16, 24, 32px` |

Sombra: `--ams-shadow-card: 0 10px 30px rgba(2,8,28,0.45)`.
Glow de destaque: `--ams-glow-cyan: 0 0 0 1px rgba(34,211,238,0.35), 0 0 24px rgba(34,211,238,0.18)`.

## 5. Estrutura da casca (de `modelo1.jpeg`)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ▣ AI Media Studio                          [ Canal ▾ ]  [ 🔔 ]  [ EU ]  │  ← topbar 64px
├────────────┬─────────────────────────────────────────────────────────────┤
│ ▣ Início   │                                                             │
│ ▤ Conteúdo │   Título da tela                                           │
│ ▦ Calendário│  subtítulo curto                                           │
│ ✦ Identidade│                                                             │
│ ◔ Analytics│   ┌─ KPI ─┐ ┌─ KPI ─┐ ┌─ KPI ─┐ ┌─ KPI ─┐                   │
│ ◈ Monetização│  └───────┘ └───────┘ └───────┘ └───────┘                  │
│            │   ┌───────────────────────┐ ┌──────────────────┐            │
│ ─────────  │   │ conteúdo principal     │ │ plano da semana  │            │
│ ⚙ Config.  │   └───────────────────────┘ └──────────────────┘            │
└────────────┴─────────────────────────────────────────────────────────────┘
```

- **Topbar (64px):** marca à esquerda; à direita o **seletor de canal** — que nos modelos aparece
  como o card "Luna e o Jardim das Cores / Canal Infantil · 723 mil inscritos". No app ele é um
  botão que abre o seletor, com o avatar, nome, tipo e inscritos sempre visíveis (o usuário precisa
  saber em qual canal está **sem clicar**).
- **Sidebar (232px, fixa em ≥1024px):** card de vidro. Itens: Início, Conteúdo, Calendário,
  Identidade, Analytics, Monetização. Rodapé: Configurações + Portfólio.
  Item ativo: fundo `--ams-glass-strong`, borda ciano à esquerda, ícone em ciano, texto branco.
- **Conteúdo:** largura máxima 1400px, padding 32px, grade de 12 colunas.

Em telas < 1024px a sidebar vira **barra inferior** com os 5 destinos principais (o celular é o modo
principal de revisão — §10 da skill `rebeca-react`).

## 6. Componentes primitivos

Nomeados em `src/components/ui/`:

| Componente | Aparência | Regra |
|---|---|---|
| `Card` | vidro + borda + raio 18 | `variant="glass" \| "sunken" \| "strong"` |
| `SectionTitle` | círculo numerado colorido + título + linha | número é ordem de leitura, não decoração |
| `IconTile` | quadrado 40px, raio 12, gradiente da categoria, ícone branco | substitui o ícone 3D até o Brand Kit entregar arte |
| `StatCard` | rótulo em caixa alta + número-herói + delta | **exige** período e canal no rodapé |
| `Pill` | pílula com ponto/ícone + texto | `tone="ok"\|"warn"\|"danger"\|"info"\|"neutral"` |
| `ModuleCard` | `IconTile` 48px + título 15/600 + 2 linhas de descrição + `Pill` opcional | é o bloco do diagrama de módulos |
| `ProgressBar` | trilho `--ams-glass-sunken` + preenchimento `--ams-grad-action` | sempre com rótulo da etapa em pt-BR |
| `ChannelAvatar` | círculo com anel gradiente + inicial ou imagem | nunca sem `alt` descritivo |
| `EmptyState` | ícone + frase + **botão da ação que resolve** | tela vazia sem ação é bug |

## 7. O diagrama de módulos (o "mapa do produto" dentro do app)

`modelo1.jpeg` mostra o ciclo como uma fileira de módulos ligados. No app isso é a tela
**Como funciona** e a faixa de status no Início. Ordem canônica (a mesma de
`docs/00-visao-produto.md` §3):

`Estratégia → Personagens → Roteiro → Geração de vídeo → Thumbnail → SEO → Aprovação → Agendamento →
Upload no YouTube → Analytics → Aprendizado`

Cada `ModuleCard` mostra em qual estado do ciclo o canal está **agora**, e o card de Aprovação é o
único que pode ficar com badge de pendência (é onde o humano é necessário).

## 8. Iconografia e ilustração — lacuna declarada

Os modelos usam **ícones 3D coloridos** e a **personagem Luna** (arte infantil). Eu **não** produzo
essa arte: ela é do `rebeca-branding` (Brand Kit + Character Sheet). No protótipo:

- ícones são `lucide-react` dentro de `IconTile` com o gradiente da categoria;
- slots de arte (avatar do canal, thumbnail, hero) são `ArtSlot` — placeholder com proporção e
  rótulo corretos, para a arte entrar sem mudar layout.

**NÃO VERIFICADO:** licença de uso das ilustrações dos modelos para produção. Tratar em
`rebeca-branding` antes de publicar qualquer tela.

## 9. Acessibilidade (não é enfeite)

- Foco visível: `outline: 2px solid var(--ams-cyan); outline-offset: 2px` em **todo** elemento
  interativo — o vidro escuro esconde o foco padrão do navegador.
- Alvos de toque ≥ 44px no celular.
- Todo gráfico tem o número em texto ao lado (nunca só a barra).
- `prefers-reduced-motion`: desliga blob animado, transição de card e shimmer de skeleton.

## 10. Verificação deste documento

- `Select-String -Path src\**\*.tsx -Pattern "#[0-9a-fA-F]{6}"` → **0 ocorrências** fora de
  `tokens.css` (nenhuma cor solta no componente).
- Teste com axe-core nas telas Início, Revisão, Calendário e Portfólio → 0 violações
  `serious`/`critical`.
- Inspeção visual contra `imagens/modelo1.jpeg` e `imagens/modelo2.jpeg` registrada em
  `.rebeca/estado.md`.
