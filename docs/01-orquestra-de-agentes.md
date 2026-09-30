# Orquestra de Agentes do Rebeca

Este documento define **quem são os agentes, quando cada um é chamado, o que cada um entrega e como
eles conversam**. Cada agente tem uma skill correspondente em `.dsh/skills/<id>/SKILL.md`, descoberta
automaticamente pelo harness.

## Como a orquestra funciona (mecânica real)

| Conceito | Mecanismo no harness |
|---|---|
| Especialista | skill em `.dsh/skills/<id>/SKILL.md` (carregada sob demanda pela ferramenta `skill`) |
| Execução paralela | ferramenta `subagent` para 1-3 tarefas; ferramenta `workflow` (script JS) para fan-out grande |
| Contrato entre agentes | protocolo de handoff da seção "Contrato de entrega" (abaixo) |
| Memória durável | `.rebeca/` no repositório (estado, decisões, prompts, custos) |
| Autoridade final | humano (dono do produto) — nenhum agente publica, gasta acima do limite ou muda escopo sozinho |

### Regra de ouro da delegação

1. **Um agente por vez no caminho crítico.** Cada agente tem uma responsabilidade única; se a tarefa
   precisa de duas especialidades, ela é quebrada em duas delegações.
2. **Nenhum agente inventa fato externo** (endpoint, quota, limite de API, preço). Se não tem fonte
   verificável, escreve `NÃO VERIFICADO` e escala para quem pode verificar (`web_search`).
3. **Ninguém publica nada.** Publicação só após aprovação humana explícita registrada em
   `.rebeca/estado.md`.
4. **Quem escreve, prova.** Toda entrega vem com evidência executável (comando + saída, teste,
   arquivo), nunca afirmação sem verificação.

### Contrato de entrega (todo agente devolve neste formato)

```yaml
agente: rebeca-<id>
tarefa: <o que foi pedido, em 1 linha>
status: concluido | parcial | bloqueado
entregaveis:            # caminhos de arquivos reais
  - <path>
evidencia:              # comando executado + resultado observado
  - comando: <...>
    resultado: <...>
decisoes:               # escolhas com trade-off, para ADR
  - <decisão> — <motivo> — <alternativa descartada>
riscos:                 # o que pode dar errado e o que não foi verificado
  - <risco>
proximo: <agente sugerido> — <o que ele precisa receber>
custos: <tokens/API/tempo estimados, se houve geração paga>
```

Saída que não segue este formato é devolvida ao agente.

## Os 18 especialistas

### Núcleo

| # | id | Missão em uma linha | Entradas | Saídas principais |
|---|---|---|---|---|
| 1 | `rebeca-orquestrador` | Quebrar o objetivo em tarefas, escolher agentes, integrar entregas e manter o estado | Pedido do humano + `.rebeca/estado.md` | Plano de execução, atribuições, estado atualizado |

### Produto e estratégia

| # | id | Missão em uma linha | Entradas | Saídas principais |
|---|---|---|---|---|
| 2 | `rebeca-produto` | Transformar visão em roadmap, histórias priorizadas e critérios de aceite | `docs/00-visao-produto.md` | `docs/roadmap.md`, histórias com aceite, análise "valeu a pena?" |

### Arquitetura e engenharia

| # | id | Missão em uma linha | Entradas | Saídas principais |
|---|---|---|---|---|
| 3 | `rebeca-arquiteto` | Desenhar a arquitetura, contratos entre módulos e ADRs | Visão + histórias | `.rebeca/decisoes/ADR-*.md`, diagrama de módulos, contratos |
| 4 | `rebeca-backend` | Construir APIs, workers, filas e integrações resilientes | Contratos do arquiteto | Serviços, jobs, políticas de retry/idempotência |
| 5 | `rebeca-supabase` | Modelar dados multi-canal, RLS, Auth, Storage, Edge Functions | Contratos + ADRs | Migrations SQL, políticas RLS, funções, seeds |
| 6 | `rebeca-react` | Construir a interface React/TS (revisão, aprovação, calendário) | Wireframes + contratos de API | Componentes, hooks, testes de componente |
| 7 | `rebeca-pwa` | Tornar o app instalável e confiável no celular (offline, push) | App React existente | `manifest`, service worker, estratégias de cache, push |
| 8 | `rebeca-github` | Automatizar CI/CD, proteção de branch, releases e segredos | Código + testes | Workflows Actions, templates de PR/issue, regras de proteção |
| 9 | `rebeca-powershell` | Automatizar o ambiente Windows (dev, build, diagnóstico, tarefas) | Necessidade operacional | Scripts `.ps1` idempotentes + documentação |
| 10 | `rebeca-prompt-eng` | Versionar, avaliar e blindar os prompts que dirigem toda a IA | Casos de uso + falhas observadas | `.rebeca/prompts/<nome>@vN.md`, suíte de avaliação, guardrails |

### IA de mídia

| # | id | Missão em uma linha | Entradas | Saídas principais |
|---|---|---|---|---|
| 11 | `rebeca-ia-video` | Pipeline de produção de vídeo: imagem, animação, voz, música, render | Roteiro aprovado + brand kit | Assets, vídeo final, versão Short, custo por minuto |
| 12 | `rebeca-youtube` | Integração oficial: OAuth, upload, agendamento, SEO, quotas, Analytics | Vídeo + metadados aprovados | Upload agendado, relatórios de métricas, alertas de política |

### Conteúdo e marca

| # | id | Missão em uma linha | Entradas | Saídas principais |
|---|---|---|---|---|
| 13 | `rebeca-infantil` | Psicologia do desenvolvimento + pedagogia aplicadas ao conteúdo infantil | Faixa etária + objetivo pedagógico | Roteiro com valores, linguagem, ritmo e checagem de adequação |
| 14 | `rebeca-branding` | Identidade por canal: character sheets, paleta, thumbnails, brand book | Direção do canal | Brand kit, character sheet, opções de thumbnail |
| 15 | `rebeca-analytics` | Medir, comparar e transformar dados em decisão de próxima semana | Métricas do YouTube + custos | Relatório "valeu a pena?", hipóteses, recomendação |

### Confiança e qualidade

| # | id | Missão em uma linha | Entradas | Saídas principais |
|---|---|---|---|---|
| 16 | `rebeca-lgpd` | LGPD + ECA Digital: base legal, consentimento, retenção, menores, DPAs | Fluxos de dados do sistema | ROPA, RIPD, políticas, checklist de conformidade |
| 17 | `rebeca-seguranca` | Threat model, segredos, tokens OAuth, rate limit, dependências | Arquitetura + código | Threat model, correções, regras de segredo/rotação |
| 18 | `rebeca-qa` | Verificar de forma adversarial: testes, e2e, aceite, regressão | Entrega dos outros agentes | Relatório de verificação, testes, bugs com reprodução |

## Cadeias de trabalho (quem chama quem)

### A. Fundação do produto (uma vez, no início)
```
rebeca-produto → rebeca-arquiteto → rebeca-supabase → rebeca-backend
                                  → rebeca-react → rebeca-pwa
                                  → rebeca-lgpd + rebeca-seguranca (em paralelo, desde o dia 1)
                                  → rebeca-github + rebeca-powershell (infra)
```

### B. Produção de um episódio (o ciclo do PDF, por conteúdo)
```
rebeca-produto (pauta) 
  → rebeca-infantil (adequação pedagógica e de linguagem)   [se canal infantil]
  → rebeca-prompt-eng (prompt de roteiro) → rebeca-branding (personagens/visual)
  → rebeca-ia-video (imagem, voz, música, render, Short)
  → rebeca-branding (thumbnails) + rebeca-youtube (título, descrição, SEO, agendamento)
  → rebeca-qa (revisão adversarial) + rebeca-lgpd (checagem de conteúdo sensível)
  → APROVAÇÃO HUMANA (.rebeca/estado.md)
  → rebeca-youtube (publica)
  → rebeca-analytics (mede e aprende) → rebeca-produto (próxima semana)
```

### C. Correção de bug / incidente
```
rebeca-orquestrador → rebeca-qa (reproduz) → <agente dono do módulo> (corrige)
                    → rebeca-qa (verifica) → rebeca-seguranca (se envolver dado/segredo)
                    → rebeca-github (publica correção)
```

## Protocolo de escalonamento para o humano

O agente **para e pergunta** (não decide sozinho) quando:

- a decisão muda algo de `docs/00-visao-produto.md`;
- envolve gasto real de dinheiro acima do limite combinado;
- envolve publicar conteúdo em nome do usuário;
- envolve dado pessoal, menor de idade ou conteúdo sensível;
- há conflito entre dois agentes sobre a mesma decisão (o `rebeca-orquestrador` arbitra por escrito
  em `.rebeca/decisoes/` e escala se persistir);
- falta informação que só o dono do produto tem (público, preço, prazo, marca).

## Definition of Done (vale para todos)

Uma entrega só é "pronta" quando:

1. Existe artefato real no repositório (arquivo, migration, componente, script) — não descrição.
2. O artefato foi **executado/verificado** e a evidência está no relatório de handoff.
3. Os critérios de aceite da história foram checados um por um.
4. Não há segredo em texto claro, nem dado pessoal fora de política (`rebeca-lgpd`).
5. Isolamento entre canais foi preservado (quando aplicável).
6. Custo real foi registrado (quando houve geração de IA paga).
7. O próximo agente sabe exatamente o que receber (campo `proximo` preenchido).

## Memória durável da orquestra

```
.rebeca/
  estado.md              # onde estamos: fase, tarefas, bloqueios, aprovações pendentes
  decisoes/ADR-*.md      # decisões de arquitetura com trade-off
  prompts/<nome>@vN.md   # prompts versionados e avaliados
  custos.csv             # custo real por ativo gerado (base do "valeu a pena?")
```
