# Especificação verificada das APIs de LLM — Anthropic (Claude), Google (Gemini) e OpenRouter

**Data de leitura de todas as fontes: 2026-09-30** (fuso America/Sao_Paulo).
**Autor:** pesquisa técnica delegada (agente de pesquisa). **Projeto:** Rebeca.

---

## 0. Método, regra de evidência e avisos

**Regra aplicada:** nenhuma afirmação sem URL exata da documentação oficial + data de leitura. O que não pôde ser confirmado está escrito literalmente como `NÃO VERIFICADO`. Não há inferência apresentada como fato.

**Fontes primárias usadas (e mudanças de endereço relevantes):**

| Observação | Detalhe | URL de origem | Lido em |
|---|---|---|---|
| A documentação da Anthropic **mudou de domínio** | `docs.anthropic.com` hoje redireciona para `platform.claude.com`. O redirecionamento cross-origin **não é seguido** automaticamente por ferramentas de fetch; a URL final real da doc é `platform.claude.com/docs/...`. Existe também variante crua em Markdown (`.../messages.md`) | https://docs.anthropic.com/en/api/messages → redireciona para https://platform.claude.com | 2026-09-30 |
| A doc do Google tem **duas superfícies de API** hoje | `models.generateContent` (`/v1beta/{model=models/*}:generateContent`) **e** a nova `interactions` (`POST /v1beta/interactions`). A doc nova de recursos (saída estruturada, imagem, contagem de tokens) publica exemplos na **Interactions API**; a referência antiga `GenerateContent` continua publicada | https://ai.google.dev/api/generate-content · https://ai.google.dev/gemini-api/docs/text-generation | 2026-09-30 |
| Páginas oficiais do Google são muito grandes | Algumas páginas (`/gemini-api/docs/pricing`, `/api/generate-content`) excederam o limite de leitura da ferramenta. **Somente a primeira seção ficou legível.** Isso está declarado item a item como `NÃO VERIFICADO` em vez de preenchido por estimativa | https://ai.google.dev/gemini-api/docs/pricing | 2026-09-30 |
| Fonte complementar oficial do Google quando a página REST não é legível | Quando a página REST não ficou legível, usei a **referência oficial do SDK Google GenAI** (`@google/genai` v2.24.0, publicada pelo Google no GitHub Pages), que documenta os mesmos tipos de requisição/resposta (`GenerateContentConfig`, `UsageMetadata`, `Part`). Cada uso está marcado como "VERIFICADO na referência oficial do SDK", com a ressalva de que a correspondência nome-a-nome com o **JSON REST cru** não foi lida | https://googleapis.github.io/js-genai/release_docs/ | 2026-09-30 |
| Leitura bloqueada em `policies.google.com` e `openrouter.ai/terms` | Parte do §5 foi obtida **renderizando a URL oficial via o proxy `https://r.jina.ai/<url oficial>`**. Isso é leitura da URL oficial **por intermediário** e está marcado com **[VIA RENDERIZADOR]** onde ocorre — confiabilidade menor que a leitura direta | https://policies.google.com/terms/generative-ai/use-policy · https://openrouter.ai/terms | 2026-09-30 |

**Aviso de modelo mental (importante para o Rebeca):** os três provedores mudaram o schema de "saída estruturada" em relação ao que a maioria do conhecimento pré-2025 assume. Na Anthropic o parâmetro **não é** `response_format`; no Gemini a superfície atual é `response_format` dentro de `interactions.create`; no OpenRouter é `response_format` no estilo OpenAI. Ver §1.4, §2.4, §3.4.

---

## 1. Anthropic — Claude (Claude API / first-party)

### 1.1 URL base e endpoint de geração

| Item | Valor | URL de origem | Lido em |
|---|---|---|---|
| Endpoint de geração/chat | `POST https://api.anthropic.com/v1/messages` (a referência escreve `POST /v1/messages`; base = `https://api.anthropic.com`) | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Endpoint de contagem de tokens | `POST https://api.anthropic.com/v1/messages/count_tokens` | https://platform.claude.com/docs/en/build-with-claude/token-counting | 2026-09-30 |
| Endpoint de upload de arquivo (Files API) | `POST https://api.anthropic.com/v1/files` | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Formato ≠ OpenAI | É `/v1/messages` com `messages[]` de blocos e `system` de topo — **não** `/v1/chat/completions` | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |

### 1.2 Autenticação

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Header de chave | `x-api-key: $ANTHROPIC_API_KEY` | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Header de versão **obrigatório** | `anthropic-version`. Valor atual documentado: **`2023-06-01`**. Trecho literal: *"When making API requests, you must send an `anthropic-version` request header. For example, `anthropic-version: 2023-06-01`."* | https://platform.claude.com/docs/en/api/versioning | 2026-09-30 |
| Histórico de versões | `2023-06-01` (atual) e `2023-01-01` (release inicial). A doc diz: *"Anthropic recommends using the latest API version whenever possible. Previous versions are considered deprecated and may be unavailable for new users."* | https://platform.claude.com/docs/en/api/versioning | 2026-09-30 |
| Header de content-type | `content-type: application/json` | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Headers opcionais citados | `anthropic-user-profile-id` (exige beta header `user-profiles`) e `anthropic-workspace-id` | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |

### 1.3 Formato mínimo do corpo — e onde ficam system/user

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Corpo mínimo | `model`, `max_tokens`, `messages[]`. `max_tokens` é **obrigatório** (minimum: 0; `0` serve para pré-aquecer o prompt cache sem gerar resposta) | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Papéis das mensagens | `messages[]` com `role` (`user` / `assistant`) e `content` (string ou array de blocos). Trecho literal: *"Our models are trained to operate on alternating `user` and `assistant` conversational turns."* | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| **`system` é campo de TOPO — CONFIRMADO** | Trecho literal: *"Note that if you want to include a system prompt, you can use the top-level `system` parameter — there is no `"system"` role for input messages in the Messages API."* Tipo: `system: optional string or array of TextBlockParam` | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Limite de mensagens por requisição | *"There is a limit of 100,000 messages in a single request."* | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Exemplo mínimo (literal da doc) | `{"model":"claude-opus-5-5","max_tokens":1024,"messages":[{"role":"user","content":"Hello, Claude"}]}` | https://platform.claude.com/docs/en/build-with-claude/token-counting | 2026-09-30 |
| `temperature` | **Deprecado**: *"Models released after Claude Opus 4.6 do not support setting temperature. A value of 1.0 will be accepted for backwards compatibility, all other values will be rejected with a 400 error."* | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Prefill | Mensagem final com `role: "assistant"` continua a resposta a partir do conteúdo dado | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |

### 1.4 Saída estruturada em JSON (item crítico)

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| **Parâmetro atual (GA)** | **`output_config.format`**, com `{"type": "json_schema", "schema": {…}}`. Aceita **JSON Schema**. Trecho literal: *"Send it in `output_config.format`. The request carries the schema in `output_config.format` with `type: "json_schema"`."* | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Nome do bloco no corpo | `output_config` (campo de topo, `optional OutputConfig`) | https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| Parâmetro antigo | `output_format` está **deprecado**: *"The `output_format` parameter has moved to `output_config.format`, and beta headers are no longer required. The `output_format` parameter is deprecated and will be removed in the future. To use it anyway, add the `structured-outputs-2025-11-13` beta header. Without it, the API returns a 400 error."* | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Ferramenta estrita (complementar) | `tools[].strict: true` — garante validação de schema nos nomes/inputs de ferramentas | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Onde o JSON volta | Bloco de conteúdo `text` da resposta (a doc usa helpers de SDK `parsed_output`) | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Limitações de JSON Schema | Suporta: tipos básicos, `enum`, `const`, `anyOf`/`allOf`, `$ref`/`$defs`/`definitions`, `default`, `required`, `additionalProperties` (**deve** ser `false` em objetos), formatos de string (`date-time`,`time`,`date`,`duration`,`email`,`hostname`,`uri`,`ipv4`,`ipv6`,`uuid`), `minItems` 0/1. **NÃO suporta:** schemas recursivos, tipos complexos em `enum`, `$ref` externo, restrições numéricas (`minimum`,`maximum`,`multipleOf`), restrições de string (`minLength`,`maxLength`), `additionalProperties` ≠ `false` | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Limites de complexidade | Máx. 20 ferramentas `strict` por requisição; máx. 24 parâmetros opcionais somados; máx. 16 parâmetros com união de tipos; timeout de compilação de 180 s | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Custo de token extra | *"Claude automatically receives an additional system prompt explaining the expected output format. This means: Your input token count is slightly higher"* | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Modelos com suporte (lista oficial) | `claude-fable-5-1`, `claude-mythos-5-1`, `claude-fable-5`, `claude-mythos-5`, `claude-mythos-preview`, `claude-opus-5-5`, `claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-5-5`, `claude-sonnet-5`, `claude-sonnet-4-6`, `claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`, `claude-haiku-4-5-20251001` | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |
| Falhas mesmo com schema | `stop_reason: "refusal"` (recusa de segurança — pode não casar com o schema) e `stop_reason: "max_tokens"` (truncado). **Capitalização de `enum`/`const` não é garantida** | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-09-30 |

### 1.5 IDs de modelo atuais (Claude API ID) e categorias

Modelos correntes, com ID literal da tabela oficial:

| Modelo (nome) | Claude API ID | Descrição oficial | URL de origem | Lido em |
|---|---|---|---|---|
| Claude Fable 5.1 | `claude-fable-5-1` | "For demanding reasoning and long-horizon agentic work" | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| Claude Opus 5.5 | `claude-opus-5-5` | "For long-running agentic coding and knowledge work" — a doc recomenda começar por ele na maioria dos workloads | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | "The best combination of speed and intelligence" | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` (alias `claude-haiku-4-5`) | "The fastest model with near-frontier intelligence" | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |

Recomendação por categoria — **somente onde a doc oficial posiciona o modelo**:

| Categoria | ID recomendado (confirmado na doc) | Base literal / observação | URL de origem | Lido em |
|---|---|---|---|---|
| (a) Raciocínio/análise | `claude-opus-5-5` (ponto de partida) ou `claude-fable-5-1` (raciocínio exigente) | *"start with Claude Opus 5.5 for most workloads. Use Claude Fable 5.1 for demanding reasoning and long-horizon agentic work"* | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| (b) Escrita criativa | **NÃO VERIFICADO** | A página oficial de modelos **não posiciona nenhum modelo para escrita criativa**; o posicionamento é por raciocínio/código/velocidade. A única menção a criatividade que encontrei é sobre `temperature` ("closer to 1.0 for creative and generative tasks"), e `temperature` está deprecado nos modelos posteriores ao Opus 4.6 | https://platform.claude.com/docs/en/models/overview · https://platform.claude.com/docs/en/api/messages | 2026-09-30 |
| (c) Classificação/extração barata e rápida | `claude-haiku-4-5-20251001` | *"The fastest model with near-frontier intelligence"*. A doc de custo recomenda: *"Choose Haiku for simple tasks, Sonnet for most production workloads, and Opus for the most complex reasoning"* | https://platform.claude.com/docs/en/models/overview · https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| (d) Visão | Todos os modelos correntes: `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-4-5-20251001` | Trecho literal: *"All current models support text and image input, text output, multilingual capabilities, vision, and tool use."* | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |

### 1.6 Preços (USD por 1M tokens) — tabela oficial

Todos os valores abaixo são da tabela `Model pricing` da página oficial de preços (`/MTok` = por milhão de tokens).

| Modelo | Entrada | Saída | Escrita cache 5m | Escrita cache 1h | Leitura de cache | URL de origem | Lido em |
|---|---|---|---|---|---|---|---|
| Claude Fable 5.1 | $10 | $50 | $12.50 | $20 | $0.25 (0,025×) | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| Claude Opus 5.5 | $4 | $20 | $5 | $8 | $0.20 (0,05×) | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| Claude Sonnet 5.5 | $2 | $10 | $2.50 | $4 | $0.20 (0,1×) | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| Claude Haiku 4.5 | $1 | $5 | $1.25 | $2 | $0.10 (0,1×) | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |

Modificadores confirmados na mesma página (URL e data acima):

| Modificador | Valor |
|---|---|
| Batch API | 50% de desconto em entrada e saída (ex.: Fable 5.1 $5/$25; Opus 5.5 $2/$10; Sonnet 5.5 $1/$5; Haiku 4.5 $0.50/$2.50) |
| Multiplicadores de cache | escrita 5m = 1,25× entrada; escrita 1h = 2× entrada; leitura = 0,1× (0,025× em Fable 5.1; 0,05× em Opus 5.5) |
| Data residency (`inference_geo: "us"`) | 1,1× em todas as categorias, para Claude 4.6 e posteriores |
| Fast mode (Opus 5.5 / Opus 5 / Opus 4.8) | Opus 5.5: $8 entrada / $40 saída. Só na Claude API first-party |
| Contexto longo | 1M de contexto **sem prêmio**: *"A 900k-token request is billed at the same per-token rate as a 9k-token request."* |
| Tokenizer novo (Claude 4.7+) | *"produces approximately 30% more tokens for the same text"* — atenção ao migrar |
| Ferramentas de servidor | web search = **$10 por 1.000 buscas**; web fetch = sem custo adicional; code execution = sem custo quando usada com web search/fetch, senão $0.05/hora por container após 1.550 h grátis/mês |

Observação da própria doc: *"For the most current pricing information, visit claude.com/pricing"* (https://claude.com/pricing).

### 1.7 Campos de contagem de tokens na resposta (custo real)

| Campo | Onde aparece (exemplo literal da doc) | URL de origem | Lido em |
|---|---|---|---|
| `usage.input_tokens` | `"usage": {"input_tokens": 105, ...}` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| `usage.output_tokens` | `"output_tokens": 239` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| `usage.cache_read_input_tokens` | `"cache_read_input_tokens": 7123` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| `usage.cache_creation_input_tokens` | `"cache_creation_input_tokens": 7345` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| `usage.server_tool_use.web_search_requests` | `"server_tool_use": {"web_search_requests": 1}` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| `usage.server_tool_use.web_fetch_requests` | `"web_fetch_requests": 1` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| `usage.server_tool_use.code_execution_requests` | `"code_execution_requests": 1` | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-30 |
| Endpoint de contagem **antes** de enviar | `count_tokens` responde `{ "input_tokens": N }`; é **gratuito** mas tem limite de RPM (Start 5.000 / Build 10.000 / Scale 20.000) | https://platform.claude.com/docs/en/build-with-claude/token-counting | 2026-09-30 |
| Aviso | *"The token count is an estimate. In some cases, the actual number of input tokens used when creating a message might differ by a small amount."* e *"You are not billed for system-added tokens"* | https://platform.claude.com/docs/en/build-with-claude/token-counting | 2026-09-30 |

### 1.8 Imagem na entrada

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Aceita imagem? | Sim | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Como declarar (bloco) | Bloco `{"type":"image","source":{…}}` dentro de `content[]` da mensagem | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| 3 formas de `source` | 1) `{"type":"base64","media_type":"image/jpeg","data":"…"}`; 2) `{"type":"url","url":"https://…"}`; 3) `{"type":"file","file_id":"…"}` (Files API) | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Formatos | `image/jpeg`, `image/png`, `image/gif`, `image/webp` — animações não suportadas (só o 1º quadro) | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Limites de quantidade | 20 por mensagem no claude.ai; **100 por requisição** na API para modelos de contexto 200k; **600 por requisição** para os demais. Acima de 20 imagens na mesma requisição aplica-se limite de dimensão mais estrito (a doc recomenda ≤ 2000 px por lado) | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Limite de dimensão/tamanho | Máx. 8000×8000 px; 10 MB (base64) na Claude API direta; 5 MB no Bedrock/Google Cloud. Limite de requisição: 32 MB nos endpoints padrão | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Custo em tokens da imagem | *"Each patch is a 28×28-pixel block of the image, referred to as a visual token. An image, therefore, costs `⌈width / 28⌉ × ⌈height / 28⌉` visual tokens."* Tetos: tier alta resolução (Claude 4.7+) 2576 px de lado maior e 4784 visual tokens; tier padrão 1568 px e 1568 visual tokens | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Ordem recomendada | *"Claude works best when images come before text."* | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |
| Restrição de uso em imagem | *"Claude cannot be used to name people in images and refuses to do so."* e *"Claude does not process inappropriate or explicit images that violate the Acceptable Use Policy"* | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-09-30 |

### 1.9 Limite de tokens de saída

| Modelo | Máx. de saída (Messages API síncrona) | Contexto | URL de origem | Lido em |
|---|---|---|---|---|
| Claude Fable 5.1 | 128K tokens | 1M | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| Claude Opus 5.5 | 128K tokens | 1M | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| Claude Sonnet 5.5 | 128K tokens | 1M | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |
| Claude Haiku 4.5 | 64K tokens | 200K | https://platform.claude.com/docs/en/models/overview | 2026-09-30 |

Nota oficial: *"On the Message Batches API, Claude Opus 5.5, Claude Opus 5, Claude Sonnet 5.5, Claude Sonnet 5, Claude Opus 4.8, Claude Opus 4.7, Claude Opus 4.6, and Claude Sonnet 4.6 support up to 300k output tokens with the `output-300k-2026-03-24` beta header."* (https://platform.claude.com/docs/en/models/overview, lido em 2026-09-30)


---

## 2. Google — Gemini (Gemini API / Google AI Studio / Generative Language API)

### 2.1 URL base e caminho exato do endpoint

| Superfície | Endpoint exato | URL de origem | Lido em |
|---|---|---|---|
| **GenerateContent (referência clássica)** | `post https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent` | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Parâmetro de caminho | `model` (string, obrigatório), **formato `models/{model}`**. Exemplo literal de REST: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY` | https://ai.google.dev/api/generate-content | 2026-09-30 |
| **Interactions API (superfície nova, usada nos guias atuais)** | `POST https://generativelanguage.googleapis.com/v1beta/interactions` | https://ai.google.dev/gemini-api/docs/text-generation | 2026-09-30 |
| Contagem de tokens | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:countTokens` (exemplo literal com `gemini-3.8-flash`) | https://ai.google.dev/gemini-api/docs/tokens | 2026-09-30 |
| Streaming | `…/{model}:streamGenerateContent` | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Modelo de placeholder | A doc usa `gemini-3.8-flash` como modelo atual nos exemplos; o exemplo de Shell da referência ainda mostra `gemini-2.0-flash` | https://ai.google.dev/api/generate-content · https://ai.google.dev/gemini-api/docs/latest-model | 2026-09-30 |

**Particularidade registrada:** o nome do modelo vai **no caminho** (path parameter `models/{model}`), e não no corpo da requisição. No corpo, o que existe é `contents`.

### 2.2 Autenticação

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Header de chave (forma documentada nos exemplos REST atuais) | `x-goog-api-key: $GEMINI_API_KEY` | https://ai.google.dev/gemini-api/docs/tokens · https://ai.google.dev/gemini-api/docs/text-generation | 2026-09-30 |
| Alternativa por query string | `?key=$GEMINI_API_KEY` (usado no exemplo Shell da referência `generateContent`) | https://ai.google.dev/api/generate-content | 2026-09-30 |
| OAuth 2.0 | A referência de descoberta da API declara escopo `https://www.googleapis.com/auth/devstorage.read_only` e o parâmetro `key`: *"API key. Your API key identifies your project and provides you with API access, quota, and reports. Required unless you provide an OAuth 2.0 token."* A doc tem página de OAuth dedicada | https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta · https://ai.google.dev/gemini-api/docs/oauth | 2026-09-30 |
| Revisão da API observada na descoberta | `"revision": "20260928"`, `"version": "v1beta"`, `"id": "generativelanguage:v1beta"` | https://generativelanguage.googleapis.com/$discovery/rest?version=v1beta | 2026-09-30 |
| Header de versão obrigatório? | **NÃO VERIFICADO** que exista um header equivalente ao `anthropic-version`. Não encontrei header obrigatório de versão nos exemplos oficiais; a versão aparece no caminho (`/v1beta/`) | https://ai.google.dev/api/generate-content | 2026-09-30 |

### 2.3 Formato mínimo do corpo — e onde ficam system/user

| Superfície | Corpo mínimo | Onde fica o system | URL de origem | Lido em |
|---|---|---|---|---|
| `generateContent` | `{"contents":[{"parts":[{"text":"…"}]}]}`. Campo `contents[]` é **obrigatório**: *"Required. The content of the current conversation with the model."* | Campo de **topo** `systemInstruction` (objeto `Content`): *"Optional. Developer set system instruction(s). Currently, text only."* — **não** é uma mensagem com role | https://ai.google.dev/api/generate-content | 2026-09-30 |
| `interactions` | `{"model":"gemini-3.8-flash","input":"…"}` | O exemplo usa `input` (string ou lista de `Content`). **NÃO VERIFICADO** o nome exato do campo de system instruction na Interactions API (não li essa seção) | https://ai.google.dev/gemini-api/docs/text-generation | 2026-09-30 |
| Papéis no `generateContent` | `contents[]` com `role` e `parts[]`; multi-turno é o mesmo campo repetido | — | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Configuração de geração | `generationConfig` (objeto `GenerationConfig`, opcional). Na Interactions API o equivalente é `generation_config` — ex.: `{"thinking_level":"low"}` | https://ai.google.dev/api/generate-content · https://ai.google.dev/gemini-api/docs/text-generation | 2026-09-30 |
| **Campos internos do `GenerationConfig`/`GenerateContentConfig`** | **VERIFICADO na referência oficial do SDK Google GenAI** (`@google/genai` v2.24.0), interface `GenerateContentConfig`, que é o objeto de configuração da geração. Campos relevantes, com a descrição literal de cada um: `maxOutputTokens` — *"Maximum number of tokens that can be generated in the response."*; `responseMimeType` — *"`application/json`: JSON response in the candidates. The model needs to be prompted to output the appropriate response type, otherwise the behavior is undefined."*; `responseSchema` — *"Represents a select subset of an OpenAPI 3.0 schema object. If set, a compatible response_mime_type must also be set."*; `responseJsonSchema` — *"This is an alternative to `response_schema` that accepts JSON Schema. If set, `response_schema` must be omitted, but `response_mime_type` is required."*; `systemInstruction`; `safetySettings`; `tools`; `thinkingConfig`; `toolConfig`; `cachedContent`; `stopSequences`; `seed`; `temperature`; `topP`; `topK`; `candidateCount`; `labels`; `mediaResolution` | https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html | 2026-09-30 |
| Ressalva de nomenclatura REST × SDK | No **SDK** os campos acima ficam em `GenerateContentConfig`. Na **REST**, o objeto de topo é `generationConfig` (confirmado na referência REST: `generationConfig: object (GenerationConfig)`). A correspondência 1:1 de cada nome de campo com o JSON REST cru é a convenção camelCase do SDK e **não foi lida literalmente** na seção REST (que permaneceu além do limite de leitura) → para o JSON REST cru, tratar como **NÃO VERIFICADO**; para o SDK, **VERIFICADO** | https://ai.google.dev/api/generate-content · https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html | 2026-09-30 |
| Outros campos de topo do `generateContent` (confirmados) | `tools[]`, `toolConfig`, `safetySettings[]`, `cachedContent`, `serviceTier` (`"auto"` / `"standard_only"`), `store`, `labels` | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Categorias de segurança | `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT`, `HARM_CATEGORY_DANGEROUS_CONTENT`, `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_CIVIC_INTEGRITY`, `HARM_CATEGORY_JAILBREAK` | https://ai.google.dev/api/generate-content | 2026-09-30 |

### 2.4 Saída estruturada em JSON (item crítico)

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| **Parâmetro na Interactions API (verificado)** | `response_format` com `{"type":"text","mime_type":"application/json","schema": <JSON Schema>}`. **Aceita JSON Schema** — trecho literal do exemplo: `response_format={"type":"text","mime_type":"application/json","schema": Recipe.model_json_schema()}` | https://ai.google.dev/gemini-api/docs/structured-output | 2026-09-30 |
| Aceita JSON Schema? | Sim. A doc abre dizendo: *"You can configure Gemini models to generate responses that adhere to a provided JSON Schema."* E: *"In addition to supporting JSON Schema in the REST API, the Google GenAI SDKs allow defining schemas using Pydantic (Python) and Zod (JavaScript)."* | https://ai.google.dev/gemini-api/docs/structured-output | 2026-09-30 |
| Leitura do resultado | `interaction.output_text` (string JSON), validada no cliente | https://ai.google.dev/gemini-api/docs/structured-output | 2026-09-30 |
| **Parâmetro no `generateContent`** | **VERIFICADO na referência oficial do SDK** (`GenerateContentConfig`): existem **dois** campos alternativos — (1) `responseSchema` (*"a select subset of an OpenAPI 3.0 schema object"*; exige `responseMimeType` compatível) e (2) `responseJsonSchema` (*"accepts JSON Schema"*; a doc lista as palavras-chave suportadas: `$id`, `$defs`, `$ref`, `$anchor`, `type`, `format`, `title`, `description`, `enum` (strings e números), `items`, `prefixItems`, `minItems`, `maxItems`, `minimum`, `maximum`, `anyOf`, `oneOf` (tratado como `anyOf`), `properties`, `additionalProperties`, `required`; e aceita a propriedade não padrão `propertyOrdering`; **se `responseJsonSchema` for usado, `responseSchema` deve ser omitido e `responseMimeType` é obrigatório**). Trecho literal de orientação: *"If `response_schema` doesn't process your schema correctly, try using `response_json_schema` instead."* | https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html | 2026-09-30 |
| Restrições de JSON Schema no `responseJsonSchema` | *"Cyclic references are unrolled to a limited degree and, as such, may only be used within non-required properties… If `$ref` is set on a sub-schema, no other properties, except for those starting as a `$`, may be set."* | https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html | 2026-09-30 |
| Nomes no JSON REST cru do `generateContent` | **NÃO VERIFICADO** (ver ressalva em §2.3) | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Suporte declarado por modelo | A página do modelo `gemini-3.8-flash` lista **Structured outputs: Supported** | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | 2026-09-30 |

> **Alerta para o Rebeca:** os nomes dos campos **foram verificados** na referência oficial do SDK Google GenAI (`maxOutputTokens`, `responseMimeType`, `responseSchema`, `responseJsonSchema`). O que **permanece `NÃO VERIFICADO`** é a correspondência nome-a-nome desses campos com o **JSON REST cru** do `generateContent` — a seção `GenerationConfig` da página `/api/generate-content` não ficou legível. Antes de codar chamadas REST cruas (sem SDK), confirmar esses nomes na fonte. Ver §2.3, §2.4 e §6.1 (L1).

### 2.5 IDs de modelo atuais e categorias

IDs literais confirmados na página oficial de modelos:

| Modelo | ID | Descrição oficial | URL de origem | Lido em |
|---|---|---|---|---|
| Gemini 3.8 Flash | `gemini-3.8-flash` | "Our most intelligent Flash model, engineered for long-horizon software engineering, autonomous agents, and complex enterprise workflows." Stable, atualizado em setembro/2026 | https://ai.google.dev/gemini-api/docs/models · https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | 2026-09-30 |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | "Frontier-class performance rivaling larger models at a fraction of the cost." | https://ai.google.dev/gemini-api/docs/models | 2026-09-30 |
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | "Our fastest, most cost-effective 3.5 model for high-throughput execution." | https://ai.google.dev/gemini-api/docs/models | 2026-09-30 |
| Gemini 3.7 Flash | `gemini-3.7-flash` | "Our previous-generation Flash model for complex coding, agentic workflows, and reliable multi-step execution." | https://ai.google.dev/gemini-api/docs/models | 2026-09-30 |

Recomendação por categoria — **somente onde a doc oficial posiciona o modelo**:

| Categoria | ID recomendado (confirmado na doc) | Base literal / observação | URL de origem | Lido em |
|---|---|---|---|---|
| (a) Raciocínio/análise | `gemini-3.8-flash` | "most intelligent Flash model… long-horizon software engineering, autonomous agents, and complex enterprise workflows"; nível de raciocínio ajustável `low`/`medium`(padrão)/`high` | https://ai.google.dev/gemini-api/docs/latest-model | 2026-09-30 |
| (b) Escrita criativa | **NÃO VERIFICADO** | A doc oficial de modelos posiciona por capacidade (código, agentes, raciocínio, preço/velocidade). Não encontrei posicionamento oficial de um modelo Gemini para escrita criativa | https://ai.google.dev/gemini-api/docs/models | 2026-09-30 |
| (c) Classificação/extração barata e rápida | `gemini-3.1-flash-lite` (ou `gemini-3.5-flash-lite`) | "Frontier-class performance rivaling larger models at a fraction of the cost" / "fastest, most cost-effective 3.5 model for high-throughput execution" | https://ai.google.dev/gemini-api/docs/models | 2026-09-30 |
| (d) Visão | `gemini-3.8-flash` | Página do modelo, campo "Supported data types" → **Inputs: Text, Image, Video, Audio, and PDF**; e "Structured outputs: Supported" | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | 2026-09-30 |

**NÃO VERIFICADO:** não confirmei se existe um "Gemini 3.8 Pro" ou equivalente Pro de raciocínio na listagem atual — a página de modelos foi truncada antes do fim da seção "Gemini 3". Portanto **não afirmo** a existência nem o ID de um modelo Pro de texto.

### 2.6 Preços (USD por 1M tokens)

| Modelo | Entrada | Saída (inclui tokens de raciocínio) | Cache de contexto | URL de origem | Lido em |
|---|---|---|---|---|---|
| `gemini-3.8-flash` | **$0.75** até 31/12/2026 — **$1.50** a partir de 01/01/2027 | **$3.75** até 31/12/2026 — **$7.50** a partir de 01/01/2027 | $0.075 até 31/12/2026 — $0.15 depois | https://ai.google.dev/gemini-api/docs/pricing · https://ai.google.dev/gemini-api/docs/latest-model | 2026-09-30 |
| Demais modelos Gemini (Flash-Lite, Flash anteriores, Pro, imagem) **na fonte oficial do Google** | **NÃO VERIFICADO** | **NÃO VERIFICADO** | **NÃO VERIFICADO** | https://ai.google.dev/gemini-api/docs/pricing (página excedeu o limite de leitura; só a seção do Gemini 3.8 Flash ficou legível) | 2026-09-30 |

Trecho literal da doc de preços (tabela "Standard", tier pago): *"Input price — Free of charge (Free Tier) / $0.75 through December 31, 2026. $1.50 starting January 1, 2027."* e *"Output price (including thinking tokens) — $3.75 through December 31, 2026. $7.50 starting January 1, 2027."*

Outros fatos de cobrança confirmados:

| Item | Valor | URL de origem | Lido em |
|---|---|---|---|
| Tier gratuito | "Free input & output tokens" e *"Content used to improve our products"* | https://ai.google.dev/gemini-api/docs/pricing | 2026-09-30 |
| Tier pago | "Content **not** used to improve our products"; "Batch API (50% cost reduction)" | https://ai.google.dev/gemini-api/docs/pricing | 2026-09-30 |

### 2.7 Campos de contagem de tokens usados na resposta

| Superfície | Campos (nomes exatos da doc) | URL de origem | Lido em |
|---|---|---|---|
| Interactions API — `interaction.usage` | `total_input_tokens` (entrada), `total_output_tokens` (saída), `total_thought_tokens` (raciocínio), `total_cached_tokens` (conteúdo em cache), `total_tool_use_tokens` (uso de ferramenta), `total_tokens` (total) | https://ai.google.dev/gemini-api/docs/tokens | 2026-09-30 |
| `generateContent` (REST clássico) — objeto `usageMetadata` | **VERIFICADO na referência oficial do SDK** (interface `UsageMetadata`), nomes exatos: `promptTokenCount` (*"The total number of tokens in the prompt. This includes any text, images, or other media provided in the request. When `cached_content` is set, this also includes the number of tokens in the cached content."*), `responseTokenCount` (*"Total number of tokens across all the generated response candidates."*), `thoughtsTokenCount` (*"The number of tokens that were part of the model's generated 'thoughts' output, if applicable."*), `cachedContentTokenCount`, `toolUsePromptTokenCount`, `totalTokenCount` (*"This is the sum of `prompt_token_count`, `candidates_token_count`, `tool_use_prompt_token_count`, and `thoughts_token_count`."*), `promptTokensDetails[]`, `responseTokensDetails[]`, `cacheTokensDetails[]`, `toolUsePromptTokensDetails[]` (detalhamento por modalidade), `serviceTier` | https://googleapis.github.io/js-genai/release_docs/interfaces/types.UsageMetadata.html | 2026-09-30 |
| **Atenção — campo renomeado** | O campo de saída hoje se chama **`responseTokenCount`** (antes documentado como `candidatesTokenCount`, que aparece apenas na descrição da soma de `totalTokenCount`). Ao ler respostas legadas, `candidatesTokenCount` pode ainda aparecer | https://googleapis.github.io/js-genai/release_docs/interfaces/types.UsageMetadata.html | 2026-09-30 |
| Nomes no JSON REST cru do `generateContent` | **NÃO VERIFICADO** (ver ressalva em §2.3) | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Endpoint de contagem prévia | `count_tokens` "Returns the total number of tokens in the input only" | https://ai.google.dev/gemini-api/docs/tokens | 2026-09-30 |
| Ordem de grandeza | *"For Gemini models, a token is equivalent to about 4 characters. 100 tokens is equal to about 60-80 English words."* | https://ai.google.dev/gemini-api/docs/tokens | 2026-09-30 |

### 2.8 Imagem na entrada

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Aceita imagem? | Sim | https://ai.google.dev/gemini-api/docs/image-understanding | 2026-09-30 |
| Como declarar (Interactions API — verificado) | Parte de entrada com tipo imagem: `{"type":"image","uri": uploaded_file.uri,"mime_type": uploaded_file.mime_type}`, combinada com `{"type":"text","text":"Caption this image."}` no array `input` | https://ai.google.dev/gemini-api/docs/image-understanding | 2026-09-30 |
| Formas de entrada | *"Passing image using URL… Passing inline image data… Uploading images using the File API"* (a doc recomenda a Files API para arquivos grandes ou reuso) | https://ai.google.dev/gemini-api/docs/image-understanding | 2026-09-30 |
| **Campos de imagem no `generateContent` REST — VERIFICADOS na referência oficial do SDK** | A interface oficial `Part` define exatamente dois campos de mídia: `inlineData` — *"Optional. The inline data content of the part. This can be used to include images, audio, or video in a request."* (tipo `Blob`) e `fileData` — *"Optional. The URI-based data of the part. This can be used to include files from Google Cloud Storage."* (tipo `FileData`). A doc alerta: *"Exactly one field within a Part should be set… Using multiple fields within the same `Part` instance is considered invalid."* Também existe `mediaResolution` (*"Media resolution for the input media."*) e `videoMetadata` (*"The metadata should only be specified while the video data is presented in inline_data or file_data."*) | https://googleapis.github.io/js-genai/release_docs/interfaces/types.Part.html | 2026-09-30 |
| Nomes no JSON REST cru | **NÃO VERIFICADO** (convenção do SDK; ver ressalva em §2.3) | https://ai.google.dev/api/generate-content | 2026-09-30 |
| Formatos/tamanhos aceitos | **NÃO VERIFICADO** (não li a seção de limites da página de image understanding) | https://ai.google.dev/gemini-api/docs/image-understanding | 2026-09-30 |
| Modelo de visão confirmado | `gemini-3.8-flash` — Inputs: Text, Image, Video, Audio, and PDF | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | 2026-09-30 |

### 2.9 Limite de tokens de saída

| Modelo | Limite de entrada | Limite de saída | URL de origem | Lido em |
|---|---|---|---|---|
| `gemini-3.8-flash` | 1.048.576 | **65.536** | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | 2026-09-30 |
| Outros modelos | **NÃO VERIFICADO** (as páginas individuais dos outros modelos não foram lidas) | **NÃO VERIFICADO** | https://ai.google.dev/gemini-api/docs/models | 2026-09-30 |

A doc também expõe esses números programaticamente: *"`Input token limit` / `Output token limit`"* via `modelInfo.InputTokenLimit` e `modelInfo.OutputTokenLimit` (https://ai.google.dev/gemini-api/docs/tokens, lido em 2026-09-30) — caminho recomendado para o Rebeca manter a tabela atualizada sem depender de scraping da doc.

---

## 3. OpenRouter

O OpenRouter é um **roteador multi-provedor** com schema normalizado no estilo OpenAI. Isso significa: você escreve uma vez no formato OpenAI e ele traduz para a API nativa de cada provedor (Anthropic Messages, Gemini, etc.).

### 3.1 URL base e endpoint de geração

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Base | `https://openrouter.ai/api/v1` (servidor de produção declarado no OpenAPI) | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| **Endpoint de chat/geração** | `POST https://openrouter.ai/api/v1/chat/completions` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Listagem de modelos (pública) | `GET https://openrouter.ai/api/v1/models` (params: `q`, `limit` máx. 1000, `offset`, `sort`, `input_modalities`, `output_modalities`, `category`, `supported_parameters`, `min_price`/`max_price`, `zdr`, `region`, …) | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Estatísticas de uma geração | `GET https://openrouter.ai/api/v1/generation?id=$GENERATION_ID` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Limites/créditos da chave | `GET https://openrouter.ai/api/v1/key` | https://openrouter.ai/docs/api_reference/limits | 2026-09-30 |
| Outras superfícies citadas | Existem também `/v1/messages` (Anthropic Messages), `/v1/responses` (compatível com OpenAI Responses) e `/v1/embeddings`, usados pelo Batch API | https://openrouter.ai/docs/api/api-reference/batch/create-a-batch | 2026-09-30 |
| Especificação OpenAPI oficial | `https://openrouter.ai/openapi.yaml` e `https://openrouter.ai/openapi.json` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |

### 3.2 Autenticação

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Header de chave | `Authorization: Bearer <OPENROUTER_API_KEY>` — trecho literal: *"Our API authenticates requests using Bearer tokens."* | https://openrouter.ai/docs/api_reference/authentication | 2026-09-30 |
| Header obrigatório de versão? | **Não existe** equivalente ao `anthropic-version`. A autenticação é só o Bearer | https://openrouter.ai/docs/api_reference/authentication | 2026-09-30 |
| Headers **opcionais** de atribuição | `HTTP-Referer` (identifica seu app), `X-OpenRouter-Title` (título do app; `X-Title` também aceito), `X-OpenRouter-Categories` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `Content-Type` | `application/json` | https://openrouter.ai/docs/api_reference/authentication | 2026-09-30 |
| Definição formal | `securitySchemes.apiKey`: *"API key as bearer token in Authorization header"*, `scheme: bearer`, `type: http` | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Aviso de segurança da doc | *"API keys on OpenRouter are more powerful than keys used directly for model APIs."* e *"We recommend setting a credit limit on every key."* | https://openrouter.ai/docs/api_reference/authentication | 2026-09-30 |

### 3.3 Formato mínimo do corpo — system e user

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Corpo mínimo | `{"model":"<author>/<slug>","messages":[{"role":"user","content":"…"}]}`. O schema diz: *"Either `messages` or `prompt` is required"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Onde fica o system | **Como mensagem**, com `role: "system"` dentro de `messages[]`: `{"role":"system","content":"You are a helpful assistant."}` — ao contrário da Anthropic | https://openrouter.ai/docs/api_reference/authentication | 2026-09-30 |
| Papéis aceitos | `user`, `assistant`, `system`, `tool`. `ContentPart[]` (multimodal) é permitido **apenas** no papel `user` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Prefill (continuação) | Basta incluir uma mensagem `role: "assistant"` no fim de `messages` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Parâmetros de amostragem | `temperature` [0,2], `top_p` (0,1], `top_k` [1,∞), `frequency_penalty` [-2,2], `presence_penalty` [-2,2], `repetition_penalty` (0,2], `seed`, `stop`, `stream`, `max_tokens` (range `[1, context_length)`), `tools`, `tool_choice`, `logit_bias`, `min_p`, `top_a`, `prediction` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Parâmetros só do OpenRouter | `models[]` (fallback), `route: 'fallback'`, `provider` (preferências de roteamento), `user` (identificador do usuário final), `plugins[]` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Comportamento com parâmetro não suportado | *"If the chosen model doesn't support a request parameter …, then the parameter is ignored."* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |

### 3.4 Saída estruturada em JSON (item crítico)

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| **Parâmetro** | `response_format` — dois modos | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Modo 1 — JSON básico | `{"type":"json_object"}` — *"Basic JSON mode - the model will return valid JSON"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Modo 2 — **JSON Schema estrito** | `{"type":"json_schema","json_schema":{"name":"…","strict":true,"schema": <JSON Schema>}}` — *"Strict schema mode - the model will return JSON matching your exact schema"* | https://openrouter.ai/docs/api_reference/overview · https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |
| Aceita JSON Schema? | **Sim** | https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |
| **Ressalva crítica sobre `strict`** | Trecho literal: *"Set `strict: true` so that providers with a native strict mode enforce your schema exactly. **Enforcement varies by provider: some guarantee schema-conforming output, while others translate your schema into their own structured-output format or treat it as a strong hint, so exact compliance is not guaranteed on every endpoint.**"* | https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |
| Suporte é por **endpoint**, não por modelo | *"Support is determined per endpoint, not just per model… To see which providers support structured outputs for a specific model, check the `structured_outputs` parameter in the Providers section of the model's page."* | https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |
| Como forçar rota compatível | *"Set `require_parameters: true` in your provider preferences… Include `response_format` and set `type: json_schema` in the required parameters"* | https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |
| Valores de `supported_parameters` que sinalizam suporte | `response_format` e `structured_outputs` (enum oficial de parâmetros) | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Streaming com saída estruturada | Suportado (`stream: true` + `response_format`) | https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |
| Plugin opcional de reparo | `response-healing` — *"reduce the risk of invalid JSON when models return imperfect formatting"* | https://openrouter.ai/docs/guides/features/structured-outputs | 2026-09-30 |

### 3.5 IDs de modelo atuais e categorias

**Formato do ID:** `<autor>/<slug>`. *"remember to select a value for `model` from the supported models … and include the organization prefix."* (https://openrouter.ai/docs/api_reference/overview, lido em 2026-09-30)

IDs confirmados consultando ao vivo o endpoint público `GET /api/v1/models` (URLs de origem e leitura em 2026-09-30):

| Categoria | ID OpenRouter confirmado | Evidência (campo do JSON) | URL de origem |
|---|---|---|---|
| (a) Raciocínio/análise (Claude) | `anthropic/claude-opus-5.5` | `"reasoning":{"mandatory":true,"supported_efforts":["max","xhigh","high","medium","low"],"default_effort":"high"}` | https://openrouter.ai/api/v1/models?q=claude |
| (a) Raciocínio/análise (Gemini) | `google/gemini-3.8-flash` | `"reasoning":{"mandatory":true,"default_effort":"medium","supported_efforts":["high","medium","low"]}` | https://openrouter.ai/api/v1/models?q=gemini |
| (a) Alternativa | `anthropic/claude-fable-5.1` | `"reasoning":{"mandatory":true,…}`; é o modelo de raciocínio exigente da Anthropic | https://openrouter.ai/api/v1/models?q=claude |
| (b) Escrita criativa | **NÃO VERIFICADO** | O endpoint expõe o filtro `category` com o valor `roleplay` e o valor `marketing`, mas **eu não consultei** esses filtros; não afirmo quais IDs retornam | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties |
| (c) Classificação/extração barata e rápida | `anthropic/claude-haiku-4.5` | Preço mais baixo da família Claude no catálogo: `"pricing":{"prompt":"0.000001","completion":"0.000005"}`; contexto 200k | https://openrouter.ai/api/v1/models?q=claude |
| (c) Alternativa mais barata | `google/gemini-3.5-flash-lite` | `"pricing":{"prompt":"0.0000003","completion":"0.0000025"}`; `"default_effort":"minimal"` | https://openrouter.ai/api/v1/models?q=gemini |
| (c) Alternativa mais barata ainda | `google/gemini-2.5-flash-lite` | `"pricing":{"prompt":"0.0000001","completion":"0.0000004"}` — atenção: `"expiration_date":"2026-10-20"` | https://openrouter.ai/api/v1/models?q=gemini |
| (d) Visão | `anthropic/claude-haiku-4.5` | `"architecture":{"input_modalities":["text","image","file"]}` | https://openrouter.ai/api/v1/models?q=claude |
| (d) Visão (multimodal amplo) | `google/gemini-3.8-flash` | `"input_modalities":["text","image","video","file","audio"]` | https://openrouter.ai/api/v1/models?q=gemini |
| Alias sempre-atual (bônus útil) | `~anthropic/claude-fable-latest` | `"alias_target":{"name":"Anthropic: Claude Fable 5.1","slug":"anthropic/claude-fable-5.1"}` — resolve para o modelo mais novo da família | https://openrouter.ai/api/v1/models?q=claude |

### 3.6 Preços — como o preço é obtido

**Resposta direta:** o OpenRouter **não publica uma tabela de preços estática** como fonte de verdade. O preço é exposto **pelo endpoint de listagem de modelos** (`GET /api/v1/models`), campo `pricing`, e é expresso em **USD por token** (não por milhão).

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Onde está o preço | Objeto `pricing` de cada modelo no retorno de `GET /api/v1/models` | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Unidade | *"`prompt`: Price in USD per token for prompt (input) processing"* e *"`completion`: Price in USD per token for completion (output) generation"*. **É por token** → multiplique por 1.000.000 para obter USD por 1M | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Outros campos de preço | `image`, `image_output`, `image_token`, `audio`, `audio_output`, `input_cache_read`, `input_cache_write`, `input_cache_write_1h`, `internal_reasoning`, `web_search`, `request`, `discount`, `overrides[]` (preço condicional por tamanho de prompt ou janela de horário UTC) | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| A API devolve o **custo real** da chamada? | **Sim.** O objeto `usage` da resposta traz `cost` — descrito no schema como *"Cost in credits (optional)"* — e `cost_details` com `upstream_inference_cost`, `upstream_inference_prompt_cost`, `upstream_inference_completions_cost` e `server_tool_cost` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Auditoria posterior | *"You can also use the returned `id` to query for the generation stats (including token counts and cost) after the request is complete via the `/api/v1/generation` endpoint."* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Base do cálculo | *"The token counts returned in the completions API response are calculated using the model's native tokenizer. Credit usage and model pricing are based on these native token counts."* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| **Conversão crédito → USD** | **NÃO VERIFICADO.** A doc diz que `cost` é "in credits" e que a chave tem limite em créditos, mas eu **não verifiquei** a taxa exata de conversão (nem a taxa de serviço sobre compra de créditos) | https://openrouter.ai/docs/api_reference/limits | 2026-09-30 |

Preços confirmados (convertendo `pricing.prompt`/`pricing.completion` de USD/token para **USD por 1M tokens**):

| ID OpenRouter | Entrada (USD/1M) | Saída (USD/1M) | Saída máx. (`top_provider.max_completion_tokens`) | Contexto | URL de origem | Lido em |
|---|---|---|---|---|---|---|
| `anthropic/claude-opus-5.5` | 4.00 | 20.00 | 128.000 | 1.000.000 | https://openrouter.ai/api/v1/models?q=claude | 2026-09-30 |
| `anthropic/claude-sonnet-5.5` | 2.00 | 10.00 | 128.000 | 1.000.000 | https://openrouter.ai/api/v1/models?q=claude | 2026-09-30 |
| `anthropic/claude-haiku-4.5` | 1.00 | 5.00 | 64.000 | 200.000 | https://openrouter.ai/api/v1/models?q=claude | 2026-09-30 |
| `anthropic/claude-fable-5.1` | 10.00 | 50.00 | 128.000 | 1.000.000 | https://openrouter.ai/api/v1/models?q=claude | 2026-09-30 |
| `google/gemini-3.8-flash` | 0.75 | 3.75 | 65.536 | 1.048.576 | https://openrouter.ai/api/v1/models?q=gemini | 2026-09-30 |
| `google/gemini-3.5-flash-lite` | 0.30 | 2.50 | 65.536 | 1.048.576 | https://openrouter.ai/api/v1/models?q=gemini | 2026-09-30 |
| `google/gemini-2.5-flash-lite` | 0.10 | 0.40 | 65.535 | 1.048.576 | https://openrouter.ai/api/v1/models?q=gemini | 2026-09-30 |

**Corroboração cruzada útil:** os valores do OpenRouter para modelos Anthropic e Google batem com as tabelas oficiais dos próprios provedores que eu li (`anthropic/claude-haiku-4.5` = $1/$5 = tabela Anthropic; `google/gemini-3.8-flash` = $0.75/$3.75 = tabela Google). Contudo, **o preço do OpenRouter é o preço do OpenRouter** — pode haver `overrides` condicionais e a taxa de serviço não está incluída no campo `pricing`.

### 3.7 Campos de contagem de tokens na resposta

| Campo | Descrição literal do schema | URL de origem | Lido em |
|---|---|---|---|
| `usage.prompt_tokens` | *"Including images, input audio, and tools if any"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.completion_tokens` | *"The tokens generated"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.total_tokens` | *"Sum of the above two fields"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.prompt_tokens_details.cached_tokens` | *"Tokens cached by the endpoint"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.prompt_tokens_details.cache_write_tokens` | *"Tokens written to cache (models with explicit caching)"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.prompt_tokens_details.audio_tokens` / `.video_tokens` | Tokens de entrada de áudio / vídeo | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.completion_tokens_details.reasoning_tokens` | *"Tokens generated for reasoning"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.completion_tokens_details.audio_tokens` / `.image_tokens` | Tokens de saída de áudio / imagem | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.cost` | *"Cost in credits (optional)"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.is_byok` | *"Whether request used Bring Your Own Key"* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.cost_details.*` | `upstream_inference_cost`, `upstream_inference_prompt_cost`, `upstream_inference_completions_cost`, `server_tool_cost` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `usage.server_tool_use.web_search_requests` | Requisições de busca web | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Quando o `usage` volta em streaming | *"When streaming, usage is returned exactly once in the final chunk before the `[DONE]` message."* | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| `finish_reason` normalizado | `tool_calls`, `stop`, `length`, `content_filter`, `error`. O valor cru do provedor fica em `native_finish_reason` | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |

### 3.8 Imagem na entrada

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Aceita imagem? | Sim, *"Requests with images, to multimodel models, are available via the `/api/v1/chat/completions` API with a multi-part `messages` parameter."* | https://openrouter.ai/docs/guides/overview/multimodal/image-understanding | 2026-09-30 |
| Como declarar | Parte de conteúdo `{"type":"image_url","image_url":{"url":"…"}}` no array `content` do papel `user`, junto de `{"type":"text","text":"…"}` | https://openrouter.ai/docs/guides/overview/multimodal/image-understanding | 2026-09-30 |
| URL ou base64 | Ambos: *"URLs: More efficient for publicly accessible images"* / *"Base64: Required for local files or private images"* — no base64 usa-se data URL `data:image/jpeg;base64,…` | https://openrouter.ai/docs/guides/overview/multimodal/image-understanding | 2026-09-30 |
| Tipo TypeScript | `ImageContentPart = { type:'image_url'; image_url:{ url:string; detail?:string } }` (o `detail` tem default `"auto"`) | https://openrouter.ai/docs/api_reference/overview | 2026-09-30 |
| Formatos suportados | `image/png`, `image/jpeg`, `image/webp`, `image/gif` | https://openrouter.ai/docs/guides/overview/multimodal/image-understanding | 2026-09-30 |
| Boa prática da doc | *"we recommend sending the text prompt first, then the images. If the images must come first, we recommend putting it in the system prompt."* | https://openrouter.ai/docs/guides/overview/multimodal/image-understanding | 2026-09-30 |
| Quantas imagens por requisição | *"The number of images you can send in a single request varies per provider and per model."* — **NÃO VERIFICADO** um número fixo | https://openrouter.ai/docs/guides/overview/multimodal/image-understanding | 2026-09-30 |

### 3.9 Limite de tokens de saída

| Item | Valor exato | URL de origem | Lido em |
|---|---|---|---|
| Parâmetro de requisição | `max_tokens` — *"Range: [1, context_length)"*. O campo `max_completion_tokens` também consta do enum de parâmetros suportados | https://openrouter.ai/docs/api_reference/overview · https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Limite por modelo | Campo `top_provider.max_completion_tokens` na listagem. A doc alerta: *"Input and output tokens share the context window, so the effective maximum output for a request is further limited by the context remaining after input tokens."* | https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties | 2026-09-30 |
| Valores confirmados | `anthropic/claude-opus-5.5` → 128.000; `anthropic/claude-haiku-4.5` → 64.000; `google/gemini-3.8-flash` → 65.536 | https://openrouter.ai/api/v1/models?q=claude · https://openrouter.ai/api/v1/models?q=gemini | 2026-09-30 |
| Rate limits de plataforma | Modelos `:free`: 20 req/min; 50 req/dia com <10 créditos comprados; 1.000 req/dia com ≥10 créditos. Não há cap de requisição por plataforma no variante paga | https://openrouter.ai/docs/api_reference/limits | 2026-09-30 |
| Limite de gasto | `402` quando saldo/chave estoura; há também um "in-flight spending budget" que estima o custo da requisição antes de liberá-la | https://openrouter.ai/docs/api_reference/limits | 2026-09-30 |

---

## 4. Comparativo consolidado

| Dimensão | Anthropic (Claude API) | Google (Gemini API) | OpenRouter |
|---|---|---|---|
| Endpoint de geração | `POST https://api.anthropic.com/v1/messages` | `POST https://generativelanguage.googleapis.com/v1beta/{model=models/*}:generateContent` **e** `POST …/v1beta/interactions` | `POST https://openrouter.ai/api/v1/chat/completions` |
| Auth | `x-api-key` + **`anthropic-version: 2023-06-01`** (obrigatório) | `x-goog-api-key` (ou `?key=`); sem header de versão obrigatório verificado | `Authorization: Bearer` (+ headers opcionais de atribuição) |
| System prompt | Campo **de topo** `system` | `systemInstruction` (topo, no `generateContent`) | Mensagem com `role: "system"` |
| Saída estruturada | `output_config.format` = `{type:"json_schema", schema}` | `response_format` = `{type:"text", mime_type:"application/json", schema}` (Interactions API) | `response_format` = `{type:"json_schema", json_schema:{name, strict, schema}}` |
| Aceita JSON Schema? | Sim (com limitações) | Sim | Sim (garantia varia por provedor) |
| Campos de custo real | `usage.input_tokens`, `usage.output_tokens`, `cache_*`, `server_tool_use.*` | `interaction.usage.total_input_tokens` / `total_output_tokens` / `total_thought_tokens` / `total_cached_tokens` / `total_tool_use_tokens` / `total_tokens` | `usage.prompt_tokens`, `usage.completion_tokens`, `usage.total_tokens`, **`usage.cost`**, `usage.cost_details.*` |
| Imagem | Bloco `image` com `source` base64/url/file | Parte de entrada `{type:"image", uri, mime_type}` | Parte `{type:"image_url", image_url:{url}}` |
| Limite de saída | 128K (Fable 5.1 / Opus 5.5 / Sonnet 5.5); 64K (Haiku 4.5) | 65.536 (`gemini-3.8-flash`) | Por modelo, em `top_provider.max_completion_tokens` |
| Preço de entrada/saída (modelo topo de linha) | Opus 5.5: $4 / $20 por 1M | Gemini 3.8 Flash: $0.75 / $3.75 por 1M (até 31/12/2026) | Igual ao do provedor, exposto em `pricing` (USD/token) |
| Modelo barato | `claude-haiku-4-5-20251001`: $1 / $5 | `gemini-3.1-flash-lite` (preço **NÃO VERIFICADO**) | `google/gemini-2.5-flash-lite`: $0.10 / $0.40 |

---

## 5. RESTRIÇÃO CONTRATUAL CRÍTICA (item 10 do pedido) — uso em produto/serviço para MENORES DE 18 na camada de TEXTO/LLM

> **Contexto desta apuração:** o pedido original já havia apurado que, para os modelos de **MÍDIA** do Google (Veo/Imagen), o Google **VEDA** uso em produto/conteúdo destinado a menores. A pergunta aqui é específica sobre a **camada de TEXTO/LLM** (Gemini via AI Studio / Generative Language API, e Claude).

### 5.0 RESPOSTA DIRETA

| Pergunta | Resposta verificada |
|---|---|
| No Google, a vedação vale **também** para a camada de TEXTO/LLM (não só mídia)? | **SIM — VEDADO.** A vedação está nas *Gemini API Additional Terms of Service*, seção **"Age Requirements"**, que regem *"Gemini API, Google AI Studio, and the other Google developer services that reference these terms"* — ou seja, cobre a API de texto |
| E na Anthropic? | **Não há vedação equivalente.** As Commercial Terms (as que regem o consumo da API) **não trazem cláusula numérica de idade**; a AUP trata especificamente de "Products serving minors" e **permite**, exigindo salvaguardas adicionais |
| E no OpenRouter? | **18+ para quem usa a API**, mas **sem cláusula própria sobre produto voltado a menores** — as obrigações dos provedores são repassadas por *flow-down* |

⚠️ **Método — leia antes de citar:** parte do texto abaixo foi obtida **renderizando a URL oficial através do proxy `https://r.jina.ai/<url oficial>`**, porque os sites bloqueiam leitura direta (detalhado em §5.5). Isso é **leitura da URL oficial por intermediário**, não leitura direta: tem confiabilidade menor que as demais seções deste documento. Onde isso ocorre, está marcado com **[VIA RENDERIZADOR]**.

### 5.1 Google — Gemini API Additional Terms of Service (camada de TEXTO/LLM)

| Item | Trecho literal | URL de origem | Lido em |
|---|---|---|---|
| **Escopo dos termos** | Regem *"Gemini API, Google AI Studio, and the other Google developer services that reference these terms"* — **inclui a API de texto** | https://ai.google.dev/gemini-api/terms?hl=en | 2026-09-30 |
| **Idade mínima do desenvolvedor** | *"You must be 18 years of age or older to use the APIs."* | https://ai.google.dev/gemini-api/terms?hl=en | 2026-09-30 |
| **VEDAÇÃO DE PRODUTO PARA MENORES (cláusula decisiva)** | *"You also will not use the Services as part of a website, application, or other service (collectively, "**API Clients**") that is directed towards or is likely to be accessed by individuals under the age of 18."* | https://ai.google.dev/gemini-api/terms?hl=en | 2026-09-30 |
| Finalidade de uso | *"Use of Google AI Studio and Gemini API is for developers building with Google AI models for professional or business purposes, not for consumer use."* | https://ai.google.dev/gemini-api/terms?hl=en | 2026-09-30 |
| Metadados dos termos | *"Effective March 23, 2026"* / last updated 2026-04-28 | https://ai.google.dev/gemini-api/terms?hl=en | 2026-09-30 |
| Variação por locale | A URL sem `?hl=` é servida em francês (geo); o conteúdo é o mesmo: *"Vous devez avoir au moins 18 ans… pouvant être consultés par des personnes âgées de moins de 18 ans, ou les ciblant"* | https://ai.google.dev/gemini-api/terms | 2026-09-30 |
| Generative AI Prohibited Use Policy — tem item sobre produtos para menores? | **NÃO.** A PUP **não** contém item sobre produtos/API Clients voltados a menores. Só trata de abuso sexual infantil: *"1. Do not engage in dangerous or illegal activities… This includes generating or distributing content that: 1. Relates to child sexual abuse or exploitation."* [VIA RENDERIZADOR] | https://policies.google.com/terms/generative-ai/use-policy | 2026-09-30 |
| `ai.google.dev/gemini-api/docs/usage-policies` ("Abuse monitoring") | Página existe (última atualização 2026-06-09) e trata de **monitoramento/retenção de 55 dias** — **não** tem cláusula de idade | https://ai.google.dev/gemini-api/docs/usage-policies | 2026-09-30 |

**Conclusão para o Google (camada de texto):** a restrição **não** é exclusiva de mídia. Um produto como o Rebeca — que é um "API Client" **"directed towards or is likely to be accessed by individuals under the age of 18"** (canal infantil "Luna e o Jardim das Cores") — **está vedado** pelo texto literal das Gemini API Additional Terms. Note que a cláusula é ampla: cobre tanto "directed towards" quanto **"likely to be accessed by"**.

### 5.2 Anthropic — Claude

| Documento | Trecho literal / achado | URL de origem | Lido em |
|---|---|---|---|
| **Consumer Terms — TEM idade mínima** | *"**Minimum age.** You must be at least 18 years old or the minimum age required to use the Services in your location, whichever is higher."* (Effective Oct 8, 2025) | https://www.anthropic.com/legal/consumer-terms | 2026-09-30 |
| **Consumer Terms NÃO regem uso de API key** | *"Please note: Our Commercial Terms of Service govern your use of any Anthropic API key, the Anthropic Console, or any other Anthropic offerings that reference the Commercial Terms of Service. For clarity, this does not include Claude.ai or Claude Pro use for individuals or entities."* → **é por isso que a cláusula de 18 anos das Consumer Terms não se aplica ao Rebeca** | https://www.anthropic.com/legal/consumer-terms | 2026-09-30 |
| **Commercial Terms (as que regem a API) — NÃO têm cláusula numérica de idade** | Texto integral (seções A–M) lido. Única restrição de elegibilidade encontrada: *"Services under these Terms are not for consumer use."* (Effective Jun 17, 2025) | https://www.anthropic.com/legal/commercial-terms | 2026-09-30 |
| Commercial Terms — autorizam servir os usuários finais do cliente | *"Anthropic gives Customer permission to use the Services, including to power products and services Customer makes available to its own customers and end users ("Users")"* (§A.1) | https://www.anthropic.com/legal/commercial-terms | 2026-09-30 |
| Commercial Terms — obrigação de conformidade | *"Customer and its Users may only use the Services in compliance with these Terms, including (a) the Usage Policy"* (§D.2) | https://www.anthropic.com/legal/commercial-terms | 2026-09-30 |
| **Usage Policy — produtos que servem menores são PERMITIDOS com salvaguardas** | *"**Products serving minors,** including organizations providing minors with the ability to directly interact with products that incorporate our API(s), must comply with the **additional guidelines** outlined in our Help Center article."* | https://www.anthropic.com/legal/aup (Effective Sep 15, 2025) | 2026-09-30 |
| Usage Policy — definição de menor | *"Note: We define a minor or child to be any individual under the age of 18 years old, regardless of jurisdiction."* | https://www.anthropic.com/legal/aup | 2026-09-30 |
| Usage Policy — segurança infantil (vedações) | Seção *"Do Not Compromise Children's Safety"*: *"This includes using our products or services to: - Create, distribute, or promote child sexual abuse material ("CSAM"), including AI-generated CSAM - Facilitate the trafficking, sextortion, or any other form of exploitation of a minor - Facilitate minor grooming, including generating content designed to impersonate a minor… - Fetishize or sexualize minors, including in fictional settings or via roleplay with the model"* | https://www.anthropic.com/legal/aup | 2026-09-30 |
| Diretrizes vinculadas para produtos que servem menores | Exigem *"Age verification systems…"*, *"Content moderation and filtering…"*, *"Monitoring and reporting mechanisms…"* e *"Anthropic will periodically audit organizations for compliance with these safeguards… may lead to the suspension or termination of your account."* (artigo de 16/03/2026) | https://support.anthropic.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors | 2026-09-30 |
| Child safety guidance for developers | *"Our first-party consumer services are restricted to users 18 years and older… All developers building on Anthropic's API are required to comply with our [Usage Policy], which prohibits using our products or services to compromise children's safety."* (26/06/2026) | https://support.claude.com/en/articles/15591275 | 2026-09-30 |
| Age assurance on Claude | *"Claude, our consumer product, is only available to people over 18 years."* (18/05/2026) | https://support.claude.com/en/articles/15171100 | 2026-09-30 |
| Seção canônica da AUP | `https://www.anthropic.com/legal/usage-policy` devolve **HTTP 404**; a URL canônica é `/legal/aup` | https://www.anthropic.com/legal/aup | 2026-09-30 |

### 5.3 OpenRouter

| Item | Trecho literal / achado | URL de origem | Lido em |
|---|---|---|---|
| Idade mínima (Terms) | *"**2. Eligibility** — You must be at least 18 years of age to use the Service…"* (Last Updated Aug 31, 2026) [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |
| Idade mínima (Privacy) | *"**8. Eligibility** — This Site is offered and available to users who are 18 years of age or older…"* (Last Updated Aug 31, 2026) [VIA RENDERIZADOR] | https://openrouter.ai/privacy | 2026-09-30 |
| **Flow-down das obrigações do provedor (cláusula decisiva)** | *"**5.1** … By accessing or using any Model through the Service, you agree, and will ensure that your Authorized Users and customers agree, to comply with the applicable terms for each Model ("Model Terms")… You are solely responsible for reviewing the Model Terms… and for determining whether the applicable Model Terms allow you and your Authorized Users to access and use the Service, Inputs, and Outputs as you intend."* [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |
| Flow-down para usuários autorizados | *"**5.2 Flow-Down to Authorized Users** — You will require that all of your Authorized Users and customers access and use the Service and Models only in accordance with this Agreement… You will be responsible for all acts and omissions of your Authorized Users, including any violation of applicable Model Terms."* [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |
| Os Model Terms não são afastados pelo OpenRouter | *"**5.8** … The applicable Model Terms govern your, your Authorized Users', and your customers' access to and use of the applicable Model… OpenRouter does not modify, waive, or limit any Model Terms unless expressly stated in writing."* + *"Model Providers are intended third-party beneficiaries of Sections 5, 6.1, 15, 17, and this Section 20…"* [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |
| Doc oficial confirma o repasse | *"You may not violate the terms of service or policies of third-party providers that power the models on OpenRouter."* | https://openrouter.ai/docs/guides/routing/provider-selection#terms-of-service | 2026-09-30 |
| **Sanção por violar Model Terms** | *"**5.5 Suspension and Termination** — You understand and acknowledge that you are solely responsible for any violation by yourself, your Authorized Users, and your customers of applicable Model Terms. OpenRouter may suspend, restrict, disable, or terminate your… access to any Model if we reasonably believe that you… has violated, or may violate, any Model Terms, or if we are required or requested to do so by the applicable Model Provider."* [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |
| Responsabilidade de escolher o caso de uso | *"**5.6 Configuration and Model Selection** — You are solely responsible for selecting the Models you use… and determining whether each Model and the applicable Model Terms are appropriate for your use case, including any regulated, high-risk, sensitive, or customer-facing use."* [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |
| Provedores como beneficiários diretos | *"Model Providers are intended third-party beneficiaries of Sections 5, 6.1, 15, 17, and this Section 20…"* [VIA RENDERIZADOR] | https://openrouter.ai/terms (§20) | 2026-09-30 |
| Dados: inputs vão ao provedor e alguns provedores treinam com eles | *"When you submit Inputs through the Service, those Inputs are transmitted to the Model Provider you select… **Some Model Providers may use your Inputs and Outputs for model training or improvement.**"*; e *"**OpenRouter does not use your Inputs or Outputs for model training.**"* [VIA RENDERIZADOR] | https://openrouter.ai/privacy | 2026-09-30 |
| **Cláusula própria sobre produto voltado a menores?** | **NÃO EXISTE.** A seção 7 "Prohibited Conduct" foi lida integralmente (15 itens): **nada** sobre produto/canal infantil. Só CSAM e correlatos: §6.7 (screen de Inputs e reporte ao NCMEC sob 18 U.S.C. § 2258A), §6.9 (*"contains child sexual abuse material (CSAM) or otherwise exploits or endangers minors"*), §7.9, §7.13 (*"falsifying your age or date of birth"*) [VIA RENDERIZADOR] | https://openrouter.ai/terms | 2026-09-30 |

### 5.4 Assimetria decisiva para o Rebeca

> **Isto é comparação de textos contratuais, NÃO parecer jurídico.**

| | Usuário da API (o Rebeca) | Produto/serviço voltado a < 18 anos |
|---|---|---|
| **Anthropic** | Commercial Terms: **sem idade numérica**; a única restrição é *"not for consumer use"* | **PERMITIDO COM SALVAGUARDAS** — "Products serving minors […] must comply with the additional guidelines"; as diretrizes exigem verificação de idade, moderação de conteúdo, monitoramento e sujeitam o cliente a **auditoria** pela Anthropic, com possível suspensão |
| **Google Gemini API** | **18+ obrigatório** — *"You must be 18 years of age or older to use the APIs."* | **VEDADO** — *"…API Clients that is directed towards or is likely to be accessed by individuals under the age of 18."* |
| **OpenRouter** | **18+** (Terms §2 e Privacy §8) | **Sem cláusula própria.** Herda os *Model Terms* por flow-down (§5.1, §5.2, §5.8) — ou seja, **a vedação do Google continua valendo** quando o modelo roteado é Gemini |

**Consequência prática (a decisão que isto muda):** rotear a camada de texto pelo **OpenRouter** **não contorna** a vedação do Google — o §5.1/§5.8 do OpenRouter repassa expressamente os Model Terms e os provedores são *third-party beneficiaries*. Para um canal infantil, a camada de TEXTO deve usar **Claude (Anthropic) com as salvaguardas das diretrizes de menores**, ou outro provedor cujos termos permitam; **Gemini na API direta está vedado** para esse cenário.

### 5.5 Método e limites desta seção (transparência)

| # | Fato de método | Detalhe |
|---|---|---|
| M1 | Bloqueio de leitura direta no Google | `policies.google.com` (ToS geral e a própria PUP) devolve **corpo vazio** no fetch direto, em inglês e português, e também via Wayback. O texto da PUP foi obtido com **[VIA RENDERIZADOR]** (`https://r.jina.ai/https://policies.google.com/terms/generative-ai/use-policy`). O **Google ToS geral não foi lido de forma alguma** |
| M2 | Bloqueio no OpenRouter | `/terms` e `/privacy` são renderizados no cliente: fetch direto e Wayback devolvem só a navegação; `/terms.md` e `/privacy.md` retornam **404**. Texto obtido com **[VIA RENDERIZADOR]** sobre as URLs oficiais |
| M3 | Google Terms em locale | `https://ai.google.dev/gemini-api/terms` sem `?hl=` é servido em **francês** por geolocalização; a versão em inglês exige `?hl=en`. Ambas foram lidas e dizem o mesmo |
| M4 | Referência cruzada | O dossiê completo desta apuração, com mais trechos e todos os registros de bloqueio, está em `.rebeca/pesquisa/_partes/idade-texto-llm.md` |

### 5.6 O que **não** foi verificado nesta seção (NÃO VERIFICADO)

| # | Item | Por quê |
|---|---|---|
| T1 | `https://www.anthropic.com/legal/usage-policy` → **HTTP 404** | A URL canônica é `/legal/aup`. Não comparei com `console.anthropic.com/legal/aup` |
| T2 | Service Specific Terms, DPA e Supplemental Credits Terms da Anthropic | **Não lidos** → não posso descartar cláusula de idade nesses documentos |
| T3 | `privacy.anthropic.com` | Redireciona a `privacy.claude.com`; a home é só um índice de coleções. Políticas por país não localizadas nem lidas |
| T4 | `trust.anthropic.com` | Aplicação JS; só devolveu o título. Nada verificável |
| T5 | Google Terms of Service geral | Bloqueio de leitura (ver M1). Não lido |
| T6 | `https://cloud.google.com/terms/service-terms` | Não aberto. As Additional Terms só remetem a ele para pagamento/faturamento |
| T7 | `support.google.com/gemini/answer/<id>` citado pelas Additional Terms | O ID não estava disponível no enunciado; testei 13594963 → **404**. O único `support.google.com` citado pelas Additional Terms é `support.google.com/adsense/answer/10926790` (**não aberto**) |
| T8 | YouTube Developer Policies, **Seção III.J "API Clients Directed to Children"** | Citada pelos YouTube API Services ToS (§9.1), mas **não lida**. O conteúdo exato das obrigações de um API Client "child-directed" é **NÃO VERIFICADO** |
| T9 | DPA do OpenRouter | Não lido |
| T10 | Pareamento modelo→Model Terms caso a caso no OpenRouter | **NÃO VERIFICADO** — qual conjunto de *Model Terms* se aplica a cada modelo do catálogo não foi conferido individualmente |

**O que os YouTube API Services ToS (§9.1, last updated 2026-09-14) dizem — parcialmente verificado:** um API Client "child-directed" deve *"comply with [Section III.J (API Clients Directed to Children) of the Developer Policies] including notifying Google of the child-directed nature of your API Client"* e *"no YouTube API Services write-based actions (such as, but not limited to, uploading content, commenting and creating/sharing playlists) taken by users of Known Child-Directed API Client will be implemented on YouTube websites"*. **Não há vedação de uso comercial em canal infantil** nesses termos; há obrigação de declarar a natureza infantil. URL: https://developers.google.com/youtube/terms/api-services-terms-of-service (lido em 2026-09-30).

**Item diretamente operacional para o Rebeca (verificado):** o §9.1 item 4 dos mesmos termos exige que um API Client que **não** é child-directed implemente **uma** das opções: *"(a) enable users of your non-Child-Directed API Client to designate their content as Made for Kids via your API Client **before** they can upload their content […]"* — ou seja, o fluxo de upload do Rebeca precisa permitir marcar "Made for Kids" **antes** do upload. URL: https://developers.google.com/youtube/terms/api-services-terms-of-service (lido em 2026-09-30).

O texto da **Seção III.J** em si permanece **NÃO VERIFICADO** (T8); URL canonical: https://developers.google.com/youtube/terms/developer-policies#j.-child-directed-api-clients.

**Elegibilidade na camada YouTube (verificada):** *"**3.2 Unauthorized Persons.** You must not accept the Agreement, or access or use the YouTube API Services, if (i) you are not of legal age to form a binding contract with us […]"* — aqui a régua é **idade legal para contratar**, **não** 18 anos fixos, ao contrário da camada Gemini. URL: https://developers.google.com/youtube/terms/api-services-terms-of-service (lido em 2026-09-30).


## 6. Lacunas (NÃO VERIFICADO)

Tudo abaixo está explicitamente **NÃO VERIFICADO**. Nenhum desses pontos foi preenchido por estimativa, memória de treinamento ou analogia com outros provedores.

### 6.1 Bloqueios de leitura que causaram lacunas

| # | Lacuna | Provedor | Por que não foi verificado | Onde confirmar |
|---|---|---|---|---|
| L1 | Nomes exatos dos campos de configuração de geração no `generateContent` (incluindo **saída estruturada** e **máximo de tokens de saída**) | Google | **RESOLVIDO PARCIALMENTE.** A seção `GenerationConfig` da página REST `https://ai.google.dev/api/generate-content` continuou além do limite de leitura. Contudo, obtive os nomes na **referência oficial do SDK Google GenAI** (`@google/genai` v2.24.0, interface `GenerateContentConfig`): `maxOutputTokens`, `responseMimeType`, `responseSchema`, `responseJsonSchema`, `systemInstruction`, `thinkingConfig`, etc. — ver §2.3 e §2.4. **Permanece NÃO VERIFICADO** apenas a correspondência nome-a-nome com o **JSON REST cru** | https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html |
| L2 | Nomes exatos dos campos de `usageMetadata` na resposta do `generateContent` | Google | **RESOLVIDO PARCIALMENTE** pela mesma via (interface oficial `UsageMetadata`): `promptTokenCount`, `responseTokenCount`, `thoughtsTokenCount`, `cachedContentTokenCount`, `toolUsePromptTokenCount`, `totalTokenCount` — ver §2.7. Permanece NÃO VERIFICADO o JSON REST cru | https://googleapis.github.io/js-genai/release_docs/interfaces/types.UsageMetadata.html |
| L3 | Nomes exatos dos campos REST de imagem inline no `generateContent` (`inlineData` / `fileData`) | Google | **RESOLVIDO PARCIALMENTE** pela mesma via (interface oficial `Part`): `inlineData` (tipo `Blob`) e `fileData` (tipo `FileData`) — ver §2.8. Permanece NÃO VERIFICADO o JSON REST cru | https://googleapis.github.io/js-genai/release_docs/interfaces/types.Part.html |
| L4 | Nome do campo de system instruction na **Interactions API** | Google | Não li essa seção; o guia de instruções do sistema aponta para uma página que não foi aberta | `https://ai.google.dev/gemini-api/docs/system-instructions` |
| L5 | Preços oficiais do Google para todos os modelos **exceto** `gemini-3.8-flash` | Google | A página `https://ai.google.dev/gemini-api/docs/pricing` excedeu o limite de leitura; só a primeira seção (Gemini 3.8 Flash) ficou legível. Tentei as versões em inglês e pt-BR | `https://ai.google.dev/gemini-api/docs/pricing` |
| L6 | Existência e ID de um modelo Gemini "Pro" de texto (raciocínio) na listagem atual | Google | A página `https://ai.google.dev/gemini-api/docs/models` foi truncada dentro da seção "Gemini 3" | `https://ai.google.dev/gemini-api/docs/models` |
| L7 | Limites de saída dos modelos Gemini diferentes de `gemini-3.8-flash` | Google | Não abri as páginas individuais | `https://ai.google.dev/gemini-api/docs/models/<modelo>` |
| L8 | Formatos/tamanhos de imagem aceitos e limite de quantidade por requisição | Google | Não li a seção de limites da página de image understanding | `https://ai.google.dev/gemini-api/docs/image-understanding` |
| L9 | Modelo recomendado oficialmente para **escrita criativa** | Anthropic, Google, OpenRouter | Em nenhuma das três fontes oficiais lidas existe posicionamento de modelo por "escrita criativa". Não invento uma recomendação | — |

### 6.2 Pontos técnicos que dependem de confirmação antes de codar

| # | Item | Status | Observação para o Rebeca |
|---|---|---|---|
| L10 | Conversão **crédito → USD** no OpenRouter, e taxa de serviço sobre compra de créditos | NÃO VERIFICADO | `usage.cost` é documentado como "in credits". Não é possível gravar custo em USD em `.rebeca/custos.csv` sem confirmar a taxa. Confirmar em `https://openrouter.ai/pricing` e `https://openrouter.ai/docs/faq` |
| L11 | Lista de modelos que o filtro `category=roleplay` (e `marketing`) retorna no OpenRouter | NÃO VERIFICADO | Endpoint: `GET https://openrouter.ai/api/v1/models?category=roleplay` |
| L12 | Número máximo de imagens por requisição no OpenRouter | NÃO VERIFICADO | A doc afirma que varia por provedor e modelo, sem fixar número |
| L13 | `usageMetadata` de `countTokens` e limites de RPM/TMP oficiais do Google | NÃO VERIFICADO | `https://ai.google.dev/gemini-api/docs/rate-limits` |
| L14 | Modelos "Mythos" da Anthropic (5.1 / 5 / preview) | Parcialmente verificado | Aparecem na tabela de preços e na lista de suporte a saída estruturada, mas estão marcados como *"limited availability"* / *"Project Glasswing"* — acesso por convite. Não são recomendáveis como padrão |
| L15 | Preços em `claude.com/pricing` (fonte que a própria doc indica como "most current") | NÃO VERIFICADO | A doc de preços da Anthropic remete a essa página; eu li a tabela em `platform.claude.com` |

### 6.3 Avisos de risco derivados da pesquisa

| # | Aviso | Base |
|---|---|---|
| A1 | O `strict: true` do OpenRouter **não garante** schema em todos os endpoints | Citação literal em §3.4: *"exact compliance is not guaranteed on every endpoint"* |
| A2 | Migrar de Claude anterior ao 4.7 muda a contagem de tokens em ~30% | Citação literal em §1.6 e §1.7 |
| A3 | `temperature` é rejeitado (400) em modelos Claude posteriores ao Opus 4.6, exceto o valor 1.0 | Citação literal em §1.3 |
| A4 | `output_format` (Anthropic) sem o beta header correto devolve **400** | Citação literal em §1.4 |
| A5 | Em saída estruturada da Anthropic, refusão (`stop_reason: "refusal"`) e truncamento (`max_tokens`) podem devolver JSON fora do schema, e a capitalização de `enum` não é garantida | Citação literal em §1.4 |
| A6 | `google/gemini-2.5-flash-lite` no OpenRouter tem `expiration_date: 2026-10-20` (menos de 1 mês após a leitura) | Campo do JSON em §3.5 — **não usar como base de custo de longo prazo** sem plano de substituição |
| A7 | No Google, o modelo vai no **caminho** da URL, não no corpo — abstração de provedor do Rebeca precisa tratar isso | §2.1 |
| A8 | O Google mantém **duas** superfícies (GenerateContent e Interactions) e a doc nova exemplifica na Interactions; escolher uma e fixar antes de implementar | §2.1, §6.1 (L1) |
