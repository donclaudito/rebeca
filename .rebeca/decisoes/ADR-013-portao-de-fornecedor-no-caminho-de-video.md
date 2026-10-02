# ADR-013 — Portão de fornecedor no caminho de vídeo, e a recusa do Gemini Omni no canal infantil

## Status
**Decidido pelo dono do produto em 2026-10-01.** Ele trouxe o pedido de usar o **Gemini Omni 1.1 Flash**
(geração de vídeo) no canal infantil; depois de ler a apuração, escolheu **"fechar o furo"** entre quatro
opções apresentadas. Implementado e verificado tecnicamente nesta sessão.
**Revisão adversarial do `rebeca-qa` pendente** — quem produz não aprova.

## Data
2026-10-01

## Contexto

### 1. O pedido, e o que ele esbarrou

O dono pediu para usar o **Gemini Omni 1.1 Flash** ("Omni 1.1") como motor de vídeo, porque o Google o
está oferecendo gratuitamente. Ele também esclareceu o objetivo do produto: vídeos de desenho animado 2D
e 3D cujo objetivo declarado era **não provocar censura** da plataforma.

Duas coisas foram verificadas antes de qualquer código:

| Fato | O que foi conferido | Fonte |
|---|---|---|
| O modelo existe | `gemini-omni-1.1-flash` — texto→vídeo com áudio nativo, entrada multimodal, edição conversacional via Interactions API | [ai.google.dev/gemini-api/docs/omni](https://ai.google.dev/gemini-api/docs/omni) |
| **Está vedado no canal infantil** | Cláusula literal em *Age Requirements*: *"You also will not use the Services as part of a website, application, or other service … that is **directed towards or is likely to be accessed by individuals under the age of 18**"*. Relida na página oficial em 2026-10-01; a página traz `last updated 2026-04-28` | [ai.google.dev/gemini-api/terms](https://ai.google.dev/gemini-api/terms) |
| E o tier grátis **piora** | Em *serviços não pagos*, o Google usa o conteúdo enviado e todas as respostas para melhorar seus produtos, **revisores humanos podem ler e anotar** entrada e saída, e os próprios termos instruem a não enviar informação sensível ou pessoal | idem |

Isso **não** era novidade de política: a allow-list do canal, aprovada pelo próprio dono em 2026-10-01,
já trazia `google / * / * → PROIBIDO` com essa cláusula como fundamento, e a **D11** já registrava o
Google como vedado para o canal infantil. O pedido, portanto, não era uma lacuna de política — era um
teste de se a política estava **ligada**.

### 2. A premissa invertida (correção factual, com fonte)

O pedido partia de que "parecer real" reduz censura. É o contrário:

- Desde maio/2026 o YouTube joga o rótulo de IA **para cima do player** quando o conteúdo é
  **fotorrealista ou significativamente alterado por IA**; para conteúdo **animado/irreal**, a
  divulgação fica na descrição expandida. Animação é o caminho de menor atrito, não o fotorrealismo.
  ([blog.youtube](https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/))
- O YouTube passou a **detectar IA automaticamente** e aplica o rótulo sozinho; a divulgação é
  **permanente** para conteúdo gerado por ferramentas próprias (Veo/Dream Screen).
- Há pressão ativa para **banir conteúdo "Made for Kids" gerado por IA** (carta de Fairplay, AFT, MAMA e
  Jonathan Haidt a Pichai e Mohan, abril/2026). ([Mashable](https://me.mashable.com/tech/69197/youtube-ai-slop-is-a-generational-threat-child-safety-experts-warn-in-new-petition))

O dono escolheu, na mesma conversa, **personagem estilizado 2D/3D 100% fictício** — que é a opção de menor
risco de política e de rótulo. Ficou também registrado o limite que não se negocia: **nenhuma imagem,
semelhança ou voz de criança real identificável**, e nenhum conteúdo desenhado para escapar de detecção.

### 3. O furo real que a apuração encontrou

O pedido do dono não podia ser atendido — mas a resposta honesta não é só "não". A allow-list existia
desde o `ADR-012` e **protegia uma única rota: a de thumbnail**. O caminho de vídeo, que é **~96% do custo
de um episódio**, atravessava **sem consulta nenhuma**. O próprio `.rebeca/estado.md` já registrava isso:

> *"E o portão da allow-list ainda **não** está no caminho de vídeo (`runSimulatedEpisode`): ele protege a
> rota que gasta dinheiro hoje."*

Traduzindo: trocar o provedor de vídeo por um fornecedor `PROIBIDO` ou `NAO-VERIFICADO` **geraria
normalmente**, com dinheiro real. A política valia para a etapa barata e não valia para a cara.

**Causa-raiz:** as quatro interfaces de mídia (`ImageProvider`, `VideoProvider`, `TtsProvider`,
`MusicProvider`) declaravam `id` e `simulated`, mas **não declaravam `model`** — e a allow-list é chaveada
por `(fornecedor, modelo, finalidade)`. Sem o modelo, o pipeline **não tinha como perguntar**. Só
`ThumbnailProvider` declarava `model`, e é exatamente por isso que só o caminho de thumbnail tinha portão.

## Decisão

**1. O Gemini Omni permanece bloqueado no canal infantil.** Não por preferência de agente: a allow-list
que o dono aprovou o veda, e a cláusula foi reconfirmada na fonte oficial nesta sessão. Reabrir isso é a
**D11** com leitura jurídica, não uma troca de configuração.

**2. `model` passa a ser declarado pelas quatro interfaces de mídia**, via um `ProviderIdentity` comum:

```ts
export interface ProviderIdentity {
  readonly id: string;
  readonly model: string;
}
export interface VideoProvider extends ProviderIdentity { … }
```

O `GeneratedAsset` já trazia `model`, mas **depois** de gerar — consultar a allow-list com ele chegaria
tarde, com o dinheiro gasto. O modelo tem de ser conhecido **antes** da chamada.

**3. O portão roda no topo de `runSimulatedEpisode`**, com a `finalidade` igual ao nome da etapa
(`imagem`, `animacao`, `voz`, `musica`), uma chamada por provedor. Ele vem **antes de
`assertFfmpegAvailable()` e antes dos portões de gasto**.

A ordem é decisão, não acaso: o `ADR-005` diz literalmente que a allow-list existe para **"impedir o preço
de justificar o fornecedor"**. Invertida a ordem, um provedor barato seria comparado com o teto antes de
alguém perguntar se ele pode operar naquele canal.

**4. O portão roda mesmo quando tudo seria reusado.** A checagem é de política, não de gasto, e a
reexecução é o caminho mais comum do pipeline — um portão que se desliga quando o cache acerta some
justamente aí.

## Alternativas descartadas

| Alternativa | Por que caiu |
|---|---|
| Usar o Omni mesmo assim | Viola cláusula contratual literal. A D11 continua aberta: sem leitura jurídica, não há como afirmar o contrário, e "não verificado" nunca autoriza neste projeto |
| Manter o portão só onde ele já estava | Deixa a etapa de ~96% do custo sem política. O furo continuaria existindo, só menos visível |
| Colocar o portão **depois** do portão de gasto | Contradiz o `ADR-005`: deixaria o preço ser comparado antes de a permissão ser perguntada |
| Pular o portão quando tudo seria reusado | O caminho mais comum do pipeline é a reexecução; o portão sumiria onde mais roda |
| Deduzir o `model` do `GeneratedAsset` | Chega depois da geração — o gasto já aconteceu |
| Liberar tudo que se declare `simulated: true` | Mesmo furo que o `rebeca-qa` achou no `ADR-010`: bastaria um provedor real mentir no campo |
| Renomear a finalidade `video` da MiniMax para `animacao` por conta própria | É arquivo **aprovado por humano**. Corrigir dado de política silenciosamente é pior que recusar |

## Consequências

**1. Achado que a implementação expôs — e que precisa de decisão humana.** A allow-list grava a entrada de
vídeo real como `minimax / MiniMax-H3-768P / finalidade **video**`, enquanto a etapa do pipeline se chama
**`animacao`**. Como o casamento de `finalidade` é exato, **trocar o provedor de vídeo para a Stack A
aprovada hoje é recusado**. Isso é o default conservador funcionando (recusar > permitir), mas é um
bloqueio que alguém precisa resolver: renomear a entrada, ou acrescentar a finalidade `animacao` à mesma
aprovação. **Não foi feito aqui de propósito** — é dado aprovado por humano.

**2. O portão protege a CLI, não uma rota HTTP.** Não existe rota que rode o episódio: o caminho de vídeo
só é alcançável por `.tools/render-episodio.mjs`. Quando a F1 expuser isso por HTTP, o portão já estará no
lugar certo — mas **hoje ninguém pode disparar uma geração de vídeo pela interface**, e isso continua
sendo a D1 (job longo fora do request).

**3. A suíte ficou hermética.** `media-render.test.ts` passou a escrever a própria allow-list em
`REBECA_ROOT` temporário. Antes disso, com o portão novo, o teste passaria a ler o arquivo de **produção** —
e ficaria vermelho no dia em que alguém editasse o dado real. Teste que mede o ambiente em vez do produto
não protege nada.

**4. Um teste existente mudou de motivo, e isso foi explicitado.** O teste "recusa gerar com provedor PAGO
e sem estimativa" usava um provedor falso que **não estava** na allow-list; com o portão novo ele seria
recusado por política, e o teste ficaria verde **pelo motivo errado**. O provedor falso passou a ser
`PERMITIDO` de propósito, com o comentário dizendo por quê.

## Verificação (comando + resultado observado)

Ambiente: Node v26.7.0 · pnpm 11.25.0 · Windows · ffmpeg 8.1.2.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro |
| Testes do caminho de vídeo | `pnpm exec vitest run src/media/__tests__/media-render.test.ts --reporter=verbose` | ✅ **6/6** (eram 3) — `.rebeca/evidencias/portao-fornecedor-video.txt` |
| Suíte completa | `pnpm exec vitest run` | ✅ **273/273 em 26 arquivos**, exit 0 — `.rebeca/evidencias/vitest-portao-fornecedor.txt` |
| Build de produção | `pnpm run build` | ✅ exit 0 — 1982 módulos · css 38,71 kB · js 505,50 kB — `.rebeca/evidencias/build-portao-fornecedor.txt` |
| **CLI real, com a allow-list de produção** | `node .tools/render-episodio.mjs` | ✅ passou o portão · 13 ativos reusados, **0 gerados** · longo 1920×1080@30, Short 1080×1920 — `.rebeca/evidencias/portao-fornecedor-cli.txt` |
| **Prova adversarial por mutação** | remover o bloco `for (…) assertProviderAllowed(…)` e rodar os testes novos | ✅ **3 vermelhos, os 3 certos** · restaurado **byte a byte** (sha256 `CC508C94…` antes e depois) — `.rebeca/evidencias/portao-fornecedor-mutacao.txt` |

Os três vermelhos da mutação, cada um pelo motivo certo:

1. **Google `PROIBIDO`** → `expected null to be an instance of ProviderNotAllowedError` — sem o portão, o
   episódio **gerou** com o fornecedor vedado.
2. **Canal sem allow-list** → não lançou: "não configurado" virou "liberado".
3. **Cache quente** → `promise resolved … instead of rejecting` — a reexecução passou como passe livre.

O CLI real é a verificação que a suíte **não** dá: os testes usam allow-list própria, então um erro de
digitação no arquivo de produção passaria despercebido. Foi ele que provou que a allow-list real casa com
os provedores reais.

## Não verificado (declarado, não maquiado)

1. **Revisão adversarial do `rebeca-qa` não foi executada** sobre esta entrega.
2. **O bloqueio do Google não foi lido por advogado.** A cláusula é literal e foi conferida na fonte, mas
   é interpretação contratual — a D11 continua aberta e é dela que depende qualquer reabertura.
3. **Nenhum provedor pago real foi exercitado.** O portão foi provado com provedores simulados e com um
   provedor falso injetado; nenhuma chave da MiniMax existe nesta máquina.
4. **A reconciliação `video` × `animacao`** na allow-list é decisão humana pendente (Consequência 1).
5. **Não existe rota HTTP que rode o episódio**, então o portão não foi exercitado por requisição — só
   pela CLI e pela suíte.
6. **Duas sessões na mesma árvore (D9):** `server/media/paths.ts` aparece modificado no `git status` e
   **não foi tocado por esta entrega**; `server/media/allow-list.ts`, `thumbnails.ts`, `minimax.ts`,
   `http.ts`, `library.ts`, `vite-plugin.ts` e vários testes de mídia seguem **não commitados** de sessões
   anteriores. Nada foi commitado por esta entrega.
