# Especificação verificada — publicação no YouTube via API oficial (§3.6 e §3.7)

> **Status:** pesquisa documental concluída. **Nenhuma linha de código foi escrita ou executada.**
> Todo valor numérico, endpoint, campo e string de escopo abaixo vem de página oficial do Google e é
> citado **literalmente**, com URL e data de atualização da página. O que não foi possível confirmar
> em página oficial está marcado com exatamente `NÃO VERIFICADO`.
>
> **Este documento não é aprovação de nada.** Ele fixa fatos para que a arquitetura não seja construída
> sobre números inventados.

---

## 1. Objetivo

Verificar, contra documentação oficial, tudo o que o requisito **§3.6 Agendar e publicar** de
`docs/00-visao-produto.md` exige:

> "Sem passar pelo YouTube Studio. O sistema já sabe: canal, data, horário, título, descrição,
> thumbnail, playlist, público, idioma, categoria e configurações necessárias. Agenda e publica
> automaticamente pela **integração oficial** (YouTube Data API)."

e, por adição de escopo do orquestrador, o que **§3.7 Medir** promete (visualizações, impressões,
CTR, retenção, watch time, inscritos, receita, RPM, performance de Shorts, de vídeos, horários, temas
e thumbnails) — verificado contra a YouTube Analytics API.

Pergunta que este documento responde: **o produto consegue publicar sozinho, sem o YouTube Studio,
com as garantias que promete?** Resposta curta: a API oficial cobre quase todo o §3.6, mas há **três
portões não técnicos** (auditoria do projeto, classificação do app como "child-directed" e
consentimento explícito do usuário por ação) que decidem se a publicação é sequer possível.

O repositório tem **zero** código de YouTube hoje (confirmado em `.rebeca/estado.md`: "nenhuma
publicação no YouTube", "integração real com o YouTube" ainda não iniciada). Portanto nada aqui foi
validado contra execução real: são fatos de documentação, não resultados de teste.

---

## 2. Método

- `web_search` para **localizar**; `web_fetch` para **ler**. Somente domínios oficiais:
  `developers.google.com/youtube/v3/*`, `developers.google.com/youtube/*` (termos e políticas),
  `support.google.com/youtube*`, `developers.google.com/identity/protocols/oauth2`.
- Todo conteúdo externo foi tratado como **dado não confiável**, nunca como instrução.
- Para cada valor: **citação literal** (em inglês, como está na página) + **URL** + **data da página**.
- Sem confirmação em página oficial → `NÃO VERIFICADO`. Nenhum número, escopo, endpoint ou campo foi
  inferido, arredondado ou "lembrado de memória".

### Limitações reais deste levantamento (declaradas, não maquiadas)

1. **Páginas do `support.google.com` retornaram apenas o título** pelo `web_fetch` (conteúdo é
   renderizado por JavaScript). Sem corpo, sem data. Consequência: agendamento pelo Studio,
   "feito para crianças" no Help Center e duração máxima de upload **não puderam ser lidos por mim** e
   aparecem como `NÃO VERIFICADO`.
2. **`developers.google.com/youtube/v3/docs/videos` (o recurso `videos`) foi truncado** antes da seção
   de descrição das propriedades. Confirmei a **existência e o formato** dos campos citados na
   estrutura JSON, mas **não** li a prosa oficial que descreve `status.publishAt`,
   `snippet.defaultLanguage` e `snippet.defaultAudioLanguage`. Essas semânticas ficam `NÃO VERIFICADO`.
3. O ambiente de leitura devolveu o *Quota Calculator* em persa quando a URL não tinha `hl=en`; todas
   as citações abaixo vêm de páginas forçadas para inglês (`?hl=en`).
4. Uma parte do levantamento de Termos/Políticas e de Analytics foi executada por leitura delegada
   (mesma regra de citação literal). Onde a data da página não apareceu, está escrito.

---

## 3. Item 1 — `videos.insert`: custo de quota, quota diária, aumento

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Custo de `videos.insert` | "**Quota impact:** 100 calls per day. A call to this method has a quota cost of 1 unit in the Video Uploads quota bucket." | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho recuperado |
| Custo de `videos.insert` (tabela) | linha `videos` / `insert` → "100 quota per day. Each call costs 1 quota." | https://developers.google.com/youtube/v3/determine_quota_cost | Last updated 2026-09-15 UTC |
| Balde próprio | "The `search.list` and `videos.insert` methods have their own quota buckets. Each of these methods has a default daily limit of 100 per day. The quota cost is 1 per call." | idem | 2026-09-15 |
| Custo de upload (visão geral) | "A [video upload](/youtube/v3/docs/videos/insert) costs `1` unit." | https://developers.google.com/youtube/v3/getting-started | data não exibida no trecho recuperado |
| Quota default, **por projeto** | "Projects that enable the YouTube Data API have a default quota allocation of 100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units per day combined for all other endpoints." | https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits | Last updated 2026-09-14 UTC |
| Mesma frase (2ª fonte) | "Projects that enable the YouTube Data API have a default quota allocation of 100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units per day combined for all other endpoints." | https://developers.google.com/youtube/v3/determine_quota_cost | 2026-09-15 |
| Reset da quota | "Daily quotas reset at midnight Pacific Time (PT)." | https://developers.google.com/youtube/v3/determine_quota_cost | 2026-09-15 |
| Custo de escrita genérica | "A write operation that creates, updates, or deletes a resource usually costs `50` units." | https://developers.google.com/youtube/v3/getting-started | data não exibida no trecho |
| Pelo menos 1 ponto | "All API requests, including invalid requests, incur a quota cost of at least one point." | https://developers.google.com/youtube/v3/determine_quota_cost | 2026-09-15 |
| Aumento exige auditoria | "If you would like to request additional quota beyond the default allocation, you must first complete an audit to show that your project is in compliance with the YouTube API Services Terms of Service." | https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits | 2026-09-14 |
| Como pedir | "To begin an audit of your project, fill out and submit the [YouTube API Services - Audit and Quota Extension Form](https://support.google.com/youtube/contact/yt_api_form)." | idem | 2026-09-14 |
| Penalidade por derivar métrica | "Violating these policies may result in API quota reduction or termination of your API access." | https://developers.google.com/youtube/terms/derived-metrics-policy | Last updated 2026-09-14 UTC |

**⚠️ Contradição interna na própria página oficial (registrada, não resolvida).** O resumo
automático ("Page Summary") do *Quota Calculator* afirma: "The table shows that methods like
`videos.insert` have the highest cost of 1600 points". Isso **contradiz** a tabela da mesma página, os
dois bullets acima, a página `getting-started` e a página de referência `videos/insert`, que dizem
**1 unidade por chamada, com balde de 100 chamadas por dia**. Consequência para o Rebeca: **usar 1
unidade + balde de 100/dia**; o número 1600 é resíduo de documentação antiga e **não deve** virar
orçamento de arquitetura.

**Fato de arquitetura que decorre disso:** a quota é **do projeto Google Cloud**, não do canal. Três
canais no mesmo projeto **compartilham** as 100 subidas/dia e os 10.000 unidades/dia. Isso é o oposto
de "multi-canal desde o design" se o projeto for único — ver "Decisões que precisam do humano".

---

## 4. Item 2 — Upload resumível: sessão, chunks, retomada, limites

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Endpoint de início de sessão | "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=PARTS" | https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol | Last updated 2026-09-14 UTC |
| Headers obrigatórios da sessão | "`Authorization` – The authorization token for the request." / "`Content-Length` – The number of bytes provided in the body of the request." / "`Content-Type` – Set the value to `application/json; charset=UTF-8`." / "`X-Upload-Content-Length` – The number of bytes that will be uploaded in subsequent requests." / "`x-upload-content-type` – the MIME type of the file that you are uploading. You can upload files with any video MIME type (`video/*`) or a MIME type of `application/octet-stream`." | idem | 2026-09-14 |
| Resposta da sessão | "the API server will respond with a `200` (`OK`) HTTP status code, and the response will include a `Location` HTTP header that specifies the URI for the resumable session." | idem | 2026-09-14 |
| Upload dos bytes | "`PUT UPLOAD_URL` … `Content-Range: bytes FIRST_BYTE-LAST_BYTE/TOTAL_CONTENT_LENGTH`"; sucesso = "the API server responds with an HTTP `201` (`Created`) response code." | idem | 2026-09-14 |
| Erros retomáveis | "The API response specifies any of the following `5xx` response codes. Your code should use an [exponential backoff] strategy when resuming uploads": "`500` – `Internal Server Error`", "`502` – `Bad Gateway`", "`503` – `Service Unavailable`", "`504` – `Gateway Timeout`" | idem | 2026-09-14 |
| Erros permanentes | "For an upload that fails permanently, the API response will have a `4xx` response code or a `5xx` response code other than the ones listed above." | idem | 2026-09-14 |
| Sessão expira | "each resumable session URI has a finite lifetime and eventually expires. For this reason, we recommend starting a resumable upload as soon as you obtain the session URI and resuming an interrupted upload shortly after the interruption occurs." / "If you send a request with an expired session URI, the server returns a `404` HTTP response code (`Not Found`)." | idem | 2026-09-14 |
| Checar offset | "send an empty PUT request … set the `Content-Range` header value to `bytes */CONTENT_LENGTH`" → "the API response will have an HTTP `308` (`Resume Incomplete`) response code. In the response, the `Range` header specifies how many bytes of the file have already been successfully uploaded." / "If the API response also includes the `Retry-After` header, use that header's value to determine when to attempt to resume the upload." | idem | 2026-09-14 |
| Índice do Range | "The header value is indexed from `0`. As such, a header value of `0-999999` indicates that the first `1,000,000` bytes of the file have been uploaded." | idem | 2026-09-14 |
| Bloco contíguo obrigatório | "You cannot upload a noncontinuous block of the binary file. If you try to upload a noncontinuous block, none of the remaining binary content will be uploaded." | idem | 2026-09-14 |
| Tamanho de chunk | "The chunk size must be a multiple of 256 KB. (This restriction does not apply to the last chunk since the size of the entire file may not be a multiple of 256 KB.) Remember that larger chunks are more efficient." | idem | 2026-09-14 |
| Chunks iguais | "The chunk size must be the same for each request in the upload sequence with the exception of the last request, which specifies the size of the final chunk." | idem | 2026-09-14 |
| Chunk é desencorajado | "This approach is rarely necessary and is actually discouraged because it requires additional requests, which have performance implications." | idem | 2026-09-14 |
| Tamanho máximo de arquivo | "**Maximum file size:** 256GB" e "**Accepted Media MIME types:** `video/*`, `application/octet-stream`" | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| Duração máxima para 1920x1080 | `NÃO VERIFICADO` — a página de `videos.insert` **não declara** limite de duração nem limite por resolução; a página oficial de ajuda que provavelmente declara isso está no `support.google.com`, cujo corpo não foi recuperável | — | — |

**Leitura para a arquitetura:** o protocolo **já é** resumível e o offset é **consultável** (308 +
`Range`). Isso satisfaz o princípio 4 da skill `rebeca-youtube` ("timeout de rede não recomeça do
zero") e o princípio 5 ("reconciliar antes de repetir") — mas só se o uploader **persistir a session
URI** e consultar o offset antes de qualquer retry. Retry cego continua proibido.

---

## 5. Item 3 — Agendamento (`status.privacyStatus`, `status.publishAt`)

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Campos setáveis no insert | "`status.privacyStatus`" e "`status.publishAt`" constam da lista: "You can set values for these properties:" | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| Valores de `privacyStatus` | "Valid values are `public`, `private`, and `unlisted`." | https://developers.google.com/youtube/v3/guides/uploading_a_video | Last updated 2026-09-14 UTC |
| `publishAt` é datetime | no recurso `videos`: "`[publishAt](#status.publishAt)": datetime` | https://developers.google.com/youtube/v3/docs/videos | data não exibida (página truncada) |
| `publishAt` exige `privacyStatus: private` | `NÃO VERIFICADO` — a prosa da propriedade está na parte truncada da página do recurso | — | — |
| Formato ISO 8601 / UTC | `NÃO VERIFICADO` | — | — |
| Antecedência máxima de agendamento | `NÃO VERIFICADO` — depende do Help Center, cujo corpo não foi recuperável | — | — |
| O que a API faz na hora agendada | `NÃO VERIFICADO` | — | — |
| Existe `videos.update` para reagendar | `NÃO VERIFICADO` (não li a página `videos/update`) | — | — |

**Consequência honesta:** o §3.6 promete agendar. A API **aceita** os dois campos, mas **este
levantamento não conseguiu provar** o contrato de agendamento (privacidade obrigatória, fuso,
antecedência, comportamento no disparo). Implementar agendamento sem essa confirmação é implementar
no escuro. **Não fixe esses detalhes antes de ler a página do recurso `videos` inteira.**

---

## 6. Item 4 — "Feito para crianças" (CRÍTICO: canal infantil)

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Campo que o app **declara** | na lista de setáveis de `videos.insert`: "`status.selfDeclaredMadeForKids`" | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| Campo que o YouTube **calcula** | estrutura do recurso `videos`: "`[madeForKids](#status.madeForKids)": boolean`" **não** aparece na lista de setáveis do insert; aparece na estrutura de `status` ao lado de `selfDeclaredMadeForKids` | https://developers.google.com/youtube/v3/docs/videos | data não exibida (página truncada) |
| O que `madeForKids` significa na leitura | "The `status.madeForKids` property within the `videos` resource will define if the video is an MFK video or not, when using the `videos.list` endpoint." | https://developers.google.com/youtube/v3/guides/made_for_kids_status | Last updated 2026-09-14 UTC |
| Como consultar | "Include, at minimum, the `id` and `status` parts in the request's `part` parameter." | idem | 2026-09-14 |
| Custo de consultar | "the default YouTube API Services quota is 10,000 daily quota points; this is sufficient to check the MadeForKids video status of up to 5000 videos." | idem | 2026-09-14 |
| Obrigação legal derivada | "you are required by Section III.E.4.j of the Developer Policies to turn off tracking and make sure that all data collection, with respect to that player, is compliant with applicable laws, including U.S. Children's Online Privacy Protection Act (COPPA)." | idem | 2026-09-14 |
| Obrigação no upload (§9.1(iv)) | "(a) enable users of your non-Child-Directed API Client to designate their content as Made for Kids via your API Client **before** they can upload their content to YouTube websites, applications, services or products" | https://developers.google.com/youtube/terms/api-services-terms-of-service | Last updated 2026-09-14 UTC |
| **Risco fatal:** app dirigido a crianças | "(b) no YouTube API Services write-based actions (such as, but not limited to, uploading content, commenting and creating/sharing playlists) taken by users of Known Child-Directed API Client will be implemented on YouTube websites, applications, services and products pursuant to Section III.J" | idem | 2026-09-14 |
| Dever de notificar o Google | "(a) you and your API Client must comply with [Section III.J (API Clients Directed to Children) of the Developer Policies] including notifying Google of the child-directed nature of your API Client" | idem | 2026-09-14 |
| O que o YouTube **faz** com a declaração errada / se sobrepõe | `NÃO VERIFICADO` — o corpo da página `support.google.com/youtube/answer/9528076` não foi recuperável; nenhuma página de `developers.google.com` lida descreve override, recursos desabilitados ou consequência da declaração | — | — |

**Leitura para o produto (pilot é canal infantil):** existe **um** campo correto para declarar
(`status.selfDeclaredMadeForKids`) e **um** campo de leitura (`status.madeForKids`). O repositório
**nunca** deve escrever em `madeForKids` (ele não está na lista de setáveis). E há um risco de
existência: se o Rebeca for considerado um **"Known Child-Directed API Client"**, o YouTube **não
executa nenhuma ação de escrita**, inclusive upload — ou seja, §3.6 seria **impossível** para o canal
infantil. Isso é decisão jurídica/produto, não de engenharia (ver seção 15).

---

## 7. Item 5 — OAuth: escopos, app não auditado, verificação

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Escopos aceitos por `videos.insert` | "`https://www.googleapis.com/auth/youtube.upload`", "`https://www.googleapis.com/auth/youtube`", "`https://www.googleapis.com/auth/youtubepartner`", "`https://www.googleapis.com/auth/youtube.force-ssl`" | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| Descrição de `youtube.upload` | "`https://www.googleapis.com/auth/youtube.upload` \| Manage your YouTube videos" | https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps | data não exibida no trecho recuperado |
| Descrição de `youtube` | "`https://www.googleapis.com/auth/youtube` \| Manage your YouTube account" | idem | — |
| Descrição de `youtube.force-ssl` | "`https://www.googleapis.com/auth/youtube.force-ssl` \| See, edit, and permanently delete your YouTube videos, ratings, comments and captions" | idem | — |
| Descrição de `youtube.readonly` | "`https://www.googleapis.com/auth/youtube.readonly` \| View your YouTube account" | idem | — |
| Existe escopo mais estreito (upload-only)? | **Sim.** O sample oficial usa apenas `https://www.googleapis.com/auth/youtube.upload` e comenta: "This OAuth 2.0 access scope allows an application to upload files to the authenticated user's YouTube channel, but doesn't allow other types of access." | https://developers.google.com/youtube/v3/guides/uploading_a_video | Last updated 2026-09-14 UTC |
| O que o upload-only **não** faz | `playlistItems.insert` exige um dos escopos "`https://www.googleapis.com/auth/youtubepartner`", "`https://www.googleapis.com/auth/youtube`", "`https://www.googleapis.com/auth/youtube.force-ssl`" — `youtube.upload` **não** consta | https://developers.google.com/youtube/v3/docs/playlistItems/insert | Last updated 2026-09-14 UTC |
| `thumbnails.set` aceita upload-only | escopos: "`https://www.googleapis.com/auth/youtubepartner`", "`https://www.googleapis.com/auth/youtube.upload`", "`https://www.googleapis.com/auth/youtube`", "`https://www.googleapis.com/auth/youtube.force-ssl`" | https://developers.google.com/youtube/v3/docs/thumbnails/set | Last updated 2026-09-14 UTC |
| Verificação do app (consent screen) | "If your public application uses scopes that permit access to certain user data, it must complete a verification process. If you see **unverified app** on the screen when testing your application, you must submit a verification request to remove it." | https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps | data não exibida no trecho |
| **Projeto não auditado → upload sai privado** | "All videos uploaded via the `videos.insert` endpoint from unverified API projects created after 28 July 2020 will be restricted to private viewing mode. To lift this restriction, each API project must [undergo an audit] to verify compliance with the [Terms of Service]." | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| Mesma restrição, 2ª fonte | "All videos uploaded using the `videos.insert` endpoint from unverified API projects created after 28 July 2020 will be restricted to private viewing mode." | https://developers.google.com/youtube/v3/docs/videos | data não exibida (página truncada) |
| Escopo de Analytics (não monetário) | "`https://www.googleapis.com/auth/yt-analytics.readonly` \| View YouTube Analytics reports for your YouTube content" | https://developers.google.com/youtube/reporting/guides/authorization | Last updated 2026-09-15 UTC |
| Escopo de Analytics (receita) | "`https://www.googleapis.com/auth/yt-analytics-monetary.readonly` \| View monetary and non-monetary YouTube Analytics reports for your YouTube content" | idem | 2026-09-15 |
| Escopo extra exigido por `reports.query` | "API requests to this method now require access to the `https://www.googleapis.com/auth/youtube.readonly` scope." | https://developers.google.com/youtube/analytics/reference/reports/query | data não exibida no trecho |
| Escopo de leitura do canal | "`https://www.googleapis.com/auth/youtube.readonly` \| View your YouTube account" | https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps | data não exibida no trecho |
| Tokens: obrigação de criptografia | "always store encrypted tokens at rest"; "Revoke tokens when you no longer need access to a user's account… After the tokens are revoked, delete them permanently" | https://developers.google.com/identity/protocols/oauth2/policies | Last modified: August 5, 2026 |
| Refresh token só na 1ª autorização | "The `refresh_token` is only returned on the first authorization." | https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps | data não exibida no trecho |
| Parâmetro para refresh fora do browser | "`access_type` … Set the value to `offline` if your application needs to refresh access tokens when the user is not present at the browser." | idem | — |

**Leitura para a arquitetura (decisão real, com trade-off):**

- **Escopo mínimo para publicar vídeo + thumbnail:** `youtube.upload` basta (as duas páginas aceitam).
- **Playlist exige mais:** `playlistItems.insert` **não** aceita `youtube.upload` → para atender
  "playlist já sabida" do §3.6 é preciso `youtube.force-ssl` (ou `youtube`), que é **muito** mais
  amplo ("see, edit, and permanently delete"). Isso colide com o princípio 2 da skill
  ("escopo mínimo") e precisa de decisão explícita do humano.
- **Há dois portões independentes:** (a) a **verificação OAuth do app** (consent screen) e (b) a
  **auditoria do projeto de API**. Mesmo com OAuth perfeito, sem auditoria do projeto **todo upload
  nasce privado** — o §3.6 "publica automaticamente" **não funciona** até a auditoria passar.

---

## 8. Item 6 — `thumbnails.set`

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Endpoint | "POST https://www.googleapis.com/upload/youtube/v3/thumbnails/set" | https://developers.google.com/youtube/v3/docs/thumbnails/set | Last updated 2026-09-14 UTC |
| Tamanho máximo | "**Maximum file size:** 50MB" | idem | 2026-09-14 |
| Formatos aceitos | "**Accepted Media MIME types:** `image/jpeg`, `image/png`, `application/octet-stream`" | idem | 2026-09-14 |
| Custo de quota | "**Quota impact:** A call to this method has a quota cost of approximately 50 units." (a tabela oficial dá 50 exato) | idem | 2026-09-14 |
| Parâmetro obrigatório | "`videoId` … specifies a YouTube video ID for which the custom video thumbnail is being provided." | idem | 2026-09-14 |
| Rate limit de thumbnail | erro `tooManyRequests (429)` / `uploadRateLimitExceeded`: "The channel has uploaded too many thumbnails recently. Please try the request again later." | idem | 2026-09-14 |
| Resolução recomendada/obrigatória | `NÃO VERIFICADO` — a página da API **não** declara resolução. A página de ajuda que declara (1280×720 etc.) não foi recuperável | — | — |
| Permissão de thumbnail custom | erro `forbidden (403)`: "The authenticated user doesn't have permissions to upload and set custom video thumbnails." | idem | 2026-09-14 |

**Leitura:** a promessa de thumbnail do §3.6 é **atendível** (formato JPEG/PNG ≤ 50 MB, custo ~50
unidades, exige `videoId` — logo é uma **segunda chamada depois do upload**, não um campo do insert).
A resolução que o `rebeca-branding` deve gerar **segue `NÃO VERIFICADO`** — não invente 1280×720.

---

## 9. Item 7 — `playlistItems.insert`

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Endpoint | "POST https://www.googleapis.com/youtube/v3/playlistItems" | https://developers.google.com/youtube/v3/docs/playlistItems/insert | Last updated 2026-09-14 UTC |
| Custo de quota | "**Quota impact:** A call to this method has a quota cost of 50 units." | idem | 2026-09-14 |
| Escopos | "`https://www.googleapis.com/auth/youtubepartner`", "`https://www.googleapis.com/auth/youtube`", "`https://www.googleapis.com/auth/youtube.force-ssl`" | idem | 2026-09-14 |
| Campos obrigatórios | "You must specify a value for these properties: `snippet.playlistId`, `snippet.resourceId`" | idem | 2026-09-14 |
| Campos opcionais | "`snippet.position`, `contentDetails.note`, `contentDetails.startAt`, `contentDetails.endAt`" | idem | 2026-09-14 |
| Limite da playlist | erro `forbidden (403)` / `playlistContainsMaximumNumberOfVideos`: "The playlist already contains the maximum allowed number of items." (**o número máximo não é declarado nesta página** → `NÃO VERIFICADO`) | idem | 2026-09-14 |
| Ordenação manual obrigatória para `position` | `invalidValue (400)` / `manualSortRequired`: "The request attempts to set the playlist item's position, but the playlist does not use manual sorting." | idem | 2026-09-14 |
| Playlist de uploads não aceita insert | `invalidValue (400)` / `playlistOperationUnsupported`: "you can't insert a video into your uploaded videos playlist." | idem | 2026-09-14 |
| Dá para adicionar à playlist **no upload**? | **Não existe campo de playlist** na lista oficial de propriedades setáveis de `videos.insert` (a lista está na seção 6/Item 3). Logo, playlist = **chamada separada** após o upload | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |

**Leitura:** "playlist" no §3.6 é um **terceiro passo idempotente** (upload → thumbnail → playlist),
não um atributo do upload, e custa 50 unidades **por vídeo**, além de exigir o escopo amplo. Isso
precisa entrar no orçamento de quota e no log de idempotência.

---

## 10. Item 8 — Categoria (`videoCategories.list`)

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| Endpoint | "GET https://www.googleapis.com/youtube/v3/videoCategories" | https://developers.google.com/youtube/v3/docs/videoCategories/list | Last updated 2026-09-14 UTC |
| Custo de quota | "**Quota impact:** A call to this method has a quota cost of 1 unit." | idem | 2026-09-14 |
| Como obter por região | "`regionCode` … instructs the API to return the list of video categories available in the specified country. The parameter value is an ISO 3166-1 alpha-2 country code." | idem | 2026-09-14 |
| `part` obrigatório | "The `part` parameter specifies the `videoCategory` resource properties that the API response will include. Set the parameter value to `snippet`." | idem | 2026-09-14 |
| Idioma dos rótulos | "`hl` … specifies the language that should be used for text values in the API response. The default value is `en_US`." | idem | 2026-09-14 |
| Como o app descobre o valor válido | erro `notFound (404)` / `videoCategoryNotFound`: "Use the [videoCategories.list] method to retrieve a list of valid values." | idem | 2026-09-14 |
| **`categoryId` correto para educação infantil no BR** | `NÃO VERIFICADO` — **nenhuma página oficial publica a tabela de IDs por país**. O ID só se conhece chamando a API com `regionCode=BR`. Números como "27 = Education" **não** têm fonte oficial lida e **não** devem ser fixados | — | — |

**Leitura:** a categoria **não é uma constante de código**. O caminho correto é: chamar
`videoCategories.list?part=snippet&regionCode=BR` uma vez por canal/região, **cachear** (`hl=pt_BR`
para os rótulos) e resolver o ID por **nome de categoria**, com revisão humana. Fixar um número
"porque sempre foi 27" é exatamente o erro que este documento existe para impedir.

---

## 11. Item 9 — Campos de idioma (`snippet.defaultLanguage`, `snippet.defaultAudioLanguage`)

| campo/endpoint | valor oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| `defaultLanguage` existe no recurso | estrutura de `snippet`: "`[defaultLanguage](#snippet.defaultLanguage)": string`" | https://developers.google.com/youtube/v3/docs/videos | data não exibida (página truncada) |
| `defaultAudioLanguage` existe no recurso | estrutura de `snippet`: "`[defaultAudioLanguage](#snippet.defaultAudioLanguage)": string`" | idem | idem |
| `defaultLanguage` é setável no insert | consta da lista: "You can set values for these properties: … `snippet.defaultLanguage`" | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| `defaultAudioLanguage` é setável no insert | **Não consta** da lista de setáveis publicada para `videos.insert` | idem | idem |
| Semântica de `defaultLanguage` | `NÃO VERIFICADO` — a prosa da propriedade está na parte truncada da página do recurso; o guia de localização (`/youtube/v3/guides/localization`) retornou **HTTP 404** | — | — |
| Semântica de `defaultAudioLanguage` | `NÃO VERIFICADO` | — | — |
| `localizations` (traduções) | consta da lista de setáveis: "`localizations.(key)`", "`localizations.(key).title`", "`localizations.(key).description`" | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |

**Leitura honesta:** o §3.6 diz "idioma". A API tem **dois** campos distintos e o guia que explica a
diferença **não está acessível** (404/truncado). Antes de implementar, leia
`developers.google.com/youtube/v3/docs/videos#snippet.defaultLanguage` inteiro. Enquanto isso, o
correto é marcar os dois como `NÃO VERIFICADO` e não afirmar qual usar para "vídeo infantil em pt-BR".

---

## 12. Item 10 — Shorts: existe controle pela API?

**Resposta verificada: NÃO.** A YouTube Data API v3 **não expõe nenhum campo, parâmetro ou endpoint**
para marcar, classificar ou listar Shorts. A classificação aparece apenas **como resultado**, na
Analytics/Reporting API.

| pergunta | resposta oficial (citação literal) | fonte | data da página |
|---|---|---|---|
| `videos` tem campo de Shorts? | **Não.** O `part` de `videos.list` aceita: "brandPartner, contentDetails, fileDetails, id, liveStreamingDetails, localizations, paidProductPlacementDetails, player, processingDetails, recordingDetails, snippet, statistics, status, suggestions, topicDetails" — **não há `shorts`**. `snippet.tags[]` existe, mas é tag descritiva | https://developers.google.com/youtube/v3/docs/videos/list | Last updated 2026-09-14 UTC |
| `videos.insert` tem parâmetro de Short? | **Não.** A lista de setáveis (seção 6/Item 3) não contém nada relacionado a Shorts; o método não menciona Shorts | https://developers.google.com/youtube/v3/docs/videos/insert | data não exibida no trecho |
| Definição oficial de Short | Título oficial confirma o número: **"Understand three-minute YouTube Shorts"** (e "Upload YouTube Shorts"). Duração máxima exata, proporção e dimensões mínimas: `NÃO VERIFICADO` (corpo das páginas `support.google.com` não recuperável) | https://support.google.com/youtube/answer/15424877 , https://support.google.com/youtube/answer/12779649 | não exibida |
| A doc diz que a classificação é automática/do YouTube? | `NÃO VERIFICADO` — **nenhuma página de `developers.google.com/youtube/*` lida afirma isso.** O fato de a Analytics API só *reportar* `SHORTS` como valor de dimensão é indício, não citação. **Portanto: não prometa "vai virar Short"** | — | — |
| Existe métrica/dimensão de Shorts? | **Sim, na leitura:** `creatorContentType` — "This dimension identifies the type of content associated with the user activity metrics in the data row. Data for this dimension is available for dates beginning January 1, 2019." Valor: "`SHORTS` \| The viewed content was a YouTube Short". Também `insightTrafficSourceType`: "`SHORTS` – The viewer was referred by swiping vertically from the previous video in the Shorts viewing experience." | https://developers.google.com/youtube/analytics/dimensions | data não exibida no trecho |
| Relatórios de Shorts | Bulk Reports têm relatórios financeiros de Shorts (ex.: `content_owner_shorts_ad_revenue_summary_a2`, campo `content_type`) | https://developers.google.com/youtube/reporting/v1/reports/system_managed/shorts | Last updated 2026-09-14 UTC |
| Playlist/lista de Shorts do canal | **Não.** `channels.contentDetails.relatedPlaylists` contém apenas "likes", "favorites", "uploads". `search.list` `type` aceita só "channel, playlist, video". Não há endpoint de "shorts shelf" | https://developers.google.com/youtube/v3/docs/channels , https://developers.google.com/youtube/v3/docs/search/list | não exibida |
| **Armadilha a evitar** | `search.list` tem `videoDuration` com valor `short`: "short – Only include videos that are less than four minutes long." Isso é **filtro de duração (4 min)**, não classificação de Short. Usar isso como detector de Shorts é erro | https://developers.google.com/youtube/v3/docs/search/list | não exibida |
| Contagem de views (relacionado) | "Starting March 31, 2025, the following fields in the Data API will return the view count for Shorts as per this change: channels.statistics.viewCount, videos.statistics.viewCount" | https://developers.google.com/youtube/v3/revision_history | não exibida |

**Decisão que decorre:** o Short do Rebeca é **só mais um vídeo** para a API (mesmos metadados, mesmo
`videos.insert`, mesma playlist se houver). A separação longo × Short no ciclo Medir **não pode** ser
inferida por duração ou proporção: tem de vir de `creatorContentType == SHORTS`. A frase da skill
("a plataforma decide a classificação") permanece `NÃO VERIFICADO` como citação — o correto é dizer ao
usuário: *"enviamos um vídeo vertical; se ele será tratado como Short é decisão da plataforma"*.

---

## 13. §3.7 Medir — o que a API oficial entrega de fato

### 13.1 Escopos (strings verificadas literalmente)

| escopo | descrição literal | fonte | data |
|---|---|---|---|
| `https://www.googleapis.com/auth/yt-analytics.readonly` | "View YouTube Analytics reports for your YouTube content" | https://developers.google.com/youtube/reporting/guides/authorization | Last updated 2026-09-15 UTC |
| `https://www.googleapis.com/auth/yt-analytics-monetary.readonly` | "View monetary and non-monetary YouTube Analytics reports for your YouTube content" | idem | 2026-09-15 |
| `https://www.googleapis.com/auth/youtube.readonly` | "View your YouTube account" — exigido adicionalmente por `reports.query`: "API requests to this method now require access to the `https://www.googleapis.com/auth/youtube.readonly` scope." | idem + https://developers.google.com/youtube/analytics/reference/reports/query | 2026-09-15 / não exibida |
| Fluxos **não** suportados | "the YouTube Reporting API and YouTube Analytics API do not support this flow" (service account) e "The YouTube Reporting and YouTube Analytics APIs do not currently support the OAuth 2.0 flow for devices." | https://developers.google.com/youtube/reporting/guides/authorization | 2026-09-15 |

### 13.2 Métrica por métrica prometida

| promessa do produto | nome exato na API (citação literal) | existe? | escopo | fonte | data da página |
|---|---|---|---|---|---|
| Visualizações | "`views` (core metric)"; também `engagedViews` | **sim** | `yt-analytics.readonly` | https://developers.google.com/youtube/analytics/metrics | 2026-09-14 |
| Impressões | "`videoThumbnailImpressions`" | **só em relatório em massa (bulk)** | `yt-analytics.readonly` | https://developers.google.com/youtube/reporting + https://developers.google.com/youtube/reporting/v1/reports/channel_reports | 2026-09-14 |
| CTR | "`videoThumbnailImpressionsClickRate`" | **só em relatório em massa (bulk)** | idem | idem | 2026-09-14 |
| Retenção (média) | "`averageViewDuration` (core metric)", "`averageViewPercentage`" | **sim** | `yt-analytics.readonly` | https://developers.google.com/youtube/analytics/metrics | 2026-09-14 |
| Retenção por minuto (curva) | "`audienceWatchRatio`", "`relativeRetentionPerformance`", "`startedWatching`", "`stoppedWatching`", "`totalSegmentImpressions`" + dimensão "`elapsedVideoTimeRatio`" | **sim** | idem | idem + https://developers.google.com/youtube/analytics/reference/reports/query | 2026-09-14 |
| Watch time | "`estimatedMinutesWatched` (core metric)" | **sim** | idem | metrics | 2026-09-14 |
| Inscritos | "`subscribersGained` (core metric)", "`subscribersLost` (core metric)" | **sim** | idem | metrics | 2026-09-14 |
| Receita | "`estimatedRevenue` (core metric) (previously named `earnings`)"; também `estimatedAdRevenue`, `grossRevenue`, `estimatedRedPartnerRevenue` | **sim** | `yt-analytics-monetary.readonly` | metrics | 2026-09-14 |
| **RPM** | **`NÃO VERIFICADO` — não existe métrica "RPM".** O que existe é "`cpm` (previously named `impressionBasedCpm`)" e `playbackBasedCpm` | **não** | `yt-analytics-monetary.readonly` | metrics | 2026-09-14 |
| Performance de Shorts | dimensão `creatorContentType`, valor "`SHORTS` — The viewed content was a YouTube Short" | **sim** | `yt-analytics.readonly` | https://developers.google.com/youtube/analytics/dimensions | data não exibida |
| Performance de vídeos | dimensão "`video` (core dimension)"; "Video reports provide statistics for all user activity related to a channel's videos" | **sim** | `yt-analytics.readonly` | dimensions + https://developers.google.com/youtube/analytics/channel_reports | não exibida |
| **HORÁRIOS** (hora do dia) | **`NÃO VERIFICADO` — não existe dimensão de hora do dia.** As dimensões de tempo documentadas são "`day` (core dimension)" e "`month` (core dimension)" | **não (promessa refutada para API; existe no Studio)** | — | dimensions | não exibida |
| **TEMAS**/tópicos | **`NÃO VERIFICADO` — não existe dimensão de tema/tópico.** O mais próximo é `insightTrafficSourceType` / `insightTrafficSourceDetail` ("search term", "hashtag") | **não — "tema" seria inferência nossa (e inferir métrica é proibido sem amendment)** | `yt-analytics.readonly` | dimensions | não exibida |
| **THUMBNAILS** (teste A/B) | **`NÃO VERIFICADO` no lado API.** A Data API só publica imagem ("`thumbnails` \| set \| 50" na tabela de quota); não há método de Test & Compare | **não** | — | https://developers.google.com/youtube/v3/determine_quota_cost | 2026-09-15 |

### 13.3 Três refutações diretas da promessa do §3.7 (documentadas, não maquiadas)

1. **Impressões e CTR por vídeo imediato não saem de `reports.query`.** A condição oficial é:
   "Reach reports \| Supported for channels ([bulk]) and content owners ([bulk]). Reach reports
   provide statistics for video thumbnail impressions and click-through rates." Como os relatórios de
   vídeo/playlist listam "query or bulk" e os de alcance (Reach) **só bulk**, impressões/CTR exigem a
   **YouTube Reporting API** (relatório em massa, agendado, com arquivo para baixar), não a query
   direta. Isso muda a arquitetura do ciclo Medir.
2. **"RPM" não é métrica da API.** Não fixe coluna `rpm`; o que existe é `cpm`/`playbackBasedCpm`.
   Exibir "RPM" na UI seria apresentar dado que a API não devolve.
3. **"Horários" e "temas" não existem na API.** Não há dimensão de hora do dia nem de tópico/tema.
   Atender essas duas promessas exigiria **nós** inventarmos o dado — exatamente o que os Developer
   Policies proíbem sem o amendment (seção 15).

### 13.4 Latência — refuta a janela de 24h da skill

| citação literal | fonte | data |
|---|---|---|
| "Data processing typically introduces a latency of 48 to 72 hours. Therefore, API responses do not contain data for the most recent days" | https://developers.google.com/youtube/analytics/data_model | Last updated 2026-09-14 UTC |
| "The response for a query with the `day` dimension will not contain rows for the most recent days." | https://developers.google.com/youtube/analytics/reference/reports/query | data não exibida no trecho |

**Consequência dura:** a skill `rebeca-youtube` prevê janelas "24h / 7d / 28d". Uma janela de **24h não
tem dado** — as respostas não contêm os dias mais recentes. O snapshot de 24h do Rebeca deve ser
rotulado como "sem dado ainda" (ou ser substituído por 48h/72h), nunca preenchido com zero.

### 13.5 Quota da Analytics API

| item | citação literal | unidade | fonte | data |
|---|---|---|---|---|
| Analytics API | "Each API request that you make counts as one unit of API usage quota. Quota limits are visible on the [Quotas] panel in the Google Cloud console." | unidades **por requisição**; **o valor diário não é publicado** → `NÃO VERIFICADO` (só no Cloud Console, serviço `youtubeanalytics.googleapis.com`) | https://developers.google.com/youtube/analytics/data_model | 2026-09-14 |
| Data API v3 | "default quota allocation of 100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units per day combined for all other endpoints" | unidades/dia; reset "at midnight Pacific Time (PT)" | https://developers.google.com/youtube/v3/determine_quota_cost | 2026-09-15 |
| São cotas separadas? | `NÃO VERIFICADO` — não há frase que declare a separação; o painel da Analytics é escopado por `service=youtubeanalytics.googleapis.com` (indício, não citação) | — | — | — |
| Página de quota dedicada | `https://developers.google.com/youtube/analytics/quota` **redireciona** para a introdução do Reporting API — não existe mais página numerada de quota da Analytics | — | — | — |

### 13.6 Conteúdo feito para crianças × analytics (decide a camada Medir)

| citação literal | fonte | data |
|---|---|---|
| "For each video that is designated Made For Kids, API Clients must turn off tracking and make sure that all data collection with respect to that player is compliant with applicable law(s) including the U.S. Children's Online Privacy (COPPA) and E.U. General Data Protection Regulation (GDPR))." (§III.E.4.d.10) | https://developers.google.com/youtube/terms/developer-policies | data não exibida no trecho |
| "The following data might be limited in YouTube Analytics reports: Demographics data, such as age and gender… The actual thresholds at which data is limited are not published and subject to change at YouTube's discretion." | https://developers.google.com/youtube/analytics/data_model | 2026-09-14 |
| "you are required by Section III.E.4.j of the Developer Policies to turn off tracking…" (para vídeo MFK **embutido** pelo app) | https://developers.google.com/youtube/v3/guides/made_for_kids_status | 2026-09-14 |
| "Made for kids ⇒ métrica X indisponível" (regra explícita por métrica) | `NÃO VERIFICADO` — o corpo das páginas de Ajuda não foi recuperável | — |

**Leitura para o produto e para a LGPD:** o status MFK é **verificável** pela API
(`videos.list` → `status.madeForKids`), mas **dados demográficos/geográficos e de origem de tráfego
do público infantil são anonimizados por limiar não publicado** — ou seja, **não são base confiável de
decisão** e não devem alimentar promessa de "conhecer o público". Para o canal infantil, a camada
Medir deve se apoiar em métricas agregadas do vídeo (views, watch time, retenção, inscritos) e tratar
demografia como indisponível, não como zero. O encaminhamento a `rebeca-lgpd` continua obrigatório
(art. 14 da LGPD / ECA Digital) — mas a conclusão correta aqui **não** é "a API entrega dado pessoal
de criança": é "a API **limita** esse dado, e o Rebeca não deve tentar reconstruí-lo".

### 13.7 Retenção de dados de métrica (contrato, não preferência)

| citação literal | fonte | data |
|---|---|---|
| "you are generally prohibited from creating metrics that replace or modify the data returned by the YouTube API Services" | https://developers.google.com/youtube/terms/derived-metrics-policy | Last updated 2026-09-14 UTC |
| "Policy III E.4.b, E.4.c, and E.4.d are amended to allow accepted API Clients to store metrics (e.g., views, likes, subs count, comment counts) from statistical endpoints for up to 36 calendar months." | idem | 2026-09-14 |
| "Other data (such as video titles, creator names, descriptions, and comment text) must still follow the 30-day refresh and deletion policy in Section III(4)." | idem | 2026-09-14 |
| "You must distinguish these metrics from metrics sourced from API Data." | idem | 2026-09-14 |

**Consequência de arquitetura:** o histórico de métricas do Rebeca tem **dois regimes possíveis**:
sem amendment → refresh/exclusão a cada **30 dias**; com amendment aceito (formulário de auditoria,
"Section 5: Use Cases… → Analytics & Reporting") → até **36 meses** para dado estatístico, mantendo
**30 dias** para título/descrição/comentário. Sem essa decisão, o "aprender com o histórico" do §3.8
não tem base legal para guardar dado.

---

## 14. Evidência de leitura (rastreabilidade)

| página oficial | data declarada na página |
|---|---|
| `youtube/v3/determine_quota_cost` | Last updated 2026-09-15 UTC |
| `youtube/v3/guides/quota_and_compliance_audits` | Last updated 2026-09-14 UTC |
| `youtube/v3/getting-started` | data não exibida no trecho recuperado |
| `youtube/v3/docs/videos/insert` | data não exibida no trecho recuperado |
| `youtube/v3/docs/videos` | data não exibida (página truncada) |
| `youtube/v3/docs/videos/list` | Last updated 2026-09-14 UTC |
| `youtube/v3/docs/thumbnails/set` | Last updated 2026-09-14 UTC |
| `youtube/v3/docs/playlistItems/insert` | Last updated 2026-09-14 UTC |
| `youtube/v3/docs/videoCategories/list` | Last updated 2026-09-14 UTC |
| `youtube/v3/guides/using_resumable_upload_protocol` | Last updated 2026-09-14 UTC |
| `youtube/v3/guides/uploading_a_video` | Last updated 2026-09-14 UTC |
| `youtube/v3/guides/made_for_kids_status` | Last updated 2026-09-14 UTC |
| `youtube/v3/guides/auth/server-side-web-apps` | data não exibida no trecho recuperado |
| `youtube/terms/api-services-terms-of-service` | Last updated 2026-09-14 UTC |
| `youtube/terms/derived-metrics-policy` | Last updated 2026-09-14 UTC |
| `youtube/terms/developer-policies` | data não exibida no trecho recuperado |
| `youtube/reporting/guides/authorization` | Last updated 2026-09-15 UTC |
| `youtube/analytics/metrics` | Last updated 2026-09-14 UTC |
| `youtube/analytics/data_model` | Last updated 2026-09-14 UTC |
| `youtube/analytics/dimensions` | data não exibida no trecho recuperado |
| `youtube/analytics/channel_reports`, `youtube/analytics/reference/reports/query` | não exibida |
| `youtube/reporting/v1/reports/system_managed/shorts` | Last updated 2026-09-14 UTC |
| `youtube/reporting/v1/reports/channel_reports` | Last updated 2026-09-14 UTC |
| `developers.google.com/identity/protocols/oauth2/policies` | Last modified: August 5, 2026 |
| `support.google.com/youtube/answer/1270709`, `/9528076`, `/9527654`, `/15424877`, `/12779649` | **corpo não recuperável** (só o título) — nenhuma citação de corpo foi usada |
| `developers.google.com/youtube/v3/guides/localization` | **HTTP 404** |
| `developers.google.com/youtube/analytics/quota` | **redireciona** para `/youtube/reporting` |

Nada deste levantamento foi executado contra a API real: **não há credencial, não há chamada, não há
quota consumida**. Os fatos são de documentação.

## 15. Item 11 — Termos dos Serviços de API que restringem este design

Fonte principal: **YouTube API Services Terms of Service** (versão Americas),
https://developers.google.com/youtube/terms/api-services-terms-of-service —
**Last updated 2026-09-14 UTC** (verificado nesta sessão por leitura direta).

| obrigação | citação literal | fonte | data da página |
|---|---|---|---|
| Escrita precisa ser iniciada pelo usuário | features de escrita devem ser "clearly initiated by the user" (Developer Policies §III.C.2.c) | https://developers.google.com/youtube/terms/developer-policies | data não exibida no trecho recuperado |
| Usuário tem o controle final do que é publicado | "users must have final control over the data that will be published to YouTube Applications" (§III.C.3) | idem | — |
| Consentimento prévio e expresso | "the user must expressly consent to those actions prior to their actual execution" (§III.E.3.d) | idem | — |
| Não mudar visibilidade por conta própria | "must not modify existing content visibility settings unless the authorizing user has expressly instructed the API Clients to do so" (§III.E.3.f) | idem | — |
| Aviso obrigatório no botão de upload | "By clicking 'upload,' you certify that the content you are uploading complies with the YouTube Terms of Service (including the YouTube Community Guidelines) at **[select and insert appropriate URL…]**. Please be sure not to violate others' copyright or privacy rights." (§9.1(i)) | TOS | 2026-09-14 UTC |
| Para Desktop o URL é o do YouTube | "If the upload is performed on a personal computer or other non-mobile device, the appropriate URL is https://www.youtube.com/t/terms" (§9.1(i)) | TOS | 2026-09-14 UTC |
| Link aos Termos do YouTube | "must display a link to YouTube's Terms of Service… users are agreeing to be bound by the YouTube Terms of Service" (§III.A.1) | Developer Policies | data não exibida |
| Política de privacidade e aviso de uso da API | "must: … (b) notify users that the API Client uses YouTube API Services, (c) reference and link to the Google Privacy Policy" (§III.A.2) | idem | — |
| Política de privacidade publicada | "Each API Client will provide and adhere to a published privacy policy that clearly and accurately describes to its users what user information you and your API Client access, collect and store" (§7) | TOS | 2026-09-14 UTC |
| Não criar métricas derivadas sem amendment | "As a developer, you are generally prohibited from creating metrics that replace or modify the data returned by the YouTube API Services." | https://developers.google.com/youtube/terms/derived-metrics-policy | Last updated 2026-09-14 UTC |
| Mesmo proibido: substituir dados da API | "must not (i) replace API Data with similar, independently calculated data, or (ii) access or use API Data to create new or derived data or metrics." (§III.E.4.h) | Developer Policies | data não exibida |
| Métricas aceitáveis exigem aceitar o amendment | "subject to your acceptance of the [amendment] to the Developer Policies (select 'Section 5: Use Cases, API Integration, and Feature Implementation' then 'Analytics & Reporting' as your use case to accept these terms)" | derived-metrics-policy | 2026-09-14 |
| Retenção de dados não-estatísticos: 30 dias | "may store all other types of Authoritative Data… for no longer than 30 calendar days. After 30 calendar days, the API Client must either delete or refresh the stored data." (§III.E.4.c) | Developer Policies | data não exibida |
| Rechecagem de autorização a cada 30 dias | "must still ensure every 30 days that it is still authorized by the user" (§III.E.4.b) | idem | — |
| Exibição sempre atualizada | "must display the most updated API Data available in their user-facing presentations" (§III.E.4.f) | idem | — |
| Exclusão a pedido: 7 dias | "you must then delete it as soon as possible and within 7 calendar days" (§III.E.4.g) | idem | — |
| Revogação de token: 30 dias para excluir | "must take place within 30 calendar days of that revocation" (§III.D.2.c.ii) | idem | — |
| Guardar métricas além de 30 dias | "Policy III E.4.b, E.4.c, and E.4.d are amended to allow accepted API Clients to store metrics (e.g., views, likes, subs count, comment counts) from statistical endpoints for up to 36 calendar months." | derived-metrics-policy | 2026-09-14 |
| Distinguir métrica própria da métrica da API | "You must distinguish these metrics from metrics sourced from API Data." | idem | 2026-09-14 |
| Não incentivar engagement | "must not offer or provide incentives, rewards, or other compensation to users for engaging with YouTube Applications" (§III.F.3.c) | Developer Policies | data não exibida |
| Tokens criptografados em repouso | "always store encrypted tokens at rest" | https://developers.google.com/identity/protocols/oauth2/policies | Last modified: August 5, 2026 |
| Proibido exceder/contornar quota | "You and your API Client(s) will not, and will not attempt to, exceed or circumvent use or quota restrictions." (§15) | TOS | 2026-09-14 UTC |
| Auditoria a qualquer momento | "YouTube may monitor, review and inspect your API Client(s), and monitor and audit your access to and use of the YouTube API Services, at any time and without further notice to you" (§6) | TOS | 2026-09-14 UTC |
| Mudança de controle: 15 dias | "you will provide to YouTube a written notice detailing the change of control within 15 calendar days after the change of control" (§25.9) | TOS | 2026-09-14 UTC |
| Fim do contrato: apagar tudo | "you will immediately stop accessing and using all YouTube Property and delete all YouTube API Services (including all API Data)… from your servers" (§24.3) | TOS | 2026-09-14 UTC |

### 15.1 O que isso muda no desenho do Rebeca (sem meias palavras)

1. **"Publica automaticamente" não significa "a IA decide publicar".** As políticas exigem ação
   **claramente iniciada pelo usuário** e **consentimento expresso antes da execução**, com o usuário
   mantendo o **controle final** do que vai ao ar. O gate de aprovação por hash da skill deixa de ser
   só uma boa prática do projeto: passa a ser **exigência contratual** da API. Um job agendado que
   publica "sozinho" sem instrução humana rastreável por ação é a violação mais provável deste design.
2. **Não existe armazenamento eterno de métrica.** Ou o Rebeca aceita o **amendment** de métricas
   derivadas (aí 36 meses para dados estatísticos) ou opera com **refresh/exclusão em 30 dias** e
   exclusão em **7 dias** a pedido. Isso é decisão de arquitetura (retenção), não detalhe de tabela.
3. **Nada de métrica inventada sem amendment:** "score de conteúdo", "índice Rebeca", CTR estimado e
   afins são proibidos por padrão; só entram com o amendment aceito **e** rotulados como não-YouTube.
4. **Aviso legal visível na tela de upload** (§9.1(i)) e link para os Termos do YouTube — é UI, e
   precisa estar no texto do botão que dispara a publicação.
5. **Canal infantil:** além do `selfDeclaredMadeForKids` no insert, o Rebeca pode ser ele próprio um
   **Child-Directed API Client** (§9.1(iii)) — o que **zeraria** a capacidade de escrever.

---

## 16. Arquitetura mínima que decorre disso

> Nada aqui é novidade de produto: é o que a documentação oficial **obriga** somado ao que a skill
> `rebeca-youtube` já exige (upload resumível, idempotência, quota-log, gate de aprovação por hash).

### 16.1 Pipeline de publicação (ordem fixa, cada passo idempotente)

1. **Gate de aprovação por hash (antes de qualquer chamada de rede).** Exige entrada em
   `.rebeca/estado.md` com `aprovado_por`, `aprovado_em`, `arquivo`, `sha256`; recalcula o SHA-256 do
   arquivo em disco e aborta **sem chamar a API** se faltar ou divergir. Cumpre, de uma vez, o
   invariante 1 do `AGENTS.md` e os §§III.C.2.c/III.C.3/III.E.3.d dos Developer Policies.
2. **Checagem de idempotência.** `publication_id = hash(canal + episódio + sha256 + versão)`; se já
   existe `video_id` em `.rebeca/publicacoes/<canal>/<ep>.json`, **encerra sem gastar quota**.
3. **Resolver metadados "sabidos" (§3.6):** `title`, `description`, `tags[]`, `categoryId`
   (**resolvido por `videoCategories.list?regionCode=BR`**, nunca constante), `snippet.defaultLanguage`,
   `status.privacyStatus`, `status.publishAt`, `status.selfDeclaredMadeForKids`, playlist alvo.
4. **Upload resumível** (`POST …?uploadType=resumable&part=snippet,status`): guardar a **session URI**
   em disco/DB no mesmo instante do `200 OK`; retomar por `308` + `Range` com **backoff exponencial**
   apenas em `500/502/503/504` e queda de conexão; `4xx` **não** se repete (vai para o humano).
   Gravar o `video_id` retornado **antes** de qualquer passo seguinte.
5. **Thumbnail** (`POST /upload/youtube/v3/thumbnails/set?videoId=…`) — só depois de ter `video_id`;
   tratar `429 uploadRateLimitExceeded` como rate limit, não como erro de validação.
6. **Playlist** (`POST /youtube/v3/playlistItems`) — passo separado, com `snippet.playlistId` +
   `snippet.resourceId`; idempotente (não inserir duas vezes o mesmo `videoId`).
7. **Registro final** em `.rebeca/publicacoes/<canal>/<ep>.json`: `video_id`, `scheduled_at`,
   `visibility`, `made_for_kids`, `sha256`, `approved_by`, `prompt_version`, `playlist_id` — mais o
   **texto do consentimento** e o instante em que o humano o deu (§III.E.3.d).

### 16.2 Quota como orçamento de projeto, com três contadores

| balde | limite default | custo por chamada |
|---|---|---|
| `videos.insert` | 100/dia | 1 |
| `search.list` | 100/dia | 1 |
| **todos os outros** (thumbnails, playlistItems, videos.list, videoCategories…) | 10.000/dia somados | 50 por escrita, 1 por leitura |
| reset | meia-noite **Pacific Time** | — |

Logo: um vídeo publicado custa **1 (upload) + ~50 (thumbnail) + 50 (playlist) = ~101 unidades** do
balde de 10.000 — **e o upload consome um balde separado de 100/dia**. O `quota-log.csv` precisa
registrar **balde + unidades + data PT**, não só "unidades": com um número só, o alerta de quota
mente. E, sendo a quota **do projeto**, o log precisa ser escopado por **projeto**, não por canal.

### 16.3 Segurança

- Um `channel_id` → uma credencial; refresh token em cofre (**nunca** em `.env` versionado, log,
  prompt ou mensagem de erro), **criptografado em repouso**; rotação e revogação detectadas viram
  aviso ao humano (nunca contorno).
- `access_type=offline` para permitir publicação/medição sem o browser aberto; `state` anti-CSRF no
  callback; validar `redirect_uri` exato.

### 16.4 Medir (esqueleto revisado pelos fatos oficiais)

- **Duas fontes, não uma.** Métricas de vídeo/canal por `reports.query` (Analytics API); **impressões
  e CTR de thumbnail só via YouTube Reporting API (relatório em massa)** — são "Reach reports",
  "Supported for channels ([bulk])".
- **Janelas:** 7d e 28d são atendíveis; a janela de **24h não tem dado** (latência de "48 to 72 hours").
  Registrar explicitamente "dado ainda não disponível" em vez de zero.
- Snapshot em `.rebeca/metricas/<canal>/<video_id>-<janela>-<data>.json`, com métrica ausente =
  **falha**, nunca zero.
- **Shorts:** separar longo × Short por `creatorContentType == SHORTS`; **nunca** por duração ou
  proporção. Métrica de vídeo único quando o filtro exigir: "Audience Retention reports
  (`dimensions=elapsedVideoTimeRatio`) only support filtering by a single video ID."
- **Não existe RPM** (usar `cpm`/`playbackBasedCpm` e rotular corretamente) e **não existem** hora do
  dia nem tema — essas duas últimas ficam fora do produto ou viram feature do Studio, nunca inferência.
- **Retenção declarada e implementada:** 30 dias para dado não-estatístico, 7 dias para exclusão a
  pedido, 30 dias após revogação — **ou** o amendment de métricas derivadas (36 meses para estatística,
  30 dias ainda para título/descrição/comentário) aceito por escrito, com rótulo de "métrica Rebeca ≠
  métrica YouTube" na UI.
- Cache e leitura em lote; proibido varrer catálogo inteiro por dia. Cota da Analytics API é **1
  unidade por requisição** e o **limite diário não é publicado** (`NÃO VERIFICADO`) → medir consumo
  real no Cloud Console antes de prometer frequência de coleta.

---

## 17. Decisões que precisam do humano

| # | Decisão | Por que é do humano | Bloqueia |
|---|---|---|---|
| Y1 | **O Rebeca é um "Known Child-Directed API Client"?** (se sim: §9.1(iii) proíbe **toda** ação de escrita, inclusive upload) | é qualificação jurídica + exige notificar o Google (§III.J) | §3.6 inteiro no canal infantil |
| Y2 | **Pedir auditoria do projeto de API agora?** (sem ela, todo upload sai **privado**) | custo, prazo e exposição do projeto a revisão do YouTube | a palavra "publica" do §3.6 |
| Y3 | **Aceitar o amendment de métricas derivadas** (36 meses) ou operar com retenção de 30 dias | obrigação contratual + afeta LGPD | §3.8 "aprender" e o histórico longo |
| Y4 | **Escopo OAuth:** só `youtube.upload` (mínimo, sem playlist) ou `youtube.force-ssl` (playlist + tudo mais, inclusive delete) | trade-off segurança × requisito "playlist" | §3.6 "playlist" |
| Y5 | **Um projeto Google Cloud por canal ou um só para todos?** (a quota de 100 uploads/dia é do projeto) | custo de auditoria × isolamento multi-canal | invariante 2 e o ritmo de publicação |
| Y6 | **Como o "usuário instrui e consente" cada publicação** (UI + registro auditável), dado §§III.C.2.c/III.C.3/III.E.3.d | é requisito contratual e de produto, não detalhe de tela | gate de aprovação |
| Y7 | **Onde ficam os dados de métrica** (Supabase, retenção, base legal) — cruza com `rebeca-lgpd`/`rebeca-supabase` | dado de audiência de canal infantil | §3.7 e LGPD/ECA Digital |
| Y8 | **Categoria, idioma e playlist de cada canal** (IDs resolvidos por API, não constantes) | exige escolha humana por canal; `NÃO VERIFICADO` hoje | metadados "sem default implícito" |
| Y9 | **Impressões/CTR: construir a coleta em massa (YouTube Reporting API: job agendado + download de arquivo + Storage) ou assumir que CTR por vídeo não entra no MVP?** | é a única forma oficial de ter impressões/CTR; `reports.query` não atende "Reach reports" | §3.7 "impressões/CTR" |
| Y10 | **Registrar como ADR** que "RPM", "horários" e "temas" **não existem** na API oficial (usar `cpm`/`playbackBasedCpm`; remover as outras duas do escopo ou marcar como recurso de Studio) | é refutação de promessa do produto, não detalhe técnico | §3.7 e §3.8 |

---

## 18. Lacunas (NÃO VERIFICADO)

Tudo abaixo **não** foi confirmado em página oficial nesta sessão. Nenhum destes valores pode ser
fixado em código, prompt, orçamento ou promessa de produto.

1. `status.publishAt`: obrigatoriedade de `privacyStatus=private`, formato ISO 8601/UTC, antecedência
   máxima e o que a API faz no horário agendado.
2. Duração máxima de vídeo (para 1920×1080 ou em geral) — a API só declara **256 GB** de tamanho.
3. Resolução recomendada/obrigatória de thumbnail (só formato e 50 MB estão confirmados).
4. Número máximo de itens de uma playlist (`playlistContainsMaximumNumberOfVideos` existe; o limite
   não é declarado).
5. Semântica de `snippet.defaultLanguage` e `snippet.defaultAudioLanguage`; se `defaultAudioLanguage`
   pode ser setado no `videos.insert` (não consta da lista publicada de setáveis).
6. `categoryId` correto para educação infantil no Brasil — nenhuma página oficial publica a tabela de
   IDs por região; só se obtém chamando a API com `regionCode=BR`.
7. O que o YouTube faz com a declaração `selfDeclaredMadeForKids` (override, recursos desabilitados,
   consequências) — corpo de `support.google.com/youtube/answer/9528076` não recuperável.
8. **Shorts:** verificado que a API **não** expõe controle/classificação (seção 12). Permanecem
   `NÃO VERIFICADO`: a frase oficial de que a classificação é automática/da plataforma, a duração
   máxima exata em segundos e a proporção/dimensões exigidas — o corpo das páginas de Ajuda não é
   recuperável por esta ferramenta.
9. **Analytics:** métricas e escopos estão verificados (seção 13), mas permanecem `NÃO VERIFICADO`:
   (a) o **valor numérico** da cota diária da Analytics API (só no Cloud Console); (b) qualquer
   métrica chamada "RPM"; (c) dimensão de hora do dia; (d) dimensão de tema/tópico; (e) API oficial de
   teste A/B de thumbnail; (f) a declaração literal de que as cotas da Analytics e da Data API são
   separadas; (g) as definições/limitações completas de `videoThumbnailImpressions*` na página
   `analytics/metrics`.
10. Texto literal da **Seção III.J** (Child-Directed API Clients) dos Developer Policies — a página
    truncou antes; só houve confirmação por referência cruzada no TOS §9.1(iii).
11. Cláusula explícita sobre publicação **100% automatizada** sem supervisão humana (só existem as
    obrigações de ação iniciada pelo usuário / consentimento expresso).
12. Google API Services User Data Policy / Limited Use (fora dos domínios permitidos pela tarefa).
13. Data de "last updated" das páginas `developer-policies`, `videos/insert` e `videos` (não exibida
    no trecho recuperado) e de `guides/auth/server-side-web-apps` e `getting-started`.
14. Corpo das páginas de ajuda do YouTube (`support.google.com`) de forma geral — inclusive
    agendamento pelo Studio e audiência do canal.
15. `videos.update` (reagendar/alterar metadados após publicação) — página não lida.
