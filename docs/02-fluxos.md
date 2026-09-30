# Fluxos de trabalho da orquestra

Manual de operação: **como acionar os agentes e o que esperar de cada fluxo.**

## 1. Acionamento simples (1 especialista)

Quando a tarefa é de uma área só, carregue a skill e execute:

> "Use o agente `rebeca-supabase` para desenhar o schema multi-canal com RLS."

O agente carrega a skill, lê `docs/00-visao-produto.md` e `.rebeca/estado.md`, e entrega no formato
"Contrato de entrega".

## 2. Acionamento com delegação (2 a 3 especialistas)

Usa a ferramenta `subagent`: cada especialista roda em contexto próprio. Bom para tarefas
independentes (ex.: schema do banco + layout da tela de revisão ao mesmo tempo).

## 3. Acionamento em massa (workflow)

Os scripts em `.dsh/workflows/` são *script bodies* da ferramenta `workflow`. Para rodar, passe o
conteúdo do arquivo em `script` e o bloco `meta` correspondente em `meta`.

| Workflow | Quando usar | O que produz |
|---|---|---|
| `rebeca-blueprint.js` | Início da fundação ou revisão de arquitetura | Blueprint consolidado + lista de decisões que exigem aprovação humana |
| `rebeca-episodio.js` | Produzir conteúdo novo para um canal | Pacote do episódio (adequação infantil → roteiro → visual → mídia → SEO → QA → LGPD) pronto para aprovação |
| `rebeca-sprint.js` | Implementar uma história de código | Contrato → implementação → revisão adversarial → correção, com evidência |

### Exemplo: blueprint

```js
// parâmetro meta
{ name: 'rebeca-blueprint',
  description: 'Gera o blueprint técnico da fundação do Rebeca.',
  phases: [{ title: 'Blueprint' }, { title: 'Síntese' }] }

// parâmetro args
{ brief: 'Definir a fundação do Rebeca priorizando o ciclo de revisão/aprovação.',
  canais: ['Luna e o Jardim das Cores', 'Arquivo Curioso', 'AI Made Simple'] }
```

O `args.modelos` permite fixar provedor/modelo por especialista, por exemplo
`{ "rebeca-ia-video": { "provider": "freellmapi", "model": "gemini-3.6-flash" } }`. **Deixe vazio para
usar o modelo padrão da sessão** — assim o fluxo não quebra se um provedor não estiver configurado.

### Exemplo: episódio

```js
// parâmetro args
{ canal: 'Luna e o Jardim das Cores',
  pautas: ['Luna e as Borboletas Coloridas'],
  faixaEtaria: '3 a 5 anos',
  formato: 'ambos' }
```

O workflow **não publica nada**. Ele termina em `PRONTO PARA APROVAÇÃO HUMANA` (ou `BLOQUEADO`, se
alguma etapa reprovar).

### Exemplo: sprint

```js
// parâmetro args
{ historia: 'Como dono do canal, quero ver os 4 conteúdos aguardando aprovação na home, com critério de aceite: lista carrega em <2s, mostra thumbnail, e aprovar muda o status para agendado.',
  agente: 'rebeca-supabase',
  arquivos: ['supabase/migrations/'],
  tentativas: 2 }
```

## 4. O ciclo do produto, mapeado nos agentes

| Etapa do PDF | Agentes envolvidos |
|---|---|
| Pesquisar | `rebeca-produto`, `rebeca-analytics`, `rebeca-youtube` (dados públicos) |
| Planejar | `rebeca-produto` (+ `rebeca-infantil` se canal infantil) |
| Criar | `rebeca-prompt-eng` → `rebeca-branding` → `rebeca-ia-video` |
| Revisar / Aprovar | `rebeca-react` (tela) + **humano** (decisão) |
| Agendar / Publicar | `rebeca-youtube` (só após aprovação registrada) |
| Medir | `rebeca-youtube` (Analytics) + `rebeca-analytics` |
| Aprender / Melhorar | `rebeca-analytics` → `rebeca-produto` (próxima semana) |
| Transversal | `rebeca-arquiteto`, `rebeca-backend`, `rebeca-supabase`, `rebeca-pwa`, `rebeca-github`, `rebeca-powershell`, `rebeca-seguranca`, `rebeca-lgpd`, `rebeca-qa` |

## 5. Verificação da própria orquestra

```powershell
python "E:\pojeto rebeca\.tools\validar_skills.py"
```

Valida frontmatter, nome kebab-case igual à pasta, tamanho e seções obrigatórias de cada skill.
Retorna código de saída 1 se qualquer skill estiver inválida — use isso antes de confiar na orquestra.

## 6. Rotina semanal sugerida (quando o app já existir)

| Dia | O que acontece | Agente |
|---|---|---|
| Segunda | Revisar aprendizado da semana anterior e gerar a pauta | `rebeca-analytics` → `rebeca-produto` |
| Segunda-Quarta | Produção dos conteúdos da semana | `rebeca-episodio` (workflow) |
| Quinta | Revisão adversarial dos pacotes | `rebeca-qa` |
| Sexta | **Humano aprova** e o sistema publica | humano → `rebeca-youtube` |
| Domingo | Coleta de métricas | `rebeca-powershell` (tarefa agendada) → `rebeca-analytics` |
