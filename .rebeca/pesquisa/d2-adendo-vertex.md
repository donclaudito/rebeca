# Adendo D2 — a pista do Vertex AI está REFUTADA

**Decisão alimentada:** D2 (provedores de mídia IA + teto de custo).
**Autor:** `rebeca-ia-video`. **Data:** 2026-09-30.
**Origem:** o dossiê `d2-provedores-ia-midia.md` (§8.6 e fechamento) levantou a hipótese de que
Vertex AI / Gemini Enterprise pudessem estar sob **outro conjunto de termos**, reabrindo o Google
para o canal infantil — a diferença entre ≈US$ 4/min e ≈US$ 18/min. O próprio dossiê pediu "pesquisa
dedicada nisso". Esta é a pesquisa. **A hipótese não se sustenta.**

## 1. O que sustentava a hipótese

Os *Gemini API Additional Terms* dizem, literalmente:

> "For clarity, these Terms do not govern your direct use of any Google Cloud Platform service
> (including those listed on the Google Cloud Services Summary)."
> — https://ai.google.dev/gemini-api/terms

Leitura correta e ainda válida: a cláusula de menores daquele documento **não governa** o Vertex.
Mas "não governa" não é "não existe" — era preciso ler o que governa.

## 2. O que fecha a hipótese

Os termos que **governam** o Vertex são os *Google Cloud Service Specific Terms*. A cláusula está lá,
com redação equivalente:

> "20. **Generative AI Services** (formerly Section 19 (Generative AI Services)).
> [...]
> d. **_Age Restrictions_**. Customer will not, and will not allow End Users to, use a Generative AI
> Service as part of a website, Customer Application, or other online service that is directed
> towards or is likely to be accessed by individuals under the age of 18."
> — https://cloud.google.com/terms/service-terms , §20(d)

E não é cláusula ornamental — os parágrafos seguintes a tornam executável:

> "f. **_Suspected Violations_**. Google may immediately suspend or terminate Customer's use of a
> Generative AI Service based on any suspected violation of Section 17(b) or subsection (d) above."
> — idem, §20(f)

> "g. **_Restrictions_**. The restrictions contained in subsections (d) and (e) above are deemed to be
> 'Restrictions' or 'Use Restrictions' under the applicable Agreement."
> — idem, §20(g)

O §20(c) ainda incorpora a mesma *Prohibited Use Policy* referenciada pelos termos da Gemini API.
Ou seja: **a restrição de menores acompanha o produto, não o endpoint.** Trocar de Vertex é trocar de
documento, não de política.

**Consequência para a D2:** o caminho Google (Veo/Imagen/Lyria/TTS) permanece **bloqueado no eixo
contratual para o canal Luna** por qualquer via — Developer API ou Vertex/Enterprise. A estimativa de
≈US$ 3,86/min deixa de ser um piso viável, e o piso realista passa a ser a stack não-Google mais
barata do dossiê (Stack A, ≈US$ 7,46/min) — condicionado a `rebeca-qa` confirmar que os provedores
dessa stack realmente permitem público menor (a "auditoria de idade" do dossiê pode ter **exagerado**
em alguns bloqueios; ver a frente de refutação em curso).

## 3. Método e limite de leitura (declarado)

- A frase foi localizada por busca da expressão exata e lida no corpo da página oficial
  `cloud.google.com/terms/service-terms`.
- **Limite:** as páginas `cloud.google.com` e `policies.google.com` não entregam corpo legível ao
  `web_fetch` direto (renderização por JS; `policies.google.com/terms/generative-ai` voltou vazio).
  O corpo foi obtido por **extrator de texto de terceiro (`r.jina.ai`) aplicado sobre a URL oficial**,
  e o trecho foi conferido no arquivo de saída completo. O conteúdo é da página oficial, **mas a
  mediação é de terceiro**.
- **Portanto:** o fato está registrado como verificado por leitura mediada. A frase é inequívoca e
  casa palavra por palavra com a cláusula da Gemini API, mas — pela mesma regra que o memo de
  conformidade aplicou ao art. 14 da LGPD — **recomenda-se releitura direta em navegador antes de
  ela virar cláusula de contrato ou base de decisão jurídica.**

## 4. O que este adendo NÃO faz

- Não declara que o uso do Google na Luna "é proibido". A literalidade justifica cautela, não produz
  certeza — a interpretação de "API Client"/"Customer Application" continua sendo decisão de advogado
  (ver `.rebeca/pesquisa/d2-restricao-menores-provedores.md` §6.1).
- Não altera o dossiê, que é de outro agente e está em refutação adversarial.
- Não fecha a D2. Ela continua dependendo de: (i) leitura dos termos de Alibaba/MiniMax; (ii) o teste
  de "over-blocking" em `rebeca-qa`; (iii) assinatura humana.

## 5. Fontes

| URL | O que foi lido |
|---|---|
| https://ai.google.dev/gemini-api/terms | Gemini API Additional Terms — "Age Requirements"; ressalva de que não governam serviços do Google Cloud |
| https://cloud.google.com/terms/service-terms | Google Cloud Service Specific Terms — §20 "Generative AI Services": (a) definição, (c) Prohibited Use Policy, **(d) Age Restrictions**, (e) Healthcare, (f) Suspected Violations, (g) Restrictions |
| https://policies.google.com/terms/generative-ai | *Generative AI Additional Terms* (consumer) — lido: **não contém** a cláusula de menores e está **substituído** desde 22/05/2024 ("these Generative AI Additional Terms of Service no longer apply, unless you're a business partner with a signed agreement that references these terms"). Registrado para evitar que alguém cite este documento achando que é o do Vertex. |
