# ADR-012 — Gerador de thumbnail: fornecedor, allow-list executável e o portão de gasto

## Status
**Aceito pelo dono do produto em 2026-10-01** — ele escolheu a opção "construir o gerador com MiniMax
`image-01`" entre as apresentadas, depois de ler a apuração de preços e termos. O código está entregue e
verificado; o que falta para gerar **arte real** é a chave da MiniMax na máquina.

## Data
2026-10-01

## Contexto

O `ADR-010` construiu o pipeline de mídia e o `ADR-005` decidiu os fornecedores — mas **nenhum dos dois
cobre thumbnail**, e a lacuna apareceu de duas formas concretas na mesma sessão:

1. `criar-thumbnail` é função de **LLM**: devolve conceito (rótulo, o que a arte deve mostrar, texto na
   arte). **Nunca gerou imagem.** O botão da tela de Revisão chama-se "Gerar opções de thumbnail com a
   IA" — o dono clicou, não apareceu arte, e relatou: *"não está produzindo, não gera"*.
2. Não existia etapa de thumbnail em `spec-midia.json`, nem o valor em `MediaStage`, nem um único arquivo
   `option-*` no repositório. A tela de Revisão dizia, com todas as letras, "a arte ainda não existe".

A apuração (`.rebeca/pesquisa/gerador-de-thumbnail-2026-10-01.md`) encontrou **duas lacunas de processo**
além da falta de gerador:

- O `ADR-005` decidiu que a allow-list é *"dado versionado, com URL, data de leitura, trecho citado e
  aprovador"* — e ela **não existia como arquivo**. A regra morava só em prosa, e ninguém conseguia
  executá-la.
- A Stack A aprovada inclui **FLUX.2 klein** para imagem, mas **a Black Forest Labs não aparece na tabela
  de allow-list daquele ADR**. O modelo de imagem da stack aprovada nunca teve termo lido registrado.

## Decisão

**1. Fornecedor de thumbnail: MiniMax `image-01`.** Por três razões, nesta ordem — e a ordem importa:

| Critério | Fato verificado | Fonte |
|---|---|---|
| **Conformidade** | Nenhuma cláusula sobre público-alvo ou sobre gerar imagem que represente menor. As duas menções de idade são sobre o **titular da conta**, não sobre a audiência | [ToS](https://platform.minimax.io/protocol/terms-of-service) · [Privacy](https://platform.minimax.io/protocol/privacy-policy) |
| **Encaixe técnico** | `aspect_ratio: 16:9` → **1280×720 nativo** — o tamanho exato da thumbnail, sem escala | [image-generation-t2i](https://platform.minimax.io/docs/api-reference/image-generation-t2i) |
| **Custo** | **US$ 0,0035 por imagem**; quatro opções custam **US$ 0,014** | [pricing-paygo](https://platform.minimax.io/docs/guides/pricing-paygo) |

E uma razão de método: a MiniMax **já estava `PERMITIDO`** na allow-list do `ADR-005` para este canal, com
quatro documentos lidos. Escolher `image-01` **estende uma entrada já aprovada de vídeo para imagem** em
vez de abrir fornecedor novo — que é exatamente a lógica que o `ADR-005` recusa inverter.

**2. A allow-list vira arquivo executável** — `.rebeca/canais/<canal>/allow-list.json`, com as entradas do
`ADR-005` transcritas, mais `image-01`, mais os provedores simulados. `assertProviderAllowed` roda
**antes** de qualquer chamada de rede e recusa `PROIBIDO` e `NAO-VERIFICADO` citando fundamento, URL e data
de leitura na própria mensagem. Provedor sem termo lido continua fora.

**3. Sem exceção automática para `simulated`.** O provedor simulado está **listado por nome**, como
declaração de procedência (ffmpeg local, sem terceiro, sem contrato). A alternativa — liberar tudo que se
declare `simulated: true` — deixaria um provedor real passar por cima da lista simplesmente mentindo no
campo. É o mesmo padrão de furo que o `rebeca-qa` encontrou no `ADR-010`.

**4. O portão de gasto roda sobre o que FALTA gerar, não sobre o total pedido.** O nome de cada arquivo sai
do `plan()` (que não toca a rede); a contagem de pendentes vem daí; só então o teto mensal é consultado.
Reexecutar um episódio pronto não pode exigir orçamento para algo que não vai ser gerado.

**5. Provedor que cobra tem de declarar preço.** `costPerImageUsd` vive no provedor, e provedor com
`simulated: false` e preço `0` é **recusado** antes de gerar. Sem preço, o portão compararia zero com o
teto e liberaria tudo — o furo medido no `ADR-010` (21 arquivos e US$ 200 lançados antes do bloqueio).

**6. A arte é servida só pelo manifesto.** `GET /api/media/file` não aceita caminho livre: o `asset` só é
servido se **já constar no `meta.json`** daquele episódio daquele canal. A defesa contra travessia é a
whitelist, não a sanitização da string — sanitização falha no dia em que alguém esquece um caso.

**7. O episódio de um conteúdo gerado pela tela é o próprio conteúdo.** `episodeId = contentId`. É
convenção **declarada**, não vínculo deduzido: o episódio sintético da Fase 0 (`luna-ep-001`) continua
fora, porque o spec dele diz "não é conteúdo do canal". A mídia pedida nesta tela nasce para este conteúdo.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Nano Banana / Gemini (inclusive o tier gratuito) | Cláusula literal veda serviço "directed towards or is likely to be accessed by individuals under the age of 18"; o tier gratuito **agrava** (conteúdo usado para treino, com revisão humana). Reconfirmado em 2026-10-01 |
| Luma Photon | Sem cláusula de público e é a única com garantia escrita de *no-train* (tier Provisioned Throughput) — mas custa **~12× mais** e **não entrega 1280×720 nativo**. Fica registrada como alternativa |
| `fal.ai` como agregador | O AUP não tem cláusula de público infantil, mas o ToS exige **End Users 18+** e permite usar *Usage Data* para desenvolver modelos. E agregador não lava a restrição do modelo de origem (`ADR-005`) |
| Pesos abertos do FLUX self-hosted | Exigem licença comercial por assinatura **com limite de domínios** e uma GPU — esta máquina tem 6 processadores lógicos e nenhuma GPU NVIDIA |
| Exceção automática para `simulated: true` | Deixaria provedor real passar pela lista declarando-se simulado |
| Deixar a thumbnail fora do `MediaStage` e tratar como "imagem de cena" | A imagem de cena é 16:9 **de vídeo**, presa à timeline e medida em duração; a thumbnail é um still com hipótese de atração. Misturar faria a timeline cronometrar uma thumbnail |
| Gerar 4 variações do mesmo prompt | Quatro apostas iguais não informam nada quando o CTR voltar. A skill `rebeca-branding` pede hipóteses **distintas** |

## Consequências

- **Positivas:** a arte passa a existir e a **aparecer** (a tela de Revisão mostra as quatro opções; a tela
  de Mídia gerada lista e exibe cada arquivo com prévia); o custo do conjunto é 0,02% do teto mensal; a
  regra de fornecedor deixou de ser prosa e virou código executável; e a lacuna do FLUX no `ADR-005` está
  registrada como `NAO-VERIFICADO` em vez de presumida.
- **Negativas / custo assumido:** 1280×720 nativo limita o reescalonamento; a MiniMax **pode usar input e
  output** para melhorar os serviços e **não oferece opt-out** — o que importa para o envio de uma
  referência de personagem; e a primeira geração paga ainda não aconteceu.
- **O que muda para o usuário:** ele clica em **"Gerar as 4 artes"** e vê quatro imagens com hipóteses
  diferentes. Se não houver chave, o resultado é arte simulada **e a tela diz isso** — nunca em silêncio.
- **Impacto no isolamento multi-canal:** a allow-list e o caminho dos ativos são por canal; um canal adulto
  pode liberar fornecedor que o infantil não pode. Isso é funcionalidade, não exceção.
- **Impacto no custo:** US$ 0,0035/imagem, dentro do D5 (US$ 60/mês) com quatro ordens de grandeza de
  folga. Cada imagem gerada entra em `.rebeca/custos.csv`; imagem **reusada não gera linha**.

## Verificação

`pnpm exec tsc --noEmit` exit 0 · suíte **265/265 em 25 arquivos** · build exit 0 · **três mutações
refutadas** com restauração conferida por sha256 (portão da allow-list removido → 1 vermelho;
reuso desligado → 1 vermelho, o teste de idempotência; checagem de `base_resp.status_code` removida →
2 vermelhos) · geração real pelo CLI (**4 arquivos 1280×720**, `rgba` conferido por `ffprobe`) ·
idempotência medida (**0 linhas novas** no livro na segunda execução) · travessia de caminho recusada em
**4 tentativas** ao vivo. Registro completo em `.rebeca/evidencias/gerador-de-thumbnail.txt`.

## Quem decide

- **Propôs:** apuração em fonte primária (`.rebeca/pesquisa/gerador-de-thumbnail-2026-10-01.md`) +
  `rebeca-ia-video` + `rebeca-branding`.
- **Aprovou:** humano, dono do produto, em **2026-10-01** — obrigatório, porque a decisão gasta dinheiro e
  define fornecedor para conteúdo destinado a menores.
- **Continua sendo decisão de advogado** (não resolvida aqui): se o produto que opera o canal é "API
  Client"/"Customer Application" para os fins das cláusulas de menores dos fornecedores; e a suficiência
  do DPA com a MiniMax. As ressalvas estão listadas no dossiê.
