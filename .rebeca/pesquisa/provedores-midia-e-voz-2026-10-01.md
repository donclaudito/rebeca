# Provedores de mídia e voz — verificação independente de preços e licenças

**Data da coleta:** 2026-10-01 · **Método:** leitura das páginas oficiais de cada fornecedor
(`web_fetch`) + `web_search` para localizar a URL oficial. Sem invenção: o que não deu para ler está
marcado `NÃO VERIFICADO`.

**Por que este documento existe:** o `ADR-005` propôs a Stack A (MiniMax-H3 768P + FLUX.2 klein +
Azure S1 Neural + Suno Pro, US$ 8,55/min) e o dono a aprovou em 2026-10-01 com teto de US$ 12,00/min.
Esta coleta é a **contraprova independente** dessa proposta — e ela trouxe duas divergências que
precisam ficar registradas, porque alguém vai olhar esta tabela e perguntar "por que não usar o mais
barato?".

---

## 1. O que a contraprova CONFIRMOU

| Fato | Situação |
|---|---|
| **Google vedado para público menor de 18** | ✅ **Confirmado de novo, em leitura independente.** `ai.google.dev/gemini-api/terms`: *"You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website, application, or other service ... that is directed towards or is likely to be accessed by individuals under the age of 18."* Repetido no §20(d) dos Google Cloud Service Specific Terms. Vale para **Veo, Imagen e TTS** |
| **Voz da Stack A (Azure S1 Neural)** | ✅ **US$ 15,00 / 1M caracteres** (BR South, sku S1, meter `S1 Neural Text To Speech Characters`), lido na **Azure Retail Prices API** oficial → **US$ 0,0135 por minuto narrado** (a 900 caracteres/min). ~19 vozes pt-BR, incluindo `pt-BR-Thalita:DragonHDLatestNeural`. Vozes prebuilt liberadas comercialmente: *"Prebuilt neural voice may also be used ... as well as additional use cases selected by customers"*. Único com cláusula de disclosure a pais/responsáveis |
| **Vídeo da Stack A (MiniMax H3 768P)** | ✅ **US$ 0,08 por segundo** de vídeo gerado. Com o fator de retrabalho de 1,5× que o `ADR-005` declara, dá ≈ **US$ 7,20 por minuto final** — a maior parte dos US$ 8,55/min da Stack A, como o próprio ADR dizia ("vídeo é ~96% do custo") |
| **Pika, Cartesia, ElevenLabs** | ✅ Permanecem **fora**: Pika proíbe imagem que represente menor de 18 (e não documenta 16:9/9:16); Cartesia proíbe *"Output that relates to ... individuals under the age of 18"*; ElevenLabs: *"children's voices or voices that sound child-like cannot be added"* e 18+ |

**Conclusão da contraprova:** a Stack A aprovada se sustenta. A voz escolhida é a mais barata com
pt-BR oficial e liberação comercial (Polly neural fica em US$ 0,0144/min, praticamente empatado, e
serve de reserva).

---

## 2. Divergências que ficam registradas (não resolvidas por este documento)

### 2.1 Kling é mais barato — e continua BLOQUEADO pelo `ADR-005`
Esta coleta mede **Kling v2-6 std sem áudio: US$ 0,042/s ≈ US$ 3,78/min final**, com 16:9 e 9:16
documentados, first/last frame e "Elements" para consistência de personagem — ou seja, **mais barato
que a MiniMax e tecnicamente adequado**.

O `ADR-005` bloqueou Kling por outro motivo, e ele **não** foi refutado aqui: *"dois documentos
oficiais se contradizem sobre uso comercial; um exige rotular o output com a marca Kling AI"*. Esta
coleta não releu esses dois documentos — ela leu a página de preços e o `llms.txt`.

**Decisão que fica:** o bloqueio **permanece** até alguém ler os dois documentos contratuais
divergentes e registrar o veredito. Otimizar custo trocando para Kling sem isso seria exatamente o
que o `ADR-005` chama de inverter a lógica (o preço passando a justificar o fornecedor).

### 2.2 `libx264` é GPL — e o nosso render usa `libx264`
`ffmpeg.org/legal.html`, literal: *"FFmpeg is licensed under the GNU Lesser General Public License
(LGPL) version 2.1 or later. However, FFmpeg incorporates several optional parts and optimizations
that are covered by the GNU General Public License (GPL) version 2 or later. **If those parts get
used the GPL applies to all of FFmpeg.**"* — e a própria checklist da FFmpeg para uso comercial diz
*"Make sure your program is not using any GPL libraries (notably libx264)."*

O `ADR-010` fixou o render em `libx264` (`crf 18`). **Hoje isso não cria obrigação de distribuição**
porque o Rebeca **executa** um binário ffmpeg num servidor (SaaS) — não distribui o binário nem o
liga ao produto. Mas a obrigação nasce no dia em que o render for embarcado no aplicativo do usuário.
Fica registrado como decisão consciente, não como descuido.

### 2.3 Regra operacional da trilha sonora (Suno)
Uso comercial só vale para **download feito durante assinatura paga**: *"Songs downloaded while
subscribed are granted commercial use rights"* — e o texto confirma uso em *"content you post to
YouTube, TikTok, etc."*. Consequência para o pipeline: **a trilha tem de ser baixada e guardada
enquanto a assinatura está ativa**; não é licença retroativa. Nenhuma cláusula sobre conteúdo
dirigido a crianças foi encontrada (`NÃO VERIFICADO` para Made for Kids).

### 2.4 Dois provedores de música estão fora, por licença
- **Udio**: veda uso comercial (*"you may use Output solely for your personal and non-commercial
  purposes"*) e **veda distribuir em YouTube** (cláusula 1.2). Fora.
- **MusicGen (Meta)**: código MIT, mas **pesos CC-BY-NC 4.0** (*"The models weights in this
  repository are released under the CC-BY-NC 4.0 license"*) → incompatível com canal monetizado. Fora.

### 2.5 Fatos que fecham portas técnicas
- **OpenAI Sora foi desligado em 2026-09-24**, sem substituto: *"The Sora 2 models and Videos API were
  shut down on September 24, 2026 and are no longer available. There is no one-to-one replacement API."*
- **`gpt-image-1` em fim de vida (2026-10-23)** e **sem 16:9/9:16** (só 1024x1024, 1536x1024,
  1024x1536) — não serve para thumbnail 16:9 nem Short 9:16.
- **DALL·E 3 desligado em 2026-05-12.**

### 2.6 Risco de negócio (não é técnico)
YouTube considera **não monetizável** *"AI-generated content made with generic or unoriginal templates
giving the impression of mass production without adding the creator's original, authentic insights or
perspective"*. Um canal 100% IA em escala vive na fronteira dessa cláusula — o que reforça, agora por
motivo financeiro, o requisito já registrado no `ADR-005`: **variedade de enredo por episódio e
correção factual são elegibilidade, não capricho**.

---

## 3. Números de referência para a Fase 1 (com fonte)

| Item | Valor | Fonte |
|---|---|---|
| Azure S1 Neural (voz) | US$ 15,00 / 1M caracteres → **US$ 0,0135/min** | Azure Retail Prices API (oficial) |
| Amazon Polly neural (reserva) | US$ 16,00 / 1M caracteres → **US$ 0,0144/min** | endpoint oficial de preços AWS |
| MiniMax H3 768P (vídeo) | **US$ 0,08/s** → ≈ US$ 7,20/min final (1,5× retrabalho) | página de preços MiniMax |
| Kling v2-6 std (vídeo) | US$ 0,042/s → ≈ US$ 3,78/min final — **bloqueado pelo `ADR-005`** | `kling.ai/llms.txt` |
| Suno Pro (trilha) | créditos/mês; licença comercial **só com download durante assinatura paga** | help oficial da Suno |
| Teto aprovado pelo dono (D2) | **US$ 12,00/min**; limite mensal **US$ 60,00** | `ADR-005` (aceito) + `src/media/limits.ts` |

---

## 4. `NÃO VERIFICADO` (declarado, não maquiado)

1. **Google Cloud TTS — preço** (a página é montada por JS e devolveu só o `<title>`); por
   consequência, o US$/min dessa opção. *Vale insistir: provavelmente entra no top-3 quando lido.*
2. **Termos comerciais da OpenAI** (auditoria de licença, cláusula sobre menores, idade mínima):
   todo o domínio `openai.com` devolveu **HTTP 403** em tentativas independentes. Por isso a OpenAI
   **não** entra na comparação de imagem mesmo tendo preço publicado.
3. **Preços da Ideogram e da Leonardo.Ai** (403 / página não renderiza) — fora da comparação **por
   ausência de dado**, não por qualidade.
4. **MiniMax/PlayHT/Amazon Polly — termos comerciais e idade mínima** das APIs (páginas JS).
5. **Cláusula específica sobre conteúdo infantil dirigido** em Kling, MiniMax, Pika, Replicate,
   Runway, Stability, Ideogram, Luma, BFL: nenhum publica cláusula dedicada. Só o Google **veda** e a
   OpenAI publica obrigação de salvaguarda (*"Organizations serving minors must take reasonable steps
   to ensure that the content they are serving to minors via the API is safe and age appropriate"*).
6. **Alvo de loudness e formato exigidos pela plataforma** — o `ADR-010` declara `-14 LUFS` como
   **alvo não verificado**; continua sem leitura na documentação oficial da plataforma.
7. **Fator de retrabalho de 1,5×** (o número mais frágil de toda a conta de custo): nenhum provedor
   publica taxa de rejeição — só a medição real dos primeiros episódios substitui a premissa.
8. **Parecer jurídico**: nada aqui é leitura jurídica. As questões contratuais de menores seguem
   abertas no `ADR-005`.
