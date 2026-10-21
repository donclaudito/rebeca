# ADR-016 — O app passa a rodar também como aplicativo instalável local (sem Vercel)

## Status
aceito

## Data
2026-10-04

## Contexto

O dono do produto perguntou, nesta sessão, se era possível ter o app **instalável na máquina dele e
copiável para outra máquina** (a da Rebeca, por exemplo) **sem depender de subir na nuvem via
Vercel**.

O `ADR-003` decidiu "onde roda" conhecendo apenas duas superfícies: repositório privado no GitHub e
hospedagem estática + funções serverless na Vercel. De lá para cá o app deixou de ser uma SPA inerte:
ele tem camada de IA (`ADR-006`), pipeline de mídia com `ffmpeg` (`ADR-010`, `ADR-012`, `ADR-013`) e
autenticação por ID token do Google (`ADR-014`). Auditoria do próprio repositório, feita agora:

| Fato verificado nesta sessão | Consequência |
|---|---|
| A API existe em **dois plugues**: middleware do Vite (`server/*/vite-plugin.ts`, só em `pnpm dev`) e funções serverless (`api/*.ts`, só na Vercel) | **Não existe servidor de produção local.** `dist/` sozinho não funciona: sem ele não há IA, nem mídia, nem autenticação |
| Não há `createServer`, `express`, `sirv` nem pasta `scripts/` no repositório | A peça que falta é o **terceiro plugue**, não a Vercel |
| `server/media/ffmpeg.ts` chama `ffmpeg`/`ffprobe` do PATH (aqui: ffmpeg 8.1.2, confirmado) | Render de vídeo **não existe** em serverless |
| O teto diário de gasto depende de livro de custos durável (`ADR-006`, achado `QA-006 #1`) | Em serverless, geração paga é **recusada com 403**; local ela funciona |
| `server/dev-env.ts` lê `.env` só quando **não** há `VERCEL` nem `VITEST` no ambiente | O modo local é um estado já previsto no código, e é hoje o único lugar onde a escrita de configuração é liberada |

Ou seja: hoje a máquina local é o ambiente **mais capaz** que existe, e o único jeito de usá-la é
`pnpm dev` — servidor de desenvolvimento, com watcher, carregamento por `ssrLoadModule` e todo o
toolchain de build instalado. Isso não é um aplicativo instalável, não sobrevive a `Ctrl+C` e não vai
para outra máquina.

Se nada fosse decidido, o dono continuaria dependendo de Vercel para ver o app de outro computador — e
a Vercel é, justamente, o ambiente onde o pipeline de mídia **não roda** e o teto de gasto **não vale**.

## Decisão

1. **O app ganha um terceiro plugue: um servidor Node de produção local**, em `server/local/`
   (`cli.ts` → `server.ts`), que serve `dist/` com *fallback* de SPA e monta os **mesmos roteadores**
   já usados pelos outros dois plugues:
   `routeAiRequest` (`server/ai/http.ts`), `routeMediaRequest` (`server/media/http.ts`) e
   `routeAuthRequest` (`server/auth/http.ts`).
   **Nenhuma regra de rota é reescrita aqui** — duplicar lógica entre plugues é o defeito que o
   repositório já documentou duas vezes (`server/ai/vite-plugin.ts`, cabeçalho; `.rebeca/estado.md`,
   "Correção — HTTP 500…").
2. **Escuta apenas em `127.0.0.1`**, porta padrão **8787**, sobreponível por `REBECA_HOST` e
   `REBECA_PORT`. Endereço local não é endereço de rede: o app gasta dinheiro e carrega o token do
   Google, e não pode ficar exposto na rede da casa ou do escritório por descuido de padrão.
3. **Os cabeçalhos de segurança vêm do `vercel.json`, lidos em tempo de execução** (fonte única, já
   coberta por `src/__tests__/headers.test.ts`), com **duas subtrações explícitas no modo local**:
   - `upgrade-insecure-requests` **sai**: o servidor local é HTTP puro, e a diretiva manda o navegador
     reescrever requisições inseguras para HTTPS. A isenção de `localhost` **não é comportamento
     padronizado** — há pedido aberto para excluí-lo ([whatwg/fetch #1780](https://lists.w3.org/Archives/Public/public-webapps-github/2024Oct/0412.html))
     e bug aberto no WebKit ([250776](https://wiki.webkit.org/show_bug.cgi?id=250776)) — logo não é
     coisa em que se apoiar. Se a diretiva valesse aqui, **toda** chamada a `/api/*` do próprio app
     seria reescrita para `https://127.0.0.1:8787/...` e falharia. (Comportamento do navegador em
     localhost nesta máquina: **NÃO VERIFICADO** — não há navegador automatizado nesta sessão; por isso
     a decisão é a que não depende dele.)
   - `Strict-Transport-Security` **sai**: HSTS só tem efeito sobre HTTPS, e o servidor local não é
     HTTPS. Mantê-lo seria um cabeçalho que mente sobre a superfície.
4. **A raiz de dados é a pasta do app**, fixada pelo próprio entrypoint em `REBECA_ROOT` (variável que
   já existia para os testes), em vez de depender de `process.cwd()`. Consequências: `.rebeca/` (ativos,
   livro de custos, prompts de canal, segredos) fica **ao lado do app**, e fazer backup é copiar essa
   pasta. Nada é redirecionado para fora da árvore: `server/media/channel-spec.ts` lê
   `.rebeca/canais/<canal>/` e precisa achá-la.
5. **O código do servidor é compilado por `tsc -p tsconfig.server.json` para `build/`** — pasta
   separada, ignorada pelo git, **nunca ao lado dos `.ts`**. O `estado.md` registra o que aconteceu
   quando um experimento emitiu 74 `.js` dentro de `api/`, `server/` e `src/`: um `git add -A`
   distraído levaria JS obsoleto duplicando as funções.
6. **A autenticação continua a do `ADR-014`** (foi a escolha do dono nesta sessão, entre mantê-la e um
   "modo dono local" sem login): ID token do Google verificado no servidor + lista por `sub` em
   `REBECA_ALLOWED_SUBS`, com falha fechada (503 sem `GOOGLE_CLIENT_ID`). Consequência operacional: a
   origem `http://127.0.0.1:8787` precisa ser cadastrada como **origem JavaScript autorizada** no
   cliente OAuth do Google Cloud, e cada pessoa autorizada entra pelo próprio `sub`.
7. **A Vercel continua existindo como alvo secundário, sem alteração.** Este ADR não remove nem
   modifica `api/`, `vercel.json` ou o deploy por Git. Ele acrescenta um caminho; não troca o outro.
8. **O empacotamento para outra máquina é parte desta decisão** (script PowerShell idempotente +
   runtime portátil de Node e ffmpeg), e a **fila de job longo fica declarada como não resolvida
   aqui** — é a `D1`, e continua aberta: gerar/renderizar dentro do request HTTP é o defeito que já
   produziu o 504 relatado pelo dono (`.rebeca/estado.md`, "Não verificado" nº 3 da correção de 500).

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| **Continuar só com `pnpm dev`** como forma de rodar local | Não é aplicativo: exige Node + pnpm + `node_modules` + o toolchain de build na máquina de destino, sobe com watcher do Vite (que já derrubou o processo com `EBUSY`), carrega rotas por `ssrLoadModule` e não tem endereço estável. Serve para desenvolver, não para operar |
| **PWA apenas** (manifest + service worker, sem servidor) | Não resolve: sem servidor não existe `/api/*`, e o app fica sem IA, sem mídia e sem custo. PWA é útil **por cima** deste ADR (janela própria, ícone, shell offline) e foi oferecido ao dono como nível B; não substitui o servidor |
| **Electron ou Tauri** (instalador `.exe` com tudo dentro) | Empacota o mesmo servidor num runtime a mais (150–250 MB), com um pipeline de build próprio para manter, e **não entrega nenhuma função nova** em relação ao nível A. Fica como evolução se o dono quiser instalador de verdade com entradas no menu Iniciar |
| **Rodar o TypeScript direto no Node** (`--experimental-strip-types`) | Os imports do servidor usam o specifier `.js` (exigência do ESM da Vercel, ver "Correção — HTTP 500"), e o Node **não** resolve `.js` para `.ts`. Funcionaria só reescrevendo 35 specifiers e quebrando o deploy da Vercel |
| **Reimplementar as rotas num "servidor local" novo** | Duas implementações de "verificar token" ou "listar episódios" divergem, e a divergente é a que ninguém testou. O custo real disso já apareceu neste projeto: `pnpm dev` aceitaria o que a Vercel recusa |
| **Empacotar com esbuild/rolldown num único arquivo** | Resolveria o mesmo problema, mas troca o compilador que já é contrato do repositório (`tsc --noEmit` no CI) por mais uma dependência de build e mais um alvo de guarda de imports. O `tsc` já emite ESM correto com os specifiers que o projeto usa |
| **Servir HTTPS local com certificado autoassinado** | Manteria o CSP idêntico ao da Vercel, ao custo de um certificado para instalar e renovar em cada máquina e de um aviso de segurança do navegador que ensina o usuário a clicar em "prosseguir". Troca ruim: o ganho é cosmético e o risco ensinado é real |

## Consequências

- **Positivas:**
  - O app passa a rodar **sem nuvem**, sem conta em serviço nenhum e sem Vercel.
  - Na máquina local voltam a funcionar três coisas que a Vercel **não** faz: render com `ffmpeg`,
    **teto diário de gasto com livro durável** e escrita da configuração de IA.
  - O mesmo roteador, a mesma guarda e o mesmo isolamento por canal (invariante nº 2) valem nas três
    superfícies; um teste novo sobe o servidor de verdade contra uma raiz temporária e confere isso.
  - `dist/` deixa de ser um artefato que só serve para a Vercel.
- **Negativas / custo assumido:**
  - **Mais uma superfície para manter em sincronia.** Mitigação: os roteadores são compartilhados e há
    teste que sobe o servidor; o risco residual é o *empacotamento* (caminho do `dist/`, do runtime, do
    `.env`) envelhecer — e isso o teste de fumaça do instalador cobre.
  - **Modo local não tem HTTPS, HSTS nem a diretiva de upgrade** — o CSP local é, de propósito, um
    pouco mais frouxo que o da Vercel. Está escrito aqui para não virar surpresa.
  - **A `D1` continua aberta:** job longo dentro do request HTTP. Instalar localmente **não** conserta
    o 504 de geração; ele fica mais visível, porque o dono passa a usar o app de verdade.
  - O pacote portátil carrega Node e ffmpeg (~120 MB): é o preço de "não precisa instalar nada na
    outra máquina".
- **O que muda para o usuário:** dois cliques em vez de um deploy. Copiar a pasta, rodar o instalador
  (ou o `Rebeca.cmd`, no pacote já pronto), entrar com a conta Google autorizada. Sem Vercel, sem
  esperar build, sem internet para usar o app depois de instalado (a internet continua necessária para
  a IA e para o login).
- **Impacto em isolamento multi-canal:** **nenhum** — `server/media/paths.ts` e a guarda de identidade
  não foram tocados. O servidor local apenas transporta. O que muda é a raiz do disco, e ela continua
  sendo `.rebeca/assets/<canal>/`.
- **Impacto em custo por vídeo:** nenhum gasto novo por esta decisão. Indiretamente **positivo**: é no
  modo local que o teto diário (`ADR-006`) e o teto por minuto/mês (`ADR-010`) realmente vigiam, porque
  o livro é um arquivo em disco.

## Verificação

1. `pnpm exec vitest run src/__tests__/app-local.test.ts` — sobe o servidor de verdade numa raiz
   temporária e confere: HTML em `/`, *fallback* de SPA em rota funda, **404 para asset inexistente**
   (nunca HTML), recusa de travessia de caminho (`..`, percent-encoded), cabeçalhos de segurança sem
   `upgrade-insecure-requests`, hash do script inline autorizado (contrato do `ADR-008`), `/api/*`
   desconhecido em JSON e **401 na rota de IA sem token** (prova de que a guarda do `ADR-014` está na
   frente do servidor local).
2. `pnpm run start:local` com o `dist/` real construído: `GET /`, `GET /c/luna/inicio` e
   `GET /api/auth/config` respondendo, com a porta escutando **só** em `127.0.0.1`.
3. `pnpm typecheck` e `pnpm test` completos verdes, e `pnpm run build:server` emitindo em `build/`
   **sem** deixar `.js` ao lado de `.ts` (`git status --porcelain api server src` limpo).
4. Revisão adversarial do `rebeca-qa`: desligar a checagem de contenção de caminho e confirmar que o
   teste de travessia fica **vermelho**; idem para o *fallback* de SPA em `/assets/*`.
5. Reavaliação: se o dono pedir instalador `.exe` com atalho no menu Iniciar, esta decisão é
   **estendida**, não substituída (nível C, Electron/Tauri, sobre o mesmo servidor).

## Quem decidiu

Proposto por `rebeca-arquiteto` com `rebeca-backend` (servidor e roteamento) e `rebeca-powershell`
(empacotamento). **Aprovado pelo dono do produto em 2026-10-04**, que escolheu explicitamente:
nível **A** (servidor local + pasta portátil) e **manter o login do Google** em vez de um modo sem
autenticação.
