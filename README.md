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
pnpm dev        # http://127.0.0.1:5173
pnpm typecheck  # tsc --noEmit
pnpm test       # vitest
pnpm build      # tsc --noEmit && vite build -> dist/
```

Precisa de **Node >= 22.12** (piso imposto por `vitest@5` e `vite@8`; declarado em `engines`).

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

A orquestra está montada e o **protótipo navegável existe** (10 telas, design system executável,
camada de dados escopada por canal, suíte de testes). Ele roda com **dados de exemplo** — não chama
provedor de IA, não publica no YouTube e não trata dado pessoal.

O que ainda falta depende de decisão do dono do produto (ver `.rebeca/estado.md`, "Decisões pendentes"):
schema com RLS, integração real com o YouTube e o primeiro caminho vertical ponta a ponta com dado de
verdade.

