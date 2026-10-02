# Fase 2 — As imagens: da cena escrita ao arquivo no disco

Origem: `ideabeba.pdf` (`.rebeca/fontes/ideabeba-extraido.txt`), item **"3. Criar"** — a lista inclui
*"imagens"* e *"animações"*. Decisão do dono em 2026-10-02: seguir para esta fase depois da Fase 1.

## O que o PDF pede

> *"Depois disso, a plataforma produz o conteúdo. Dependendo do canal, isso pode incluir: ideia; roteiro;
> personagens; **cenas; imagens; animações**; voz; música; edição; vídeo final; verso Short; thumbnail;
> título; descrição; SEO; metadata. Tudo deve acontecer dentro da mesma plataforma."*

## O que já existe (não refaça)

| Peça | Onde |
|---|---|
| Adapter real MiniMax, com o cliente HTTP e o preço já lidos | `server/media/providers/minimax.ts` — hoje só implementa **thumbnail** (`plan` + `generate`) |
| Interface `ImageProvider` (`id`, `model`, `simulated`, `render(ImageRequest)`) | `src/media/contract.ts` |
| Provedor de imagem **simulado** (ffmpeg) | `server/media/providers/simulated.ts` |
| Pipeline que já renderiza uma imagem por cena | `server/media/simulated-episode.ts` — `planImage` / `providers.image.render` |
| Custo real por ativo no livro | `server/media/ledger.ts` — `recordAssetCost` |
| Allow-list **liberada nesta sessão** | `.rebeca/canais/luna/allow-list.json` → `minimax / image-01 / imagem` = PERMITIDO |

## O portão já não bloqueia — verificado

O `ADR-013` chaveia a allow-list por `(fornecedor, modelo, finalidade)`. Antes desta sessão, a única
finalidade `imagem` aprovada no canal era o **ffmpeg simulado**, e a Fase 2 inteira seria recusada. A
entrada foi autorizada pelo dono e adicionada em 2026-10-02 com o mesmo fundamento já lido para
`thumbnail`. **Não é preciso mexer nisso de novo.**

## A lacuna maior não é o provedor — é o vínculo que não existe

`runSimulatedEpisode` roda sobre um `EpisodeSpec` com cenas **fixas em código** (`EPISODIO_SINTETICO`).
A Fase 1 gravou o storyboard em `ContentItem.storyboard.cenas`, com `promptImagem`, `negativePrompt` e
`seed` — **que é exatamente o que a etapa de imagem consome.**

Hoje esses dois mundos não se falam. O trabalho desta fase é:

1. **Um `ImageProvider` real** (MiniMax `image-01`) atrás da mesma interface, ao lado do simulado —
   trocado por configuração, nunca por `if` no pipeline (invariante nº 7).
2. **O caminho do storyboard até a imagem**: `ContentItem.storyboard.cenas` → `EpisodeSpec.scenes`
   → `ImageRequest` por cena. Sem inventar vínculo: o conteúdo e o episódio se ligam por
   `episodeId` declarado (o campo já existe, hoje ausente em todo dado de exemplo, e isso é a verdade).
3. **Idempotência antes de gastar**: o hash da cena (prompt + seed + modelo + promptVersion) já é o nome
   do arquivo. Cena que já existe no manifesto **não** é gerada de novo — é o que faz reexecutar não
   custar nada.
4. **O rótulo de deep synthesis** que o `ADR-005` exige quando o provedor é MiniMax.
5. **A tela**: as cenas geradas aparecerem onde o humano decide, com custo real e o aviso de que a arte
   é de provedor (não simulada) ou simulada.

## Decisões de desenho (amarradas aos invariantes)

1. **O portão vem antes de gerar** — a ordem do `ADR-010`/`ADR-013`: allow-list → idempotência → teto →
   gerar → livro → manifesto.
2. **Nada de vídeo nesta fase.** "Animações" é a Fase 3. Não misture.
3. **Custo por imagem em `.rebeca/custos.csv`** com provedor, modelo e quantidade (US$ 0,0035 por
   imagem, preço já lido — mas **confirme no link antes de fixar número**, preço muda).
4. **Sem chave configurada, cai no simulado e a tela diz isso.** Nunca apresentar ffmpeg como arte.
5. **Tudo escopado por canal** no caminho do arquivo (invariante nº 2).
6. **A interface não mostra fornecedor nem modelo** (`docs/04` §5).

## Restrições de ambiente — a árvore tem dois escritores (D9)

- **NUNCA use `git add -A` nem `git add .`.** Um `add` largo de outra sessão já publicou código quebrado
  em produção em 2026-10-02.
- **Não toque em**: `vercel.json`, `server/auth/**`, `src/auth/**`, `server/media/http.ts`,
  `src/media/**`, `.rebeca/estado.md`, `src/features/identidade/**` (Fase 1, em andamento).
- Pode tocar em: `server/media/providers/minimax.ts`, `server/media/simulated-episode.ts`,
  `server/media/thumbnail-art.ts` (se fizer sentido reusar), testes em `src/media/__tests__/**`,
  `src/features/revisao/**`.
- **Não rode a Fase 2 enquanto a Fase 1 estiver ativa**: as duas mexem em `src/data/**` e o risco de
  colisão é o defeito que já custou um deploy quebrado.

## Critério de aceite

1. Uma cena de storyboard (com `promptImagem` e `seed`) vira um **PNG de verdade** na pasta do canal.
2. Roda **duas vezes** e a segunda **não gera arquivo novo nem linha nova** de custo.
3. Com a chave ausente, cai no simulado e a tela **diz** que é simulado.
4. O custo real aparece no livro **e** na tela.
5. Fornecedor fora da allow-list é recusado **antes** de qualquer chamada de rede.

## Evidência obrigatória antes de dizer "pronto"

- `pnpm exec tsc --noEmit` → exit 0.
- Teste de idempotência: duas execuções, mesma contagem de arquivos e de linhas no livro.
- **Uma geração real** (com a chave) medida: arquivo, bytes, tempo e custo lançado.
- **Prova adversarial por mutação**: desfaça o portão da allow-list e mostre o teste vermelho; restaure e
  confirme por sha256.
- Saída em `.rebeca/evidencias/fase-2-imagens.txt`.

## Handoff

Formato "Contrato de entrega" de `docs/01-orquestra-de-agentes.md`.
**Não commite** — a árvore tem outros escritores.
