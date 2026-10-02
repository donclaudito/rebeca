# Rebeca

Plataforma que opera o ciclo completo de canais de YouTube feitos com IA: pesquisa → planejamento →
criação → revisão → **aprovação humana** → agendamento → publicação → medição → aprendizado.

> "Hoje uma pessoa precisa usar cinco ou dez ferramentas diferentes para operar um canal de YouTube
> com IA. Nós queremos transformar todo esse processo em um único aplicativo inteligente.
> A IA faz o trabalho. A pessoa dirige e aprova."

## Por onde começar

| Quero… | Leia |
|---|---|
| entender o produto | [`docs/00-visao-produto.md`](docs/00-visao-produto.md) |
| saber quem são os agentes e como delegar | [`docs/01-orquestra-de-agentes.md`](docs/01-orquestra-de-agentes.md) |
| rodar um fluxo de trabalho | [`docs/02-fluxos.md`](docs/02-fluxos.md) |
| escrever uma skill nova | [`docs/modelo-skill.md`](docs/modelo-skill.md) |
| saber onde o projeto está | [`.rebeca/estado.md`](.rebeca/estado.md) |
| as regras do repositório | [`AGENTS.md`](AGENTS.md) |

## A orquestra

18 especialistas, cada um com uma skill própria em `.dsh/skills/`, carregada sob demanda:

**Núcleo** `rebeca-orquestrador` · **Produto** `rebeca-produto`
**Engenharia** `rebeca-arquiteto`, `rebeca-backend`, `rebeca-supabase`, `rebeca-react`, `rebeca-pwa`,
`rebeca-github`, `rebeca-powershell`, `rebeca-prompt-eng`
**Mídia** `rebeca-ia-video`, `rebeca-youtube`
**Conteúdo** `rebeca-infantil`, `rebeca-branding`, `rebeca-analytics`
**Confiança** `rebeca-lgpd`, `rebeca-seguranca`, `rebeca-qa`

## Fluxos executáveis

- `.dsh/workflows/rebeca-blueprint.js` — blueprint técnico da fundação (11 especialistas + síntese)
- `.dsh/workflows/rebeca-episodio.js` — produção de um episódio, da adequação infantil à revisão final
- `.dsh/workflows/rebeca-sprint.js` — implementação de uma história com revisão adversarial

## Verificação

```powershell
python "E:\pojeto rebeca\.tools\validar_skills.py"   # 18 skills: frontmatter, nome, seções
```

## Rodar o app

```powershell
pnpm install
Copy-Item .env.example .env   # preencha GOOGLE_CLIENT_ID e REBECA_ALLOWED_SUBS (ver "Entrar no app")
pnpm dev        # http://127.0.0.1:5173
pnpm typecheck  # tsc --noEmit  (cobre src/, server/ e api/)
pnpm test       # vitest
pnpm build      # confere prompts + tipos + vite build -> dist/
pnpm prompts:check   # o prompt versionado e o que executa estão iguais?
```

Precisa de **Node >= 22.12** (piso imposto por `vitest@5` e `vite@8`; declarado em `engines`).

## Entrar no app (autenticação)

Desde o `ADR-014` o app **não abre** para quem não entrou, e as rotas de `api/ai/*` e `api/media/*`
exigem um **ID token do Google** verificado no servidor. É isso que permite a chave paga existir no
servidor publicado sem que qualquer visitante a consuma (`ADR-011`, camada 3).

Duas variáveis, e só a segunda é segredo:

| Variável | O que é |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID do OAuth criado no Google Cloud (*Web application*). **Público** por definição: vai no bundle do navegador e é o `aud` que o servidor confere |
| `REBECA_ALLOWED_SUBS` | **O controle de acesso.** Lista de `sub`s autorizados, separados por vírgula — fica **só no servidor** |

O `sub` é o identificador numérico da conta Google, **não o e-mail** (a própria documentação do Google
avisa que uma conta pode trocar de endereço; o `sub` nunca muda). Para descobrir o seu: rode o app,
clique em entrar — a **tela de entrada mostra o `sub`** quando a conta ainda não está autorizada, e a
tela de Configurações mostra o mesmo valor depois. Passo a passo completo, incluindo o que fazer no
Google Cloud e na Vercel: [`docs/passo-a-passo-autenticacao-google.md`](docs/passo-a-passo-autenticacao-google.md).

**Sem `GOOGLE_CLIENT_ID` o app responde 503 em tudo** — falha fechada de propósito: erro de
configuração não pode virar porta aberta para a chave paga.

## Camada de IA

Cada função do app tem o modelo que faz sentido para ela — o usuário escolhe o canal, não o modelo.
São **15 funções** (pesquisar tendência, planejar semana, roteiro, storyboard, thumbnail, SEO, revisão
de qualidade, checagem infantil, horário, leitura de desempenho, aprendizado, melhoria de pauta,
personagem, veredito de custo e material de divulgação).

**Para ligar o app:** abra **Configurações → Inteligência artificial** dentro do app. Ali você cola a
chave, troca o endereço do provedor se precisar, escolhe o modelo de cada tipo de trabalho — e pode
sobrescrever uma função específica — e clica em **testar conexão**. Não precisa editar `.env` nem
reiniciar o servidor.

| Quero… | Leia |
|---|---|
| a decisão e os trade-offs da camada | [`.rebeca/decisoes/ADR-006-camada-de-llm-por-funcao.md`](.rebeca/decisoes/ADR-006-camada-de-llm-por-funcao.md) |
| a decisão sobre a tela de configuração | [`.rebeca/decisoes/ADR-007-configuracao-pela-interface.md`](.rebeca/decisoes/ADR-007-configuracao-pela-interface.md) |
| configurar por variável de ambiente | [`.env.example`](.env.example) |
| ver/editar um prompt | [`.rebeca/prompts/`](.rebeca/prompts) — `@vN.md`, nunca editado no lugar |
| o registro de custo | [`.rebeca/custos.csv`](.rebeca/custos.csv) |

**Sem chave configurada, o app funciona** — ele responde com conteúdo simulado, com a mesma forma do
real, e **diz na tela que é simulação**. Isso mantém o app demonstrável e testável sem gastar dinheiro.

Quatro garantias que valem conhecer antes de mexer:

1. **A chave nunca vai ao navegador.** A chamada sai do servidor (`api/ai/` na Vercel, mesmo código no
   `pnpm dev`). A tela de configuração recebe apenas a máscara — não existe rota que devolva o valor.
2. **Custo tem teto travado antes do gasto** — US$ 0,05 por chamada e US$ 1,00 por dia, aprovados pelo
   dono do produto. A chamada que passaria do teto nem é enviada.
3. **Canal infantil tem lista restrita de fornecedor.** Só entram os que permitem, no contrato, serviço
   voltado a menores. Quando nenhum se qualifica, o canal cai em simulação — e a tela explica.
4. **A IA nunca aprova, agenda ou publica.** Ela propõe; o clique é humano.

**Sobre a tela de configuração:** em ambiente **publicado** (Vercel) ela continua **somente leitura**,
mesmo com autenticação ligada. A razão mudou de "não existe login" para uma decisão de desenho
(`ADR-014`): quem entra passa a **usar** a chave, não a **ver** nem a **trocar** — o lugar do segredo é
o gerenciador do host. Localmente, as chaves ficam em `.rebeca/segredos/llm.json` — arquivo ignorado
pelo git, **não um cofre**, e a própria tela diz isso.

## Onde roda (nuvem)

| Frente | Onde |
|---|---|
| Código e memória durável | repositório **privado** `donclaudito/rebeca` no GitHub |
| Aplicação em produção | **Vercel**, projeto `rebeca-odda` → `rebeca-odda.vercel.app` (build estático do `dist/`) |
| Preview de PR | URL automática por pull request |

> O nome `ai-media-studio` **não** é deste projeto: `ai-media-studio.vercel.app` é de terceiro (o
> `QA-003` já tinha registrado isso). O endereço do dono é `rebeca-odda.vercel.app`.

**O deploy precisa ser privado, e a camada que fecha a porta da API já está no código** (camadas do
`ADR-011`; a autenticação é o `ADR-014`).

- **Camada 1 — ⏳ pendente, é ação do dono no painel da Vercel** (não há como fazer por código):
  *Deployment Protection → Vercel Authentication*, escopo **_All Deployments_**. É gratuita no plano
  Hobby e cobre **todas** as requisições, inclusive `/api/*`. Vale **por projeto**: ligue em todos os
  que recebem este repositório. **Verificação:** com a camada ligada, `/api/ai/status` **sem sessão**
  deve deixar de devolver 200 — enquanto continuar 200, ela está desligada.
  **Medição honesta:** em 2026-10-01 o dono relatou ter ligado a proteção e a URL de produção
  **continuou respondendo 200 sem credencial** (a hipótese registrada é erro de escopo: *Standard
  Protection* protege só os previews). Com a camada 3 no ar, o que essa camada 1 ainda protege é a
  **casca estática** do app — não a chave.
- **Camada 2 — ✅ no código** (`X-Robots-Tag`, `public/robots.txt` e a meta tag do documento): só
  descoberta. Impede indexação e arquivamento, **não** é controle de acesso.
- **Camada 3 — ✅ no código (`ADR-014`)**: toda rota de `api/ai/*` e `api/media/*` exige **ID token do
  Google** verificado no servidor, com lista de acesso por `sub`; sem credencial → **401**, conta fora
  da lista → **403** (e nada é cobrado em nenhum dos dois), sem `GOOGLE_CLIENT_ID` → **503**. O
  navegador guarda o token **só em memória**. O que segue público é a casca estática (HTML/JS) — que
  mostra a tela de entrada e nenhum dado.
  **Ainda aberto (é a F1, `D3`):** papéis por usuário (editor/revisor) e trilha de auditoria em banco.
  Hoje o acesso é do dono (e de quem ele autorizar por `sub`), e o gasto fica atribuído na coluna
  `identidade_sub` do livro de custos.
- **O que a camada 3 ainda NÃO liga, e é importante saber:** autenticar não faz o app publicado
  **gerar**. O teto diário de gasto depende de um livro de custos durável, e em serverless ele não
  existe (achado `QA-006 #1`) — por isso a **geração paga continua sendo recusada com 403** em
  produção, até existir banco (decisão `D1`) ou até o aceite explícito de `REBECA_ALLOW_NO_LEDGER=1`,
  que significa gastar sem teto diário efetivo. Para usar as APIs com o teto valendo, rode local
  (`pnpm dev`).

- **Deploy:** `push` em `main` publica produção; abrir PR gera preview. O deploy é da integração Git
  da Vercel — **o CI não publica**.
- **CI** (`.github/workflows/ci.yml`): varredura de segredo em texto claro, tipos, testes e build. Roda
  no piso do Node (22) para provar o cenário mais restritivo.
- **Config do host:** `vercel.json` — comando de build, rewrite catch-all para `/index.html` (o app usa
  `BrowserRouter`, então `/c/luna/inicio` não existe como arquivo) e headers de segurança.
- **Decisão e trade-offs:** [`.rebeca/decisoes/ADR-003-onde-roda-github-vercel.md`](.rebeca/decisoes/ADR-003-onde-roda-github-vercel.md).

## Estado

A orquestra está montada, o **protótipo navegável existe** (10 telas, design system executável, camada
de dados escopada por canal) e o app **tem camada de IA ligada** — 15 funções, prompts versionados,
saída validada por schema, teto de gasto e registro de custo real.

O que ainda **não** é verdade, e é importante não confundir com o que já é:

- Os **dados de conteúdo são de exemplo**. As funções de IA geram conteúdo de verdade (com chave
  configurada), mas o que aparece nas telas de biblioteca, calendário e analytics continua semeado.
- **Nenhum upload no YouTube acontece.** Publicação é a fase seguinte.
- **Nenhuma chamada real a provedor foi executada** na verificação desta entrega: sem chave no
  ambiente, tudo rodou com provedor simulado ou transporte injetado. Os adaptadores HTTP foram
  escritos a partir da documentação oficial, não de resposta observada — é o teste que falta.
- A **revisão adversarial do `rebeca-qa`** sobre `ADR-006` é pendente, e a leitura jurídica sobre qual
  fornecedor pode atender canal infantil também (D11).

O que falta depende de decisão do dono do produto (ver `.rebeca/estado.md`, "Decisões pendentes"):
schema com RLS, integração real com o YouTube e o primeiro caminho vertical ponta a ponta com dado de
verdade.

