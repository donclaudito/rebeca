# Fase 3 — O vídeo: a ÚNICA fase que gasta dinheiro de verdade

Origem: `ideabeba.pdf` (`.rebeca/fontes/ideabeba-extraido.txt`), item **"3. Criar"** — *"animações"*,
*"edição"*, *"vídeo final"*, *"verso Short"*.

## Estado: **bloqueada**. Não comece.

Ao contrário das fases 1 e 2, esta **não** pode ser executada por um agente sozinho. Ela tem três
portões, e nenhum é técnico.

| # | Portão | Quem abre |
|---|---|---|
| 1 | Allow-list: `video` × `animacao` | **dono do produto** — mesma classe de reconciliação que a Fase 2 precisou e que foi autorizada em 2026-10-02 só para `image-01 / imagem` |
| 2 | **D1 — onde roda o job longo** | **dono do produto** — decisão de arquitetura aberta desde o 504 que ele viu |
| 3 | Autorização de gasto | **dono do produto** — ~US$ 39 por episódio contra teto de **US$ 60/mês** |

## Portão 1 — a segunda reconciliação da allow-list

```
minimax / MiniMax-H3-768P / video  -> PERMITIDO
```

A entrada existe, com termo lido em 2026-10-01. **Mas a etapa do pipeline se chama `animacao`**, e o
portão do `ADR-013` (`assertProviderAllowed`, chamado em `runSimulatedEpisode` com
`purpose = 'animacao'`) casa `finalidade` por **igualdade exata**.

Resultado medido: trocar o provedor de vídeo para o aprovado **é recusado** com `fornecedor-nao-lista`.

Duas saídas, e a escolha é do dono:
- acrescentar `animacao` à mesma aprovação (preserva o registro do que foi aprovado), ou
- renomear `video` → `animacao` (mexe no registro de um humano — exige justificativa escrita).

**A primeira é a recomendada**, pelo mesmo motivo que a Fase 2 usou: estende uma aprovação existente do
mesmo fornecedor e do mesmo modelo, sem apagar o rastro.

## Portão 2 — D1: gerar vídeo não é uma requisição HTTP

Já medido nesta sessão, em dois lugares diferentes:

- `criar-roteiro` estourou o teto de **90 s** (`AI_LIMITS.requestTimeoutMs`) e devolveu **504**;
- o dono já viu **504** em produção antes disso.

Um episódio de 8 min tem dezenas de cenas e leva **minutos**, não segundos. Enquanto não existir fila com
worker, progresso e retomada, ligar o provedor de vídeo só troca um erro por outro pior — gasto sem
resultado na tela, que é o defeito que o próprio `estado.md` registra.

A escolha de **onde** isso roda (serviço Node separado vs. fila gerenciada vs. Supabase Edge + cron) é a
D1, e ela nunca foi fechada.

## Portão 3 — o dinheiro

| | |
|---|---|
| MiniMax-H3 768P | **US$ 0,08/s** (preço lido em 2026-10-01 — **reconfirmar antes de fixar**) |
| Episódio de 8 min | ≈ **US$ 39** |
| Teto mensal aprovado (D5) | **US$ 60** |
| Consequência | **um episódio por mês** |

O PDF fala em *"menor custo operacional possível"* sem citar número. O número é o que decide. Um lote de
teste de 30 s custa ~US$ 2,40 e já prova o adapter.

## O que já existe

| Peça | Onde |
|---|---|
| Allow-list do provedor de vídeo | `.rebeca/canais/luna/allow-list.json` (entrada `video`, ver Portão 1) |
| Interface `VideoProvider` (`animate(VideoRequest)`) | `src/media/contract.ts` |
| Provedor de vídeo **simulado** (ffmpeg zoompan) | `server/media/providers/simulated.ts` |
| O clipe por cena já é resolvido no pipeline | `server/media/simulated-episode.ts` — `planClip` / `providers.video.animate` |
| Short como recorte do mesmo material | `server/media/render.ts` |
| Teto por minuto e mensal **em código** | `src/media/limits.ts` |
| Rótulo de deep synthesis **exigido pelo `ADR-005`** | ainda **não implementado** — é requisito desta fase |

## O que falta

1. **Adapter real** `VideoProvider` (MiniMax-H3-768P) atrás da mesma interface, trocável por configuração.
2. **A fila** (D1) — sem ela, nada.
3. **O vínculo storyboard → episódio**, deixado fora da Fase 2 de propósito. `EPISODIO_SINTETICO` tem
   cenas fixas em código; o conteúdo tem `storyboard.cenas`. Ligar os dois é declarar linhagem, não
   inferir (o `episodeId` já existe como campo declarado).
4. **O rótulo de deep synthesis** no conteúdo gerado (condição do `ADR-005`).
5. **Upscale 768P → 1080p** e conformação de fps no render.
6. **Seleção do trecho de gancho** para o Short — hoje o Short é o episódio inteiro quando ele é curto.
7. **Consistência provada**: comparar as cenas com o Character Sheet antes de aceitar. Depende da arte
   canônica, que continua dívida do `rebeca-branding` — a Fase 1 entrega a **ficha**, não a **arte**.

## Restrições de ambiente (D9)

- **NUNCA `git add -A` nem `git add .`.** Não commite.
- Não tocar em `vercel.json`, `server/auth/**`, `src/auth/**`, `server/media/http.ts`, `src/media/**`,
  `.rebeca/estado.md`, `src/features/identidade/**`, `.rebeca/canais/**` (dado aprovado por humano).
- **Não iniciar enquanto as Fases 1 e 2 estiverem ativas** — as três compartilham `server/media/**`.

## Critério de aceite

1. Uma cena do storyboard vira um **clipe de vídeo de verdade**, com duração medida por `ffprobe`.
2. **Idempotência**: rodar duas vezes não gera arquivo nem linha de custo.
3. **Teto respeitado**: o pipeline **para** antes de estourar o por minuto e o mensal, e grava o teto e o
   aprovador no manifesto.
4. **Rótulo de deep synthesis** presente no conteúdo gerado.
5. Fornecedor fora da allow-list recusado **antes** de qualquer chamada de rede.
6. Custo real por ativo no livro, e custo por minuto calculado com a duração do **arquivo renderizado**
   (`ffprobe`), nunca com `tempo_min`.

## Evidência obrigatória

- `tsc` exit 0; teste de idempotência (duas execuções, contagens iguais).
- **Uma geração real medida**: arquivo, duração por `ffprobe`, tempo de parede e custo lançado.
- Prova adversarial por mutação (portão desfeito → teste vermelho → restaurado por sha256).
- Saída em `.rebeca/evidencias/fase-3-video.txt`.
