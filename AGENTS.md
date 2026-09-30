# AGENTS.md — Rebeca (instruções de workspace)

Projeto: **Rebeca** — plataforma que opera o ciclo completo de canais de YouTube feitos com IA
(pesquisa → planejamento → criação → revisão → aprovação humana → agendamento → publicação →
medição → aprendizado). Leia `docs/00-visao-produto.md` antes de qualquer decisão de produto.

## Como este repositório está organizado

| Caminho | O que é |
|---|---|
| `docs/00-visao-produto.md` | Fonte de verdade do produto (extraída do PDF do cliente) |
| `docs/01-orquestra-de-agentes.md` | Quem são os agentes, quando são chamados, como conversam |
| `docs/02-fluxos.md` | Manual de operação dos fluxos de trabalho |
| `docs/03-design-system.md` | Fonte de verdade **visual** (tokens, primitivos, "esta cara") |
| `docs/04-mapa-funcional.md` | Fonte de verdade **funcional** (rotas, donos, critério de aceite) |
| `docs/modelo-skill.md` | Modelo obrigatório para escrever/escrever uma skill de agente |
| `.dsh/skills/<id>/SKILL.md` | Um especialista por pasta; carregado pela ferramenta `skill` |
| `.dsh/workflows/*.js` | Scripts de orquestração em massa (ferramenta `workflow`) |
| `.rebeca/` | Memória durável: estado, ADRs, prompts versionados, custos |

## A orquestra (carregue a skill do especialista antes de agir na área dele)

| Especialidade | Skill |
|---|---|
| Orquestração e integração | `rebeca-orquestrador` |
| Produto, roadmap, priorização | `rebeca-produto` |
| Arquitetura e ADRs | `rebeca-arquiteto` |
| Backend, filas, integrações | `rebeca-backend` |
| Dados, RLS, Auth, Storage (Supabase) | `rebeca-supabase` |
| Front-end React/TypeScript | `rebeca-react` |
| PWA, offline, push, mobile | `rebeca-pwa` |
| GitHub, CI/CD, releases | `rebeca-github` |
| Automação Windows/PowerShell | `rebeca-powershell` |
| Engenharia de prompt e avaliação | `rebeca-prompt-eng` |
| Geração de vídeo, voz, imagem, render | `rebeca-ia-video` |
| YouTube Data/Analytics API, SEO, políticas | `rebeca-youtube` |
| Psicologia infantil + pedagogia | `rebeca-infantil` |
| Branding, character sheets, thumbnails | `rebeca-branding` |
| Métricas, experimentos, unit economics | `rebeca-analytics` |
| LGPD + ECA Digital + menores | `rebeca-lgpd` |
| Segurança, segredos, OAuth, abuso | `rebeca-seguranca` |
| QA, testes, revisão adversarial | `rebeca-qa` |

Para tarefas que cruzam áreas, use o `rebeca-orquestrador` e **delegue** com a ferramenta `subagent`
(1-3 tarefas) ou `workflow` (fan-out grande, com fases).

## Invariantes do projeto (não negociáveis)

1. **Aprovação humana antes de publicar.** Nada vai ao YouTube sem aprovação explícita registrada em
   `.rebeca/estado.md`. A IA nunca aprova por conta própria.
2. **Isolamento entre canais.** Todo dado, asset, métrica, prompt e cache é escopado por canal. Bug de
   vazamento entre canais é prioridade máxima.
3. **Consistência de marca e personagem.** A Luna (e qualquer personagem oficial) precisa parecer a
   mesma em todos os episódios; o Brand Kit/Character Sheet é a fonte disso.
4. **Custo é requisito.** Toda geração paga registra custo real em `.rebeca/custos.csv`. Decisão sem
   custo por ativo é decisão incompleta — o negócio pergunta "esse conteúdo valeu a pena?", não
   "quantas views teve".
5. **Multi-canal desde o design.** Nada é codificado para um único canal (nem tabela, nem prompt, nem
   layout). Luna é o primeiro caso, não o único.
6. **Conteúdo infantil tem regra própria.** Canal infantil passa por `rebeca-infantil` e
   `rebeca-lgpd`; conteúdo sensível para menores de 18 anos é bloqueante.
7. **Provedores são substituíveis.** O usuário vê uma ferramenta só; a camada de IA é abstraída atrás
   de interfaces (trocar de modelo/provedor não pode exigir mudar a UI).

## Regras de trabalho

- **Evidência, não afirmação.** Toda entrega vem com comando executado + resultado observado
  (teste, saída de script, arquivo gerado). Sem isso, não está pronto.
- **Nada de fato externo inventado.** Endpoint, quota, limite, preço e política de API precisam de
  fonte verificável (`web_search`/`web_fetch`). Se não deu para verificar, escreva `NÃO VERIFICADO`.
- **Verificação adversarial.** Quem produz não é quem aprova: trabalho relevante passa pelo
  `rebeca-qa`, que tenta **refutar** a entrega antes de aceitá-la.
- **Idempotência em tudo que gasta dinheiro ou publica.** Retry não pode gerar vídeo duplicado nem
  publicação dupla.
- **Segredos nunca em texto claro** no repositório, em log ou em prompt. Ver `rebeca-seguranca`.
- **Documente a decisão, não só o resultado.** Escolha com trade-off vira ADR em `.rebeca/decisoes/`.
- **Português (pt-BR)** em documentação, interface, roteiros e relatórios; código e identificadores
  em inglês.
- **Handoff obrigatório:** toda delegação termina no formato da seção "Contrato de entrega" de
  `docs/01-orquestra-de-agentes.md` (status, entregáveis, evidência, decisões, riscos, próximo).

## Fluxo padrão de uma tarefa

1. Ler `docs/00-visao-produto.md` (produto) e `.rebeca/estado.md` (onde estamos).
2. Carregar a skill do especialista responsável antes de agir.
3. Se a tarefa cruza áreas: `rebeca-orquestrador` decompõe e delega.
4. Implementar a menor mudança que satisfaz o critério de aceite.
5. Verificar (executar, testar, medir) e registrar evidência.
6. Passar por `rebeca-qa` quando o risco justificar.
7. Atualizar `.rebeca/estado.md` e, se houve decisão arquitetural, criar ADR.
8. Pedir aprovação humana apenas onde ela é necessária (publicar, gastar, mudar escopo, dado
   sensível) — e nunca fingir que ela aconteceu.

## Estado atual

Ver `.rebeca/estado.md`. Existem **duas frentes na mesma pasta**: esta orquestra (`.dsh/`, `AGENTS.md`,
`docs/00-02`) e um protótipo construído em paralelo (`package.json` `ai-media-studio`, `src/`,
`docs/03-design-system.md`, `docs/04-mapa-funcional.md`, `imagens/`). Antes de criar qualquer arquivo,
confira se a outra frente já não é dona daquele caminho — e trate `docs/03` como fonte de verdade
visual e `docs/04` como fonte de verdade funcional. O conflito de nome do produto (Rebeca × AI Media
Studio) está aberto como D7 em `.rebeca/estado.md`.
