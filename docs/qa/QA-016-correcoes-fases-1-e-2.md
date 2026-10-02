# QA-016 — Segunda revisão adversarial: as correções das Fases 1 e 2

**Alvos desta rodada:** `src/data/client.ts` (`proximaVersaoDaIdentidade`, `identidadeDoNome`),
`.rebeca/decisoes/ADR-015-ciclo-do-personagem.md` (redação reescrita), `server/media/providers/minimax.ts`
(gravação validada em duas camadas, `isUsableImage`), `server/media/providers/image-provider.ts`
(`assertPlanWithinScope`), `server/media/simulated-episode.ts` (idempotência pelo livro) e as inversões de
asserção em `src/data/__tests__/qa-fase1-adversarial.test.ts` e
`src/media/__tests__/qa-fase2-adversarial.test.ts`.
**Revisor:** `rebeca-qa` (não escreveu nenhuma das correções; nesta rodada **não inverti nenhum teste
meu** — escrevi 11 testes novos, e as inversões dos cinco achados desta rodada foram feitas pelo autor e
revisadas por mim, item por item). **Data:** 2026-10-02, janela 18:36–19:17.

**Veredito: REFUTADO (parcial) — 1 achado de gravidade ALTA em aberto (com duas reproduções), mais duas
imprecisões de texto no ADR-015.**
Os **seis achados da rodada anterior** (1, 4, 5, 6, 7 e 8) estão fechados e provados. Nesta rodada eu
produzi **cinco achados novos** — um deles de dinheiro (ALTA) —, todos reproduzidos com arquivo de teste;
o autor os **corrigiu às 18:57–18:58, com esta revisão em andamento**, e eles foram fechados por medição
(19:07). O que **continua aberto** é o adapter de thumbnail da **OpenAI** — que é o caminho pago de
thumbnail **efetivamente em uso** e ficou com o achado 1 da rodada anterior, em versão pior (1a e 1b
abaixo) —, mais duas imprecisões de texto no ADR-015.

> **A árvore mudou debaixo desta revisão, duas vezes.** `simulated-episode.ts` (18:57:53) e `minimax.ts`
> (18:58:30) foram gravados **no meio** das minhas medições, e o meu arquivo de teste em 19:08:21. Cada
> achado abaixo diz **contra que instante** foi medido e o que passou a valer depois. O estado que esta
> revisão finalmente valida é o das 19:08+, com os hashes na seção de integridade.

## Integridade do estado revisado (medida às 19:07–19:11)

| Arquivo | sha256 | gravado às |
|---|---|---|
| `src/data/client.ts` | `3C4854E92CE57031CDFB6ADB43F5D3062406BB4466C98421E9C904C75D60FCB8` | 18:05:18 |
| `.rebeca/decisoes/ADR-015-ciclo-do-personagem.md` | `983D71F58487BA964912BAC052BA6DC098EDC3BA62655105ECEC4D421BC79A0A` | 18:05:46 |
| `server/media/providers/image-provider.ts` | `7995F1ABF6DED2D11F4B8ECE1DE0C86A28CB3B2FD3EE62BB6040044D827B37DD` | 18:03:48 |
| `server/media/providers/minimax.ts` | `3FA9F224456CB00DAB1DF42E7D4871E6F7B6E1A9B5168081D38D35C5D202783B` | **18:58:30** |
| `server/media/simulated-episode.ts` | `F5BAF2128DB60CE3695561B0255F694149F6F3AABDE350620751326D540062D4` | **18:57:53** |
| `server/media/providers/openai.ts` (não tocado) | `D2DCADCA4638822871B60B0CDC2C7CB32571FFF060C590F99EC827FA9A82BC0F` | 08:46:30 |
| `src/data/__tests__/qa-fase1-adversarial.test.ts` | `AF1B7F3AE3155193B964BC052AEC44ECD03368B1A13C2D2822F0FAB1D4CA924E` | 18:43:26 |
| `src/media/__tests__/qa-fase2-adversarial.test.ts` | `AB3F4B80D7973AA9715DF77F5B21A419734F34BE9F076AE8582AD91C037C0308` | 18:56:50 → 19:08:21 |

| Medição | Hora | Resultado |
|---|---|---|
| `pnpm exec tsc --noEmit` | 18:55:09 e 19:11:11 | ✅ **exit 0** nas duas |
| `vitest run src/media/__tests__/qa-fase2-adversarial.test.ts` | 19:09:14 → 19:10:59 | ✅ **24/24** |
| `vitest run src/data/__tests__/qa-fase1-adversarial.test.ts` | 18:42:28 | ✅ **19/19** |
| Suíte completa (rodada 1, **estado intermediário**) | 18:55:35 → 19:05:59 | ⚠️ **42 arquivos / 501 testes / 2 falhas** — as duas **passam isoladas** (19:06:11 → 19:07:02: 3 arquivos, 30/30). São de **tempo** sob carga: `identidade-personagem.test.tsx` levou 23,7 s contra o teto de 20 s. Esta rodada começou **antes** da correção das 18:58, então ela é foto do estado intermediário |
| **Suíte completa (rodada final, estado das 19:08+)** | 19:11:34 → 19:17:07 | ✅ **42 arquivos / 517 testes / 0 falhas** · 327,5 s |
| `.rebeca/custos.csv` | 19:07 | ✅ `Import-Csv` sem erro, **270 linhas**, **0** linhas `minimax`, **16** linhas de thumbnail `openai`; última gravação 18:28:15 |

## Achados EM ABERTO

| # | Gravidade | O que está errado | Reprodução (comando + observado) | Efeito para quem usa |
|---|---|---|---|---|
| 1a | **ALTA** | `server/media/providers/openai.ts:159` decide reuso por **`existsSync(path)`** — nenhuma validação, nem o tamanho do arquivo. Um arquivo de zero byte no caminho planejado é "ativo pronto" | `qa-fase2-adversarial.test.ts > REFUTADO (NOVO, ALTA): a checagem de reuso da OpenAI nem abre o arquivo`: `fetch` não chamado, `costUsd: 0`, `readFileSync(asset.path).length === 0` | Thumbnail vazia/ilegível é servida como a arte do canal e **nunca é regerada** |
| 1b | **ALTA** | `openai.ts:235` grava com `writeFileSync` **antes** de conferir a assinatura (`:237`) — e a conferência é só a assinatura de 8 bytes. É o achado 1 do `QA-015` inteiro, no adapter que a correção da Fase 2 **não tocou** | `... > providerForThumbnails prefere a OpenAI — e ela grava antes de validar`: resposta com HTML em base64 → 1ª chamada lança `/não é um PNG/` **e o lixo fica no disco**; a 2ª devolve **sucesso com custo 0** sobre ele | Um erro do provedor vira ativo "pronto" e a falha detectada se transforma em sucesso silencioso na retentativa. Este é o caminho **pago de thumbnail em uso**: `thumbnails.ts:219` escolhe a OpenAI **antes** da MiniMax quando há chave, e o livro tem **16 linhas** de thumbnail `openai / gpt-image-2.5-sunburst` |
| 2 | **BAIXA** (texto) | A redação nova do ADR-015 diz *"Identidade aqui é o nome normalizado MAIS a linhagem da base"* e promete `sheetVersion` **único dentro de uma identidade**. Lida como a **união** das duas relações — que é o que a frase diz —, a identidade é o fecho transitivo, e o código **não** o calcula: `proximaVersaoDaIdentidade` olha `(mesmo nome) ∪ (linhagem da MINHA base)` | `qa-fase1-adversarial.test.ts > REFUTADO (novo): a identidade do cálculo NÃO é fechada`: A("Bento") v1 → refino renomeado B("Pip", linhagem de A) = **v2** → ficha nova C("Bento") do zero = **v2**. B ~ A (linhagem) e A ~ C (nome): o mesmo conjunto fechado com dois `v2` | Nenhum consumidor quebra e a chave `id` + `sheetVersion` continua desambiguando — o defeito é a **frase**, não o comportamento. A correção é de uma palavra no ADR ("único **por nome**; a linhagem estende a contagem"), não de código |
| 3 | **BAIXA** (texto) | O ADR afirma: *"A chave de auditoria de um ativo gerado é o par `id` + `sheetVersion`"*. Nenhum ativo gerado registra esse par: `MediaAsset` (`src/media/contract.ts:155-189`) não tem campo de personagem, o manifesto fixa `reference: 'sintetica'` e `characterSheet: 'ausente'` (`manifest.ts:53`) | leitura + `grep sheetVersion`: os únicos pontos que transportam versão são `server/media/http.ts:166` e `src/media/client.ts:176` (`PersonagemDoCanal` com `name`/`role`/`sheetVersion`) — e o **`id` não viaja em nenhum** | A frase descreve uma chave de auditoria que ainda não existe (é a Fase 3 + a arte do Character Sheet). Como está redigida, promete rastreabilidade que o artefato não tem |
| 4 | **OBSERVAÇÃO** | O cabeçalho que o autor escreveu no meu arquivo diz "**Três** testes que apenas usavam um fixture falso (`pngMinimo`…) passaram a usar `pngSolido`"; são **quatro** respostas trocadas (linhas 237, 252, 278, 388) — o quinto uso de `pngMinimo` é legítimo (arquivo truncado de propósito, linha 344) | contagem no arquivo | Cosmético; registro para o número não virar "verdade" por repetição |

## Achados desta rodada que foram CORRIGIDOS durante a revisão (medidos às 18:45, fechados às 18:58)

Todos os cinco foram reproduzidos com teste antes da correção; depois dela, os mesmos testes — invertidos
pelo autor às 19:08 e verificados por mim às 19:09 — provam a garantia.

| # | Gravidade | O que eu medi às 18:45 | Correção (18:57–18:58) | Prova atual |
|---|---|---|---|---|
| N1 | **ALTA** (dinheiro) | Apagado **só** o arquivo da imagem, a execução seguinte chamava a API de novo (2ª cobrança) e o livro continuava com **1** linha: `fetch=2, linhas_imagem=1, custoEpisodio=0.0035` com **0,007** realmente gasto. A correção do achado 6 consultava o livro e, achando linha, tratava como reuso **mesmo quando o provedor acabara de cobrar** | `simulated-episode.ts:608` — a consulta ao livro só vale quando o provedor **não cobrou agora** (`costUsd === 0`); o mesmo em `:889` para o render | `CORRIGIDO (QA-016, achado ALTA)`: 2 linhas no livro, `custo = 2 × 0,0035`, e o ativo deixa de ser contado como reusado |
| N2 | **MÉDIA** | Com `REBECA_FFMPEG` apontando para um binário inexistente, um PNG com `IHDR 0x0` **passava** e era promovido como arte do canal — a camada 2 da validação é condicional (`if (ffmpegAvailable())`) e a camada 1 não olhava o IHDR | `minimax.ts:363` (`ihdrValido`) + `:451-464` (tamanho dos pixels) — a camada 1 passou a validar o cabeçalho e o `IDAT` descomprimido | `CORRIGIDO (QA-016, achado MÉDIA)`: recusado **sem ffmpeg**, mensagem da camada 1, nada no destino nem no `.parcial` |
| N3 | **MÉDIA** | O autor declarou **não ter conseguido** construir arquivo que passe na camada 1 e falhe na decodificação. Construí **cinco** (ver abaixo) e todos eram recusados com a mensagem da **camada 2** — prova de que a camada 1 os aceitava | idem N2 | `CORRIGIDO (QA-016, achado MÉDIA)`: os quatro caem na camada 1 e o teste exige a **mensagem da camada 1** (`/está incompleto/`), não a da camada 2 |
| N4 | **BAIXA** | PNG com `interlace=7` (o formato define 0 e 1) passava nas **duas** camadas e virava o ativo do canal | `minimax.ts:391` | `CORRIGIDO (QA-016, achado BAIXA)`: recusado com `/interlace 7/`, nada no disco |
| N5 | **BAIXA** | 5º caso da camada 1: `IHDR 8x8 RGB` com `IDAT` que descomprime para 4 bytes (o correto seriam 200) só era pego pelo ffmpeg | `minimax.ts:451-464` (só para PNG não entrelaçado — declarado no código) | `ATUALIZADO (QA-016)`: cai já na camada 1, com `/o IDAT descomprime para 4 bytes/` |

### O caso que o autor **não conseguiu construir** (item 3 do pedido)

Construí cinco, todos com assinatura válida, chunks com **CRC correto**, `IDAT` que descomprime e `IEND`
presente — e nenhum decodificável. Às 18:45, **os cinco eram recusados com a mensagem da camada 2**
("passou na conferência estrutural mas o ffmpeg NÃO conseguiu decodificá-lo"), que é a prova de que a
camada 1 os aceitava:

| Caso | Por que não é imagem | Quem recusava (18:45) |
|---|---|---|
| `IHDR` com largura/altura 0 | não há imagem de dimensão zero | camada 2 |
| `colorType=99` | valor que o formato não define | camada 2 |
| `bitDepth=7` com `colorType=2` | combinação inválida | camada 2 |
| `IDAT` que descomprime para 0 bytes (1x1 RGB) | sem um pixel sequer | camada 2 |
| `IHDR 8x8 RGB` com 4 bytes de pixels | faltam 196 bytes de pixel | camada 2 |

**Nota de método (importante para quem repetir isto):** numa primeira medição o **quinto** caso apareceu
como *aceito*. Era contaminação do meu próprio instrumento — as duas sondas usavam o mesmo `PEDIDO`, logo
o mesmo caminho de arquivo no mesmo diretório temporário: a segunda encontrou o arquivo promovido pela
primeira e respondeu pelo caminho de **reuso**, sem tocar nos bytes dela. Medido isolado (em `it`
separado, com diretório próprio), é recusado. Fica registrado porque um "aceito" falso é exatamente o
tipo de erro que esta revisão existe para não cometer.

## A afirmação do autor sobre o `ffprobe` (item 2 do pedido) — **CONFIRMADA**

Medi os dois lados, com os mesmos arquivos:

| Arquivo | `ffprobe -show_entries stream=width,height` | `ffmpeg -i … -frames:v 1 -f null -` |
|---|---|---|
| PNG válido 64×64 | exit **0** · `64,64` | exit **0** |
| PNG de 33 bytes (só IHDR) | exit **0** · `0,0` | exit **69** (`0 bytes left`) |
| PNG cortado em 20 bytes | exit **0** · `0,0` (stderr `chunk too big`) | exit **69** (`chunk too big`) |
| HTML com nome `.png` | exit **0** · `0,0` (stderr `Invalid PNG signature`) | exit **69** (`Invalid PNG signature`) |

**A afirmação está certa e a consequência é a que ele tirou:** o `ffprobe` devolve **exit 0** para os três
arquivos ruins (e ainda reporta `0,0`), então não serve para validar imagem; `ffmpeg -frames:v 1 -f null -`
devolve **69** nos três e 0 no bom. A escolha da camada 2 é a ferramenta certa.

## Verificação das inversões de asserção (item 1 do pedido)

Critério aplicado a cada uma: (a) comentada com o achado, o defeito medido e a data; (b) **mais estrita**
que a original — nunca mais frouxa; (c) a reprodução original preservada.

### Fase 1 — `qa-fase1-adversarial.test.ts` (4 inversões)

| # | Teste | Antes | Depois | Veredito |
|---|---|---|---|---|
| I1 | espaço INTERNO (l. 85) | 2 oficiais `['Bento', 'Ben to']` | 1 oficial `['Ben to']` **+ a anterior em `substituido`** | ✅ mais estrita (1 asserção a mais) |
| I2 | acento (l. 105) | 2 oficiais `['Bento', 'Bentó']` | 1 oficial `['Bentó']` **+ a anterior em `substituido`** | ✅ mais estrita |
| I3 | revisão única (l. 188) | reemissão `v2`, **duas** fichas `v2` | reemissão **`v3`**, uma `v2` **+ unicidade sobre todas as versões do nome** | ✅ mais estrita (2 asserções a mais) |
| I4 | duas ramificações (l. 227) | `['v2','v2']` | `['v2','v3']` | ✅ correção direta, mesma força |

### Fase 2 — `qa-fase2-adversarial.test.ts`, lote da primeira rodada (5 inversões)

| # | Teste | Antes (defeito) | Depois (garantia) | Veredito |
|---|---|---|---|---|
| I5 | achado 1 (l. 333) | arquivo ficava no disco e a 2ª chamada devolvia "sucesso grátis" | nada no destino **nem no `.parcial`**; a 2ª chamada **volta à rede** e falha de novo | ✅ mais estrita |
| I6 | achados 1 e 8 (l. 368) | truncado aceito com custo 0 | 1 requisição, **custo real**, resolução medida `1280x720`, arquivo > 20 bytes | ✅ mais estrita |
| I7 | achado 6 (l. 406) | `created=total`, `reused=0`, livro cresce | `created=0`, `reused=total`, livro igual **e custo real de volta ao manifesto** | ✅ mais estrita |
| I8 | achado 4 (l. 513) | terceiro simulado herdava o caminho do ffmpeg | **recusa** + controle de que o simulado canônico não mudou | ✅ mais estrita |
| I9 | achado 5 (l. 540) | plano fora do canal era aceito | `ChannelScopeError` **com classe e mensagem** + o lado oposto (dentro do canal vale) | ✅ mais estrita |

### Fase 2 — lote desta rodada (5 inversões, feitas pelo autor às 19:08)

| # | Teste | Antes (medido por mim às 18:45) | Depois | Veredito |
|---|---|---|---|---|
| I10 | N1, livro (l. 720) | 1 linha, custo 0,0035, ativo contado como reusado | **2 linhas**, custo `2 × 0,0035` **+ o ativo NÃO é reusado** | ✅ mais estrita (1 asserção a mais) |
| I11 | N2, sem ffmpeg (l. 786) | arquivo promovido como arte boa | recusa **sem ffmpeg** + nada no destino **nem no `.parcial`** | ✅ mais estrita |
| I12 | N3, camada 1 (l. 824) | quatro recusados pela camada **2** | quatro recusados pela camada **1**, com a mensagem dela | ✅ mais estrita (fixa a camada) |
| I13 | N4, interlace (l. 861) | aceito, virava o ativo | recusa `/interlace 7/` + nada no disco | ✅ mais estrita |
| I14 | N5, pixels (l. 876) | camada 2 | camada 1, com `/o IDAT descomprime para 4 bytes/` | ✅ mais estrita |

**Nenhuma das 14 inversões afrouxou asserção** — conferi uma por uma, e todas conservam a reprodução
original no comentário. Uma ressalva de processo: **I10–I14 foram invertidas pelo autor**, não por mim;
eu as revisei e as executei (19:09, 24/24). Elas ficam sujeitas ao mesmo critério de "quem produz não
aprova" — se o orquestrador quiser, o caminho é um terceiro agente reexecutar a suíte contra o hash
`AB3F4B80…` (o arquivo como está depois de 19:08:21).

## O que eu tentei refutar e **resistiu**

1. **A redação nova do ADR-015, no essencial.** Varredura de 12 passos alternando refino da ficha mais
   recente e da raiz já aposentada: **19 versões distintas**, nenhuma repetida. Linhagem com renomeação
   no meio (`Bento → Pip → Bento`): `v1, v2, v3` — a minha aposta de que a contagem reiniciaria pelo nome
   **não se sustentou**. O limite declarado ("entre identidades diferentes o número pode coincidir") é
   verdadeiro e está medido.
2. **A gravação validada em duas camadas.** Depois da correção: nenhum dos cinco arquivos malformados
   deixa rastro (nem destino, nem `.parcial`), e a recusa acontece na camada que não depende de binário.
3. **A idempotência pelo arquivo + livro.** Perdido só o `meta.json`: `created=0`, `reused=total`, livro
   sem linha nova, custo real reconstruído no manifesto — verde.
4. **O portão de fornecedor antes da rede**, inclusive para provedor injetado por `providers`, sem
   arquivo, sem linha e sem tocar o provedor.
5. **O achado 7** (`failed_count` como número **ou** string) — corrigido exatamente como o exemplo do
   OpenAPI exige.
6. **A chave de quatro campos do render** (`episódio, etapa, modelo, hash8`): `RENDER_MODEL.long/short/
   captions` são distintos (`render.ts:40-44`), então a colisão que o autor mediu (o `short` sumindo do
   livro) não volta.
7. **Os 19 testes da Fase 1 e os 24 da Fase 2** — todos verdes contra o estado de 19:08+.

## O que ficou **não verificado**

1. **Nenhuma chamada real à MiniMax** (sem chave, e eu não tentei obter nenhuma): preço cobrado, latência,
   tamanho e resolução realmente entregues para `16:9` seguem **NÃO VERIFICADOS na prática**. O que há é a
   documentação oficial (16:9 = 1280×720, US$ 0,0035/imagem) e dublê de `fetch`.
2. **Nenhuma imagem foi olhada** — a consistência de personagem (invariante nº 3) continua sem prova
   visual, e a arte do Character Sheet não existe.
3. **O adapter da OpenAI é o achado 1 em aberto e eu não o consertei** (nem devia): os dois testes que o
   documentam ficam **vermelhos de propósito** quando alguém corrigir o `openai.ts`.
4. **A correção de N1 não foi medida nas etapas pagas da Fase 3** (voz, música, animação): o `register`
   corrigido é compartilhado, então a expectativa é que valha para elas — mas nenhuma delas é paga hoje e
   eu não montei provedor pago de voz/música para medir. Fica declarado, não presumido.
5. **`characterSheet` continua fixo em `'ausente'`** (`manifest.ts:53`): a ficha canônica ainda não
   alimenta a geração de imagem, e o `negativePrompt` do storyboard continua sem campo em `ImageRequest`.
6. **Duas falhas de suíte por TEMPO sob carga** na rodada intermediária
   (`identidade-personagem.test.tsx` a 23,7 s contra teto de 20 s; `revisao.test.tsx`), ambas ausentes da
   rodada final (517/517) e quando os arquivos rodam isolados. Não são regressão das Fases 1/2 — mas o
   teto de 20 s segue apertado numa árvore com dois escritores rodando suíte ao mesmo tempo.

## Ambiente (registrado, não maquiado)

- O `vitest` não carrega no sandbox confinado (o Vite chama `exec("net use")` e o pipe é negado). Usei o
  mesmo contorno já declarado nas evidências dos autores, fora do repositório:
  `NODE_OPTIONS='--require ./node_modules/.cache/dsh-vitest-sandbox-shim.cjs'`. Nada versionado mudou.
- **Dois escritores na mesma árvore, em tempo real:** enquanto eu media, o autor gravou
  `simulated-episode.ts` (18:57:53), `minimax.ts` (18:58:30) e o meu arquivo de teste (19:08:21). Duas
  consequências declaradas: (a) os achados N1–N5 foram medidos contra o **estado anterior** e só fazem
  sentido com essa data; (b) a rodada completa da suíte (18:55:35–19:05:59) começou antes da correção das
  18:58, então ela é, no máximo, uma foto do estado intermediário.
- `.rebeca/custos.csv` ganhou **13 linhas** `openai / gpt-6.1-sol` às 18:28 (etapa `criar`, conteúdo
  `luna-frutas`, ~US$ 0,18 no total) de **outra frente** — nenhuma delas é das Fases 1/2, e o livro
  continua com **0** linhas `minimax`. Registro porque o livro é a memória de gasto do projeto.

## Testes que esta revisão deixa

| Arquivo | Testes | Estado |
|---|---|---|
| `src/data/__tests__/qa-fase1-adversarial.test.ts` | 19 | ✅ verde — inclui 4 testes novos sobre a redação do ADR-015 (2 confirmam, 1 refuta a leitura literal, 1 confirma o caso da linhagem) |
| `src/media/__tests__/qa-fase2-adversarial.test.ts` | 24 | ✅ verde — 2 deles (`REFUTADO (NOVO, ALTA)`, adapter da OpenAI) **documentam defeito em aberto** e ficarão vermelhos quando ele for corrigido |
| `src/media/__tests__/qa-fase2-sonda.test.ts` | — | **removido**: era instrumento de medição descartável (sonda com `console.log`), substituído pelos testes acima |

## Próximo

1. **`rebeca-ia-video`**: corrigir `server/media/providers/openai.ts` (achados 1a e 1b) — validar antes de
   promover (parcial + `rename`, como já foi feito na MiniMax) e trocar `existsSync` por uma checagem que
   **abra** o arquivo; e então inverter os dois testes que documentam o defeito.
2. **`rebeca-arquiteto`**: ajustar duas frases do ADR-015 (achados 2 e 3) — `sheetVersion` único **por
   nome** (a linhagem estende), e a chave de auditoria como **o que ela ainda será**, não como o que o
   artefato registra hoje.
3. **`rebeca-orquestrador`**: registrar em `.rebeca/estado.md` (arquivo que esta revisão não pode editar)
   o desfecho desta rodada, inclusive a colisão de escrita de 18:57–19:08.
4. **Humano**: nada aqui autoriza publicar nem gastar — a chave da MiniMax continua ausente e a arte do
   Character Sheet continua inexistente.
