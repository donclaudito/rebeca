# ADR-015 — Ciclo do personagem: opções, escolha, refino e aprovação

## Status
proposto (aguarda aprovação humana; a decisão de produto é do dono, e esta entrega apenas a implementa
como o PDF pediu)

## Data
2026-10-02

## Contexto
O PDF do cliente (`.rebeca/fontes/ideabeba-extraido.txt`, *Identidade e branding*) descreve o ciclo do
personagem em quatro batidas: *"O sistema gera opções. Eu escolho uma. Depois digo: 'Gostei desse, mas
quero as orelhas maiores e sem coleira.' Ela gera novamente. Quando eu aprovar o personagem, ele vira
um personagem oficial. A plataforma passa a utilizar aquela mesma identidade em vídeos futuros."*

O app tinha só a primeira metade: a função `identidade-personagem` devolvia **uma** ficha, nada era
gravado, não havia refinamento com a ficha anterior como contexto e `sheetVersion` era um número sem
documento. Sem decisão, "consistência de personagem" (invariante nº 3) ficava sem fonte: não existia
ficha canônica gravada, e o refino não tinha de onde partir.

Duas perguntas de projeto precisavam de resposta escrita, porque as duas têm consequência sobre
episódios já existentes:

1. **Refinar um personagem `oficial` rebaixa a ficha atual ou cria uma nova?**
2. **Se cria uma nova, o que acontece com a que era oficial?**

## Decisão
O ciclo passa a ser `AiAction` (proposta de 2-3 opções) → `saveCharacterDraft` (escolha vira
`rascunho`) → `saveCharacterDraft` com `derivedFromId` (refino vira **nova** versão, `sheetVersion`
+1) → `approveCharacter` (único caminho para `oficial`).

**Refinar nunca edita a ficha existente: cria uma nova versão derivada, e a anterior só deixa de ser
oficial quando a nova é aprovada — passando ao estado `substituido`.**

Implementação:
- `src/data/types.ts`: `CharacterSheet` (documento da ficha), `CharacterProposal` (a opção proposta),
  `CharacterSheetOrigin` (procedência) e `Character.status` com a variante `substituido`.
- `src/data/client.ts`: `saveCharacterDraft` (nasce `rascunho`, `derivedFromId` validado contra o
  canal, `sheetVersion` derivado do topo da **vizinhança de identidade** — nome normalizado ou raiz da
  linhagem da base; ver o limite logo abaixo) e `approveCharacter` (portão de ficha completa,
  substituição da versão oficial anterior, registro de `approvedAt`).
- `src/ai/schemas.ts` + `.rebeca/prompts/identidade-personagem@v2.md`: a saída passa a ser
  `opcoes` (2-3) e a entrada ganha `ajuste` + `personagemBase` (lista de 0 ou 1 ficha).

### O que `sheetVersion` garante — e o que não garante

`sheetVersion` é **único e crescente por nome, dentro de um canal**: duas fichas do mesmo canal com o
mesmo nome normalizado nunca recebem o mesmo número. O nome é normalizado por `identidadeDoNome` (sem
acento, sem caixa, sem separador — `Bentó`, `bento` e `Ben  to` são a mesma coisa).

`proximaVersaoDaIdentidade` olha, no canal, as fichas que compartilham o **nome normalizado** com a
ficha nova **ou** a **raiz da linhagem da base** — e sobe do maior número que encontrar. A linhagem
entra no cálculo por um motivo só: quando o refino **renomeia**, a contagem continua de onde estava em
vez de reiniciar em `v1`.

Refinar uma versão `substituido` ou abrir duas ramificações da mesma base, então, produz `v3`, `v4`, …
e nunca reemite o número de uma ficha viva.

**Dois limites declarados** — as duas frases que este ADR dizia antes prometiam mais do que o código
faz, e as duas foram corrigidas aqui (achados 2 e 3 do `docs/qa/QA-016-correcoes-fases-1-e-2.md`):

1. **É vizinhança de um passo, não fecho transitivo.** A identidade **não** é "nome ∪ linhagem" fechado
   transitivamente. O caso que refuta a leitura literal, medido pelo `rebeca-qa`:
   `A("Bento") v1` → refino renomeado `B("Pip", derivado de A)` = `v2` → ficha nova `C("Bento", do
   zero)` = `v2`. `B ~ A` pela linhagem e `A ~ C` pelo nome, mas **B e C não se olham**: duas fichas
   `v2` convivem. Nenhum consumidor quebra e o par `id` + `sheetVersion` desambigua — o que não podia
   continuar era a frase dizer "único dentro da identidade" onde o código garante "único **por nome**,
   com a linhagem estendendo a contagem".
2. **Entre identidades diferentes o número coincide por definição** — cada personagem novo começa na
   sua `v1`, e é por isso que o rótulo sozinho nunca identifica uma ficha.

A comparação de identidade tem **uma única** regra no arquivo (`identidadeDoNome`), usada tanto pelo
gerador de `id` quanto pela substituição da versão oficial.

### Rastrear a ficha **no ativo gerado** ainda não existe (declarado, não prometido)

`id` + `sheetVersion` identifica uma ficha sem ambiguidade **no registro de personagens do canal** —
que é onde `saveCharacterDraft` e `approveCharacter` escrevem. **Nenhum ativo de mídia registra qual
ficha usou**, e este é o estado de hoje, conferido no código:

- `MediaAsset` (`src/media/contract.ts:155-189`) não tem campo de personagem: registra `providerId`,
  `model`, `promptVersion`, `reference` — e nada sobre personagem ou versão de ficha.
- O manifesto fixa `characterSheet: 'ausente'` (`server/media/manifest.ts:53`).
- O que viaja até o gerador é `{ name, role, sheetVersion }` (`src/media/client.ts:176`,
  `server/media/http.ts:166`): **o `id` não viaja em ponto nenhum**.

Consequência declarada: *"o episódio usou a ficha v4"* é, hoje, uma pergunta **sem resposta no
artefato** — a informação existe na tela de Identidade, não no ativo. Tornar a frase verdadeira exige
um campo de personagem (`id` + versão) no contrato de mídia e no manifesto, junto com a arte do
Character Sheet: é a Fase 3, **não** esta. Enquanto isso não existir, este ADR promete
rastreabilidade **no registro de personagens** e diz `NÃO VERIFICADO no ativo` sobre o resto — em vez
de deixar uma promessa de auditoria que nenhum ativo cumpre.

## Alternativas descartadas
| Alternativa | Por que foi descartada |
|---|---|
| Refinar **rebaixando** a ficha oficial para `em_aprovacao` e editando-a no lugar | Episódio já gerado aponta para uma ficha que passaria a dizer outra coisa. O invariante nº 3 exige que o personagem oficial "pareça o mesmo"; mudar a ficha sob os pés de um episódio existente apaga a referência que explica o que foi gerado. Além disso, `em_aprovacao` significa "esperando decisão", e a ficha rebaixada não estava esperando nada — seria estado mentiroso |
| Refino aprovado deixa as **duas** versões `oficial` e a interface escolhe a mais nova | Duas identidades canônicas com o mesmo nome tornam "a identidade que a plataforma usa em vídeos futuros" uma pergunta sem resposta. Qualquer consumidor (geração de imagem, manifesto de mídia) teria de decidir por conta própria, e é assim que a Luna sai diferente entre episódios |
| Apagar a versão anterior ao aprovar a nova | Apaga o registro da ficha que existia quando os episódios já gerados saíram do forno. O vínculo do ativo com a ficha ainda **não existe** (ver o limite declarado acima), mas apagar a versão tiraria até a possibilidade de reconstruí-lo — e é a mesma razão pela qual `rebeca-branding` exige que ajuste em personagem oficial crie nova versão em vez de editar a anterior |
| `personagemBase` com campos vazios (`nome: ''`) em vez de lista de 0/1 item | Funciona, mas inventa uma ficha "vazia" com seed 0 para dizer "não há base". Lista vazia já é o vocabulário do projeto para "não há valor" |
| Nova função de IA só para o refino | Duplicaria prompt, schema e caminho de custo para a mesma capacidade. O refino é a **mesma** tarefa com uma ficha de origem no contexto — é a mesma função, com entrada a mais |

## Consequências
- Positivas: a ficha canônica passa a existir como dado (e `sheetVersion` passa a significar algo **no
  registro de personagens**); o refino não edita a versão anterior — ela permanece intacta e rastreável
  na tela de Identidade; a IA continua sem nenhum caminho de escrita — `approveCharacter` é o único para
  `oficial`; e a tela consegue dizer, para cada ficha, se veio de proposta real ou de **simulação**.
  (O que **não** existe é o vínculo do ativo gerado com a ficha: ver a seção de limite, acima.)
- Negativas / custo assumido: o canal acumula versões `substituido` (não há caminho de descarte nesta
  fase) e a lista vai crescer a cada refino aprovado; o teto de tokens da função subiu de 1600 para
  2400 (2-3 fichas não cabiam em uma).
- O que muda para o usuário: ele passa a poder escolher entre opções, pedir ajuste em texto e aprovar
  — e a tela mostra a ficha inteira (traços, prompt, seed, notas), dizendo o que ainda **não** existe:
  a arte das pranchas.
- Impacto em isolamento multi-canal: `derivedFromId` é validado contra o canal com a mesma mensagem de
  "não existe" (`Personagem não encontrado neste canal.`); a lista lê do armazenamento escopado; e a
  troca de canal remonta a tela (`AppShell:30`). Testes: `personagem-ciclo.test.ts` e
  `identidade-personagem.test.tsx`.
- Impacto em custo por vídeo: cada rodada de criação/refino é uma chamada da função `criativo`. Com o
  teto de 2400 tokens de saída, o custo estimado no modelo mais caro dos níveis fica em torno de
  US$ 0,03 — abaixo do teto por chamada (US$ 0,05) que o dono aprovou. Nesta fase **nenhuma chamada
  paga foi feita** pelos testes (a suíte usa o provedor simulado e dublês de rede).

## Verificação
- `pnpm exec vitest run src/data/__tests__/personagem-ciclo.test.ts` — ciclo completo, recusa de outro
  canal, refino de oficial sem deixar oficial para trás, ficha incompleta recusada, revisão única por
  identidade e identidade insensível a acento/caixa/separador.
- `pnpm exec vitest run src/features/identidade/__tests__/` — o ciclo na tela, nada gravado sem clique
  humano, troca de canal limpa, resposta sem opções não quebra.
- `pnpm exec vitest run src/data/__tests__/qa-fase1-adversarial.test.ts` — a refutação independente do
  `rebeca-qa` (19 testes depois do QA-016), hoje verde.
- Prova por mutação das garantias (8 mutações da primeira rodada + 2 mutações inversas das correções,
  cada uma deixando o teste vermelho e restaurada byte a byte por sha256) em
  `.rebeca/evidencias/fase-1-personagem.txt`, que também registra o conserto do teste de tela instável
  por tempo (seção 9) e esta correção de texto (seção 10).
- Reavaliar em: quando existir arte de Character Sheet (pranchas), quando a camada de mídia passar a
  consumir a ficha oficial e registrar **qual** ficha usou (`server/media/manifest.ts` hoje fixa
  `characterSheet: 'ausente'`, e `MediaAsset` não tem campo de personagem) e quando houver caminho de
  descarte de versões `substituido`.

## Correções após verificação adversarial

### QA-015 (achados 2 e 3 — código)

O `rebeca-qa` refutou a primeira versão desta decisão em dois pontos
(`docs/qa/QA-015-fases-1-e-2.md`, achados 2 e 3). Os dois foram **aceitos e corrigidos** — nenhum foi
contestado, porque a reprodução dele é mínima e o defeito está no código. As asserções que documentavam
o defeito em `src/data/__tests__/qa-fase1-adversarial.test.ts` foram **invertidas**, com o achado e a
data no comentário de cada uma, para travar o comportamento correto.

| Achado | O que estava errado | Correção | Prova |
|---|---|---|---|
| 2 | `sheetVersion` subia da **base** (`nextSheetVersion(base.sheetVersion)`): refinar uma versão `substituido` reemitia o número de uma ficha viva | `proximaVersaoDaIdentidade` sobe do topo da vizinhança de identidade (nome normalizado ou raiz da linhagem da base) | teste do QA verde; mutação inversa deixa 3 testes vermelhos |
| 3 | `mesmaIdentidade` comparava a string crua e o gerador de `id` tirava o diacrítico — duas regras para a mesma pergunta, e `Bento` + `Bentó` viravam dois `oficial` | uma única função (`identidadeDoNome`) usada pelo `id` **e** pela substituição | idem |

O texto original desta ADR afirmava que a subida de versão tornava o refino auditável; como estava
implementado, a afirmação era **falsa**.

### QA-016 (achados 2 e 3 — só texto, e é a segunda vez)

Na segunda rodada o `rebeca-qa` (`docs/qa/QA-016-correcoes-fases-1-e-2.md`) mediu a **leitura literal**
do texto que a correção anterior introduziu e achou duas frases que o código não sustenta. As duas
foram corrigidas **no texto**, sem mexer no comportamento — que ele mesmo verificou estar certo:

| Achado | A frase que não se sustentava | O que passou a estar escrito |
|---|---|---|
| 2 | *"identidade = nome **mais** linhagem"* e `sheetVersion` *"único dentro de uma identidade"* → lido como união, a identidade seria o fecho transitivo, e `proximaVersaoDaIdentidade` calcula **vizinhança de um passo** | `sheetVersion` é único **por nome**, e a linhagem da base **estende a contagem**; o caso do fecho (A "Bento" v1 → B "Pip" v2 → C "Bento" v2) está escrito como limite declarado |
| 3 | *"a chave de auditoria de um ativo gerado é o par `id` + `sheetVersion`"* — nenhum ativo registra esse par | virou "`id` + `sheetVersion` identifica uma ficha **no registro de personagens**", mais a seção que declara que o ativo **não** registra a ficha (`MediaAsset` sem campo de personagem, `manifest.ts:53` fixo em `'ausente'`, e o `id` não viaja em `src/media/client.ts:176` / `server/media/http.ts:166`) |

Lição registrada: **duas vezes seguidas este ADR disse mais do que o código faz** — na primeira, no
código; na segunda, na redação. A regra que passa a valer para ele: afirmação de garantia só entra
acompanhada do **limite** e de onde ela é verificável; o que ainda não existe é escrito como o que
ainda não existe, não como o que já vale.

## Quem decidiu
Proposto pelo agente desta entrega (Fase 1 do plano `.rebeca/planos/fase-1-personagem.md`), seguindo a
decisão do dono registrada no plano ("Refinar derruba a oficialidade. Escolha e documente.").
**Pendente de aprovação humana** — enquanto não for aprovado, vale o que está implementado, e o
`rebeca-qa` deve ser quem tenta refutar.
