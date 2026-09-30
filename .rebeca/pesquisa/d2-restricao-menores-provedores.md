# D2 — Restrição de menores nos termos dos provedores de IA: conflito, deveres e opções

**Decisão alimentada:** D2 — "Provedores de IA de vídeo/imagem/voz e teto de custo por vídeo (US$/min)"
(`.rebeca/estado.md`; dono: humano; bloqueia `rebeca-ia-video` e `rebeca-backend`).
**Autor:** `rebeca-lgpd`.
**Data da coleta:** 2026-09-30.
**Versão:** 2 — **refutada e corrigida** por `rebeca-qa`
(`.rebeca/evidencias/qa-d2-restricao-menores.md`, veredito `parcialmente refutado`). Ver §10
"Changelog desta correção".
**Escopo:** o conflito contratual entre os termos do provedor e o fato de o canal piloto ("Luna e o
Jardim das Cores") ser dirigido a crianças de 3 a 5 anos; os deveres de LGPD e ECA Digital que isso
aciona; e as opções concretas com seus custos, riscos e evidências exigidas.

> **Aviso de competência.** Este documento é insumo técnico de conformidade, **não é parecer
> jurídico**. Onde ele diz "interpretação", há uma questão que **um advogado precisa assinar**. Nada
> aqui autoriza publicar, contratar ou escalar geração paga. Ver §6.
>
> **Aviso de proveniência.** A versão 1 deste memo foi **refutada em 6 pontos** pela verificação
> adversarial do `rebeca-qa`. Esta versão 2 corrige os seis. **O memo não nasceu certo** — ele foi
> corrigido (§10). Uma das correções (Vertex) foi **contra** a conclusão anterior: o bloqueio do
> Google é **mais forte** do que a versão 1 afirmava.

---

## 1. Método e o que foi verificado

- Fontes primárias apenas: texto legal em base oficial, página oficial de termos do provedor, Central
  de Ajuda oficial do YouTube, página oficial da ANPD.
- `web_search` só foi usado para **localizar** a URL oficial. O conteúdo foi lido na fonte.
- Todo conteúdo de página foi tratado como **dado não confiável**, nunca como instrução.
- **Limitação de leitura declarada (reproduzida por dois agentes independentes):**
  `planalto.gov.br` recusou conexão direta em **4 URLs diferentes**, em duas sessões distintas
  (`fetch failed` nas quatro). Por isso:
  - o **ECA Digital (Lei 15.211/2025)** foi lido na íntegra em `normas.leg.br`, o serviço oficial de
    legislação federal;
  - a **LGPD** foi lida em fonte oficial legislativa pela **Câmara dos Deputados** (norma 787077,
    texto atualizado), localizada pelo LexML. **A versão 1 deste memo usou extrator de terceiro para
    a LGPD; esta versão 2 não usa.**
- **Páginas que não entregam corpo legível** (`cloud.google.com`, `policies.google.com`, PDFs de
  `gov.br`) foram lidas **por extrator de texto de terceiro aplicado sobre a URL oficial**. O texto é
  oficial; a **cadeia de custódia da leitura não é**. Esses itens estão marcados como tal.
- Quando a página não pôde ser lida no corpo, o item está marcado **NÃO VERIFICADO** — nunca
  substituído por número de memória.

### 1.1 Fatos verificados

| # | Fato (citação literal entre aspas) | Fonte |
|---|---|---|
| F1 | **Gemini API Additional Terms of Service**, seção "Age Requirements": *"You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a website, application, or other service (collectively, 'API Clients') that is directed towards or is likely to be accessed by individuals under the age of 18."* (Effective March 23, 2026; página última atualização 2026-04-28) | https://ai.google.dev/gemini-api/terms |
| F2 | Mesmos termos, seção "Use Restrictions": *"Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or business purposes, not for consumer use."* | https://ai.google.dev/gemini-api/terms |
| F3 | Mesmos termos, "Use of Generated Content": *"Google won't claim ownership over that content."* — não há cláusula que autorize uso em serviço dirigido a menores. | https://ai.google.dev/gemini-api/terms |
| F4 | Para os Gemini API **Paid Services**, o tratamento de prompts/respostas segue o *Data Processing Addendum for Products Where Google is a Data Processor*; mas os termos adicionais (F1/F2) continuam aplicáveis — o DPA é sobre dado pessoal, não sobre público-alvo. | https://ai.google.dev/gemini-api/terms |
| **F4-A** | **A MESMA RESTRIÇÃO EXISTE NO VERTEX, COM REDAÇÃO MAIS AMPLA.** *Google Cloud Service Specific Terms*, §20 "Generative AI Services" (anteriormente §19): **§20(d)** *"Age Restrictions. Customer will not, and will not allow End Users to, use a Generative AI Service as part of a website, **Customer Application, or other online service** that is directed towards or is likely to be accessed by individuals under the age of 18."* — **§20(f)** *"Suspected Violations. Google may immediately suspend or terminate Customer's use of a Generative AI Service based on any suspected violation of Section 17(b) or subsection (d) above."* — **§20(g)** *"Restrictions. The restrictions contained in subsections (d) and (e) above are deemed to be 'Restrictions' or 'Use Restrictions' under the applicable Agreement."* **Não há exceção** para uso parental, educacional ou familiar; **não há waiver** publicado. Verificação independente: `rebeca-qa` e o adendo `.rebeca/pesquisa/d2-adendo-vertex.md`, mais releitura própria nesta sessão. | https://cloud.google.com/terms/service-terms (§20(d)–(g); corpo obtido por extrator de terceiro sobre a página oficial) |
| **F4-B** | Os próprios *Gemini API Additional Terms* declaram: *"For clarity, these Terms do not govern your direct use of any Google Cloud Platform service (including those listed on the Google Cloud Services Summary)."* — ou seja, a cláusula da Gemini API **não governa** o Vertex; o que governa o Vertex é o §20(d) de F4-A. **A restrição acompanha o produto, não o endpoint.** | https://ai.google.dev/gemini-api/terms · https://cloud.google.com/terms/service-terms |
| F5 | O YouTube **obriga** o criador a declarar o público: *"Você precisa nos informar se os seus vídeos têm conteúdo para crianças"*; a configuração pode ser de canal inteiro ou por vídeo; *"o YouTube poderá configurar essa opção para você"*; declarar errado gera *"consequências jurídicas ou no YouTube"*, e há restrição de recursos e de publicidade personalizada quando o conteúdo é infantil. | https://support.google.com/youtube/answer/9527654?hl=pt-BR |
| F6 | Fatores oficiais do YouTube/FTC para "conteúdo para crianças": *"o tema do vídeo (por exemplo, conteúdo educativo para crianças em idade pré-escolar)"*, *"se o vídeo mostra personagens… infantis"*, *"se o vídeo contém músicas, histórias ou poemas para crianças"*. E: *"Vídeos para um 'público misto' são considerados um tipo de conteúdo para crianças."* A página diz também: *"não oferecemos aconselhamento legal… procure uma assessoria jurídica"*. | https://support.google.com/youtube/answer/9528076?hl=pt-BR |
| F7 | **LGPD, art. 14, caput:** *"O tratamento de dados pessoais de crianças e de adolescentes deverá ser realizado em seu melhor interesse, nos termos deste artigo e da legislação pertinente."* **§ 1º:** consentimento *"específico e em destaque dado por pelo menos um dos pais ou pelo responsável legal"* — **e o § 1º fala só de "crianças"**, enquanto o caput cobre "crianças e adolescentes". **§ 2º:** controlador deve manter pública a informação sobre tipos de dados, uso e procedimentos de direitos. **§ 3º:** dispensa de consentimento só para contatar os pais (uso único, sem armazenamento) ou para proteção da criança, vedado repasse a terceiro. **§ 4º:** vedado condicionar participação ao fornecimento de dados além do estritamente necessário. **§ 5º:** *"realizar todos os esforços razoáveis para verificar que o consentimento… foi dado pelo responsável pela criança"*. **§ 6º:** informação *"de maneira simples, clara e acessível"*. | https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html (localizado por https://www.lexml.gov.br/urn/urn:lex:br:federal:lei:2018-08-14;13709) |
| **F7-A** | **Existe uma Seção III-A (art. 14-A) na LGPD e ela está VETADA** pela Lei 15.134/2025 — a tentativa legislativa de acrescentar dispositivo de aferição etária à LGPD **não vingou**. | idem F7 |
| **F7-B** | **LGPD, art. 12, § 2º:** *"Poderão ser igualmente considerados como dados pessoais, para os fins desta Lei, aqueles utilizados para formação do perfil comportamental de determinada pessoa natural, se identificada."* — relevante para o "aprendizado" da camada Medir. | idem F7 |
| F8 | **LGPD, art. 5º VI:** *"controlador: pessoa natural ou jurídica, de direito público ou privado, a quem competem as decisões referentes ao tratamento de dados pessoais"*; **VII:** *"operador: pessoa natural ou jurídica, de direito público ou privado, que realiza o tratamento de dados pessoais em nome do controlador"*. **Art. 6º III:** *"necessidade: limitação do tratamento ao mínimo necessário…"*; **VI:** *"transparência: garantia, aos titulares, de informações claras, precisas e facilmente acessíveis…"*. **(art. 5º VI/VII e art. 6º III/VI agora lidos na letra em fonte oficial nesta versão — ver §10 item 7; o art. 46 continua NÃO VERIFICADO.)** | idem F7 |
| F8-A | **LGPD, art. 46** — medida de segurança desde a concepção. **NÃO VERIFICADO na letra**: não foi lido no texto oficial em nenhuma das duas sessões. | — (pendência) |
| F9 | **ECA Digital (Lei 15.211/2025), art. 1º:** aplica-se a *"todo produto ou serviço de tecnologia da informação direcionado a crianças e a adolescentes no País ou de acesso provável por eles, independentemente de sua localização"*, com o parágrafo único definindo "acesso provável" (probabilidade de uso e atratividade; facilidade de acesso; grau de risco). **Art. 2º, I:** produto ou serviço de TI é *"produto ou serviço fornecido a distância, por meio eletrônico e provido em virtude de requisição individual, tais como aplicações de internet, programas de computador, softwares, sistemas operacionais de terminais, lojas de aplicações de internet e jogos eletrônicos ou similares conectados à internet ou a outra rede de comunicações"*. **Art. 2º, IX:** serviço com controle editorial é *"aplicação de internet que tem como finalidade principal a disponibilização de conteúdos previamente selecionados, **sem o uso de meios automatizados de seleção**, por agente econômico responsável"*. **Art. 3º:** proteção prioritária, melhor interesse, nível elevado de privacidade e segurança. | https://normas.leg.br/api/public/binario/b434eb3c-9e75-41fb-a074-0bacf96bccec/texto |
| F10 | **ECA Digital, art. 9º e § 1º:** a verificação de idade **a cada acesso**, *"vedada a autodeclaração"*, é exigida de quem *"disponibilizarem conteúdo, produto ou serviço cuja oferta ou acesso seja impróprio, inadequado ou proibido para menores de 18"* — e o § 2º define impróprio/inadequado como *"material pornográfico, ou quaisquer outros vedados pela legislação vigente"*. A ANPD/MJSP confirmam a leitura restritiva: *"fornecedores de conteúdos, produtos ou serviços proibidos para crianças e adolescentes deverão adotar mecanismos confiáveis de verificação de idade"*. | idem F9 · https://www.gov.br/anpd/pt-br/assuntos/eca-digital (e Q&A oficial das ANPD/MJSP/Secom, lido por extrator) |
| F11 | **ECA Digital, art. 24 (CAPÍTULO IX):** *"No âmbito de seus serviços, os provedores de produtos ou serviços **direcionados a crianças e a adolescentes ou de acesso provável por eles** deverão garantir que usuários ou contas de crianças e de adolescentes de até 16 (dezesseis) anos de idade estejam vinculados ao usuário ou à conta de um de seus responsáveis legais."* O caput adota **a fórmula de público**; o § 1º fala em *"provedores de redes sociais"*. A ANPD/MJSP enquadram a vinculação como regra **"para usar redes sociais"**. **Art. 39, caput:** as obrigações dos arts. 6º, 17, 18, 19, 20, 27, 28, 29, 31, 32 e 40 são moduladas por características, funcionalidades, grau de interferência, número de usuários e porte. **§ 1º:** *"Os provedores dos serviços com controle editorial e os provedores de conteúdos protegidos por direitos autorais previamente licenciados de agente econômico responsável que não se confunda com usuário final **estarão dispensados do cumprimento das obrigações** previstas nos artigos referidos no caput deste artigo"*, desde que: I – observem a classificação indicativa; II – ofereçam transparência na classificação etária; III – disponibilizem mediação parental de acesso facilitado; IV – ofereçam canais de denúncia. **§ 2º:** obrigações aplicadas de forma proporcional à capacidade de influenciar conteúdos. **Art. 29, § 4º:** *"Não estarão sujeitos ao procedimento de retirada de que trata o caput deste artigo os conteúdos jornalísticos e os submetidos a controle editorial."* **Nota decisiva: o art. 8º NÃO está na lista do art. 39 — não é modulável nem dispensável.** | idem F9 |
| F12 | **ECA Digital, arts. 22 e 26:** vedação de perfilamento para direcionamento de publicidade comercial a crianças e adolescentes, inclusive a partir de *"dados grupais e coletivos"* e de dados obtidos na verificação de idade. **Art. 16, parágrafo único:** no tratamento de dados de crianças e adolescentes, o controlador deve mapear riscos e **elaborar relatório de impacto**. **Art. 31:** relatório semestral só acima de **1.000.000** de usuários menores no Brasil. **Art. 35, II:** *"multa simples, de até 10% (dez por cento) do faturamento do grupo econômico no Brasil no seu último exercício ou, **ausente o faturamento**, multa de R$ 10,00 (dez reais) até R$ 1.000,00 (mil reais) por usuário cadastrado do provedor sancionado, limitada, no total, a R$ 50.000.000,00 (cinquenta milhões de reais) por infração"*. As sanções dos incisos III e IV são aplicadas pelo Judiciário (art. 35, § 5º). | idem F9 |
| F13 | **ECA Digital em vigor desde 17/03/2026.** ANPD é a autoridade competente (Decreto 12.622/2025); ANPD virou agência reguladora pela Lei 15.352/2026; Decreto 12.880/2026 detalha a proteção e institui a Política Nacional; Decreto 12.881/2026 definiu a nova estrutura da ANPD. **Fiscalização:** Etapa I (lojas de apps e sistemas operacionais, desde março/2026); Etapa II (outros setores) a partir de agosto/2026, com **período de adaptação até novembro/2026**; **atualização dos Regulamentos de Fiscalização e Aplicação de Sanções a partir de novembro/2026**; **ações de fiscalização a partir de janeiro/2027**. | https://www.gov.br/anpd/pt-br/assuntos/eca-digital |
| F14 | Ordenamento vigente já contempla o caso: parâmetros preliminares da ANPD para **aferição de idade** e um Guia de escopo/obrigações gerais do ECA Digital em tomada de subsídios. | idem F13 |
| F15 | **Runway, Usage Policy** (última atualização 2026-03-06). Há **duas** frentes sobre menores, e elas não se confundem: **(i) seção geral "Children's Safety"**, que veda conteúdo que *"depicts, facilitates, or promotes child sexual abuse or the sexualization of children"*, *"minor grooming, including generating content designed to impersonate a minor"* e *"child abuse or minor participation in harmful or dangerous acts"*, e diz que aplica *"a stricter standard for potential harmful and inappropriate content… when a child is depicted"*; **(ii) "Additional Character & Game Worlds Policies"**, que proíbe, *"in these products"*, *"Characters or games that are intended to engage users under the age of 18, including narrative elements or visual styles intended for children"* e *"Characters based on the face or voice of a person under the age of 18"*. **A vedação de público-alvo infantil é dos produtos Characters & Game Worlds, não do gerador de vídeo** — e nenhuma das proibições gerais alcança um canal infantil educativo. | https://runway.com/safety/usage-policy |
| F16 | **Runway, Enterprise Services Terms** (2026-06-01): há **DPA** incorporado; Runway *"may not use Customer Content as training data"*; o Cliente responde pelos Inputs e por avaliar a legalidade dos Outputs. **Não há cláusula sobre direcionamento a menores.** Pontos de atenção contratual: §11.1 permite que a Runway use nome e logo do cliente como referência comercial; e os **Terms of Use** §1 exigem que aplicações de usuário final exibam *"Powered by Runway"*. **Ressalva que muda o peso da opção (a):** os Terms of Use **de consumidor** dizem o oposto em §4.4 — *"Inputs and Outputs may be used by the Company to train and improve its AI models"* — e trazem idade mínima de **13 anos**, com permissão dos pais para menores de 18 (§2.2). Ou seja: **"não treina com Customer Content" e "13+" só valem no contrato Enterprise.** | https://runway.com/enterprise-terms · https://runway.com/terms-of-use |
| F17 | **OpenAI Services Agreement** (business/API, Effective 2026-01-01): não veda conteúdo dirigido a menores; a §3.3 restringe apenas *"allow minors to use OpenAI Services without consent from their parent or guardian"*. Há DPA, *"OpenAI will not use Customer Content to develop or improve the Services, unless Customer explicitly agrees"*, e §10 **No Publicity**. As Usage Policies incorporadas também não vedam conteúdo dirigido a menores. | https://openai.com/policies/business-terms/ (via extrator; fetch direto HTTP 403) |
| F18 | **OpenAI Sora 2 / Videos API foi encerrada em 24/09/2026** e não tem substituta 1:1 — logo, a OpenAI não é candidata a vídeo hoje (dossiê `d2-provedores-ia-midia.md` §6.3). | https://developers.openai.com/api/docs/models/sora-2.md |
| F19 | **ElevenLabs ToS** (2026-03-31), §1(a): *"If you are under 18 years of age (or the age of legal majority where you live), you may not use our Services"*; §1(c): uso gratuito só não comercial, uso comercial exige plano pago; há **DPA**. A Prohibited Use Policy incorporada alcança *"material that targets minors **and promotes** sexual material, graphic violence, obscenity, or other mature themes"* — **não** veda conteúdo dirigido a crianças. A restrição é sobre **quem opera a conta**, não sobre o público do conteúdo. | https://elevenlabs.io/terms-of-use · https://elevenlabs.io/use-policy |

### 1.2 O que segue NÃO VERIFICADO

| Item | Por que |
|---|---|
| **LGPD art. 46** | Não lido na letra em nenhuma das sessões. Não promover sem fonte. |
| **LGPD arts. 37, 38 e 5º XVII** (ROPA e RIPD) | Citados no §3.2 por dever de ofício; **não lidos na letra**. Tratar como pendência, não como citação. |
| **Art. 47 do Decreto 12.880/2026** (avaliação de impacto de riscos à segurança e à saúde) | Citado nominalmente pela ANPD/MJSP, mas **o texto do artigo não foi lido na letra** nesta sessão. O RIPD do art. 16, parágrafo único, do ECA Digital **está** verificado e é suficiente como base do dever; o art. 47 entra como referência a conferir. |
| **PDFs oficiais da ANPD** (Q&A do ECA Digital, orientações preliminares de aferição de idade, Radar Tecnológico) | O `web_fetch` direto recusa `application/pdf`; o conteúdo veio **por extrator de terceiro** sobre PDF oficial. O texto é oficial; **a cadeia de custódia da leitura não é**. Reverificar à mão antes de virar cláusula. |
| **Cláusula §20(d) do GCP** | Lida **por renderizador de terceiro** sobre `cloud.google.com/terms/service-terms` (a página é JS-rendered e não entrega corpo ao fetch direto). O trecho é inequívoco e foi conferido duas vezes, mas a mediação é de terceiro. **Reler em navegador antes de virar base de decisão jurídica.** |
| Termos e política de uso da **MiniMax** | `platform.minimax.io/protocol/terms-of-service` respondeu HTTP 200 mas com **corpo não legível**. Sem leitura, não se afirma que permite (nem que proíbe) conteúdo dirigido a menores. |
| Termos da **Pika**, **Luma**, **Kling**, **Alibaba/Wan**, **Amazon Bedrock/Nova** quanto a público-alvo menor | Não lidos. Kling já está bloqueada por outro motivo (conflito de uso comercial — dossiê D2 §6.6 item 5). |
| **Google Cloud Acceptable Use Policy** | URL tentada devolveu HTTP 404. A AUP é incorporada pelo §20(c); não foi lida. Não muda a conclusão sobre a age restriction, que é dispositivo separado (§20(d)). |
| Se o YouTube **entrega** ao Rebeca dado pessoal de espectador menor (comentários, dados de audiência identificáveis) | Depende de quais relatórios/escopos serão usados; não verificado neste memo. Ver §4, item 2. |
| Se a **Kling/MiniMax/Alibaba** aceitam contrato negociado para público infantil | Depende de negociação; não verificável por leitura de página. |

---

## 2. O conflito, mapeado com precisão

### 2.1 O que a cláusula proíbe

Literalmente: **o desenvolvedor** (pessoa) não pode usar a API **como parte de** uma aplicação ou
**outro serviço** — os "API Clients" — que **seja dirigido a**, **ou provavelmente acessado por**,
pessoas **menores de 18 anos**. A proibição tem dois verbos distintos: (i) *"directed towards"* e
(ii) *"likely to be accessed by"*. A segunda é mais ampla que a primeira e captura serviço cujo
público-alvo declarado é outro, mas que crianças acessam na prática.

**E a cláusula não tem saída pelo Google Cloud.** O §20(d) do GCP repete a restrição trocando "API
Clients" por *"Customer Application, or other online service"*, com suspensão por suspeita (§20(f)) e
classificação expressa como "Use Restrictions" (§20(g)). **A troca de Google AI Studio/Gemini API por
Vertex AI não muda a política — muda o documento** (F4-A, F4-B).

### 2.2 O que o Rebeca faz

O Rebeca é um **sistema operacional de canais**: ele **gera conteúdo** (imagem, vídeo, voz, música) e
**opera o canal** (agenda, publica, mede). O canal piloto "Luna e o Jardim das Cores" é uma
animação infantil educativa dirigida **explicitamente** a crianças de 3 a 5 anos — personagens
infantis, histórias, músicas, tema pré-escolar: exatamente os fatores que o YouTube/FTC usam para
caracterizar "conteúdo para crianças" (F6) e que o YouTube **obriga** a declarar (F5).

### 2.3 As três figuras que não podem ser confundidas

| Figura | Quem é, no caso Rebeca | O que a cláusula diz sobre ela |
|---|---|---|
| **(a) O operador** | Pessoa natural adulta, profissional, dona do negócio, usando a API para fins comerciais | **Não resolve o problema.** O requisito *"must be 18 years of age or older"* é satisfeito por ele — mas é uma frase **separada** da proibição seguinte. Cumprir a idade do desenvolvedor **não** libera o serviço dirigido a menores. |
| **(b) O "API Client" / "Customer Application"** | É o **serviço que usa a API como parte de si**. Duas leituras possíveis: (b1) o **software Rebeca** (ferramenta profissional de uso interno, cujos operadores são adultos) — que **não** é dirigido a menores; ou (b2) o **canal publicado no YouTube**, cuja razão de existir é ser assistido por crianças de 3 a 5 anos. A cláusula da Gemini fala de *"website, application, **or other service**"*; a do GCP fala de *"website, **Customer Application**, or other online service"*. As duas expressões dão força à leitura (b2). | **Ponto de virada da análise.** A frase *"use the Services **as part of**"* também empurra para (b2): o conteúdo Gemini é usado **como parte** do canal. A leitura (b1) exige sustentar que o canal de destino é irrelevante para o contrato — argumento que só um advogado pode assumir. |
| **(c) Os "users" / "End Users"** | Quem a cláusula protege: *"individuals under the age of 18"*. No caso Rebeca, os **usuários do API Client (b2)** são as crianças que assistem — não o dono. Já os **usuários do software Rebeca (b1)** são adultos. | **É aqui que a ambiguidade se resolve na prática:** a palavra "users" aponta para o público do serviço, não para quem opera a conta de API. Nota: a skill `lgpd-eca-digital-minors` usa "usuário" no sentido de conta/operador — os dois sentidos convivem no mesmo problema e precisam ser separados por escrito. **O §20(d) do GCP reforça a leitura (b2)**, porque lá o texto diz "Customer Application" e "other online service" em vez de "API Client". |

### 2.4 Por que a leitura **não está assentada**

1. Nenhum dos dois documentos (Gemini, GCP) define "API Client"/"Customer Application" de modo que se
   decida se o canal de destino conta — os textos apenas listam as expressões.
2. O contexto do F2 (*"professional or business purposes, not for consumer use"*) sugere que a
   preocupação do Google é o **consumidor final**, o que **favorece** a leitura restritiva (b2): o
   público infantil é o consumidor final do produto que embute a API.
3. **Nenhuma** das páginas lidas registra exceção, waiver, ou processo de aprovação para uso com
   público menor. A *Generative AI Prohibited Use Policy* menciona exceções *"based on educational,
   documentary, scientific, or artistic considerations"* — mas essa exceção é das **Prohibited Use
   Policies**, não da cláusula de idade, que vive em dispositivo próprio ("Age Requirements" na
   Gemini; §20(d) no GCP). **A brecha textual plausível foi testada e não alcança a cláusula.**
4. Do outro lado, o Rebeca **não expõe a API ao público**: a API é consumida por backend adulto. Isso
   é um argumento **real**, mas é de **interpretação contratual**, não de fato — e por isso vai para
   o §6 (advogado), **não** para uma decisão de engenharia.

### 2.5 Consequência prática da incerteza

A incerteza não é neutra: operar na leitura (b1) e estar errado significa (i) violação contratual com
o Google, com **suspensão imediata por suspeita** (§20(f)) e perda do histórico de geração, e (ii)
**nenhuma** defesa de boa-fé se a leitura correta for (b2), porque o canal é declaradamente infantil.
O custo do erro é assimétrico: alto, sem caminho alternativo dentro do Google e difícil de reverter.

---

## 3. Deveres de LGPD e ECA Digital acionados

Cada linha diz **o que aciona** e **o que a norma exige**. Onde a aplicação depende de fato que o
Rebeca ainda não tem, está dito.

### 3.1 ECA Digital (Lei 15.211/2025) — mapa completo do que incide

> **Correção da versão 2.** A versão 1 desta seção era **materialmente incompleta**: apresentava como
> fechada uma lista de incidência que omitia **treze dispositivos** e a avaliação de impacto do
> Decreto, e errava a justificativa de dois artigos. O mapa abaixo parte da mesma fórmula de incidência
> do art. 1º (*"direcionado a crianças e a adolescentes ou de acesso provável por eles"*) e segue os
> capítulos na ordem da lei. **O Rebeca cai no ECA Digital por dois caminhos distintos, que não podem
> ser misturados:** (A) **como fornecedor de produto/serviço de TI** — o software, cujos operadores são
> adultos; e (B) **pelo conteúdo que opera** — o canal Luna, que é dirigido a crianças. Onde o dever é
> claramente do canal (B) e não do software (A), está dito; onde a repartição é interpretativa, está
> dito que é interpretativa.

| Dispositivo | Status | O que exige do Rebeca |
|---|---|---|
| **Art. 1º e parágrafo único** — âmbito | **INCIDE** (caminho B, e potencialmente A) | Tratar Luna como escopo do ECA Digital. Levantar por escrito se o **próprio software Rebeca** é "produto ou serviço de TI" do art. 2º, I — questão interpretativa legítima (o art. 2º, I fala de serviço *"fornecido a distância… em virtude de requisição individual"*), que hoje **não está resolvida** e precisa de parecer. |
| **Art. 2º, I e IX** — definições | **INCIDE como enquadramento** | Não é dever, é critério: (I) define o que é produto/serviço de TI; (IX) define **"serviço com controle editorial"** como aquele que disponibiliza *"conteúdos previamente selecionados, **sem o uso de meios automatizados de seleção**"*. Os dois critérios governam as dispensas do art. 39 (§ abaixo). |
| **Art. 3º** — melhor interesse e proteção prioritária | **INCIDE** | Toda decisão do pipeline deve ser justificável pelo melhor interesse da criança — inclusive a escolha de provedor e o teto de custo. |
| **Art. 4º** — fundamentos | **INCIDE como princípio** | Inclui *"proteção contra a exploração comercial"* (VI) e *"transparência e responsabilidade no tratamento de dados"* (IX). Orienta a redação da política e o desenho do produto. |
| **Art. 5º, caput e § 1º** — deveres de prevenção/proteção/informação/segurança | **INCIDE** | § 1º: *"adotar as medidas técnicas adequadas, inclusive mecanismos de segurança amplamente reconhecidos, que possibilitem à família e aos responsáveis legais prevenir o acesso e o uso inadequado por crianças e adolescentes"*. No Rebeca: controles de acesso do operador, segregação por canal e trilha de auditoria — e o compromisso de **não** publicar sem aprovação humana (invariante 1). |
| **Art. 6º** — medidas desde a concepção contra conteúdos/práticas dos incisos I–VI | **INCIDE** | *"tomar medidas razoáveis desde a concepção e ao longo da operação"* para prevenir exposição a: exploração/abuso sexual; violência e assédio; indução a dano à saúde; jogos de azar, álcool, tabaco; **práticas publicitárias predatórias, injustas ou enganosas**; conteúdo pornográfico. No Rebeca: o gate de conteúdo do `rebeca-infantil` + `rebeca-lgpd` antes da aprovação humana é a implementação deste dever; o § 1º ainda responsabiliza *"as pessoas que se beneficiam financeiramente da produção ou distribuição pública de qualquer representação visual de criança ou de adolescente"* — **o dono do canal entra nessa frase.** |
| **Art. 7º** — privacidade **by default** no modelo mais protetivo | **INCIDE** | *"garantir, por padrão, a configuração no modelo mais protetivo disponível em relação à privacidade e à proteção de dados pessoais"*. Consequência de engenharia: **padrão privado**, coleta mínima, sem telemetria de audiência por default. |
| **Art. 8º, I–V** — gerenciamento de risco, classificação etária, bloqueio de conteúdo inadequado e **uso compulsivo** | **INCIDE — e NÃO é modulável nem dispensável** | **(I)** gerenciamento de riscos de recursos, funcionalidades e sistemas; **(II)** *"realizar avaliação do conteúdo disponibilizado para crianças e adolescentes de acordo com a faixa etária, para que seja compatível com a respectiva classificação indicativa"*; **(III)** *"oferecer sistemas e processos projetados para impedir que crianças e adolescentes encontrem… conteúdos manifestamente inadequados à sua faixa etária"*; **(IV)** *"desenvolver desde a concepção e adotar por padrão configurações que evitem o uso compulsivo"* — bate direto num canal infantil com autoplay e maratona de episódios; **(V)** *"informar extensivamente a todos os usuários sobre a faixa etária indicada para o produto ou serviço **no momento do acesso**"*. **Crucial:** o art. 8º **não está** na lista de modulação do art. 39 — não é modulável por porte **nem** alcançado pela dispensa do § 1º. Quem exatamente cumpre (II), (III) e (V) — o canal ou a plataforma de vídeo — é **questão interpretativa em aberto** (§6.1). |
| **Art. 9º, caput e §§ 1º–3º** — verificação de idade a cada acesso, vedada autodeclaração | **NÃO incide pelo Rebeca** | O gatilho do caput é *"conteúdo, produto ou serviço cuja oferta ou acesso seja impróprio, inadequado ou proibido para menores de 18"*, e o § 2º fecha: *"material pornográfico, ou quaisquer outros vedados pela legislação vigente"*. A Luna **não** é isso. A ANPD/MJSP confirmam: a aferição recai sobre *"fornecedores de conteúdos, produtos ou serviços **proibidos** para crianças e adolescentes"*. Os arts. 12–14 (CAPÍTULO IV) dirigem-se a **lojas de aplicações e sistemas operacionais** (art. 12) e a quem **recebe** o sinal de idade (art. 14) — nenhum alcança quem publica conteúdo infantil. **Mas:** se o Rebeca passar a operar conteúdo restrito a 18, a obrigação nasce. |
| **Art. 10** — experiências adequadas à idade | **INCIDE** | *"adotar mecanismos para proporcionar experiências adequadas à idade"*, respeitada a autonomia progressiva. No Rebeca: idioma, ritmo e vocabulário validados por `rebeca-infantil` como critério de aceite, não como preferência estética. |
| **Art. 14, parágrafo único** — mecanismos próprios | **INCIDE** | *"Independentemente das medidas adotadas pelos sistemas operacionais e pelas lojas de aplicações, os fornecedores… deverão implementar mecanismos próprios para impedir o acesso indevido de crianças e de adolescentes a conteúdos inadequados para sua faixa etária"*. Não dá para terceirizar a proteção para a plataforma. |
| **Art. 16, caput** — informação sobre riscos e medidas de segurança | **INCIDE** | Disponibilizar a pais, responsáveis, crianças e adolescentes, *"com acesso de forma independente da aquisição do produto, informações sobre os riscos e as medidas de segurança adotadas para esse público, incluídas a privacidade e a proteção de dados"*. |
| **Art. 16, parágrafo único** — RIPD | **INCIDE se houver tratamento de dado de criança/adolescente** | Mapear riscos e *"elaborar relatório de impacto, de monitoramento e de avaliação da proteção de dados pessoais"*. É a base verificada do dever de RIPD (a ANPD cita, junto, o art. 38 da LGPD). |
| **Art. 17, I–IV** — ferramentas de supervisão parental | **INCIDE** | Disponibilizar *"configurações e ferramentas acessíveis e fáceis de usar que apoiem a supervisão parental"*, informar onde estão, exibir aviso quando estiverem em vigor, e — **(IV)** — *"oferecer funcionalidades que permitam limitar e monitorar o tempo de uso"*. O § 4º fixa o padrão no **mais alto nível de proteção** (restrição de comunicação, limitação de recursos que estendam o uso, controle de recomendação, restrição de geolocalização). A ANPD/MJSP descrevem isso como valendo para *"todos os serviços para crianças e adolescentes conectados à internet"*. **Observação de repartição:** essas ferramentas pressupõem **conta de criança** no serviço; o Rebeca hoje não tem. Onde elas vivem (no app do Rebeca, no YouTube, ou em nenhum) é decisão de produto **e** de interpretação — §6.1. |
| **Art. 18** — o que as ferramentas parentais devem permitir | **INCIDE** | Contas e privacidade, restrição de compras, identificar perfis de adultos, métricas de tempo de uso, ativar/desativar salvaguardas, **informações e opções de controle em língua portuguesa**. |
| **Arts. 22 e 26** — vedação de perfilamento publicitário de menores | **INCIDE por risco, não por desenho atual** | O Rebeca é desenhado para *aprender* com a audiência e recomendar conteúdo. Se esse aprendizado gerar perfis comportamentais de espectadores menores — inclusive a partir de **dados grupais e coletivos** — o art. 26 é atingido. Somado ao **art. 12, § 2º, da LGPD** (perfil comportamental de pessoa identificada é dado pessoal), isso é o risco mais provável de materializar em código. |
| **Art. 24** — vinculação a responsável (até 16) | **NÃO incide hoje — pela razão certa** | O caput **adota a fórmula de público** (*"provedores de produtos ou serviços direcionados a crianças e a adolescentes ou de acesso provável por eles"*), então **não** se pode dizer que o critério é "usuário/conta e não público" — a versão 1 deste memo disse isso e estava errado. A razão correta é dupla: (i) o dispositivo está no **CAPÍTULO IX — DAS REDES SOCIAIS**, e o § 1º fala expressamente em *"provedores de redes sociais"*; (ii) a ANPD/MJSP enquadram a vinculação como regra **"para usar redes sociais"**, e o Rebeca/Luna não é rede social. **Se o Rebeca ganhar conta de menor (D3), a obrigação nasce.** |
| **Art. 28** — mecanismos de notificação de violações | **INCIDE** | *"disponibilizar aos usuários mecanismos de notificações acerca de violações aos direitos de crianças e de adolescentes"*, e oficiar autoridades quando for o caso. |
| **Art. 29** — retirada de conteúdo violador | **INCIDE** | Retirada *"independentemente de ordem judicial"* mediante notificação fundamentada (o § 2º veda denúncia anônima e exige identificação técnica). **Art. 29, § 4º:** os conteúdos *"submetidos a controle editorial"* **não** estão sujeitos a esse procedimento — dispositivo que a versão 1 não citou e que interage com o art. 39. |
| **Art. 33** — uso abusivo dos instrumentos de denúncia | **INCIDE** | Informações claras sobre hipóteses de uso indevido e sanções, com procedimento objetivo, contraditório e recurso. |
| **Art. 39, caput e §§ 1º–3º** — modulação **e dispensa** | **INCIDE — nos dois sentidos** | **Caput:** as obrigações dos arts. 6º, 17, 18, 19, 20, 27, 28, 29, 31, 32 e 40 são **moduladas** por características, funcionalidades, grau de interferência, número de usuários e porte. **§ 1º — e a versão 1 deste memo escreveu o oposto:** provedores de **serviços com controle editorial** *"**estarão dispensados do cumprimento das obrigações** previstas nos artigos referidos no caput"*, cumpridas as quatro condições (classificação indicativa; transparência da classificação etária; mediação parental de acesso facilitado; canal de denúncias). **Análise honesta, nos dois lados:** (a) **a favor** — o canal Luna é conteúdo **pré-selecionado** e passa por **revisão e aprovação humana** antes de publicar (invariante 1 do `AGENTS.md`), o que aproxima o canal da definição do art. 2º, IX; (b) **contra** — o Rebeca **usa IA para selecionar e priorizar** pauta, tema e formato, e o art. 2º, IX exige *"**sem** o uso de meios automatizados de seleção"*. Se a IA do Rebeca escolhe o que produzir, a qualificação como "serviço com controle editorial" pode **falhar** — e com ela a dispensa. **Em nenhum cenário o art. 8º é alcançado pela dispensa**, porque não está na lista. **A qualificação é decisão de advogado (§6.1) e muda materialmente o custo de conformidade.** |
| **Art. 40** — representante legal no País | **NÃO incide hoje** | Obrigação dos fornecedores do art. 1º; se o Rebeca for operado por pessoa/empresa **no Brasil**, a figura é inaplicável. Se o fornecedor for estrangeiro, incide. Registrado porque é a única linha do mapa que o domicílio resolve sozinho. |
| **Art. 31** — relatório semestral | **NÃO incide** | Gatilho é **> 1.000.000** de usuários menores registrados no Brasil. Registrar a avaliação de não aplicabilidade com a fonte. |
| **Art. 35, II** — sanções | **Exposição conhecida** | Multa de até 10% do faturamento do grupo no Brasil no último exercício **ou, ausente o faturamento**, R$ 10 a R$ 1.000 por usuário cadastrado, **limitada a R$ 50 mi por infração**. Num serviço **com** faturamento, a régua aplicável é a do **percentual** — a alternativa por usuário é reservada a quem não tem faturamento. Suspensão e proibição de atividade são aplicadas pelo **Judiciário** (art. 35, § 5º). |
| **Decreto 12.880/2026, art. 47** — avaliação de impacto de riscos à segurança e à saúde | **`NÃO VERIFICADO` na letra** (citado pela ANPD) | A ANPD/MJSP o apontam como *"instrumento relevante à avaliação de proporcionalidade das soluções adotadas"*, ao lado do art. 16, parágrafo único, do ECA Digital e do art. 38 da LGPD. **O texto do artigo não foi lido** nesta sessão; entra como referência a conferir, não como citação. |

**Conclusão corrigida do ECA Digital.** O ECA Digital **incide sobre o canal** (público infantil) e
também sobre o **produto Rebeca**, por caminhos diferentes, e impõe: proteção reforçada e by default
(arts. 3º, 7º), gerenciamento de risco e classificação etária (art. 8º, **não modulável**), medida
técnica própria contra conteúdo inadequado (art. 14, parágrafo único), informação a famílias (art. 16,
caput), RIPD (art. 16, parágrafo único), supervisão parental (arts. 17 e 18), vedação de perfilamento
(arts. 22 e 26), notificação e retirada (arts. 28, 29 e 33) — tudo isso **modulado ou dispensado** pelo
art. 39 conforme o porte e conforme a qualificação (ou não) como serviço com controle editorial.
**Art. 8º fica fora dessa modulação e dessa dispensa.** Continua **não** incidindo, no desenho atual:
verificação de idade (art. 9º), vinculação a responsável (art. 24, matéria de redes sociais),
relatório semestral (art. 31) e representante legal (art. 40). A repartição de quem cumpre o quê entre
**canal** e **software** — em especial nos arts. 8º, 14 e 17 — é **questão interpretativa em aberto**.

### 3.2 LGPD (Lei 13.709/2018) — o que incide

| Dispositivo | Status | O que exige |
|---|---|---|
| Art. 5º VI e VII — controlador/operador | **INCIDE** (lido na letra) | Qualificar por escrito: o **dono do canal/Rebeca** é controlador; **cada provedor de IA** é operador; o **YouTube** tem papel próprio (não é operador do Rebeca). Isso define quem responde e com quem se assina DPA. |
| Art. 6º III e VI — necessidade e transparência | **INCIDE** (lido na letra) | Coletar o mínimo; informar de forma clara e acessível. |
| Art. 14, caput e §§ 1º a 6º — melhor interesse e consentimento parental | **Só incide se o Rebeca tratar dado pessoal de criança.** O conteúdo da Luna é ficção: personagens animados **não** são dado pessoal de criança. **O gatilho real** é a camada Medir: se o Rebeca armazenar ou tratar dado pessoal de espectador menor (comentário, identificador, dado de audiência que permita reidentificar), o art. 14 passa a exigir consentimento específico e em destaque do responsável, esforços razoáveis de verificação (§ 5º) e informação clara e acessível (§ 6º) — e **esse consentimento não é fabricável retroativamente**. **Precisão de faixa etária:** o **§ 1º fala só de "crianças"** (no ECA, art. 2º, até 12 anos incompletos); o **caput** cobre crianças e adolescentes. Se a camada Medir capturar dado de **adolescente (13–17)**, o regime **não** é o do § 1º — é o do caput (melhor interesse) sem a exigência de consentimento parental. | Duas providências: (i) validar em `.lgpd/data-map.md` se algum dado de espectador entra no Rebeca; (ii) enquanto não validado, tratar analytics de audiência como **não pessoal por prova**, nunca por presunção. |
| Art. 12, § 2º — perfil comportamental | **INCIDE por risco** | Dado usado para formar perfil comportamental de pessoa identificada **é dado pessoal**. Fecha a porta para "agregado que na prática individualiza". |
| Art. 46 — segurança desde a concepção | **`NÃO VERIFICADO` na letra** | Dever geral de medidas de segurança. Citado por dever de ofício; o texto não foi lido. **Pendência.** |
| Arts. 37 e 38 e art. 5º XVII — ROPA e RIPD | **`NÃO VERIFICADO` na letra** | Deveres de registro e de relatório de impacto. Recomendados por IA + menores (alto risco), mas **as citações precisam ser conferidas** antes de virarem afirmação. |
| Art. 39 — DPA com operador; art. 42 — responsabilidade solidária | **INCIDE por provedor** (`NÃO VERIFICADO` na letra) | Ficha em `.lgpd/vendors/` por provedor; DPA antes de mandar dado pessoal. **Observação central: DPA não resolve conflito de público-alvo** — são eixos diferentes. Um provedor pode ter DPA perfeito e ainda proibir conteúdo para menores. |
| Art. 48 — incidente | **`NÃO VERIFICADO` na letra** | Runbook e prazo de comunicação (ver `lgpd-incident-response`); não entra no escopo desta decisão. |
| Art. 14-A (Seção III-A) | **VETADO** (Lei 15.134/2025) | Houve tentativa de acrescentar aferição etária à LGPD e ela **não vingou** — dado que **reforça** a leitura de que a aferição de idade não é dever geral de quem publica conteúdo infantil. |

### 3.3 O cruzamento que importa

O que **bloqueia a D2** não é proteção de dados — é **contrato de fornecedor** (F1, F4-A). O que a
LGPD e o ECA Digital impõem é **proteção reforçada do público**, RIPD, não perfilamento e trilha de
evidência. Confundir os dois leva a duas decisões erradas: (i) achar que um DPA resolve o bloqueio (não
resolve); (ii) achar que, trocando de provedor, a conformidade com menores está resolvida (não está —
o dever de proteção é do Rebeca/canal, independentemente do provedor).

---

## 4. Questões abertas que mudam a resposta

1. **D3 (modelo de acesso):** se o Rebeca ganhar tier gratuito ou multiusuário aberto, entram
   usuários menores? Se sim, art. 24 do ECA Digital e verificação de idade passam a incidir.
2. **Escopos do YouTube Analytics:** algum relatório entrega dado de espectador identificável ou
   reidentificável? Define se o art. 14 da LGPD incide sobre a camada Medir — e o art. 12, § 2º,
   torna essa porta mais estreita do que a versão 1 deste memo sugeria.
3. **~~Vertex AI / Gemini Enterprise~~ — RESPONDIDA, E CONTRA.** A versão 1 deixou esta como "a
   pergunta que decide se a opção (a) pode manter o Veo no pipeline da Luna". **A resposta é não:** o
   §20(d) do GCP contém a mesma restrição, com redação **mais ampla** (*"Customer Application, or
   other online service"*), suspensão por suspeita (§20(f)) e sem exceção publicada. Ver F4-A.
4. **Rebeca é ferramenta interna ou produto para terceiros?** Se for vendida a terceiros que operam
   canais infantis, o número de "API Clients"/"Customer Applications" dirigidos a menores cresce e a
   exposição cresce junto.
5. **O Rebeca/Luna se qualifica como "serviço com controle editorial" (art. 2º, IX)?** Decide se a
   **dispensa** do art. 39, § 1º, alcança as obrigações dos arts. 6º, 17, 18, 28, 29, 31, 32 e 40 — ou
   se o uso de IA para selecionar conteúdo descaracteriza o requisito *"sem o uso de meios
   automatizados de seleção"*. Não afeta o art. 8º, que está fora da lista em qualquer cenário.
6. **Quem cumpre os arts. 8º, 14 e 17 — o canal ou a plataforma de vídeo?** O ECA Digital não resolve a
   repartição entre quem produz o conteúdo e quem o distribui.

---

## 5. Opções concretas, com trade-offs

> Nenhuma opção abaixo está "recomendada" por este agente para a Luna **em produção**. A escolha é do
> humano (D2), com o §6 assinado.

### (a) Restringir o pipeline a provedores cujos termos permitam serviço dirigido a menores

**O que é:** allow-list por provedor **e por finalidade**; o roteador de provedores recusa chamada
quando `canal.publicoAlvo` for menor e o provedor não estiver na allow-list.

| Dimensão | Avaliação |
|---|---|
| **Custo** | Custo de engenharia **baixo** (a abstração de provedor já é invariante 7; é configuração + gate). Custo de mídia pode **subir** conforme o substituto — e isso alimenta o teto da D2. |
| **Risco** | Não elimina risco legal de LGPD/ECA (que é do Rebeca), mas remove o **risco contratual** mais agudo. Risco residual: escolher substituto cujos termos **não foram lidos** — hoje é o caso de MiniMax, Pika, Luma, Alibaba (NÃO VERIFICADO). |
| **Evidência exigida** | Termos do substituto **citados literalmente**, com URL e data de leitura; cláusula de uso comercial; **ausência** de vedação de público-alvo menor; DPA; **distinção explícita entre plano enterprise e plano de consumidor** (a Runway muda as duas coisas entre eles, F16); ficha em `.lgpd/vendors/`; registro do gate em teste automatizado. |
| **O que hoje se sabe — e o que NÃO se sabe** | **Google está fora, por qualquer via** (F1 e F4-A): Developer API, Vertex e Gemini Enterprise. **Runway Enterprise** é o candidato com material lido mais favorável (F15/F16: veda personagens/games para menores **não** o gerador de vídeo; tem DPA; não treina com Customer Content) — **mas** os Terms of Use de consumidor treinam com Inputs/Outputs (§4.4) e aceitam 13+, então **"Enterprise" é condição, não preferência**; e há a exigência de *"Powered by Runway"* na aplicação de usuário final. **ElevenLabs** (voz) restringe a idade de **quem opera** (18+), o que o Rebeca satisfaz, e sua Prohibited Use Policy não veda público infantil — precisa de confirmação por escrito. **OpenAI** não veda público menor, mas **não tem API de vídeo** (F18). |
| **Bloqueio honesto** | A allow-list **não pode ser fechada hoje** para vídeo: os termos de MiniMax, Pika, Luma e Alibaba quanto a público-alvo menor seguem `NÃO VERIFICADO`. Fechar a D2 sem isso é escolher no escuro. |

### (b) Pedir permissão escrita / acordo empresarial ao provedor

**O que é:** contato comercial com o provedor buscando exceção formal, aditivo ou contrato enterprise
que autorize expressamente produzir conteúdo dirigido a menores.

| Dimensão | Avaliação |
|---|---|
| **Custo** | Tempo de ciclo comercial (semanas a meses) e provável exigência de contrato enterprise (compromisso mínimo de gasto). Sem preço público — **NÃO VERIFICADO**. |
| **Risco** | Resposta pode ser "não"; e um pedido que descreve o uso pode **explicitar** ao provedor uma prática que ele hoje não enxerga — o que, se a resposta for negativa, transforma incerteza em ciência do descumprimento. |
| **Evidência exigida** | Documento escrito assinado, com escopo explícito ("canal de animação infantil para 3–5 anos"), identificação do produto e do canal, e cláusula de não suspensão por esse motivo. E-mail de suporte **não** é evidência suficiente. |
| **Observação verificada e reforçada** | Nenhuma das páginas lidas (Google, Runway, OpenAI, ElevenLabs) publica processo de exceção para público menor. Pior para o Google: em **dois tópicos oficiais do fórum de desenvolvedores** (28 e 30/09/2026), moderadores responderam pedidos de interpretação desta cláusula com *"We can't provide specific legal guidance on this forum"*; um tópico perguntando **exatamente** se o Vertex carrega a mesma restrição segue **sem resposta**; e um caso quase idêntico ao do Rebeca (TTS gerado por adulto, offline, embarcado em app infantil 4–9 anos) também segue sem resposta oficial. **A evidência aponta para negativa ou evasiva — o que aumenta o custo esperado desta opção.** |

### (c) Argumentar que o canal **não** é dirigido a menores

**O que é:** sustentar que o "API Client"/"Customer Application" é o software Rebeca (leitura b1)
e/ou que a Luna é conteúdo de "público geral" ou "público misto".

| Dimensão | Avaliação |
|---|---|
| **Teste de honestidade (obrigatório)** | Contra a leitura (b1): a cláusula diz *"use the Services **as part of**"* e inclui *"or other service"* / *"or other online service"* — o canal é o serviço que embute o conteúdo gerado. Contra a leitura "público geral": o próprio YouTube define *"público misto"* como **um tipo de conteúdo para crianças** (F6), e lista tema pré-escolar, personagens infantis e músicas/histórias infantis como fatores de conteúdo para crianças. A Luna tem **todos**. Além disso o YouTube **obriga** declarar o público (F5). **Veredito deste agente: declarar a Luna como "não para crianças" é factualmente insustentável e cria exposição COPPA/FTC independente do Google.** |
| **Custo** | Baixo para escrever; altíssimo se a aposta estiver errada. |
| **Risco** | (i) violação contratual com o Google, com suspensão imediata por suspeita (§20(f)); (ii) misdesignação perante o YouTube/FTC — a própria página do YouTube avisa de *"consequências jurídicas ou no YouTube"*; (iii) risco reputacional grave em canal infantil. |
| **Evidência exigida** | Parecer jurídico **escrito** que assuma expressamente as duas leituras e conclua por (b1) — e uma declaração de público no YouTube coerente com essa tese. Sem advogado, esta opção **não pode ser usada**. |

### (d) Revisão jurídica formal antes de escalar

**O que é:** contratar advogado (idealmente com prática em proteção de dados/menores e contratos de
tecnologia) para: interpretar F1 e F4-A no contexto do Rebeca; resolver a qualificação do art. 39,
§ 1º, do ECA Digital; validar a estratégia de público no YouTube; revisar DPAs; e assinar o
enquadramento de LGPD/ECA Digital.

| Dimensão | Avaliação |
|---|---|
| **Custo** | Honorários (não cotados nesta pesquisa) + tempo de calendário. É o custo mais **previsível** de todos. |
| **Risco** | Baixo — é a opção que **reduz** os outros riscos. Risco residual: parecer genérico que não enfrente a literalidade de F1/F4-A nem a qualificação do art. 39, § 1º. |
| **Evidência exigida** | Parecer escrito e datado, com a versão dos termos analisada, respondendo explicitamente ao §6.1 — inclusive **se o Rebeca é serviço com controle editorial** e **quem cumpre os arts. 8º, 14 e 17**. Registro em `.lgpd/STATUS.md` com quem revisou, quando e qual versão do texto. |
| **Quando fazer** | **Antes de escalar** produção paga e **antes** de tornar o Rebeca multiusuário. Para o primeiro episódio piloto, o custo de esperar é baixo. |

### (e) Opção complementar: separação limpa por público (não-Google na Luna, Google no adulto)

**O que é:** manter os serviços Google **somente** nos canais de público adulto (Arquivo Curioso, AI
Made Simple) e produzir a Luna com provedores da allow-list.

| Dimensão | Avaliação |
|---|---|
| **Custo** | O pipeline fica com dois caminhos de provedor (mais teste, mais superfície). Custo de mídia da Luna depende do substituto. |
| **Risco** | Baixo no eixo contratual; **não** zera risco de LGPD/ECA, que é do Rebeca. |
| **O que mudou nesta versão** | A versão 1 apresentava esta opção como se houvesse a **saída** de manter o Veo na Luna via Vertex, a um custo menor. **Essa saída não existe** (F4-A): o bloqueio é o mesmo por qualquer via Google. A opção (e) deixa de ser "congelar o Google **na Luna** com um caminho alternativo" e passa a ser **separação limpa por público**: Google onde o público é adulto, não-Google onde é infantil. |
| **Evidência** | A allow-list do item (a) + teste que prova a recusa de chamada para canal infantil com provedor proibido. |

### 5.1 Quadro comparativo

| Opção | Remove o bloqueio? | Custo dominante | Evidência mínima | Quem assina |
|---|---|---|---|---|
| (a) allow-list por provedor/finalidade | **Parcialmente** — depende de ler os termos dos candidatos | engenharia baixa + mídia | termos citados + DPA + distinção enterprise/consumidor + teste do gate | engenharia (escolha) + humano (D2) |
| (b) permissão escrita/enterprise | **Sim, se concedida** — e a evidência pública sugere negativa | ciclo comercial + compromisso de gasto | documento assinado com escopo explícito | provedor + humano |
| (c) argumentar que não é para menores | **Só na aparência** | risco assimétrico altíssimo | parecer jurídico escrito | **advogado** |
| (d) revisão jurídica formal | **Não sozinha; habilita as outras** | honorários + calendário | parecer datado e registrado | **advogado** |
| (e) separação limpa por público (não-Google na Luna) | **Sim, no eixo contratual** — **não existe** caminho Vertex que mantenha o Veo na Luna | dois caminhos de pipeline | allow-list + teste de recusa | engenharia + humano |

---

## 6. Separação de competências: o que é decisão jurídica e o que é decisão de engenharia

### 6.1 O que é **de advogado** (não decidir sem assinatura humana)

1. Se o **canal publicado** é "API Client" (Gemini) / "Customer Application" ou "other online service"
   (GCP) — e, portanto, se a leitura (b1) se sustenta. **É a questão central e ela não é técnica.**
2. Se **"users"** / **"End Users"** significam o público do serviço ou os operadores das contas.
3. **Se o Rebeca/Luna é "serviço com controle editorial" (art. 2º, IX, do ECA Digital)** e, portanto, se
   a **dispensa** do art. 39, § 1º, alcança as obrigações dos arts. 6º, 17, 18, 28, 29, 31, 32 e 40 — ou
   se o uso de IA para **selecionar** conteúdo descaracteriza o requisito *"sem o uso de meios
   automatizados de seleção"*. Muda materialmente o custo de conformidade. **Não afeta o art. 8º.**
4. **Quem cumpre os arts. 8º, 14, parágrafo único, e 17 do ECA Digital** — o canal que produz o
   conteúdo ou a plataforma que o distribui. O ECA Digital não resolve a repartição.
5. Se o **próprio software Rebeca** é "produto ou serviço de tecnologia da informação" do art. 2º, I.
6. Se o Rebeca precisa de **consentimento parental (LGPD art. 14 § 1º)** por causa da camada Medir —
   o que depende de os dados de audiência do YouTube serem pessoais/reidentificáveis no contexto — e
   **qual o regime para adolescentes de 13–17** (caput, sem § 1º).
7. Se o Rebeca é **controlador** e cada provedor **operador**, e se os DPAs existentes bastam
   (art. 39 e art. 42 da LGPD — **citações ainda `NÃO VERIFICADO` na letra**).
8. Se é preciso registar **encarregado** e publicar política antes de operar.
9. Se a estratégia pretendida de designação de público no YouTube é defensável.
10. Redação e assinatura de qualquer pedido de permissão ao provedor (opção b).

### 6.2 O que é **de engenharia** (decidir e provar agora, sem esperar advogado)

1. **Modelar o público-alvo como atributo de primeira classe do canal** (`publicoAlvo: 'infantil' |
   'geral' | 'adulto'`, com faixa etária), porque o isolamento por canal já é invariante — hoje só
   falta este campo.
2. **Implementar o gate de provedor:** o roteador recusa geração quando o canal é infantil e o
   provedor/finalidade não está na allow-list. **Falha fechado** (na dúvida, recusa) e registra a
   recusa em log imutável. **A allow-list parte de zero para o Google** — as três vias (AI Studio,
   Gemini API, Vertex/Enterprise) estão bloqueadas.
3. **Manter a allow-list como dado versionado** (não como código): provedor, finalidade, **plano
   (enterprise vs. consumidor)**, URL do termo, data de leitura, trecho citado, quem aprovou. Provedor
   sem termo lido = fora da allow-list.
4. **Registrar custo por ativo** no formato de `.rebeca/custos.csv` em cada caminho de provedor, para
   que a D2 possa comparar o teto de custo entre provedores permitidos.
5. **Provar que a camada Medir não trata dado pessoal de menor** — ou anonimizar até que seja
   demonstrável — com evidência, em vez de presunção. Lembrar do art. 12, § 2º, da LGPD: perfil
   comportamental de pessoa identificada **é** dado pessoal.
6. **Adotar privacidade no modelo mais protetivo por padrão** (art. 7º do ECA Digital) e **não**
   desenhar funcionalidade que estenda o uso (art. 8º, IV): autoplay encadeado, contagem de maratona e
   notificações de reengajamento para público infantil ficam **fora** por padrão.
7. **Rodar um episódio-piloto de ponta a ponta com provedor permitido**, medindo custo por minuto
   real, antes de escalar: é a evidência que falta para a D2.
8. **Não** tomar nenhuma decisão de engenharia que dependa de (1)–(10) do §6.1 estar respondido.

### 6.3 O que **este agente recusa a fazer**

- Declarar que o uso do Gemini/Veo na Luna "é permitido" ou "é proibido". A literalidade é clara o
  bastante para **justificar cautela**, não para produzir certeza.
- Declarar a Luna como "não dirigida a menores" — ver §5(c).
- Declarar que a dispensa do art. 39, § 1º, do ECA Digital "se aplica ao Rebeca". Ela pode aplicar-se —
  ou pode falhar no requisito *"sem o uso de meios automatizados de seleção"*. Quem decide é o advogado.
- Assinar DPA, aceitar termos em nome do projeto, ou publicar política de privacidade.

---

## 7. Checklist de evidência e registros para manter a decisão auditável

Regra do projeto: *"documente a decisão, não só o resultado"*. Cada item abaixo tem um artefato
verificável — e um comando de conferência.

### 7.1 Antes de fechar a D2

- [ ] **ADR da D2** em `.rebeca/decisoes/ADR-00N-provedores-d2.md`, no modelo de
      `.rebeca/decisoes/ADR-000-modelo.md`, com status `proposto`, contemplando: conflito, leitura
      adotada, opção escolhida, alternativas descartadas, o bloqueio do Google **por todas as vias**
      (Gemini API **e** §20(d) do GCP) e a frase exata do que ficou pendente de revisão jurídica.
- [ ] **Allow-list versionada** de provedores × finalidade **× plano**, com URL do termo, data de
      leitura e trecho citado, e status por provedor: `PERMITIDO` / `PROIBIDO` / `NÃO VERIFICADO`.
      Conferência: nenhum campo de trecho ou URL em branco; Google marcado `PROIBIDO` nas três vias.
- [ ] **Leitura dos termos dos candidatos de vídeo** (MiniMax, Pika, Luma, Alibaba) quanto a
      público-alvo menor — hoje `NÃO VERIFICADO`, e é o que impede fechar a D2.
- [ ] **Ficha por provedor** em `.lgpd/vendors/<provedor>.md` com: papel (operador), DPA publicado,
      transferência internacional, uso comercial, **se treina ou não com os Inputs/Outputs**, e
      público-alvo permitido **por plano**.
- [ ] **Parecer jurídico** (ou registro explícito de que ele **ainda não existe** e que a produção
      fica limitada até existir), respondendo ao §6.1 inteiro.

### 7.2 Antes de gerar mídia paga para canal infantil

- [ ] **Gate testado**, com prova adversarial: canal infantil + provedor proibido → chamada recusada;
      canal adulto + mesmo provedor → chamada permitida.
- [ ] **`.lgpd/data-map.md`** com a camada Medir: quais campos de audiência entram, e a conclusão
      (pessoal / não pessoal **com prova**).
- [ ] **`.lgpd/eca-digital.md`** com o **mapa completo do §3.1**: aplicabilidade, o que incide, o que
      **não** incide hoje (arts. 9º, 24, 31, 40 — com a justificativa e a fonte), a avaliação do
      art. 39, caput **e § 1º**, e a vedação de perfilamento (arts. 22 e 26). Declarar expressamente o
      **art. 8º como não modulável e não dispensável**.
- [ ] **`.lgpd/RIPD/`** por IA + menores, referenciando o art. 16, parágrafo único, do ECA Digital e o
      art. 38 da LGPD (ambos a conferir na letra — hoje `NÃO VERIFICADO`).
- [ ] **Registro do custo real** em `.rebeca/custos.csv` para o primeiro episódio no provedor
      permitido.

### 7.3 Contínuo

- [ ] **Releitura dos termos a cada revisão de provedor**, com data registrada; termo que mudou
      invalida a allow-list até nova leitura.
- [ ] **Reavaliação da D2** quando: (i) o parecer jurídico chegar; (ii) o Rebeca virar multiusuário
      (D3); (iii) a ANPD publicar os **regulamentos de fiscalização e sanção — a partir de
      novembro/2026**, que é o marco que muda o risco de sanção (as ações de fiscalização começam em
      **janeiro/2027**; a Etapa II de monitoramento começa em agosto/2026, com adaptação até
      novembro/2026). **Correção da versão 1:** reavaliar em agosto/2026 era cedo.
- [ ] **Registro em `.rebeca/estado.md`** de todo bloqueio de conformidade e de toda aprovação humana
      obtida — sem presumir aprovação que não aconteceu.

### 7.4 Comandos de conferência (A fazer quando os artefatos existirem)

```powershell
# Nenhum provedor sem ficha de vendor
(Get-ChildItem .lgpd/vendors -File -ErrorAction SilentlyContinue | Measure-Object).Count

# Nenhum campo de base legal em branco no ROPA
Select-String .lgpd/ROPA.md -Pattern '^\|' | Where-Object { $_.Line -match '\|\s*\|\s*$' }

# Nenhum segredo em texto claro nos artefatos de conformidade
Select-String .lgpd/*.md -Pattern '(?i)(refresh_token|access_token|client_secret)\s*[:=]\s*\S'

# Revisão jurídica registrada com data
Select-String .lgpd/STATUS.md -Pattern 'revis[aã]o jur[ií]dica'

# Art. 8º do ECA Digital declarado como não modulável no mapa
Select-String .lgpd/eca-digital.md -Pattern 'art\. 8'
```

---

## 8. Fontes

| # | URL | O que foi lido |
|---|---|---|
| 1 | https://ai.google.dev/gemini-api/terms | Gemini API Additional Terms of Service — Age Requirements; Use Restrictions; Use of Generated Content; Unpaid/Paid Services; ressalva de que não governam serviços do Google Cloud |
| 2 | https://cloud.google.com/terms/service-terms | **Google Cloud Service Specific Terms §20 "Generative AI Services"** — (a) definição, (c) Prohibited Use Policy, **(d) Age Restrictions**, (e) Healthcare, **(f) Suspected Violations**, **(g) Restrictions**, (h) retenção de prompts/output (lido por extrator de terceiro; página JS-rendered) |
| 3 | https://support.google.com/youtube/answer/9527654?hl=pt-BR | Definir o público do canal/vídeo; obrigatoriedade; públicos mistos; restrições de recursos |
| 4 | https://support.google.com/youtube/answer/9528076?hl=pt-BR | Como determinar se o conteúdo é para crianças; fatores do YouTube/FTC; público misto |
| 5 | https://normas.leg.br/api/public/binario/b434eb3c-9e75-41fb-a074-0bacf96bccec/texto | Lei 15.211/2025 (ECA Digital) — texto integral: arts. 1º–40 (os citados neste memo: 1º, 2º, 3º, 4º, 5º, 6º–10, 14, 16–18, 22–24, 26–29, 31, 33, 34, 35, 39, 40) |
| 6 | https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html | LGPD (texto atualizado, fonte oficial legislativa) — arts. 5º VI/VII, 6º III/VI, 12 § 2º, 14 caput e §§ 1º–6º, 14-A (VETADO), 15–23 (lido diretamente, **sem** extrator) |
| 7 | https://www.lexml.gov.br/urn/urn:lex:br:federal:lei:2018-08-14;13709 | Localização da fonte oficial da LGPD (LexML) |
| 8 | https://www.gov.br/anpd/pt-br/assuntos/eca-digital | ANPD — competência, Decretos 12.622/2025, 12.880/2026 e 12.881/2026, Lei 15.352/2026, cronograma de fiscalização (Etapas I–III) |
| 9 | https://www.gov.br/anpd/pt-br/assuntos/eca-digital/perguntas_respostas_eca_digital_30072026.pdf | Q&A oficial ECA Digital (ANPD/MJSP/Secom) — leitura restritiva do art. 9º; vinculação "para usar redes sociais"; supervisão parental universal; citação do art. 47 do Decreto (**lido por extrator de terceiro**) |
| 10 | https://runway.com/safety/usage-policy | Runway Usage Policy — **Children's Safety**; Additional Character & Game Worlds Policies |
| 11 | https://runway.com/enterprise-terms | Runway Enterprise Services Terms — DPA, Customer Content (não-treinamento), atribuição, indenização |
| 12 | https://runway.com/terms-of-use | Runway Terms of Use — "Powered by Runway", idade mínima 13+ (§2.2), **§4.4 treinamento com Inputs/Outputs** |
| 13 | https://openai.com/policies/business-terms/ | OpenAI Services Agreement — End Users, Restrictions (§3.3), Customer Content (§4.2), No Publicity (§10) (lido via extrator; fetch direto HTTP 403) |
| 14 | https://elevenlabs.io/terms-of-use | ElevenLabs ToS (non-EEA) — §1(a) idade 18+, §1(c) uso comercial, DPA |
| 15 | https://elevenlabs.io/use-policy | ElevenLabs Prohibited Use Policy (incorporada pela ToS) — não veda conteúdo dirigido a crianças |
| 16 | https://developers.openai.com/api/docs/models/sora-2.md | Encerramento da Sora 2 / Videos API em 24/09/2026 |
| 17 | https://discuss.ai.google.dev/t/does-byok-allow-gemini-api-use-in-an-app-likely-to-be-accessed-by-under-18-students/185614 · https://discuss.ai.google.dev/t/gemini-developer-api-age-requirements-for-an-adult-only-qr-accessed-web-service/184622 | Fórum oficial Google AI Developers — moderadores recusam interpretar a cláusula ("We can't provide specific legal guidance on this forum") |
| 18 | https://discuss.ai.google.dev/t/age-restrictions-in-gemini-api-terms-general-audience-app-rated-3-with-an-adult-only-ai-feature/179916 · https://discuss.ai.google.dev/t/gemini-api-age-restriction-may-static-tts-audio-generated-offline-by-an-adult-ship-inside-a-childrens-learning-app/186036 | Pergunta sobre Vertex e caso análogo ao Rebeca — **sem resposta oficial** |
| 19 | https://policies.google.com/terms/generative-ai/use-policy | Generative AI Prohibited Use Policy — exceção "educational, documentary, scientific, or artistic" que **não alcança** a cláusula de idade (lido via extrator) |

### 8.1 Fontes registradas como pendência (não lidas no corpo)

- https://platform.minimax.io/protocol/terms-of-service — HTTP 200, **corpo não legível**.
- https://cloud.google.com/terms/data-processing-addendum — não lido no corpo.
- `services.google.com/fh/files/misc/cloud-acceptable-use-policy.pdf` — **HTTP 404**.
- Termos de Pika, Luma, Kling, Alibaba/Wan quanto a público-alvo menor — não lidos.
- LGPD art. 46 e arts. 37/38 — **não lidos na letra**.
- Decreto 12.880/2026, art. 47 — citado pela ANPD, **texto não lido**.

---

## 9. Handoff — Contrato de entrega

- **Status:** concluído (memo v2 entregue), com **pendências bloqueantes declaradas**: (i) termos dos
  candidatos de vídeo (MiniMax, Pika, Luma, Alibaba) quanto a público-alvo menor; (ii) LGPD art. 46 e
  arts. 37/38, e Decreto 12.880/2026 art. 47, não lidos na letra. **A D2 não pode ser fechada sem (i).**
- **Entregáveis:** este memo v2; ADR da D2 **a criar** pelo humano/`rebeca-arquiteto`.
- **Evidência:** §1.1 (citações literais com URL) e §8 (fontes); §1.2 e §8.1 listam o que **não** foi
  verificado; §10 registra o que a refutação adversarial mudou.
- **Decisões (propostas, não tomadas):** allow-list por provedor × finalidade × plano; gate que falha
  fechado; `publicoAlvo` como atributo de canal; privacidade no modelo mais protetivo por padrão.
- **Riscos:** (i) operar na leitura (b1) e ela estar errada — **agravado**: não há via Google
  alternativa; (ii) declarar a Luna como "não para crianças"; (iii) tratar analytics de audiência como
  anônimo sem prova; (iv) escolher substituto com termo não lido; (v) **assumir que a dispensa do
  art. 39, § 1º, do ECA Digital se aplica** quando o uso de IA para selecionar conteúdo pode
  descaracterizar o "controle editorial".
- **Próximo:** revisão jurídica formal (opção d) e leitura dos termos pendentes. **`rebeca-qa` deve
  refutar esta versão 2** — em especial a conclusão de que o art. 8º do ECA Digital não é modulável
  nem dispensável, e a repartição de deveres entre canal e software.
- **Humano deve assinar:** os itens do §6.1, integralmente.

---

## 10. Changelog desta correção

A versão 1 deste memo foi submetida a refutação adversarial pelo `rebeca-qa`
(`.rebeca/evidencias/qa-d2-restricao-menores.md`), com veredito **`parcialmente refutado`** — 6 itens.
**O memo não nasceu certo: ele foi refutado e corrigido.** Registro do que mudou e por quê.

| # | Item | O que a v1 dizia | O que a v2 diz | Por que mudou |
|---|---|---|---|---|
| 1 | **§3.1 — mapa do ECA Digital** (o mais grave) | Lista de incidência apresentada como fechada, cobrindo ~8 dispositivos | **Mapa completo**, dispositivo por dispositivo, com o que cada um exige do Rebeca: arts. 1º, 2º (I e IX), 3º, 4º, 5º caput e § 1º, 6º, **7º**, **8º I–V**, 9º, **10**, **14 § único**, **16 caput**, 16 § único, **17 I–IV**, **18**, 22, 24, 26, **28**, **29** (com o § 4º), 31, **33**, 34, 35, **39 caput e § 1º**, **40** | A v1 **omitia treze dispositivos** dirigidos ao mesmo alvo e apresentava a lista como fechada. O art. 8º, IV (uso compulsivo) e V (informar a faixa etária no momento do acesso) **batem direto num canal infantil**, e o art. 8º **não é modulável nem dispensável pelo art. 39**. Omissão material, apontada como o erro mais grave. |
| 2 | **Art. 39 do ECA Digital** | *"Aplica-se como alívio, não como isenção"* | **Citado o § 1º na letra**: provedores de serviços com controle editorial *"estarão **dispensados** do cumprimento das obrigações"*. Acrescentados o **art. 2º, IX** (definição de controle editorial, com o requisito *"sem o uso de meios automatizados de seleção"*) e o **art. 29, § 4º**. Reanálise nos dois sentidos (a favor e contra o Rebeca), com o **art. 8º explicitamente fora da dispensa** | A v1 escreveu o **oposto do texto legal** e nunca mencionou o § 1º, o art. 2º, IX nem o art. 29, § 4º. A consequência é material: pode ser **dispensa** (a favor, se o serviço for editorial) **ou risco** (se o uso de IA para selecionar conteúdo descaracterizar o requisito). Entra no §6.1 como decisão de advogado. |
| 3 | **Art. 24 do ECA Digital** | *"NÃO incide hoje: fala de 'usuários ou contas', não de público"* | Conclusão **mantida**; razão **trocada** por: (i) o capítulo é o **CAPÍTULO IX — DAS REDES SOCIAIS** e o § 1º fala em *"provedores de redes sociais"*; (ii) a ANPD/MJSP enquadram a vinculação como regra **"para usar redes sociais"**. O caput **é** redigido pela fórmula de público — reconhecido expressamente | A justificativa da v1 era **literalmente falsa** contra o próprio caput (*"provedores de produtos ou serviços **direcionados a crianças e a adolescentes ou de acesso provável por eles**"*). Quem lesse o memo repetiria um argumento que a ANPD não usa. |
| 4 | **Vertex AI / Gemini Enterprise** | `NÃO VERIFICADO`; descrito como *"a pergunta que decide se a opção (a) pode manter o Veo no pipeline da Luna"* | **VERIFICADO — e bloqueado, com redação mais ampla.** Novo fato **F4-A** (§20(d), (f) e (g) do Google Cloud Service Specific Terms, com citação literal) + **F4-B** (a Gemini API declara que não governa o GCP). §4 item 3, §5(a), §5(e), §5.1 e §6.1 atualizados: **não há saída pelo Google** | A v1 entregou uma pergunta quando já era possível entregar a resposta — e errou **por otimismo residual**, não por cautela. A v2 corrige na direção **contra** manter o Google: o bloqueio acompanha o produto, não o endpoint, com suspensão por suspeita e sem exceção publicada. Verificado por três leituras independentes (QA, adendo `.rebeca/pesquisa/d2-adendo-vertex.md`, e releitura própria nesta sessão). |
| 5 | **F15 — Runway** | Restrições a menores aparecem *"apenas"* em "Additional Character & Game Worlds Policies" | Corrigido para: **duas frentes, que não se confundem** — a seção geral **"Children's Safety"** (CSAM, grooming, abuso) e a vedação de **público-alvo infantil**, que é a dos Characters & Game Worlds. Ambas citadas | A palavra *"apenas"* era **falsa na letra**. A conclusão substantiva (a vedação de produtos dirigidos a menores não alcança o gerador de vídeo) sobreviveu — mas um advogado que conferisse o "apenas" perderia confiança no resto do memo. |
| 6 | **F12 — art. 35, II do ECA Digital** | *"ou R$ 10 a R$ 1.000 por usuário cadastrado"* | Restituída a condição suprimida: *"ou, **ausente o faturamento**, multa de R$ 10,00 até R$ 1.000,00 por usuário cadastrado"*, com a consequência explicitada: **num serviço com faturamento, a régua é o percentual** | A v1 apresentava a multa por usuário como alternativa **livre** ao percentual. A lei a reserva a quem **não tem faturamento** — a supressão **subestimava** a exposição. |
| 7 | **F8 — LGPD arts. 5º VI/VII e 46** | Apresentados como "verificado" | **Art. 5º VI/VII e art. 6º III/VI: PROMOVIDOS a verificado na letra**, agora com citação literal da **Câmara dos Deputados** (norma 787077), lidos nesta sessão. **Art. 46: permanece `NÃO VERIFICADO`** — não foi lido na letra em nenhuma sessão. Acrescentados como `NÃO VERIFICADO` os arts. 37, 38 e 5º XVII | O QA apontou que a v1 os declarava verificados **sem ter lido a letra**. A v2 resolve o que pôde ser resolvido com fonte oficial e **deixa o resto marcado**. Nenhum item foi promovido sem fonte. |
| 8 | **LGPD art. 14 — precisão de faixa etária** | Tratava "criança" e "adolescente" como bloco único | Explicita que o **§ 1º fala só de "crianças"** (até 12 anos incompletos), enquanto o caput cobre ambos; se a camada Medir capturar dado de **adolescente (13–17)**, o regime **não** é o do § 1º | A v1 escrevia "consentimento do responsável" sem distinguir a faixa — imprecisão que um advogado corrigiria. |
| 9 | **F7 — proveniência da fonte da LGPD** | Texto lido **por extrator de terceiro** sobre o Planalto | Texto lido **direto em fonte oficial legislativa** (Câmara dos Deputados, via LexML) — **sem extrator**. A limitação do Planalto direto é reproduzida e declarada, com as 4 URLs que falharam | O QA reproduziu a falha (`fetch failed` nas 4 URLs) **e** mostrou que dava para ler em fonte oficial sem mediação de terceiro. A v2 adota a fonte melhor. |
| 10 | **Art. 14-A da LGPD (Seção III-A)** | Ausente | Acrescentado como **F7-A**: a tentativa legislativa de inserir aferição etária na LGPD foi **VETADA** pela Lei 15.134/2025 | Dado que **reforça** a tese central do memo (a aferição de idade não é dever geral de quem publica conteúdo infantil) e a v1 não usou. |
| 11 | **Art. 12, § 2º, da LGPD** | Ausente | Acrescentado como **F7-B**: perfil comportamental de pessoa identificada **é** dado pessoal | Fecha a porta para "agregado que na prática individualiza" — e é exatamente o que a camada Medir poderia produzir. |
| 12 | **F16 — Runway enterprise vs. consumidor** | Citava Runway Enterprise sem contrastar com o plano de consumidor | Acrescentado: os **Terms of Use de consumidor treinam com Inputs/Outputs (§4.4)** e aceitam **13+** (§2.2); *"não treina"* e *"13+"* **só valem no Enterprise**. A allow-list passa a exigir o campo **plano** | Muda o peso da opção (a): **"Enterprise" é condição, não preferência**. Sem isso, o §7.1 pediria ficha de vendor sem o campo que importa. |
| 13 | **§5(b) — permissão ao provedor** | "Nenhuma das páginas lidas publica processo de exceção" | **Reforçado com evidência de fórum**: moderadores do Google recusam interpretar a cláusula; um tópico perguntando **exatamente** sobre o Vertex segue sem resposta; um caso quase idêntico (TTS offline em app infantil) também | A evidência pública indica **negativa ou evasiva** — o que aumenta o custo esperado da opção (b). |
| 14 | **§7.3 — gatilho de reavaliação** | Reavaliar quando a ANPD ampliar a Etapa II (agosto/2026) | Corrigido: a Etapa II começa em agosto/2026 **com adaptação até novembro/2026**; os **regulamentos de sanção saem a partir de novembro/2026**; fiscalização em **janeiro/2027**. O marco que muda o risco de sanção é **novembro**, não agosto | Reavaliar em agosto era **cedo**. O cronograma oficial tem mais etapas do que a v1 citava. |
| 15 | **§3.2 — art. 39 da LGPD e correlatos** | Citados como INCIDE | Mantidos como dever, **mas com `NÃO VERIFICADO` na letra** (arts. 37, 38, 39, 42, 46, 48) | A v1 afirmava mais do que tinha lido. Dever de ofício não é o mesmo que citação conferida. |
| 16 | **Decreto 12.880/2026, art. 47** | Ausente | Acrescentado como **`NÃO VERIFICADO` na letra**, citado pela ANPD como instrumento de avaliação de proporcionalidade | O QA o apontou como obrigação regulamentar ausente. Entra **como referência a conferir**, não como citação. |

### 10.1 O que a refutação **confirmou** (não mexido)

A conclusão que trava a D2 — **o Google está bloqueado por contrato para serviço dirigido a menores** —
foi **confirmada** e **fortalecida** (a via Vertex também está bloqueada). Também confirmados sem
alteração: art. 9º do ECA Digital **não** incide; art. 31 **não** incide; art. 16, parágrafo único,
incide e exige RIPD; arts. 22 e 26 lidos com precisão (inclusive "dados grupais e coletivos"); a
análise b1/b2 do §2.3 permanece honesta e corretamente calibrada; a assimetria de risco do §2.5
permanece — e ficou **mais** assimétrica; a opção (b) permanece bem calibrada; o bloqueio honesto da
allow-list permanece; e **nenhum número, data ou citação inventada** foi encontrado em nenhum ponto
que o QA conseguiu conferir.

**O que este changelog não faz:** não promove nada a "verificado" sem fonte, não transforma dever de
ofício em citação conferida, e não resolve as questões do §6.1 — que continuam sendo **de advogado**.
