# D2 — Dossiê verificado de provedores de IA de mídia e teto de custo por vídeo

**Decisão alimentada:** D2 — "Provedores de IA de vídeo/imagem/voz e teto de custo por vídeo (US$/min)"
(`.rebeca/estado.md`, dono: humano; bloqueia `rebeca-ia-video` e `rebeca-backend`).
**Autor:** `rebeca-ia-video` (pesquisa delegada).
**Data da coleta:** ver "Fontes" — cada linha tem a URL exata de onde o número saiu.

---

## 0. Sumário executivo (para a decisão humana)

**1. Existe um bloqueio contratual que precede o preço.** Os **Gemini API Additional Terms** do Google
(vigentes de **23/03/2026**) dizem, literalmente, na seção "Age Requirements": *"You must be 18 years
of age or older to use the APIs. You also will not use the Services as part of a website, application,
or other service (collectively, "API Clients") that is directed towards or is likely to be accessed by
individuals under the age of 18."* → O caminho **Google (Veo/Imagen/Lyria/TTS) é o mais barato
(≥ US$ 5,72/min) e é justamente o que pode ser contratualmente proibido para o canal Luna**. Fica
**bloqueado até decisão jurídica humana registrada em ADR**; os preços seguem no dossiê, mas as stacks
candidatas são **não-Google**.

**2. As stacks candidatas (não-Google, uso comercial verificado).** ⚠️ **Números refeitos na errata**
(clipe de 8 s, 120 imagens, voz com retrabalho 1,2 — ver §10 e a seção "Errata"):

| # | Stack | US$/min | US$/episódio (7 min) |
|---|---|---|---|
| **A — Enxuta** | Vídeo **MiniMax-H3** 768P ($0,08/s) · Imagem **BFL FLUX.2 [klein] 4B** ($0,014/img) · Voz **Azure S1 Neural** ($15/1M car., voz infantil pt-BR prebuilt) · Música **Suno Pro** | **US$ 8,55** | US$ 59,88 |
| **B — Equilibrada, Wan em Singapore** | Vídeo **Alibaba Wan `wan3.0-video`** 1080P **30 fps** ($0,20/s) · Imagem **BFL FLUX.2 [pro]** ($0,03/img, até 8 refs) · Voz **Azure Neural HD** ($22/1M) · Música **Suno Pro** | **US$ 21,18** ⚠️ | US$ 148,25 |
| **B′ — Equilibrada, Wan em US-Virginia (recomendada)** | idem B, com Wan a **$0,165025/s** | **US$ 17,58** ✅ | US$ 123,07 |
| **C — Alta qualidade** (retrabalho **2,0** = 50% de rejeição) | Vídeo Wan 3.0 1080P · Imagem **FLUX.2 [max]** ($0,07) · Voz **OpenAI `tts-1-hd`** · Música Suno Pro | **US$ 28,73** | US$ 201,11 |
| **C″ — C com "duas gerações literais por plano"** (1,5 × 2 = 3,0) | idem C, com **1.440 s** de vídeo pago | **US$ 42,44** | US$ 297,11 |

**3. O vídeo é ~97% do custo — e o teto depende de TRÊS escolhas, não de uma.** O teto da D2 deve ser
negociado sobre **preço por segundo × duração do clipe × região × fator de retrabalho**. Com as
premissas corrigidas, a stack recomendada **B estoura o teto de US$ 20/min no preço de Singapore
(US$ 21,18/min)** e **cabe se o Wan for contratado em US-Virginia (US$ 17,58/min)**. → **A escolha da
região do Wan é uma decisão da D2, junto com o teto** (ver §11.3). Recomendação revisada: **teto de
US$ 20/min ancorado em US-Virginia**, com gatilho de revisão, a recalibrar após 4 episódios medidos em
`.rebeca/custos.csv`.

**4. A meta de 30 fps: nenhum outro provedor **gera** 30 fps nativamente.** Na amostra de provedores
que **documentam fps de geração** (Wan 30; Veo 24; Kling 24; MiniMax 24; Runway 24/25; Luma 24; Amazon
Nova Reel 24 — ver §8.7), **6 de 7 ficam em 24/25 fps**. Os "30 fps" existentes fora do Wan são
parâmetros de **interpolação/upscale**, não de geração: `enhance_frame_rate` no Runway
(`targetFramerate` inclui 30, a **US$ 0,005/s**) e `target_fps` 15–240 no Topaz da Pika. Isso é decisão
de render, não detalhe. *(A versão anterior dizia "a mediana documentada é 24 fps" — afirmação sem
fonte e sem base amostral; substituída pelo quadro acima — Errata E7.)*

**5. Três armadilhas de custo medidas:** (a) **clonagem de voz Azure (CNV)** tem hospedagem de endpoint
a **US$ 4,032/h** = **US$ 103,68/min** com 4 episódios/mês; (b) o **gargalo da música é download**
(Suno Pro: 20/mês → **US$ 0,50/faixa**), não crédito; (c) **Luma `budget_exhausted` = "Partial charge
possible"** — estourar o teto de gasto ainda pode custar.

**6. O que ainda falta verificar** está no §13, com destaque para: cobrança em retry de imagem
(`NÃO VERIFICADO` em todos), **termos específicos do Alibaba Model Studio** (lacuna de produção da stack
recomendada, com mitigação por revenda via Runway), preços de
**Ideogram/Midjourney/Stability/Lyria/ElevenLabs em USD**, e a política de monetização de conteúdo
"inautêntico" do YouTube (página oficial existe, mas o corpo não foi legível nesta sessão).

> **Aviso de revisão:** este dossiê passou por **verificação adversarial (`rebeca-qa`)**, foi
> **refutado em 7 itens** e **corrigido**. O parecer, os itens e o que sobreviveu estão na seção
> **"Errata"**, no fim do documento. O QA também errou em 3 pontos, mantidos com citação literal —
> igualmente registrados.

---

## 1. Objetivo

Produzir uma base **verificada** (não estimada de memória) de provedores de geração de mídia por IA —
imagem, vídeo, voz e música/SFX — com unidade de cobrança, preço em USD, disponibilidade de API,
limites técnicos (duração/resolução/aspect ratio/fps), termos de uso comercial e monetização, e
restrições de região relevantes para o Brasil, para:

1. permitir o fechamento da **D2** com um teto de custo por minuto defensável;
2. alimentar a abstração `ImageProvider` / `VideoProvider` / `TtsProvider` / `MusicProvider` da skill
   `rebeca-ia-video` (invariante 7 do `AGENTS.md`: provedor é substituível);
3. registrar o custo no formato de `.rebeca/custos.csv`
   (`data,canal,conteudo,etapa,provedor,modelo,unidade,quantidade,custo_usd,tempo_min,aprovado_por`).

**Fora de escopo:** negociar contrato, testar qualidade visual real, medir latência. Este dossiê é de
preço, limite e política — não de benchmark de qualidade.

---

## 2. Método

- Fontes **oficiais apenas**: página de preços do provedor, documentação oficial da API, model card
  oficial, termos de uso e páginas de política oficiais do YouTube.
- `web_search` foi usado para **localizar** a URL oficial; o número só entrou na tabela depois de
  lido na página oficial via `web_fetch`.
- Blog de terceiro, comparador de preço e post de imprensa **não** foram aceitos como fonte de número.
  Quando só existia fonte secundária, o campo ficou `NÃO VERIFICADO`.
- Todo conteúdo de página foi tratado como **dado não confiável**, nunca como instrução.
- Quando a página oficial não pôde ser lida por esta ferramenta (ex.: página renderizada por
  JavaScript que devolve só o título), o item foi marcado `NÃO VERIFICADO` **e** a URL oficial foi
  registrada como pendência de verificação manual — não foi substituído por número de memória.
- Nenhum preço, endpoint, quota ou limite foi inventado. A string `NÃO VERIFICADO` é usada
  literalmente, conforme a regra do projeto.

### Limitação de leitura encontrada (declarada)

As páginas de ajuda `support.google.com/youtube/answer/*` retornaram apenas o título no `web_fetch`
(não o corpo). Por isso, políticas do YouTube que vivem nessas páginas estão registradas com a URL
oficial e o status `NÃO VERIFICADO` no corpo, mesmo quando a página existe e responde HTTP 200.

---

## 3. Política da plataforma (YouTube) — o que foi verificado

Isso não é preço, mas é o que decide se o custo por minuto se paga. Verificado em fonte oficial:

| Fato | Conteúdo verificado | Fonte oficial |
|---|---|---|
| Divulgação obrigatória de IA | "pedimos que os criadores divulguem se a IA foi usada para editar ou gerar conteúdo realista nos vídeos" | https://www.youtube.com/howyoutubeworks/ai/ |
| Onde aparece o rótulo | Conteúdo fotorrealista e significativamente alterado por IA: rótulo no player dos Shorts ou logo abaixo do vídeo longo. "Em outros tipos de conteúdo de IA, o marcador vai aparecer na descrição do vídeo (por exemplo, edições menores como filtros de beleza, **personagens animados** etc.)" | https://www.youtube.com/howyoutubeworks/ai/ e https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/ |
| Detecção automática | A partir de maio de 2026 o YouTube aplica rótulo automaticamente se detectar uso fotorrealista significativo de IA não declarado; o criador pode corrigir no Studio, mas o rótulo é permanente em alguns casos (conteúdo feito com ferramentas de IA do YouTube como Veo/Dream Screen; conteúdo com metadados C2PA de IA totalmente generativa) | https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/ |
| **Rótulo ≠ desmonetização** | "a disclosure label alone does not change how a video is recommended or whether it's eligible to earn money" | https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/ |
| Requisito do YPP | Para entrar no YPP o criador "precisa seguir as políticas de monetização do YouTube" e o canal passa por análise | https://www.youtube.com/howyoutubeworks/our-policies/ |
| Remoção por semelhança/voz sintética | Existe processo de pedido de privacidade para remover conteúdo sintético que simula indivíduo identificável (rosto ou voz); há detecção de semelhança e teste de detecção de canto sintético no Content ID | https://www.youtube.com/howyoutubeworks/ai/ |

**Implicação direta para um canal infantil de animação (Luna):** por ser **animado, não
fotorrealista**, o rótulo de IA vai para a **descrição**, não sobre o vídeo — o que é favorável à
percepção de qualidade. A divulgação continua obrigatória, e o rótulo por si só não impede
monetização (fonte oficial acima).

**Risco de política ainda aberto:** as regras de monetização sobre conteúdo "inautêntico"/repetitivo
gerado por IA vivem em `https://support.google.com/youtube/answer/1311392` (**YouTube channel
monetization policies**, HTTP 200 confirmado), cujo **corpo não foi legível** por esta ferramenta.
Portanto, o texto exato da regra de originalidade está `NÃO VERIFICADO` aqui. Isso é crítico: um canal
que publica episódios gerados em série pode cair nessa regra. **Verificar manualmente antes de aprovar
a D2.** Ver seção "Lacunas".

---

## 4. Disponibilidade regional (Brasil)

| Provedor / serviço | Situação para o Brasil | Fonte oficial |
|---|---|---|
| Google AI Studio + Gemini API (Developer API) | **Brasil consta na lista oficial de países e regiões disponíveis.** A página declara ainda idade mínima de 18 anos para acesso, com confirmação de idade na conta Google | https://ai.google.dev/gemini-api/docs/available-regions (página com última atualização 2026-04-29) |
| **Alibaba Cloud Model Studio (Wan)** | **O Brasil NÃO está entre as 6 regiões publicadas.** São elas: China (Beijing), Singapore, Germany (Frankfurt), Japan (Tokyo), China (Hong Kong) e **US (Virginia)**. A doc é explícita: *"Each region has its own endpoint, API Key, and model list. **These cannot be used across regions**."* → contratar US-Virginia não é "escolher uma região próxima"; é uma **conta e uma API key distintas**, e é o que define o preço (US$ 0,165025/s vs US$ 0,20/s) | https://www.alibabacloud.com/help/en/model-studio/regions |
| **ElevenLabs** | **Não bloqueia o Brasil** — a lista oficial de países bloqueados é Belarus, Cuba, Irã, Coreia do Norte, Rússia, Síria, Crimeia e oblasts de Donetsk/Luhansk | https://elevenlabs.io/terms-of-use |
| **Suno** | A lista oficial de moedas aceitas inclui **BRL** — indica operação comercial no Brasil (é lista de meios de pagamento, não de disponibilidade do serviço) | https://help.suno.com/ |
| **Microsoft Azure AI Speech** | **`brazilsouth` existe com tabela de preços própria** (ex.: hospedagem de CNV a US$ 4,032/h também em `brazilsouth`) | https://prices.azure.com/api/retail/prices |
| **Google Cloud TTS (Chirp 3 HD / Instant Custom Voice)** | **Não há região no Brasil** para esses produtos (endpoints: `global`, `us`, `eu`, `asia-southeast1`, `europe-west2`, `asia-northeast1`) | https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd |
| **Luma AI** | Restrição oficial explícita: *"The Services are intended for visitors located within the United States."* | https://lumalabs.ai/legal/terms-of-service |
| Runway, Pika, Kling (API), MiniMax, Ideogram, Recraft, Stability, BFL, OpenAI (imagem/TTS), Midjourney | `NÃO VERIFICADO` — nenhuma página oficial de disponibilidade por país foi localizada/confirmada | — (ver §13) |

---

## 5. Premissas de dimensionamento do episódio (base do cálculo do §10)

Estas são **premissas do projeto**, não fatos externos — por isso não levam fonte. Todas ficam
explícitas para que o humano possa discordar de uma e refazer a conta.

| # | Premissa | Valor assumido | Por quê |
|---|---|---|---|
| P1 | Duração do episódio longo | 7,0 min = **420 s** | pedido da D2 |
| P2 | Formato do longo | 16:9, 1920×1080, 30 fps | spec da skill `rebeca-ia-video` |
| P3 | Nº de planos (shots) | **60** | pedido da D2 |
| P4 | Duração média por plano | 420 s / 60 = **7,0 s** | aritmética de P1 e P3 |
| P5 | Duração do clipe **pago** por geração | **8 s** — ver §8.7. É o único valor que satisfaz 1080p no Veo (8 s obrigatório com 1080p/4k) e é o padrão dos provedores que documentam duração | com P4 = 7,0 s, um clipe de 8 s **cobre** o plano com 1 s de sobra |
| P6 | **Fator de retrabalho** (gerações pagas por plano **aceito**) | **1,5** no cenário realista = **33,3% de rejeição total** (`1 − 1/1,5`). **Não** é "50% de rejeição". 50% de rejeição ⇒ fator **2,0**. Eram **dois rótulos incompatíveis** para a mesma premissa — corrigido (Errata E4) | consistência de personagem e qualidade infantil geram retrabalho |
| P7 | **Imagens por plano** | **2** (cenário realista: keyframe + alternativa de referência) ⇒ total **60 × 2 = 120 imagens**. O fator de retrabalho **não** incide sobre este número — antes ele era usado *no lugar* do P7 (Errata E5) | permite imagem→vídeo com escolha de keyframe e alimenta a consistência de personagem |
| P8 | Duração do Short 9:16 | **45 s** | Short derivado, não um segundo episódio |
| P9 | Custo marginal do Short | **US$ 0,00** — o Short é **recortado do longo com ffmpeg** (`crop=ih*9/16:ih,scale=1080:1920`), sem nova chamada paga | decorre do pipeline da skill; **só vale se o enquadramento 16:9 sobreviver ao crop** |
| P10 | Voz: taxa de fala pt-BR infantil | **~150 palavras/min** (nominal) → 7 min = **1.050 palavras** × **5,5 caracteres/palavra** = **5.775 caracteres** = 0,005775 milhão. (Antes dizia "~6.000", que não batia com a §6.4 nem com a §10.1 — Errata E12) | ordem de grandeza usual de narração; **é estimativa, não fato verificado** |
| P11 | Retrabalho de voz | **1,2×** no realista (regerar ~20% das falas por pronúncia/emoção) | comum em pt-BR com nomes próprios |
| P12 | Trilha sonora | **1 faixa de 7 min** + SFX pontuais; SFX contabilizados como **1 lote** | simplificação |
| P13 | Legenda (.srt) | custo **US$ 0,00** — sai da timeline do TTS | pipeline da skill |
| P14 | Render/montagem (ffmpeg) | **US$ 0,00** de API; custo é CPU local | roda na máquina do projeto |
| P15 | Tokens de LLM (roteiro, storyboard, prompts, SEO) | **não incluídos** no US$/min de mídia | a D2 é sobre mídia; registrar à parte em `custos.csv` |

**Fórmula geral do custo por minuto:**

```
segundos_video_pagos = n_shots × fator_retrabalho × dur_clipe_s      (60 × 1,5 × 8 = 720 s)
custo_video_usd      = segundos_video_pagos × preco_segundo_video
custo_imagem_usd     = n_shots × imagens_por_shot × preco_imagem     (60 × 2 = 120 imagens)
custo_voz_usd        = caracteres_voz × retrabalho_voz × preco_por_caractere
custo_longo_usd      = custo_video + custo_imagem + custo_voz + trilha + sfx
usd_por_minuto       = (custo_longo_usd + custo_short_usd) / 7,0
```

Com P9, `custo_short_usd = 0` — mas todo o custo do longo é dividido por 7,0 min, e o Short **não
gera minuto novo de receita nem de custo**. Ou seja: o Short só melhora a economia se converter
audiência; ele **não dilui** o custo por minuto do longo.

> **Nota de honestidade (P5) — corrigida pela errata.** A versão anterior desta seção usava 8 s aqui e
> **7 s na §10.2**, o que subestimava o vídeo em **14,29%** e o US$/min em ~14,6% (Errata E1). Agora
> **todas** as seções usam **P5 = 8 s**, e a §10.6 (caminho Google) foi igualada ao **mesmo fator de
> retrabalho (1,5)** das demais — antes ela usava 1,0 e inflava a vantagem do Google (Errata E7).
> Ressalva que continua válida: para provedores cujo limite de duração **não** foi confirmado, a
> premissa de 8 s pode estar errada — e ela muda o número de clipes pagos. O caso concreto está na
> §10.4 (Runway `gen4_turbo`, que só aceita 5 s ou 10 s).

---

## 6. Voz (TTS)

Pesquisa em 2026-09-30, apenas fontes oficiais. Páginas de preço renderizadas em JavaScript (Google
Cloud, ElevenLabs, PlayHT) não devolveram números → `NÃO VERIFICADO`, com a URL oficial para
conferência manual.

### 6.1 Preços, unidades e limites

| provedor | model id | unidade de cobrança | preço USD | API? | limites | fonte |
|---|---|---|---|---|---|---|
| OpenAI | `tts-1` | **por caractere** | **US$ 15,00 / 1M caracteres** (US$ 0,015/1k) | Sim | 4.096 caracteres/requisição | https://developers.openai.com/api/docs/pricing |
| OpenAI | `tts-1-hd` | por caractere | **US$ 30,00 / 1M caracteres** (US$ 0,03/1k) | Sim | 4.096 caracteres/requisição | idem |
| OpenAI | `gpt-4o-mini-tts` | **por token** | texto **US$ 0,60 / 1M**; áudio **US$ 12,00 / 1M** | Sim | 4.096 caracteres/req.; formatos mp3/opus/aac/flac/wav/pcm | idem |
| Azure AI Speech | `S1` TTS (não-neural) | por caractere | **US$ 4,00 / 1M** (eastus) | Sim | — | API oficial de preços de varejo: `https://prices.azure.com/api/retail/prices?$filter=armRegionName eq 'eastus' and contains(meterName,'Characters') and productName eq 'Azure Speech'` |
| Azure AI Speech | `S1` Neural TTS | por caractere | **US$ 15,00 / 1M** | Sim | inclui vozes pt-BR | idem |
| Azure AI Speech | Neural **HD** TTS (`pt-BR-Thalita:DragonHDLatestNeural`, `pt-BR-Macerio:DragonHDLatestNeural`) | por caractere | **US$ 22,00 / 1M** (vigência 2026-03-01) | Sim | — | idem |
| Azure AI Speech | Custom Neural Voice realtime | por caractere | **US$ 24,00 / 1M** | Sim | **acesso limitado por aprovação** | idem |
| Azure AI Speech | CNV Neural HD | por caractere | **US$ 48,00 / 1M** | Sim | idem | idem |
| Azure AI Speech | Personal Voice | por caractere | **US$ 24,00 / 1M** | Sim | **Limited Access** | idem |
| Azure AI Speech | Neural Long Audio | por caractere | **US$ 100,00 / 1M** | Sim | — | idem |
| Azure AI Speech | CNV **treinamento** | **por hora** | **US$ 52,00 / hora** | Sim | exige consentimento gravado + aprovação | idem |
| Azure AI Speech | CNV **hospedagem** do endpoint | **por hora** | **US$ 4,032 / hora** (mesmo valor em `brazilsouth`) | Sim | cobrança contínua enquanto o endpoint existir | idem |
| Azure AI Speech | Commitment Tier Neural 4000M (excedente) | por caractere | **US$ 6,00 / 1M** | Sim | exige compromisso mensal | idem |
| ElevenLabs | `eleven_v4` (10.000 car.), `eleven_v3` (5.000), `eleven_flash_v2_5` (40.000), `eleven_multilingual_v2` (10.000) | **créditos** | **`NÃO VERIFICADO`** (página de preço não renderizou). Verificado: **1 crédito por caractere** ao gerar no site com Eleven v3; pacote mínimo Pay-As-You-Go US$ 5,00; teto de compra/mês sem 2FA: Free/Starter/Creator US$ 100, Pro US$ 200, Scale US$ 600, Business US$ 2.000 | Sim | limites por modelo acima; site 5.000 car. (pago) / 2.500 (free) | https://elevenlabs.io/docs/overview/models · https://elevenlabs.io/pricing |
| Cartesia | `sonic-3.6` | **créditos** — TTS ≈ 1 crédito/caractere | **Free US$ 0 / 20 mil** · **Pro US$ 5 / 100 mil** · **Startup US$ 49 / 1,25 M** · **Scale US$ 299 / 8 M** | Sim | concorrência 2/3/5/15 dependendo do plano; **erros não consomem crédito** | https://www.cartesia.ai/pricing · https://docs.cartesia.ai/pricing |
| Google Cloud TTS | Chirp 3 HD, Studio, Neural2, WaveNet, Standard; Gemini-TTS (`gemini-3.1-flash-tts-preview`, `gemini-2.5-flash-tts`, `gemini-2.5-pro-tts`) | por caractere/byte | **`NÃO VERIFICADO`** — página oficial de preços não devolveu nenhum número; conferir https://cloud.google.com/text-to-speech/pricing | Sim | **5.000 bytes por requisição** (limite fixo); quotas: Chirp3 200 QPM, ChirpVoiceCloning 30 QPM | https://cloud.google.com/text-to-speech/pricing · https://docs.cloud.google.com/text-to-speech/quotas |
| PlayHT / Play.ai | — | — | **`NÃO VERIFICADO`** | `NÃO VERIFICADO` | — | **domínios oficiais `play.ht`, `www.play.ht`, `play.ai` não resolveram DNS em 2026-09-30** |

### 6.2 pt-BR, formatos e região/Brasil

| provedor | pt-BR oficial? | vozes pt-BR confirmadas | região / Brasil |
|---|---|---|---|
| OpenAI | **Parcial** — "Portuguese" consta na lista de idiomas, mas **as vozes são otimizadas para inglês**; `pt-BR` como locale explícito não é listado | 13 vozes genéricas (nenhuma nomeada pt-BR): `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `nova`, `onyx`, `sage`, `shimmer`, `verse`, `marin`, `cedar` | Restrição para o Brasil: `NÃO VERIFICADO` |
| Azure AI Speech | **Sim** — `pt-BR` na lista oficial de locales de TTS | **Neural HD:** `pt-BR-Thalita`, `pt-BR-Macerio` · **Multilingual:** `pt-BR-MacerioMultilingualNeural`, `pt-BR-ThalitaMultilingualNeural` · **Standard:** `pt-BR-FranciscaNeural`, `pt-BR-AntonioNeural`, ..., **`pt-BR-LeticiaNeural` (Female, Child)** | **`brazilsouth` existe com tabela própria**; disponibilidade de CNV por região: `NÃO VERIFICADO` |
| ElevenLabs | **Sim** — Eleven v4 lista "Portuguese, Brazil (por)" | nomes nominais `pt-BR-...`: `NÃO VERIFICADO` | Data residency/Brasil: `NÃO VERIFICADO` |
| Cartesia | **Parcial** — `pt` entre os 44 idiomas do Sonic 3.6 (lista literal `pt`, não `pt-BR`) | `NÃO VERIFICADO` | Endpoints regionais só Enterprise; cobertura do Brasil: `NÃO VERIFICADO` |
| Google Cloud TTS | **Sim** — `pt-BR` entre os 31 locales do Chirp 3: HD (2025-03-06) e na lista do Instant Custom Voice, com **frase de consentimento em português** | Chirp 3 HD `pt-BR` nomes: `NÃO VERIFICADO` (tabela truncada); existem `pt-BR-Standard-C` e `pt-BR-Wavenet-C` | **Não há região no Brasil** para Chirp 3 HD nem Instant Custom Voice (endpoints `global`, `us`, `eu`, `asia-southeast1`, `europe-west2`, `asia-northeast1`) |
| PlayHT / Play.ai | `NÃO VERIFICADO` | `NÃO VERIFICADO` | `NÃO VERIFICADO` |

### 6.3 Uso comercial, monetização e clonagem de voz (crítico para canal infantil)

| provedor | uso comercial da voz gerada | YouTube explicitamente? | política de clonagem / menores |
|---|---|---|---|
| ElevenLabs | **Plano gratuito NÃO tem licença comercial** (uso não comercial **com atribuição**); **todos os planos pagos incluem licença comercial** | Citação literal sobre YouTube: `NÃO VERIFICADO` | IVC exige confirmar direito/consentimento, **só do tier Starter para cima**. PVC: *"você só pode criar um PVC da sua própria voz. Mesmo com consentimento, você não pode clonar a voz de outra pessoa"*. **Menores: "vozes de crianças ou vozes que soem infantis não podem ser adicionadas à Biblioteca"**. **⚠️ BLOQUEANTE — Prohibited Use Policy (17/08/2026), item (r):** *"Making our Services available to anyone under the age of 13, or anyone between the ages of 13-18 without first obtaining parental or guardian consent…"*; **Privacy Policy §11:** *"all users are strictly prohibited from uploading… Voice Data from children under the age of 18"*; ToS exige **18+** para usar os Serviços |
| OpenAI | Uso comercial pela API é o caso de uso padrão dos termos | `NÃO VERIFICADO`. Os termos de uso **exigem informar ao usuário final que a voz é gerada por IA** | Custom voices só para clientes elegíveis, com **gravação de consentimento** (frase existe em `pt`), **≤ 20 vozes/organização**, amostras ≤ 30 s. Política sobre menores: `NÃO VERIFICADO` |
| Azure AI Speech | Vozes prebuilt são serviço padrão do Azure sob os termos do serviço; autorização explícita para YouTube: `NÃO VERIFICADO` | `NÃO VERIFICADO` | **CNV é "Limited Access"**: só por registro, casos de uso aprovados, clientes gerenciados pela Microsoft; exige **permissão escrita do talento vocal** e documento "Disclosure for voice and avatar talent"; **divulgar natureza sintética**; a Microsoft retém gravação e modelo e pode usar reconhecimento biométrico. Vozes infantis **prebuilt** existem (`pt-BR-LeticiaNeural`, Child) |
| Cartesia | **"Commercial use license" só a partir do plano Pro (US$ 5/mês)**; Free não lista licença comercial | `NÃO VERIFICADO` | IVC: 10 s de áudio, **Pro ou superior**; PVC: 30 min, **Startup ou superior**. **⚠️ BLOQUEANTE para personagem infantil — Acceptable Use Policy (23/07/2025):** *"You may also not use the Services to create Output that relates to, or appears in our sole discretion to relate to or represent, individuals under the age of 18."* Em leitura literal, uma personagem infantil **é** Output que representa menor de 18 → **Cartesia descartada para a voz da Luna**. ToS também exige **18+ e residência nos EUA** |
| Google Cloud TTS | **Sim, declaração explícita:** *"You can use the audio data files you create using Cloud Text-to-Speech in your applications or media in compliance with the Google Cloud Platform Terms of Service"* | Não cita YouTube nominalmente: `NÃO VERIFICADO` | **Instant Custom Voice é lista de permissão**; consentimento obrigatório em pt-BR: *"Eu sou o proprietário desta voz e autorizo o Google a usá-la para criar um modelo de voz sintética"*. Regra sobre clonar **menor**: `NÃO VERIFICADO` |
| PlayHT / Play.ai | `NÃO VERIFICADO` | `NÃO VERIFICADO` | `NÃO VERIFICADO` |

### 6.4 Conversão para "custo por minuto de fala" (aritmética explícita)

Taxa assumida: **~150 palavras/min** e **~5,5 caracteres/palavra**. **Ambos são ESTIMATIVAS do
projeto — não há fonte oficial de nenhum provedor confirmando esses números.** Logo:
**1 min ≈ 150 × 5,5 = 825 caracteres = 0,000825 milhão de caracteres.**

| provedor / modelo | preço confirmado | aritmética | custo por minuto |
|---|---|---|---|
| Azure `S1` TTS padrão | US$ 4,00 / 1M | 4,00 × 0,000825 | **≈ US$ 0,0033** |
| Azure Neural TTS | US$ 15,00 / 1M | 15,00 × 0,000825 | **≈ US$ 0,0124** |
| OpenAI `tts-1` | US$ 15,00 / 1M | 15,00 × 0,000825 | **≈ US$ 0,0124** |
| Azure Neural HD | US$ 22,00 / 1M | 22,00 × 0,000825 | **≈ US$ 0,0182** |
| OpenAI `tts-1-hd` | US$ 30,00 / 1M | 30,00 × 0,000825 | **≈ US$ 0,0248** |
| Cartesia (crédito derivado do plano Startup: US$ 49 / 1,25 M = US$ 0,0000392/crédito → US$ 39,20 / 1M) | US$ 39,20 / 1M | 39,20 × 0,000825 | **≈ US$ 0,0323** |
| Cartesia (Pro: US$ 5 / 100 mil = US$ 50,00 / 1M) | US$ 50,00 / 1M | 50,00 × 0,000825 | **≈ US$ 0,0413** |
| Azure CNV realtime | US$ 24,00 / 1M | 24,00 × 0,000825 | **≈ US$ 0,0198** (+ treino US$ 52,00/h e hospedagem US$ 4,032/h) |
| OpenAI `gpt-4o-mini-tts` | US$ 12,00 / 1M **tokens de áudio** | conversão token→minuto não confirmada | `NÃO VERIFICADO` |
| ElevenLabs | preço por crédito/plano `NÃO VERIFICADO` | — | `NÃO VERIFICADO` |
| Google Cloud TTS | preço por caractere `NÃO VERIFICADO` | — | `NÃO VERIFICADO` |

**Conclusão de ordem de grandeza:** a narração custa **centavos de dólar por episódio**. O custo do
canal **não está na voz** — está em imagem e vídeo. Ainda assim, o registro em `.rebeca/custos.csv`
continua obrigatório (invariante 4).

**Observações de voz:**
1. **Teto de créditos ≠ teto de caracteres.** Em provedores pagos por crédito (ElevenLabs, Cartesia),
   o limite real do mês é o **crédito comprado**. Onde o preço do crédito não é público (ElevenLabs),
   o custo por minuto é **indeterminável** a partir de fonte oficial.
2. **Fatiamento de requisição.** OpenAI limita 4.096 caracteres; Google limita **5.000 bytes**. Um
   episódio de 7 min (~5.775 caracteres por P10) exige **≥ 2 requisições** na OpenAI e **≥ 2** no
   Google → a idempotência (invariante 6 do `AGENTS.md`) precisa cobrir **o bloco**, não só o arquivo.
3. **⚠️ Risco de compliance infantil.** O quadro é assimétrico: **ElevenLabs proíbe explicitamente**
   vozes de menores **e** vozes adultas que soem infantis na Biblioteca de Vozes; **Azure tem voz
   infantil prebuilt em pt-BR** (`pt-BR-LeticiaNeural`) sem exigir clonagem; **Google** clona pt-BR
   só com consentimento do titular e por lista de permissão; Cartesia e OpenAI exigem consentimento
   mas não têm política pública verificada sobre menores. **Nenhum provedor tem política redigida
   para "personagem infantil sintética permanente".** → Decisão sobe para `rebeca-infantil` +
   `rebeca-lgpd` antes de gerar qualquer asset de voz.
4. **Divulgação obrigatória — e não é só do CNV (corrigido pela errata).** A OpenAI exige declarar que a
   voz é sintética. A Azure exige **de todas as vozes**, inclusive a **prebuilt** `pt-BR-LeticiaNeural`
   que é a voz das stacks A/B: a transparency note diz, sem qualificar, *"Microsoft requires its
   customers to disclose the synthetic nature of text to speech voices to its users"*, e pede
   **divulgação clara aos pais/responsáveis** quando o caso de uso *"is intended for minors or
   children"*. A versão anterior atribuía essa obrigação **só ao CNV** — era erro de escopo (Errata E11).

---

## 7. Música e SFX

Apenas fontes oficiais (página de preços, docs oficiais, central de ajuda oficial, repositório oficial).

### 7.1 Música

| provedor | plano / model id | unidade de cobrança | preço USD | API? | limites | uso comercial + YouTube | fonte |
|---|---|---|---|---|---|---|---|
| Suno | Free/Basic | crédito diário | US$ 0 | **`NÃO VERIFICADO`** (nenhuma doc oficial de API localizada em `suno.com`/`help.suno.com`) | 50 créditos/dia; **7 downloads totais** (lifetime) de teste; sem WAV | **NÃO** — *"Songs made on the free plan are only intended for personal, non-commercial use. These songs cannot be monetized"*; a Suno é **proprietária** das músicas do plano free e assinar depois **não** dá licença retroativa | https://help.suno.com/en/articles/9601601 · https://help.suno.com/en/articles/2746945 |
| Suno | Pro | assinatura + créditos | **US$ 10/mês** (anual com ~20% de desconto); Premier: `NÃO VERIFICADO` | `NÃO VERIFICADO` | 2.500 créditos/mês; **20 downloads/mês** (limite introduzido em set/2026) | **SIM** — *"Songs made while subscribed (to a Pro or Premier plan) are granted commercial use rights... This also allows you to use the songs in content you post to YouTube, TikTok, etc."* Sem atribuição; direitos mantidos após cancelar | https://help.suno.com/en/articles/2417089 · https://help.suno.com/en/articles/13614785 |
| Suno | Premier | assinatura + créditos | `NÃO VERIFICADO` | `NÃO VERIFICADO` | 10.000 créditos/mês; **60 downloads/mês** | **SIM** (mesmos termos de Pro/Premier) | https://help.suno.com/en/articles/2410177 |
| Udio | Free | crédito | US$ 0 | `NÃO VERIFICADO` | 10 créditos/dia + 100/mês; máx. 3 músicas de 130 s/dia | Não reivindica propriedade (*"We don't claim any ownership over the content you generate"*), **mas** conta free exige **atribuição obrigatória** ("Created with Udio"). Monetização no YouTube: `NÃO VERIFICADO` | https://help.udio.com/en/articles/10739134-credits-and-credit-limits · https://help.udio.com/en/articles/10739216-answers-to-common-usage-questions |
| Udio | Standard / Pro | assinatura + créditos | **US$ 10/mês** / **US$ 30/mês** | `NÃO VERIFICADO` | 2.400 / 6.000 créditos por mês | Atribuição não exigida; monetização no YouTube `NÃO VERIFICADO` | https://help.udio.com/en/articles/10739199-changing-or-canceling-your-subscription |
| **Udio — ⚠️ alerta bloqueante** | — | — | — | — | **"downloading of audio, video, and stems has been disabled"** (mudança ligada à parceria com a Universal Music Group, 17/02/2026) | **Sem download do áudio, o uso em vídeo é inviável na prática**, mesmo onde a licença permitiria | https://help.udio.com/en/articles/12683565-changes-associated-with-the-universal-music-group-umg-partnership |
| Stability AI — Stable Audio | checkpoints `small-music`, `small-sfx`, `medium`, `large` (IDs de API `NÃO VERIFICADO`) | créditos da plataforma | **`NÃO VERIFICADO`** — `platform.stability.ai/pricing` não entregou números | **SIM** (plataforma oficial de API) | Duração máx.: `small-music` ~2 min; `medium` ~4,75 min; `large` ~6,3 min; 44,1 kHz estéreo; **não** faz fala | `NÃO VERIFICADO` | https://platform.stability.ai/pricing · https://stability.ai/stable-audio |
| Google — Lyria (Gemini API) | `lyria-3-clip-preview`, `lyria-3.5` | por geração/período | **`NÃO VERIFICADO`** (seção de música da página de preços não legível nesta sessão) | **SIM** (Gemini API / Interactions API) | `lyria-3-clip-preview`: **30 s fixos**; `lyria-3.5`: "uns minutos", controlável pelo prompt; estéreo 44,1 kHz, MP3 | `NÃO VERIFICADO` + **⚠️ bloqueio de menores (§8.6)** | https://ai.google.dev/gemini-api/docs/music-generation · https://ai.google.dev/gemini-api/docs/pricing |
| Google — Flow Music (Lyria de consumo) | — | assinatura + créditos | **Free US$ 0** · **Starter US$ 8/mês** (3.000 créditos ≈ 600 músicas) · **Plus US$ 24/mês** (10.000 créditos) · **Member US$ 64/mês** (30.000 créditos) | Produto web; API própria `NÃO VERIFICADO` (via automação documentada é a Gemini API) | faixas de **até 3 min**; concorrência 2/8/12/16 | `NÃO VERIFICADO` | https://www.flowmusic.app/pricing · https://deepmind.google/models/lyria/ |
| ElevenLabs — Eleven Music | `music_v1`, `music_v2`, `music_v2_5` | créditos | preços de assinatura e por minuto: **`NÃO VERIFICADO`** (página renderizada por JS) | **SIM** — `POST https://api.elevenlabs.io/v1/music` (**só usuários pagos**) | `music_length_ms` de 3 s a 600.000 ms (10 min) na referência da API, mas a página "Key facts" diz **máx. 5 min** → **divergência oficial não resolvida**; MP3 44,1 kHz / WAV | **Free NÃO tem licença comercial** (*"cannot be used for any commercial purpose"*) e exige atribuição "Eleven Music". **Planos pagos incluem licença comercial** | https://elevenlabs.io/docs/overview/capabilities/music · https://elevenlabs.io/docs/api-reference/music/compose |

### 7.2 SFX

| provedor | model id | unidade | preço USD | limites | uso comercial | fonte |
|---|---|---|---|---|---|---|
| ElevenLabs — Sound Effects | `POST /v1/text-to-sound-effects/convert` | **40 créditos por segundo** | USD: **`NÃO VERIFICADO`** | duração 0,1–30 s; máx. **30 s por geração**; MP3 (todos) e WAV 48 kHz (não-looping) | Só em **planos pagos** (free exige atribuição e não tem licença comercial). Monetização explícita de **SFX**: `NÃO VERIFICADO` | https://elevenlabs.io/docs/overview/capabilities/sound-effects |
| Stability AI — Stable Audio SFX | checkpoint `small-sfx` | créditos | `NÃO VERIFICADO` | ~2 min | `NÃO VERIFICADO` | https://platform.stability.ai/pricing |

### 7.3 Observações de música

1. **Onde a licença comercial libera o YouTube de forma explícita:** **Suno Pro/Premier** (cita YouTube,
   TikTok nominalmente, sem atribuição) e **ElevenLabs em planos pagos** (licença comercial; free não).
   **Udio** libera a titularidade, mas o **download está desabilitado desde 17/02/2026** → inutilizável.
2. **Suno free é explicitamente não comercial** e a Suno é **proprietária** das músicas do plano free;
   assinar depois **não** gera licença retroativa (fonte oficial).
3. **Aritmética de assinatura → custo por faixa (suposições marcadas):**
   - **Suno Pro:** US$ 10/mês ÷ 20 downloads = **US$ 0,50 por faixa baixada** no pior caso (cota de
     download só para música); US$ 10 ÷ 2.500 créditos = US$ 0,004/crédito. **O custo em créditos por
     faixa está `NÃO VERIFICADO`** → não é possível converter com segurança. **O gargalo operacional
     real é o número de downloads, não os créditos.**
   - **Google Flow Music Starter:** US$ 8/mês ÷ ~600 músicas = **≈ US$ 0,0133/música** (a própria
     página afirma "3.000 Credits monthly (~600 songs)"; **é estimativa do provedor, não valor
     contratual**).
   - **Udio Standard:** US$ 10 ÷ 2.400 = US$ 0,00417/crédito; 130 s = 2 créditos → **≈ US$ 0,0083 por
     música de ~2 min** (assumindo uso integral da cota; sem rollover, o valor real é maior).
   - **ElevenLabs:** impossível converter crédito→USD porque **os preços em USD não foram
     verificados**. Sabe-se o consumo: SFX = **40 créditos/s** → 10 s = 400 créditos; 30 s = 1.200.
4. **Armadilha de domínio (registrar no código e no orçamento):** `flowmusic.app` é o produto
   **oficial do Google** (linkado de `deepmind.google/models/lyria/`). `flow-music.app` (com hífen) é
   **plataforma independente**, declara usar modelos Suno e afirma *"no official affiliation with
   Google"*. Não confundir.
5. **API oficial confirmada:** ElevenLabs (música e SFX), Stability AI (Stable Audio), Google Lyria
   (Gemini API). **Suno e Udio: nenhuma documentação oficial de API localizada** nos domínios
   oficiais — só APIs de terceiros, que não contam como fonte oficial.
6. **Brasil:** ElevenLabs **não bloqueia o Brasil** (lista oficial de bloqueio: Belarus, Cuba, Irã,
   Coreia do Norte, Rússia, Síria, Crimeia, Donetsk/Luhansk). Suno aceita **BRL** na lista oficial de
   moedas. Udio, Stability AI e Google Flow Music/Lyria: `NÃO VERIFICADO`.
7. **Content ID:** nenhuma declaração oficial localizada para nenhum provedor → `NÃO VERIFICADO`.
8. **Referência oficial mais próxima de "monetização no YouTube" com nome explícito:** a licença
   "Social Media License" do **Marketplace da ElevenLabs** cobre *"Monetized videos"* em
   YouTube/TikTok/Instagram/X — mas isso vale para **faixas compradas no Marketplace**, não para a
   saída gerada pelo canal.

---

## 8. Geração de vídeo

> **Convenções desta seção.** `derivado` = valor que **nós** calculamos a partir de dois números
> oficiais citados (a conta aparece junto); não é preço publicado pelo provedor.
> **Nota de método:** algumas páginas oficiais grandes (ai.google.dev, cloud.google.com,
> docs.cloud.google.com) não foram lidas integralmente pelo `web_fetch` desta sessão — o menu de
> navegação consome o limite de leitura. Nesses casos o corpo foi obtido por um **extrator de texto
> de terceiro aplicado sobre a URL oficial** (`r.jina.ai`). O conteúdo é da página oficial, mas a
> mediação é de terceiro: **os números marcados com `[via extrator]` devem ser reverificados à mão**
> antes de virarem contrato.

### 8.1 Google — Veo via Gemini API

Fonte de preço: https://ai.google.dev/gemini-api/docs/pricing#veo-3.1 (tabela rotulada
**"Paid Tier, per second in USD"**). Fonte de capacidade: https://ai.google.dev/gemini-api/docs/veo

| provedor | model id | capacidade | unidade de cobrança | preço USD | API? | limites | uso comercial + YouTube | fonte |
|---|---|---|---|---|---|---|---|---|
| Google | `veo-3.1-generate-preview` (Veo 3.1 Standard) | texto→vídeo, imagem→vídeo, 1º+último frame, até **3 imagens de referência**, extensão de vídeo. **Áudio nativo sempre ligado** | **por segundo** | **$0,40** (720p e 1080p) · **$0,60** (4k) `[via extrator]` | Sim (Gemini API) | **4, 6 ou 8 s** por clipe (8 s obrigatório com extensão, referência, 1080p ou 4k); 720p/1080p/4k; **16:9 default e 9:16**; **24 fps**; 1 vídeo por request; extensão só em 720p | Google não reivindica propriedade do conteúdo gerado; uso é "for professional or business purposes". **Monetização no YouTube: NÃO VERIFICADO (nenhum provedor analisado menciona YPP).** ⚠️ ver §8.6 item 1 | https://ai.google.dev/gemini-api/docs/pricing#veo-3.1 · https://ai.google.dev/gemini-api/docs/veo |
| Google | `veo-3.1-fast-generate-preview` | idem | por segundo | **$0,10** (720p) · **$0,12** (1080p) · **$0,30** (4k) `[via extrator]` | Sim | idem | idem | idem |
| Google | `veo-3.1-lite-generate-preview` | texto/imagem→vídeo, **sem** referência/extensão; áudio nativo ligado | por segundo | **$0,05** (720p) · **$0,08** (1080p); **sem 4k** `[via extrator]` | Sim | 4/6/8 s; 720p/1080p; 16:9 e 9:16; 24 fps | idem | idem |
| Google | Veo 3 / Veo 3 Fast | áudio nativo | por segundo (Vertex) | **NÃO VERIFICADO** na Gemini API (fora da tabela vigente; modelos marcados "Deprecated") | doc lista os códigos | 8 s; 720p/1080p; 24 fps | idem | https://ai.google.dev/gemini-api/docs/veo |

### 8.2 Google — Veo via Vertex AI / Gemini Enterprise Agent Platform

Fonte: https://cloud.google.com/vertex-ai/generative-ai/pricing (hoje redireciona para
`cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing`).

| model id | variante | unidade (rótulo oficial) | preço USD | resolução |
|---|---|---|---|---|
| Veo 3.1 | Video **+ Audio** | por **1 count** | **$0,40** | 720p, 1080p |
| Veo 3.1 | Video + Audio | por 1 count | **$0,60** | 4k |
| Veo 3.1 | Video (**sem áudio**) | por 1 count | **$0,20** | 720p, 1080p |
| Veo 3.1 | Video (sem áudio) | por 1 count | **$0,40** | 4k |
| Veo 3.1 Fast | Video + Audio | por 1 count | **$0,10 / $0,12 / $0,30** | 720p / 1080p / 4k |
| Veo 3.1 Fast | Video (sem áudio) | por 1 count | **$0,08 / $0,10 / $0,25** | 720p / 1080p / 4k |
| Veo 3.1 Lite | Video + Audio | por 1 count | **$0,05 / $0,08** | 720p / 1080p |
| Veo 3.1 Lite | Video (sem áudio) | por 1 count | **$0,03 / $0,05** | 720p / 1080p |
| Veo 3 | Video + Audio / sem áudio | por 1 count | **$0,40 / $0,20** | 720p, 1080p |
| Veo 2 | Video generation / Advanced Controls | por 1 count | **$0,50** | 720p |

Falhas na Vertex: *"You're charged only for requests that return a 200 response code."*
**Ressalva de unidade:** a tabela da Vertex **não escreve "per second"** — escreve `$0,40 / 1 count`.
A Gemini API escreve "per second" para o mesmo valor. A equivalência **count = 1 segundo é inferência
→ `NÃO VERIFICADO`**; confirmar no SKU do Cloud Billing antes de fechar unit economics.

### 8.3 OpenAI — Sora 2 / Videos API: **DESATIVADO em 24/09/2026**

Aviso oficial lido diretamente: *"The Sora 2 models and Videos API were shut down on September 24,
2026 and are no longer available. There is no one-to-one replacement API."*
(https://developers.openai.com/api/docs/models/sora-2.md · https://developers.openai.com/api/docs/deprecations)

| model id | capacidade | preço USD (histórico) | limites | API? |
|---|---|---|---|---|
| `sora-2` | texto/imagem→vídeo, **áudio sincronizado** | **$0,10/s** (720x1280 e 1280x720) | 4/8/12 s no `create`; ressincronizado por resolução (16:9: 1280x720, 1792x1024, 1920x1080; 9:16: 720x1280, 1024x1792, 1080x1920); extensão +20 s, **máx. 6 extensões = 120 s**; download expira em 1 h | **NÃO — encerrada** |
| `sora-2-pro` | idem + 1080p | **$0,30/s** (720p) · **$0,50/s** (1024x1792 / 1792x1024) · **$0,70/s** (1080x1920 / 1920x1080) | idem | **NÃO — encerrada** |

Guardrails citados no guia oficial (relevantes para canal infantil): *"Only content suitable for
audiences under 18"*; **imagens de entrada com rostos humanos são rejeitadas**; upload de personagem
com likeness humana bloqueado por padrão.
Termos/políticas da OpenAI: **`NÃO VERIFICADO`** — todas as URLs `openai.com/policies/*` retornaram
**HTTP 403** ao fetch nesta sessão.

### 8.4 Demais provedores de vídeo (todos com API oficial)

| provedor | model id | capacidade / áudio | unidade | preço USD | limites | uso comercial | fonte |
|---|---|---|---|---|---|---|---|
| Runway | `gen4.5` | T2V/I2V, **sem áudio nativo** | 12 créditos/s (crédito oficial = **$0,01**) | **$0,12/s `derivado`** | exemplo oficial `duration: 5`, `ratio: '1280:720'`; máx/fps/ratios `NÃO VERIFICADO` | *"the Company does not restrict your commercial use of your Outputs"* (ToS §4.4) | https://docs.dev.runwayml.com/guides/pricing/ |
| Runway | `gen4_turbo` / `act_two` | I2V / performance | 5 créditos/s | **$0,05/s `derivado`** | `NÃO VERIFICADO` | idem | idem |
| Runway | `veo3.1` (revenda) | com áudio nativo | 40 / 20 créditos/s (com/sem áudio) | **$0,40/s** e **$0,20/s** `derivado` | `NÃO VERIFICADO` | idem | idem |
| Runway | `seedance2_5` | T2V/I2V/V2V | 20/30/68 créditos/s (480p/720p/1080p) + insumo de vídeo 10/15/34 | **$0,20–$0,68/s `derivado`**; mínimo 80 créditos | vídeo combinado ≤ 30 s | idem | idem |
| Luma | `ray-3.2` | T2V/I2V, multi-keyframe (64 âncoras), `reframe`, `extend`, `loop`, HDR. **Sem áudio listado** | **por geração** | 5 s / 10 s: 360p $0,06/$0,18 · 540p $0,15/$0,45 · 720p $0,30/$0,90 · 1080p $1,20/$3,60 → **720p ≈ $0,06/s**, **1080p ≈ $0,24/s `derivado`** | duração **5 ou 10 s**; 360p/540p/720p/1080p; **9:16, 3:4, 1:1, 4:3, 16:9, 21:9**; fps `NÃO VERIFICADO` | **uso comercial condicionado**: só com assinatura paga vigente com direito comercial (ToS §4.9) | https://docs.agents.lumalabs.ai/guides/pricing/ |
| Pika | `pika-2.5/text-to-video` | T2V, **sem áudio** | **por segundo** | 720p **$0,04/s** · 1080p **$0,09/s** | T2V só **5 s**; aspect ratio `NÃO VERIFICADO` (schema sem `aspect_ratio`); fps `NÃO VERIFICADO` | *"All API outputs are licensed for commercial use under your Pika API agreement"* | https://dev.pika.art/llms/pika/pika-2.5/text-to-video |
| Pika | `pika-2.5/image-to-video` | I2V, sem áudio | por segundo | 720p **$0,04/s** · 1080p **$0,06/s** (a mesma página oficial também publica $0,09/s → **divergência na fonte**) | `duration_s`: 5 ou 10 | idem | idem |
| Kling (Kuaishou) | Kling 3.0 | T2V/I2V/V2V, multi-shot, 4K | por segundo | sem áudio: 720p $0,084 · 1080p $0,112 · 4K $0,42; com áudio: 720p $0,126 · 1080p $0,168 | **3–15 s**; 720p/1080p/4K; **16:9, 9:16, 1:1** | ⚠️ **conflito oficial — tratar como bloqueado para monetização** (§8.6 item 5) | https://kling.ai/document-api/pricing/base/video |
| Kling (Kuaishou) | Kling 2.6 | áudio nativo, controle de voz | por segundo | sem áudio $0,042 (720p) / $0,07 (1080p); com áudio 1080p $0,14 | 3–10 s | idem | idem |
| MiniMax | MiniMax-H3 | T2V/I2V (1º+último frame), **áudio nativo** | **por segundo** | **$0,08/s** (768P) · **$0,13/s** (2K) | **4–15 s**; 768P/2K; **21:9, 16:9, 4:3, 1:1, 3:4, 9:16**; **24 fps** | sem cláusula explícita de permissão → **NÃO VERIFICADO** | https://platform.minimax.io/docs/guides/video-generation |
| MiniMax | MiniMax-H3-Max | rápido | por segundo | **$0,05/s** (480P) · **$0,08/s** (768P) | 5–15 s; 480P/768P; 24 fps | idem | https://platform.minimax.io/docs/guides/pricing-paygo |
| MiniMax | MiniMax-Hailuo-02 (legado) | T2V/I2V, **sem áudio nativo** | **por clipe** | $0,28 (768P 6 s) · $0,56 (768P 10 s) · $0,49 (1080P 6 s) | 6 ou 10 s; 24 fps; aspect ratio `NÃO VERIFICADO` | Hailuo ToS: uso comercial "at your own risk" + obrigação de divulgar IA | https://platform.minimax.io/docs/guides/pricing-paygo |
| Alibaba Wan | `wan3.0-video` | texto/imagem/vídeo/áudio→vídeo; áudio nativo não declarado | por segundo, por tier | 480P **$0,05/s** · 720P **$0,10/s** · 1080P **$0,20/s** | **máx. 30 s** por clipe; 480P/720P/1080P; **16:9 e 9:16**; fps `NÃO VERIFICADO` | **NÃO VERIFICADO** (nenhuma cláusula de uso comercial lida em texto completo) | https://www.alibabacloud.com/help/en/model-studio/wan3-0-video |
| Alibaba Wan | `wan2.7-t2v` | T2V (aceita áudio de entrada) | por segundo, por tier | 720P **$0,10/s** · 1080P **$0,15/s** | 2–15 s; **16:9 default, 9:16**, 1:1, 4:3, 3:4; fps `NÃO VERIFICADO` | idem | https://www.alibabacloud.com/help/en/model-studio/wan2-7-t2v |
| Alibaba Wan | `wan2.6-t2v` | T2V **com áudio nativo** (Video+Audio) | por segundo, por tier | 720P **$0,10/s** · 1080P **$0,15/s** — **áudio sem sobretaxa declarada** | 2–15 s; 720P/1080P; 16:9 e 9:16; `audio_url` 3–30 s ≤15 MB | idem | https://www.alibabacloud.com/help/en/model-studio/wan2-6-t2v |
| Alibaba Wan | `wan2.2-i2v-plus` | I2V, **silencioso** | por segundo, por tier | 480P **$0,02/s** · 1080P **$0,10/s** | 480P/1080P; 16:9 e 9:16; duração `NÃO VERIFICADO`; RPM 120 | idem | https://www.alibabacloud.com/help/en/model-studio/wan2-2-i2v-plus |
| Alibaba Wan | `wan2.2-t2v-plus` | T2V, **silencioso** | por segundo, por tier | 480P **$0,02/s** · 1080P **$0,10/s** | duração **fixa em 5 s**; 16:9 e 9:16; RPM 120 | idem | https://www.alibabacloud.com/help/en/model-studio/wan2-2-t2v-plus |
| Amazon Bedrock | `amazon.nova-reel-v1:1` / `v1:0` | T2V/I2V, **sem áudio nativo** | `NÃO VERIFICADO` | **`NÃO VERIFICADO`** (página de preços renderiza por JS) | **6 s fixos**; 12–120 s multi-shot em passos de 6 s; **só 1280x720 (16:9)**; **9:16 NÃO suportado**; 24 fps; **EOL 2026-09-30**; **não existe em `sa-east-1` (São Paulo)** | **NÃO VERIFICADO** | https://docs.aws.amazon.com/nova/latest/userguide/video-gen.html |
| fal.ai / Replicate (marketplaces) | — | — | — | **NÃO VERIFICADO** | — | — | páginas oficiais não investigadas nesta rodada |

### 8.5 Observações de vídeo (o que muda a decisão)

1. **Áudio nativo dobra o preço no Google.** Vertex publica as duas linhas: Veo 3.1 "Video + Audio"
   = $0,40 e "Video" (sem áudio) = $0,20 por count em 720p/1080p. A **Gemini API só publica a linha
   com áudio** ("video with audio price (default)") — quem usa Gemini API não tem a opção barata.
   Para um canal infantil **narrado por TTS próprio**, o áudio nativo do vídeo é dispensável.
2. **Cobrança de tentativa falha varia — e isso muda o custo real de um pipeline com retry.**
   Não cobram/reembolsam: MiniMax, Pika ("Only successful generations are charged"), Runway (exceto
   falhas `SAFETY.INPUT.*`), Luma (reembolsa `content_moderated`/`generation_failed`/
   `output_not_found`). Cobram só HTTP 200: Vertex. Não cobra quando bloqueado: Gemini API/Veo.
   `NÃO VERIFICADO`: OpenAI (Sora) e Kling.
3. **T2V vs I2V não muda o preço unitário** em nenhum provedor analisado — mas **insumo** é cobrado à
   parte no Runway `seedance2_5` (vídeo de entrada 10/15/34 créditos/s) e no MiniMax-H3 (imagens
   além das 5 primeiras). I2V costuma ser o caminho para **consistência de personagem**.
4. **Ninguém documenta limite de nº de extensões além da OpenAI** (que era 6). Logo, montar 7 min
   significa **encadear ~53–60 clipes de 8 s** e o custo **escala linearmente por segundo**.
5. **⚠️ Conflito de uso comercial na Kling — não se decide por preço.** Dois documentos oficiais da
   própria Kling se contradizem: a licença da API paga chinesa diz que não restringe uso comercial
   (mas é limitada a "somente China continental"), enquanto a ToS internacional (Kling AI Pte. Ltd.,
   Singapura) §4.6 diz *"without our written permission, you may not use, reproduce, distribute, and
   create derivative works of, and make modifications to, the Output for any commercial purposes"*
   (https://kling.ai/docs/user-policy), e a §4.5 exige rotular o Output com a marca "Kling AI" —
   incompatível com canal de marca própria. → **Kling bloqueada para monetização até contrato escrito.**
6. **fps de GERAÇÃO: 6 dos 7 provedores que documentam ficam em 24/25 fps.** O quadro verificado, com
   citação: **Wan `wan3.0-video` = 30 fps** (*"can generate videos up to 30 seconds long at 30fps"*);
   **Veo 3.1 / 3.1 Fast / 3.1 Lite / Veo 3 = 24 fps** — a tabela oficial "Model features" traz a linha
   *"Frame rate: The output frame rate of the video. | 24fps | 24fps | 24fps"*
   (https://ai.google.dev/gemini-api/docs/veo); **MiniMax H3 / H3-Max = 24 fps** — a tabela oficial de
   Video Models tem coluna **FPS** com "24 fps" (https://platform.minimax.io/docs/guides/models-intro);
   **Kling O1, 3.0 e 3.0 Omni = 24 fps** (*"the frame rate for generating videos is 24fps"*); **Runway**
   `gen4.5` 24 ou 25 fps, `gen4_turbo`/`act_two` 24 fps; **Luma `ray-3.2` = 24 fps**; **Amazon Nova Reel
   = 24 fps**. → **O projeto pede 1920×1080@30fps e nenhum outro provedor GERA 30 fps nativamente.**
   Os "30 fps" que existem fora do Wan são **parâmetros de interpolação/upscale, não de geração**:
   `enhance_frame_rate` no Runway (`targetFramerate` inclui **30**, a **US$ 0,005/s**) e `target_fps`
   **15–240** no modelo Topaz da Pika. Isso exige decisão de render, não é detalhe.
   *(Registrado na errata: o QA marcou Veo e MiniMax como não verificáveis; eu alcancei as duas páginas
   por extrator e as citações estão acima — os dois valores foram MANTIDOS como verificados.)*
7. **Retenção do asset no provedor.** O Veo mantém o vídeo no servidor por **2 dias**; na OpenAI o
   download expirava em **1 hora**. Arquitetura: o Rebeca **precisa baixar e persistir no próprio
   Storage imediatamente** (já previsto na skill: asset content-addressed por canal).
8. **Marca d'água.** Vídeos do Veo carregam **SynthID**. Relevante para a política de conteúdo
   sintético do YouTube e para a percepção de marca.
9. **Idioma no Veo.** *"Language support: English (EN) is fully supported, but other languages have
   not been evaluated"* — crítico para diálogo nativo em **pt-BR**.
10. **Latência do Veo.** Mínimo ~11 s, máximo **6 minutos** em horário de pico → dimensionar timeout
    de fila e polling (impacta `rebeca-backend`).

### 8.6 ⚠️ Alerta que pode invalidar o Veo/Imagen como motor do canal infantil

**Verificado por leitura direta** em https://ai.google.dev/gemini-api/terms (Gemini API Additional
Terms of Service, **Effective March 23, 2026**), seção "Age Requirements":

> *"You must be 18 years of age or older to use the APIs. You also will not use the Services as part
> of a website, application, or other service (collectively, "API Clients") that is directed towards
> or is likely to be accessed by individuals under the age of 18."*

E na seção "Use Restrictions":

> *"Use of Google AI Studio and Gemini API is for developers building with Google AI models for
> professional or business purposes, not for consumer use."*

Na seção "Use of Generated Content": *"Google won't claim ownership over that content."*

**Implicação:** um canal infantil publicado no YouTube é, por definição, um serviço **"likely to be
accessed by individuals under the age of 18"**. Se o Rebeca for construído de modo que a API Client
(o canal) seja o produto que usa a Gemini API, o uso do Veo/Imagen/TTS via Gemini API fica em **zona
proibida pelos termos do próprio fornecedor**. Isso é **interpretação jurídica pendente, não
conclusão nossa**: pode haver leitura de que o "API Client" é o software do Rebeca (ferramenta
profissional) e não o canal publicado — mas isso **precisa de decisão jurídica registrada em ADR
antes de escalar**. É o achado mais importante deste dossiê e afeta D2, `rebeca-lgpd` e
`rebeca-infantil` ao mesmo tempo.

### 8.7 Ficha técnica consolidada: fps, resolução, aspect ratio, áudio nativo

O projeto exige **1920×1080 (16:9) a 30 fps** no longo e **1080×1920 (9:16)** no Short. O que a
documentação oficial publica:

| provedor | model id | **fps documentado** | resoluções | 16:9 | 9:16 | áudio nativo | duração / extensão |
|---|---|---|---|---|---|---|---|
| Alibaba Wan | `wan3.0-video` / `-prime` | **30 fps** — *"can generate videos up to 30 seconds long at 30fps"*; `usage.fps` *"Default value: 30"* (resposta de exemplo `"fps": 30`) | **1080P (default)**, 720P, 480P | **Sim** | **Sim** | **Sim** — `parameters.audio` default `true`, e *"Enabling or disabling audio does not affect pricing"* | **até 30 s** por chamada + **Video Extension documentada** |
| Runway | `gen4.5` | **24 ou 25 fps** (*"Choose between 24 or 25fps in the Advanced settings"*) | **720p** (output resolution) | Sim (1280×720) | Sim (720×1280) | **Não** (áudio é produto separado no catálogo) | 2–10 s; sem extensão documentada |
| Runway | `gen4_turbo` | **24 fps** | **720p** | Sim | Sim | **Não** | 5 s ou 10 s |
| Runway | `act_two` | **24 fps** | **720p** | Sim | Sim | Áudio vem da **performance de entrada**, não é gerado | **até 30 s** |
| Luma | `ray-3.2` | **24 fps** (grade `duration × 24fps`: 5s → 0–120) | 360p / 540p / 720p / 1080p | Sim | Sim | **Não declarado** | 5 s e 10 s + **extensão documentada** (forward/backward por `generation_id`) |
| Kling | `kling-o1` | **24 fps** explícito | 720p / 1080p | Sim | Sim | **Não** (`audio: original \| off`) | 3–10 s |
| Kling | 3.0 / 3.0 Omni | **24 fps** — *"The video frame rate is based on 24fps to 60fps (**the frame rate for generating videos is 24fps**)"* (fechado pela auditoria; idêntico no O1) | 720p / 1080p / 4k | Sim | Sim | **Sim** (`settings.audio: native`) | 3–15 s |
| Kling | 2.6 | **`NÃO VERIFICADO`** (a página do 2.6 não publica fps) | 720p / 1080p | Sim | Sim | **Sim** (exige 1080P) | 5 ou 10 s |
| MiniMax | H3 / H3-Max | **24 fps** (tabela oficial de Video Models) | 768P / 2K (H3-Max: 480P / 768P, **sem 2K**) | Sim | Sim | **`NÃO VERIFICADO` quanto a áudio GERADO** — a doc só traz `reference_audio` de entrada | 4–15 s (H3) / 5–15 s (H3-Max) |
| Pika | `pika-2.5` | **`NÃO VERIFICADO`** (nenhum campo de fps) | 720p / 1080p | **`NÃO VERIFICADO`** — **não existe parâmetro `aspect_ratio`** | **`NÃO VERIFICADO`** | **Não** (Pika Soundtrack é operação separada) | t2v **só 5 s**; i2v 5 ou 10 s |
| Alibaba Wan | `wan2.7-t2v` | **`NÃO VERIFICADO`** | 720P / 1080P — publica pixels exatos **1920×1080** e **1080×1920** | **Sim** (default) | **Sim** | **Sim** (dublagem automática / BGM+SFX) | 2–15 s |
| Alibaba Wan | `wan2.2-i2v-plus` | **`NÃO VERIFICADO`** | 480P / 1080P | **Parcial** — sem parâmetro `ratio`; a proporção **vem da imagem de entrada** e a FAQ avisa que a razão exata **não é garantida** | **Parcial** (mesma regra) | **Não** — *"wan2.2 and wan2.1 series models: Generate silent videos by default"* | **fixo em 5 s** |
| Amazon Bedrock | `amazon.nova-reel-*` | **24 fps** | **só 1280×720** | Sim | **NÃO** | **Não** | 6 s fixos; multi-shot 12–120 s |

**Três consequências diretas para a decisão (não são opinião, decorrem da tabela acima):**

1. **Nenhum outro provedor GERA 30 fps nativamente.** Na amostra dos que **documentam fps de geração**
   (Wan 30; Veo 24; Kling 24; MiniMax 24; Runway 24/25; Luma 24; Nova Reel 24), **6 de 7 ficam em
   24/25 fps**, e o único de 30 fps é o **Wan `wan3.0-video`**, que a própria página marca como
   **"Currently in preview"**. *(A versão anterior dizia "a mediana documentada é 24 fps" — afirmação sem
   fonte; substituída pelo quadro com citação acima e na §8.5 item 6 — Errata E7.)* Para os demais,
   existem **duas** rotas oficiais de conformação 24 → 30 fps: o **Runway `enhance_frame_rate`**
   (`POST /v1/video_upscale`, `targetFramerate` aceitando **30**, a **US$ 0,005/s** ≈ **+US$ 0,30/min**)
   e o **`target_fps` 15–240** do modelo Topaz da Pika. São **interpolação/upscale, não geração** — e
   por isso não contradizem a frase acima. Conformar no render (ffmpeg) também serve. Isso é uma
   **decisão de render**, não um detalhe.
2. **1080p também não é universal.** O Runway publica **720p como output resolution** nas três
   variantes (a maior moldura 16:9 é 1280×720) → 1080p exigiria upscale. O caminho de **menor atrito
   para 1080p + 30 fps é o Wan** (`wan2.7-t2v` publica 1920×1080 e 1080×1920 explícitos;
   `wan3.0-video` aceita 1080P a 30 fps).
3. **O pipeline de voz/música separado continua necessário.** Áudio nativo existe só no Kling
   (3.0/3.0 Omni/2.6) e no Wan (3.0 e 2.7). **Runway não gera áudio em vídeo**, a Luma não declara,
   a Pika não gera, o `wan2.2-i2v-plus` é mudo por padrão, e o áudio gerado do MiniMax é
   `NÃO VERIFICADO`. Como o canal Luna usa **TTS próprio em pt-BR**, o áudio nativo é dispensável — e
   no Google ele **dobra o preço** (§8.5 item 1).
4. **Vídeo longo = concatenação de clipes.** Só o Wan `wan3.0-video` (até 30 s + Video Extension) e a
   Luma `ray-3.2` documentam extensão/encadeamento. Em todos os outros, os 420 s do episódio saem de
   **~60 clipes concatenados no render** — o que **já é** o desenho da skill `rebeca-ia-video`.

---

## 9. Geração de imagem

> **Datas de referência:** Gemini API pricing "Last updated 2026-09-24"; Gemini API Additional Terms
> "Effective March 23, 2026"; BFL FLUX API/Developer Terms "Last Revised August 4, 2026"; Midjourney
> ToS "Version Effective Date: May 27, 2026"; Ideogram ToS/API ToS "Last revised: August 14, 2024".

### 9.1 Google — Imagen (encerrado) e Nano Banana (Gemini API)

| model id | capacidade | unidade | preço USD | API? | limites | fonte |
|---|---|---|---|---|---|---|
| `imagen-4.0-generate-001` / `-ultra-` / `-fast-` (**Imagen 4 / Ultra / Fast**) | texto→imagem | por imagem (historicamente) | **`NÃO VERIFICADO`** — não constam da tabela vigente | **NÃO — desligados**: *"Shutdown date 2026-08-17"*, substituição recomendada `gemini-3.1-flash-image` | `NÃO VERIFICADO` | https://ai.google.dev/gemini-api/docs/deprecations |
| `gemini-3.1-flash-image` (**Nano Banana 2**) | T2I, I2I, edição multi-turn, **múltiplas referências incl. personagem** | **por token** (com equivalente por imagem) | entrada **$0,50/1M**; saída de imagem **$60,00/1M** = **$0,045 (0,5K) · $0,067 (1K) · $0,101 (2K) · $0,151 (4K)** por imagem. **Batch (50%)**: $0,022 / $0,034 / $0,050 / $0,076 | Sim | resoluções **0,5K/1K/2K/4K**; aspect ratios da família Gemini 3: `1:1`, `3:2`, `2:3`, `3:4`, `4:3`, `4:5`, `5:4`, **`9:16`**, **`16:9`**, `21:9`; **até 14 referências** (10 objetos + até 4 personagens); **SynthID** | https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-image |
| `gemini-3.1-flash-lite-image` (**Nano Banana 2 Lite**) | T2I, I2I, edição | por token | entrada **$0,25/1M**; saída **$30,00/1M** = **$0,0336/imagem 1K**. Batch: **$0,0168/imagem 1K** | Sim | **só 1K**; **até 14 referências, todas de OBJETOS** — a tabela oficial marca `N/A` para **personagens**; *"Not optimized for multiple reference inputs or multi-turn sequential editing"* | https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite-image |
| `gemini-3-pro-image` (**Nano Banana Pro**) | T2I, I2I, edição, saída intercalada texto+imagem | por token | entrada **$2,00/1M**; saída **$120,00/1M** = **$0,134/imagem (1K e 2K)** e **$0,24 (4K)** | Sim | 1K–4K; **6 objetos + até 5 personagens + até 3 estilos**; *"accurate brand consistency"* | https://ai.google.dev/gemini-api/docs/pricing#gemini-3-pro-image |
| `gemini-2.5-flash-image` (Nano Banana legado) | T2I, I2I, edição | por token | entrada $0,30/1M; saída **$0,039/imagem (1K)** (*"Output images up to 1024x1024px consume 1290 tokens and are equivalent to $0.039 per image"*) | Sim, mas **desligamento anunciado em 2026-10-02** | `NÃO VERIFICADO` | https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash-image |

Toda a família Nano Banana: **SynthID em toda imagem**; Batch com prazo de até 24 h; **tokens de
thinking são cobrados por padrão**.

### 9.2 OpenAI — GPT Image

| model id | unidade | preço USD (Standard, por 1M tokens) | limites |
|---|---|---|---|
| `gpt-image-2.5-sunburst` | por token (imagem entrada + imagem saída + texto) | imagem entrada **$8,00** (cache $2,00) · saída **$30,00** · texto $5,00 ($1,25). **Batch**: $4,00 / **$15,00** / $2,50 | tamanhos recomendados `1024x1024`, `1536x1024`, `1024x1536`; **dimensões customizadas**, múltiplos de 16, **aspect ratio entre 1:3 e 3:1**, nenhum lado > 3840 px, pixels entre 655.360 e 8.294.400; qualidade `low/medium/high/xhigh/max/auto`; `n` múltiplas imagens (máximo `NÃO VERIFICADO`) |
| `gpt-image-2.5-flare` | por token | idêntico ao Sunburst | idem |
| `gpt-image-2` | por token | $8,00 / $30,00 / $5,00. Batch $4,00 / $15,00 | qualidade até `high` |
| `gpt-image-1.5` | por token | $8,00 / **$32,00** / $5,00. Batch $4,00 / $16,00 | qualidade até `high` |
| `gpt-image-1-mini` | por token | imagem entrada **$2,50** (cache $0,25) · saída **$8,00** · texto $2,00 | `NÃO VERIFICADO` |
| `gpt-image-1` | por token | imagem entrada **$10,00** · saída **$40,00** · texto $5,00 — **o mais caro da linha** | edição aceita múltiplas referências (exemplo oficial com 4); máximo `NÃO VERIFICADO` |

Fonte: https://developers.openai.com/api/docs/pricing · https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst.md
**Limitação oficial de consistência (crítico):** *"While capable of producing consistent imagery,
the model may occasionally struggle to maintain visual consistency for recurring characters or brand
elements across multiple generations."* — https://developers.openai.com/api/docs/guides/image-generation.md
**Licenciamento/ownership da OpenAI: `NÃO VERIFICADO`** — todo `openai.com/policies/*` retornou **HTTP 403**.

### 9.3 Black Forest Labs — FLUX (API oficial BFL)

Regra oficial de crédito: **1 crédito = $0,01**, "per image, or per second for video".

| model id | unidade | preço USD | referências | uso comercial |
|---|---|---|---|---|
| FLUX.2 `[max]` | por megapixel | **a partir de $0,07** | até **8** (API) / 10 (playground) | Você é dono do Output; *"You and your End Users may use Outputs for your or their own personal or commercial purposes"* (Developer ToS §3.b/§4.b). **⚠️ Proibido subir imagem/vídeo/dado pessoal de MENORES DE 18 ANOS (§6.k)** |
| FLUX.2 `[pro]` | por megapixel | **a partir de $0,03** (t2i) · **a partir de $0,045** (edição); lote de 4 = a partir de $0,12 | até **8** | idem |
| FLUX.2 `[flex]` | por megapixel | **a partir de $0,05** na tabela, mas a visão geral publica **$0,06/MP → divergência entre duas páginas oficiais** | até **8** | idem |
| FLUX.2 `[klein] 4B` | por megapixel | **a partir de $0,014**; doc: $0,014 + $0,001/MP (2 MP = $0,015) | até **4** | idem; licença **Apache 2.0** |
| FLUX.2 `[klein] 9B` | por megapixel | **a partir de $0,015**; doc: $0,015 + $0,002/MP | até **4** | idem; licença **FLUX Non-Commercial** (pesos) |
| FLUX.2 `[dev]` | — | **sem API hospedada** (local) | máx. recomendado 6 | **não comercial** → inadequado para canal monetizado |
| `FLUX1.1 [pro]` | por imagem | **$0,04** (4 créditos) | `NÃO VERIFICADO` | idem BFL |
| `FLUX1.1 [pro] Ultra` / `Raw` | por imagem | **$0,06** | `NÃO VERIFICADO` | idem |
| `FLUX.1 Kontext [pro]` / `[max]` | por imagem | **$0,04** / **$0,08** | `NÃO VERIFICADO` | idem |
| `FLUX.1 Fill [pro]` | por imagem | **$0,05** | `NÃO VERIFICADO` | idem |

Fonte: https://docs.bfl.ai/quick_start/pricing · https://docs.bfl.ai/flux_2/flux2_overview · https://bfl.ai/legal/developer-terms-of-service
**Batch NÃO tem desconto na BFL** (*"Batch requests multiply the base cost by the number of images"*).
Resolução máx. e aspect ratios por modelo: **`NÃO VERIFICADO`**.

### 9.4 Ideogram, Recraft, Midjourney, Stability

| provedor | model id | unidade | preço USD | API? | uso comercial | fonte |
|---|---|---|---|---|---|---|
| Ideogram | API v4 (`POST /v1/ideogram-v4/generate`), v3 | por crédito pré-pago | **`NÃO VERIFICADO`** — as páginas oficiais `/api-pricing` e `/pricing?pricing_tab=api` renderizam via JS e devolvem *"Loading current pricing."* | **Sim** (`api.ideogram.ai`) | *"We do not claim any ownership rights in your User Input or User Output, and we do not restrict your ability to use User Output for your own purposes (including for commercial purposes)"* (ToS §2.1). **Exige atribuição na API**: *"identify ... that any User Output ... was created by the Ideogram AI Model (e.g., via a 'Powered by Ideogram' tagline)"* (API ToS §2.3.1) | https://ideogram.ai/legal/api-tos/ |
| Recraft | `Recraft V4.1 Flash` | por imagem | **$0,007** (7 units) | Sim | **Plano pago → *"full ownership and commercial rights"*; plano FREE → imagens *"remain the property of Recraft"* e sem licença comercial.** Assets não podem treinar IA | https://www.recraft.ai/docs/api-reference/pricing |
| Recraft | `V4.1` / `V4.1 Utility` | por imagem | **$0,035** | Sim | idem | idem |
| Recraft | `V4.1 Pro` / `Utility Pro` | por imagem | **$0,21** | Sim | idem | idem |
| Recraft | `V4` / `V4 Pro` | por imagem | **$0,04** / **$0,25** | Sim | idem | idem |
| Recraft | `V3` (I2I, inpaint, outpaint, fundo) | por imagem | **$0,04** | Sim | idem | idem |
| Recraft | utilitários | por requisição | remoção de fundo $0,01 · crisp upscale $0,004 · **creative upscale $0,25** · erase $0,002 · prompt enhancement $0,01 | Sim | idem | idem |
| Midjourney | V8.2 (web/Discord) | assinatura (não há API) | **`NÃO VERIFICADO`** | **API oficial: NÃO disponível** — nenhuma API pública documentada e os ToS **proíbem acesso automatizado**: *"You may not use automated tools to access, interact with, or generate Assets through the Services"* | *"You own all Assets You create with the Services to the fullest extent possible under applicable law"*, exceto empresa com **receita > US$ 1.000.000/ano**, que precisa de plano **Pro ou Mega** para possuir os Assets | https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service |
| Stability AI | Stable Image Ultra (SD 3.5 Large) | por crédito (1 crédito = **$0,01**) | **8 créditos = $0,08** | Sim | *"we assign to you all of our right, title, and interest (if any) in the Outputs... you own the Output"* (ToS §4.a). **⚠️ Idade mínima 18+** para todos os serviços que não sejam de áudio (§2.b). Proibido remover marca-d'água/proveniência | https://platform.stability.ai/pricing · https://stability.ai/terms-of-service |
| Stability AI | SD 3.5 Large / Large Turbo / Medium / Flash | por imagem | **$0,065 / $0,04 / $0,035 / $0,025** | Sim | idem | idem |
| Stability AI | Stable Image Core / SDXL 1.0 | por imagem | **$0,03 / a partir de $0,009** | Sim | idem | idem |
| Stability AI | Edit (Erase, Inpaint, Outpaint, Remove BG, Recolor, Replace BG) | por requisição | **$0,05 / $0,05 / $0,04 / $0,05 / $0,05 / $0,08** | Sim | idem | idem |
| Stability AI | Control (Structure, Sketch, Style Guide, **Style Transfer**) | por requisição | **$0,05 / $0,05 / $0,05 / $0,08** | Sim | idem; Style Transfer descrito como *"Apply visual styles from reference images to a target image to maintain consistency across content"* | idem |
| Stability AI | Upscale Creative / Conservative / Fast | por requisição | **$0,60 / $0,40 / $0,02** | Sim | idem | idem |

### 9.5 Consistência de personagem — o requisito mais crítico do Rebeca

| provedor | recurso oficial | limite oficial de referências | fonte |
|---|---|---|---|
| Google | referências de **personagem** (Nano Banana 2 e Pro) | 3.1 Flash Image: **10 objetos + até 4 personagens**; 3 Pro Image: **6 objetos + até 5 personagens + 3 estilos**; **3.1 Flash Lite: 14 objetos e `N/A` personagens** | https://ai.google.dev/gemini-api/docs/image-generation |
| Black Forest Labs | **multi-referência** (exemplo oficial: *"8 consistent characters from reference images"*) | `[klein]` **até 4**; `[max]`/`[pro]`/`[flex]` **até 8** na API (10 no playground) | https://docs.bfl.ai/flux_2/flux2_overview |
| Ideogram | **character reference** documentado + Face Swapping via Edit | `NÃO VERIFICADO` | https://developer.ideogram.ai/ideogram-api/api-overview |
| Stability AI | **Style Transfer** + Control (Structure/Sketch/Style Guide) | `NÃO VERIFICADO` | https://platform.stability.ai/pricing |
| OpenAI | **não há recurso dedicado**; edição aceita múltiplas referências (exemplo oficial com 4) | `NÃO VERIFICADO` — e a doc **admite fragilidade** com personagens recorrentes | https://developers.openai.com/api/docs/guides/image-generation.md |
| Recraft | **não há recurso dedicado**: *"Recraft doesn't offer a dedicated character-tracking feature"* | `NÃO VERIFICADO` | https://www.recraft.ai/docs/best-practices/character-consistency |
| Midjourney | `NÃO VERIFICADO` | `NÃO VERIFICADO` | https://docs.midjourney.com/hc/en-us |

### 9.6 Observações de imagem

1. **A unidade de cobrança não é comparável.** Google e OpenAI cobram **por token** (o custo depende de
   resolução, qualidade e tamanho do prompt); BFL cobra **por megapixel**; Recraft, Ideogram e
   Stability cobram **por imagem/requisição**. Para o `.rebeca/custos.csv`, só Google/OpenAI/BFL exigem
   cálculo por ativo; os outros têm preço fixo por chamada.
2. **Rascunho barato + render final caro é um fluxo de dois passos** em qualquer provedor: no Google o
   "preço por imagem" varia de **$0,045 (0,5K)** a **$0,151 (4K)** (Nano Banana 2) e a Lite só faz 1K
   a **$0,0336**; a doc da OpenAI recomenda `quality: "low"` para rascunho.
3. **Thinking é cobrado no Google** (*"thinking tokens are billed by default for thinking models"*).
4. **Batch é o único desconto estrutural documentado:** Google **50%**; OpenAI **50%** (saída de
   imagem $30 → $15/1M); **BFL não dá desconto em batch**.
5. **Billing em falha/retry: `NÃO VERIFICADO` em TODOS os provedores de imagem** → um retry pode ser
   uma segunda cobrança integral. O idempotency key do pipeline é o que evita pagamento duplo.
6. **Links de imagem da Ideogram expiram** — é obrigatório baixar e persistir no Storage do canal.
7. **Proveniência obrigatória:** Google aplica **SynthID**; a BFL embute **Content Credentials** e
   proíbe removê-las; a Stability proíbe remover marca/proveniência.
8. **Free tier do Google alimenta treino** (*"Content used to improve our products"* = **Yes** no free,
   **No** no pago) → para produção do Rebeca, só o tier pago é aceitável.
9. **Alerta infantil (bloqueante em vários provedores):** a **BFL proíbe** subir imagens/dados de
   **menores de 18 anos** (§6.k) → **não dá para usar foto de criança como referência**; a
   **Stability exige 18+**; a **Google** proíbe uso em serviço *"likely to be accessed by individuals
   under the age of 18"* (ver §8.6).

### 9.7 Lacunas de imagem (`NÃO VERIFICADO`)

| # | Lacuna | Provedor | Motivo |
|---|---|---|---|
| 1 | Preço de **Imagen 4 / Fast / Ultra** | Google | modelos **desligados em 2026-08-17**, fora da tabela vigente |
| 2 | Preço **por imagem** da API v3/v4 | Ideogram | páginas oficiais renderizam via JS (*"Loading current pricing."*) |
| 3 | Preço/planos e limites | Midjourney | não há API; páginas oficiais retornam **HTTP 403** (Cloudflare) |
| 4 | **Resolução máx. e aspect ratios** (16:9 / 9:16) | BFL | não publicados nas páginas de visão geral lidas |
| 5 | Resolução máx., aspect ratios e nº de imagens por chamada | Recraft, Ideogram, Stability, OpenAI | não publicados nas páginas lidas |
| 6 | **Licenciamento/ownership** | OpenAI | todo `openai.com/policies/*` retorna **HTTP 403** |
| 7 | Preço de **imagem na Vertex AI** | Google | página JS-renderizada |
| 8 | Matriz completa de aspect ratios por modelo Gemini | Google | a lista nova é atribuída ao 3.1 Flash Lite; `1:4/4:1/1:8/8:1` citados só para o 3.1 Flash Image |
| 9 | **Cobrança em erro/retry** de imagem | Todos | nenhuma página oficial lida declara |
| 10 | **Disponibilidade regional (Brasil)** | Ideogram, Midjourney, Recraft, Stability, BFL, OpenAI | só o Google tem página oficial de regiões, e **Brasil está na lista** |
| 11 | Política específica de **conteúdo infantil** (imagem de criança, COPPA) | Todos | não tratada nas páginas de preço/limites lidas |
| 12 | Preço do **FLUX.2 [klein] Base** e fine-tuning fora do beta | BFL | Klein Base é distribuição em Hugging Face, sem preço de API |
| 13 | **Divergência oficial de preço do FLUX.2 [flex]** ($0,05/MP na tabela vs $0,06/MP na visão geral) | BFL | duas páginas oficiais divergem — registrado sem arbitragem |

---

## 10. Estimativa de custo por minuto (US$/min)

### 10.1 Aritmética base (derivada das premissas do §5)

```
n_shots                = 60
duração_alvo           = 420 s (7,0 min)
dur_clipe_s (P5)       = 8 s   ->  segundos_gerados = 60 × 8 = 480 s por passe
segundos_video_pagos   = 60 × fator_retrabalho × 8 s
                       = 60 × 1,5 × 8 = 720 s        (cenário-base)
imagens                = 60 × 2 = 120 imagens         (P7, fixo)
caracteres_voz         = 7 min × 150 palavras/min × 5,5 car./palavra = 5.775 caracteres
                       = 0,005775 milhão de caracteres
```

**Fator de retrabalho (P6, corrigido):** `1,5` no cenário-base = **33,3% de rejeição total**
(`1 − 1/1,5`); `2,0` = 50% de rejeição. **É uma premissa do projeto, não um dado verificado** — é o
parâmetro mais sensível de toda a conta.

> ⚠️ **Esta seção foi integralmente refeita na errata.** A versão anterior usava clipe de **7 s**
> (`0,08 × 420 × 1,5`), contradizendo a P5 e a §10.6, e subestimava o vídeo em **14,29%**. Ver Errata E1.

### 10.2 Custo por componente (números verificados × aritmética)

| componente | provedor/modelo | preço verificado | aritmética | custo |
|---|---|---|---|---|
| **Vídeo** (baixo) | MiniMax-H3 768P | **$0,08/s** | 0,08 × 60 × 1,5 × 8 | **$57,60** |
| **Vídeo** (médio) | Wan `wan3.0-video` 1080P **30 fps** — região **Singapore** | **$0,20/s** | 0,20 × 60 × 1,5 × 8 | **$144,00** |
| **Vídeo** (médio′) | Wan `wan3.0-video` 1080P — regiões **US-Virginia / Beijing / Tokyo / Frankfurt / Hong Kong** | **$0,165025/s** | 0,165025 × 60 × 1,5 × 8 | **$118,82** |
| **Vídeo** (alto) | Wan `wan3.0-video` 1080P Singapore, retrabalho **2,0** | **$0,20/s** | 0,20 × 60 × 2,0 × 8 | **$192,00** |
| **Imagem** (baixo) | BFL FLUX.2 `[klein] 4B` | **$0,014/imagem** | 0,014 × 120 | **$1,68** |
| **Imagem** (médio) | BFL FLUX.2 `[pro]` (até 8 refs) | **$0,03/imagem** | 0,03 × 120 | **$3,60** |
| **Imagem** (alto) | BFL FLUX.2 `[max]` | **$0,07/imagem** | 0,07 × 120 | **$8,40** |
| **Voz** (baixo) | Azure `S1` Neural TTS | **$15,00/1M car.** | 15,00 × 0,005775 × 1,2 | **$0,1040** |
| **Voz** (médio) | Azure Neural **HD** | **$22,00/1M car.** | 22,00 × 0,005775 × 1,2 | **$0,1525** |
| **Voz** (alto) | OpenAI `tts-1-hd` | **$30,00/1M car.** | 30,00 × 0,005775 × 1,2 | **$0,2079** |
| **Música** | Suno Pro (US$ 10/mês ÷ 20 downloads) | **$0,50/faixa** | 0,50 × 1 | **$0,50** |
| **SFX** | ElevenLabs Sound Effects | 40 créditos/s, **USD `NÃO VERIFICADO`** | — | **`NÃO VERIFICADO`** |
| **Insumo de imagem do MiniMax** | primeiras 5 imagens grátis, **$0,04/imagem adicional** | **$0,04/imagem** | 120 refs em 60 planos = 2/plano → **não excede as 5 primeiras por chamada** → **$0,00** nesta configuração | **$0,00** |
| **Short 9:16** | ffmpeg crop do longo | US$ 0 (CPU local) | — | **$0,00** |
| **Legenda / Render** | da timeline do TTS / ffmpeg local | US$ 0 | — | **$0,00** |
| **Tokens de LLM** | roteiro/storyboard/prompts | fora do escopo da D2 | — | não incluído |

### 10.3 Total e US$/min por stack (aritmética corrigida)

| stack | composição | soma | ÷ 7,0 min |
|---|---|---|---|
| **A — Enxuta** | vídeo $57,60 + imagem $1,68 + voz $0,1040 + música $0,50 | **$59,88** | **$8,55/min** |
| **B — Equilibrada (Wan Singapore)** | vídeo $144,00 + imagem $3,60 + voz $0,1525 + música $0,50 | **$148,25** | **$21,18/min** |
| **B′ — Equilibrada (Wan US-Virginia)** | vídeo $118,82 + imagem $3,60 + voz $0,1525 + música $0,50 | **$123,07** | **$17,58/min** |
| **C — Alta qualidade (retrabalho 2,0)** | vídeo $192,00 + imagem $8,40 + voz $0,2079 + música $0,50 | **$201,11** | **$28,73/min** |
| **C″ — C com "duas gerações literais por plano"** | vídeo $288,00 + imagem $8,40 + voz $0,2079 + música $0,50 | **$297,11** | **$42,44/min** |

**Faixa: US$ 8,55 – US$ 28,73 por minuto** no quadro de premissas corrigido (ou **US$ 42,44/min** no
cenário de duas gerações literais). Episódio de 7 min: **de US$ 59,88 a US$ 201,11**.

**⚠️ Consequência direta para o teto:** a stack recomendada **B**, no preço de **Singapore**
(US$ 0,20/s), dá **US$ 21,18/min** — **acima do teto provisório de US$ 20/min** proposto na versão
anterior. Com **US-Virginia** (US$ 0,165025/s) ela cai para **US$ 17,58/min** e **cabe**. Ou seja:
**a região de contratação do Wan é uma decisão da D2, junto com o teto — não um detalhe de deploy.**

### 10.4 Sensibilidade: o que move o número

Base = stack B (Wan, imagem `[pro]`, voz Azure HD). Cada linha troca **uma** variável.

| Cenário | Aritmética | US$/min |
|---|---|---|
| Retrabalho cai para **1,0** (0% de rejeição) | 0,20 × 60 × 1,0 × 8 = $96,00 + $3,60 + $0,1525 + $0,50 = **$100,25** | **$14,32** |
| Retrabalho sobe para **2,0** (50% de rejeição) | 0,20 × 60 × 2,0 × 8 = $192,00 + $3,60 + $0,1525 + $0,50 = **$196,25** | **$28,04** |
| **Duas gerações literais por plano** (1,5 × 2 = 3,0) | 0,20 × 60 × 3,0 × 8 = $288,00 + $3,60 + $0,1525 + $0,50 = **$292,25** | **$41,75** |
| Wan US-Virginia (resto igual) | $118,82 + $3,60 + $0,1525 + $0,50 = **$123,07** | **$17,58** |
| Trocar Wan por **MiniMax-H3 2K** ($0,13/s) | 0,13 × 60 × 1,5 × 8 = $93,60 + $3,60 + $0,1525 + $0,50 = **$97,85** | **$13,98** |
| Trocar Wan por **Runway `gen4_turbo`** ($0,05/s) | ⚠️ o modelo **só gera 5 s ou 10 s** → clipe de **10 s**: 0,05 × 60 × 1,5 × 10 = $45,00 + $3,60 + $0,1525 + $0,50 = **$49,25** | **$7,04** |
| ↳ o mesmo, se o clipe pudesse ser de 8 s | 0,05 × 60 × 1,5 × 8 = $36,00 + $4,25 = **$40,25** | $5,75 |
| **Short gerado nativamente** (45 s em 9:16) em vez de recortado | +0,20 × 45 × 1,5 = **+$13,50** no episódio | **+$1,93** |
| Conformação de fps 24→30 no Runway (`enhance_frame_rate`) | 1 crédito/2 s = **$0,005/s** × 420 s = **+$2,10** | **+$0,30** |

> **Divergências declaradas com o QA (não copiei os números dele):**
> - **Runway `gen4_turbo`:** o QA publicou **$6,91/min**; eu chego a **$7,04/min** por usar **120
>   imagens** (P7 corrigido) em vez de 90. A diferença é exatamente esse item ($0,90/7 = $0,13).
> - **Duas gerações literais:** o QA/pai citaram **$42,44/min** para a stack C (que tem imagem `[max]`
>   e voz `tts-1-hd`); a linha equivalente aqui usa os itens da **stack B** ($41,75). São recortes
>   diferentes, não erro de conta.
> - **Google (§10.6):** o QA calculou **$5,57/min** com 90 imagens; com as **120** corrigidas, **$5,72/min**.

**O vídeo é ~97% do custo.** Imagem e voz juntas ficam abaixo de US$ 4 por episódio em qualquer
stack. Qualquer negociação de custo que não seja sobre **preço por segundo × duração do clipe × região
× fator de retrabalho** não move a agulha.

### 10.5 Armadilhas de custo que a planilha ingênua não vê

1. **Clonagem de voz Azure (CNV) é economicamente absurda no início.** A **hospedagem do endpoint**
   custa **US$ 4,032/hora** (verificado, igual em `brazilsouth`): `4,032 × 24 h × 30 d = US$ 2.903,04/mês`
   por endpoint. Dividido por episódios: **4 episódios/mês → US$ 725,76/episódio → US$ 103,68/min**;
   só com **100 episódios/mês** cai para **US$ 29,03/episódio → US$ 4,15/min**. Somam-se **treino
   US$ 52,00/hora** e **síntese US$ 24,00/1M caracteres**. → Voz clonada treinada **não** é caminho de
   custo no começo; voz prebuilt (`pt-BR-LeticiaNeural`) custa **US$ 0,0124/min**.
2. **O gargalo da música é download, não crédito.** Suno Pro: US$ 10/mês ÷ **20 downloads/mês** =
   **US$ 0,50 por faixa** liberada para uso comercial (no pior caso, usando toda a cota só com música).
3. **Falha/retry pode ser cobrado duas vezes.** Para imagem, **todos** os provedores ficaram
   `NÃO VERIFICADO` quanto a cobrança em erro; em vídeo, quem **reembolsa/não cobra** está identificado
   (MiniMax, Pika, Runway exceto `SAFETY.INPUT.*`, Luma) e quem **não documenta** também (Kling,
   Alibaba). **Linha que faltava (achado do QA):** na Luma, `budget_exhausted` = *"Partial charge
   possible"* — ou seja, **estourar o teto de gasto ainda pode gerar cobrança parcial**. → A
   idempotency key antes da chamada paga (invariante 6 do `AGENTS.md`) é o único controle real aqui.
4. **Insumo de imagem é cobrado à parte no MiniMax.** `MiniMax-H3`: **as 5 primeiras imagens grátis,
   US$ 0,04 por imagem adicional** (H3-Max: 2 grátis, **US$ 0,074** adicional). Nesta configuração
   (2 refs/plano por chamada) não há cobrança, mas **se o retrabalho empilhar referências na mesma
   chamada, entra custo** que não está em nenhuma stack. O Runway cobra **2 créditos por imagem de
   referência/keyframe** no `hailuo3` (US$ 0,02 cada).
5. **Batch é desconto de 50% em imagem (Google/OpenAI) e zero na BFL** — mas batch tem prazo de até
   24 h, o que não serve para o ciclo de revisão humana do Rebeca.
6. **O Short não dilui custo.** Recortado do longo, ele custa US$ 0 **e não cria minuto novo**; se for
   gerado nativamente em 9:16, **acrescenta** custo (+US$ 1,93/min no exemplo acima).

### 10.6 O caminho Google seria ~3,7× mais barato — e é justamente o bloqueado

Custo de oportunidade, agora com **o mesmo fator de retrabalho (1,5)** das stacks não-Google e as **120
imagens** corrigidas (antes o Google era calculado a 1,0 passe — Errata E7):

| componente | modelo | aritmética | custo |
|---|---|---|---|
| Vídeo | Veo 3.1 **Lite** 720p | 0,05 × 60 × 1,5 × 8 = $36,00 | $36,00 |
| Imagem | Nano Banana 2 **Lite** 1K | 0,0336 × 120 = $4,03 | $4,03 |
| Voz | Google Cloud TTS | preço **`NÃO VERIFICADO`** | — |
| Música | Lyria | preço **`NÃO VERIFICADO`** | — |
| **Total parcial** | | $40,03 | **≥ $5,72/min** |

**Razão honesta contra a stack B corrigida:** $21,18 ÷ $5,72 = **≈3,7×** (não "≈5×" como a versão
anterior afirmava). A conclusão — o Google é muito mais barato — **sobrevive**; a grandeza divulgada, não.

**Mesmo cenário com áudio nativo (Veo 3.1 Standard):** 0,40 × 60 × 1,5 × 8 = $288,00 → **$41,14/min** só
de vídeo, ou seja **mais caro que qualquer stack não-Google** — o áudio nativo **dobra** o preço
(§8.5 item 1) e o canal Luna **já tem TTS próprio**, então não precisa dele.

> **Conclusão do §10 (corrigida):** o piso realista **monetizável e contratualmente defensável** hoje é
> **≈ US$ 8,55/min** (stack A) e o cenário-base é **US$ 17,58/min** (stack B′ com Wan em US-Virginia) ou
> **US$ 21,18/min** (stack B com Wan em Singapore). O que domina o custo é o **preço por segundo de
> vídeo × duração do clipe × região × fator de retrabalho** — e o retrabalho é consequência direta da
> **consistência de personagem**, exatamente onde os provedores de imagem diferem mais (§9.5).

---

## 11. Recomendação (stacks candidatas)

### 11.1 O critério não é preço — é "posso monetizar sem violar contrato?"

A pergunta que a D2 precisa responder é: **qual stack entrega 16:9 1080p + 9:16, com consistência de
personagem, que o Rebeca possa usar comercialmente num canal INFANTIL sem violar contrato?** O
levantamento de cláusulas de idade/público menor (§8.6, §6.3 e auditoria dedicada) dá este quadro:

| Provedor | Cláusula de idade/público menor | Leitura para o canal Luna | Risco |
|---|---|---|---|
| **Google** (Veo/Imagen/Lyria/TTS) | Additional Terms, vig. **23/03/2026**: 18+ e *"will not use the Services as part of a … service … directed towards or is likely to be accessed by individuals under the age of 18"* | Atinge o canal em cheio | **BLOQUEANTE** |
| **ElevenLabs** (voz) | **BLOQUEIO CORRETO, RAZÃO CORRIGIDA (Errata E10).** O fundamento é **PUP (17/08/2026) item 9(r), 2ª metade**: proíbe *"otherwise using our Services to make available **bundled solutions that target** anyone under the age of 13"* — isso é cláusula de **público-alvo**. As outras duas citações **não** sustentam bloqueio de output: a Privacy §11 proíbe **upload** de Voice Data de menor (eixo **insumo**) e a regra da **Voice Library** é de **compartilhamento** (eixo conta). Consequência: um produto futuro para público **13+** com personagem infantil sintética **não** está coberto por este bloqueio | Público anônimo no YouTube não permite consentimento parental; canal 3–5 anos é "solução empacotada dirigida a menor de 13" | **BLOQUEANTE** |
| **Cartesia** (voz) | AUP (23/07/2025): proíbe Output que *"relate to or represent individuals under the age of 18"* | Personagem infantil **é** Output que representa menor | **BLOQUEANTE** |
| **Udio** (música) | ToS proíbe baixar/distribuir Output em plataforma de conteúdo de usuário, **citando "YouTube" nominalmente**; download desabilitado desde 17/02/2026 | Inutilizável para trilha de canal | **BLOQUEANTE** |
| **Runway** | Usage Policy (06/03/2026) proíbe *"Characters or games that are intended to engage users under the age of 18…"* — **escopada ao produto "Runway Characters & Game Worlds"** | Cláusula de **produto específico**; `gen4.5`/`gen4_turbo` são geração de vídeo geral. **Não é bloqueio claro, mas é risco a confirmar por escrito** | **condicional** |
| **Pika** | AUP (16/05/2025): *"You must not upload any images that depict or appear to depict individuals under the age of 18"*; ToS §5(e): gate 18+/consentimento parental para end users | Restringe **insumo** (imagem de referência), não a audiência. Personagem animado fictício é zona cinzenta | **condicional** |
| **Black Forest Labs** (imagem) | Developer Terms §6(k) (04/08/2026): proíbe subir imagem/vídeo/dado pessoal *"relating to individuals under the age of 18"*. **ToS, citação direta:** *"You must be 18 years of age or older to use the Services."* | **Mesmo problema do Pika, no provedor de imagem da stack recomendada**: referência de personagem **infantil** é zona cinzenta | **condicional (atenção)** |
| **Luma** | COPPA-protected personal data é **"Prohibited Data"** (Enterprise ToS §2.5(b)); conta 18+; ToS diz que os Serviços são *"intended for visitors located within the United States"* | Restringe insumo + região (EUA) | **condicional** |
| **Recraft / Stability** | Recraft: 18+ no serviço e na API (11/08/2026). Stability: 18+ (ToS §2.b); AUP (30/09/2026) só proíbe **explorar/abusar** de menor | 18+ é a **conta**, não o conteúdo: libera personagem infantil fictício | **aparentemente livre** |
| **OpenAI** (imagem/TTS) | Business Terms (01/01/2026) §3.3(c): proíbe *"allow minors to use OpenAI Services without consent from their parent or guardian"* — **não há cláusula de público-alvo** | Semanticamente o mais permissivo; **mas não autoriza por escrito** | **aparentemente livre / `NÃO VERIFICADO` quanto a autorização** |
| **Azure AI Speech** | Limited Access + transparency note **admitem** casos *"intended for minors or children"*, exigindo **divulgação clara aos pais**; lista *"Media: Entertainment … fictional brand or character voice"* como uso aprovado de CNV. ⚠️ **A obrigação de divulgação vale para TODAS as vozes, inclusive a prebuilt** — a página diz *"Microsoft requires its customers to disclose the synthetic nature of text to speech voices to its users"*, sem qualificar (Errata E11) | É a única fonte oficial que **reconhece** o caso de uso de personagem fictício; a divulgação é requisito da stack A/B, não detalhe de CNV | **aparentemente livre (com divulgação obrigatória)** |
| **Kling / MiniMax / Ideogram / Midjourney / AWS Bedrock** | Nenhuma cláusula de idade ou de público-alvo localizada. Kling: ToS exige **13+** de conta (*"Anyone under the age of 13 … shall not use the Services"*); MiniMax: só consentimento do responsável para menor de 18; Ideogram e Midjourney: **13+**; AWS: AUP/Responsible AI Policy sem requisito de idade | Sem barreira contratual de **audiência** localizada | **aparentemente livre quanto a idade** |
| **Alibaba Wan** | **`NÃO VERIFICADO`** — os termos gerais lidos não têm cláusula de idade, mas os **termos específicos do Model Studio não foram alcançados** (a URL oficial é um **índice de 6 documentos**: Product Terms of Service, Model Inference SLA, Membership Agreement, Privacy Policy, Open Source Model License Terms e Third Party Vendor Terms). **Mitigação nova:** o **Runway revende o `wan3`** (US$ 0,05/0,10/0,20 por s em 480p/720p/1080p) e o `h3_max` (US$ 0,05/0,08) — troca o **contratante** para a Runway, cujos termos **foram lidos** | Lacuna de **produção** da stack recomendada, não de custo. A revenda resolve o contratante, **mas não dá o desconto de região** (o Runway cobra o preço de Singapore) | **`NÃO VERIFICADO` (mitigável por revenda)** |

> **Ressalva metodológica:** "aparentemente livre" = **nenhuma cláusula localizada**, o que **não é o
> mesmo que autorização**. Ausência de cláusula não é licença.

### 11.2 As stacks candidatas (todas não-Google) — números corrigidos na errata

**Stack A — Enxuta (piso de custo) — US$ 8,55/min (US$ 59,88/episódio)**
- Vídeo: **MiniMax-H3 768P** — $0,08/s · **24 fps** (documentado) · 4–15 s · 16:9 e 9:16 confirmados
- Imagem: **BFL FLUX.2 `[klein] 4B`** — $0,014/imagem · até 4 referências
- Voz: **Azure `S1` Neural TTS** — $15/1M caracteres · voz infantil pt-BR **prebuilt** (`pt-BR-LeticiaNeural`)
- Música: **Suno Pro** — $0,50/faixa
- **Trade-offs:** a mais barata. 768P exige **upscale** para 1080p e 24 fps exige **conformação** para 30.
  Consistência de personagem limitada a 4 referências. A §6(k) da BFL (insumo de menor) continua valendo;
  trocar a imagem por **Stability SD 3.5 Flash ($0,025)** elimina esse ponto.

**Stack B — Equilibrada, Wan em Singapore — US$ 21,18/min (US$ 148,25/episódio) — ⚠️ ESTOURA o teto de US$ 20**
**Stack B′ — Equilibrada, Wan em US-Virginia — US$ 17,58/min (US$ 123,07/episódio) — ✅ cabe no teto**
- Vídeo: **Alibaba Wan `wan3.0-video` 1080P** — **$0,20/s em Singapore** ou **$0,165025/s** nas outras cinco
  regiões (US-Virginia, Beijing, Tokyo, Frankfurt, Hong Kong) · **30 fps nativo** · até **30 s por clipe** ·
  16:9 e 9:16 · **áudio sem sobretaxa** (e desligável sem alterar o preço) · Video Extension documentada
- Imagem: **BFL FLUX.2 `[pro]`** — $0,03/imagem · **até 8 referências** (melhor consistência fora do Google)
- Voz: **Azure Neural HD** — $22/1M caracteres
- Música: **Suno Pro**
- **Trade-offs:** é a **única stack que atinge 1920×1080@30fps sem upscale nem interpolação**. Em
  compensação: (i) o `wan3.0-video` está marcado **"Currently in preview"**; (ii) **não existe região na
  América do Sul** e **o Brasil não está entre as 6 regiões publicadas** — a latência do Brasil vem de
  Singapore ou Virginia, o que é justamente o que decide o preço; (iii) os **termos específicos do
  Model Studio (Alibaba) não foram alcançados** — mitigável comprando o **mesmo modelo via Runway**, que
  troca o contratante mas **custa o preço de Singapore**; (iv) a §6(k) da BFL é zona cinzenta para
  personagem infantil.

**Stack C — Alta qualidade (retrabalho 2,0 = 50% de rejeição) — US$ 28,73/min (US$ 201,11/episódio)**
- Vídeo: **Wan 3.0 1080P** com **fator de retrabalho 2,0** (60 × 2,0 × 8 = **960 s pagos**)
- Imagem: **BFL FLUX.2 `[max]`** — $0,07/imagem × 120
- Voz: **OpenAI `tts-1-hd`** — $30/1M caracteres (substitui a Cartesia, **bloqueada**; a ElevenLabs também está)
- Música: **Suno Pro**
- **Trade-offs:** compra qualidade com retrabalho. **Não** é a stack para começar.

**Stack C″ — a MESMA stack C sob a outra leitura de "2 passes" — US$ 42,44/min (US$ 297,11/episódio)**
- ⚠️ **Ambiguidade que a errata resolve por escrito (E-nova):** "2 passes" podia significar (i) **fator de
  retrabalho 2,0** ⇒ 960 s pagos ⇒ **US$ 28,73/min**, ou (ii) **duas gerações literais por plano** sobre o
  fator 1,5 ⇒ 60 × 1,5 × 8 × 2 = **1.440 s pagos** ⇒ **US$ 42,44/min**.
- **Este dossiê adota (i)**, que é a leitura coerente com a §10.4 (onde "2,0" é o fator de retrabalho
  pessimista). **A leitura (ii) está publicada acima em C″** e, se for a escolhida pelo humano, a stack C
  **deixa de ser "a opção cara" e vira ~2,4× o teto** — diferença de **US$ 13,71/min ≈ US$ 96 por episódio**.

### 11.3 Recomendação (revisada pela errata)

1. **Piloto na Stack B′ — e a região do Wan precisa ser travada no ADR junto com o teto.** O teto de
   US$ 20/min **só se sustenta com o Wan contratado em US-Virginia (US$ 0,165025/s → US$ 17,58/min)**.
   No preço de **Singapore** (US$ 0,20/s) a mesma stack dá **US$ 21,18/min** e **estoura o teto**. Se o
   caminho for **comprar o `wan3` via Runway** (para fugir dos termos não lidos da Alibaba), o preço é
   **o de Singapore** ($0,20/s) → **também estoura**. → **Decisão explícita exigida:** (a) Alibaba
   US-Virginia a $0,165025/s **com termos ainda não lidos**, ou (b) Runway a $0,20/s **com termos
   lidos**, ou (c) subir o teto para US$ 22/min. **Medir 4 episódios reais** em `.rebeca/custos.csv` e
   recalibrar: o fator de retrabalho (assumido **1,5 = 33,3% de rejeição**) é a premissa mais frágil.
2. **Manter a Stack A como plano B de custo** para semanas de teste de formato, aceitando upscale
   768P→1080p e conformação 24→30 fps.
3. **Não usar o Google (Veo/Imagen/Lyria/TTS) no canal Luna** enquanto a leitura das Additional Terms
   não for decidida por escrito. Os preços continuam no dossiê para o custo de oportunidade.
4. **Não usar ElevenLabs nem Cartesia para voz de personagem infantil** (§6.3). Voz = **Azure**
   (prebuilt infantil pt-BR, **com divulgação obrigatória da natureza sintética — vale para prebuilt, não
   só CNV**) ou **OpenAI TTS**.
5. **Antes de gerar qualquer asset:** parecer de `rebeca-infantil` + `rebeca-lgpd` sobre (a) a §6(k)
   da BFL e o insumo de personagem infantil; (b) a divulgação obrigatória de voz sintética; (c) a
   política de conteúdo "made for kids" do YouTube.
6. **Pista que pode reabrir o Google (não verificada, alto valor):** as próprias *Additional Terms* do
   Google dizem que *"these Terms do not govern your direct use of any Google Cloud Platform service"*.
   Isso levanta a hipótese de que o acesso a Gemini/Imagen/Veo **via Vertex AI (Google Cloud)** ou via
   **revendedor** (Bedrock, fal, Replicate, OpenRouter) esteja sob **outro conjunto de termos**, sem a
   cláusula de público menor. **Vale uma pesquisa dedicada antes de descartar o Google de vez** — é a
   diferença entre **US$ 5,72/min** e **US$ 17,58–21,18/min** (razão ≈3,7×, corrigida na errata).

---

## 12. Fontes

Todas as URLs foram lidas nesta pesquisa. Onde a página oficial não pôde ser lida diretamente pelo
`web_fetch` (truncamento por menu de navegação, renderização por JavaScript ou HTTP 403), o corpo foi
obtido por um **extrator de texto de terceiro aplicado sobre a mesma URL oficial** (`r.jina.ai`) —
declarado caso a caso. **O conteúdo é da página oficial; a mediação é de terceiro.**

### Preços e documentação de API

**Google / Gemini API**
- Preços: https://ai.google.dev/gemini-api/docs/pricing
- Veo: https://ai.google.dev/gemini-api/docs/veo
- Geração de imagem: https://ai.google.dev/gemini-api/docs/image-generation
- Geração de música (Lyria): https://ai.google.dev/gemini-api/docs/music-generation
- Geração de fala: https://ai.google.dev/gemini-api/docs/speech-generation
- Regiões disponíveis: https://ai.google.dev/gemini-api/docs/available-regions *(última atualização 2026-04-29 — **Brasil consta na lista**)*
- Descontinuações (Imagen 4 desligado em 2026-08-17): https://ai.google.dev/gemini-api/docs/deprecations
- Termos adicionais da Gemini API (Effective March 23, 2026): https://ai.google.dev/gemini-api/terms
- Política de uso proibido de IA generativa: https://policies.google.com/terms/generative-ai/use-policy
- Vertex AI / Agent Platform — preços: https://cloud.google.com/vertex-ai/generative-ai/pricing
- Preços de TTS (**página JS, não legível**): https://cloud.google.com/text-to-speech/pricing
- Quotas de TTS: https://docs.cloud.google.com/text-to-speech/quotas
- Chirp 3 HD: https://docs.cloud.google.com/text-to-speech/docs/chirp3-hd
- Chirp 3 Instant Custom Voice: https://docs.cloud.google.com/text-to-speech/docs/chirp3-instant-custom-voice
- Flow Music (consumo): https://www.flowmusic.app/pricing · https://deepmind.google/models/lyria/

**OpenAI**
- Preços da API: https://developers.openai.com/api/docs/pricing
- Sora 2 (desativado em 24/09/2026): https://developers.openai.com/api/docs/models/sora-2.md
- Sora 2 Pro: https://developers.openai.com/api/docs/models/sora-2-pro.md
- Geração de vídeo / descontinuação: https://developers.openai.com/api/docs/guides/video-generation.md
- GPT Image 2.5 Sunburst: https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst.md
- Guia de geração de imagem: https://developers.openai.com/api/docs/guides/image-generation.md
- Guia de TTS: https://developers.openai.com/api/docs/guides/text-to-speech
- Custom voices: https://developers.openai.com/api/docs/guides/custom-voices
- Referência `audio/speech`: https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
- Políticas (**HTTP 403 no acesso direto; lidas via extrator**): https://openai.com/policies/business-terms/ · https://openai.com/policies/terms-of-use/ · https://openai.com/policies/usage-policies/

**Vídeo**
- Runway: preços https://docs.dev.runwayml.com/guides/pricing/ · modelos https://docs.dev.runwayml.com/guides/models/ · falhas https://docs.dev.runwayml.com/errors/task-failures/ · tiers https://docs.dev.runwayml.com/usage/tiers/ · ToS https://runway.com/terms-of-use · fps (central de ajuda) https://help.runwayml.com/hc/en-us/articles/46974685288467-Creating-with-Gen-4-5 · https://help.runwayml.com/hc/en-us/articles/37327109429011-Creating-with-Gen-4 · https://help.runwayml.com/hc/en-us/articles/42311337895827
- Luma: preços https://docs.agents.lumalabs.ai/guides/pricing/ · modelo https://docs.agents.lumalabs.ai/guides/model/ · geração https://docs.agents.lumalabs.ai/guides/videos/generation/ · ToS https://lumalabs.ai/legal/terms-of-service · planos https://lumalabs.ai/pricing · API legada https://docs.lumalabs.ai/docs/video-generation
- Pika: https://dev.pika.art/llms/pika/pika-2.5/text-to-video · https://dev.pika.art/llms/pika/pika-2.5/image-to-video · https://dev.pika.art/models · https://dev.pika.art/agent
- Kling: preços https://kling.ai/document-api/pricing/base/video · capability map https://klingai.com/document-api/guides/capability-map/video · concorrência https://klingai.com/document-api/api/get-started/concurrency-rules · ToS https://kling.ai/docs/user-policy · licença paga (CN) https://klingai.com/document-api/guides/protocols/paid-service · API 3.0 Omni https://kling.ai/document-api/api/video/3-0-omni/text-to-video.md · API O1 https://kling.ai/document-api/api/video/o1/video-omni.md
- MiniMax: https://platform.minimax.io/docs/guides/pricing-paygo · https://platform.minimax.io/docs/guides/pricing-video · https://platform.minimax.io/docs/guides/video-generation · https://platform.minimax.io/docs/guides/models-intro · https://platform.minimax.io/docs/api-reference/video-generation-v2-create · Hailuo ToS https://hailuoai.video/doc/terms-of-service.html
- Alibaba Wan: https://www.alibabacloud.com/help/en/model-studio/model-pricing · https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference · https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-guide · https://www.alibabacloud.com/help/en/model-studio/text-to-video-api-reference · https://www.alibabacloud.com/help/en/model-studio/image-to-video-api-reference · https://www.alibabacloud.com/help/zh/model-studio/image-to-video-api-reference · https://www.alibabacloud.com/help/en/model-studio/model-list-video-generation · **regiões (as 6 publicadas; Brasil não está nelas)**: https://www.alibabacloud.com/help/en/model-studio/regions · **índice dos 6 documentos de termos** (lacuna L2): https://www.alibabacloud.com/help/en/model-studio/related-agreements
- Google (blog oficial) — preço do Veo 3 a **US$ 0,40/segundo** (reforça a unidade "por segundo"): https://developers.googleblog.com/en/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution/
- Pika — **Topaz Video Upscale** (`target_fps` 15–240, inclui 30/29.97): https://dev.pika.art/llms/topaz/topaz-video-upscale/video-upscale
- Kling — API 3.0 Omni / O1 (fps de geração 24 fps): https://kling.ai/document-api/api/video/3-0-omni/video-to-video.md · https://kling.ai/document-api/api/video/o1/video-omni.md
- Ideogram — aviso oficial de que a tabela estática de preços não deve ser usada para decisão de compra: https://docs.ideogram.ai/plans-and-pricing/available-plans.md
- Amazon Bedrock / Nova Reel: https://docs.aws.amazon.com/nova/latest/userguide/video-gen.html · https://docs.aws.amazon.com/bedrock/latest/userguide/models-region-compatibility.md · preços (JS, não legível) https://aws.amazon.com/bedrock/pricing/

**Imagem**
- Black Forest Labs: https://docs.bfl.ai/quick_start/pricing · https://docs.bfl.ai/flux_2/flux2_overview · https://docs.bfl.ai/flux_2/flux2_text_to_image · https://docs.bfl.ai/flux_2/flux2_image_editing · https://bfl.ai/pricing · Developer ToS https://bfl.ai/legal/developer-terms-of-service
- Ideogram: https://developer.ideogram.ai/ideogram-api/api-overview · https://developer.ideogram.ai/ideogram-api/api-setup · https://ideogram.ai/legal/tos/ · https://ideogram.ai/legal/api-tos/ · preços (JS, não legível) https://ideogram.ai/api-pricing
- Recraft: https://www.recraft.ai/docs/api-reference/pricing · https://www.recraft.ai/docs/plans-and-billing/commercial-rights-and-ownership · https://www.recraft.ai/docs/best-practices/character-consistency
- Midjourney: https://docs.midjourney.com/hc/en-us · ToS https://docs.midjourney.com/hc/en-us/articles/32083055291277-Terms-of-Service *(domínios principais retornam HTTP 403)*
- Stability AI: https://platform.stability.ai/pricing · https://stability.ai/terms-of-service · https://stability.ai/use-policy · https://stability.ai/stable-audio · repo oficial https://raw.githubusercontent.com/Stability-AI/stable-audio-3/main/docs/guides/model-overview.md

**Voz**
- ElevenLabs: https://elevenlabs.io/docs/overview/models · https://elevenlabs.io/docs/overview/administration/pay-as-you-go · https://elevenlabs.io/pricing · https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform · https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/instant-voice-cloning · https://elevenlabs.io/docs/eleven-creative/voices/voice-cloning/professional-voice-cloning · https://elevenlabs.io/docs/help-center/product/voices/voice-library/can-childrens-or-child-like-voices-be-added-to-the-voice-library · ToS https://elevenlabs.io/terms-of-use · PUP https://elevenlabs.io/use-policy · Privacidade https://elevenlabs.io/privacy-policy · https://elevenlabs.io/safety
- Cartesia: https://www.cartesia.ai/pricing · https://docs.cartesia.ai/pricing · https://docs.cartesia.ai/build-with-cartesia/capability-guides/clone-voices · ToS https://www.cartesia.ai/legal/terms · AUP https://www.cartesia.ai/legal/acceptable-use
- Azure AI Speech — preços via **API oficial de preços de varejo** `https://prices.azure.com/api/retail/prices` (`armRegionName eq 'eastus'`, `productName eq 'Azure Speech'`) · vozes/idiomas https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts · CNV https://learn.microsoft.com/en-us/azure/ai-services/speech-service/custom-neural-voice · Limited Access https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/speech-service/text-to-speech/limited-access · transparency note https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/transparency-note · AI Code of Conduct https://learn.microsoft.com/en-us/legal/ai-code-of-conduct
- PlayHT/Play.ai: **`play.ht`, `www.play.ht` e `play.ai` não resolveram DNS** — nenhuma fonte oficial acessível

**Música / SFX**
- Suno: https://help.suno.com/en/articles/9601601 · https://help.suno.com/en/articles/2746945 · https://help.suno.com/en/articles/2425729 · https://help.suno.com/en/articles/2417089 · https://help.suno.com/en/articles/2410049 · https://help.suno.com/en/articles/2410177 · https://help.suno.com/en/articles/13614785 · ToS https://suno.com/terms · https://suno.com/community-guidelines
- Udio: https://help.udio.com/en/articles/10739134-credits-and-credit-limits · https://help.udio.com/en/articles/10739216-answers-to-common-usage-questions · https://help.udio.com/en/articles/10739199-changing-or-canceling-your-subscription · https://help.udio.com/en/articles/12683565-changes-associated-with-the-universal-music-group-umg-partnership · ToS https://www.udio.com/terms-of-service
- ElevenLabs Music/SFX: https://elevenlabs.io/docs/overview/capabilities/music · https://elevenlabs.io/docs/overview/capabilities/sound-effects · https://elevenlabs.io/docs/api-reference/music/compose · https://elevenlabs.io/docs/help-center/product/core-capabilities/sound-effects/how-much-does-it-cost-to-generate-sound-effects · https://elevenlabs.io/music-terms · https://elevenlabs.io/sound-effects-terms

### Cláusulas de idade / público menor (auditoria dedicada)

- **Google** — Gemini API Additional Terms (Age Requirements): https://ai.google.dev/gemini-api/terms
- **Google** — Generative AI Prohibited Use Policy: https://policies.google.com/terms/generative-ai/use-policy
- **Runway** — Safety / Usage Policy: https://runway.com/safety/usage-policy
- **Pika** — Acceptable Use Policy: https://pika.art/acceptable-use-policy · ToS: https://pika.art/terms-of-service
- **Black Forest Labs** — Developer Terms of Service (§6.k): https://bfl.ai/legal/developer-terms-of-service
- **Luma** — Enterprise Terms of Service: https://lumalabs.ai/legal/terms-of-service
- **Recraft** — Commercial rights and ownership: https://www.recraft.ai/docs/plans-and-billing/commercial-rights-and-ownership
- **Stability AI** — Terms of Service: https://stability.ai/terms-of-service · Acceptable Use Policy: https://stability.ai/use-policy
- **Kling AI** — Terms of Service / User Policy: https://kling.ai/docs/user-policy · Community Guidelines: https://kling.ai/docs/community-guidelines
- **ElevenLabs** — Terms of Use: https://elevenlabs.io/terms-of-use · Prohibited Use Policy: https://elevenlabs.io/use-policy · Privacy Policy (§11 Children's Privacy): https://elevenlabs.io/privacy-policy
- **Cartesia** — Terms of Service: https://www.cartesia.ai/legal/terms · Acceptable Use Policy: https://www.cartesia.ai/legal/acceptable-use
- **OpenAI** — Business Terms (§3.3.c): https://openai.com/policies/business-terms/ · Terms of Use: https://openai.com/policies/terms-of-use/ · Usage Policies: https://openai.com/policies/usage-policies/
- **Microsoft Azure AI Speech** — Limited Access: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/limited-access · Transparency note: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/transparency-note · AI Code of Conduct: https://learn.microsoft.com/en-us/legal/ai-code-of-conduct
- **Suno** — Terms of Service: https://suno.com/terms · Community Guidelines: https://suno.com/community-guidelines
- **Udio** — Terms of Service: https://www.udio.com/terms-of-service
- **Amazon Bedrock / AWS** — Acceptable Use Policy, Responsible AI Policy e Service Terms: https://aws.amazon.com/aup/ · https://aws.amazon.com/machine-learning/responsible-ai/policy/ · https://aws.amazon.com/service-terms/
- **OpenAI Sora (descontinuado)** — aviso oficial: https://help.openai.com/en/articles/20001152

### Políticas do YouTube (fonte oficial)

- Divulgação de conteúdo alterado ou sintético: https://support.google.com/youtube/answer/14328491
- Blog oficial — "Improving AI labels for viewers and creators" (27/05/2026): https://blog.youtube/news-and-events/improving-ai-labels-viewers-creators/
- Blog oficial — "Disclosing AI-generated content": https://blog.youtube/news-and-events/disclosing-ai-generated-content/
- Como o YouTube funciona — IA: https://www.youtube.com/howyoutubeworks/ai/
- Como o YouTube funciona — Nossas políticas: https://www.youtube.com/howyoutubeworks/our-policies/
- **YouTube channel monetization policies** (HTTP 200, **corpo não legível** nesta sessão): https://support.google.com/youtube/answer/1311392

---

## 13. Lacunas (`NÃO VERIFICADO`)

`NÃO VERIFICADO` = **não confirmado em fonte oficial nesta sessão**. Não significa que seja falso —
significa que **não pode ser usado como base de decisão sem verificação manual**.

### 13.1 Lacunas que travam decisão (prioridade alta)

| # | Lacuna | Impacto na D2 | Como fechar |
|---|---|---|---|
| L1 | **Regra de monetização de conteúdo "inautêntico"/repetitivo de IA** do YouTube (`support.google.com/youtube/answer/1311392`) — a página existe e responde HTTP 200, mas **o corpo não foi legível** por esta ferramenta | Um canal que publica episódios gerados em série pode cair nessa regra. **É o maior risco do negócio, não do provedor** | Abrir a página em navegador humano e registrar a redação exata; envolver `rebeca-youtube` + `rebeca-qa` |
| L2 | **Termos específicos do Alibaba Model Studio/DashScope (Wan)** — **continua aberto**. A URL oficial é um **índice de 6 documentos** (Product Terms of Service v3.8.0, Model Inference SLA, Membership Agreement, Privacy Policy, Open Source Model License Terms, Third Party Vendor Terms), nenhum deles lido em texto integral. **MiniMax: sem cláusula de idade localizada** (fechado). **Alibaba: 6 regiões publicadas (Beijing, Singapore, Frankfurt, Tokyo, Hong Kong, US-Virginia) e o Brasil NÃO está entre elas** | O Wan é o provedor de vídeo da stack recomendada: sem os termos, há risco contratual. **Mitigação identificada:** o **Runway revende o mesmo `wan3`** (US$ 0,05/0,10/0,20/s em 480p/720p/1080p) e o `h3_max` (US$ 0,05/0,08) — troca o **contratante** para a Runway, cujos termos **foram lidos** | (a) abrir os 6 documentos oficiais e/ou contato comercial; ou (b) **comprar via Runway** — aceitando o preço de Singapore (US$ 0,20/s → US$ 21,18/min, acima do teto) |
| L3 | **Cobrança em caso de erro/retry de geração de imagem** | `NÃO VERIFICADO` em **todos** os provedores de imagem → um retry pode ser cobrança dupla | Medir no próprio billing com 2 falhas controladas |
| L4 | **Preço em USD da ElevenLabs** (assinaturas, USD por crédito, API de música/SFX) | Impede calcular custo de voz/música da ElevenLabs (que já está **bloqueada** para a voz da Luna — §6.3) | Contato comercial / página em navegador |
| L5 | **Preço da API do Google Lyria, do Google Cloud TTS e da Stability Stable Audio** | Sem alternativa de preço verificada para música/SFX além do Suno | Páginas JS em navegador humano |
| L6 | **Preço da API do Ideogram e preço/planos do Midjourney** | Ideogram tem *character reference* (relevante para consistência) mas preço desconhecido; Midjourney **não tem API** | Navegador humano; decidir se faz sentido provedor sem API |
| L7 | **Unidade de cobrança da Vertex AI ("$0,40 / 1 count")** — a tabela **não escreve "per second"** | A equivalência `1 count = 1 segundo` é **inferência nossa** | Confirmar no SKU do Cloud Billing |
| L8 | **PlayHT / Play.ai é um buraco de diligência** — domínios oficiais sem registro DNS, `www.play.ai` em IP de estacionamento, `docs.play.ai` com 404; **nenhum termo oficial obtido** | Provedor não pode ser avaliado nem descartado com base em fonte | Contato direto com o fornecedor; até lá, **não usar** |

### 13.2 Lacunas técnicas e comerciais por categoria

**Vídeo**
- **fps `NÃO VERIFICADO`:** Pika `pika-2.5`; Kling **2.6**; Wan `wan2.7-t2v` e `wan2.2-i2v-plus` (checado em EN e ZH). **Fechado pela auditoria:** Kling **3.0 e 3.0 Omni = 24 fps** (*"the frame rate for generating videos is 24fps"*). **Mantidos como verificados** (com citação literal, contra o parecer do QA): **Veo 24 fps** (tabela "Model features") e **MiniMax H3/H3-Max 24 fps** (coluna FPS da tabela oficial de Video Models).
- **Áudio nativo GERADO do MiniMax H3/H3-Max: `NÃO VERIFICADO`** (a doc só traz `reference_audio` de entrada).
- **16:9 e 9:16 no Pika `pika-2.5`:** não existe parâmetro `aspect_ratio` no schema.
- **16:9 e 9:16 no Wan `wan2.2-i2v-plus`:** a proporção vem da imagem de entrada e a FAQ oficial avisa que **a razão exata não é garantida**.
- **Extensão/encadeamento nativa:** documentada só no Wan `wan3.0-video` e na Luma `ray-3.2`. Nos demais, **ausência de documento ≠ inexistência**.
- **Cobrança de geração falha:** `NÃO VERIFICADO` na OpenAI (Sora) e na Kling.
- **Preço do `amazon.nova-reel-*`:** não verificável por fetch (JS; a API de preços devolve `application/octet-stream`).
- **fal.ai e Replicate:** não investigados — tabela integralmente `NÃO VERIFICADO`.
- **Wan `wan3.0-video` está marcado "Currently in preview"** — é o **único** 30 fps documentado. Virar dependência de produção exige confirmação no console.

**Imagem**
- Preço de **Imagen 4 / Fast / Ultra** (desligados em 2026-08-17).
- Preço **por imagem** do Ideogram (JS); preço/planos do Midjourney (HTTP 403).
- **Resolução máxima e aspect ratios (16:9 / 9:16): `NÃO VERIFICADO` em BFL, Recraft, Ideogram, Stability e OpenAI.** É grave: o pipeline exige 16:9 e 9:16 confirmados.
- Nº de imagens por chamada e limite de referências: `NÃO VERIFICADO` em vários provedores.
- **Licenciamento/ownership da OpenAI** (`openai.com/policies/*` → HTTP 403).
- Preço de imagem na Vertex AI (JS).
- **Divergência oficial** de preço do FLUX.2 `[flex]` ($0,05/MP vs $0,06/MP em duas páginas da própria BFL) — registrada sem arbitragem.

**Voz**
- **Fronteira Library × conta privada na ElevenLabs:** a doc proíbe voz infantil/child-like **na Voice Library** e proíbe Voice Data de menor de 18; **não localizamos cláusula explícita sobre Voice Design privado** com timbre jovem. Alto impacto para a Luna → **exige confirmação escrita do fornecedor**.
- Preço do Google Cloud TTS; formatos de saída completos de Azure e Cartesia; vozes `pt-BR` nominais da Chirp 3 HD e da Cartesia.
- **Região/Brasil:** OpenAI TTS, ElevenLabs e Cartesia (fora do Enterprise) → `NÃO VERIFICADO`. Confirmado: Azure tem `brazilsouth`; o Google **não** tem região no Brasil para Chirp 3 HD nem Instant Custom Voice.
- Idade mínima da **conta Microsoft/Azure** (Microsoft Services Agreement) não verificada.
- **"COPPA" não apareceu literalmente em nenhum documento oficial lido** — lacuna de busca, não ausência de regra.

**Música / SFX**
- Preço de API do Lyria e da Stability Stable Audio; preço do plano Suno Premier; custo em créditos por faixa.
- **Nenhuma API oficial de Suno ou Udio foi localizada** nos domínios oficiais.
- Uso comercial explícito no YouTube para Udio, Lyria/Flow Music, Stable Audio e **SFX** da ElevenLabs.
- **YouTube Content ID:** nada em fonte oficial para nenhum provedor.
- Disponibilidade no Brasil de Udio, Stability e Google Flow Music/Lyria.
- **Conflito oficial da ElevenLabs Music** (API aceita até 10 min; página de capacidades diz 5 min).
- **Udio:** download desabilitado desde 17/02/2026 + ToS que proíbe distribuir Output em plataformas de conteúdo de usuário citando **"YouTube" nominalmente** → **descartado**, independentemente de preço.

### 13.3 Riscos transversais (não são lacunas de dado, são riscos)

1. **Datas de vigência futuras.** Suno (Effective 03/09/2026) e Stability AUP (Effective 30/09/2026)
   têm data de vigência **posterior à leitura** — o texto em vigor pode diferir do citado.
2. **Mediação por extrator de terceiro.** Vários números-chave (preços da Gemini API e da Vertex) foram
   lidos via `r.jina.ai` sobre a URL oficial, porque o `web_fetch` truncou. O conteúdo é o da página
   oficial, mas **os números marcados `[via extrator]` devem ser reverificados à mão** antes de virar
   contrato. Onde foi possível comparar duas superfícies oficiais (Gemini API × Vertex), os valores
   **coincidiram** ($0,40 com áudio / $0,20 sem áudio) — consistência, não verificação independente.
3. **Nenhum provedor, de nenhuma categoria, cita o YouTube Partner Program nominalmente.** O que existe
   é licença comercial genérica (e, na ElevenLabs Marketplace, uma "Social Media License" que cita
   "Monetized videos" — mas só para faixas **compradas** no Marketplace).
4. **O risco de compliance infantil é do Rebeca, não do provedor.** Google, ElevenLabs, Cartesia e BFL
   têm cláusulas que atingem o canal Luna; Azure e OpenAI **não têm cláusula de público-alvo, mas também
   não autorizam por escrito**. → Antes de gerar qualquer asset do canal infantil, isso passa por
   `rebeca-infantil` + `rebeca-lgpd` + decisão jurídica humana registrada em ADR.
5. **Este dossiê PASSOU por verificação adversarial (`rebeca-qa`)** — ver a seção "Errata" abaixo. Não
   houve, porém, execução de ponta a ponta do pipeline com os provedores recomendados. Os preços são de
   **tabela**; o custo real só existe em `.rebeca/custos.csv` depois de gerar.

---

## 14. Errata

**Motivo:** o dossiê foi submetido a verificação adversarial (`rebeca-qa`) e o parecer —
`.rebeca/evidencias/qa-dossie-d2.md` — foi **"não verificável como base de decisão"**: sólido em
política, limites e cláusulas, mas **o US$/min estava errado por construção** e **o teto proposto era
estourado pela stack recomendada**.

### 14.1 O que o QA refutou e o que foi corrigido

| # | Item refutado | O que estava errado | Correção aplicada |
|---|---|---|---|
| **E1** | **Aritmética incoerente entre seções** | A §10.2 usava clipe de **7 s** (`0,08 × 420 × 1,5`) contra a premissa **P5 = 8 s** declarada na §5, enquanto a §10.6 usava 480 s (60 × 8). Subestimava o vídeo em **14,29%** e o US$/min em ~14,6% | §5, §10.1, §10.2, §10.3, §10.4 e §10.6 **refeitos com P5 = 8 s** — agora `60 × fator × 8 s`. Toda a aritmética do §10 está reconciliada |
| **E2** | **O teto estava furado pela própria stack recomendada** | O teto de US$ 20/min não cobria a stack B, que com a aritmética correta chega a **US$ 21,18/min** (Singapore). A contradição estava implícita | Tornada **explícita** no §0, no §10.3 e no §11.3, com a bifurcação **B (Singapore) × B′ (US-Virginia)** e **três opções de decisão** para o humano |
| **E3** | **Preço do Wan sem o qualificador de região** | Publicava-se só **US$ 0,20/s** (1080P), que é o preço de **Singapore**. Beijing, Tokyo, Frankfurt, **US-Virginia** e Hong Kong = **US$ 0,165025/s** | §10.2, §10.3, §11.2 e §11.3 agora trazem **as duas linhas separadas**, e **a região passa a ser decisão da D2 junto com o teto** — não detalhe de deploy |
| **E4** | **"1,5 = rejeição de 50%" não fecha** | 1,5 gerações por plano aceito ⇒ rejeição total = **33,3%**; 50% de rejeição ⇒ fator **2,0**. A premissa mais sensível tinha dois rótulos incompatíveis | P6 reescrita: **1,5 = 33,3% de rejeição**; 2,0 = 50%. Consequência no teto publicada na §10.4 |
| **E5** | **Contagem de imagens oscilava (60/90/120)** | O fator de retrabalho era aplicado **no lugar** do P7 (`0,014 × 60 × 1,5`), quando P7 fixa **2 imagens/plano** | P7 reescrita: **120 imagens fixas** (60 × 2), sem multiplicador de retrabalho. Conta mostrada na §10.2 |
| **E6** | **Runway `gen4_turbo` a US$ 4,98/min é impossível** | O modelo só gera **5 s ou 10 s** — não existe clipe de 7 s; um plano de 7,0 s obriga clipe de **10 s** | Linha corrigida na §10.4: **US$ 7,04/min** (0,05 × 60 × 1,5 × 10 + itens). *(O QA publicou US$ 6,91 porque usou 90 imagens; com as 120 corrigidas dá 7,04 — divergência declarada.)* |
| **E7** | **"Só o Wan documenta 30 fps" + "mediana de 24 fps"** | Falso como escrito: o Runway documenta `targetFramerate` = **30** no `enhance_frame_rate` e a Pika documenta `target_fps` **15–240** no Topaz. E "mediana de 24 fps" **não tinha fonte** | Reescrito para a versão **estreita e defensável**: *"nenhum outro provedor **gera** 30 fps nativamente"* — interpolação/upscale não é geração. A "mediana" foi substituída pelo **quadro amostral citado** (7 provedores: 6 em 24/25 fps, 1 em 30) no §0 item 4, §8.5 item 6 e §8.7 |
| **E8** | **Citação do Google** | O QA disse que *"professional or business purposes, not for consumer use"* **não existe** na página citada | **MANTIDA — a citação existe.** Eu li a fonte primária direto (sem extrator) em https://ai.google.dev/gemini-api/terms , seção **"Use Restrictions"**, e a frase está lá literal, na renderização em inglês. O QA conferiu as renderizações **pt-BR** e **sq**, onde o trecho aparece de outra forma. URL ao lado da citação **confirmada como exatamente essa página** |
| **E9** | **Stack C com dois totais** | §0/§10.3 diziam $177,11/$25,30 e §11.2 dizia $177,61/$25,37 — não reconciliavam | Resolvido: existe **um** número por stack, todos reconciliados com os componentes (§10.2/§10.3) |
| **E10** | **Over-read da ElevenLabs** | O bloqueio era justificado com duas cláusulas que **não são de output** (proibição de **upload** de Voice Data de menor = insumo; regra da **Voice Library** = compartilhamento) | §11.1 corrigida: o fundamento é **PUP 9(r), 2ª metade** — *"bundled solutions that **target** anyone under the age of 13"*, que é cláusula de **público-alvo**. **A conclusão (bloqueio) sobrevive**; o raciocínio mudou. Registrada a consequência: público **13+** com personagem infantil sintética **não** está coberto pelo bloqueio |
| **E11** | **Escopo da divulgação da Azure** | O dossiê atribuía a obrigação de divulgação **só ao CNV** | Corrigido: vale para **todas** as vozes, inclusive a **prebuilt** `pt-BR-LeticiaNeural` da stack A/B (§6.4 item 4 e §11.1) |
| **E12** | **P10 dizia "~6.000 caracteres"** | §5 dizia ~6.000, §10.1 usava 5.775 e a §6.4 atribuía 5.775 ao P10 | P10 corrigida para **5.775** com a conta explícita (1.050 × 5,5) |
| **E13** | **Linhas oficiais omitidas que mudam contas** | Faltavam: Luma `budget_exhausted` = *"Partial charge possible"*; insumo de imagem do MiniMax (**5 primeiras grátis, US$ 0,04 por adicional**; H3-Max: 2 grátis, US$ 0,074); preço do `enhance_frame_rate` (**1 crédito/2 s = US$ 0,005/s**) | Todas incorporadas (§10.2, §10.4, §10.5 itens 3 e 4) |
| **E14** | **Insumo de retrabalho fora de todas as stacks** | O dossiê reconhecia que o insumo é cobrado à parte, mas nenhuma stack contabilizava | §10.2 ganhou a linha de insumo do MiniMax (**$0,00 nesta configuração**, 2 refs/plano) e §10.5 item 4 explica **quando** ele passa a custar |
| **E-nova** | **Ambiguidade de "2 passes" na stack C** | "2 passes" admitia duas leituras com **47% de diferença**: (i) fator de retrabalho **2,0** ⇒ 960 s ⇒ **US$ 28,73/min**; (ii) **duas gerações literais por plano** ⇒ 1.440 s ⇒ **US$ 42,44/min** | Definido por escrito na §11.2: o dossiê **adota (i)** (coerente com a §10.4) e **publica (ii)** como stack **C″**, com a nota de que, sob (ii), a stack C vira **~2,4× o teto** (**+US$ 13,71/min ≈ +US$ 96/episódio**) |

### 14.2 Pontos em que o QA errou (mantidos, com citação literal)

O QA não conseguiu alcançar algumas páginas; eu alcancei por extrator e as citações existem. **Não
rebaixei nada a `NÃO VERIFICADO` sem checar** — e onde cheguei à fonte, mantive o fato:

1. **Veo = 24 fps — MANTIDO.** A página oficial https://ai.google.dev/gemini-api/docs/veo tem a tabela
   **"Model features"** com a linha: *"**Frame rate:** The output frame rate of the video. | 24fps |
   24fps | 24fps"* (Veo 3.1 & 3.1 Fast / Veo 3.1 Lite / Veo 3 & 3 Fast).
2. **MiniMax H3 / H3-Max = 24 fps — MANTIDO.** A tabela oficial de modelos em
   https://platform.minimax.io/docs/guides/models-intro tem **coluna "FPS"** com "24 fps" para H3, H3
   Max, Hailuo 2.3, 2.3Fast e 02. (O QA afirmou que a doc só publica fps de **entrada** — isso vale
   para o request body; a tabela de modelos publica o fps de **saída**.)
3. **Citação do Google "not for consumer use" — MANTIDA** (ver E8).

### 14.3 O que o QA confirmou e o que isso muda

- **Confirmado literalmente pelo QA:** MiniMax-H3 $0,08/s; crédito Runway $0,01; Luma por geração; Pika
  $0,04/s; **Wan 30 fps**; Vertex "só cobra HTTP 200"; Azure *fictional character voice*; BFL §6.k;
  Cartesia AUP; Kling §4.6; Google cláusula de público <18; e a pista de que as Additional Terms
  excluem o uso direto de serviços GCP (**base textual para reabrir o Google via Vertex**).
- **Achado do QA a favor da decisão (incorporado):** o **Runway revende o `wan3`** — confirmado por
  mim na página oficial de preços da Runway: `wan3` 480p/720p/1080p = 5/10/20 créditos/s =
  **$0,05/$0,10/$0,20/s**, e `h3_max` = 5/8 créditos/s = **$0,05/$0,08/s**. Isso **troca o contratante**
  do modelo da stack recomendada (foge da lacuna L2 dos termos da Alibaba), mas **custa o preço de
  Singapore**, não o de US-Virginia.
- **Números finais publicados nesta errata:** **A = 8,55** · **B = 21,18** (Wan Singapore) ·
  **B′ = 17,58** (Wan US-Virginia) · **C = 28,73** (retrabalho 2,0) · **C″ = 42,44** (duas gerações
  literais) — todos em **US$/min**. Conferem com o recálculo independente do QA/pai nos quatro
  primeiros; **C″ é o número da leitura alternativa**, publicado em vez de ficar implícito.
- **Consequência para a narrativa:** o teto de **US$ 20/min só se sustenta com o Wan em US-Virginia**
  (US$ 17,58/min). Com Singapore ou com o `wan3` via Runway, a stack equilibrada **estoura o teto**
  (US$ 21,18/min) e a decisão passa a ser: contratar Alibaba US-Virginia com **termos não lidos**,
  contratar Runway com **termos lidos e preço maior**, ou **subir o teto para US$ 22/min**.

### 14.4 Limites desta errata

Não houve **nova** coleta de preços nas categorias imagem/voz/música além dos pontos acima; os 133
marcadores `NÃO VERIFICADO` que sobreviveram foram mantidos — **nada foi promovido a "verificado" sem
fonte literal**. As lacunas L1 (monetização de conteúdo "inautêntico" no YouTube), L2 (termos do
Alibaba), L3 (cobrança em retry de imagem) e L4–L8 continuam **abertas**.



