# ADR-003 — Onde o protótipo roda: repositório privado no GitHub + Vercel (decisão D6)

## Status
aceito

## Data
2026-09-30

## Contexto
A decisão **D6** de `.rebeca/estado.md` ("onde roda: local Windows, VPS, Vercel/Supabase Cloud, e como
o Windows entra no build") estava aberta e é uma das que bloqueiam a fase F1. O dono do produto pediu
nesta sessão: **publicar o protótipo na nuvem usando GitHub e Vercel**.

O que existe hoje é uma **SPA estática** (React 19 + Vite, ADR-001) que roda com **dados de exemplo**
em `src/data/mock/`. Ela não tem servidor, não autentica, não chama provedor de IA, não trata dado
pessoal e não guarda credencial. Isso significa que "onde roda" hoje é só uma pergunta de hospedagem
de arquivo estático — e não de backend. Se nada fosse decidido, o dono continuaria dependendo de
`pnpm dev` na máquina dele para ver o app, e a fidelidade visual (o item nº 1 declarado como **não
verificado** em `.rebeca/estado.md`) não poderia ser conferida de outro dispositivo.

## Decisão
1. O código passa a viver em um **repositório privado** no GitHub: `donclaudito/rebeca`. Além do app,
   o repositório versiona a memória durável e a orquestra (`.rebeca/`, `.dsh/`, `docs/`, `imagens/`,
   `O APP.pdf`) — é o que `AGENTS.md` chama de memória durável do projeto. Repositório **privado**
   precisamente por isso: contém o PDF do cliente e a estratégia de produto.
2. A **Vercel** hospeda o resultado do build estático, no projeto **`ai-media-studio`** (a marca que o
   usuário vê, conforme ADR-002). **A URL final não é afirmada aqui — e isso é uma correção.**
   `ai-media-studio.vercel.app` **já pertence a terceiro**: verificado em 2026-09-30, HTTP 200
   servindo outro produto de vídeo com IA (modelos Wan 2.2 / LTX / FLUX). Subdomínio `*.vercel.app`
   é único no mundo, então na importação a Vercel vai atribuir uma URL livre (sufixo aleatório) ou
   pedir outro nome de projeto. A URL só entra neste ADR **depois de observada**, pelo teste do item 3
   da Verificação. Consequência de produto: o nome "AI Media Studio" também já está ocupado como
   subdomínio — insumo direto para a decisão **D7** (nome do produto).

   **Atualização de 2026-09-30 — a URL foi observada:** o dono importou o repositório e a produção
   vive em **`https://rebeca-odda.vercel.app`** (projeto `rebeca-odda`). Há **dois** projetos da Vercel
   recebendo este repositório (`rebeca-odda` e `rebeca`), o que duplica builds e deploys: convém
   manter um só. O nome do projeto **não** é `ai-media-studio`, exatamente como o parágrafo acima
   previa.
3. O deploy é por **integração Git**, não por CLI: `push` em `main` → build e publicação automáticos;
   PR → URL de preview. A Vercel roda `pnpm install --frozen-lockfile` e `pnpm build` (configurado em
   `vercel.json`), em Linux.
4. Como o app usa `BrowserRouter`, rotas profundas (ex.: `/c/luna/inicio`) não existem como arquivo.
   `vercel.json` declara **rewrite catch-all para `/index.html`**; `/assets/*` continua sendo servido
   do disco porque o rewrite só alcança o que não é arquivo real. *(Comportamento da ordem
   arquivo-antes-de-rewrite: premissa adotada a partir do padrão de SPA da Vercel; prova exigida na
   Verificação, com HTTP 200 em rota profunda — não aceito como fato até esse teste.)*
5. O **piso de Node é 22.x** (`engines.node: ">=22.12.0"`), imposto pelo toolchain real: `vitest@5`
   exige `^22.12.0 || ^24.0.0 || >=26.0.0` e `vite@8` exige `^20.19.0 || >=22.12.0`. O CI do Actions
   testa **no piso** (node@22), que é o cenário mais restritivo — a Vercel, com essa faixa, roda
   **Node 24.x** (verificado na Verificação, item 5).
6. **O CI não faz deploy.** Ele roda tipos, testes, build e uma varredura de segredo em texto claro.
   Publicar é ação da integração Git da Vercel, com trilha por commit. Nenhum job de CI publica no
   YouTube nem gasta API paga — invariante de aprovação humana preservado.
7. **O Windows não entra no pipeline.** A Vercel compila em Linux; a máquina Windows é ambiente de
   desenvolvimento. Isso evita que o deploy dependa de peculiaridades locais (o watcher com `EBUSY`,
   por exemplo).
8. **A versão do pnpm é fixada em `package.json#packageManager` (`pnpm@11.25.0`).** Sem esse campo a
   Vercel instalaria com **pnpm 10**, por comportamento deliberado dela: em
   `packages/build-utils/src/fs/run-user-scripts.ts`, `detectPnpmVersion()` só prefere pnpm 11 para
   `lockfileVersion 9.0` quando o projeto foi criado a partir de `PNPM_11_PREFERRED_AT`
   (`2027-03-01` — adiado de 2026-08-19 porque o pnpm 11 liga `minimumReleaseAge` de 1 dia e quebrou
   projetos novos sem pin). Com o pin, CI e máquina de desenvolvimento usam a mesma versão, e a
   produção tenta a mesma. **Ressalva honesta:** o pin só é honrado se `/pnpm11` existir na imagem de
   build (`isPnpmMajorAvailable`); se não existir, a Vercel cai para pnpm 10 **sem erro**. Isso é
   aceitável — `validLockfileForPackageManager()` mostra que o pnpm 10 aceita `lockfileVersion 9.0` —
   mas fica registrado como divergência a conferir no log do primeiro build, não como fato resolvido.

## Alternativas descartadas
| Alternativa | Por que foi descartada |
|---|---|
| Publicar pelo **Vercel CLI** a partir desta máquina | O CLI não está autenticado nesta máquina e é bloqueado pelo sandbox (`spawn EPERM` no checador de versão). Publicar exigiria criar um token da Vercel e entregá-lo ao agente — segredo de longa duração trocado por conveniência. |
| Deploy por **GitHub Action** com `vercel deploy --prod` + `VERCEL_TOKEN` | Um segundo segredo permanente para criar e rotacionar, duplicando o que a integração Git da Vercel já faz sem segredo nenhum. Rejeitado nesta fase; reconsiderar se um dia for preciso deploy fora do Git. |
| **VPS própria** | Custo mensal e trabalho de operação (TLS, proxy reverso, deploy, uptime) para servir arquivo estático. Sem ganho para o que existe hoje. |
| **Repositório público** | Expõe `O APP.pdf` (documento do cliente), a visão de produto e a orquestra interna. Exposição é irreversível; não há ganho de produto. |
| **HashRouter** para dispensar o rewrite | URLs `/#/c/luna/inicio` são piores de compartilhar, de ler e de evoluir para SEO quando o produto tiver landing page. Trocar o roteador para contornar configuração de host inverte a prioridade. |
| Versionar o repositório **sem** a orquestra (só `src/`) | Perde histórico e backup da memória durável (`.rebeca/estado.md`, ADRs, evidências) e da própria orquestra. O `AGENTS.md` trata esses arquivos como parte do projeto, não como sobra local. |

## Consequências
- Positivas: o dono abre uma URL e confere a fidelidade visual de qualquer dispositivo — ataca
  diretamente o item "não verificado nº 1" de `.rebeca/estado.md`; cada PR ganha URL de preview para
  revisão adversarial antes do merge; todo deploy é imutável e tem rollback.
- Negativas / custo assumido: a Vercel passa a ter acesso de leitura a um repositório privado que
  contém material do cliente, e a pasta deixa de ser puramente local. **Custo de hospedagem: `NÃO
  VERIFICADO`** — a expectativa é plano gratuito, mas limite de build, banda e usuários do plano precisa
  ser conferido na conta antes de assumir compromisso. Enquanto o protótipo não tratar dado pessoal,
  não há operador de dado a declarar (o mapa de operadores passa a importar na fase de dados reais —
  `rebeca-lgpd`).
- O que muda para o usuário: **depois que ele concluir a importação**, deixa de precisar da máquina
  ligada rodando `pnpm dev` e passa a ter um link. Hoje existem o repositório e o CI verde; o link
  **ainda não existe** — a pendência é o import na Vercel.
- Impacto em isolamento multi-canal: **nenhum**. A hospedagem é de arquivo estático; todo dado continua
  vindo do mock escopado por canal e coberto por `src/data/__tests__/channel-scope.test.tsx`.
- Impacto em custo por vídeo: **nenhum**. Nada aqui chama provedor pago nem lança linha em
  `.rebeca/custos.csv`.

## Verificação
1. `pnpm build` local verde (tipos + `vite build` gerando `dist/`).
2. CI do repositório verde na `main` (tipos, testes, build, varredura de segredo).
3. **A prova que importa — FEITA em 2026-09-30.** A URL publicada responde **HTTP 200** em `/` **e**
   em rota profunda `/c/luna/inicio`, observada com `web_fetch` em
   `https://rebeca-odda.vercel.app/c/luna/inicio`. **Logo o rewrite de SPA funciona e o item 4 da
   Decisão está confirmado, não mais presumido.** A URL observada é
   `https://rebeca-odda.vercel.app` (projeto `rebeca-odda`, criado pelo dono no import) — e não
   `ai-media-studio.vercel.app`, como o item 2 já corrigia.

   **Achado colateral desta prova, ainda aberto:** as funções serverless respondem **HTTP 500** em
   produção. `GET /api/ai/status` e `GET /api/ai/settings` devolvem o JSON de erro genérico da
   própria Vercel (`{"error":{"code":"500","message":"A server error has occurred"}}`), não o HTML do
   app. **Isso prova duas coisas:** (a) o rewrite catch-all **não** atropela `/api/*` — a requisição
   chega na função; (b) a função **quebra** no runtime da Vercel. **Causa-raiz: `NÃO VERIFICADO` no
   runtime da Vercel** — exige o log do projeto, que não é acessível por este agente.
   **Correção de um raciocínio meu anterior:** uma reprodução local com `VERCEL=1` falhou com
   `Cannot find module '…/src/ai/contract' imported from '…/server/ai/http.ts'` e eu tratei isso como
   "artefato de tooling, não serve de diagnóstico". **Descartei errado.** Os imports de `server/` e
   `api/` são **sem extensão** (estilo TypeScript) e o `package.json` declara `"type": "module"` — em
   ESM o Node **exige extensão explícita**. A falha local e o 500 de produção têm o **mesmo sintoma**,
   o que torna esta a hipótese principal — ainda **não confirmada** no runtime da Vercel.
   Hipóteses, nesta ordem: (1) resolução ESM de import sem extensão no caminho `api/` → `server/` →
   `src/`, que é o que a reprodução local mostra; (2) o empacotamento não compilar os módulos de fora
   de `api/`. O grafo de imports é limpo (só built-ins do Node), o que **descarta** dependência
   faltando. **Como confirmar:** Vercel → projeto → o deployment → Functions → Logs da invocação que
   falhou. **Correções possíveis, a decidir com o erro em mãos:** extensão `.js` explícita nos imports
   relativos de `server/` e `api/` (convenção ESM + TypeScript), ou um passo de bundle
   (`esbuild --bundle --platform=node`) com a função consumindo a saída.
   **Consequência para o dono: a IA não funciona em produção até isso ser resolvido** — o que, por
   outro lado, coincide com a recusa de geração paga em serverless já registrada em
   `server/ai/handler.ts:449`. Uma chave paga real foi cadastrada pelo dono em 2026-10-01 e funciona
   **em desenvolvimento** (`ADR-006`, "Verificação com chave paga real"); é **só** no deploy que ela
   não é alcançada.
4. `git ls-files` não contém `.env`, `*.pem`, `*.key` nem `node_modules/`.
5. **Resolução da versão do Node na Vercel — verificada na implementação, não presumida.** Lido
   `packages/build-utils/src/fs/node-version.ts` do repositório `vercel/vercel`
   (`raw.githubusercontent.com/vercel/vercel/main/...`, 2026-09-30): `getSupportedNodeVersion()`
   percorre `NODE_VERSIONS` **do mais novo para o mais antigo** e seleciona o primeiro cujo `range`
   **intersecta** o valor de `engines.node`. Com `">=22.12.0"` o primeiro intersectado é `24.x`
   → **a Vercel constrói com Node 24.x**, que satisfaz `vite@8` e `vitest@5`. A mesma fonte mostra
   `discontinueDate: 2026-10-01` para o Node 20: o piso 22 adotado aqui evita a versão que é
   descontinuada exatamente hoje, sem depender de ajuste manual no painel.
6. CI do repositório na `main`: verde, com os 8 steps do workflow.
7. **Varredura de segredo endurecida depois da revisão adversarial.** O `rebeca-qa` refutou o
   controle que este ADR descrevia: o `git grep -I` do CI **pulava** os `.rebeca/evidencias/*.txt`,
   que no Windows saem em UTF-16LE. Provado com segredo falso plantado: o mesmo `AIza…` era achado em
   UTF-8 e **invisível** em UTF-16LE. Substituído por `.tools/scan_secrets.py`, que lê cada blob em
   bytes, decide a codificação pelo conteúdo (BOM/NUL) e varre **árvore + histórico**
   (`fetch-depth: 0`), mascarando o valor na saída para o log do CI não virar o vazamento. Verificado:
   planta em UTF-8 e UTF-16LE → as duas achadas; árvore e histórico reais → limpos, sem falso
   positivo contra a documentação do projeto (que cita `AIza`, `eyJ` e `refresh_token`).

Reavaliar quando existir backend real (D1, segunda metade): se a API passar a ter função de servidor,
ela ganha projeto e configuração próprios, e este ADR deixa de cobrir tudo.

## Quem decidiu
Proposto por `rebeca-github` + `rebeca-orquestrador`. **Aprovado pelo dono do produto nesta sessão**,
nas escolhas: repositório **privado**; repo `rebeca` + projeto Vercel `ai-media-studio`; versionar
tudo exceto build e segredos; e **o próprio dono faz o import na Vercel** (sem token compartilhado).
