# ADR-009 — Linguagem visual do app passa a ser a do YouTube

## Status
aceito pelo dono do produto na sessão (pedido direto: *"de um layout moderno, atualizado, seguir
modelo e fontes gráficas do YouTube"*)

## Data
> **Numeração:** esta decisão nasceu como ADR-006, virou **008** e ficou em **009** porque a pasta
> é compartilhada por duas sessões de agente no mesmo minuto: o ADR-006 já era da camada de LLM e o
> ADR-008 é do CSP (a sessão de segurança saiu do 007 justamente por causa deste arquivo). Ver D9 no
> `.rebeca/estado.md` — a colisão de numeração é o mesmo custo de concorrência, agora visível.
2026-10-01

## Contexto

O `docs/03-design-system.md` vigente descrevia um **"painel noturno de estúdio"**: fundo
azul-marinho em gradiente, cards de vidro com borda ciano, blobs radiais desfocados e três passos de
gradiente como cor de ação. Essa linguagem foi extraída de `imagens/modelo1.jpeg` e
`imagens/modelo2.jpeg`, os dois modelos que o dono entregou na abertura do projeto.

O dono pediu, nesta sessão, outra linguagem: **a do YouTube**. O produto já se apresenta como uma
ferramenta *para* o YouTube (o seletor de canal diz literalmente "como no YouTube Studio"), então
falar a língua visual da plataforma reduz o custo de aprendizado de quem já opera um canal.

O que estava em jogo, se nada fosse decidido:

1. O app continua com uma identidade que não conversa com o produto que ele opera, e cada tela nova
   reinventa cor — o defeito que o `docs/03` existia para impedir.
2. A tipografia de 13px de corpo / 11px de rótulo fica abaixo do que a própria fonte de referência do
   YouTube usa (`label-md` 14/500, `label-sm` 12/500), piorando leitura e acessibilidade.
3. O foco em ciano sobre vidro escuro, o foco em vermelho/azul sobre superfície clara — a decisão de
   acessibilidade fica pendurada numa paleta que ninguém mais quer.

## Decisão

**`docs/03-design-system.md` passa a descrever a linguagem visual do YouTube**, e o app abre no
**tema claro** (a cara padrão do youtube.com), com o tema escuro do YouTube a um clique na topbar.

Concretamente:

| Item | Antes | Agora |
|---|---|---|
| Superfície | gradiente azul + 3 blobs `blur(80px)` | plana: `#ffffff` (claro) / `#0f0f0f` (escuro) |
| Card | vidro `rgba(255,255,255,.055)` + blur + glow ciano | `#ffffff` com contorno `#dbdbdb`, raio 8px, sombra só no hover |
| Ação primária | gradiente ciano→azul→violeta | vermelho sólido `#e1002d` (hover `#c41e3a`) |
| Acento/foco/link | ciano `#22d3ee` | azul `#065fd4` (claro) / `#3ea6ff` (escuro) |
| Forma | raio 18px no card | botão, chip e campo em **pill**; card 8px |
| Tipografia | Inter, corpo 13px, rótulo 11px caixa alta | pilha **Roboto** (fallback `[YT-1]`), corpo 14px, rótulo 12px |
| Casca | topbar 64px + sidebar 232px em card de vidro | masthead 56px com **busca no centro** + guide 240px↔72px |
| Ícone | tile com gradiente e brilho | tom a 14% sobre a superfície, ícone na cor do tom |
| Tema | só escuro (`color-scheme: dark`) | claro (padrão) + escuro, em `[data-theme]` no `<html>` |

Arquivos que materializam a decisão:

- `src/styles/tokens.css` — tokens, os dois temas, e o bloco `@theme inline` do Tailwind.
- `src/styles/components.css` — primitivos, agora incluindo `.ams-chip` (filtro), `.ams-thumb`
  (thumbnail com badge de duração) e `.ams-search` (busca do masthead).
- `src/app/Topbar.tsx` — masthead: hambúrguer, marca, busca, aprovações, tema, canal.
- `src/app/Sidebar.tsx` — guide recolhível no desktop, gaveta no celular.
- `src/app/guide.tsx`, `src/app/theme.tsx` — estado do guide e do tema.
- `src/components/content/ContentCard.tsx` — cartão de vídeo (16:9 + duração).
- `src/features/conteudo/ConteudoPage.tsx` — chips de estado + busca de verdade (`?busca=`).

**Procedência dos valores** (regra do `AGENTS.md`: fato externo precisa de fonte): `[YT-1]`
<https://www.sokosumi.com/tools/design-md/analysis/youtube> (extração dos tokens do youtube.com em
25/09/2026) e `[YT-2]` <https://youtube-skins.com/youtube-dark-mode> (guia de 09/2026 com os códigos
do tema escuro). Cada token do `tokens.css` cita qual das duas o originou; o que não veio de nenhuma
está marcado `derivado` e existe para fechar contraste AA.

## Adendo — as duas barras laterais abrem e fecham (mesma sessão)

Pedido do dono, literal: *"as barras laterais têm que ter função de fechar/abrir, tanto da direita
quanto da esquerda"*.

**O que existia:** a barra esquerda só **encolhia** para um trilho de 72px (nunca fechava), e a barra
direita não tinha controle nenhum — era apenas uma coluna que a tela desenhava.

**Decisão:**

1. **Esquerda — aberta (240px) ou fechada (some).** O trilho de 72px saiu: com o pedido explícito de
   "fechar", manter um meio-termo que continua ocupando a tela não atende. Controles: o ☰ do masthead
   e um **×** dentro da própria barra (quem procura como fechar procura ali, não no canto oposto).
2. **Direita — aberta ou fechada** pelo botão **▥** do masthead. Ela é a coluna de contexto das telas
   de canal (plano da semana, decisão da revisão, indicadores).
3. **O fechamento da direita só vale a partir de `lg`/`xl`.** Abaixo disso a coluna não é barra
   lateral, é conteúdo empilhado — e na Revisão ela carrega o **botão de aprovar**. Esconder no
   celular a coluna da ação principal seria armadilha, não preferência.
4. **Como fecha:** a coluna é escrita por cada tela, não pela casca. A casca publica
   `data-rail-right` no `<html>` e o CSS esconde `.ams-split__aside` e alarga `.ams-split__main`. Cada
   tela só marca `.ams-split` + `data-split`. Evita reescrever 5 telas com estado local e mantém **um
   só dono** do estado (o `ShellProvider`).
5. **Estado é preferência de apresentação** (`ams-barra-esquerda`, `ams-barra-direita` no
   `localStorage`), aplicado em `useLayoutEffect` para não piscar. **Nenhum dos dois carrega
   `channelId`** — o invariante nº 2 continua intacto.

**Arquivos:** `src/app/shell.tsx` (novo; substitui `guide.tsx`), `Topbar.tsx`, `Sidebar.tsx`,
`components.css` (contrato `.ams-split`), e as 5 telas com coluna lateral.

**Efeito colateral assumido:** o botão da direita fica oculto no celular (`hidden lg:inline-flex`),
porque lá ele não tem o que fechar — botão que promete o que não faz é pior que botão ausente.
`--ams-guide-mini-w` foi **removido** (token órfão depois da decisão 1).

**Verificação:** `src/app/__tests__/barras-laterais.test.tsx` — **4/4**, cobrindo abrir/fechar das
duas, o × interno, `aria-controls` apontando para alvo que existe, o atributo `data-rail-right` que o
CSS lê, e a sobrevivência da escolha à remontagem da casca.

## Adendo — o ícone do app chegou do dono (mesma sessão)

Depois da decisão acima, o dono entregou o **ícone do app** e pediu para usá-lo: anel menta `#A5E3DD`
com uma linha de pulso desenhando "Ai", sobre bloco azul-marinho `#213454`.

**Efeito:** o masthead deixa de usar um bloco vermelho e passa a exibir a marca real do produto
(`.ams-logo-mark`). O vermelho continua sendo a cor de **ação** da camada YouTube (`--ams-primary`,
barra de progresso) — a marca do produto e a linguagem da plataforma ficam em papéis separados, que é
o correto.

**O que foi feito:** master intocado em `imagens/icone-app-original.png`; `public/icone-{32,48,96,180}.png`
gerados por recorte quadrado (93×93) com 1px de sangria; favicon e `apple-touch-icon` no `index.html`.
Verificado: alpha mínimo = 255 (nenhum anel semitransparente) e nenhuma borda branca residual — o
master tinha ~2px de branco nos cantos, herança de captura de tela.

**Pendência declarada:** o master tem **93px** de lado. `icone-180.png` é ampliação de ~1,9× e
**não** foram gerados `192`/`512`: um ícone instalável exige vetor ou PNG grande. `rebeca-branding`
pede/gera o vetor; `rebeca-pwa` não publica manifest antes disso.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Manter o painel noturno e só "modernizar" espaçamento e tipografia | Não atende ao pedido; deixaria o app com a identidade que o dono pediu para trocar |
| Clonar o youtube.com (feed de vídeos, player, cards sem contorno) | O produto **não é** um consumidor de vídeo: é painel de decisão. Copiar o feed apagaria a fila de aprovação, que é o coração do produto (`docs/00` §6) |
| Usar o vermelho `#ff0000` como cor do botão primário | Branco sobre `#ff0000` dá **4,00:1** e reprova em AA para texto de 14px. `#e1002d` (o `primary` da `[YT-1]`) dá **4,95:1** e passa |
| Carregar Roboto do CDN do Google Fonts | Servir o app transferiria o IP de cada usuário ao Google sem base legal mapeada — é exatamente o que a skill `lgpd-internacional` existe para barrar. Auto-hospedar é o caminho; não foi possível nesta sessão |
| Reduzir de 3 níveis de texto para 2 (como o YouTube tem) | `--ams-text-2` e `--ams-text-3` são usados em ~40 lugares e carregam hierarquia real (corpo × rótulo). Mantidos os três, todos AA |
| Renomear o prefixo `--ams-*` para `--yt-*` | Toca ~30 arquivos para ganho zero, e o nome do produto (D7) ainda está em aberto — o prefixo não deve ser decidido agora |

## Consequências

- **Positivas:** a identidade visual passa a conversar com o produto (ferramenta de YouTube);
  contraste AA fica demonstrado por cálculo, não por gosto; um só ponto (`tokens.css`) troca tema,
  densidade e cor; a busca do masthead dá função real a um elemento que existia só como promessa.
- **Negativas / custo assumido:** a identidade própria construída a partir de `imagens/modelo*.jpeg`
  **deixa de valer** — os dois modelos seguem no repositório como insumo histórico, não como contrato.
  O app fica parecido com um produto de terceiro; a diferenciação passa a depender do conteúdo
  (fila de aprovação, custo real, ciclo de 10 etapas), não da pele.
- **O que muda para o usuário:** o app abre claro; há um botão de tema na topbar; a navegação virou
  guide recolhível; a lista de conteúdo ganhou busca de verdade.
- **Impacto em isolamento multi-canal:** **nenhum**. O ADR não cria estado global novo. As duas
  preferências que passam a viver no navegador são tema (`ams-tema`) e estado do guide — nenhuma
  carrega `channelId`. O canal ativo continua só na URL, e o `GuideProvider` é remontado dentro do
  `AppShell`, que já recebe `key={channelId}` no `<main>`.
- **Impacto em custo por vídeo:** nenhum. Nada aqui gera mídia nem chama provedor.
- **Impacto em acessibilidade:** melhora. Corpo de 13px→14px e rótulo de 11px→12px, foco com anel
  visível nas duas superfícies, e alvos de toque do masthead em 40px.

## Verificação

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro |
| Testes das telas tocadas por este ADR | `pnpm exec vitest run src/features/revisao src/features/como-funciona src/data/__tests__/channel-scope.test.tsx` | ✅ **11/11 em 3 arquivos**, exit 0 — alvo real da mudança |
| Suíte completa | `pnpm exec vitest run --reporter=verbose` | ⚠️ **86/86 em 8 arquivos** em janela quieta; com 10 arquivos estoura o `testTimeout` de 20s por **contenção de runner** (ver abaixo) |
| Build de produção | `pnpm run build` (tsc + vite) | ✅ exit 0 — html 1,58 kB · **css 35,34 kB** (gzip 7,84) · js 459,91 kB (gzip 136,35) |
| Tokens chegaram ao bundle | `Select-String` no `dist/assets/*.css` | ✅ `[data-theme=dark]` presente; `color-mix` presente em 7 pontos (o tile depende dele) |
| Nenhum token morto em componente | grep de `--ams-*` em `src/**/*.tsx` | ✅ **0 ocorrências** de token removido |
| Nenhuma cor solta em componente | grep de `#[0-9a-f]{3,8}` em `src/**/*.tsx` e `components.css` | ✅ **0 ocorrências** |
| A casca nova renderiza | `src/data/__tests__/channel-scope.test.tsx` | ✅ passa — renderiza masthead + guide + Início e troca de canal pelo seletor da topbar |
| CSP × script de tema | `pnpm exec vitest run src/__tests__/headers.test.ts` | ✅ **8/8** — o hash do script inline bate com o `vercel.json` (contrato do `ADR-008`) |
| Ícones do app | inspeção de alpha dos PNG gerados | ✅ alpha mínimo = 255; 0 px quase-branco nos cantos |

Evidência das rodadas de teste: `.rebeca/evidencias/vitest-layout-youtube.txt` (tem as duas rodadas).

**A suíte completa não é confiável sob concorrência (D9) — agora com diagnóstico medido.** A rodada
completa reprovou `revisao > rejeitar exige motivo` com `Test timed out in 20000ms`, **sem nenhuma
falha de asserção**. O runner entregou a causa: `~21.67s startup each` para **10 workers** — o tempo vai
em subir ambiente jsdom, e o *startup* de um worker já supera o `testTimeout` de 20s. Não é regressão
deste ADR: **os 3 arquivos que este layout toca passam 11/11 isolados**, incluindo o teste que estourou
(7,2s). O `testTimeout` de 20s foi calibrado quando a suíte tinha 4 arquivos; a sessão paralela a levou
a 10. **Correção sugerida:** `isolate: false` (o runner estima "at least ~21.67s faster") — **não
aplicada**: `vite.config.ts` é de outra frente, e afrouxar limite de teste para "passar" é exatamente o
que este projeto chama de maquiar.

**Não verificado (declarado, não maquiado):**

1. **Fidelidade visual.** Não há navegador automatizado nesta sessão. A conferência foi estrutural
   (tokens no bundle, DOM nos testes), **não visual**. Precisa da sua olhada em `pnpm dev`.
2. **axe-core não rodou** nas telas. O contraste foi conferido **por cálculo** (ver `docs/03` §9), e
   o alvo de 44px no celular ainda não foi medido em viewport real.
3. **Roboto não está no repositório.** O host desta sessão não tem saída de rede (o `Invoke-WebRequest`
   e o `curl` falharam antes de baixar qualquer byte), então não deu para auto-hospedar os `.woff2`.
   O app usa a pilha `Roboto, 'Segoe UI', Arial` e cai para Segoe UI no Windows — que é o fallback
   que a própria `[YT-1]` declara. **Pendência para o `rebeca-branding`.**
4. **YouTube Sans não pode ser embarcada**: é fonte proprietária. A pilha a cita primeiro apenas para
   quem já a tem instalada; nunca será baixada.
5. **O ícone só existe em 93px de lado** — não há arte vetorial nem PNG grande. `icone-180.png` é
   ampliação de ~1,9× e não foram gerados `192`/`512`; o `rebeca-pwa` não deve publicar manifest
   antes do vetor (ver o Adendo).
6. **A árvore segue suja com trabalho de outra frente** (`src/ai/`, `server/`, `api/`,
   `src/__tests__/headers.test.ts`, `tsconfig.json`, `vite.config.ts` não commitados). **Nada deste
   ADR foi commitado** — de propósito: a pasta é compartilhada por duas sessões (D9) e o commit exige
   a pasta quieta.

## Quem decidiu

Proposto e implementado pelo agente `rebeca-react` (com `rebeca-branding` como dono da identidade).
**Aprovado pelo dono do produto por pedido direto na sessão.** A pendência de auto-hospedar Roboto e
o rebaixamento dos modelos `imagens/modelo*.jpeg` a insumo histórico ficam registrados para o
`rebeca-branding` confirmar.
