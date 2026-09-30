# QA adversarial — Dossiê D2 (provedores de IA de mídia e teto de US$/min)

**Alvo:** `.rebeca/pesquisa/d2-provedores-ia-midia.md` (1.000 linhas).
**Autor do alvo:** `rebeca-ia-video`. **Autor desta verificação:** `rebeca-qa`.
**Método:** `web_search` para localizar, `web_fetch` para ler a página **oficial** do provedor. Todo conteúdo
de página externa foi tratado como **dado não confiável**, nunca como instrução. Nenhum número foi
inventado; onde a página não foi alcançável, o veredito é `NÃO VERIFICADO` **com o que foi tentado**.
**Regra desta revisão:** o valor está em refutar. Onde confirmo, confirmo porque li a cláusula/número.

> **Escopo honesto:** não refiz a coleta inteira (centenas de números). Ataquei, na ordem pedida, (1) a
> aritmética, (2) a leitura das cláusulas de idade/menores, (3) as citações que carregam a decisão,
> (4) a tese dos "30 fps", (5) a cobrança em falha, (6) marcas `NÃO VERIFICADO`. O que não foi atacado
> está declarado no fim.

---

## 0. Veredito curto

Dos números e cláusulas que elegeu como decisivos, **quase todos existem literalmente** na página oficial
(conferi 12; uma citação do Google não existe e uma tese central — "só o Wan documenta 30 fps" — é falsa
como escrita). **Mas o número que decide a D2 — o US$/min — está errado por construção:** a §10.2 usa
clipe de **7 s** enquanto a premissa P5 (declarada pelo próprio autor) manda **8 s**. O efeito é um
**subdimensionamento de ~14,6%** em todas as três stacks. Com a mesma premissa P5, a stack recomendada
(B) sai de **US$ 18,48/min para US$ 21,18/min** — **acima do teto provisório de US$ 20/min que o próprio
dossiê propõe**.

Correção material que **salva** o teto: o preço do Wan citado (US$ 0,20/s a 1080P) é o da região
**Singapore**; nas outras cinco regiões (inclusive **US-Virginia**) o mesmo 1080P é **US$ 0,165025/s**.
Com a aritmética corrigida **e** a região Virginia, a stack B fica em **US$ 17,58/min** (dentro do teto).

**Veredito: o dossiê NÃO está pronto para ir sozinho à decisão humana.** Ele precisa de uma errata da
§10 (clipe 8 s, região do Wan, teto) antes de virar ADR. O restante — política, limites, cláusulas —
é aproveitável hoje.

---

## 1. Recomptação da aritmética (ataque nº 1)

### 1.1 A falha estrutural: 7 s vs 8 s por clipe

A fórmula do próprio dossiê (§5) é:

```
custo_longo_usd = (n_shots × clipes_por_shot × preco_segundo_video × dur_clipe_s) + ...
```

com P3 = 60 planos, P5 = **dur_clipe_s = 8 s**, P6 = **1,5** clipes/plano.

Aplicando a fórmula **com as premissas declaradas**:

```
segundos_pagos_de_vídeo = 60 planos × 1,5 × 8 s = 720 s
```

A §10.2 do dossiê faz outra conta:

```
0,08 × 420 × 1,5 = $50,40        (§10.2, linha "Vídeo (baixo)")
```

Ou seja: **o autor trocou `n_shots × dur_clipe_s` (= 480 s) por "duração do episódio" (= 420 s)**,
e para isso teve de usar clipe de **7 s**, não de 8 s. A §10.1 diz isso sem avisar a §5:
*"segundos_gerados = 60 × 7 s = 420 s (MiniMax H3 aceita 4–15 s → 7 s exatos)"*.

| | Dossiê §5 (P4/P5) | Dossiê §10.1/§10.2 | Dossiê §10.6 |
|---|---|---|---|
| clipe assumido | **8 s** | **7 s** | **8 s** (usa 480 s) |
| segundos pagos (1 passe) | 480 s | 420 s | 480 s |
| segundos pagos (1,5 passe) | 720 s | 630 s | 480 s (retry 1,0) |

**A §10.6 (caminho Google) usa 480 s = 60 × 8 s. A §10.2 usa 420 s. O documento contradiz a si mesmo
sobre a duração do clipe.** Isto é o erro silencioso mais caro do dossiê: ele é da ordem do teto.

**Sobre a pergunta "1,5 clipes/plano é coerente com clipe de 8 s?"** — Não como *cobertura*: um clipe de
8 s **já cobre** um plano de 7,0 s; nunca são necessários 1,5 clipes para cobrir um plano. `1,5` é
**fator de retrabalho** (o próprio P6 diz "1,0 no ideal; 1,5 no realista"), e retrabalho incide sobre
**segundos gerados**, não sobre a duração final. Logo o multiplicador correto é `60 × 1,5` **gerações**,
cada uma de `dur_clipe_s` segundos pagos — e com P5 = 8 s isso dá 720 s. A forma como o dossiê escreveu
(`420 × 1,5`) só é válida se o clipe for de 7 s, o que contraria P5 e a §10.6.

### 1.2 O multiplicador 1,5 não é "taxa de rejeição de 50%"

P6 diz: *"**1,5** no cenário realista (**taxa de rejeição de 50%**)"*. As duas coisas não fecham:

- 1,5 gerações por plano aceito ⇒ rejeição total = `1 − 1/1,5` = **33,3%**.
- rejeição de **50%** ⇒ gerações esperadas por plano aceito = `1/(1−0,5)` = **2,0**.

A §10.1 usa a outra redação (*"regerar ~50% dos clipes"*), que é compatível com 1,5 — mas então a
rejeição total não é 50%, e sim 33%. **A premissa mais sensível da conta está rotulada de dois jeitos
incompatíveis.** Se a leitura literal do P6 valer (50% de rejeição), o fator é 2,0 e o custo sobe ~33%
— que é exatamente a linha "pessimista" da própria §10.4. Isto precisa ser decidido pelo humano, não
herdado por ambiguidade.

### 1.3 Contagem de imagens: o multiplicador foi usado como se fosse o P7

P7 diz: **1 imagem/plano no ideal, 2 no realista**. A §10.2 usa três bases diferentes:

| linha | conta | imagens por plano implícitas |
|---|---|---|
| §10.2 imagem baixa | `0,014 × 60 × 1,5` = $1,26 | 1,5 |
| §10.2 imagem média | `0,03 × 60 × 1,5` = $2,70 | 1,5 |
| §10.2 imagem alta | `0,07 × 60 × 2,0` = $8,40 | 2,0 |
| §10.4 (retrabalho 1,0) | $1,80 | 1,0 |
| §10.4 (retrabalho 2,0) | $3,60 | 2,0 |

O fator de retrabalho (1,5 / 2,0) foi aplicado **como se fosse** a contagem de imagens do P7. Com P7 = 2
imagens/plano (cenário realista, que é o das stacks A/B), são **120 imagens**, não 90. E o retrabalho
de imagem, se existir, incide **em cima** disso.

### 1.4 A voz da stack A ficou sem o fator P11

A §10.2 usa, para a stack baixa, `15,00 × 0,005775` = $0,0867 — **sem** o `× 1,2` que P11 manda aplicar
no cenário realista (aplicado nas linhas HD e tts-1-hd). Impacto absoluto pequeno ($0,017/episódio),
mas é aplicação desigual da mesma premissa.

### 1.5 Totais que não reconciliam

| # | Onde | Diz | Reconciliação |
|---|---|---|---|
| a | §0 e §10.3 (stack C) | $177,11 / **$25,30/min** | 168 + 8,40 + 0,2079 + 0,50 = **177,1079** ✓ |
| b | §11.2 (stack C) | ≈ **$177,61** / **$25,37/min** | não sai de nenhuma combinação dos componentes; sobra **$0,50** (uma segunda faixa de música?) → **REFUTADO** |
| c | §5 P10 | "≈ **6.000** caracteres" | §10.1 usa 5.775 e a §6.4 atribui os 5.775 **ao P10** — citação errada do próprio P10 (1.050 × 5,5 = 5.775) |

### 1.6 Comparações com premissas trocadas (§10.4 e §10.6)

- **§10.4, linha Runway `gen4_turbo`.** O dossiê calcula `0,05 × 420 × 1,5 = $31,50` → **$4,98/min**.
  Mas a própria §8.7 do dossiê diz que `gen4_turbo` aceita **5 s ou 10 s** — não existe clipe de 7 s.
  Um plano de 7,0 s obriga clipe de **10 s**: `0,05 × 60 × 1,5 × 10 = $45,00` → total $48,35 →
  **$6,91/min**, não $4,98 (**+38,8%**). A "alternativa barata" da §10.4 está subestimada em ~39%.
- **§10.6 vs §10.2 (o "Google é ~5× mais barato").** A §10.6 usa retrabalho **1,0** para o Google e a
  §10.2 usa **1,5** para as stacks não-Google. Igualando em 1,5: `0,05 × 60 × 1,5 × 8 = $36,00` + imagem
  $3,02 → **$5,57/min** contra **$21,18/min** corrigidos da stack B. A razão honesta é **~3,8×**, não
  "≈US$ 4/min contra ≈US$ 18/min" como afirma a §11.3 item 6. A conclusão (Google é muito mais barato)
  sobrevive; a grandeza divulgada não.

### 1.7 Tabela de recomputação (o número do QA vs o número do dossiê)

Premissas do QA: **P5 = 8 s/clipe**, P6 = 1,5, **P7 = 2 imagens/plano**, P11 = 1,2, P1 = 420 s, P3 = 60,
caracteres = 5.775 (§10.1).

| Stack | Componente | Dossiê | QA (P5=8 s, P7=2) | Δ |
|---|---|---|---|---|
| **A** — MiniMax-H3 768P $0,08/s | vídeo | $50,40 | **$57,60** | +$7,20 |
| | imagem FLUX.2 klein $0,014 | $1,26 | **$1,68** | +$0,42 |
| | voz Azure S1 $15/1M ×1,2 | $0,0867 | **$0,1040** | +$0,017 |
| | música Suno Pro | $0,50 | $0,50 | — |
| | **total / US$/min** | **$52,25 / $7,46** | **$59,88 / $8,55** | **+$1,09/min (+14,6%)** |
| **B** — Wan 1080P $0,20/s (Singapore) | vídeo | $126,00 | **$144,00** | +$18,00 |
| | imagem FLUX.2 pro $0,03 | $2,70 | **$3,60** | +$0,90 |
| | voz Azure HD $22/1M ×1,2 | $0,1525 | $0,1525 | — |
| | música | $0,50 | $0,50 | — |
| | **total / US$/min** | **$129,35 / $18,48** | **$148,25 / $21,18** | **+$2,70/min (+14,6%)** |
| **B′** — mesma stack, Wan **US-Virginia** $0,165025/s | vídeo | — | **$118,82** | −$25,18 vs B |
| | **total / US$/min** | — | **$123,07 / $17,58** | **−$0,90 vs o dossiê** |
| **C** — Wan 1080P, 2,0 passes | vídeo | $168,00 | **$192,00** | +$24,00 |
| | imagem FLUX.2 max $0,07 | $8,40 | $8,40 | — |
| | voz tts-1-hd $30/1M ×1,2 | $0,2079 | $0,2079 | — |
| | música | $0,50 | $0,50 | — |
| | **total / US$/min** | **$177,11 / $25,30** (§10.3) | **$201,11 / $28,73** | **+$3,43/min (+13,6%)** |

**Consequência para a decisão:** o teto provisório de **US$ 20/min** proposto no §0/§11.3 **é estourado
pela stack recomendada** (US$ 21,18/min) antes de somar qualquer imprevisto — mas **volta a caber**
(US$ 17,58/min) se o Wan for contratado na região **US-Virginia** a US$ 0,165025/s. Ou seja: o teto não
se decide sobre o preço por segundo "de tabela", e sim sobre **região + duração de clipe + fator de
retrabalho**. Os três precisam estar escritos no ADR.

---

## 2. Teste de over-blocking (ataque nº 2)

Três eixos, separados de propósito:
**(a)** quem opera a conta / quem pode usar o serviço · **(b)** qual **insumo** pode ser enviado
(voz, biometria, imagem de pessoa real) · **(c)** o que o **output** pode representar ou a quem pode
ser **dirigido**.

| Provedor | Cláusula citada pelo dossiê | Eixo real | Veredito QA |
|---|---|---|---|
| **Google** (Veo/Imagen/Lyria/TTS) | *"Não é permitido usar os Serviços como parte de um site, aplicativo ou outro serviço … **direcionado a usuários menores de 18 anos ou que possa ser acessado por eles**"* | **(c) audiência** | **CONFIRMADO** — é cláusula de público-alvo, literal. **Não é over-read.** |
| **ElevenLabs** | PUP 9(r) + Privacidade §11 + Voice Library | misto: (r) = (a)+**(c)**; §11 = **(b)**; Library = **(a)** | **REFUTADO parcialmente** — ver §2.1 |
| **Cartesia** | AUP: *"You may also not use the Services to create **Output** that relates to … individuals under the age of 18"* | **(c) output** | **CONFIRMADO** — a cláusula é de output, literal. Bloqueio defensável. |
| **Pika** | AUP: *"You must not **upload** any images that depict or appear to depict individuals under the age of 18"* | **(b) insumo** | **CONFIRMADO** — e o dossiê **classificou certo** ("restringe insumo, não a audiência"). |
| **Black Forest Labs** | Dev. ToS §6(k): *"**Upload** images, videos or personal data to the FLUX Services or FLUX AI Models relating to individuals under the age of 18"* | **(b) insumo** | **CONFIRMADO literal**; o dossiê marcou "condicional/zona cinzenta" — leitura conservadora e correta (não é bloqueio de output). |
| **Runway** | Usage Policy: proibição de *"Characters or games that are intended to engage users under the age of 18…"* | **(c)**, porém **escopada** | **CONFIRMADO literal + escopo confirmado** — o texto diz *"We also prohibit the following **in these products**"* (Characters & Game Worlds). O dossiê acertou ao não tratar como bloqueio de `gen4.5`. |
| **Kling** | ToS §4.6: *"without our written permission, you may not use, reproduce, distribute, and create derivative works of, and make modifications to, the Output for any commercial purposes"* | **(c) uso comercial do output** | **CONFIRMADO literal** (e §4.5 exige rotular com a marca "Kling AI"). Bloqueio para canal de marca própria procede. |
| **Azure AI Speech** | Transparency note lista **"Media: Entertainment: To create a fictional brand or character voice…"** como uso aprovado e manda divulgar a pais quando *"intended for minors or children"* | **(c) permitido** | **CONFIRMADO literal** — ressalva em §2.2. |
| **MiniMax** | nenhuma cláusula localizada | — | **NÃO VERIFICADO** (o dossiê também). |
| **Alibaba Wan** | termos específicos do Model Studio não alcançados | — | **NÃO VERIFICADO** — tentei `related-agreements`; a página é **índice de links** (6 documentos), não o texto. Continua aberto, e agora com a URL exata a seguir. |
| **Luma / Stability / OpenAI** | — | — | **NÃO VERIFICADO** nesta sessão (não refiz). |

### 2.1 ElevenLabs — o over-read existe, mas a conclusão sobrevive

O dossiê conclui (§11.3 item 3): *"Não usar ElevenLabs nem Cartesia para voz de personagem infantil"*,
apoiado em três cláusulas. Testei cada uma:

**(i) Prohibited Use Policy, item 9(r)** — literal, lido via extrator de terceiro sobre a URL oficial
(`r.jina.ai/https://elevenlabs.io/use-policy`; a página direta trunca antes do item (r)):

> *"r) Making our Services available to anyone under the age of 13, or anyone between the ages of 13-18
> without first obtaining parental or guardian consent, **or otherwise using our Services to make
> available bundled solutions that target anyone under the age of 13**."*

A **segunda metade** ("bundled solutions that **target** anyone under the age of 13") é uma cláusula de
**público-alvo** — funcionalmente eixo (c). Um canal infantil de 3–5 anos produzido com vozes da
ElevenLabs é, com boa margem, "solução empacotada dirigida a menores de 13". **É esta cláusula que
sustenta o bloqueio — e o dossiê não a usa em §11.1**, apesar de citá-la em §6.3.

**(ii) Privacy Policy — proibição de "Voice Data from children under the age of 18".**
O próprio verbo citado é **"uploading"**: é cláusula de **insumo (b)**, não de output. Uma voz
sintética infantil gerada a partir de uma **voz adulta prebuilt ou de Voice Design** não envia dado
vocal de criança nenhum. **REFUTADO** como fundamento do bloqueio de output.
*Ressalva de verificação:* não alcancei a §11 da Privacy Policy (página truncada antes); o texto integral
fica `NÃO VERIFICADO` — mas o trecho transcrito pelo autor contém o verbo que define o eixo.

**(iii) "vozes de crianças ou vozes que soem infantis não podem ser adicionadas à Biblioteca".**
Literal, confirmado:

> *"**No, children's voices or voices that sound child-like cannot be added to the Library.** This policy
> applies to voices of minors as well as adult voices designed to mimic or sound like children."*
> — https://elevenlabs.io/docs/eleven-creative/voices/voice-library.md (FAQ "Can Children's or Child-Like
> Voices Be Added to the Voice Library?")

**O escopo é a Voice Library** — um *marketplace de compartilhamento* ("Only Professional Voice Clones
can be published to the Voice Library"; vozes de Voice Design **não são compartilháveis** de todo modo).
É operação **(a)**, não restrição de output. **REFUTADO** como fundamento do bloqueio.
O próprio dossiê reconhece a lacuna em §13.2 (*"não localizamos cláusula explícita sobre Voice Design
privado com timbre jovem"*) — ou seja, ele sabe que a conclusão da §11.3 não decorre dessas duas.

**Veredito do QA:** a **conclusão está certa, o raciocínio está errado**. O canal Luna deve continuar
fora da ElevenLabs, mas por causa do **PUP 9(r), 2ª metade** — e não porque "a cláusula de menores
proíbe voz infantil no output", que é o que o resumo executivo e a §11.1 fazem crer. Como consequência
prática: a ElevenLabs continua bloqueada, mas **um produto futuro para público 13+ ou adulto com
personagem infantil sintética não está coberto por esse bloqueio** — o que importa se o portfólio crescer.

### 2.2 Azure — o dossiê está certo, mas subestima uma obrigação

Transparency note (literal, na íntegra do trecho relevante):

> *"**Prebuilt neural voice may also be used for the custom neural voice use cases above, as well as
> additional use cases selected by customers** … No registration or pre-approval is required for
> additional use cases for prebuilt neural voice that meet all applicable terms and conditions."*
> *"Consider proper disclosure to parents or other parties with use cases that are designed for or may be
> used in situations involving minors and children. **If your use case is intended for minors or children,
> you'll need to ensure that your disclosure is clear and transparent** so that parents or legal guardians
> can understand the role of synthetic media…"*
> — https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/speech-service/text-to-speech/transparency-note

**Achado do QA (erro de escopo do dossiê):** a §6.3 atribui a divulgação obrigatória **só ao CNV**
("*Azure exige (CNV) divulgar a natureza sintética*"). A página diz, sem qualificar:
*"**Microsoft requires its customers to disclose the synthetic nature of text to speech voices to its
users**"* — vale para **todas** as vozes, inclusive a prebuilt `pt-BR-LeticiaNeural` que é a voz da
stack A/B. Divulgação obrigatória é requisito de conformidade da stack recomendada, não detalhe de CNV.

---

## 3. Verificação das citações que carregam a decisão (ataque nº 3)

| # | Alegação do dossiê | Veredito | Citação literal / observação | URL |
|---|---|---|---|---|
| 1 | MiniMax-H3 **$0,08/s (768P)** | **CONFIRMADO** | `\| MiniMax-H3 \| 768P \| Billed per second \| $0.08 / second \|` (2K = $0,13/s; H3-Max 480P = $0,05/s, 768P = $0,08/s) | https://platform.minimax.io/docs/guides/pricing-paygo.md |
| 2 | Alibaba `wan3.0-video` 1080P **$0,20/s** | **REFUTADO como "o preço"** | O valor existe, mas **por região**: Singapore 480P `0.05` / 720P `0.1` / **1080P `0.2`**; Beijing, Tokyo, Frankfurt, **US (Virginia)**, Hong Kong = `0.041256` / `0.082513` / **`0.165025`**. O dossiê publica **só o preço mais caro** e não diz que é Singapore. | https://www.alibabacloud.com/help/en/model-studio/wan3-0-video |
| 3 | Wan documenta **30 fps** | **CONFIRMADO** | *"It can generate videos up to 30 seconds long at **30fps**. **Currently in preview**."* e `fps` (usage) *"Frame rate of the generated video. **Default value: 30**"*, com resposta de exemplo `"fps": 30`. Também literal: *"Enabling or disabling audio does not affect pricing."* | https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-api-reference |
| 4 | Kling tem cláusulas comerciais contraditórias | **CONFIRMADO** | §4.6: *"without our written permission, you may not use, reproduce, distribute, and create derivative works of, and make modifications to, the Output for any commercial purposes"*; §4.5 exige rotular o Output com "Kling AI". ToS **Kling AI Pte. Ltd. (Singapura)**, Last/Effective **2026/04/21**, lei de Singapura. | https://kling.ai/docs/user-policy |
| 5 | Runway: **crédito = $0,01** → `gen4.5` = $0,12/s | **CONFIRMADO** | *"Credits can be purchased for **$0.01 per credit** in the developer portal"*; `gen4.5` = **12 credits per second**; `gen4_turbo` = **5**; `act_two` = **5**; `veo3.1 (audio)` = **40**, `(no audio)` = **20**. | https://docs.dev.runwayml.com/guides/pricing/ |
| 6 | Luma `ray-3.2` preços por geração | **CONFIRMADO** | 5 s / 10 s: `360p` $0,06/$0,18 · `540p` $0,15/$0,45 · `720p` $0,30/$0,90 · `1080p` $1,20/$3,60. Derivados $0,06/s (720p) e $0,24/s (1080p) conferem. | https://docs.agents.lumalabs.ai/guides/pricing/ |
| 7 | Pika `pika-2.5` T2V **$0,04/s** (720p) | **CONFIRMADO** | *"720p · 5s: **$0.04 per second**"* / *"1080p · 5s: $0.09 per second"* · *"**Only successful generations are charged.**"* · `duration_s`: *"5s only for text-to-video"*. | https://dev.pika.art/llms/pika/pika-2.5/text-to-video |
| 8 | Google: Additional Terms com cláusula de público <18 (vig. 23/03/2026) | **CONFIRMADO** | *"Em vigor a partir de 23 de março de 2026"* … *"Você precisa ter pelo menos 18 anos para usar as APIs. Não é permitido usar os Serviços como parte de um site, aplicativo ou outro serviço (coletivamente, "Clientes de API") direcionado a usuários menores de 18 anos ou que possa ser acessado por eles."* (li também a renderização `sq`; conteúdo equivalente) | https://ai.google.dev/gemini-api/terms |
| 9 | Google, seção "Use Restrictions": *"…professional or business purposes, not for consumer use"* | **REFUTADO** | **Esta frase não existe na página citada.** Na seção "Restrições de uso" das renderizações **pt-BR e sq** (mesma URL, "Última atualização 2026-04-28") constam apenas: região disponível; EEA/CH/UK só com Serviços Pagos; proibição de modelo concorrente; Política de Uso Proibido; recursos de segurança; proibição de uso clínico. A citação precisa ser removida ou re-atribuída à fonte real. | https://ai.google.dev/gemini-api/terms |
| 10 | "these Terms do not govern your direct use of any Google Cloud Platform service" (§11.3 item 6) | **CONFIRMADO** | *"Para fins de esclarecimento, estes Termos não regem seu uso direto de qualquer serviço do Google Cloud Platform…"* → a pista de reabrir o Google via Vertex **tem base textual**. | https://ai.google.dev/gemini-api/terms |
| 11 | Vertex: *"You're charged only for requests that return a 200 response code"* | **CONFIRMADO** | *"You're charged only for requests that return a 200 response code. Requests returning any other response codes, such as 4xx and 5xx codes, aren't charged for the input or output."* (lido via extrator sobre a URL oficial — a página direta devolve só o título, como o dossiê declarou) | https://cloud.google.com/vertex-ai/generative-ai/pricing |
| 12 | Vertex: tabela Veo em **"$0,40 / 1 count"** e a equivalência `count = 1 s` é inferência | **NÃO VERIFICADO** | A página truncou antes das tabelas de Veo/Lyria/Imagen nas duas tentativas. **A ressalva metodológica do dossiê (§8.2, L7) permanece aberta e é legítima.** | idem |

---

## 4. A tese dos "30 fps" (ataque nº 4) — **REFUTADO como está escrito**

O dossiê afirma, em negrito e em dois lugares (§0 item 4 e §8.7): *"o **único** provedor que documenta
**30 fps** é o **Wan `wan3.0-video`**"* e *"**Nenhum** provedor de vídeo analisado entrega 30 fps
nativo"*. A citação do Wan é **literal e verdadeira** (item 3 da §3), inclusive numa segunda página:

> *"It supports up to 30 seconds per generation, **30fps output frame rate**, natively outputs dialogue,
> BGM, and sound effects"* — https://www.alibabacloud.com/help/en/model-studio/wan3-video-generation-guide

**Mas o "único" cai.** Duas páginas oficiais de outros provedores publicam **30** como valor de
frame rate documentado:

| Provedor | Endpoint | Valor documentado | Citação literal | URL |
|---|---|---|---|---|
| **Runway** | `enhance_frame_rate` em `POST /v1/video_upscale` | **30** (aceita 24, 25, 30, 48, 50, 60, 120, 23.98, 29.97, 59.94) | *"Required `targetFramerate` is one of `24`, `25`, `30`, `48`, `50`, `60`, `120`, `23_98` (23.98 fps), `29_97` (29.97 fps), or `59_94` (59.94 fps). Inputs can be at most 300 seconds."* | https://docs.dev.runwayml.com/guides/models/ |
| **Pika** (modelo Topaz) | `topaz-video-upscale` | **30** (faixa 15–240, inclui 29.97) | *"`target_fps` \| number (15 – 240) … Raise the output frame rate to this value (15-240, decimals allowed for the NTSC rates 23.976/29.97/59.94) with Topaz's Apollo frame-interpolation model"* | https://dev.pika.art/llms/topaz/topaz-video-upscale/video-upscale |

**A distinção que salva a decisão (e que o dossiê não fez):** os dois achados acima são **parâmetros de
fps em endpoints de upscale/interpolação**, não fps de geração nativa. O 30 fps do Wan é **saída gerada**.
Portanto:

- a frase *"o único provedor que documenta 30 fps"* → **REFUTADO**;
- a frase mais estreita *"nenhum outro provedor **gera** 30 fps nativamente"* → **sobrevive** a esta busca
  (entre os provedores cujo fps **de geração** está documentado: Wan 30, Kling 24, Nova Reel 24; Veo e Luma
  ficaram `NÃO VERIFICADO`, não contra-evidência);
- a frase *"a mediana documentada é 24 fps"* → **NÃO VERIFICADO / sem fonte**: só **dois** provedores da
  amostra documentam fps de geração (Kling 24 e Nova Reel 24) contra um documentando 30. Isso não é uma
  mediana — é uma amostra de três. **O dossiê não cita fonte para "mediana".**

**Fontes de geração encontradas pela branch (verbatim):**

| Provedor | Modelo | fps de geração | Citação |
|---|---|---|---|
| Kling | O1 (omni) e 3.0 Omni | **24** | *"The video frame rate is based on 24fps to 60fps (**the frame rate for generating videos is 24fps**)."* — https://kling.ai/document-api/api/video/o1/video-omni.md |
| Amazon | Nova Reel | **24** | *"…generated in six second increments at 1280x720 resolution and **24 frames per second**."* — https://docs.aws.amazon.com/nova/latest/userguide/video-generation.html |
| MiniMax | H3 / H3-Max | **não documentado** | Só há fps de **entrada**: `video_url` → *"Frame rate: [23.976, 60]"* |
| Veo / Luma / Pika 2.5 | — | **não documentado** | várias páginas tentadas; nenhuma tabela de spec alcançada |

**Preço da conformação (o dossiê cita o endpoint e não o preço):** `enhance_frame_rate` custa
**1 credit per 2 seconds** de entrada = **$0,005/s** — ou seja ~**$0,04 por episódio de 7 min**. Isso
**reforça** a recomendação de conformar 24→30 no render (ou usar o Wan): o custo da interpolação oficial
é irrelevante perto de qualquer diferença de preço por segundo de vídeo.

**Correção adicional que esta seção revela:** o dossiê lista **Veo = 24 fps** e **MiniMax = 24 fps** como
"confirmados oficialmente" (§8.1, §8.5 item 6, §8.7). Nenhuma das duas foi confirmável nesta rodada —
as páginas de spec do Veo não foram legíveis e a doc do MiniMax não publica fps de saída. Os dois valores
**não estão verificados** e não podem ser tratados como fato na ficha técnica que vai ao ADR.

---

## 5. Cobrança em falha e o "só HTTP 200" (ataque nº 5)

A tabela da §8.5 item 2 é a que orienta a política de retry (e portanto o custo real). O que conferi
diretamente:

| Provedor | Alegação do dossiê | Veredito QA | Evidência literal |
|---|---|---|---|
| **Vertex** | "Cobram só HTTP 200" | **CONFIRMADO** | *"You're charged only for requests that return a 200 response code."* |
| **Pika** | "Only successful generations are charged" | **CONFIRMADO** | *"Only successful generations are charged."* (e o envelope de falha traz `"billing": {"state":"settled","charge_micro_usd": 0}`) |
| **Luma** | reembolsa `content_moderated` / `generation_failed` / `output_not_found` | **CONFIRMADO, com omissão** | A tabela oficial tem **quatro** linhas: os três códigos = *Refunded* **e `budget_exhausted` = "Partial charge possible"**. O dossiê omite a quarta linha — que é exatamente a que interessa a um pipeline com teto de gasto. |
| **MiniMax** | "não cobram/reembolsam" | **NÃO VERIFICADO** | A página de preços (`.md`) não trata de falha; a página de billing não foi aberta nesta sessão. |
| **Runway** | reembolsa exceto falhas `SAFETY.INPUT.*` | **NÃO VERIFICADO** | Não abri `docs.dev.runwayml.com/errors/task-failures/`. |
| **OpenAI (Sora)** / **Kling** | `NÃO VERIFICADO` no dossiê | **NÃO VERIFICADO** (concordo) | Sora encerrado em 24/09/2026 segundo o dossiê; irrelevante para a decisão. |

**Achado de QA:** a tabela é utilizável, mas **não é base suficiente** para dimensionar retry. Falta
justamente o custo do insumo em regeneração (a §8.5 item 3 cita "insumo cobrado à parte"): o MiniMax
cobra imagem de entrada — **primeiras 5 grátis, $0,04 por imagem adicional** (`MiniMax-H3`), e no
H3-Max **primeiras 2 grátis, $0,074 por adicional**. Com retrabalho de 1,5–2,0 passes e 1–2 imagens de
referência por plano, isso entra na conta e **não está em nenhuma das stacks**.

---

## 6. Spot-check das marcas `NÃO VERIFICADO` (ataque nº 6)

O dossiê tem 133 ocorrências de `NÃO VERIFICADO`. Atacadas **17**: **6 fecham** (viram fato verificado
com citação literal), **2 se agravam** (afirmação que o dossiê trata como *verificada* se revela **não
verificável**), **3 se confirmam** (o dossiê estava certo) e **6 continuam abertas**, com a evidência do
que foi tentado. Nenhuma foi fechada por memória.

| # | Item | Status no dossiê | Resultado do QA | Evidência literal / URL |
|---|---|---|---|---|
| 1 | fps de geração do **Kling 3.0 / 3.0 Omni** | `NÃO VERIFICADO` ("não publicam fps; não é lícito transferir o 24 fps do O1") | **FECHADO → 24 fps** | *"The video frame rate is based on 24fps to 60fps (**the frame rate for generating videos is 24fps**)."* — https://kling.ai/document-api/api/video/3-0-omni/video-omni.md (idêntico no O1) |
| 2 | **Preço da conformação de fps** no Runway (`enhance_frame_rate`) | endpoint citado, sem preço | **FECHADO → $0,005/s** (1 crédito/2 s) | *"Enhance Frame Rate (`enhance_frame_rate`) … Billed per second of input."* tabela: `enhance_frame_rate` = **1 credit per 2 seconds** — https://docs.dev.runwayml.com/guides/pricing/ |
| 3 | **Insumo de imagem do MiniMax-H3** ("imagens além das 5 primeiras") | regra citada, **sem preço** | **FECHADO → $0,04/imagem** adicional (H3-Max: 2 grátis, $0,074) | `\| MiniMax-H3 \| Image \| First **5 images** free; **$0.04 per additional image** \|` — https://platform.minimax.io/docs/guides/pricing-paygo.md |
| 4 | **Regiões do Alibaba Model Studio** (§4 "demais provedores NÃO VERIFICADO") | `NÃO VERIFICADO` | **FECHADO** — 6 regiões publicadas, **Brasil não está nelas** | *"Each region has its own endpoint, API Key, and model list. **These cannot be used across regions**."* China (Beijing), Singapore, Germany (Frankfurt), Japan (Tokyo), China (Hong Kong), US (Virginia) — https://www.alibabacloud.com/help/en/model-studio/regions |
| 5 | **BFL: ToS exige 18+** | afirmado sem citação direta | **FECHADO** | *"You must be 18 years of age or older to use the Services."* — https://bfl.ai/legal/terms-of-service |
| 6 | **Idade mínima da conta Kling** | não tratado | **FECHADO → 13+** | *"Anyone under the age of 13 or other minimum age as defined under applicable laws of your jurisdiction ("Minimum Age") shall not use the Services."* — https://kling.ai/docs/user-policy |
| 7 | **Luma: fps** | `NÃO VERIFICADO` | **continua `NÃO VERIFICADO`** (3 páginas oficiais lidas: `/guides/videos/generation`, `/guides/model/`, `/api/.../create` truncada) — nenhum valor de fps existe na doc | — |
| 8 | **Veo: fps** | dossiê afirma **24 fps** como verificado (§8.1, §8.7) | **AGRAVA → `NÃO VERIFICADO`.** Nenhuma página de spec do Veo foi legível (6 URLs tentadas; nav gigante trunca antes da tabela). O "24 fps" do Veo **não é fato verificado** | https://ai.google.dev/gemini-api/docs/veo |
| 9 | **MiniMax: fps de geração** | dossiê afirma **24 fps** como verificado (§8.7) | **AGRAVA → `NÃO VERIFICADO`.** A doc do MiniMax não publica fps de saída; o único fps é limite de **entrada** (`video_url`: *"Frame rate: [23.976, 60]"*) | https://platform.minimax.io/docs/guides/video-generation.md |
| 10 | **Vertex: `count = 1 segundo`** (lacuna L7) | `NÃO VERIFICADO` | **FORTEMENTE SUSTENTADO por fonte oficial** — o blog oficial da Google publica Veo 3 a **$0.40/segundo** | *"Veo 3: **Now $0.40 / second**; was $0.75 / second"* — https://developers.googleblog.com/en/veo-3-and-veo-3-fast-new-pricing-new-configurations-and-better-resolution/ |
| 11 | **Vertex: "cobrado só em HTTP 200"** | afirmado como verificado (§8.2) | **CONFIRMADO por mim** — a página é shell JS no fetch direto, mas o extrator sobre a URL oficial devolve a frase literal (ver §5). *(A branch delegada não conseguiu; eu consegui — a diferença é o extrator.)* | https://cloud.google.com/vertex-ai/generative-ai/pricing |
| 12 | **OpenAI: `openai.com/policies/*` → HTTP 403** | `NÃO VERIFICADO` (e declarado 403) | **CONFIRMADO o 403**; as cláusulas de titularidade/menores permanecem **`NÃO VERIFICADO`** (corpo vazio) | https://openai.com/policies/business-terms/ · https://openai.com/policies/terms-of-use/ |
| 13 | **Google Cloud TTS: preço por caractere** | `NÃO VERIFICADO` | **continua `NÃO VERIFICADO`.** HTTP 200 com o corpo reduzido ao título; `?hl=en` idem. Só a **unidade** é oficial: *"priced based on the number of characters sent to the service"* | https://cloud.google.com/text-to-speech/pricing |
| 14 | **Preço do Lyria** | `NÃO VERIFICADO` | **continua `NÃO VERIFICADO`** — a página de preços trunca antes da seção de música; o model card do `lyria-3-pro-preview` **não tem campo de preço** | https://ai.google.dev/gemini-api/docs/pricing · https://ai.google.dev/gemini-api/docs/models/lyria-3-pro-preview |
| 15 | **Stability AI: preço** | `NÃO VERIFICADO` | **continua `NÃO VERIFICADO`** — `platform.stability.ai/*` e `stableaudio.com/pricing` devolvem só título; o JSON oficial da página de preços tem `"mainContent": ""` | https://platform.stability.ai/pricing |
| 16 | **Ideogram: preço da API v3/v4** | `NÃO VERIFICADO` | **continua `NÃO VERIFICADO`** — redirect cross-origin bloqueia `ideogram.ai/api-pricing`; a **própria doc oficial** manda não confiar em tabela estática | *"do not rely on static tables in docs for purchase decisions"* — https://docs.ideogram.ai/plans-and-pricing/available-plans.md |
| 17 | **Suno Premier: preço em USD** | `NÃO VERIFICADO` | **continua `NÃO VERIFICADO`** (o artigo 2410177 é o de distribuição, sem preço); **CONFIRMADO** apenas o crédito | *"The **Premier** plan includes **10,000 credits** that are replenished monthly."* — https://help.suno.com/en/articles/2417089 |

**Ganho líquido para a decisão:** o item 1 fecha uma dúvida de fps do Kling, o 2 e o 3 **adicionam
custo real** que não estava em nenhuma stack, o 4 fecha a questão regional do provedor de vídeo
recomendado, e os itens 8 e 9 **retiram duas "confirmações" falsas** da ficha técnica (Veo e MiniMax a
24 fps) — que era exatamente o número usado para sustentar a "mediana de 24 fps".

### 6.1 Lacuna L2 (termos da Alibaba para o Wan) — continua aberta, mas agora com o caminho exato

Tentei `https://www.alibabacloud.com/help/en/model-studio/related-agreements` (HTTP 200): a página é um
**índice de 6 documentos**, não o texto dos termos. Os contratos aplicáveis são, literalmente:

- Alibaba Cloud International Website **Product Terms of Service** (v3.8.0)
- Alibaba Cloud Model Studio — **Model Inference SLA**
- Alibaba Cloud International Website **Membership Agreement**
- Alibaba Cloud International Website **Privacy Policy**
- **Open Source Model License Terms**
- **Third Party Vendor Information and Terms of Service**

O dossiê apontou a URL certa; o que falta é abrir os dois primeiros e o de terceiros. **Enquanto isso
não acontecer, a stack recomendada (B) depende de termos não lidos** — e é por isso que a alternativa
de comprar o mesmo `wan3.0-video` **via Runway** (§1.6 e §"acertou" item 8) é materialmente importante:
ela substitui o contratante.

---

## O que o dossiê errou

1. **A aritmética da §10.2 usa clipe de 7 s contra a premissa P5 (8 s) declarada pelo próprio autor** —
   subestima o custo de vídeo em **14,29%** e o US$/min em **~14,6%** nas três stacks. É o erro que
   decide a D2, porque é da ordem do teto proposto.
2. **O teto de US$ 20/min está furado pela própria stack recomendada**: com a aritmética correta
   (US$ 21,18/min) e o preço do Wan da região mais cara, a stack B já nasce fora do teto.
3. **O preço do Wan é apresentado sem o qualificador de região.** US$ 0,20/s a 1080P é o preço de
   **Singapore**; as outras cinco regiões (inclusive **US-Virginia**) são **US$ 0,165025/s**. O dossiê
   cita "não existe região na América do Sul (tráfego do Brasil sai de Singapore/Virginia)" — a mesma
   frase em que **escolhe o preço mais caro das duas**.
4. **`1,5 = taxa de rejeição de 50%` não fecha**: 1,5 corresponde a 33,3% de rejeição total; 50% de
   rejeição é fator 2,0. A premissa mais sensível do modelo tem dois rótulos incompatíveis.
5. **A contagem de imagens por plano oscila (60 / 90 / 120) conforme o fator de retrabalho**, quando
   P7 fixa 2 imagens/plano no cenário realista. O retrabalho foi aplicado *no lugar* do P7.
6. **A linha "Runway `gen4_turbo` = US$ 4,98/min" (§10.4) é impossível**: o modelo só gera 5 s ou 10 s
   (premissa do próprio §8.7), então um plano de 7 s custa 10 s de geração → **$6,91/min (+38,8%)**.
7. **A comparação "Google ≈ US$ 4/min vs não-Google ≈ US$ 18/min" (§10.6/§11.3.6) troca o fator de
   retrabalho** (1,0 no Google, 1,5 nas demais). Em base igual: **$5,57 vs $21,18 (~3,8×)**. A conclusão
   sobrevive; o número divulgado, não.
8. **A citação do Google *"professional or business purposes, not for consumer use"* não existe na
   página citada.** Não a encontrei nas seções "Restrições de uso" das renderizações pt-BR e sq dos
   Additional Terms vigentes. Citação a remover ou re-atribuir.
9. **A stack C aparece com dois totais** ($177,11/$25,30 em §0 e §10.3; $177,61/$25,37 em §11.2). Os
   dois não reconciliam com os componentes.
10. **O over-read da ElevenLabs**: o bloqueio é justificado com duas cláusulas que não são de output
    (proibição de **upload** de Voice Data de menor = insumo; proibição de **adicionar** voz infantil à
    **Voice Library** = compartilhamento). A cláusula que de fato sustenta o bloqueio — PUP 9(r),
    "bundled solutions that **target** anyone under the age of 13" — está citada em §6.3 e **não é usada
    na §11.1**.
11. **A obrigação de divulgação da Azure é maior do que o dossiê diz**: vale para **todas** as vozes
    TTS (inclusive a prebuilt infantil), não só para CNV.
12. **Omite linhas oficiais que mudam contas**: `budget_exhausted` = "Partial charge possible" na Luma;
    **$0,04/imagem adicional** de insumo no MiniMax-H3 (as 5 primeiras são grátis); e o preço do
    `enhance_frame_rate` (1 crédito/2 s) no Runway.
13. **A tese dos "30 fps" não sobrevive como está escrita.** *"O **único** provedor que documenta 30 fps
    é o Wan"* é falso: o Runway documenta `targetFramerate` = **30** (e 29,97) para `enhance_frame_rate`
    e a Pika documenta `target_fps` **15–240** (inclui 30 e 29,97) no endpoint Topaz. A versão estreita
    ("nenhum outro **gera** 30 fps nativamente") sobrevive — mas é **outra frase**.
14. **"A mediana documentada é 24 fps" é afirmação sem fonte e sem base amostral.** Só três provedores
    documentam fps de geração na amostra (Wan 30, Kling 24, Nova Reel 24). E os dois "24 fps" que o
    dossiê lista como confirmados — **Veo** e **MiniMax** — **não são verificáveis** nas páginas oficiais:
    aqueles 24 fps eram justamente os que sustentavam a "mediana".
15. **Custo de insumo em retrabalho não entra em nenhuma stack**, apesar de a §8.5 item 3 reconhecer que
    ele existe: MiniMax cobra **$0,04 por imagem de referência além das 5 primeiras** (H3) — com 2
    imagens/plano e fator 1,5–2,0, isso é custo real por episódio, e some da conta.

## O que o dossiê acertou

1. **Disciplina de fonte.** Verifiquei 12 citações estruturais; **11 existem literalmente** na página
   oficial, incluindo os números difíceis (MiniMax $0,08/s, crédito Runway $0,01, Luma por geração,
   Pika $0,04/s, Wan 30 fps, Vertex HTTP 200, Azure fictional character voice, BFL §6.k, Cartesia AUP).
2. **A separação insumo × audiência está correta na maioria dos casos.** Pika, BFL e Runway foram
   classificados com o eixo certo (insumo / produto específico), e as três leituras conferem com o
   texto. O dossiê **não** superbloqueou Pika nem BFL.
3. **A cláusula do Google é uma cláusula de audiência real** — o alerta do §8.6 é o achado mais
   importante do dossiê e se sustenta literalmente. Tratá-lo como bloqueio até decisão jurídica é
   proporcional.
4. **A ressalva metodológica é honesta e rara**: o autor declara o uso de extrator de terceiro, diz
   quais números precisam ser reverificados à mão, e marca `NÃO VERIFICADO` em vez de chutar. As
   páginas que ele disse serem ilegíveis **são** ilegíveis ao fetch direto (Vertex, `cloud.google.com`,
   `support.google.com`) — reproduzi a limitação.
5. **As três armadilhas econômicas estão certas**: hospedagem de endpoint CNV a US$ 4,032/h
   (US$ 103,68/min com 4 episódios/mês — a aritmética confere: `4,032 × 24 × 30 / 4 / 7 = 103,68`), o
   gargalo de **download** do Suno Pro (US$ 10 ÷ 20 = US$ 0,50/faixa) e o fato de o Short recortado
   **não diluir** custo.
6. **Acertou em não tratar a Runway como bloqueada** e em registrar a cláusula da Kling como
   bloqueante — as duas leituras são literalmente corretas.
7. **A pista de reabrir o Google via Vertex tem base textual** (o próprio Additional Terms exclui o uso
   direto de GCP) — e é a diferença entre ~$5,6/min e ~$21/min.
8. **O que o dossiê não viu e o QA achou a favor da decisão:** o Runway **revende** o `wan3`
   (480p/720p/1080p = **5/10/20 créditos/s = $0,05/$0,10/$0,20/s**) e o `h3_max` (480p/768p =
   $0,05/$0,08/s). Isto é: o provedor de vídeo da stack recomendada pode ser contratado **por um
   revendedor com faturamento e termos ocidentais**, sem depender do Model Studio — o que ataca
   diretamente a lacuna L2 (termos da Alibaba não alcançados) e a restrição de região.
9. **A limitação de leitura que ele declarou é real, e eu a reproduzi.** Testei por fora as páginas que
   ele disse serem ilegíveis: `cloud.google.com/text-to-speech/pricing`, `platform.stability.ai/pricing`,
   `ideogram.ai/api-pricing`, `suno.com/pricing` e as páginas do Vertex devolvem **só o título** (shell
   JS), e `openai.com/policies/*` devolve **HTTP 403 confirmado**. Ele não usou "não consegui ler" como
   desculpa para chutar — usou como `NÃO VERIFICADO`. Isso é o comportamento correto do projeto.
10. **Aceitou o custo de oportunidade sem esconder a ressalva**: registrou o caminho Google como ~5×
    mais barato **e** marcou que a cláusula de audiência o bloqueia, em vez de omitir o número bom.

## Veredito

**`não verificável como base de decisão` — aprovado apenas para as partes não-§10.**

O dossiê é sólido em **política, limites e cláusulas**, e é honesto sobre o que não conseguiu ler. Mas a
peça que a D2 existe para responder — o **teto em US$/min** — está **errada por construção** (clipe de
7 s contra a própria premissa de 8 s), o **teto proposto de US$ 20/min é estourado pela stack que ele
recomenda**, e o **preço do provedor de vídeo foi publicado sem a região**, que é justamente o parâmetro
que faz o teto caber ou não.

**Antes de ir ao humano, o dossiê precisa de uma errata com seis itens, todos fecháveis em uma
tarde:** (1) refazer a §10 com `dur_clipe_s = 8` (720 s pagos por episódio a 1,5 passe) e escolher
explicitamente entre 1,5 (33% de rejeição) e 2,0 (50%); (2) republicar o preço do Wan **por região** e
travar a região no ADR (US-Virginia, US$ 0,165025/s); (3) corrigir a linha Runway `gen4_turbo` para
clipe de 10 s; (4) remover ou re-atribuir a citação do Google não localizada; (5) reescrever a tese dos
fps — *"nenhum outro provedor **gera** 30 fps nativamente"* é defensável, *"o único que documenta
30 fps"* é falso, e *"a mediana é 24 fps"* não tem fonte; (6) retirar Veo e MiniMax da lista de fps
"confirmados oficialmente" e marcar os dois como `NÃO VERIFICADO`. Feito isso, e mantido o resto, o
dossiê fica **aprovado sem ressalvas** para a decisão — a arquitetura proposta (Wan 1080P@30 + FLUX.2 +
Azure prebuilt + Suno Pro, 60 clipes concatenados) sobrevive à revisão inteira, e sai **mais barata**
do que o dossiê pensava se a região do Wan for US-Virginia (US$ 17,58/min) e **mais cara** se for
Singapore (US$ 21,18/min).

**O que eu NÃO verifiquei** (e portanto não aprovo nem refuto): preços de Azure Speech na API de varejo;
o bucket de imagens do Google/Nano Banana e do OpenAI GPT Image; os preços de música (Suno/Udio/Lyria/
Stability); fps e limites de Runway `gen4.5`/`gen4_turbo` além do que está na §8.7 do dossiê; política
da OpenAI sobre menores (403); termos específicos da Alibaba (§6.1); e a cláusula §11 da Privacy Policy
da ElevenLabs. Nada disso está no caminho crítico do teto — com a exceção dos termos da Alibaba (§6.1),
que é bloqueio de produção e não de custo.
