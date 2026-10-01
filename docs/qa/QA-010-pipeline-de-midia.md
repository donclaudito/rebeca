# QA-010 — Revisão adversarial do pipeline de mídia (Fase 0)

**Alvo:** `src/media/**`, `server/media/**`, `.tools/render-episodio.mjs`, `.rebeca/canais/luna/spec-midia.json`
— commit `818c393` (arquivos de mídia idênticos até `f25e1a3`, quando a revisão terminou).
**Revisor:** `rebeca-qa`. **Data:** 2026-10-01.

**Veredito: REFUTADO (parcial).** A máquina, os formatos, a timeline, o determinismo, o isolamento de
canal e a medição de custo por `ffprobe` estão provados com evidência reproduzida — **aprovados como base
da Fase 1**. O que caiu foi o **teto de gasto**: dois achados de gravidade alta mostram que a garantia
escrita ("portões que PARAM o pipeline") cobria só o nível unitário, não o caminho real.

> Revisão adversarial é isto: quem produz não aprova. Os dois achados abaixo são a razão pela qual a
> Fase 1 (provedor pago) **não podia** começar com o código como estava.

## Achados

| # | Gravidade | O que estava errado | Reprodução do QA | O que ficou |
|---|---|---|---|---|
| 1 | **ALTA** | Célula **vazia** de `custo_usd` era pulada (`continue`), contra o contrato escrito no próprio módulo: "não verificado" entrava na conta como "não gastou" | 59,00 pagos + 59,00 não verificados → `monthlySpendUsd` = 59 → limite mensal **passou**; linha truncada também passou | `costFromCell()` **lança** `MediaBudgetError('custo-invalido')` para célula vazia. O teste do autor (que afirmava 1,0 com o nome dizendo "NÃO soma zero") foi **reescrito** para exigir a recusa |
| 2 | **ALTA** | Portão pré-gasto dependia de `estimateUsd` opcional com default `0` (`simulated-episode.ts:143,300,303`): sem estimativa, o portão comparava **zero** com o teto e o pipeline gerava antes de qualquer bloqueio | Com provedor de US$ 50/ativo e sem estimativa: **21 arquivos, 7 linhas, US$ 200** lançados, e só então `teto-por-minuto` | Provedor passa a **declarar** `simulated: boolean` no contrato; com provedor pago e estimativa ≤ 0 o pipeline lança `estimativa-obrigatoria` **antes de escrever qualquer arquivo**. Teste **no nível do pipeline** criado em `media-render.test.ts` |
| 3 | MÉDIA | `parseFloat` aceitava negativo e separador pt-BR: `-119,00` somado com positivo **mascarava** gasto; `59,5` e `1.234,56` subcontavam em silêncio | `-119.00 + 119.00 → 0 → PASSOU`; `"1.234,56" → 1.234` | Validação por **número puro** (`/^\d+(\.\d+)?([eE]-?\d+)?$/`): sinal, vírgula decimal e separador de milhar **lançam** |
| 4 | MÉDIA | Idempotência dependia do `meta.json` como fonte única: perdido o manifesto com os ativos no disco, o pipeline **re-registrava custo** sem regerar (em Fase 1, duplica linha paga) | `created=7, linhas=7` → apaga só `meta.json` → `created=7, linhas=14`, mesmos 21 arquivos | **Registrado como pendência da Fase 1** (não corrigido nesta rodada): consultar o livro pelo `hash8` (já gravado em `prompt_id`) antes de gerar. Sem provedor pago o dano é linha de custo 0; com provedor pago é dinheiro |
| 5 | BAIXA | `renderPath` aceitava nome sem extensão e devolvia caminho terminando em ponto (`.../v1/sem-extensao.`) | leitura do código (`paths.ts:154-166`) | Passa a validar a extensão com a **mesma regra** do `assetPath`; nome sem extensão lança |
| 6 | BAIXA | Evidência citada inexistente: `ffmpeg.ts` apontava `.rebeca/evidencias/f0-ffmpeg-sem-pipe.txt` | `Test-Path` → falso | Citação removida; o comentário passa a declarar o fato **sem** apontar arquivo que não existe |
| 7 | BAIXA | `CHARS_PER_SECOND = 14.5` sem procedência declarada, usado no TTS simulado e na estimativa do portão | leitura do código | Comentário declara que é **premissa nossa**, não fato de provedor, e que não entra no caminho pago |
| 8 | BAIXA | `ADR-010` se contradizia (D2 "aprovada" no topo × "aguardando aprovação humana" no corpo) | leitura | Texto corrigido; status do ADR atualizado para refletir Fase 0 entregue e achados tratados |

## O que o QA verificou e **passou** (comando + resultado)

- **Idempotência real**: ativos apagados → rodada 1 `gerados 13 · reusados 0` (livro 100 → 113 linhas);
  rodada 2 `gerados 0 · reusados 13` (113 → 113). Hashes idênticos nas duas rodadas.
- **Formatos**: `ffprobe -select_streams v:0 -show_entries stream=width,height,r_frame_rate` → longo
  `1920,1080,30/1` e Short `1080,1920,30/1`; ambos `27.033333 s`, 811 quadros. `.srt` com último bloco
  terminando exatamente em `27,033` — nenhum bloco depois do fim.
- **Loudness**: `loudnorm=print_format=summary` → `Input Integrated: -14.0 LUFS`.
- **Isolamento de canal**: `episodeDir/assetPath/renderDir/workPath/manifestPath` com dono ≠ escopo →
  `ChannelScopeError` em 5/5; `..`, `a/b`, `a\b`, `C:`, `Luna`, `""`, `-luna`, `NUL` → `segmento-invalido`.
- **Git**: `git check-ignore -v` → `.gitignore:45:.rebeca/assets/`; nenhum artefato gerado entra no repo.
- **Custo medido do arquivo**: `simulated-episode.ts:658-661` usa `probeMedia(render.long.path)`, não
  `tempo_min`.
- **Nada inventado**: `LOUDNESS_TARGET.verified=false`, spec com 5 itens em `naoVerificado`, CLI imprime
  "alvo DECLARADO e NÃO VERIFICADO".
- **Tipos e suíte**: `tsc --noEmit` exit 0; suíte completa 22 arquivos / **210/210** (na ocasião).

## O que a Fase 1 ainda exige (nada disso está pronto)

Adapter real atrás das mesmas interfaces (MiniMax/Luma), **rodapé de rótulo *deep synthesis*** (0
ocorrências no código), **Character Sheet** (`characterSheet: ausente`, referência sintética), job longo
fora do request HTTP com cancelamento (**D1**), seleção do trecho de gancho do Short (hoje é o episódio
inteiro quando ele é curto), allow-list de provedor por canal na camada de mídia e upscale 768P→1080p.

## Observação de ambiente (registrada, não maquiada)

Durante a revisão **outro agente gravou e commitou na mesma árvore** (HEAD foi de `818c393` para
`f25e1a3`; `index.html`, `headers.test.ts` e `README.md` são trabalho alheio — ADR-011). Os arquivos de
mídia estão idênticos entre os dois commits, então a verificação vale. É a decisão **D9** cobrando o
preço outra vez: numeração, estado e revisão não aceitam dois escritores simultâneos.
