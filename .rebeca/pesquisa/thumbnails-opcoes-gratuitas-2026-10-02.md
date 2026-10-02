# Thumbnails: opções gratuitas e mais baratas (pesquisa verificada — 2026-10-02)

**Por que existe:** o dono do produto **não conseguiu obter a chave da MiniMax** (provedor aprovado no
`ADR-005`) e pediu a alternativa gratuita ou a mais barata. Esta é a verificação, com fonte primária e
trecho literal. Onde não deu para ler, está `NÃO VERIFICADO` — nada foi estimado como se fosse preço.

**Regra que continua valendo:** a `allow-list` do canal (`.rebeca/canais/luna/allow-list.json`) recusa
provedor `NÃO-VERIFICADO` e exige que provedor real esteja listado **por nome**, com termo lido. Trocar
de fornecedor não é trocar uma linha.

## O veredito curto

| | |
|---|---|
| **Única gratuita que atende sem violar termo** | **Cloudflare Workers AI** — 10.000 Neurons/dia grátis |
| **Mais barata paga com 16:9 nativo** | **fal.ai `fal-ai/flux/schnell`** — US$ 0,003/MP ≈ **US$ 0,00276** em 1280×720 (~21% mais barato que a MiniMax, US$ 0,0035) |
| **Melhor caminho agora, custo zero** | **composição local** (`server/media/thumbnail-art.ts`) — sem chave, sem cadastro, sem contrato |

## Cloudflare Workers AI — a única gratuita viável

- **Camada gratuita:** *"Our free allocation allows anyone to use a total of 10,000 Neurons per day at
  no charge."* e *"priced at $0.011 per 1,000 Neurons"* — <https://developers.cloudflare.com/workers-ai/platform/pricing/>
- **Imagem:** `@cf/black-forest-labs/flux-1-schnell` — **US$ 0,0000528 por tile 512×512 + US$ 0,0001056
  por step** (mesma página). Pesos do FLUX.1 [schnell] = **Apache-2.0** (uso comercial explícito).
- **Endpoint/auth:** `POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/<modelo>`
  com `Authorization: Bearer {API_TOKEN}` — <https://developers.cloudflare.com/workers-ai/get-started/rest-api/>
- **Dono do conteúdo:** *"You own, and are responsible for, all of your Customer Content."* —
  <https://developers.cloudflare.com/workers-ai/platform/data-usage/>
- **Ressalva técnica que decide o desenho:** o `flux-1-schnell` **não aceita largura/altura** (schema
  oficial só tem `prompt` e `steps`). Quem aceita é `@cf/leonardo/phoenix-1.0` (default 1024, máx 2048),
  mas custa ordens de grandeza mais por imagem.
  **Consequência:** o 16:9 exato sai **por composição local** — gerar a arte quadrada e montar a
  thumbnail 1280×720 aqui, com a camada de marca. É exatamente o que `thumbnail-art.ts` já faz.
- **Cláusula sobre crianças:** a página de termos da Cloudflare é renderizada por JS e não entregou
  texto → **`NÃO VERIFICADO`** (o ToS do modelo aponta para a BFL, que exige 18+ do **titular** e não
  veda conteúdo infantil).

## As outras, e por que caem

| Provedor | Situação |
|---|---|
| **Together AI** | O endpoint gratuito **morreu**: *"2025-12-23 · FLUX.1-schnell-free · No"* — <https://docs.together.ai/docs/deprecations>. Hoje exige saldo: *"Calling image models requires a positive credit balance."* |
| **Google / Gemini** | **FORA por contrato**: *"You also will not use the Services as part of a website, application, or other service ... directed towards or likely to be accessed by individuals under the age of 18."* — <https://ai.google.dev/gemini-api/terms> |
| **Pollinations.ai** | Sem chave hoje responde **HTTP 401**; o host legado só oferece `sana` e os termos dizem *"Model licences vary; verify before commercial use"* — sem concessão de uso comercial |
| **Stability AI** | 25 créditos grátis (US$ 1 = 100), mas **não entrega 16:9 exato** (só `aspect_ratio`, saída ~1–1,5 MP); *"you can use the outputs ... for commercial purposes"* |
| **Hugging Face Inference Providers** | US$ 0,10/mês grátis; aceita `width`/`height`; repassa o preço do provedor sem markup |
| **AI Horde (anônimo)** | Grátis, mas **não faz 16:9** (`multipleOf: 64` — 720 e 1080 falham) e publica imagem+prompt na LAION |
| **NVIDIA NIM (grátis)** | *"for prototyping, research, development and testing purposes only"* — produção exige licença Enterprise |
| **Replicate** | `flux-schnell` a US$ 0,003/imagem; free tier `NÃO VERIFICADO` |
| **Modelos abertos auto-hospedados** | A gratuita de verdade, mas exige GPU. FLUX.1 [schnell]/Sana/Qwen = Apache-2.0; **FLUX.1 [dev] = "Non-Commercial Use Only"** → bloqueado para canal monetizado |

## O que ficou `NÃO VERIFICADO`

1. Cláusulas literais dos termos/privacidade da Cloudflare (páginas JS), inclusive sobre menores.
2. Exigência de cartão no cadastro: Cloudflare, fal.ai, Together, Stability, Replicate, HF.
3. Regra oficial de contagem de tiles 512×512 da Cloudflare (o total por imagem seria aritmética nossa).
4. Resolução de saída do `flux-1-schnell` (não documentada; não aceita width/height).
5. Cláusula sobre conteúdo dirigido a crianças: Cloudflare, Together, Stability, HF, NVIDIA.
6. Preço por imagem do Google em 1280×720 e limites diários do free tier.

## O que foi feito com isto

`server/media/thumbnail-art.ts` — composição local (fundo em gradiente por opção, faixa de arco-íris,
painel claro, título em corpo grande, hipótese em corpo pequeno e a nota **"arte local · sem
personagem"**). Custo zero, sem chave, sem contrato, e **conferida a olho** — foi assim que apareceu o
defeito da primeira versão (título sem quebra de linha transbordando o quadro). O que continua faltando
é a **Luna ilustrada**, e isso depende do Character Sheet (`rebeca-branding`), não de provedor.
