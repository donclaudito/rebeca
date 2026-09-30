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
   usuário vê, conforme ADR-002), publicando em `ai-media-studio.vercel.app`.
3. O deploy é por **integração Git**, não por CLI: `push` em `main` → build e publicação automáticos;
   PR → URL de preview. A Vercel roda `pnpm install --frozen-lockfile` e `pnpm build` (configurado em
   `vercel.json`), em Linux.
4. Como o app usa `BrowserRouter`, rotas profundas (ex.: `/c/luna/inicio`) não existem como arquivo.
   `vercel.json` declara **rewrite catch-all para `/index.html`**; `/assets/*` continua sendo servido
   do disco porque o rewrite só alcança o que não é arquivo real. *(Comportamento da ordem
   arquivo-antes-de-rewrite: premissa adotada a partir do padrão de SPA da Vercel; prova exigida na
   Verificação, com HTTP 200 em rota profunda — não aceito como fato até esse teste.)*
5. O **piso de Node é 22.x** (`engines.node: ">=22.12.0"`), imposto pelo toolchain real: `vitest@5`
   exige `^22.12.0` e `vite@8` exige `^20.19.0 || >=22.12.0`. O CI do Actions testa **no piso**
   (node@22), que é o cenário mais restritivo.
6. **O CI não faz deploy.** Ele roda tipos, testes, build e uma varredura de segredo em texto claro.
   Publicar é ação da integração Git da Vercel, com trilha por commit. Nenhum job de CI publica no
   YouTube nem gasta API paga — invariante de aprovação humana preservado.
7. **O Windows não entra no pipeline.** A Vercel compila em Linux; a máquina Windows é ambiente de
   desenvolvimento. Isso evita que o deploy dependa de peculiaridades locais (o watcher com `EBUSY`,
   por exemplo).

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
- O que muda para o usuário: ele deixa de precisar da máquina ligada rodando `pnpm dev` e passa a ter
  um link.
- Impacto em isolamento multi-canal: **nenhum**. A hospedagem é de arquivo estático; todo dado continua
  vindo do mock escopado por canal e coberto por `src/data/__tests__/channel-scope.test.tsx`.
- Impacto em custo por vídeo: **nenhum**. Nada aqui chama provedor pago nem lança linha em
  `.rebeca/custos.csv`.

## Verificação
1. `pnpm build` local verde (tipos + `vite build` gerando `dist/`).
2. CI do repositório verde na `main` (tipos, testes, build, varredura de segredo).
3. **A prova que importa:** a URL publicada responde `200` em `/` **e** em rota profunda
   `/c/luna/inicio` — é isso que refuta (ou confirma) o item 4 da Decisão e prova que o rewrite de SPA
   funciona.
4. `git ls-files` não contém `.env`, `*.pem`, `*.key` nem `node_modules/`.

Reavaliar quando existir backend real (D1, segunda metade): se a API passar a ter função de servidor,
ela ganha projeto e configuração próprios, e este ADR deixa de cobrir tudo.

## Quem decidiu
Proposto por `rebeca-github` + `rebeca-orquestrador`. **Aprovado pelo dono do produto nesta sessão**,
nas escolhas: repositório **privado**; repo `rebeca` + projeto Vercel `ai-media-studio`; versionar
tudo exceto build e segredos; e **o próprio dono faz o import na Vercel** (sem token compartilhado).
