# QA-015 — Revisão adversarial das Fases 1 e 2 (o personagem e as imagens)

**Alvos:** Fase 1 — `src/features/identidade/IdentidadePage.tsx`, `src/data/client.ts`, `src/data/types.ts`,
`src/ai/schemas.ts`, `src/ai/contract.ts`, `.rebeca/prompts/identidade-personagem@v2.md`;
Fase 2 — `server/media/providers/minimax.ts`, `server/media/providers/image-provider.ts` (novo),
`server/media/simulated-episode.ts`.
**Revisor:** `rebeca-qa` (independente: não escreveu nem corrigiu nada das duas entregas).
**Data:** 2026-10-02, janela 17:17–18:05 (horário local).

**Veredito: REFUTADO (parcial).**
Os **quatro alvos da Fase 1 resistiram** — não consegui produzir dois personagens `oficial` com o mesmo
nome, não consegui fazer o refino editar a ficha existente nem deixar a anterior oficial, não consegui
vazar personagem entre canais por nenhuma porta da camada de dados, e não existe caminho de escrita a
partir da IA. O que caiu na Fase 1 foi uma alegação **do próprio ADR-015**: `sheetVersion` **não**
identifica uma ficha única (achado 2). Na Fase 2 caiu uma garantia de integridade de arquivo (achado 1):
o arquivo é gravado **antes** da validação, a retentativa transforma a falha detectada em **sucesso
silencioso**, e um arquivo que passa nessa validação mas não é decodificável **trava o passo do clipe
por 15 minutos** em vez de falhar rápido (reprodução medida com `ffmpeg` puro).

Nenhuma correção foi feita por mim: os achados voltam para o autor com reprodução mínima.

## Integridade do que foi julgado (medida às 17:18)

Os 19 arquivos entregues batem **byte a byte** com os sha256 registrados nas duas evidências dos autores
(`Get-FileHash -Algorithm SHA256` em cada um; 0 divergências). A árvore **não** mudou debaixo desta
revisão: `tsc` e a suíte foram remedidos no fim e dão o mesmo resultado dos autores.

| Verificação de árvore | Hora | Resultado |
|---|---|---|
| `pnpm exec tsc --noEmit` | 17:23:40 | ✅ **exit 0** |
| Suíte completa | 17:57:30 → 17:59:37 | ✅ **42 arquivos / 479 testes, 0 falhas** (inclui os 32 testes novos deste QA) |
| `.rebeca/custos.csv` | 17:24 | ✅ `Import-Csv` sem erro, **257 linhas**, última gravação **15:49:06** — anterior às duas sessões (16:00–16:30), ou seja, **nenhuma das duas entregas gastou dinheiro**; **0** linhas com `provedor=minimax` |
| `git status` | 17:17 | ✅ só os arquivos esperados; nada commitado; `git add -A` nunca usado |

> **Transparência sobre uma rodada vermelha intermediária (17:24–17:41):** a primeira versão da suíte
> completa com os meus testes deu `1 failed | 478 passed`, com **900,7 s** num único teste meu — e o
> número não era coincidência: `FFMPEG_TIMEOUT_MS` é 15 min (`ffmpeg.ts:31`). A causa era **do meu
> fixture**: eu alimentava o pipeline com um PNG de 33 bytes (só assinatura + IHDR) que passa no
> `assertImageBytes` mas **não é decodificável**, e o `zoompan` do passo do clipe queima CPU/memória sem
> terminar. Corrigi o fixture (PNG real com IHDR+IDAT+IEND) e remedi: 479/479 em 17:59:37. O defeito do
> **produto** que essa rodada revelou está no achado 1 (o mesmo arquivo é aceito como "reuso válido").

## Achados

| # | Fase | Gravidade | O que está errado | Reprodução mínima (comando + observado) | Efeito para quem usa |
|---|---|---|---|---|---|
| 1 | 2 | **ALTA** | `minimax.ts:556-558` (e `:393-394`) grava o arquivo com `writeFileSync` **antes** de `assertImageBytes`. A falha é detectada mas o arquivo fica no disco, e `fileExists()` só olha tamanho > 0 — então a **retentativa devolve sucesso com custo zero** sobre um arquivo que não é imagem. Pior: um arquivo que **passa** na validação de 3 bytes e não é decodificável **trava o passo do clipe por 15 min** | (a) `qa-fase2-adversarial.test.ts > REFUTADO: resposta que não é imagem deixa o arquivo no disco e vira "sucesso grátis" na retentativa`: 1ª chamada lança `/não é uma imagem/` e o arquivo contém o texto `erro do provedor`; 2ª chamada **não chama `fetch`**, devolve `costUsd: 0` e o mesmo `path`. (b) variante: PNG truncado no disco → aceito, `pngSize` = `null`. (c) **reprodução com `ffmpeg` puro**: com um PNG de 33 bytes (assinatura + IHDR), `ffmpeg -y -loop 1 -i truncado.png -frames:v 90 -vf zoompan=… -c:v libx264 … out.mp4` **não terminou em 180 s** (o comando do `simulatedVideoProvider.animate`); o mesmo passo rodou no teste real em ~2 s | O pipeline segue com esse caminho, registra no manifesto e monta o clipe sobre ele. Um erro de provedor vira ativo "pronto" e nunca é regerado — o contrato do comentário ("melhor falhar aqui do que entregar arquivo corrompido") só vale na **primeira** chamada. E o custo de descobrir isso em produção é um episódio parado 15 min (o teto do `spawnSync`) com um processo `ffmpeg` consumindo ~700 MB, não uma mensagem de erro |
| 2 | 1 | **MÉDIA** | `client.ts:932` faz `sheetVersion: nextSheetVersion(base.sheetVersion)` — sobe a partir da **base**, não do topo da linhagem. Refinar uma versão `substituido` reemite o número de uma ficha **viva** | `qa-fase1-adversarial.test.ts > REFUTADO: o número da revisão não é único`: v1 oficial → refino v2 aprovado (v1 vira `substituido`) → refinar **a v1** de novo → a ficha nova nasce **`v2`**, o mesmo rótulo da oficial. Duas fichas `v2` convivendo (o teste mede `length = 2`). Também por ramificação: dois refinos da mesma base → `['v2','v2']` | O ADR-015 justifica a subida de versão com *"o episódio gravado com a v4 continua rastreável"*. Com dois documentos chamados `v2`, "qual ficha o episódio usou?" deixa de ter resposta, e o painel "Este canal tem N fichas canônicas" pode listar duas `v2` do mesmo personagem. Não há perda de dado nem vazamento — é a **auditabilidade** que o ADR promete e que não se sustenta |
| 3 | 1 | **MÉDIA** | `mesmaIdentidade` (`client.ts:553-555`) compara `normalizeSingleLine().toLowerCase()`; o gerador de `id` (`:524-537`) **tira** o diacrítico. Dois nomes que o humano lê como iguais escapam da substituição | `qa-fase1-adversarial.test.ts > REFUTADO: acento separa duas identidades…`: aprovar `Bento` e depois `Bentó` → **dois `oficial`**, ids `luna-bento` e `luna-bento-2`. Idem `Bento` × `Ben  to` (espaço interno) | É o cenário que o ADR-015 diz existir para impedir (*"é assim que a Luna sai diferente entre episódios"*): duas identidades canônicas lidas como o mesmo personagem, e o consumidor que filtra `oficial` (a Revisão usa isso para thumb e storyboard) passa a mandar as duas ao prompt |
| 4 | 2 | **MÉDIA** | `image-provider.ts:219`: o fallback de plano é `if (provider.simulated) return planImage(input)` — chaveado pela **flag**, não pela identidade. Um terceiro provedor **simulado** sem `plan()` herda hash **e caminho** do ffmpeg | `qa-fase2-adversarial.test.ts > REFUTADO: terceiro provedor SIMULADO sem plan herda o hash e o CAMINHO do ffmpeg`: `path`, `hash` e `sha256` **idênticos** aos de `simulado-imagem` (`planImage` fixa `providerId: 'simulado-imagem'`) | É o mesmo defeito que a Fase 2 diz ter fechado ("arte real nasceria com nome de arte simulada"). Latente hoje (só existe um provedor simulado), mas o ponto de extensão é público: um segundo gerador local escreveria no arquivo do primeiro e a reexecução serviria a arte do outro achando que é a sua |
| 5 | 2 | **MÉDIA** | A "segunda rede" de escopo (`assertWithinChannel`) só existe dentro de `assetPath`, usado pelos planos do simulado e da MiniMax. `planImageFor` devolve o `plan` de um terceiro provedor **verbatim** | `qa-fase2-adversarial.test.ts > REFUTADO: o plan de um terceiro provedor não passa pela segunda rede de escopo`: um plano apontando para `<temp>/fora/canal-alheio.png` é aceito, e `planImageFor` o devolve sem consultar o escopo | Um adapter futuro que monte o próprio caminho pode gravar ativo **fora da pasta do canal** — e o manifesto registra o caminho absoluto. Hoje nenhum provedor faz isso; a rede de escopo não cobre o ponto de extensão que a própria fase criou |
| 6 | 2 | **MÉDIA** | Perdido o `meta.json` com os arquivos no disco, a reexecução **relança linhas no livro** (`created` volta ao total, `reused` = 0). É o achado nº 4 do `QA-010`, registrado lá como pendência da Fase 1 e **não fechado** | `qa-fase2-adversarial.test.ts > REFUTADO: sem o meta.json, a reexecução relança linhas no livro`: 1ª execução 1 chamada de rede; apaga-se só o `meta.json`; 2ª execução **não chama a rede** (o arquivo segura o dinheiro) mas `ledgerRowCount()` **cresce** e `reused` = 0 | O critério "*rodar duas vezes não gera linha nova no livro*" vale **enquanto o manifesto existir**. O dinheiro está protegido pelo `fileExists` do adapter (as linhas novas de imagem entram com custo 0), mas `ledgerRows` e a leitura "quantas vezes isto foi gerado" ficam erradas — e num manifesto perdido no meio de um episódio pago o operador vê "gerado de novo" onde não houve gasto |
| 7 | 2 | **BAIXA** | `minimax.ts:331` só usa `metadata.failed_count` quando `typeof === 'number'`. O **exemplo** do OpenAPI oficial devolve `failed_count: '0'` como **string** (`success_count: '3'` também), enquanto o schema declara `integer` | `web_fetch` de `platform.minimax.io/docs/api-reference/image-generation-t2i.md` (lido às 17:25): `example: metadata: { failed_count: '0', success_count: '3' }` | Quando o provedor manda string, a mensagem perde o `failed_count=N (pode ter sido bloqueio de segurança)` — justamente a pista que explica um bloqueio de conteúdo. Só qualidade de mensagem: a recusa acontece do mesmo jeito |
| 8 | 2 | **BAIXA** | `assertImageBytes` compara **3 bytes** (`minimax.ts:229`) contra os 3 primeiros da assinatura PNG: qualquer arquivo começando em `89 50 4E` passa por "imagem" — inclusive um PNG sem `IDAT`, que o `ffmpeg` não consegue decodificar | leitura de `minimax.ts:227-238` + a reprodução (c) do achado 1: 33 bytes passam e travam o `zoompan` | É a **causa raiz** do achado 1: a validação é mais fraca do que a mensagem sugere. O teste do próprio autor já registrava o risco em comentário ("um PNG só com a assinatura passaria no `assertImageBytes` e quebraria o render") — aqui ele está medido, não suposto |
| 9 | 2 | **BAIXA (observação)** | `providers` (conjunto informado pelo chamador) **vence** `imageProvider: 'auto'` (`simulated-episode.ts:282-299`). Comportamento documentado no código, não defeito | `qa-fase2-adversarial.test.ts > um providers informado pelo chamador tem PRECEDÊNCIA sobre auto`: com chave presente + `auto`, passar `providers: SIMULATED_PROVIDERS` faz o episódio rodar inteiro simulado, `fetch` nunca chamado, custo 0 | Informação para quem for ligar a tela/CLI: `auto` é uma propriedade do **run**, e um chamador que informe `providers` (para trocar uma etapa) desliga o caminho pago sem que o nome do parâmetro sugira isso. O erro cai para o lado barato, nunca para o caro |

## O que eu tentei refutar e **resistiu** (com a prova)

### Fase 1 — os quatro alvos

1. **Oficialidade única.** Tentei por quatro caminhos: (a) criar do zero uma segunda ficha com o mesmo
   nome — `approveCharacter` substitui por **linhagem OU nome** (`client.ts:977-983`), resultado 1 oficial;
   (b) variações de caixa e espaço nas pontas (`BENTO`, `bento`, `  Bento  `) — `normalizeSingleLine` +
   `mesmaIdentidade` colapsam, resultado 1 oficial; (c) aprovar de novo a versão substituída —
   `rejeita /substituída/`; (d) aprovar a reemissão do `v2` duplicado — a versão viva é substituída, sobra
   1 oficial. **A aprovação substitui de fato**: o filtro `status === 'oficial'` que a `RevisaoPage` usa
   (`RevisaoPage.tsx:138,177,434,726`) passa a enxergar só a versão nova, e a antiga permanece com a ficha
   intacta em `substituido`. Só cai quando o nome **não é a mesma string** (achado 3).
2. **O refino não edita.** Refino cria `id` novo, `sheetVersion` +1 e `derivedFromId`; a ficha de origem
   continua com a mesma `descricaoVisual` e o mesmo `status`. Nada aqui foi refutado (o que caiu foi a
   **unicidade do número**, achado 2).
3. **Isolamento por canal.** Testei as três portas da camada de dados com `channelId` cruzado — leitura
   (`getCharacters`), aprovação (`approveCharacter('arquivo', <id da luna>)`) e refino
   (`derivedFromId` de outro canal): todas recusam com a **mesma** mensagem `Personagem não encontrado
   neste canal.` (não vaza a existência do dado alheio). Também: aprovar no canal `luna` um personagem
   com o nome do oficial de `arquivo` **não** derruba o de `arquivo` (`superseded = []`), e forjar
   `id`/`channelId`/`sheetVersion`/`status`/`approvedAt` dentro da proposta é ignorado campo a campo.
   Nenhuma linha, nenhum id e nenhum nome cruzou. O mecanismo estrutural (`AppShell.tsx:30`,
   `key={channelId}`) foi conferido por leitura — `qk.characters(channelId)` também carrega o canal, então
   o cache do React Query não é um vetor.
4. **A IA nunca grava nem aprova.** `characterStore` só é mutado em `src/data/client.ts`; os únicos
   chamadores de `saveCharacterDraft`/`approveCharacter` são a tela (`IdentidadePage.tsx:239,253`) e
   testes; `src/ai/**` e `server/ai/**` importam **apenas tipos** de `data/` (`import type`); o `AiAction`
   tem uma única mutação, a de geração. Não existe atalho de status: a proposta é lida campo a campo e o
   status é fixo em `rascunho`.

### Fase 2 — os cinco alvos

1. **`auto` com e sem chave.** Sem chave: provedor `simulado-imagem`, aviso com *"Prova de máquina, NÃO
   arte"* e `ffmpeg` na frase, `origem` dizendo por quê. Com chave: `minimax`, preço 0,0035,
   `deepSynthesis.required = true` e `text = null`. O aviso da MiniMax não foi inventado em nenhum ponto.
2. **A resolução bate com o que o código faz.** CONFIRMADO. `miniMaxAspectRatioFor(1920, 1080)` → `'16:9'`,
   e o corpo enviado tem `aspect_ratio: '16:9'` **sem** `width`/`height` — coerente com o OpenAPI oficial,
   que diz que `aspect_ratio` tem prioridade quando os dois vão juntos. A resolução publicada é **medida
   do arquivo**: com um provedor que devolve 640×360, `pngSize` acusa 640×360 e não os 1920×1080 pedidos;
   PNG sem IHDR devolve `null` ("não medido"). A afirmação *"16:9 entrega 1280×720 nativo"* foi conferida
   na fonte: o OpenAPI oficial lista `16:9 (1280x720)`. **Preço conferido**: `pricing-paygo.md` →
   `image-01 | $0.0035 per image` (relido por mim às 17:25). Os `status_code` (0/1002/1004/1008/1026/2013/
   2049), o limite de 1500 caracteres do prompt, `width/height` [512,2048] múltiplo de 8 e a expiração de
   24 h da URL também batem com o documento.
3. **Terceiro provedor.** Real com `plan` → respeitado; real sem `plan` → recusado com mensagem que
   explica o motivo (não paga para descobrir o nome do arquivo); real pago sem preço → `null` no preço, sem
   herdar rótulo nem valor de ninguém, e o portão de estimativa barra antes. Caiu no simulado (achado 4) e
   no escopo (achado 5).
4. **Idempotência.** No caminho normal: 2 chamadas → 1 requisição, `costUsd: 0` na segunda; e a suíte do
   autor (que eu reproduzi) confirma 2 execuções de episódio com `created=0`, `reused` = total, mesma lista
   de arquivos, mesmo número de linhas e **zero requisição nova**. Caiu quando o manifesto se perde
   (achado 6) e quando o arquivo gravado é inválido (achado 1).
5. **O portão antes da rede.** CONFIRMADO, e fui além do autor: além do caso mutado por ele, injetei um
   fornecedor de terceiro pelo parâmetro `providers` e o portão o recusou com `ProviderNotAllowedError`
   citando o id, **sem** chamar `render`, sem arquivo e sem linha — e antes do `assertFfmpegAvailable`
   (o teste roda sem depender do binário). Provedor pago sem preço declarado também é barrado antes de
   gerar.

### Rótulo de deep synthesis (`ADR-005`) — corroborei a declaração do autor

`web_fetch` de `platform.minimax.io/protocol/terms-of-service` às 17:26: **HTTP 200 com corpo
ilegível** (página renderizada por JS) — exatamente o que a evidência da Fase 2 declara. `text: null` é
honesto: a obrigação está afirmada, a redação não foi inventada.

## O que ficou **não verificado** (e por quê)

1. **Nenhuma chamada real à MiniMax.** Não existe chave nesta máquina e eu não tentei obter nenhuma, nem
   rodei o comando que gasta. Consequência: **preço realmente cobrado, latência, tamanho do PNG e
   resolução realmente entregue para `16:9` seguem NÃO VERIFICADOS na prática.** O que verifiquei é a
   documentação oficial (que declara 1280×720) e o comportamento do código com um dublê de `fetch`.
2. **Nenhuma imagem foi aberta e olhada.** A consistência de personagem (invariante nº 3) não foi
   avaliada: o PNG dos testes é sintético. O Character Sheet ilustrado continua inexistente.
3. **A tela não foi exercitada para a Fase 2.** O dado (`imageSize`, custo real, aviso de provedor) existe
   na resposta do pipeline, mas a Revisão não foi tocada pela entrega — não há como confirmar que o humano
   **vê** a resolução medida e o aviso. Não escrevi teste de UI: `src/features/revisao/**` está fora dos
   caminhos de teste que esta revisão pode criar.
4. **A ficha canônica ainda não é consumida como identidade visual.** `RevisaoPage` passa só
   `name/role/sheetVersion` e `server/media/manifest.ts:53` continua fixando `characterSheet: 'ausente'`.
   Está declarado pelo autor (`evidências`, itens c e 3) — registro aqui porque é o pedaço do PDF
   ("a plataforma passa a utilizar aquela mesma identidade em vídeos futuros") que ainda não existe.
5. **`negativePrompt` do storyboard não chega ao provedor** — confirmei lendo `src/media/contract.ts`
   (`ImageRequest` não tem o campo). Declarado pelo autor; é da Fase 3.
6. **O travamento de 15 min do passo do clipe não virou teste automatizado.** Reproduzi com `ffmpeg` puro
   (achado 1c) porque um teste disso custaria 15 min de suíte — o teto do `spawnSync`. O que está
   automatizado é o que o causa: o arquivo inválido/truncado ser aceito como ativo válido.
7. **Desempenho/tempo sob carga.** Um dos testes de tela do autor caiu por tempo numa rodada intermediária
   de *outra* sessão (20 s de teto). Nesta revisão ele passou (5,2 s); a suíte completa fechou verde como
   um todo, mas o teto de 20 s segue apertado para os testes de tela em máquina carregada.

## Árvore compartilhada (D9) — o que aconteceu nesta janela

- 17:17 — `git status` listava exatamente os arquivos das duas entregas + os da outra frente; **nada
  commitado**, `git add -A` não foi usado por mim em momento nenhum.
- 17:18 — sha256 dos 19 entregáveis: **todos idênticos** aos registrados nas evidências dos autores. A
  árvore ficou **estável** durante toda a revisão (nenhum arquivo fora das duas fases mudou de conteúdo).
- 17:23:40 — `tsc --noEmit` **exit 0** (nada vermelho; nenhum arquivo da área julgada com erro).
- 17:24–17:41 — primeira rodada da suíte completa: **1 vermelho, meu** (fixture não decodificável, ver nota
  no topo). Corrigido o fixture, sem tocar em nenhum arquivo das entregas.
- 17:57:30–17:59:37 — suíte completa verde (42 arquivos, 479 testes, 0 falhas, 126 s) (ver tabela no topo).
- 17:24 — `.rebeca/custos.csv` intocado desde 15:49:06 e com **0** linhas `minimax`: **as duas fases não
  gastaram dinheiro**, o que confirma o "não verificado" declarado por ambos os autores.

## Ambiente de execução do QA

O `vitest` não carrega no sandbox confinado desta sessão (o Vite chama `exec("net use")` e a criação do
pipe é negada). Usei o mesmo contorno já declarado nas evidências dos autores, **fora do repositório**:
`NODE_OPTIONS='--require ./node_modules/.cache/dsh-vitest-sandbox-shim.cjs'`. Nada versionado foi alterado.
O `tsc` não usa o shim e dá exit 0 como corroboração independente. Nenhum teste foi marcado `skip`/`todo`
sem justificativa: os `it.skipIf(!HAS_FFMPEG)` são os já usados pelo projeto (e o ffmpeg 8.1.2 está
presente, então eles **executaram**).

## Testes que este QA deixou no repositório

| Arquivo | Testes | O que morde |
|---|---|---|
| `src/data/__tests__/qa-fase1-adversarial.test.ts` | 15 | oficialidade única (4 tentativas), acento/espaço (achado 3), `sheetVersion` duplicado (achado 2), refino não-edita, isolamento por canal em 3 portas + forja da proposta, IA sem caminho de escrita |
| `src/media/__tests__/qa-fase2-adversarial.test.ts` | 17 | arquivo inválido/truncado (achado 1), idempotência normal, perda do manifesto (achado 6), `planImageFor` × terceiro provedor (achados 4 e 5), `auto` com/sem chave, precedência de `providers` (achado 9), portão antes da rede com provedor **injetado** |

## Próximo

Os achados 1, 2, 3, 4, 6 e 8 são do **autor das entregas** (`rebeca-ia-video` para os de mídia,
`rebeca-react`/`rebeca-backend` para o ciclo do personagem). Ordem sugerida, por efeito: **1 e 8**
(integrity do ativo — gravar só depois de validar e checar a assinatura no reuso), **2** (versão única por
linhagem), **3** (identidade comparada com a mesma normalização do `id`), **6** (consultar o livro pelo
`hash8` antes de re-registrar), **4 e 5** (os dois buracos do ponto de extensão `ImageProvider`), **7 e 9**
(mensagem e documentação).

Nenhum dos achados é vazamento entre canais, gasto não autorizado ou publicação sem aprovação — os três
gatilhos de escalação do `rebeca-qa` **não** foram disparados. O que este relatório **não** autoriza:
publicar, gastar com a MiniMax antes de existir chave aprovada, ou tratar a ficha oficial como referência
visual — a arte do Character Sheet continua inexistente, e o manifesto de mídia continua dizendo
`characterSheet: 'ausente'`.
