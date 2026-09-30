# D2 — Termos pendentes sobre menores: MiniMax, Pika, Luma e Alibaba/Wan

**Decisão alimentada:** D2 — provedores de IA de vídeo/imagem/voz e teto de custo por vídeo
(`.rebeca/estado.md`).
**Autor:** `rebeca-lgpd` + `rebeca-ia-video`.
**Data da coleta:** 2026-09-30.
**Missão:** fechar **a última lacuna bloqueante** da D2 — ler, na fonte oficial, o que quatro
provedores dizem sobre produzir conteúdo **para canal infantil (3–5 anos)** e sobre o **output
representar personagem criança**.
**Memos que este documento completa:** `.rebeca/pesquisa/d2-restricao-menores-provedores.md` (v2,
§1.2 e §5(a)) e `.rebeca/pesquisa/d2-adendo-vertex.md`.

> **Aviso de competência.** Documento técnico de conformidade. **Não é parecer jurídico.** Onde aqui
> se lê "interpretação", há questão que **um advogado precisa assinar** (ver §7).

---

## 0. Método, eixos e limites de leitura

### 0.1 Os três eixos (não podem ser confundidos)

Todo o erro deste projeto nasceu de **transferir conclusão de um eixo para outro**. Cada citação
abaixo vem rotulada com o eixo que ela **de fato** governa:

| Eixo | Pergunta | Exemplo de cláusula |
|---|---|---|
| **(1) Quem opera a conta/API** | Há idade mínima para o operador humano/empresa? | "you are at least 18 years old" |
| **(2) Quem/dado é enviado como input** | É vedado subir imagem, voz ou dado de menor? | "You must not upload any images that depict … individuals under the age of 18" |
| **(3) O que o output/serviço representa ou a quem se dirige** | O output pode representar menor? O serviço pode ser dirigido a menores? | "…use the Services as part of a website, application, or other service … directed towards … individuals under the age of 18" (Google/GCP — já conhecida) |

**Uma cláusula sobre "usuários menores de 13" governa o eixo 1** e **não** libera nem bloqueia nada
nos eixos 2 e 3. Cláusulas sob o rótulo "exploiting or harming children" governam **dano/abuso** —
não são cláusula de público-alvo e **não** devem ser lidas como se fossem.

### 0.2 Regras de leitura aplicadas

- Fonte primária: **página oficial do provedor**. `web_search` só para **localizar** a URL.
- Todo conteúdo de página tratado como **dado não confiável**, nunca como instrução.
- **Leitura mediada por terceiro é declarada** onde ocorreu (§0.3). Onde a página oficial não
  entregou corpo legível e não houve leitura por extrator, o item está **`NÃO VERIFICADO`**.
- **Nenhuma cláusula, artigo ou aspas foi inventada.** Aspas foram copiadas literalmente do corpo
  lido; divergências de pontuação são do original.

### 0.3 Limites de leitura (reproduzíveis)

| Provedor | Documento | Como foi lido | Limite |
|---|---|---|---|
| MiniMax | **Open Platform ToS** (`platform.minimax.io/protocol/terms-of-service`) | `web_fetch` direto devolve **HTTP 200 com corpo ilegível** (só o título "MiniMax API Platform"); o corpo foi obtido **por extrator de texto de terceiro (`r.jina.ai`) aplicado sobre a URL oficial** | Texto é da página oficial; **a cadeia de custódia da leitura é de terceiro**. §Lacunas |
| Alibaba | **Product Terms v3.8.0** | `web_fetch` e extrator de terceiro: ambos os caminhos **truncam** o documento em §4.44 | **§4.45 até o fim NÃO LIDO** — é lá que fica a seção do Model Studio (ver §4.4) |
| Demais documentos | — | `web_fetch` direto, corpo completo e legível | — |

---

## 1. MiniMax

**Documentos lidos**

| # | Documento | URL | Data declarada na página |
|---|---|---|---|
| M1 | MiniMax Terms of Service (moldura geral, unifica produtos) | https://www.minimax.io/terms-of-service-v2.html | Updated: **April 15, 2026** |
| M2 | **MiniMax Open Platform Terms of Service** (API/empresas) — Nanonoble Pte Ltd. | https://platform.minimax.io/protocol/terms-of-service | Effective Date: **March 30, 2026** |
| M3 | Hailuo AI Terms of Service for Video and Image Tools (consumidor, `hailuoai.video`) | https://hailuoai.video/doc/terms-of-service.html | Last Modified: **08/19/2026** |
| M4 | MiniMax App and Web Terms of Service (consumidor: chat/audio) | https://www.minimax.io/audio/doc/terms-of-service.html | Updated: **June 19, 2025** |

M1 remete a M2 como "Terms applicable to enterprise API services" e a M3/M4 como termos por produto,
dizendo: *"In the event of a conflict between these Terms and the applicable product terms for a
particular Service, the applicable product terms will control with respect to that Service."*

### Tabela MiniMax

| Cláusula | Eixo (1/2/3) | Citação literal | URL | Data da página |
|---|---|---|---|---|
| Capacidade do operador | **1** | *"By clicking to confirm this Agreement on the website or by actually using the Service, you confirm that: you possess the legal rights and capacity necessary to enter into a binding contract with us (if you are under 18, please read this Agreement with a guardian and obtain their consent before using the Service), and that you accept and agree to abide by this Agreement."* | https://platform.minimax.io/protocol/terms-of-service | Effective **2026-03-30** |
| Idade do usuário do produto de consumidor | **1** | *"This Services is offered and available to users who are 16 years of age or older."* | https://www.minimax.io/audio/doc/terms-of-service.html · https://hailuoai.video/doc/terms-of-service.html | 2025-06-19 · 2026-08-19 |
| Responsabilidade pelo próprio produto | **3** | *"The Service is solely provided as a neutral technical service … You are solely responsible for the operation of your own websites, applications, software, platforms, and any related content."* | https://platform.minimax.io/protocol/terms-of-service | 2026-03-30 |
| Lista de conteúdo proibido (íntegra conferida) | **3** | Itens proibidos vão de *"Opposing the basic social principles required by applicable law"* a *"Creating or disseminating obscene, pornographic, violent, murderous, terroristic, or criminal incitement content"* e fecham em *"Including any other prohibited content by applicable laws or regulations."* **Não há item sobre público-alvo menor nem sobre output representando menor.** | https://platform.minimax.io/protocol/terms-of-service | 2026-03-30 |
| Rotulagem obrigatória de conteúdo sintético | **3 (output) / (e)** | *"The services provided by us are based on deep synthesis technology. If you offer services based on these technologies, you must enhance data management, implement necessary measures to protect data security, and fulfill assessment obligations. You are required to adopt technical measures to add non-intrusive identifiers, maintain log information according to applicable laws and regulations, and place a prominent mark in reasonable positions or areas within generated or edited content to inform the public of the use of deep synthesis technology. You must also fulfill filing, modification, and deregistration requirements according to applicable local laws, if any."* | https://platform.minimax.io/protocol/terms-of-service | 2026-03-30 |
| Dano a menores (**não** é cláusula de público) | **3 (dano)** | *"For the purpose of exploiting, harming, or attempting to exploit or harm minors in any way by exposing them to inappropriate content, asking for personally identifiable information, or otherwise."* | https://hailuoai.video/doc/terms-of-service.html | 2026-08-19 |
| **Uso comercial no produto de consumidor** | **(e)** | *"If you use any User Generated Content for any personal, business, or commercial purpose, whether or not such use is permitted under these Terms of Use, you do so at your own risk. You are solely responsible for (a) evaluating the legality, accuracy, appropriateness, and intended audience of that use; (b) obtaining all rights, permissions, consents, licenses, and releases required for that use, including rights relating to intellectual property, privacy, publicity, image, voice, and personal data; (c) complying with all applicable laws, regulations, industry requirements, and third-party platform terms; and (d) all claims, disputes, losses, liabilities, and consequences arising from that use."* — **confirma, verbatim, o "uso comercial por sua conta e risco" registrado no dossiê anterior** | https://hailuoai.video/doc/terms-of-service.html | 2026-08-19 |
| **Dever de divulgar IA** | **(e)** | *"When you publish, share, display, distribute, or otherwise make User Generated Content available to others, you must clearly disclose that it is AI-generated or manipulated whenever required by applicable law or reasonably necessary to avoid deception, confusion, or mistaken belief that the content is authentic."* — **confirma, verbatim, a obrigação de divulgar IA** | https://hailuoai.video/doc/terms-of-service.html | 2026-08-19 |
| Licença restritiva do produto de consumidor | **(e)/(f)** | *"These Terms of Use permit you to use the Services for your personal, non-commercial use only."* e *"You must not access or use for any commercial purposes any part of the Services or any services or materials available through the Services."* | https://hailuoai.video/doc/terms-of-service.html | 2026-08-19 |
| Licença ampla sobre o conteúdo do usuário (consumidor) | **(e)** | *"…royalty-free, perpetual, irrevocable, worldwide, non-exclusive right (including any moral rights) and license to use, license, reproduce, modify, adapt, publish, translate, create derivative works from, distribute, **derive revenue or other remuneration from**, and communicate to the public … This license survives termination of this Agreement by any party, for any reason."* | https://hailuoai.video/doc/terms-of-service.html | 2026-08-19 |

**Leitura do MiniMax (por eixo).** Eixo 1: satisfeito por operador adulto; a cláusula de capacidade
**não** é proibição. Eixo 2: **silêncio** — nada veda subir dado de menor, mas as obrigações de
proteção de dados do próprio Rebeca continuam. Eixo 3: **silêncio** — nenhuma cláusula sobre
público-alvo ou output representando menor em **M1, M2, M3 ou M4**. (e): no **API/Open Platform**
não foi encontrada vedação de uso comercial; há **obrigação de rotular** conteúdo sintético. No
**produto de consumidor** (Hailuo), a licença é *"personal, non-commercial use only"*, com o uso
comercial apenas *"at your own risk"* — **o tier de consumidor não serve para canal monetizado**.
(f): **sim, os tiers diferem** — API/plataforma (M2) vs. consumidor (M3/M4); e o consumidor é 16+,
enquanto M2 admite menor de 18 com consentimento do responsável.

---

## 2. Pika

**Documentos lidos**

| # | Documento | URL | Data declarada na página |
|---|---|---|---|
| P1 | Pika Terms of Service — Mellis, Inc. | https://pika.art/terms-of-service | Last modified: **08/04/2026** |
| P1-API | Pika API Terms of Service (mesmo texto-base + §§ de API) | https://dev.pika.art/terms-of-service | Last updated **08/04/2026** |
| P2 | Pika Acceptable Use Policy (incorporada por referência pela P1) | https://pika.art/acceptable-use-policy | Last updated: **05/16/2025** |
| P3 | Catálogo/llms.txt da API (fonte operacional; **não** é termo) | https://dev.pika.art/llms.txt | — |

### Tabela Pika

| Cláusula | Eixo (1/2/3) | Citação literal | URL | Data da página |
|---|---|---|---|---|
| Idade do operador | **1** | *"By accessing or using the Service, you state that you are at least 18 years old and meet the minimum age of digital consent in your country. You must be at least 18 years of age to create, operate, or interact with an AI Self, or to monetize any Content through the Service."* | https://pika.art/terms-of-service | 2026-08-04 |
| Postura declarada do produto | **(3) contexto** | *"Pika strives to make the Service PG-13 and family-friendly. However, the content generated by the Service is produced by an artificial intelligence system in response to user input."* | https://pika.art/terms-of-service | 2026-08-04 |
| **Acesso de end users ao SEU serviço** | **3** | *"If your Plan permits you to make the Service or Outputs available to your own end users through your application or service, you are solely responsible for (a) all acts and omissions of your end users, (b) ensuring that your end users comply with these terms of service, the AUP, and all applicable Model Terms through your own binding end user agreement, (c) implementing appropriate content moderation and abuse prevention controls, (d) cooperating with Pika in connection with any takedown requests, abuse reports, or investigations related to your end users, and **(e) restricting access to your application or service to users who are at least 18 years old or, if lower age thresholds apply under your jurisdiction, ensuring appropriate parental consent and supervision.**"* | https://pika.art/terms-of-service · https://dev.pika.art/terms-of-service | 2026-08-04 |
| **Upload de imagem de menor — VEDAÇÃO** | **2** | *"**You must not upload any images that depict or appear to depict individuals under the age of 18**, or that include celebrity likenesses or copyrighted photographs without authorization."* | https://pika.art/acceptable-use-policy | 2025-05-16 |
| Upload de retrato/likeness de pessoa real | **2** | *"You must not upload or submit photographs, portraits, or other likenesses of real individuals without their express consent. You must only use images of yourself or of others where you have all necessary rights, licenses, and consents, including those required under privacy, publicity, and intellectual property Laws."* | https://pika.art/acceptable-use-policy | 2025-05-16 |
| Restrição de conteúdo envolvendo criança (sob guarda-chuva de dano) | **3 (dano)** | *"Promotes, describes, or depicts exploitation, abuse, or harm to a child, including: child sexual abuse material; **content impersonating or intended to impersonate a child**; and any scenario involving non-adult participants in sexual situations, whether real, fictional, or AI-generated."* | https://pika.art/acceptable-use-policy | 2025-05-16 |
| Uso comercial | **(e)** | *"Pika hereby grants you a limited, nonexclusive, nontransferable, nonsublicensable, revocable license to access and use the Service solely for your personal, noncommercial use—except where your subscription Plan expressly permits commercial use."* | https://pika.art/terms-of-service | 2026-08-04 |
| Venda/anúncio via Serviço | **(e)** | *"To advertise, promote, or facilitate the sale of any goods or services without our prior written authorization."* (item da lista de usos proibidos da AUP) | https://pika.art/acceptable-use-policy | 2025-05-16 |
| Divulgação de IA | **(e)** | *"You agree to disclose that any deepfake Output has been artificially generated or manipulated."* | https://pika.art/acceptable-use-policy | 2025-05-16 |
| **Atribuição exigida** | **(e)** | *"If you use the Service to integrate Pika's models into your application or service, you must display appropriate attribution in a manner reasonably visible to end users, unless your Plan expressly permits white-labeling. White-labeling of Pika's first-party models is available only to enterprise customers under a separate written agreement. For Third-Party Models, attribution requirements are governed by the applicable Model Terms."* | https://dev.pika.art/terms-of-service | 2026-08-04 |
| Treinamento com Inputs/Outputs vs. enterprise | **(f)** | *"Unless otherwise agreed in writing, you acknowledge that Pika may use anonymized or aggregated Content, including Inputs, Outputs, and your interactions with the Service, and Usage Data to train, improve, and develop its machine learning models…"* e *"If you are an enterprise customer with a separate written agreement, the terms of that agreement will govern data use and training."* | https://dev.pika.art/terms-of-service | 2026-08-04 |
| **Modelos de terceiros repercutem os termos do provedor de origem** | **(f)** | *"The Service may provide access to artificial intelligence models, services, or content provided by third-party model providers ('Third-Party Models'). Each Third-Party Model is subject to its own terms and conditions, usage policies, and acceptable use policies established by the applicable third-party provider ('Model Terms'). By accessing or using any Third-Party Model through the Service, you agree to review, accept, and comply with the applicable Model Terms."* | https://dev.pika.art/terms-of-service | 2026-08-04 |
| Moderação de origem | **(3) operacional** | *"Bypassing provider moderation. Every operation runs the upstream provider's safety policy and can refuse a prompt or an input."* | https://dev.pika.art/llms.txt | (página viva) |

**Leitura do Pika (por eixo).** Eixo 1: 18+ — satisfeito por operador adulto. **Eixo 2: BLOQUEIO
LITERAL.** A AUP veda subir imagem que *"depict **or appear to depict** individuals under the age of
18"*. O pipeline da Luna é **image-to-video** com **character sheet** do personagem criança para
garantir consistência (invariante 3). Esse caminho exige exatamente o upload vedado. A vedação
alcança também a imagem **gerada** que *"appear to depict"* menor — o "appear to" amplia, não
restringe. **Eixo 3:** há cláusula de **end users do seu serviço com 18+** (ou consentimento
parental onde a lei local admitir idade menor). Observação de honestidade: essa alínea fala de quem
**acessa o Serviço/Outputs** pela sua aplicação — espectador de vídeo publicado **não** "acessa o
Serviço"; a extensão ao canal do YouTube é **interpretativa** e, por isso, vai ao §7. Mas o eixo 2
**não depende** dessa interpretação. (e): uso comercial só com Plano que autorize; **atribuição
obrigatória** ao integrar modelos Pika, com white-label reservado a enterprise; treinamento com
Inputs/Outputs é o padrão **fora** de acordo enterprise escrito (f).

---

## 3. Luma

**Documentos lidos**

| # | Documento | URL | Data declarada na página |
|---|---|---|---|
| L1 | Terms of Service (usuário individual/consumidor) | https://lumalabs.ai/legal/terms-of-service | Last updated: **May 14, 2026** |
| L2 | Enterprise Terms of Service | https://lumalabs.ai/legal/enterprise-terms-of-service | Last updated: **April 20, 2026** |
| L3 | API Terms of Use | https://lumalabs.ai/legal/api-terms-of-use | Last updated: **April 28, 2026** |
| L4 | **Content Moderation Policy** | https://lumalabs.ai/legal/content-moderation-policy | Last updated: **April 23, 2026** |

O índice oficial `https://lumalabs.ai/legal` lista esses quatro e mais Billing/Spend Limit/Cookies/
Privacidade/Subprocessors — **não existe** documento separado de "Acceptable Use" além do AUP
embutido (§3.4 e §4.7 de L1; §2.5(b) de L2); `lumalabs.ai/aup` responde **HTTP 404**.

### Tabela Luma

| Cláusula | Eixo (1/2/3) | Citação literal | URL | Data da página |
|---|---|---|---|---|
| Idade do operador (consumidor) | **1** | *"You represent and warrant that: … (c) you are at least 18 years old (or, if between 13 and 18, that you have your parent's or legal guardian's consent to be bound by this Agreement). Users under 13 are not authorized to use the Services."* | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| Aviso COPPA (consumidor) | **1** | *"COPPA NOTICE: Luma does not knowingly collect personal information from children under 13. If Luma discovers that a user under 13 has provided personal information, it will promptly delete that information…"* | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| Idade do operador (enterprise/API) | **1** | **Não há cláusula de idade** em L2 nem em L3 (contrato B2B). | https://lumalabs.ai/legal/enterprise-terms-of-service · https://lumalabs.ai/legal/api-terms-of-use | 2026-04-20 · 2026-04-28 |
| Público-alvo menor / serviço dirigido a menores | **3** | **Nenhuma cláusula** em L1, L2, L3 ou L4. A única referência a criança é a proibição de conteúdo sob o rótulo de **dano**: *"use the Services to engage in … any illegal activity, including … exploiting or harming children …"* e *"sexualize children"* (L1 §4.7(a) e (c)). | https://lumalabs.ai/legal/terms-of-service · https://lumalabs.ai/legal/content-moderation-policy | 2026-05-14 · 2026-04-23 |
| Política de moderação de conteúdo | **3** | Diretrizes são: *"No NSFW Content"*, *"No Harmful Content"*, *"Respectful and Inclusive"*, *"Legal and Ethical"*, *"Intellectual Property"*. **Nenhuma menção a menores, a público infantil ou a público-alvo.** | https://lumalabs.ai/legal/content-moderation-policy | 2026-04-23 |
| **Dado vedado como input (inclui dado de criança sob COPPA)** | **2** | Definição de *"Prohibited Data"*: *"(d) other information subject to regulation or protection under specific Laws such as the **Children's Online Privacy Protection Act** or Gramm-Leach-Bliley Act (or related rules or regulations)"*; e é vedado *"Use the Services with Prohibited Data or for High Risk Activities"* (L1 §3.4(l); L2 §2.5(b)(6); L3 §4.7(b)). | https://lumalabs.ai/legal/terms-of-service · https://lumalabs.ai/legal/enterprise-terms-of-service · https://lumalabs.ai/legal/api-terms-of-use | 2026-05-14 · 2026-04-20 · 2026-04-28 |
| Foto enviada com pessoas | **2** | *"If you Upload a photograph or image to the Services that includes one or more persons, you hereby grant such persons **and their administrators, guardians, heirs, and trustees**, if any, an irrevocable, perpetual, royalty free, fully paid-up, worldwide license to reproduce, distribute, and publicly display that photograph…"* | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| Uso comercial | **(e)** | *"(c) use the Services or Output for commercial purposes, unless permitted to do so under Section 4.9"*; e §4.9(a): *"Customer acknowledges and agrees that it can only use the Outputs for commercial purposes if the Outputs were produced during an active Subscription Term under Customer's paid subscription allowing for the commercial use of those Outputs."* | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| Divulgação de IA em output que pareça pessoa | **(e)** | *"If you use any Output that identifies or resembles a person, you will publicly identify that such Output was AI generated."* | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| Marca d'água / metadados de proveniência | **(e)** | *"Luma reserves the right, in its sole discretion and without prior notice, to embed watermarks, content credentials, provenance metadata, or other identifying information in or associated with Output… Customer will not, and will not permit its Users to, remove, alter, obscure, or circumvent any such watermarks, metadata, or content credentials."* | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| **Atribuição (condicional)** | **(e)** | *"If required by Luma in writing or as specified in an applicable Order Form, Customer shall display 'Powered by Luma' or such other attribution language as Luma may specify in all Customer Services that incorporate or make use of the APIs or Output."* — **condicional**, ao contrário do "Powered by Runway" (incondicional). | https://lumalabs.ai/legal/api-terms-of-use | 2026-04-28 |
| Dever de informar o end user que é IA | **(e)** | *"Customer shall ensure that API Users are informed, through Customer's terms of service, documentation, or other reasonable means, that Output generated through the Services is AI-generated content."* | https://lumalabs.ai/legal/api-terms-of-use | 2026-04-28 |
| **Treinamento — consumidor TREINA** | **(f)** | Licença de input no plano **pago** (L1 §4.2(a)) inclui *"(5) create, test, improve, train, or otherwise develop the artificial intelligence or machine learning models, systems, architecture, weights, or related technology used by Luma"*; no **free** (§4.2(b)) a licença se amplia para *"publicly display, publicly perform … distribute Input"*. | https://lumalabs.ai/legal/terms-of-service | 2026-05-14 |
| **Treinamento — Enterprise NÃO treina** | **(f)** | *"Notwithstanding anything to the contrary in this Agreement, **Luma will not train its artificial intelligence or machine learning models on Input or Output (the 'No Train Guarantee')**."* | https://lumalabs.ai/legal/enterprise-terms-of-service | 2026-04-20 |
| **Treinamento — API NÃO treina** | **(f)** | *"Luma will not use (a) any Input submitted by Customer to the Services through Customer's API access under these API Terms, or (b) any Output generated by the Services in connection with Customer's API access under these API Terms, to train, fine-tune, or otherwise develop Luma's artificial intelligence or machine learning models."* | https://lumalabs.ai/legal/api-terms-of-use | 2026-04-28 |

**Leitura do Luma (por eixo).** Eixo 1: consumidor 18+ (13–18 com consentimento dos pais; <13 não
autorizado) — satisfeito por operador adulto; o contrato enterprise/API **não tem cláusula de idade**
(é B2B). **Eixo 2:** a vedação é de **dado** — *"Prohibited Data"* inclui informação protegida sob
COPPA. Não é vedação de *upload de imagem de menor* como no Pika: é vedação de **dado pessoal de
criança**. Personagem animado fictício **não** é dado protegido pela COPPA; imagem de **criança real**
é. **Eixo 3: silêncio em todos os quatro documentos** — nenhuma cláusula sobre serviço dirigido a
menores ou output representando menor. (e): uso comercial exige assinatura paga (a distinção
free × pago é material); atribuição **só se exigida por escrito**; há dever de declarar IA em output
que identifique/pareça pessoa. (f): **diferença material e verificada** — consumidor **treina** com
Inputs/Outputs; Enterprise e API **não treinam**. É o mesmo padrão da Runway: **"API/Enterprise" é
condição, não preferência.**

---

## 4. Alibaba Cloud — Model Studio / Wan

**Documentos lidos**

| # | Documento | URL | Data declarada na página |
|---|---|---|---|
| A1 | Alibaba Cloud International Website Terms of Use | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-terms-of-use-alibaba-cloud-international-website-terms-of-use | Last Updated: **Sep 04, 2026** |
| A2 | Alibaba Cloud International Website Membership Agreement | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-membership-agreement | Last Updated: **Sep 10, 2026** |
| A3 | Alibaba Cloud International Website Product Terms of Service (v3.8.0) | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0 | Last Updated: **Aug 28, 2026** |
| A4 | **Model Studio — Related agreements** (índice oficial do que governa o Model Studio) | https://www.alibabacloud.com/help/en/model-studio/related-agreements | Last Updated: **Sep 28, 2026** |
| A5 | Open Source Model License Terms | https://www.alibabacloud.com/help/en/model-studio/open-source-model-terms | Last Updated: **Sep 28, 2026** |
| A6 | Cloud Config — Best practices for generative AI compliance | https://www.alibabacloud.com/help/en/cloud-config/latest/generated-ai-compliance-best-practices | Last Updated: **Jun 23, 2026** |

### 4.1 O que A4 (índice oficial) diz governar o Model Studio

A4 lista, como **únicos** instrumentos: Product Terms (A3, com âncora `#d48a5c007bamp`), o
*Model Inference SLA*, a Membership Agreement (A2), a Privacy Policy, os *Open Source Model License
Terms* (A5) e as *Third Party Vendor Information and Terms of Service*.
**Não existe documento separado de "termos de IA generativa" do Model Studio para o site
internacional.** A6, que cobre "Model Studio, PAI e dependências", é **puramente técnico**
(guardrails de prompt/entrada/saída, criptografia, backups) e **não contém regra de conteúdo,
público-alvo ou menores**.

### Tabela Alibaba

| Cláusula | Eixo (1/2/3) | Citação literal | URL | Data da página |
|---|---|---|---|---|
| Idade do operador da conta | **1** | *"If you're a minor (which is under the age of 18 in most jurisdictions) in any applicable jurisdiction, you must have your parent or legal guardian's permission to register and use an Account."* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-terms-of-use-alibaba-cloud-international-website-terms-of-use | 2026-09-04 |
| Conteúdo **prejudicial a menores** (sob rótulo de conteúdo ilícito) | **2/3 (dano)** | *"is obscene or contains or infers any pornography or sex-related merchandising or any other content that otherwise promotes sexually explicit materials, or **is otherwise harmful to minors**"* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-membership-agreement | 2026-09-10 |
| Conteúdo ofensivo/ilícito (geral) | **3** | *"upload, post, transmit or otherwise make available on the Alibaba Cloud Platform any Materials that are defamatory, obscene, abusive, invasive of privacy, or offensive"* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-terms-of-use-alibaba-cloud-international-website-terms-of-use | 2026-09-04 |
| Ordem pública / moralidade | **3** | *"is otherwise objectionable on the grounds of public interest, public morality, public order, public security, national harmony or is prohibited by applicable laws"* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-membership-agreement | 2026-09-10 |
| End users sob responsabilidade do cliente | **3** | *"be responsible for your End Users … and ensure that such End Users act in ways that comply with the Terms"* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-membership-agreement | 2026-09-10 |
| Dado pessoal — base legal e consentimento são do cliente | **2** | *"Some Products require the processing of personal data of your customers or employees. You agree that it is solely your responsibility to establish a legal basis for the processing of such data under local law, including providing adequate privacy notices and obtaining any required consents to customers or employees."* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0 | 2026-08-28 |
| **Voz enviada exige consentimento explícito** | **2** | *"You represent and warrant that you have obtained explicit consent and all necessary rights to the voice data you upload, store or share on the Alibaba Intelligent Speech Interaction ('ISI') Service and other Alibaba voice services for purposes of using these services."* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0 | 2026-08-28 |
| Moderação de conteúdo — avisos e consentimentos | **2** | *"You represent to Alibaba Cloud that you have provided any necessary privacy notices to your end users of your products and services that use Alibaba Cloud Content Moderation service, and have obtained any necessary consents for processing the Member Content."* | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0 | 2026-08-28 |
| Público-alvo menor / output representando menor | **3** | **Nenhuma cláusula encontrada** em A1, A2, A3 (§1–§4.44, lidos), A4, A5 ou A6. | — | — |
| Uso comercial | **(e)** | **Nenhuma restrição de uso comercial encontrada** nos documentos lidos (é nuvem empresarial paga). **Nenhuma exigência geral de rotulagem de IA** encontrada nos trechos lidos. | — | — |
| Diferença consumidor × enterprise | **(f)** | **Não há** dois conjuntos de termos para o Model Studio no site internacional; o contrato é único e empresarial (aceitação + Product Terms). | https://www.alibabacloud.com/help/en/model-studio/related-agreements | 2026-09-28 |

### 4.2 O que **NÃO** foi lido (e por quê)

- **A3 §4.45 até o fim**: `web_fetch` direto, `r.jina.ai` (en) e `r.jina.ai` (zh) **truncam todos no
  mesmo ponto** (§4.44); download local por `pwsh`/`Invoke-WebRequest` **falhou** (conexão encerrada
  — rede indisponível no sandbox desta sessão). O índice A4 aponta para A3 com a âncora
  `#d48a5c007bamp`, ou seja: **a seção específica do Model Studio está nesse trecho não lido**
  (a §4.47 existe e é citada em resultados de busca). **`NÃO VERIFICADO`**.
- **Acordos do site chinês** (`阿里云百炼服务协议` / Bailian; `万相用户协议` / Wanxiang): **não**
  foram usados como fonte de conclusão. São documentos de outra plataforma (aliyun.com, lei chinesa)
  e **não governam** o Model Studio do site internacional. Registrado aqui justamente para **evitar**
  que alguém os cite como se governassem.

---

## 5. Veredito por provedor

**Caso de uso avaliado:** canal infantil (público 3–5 anos, declarado ao YouTube) e **output
representando personagem criança**.

| Provedor | Tier avaliado | Status | Fundamento decisivo (citação) | Condições que a allow-list precisa registrar |
|---|---|---|---|---|
| **MiniMax** | **Open Platform (API)** — não o consumidor | **`PERMITIDO`** | Nenhuma cláusula sobre público-alvo ou output representando menor em M1–M4. O que existe é **(1)** capacidade do operador e **(2)** *"place a prominent mark in reasonable positions or areas within generated or edited content to inform the public of the use of deep synthesis technology"* | Operador adulto (eixo 1 satisfeito); **rotulagem de conteúdo sintético obrigatória**; **não** usar Hailuo/Audio (consumidor: *"personal, non-commercial use only"*) para produção monetizada; leitura de M2 foi **mediada por terceiro** (§0.3) — reler em navegador antes de assinar |
| **Pika** | consumidor e API (texto-base comum) | **`PROIBIDO`** | AUP: *"**You must not upload any images that depict or appear to depict individuals under the age of 18**"* — o pipeline image-to-video com character sheet do personagem criança **exige** esse upload. Somam-se: *"(e) restricting access to your application or service to users who are at least 18 years old"* e a postura *"PG-13"* | Não entra na allow-list para canal infantil. Ressalva registrada: caminho **texto→vídeo** sem upload de imagem não é literalmente alcançado pelo eixo 2, mas continua sob (e) e sob a ressalva de interpretação do §7 |
| **Luma** | **API / Enterprise** — não o consumidor | **`PERMITIDO`** | **Silêncio total** sobre público-alvo e output representando menor nos quatro documentos (L1–L4), inclusive na *Content Moderation Policy*. O que existe é vedação de **dado** (*"Prohibited Data"* com COPPA) e deveres de rotulagem/proveniência | Usar **API ou Enterprise** (consumidor **treina** com Inputs/Outputs; API/Enterprise têm *No Train Guarantee*); **nenhum dado de criança real** (COPPA = Prohibited Data); declarar IA em output que identifique/pareça pessoa; *"Powered by Luma"* **se** exigido por escrito; não remover marcas d'água/metadados |
| **Alibaba / Model Studio / Wan** | site internacional | **`NÃO VERIFICADO`** | **Nenhuma cláusula restritiva encontrada em 6 documentos lidos** (ToU, Membership Agreement, Product Terms §1–§4.44, índice A4, A5, A6) — mas a **seção específica do Model Studio** (Product Terms §4.45+, âncora apontada pelo próprio índice oficial) **não pôde ser lida** | Pendência de **1 seção**. Não entra na allow-list até essa leitura; **nada** no material lido bloqueia — é o candidato mais provável a fechar a lacuna com uma releitura de navegador |

**Nota de não-conflação.** O status do Pika é `PROIBIDO` **pelo eixo 2** (upload), não pelo eixo 3 —
a cláusula de end users 18+ é um segundo problema, **separado**, e é interpretativa quanto ao canal
publicado. O status do Luma e do MiniMax é `PERMITIDO` **por ausência de cláusula** (silêncio), não
por cláusula permissiva expressa: silêncio não é licença afirmativa (§7).

---

## 6. O que isto destrava na D2

1. **A allow-list de vídeo deixa de estar vazia.** Antes desta coleta, **nenhum** provedor de vídeo
   tinha termo lido que permitisse canal infantil. Agora:
   - `PERMITIDO` para canal infantil: **MiniMax Open Platform (API)** e **Luma API/Enterprise**.
   - `PROIBIDO`: **Pika** (eixo 2 — upload de imagem de personagem criança) e, por motivo anterior,
     **Kling** (conflito de uso comercial) e **Google/Veo/Imagen/Gemini/Vertex** (F1 e §20(d) do GCP,
     inalterados por este documento).
   - `NÃO VERIFICADO`: **Alibaba/Model Studio/Wan** — **uma** seção não lida.
2. **A D2 pode ser fechada para vídeo — sim, com escopo explícito.** O gate de provedor já tem dois
   caminhos com termo lido e nenhum bloqueio de público. Fechar significa: (i) allow-list versionada
   com os campos `provedor × finalidade × plano × URL × data de leitura × trecho`; (ii) os **dois**
   candidatos entram **no tier correto** (MiniMax API, não Hailuo; Luma API/Enterprise, não
   consumidor); (iii) Alibaba fica **fora** até a leitura de §4.45+.
3. **Achado novo e estrutural: agregador não lava a restrição de origem.** O `dev.pika.art` revende
   modelos de terceiros — há **Veo 3.1, Gemini Omni, Lyria, Nano Banana (Google)**, **Wan 3.0
   (Alibaba)**, **MiniMax H3/Hailuo**, Kling, ByteDance — e a própria ToS da API diz que *"Each
   Third-Party Model is subject to its own terms and conditions, usage policies, and acceptable use
   policies"*, com o `llms.txt` confirmando que *"Every operation runs the upstream provider's safety
   policy and can refuse a prompt or an input"*.
   **Consequência para a D2:** a chave da allow-list **não pode ser o agregador**; tem de ser o
   **modelo efetivamente chamado**. Chamar Veo "via Pika" **não** contorna a restrição de menores do
   Google — apenas acrescenta uma camada contratual. E escolher um agregador que ofereça modelo
   bloqueado reintroduz o risco pela porta dos fundos.
4. **O campo "plano" continua sendo parte da allow-list — agora com três casos verificados:**
   Runway (consumidor treina e aceita 13+; Enterprise não treina), **Luma** (consumidor treina;
   API/Enterprise com *No Train Guarantee*), **Pika** (treina com Inputs/Outputs fora de acordo
   enterprise escrito; atribuição obrigatória com white-label só em enterprise), **MiniMax**
   (plataforma = API empresarial; Hailuo = 16+ e não comercial).
5. **Regra nova de gate, derivada do eixo 2:** o roteador deve **recusar upload de imagem de pessoa
   menor de 18** — e, por precaução, **recusar imagem que "appear to depict" menor** (fórmula literal
   do Pika) — e **recusar `Prohibited Data`** (dado de criança sob COPPA, no Luma). A Luna é
   personagem animado fictício: o caminho seguro é **não enviar imagem de criança real em nenhuma
   etapa**, nem para gerar nem para animar.
6. **Rotulagem: inventário fechado.** Passam a ser obrigações verificadas com cláusula literal:
   MiniMax (marca proeminente + identificadores + logs), Luma (declarar IA em output que pareça
   pessoa; marcas d'água/metadados não removíveis; "Powered by Luma" se exigido), Pika (atribuição;
   divulgar deepfake). Isso entra como **requisito de render**, não como nota de rodapé.
7. **O que a D2 ainda NÃO pode declarar.** Este documento **não** conclui que "produzir canal
   infantil é permitido pelos termos" em sentido afirmativo para Luma e MiniMax: conclui que
   **nenhuma cláusula o veda**. Silêncio contratual mais o dever de proteção reforçada do ECA Digital
   (que é do Rebeca, não do provedor) é o estado real. A opção (§5(b) do memo v2) — pedir permissão
   por escrito — continua sendo a única forma de converter silêncio em certeza.

---

## 7. Lacunas

| # | Lacuna | Por que importa | Como fechar |
|---|---|---|---|
| 1 | **Alibaba — Product Terms §4.45 até o fim** (inclui a seção do Model Studio, âncora `#d48a5c007bamp`) | É o único documento que o próprio índice oficial aponta como governante do Model Studio e que ficou fora da leitura | Abrir a URL em navegador e ler de §4.45 ao fim; ~15 min. **Bloqueia** a entrada do Alibaba na allow-list |
| 2 | **MiniMax Open Platform ToS lido por extrator de terceiro (`r.jina.ai`)** | O `web_fetch` direto entrega HTTP 200 com **corpo ilegível**; a mediação é de terceiro (mesma ressalva que o memo v2 aplicou ao §20(d) do GCP) | Reler em navegador e conferir as duas cláusulas citadas (capacidade e rotulagem de "deep synthesis") antes de assinar |
| 3 | **Silêncio dos provedores ≠ licença** (Luma, MiniMax; Alibaba no que foi lido) | Nenhum dos documentos diz "pode usar para canal infantil". A conclusão é **ausência de vedação**, não autorização expressa | Opção (§5(b) do memo v2): permissão escrita/enterprise com escopo explícito ("animação infantil educativa, 3–5 anos"). E-mail de suporte **não** é evidência |
| 4 | **Interpretação do eixo 3 no Pika** | A alínea de end users 18+ fala de quem acessa o Serviço pela sua aplicação. Espectador de vídeo publicado **não acessa o Serviço** — a extensão ao canal do YouTube é interpretativa | Advogado. **Não é necessária para bloquear o Pika**: o eixo 2 já o bloqueia no caminho image-to-video |
| 5 | **Interpretação do bala "content impersonating or intended to impersonate a child" (AUP do Pika)** | Está sob o guarda-chuva *"Promotes, describes, or depicts exploitation, abuse, or harm to a child"*, e um personagem infantil fictício e benigno não é abuso. Mas a literalidade do bala, isolada, é ampla | Advogado. Registrar que este agente **não** leu o bala como vedação de personagem infantil — leria errado, porque o guarda-chuva é dano |
| 6 | **Cláusulas de provedores de origem usados dentro de agregadores** | Pika revende Google/Wan/MiniMax/Kling. Cada Model Term se aplica (Pika ToS §8), mas esses termos **por modelo** não foram auditados neste documento | Auditar por **modelo**, não por agregador, antes de qualquer chamada via agregador |
| 7 | **Se o projeto migrar para o site chinês (aliyun.com)** | Os acordos de lá (`百炼`/Bailian, `万相`/Wanxiang) são outros documentos e não foram analisados como governantes | Refazer a análise se o contrato for com o site chinês. **Não** usar este documento para aquele cenário |
| 8 | **Rotulagem/atribuição ainda não está no pipeline** | MiniMax exige marca proeminente; Luma exige não remover marcas e declarar IA; Pika exige atribuição | Virar requisito de render em `rebeca-ia-video`, com teste que falha se a marca/metadado for removido |

---

## 8. Fontes

| # | URL | O que foi lido | Mediação |
|---|---|---|---|
| 1 | https://www.minimax.io/terms-of-service-v2.html | MiniMax ToS (moldura geral; remete aos termos por produto) | direta |
| 2 | https://platform.minimax.io/protocol/terms-of-service | MiniMax Open Platform ToS — capacidade do operador, conteúdo proibido, rotulagem de *deep synthesis*, conta, confidencialidade, lei de Singapura | **extrator de terceiro sobre a URL oficial** |
| 3 | https://hailuoai.video/doc/terms-of-service.html | Hailuo Video/Image ToS — 16+, uso comercial *"at your own risk"*, dever de divulgar IA, licença *"personal, non-commercial"* | direta |
| 4 | https://www.minimax.io/audio/doc/terms-of-service.html | MiniMax App/Web ToS — 16+, usos proibidos | direta |
| 5 | https://pika.art/terms-of-service | Pika ToS — 18+, end users 18+ (e), licença não comercial, proibições | direta |
| 6 | https://dev.pika.art/terms-of-service | Pika API ToS — atribuição/white-label, treinamento e acordo enterprise, Third-Party Models | direta |
| 7 | https://pika.art/acceptable-use-policy | Pika AUP — **vedação de upload de imagem de menor**, retratos/likeness, restrições de conteúdo, divulgação de deepfake | direta |
| 8 | https://dev.pika.art/llms.txt | Catálogo da API Pika (modelos de Google/Alibaba/MiniMax/Kling revendidos; moderação de origem) | direta |
| 9 | https://lumalabs.ai/legal | Índice oficial de documentos legais do Luma | direta |
| 10 | https://lumalabs.ai/legal/terms-of-service | Luma ToS — idade 18+/13+, COPPA, uso comercial, Prohibited Data, §4.8, licença de treinamento | direta |
| 11 | https://lumalabs.ai/legal/enterprise-terms-of-service | Luma Enterprise — **No Train Guarantee**, AUP §2.5(b), Prohibited Data | direta |
| 12 | https://lumalabs.ai/legal/api-terms-of-use | Luma API Terms — §10 sem treinamento, §6.1 "Powered by Luma", §4.2 informar IA | direta |
| 13 | https://lumalabs.ai/legal/content-moderation-policy | Luma Content Moderation Policy — **sem menção a menores** | direta |
| 14 | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-terms-of-use-alibaba-cloud-international-website-terms-of-use | Alibaba ToU — §1.5 menores sob responsabilidade do responsável legal; §2.3 | direta |
| 15 | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-membership-agreement | Alibaba Membership Agreement — §3.2(e)(ii) *"harmful to minors"*; End Users; DPA/addenda | direta |
| 16 | https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0 | Alibaba Product Terms — §3 geral, §3.7 dado pessoal, §4.36 moderação, §4.43 voz, §4.44. **§4.45+ não lido** | direta + extrator de terceiro (ambos truncam em §4.44) |
| 17 | https://www.alibabacloud.com/help/en/model-studio/related-agreements | Índice oficial dos acordos do Model Studio | direta |
| 18 | https://www.alibabacloud.com/help/en/model-studio/open-source-model-terms | Licenças dos modelos de código aberto no Model Studio | direta |
| 19 | https://www.alibabacloud.com/help/en/cloud-config/latest/generated-ai-compliance-best-practices | Regras técnicas de conformidade de IA generativa (guardrails, criptografia) | direta |

**Fontes registradas como pendência (não lidas no corpo):**
- `https://www.alibabacloud.com/help/en/legal/latest/alibaba-cloud-international-website-product-terms-of-service-v-3-8-0`
  **§4.45 até o fim** — inclui a seção do Model Studio.
- `lumalabs.ai/aup` — **HTTP 404**; o AUP do Luma vive embutido em L1 §3.4/§4.7 e L2 §2.5(b).
- `dev.pika.art/terms` — **HTTP 404**; os termos da API estão em `/terms-of-service`.
- Acordos do site chinês da Alibaba (`百炼` / Bailian, `万相` / Wanxiang) — **deliberadamente não
  usados** como fonte (não governam o site internacional).

---

## 9. Handoff — Contrato de entrega

- **Status:** concluído. A lacuna do §1.2 do memo v2 ("termos de MiniMax, Pika, Luma e Alibaba/Wan
  quanto a público-alvo menor — **NÃO VERIFICADO**") está **fechada para três dos quatro** provedores
  e **reduzida a uma única seção** no quarto.
- **Entregáveis:** este documento (pt-BR), com uma tabela por provedor, veredito por provedor e os
  efeitos na D2.
- **Evidência:** §1 a §4 (citações literais com URL e data da página); §0.3 (limites de leitura
  declarados); §8 (fontes e mediação de cada leitura).
- **Decisões (propostas, não tomadas):** allow-list `provedor × finalidade × plano` com
  `MiniMax (Open Platform API)` e `Luma (API/Enterprise)` marcados `PERMITIDO`; `Pika` `PROIBIDO`;
  `Alibaba/Model Studio/Wan` `NÃO VERIFICADO` até a leitura de §4.45+; gate que **recusa upload de
  imagem que depicte ou aparente depictar menor** e que **chaveia a allow-list pelo modelo chamado,
  não pelo agregador**.
- **Riscos:** (i) fechar a D2 assumindo que silêncio contratual é autorização; (ii) tratar o agregador
  como se ele substituísse os termos do modelo de origem; (iii) escolher o tier errado (consumidor)
  e cair em treinamento com Inputs/Outputs — Luma e Pika treinam no tier de consumidor;
  (iv) fechar a D2 sem a leitura de §4.45+ do Alibaba e depois descobrir cláusula restritiva lá.
- **Humano deve assinar:** a interpretação dos itens do §7 (lacunas 3, 4, 5), a escolha dos dois
  provedores permitidos e o teto de custo da D2. **Nada aqui autoriza gerar mídia paga.**
- **Próximo:** (a) leitura em navegador de §4.45+ do Alibaba; (b) releitura em navegador do Open
  Platform ToS do MiniMax (leitura mediada); (c) refutação adversarial deste documento por
  `rebeca-qa` — em especial a conclusão de `PERMITIDO` para Luma e MiniMax **por ausência de
  cláusula**, e o `PROIBIDO` do Pika pelo eixo 2.
