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
Copy-Item .env.example .env   # opcional: sem chave, o app roda com provedor simulado
pnpm dev        # http://127.0.0.1:5173
pnpm typecheck  # tsc --noEmit  (cobre src/, server/ e api/)
pnpm test       # vitest
pnpm build      # confere prompts + tipos + vite build -> dist/
pnpm prompts:check   # o prompt versionado e o que executa estão iguais?
```

Precisa de **Node >= 22.12** (piso imposto por `vitest@5` e `vite@8`; declarado em `engines`).

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

**Sobre a tela de configuração:** em ambiente **publicado** (Vercel) ela é somente leitura, porque não
existe autenticação nesta fase e uma rota pública que aceita chave de API de qualquer visitante seria
uma vulnerabilidade. Ali, o lugar do segredo é o gerenciador de segredos do host. Localmente, as
chaves ficam em `.rebeca/segredos/llm.json` — arquivo ignorado pelo git, **não um cofre**, e a própria
tela diz isso.

## Onde roda (nuvem)

| Frente | Onde |
|---|---|
| Código e memória durável | repositório **privado** `donclaudito/rebeca` no GitHub |
| Aplicação em produção | **Vercel**, projeto `ai-media-studio` (build estático do `dist/`) |
| Preview de PR | URL automática por pull request |

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

