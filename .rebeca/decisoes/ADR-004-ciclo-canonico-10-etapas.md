# ADR-004 — O ciclo canônico tem 10 etapas: `Agendar` separado de `Publicar` e `Melhorar` no lugar de `Ajustar`

## Status
aceito

## Data
2026-09-30

## Contexto

O ciclo é o coração do produto: `docs/00-visao-produto.md` §3 e `docs/04-mapa-funcional.md` §1 são a
espinha de tudo que a plataforma faz. Três fontes o descrevem, e elas **não o numeram do mesmo jeito**:

| Fonte | Numeração | Última etapa |
|---|---|---|
| `imagens/modelo2.jpeg` | 9 etapas, com "Agendar / Publicar" juntas | `Ajustar` |
| `O APP.pdf` | **9 seções numeradas** (`8. Aprender`, `9. Melhorar automaticamente`) | `Melhorar automaticamente` |
| `docs/00-visao-produto.md` §3 | 9 subseções (§3.1–§3.9); "Agendar e publicar" juntas em §3.6 | "Melhorar automaticamente" |

O código herdou a leitura de 9 etapas e a palavra do **modelo visual**: `src/data/types.ts` tinha
`CycleStage = pesquisar | planejar | criar | revisar | aprovar | publicar | medir | aprender | ajustar`
— sem `agendar`, e com `ajustar` no lugar de `melhorar`.

**O defeito concreto que isso produzia:** `src/data/client.ts` agendava um conteúdo gravando
`stage: 'publicar'`. Ou seja, o instante em que o conteúdo ganha data e horário — o último momento em
que o usuário ainda pode mudar algo sem custo — era indistinguível de "já está no ar". Também não
havia como a interface dizer "está agendado" sem mentir sobre a etapa.

Se nada fosse decidido, o produto continuaria ensinando 9 passos na tela "Como funciona" enquanto o
dono do produto descreve 10, e a divergência voltaria a cada nova tela.

## Decisão

O ciclo canônico tem **10 etapas**, nesta ordem:

```
Pesquisar → Planejar → Criar → Revisar → Aprovar → Agendar → Publicar → Medir → Aprender → Melhorar
```

1. **`Agendar` e `Publicar` são etapas distintas.** Agendar é o conteúdo aprovado ganhar data e
   horário; publicar é o envio pela API oficial do YouTube.
2. **A etapa que fecha o ciclo se chama `Melhorar`.** `Ajustar` era o vocabulário do modelo visual e
   deixa de existir como etapa.
3. **`aprovar` continua sendo a etapa humana** (invariante nº 1 do `AGENTS.md`) e continua sendo a 5ª.
4. **Uma fonte só no código:** `src/data/cycle.ts` exporta `CYCLE_ORDER` (a ordem) e `CYCLE_LABEL` (o
   texto pt-BR). A tela "Como funciona" **deriva** a lista de lá em vez de redigitar; o tipo
   `CycleStage` é só o vocabulário; `Record<CycleStage, …>` garante em tempo de compilação que etapa
   nova sem texto não passa.
5. **Agendar deixou de gravar `publicar`:** `approve()` com data e `reschedule()` gravam
   `stage: 'agendar'`; o módulo "Agendamento" aponta para `agendar`; os conteúdos de exemplo que
   estavam agendados foram corrigidos.
6. **O documento e o código passam a se vigiar:** o teste `src/data/__tests__/cycle.test.ts` **lê
   `docs/00-visao-produto.md` do disco** e exige que a linha do ciclo no documento seja exatamente a
   que o código produz. Mudar um sem o outro quebra a suíte.

**Honestidade sobre a fonte — texto literal já recebido e conferido:** o PDF tem **9 seções**, não 10,
e a seção 6 chama-se literalmente **"Agendar e publicar"**, tratando as duas coisas num bloco só ("então
o sistema agenda e publica automaticamente no YouTube através da integração oficial"); a seção 7 é
"Medir" e a 9ª é "Melhorar automaticamente".

**Portanto: o PDF não separa `Agendar` de `Publicar`.** A lista de 10 verbos é **refinamento do dono do
produto**, não transcrição — e este ADR existe justamente para que essa diferença fique registrada em
vez de virar uma divergência silenciosa entre documento e código (que foi o defeito original). O texto
da seção 6 **é compatível** com a separação: ele já lista `data` e `horário` entre os insumos e
"publica" como o ato. Transcrição integral em `.rebeca/fontes/ciclo-no-pdf.md`.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Manter 9 etapas com "Agendar e publicar" juntas | Era a origem do defeito: `stage: 'publicar'` num conteúdo apenas agendado. O usuário perdia a única etapa em que ainda dá para mudar sem custo, e a tela não tinha como nomear o estado real. |
| Acrescentar `agendar` como 10ª etapa no fim da lista | Quebraria a ordem do ciclo: agendar acontece **antes** de publicar. Ordem é requisito, não estética. |
| Manter as duas (`agendar` **e** `ajustar`), ficando com 11 etapas | `Ajustar` e `Melhorar` seriam sinônimos competindo pelo mesmo lugar — duas fontes de verdade para a mesma etapa, exatamente o problema que este ADR resolve. |
| Renomear `ajustar` → `melhorar` sem separar Agendar de Publicar | Resolveria metade do problema e deixaria o defeito de `client.ts` intacto. |
| Deixar a lista de etapas redigitada em cada tela | Foi o que produziu a divergência: `types.ts`, `mock/db.ts` e a tela "Como funciona" tinham três listas mantidas à mão. |
| Ler `docs/00` em tempo de execução para montar a interface | Acopla o app a um arquivo do repositório que não vai para o bundle de produção. O teste que lê o documento cobre a divergência sem esse acoplamento. |

## Consequências

- **Positivas:** existe **uma** lista de etapas no código, e ela é vigiada contra o documento por
  teste. O estado "agendado, ainda não publicado" passa a ser nomeável e endereçável — base para a
  tela de Calendário mostrar o que ainda dá para reagendar. `CYCLE_ORDER`/`CYCLE_LABEL` também
  eliminam a possibilidade de a numeração da tela divergir da ordem do domínio.
- **Negativas / custo assumido:** o código agora diverge, de propósito, da numeração das duas fontes
  visuais (modelo 2 e PDF). Quem ler o PDF e for conferir o código precisa saber disso — por isso o
  ADR e `.rebeca/fontes/ciclo-no-pdf.md` existem. Uma etapa a mais também custa um item a mais de
  largura na tela "Como funciona" (o grid foi de `2xl:grid-cols-9` para `2xl:grid-cols-10`).
- **O que muda para o usuário:** na tela "Como funciona" ele passa a ver 10 passos, com **Agendar** e
  **Publicar** explicados separadamente, e a última etapa chamada **Melhorar**. O botão da tela de
  Revisão continua sendo **um só** ("Aprovar e agendar"): a separação é do domínio e do ciclo, não um
  segundo clique para o usuário.
- **Impacto em isolamento multi-canal:** nenhum. `CycleStage` é vocabulário global do produto, não dado
  de canal; nada aqui cria tabela, cache ou rota sem `channel_id`.
- **Impacto em custo por vídeo:** nenhum custo de geração. Efeito indireto positivo: distinguir
  "agendado" de "publicado" é o que permite medir custo de conteúdo que ainda não foi ao ar.

## Verificação

- `pnpm exec tsc --noEmit` → exit 0.
- `pnpm exec vitest run` → **19/19**, com o teste que lê `docs/00` incluído.
- `pnpm run build` → exit 0.
- Teste específico: `src/data/__tests__/cycle.test.ts` compara `CYCLE_ORDER` com a linha literal do
  documento e recusa `ajustar`; `src/features/como-funciona/__tests__/como-funciona.test.tsx` exige 10
  itens numerados na ordem canônica na tela.
- **Reavaliação — já exercida nesta sessão, com resultado "mantém-se":** o texto literal das seções 6
  e 7 foi recebido e confere o que este ADR afirma. A seção 6 do PDF **não** separa as duas etapas,
  mas também não as impede: ela lista `canal, data, horário, título, descrição, thumbnail, playlist,
  público, idioma, categoria, configurações` (insumos de *agendar*) e fecha com "agenda e publica"
  (o ato de *publicar*). A separação continua se sustentando porque o defeito que a motivou é de
  implementação, não de vocabulário: `stage: 'publicar'` num conteúdo apenas agendado. Se o dono
  quiser reverter para 9 etapas, este ADR recebe status `substituído por ADR-NNN` — não é apagado.

## Quem decidiu

**Proposto por:** `rebeca-arquiteto` (com `rebeca-react` para a parte de tela).
**Aprovado por:** dono do produto, nesta sessão — escolheu explicitamente "corrigir para as 10 etapas
canônicas e propagar em código e docs" entre as opções apresentadas.
