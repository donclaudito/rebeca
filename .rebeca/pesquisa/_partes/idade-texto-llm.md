# Camada TEXTO/LLM — restrições de uso por menores de 18 anos nos termos oficiais

**Data de leitura de todas as URLs abaixo: 2026-09-30.**
Método: `web_fetch` direto nas páginas oficiais. Onde a página é renderizada por JavaScript e o
fetch direto retornou apenas a navegação, usei o proxy de renderização `https://r.jina.ai/<url oficial>`
— isso está sinalizado em cada item (**[VIA RENDERIZADOR]**) e o texto citado continua sendo o da URL oficial.

Complementa: `_partes/idade-video-imagem.md`, `_partes/idade-voz-musica.md`, `d2-termos-pendentes-menores.md`.

---

## A) ANTHROPIC

### A.1 Consumer Terms — idade mínima (SIM, 18 anos)

[Consumer Terms tem cláusula de idade mínima de 18 anos (ou a maior exigida localmente)] |
"**Minimum age.** You must be at least 18 years old or the minimum age required to use the Services in your location, whichever is higher." |
https://www.anthropic.com/legal/consumer-terms (Effective October 8, 2025) | lido em 2026-09-30

[As Consumer Terms NÃO regem o uso de API key] |
"**Please note: Our [Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms) govern your use of any Anthropic API key, the [Anthropic Console](https://console.anthropic.com/), or any other Anthropic offerings that reference the Commercial Terms of Service. For clarity, this does not include Claude.ai or Claude Pro use for individuals or entities.**" |
https://www.anthropic.com/legal/consumer-terms | lido em 2026-09-30

### A.2 Commercial Terms (a camada usada por quem consome a API) — NÃO tem cláusula numérica de idade

[Li o texto integral (seções A a M) e NÃO localizei nenhuma cláusula de idade mínima / elegibilidade por idade. A única restrição literal de elegibilidade é a de uso não-consumidor] |
"Services under these Terms are not for consumer use. Our consumer offerings (e.g., Claude.ai) are governed by our [Consumer Terms of Service](https://www.anthropic.com/legal/terms) instead." |
https://www.anthropic.com/legal/commercial-terms (Effective June 17, 2025) | lido em 2026-09-30

[As Commercial Terms autorizam explicitamente o Customer a repassar o serviço a terceiros e responsabilizam o Customer pelos "Users"] |
"A.1. **Overview.** Subject to these Terms, Anthropic gives Customer permission to use the Services, including to power products and services Customer makes available to its own customers and end users ("**Users**")." |
https://www.anthropic.com/legal/commercial-terms | lido em 2026-09-30

[O repasse é vinculado à Usage Policy] |
"D.2. **Policies and Service Terms.** Customer and its Users may only use the Services in compliance with these Terms, including (a) the [Usage Policy](https://console.anthropic.com/legal/aup) ("**Usage Policy**", which was previously referred to as the Acceptable Use Policy) [...]" |
https://www.anthropic.com/legal/commercial-terms | lido em 2026-09-30

### A.3 Usage Policy — seção de menores / child safety (SIM)

[URL pedida não existe hoje] |
"Not Found" (HTTP 404) |
https://www.anthropic.com/legal/usage-policy | lido em 2026-09-30

[URL canônica vigente da Usage Policy] |
"# Usage Policy — Effective September 15, 2025" |
https://www.anthropic.com/legal/aup (redirecionamento/nome canônico; as Commercial Terms apontam para https://console.anthropic.com/legal/aup) | lido em 2026-09-30

[A Usage Policy tem bloco "Do Not Compromise Children's Safety", aplicável a quem submete inputs, inclusive via API] |
"Our Usage Policy (also referred to as our "Acceptable Use Policy" or "AUP") applies to anyone who can submit inputs to Anthropic's products and/or services, including via any authorized resellers or passthrough access, all of whom we refer to as "users."" |
https://www.anthropic.com/legal/aup | lido em 2026-09-30

[Veda CSAM, inclusive gerado por IA] |
"Do Not Compromise Children's Safety — This includes using our products or services to: - Create, distribute, or promote child sexual abuse material ("CSAM"), including AI-generated CSAM - Facilitate the trafficking, sextortion, or any other form of exploitation of a minor - Facilitate minor grooming, including generating content designed to impersonate a minor - Facilitate child abuse of any form, including instructions for how to conceal abuse - Promote or facilitate pedophilic relationships, including via roleplay with the model - Fetishize or sexualize minors, including in fictional settings or via roleplay with the model" |
https://www.anthropic.com/legal/aup | lido em 2026-09-30

[Definição de menor = menor de 18 anos, independente de jurisdição, + dever de reportar] |
"_Note: We define a minor or child to be any individual under the age of 18 years old, regardless of jurisdiction. When we detect CSAM (including AI-generated CSAM), or coercion or enticement of a minor to engage in sexual activities, we will report to relevant authorities._" |
https://www.anthropic.com/legal/aup | lido em 2026-09-30

[Existe seção específica "Products serving minors" — produtos que servem menores são PERMITIDOS com salvaguardas adicionais] |
"**Products serving minors,** including organizations providing minors with the ability to directly interact with products that incorporate our API(s), must comply with the **additional guidelines** outlined in our [Help Center article.](https://support.anthropic.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors)" |
https://www.anthropic.com/legal/aup | lido em 2026-09-30

### A.4 Guidelines for Organizations Serving Minors (artigo vinculado pela AUP)

[O artigo existe e foi lido; ele pede salvaguardas, não proíbe o uso em produtos para menores] |
"At Anthropic, we recognize the unique vulnerabilities and needs of children in digital spaces. In order to create a safer digital environment and mitigate risks, organizations providing minors with the ability to directly interact with products that incorporate our API(s) should implement the following safeguards:" |
https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors (página datada "March 16, 2026"; a URL citada pela AUP em support.anthropic.com redireciona para support.claude.com) | lido em 2026-09-30

[Salvaguardas exigidas — inclui verificação de idade] |
"**1. Additional Technical Measures** [...] These safety measures may include, but are not limited to: * Age verification systems to ensure only intended users can access the product * Content moderation and filtering to block inappropriate or harmful content * Monitoring and reporting mechanisms to identify and address potential issues * Educational resources and guidance for minors on safe and responsible use of the product" |
https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors | lido em 2026-09-30

[Consequência do descumprimento: auditoria, exigência e possível suspensão] |
"Anthropic will periodically audit organizations for compliance with these safeguards. If your organization has a high violation rate and has not implemented these safety recommendations, we may ask you to implement them. Failure to implement these recommendations when requested, or a continued high violation rate, may lead to the suspension or termination of your account." |
https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors | lido em 2026-09-30

### A.5 Child safety guidance for developers (reforço, 2026)

[Serviços de consumidor da Anthropic são 18+; o texto distingue isso do uso de API] |
"Our first-party consumer services are restricted to users 18 years and older, and Claude does not produce photorealistic image or video output." |
https://support.claude.com/en/articles/15591275-child-safety-guidance-for-developers (página datada "June 26, 2026") | lido em 2026-09-30

[A obrigação de quem constrói na API é a Usage Policy, que se aplica mesmo quando o público é adulto] |
"All developers building on Anthropic's API are required to comply with our **[Usage Policy](https://www.anthropic.com/aup)**, which prohibits using our products or services to compromise children's safety. [...] These obligations apply regardless of your platform's size or use case." |
https://support.claude.com/en/articles/15591275-child-safety-guidance-for-developers | lido em 2026-09-30

[Quando o produto deixa menores interagirem direto com o modelo, aplicam-se as guidelines de menores] |
"Additionally, if your product allows minors to interact directly with our models, please refer to our **[Guidelines for Organizations Serving Minors](https://support.claude.com/en/articles/9307344)**, which sets out the additional safeguards Anthropic requires for that audience." |
https://support.claude.com/en/articles/15591275-child-safety-guidance-for-developers | lido em 2026-09-30

### A.6 Age assurance on Claude (produto de consumidor)

[Confirma 18+ no produto de consumidor e descreve verificação de idade com a Yoti] |
"Claude, our consumer product, is only available to people over 18 years. You'll need to confirm you're 18 or over while setting up an account. When we detect signals that you may be under 18, we'll ask you to verify your age before you can continue using Claude." |
https://support.claude.com/en/articles/15171100-age-assurance-on-claude (página datada "May 18, 2026") | lido em 2026-09-30

### A.7 Privacy Policy — verificação de idade (sem idade mínima)

[Não há idade mínima na Privacy Policy; há coleta de dados de verificação de idade] |
"Verification Data: In certain circumstances, we may ask you to verify your age or identity. If you choose to do so, data we will collect includes, depending on the method: an image of your government-issued identity document and the information appearing on it (such as your ID number and date of birth); [...] and the result of the verification (for example, whether your age meets the applicable threshold)." |
https://www.anthropic.com/legal/privacy (Effective September 10, 2026) | lido em 2026-09-30

### A.8 U.S. K-12 Terms (relevante: K-12 NÃO dá conta direta a aluno)

[No contrato K-12, "Users" são os empregados da escola, não os alunos] |
"A.1. **Overview.** Subject to these Terms, Anthropic gives Customer permission to use the Services or if Customer is a School, make available to its own employees (**"Users"**). Use of the Services under these Terms is permitted only by Customers for educational purposes [...]" |
https://www.anthropic.com/legal/k12-terms (Effective July 14, 2026) | lido em 2026-09-30

### A.9 privacy.anthropic.com e trust.anthropic.com

[privacy.anthropic.com redireciona para privacy.claude.com; a home é um índice de coleções, sem texto de política de idade] |
"Anthropic Privacy Center — Commercial Customers / API, Console, Team & Enterprise plans (30 articles) / Consumers — Claude Free, Pro & Max plans (28 articles)" |
https://privacy.anthropic.com/ → URL final https://privacy.claude.com/ (HTTP 200) | lido em 2026-09-30

[trust.anthropic.com responde 200 mas só devolve o título (app JS): nenhuma cláusula verificável] |
"Anthropic Trust Center" |
https://trust.anthropic.com/ | lido em 2026-09-30

---

## B) GOOGLE (Gemini API / Generative Language API / AI Studio)

### B.1 + B.2 — **RESPOSTA CENTRAL: a vedação vale para TODA a Gemini API, inclusive texto/LLM**

[A Gemini API Additional Terms exige 18 anos de quem usa as APIs] |
"You must be 18 years of age or older to use the APIs." |
https://ai.google.dev/gemini-api/terms?hl=en ("Gemini API Additional Terms of Service", Effective March 23, 2026; "Last updated 2026-04-28 UTC") | lido em 2026-09-30

[E veda usar os Serviços em API Client voltado a / acessível por menores de 18 — esta é a cláusula "directed to / likely to be accessed by"] |
"You also will not use the Services as part of a website, application, or other service (collectively, "**API Clients**") that is directed towards or is likely to be accessed by individuals under the age of 18." |
https://ai.google.dev/gemini-api/terms?hl=en | lido em 2026-09-30

[O escopo dessas Additional Terms é a Gemini API + AI Studio + demais serviços de desenvolvedor que as referenciam — NÃO é específico de mídia (Veo/Imagen). Ou seja: a regra é a MESMA para a camada de texto] |
"To use [Gemini API](/docs/gemini_api_overview), [Google AI Studio](https://aistudio.google.com), and the other Google developer services that reference these terms (collectively, the "**APIs**" or "**Services**"), you must accept (1) the [Google APIs Terms of Service](https://developers.google.com/terms) (the "**API Terms**"), and (2) these Gemini API Additional Terms of Service (the "**Additional Terms**")." |
https://ai.google.dev/gemini-api/terms?hl=en | lido em 2026-09-30

[Além disso, uso é declaradamente profissional/empresarial, não de consumidor] |
"Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or business purposes, not for consumer use." |
https://ai.google.dev/gemini-api/terms?hl=en | lido em 2026-09-30

**[nota de método]** O `web_fetch` de `https://ai.google.dev/gemini-api/terms` (sem `?hl=`) foi servido em francês
(`?hl=fr`), com o mesmo conteúdo: "## Âge requis — Vous devez avoir au moins 18 ans pour utiliser les API. De plus,
vous ne devez pas utiliser les Services avec un site Web, une application ou un autre service (collectivement, les
"**Clients API**") pouvant être consultés par des personnes âgées de moins de 18 ans, ou les ciblant." A citação em
inglês acima vem de `https://ai.google.dev/gemini-api/terms?hl=en`. O mesmo documento arquiva versões anteriores em
https://ai.google.dev/gemini-api/terms-archive (não lido).

### B.3 Generative AI Prohibited Use Policy

> **[VIA RENDERIZADOR]** `https://policies.google.com/terms/generative-ai/use-policy` responde HTTP 200 mas o fetch
> direto (em `?hl=en`, `?hl=en-US`, `?hl=pt-BR`) devolveu conteúdo vazio; o snapshot do Wayback também voltou vazio.
> O texto abaixo foi obtido renderizando a URL oficial via `https://r.jina.ai/https://policies.google.com/terms/generative-ai/use-policy`.

[A Prohibited Use Policy NÃO é a fonte da vedação de produtos para menores; ela trata de CSAM/exploração] |
"Last Modified: December 17, 2024 — [...] 1. Do not engage in dangerous or illegal activities, or otherwise violate applicable law or regulations. This includes generating or distributing content that: 1. Relates to child sexual abuse or exploitation." |
https://policies.google.com/terms/generative-ai/use-policy | lido em 2026-09-30

[E ela própria prevê exceções] |
"We may make exceptions to these policies based on educational, documentary, scientific, or artistic considerations, or where harms are outweighed by substantial benefits to the public." |
https://policies.google.com/terms/generative-ai/use-policy | lido em 2026-09-30

[ACHADO NEGATIVO: li a política integral e ela **não** contém item sobre produtos destinados a menores, nem
restrição de uso comercial em produto infantil. O único item relativo a criança é "child sexual abuse or exploitation".] |
— (ausência verificada no texto integral da página) | https://policies.google.com/terms/generative-ai/use-policy | lido em 2026-09-30

[Os termos da API vinculam essa política] |
"In addition to the "[API Prohibitions](https://developers.google.com/terms#a_api_prohibitions)" section in the API Terms, you must comply with our [Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy), which provides additional details about appropriate conduct when using the Services." |
https://ai.google.dev/gemini-api/terms?hl=en | lido em 2026-09-30

### B.3b Abuse monitoring (ai.google.dev/gemini-api/docs/usage-policies)

[A página de "usage policies" que a Gemini API publica trata de monitoramento/abuso, não de idade] |
"Google is committed to the responsible development and use of AI. To ensure the safety and integrity of the Gemini API, we have created these policy guidelines. By using the Gemini API, you agree to the following guidelines, the [Gemini API Additional Terms of Service](/gemini-api/terms) and Generative AI [Prohibited Use Policy](https://policies.google.com/terms/generative-ai/use-policy)." |
https://ai.google.dev/gemini-api/docs/usage-policies ("Last updated 2026-06-09 UTC") | lido em 2026-09-30

[Retenção para enforcement] |
"Google retains the following data for fifty-five (55) days for the purposes of detecting and preventing violations of the Prohibited Use Policy [...]" |
https://ai.google.dev/gemini-api/docs/usage-policies | lido em 2026-09-30

### B.4 Restrição contratual em canal/produto infantil (YouTube "made for kids")

[A Gemini API trata o tema pela via da idade: "API Clients" voltados a menores de 18 são vedados — logo, um produto
cujo público-alvo/acesso seja infantil está fora do contrato, sem necessidade de cláusula específica de "canal infantil"] |
"You also will not use the Services as part of a website, application, or other service (collectively, "**API Clients**") that is directed towards or is likely to be accessed by individuals under the age of 18." |
https://ai.google.dev/gemini-api/terms?hl=en | lido em 2026-09-30

[Camada YouTube (não-LLM): a API do YouTube NÃO proíbe uso comercial em canal infantil — ela impõe obrigações para API Clients "child-directed"] |
"3. If your API Client (or any part thereof) targets or directs itself to children (as defined under applicable law(s) including the U.S. Children's Online Privacy (COPPA) and E.U. General Data Protection Regulation (GDPR)) (referred to herein as a "**Child-Directed API Client**"), (a) you and your API Client must comply with [Section III.J (API Clients Directed to Children) of the Developer Policies](https://developers.google.com/youtube/terms/developer-policies#j.-child-directed-api-clients) including notifying Google of the child-directed nature of your API Client; each Child-Directed API Client notified to Google as provided in Section III.J.2.b of the Developer Policies or otherwise is referred to herein as a "**Known Child-Directed API Client**", and (b) no YouTube API Services write-based actions (such as, but not limited to, uploading content, commenting and creating/sharing playlists) taken by users of Known Child-Directed API Client will be implemented on YouTube websites, applications, services and products [...]" |
https://developers.google.com/youtube/terms/api-services-terms-of-service (seção 9.1, "Notices to Users"; "Last updated 2026-09-14 UTC") | lido em 2026-09-30

[Para API Client que NÃO é child-directed, é obrigatório permitir marcar "Made for Kids" antes do upload, ou avisar o usuário] |
"4. If your API Client is **not** a Child-Directed API Client, you must implement **one** of the following: (a) enable users of your non-Child-Directed API Client to designate their content as Made for Kids via your API Client **before** they can upload their content to YouTube websites, applications, services or products; or (b) notify users of your non-Child-Directed API Client **within** such API Client that if they upload content to YouTube websites, applications, services or products that is Made for Kids, then they must immediately go to YouTube on desktop to declare their content as Made for Kids." |
https://developers.google.com/youtube/terms/api-services-terms-of-service (seção 9.1) | lido em 2026-09-30

[Camada YouTube: elegibilidade é "idade legal para contratar", não 18 fixo] |
"3.2 **Unauthorized Persons.** You must not accept the Agreement, or access or use the YouTube API Services, if (i) you are not of legal age to form a binding contract with us [...]" |
https://developers.google.com/youtube/terms/api-services-terms-of-service | lido em 2026-09-30

[Os Termos de Google Cloud regem apenas pagamento/faturamento da Gemini API] |
"As such, while these Terms govern your use of the Paid Services, the following sections of the [Google Cloud Terms of Service](https://cloud.google.com/terms) as applicable to the Google Cloud Platform [...] will govern payments, invoicing, billing, payment disputes, and related issues pertaining to the Paid Services [...]" |
https://ai.google.dev/gemini-api/terms?hl=en | lido em 2026-09-30

---

## C) OPENROUTER

> **Método:** `https://openrouter.ai/terms` e `https://openrouter.ai/privacy` são renderizadas no cliente; o fetch
> direto devolveu apenas a navegação (e o snapshot do Wayback, idem). O texto abaixo veio de
> **[VIA RENDERIZADOR]** `https://r.jina.ai/https://openrouter.ai/terms` e `https://r.jina.ai/https://openrouter.ai/privacy`.

### C.1 Idade mínima nos termos do OpenRouter (SIM, 18)

[ToS, seção 2 — Eligibility] |
"**2. Eligibility** — You must be at least 18 years of age to use the Service. By agreeing to these Terms, you represent and warrant to us that: (a) you are at least 18 years of age; (b) you have not previously been suspended or removed from the Service; and (c) your registration and your use of the Service is in compliance with all applicable laws and regulations." |
https://openrouter.ai/terms (Last Updated: August 31, 2026) | lido em 2026-09-30

[Privacy Policy, seção 8 — Eligibility] |
"**8. Eligibility** — This Site is offered and available to users who are 18 years of age or older. By using the Site, you represent and warrant that you are at least 18 years old and that you are of legal age to form a binding contract with us. If you do not meet all of these requirements, you must not access or use our Site." |
https://openrouter.ai/privacy (Last Updated: August 31, 2026) | lido em 2026-09-30

[Proibição de falsificar idade] |
"13. perform any fraudulent activity including impersonating any person or entity, claiming a false affiliation, accessing any other Service account without permission, or falsifying your age or date of birth;" |
https://openrouter.ai/terms (§7 Prohibited Conduct) | lido em 2026-09-30

### C.2 Idade do usuário final (end user) e dever do desenvolvedor

[Não há número de idade para o end user; o dever é contratual: o desenvolvedor precisa garantir que Authorized Users
e customers aceitem/cumpram os Model Terms, e responde por eles] |
"**5.1 Applicability and Acceptance** — You acknowledge that the Service enables you, your Authorized Users, and your customers (to the extent you incorporate the Service into your own products and services) access to Models provided by Model Providers. By accessing or using any Model through the Service, you agree, and will ensure that your Authorized Users and customers agree, to comply with the applicable terms for each Model ("**Model Terms**"), a list of which is provided [here](https://openrouter.ai/docs/features/provider-routing#terms-of-service). You are solely responsible for reviewing the Model Terms applicable to each Model before accessing or using that Model and for determining whether the applicable Model Terms allow you and your Authorized Users to access and use the Service, Inputs, and Outputs as you intend." |
https://openrouter.ai/terms | lido em 2026-09-30

[Flow-down obrigatório + responsabilidade objetiva do desenvolvedor] |
"**5.2 Flow-Down to Authorized Users** — You will require that all of your Authorized Users and customers access and use the Service and Models only in accordance with this Agreement, any documentation provided by OpenRouter on the Site and Service, and the applicable Model Terms. You will be responsible for all acts and omissions of your Authorized Users, including any violation of applicable Model Terms." |
https://openrouter.ai/terms | lido em 2026-09-30

[O desenvolvedor é quem decide se o caso de uso é apropriado] |
"**5.6 Configuration and Model Selection** — You are solely responsible for selecting the Models you use, configuring your account settings, setting permissions and restrictions for your Authorized Users and your customers, and determining whether each Model and the applicable Model Terms are appropriate for your use case, including any regulated, high-risk, sensitive, or customer-facing use." |
https://openrouter.ai/terms | lido em 2026-09-30

[Suspensão se houver violação dos Model Terms] |
"**5.5 Suspension and Termination** — You understand and acknowledge that you are solely responsible for any violation by yourself, your Authorized Users, and your customers of applicable Model Terms. OpenRouter may suspend, restrict, disable, or terminate your, any of your Authorized User's, and your customers' access to any Model if we reasonably believe that you, one of your Authorized Users, or your customer(s) has violated, or may violate, any Model Terms, or if we are required or requested to do so by the applicable Model Provider." |
https://openrouter.ai/terms | lido em 2026-09-30

### C.3 Vedação de uso em produtos destinados a menores / conteúdo infantil

[NÃO há cláusula vedando produto destinado a menores nem conteúdo infantil. O que existe é vedação de CSAM em
Inputs/arquivos e obrigação legal de reporte] |
"This includes screening Inputs for known child sexual abuse material (CSAM) and malware using automated detection tools. Nothing in this Section 6.7 or Section 6.9 limits or waives OpenRouter's own independent obligations under applicable law, including the obligation to report apparent CSAM to the National Center for Missing & Exploited Children (NCMEC) under 18 U.S.C. § 2258A." |
https://openrouter.ai/terms (§6.7) | lido em 2026-09-30

[Vedação em arquivos enviados] |
"You agree not to upload or store any Uploaded File that: (a) contains child sexual abuse material (CSAM) or otherwise exploits or endangers minors; (b) contains malware, viruses, or other malicious code; [...]" |
https://openrouter.ai/terms (§6.9) | lido em 2026-09-30

[Reforço na lista de condutas proibidas] |
"9. upload or store, or attempt to upload or store, any file through the Files API (or any other file-upload feature of the Service) that you know or reasonably should know contains child sexual abuse material, malware, or other content prohibited by Section 6.9;" |
https://openrouter.ai/terms (§7) | lido em 2026-09-30

[ACHADO NEGATIVO: li a §7 "Prohibited Conduct" inteira (15 itens) e ela **não** contém item sobre produtos
destinados a menores, público infantil, nem restrição de uso comercial em canal infantil.] |
— (ausência verificada) | https://openrouter.ai/terms (§7) | lido em 2026-09-30

### C.4 Como as políticas dos provedores upstream se aplicam

[ToS vincula expressamente o uso aos Model Terms de cada provedor] |
"**5.8 Conflicts** — As between yourself and OpenRouter, these Terms govern the parties' rights and obligations with respect to the Service. The applicable Model Terms govern your, your Authorized Users', and your customers' access to and use of the applicable Model to the extent required by the applicable Model Provider. OpenRouter does not modify, waive, or limit any Model Terms unless expressly stated in writing." |
https://openrouter.ai/terms | lido em 2026-09-30

[Model Providers são beneficiários diretos de cláusulas do contrato] |
"Model Providers are intended third-party beneficiaries of Sections 5, 6.1, 15, 17, and this Section 20 to the extent such provisions relate to your, Authorized Users', or your customers' access to or use of the applicable Models, compliance with applicable Model Terms, User Content, Inputs, Outputs, usage restrictions, or limitations of liability." |
https://openrouter.ai/terms (§20) | lido em 2026-09-30

[Documentação oficial do OpenRouter: obrigação de não violar os termos dos provedores] |
"## Terms of Service — You can view the terms of service for each provider below. You may not violate the terms of service or policies of third-party providers that power the models on OpenRouter." |
https://openrouter.ai/docs/guides/routing/provider-selection#terms-of-service (twin markdown: https://openrouter.ai/docs/guides/routing/provider-selection.md) | lido em 2026-09-30

[Privacidade: o Input vai para o provedor e as práticas dele regem] |
"When you submit Inputs through the Service, those Inputs are transmitted to the Model Provider you select, or that is selected through automatic routing, as applicable. Different Model Providers have different data practices [...] **Some Model Providers may use your Inputs and Outputs for model training or improvement.**" |
https://openrouter.ai/privacy | lido em 2026-09-30

[OpenRouter diz que não treina com seus dados] |
"**OpenRouter does not use your Inputs or Outputs for model training.**" |
https://openrouter.ai/privacy | lido em 2026-09-30

[Política de logging por padrão] |
"OpenRouter does not store your prompts or responses, *unless* you opt in to one or both of the following: [...] Any prompt retention on OpenRouter is always opt-in. OpenRouter has never shared, sold, or licensed underlying prompt data to any third party." |
https://openrouter.ai/docs/guides/privacy/data-collection | lido em 2026-09-30

---

## Comparação literal (sem inferência além do texto)

| | Usuário da API | API Client / produto voltado a menores de 18 |
|---|---|---|
| **Anthropic** (Commercial Terms + AUP) | sem idade mínima numérica nas Commercial Terms; "not for consumer use" | **PERMITIDO com salvaguardas** — "Products serving minors [...] must comply with the additional guidelines" e o artigo 9307344 exige verificação de idade, moderação, monitoramento; auditoria e possível suspensão |
| **Google Gemini API** | 18+ obrigatório | **VEDADO** — "You also will not use the Services as part of [...] "API Clients" that is directed towards or is likely to be accessed by individuals under the age of 18." |
| **OpenRouter** | 18+ obrigatório (ToS §2 e Privacy §8) | sem cláusula própria; o dever é repassar e não violar os Model Terms (Anthropic/Google), sob pena de suspensão |

**Resposta direta à pergunta de contexto:** SIM — no Google a vedação **não é específica de mídia (Veo/Imagen)**.
Ela está na seção "Age Requirements" das *Gemini API Additional Terms of Service*, que regem a Gemini API, o Google
AI Studio "and the other Google developer services that reference these terms" — ou seja, a camada de TEXTO/LLM
está coberta pela mesma restrição. Citação literal em B.1/B.2 acima.

---

## NÃO VERIFICADO

1. **https://www.anthropic.com/legal/usage-policy → HTTP 404.** Não existe nessa URL. Canônica verificada: `/legal/aup`.
   A URL que as Commercial Terms usam (`https://console.anthropic.com/legal/aup`) **não foi aberta** — não confirmei se o
   texto lá é idêntico ao de `/legal/aup`.
2. **Anthropic Commercial Terms: ausência de cláusula de idade.** Li o texto integral (seções A–M) e não há cláusula
   de idade mínima. Não posso afirmar que não exista em documento incorporado por referência: **Service Specific Terms**
   (https://www.anthropic.com/legal/service-specific-terms), **DPA** (https://www.anthropic.com/legal/data-processing-addendum)
   e **Supplemental Credits Terms** não foram lidos.
3. **privacy.anthropic.com (políticas por país).** Redireciona para https://privacy.claude.com/, cuja home é só um índice
   de coleções ("Commercial Customers", "Consumers"). Não localizei nem li políticas específicas por país com cláusula de
   idade → NÃO VERIFICADO.
4. **trust.anthropic.com.** HTTP 200, mas o fetch devolveu apenas o título "Anthropic Trust Center" (aplicação JS).
   Nenhuma cláusula pôde ser lida → NÃO VERIFICADO.
5. **https://policies.google.com/terms (Google Terms of Service) e a Prohibited Use Policy por fetch direto.**
   Retornaram HTTP 200 com corpo vazio em `?hl=en`, `?hl=en-US`, `?hl=pt-BR`; o snapshot do Wayback
   (web.archive.org/web/2026/https://policies.google.com/terms/generative-ai/use-policy) também voltou vazio.
   O texto da Prohibited Use Policy citado em B.3 veio de **renderização via r.jina.ai da URL oficial** — não é leitura
   direta da página, e o Google ToS **não foi lido de forma alguma** → NÃO VERIFICADO.
6. **https://cloud.google.com/terms/service-terms.** Não foi aberto. As Gemini API Additional Terms dizem apenas que as
   seções de pagamento/faturamento dos Termos do Google Cloud se aplicam aos Paid Services → não verifiquei se há
   cláusula de idade/uso infantil lá → NÃO VERIFICADO.
7. **support.google.com/gemini/answer/...** O enunciado da tarefa não indicou o ID do artigo. Testei um ID plausível
   (`13594963`) → HTTP 404. O **único** link `support.google.com` citado nas Gemini API Additional Terms é
   https://support.google.com/adsense/answer/10926790 (Client Application Guidelines, para Grounding with Google Search),
   que não foi aberto → NÃO VERIFICADO.
8. **YouTube Developer Policies, Seção III.J (API Clients Directed to Children).** Citada pelos Termos da API do YouTube
   (9.1.3), mas não lida → o conteúdo exato das obrigações de API Client "child-directed" é NÃO VERIFICADO.
9. **OpenRouter: leitura direta.** https://openrouter.ai/terms, https://openrouter.ai/privacy e
   https://openrouter.ai/for-ai são renderizadas no cliente; o fetch direto devolveu só navegação (Wayback idem).
   Todo o texto de C veio de renderização via r.jina.ai das URLs oficiais; `/terms.md` e `/privacy.md` retornam 404.
10. **OpenRouter DPA** (https://openrouter.ai/data-processing-agreement, citado na §10.2 do ToS): não lido → não
    verifiquei se contém cláusula de menores/idade → NÃO VERIFICADO.
11. **Lista oficial de Model Terms do OpenRouter.** O ToS §5.1 aponta para
    https://openrouter.ai/docs/features/provider-routing#terms-of-service, que hoje resolve para
    https://openrouter.ai/docs/guides/routing/provider-selection#terms-of-service (seção "Terms of Service"). Não abri a
    página individual de cada provedor para confirmar o pareamento modelo→termos → NÃO VERIFICADO caso a caso.
12. **Documento citado no enunciado como "https://ai.google.dev/gemini-api/docs/usage-policies"** foi lido, mas o título
    real é "Abuse monitoring"; ele **não** contém cláusula de idade. A restrição de idade está nas Additional Terms
    (B.1/B.2), não nessa página.
