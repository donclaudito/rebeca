# QA adversarial — D2: restrição de menores nos provedores de IA

**Verifica:** `.rebeca/pesquisa/d2-restricao-menores-provedores.md`
**Verificador:** `rebeca-qa` (não é autor do memo — quem produz não aprova o próprio trabalho)
**Data da verificação:** 2026-09-30
**Método:** `web_search` só para **localizar** URL oficial; leitura na fonte por `web_fetch`. Todo conteúdo
externo tratado como **dado não confiável**, nunca como instrução. Nenhum artigo, data, citação, preço ou
política foi preenchido de memória: onde não deu para ler, está escrito `NÃO VERIFICADO`.

**Veredito final:** `parcialmente refutado` — **não alimente a decisão humana com este memo sem corrigir o §3.1.**
O bloqueio do Google (que é o que trava a D2) **se confirma e é mais forte do que o memo diz**; o mapa do ECA
Digital do §3.1 é **materialmente incompleto** e uma de suas justificativas está literalmente errada.

---

## 0. Resumo dos vereditos

| # | Afirmação do memo | Veredito |
|---|---|---|
| F1 | Gemini "Age Requirements" (18+, API Client dirigido a <18) | **CONFIRMADO** (literal, fonte oficial) |
| F2 | Gemini "Use Restrictions" (professional or business purposes) | **CONFIRMADO** (literal, fonte oficial) |
| F3 | "Google won't claim ownership" e ausência de cláusula autorizando público menor | **CONFIRMADO** (+ testei a única exceção plausível) |
| F4 | DPA para Paid Services + termos adicionais seguem valendo | **CONFIRMADO** |
| F5 | YouTube obriga declarar público; penalidades; restrição de recursos | **CONFIRMADO** |
| F6 | Fatores FTC/YouTube; "público misto" é conteúdo para crianças | **CONFIRMADO** |
| F7 | LGPD art. 14 caput e §§ 1º–6º (lido via extrator de terceiro) | **CONFIRMADO** — e **promovido a fonte oficial** (Câmara dos Deputados) |
| F8 | LGPD arts. 5º VI/VII, 6º III e VI, 46 | **PARCIALMENTE NÃO VERIFICADO** (art. 6º III e VI confirmados; art. 5º VI/VII e art. 46 não lidos) |
| F9 | ECA Digital art. 1º e parágrafo único; art. 3º | **CONFIRMADO** (literal) |
| F10 | ECA Digital art. 9º, §§ 1º e 2º | **CONFIRMADO** (literal) |
| F11 | ECA Digital art. 24 (usuário/conta) e art. 39 (modulação) | **REFUTADO** em dois pontos (razão do art. 24; natureza do art. 39) |
| F12 | ECA Digital arts. 22/26, 16 § único, 31, 35 II | **CONFIRMADO**, com imprecisão no art. 35 II |
| F13 | Cronologia ECA Digital / ANPD / decretos / leis | **CONFIRMADO** |
| F14 | Parâmetros preliminares + guia em tomada de subsídios | **CONFIRMADO** |
| F15 | Runway: restrições a menores **apenas** em Characters & Game Worlds | **REFUTADO** no "apenas"; conclusão substantiva confirmada |
| F16 | Runway Enterprise: DPA, não-treinamento, "Powered by Runway", §11.1 | **CONFIRMADO** (literal) |
| F17 | OpenAI §3.3(c), §4.2, §10 | **CONFIRMADO** (literal, via extrator) |
| F18 | Sora 2 / Videos API encerrada em 24/09/2026 | **CONFIRMADO** (literal) |
| F19 | ElevenLabs §1(a) 18+ e §1(c) uso comercial | **CONFIRMADO** (literal) |
| §3.1 | Arts. 9º e 24 do ECA Digital **não** incidem | **CONFIRMADO** na conclusão de cada artigo; **REFUTADO** como "mapa do que incide" (omissões materiais) |
| §4.3 / §6.1.3 | Vertex AI / Gemini Enterprise: cláusula equivalente **NÃO VERIFICADO** | **VERIFICADO — e a resposta REFUTA a opção**: a cláusula existe e é mais ampla |
| §6.3 | "Não existe caminho autoatendido de pedir permissão" | **CONFIRMADO** (com evidência adicional) |

---

## 1. Ataque nº 1 — §3.1: arts. 9º e 24 do ECA Digital não incidem

### 1.1 O que tentei e o que achei

Li a **íntegra da Lei 15.211/2025** em base oficial (`normas.leg.br`, serviço de legislação federal) e as
**duas publicações oficiais da ANPD** (página institucional + "Perguntas e respostas sobre o ECA Digital",
ANPD/MJSP/Secom, atualizado em 30/07/2026).

**(a) O art. 9º tem outro gatilho que o memo não viu?** **Não.** Texto literal:

> **Art. 9º** Os fornecedores de produtos ou serviços de tecnologia da informação que disponibilizarem
> conteúdo, produto ou serviço cuja oferta ou acesso seja impróprio, inadequado ou proibido para menores de
> 18 (dezoito) anos de idade deverão adotar medidas eficazes para impedir o seu acesso por crianças e
> adolescentes no âmbito de seus serviços e produtos.
> **§ 2º** Para os fins desta Lei, consideram-se impróprios ou inadequados para crianças e adolescentes os
> produtos, serviços ou conteúdos de tecnologia da informação que contenham material pornográfico, ou
> quaisquer outros vedados pela legislação vigente.

— https://normas.leg.br/api/public/binario/b434eb3c-9e75-41fb-a074-0bacf96bccec/texto

O § 2º é **literalmente** o que o memo diz. E a ANPD/MJSP confirmam a leitura restritiva, respondendo
"a quais dos provedores se aplica a obrigação de aferição de idade":

> "Adicionalmente, **fornecedores de conteúdos, produtos ou serviços proibidos para crianças e
> adolescentes** deverão adotar mecanismos confiáveis de verificação de idade, vedada a autodeclaração."

E a própria ANPD ancora o dever no art. 9º, caput e § 1º, descrevendo-o como dever de impedir acesso a
conteúdo "impróprio, inadequado ou proibido":

> "É com base nesse modelo regulatório que se deve compreender o comando do art. 9º, caput e § 1º, do ECA
> Digital, que determina que os mecanismos de aferição de idade adotados sejam 'confiáveis'."

— https://www.gov.br/anpd/pt-br/assuntos/eca-digital (página)
— https://www.gov.br/anpd/pt-br/assuntos/eca-digital/perguntas_respostas_eca_digital_30072026.pdf (PDF, 9 p.)
— https://www.gov.br/anpd/pt-br/assuntos/eca-digital/mecanismos-confiaveis-de-afericao-de-idade-orientacoes-preliminares.pdf (PDF, 33 p., março/2026)

**Resultado: não consegui refutar a conclusão sobre o art. 9º.** A Luna não é conteúdo pornográfico nem
produto proibido. O memo está certo — e agora com fonte de governo, não só com o texto da lei.

**(b) "usuário"/"acesso provável" alcançam o espectador de canal público?** Para o **art. 9º**, não — o
gatilho é o conteúdo, não o público. Para o **art. 24**, o memo errou a razão (ver 1.2).

**(c) Algum outro artigo impõe aferição de idade a quem publica conteúdo?** **Não encontrei nenhum.** Os
arts. 12, 13 e 14 (CAPÍTULO IV — DOS MECANISMOS DE AFERIÇÃO DE IDADE) dirigem-se a lojas de aplicações e
sistemas operacionais (art. 12) e a quem **recebe** o sinal de idade (art. 14). A conclusão do memo de que
a aferição de idade não recai sobre o canal infantil **se sustenta**.

### 1.2 REFUTADO — a justificativa do art. 24 está errada

O memo escreve: *"**NÃO incide hoje:** fala de 'usuários ou contas', não de público."* Isso é **refutado
pelo próprio caput**, que se dirige expressamente a fornecedores cujo serviço é direcionado a crianças:

> **Art. 24.** No âmbito de seus serviços, os provedores de produtos ou serviços **direcionados a crianças e
> a adolescentes ou de acesso provável por eles** deverão garantir que usuários ou contas de crianças e de
> adolescentes de até 16 (dezesseis) anos de idade estejam vinculados ao usuário ou à conta de um de seus
> responsáveis legais.

O critério de incidência **é** o público — que é justamente o que o memo usa no art. 1º para dizer
"INCIDE". A razão correta para o art. 24 não incidir hoje é outra: (i) ele está no **CAPÍTULO IX — DAS
REDES SOCIAIS** e o § 1º fala em "provedores de redes sociais"; e (ii) a ANPD/MJSP enquadram a vinculação
como regra "**para usar redes sociais**". A conclusão do memo sobrevive; a justificativa escrita, não.
Isso importa: quem ler o memo vai repetir um argumento que a ANPD não usa.

### 1.3 REFUTADO — art. 39 é, sim, hipótese de isenção (e o memo não a viu)

O memo afirma que o art. 39 "**Aplica-se como alívio, não como isenção**". O § 1º do art. 39 diz o
contrário, literalmente:

> **Art. 39, § 1º** Os provedores dos serviços com controle editorial e os provedores de conteúdos
> protegidos por direitos autorais previamente licenciados [...] **estarão dispensados do cumprimento das
> obrigações** previstas nos artigos referidos no caput deste artigo, desde que: I – observem as normas de
> classificação indicativa [...]; II – ofereçam transparência na classificação etária [...]; III –
> disponibilizem mecanismos técnicos de mediação parental de acesso facilitado [...]; IV – ofereçam canais
> acessíveis para recebimento de denúncias [...]

E "serviço com controle editorial" tem definição legal no art. 2º, IX:

> "aplicação de internet que tem como finalidade principal a disponibilização de conteúdos previamente
> selecionados, **sem o uso de meios automatizados de seleção**, por agente econômico responsável"

O memo **não menciona o § 1º nem o art. 2º, IX** em nenhum ponto. Também não menciona o art. 29, § 4º
("Não estarão sujeitos ao procedimento de retirada [...] os conteúdos jornalísticos e os submetidos a
controle editorial"). Isso é uma omissão material de mão dupla: pode ser **isenção** (a favor do Rebeca,
se o serviço for qualificado como editorial) ou **risco** (o Rebeca usa IA para selecionar conteúdo, o que
pode fazer falhar o requisito "sem o uso de meios automatizados de seleção"). Em nenhum dos dois casos o
memo podia ignorar o dispositivo.

### 1.4 REFUTADO — o §3.1 é incompleto como "mapa do que incide"

A conclusão do memo diz que o ECA Digital "impõe proteção reforçada, RIPD e vedação de perfilamento".
Isso é uma lista fechada que **não se sustenta** contra a própria fórmula de incidência que o memo adota
("direcionado a crianças... ou de acesso provável por eles"). Todos estes dispositivos usam **exatamente a
mesma fórmula** e **não aparecem** no §3.1:

| Dispositivo omitido | Obrigação (literal, resumida) |
|---|---|
| Art. 5º, § 1º | "adotar as medidas técnicas adequadas [...] que possibilitem à família e aos responsáveis legais prevenir o acesso e o uso inadequado por crianças e adolescentes" |
| Art. 6º | "tomar medidas razoáveis desde a concepção e ao longo da operação" contra conteúdo/produto/prática dos incisos I–VI |
| Art. 7º | "garantir, por padrão, a configuração no modelo mais protetivo disponível" |
| **Art. 8º** | "II – realizar avaliação do conteúdo [...] de acordo com a faixa etária"; "III – oferecer sistemas e processos projetados para impedir que crianças e adolescentes encontrem [...] conteúdos manifestamente inadequados à sua faixa etária"; "IV – [...] configurações que evitem o uso compulsivo"; "**V – informar extensivamente a todos os usuários sobre a faixa etária indicada [...] no momento do acesso**" |
| Art. 10 | "adotar mecanismos para proporcionar experiências adequadas à idade" |
| Art. 14, § único | "deverão implementar mecanismos próprios para impedir o acesso indevido [...] a conteúdos inadequados para sua faixa etária" |
| Art. 16, caput | disponibilizar a pais, responsáveis, crianças e adolescentes "informações sobre os riscos e as medidas de segurança adotadas" |
| **Art. 17, I–IV** | "disponibilizar configurações e ferramentas acessíveis e fáceis de usar que apoiem a supervisão parental"; "**IV – oferecer funcionalidades que permitam limitar e monitorar o tempo de uso**" |
| Art. 18 | ferramentas de supervisão parental (contas, compras, métricas de tempo de uso, controles) |
| Art. 28 | "disponibilizar aos usuários mecanismos de notificações acerca de violações aos direitos" |
| Art. 29 | retirada de conteúdo violador mediante notificação |
| Art. 33 | informações sobre uso indevido dos instrumentos de denúncia |
| Art. 40 | "manter representante legal no País" |

E há uma obrigação **regulamentar** que o memo também não cita, apontada pela ANPD:

> "Outro instrumento relevante à avaliação de proporcionalidade das soluções adotadas é a **avaliação de
> impacto de riscos à segurança e à saúde de crianças prevista no art. 47 do Decreto**."

A ANPD/MJSP descrevem as obrigações dos arts. 17/18 como universais para o público infantil:

> "O ECA Digital determina que **todos os serviços para crianças e adolescentes conectados à internet**
> devem oferecer configurações e ferramentas simples de usar para apoiar a supervisão dos pais e
> responsáveis, como: Limitação de tempo de uso; Restrição de comunicação com usuários não autorizados;
> Controle sobre sistemas de recomendação e possibilidade de desativação de funcionalidades."

Observe ainda que o art. 8º **não está** na lista de modulação do art. 39 — ou seja, não é sequer
modulável por porte. Uma coisa é discutir se o **canal do YouTube** é "produto ou serviço de tecnologia da
informação" nos termos do art. 2º, I (questão interpretativa legítima, que o memo nem levanta); outra é o
memo afirmar que o §3.1 é o mapa do que incide e omitir treze dispositivos. **O §3.1 precisa de correção
antes de virar insumo de decisão.**

---

## 2. Ataque nº 6 — tentar refutar o BLOQUEIO do Google

**Este é o achado de maior valor desta verificação — e ele vai na direção contrária à que o memo esperava.**

O memo trata como `NÃO VERIFICADO` (item 3 do §1.2, §4.3, §6.1.3, §8.1) a existência de cláusula
equivalente nos termos do **Vertex AI / Gemini Enterprise**, e diz que essa é "a pergunta que decide se a
opção (a) pode manter o Veo no pipeline da Luna".

**Verifiquei: a cláusula existe no Google Cloud Service Specific Terms, e é mais ampla que a da Gemini API.**
Citação literal (seção 20 — "Generative AI Services", anteriormente "Section 19"):

> **d. _Age Restrictions_.** Customer will not, and will not allow End Users to, use a Generative AI Service
> as part of a website, **Customer Application**, or **other online service** that is directed towards or is
> likely to be accessed by individuals under the age of 18.

E ainda, no mesmo bloco:

> **f. _Suspected Violations_.** Google may immediately suspend or terminate Customer's use of a Generative
> AI Service based on any suspected violation of Section 17(b) or subsection (d) above.
> **g. _Restrictions_.** The restrictions contained in subsections (d) and (e) above are deemed to be
> "Restrictions" or "Use Restrictions" under the applicable Agreement.

— https://cloud.google.com/terms/service-terms (seção 20; lida na íntegra pelo texto renderizado da página)

Consequências para o memo:

1. **A opção (e) e o §5(a) mudam de figura.** O memo deixou aberta a possibilidade de manter o Veo por
   Vertex. Não há essa saída: a redação do GCP fala em "**Customer Application**" e "**other online
   service**" — se o canal publicado conta como "API Client" da Gemini API (leitura b2 do memo), ele conta
   *a fortiori* como "Customer Application"/"online service" aqui. A ambiguidade b1/b2 do §2.3 **não
   desaparece** com a troca de path.
2. **Procurei exceção e não existe.** Varri o documento por "parental", "guardian", "education", "family",
   "prior written approval", "waiver": **zero** ocorrências aplicáveis à age restriction. Não há caminho de
   exceção, aditivo ou aprovação para a §20(d).
3. **Testei a única brecha textual plausível e ela não alcança a cláusula.** A *Generative AI Prohibited
   Use Policy* (incorporada ao GCP por §20(c) e à Gemini API por referência) termina com:
   > "We may make exceptions to these policies based on educational, documentary, scientific, or artistic
   > considerations [...]"
   — https://policies.google.com/terms/generative-ai/use-policy (Last Modified: December 17, 2024).
   Essa exceção é das **Prohibited Use Policies**, não da cláusula de idade, que vive em dispositivo
   próprio ("Age Requirements" na Gemini; §20(d) no GCP). **Tentativa de refutação falhou.**
4. **Reforcei o lado do memo com prova adicional de que o Google se recusa a esclarecer.** Em dois tópicos
   oficiais do fórum Google AI Developers (28 e 30/09/2026), moderadores do Google respondem pedidos de
   interpretação exatamente desta cláusula com:
   > "We can't provide specific legal guidance on this forum. Please refer to the documents below: Gemini
   > API Additional Terms of Service (Age Requirements; Use Restrictions; Paid Services), Available regions,
   > Google APIs Terms of Service."
   — https://discuss.ai.google.dev/t/does-byok-allow-gemini-api-use-in-an-app-likely-to-be-accessed-by-under-18-students/185614
   — https://discuss.ai.google.dev/t/gemini-developer-api-age-requirements-for-an-adult-only-qr-accessed-web-service/184622
   Em outro tópico **sem resposta** (28/08/2026), foi exatamente esse o Q3 do usuário:
   > "Does Vertex AI (Google Cloud) carry the same restriction? The Google Cloud Service Specific Terms
   > appear to contain similar language about services 'likely to be accessed by individuals under the age
   > of 18.'"
   — https://discuss.ai.google.dev/t/age-restrictions-in-gemini-api-terms-general-audience-app-rated-3-with-an-adult-only-ai-feature/179916
   Há ainda um caso quase idêntico ao do Rebeca (TTS gerado por adulto, offline, embarcado como asset em
   app infantil 4–9 anos) também **sem resposta oficial**:
   https://discuss.ai.google.dev/t/gemini-api-age-restriction-may-static-tts-audio-generated-offline-by-an-adult-ship-inside-a-childrens-learning-app/186036

**Conclusão do ataque nº 6:** o bloqueio **se sustenta** enquanto **interpretação** — não há cláusula que
autorize uso dirigido a menores, não há exceção, não há canal de aprovação público, e a mudança para
Vertex **não** escapa. O memo errou por **otimismo residual**, não por excesso de cautela: ele subestimou o
alcance do bloqueio. Ver "O que o memo errou ou exagerou", item 5.

---

## 3. Ataque nº 4 — LGPD art. 14 (planalto.gov.br)

**Tentei planalto.gov.br DIRETAMENTE, quatro vezes, em quatro formas de URL:**

| URL tentada | Resultado |
|---|---|
| `https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm` | `fetch failed` |
| `https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709compilado.htm` | `fetch failed` |
| `https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709.htm` | `fetch failed` |
| `https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm` | `fetch failed` |

**A limitação declarada no memo é real e se reproduz.** O que o memo não precisava era depender de extrator
de terceiro: localizei o **texto atualizado oficial** pelo LexML e verifiquei o art. 14 **na fonte oficial
legislativa** (Câmara dos Deputados, norma 787077):

> **Art. 14.** O tratamento de dados pessoais de crianças e de adolescentes deverá ser realizado em seu
> melhor interesse, nos termos deste artigo e da legislação pertinente.
> **§ 1º** O tratamento de dados pessoais de crianças deverá ser realizado com o consentimento específico e
> em destaque dado por pelo menos um dos pais ou pelo responsável legal.
> **§ 2º** No tratamento de dados de que trata o § 1º deste artigo, os controladores deverão manter pública
> a informação sobre os tipos de dados coletados, a forma de sua utilização e os procedimentos para o
> exercício dos direitos a que se refere o art. 18 desta Lei.
> **§ 3º** Poderão ser coletados dados pessoais de crianças sem o consentimento a que se refere o § 1º deste
> artigo quando a coleta for necessária para contatar os pais ou o responsável legal, utilizados uma única
> vez e sem armazenamento, ou para sua proteção, e em nenhum caso poderão ser repassados a terceiro sem o
> consentimento de que trata o § 1º deste artigo.
> **§ 4º** Os controladores não deverão condicionar a participação dos titulares de que trata o § 1º deste
> artigo em jogos, aplicações de internet ou outras atividades ao fornecimento de informações pessoais além
> das estritamente necessárias à atividade.
> **§ 5º** O controlador deve realizar todos os esforços razoáveis para verificar que o consentimento a que
> se refere o § 1º deste artigo foi dado pelo responsável pela criança, consideradas as tecnologias
> disponíveis.
> **§ 6º** As informações sobre o tratamento de dados referidas neste artigo deverão ser fornecidas de
> maneira simples, clara e acessível, consideradas as características físico-motoras, perceptivas,
> sensoriais, intelectuais e mentais do usuário, com uso de recursos audiovisuais quando adequado, de forma
> a proporcionar a informação necessária aos pais ou ao responsável legal e adequada ao entendimento da
> criança.

— https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html
— localizado via https://www.lexml.gov.br/urn/urn:lex:br:federal:lei:2018-08-14;13709

**F7 sai de "fonte fraca declarada" para CONFIRMADO em fonte oficial.** O resumo do memo bate com o texto.

**Duas precisões que o memo não faz:**

- **§ 1º vale para "crianças", não para "crianças e adolescentes".** O caput cobre ambos; a exigência de
  consentimento parental do § 1º fala só de "crianças" (no ECA, art. 2º, criança = até 12 anos incompletos).
  O memo trata "criança" e "adolescente" como bloco único no §3.2. Se a camada Medir capturar dado de
  adolescente de 13–17, o regime **não** é o do § 1º.
- **Existe uma Seção III-A (art. 14-A) na LGPD — VETADA** pela Lei 15.134/2025. Ou seja: houve tentativa
  legislativa de acrescentar dispositivo de aferição etária à LGPD e ela **foi vetada**. É um dado que
  **reforça** a tese do memo e não foi usado.

---

## 4. Ataques nº 2 e nº 3 — cronologia (F13) e números (F12)

### F13 — cronologia: **CONFIRMADO**

Tudo lido na página oficial da ANPD:

- "a [Lei nº 15.211, de 17 de setembro de 2025](...), o Estatuto Digital da Criança e do Adolescente (ECA Digital)"
- "foi editado o [Decreto nº 12.622, de 17 de setembro de 2025](...), que conferiu à ANPD a competência"
- "mudança no regime jurídico da ANPD, que foi transformada em agência reguladora pela [Lei nº 15.352, de 25 de fevereiro de 2026](...)"
- "o [Decreto 12.880, de 18 de março de 2026](...), detalhada as disposições sobre a proteção de crianças e adolescentes em ambientes digitais e institui a Política Nacional"
- "em vigor desde o dia 17 de março"
- Etapa I "A partir de março/2026" — "priorizará o monitoramento de lojas de aplicativos e sistemas operacionais proprietários"
- Etapa II "A partir de agosto/2026"
- Etapa III "Ações de fiscalização [...] **A partir de janeiro/2027**"

— https://www.gov.br/anpd/pt-br/assuntos/eca-digital

**Omissões (não erros):** o cronograma oficial também traz, na Etapa II, "Período de adaptação e
monitoramento de implantação de soluções de aferição de idade — **Agosto - novembro/2026**" e
"Atualização dos Regulamentos de Fiscalização e Aplicação de Sanções Administrativas — **A partir de
novembro/2026**". O memo cita só agosto/2026 para a Etapa II. E existe ainda o **Decreto nº 12.881/2026**
(nova estrutura da ANPD), que o memo não menciona. Nada disso muda a decisão, mas o §7.3 do memo usa a
data de agosto/2026 como gatilho de reavaliação e ignora que os regulamentos de sanção só saem em novembro.

### F12 — números: **CONFIRMADO**, com uma imprecisão

**Art. 35, II (literal):**
> "multa simples, de até 10% (dez por cento) do faturamento do grupo econômico no Brasil no seu último
> exercício ou, **ausente o faturamento**, multa de R$ 10,00 (dez reais) até R$ 1.000,00 (mil reais) por
> usuário cadastrado do provedor sancionado, limitada, no total, a R$ 50.000.000,00 (cinquenta milhões de
> reais) por infração"

O memo escreve "ou R$ 10 a R$ 1.000 por usuário cadastrado" **suprimindo a condição "ausente o
faturamento"**. O texto faz parecer que o critério por usuário é alternativa livre ao percentual de
faturamento; a lei o reserva para quem **não tem faturamento**. Imprecisão que só favorece o otimismo —
num serviço que terá faturamento, a régua aplicável é a do percentual. Fora isso, o teto de R$ 50 mi
"por infração" e os demais números estão certos.

**Art. 31 (literal):** "que possuírem mais de 1.000.000 (um milhão) de usuários nessa faixa etária
registrados" — **CONFIRMADO**.

**Art. 16, parágrafo único (literal):** "o controlador [...] deverá: I – mapear os riscos e envidar esforços
para mitigá-los; e II – elaborar relatório de impacto, de monitoramento e de avaliação da proteção de
dados pessoais" — **CONFIRMADO**.

**Arts. 22 e 26:** art. 22 veda "a utilização de técnicas de perfilamento para direcionamento de publicidade
comercial a crianças e a adolescentes"; art. 26 veda "a criação de perfis comportamentais [...] inclusive
daqueles obtidos nos processos de verificação de idade, bem como de **dados grupais e coletivos**, para fins
de direcionamento de publicidade comercial" — **CONFIRMADO**, e o memo corretamente destaca "dados grupais
e coletivos".

**Inconsistência interna (art. 39):** F11 lista corretamente "arts. 6º, 17, 18, 19, 20, 27, 28, 29, 31, 32
e 40". A linha do art. 39 no §3.1 lista "arts. 6º, 17, 18, 28, 29, 31, 32 e 40" — **faltam 19 e 20**.

---

## 5. Ataque nº 5 — citações literais dos termos dos provedores

### Gemini API Additional Terms — F1, F2, F3, F4: **CONFIRMADOS na letra**

> **Age Requirements**
> You must be 18 years of age or older to use the APIs. You also will not use the Services as part of a
> website, application, or other service (collectively, "**API Clients**") that is directed towards or is
> likely to be accessed by individuals under the age of 18.

> **Use Restrictions**
> Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional
> or business purposes, not for consumer use.

> **Use of Generated Content**
> Some of our Services allow you to generate original content. Google won't claim ownership over that content.

> "For Paid Services, [...] will process your prompts and responses in accordance with the [Data Processing
> Addendum for Products Where Google is a Data Processor]"

Página: "Effective March 23, 2026" / "Last updated 2026-04-28 UTC" — **bate exatamente** com F1.
— https://ai.google.dev/gemini-api/terms (versão EN, lida diretamente; a versão EL, servida por geolocalização, traz o mesmo texto)

**Procurei cláusula de criança/público que o memo tivesse perdido no MESMO documento: não há.** O
documento também diz, sobre escopo:

> "For clarity, these Terms do not govern your direct use of any Google Cloud Platform service (including
> those listed on the Google Cloud Services Summary)."

Frase que **apoia** o memo tratar Vertex como questão separada — e que agora está resolvida (ver §2 acima).

### Runway Usage Policy — F15: **REFUTADO no "apenas"**

A citação do memo é literal e está no lugar certo, com o escopo correto:

> "**Additional Character & Game Worlds Policies** — The policies outlined above apply to Runway Characters
> & Game Worlds. We also prohibit the following **in these products**: [...] Characters or games that are
> intended to engage users under the age of 18, including narrative elements or visual styles intended for
> children [...] Characters based on the face or voice of a person under the age of 18."

**Mas o memo afirma que "restrições a menores aparecem apenas em 'Additional Character & Game Worlds
Policies'". Isso é falso na letra.** O mesmo documento tem uma seção geral, antes dela:

> "**Children's Safety** — We prohibit the following: Content that depicts, facilitates, or promotes child
> sexual abuse or the sexualization of children [...] Content that facilitates minor grooming, including
> generating content designed to impersonate a minor [...] Content depicting child abuse or minor
> participation in harmful or dangerous acts. **We also apply a stricter standard for potential harmful and
> inappropriate content (as outlined below) when a child is depicted.**"

— https://runway.com/safety/usage-policy (Last updated March 6, 2026)

A conclusão substantiva do memo (a vedação de produtos dirigidos a menores é dos Characters & Game Worlds,
não do gerador de vídeo) **se confirma**: a frase "in these products" é literal. E nenhuma das proibições
gerais alcança um canal infantil educativo. Mas o advogado que conferir o "apenas" vai encontrar a
Children's Safety e perder confiança no resto do memo. **Corrigir para "as restrições de público-alvo
aparecem apenas em..."**.

### Runway Enterprise Services Terms — F16: **CONFIRMADO**

> "**3.3 Data Protection.** Runway will process Personal Data [...] in accordance with the DPA between the
> Parties available at https://runway.com/customer-data-processing-addendum.pdf (the "**DPA**"), which is
> incorporated by reference into this Agreement."

> "**5.2 Customer Content.** [...] **Runway may not use Customer Content as training data** for the Services."

> "**3.2 Customer Responsibilities.** Customer is responsible for Inputs [...] Customer is responsible for
> all use of Outputs and evaluating Outputs for legality and appropriateness for Customer's use case"

> "**11.1 Attribution.** Customer agrees that Runway may use Customer's name and logo to indicate that
> Customer is a customer of Runway [...]"

— https://runway.com/enterprise-terms (Last updated June 1, 2026)

Varri o documento por "menor", "criança", "18": **não há cláusula sobre direcionamento a menores** — o
memo está certo.

O "Powered by Runway" também é literal, nos **Terms of Use**, § 1:

> "provided that Your Applications made available to end users **must prominently display 'Powered by
> Runway'** and link to runway.com on applicable user interfaces"

— https://runway.com/terms-of-use (Last updated September 15, 2026)

**Acréscimo que o memo não fez e que muda o peso da opção (a):** os **Terms of Use de consumidor** da
Runway § 4.4 dizem o oposto do Enterprise:

> "You acknowledge that **Inputs and Outputs may be used by the Company to train and improve its AI models**"

Ou seja: a vantagem "não treina com Customer Content" **só existe no contrato Enterprise**. O memo cita
"Runway Enterprise" na opção (a), então está coerente — mas o §7.1 exige ficha de vendor com "uso
comercial" e "público-alvo permitido", e essa distinção Enterprise × consumidor precisa estar escrita.
Os Terms of Use também trazem idade mínima de **13 anos**, com permissão dos pais para menores de 18
(§2.2) — muito mais permissivo que a Gemini, e o memo não usa esse dado.

### OpenAI Services Agreement — F17: **CONFIRMADO** (via extrator; `openai.com` devolveu **HTTP 403** também para mim)

> "**Effective: January 1, 2026**"
> "**3.3 Restrictions.** Customer will not, and will not permit End Users to: [...] (c) **allow minors to
> use OpenAI Services without consent from their parent or guardian**"

> "**4.2 OpenAI Obligations.** [...] OpenAI will not use Customer Content to develop or improve the
> Services, unless Customer explicitly agrees to such use."

> "**10. No Publicity.** Except with express prior written permission in each instance, neither Party will:
> (i) include the other Party's name or logo on their websites, media, or marketing materials [...]"

— https://openai.com/policies/business-terms/ (403 no fetch direto; lido via `r.jina.ai`, mediação de terceiro — mesma fraqueza que o memo declarou)

**Fui além e li as Usage Policies incorporadas** (a §3.3(a) remete a "OpenAI Policies", definidas no §17 como
Service-Specific Terms + Sharing and Publication Policy + Usage Policies). Não há vedação a conteúdo
dirigido a menores; há vedações de expor menores a conteúdo impróprio. **A afirmação do memo se sustenta.**
— https://openai.com/policies/usage-policies/ (via `r.jina.ai`)

### Sora 2 — F18: **CONFIRMADO**

> "The Sora 2 models and Videos API were shut down on **September 24, 2026** and are no longer available.
> **There is no one-to-one replacement API.**"

— https://developers.openai.com/api/docs/models/sora-2.md

### ElevenLabs — F19: **CONFIRMADO**

> "**Last Updated: 31 March 2026**"
> "**1. Eligibility and Use Restrictions** — **(a) Age.** If you are under 18 years of age (or the age of
> legal majority where you live), you may not use our Services"
> "**(c) Use Restrictions.** [...] (i) if you access or use our Services free of charge [...] you may only
> use the Services for non-commercial purposes; (ii) if you access or use our Services through a paid
> subscription plan [...] you may use the Services for commercial purposes"
> "Our [Data Processing Addendum](/dpa), which governs our processing of any personal data contained within
> any content our business clients provide to us"

— https://elevenlabs.io/terms-of-use

**Fui além e li a Prohibited Use Policy incorporada** (o memo leu só a ToS). Nada lá proíbe conteúdo
dirigido a crianças; a §1(b) alcança "material that targets minors **and promotes** sexual material, graphic
violence, obscenity, or other mature themes". A conclusão do memo ("a restrição é sobre quem opera a conta,
não sobre o público do conteúdo") **se sustenta** — mas foi obtida sem ler o documento que efetivamente
trata de conteúdo.
— https://elevenlabs.io/use-policy (Last Updated 17 August 2026)

---

## 6. Itens que permanecem NÃO VERIFICADOS (e por quê)

| Item | O que tentei | Por que continua NÃO VERIFICADO |
|---|---|---|
| **F8** — LGPD art. 5º VI/VII e art. 46 | Leitura da LGPD na Câmara | Só confirmei **art. 6º III e VI** (via ANPD: "o princípio da minimização de dados (ou da necessidade) — conforme definido no Art. 6º, inciso III da LGPD"; "princípios da transparência e da responsabilização e prestação de contas (art. 6º, VI e X)"). **Art. 5º VI/VII e art. 46 não foram lidos na letra.** O memo os cita como "verificado" — **não estão**. |
| **planalto.gov.br** direto | 4 URLs diferentes | `fetch failed` nas quatro. A limitação do memo **se reproduz**; não é desleixo do autor. |
| **ANPD/MJSP PDFs** (Q&A; orientações preliminares; Radar Tecnológico; guia do Decreto) | `web_fetch` direto e via `r.jina.ai` | O fetch direto devolve `unsupported content type "application/pdf"`. O conteúdo que uso acima veio **por extrator de terceiro** (`r.jina.ai`) de PDF oficial — mediação de terceiro, **mesma fraqueza que o memo declarou para a LGPD**. O **texto** é oficial; a **cadeia de custódia da leitura** não é. Reverificar à mão antes de virar cláusula. |
| **Vertex AI** — leitura direta da página | 3 tentativas, incluindo `?hl=en` | A página é JS-rendered e devolveu só a navegação no fetch simples. **O texto da cláusula acima foi obtido pelo renderizador** (`r.jina.ai`) sobre `cloud.google.com/terms/service-terms`. Mesma ressalva de mediação — mas o trecho é inequívoco e está em documento oficial do Google. |
| **MiniMax, Pika, Luma, Alibaba/Wan, Kling** quanto a público-alvo menor | não tentado nesta rodada | Permanece `NÃO VERIFICADO`, como o memo já declara. **É o que impede fechar a D2** — e o memo está certo em dizer isso. |
| Termos da **Google Cloud Acceptable Use Policy** | `services.google.com/fh/files/misc/cloud-acceptable-use-policy.pdf` → HTTP 404 | A AUP do GCP é incorporada pela §20(c) e não foi lida. Não muda a conclusão sobre a age restriction (que está na §20(d), dispositivo separado). |

---

## 7. O que o memo errou ou exagerou

Em ordem de gravidade:

1. **§3.1 — o mapa do ECA Digital é materialmente incompleto.** A conclusão do §3.1 apresenta como
   fechada uma lista de incidência que omite **treze dispositivos** dirigidos exatamente ao mesmo alvo
   (arts. 5º, 6º, 7º, **8º**, 10, 14 § único, 16 caput, 17, 18, 28, 29, 33, 40) e a **avaliação de impacto
   do art. 47 do Decreto**. O art. 8º, V ("informar extensivamente a todos os usuários sobre a faixa etária
   indicada [...] no momento do acesso") e o art. 8º, IV (uso compulsivo) são portas de entrada diretas
   para um canal infantil. E o art. 8º **não é modulável** pelo art. 39. Isto não é detalhe: é a maior
   parte do capítulo que o memo diz ter mapeado.

2. **§3.1, linha do art. 24 — a justificativa está literalmente errada.** "fala de 'usuários ou contas',
   não de público" é refutado pelo próprio caput, que se dirige a "provedores de produtos ou serviços
   **direcionados a crianças e a adolescentes ou de acesso provável por eles**". A razão correta
   (CAPÍTULO IX — redes sociais; enquadramento da ANPD) não é usada.

3. **§3.1, linha do art. 39 — "não como isenção" é o oposto do texto.** O § 1º diz que os provedores de
   serviços com controle editorial "**estarão dispensados do cumprimento das obrigações**" dos arts. 6º,
   17, 18, 19, 20, 27, 28, 29, 31, 32 e 40. O memo nunca menciona o § 1º nem o art. 2º, IX, nem o art. 29,
   § 4º. Perdeu uma hipótese de isenção (ou um risco, se o uso de IA para selecionar conteúdo descaracterizar
   o "controle editorial").

4. **F15 — o "apenas" é falso.** Restrições envolvendo menores existem fora de "Additional Character &
   Game Worlds Policies" (seção "Children's Safety" do topo da Usage Policy da Runway). A conclusão
   substantiva sobrevive; a palavra "apenas" precisa sair.

5. **§4.3 / §6.1.3 / §5(a) / §5(e) / §5.1 — o memo errou por subestimar o bloqueio, não por exagerá-lo.**
   Ele deixou "Vertex AI / Gemini Enterprise" como a pergunta que decidiria se o Veo pode ficar no pipeline
   da Luna. A resposta é que a **mesma restrição existe lá, com redação mais ampla** (§20(d) dos Google
   Cloud Service Specific Terms: "Customer Application, or other online service"). A opção (e) "congelar o
   Google na Luna" **não tem a saída que o memo sugere**; e a afirmação de que isso é "o que decide se a
   opção (a) pode manter o Veo" foi respondida **contra** manter o Veo. O memo entregou uma pergunta quando
   já era possível entregar a resposta.

6. **F12 — art. 35, II: supressão da condição "ausente o faturamento".** O memo apresenta a multa por
   usuário cadastrado como alternativa livre ao percentual do faturamento. A lei a reserva para quem não tem
   faturamento. Erro que, num serviço com receita, **subestima** a exposição.

7. **F8 está apresentado como "verificado" sem ter sido lido na letra** (art. 5º VI/VII, art. 46). Só o
   art. 6º III/VI se confirma, e por fonte indireta (ANPD).

8. **F7 e §3.2 — "criança" e "adolescente" tratados como bloco único.** O § 1º do art. 14 da LGPD exige
   consentimento parental para **crianças**; o caput cobre ambos. O §3.2 escreve "consentimento específico e
   em destaque do responsável" para o gatilho "dado pessoal de criança" sem distinguir a faixa.

9. **Inconsistência interna no art. 39:** F11 lista 11 artigos; a linha do §3.1 lista 9 (faltam 19 e 20).

10. **Omissões de cronograma que afetam o gatilho de reavaliação:** o §7.3 reavalia "quando a ANPD ampliar
    a fiscalização da Etapa II — prevista a partir de agosto/2026", mas o cronograma oficial tem período de
    adaptação até **novembro/2026** e atualização dos **regulamentos de sanção a partir de novembro/2026**.
    Reavaliar em agosto é cedo; o marco que muda o risco de sanção é novembro.

11. **Oportunidades não usadas:** (i) a LGPD teve um **art. 14-A vetado** (Lei 15.134/2025) que tentava
    acrescentar dispositivo de aferição etária — reforça a tese do memo e não foi citado; (ii) a Runway
    aceita **13+ com permissão dos pais** nos Terms of Use de consumidor — dado relevante e ausente;
    (iii) os **Terms of Use de consumidor da Runway treinam com Inputs/Outputs** (§4.4), o que torna a
    escolha "Enterprise" uma condição, não uma preferência.

---

## 8. O que o memo acertou

1. **A conclusão que trava a D2 está certa e é sólida: o Google está bloqueado por contrato.** F1 é literal,
   está vigente (23/03/2026, atualizado 28/04/2026) e não tem exceção. O memo acertou em tratá-la como o
   eixo do problema, e em separar **contrato de fornecedor** de **proteção de dados** (§3.3) — separação
   correta e que evita as duas decisões erradas que ele mesmo nomeia.

2. **O art. 9º do ECA Digital realmente não incide.** Não consegui refutar. Li a lei inteira e duas peças
   oficiais da ANPD; a ANPD/MJSP dizem expressamente que a aferição de idade recai sobre "fornecedores de
   conteúdos, produtos ou serviços **proibidos** para crianças e adolescentes". A Luna não é isso. Conclusão
   confirmada, agora com fonte de governo.

3. **O art. 24 também não incide hoje** — embora por razão diferente da que o memo escreveu (é matéria de
   redes sociais e não há conta de menor no desenho atual).

4. **O art. 31 não incide** — o gatilho de 1.000.000 de usuários menores está literalmente no art. 31, e a
   ANPD/MJSP o repetem.

5. **O art. 16, parágrafo único, incide e exige RIPD** — e a ANPD confirma, citando "art. 38 da LGPD e do
   art. 16, parágrafo único, do ECA Digital" como instrumentos de identificação e avaliação de riscos.

6. **A vedação de perfilamento (arts. 22 e 26) é lida com precisão**, inclusive o detalhe decisivo de
   "dados grupais e coletivos" — que é exatamente o que a camada Medir poderia produzir.

7. **A análise b1/b2 do §2.3 está honesta e corretamente calibrada.** O memo não declara o uso "permitido"
   nem "proibido", reconhece que "users" aponta para o público, e entrega a questão ao advogado (§6.1)
   em vez de resolver na engenharia. Isso é o comportamento certo — e o achado do §20(d) do GCP **reforça**
   a leitura (b2), porque lá o texto diz "Customer Application" e "other online service" no lugar de
   "API Client".

8. **A assimetria de risco do §2.5 está certa** — e o achado do GCP torna o custo do erro ainda mais
   assimétrico (não há path alternativo no Google).

9. **A option (b) está bem calibrada:** "Nenhuma das páginas lidas publica processo de exceção para público
   menor". Confirmado e **reforçado**: em dois tópicos oficiais do fórum Google, moderadores responderam
   pedidos idênticos de interpretação com "We can't provide specific legal guidance on this forum" —
   e um caso quase idêntico ao do Rebeca (TTS offline embarcado em app infantil) segue **sem resposta**.
   O §5(b) avisa que perguntar pode "explicitar ao provedor uma prática que ele hoje não enxerga" — risco
   real, e o histórico do fórum é a evidência de que a resposta tende a ser negativa ou evasiva.

10. **O bloqueio honesto da allow-list (§5(a)) está certo:** MiniMax, Pika, Luma e Alibaba quanto a
    público-alvo menor seguem `NÃO VERIFICADO`, e é isso que impede fechar a D2. Também confirmei que
    MiniMax segue ilegível e que os demais não foram lidos.

11. **A disciplina de fontes funciona.** O memo declarou as duas limitações reais (planalto e extrator) e
    **ambas se reproduziram** na minha sessão. Não houve número, data ou citação inventada em nenhum ponto
    que eu tenha conseguido conferir.

---

## 9. Veredito e condição para uso

**`parcialmente refutado`.**

- **O núcleo da decisão D2 é seguro para o humano decidir:** o Gemini está bloqueado para serviço dirigido a
  menores, por cláusula literal e vigente, sem exceção publicada, e **a troca para Vertex AI não escapa**.
  Este último ponto **fortalece** o memo em relação ao que ele mesmo afirmava.
- **O §3.1 não pode ir para o humano como está.** Ele é a resposta a "o que o ECA Digital exige de nós?" e
  omite treze dispositivos aplicáveis, um deles (art. 8º) não modulável, além de errar a justificativa do
  art. 24 e inverter o sentido do art. 39, § 1º.
- **Antes de alimentar a decisão humana, corrigir:** (i) §3.1 completo com arts. 5º–8º, 10, 14, 16 caput,
  17, 18, 28, 29, 33, 40 e Decreto art. 47; (ii) justificativa do art. 24; (iii) art. 39, § 1º e art. 2º, IX;
  (iv) F15 ("apenas"); (v) art. 35, II ("ausente o faturamento"); (vi) mover o item Vertex de
  `NÃO VERIFICADO` para **VERIFICADO — bloqueado**, e reescrever §4.3, §5(a), §5(e), §5.1 e §6.1.3;
  (vii) rebaixar F8 para `NÃO VERIFICADO` no que se refere a art. 5º VI/VII e art. 46.

**O que NÃO está verificado e continua bloqueando:** termos de MiniMax, Pika, Luma, Alibaba/Wan quanto a
público-alvo menor (inalterado); leitura direta de planalto.gov.br (limitação da ferramenta, não do memo);
PDFs oficiais da ANPD (lidos por extrator de terceiro); e a própria cláusula do GCP (lida por renderizador
sobre documento oficial do Google). Nenhum desses é aprovação: todos voltam como pendência.

---

## 10. Rastreabilidade — comandos e URLs usados

```
web_fetch  https://normas.leg.br/api/public/binario/b434eb3c-9e75-41fb-a074-0bacf96bccec/texto   -> HTTP 200 (Lei 15.211/2025 integral)
web_fetch  https://ai.google.dev/gemini-api/terms?hl=en                                          -> HTTP 200 (F1-F4)
web_fetch  https://www.gov.br/anpd/pt-br/assuntos/eca-digital                                    -> HTTP 200 (F13, F14)
web_fetch  https://runway.com/safety/usage-policy                                                -> HTTP 200 (F15)
web_fetch  https://runway.com/enterprise-terms                                                   -> HTTP 200 (F16)
web_fetch  https://runway.com/terms-of-use                                                       -> HTTP 200 ("Powered by Runway", §2.2, §4.4)
web_fetch  https://elevenlabs.io/terms-of-use                                                    -> HTTP 200 (F19)
web_fetch  https://elevenlabs.io/use-policy                                                      -> HTTP 200 (PUP incorporada)
web_fetch  https://openai.com/policies/business-terms/                                           -> HTTP 403
web_fetch  https://r.jina.ai/https://openai.com/policies/business-terms/                         -> HTTP 200 (F17, via extrator)
web_fetch  https://r.jina.ai/https://openai.com/policies/usage-policies/                         -> HTTP 200 (políticas incorporadas)
web_fetch  https://developers.openai.com/api/docs/models/sora-2.md                              -> HTTP 200 (F18)
web_fetch  https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm               -> fetch failed
web_fetch  https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709compilado.htm      -> fetch failed
web_fetch  https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/L13709.htm               -> fetch failed
web_fetch  https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm               -> fetch failed
web_fetch  https://www.lexml.gov.br/urn/urn:lex:br:federal:lei:2018-08-14;13709                  -> HTTP 200 (localizou fontes oficiais)
web_fetch  https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html -> HTTP 200 (F7, LGPD art. 14)
web_fetch  https://www.gov.br/anpd/pt-br/assuntos/eca-digital/perguntas_respostas_eca_digital_30072026.pdf/@@display-file/file -> unsupported content type
web_fetch  https://r.jina.ai/<mesma URL>                                                         -> HTTP 200 (Q&A oficial, via extrator)
web_fetch  https://www.gov.br/anpd/pt-br/assuntos/eca-digital/mecanismos-confiaveis-de-afericao-de-idade-orientacoes-preliminares.pdf/@@display-file/file -> unsupported content type
web_fetch  https://r.jina.ai/<mesma URL>                                                         -> HTTP 200 (orientações preliminares, via extrator)
web_fetch  https://cloud.google.com/terms/service-terms                                          -> HTTP 200 (só navegação; JS-rendered)
web_fetch  https://r.jina.ai/https://cloud.google.com/terms/service-terms                        -> HTTP 200 (ACHADO: §20(d) Age Restrictions)
grep       sobre o texto completo do GCP (spill local)                                           -> 1 ocorrência: "under the age of 18"
grep       sobre o mesmo texto por (parental|guardian|education|family|prior written approval|waiver) -> nenhuma exceção aplicável
web_fetch  https://policies.google.com/terms/generative-ai/use-policy                            -> HTTP 200 vazio
web_fetch  https://r.jina.ai/https://policies.google.com/terms/generative-ai/use-policy          -> HTTP 200 (exceção "educational..." não alcança a age restriction)
web_fetch  https://developers.google.com/terms                                                   -> HTTP 200 (Google APIs ToS; §3(a) define "API Client"; sem cláusula de idade)
web_fetch  https://discuss.ai.google.dev/t/does-byok-.../185614                                  -> HTTP 200 (Google recusa interpretar)
web_fetch  https://discuss.ai.google.dev/t/gemini-developer-api-age-requirements-.../184622      -> HTTP 200 (Google recusa interpretar)
web_fetch  https://discuss.ai.google.dev/t/age-restrictions-.../179916                           -> HTTP 200 (pergunta sobre Vertex, sem resposta)
web_fetch  https://discuss.ai.google.dev/t/gemini-api-age-restriction-...-childrens-learning-app/186036 -> HTTP 200 (caso análogo, sem resposta)
web_fetch  https://r.jina.ai/https://support.google.com/youtube/answer/9528076?hl=pt-BR          -> HTTP 200 (F6)
web_fetch  https://r.jina.ai/https://support.google.com/youtube/answer/9527654?hl=pt-BR          -> HTTP 200 (F5)
web_fetch  https://services.google.com/fh/files/misc/cloud-acceptable-use-policy.pdf             -> HTTP 404 (AUP do GCP não lida)
```
