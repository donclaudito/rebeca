# ADR-006 — Camada de LLM por função: um modelo escolhido para cada trabalho

## Status
**proposto** — implementado e verificado tecnicamente; aguarda decisão humana sobre os pontos
marcados em "Decisões que continuam sendo do dono do produto". A **revisão adversarial do
`rebeca-qa`** está declarada como pendente no fim deste documento.

## Data
2026-10-01

## Contexto

O protótipo era navegável e honesto, mas **inerte**: dez telas, nenhuma chamada de IA, todos os dados
de exemplo. O pedido do dono do produto foi "dar vida e funcionalidade ao app adicionando LLMs
específicas para cada função".

Quatro invariantes do `AGENTS.md` definem o problema antes de qualquer escolha técnica:

1. **nº 1 — aprovação humana antes de publicar.** A IA não pode aprovar, agendar ou publicar.
2. **nº 2 — isolamento entre canais.** Prompt, cache, custo e resultado escopados por canal.
3. **nº 4 — custo é requisito.** Toda geração paga registra custo real em `.rebeca/custos.csv`.
4. **nº 7 — provedores são substituíveis.** Trocar de modelo não pode exigir mudar a UI.

E um quinto, específico deste produto: **nº 6 — conteúdo infantil tem regra própria.**

A pesquisa com fonte primária (`.rebeca/pesquisa/llm-spec-openai-deepseek.md` e
`.rebeca/pesquisa/llm-spec-anthropic-google-openrouter.md`, ambas lidas em 2026-09-30) trouxe três
fatos que mudaram a decisão e **não** eram conhecidos quando o trabalho começou:

- **O Google está vedado na camada de texto, não só na de mídia.** As Gemini API Additional Terms
  (seção "Age Requirements") dizem, literalmente: *"You also will not use the Services as part of a
  website, application, or other service ('API Clients') that is directed towards or is likely to be
  accessed by individuals under the age of 18."* É a mesma cláusula que o `ADR-005` encontrou nos
  modelos de mídia — agora confirmada para LLM. O canal piloto é infantil.
- **A DeepSeek tem cláusula que pode alcançar exatamente o caso da Luna.** Termos §3.4(8) proíbem
  conteúdo *"designed to specifically appeal to or present a persona of any person under the age of
  18"*. O canal tem personagem criança. A leitura jurídica do alcance está pendente.
- **A Anthropic permite explicitamente "products serving minors"**, com salvaguardas e auditoria; e
  as Commercial Terms — que regem uso de API key — não têm cláusula numérica de idade.

Um quarto fato, técnico, também definiu o desenho: **nem todo provedor valida schema**. A OpenAI
aceita JSON Schema com `strict`; a DeepSeek só aceita `json_object`, que garante "JSON válido" mas
**não** aderência ao schema.

Se nada fosse decidido, o app continuaria sem gerar nada — e a pergunta "esse conteúdo valeu a pena?"
seguiria sem custo real para responder.

## Decisão

**1. O registro é por *nível de capacidade*, não por nome de modelo.**
`AiFunctionId` (15 funções **registradas**) → `AiTier` (`raciocinio`, `criativo`, `rapido`,
`visao`) → modelo concreto. O nome do modelo existe **em um único arquivo** (`server/ai/catalog.ts`),
configurável por `REBECA_MODEL_*`. Nem a tela, nem o prompt, nem o contrato conhecem "gpt-…" ou
"claude-…". É o invariante nº 7 virando estrutura em vez de intenção.

**Escopo real hoje:** das 15 funções registradas, **10 têm ponto de entrada na interface**
(`pesquisar-tendencia`, `planejar-pauta`, `melhorar-plano`, `criar-seo`, `revisar-qualidade`,
`revisar-infantil`, `agendar-horario`, `medir-analise`, `monetizacao-veredito`,
`identidade-personagem`). As outras cinco — `criar-roteiro`, `criar-cena`, `criar-thumbnail`,
`aprender-insight` e `marketing-derivados` — estão implementadas, testadas e chamáveis pela API, mas
**ainda não têm botão em tela**. Registrado assim porque "15 funções visíveis" era afirmação falsa: é
o tipo de exagero que faz o time achar que a funcionalidade está entregue quando não está.

A alocação por função segue uma regra explícita: **modelo grande para julgar e criar, modelo pequeno
para classificar e extrair.** Escrever título/descrição/tags é trabalho mecânico: paga-se o modelo
mais barato. Revisar qualidade é julgamento: paga-se o modelo de raciocínio. Onde a documentação
oficial **não** classifica modelo por "escrita criativa" — o caso da OpenAI e da Anthropic — a
decisão **não foi inventada**: usa-se o mesmo modelo de raciocínio e isso está registrado como
`NÃO VERIFICADO` na pesquisa.

**2. A chamada sai do servidor, nunca do navegador.**
`api/ai/*` (função serverless na Vercel) e um middleware do Vite em desenvolvimento executam **a mesma
função** (`server/ai/http.ts`). Chave no navegador é chave pública; uma chave de LLM é gasto direto na
conta do dono.

**3. A saída é validada por JSON Schema no servidor — sempre.**
O schema é enviado ao provedor quando ele souber usá-lo (ganho) e **não depende** disso (garantia).
Saída fora do contrato dispara **uma** tentativa de correção e, se falhar, erro — nunca aproveitamento
parcial. Laço de retry sobre saída inválida é como se queima orçamento.

**4. O prompt é arquivo versionado, e o build prova que não divergiu.**
`.rebeca/prompts/<id>@v<N>.md` é a fonte; `.tools/build_prompts.mjs` gera o módulo que o servidor usa,
com o **sha256** do arquivo de origem. O `pnpm build` roda `--check` e falha se o prompt versionado e o
prompt que executa discordarem.

**5. Custo é medido, não estimado — e nunca inventado.**
Custo real = tokens do `usage` × preço da tabela, e a tabela carrega **URL e data de leitura** por
linha. Casos tratados explicitamente: a DeepSeek publica preço de pico e fora de pico (o horário UTC
decide, e subestimar quebraria o teto diário); o preço da `gemini-3.8-flash` é promocional **até
31/12/2026** e a data está no código para o dia da virada não pegar ninguém de surpresa. Modelo fora
do catálogo **não** ganha preço estimado — e, pela regra 6.1, também **não é chamado** por padrão:
sem preço não há estimativa, e sem estimativa o teto por chamada não teria como ser aplicado.
Custo não verificado entra no livro como **célula vazia**, nunca como `0.000000`: zero é a afirmação
"não custou", e o que se sabe é "não sei". O `rebeca-qa` flagrou o zero falso.

**6. Teto travado antes do gasto, com os números aprovados nesta sessão pelo dono do produto:**
US$ 0,05 por chamada e US$ 1,00 por dia. A estimativa roda **antes** do POST; a chamada que passaria do
teto não é enviada. A tentativa que falhou **também** entra no livro — o provedor cobrou, então omitir
produziria custo fantasma.

**6.1. Modelo sem preço verificado é recusado por padrão.**
O teto é calculado a partir do preço; sem preço não há estimativa, e sem estimativa **a trava por
chamada não se aplica** — a chamada sairia sem teto nenhum. Permitir isso seria abrir um buraco no
invariante nº 4 por um erro de digitação em `REBECA_MODEL_*`. Quem quiser experimentar um modelo novo
liga `REBECA_ALLOW_UNPRICED_MODEL=1` e assume a decisão; nesse caso o custo sai como
`nao-verificado` e a tela diz isso.

**7. Allow-list de fornecedor por canal — não global.**
É o que o `ADR-005` fixou para mídia, aplicado agora ao texto. O servidor decide se o canal é dirigido
a crianças (`server/ai/channels.ts`), não o cliente:

| Fornecedor | Status para canal infantil | Fundamento (fonte lida 2026-09-30) |
|---|---|---|
| Anthropic | `permitido` | AUP tem seção "Products serving minors" que **autoriza**, exigindo salvaguardas; Commercial Terms (que regem API key) não têm cláusula de idade |
| OpenAI | `permitido` | Não veda público-alvo; impõe salvaguardas auditáveis (filtros, verificação de idade, COPPA) |
| DeepSeek | `nao-verificado` | Termos §3.4(8) podem vedar "persona de pessoa menor de 18 anos" — leitura jurídica pendente |
| Google (Gemini) | `restrito-menores` | Cláusula literal veda API Client "directed towards … under the age of 18" |
| OpenRouter | `nao-verificado` | É revenda: §5.8 mantém os Model Terms; **não lava** a restrição de origem |

`nao-verificado` é tratado como **não permitido por padrão** — o custo do erro é assimétrico
(suspensão de conta contra conveniência de escolher fornecedor). Existe
`REBECA_ALLOW_UNVERIFIED_MINOR_POLICY=1` para o dono assumir a decisão **explicitamente**; ela fica
registrada no painel de Configurações. Sem isso, o canal infantil cai em simulação e a tela explica
por quê.

**8. Defesa contra injeção de prompt em três camadas.**
(a) Todo conteúdo externo entra em bloco delimitado, e o delimitador de fechamento é **neutralizado**
dentro dos dados — sem isso, um texto contendo `</dados_do_canal>` escaparia do bloco; (b) o system
prompt declara que o bloco é dado, não ordem; (c) a saída continua validada por schema, e a aprovação
continua humana. O texto hostil **não é apagado** — fica visível como dado, porque auditoria importa.

**9. Provedor simulado com a mesma forma do real.**
Sem chave, o app responde por simulação — e **diz** que é simulação. A saída simulada passa pelo mesmo
schema; é isso que a torna teste de contrato em vez de enfeite. Simulação **não** escreve no livro de
custos: não houve gasto, e gravar linha de custo zero faria "quantas gerações pagas tivemos?" mentir.

**10. A IA nunca aplica sozinha.**
A saída chega para leitura. Quando há formulário de destino, o botão "usar na tela" apenas **preenche**;
gravar continua exigindo o clique humano em "Salvar". Nenhuma função de IA chama `approve`, `reschedule`,
`reject` ou `publish` — e há teste que falha se alguém acrescentar um efeito que permita.

## Revisão adversarial (`rebeca-qa`) — veredito: REFUTADO, e corrigido

Relatório completo em [`docs/qa/QA-006-camada-de-llm.md`](../../docs/qa/QA-006-camada-de-llm.md).
O escopo revisado foi a tabela de "Verificação" acima e as garantias que ela declarava. A decisão
arquitetural em si sobreviveu aos ataques; as **garantias** não — e é isso que importa saber.

O `rebeca-qa` também registrou o problema de método: **o alvo mudou durante a auditoria** (este
documento e o handler foram gravados entre 18:14 e 18:22), então ele pediu reauditoria sobre um alvo
congelado. Pedido legítimo, registrado como pendência.

| # | Gravidade | O que estava errado | O que ficou |
|---|---|---|---|
| QA1 | **alta** | **O teto diário não existia em produção.** Com `VERCEL=1`, `ledgerPath()` é `null` → custo só em memória → cada invocação serverless nasce com gasto zero. N chamadas caras em processos distintos passavam, e o painel informava um gasto que não era o gasto | Geração paga **recusada** onde o livro não é durável, com mensagem dizendo o que fazer; escape explícito `REBECA_ALLOW_NO_LEDGER=1`. Teste cobre |
| QA2 | **alta** | **O leitor do livro era cego ao CSV que o próprio livro escreve.** `spentTodayUsd` usava `split(',')` enquanto `csvCell` cita campos com vírgula. `contentId` sem limite com `\n` fazia ler `0` e **liberar** a chamada; com `,` lia `1000` e travava o dia | Parser de CSV com aspas + quebra de linha neutralizada na escrita + `contentId` limitado a 120 caracteres e alfabeto restrito. Dois testes cobrem |
| QA3 | **alta** | **Injeção não era neutralizada no bloco de dados.** `prompt.ts` neutralizava só o `note`; a entrada era serializada crua, então `roteiroResumo` com `</dados_do_canal>` fechava o bloco de verdade | `neutralize` aplicado ao payload serializado. Teste específico por entrada, não só por recado |
| QA4 | **alta** | **O gate infantil não bloqueava nada.** Ninguém lia `bloqueante`; o schema aceitava `adequado: true` + `bloqueante: true` + achado de gravidade alta | Regras do prompt viraram verificação executável (`semanticErrors`) e a tela de Revisão **trava a aprovação** enquanto o veredito for bloqueante |
| QA5 | media | Custo `nao-verificado` entrava no livro como `0.000000` — zero falso onde saem decisões de negócio | Célula vazia, e o leitor ignora vazio em vez de somar zero |
| QA6 | media | 5 das 15 funções não têm ponto de entrada na UI, e o ADR dizia "15 funções visíveis" | Escopo real declarado no topo deste ADR: 10 com tela, 5 só por API |
| QA7 | media | `provider · model` aparecia na procedência de **toda** tela, contra `docs/04` §5 | Fornecedor, modelo e `promptId` saíram da interface comum; o detalhe técnico ficou só no bloco recolhido de Configurações |
| QA8 | media | O prompt de `criar-seo` pedia capítulos em `mm:ss` sem nomear `tempo`/`rotulo`, que o schema exige com `additionalProperties: false` — saída legítima recusada, custo dobrado | Prompt passa a nomear os dois campos e a permitir lista vazia |
| QA9-13 | baixa | `in` em vez de `hasOwnProperty` no validador (deixava passar `__proto__`); `contentId` de 200 KB; `estimatedCostUsd` morto; `detail` sem higienizar no plugin de dev; caminho absoluto do livro na resposta de status | Todos corrigidos |
| QA14 | baixa | Furos **nos próprios testes**: o de injeção só atacava o `note`; o "teste do hash" não calculava hash (15/15 prompts mutados após o 40º caractere seguiam verdes); o teste do teto lia campo morto; o fixture do teto diário era legível pelo leitor quebrado | Hash agora é **calculado** com `node:crypto`, com teste adicional provando que a checagem não é decorativa; injeção testada pela entrada; fixture com campo entre aspas |

**O que o `rebeca-qa` tentou refutar e NÃO conseguiu** (também é resultado): a decisão de recusar
fornecedor vedado no canal infantil; o gate de preço impedir o POST antes de gastar; o registro de
custo de tentativa que falhou; a redação de segredo em erro do domínio; a migração aditiva do
cabeçalho do livro.

**O que continua em aberto por causa desta revisão:**

1. **Persistir o veredito do gate.** Hoje ele vive no estado da tela: recarregar a página destrava a
   aprovação. Bloqueio que não sobrevive a um F5 é bloqueio fraco. Corrigir exige guardar o resultado
   no conteúdo (camada de dados) e fazer `approve` consultá-lo.
2. **Reauditoria sobre alvo congelado** — o `rebeca-qa` pediu, e o pedido é justo.
3. **Rate limit e autenticação.** O achado QA1 é um sintoma de algo maior: sem auth e sem limite por
   usuário, a única trava de gasto é o teto diário. Ele agora funciona onde o livro é durável, mas
   continua sendo a única barreira numa rota pública.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| **Chamar o provedor direto do navegador** | Exigiria embutir a chave no bundle. Qualquer visitante leria a chave e gastaria na conta do dono. Viola o invariante de segredos |
| **Um modelo só para tudo** | Paga-se caro em extração de metadados (trabalho mecânico) e paga-se barato na revisão de qualidade (trabalho de julgamento). O erro caro é o segundo: reprovar conteúdo ruim é a função que existe para evitar problema |
| **Nome do modelo fixo em cada componente** | Contraria o invariante nº 7: trocar de fornecedor passaria a exigir mudar a UI. É exatamente o acoplamento que o invariante proíbe |
| **Confiar no `strict` do provedor e não validar local** | A DeepSeek não tem `json_schema`, e a Anthropic **não garante** capitalização de `enum`. A garantia tem de ser do produto, não do fornecedor |
| **Estimar custo por caractere e registrar a estimativa** | "Custo é requisito" (invariante nº 4) pede custo real. Estimativa registrada como real é dado falso no lugar de onde saem as decisões de negócio |
| **Não registrar tentativa que falhou** | O provedor cobra a resposta inválida. Omitir criaria custo fantasma — o oposto do invariante nº 4 |
| **Uma allow-list global de fornecedor** | O `ADR-005` já fixou que a restrição é por canal. Global forçaria o canal adulto à regra do infantil (perda de qualidade/custo) ou o inverso (risco contratual) |
| **Bloquear todo fornecedor `nao-verificado` sem escape** | Travaria o produto para quem já tem a chave da DeepSeek, sem dar ao dono a chance de assumir a decisão. O escape existe, é explícito e é registrado |
| **Deixar o prompt em constante TypeScript** | Perde o versionamento em arquivo que a skill `rebeca-prompt-eng` exige, e o histórico de prompt deixa de ser diffável |
| **Não simular nada (só funcionar com chave)** | O app ficaria inútil para demonstrar, e cada `pnpm test` seria decisão de orçamento |

## Consequências

**O que fica fácil**

- Trocar de fornecedor (ou de modelo de um nível) é mudar uma variável de ambiente — sem tocar em tela.
- A restrição contratual é **executável e testada**, não um parágrafo em documento: há teste que falha
  se o Google passar a atender o canal infantil.
- Cada geração tem procedência registrada: prompt e versão, modelo, tokens, custo e onde o custo foi
  gravado. É o que o ciclo Aprender→Melhorar precisa para saber qual prompt gerou o vídeo que performou
  melhor.
- Custo de chamada que falha não desaparece.

**O que fica caro / assumido**

- **Duas tentativas por chamada** quando a saída é inválida. Em provedor sem schema nativo (DeepSeek,
  OpenRouter) isso deve ser mais frequente — e custa o dobro.
- **O teto de US$ 0,05/chamada não cobre tudo por muito tempo.** As estimativas por função são
  baixas hoje porque os prompts são enxutos; prompt que cresça pode esbarrar no teto e a chamada será
  recusada. É o comportamento desejado (recusar é barato; estourar não), mas vai gerar atrito.
- **O livro de custos vai ganhar três colunas** (`tokens_in`, `tokens_out`, `prompt_id`) na
  **primeira chamada paga**. A migração é automática, idempotente e aditiva: as 11 colunas originais
  mantêm nome e ordem, `Import-Csv` continua lendo `custo_usd`, e linha antiga ganha as colunas novas
  vazias — há teste que prova que a linha antiga sobrevive. **Estado atual: o arquivo ainda está com o
  cabeçalho original**, porque nenhuma chave existe e nenhuma chamada paga foi feita. Ver "Decisões que
  continuam sendo do dono".
- **Em serverless o custo não fica durável.** A Vercel não dá disco gravável fora de `/tmp`; o
  resultado devolve `costRecorded: 'memoria'` e a tela avisa "não durável". Memória durável em
  produção exige banco — decisão D1, ainda aberta. **Não fingimos persistência que não existe.**
- **`vitest` neste workspace só roda fora do sandbox confinado.** O carregador de config do Vite faz
  detecção de unidade de rede no Windows via `net use`, e o sandbox bloqueia o `spawn` com `EPERM`.
  Não é defeito do projeto (reproduzido com o `vite.config.ts` original), mas é atrito para quem for
  rodar a suíte em ambiente confinado.

**O que precisa ser revisitado**

- **Quando os termos da DeepSeek §3.4(8) forem lidos por jurista:** o status `nao-verificado` vira
  `permitido` ou `restrito-menores`. O lugar é `server/ai/catalog.ts`, campo `minorPolicy`.
- **Quando a promoção da `gemini-3.8-flash` vencer (01/01/2027):** `effectivePrice` já aplica o preço
  cheio, mas o valor deve ser reconferido na fonte.
- **Se a DeepSeek mudar a janela de pico:** o preço do livro fica desalinhado. A janela está em
  `deepseekIsPeak`, com fonte e data.
- **Quando o Supabase entrar (D1):** o livro de custos e o registro de aprovação vão para tabela, e
  `server/ai/channels.ts` passa a ler a tabela `channels` em vez da lista espelhada.
- **Antes de considerar isto pronto para produção:** falta autenticação. `channelId` é **conferido**
  contra a lista do servidor, mas isso **não é autorização** — quem alcança a função serverless pode
  chamar qualquer canal da lista. Está escrito no cabeçalho de `server/ai/channels.ts` para não virar
  suposição.

## Decisões que continuam sendo do dono do produto

1. **O teto de gasto.** Os valores (US$ 0,05/chamada, US$ 1,00/dia) foram escolhidos pelo dono nesta
   sessão, entre três opções apresentadas. Seguem valendo como decisão humana revogável — estão em
   `src/ai/limits.ts`, não em variável de ambiente, justamente para que mudá-los exija revisão.
2. **O escape `REBECA_ALLOW_UNVERIFIED_MINOR_POLICY`.** Desligado por padrão. Ligar significa usar, no
   canal infantil, fornecedor cujo termo não foi verificado para serviço dirigido a menores.
2.1. **O escape `REBECA_ALLOW_UNPRICED_MODEL`.** Desligado por padrão. Ligar significa chamar um modelo
   que **não tem teto de custo** enquanto não entrar no catálogo com preço e fonte.
3. **As três colunas novas em `.rebeca/custos.csv`.** A mudança é aditiva e testada, mas o arquivo é
   lido por `rebeca-analytics` — quem consome precisa saber que `tokens_in`, `tokens_out` e `prompt_id`
   passam a existir a partir da primeira chamada paga.
4. **Nome de fornecedor na tela de Configurações.** A regra de `docs/04` §5.5 diz "interface sem termo
   interno (nome de provedor)". Nesta tela, o nome aparece **dentro de um bloco recolhido, marcado como
   detalhe técnico**, porque esconder qual fornecedor atende o canal infantil tornaria invisível uma
   restrição contratual. Se o dono preferir ocultar até isso, é uma linha a remover — mas então a
   informação precisa existir em outro lugar que ele veja.

## Verificação

Ambiente: Node v26.7.0 · pnpm 11.25.0 · Windows.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos (inclui `src`, `server` e `api`) | `pnpm exec tsc --noEmit` | ✅ exit 0, nenhum erro |
| Suíte completa | `pnpm exec vitest run` | ✅ **106/106 em 11 arquivos**, 60,47s — `.rebeca/evidencias/vitest-ia.txt` |
| Prompts em sincronia | `node .tools/build_prompts.mjs --check` | ✅ `OK: prompts em sincronia` |
| Geração ponta a ponta (HTTP real) | `POST http://127.0.0.1:5199/api/ai/generate` com `medir-analise` | ✅ 200, saída no schema, `provider=simulado`, `costSource=nao-verificado`, `costRecorded=nenhum` |
| Estado do motor (HTTP real) | `GET /api/ai/status` | ✅ 200, 5 fornecedores com `minorPolicy` e `allowedForChildDirected`, tetos e livro |
| Isolamento — pedido sem canal | `POST /api/ai/generate` sem `channelId` | ✅ HTTP 400 `canal-obrigatorio` |
| Isolamento — canal inexistente | `POST` com `channelId: canal-fantasma` | ✅ HTTP 400 `canal-desconhecido` |
| Contrato de entrada | `POST` com entrada fora do schema | ✅ HTTP 400 com o campo que faltou |
| Gate infantil | `revisar-infantil` em canal adulto | ✅ HTTP 400 recusado |
| Método errado | `GET /api/ai/generate` | ✅ HTTP 405 |
| **Gate de fornecedor** | teste `handler.test.ts` | ✅ Google e DeepSeek recusados no canal infantil; Anthropic e OpenAI aceitos; canal adulto aceita os mesmos que o infantil recusa |
| **Override não fura o gate** | teste `handler.test.ts` | ✅ `REBECA_MODEL_*` apontando para fornecedor vedado → HTTP 403 `nao-autorizado` |
| **Teto antes do gasto** | teste `handler.test.ts` | ✅ chamada recusada e o transporte do provedor **nunca é chamado** |
| **Teto diário** | teste `handler.test.ts` | ✅ recusa com o livro do dia no limite |
| **Modelo sem preço verificado** | teste `handler.test.ts` | ✅ recusado por padrão (sem preço não há teto); com `REBECA_ALLOW_UNPRICED_MODEL=1` roda e o custo sai `nao-verificado` |
| **Custo real** | teste `handler.test.ts` | ✅ 1M tokens de entrada + 1M de saída no modelo barato = US$ 0,60 exatos |
| **Custo de falha** | teste `handler.test.ts` | ✅ linha gravada com `(falhou)` e as duas tentativas somadas |
| **Injeção de prompt** | teste `handler.test.ts` | ✅ `</dados_do_canal>` no recado humano é neutralizado; o bloco não é fechado |
| **Segredo em erro** | teste `handler.test.ts` | ✅ chave plantada dentro da exceção **não** aparece na mensagem |
| **Migração do livro** | teste `handler.test.ts` | ✅ cabeçalho antigo preservado, linha antiga intacta, colunas novas no fim |
| **Simulação sob contrato** | teste `registry.test.ts` | ✅ a saída simulada das 15 funções passa no schema da própria função |
| **Tela avisa quando é simulação** | teste `AiAction.test.tsx` | ✅ tarja de simulação aparece; resultado real não a exibe |
| **Tela não inventa custo** | idem | ✅ `costSource: nao-verificado` mostra "custo não verificado", nunca um valor |
| **A IA não aplica sozinha** | idem | ✅ `onApply` não é chamado ao receber a resposta; só no clique em "usar na tela" |
| **Erro do servidor chega legível** | idem | ✅ mensagem em pt-BR do servidor é exibida |
| Isolamento de prompt | teste `registry.test.ts` | ✅ nenhum prompt de escopo `*` cita nome de canal |

**Defeitos reais encontrados pela própria verificação** (e corrigidos, não maquiados):

1. **Os guardrails não chegavam ao modelo.** A primeira versão do gerador de prompt extraía apenas as
   seções "Sistema" e "Instrução" e **descartava "Guardrails" em silêncio** — ou seja, a defesa contra
   injeção, o "você não aprova nem publica" e o "não invente número" não eram enviados. O teste de
   contrato pegou. Guardrail que não é enviado é texto decorativo no repositório.
2. **Prompt de escopo global citava um canal.** `identidade-personagem@v1.md` dizia "a Luna parece a
   Luna" — defeito de isolamento (invariante nº 2) que o teste de vazamento pegou.
3. **Override de modelo engolido em silêncio.** A checagem do `REBECA_MODEL_*` usava um mapa que não
   continha Anthropic nem Google, então um override para esses fornecedores era ignorado sem aviso.
4. **Erro inesperado não era higienizado.** Exceção de rede ou de adaptador podia atravessar com URL
   ou cabeçalho contendo a chave. Foi acrescentada uma função de redação, e o teste planta a chave
   dentro do erro para provar que ela não sai.
5. **Preço da DeepSeek invertido.** O catálogo começou com o preço de pico; a doc publica o **dobro**
   em pico, com o valor menor sendo o fora de pico. Subestimar custo quebraria o teto diário.
6. **Campo de tokens do Google renomeado.** A doc atual usa `responseTokenCount`;
   `candidatesTokenCount` é o nome antigo. Ler só o antigo faria o custo virar "não verificado".

**Não verificado / não coberto (declarado, não maquiado):**

> **Isso mudou em 2026-10-01.** Com uma chave paga real cadastrada pela tela de Configurações, os
> itens 1 e 2 deixaram de ser verdade: os adaptadores HTTP foram exercitados contra a API de verdade,
> com custo real registrado no livro. Ver **"Verificação com chave paga real"** no fim deste
> documento — inclusive o defeito de integração que só apareceu ali.

1. **Nenhuma chamada real a provedor foi feita.** Todas as verificações acima usam o provedor
   simulado ou um transporte injetado. **Nenhum token foi gasto, nenhuma chave existe no ambiente.**
   Logo: os adaptadores HTTP reais (OpenAI, DeepSeek, Anthropic, Google, OpenRouter) **não foram
   exercitados contra os endpoints de verdade**. Os fatos de endpoint, header e nome de campo vêm da
   documentação oficial lida em 2026-09-30, não de resposta observada.
2. **A função serverless da Vercel não foi executada.** O caminho `api/ai/*` foi verificado por tipos
   e compartilha a mesma função do middleware de desenvolvimento (que foi exercitada por HTTP), mas
   o runtime da Vercel em si não foi testado. A Vercel emite aviso de que os imports sem extensão do
   grafo de config não são suportados pelo carregador nativo futuro — não afeta `api/`, que é
   empacotado pelo builder de funções, mas **não foi confirmado com deploy**.
3. **Revisão adversarial do `rebeca-qa` não foi executada sobre esta entrega.** Pela regra do projeto
   (quem produz não aprova), isto precisa acontecer antes de a camada ser considerada confiável.
4. **A leitura jurídica do §3.4(8) da DeepSeek está pendente** — e é ela que decide o status daquele
   fornecedor para o canal infantil.
5. **A janela de pico da DeepSeek e a promoção do Google podem mudar sem aviso.** Ambas estão no
   código com fonte e data, e ambas entram na lista de reavaliação obrigatória.
6. **Nenhum teste de render foi escrito para o painel de Configurações.** O `AiAction` tem teste de
   tela (`src/components/ai/__tests__/AiAction.test.tsx`, 6 casos); o painel de status do motor de IA
   tem verificação de tipos apenas.

## Verificação com chave paga real (2026-10-01)

O dono do produto entregou uma **chave paga da OpenAI**, cadastrada pela tela de Configurações
(`ADR-007`). Foi o primeiro gasto real do projeto, e ele respondeu às duas perguntas que ficaram
abertas acima.

**Chave instalada sem passar pelo contexto do agente nem por log**: o script `instalar-chave-ia.mjs`
lê o arquivo, valida o formato e grava direto em `.rebeca/segredos/llm.json` (ignorado pelo git),
imprimindo apenas a máscara. Em nenhum momento o valor apareceu em saída de terminal ou de ferramenta.

### O que ficou provado

| Verificação | Resultado observado |
|---|---|
| Modelos que a conta enxerga | ✅ `GET /v1/models` → **HTTP 200, 133 modelos** |
| **Os IDs do catálogo existem** | ✅ `gpt-6.1-sol`, `gpt-6-luna`, `gpt-6-astra`, `gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-5.4-nano`, `gpt-5-nano` — **todos presentes** |
| Teste de conexão real | ✅ `ok=true`, modelo `gpt-6-luna`, 4.326 ms, **custo real US$ 0,0000048** |
| **Geração real com schema** | ✅ `criar-seo` no canal infantil: 929 tokens de entrada, 269 de saída, **1 tentativa**, 3.651 ms |
| **A conta do custo confere** | ✅ `929 × 0,10/1M + 269 × 0,50/1M = US$ 0,0002274` — exatamente o valor registrado |
| Livro de custos | ✅ duas linhas reais, com `tokens_in`, `tokens_out` e `prompt_id` preenchidos |
| Migração do cabeçalho | ✅ colunas novas acrescentadas no fim, as 11 originais intactas |
| Conteúdo gerado | ✅ título, descrição com gancho de duas linhas, tags e hashtags em pt-BR; `capitulos` como lista vazia, que é o comportamento correto |

O conteúdo produzido foi adequado ao público (3 a 5 anos) e no tom do canal — a camada funciona de
ponta a ponta, com custo medido, não estimado.

### Defeito de integração que só a API real revelou

**O modo `strict` da OpenAI exige que TODA propriedade esteja em `required`.** Requisição recusada com
HTTP 400:

> `Invalid schema for response_format 'resposta': In context=(), 'required' is required to be supplied
> and to be an array including every key in properties. Missing 'hashtags'.`

Vários schemas declaravam campos opcionais (`hashtags`, `capitulos`, `paleta`, `negativePrompt`,
`seed`, `alternativas`, `vocabulario`, `valores`, e `instagram.hashtags`) fora de `required`. Nenhum
teste com provedor simulado pegava — o simulado preenchia tudo de qualquer forma.

**Corrigido na raiz:** o construtor `obj()` passou a **derivar `required` das próprias propriedades**,
e o segundo argumento (que listava um subconjunto) deixou de existir. A consequência de projeto é
boa: "campo sem valor" passa a ser expresso por **valor vazio** (lista vazia, texto vazio), nunca por
ausência de chave — e a ambiguidade entre "não há capítulos" e "o modelo esqueceu de dizer"
desaparece.

### Segurança — o que mudou com uma chave real no ambiente

- **Os testes passaram a vazar para a configuração real.** O `handler.test.ts` isolava o livro de
  custos mas **não** a configuração de IA: numa máquina com chave cadastrada, o teste "sem chave
  nenhuma, responde por simulação" falhava. Pior: um teste futuro poderia ter disparado uma **chamada
  paga de verdade**. Corrigido — todo teste agora redireciona `REBECA_SETTINGS_FILE` para temporário.
  **Teste não pode depender de credencial real nem gastar dinheiro de ninguém.**
- A varredura de segredo segue limpa (204 blobs), e `.rebeca/segredos/` continua ignorado pelo git.

### Continua não verificado

- **Os demais provedores** (Anthropic, DeepSeek, Google, OpenRouter) seguem sem chamada real — só a
  OpenAI foi exercitada.
- **A função serverless da Vercel** continua sem execução em deploy real.
- O **gasto acumulado** desta verificação foi de **menos de US$ 0,001**, muito abaixo do teto diário.

## Quem decidiu

- **Propôs:** implementação conduzida com as skills `rebeca-arquiteto`, `rebeca-prompt-eng`,
  `rebeca-seguranca` e `rebeca-orquestrador`.
- **Fatos de fornecedor levantados por:** dois pesquisadores independentes, cada um com arquivo
  próprio de dossiê, e conferidos por busca independente do orquestrador.
- **Aprova parcialmente (nesta sessão):** o dono do produto escolheu **multi-provedor configurável por
  `.env`**, **proxy no servidor (dev + Vercel)** e o **teto de US$ 0,05/chamada e US$ 1,00/dia**.
- **Aprova (pendente):** os quatro itens de "Decisões que continuam sendo do dono do produto" e a
  revisão do `rebeca-qa`.
