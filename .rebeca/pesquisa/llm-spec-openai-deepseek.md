# Spec de APIs de LLM — OpenAI e DeepSeek

**Data de leitura de todas as fontes: 2026-09-30.**
Todo dado desta página foi lido em **fonte primária oficial** (documentação do provedor). A coluna
**URL de origem** existe em toda tabela. O que não pôde ser confirmado está marcado literalmente como
`NÃO VERIFICADO` e consolidado na última seção.

## Como ler este documento

| Rótulo | Significado |
|---|---|
| **leitura direta** | `web_fetch` na URL oficial retornou HTTP 200 e o conteúdo foi lido. |
| **leitura indireta** | O domínio oficial bloqueou leitura direta (HTTP 403) e o conteúdo foi lido por proxy de leitura que reproduz a URL oficial. Fonte primária por via indireta. |
| **NÃO VERIFICADO** | Não foi possível confirmar. Nada foi inferido no lugar. |

### Mapa de leitura (status HTTP por URL)

| URL | Status | Tipo |
|---|---|---|
| https://api-docs.deepseek.com/ | 200 | leitura direta |
| https://api-docs.deepseek.com/quick_start/pricing | 200 | leitura direta |
| https://api-docs.deepseek.com/api/create-chat-completion | 200 | leitura direta |
| https://api-docs.deepseek.com/guides/json_mode | 200 | leitura direta |
| https://api-docs.deepseek.com/guides/tool_calls | 200 | leitura direta |
| https://api-docs.deepseek.com/guides/vision | 200 | leitura direta |
| https://api-docs.deepseek.com/quick_start/token_usage | 200 | leitura direta |
| https://api-docs.deepseek.com/quick_start/rate_limit | 200 | leitura direta |
| https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html | 200 | leitura direta |
| https://developers.openai.com/api/docs/pricing.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/models.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/models/all.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/guides/structured-outputs.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/guides/images-vision.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/quickstart.md | 200 | leitura direta |
| https://developers.openai.com/api/reference/resources/chat.md | 200 | leitura direta |
| https://developers.openai.com/api/reference/resources/responses/methods/create.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/models/gpt-6-astra.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/models/gpt-6.1-sol.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/models/gpt-6-luna.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance.md | 200 | leitura direta |
| https://developers.openai.com/api/docs/guides/csam-guidance.md | 200 | leitura direta |
| https://openai.com/policies/terms-of-use/ | **403** | bloqueado |
| https://openai.com/policies/row-terms-of-use/ | **403** | bloqueado |
| https://openai.com/policies/usage-policies/ | **403** | bloqueado |
| https://openai.com/policies/services-agreement/ | **403** | bloqueado |
| https://openai.com/policies/business-terms/ | **403** | bloqueado |
| https://openai.com/policies/eu-terms-of-use/ | **403** | bloqueado |
| https://openai.com/pt-BR/policies/terms-of-use/ | **403** | bloqueado |
| https://help.openai.com/en/articles/8313401-is-chatgpt-safe-for-all-ages | **403** | bloqueado |
| https://cdn.openai.com/policies/terms-of-use.pdf | 404 (BlobNotFound) | inexistente |
| https://platform.openai.com/docs/pricing | 403 / redireciona para developers.openai.com | bloqueado |
| https://platform.openai.com/docs/api-reference/chat/create | 403 | bloqueado |

> Observação importante de infraestrutura: **`platform.openai.com` retorna HTTP 403 e
> `openai.com/policies/**` retorna HTTP 403** neste ambiente. A documentação técnica da OpenAI hoje
> vive em `developers.openai.com`, que é legível diretamente (e tem versão `.md` de cada página:
> basta acrescentar `.md` à URL). Os textos de política da OpenAI foram lidos por **leitura indireta**
> e estão marcados como tal.

---

# 1. OpenAI

## 1.1 URL base e caminho exato do endpoint de chat/completions

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Chat Completions | `POST https://api.openai.com/v1/chat/completions` | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Responses (recomendado pela própria doc para projetos novos) | `POST https://api.openai.com/v1/responses` | https://developers.openai.com/api/reference/resources/responses/methods/create.md | leitura direta |
| Base URL | `https://api.openai.com/v1` | https://developers.openai.com/api/docs/quickstart.md | leitura direta |

A própria doc do Chat Completions diz, textualmente: *"**Starting a new project?** We recommend trying
[Responses] to take advantage of the latest OpenAI platform features."*
(https://developers.openai.com/api/reference/resources/chat.md, leitura direta)

## 1.2 Autenticação

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Header de autenticação | `Authorization: Bearer $OPENAI_API_KEY` | https://developers.openai.com/api/docs/quickstart.md | leitura direta |
| Header de conteúdo | `Content-Type: application/json` | https://developers.openai.com/api/reference/resources/chat.md (exemplos curl) | leitura direta |
| Variável de ambiente lida pelos SDKs | `OPENAI_API_KEY` | https://developers.openai.com/api/docs/quickstart.md | leitura direta |

## 1.3 Formato mínimo do corpo e onde ficam system/user

**Chat Completions** — `messages` é **obrigatório** (array de `ChatCompletionMessageParam`); `model` é
obrigatório.

```json
{
  "model": "gpt-6-astra",
  "messages": [
    {"role": "system", "content": "Você é ..."},
    {"role": "user",   "content": "Faça ..."}
  ]
}
```

**Responses** — `input` aceita string (equivale a mensagem `user`) ou lista de itens.

```json
{
  "model": "gpt-6-astra",
  "input": [
    {"role": "system", "content": "Você é ..."},
    {"role": "user",   "content": "Faça ..."}
  ]
}
```

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Papéis aceitos em `messages` | `developer`, `system`, `user`, `assistant`, `tool`, `function` | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Onde ficam as instruções de sistema | `role: "system"`. **Atenção:** *"With o1 models and newer, use `developer` messages for this purpose instead."* | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Papéis aceitos em `input` (Responses) | `user`, `assistant`, `system`, `developer` | https://developers.openai.com/api/reference/resources/responses/methods/create.md | leitura direta |
| Campo alternativo de instrução (Responses) | `instructions` | https://developers.openai.com/api/docs/quickstart.md | leitura direta |

## 1.4 Saída estruturada em JSON (JSON Schema) — **crítico**

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Parâmetro (Chat Completions) | `response_format` | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Forma schema-validada | `response_format: { "type": "json_schema", "json_schema": { "name": ..., "description": ..., "schema": {...}, "strict": true } }` | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Sub-campos de `json_schema` | `name` (obrigatório, máx. 64, `a-z A-Z 0-9 _ -`), `description` (opcional), `schema` (opcional, objeto JSON Schema), `strict` (opcional, bool) | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Parâmetro (Responses) | `text.format` — ex.: `text: { format: { type: "json_schema", name: "math_reasoning", schema: {...}, strict: true } }` | https://developers.openai.com/api/docs/guides/structured-outputs.md | leitura direta |
| Aceita JSON Schema? | **Sim.** *"Structured Outputs is a feature that ensures the model will always generate responses that adhere to your supplied JSON Schema"* | https://developers.openai.com/api/docs/guides/structured-outputs.md | leitura direta |
| Restrição de `strict: true` | *"Only a subset of JSON Schema is supported when `strict` is `true`."* | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Compatibilidade | *"Structured Outputs with `response_format: {type: \"json_schema\", ...}` is only supported with the `gpt-4o-mini`, `gpt-4o-mini-2024-07-18`, and `gpt-4o-2024-08-06` model snapshots and later."* | https://developers.openai.com/api/docs/guides/structured-outputs.md | leitura direta |
| Modo JSON antigo | `response_format: { "type": "json_object" }` — *"the older JSON mode, which ensures the message the model generates is valid JSON"* | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Recusa detectável programaticamente | Quando o modelo recusa, a resposta traz o campo `refusal` (no Responses: item de conteúdo `{"type":"refusal","refusal":"..."}`) | https://developers.openai.com/api/docs/guides/structured-outputs.md | leitura direta |
| Modelos com o recurso | `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna` listam `structured_outputs` em *Supported features* | https://developers.openai.com/api/docs/models/gpt-6-astra.md · https://developers.openai.com/api/docs/models/gpt-6.1-sol.md · https://developers.openai.com/api/docs/models/gpt-6-luna.md | leitura direta |

**Veredito para o produto:** a OpenAI entrega **validação por JSON Schema de verdade** (`json_schema` +
`strict: true`), e o próprio modelo pode recusar (campo `refusal`) — o que é tratável em código.

## 1.5 IDs de modelo atuais por categoria

A página oficial de modelos descreve os modelos por capacidade, não por "escrita criativa". Onde a
categoria não está documentada, ela está marcada como `NÃO VERIFICADO` (ver §5).

| Categoria | Model ID | O que a doc oficial diz | URL de origem | Tipo |
|---|---|---|---|---|
| (a) Raciocínio / análise | `gpt-6-astra` | *"Our most capable model for the most demanding work. Use it for complex reasoning, coding, computer use, research, and document creation."* `reasoning.effort`: `low, medium, high, xhigh, max`; *Reasoning token support* | https://developers.openai.com/api/docs/models/gpt-6-astra.md | leitura direta |
| (a) Raciocínio / análise | `gpt-6.1-sol` | *"Near-Astra performance for complex work at a lower cost."* `reasoning.effort`: `low, medium, high, xhigh, max` (`none` e `minimal` não suportados) | https://developers.openai.com/api/docs/models/gpt-6.1-sol.md | leitura direta |
| (a) Raciocínio / análise | `gpt-5.6-sol` | *"GPT-5.6 flagship model for complex professional work"* | https://developers.openai.com/api/docs/models.md | leitura direta |
| (a) Raciocínio / análise | `gpt-6-sol` | *"Built to power complex coding and agentic workflows."* | https://developers.openai.com/api/docs/models.md | leitura direta |
| (b) Escrita criativa | `NÃO VERIFICADO` | Nenhuma página oficial de modelos da OpenAI classifica modelo por "creative writing". Nenhum ID é recomendado aqui para não inventar. | — | — |
| (c) Classificação / extração barata e rápida | `gpt-6-luna` | *"Our most efficient model for focused, high-volume tasks."* | https://developers.openai.com/api/docs/models/gpt-6-luna.md | leitura direta |
| (c) Classificação / extração barata e rápida | `gpt-5.6-luna` | *"GPT-5.6 model optimized for cost-sensitive workloads"* | https://developers.openai.com/api/docs/models.md | leitura direta |
| (c) Classificação / extração barata e rápida | `gpt-5.4-nano` | *"Our cheapest GPT-5.4-class model for simple high-volume tasks"* | https://developers.openai.com/api/docs/models.md | leitura direta |
| (c) Classificação / extração barata e rápida | `gpt-5-nano` | *"Fastest, most cost-efficient version of GPT-5"* | https://developers.openai.com/api/docs/models.md | leitura direta |
| (d) Visão | `gpt-6-astra` | *Input modalities: text, image*; feature `image_input` | https://developers.openai.com/api/docs/models/gpt-6-astra.md | leitura direta |
| (d) Visão | `gpt-6.1-sol` | *Input modalities: text, image*; feature `image_input` | https://developers.openai.com/api/docs/models/gpt-6.1-sol.md | leitura direta |
| (d) Visão | `gpt-6-luna` | *Input modalities: text, image*; feature `image_input` | https://developers.openai.com/api/docs/models/gpt-6-luna.md | leitura direta |
| (d) Visão — regra geral | *(todos os modelos atuais)* | *"All latest OpenAI models support text and image input, text output, multilingual capabilities, and vision."* | https://developers.openai.com/api/docs/models.md | leitura direta |

## 1.6 Preços por 1M de tokens (USD, tier **Standard**, contexto curto ≤272K)

| Model ID | Entrada | Entrada cache | Escrita de cache | Saída | Entrada >272K | Saída >272K | URL de origem |
|---|---:|---:|---:|---:|---:|---:|---|
| `gpt-6-astra` | $10.00 | $1.00 | $12.50 | $50.00 | $20.00 | $75.00 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-6.1-sol` | $2.00 | $0.10 | $2.50 | $10.00 | $4.00 | $15.00 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-6-sol` | $2.00 | $0.20 | $2.50 | $10.00 | $4.00 | $15.00 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-6-luna` | $0.10 | $0.01 | $0.125 | $0.50 | $0.20 | $0.75 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-5.6-sol` | $4.00 | $0.40 | $5.00 | $20.00 | $8.00 | $30.00 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-5.6-terra` | $2.00 | $0.20 | $2.50 | $12.00 | $4.00 | $18.00 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-5.6-luna` | $0.20 | $0.02 | $0.25 | $1.20 | $0.40 | $1.80 | https://developers.openai.com/api/docs/pricing.md |
| `gpt-5.4-nano` | $0.20 | $0.02 | — | $1.25 | — | — | https://developers.openai.com/api/docs/pricing.md |
| `gpt-5-nano` | $0.05 | $0.005 | — | $0.40 | — | — | https://developers.openai.com/api/docs/pricing.md |

Regras oficiais de cobrança lidas na mesma página: *"Short context: ≤272K input tokens. Long context:
>272K input tokens."*; *"Batch and Flex are priced at 50% of Standard rates. Fast mode is priced at 2x
the applicable rates."*; *"Cache writes are billed at 1.25x the uncached input token rate."*
(https://developers.openai.com/api/docs/models/gpt-6-astra.md e .../gpt-6-luna.md, leitura direta)

## 1.7 Contagem de tokens usados na resposta (custo real)

| Endpoint | Campo | Significado | URL de origem | Tipo |
|---|---|---|---|---|
| Chat Completions | `usage.prompt_tokens` | Nº de tokens do prompt | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Chat Completions | `usage.completion_tokens` | Nº de tokens gerados | idem | leitura direta |
| Chat Completions | `usage.total_tokens` | prompt + completion | idem | leitura direta |
| Chat Completions | `usage.prompt_tokens_details.cached_tokens` | tokens de prompt vindos de cache | idem | leitura direta |
| Chat Completions | `usage.prompt_tokens_details.cache_write_tokens` | tokens de prompt escritos em cache | idem | leitura direta |
| Chat Completions | `usage.prompt_tokens_details.image_tokens` | tokens de imagem no prompt | idem | leitura direta |
| Chat Completions | `usage.completion_tokens_details.reasoning_tokens` | tokens de raciocínio (cobrados como saída) | idem | leitura direta |
| Responses | `usage.input_tokens`, `usage.output_tokens`, `usage.total_tokens` | idem | https://developers.openai.com/api/docs/guides/structured-outputs.md (exemplo de resposta de recusa) | leitura direta |
| Responses | `usage.output_tokens_details.reasoning_tokens` | tokens de raciocínio | idem | leitura direta |

O objeto `usage` no Chat Completions está marcado como `optional` na referência; no Responses, o
exemplo oficial sempre o traz. **Portanto o custo real é calculável** por request.

## 1.8 Visão — se aceita imagem e como declarar

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Aceita imagem? | Sim — *"Recent language models can process image inputs and analyze them—a capability known as **vision**."* | https://developers.openai.com/api/docs/guides/images-vision.md | leitura direta |
| Corpo (Chat Completions) | `content` vira **array**: `[{"type":"text","text":"..."},{"type":"image_url","image_url":{"url":"...","detail":"auto"}}]` | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Corpo (Responses) | `[{"type":"input_text","text":"..."},{"type":"input_image","image_url":"...","detail":"auto"}]` | https://developers.openai.com/api/docs/guides/images-vision.md | leitura direta |
| Valores de `detail` (Chat Completions) | `auto`, `low`, `high` | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| Valores de `detail` (Responses) | `low`, `high`, `auto`, `original` (default `auto`) | https://developers.openai.com/api/docs/guides/images-vision.md | leitura direta |
| 3 formas de enviar | URL pública; data URL base64; `file_id` (Files API, `purpose: "vision"`) | https://developers.openai.com/api/docs/guides/images-vision.md | leitura direta |
| Formatos suportados | PNG (`.png`), JPEG (`.jpeg`/`.jpg`), WEBP (`.webp`), GIF não animado (`.gif`) | idem | leitura direta |
| Limites | *Request size* até 512 MB por requisição; até 1.500 imagens por requisição; até 30.000 patches por imagem | idem | leitura direta |

## 1.9 Limite de tokens de saída

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Parâmetro (Chat Completions) | `max_completion_tokens` — *"An upper bound for the number of tokens that can be generated for a completion, including visible output tokens and reasoning tokens."* | https://developers.openai.com/api/reference/resources/chat.md | leitura direta |
| `max_tokens` | Deprecado: *"This value is now deprecated in favor of `max_completion_tokens`, and is not compatible with o-series models."* | idem | leitura direta |
| Parâmetro (Responses) | `max_output_tokens` | https://developers.openai.com/api/docs/guides/structured-outputs.md | leitura direta |
| Máximo documentado por modelo | `gpt-6-astra`: **128.000** max output tokens; `gpt-6.1-sol`: **128.000**; `gpt-6-luna`: **128.000** | https://developers.openai.com/api/docs/models/gpt-6-astra.md · .../gpt-6.1-sol.md · .../gpt-6-luna.md | leitura direta |
| Teto absoluto da API (valor numérico global) | `NÃO VERIFICADO` — nenhuma página lida documenta um teto numérico global; só o limite por modelo. | — | — |

---

# 2. DeepSeek

## 2.1 URL base e caminho exato do endpoint de chat/completions

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Chat Completions | `POST https://api.deepseek.com/chat/completions` | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |
| `base_url` (formato OpenAI) | `https://api.deepseek.com` | https://api-docs.deepseek.com/ | leitura direta |
| `base_url` (formato Anthropic) | `https://api.deepseek.com/anthropic` | https://api-docs.deepseek.com/ | leitura direta |
| `base_url` Beta (necessário para `strict` em tool calls) | `https://api.deepseek.com/beta` | https://api-docs.deepseek.com/guides/tool_calls | leitura direta |
| Outros endpoints | `POST /responses` (Responses API), `POST /completions` (FIM, Beta), `GET /models`, `GET /user/balance`, Files API (`/files`) | https://api-docs.deepseek.com/api/create-chat-completion (menu de referência) | leitura direta |

Exemplo oficial em curl (`https://api-docs.deepseek.com/`, leitura direta):
`curl https://api.deepseek.com/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer ${DEEPSEEK_API_KEY}" ...`

## 2.2 Autenticação

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Header | `Authorization: Bearer ${DEEPSEEK_API_KEY}` | https://api-docs.deepseek.com/ | leitura direta |
| Header de conteúdo | `Content-Type: application/json` | idem | leitura direta |
| Onde obter a chave | `https://platform.deepseek.com/api_keys` | idem | leitura direta |
| Compatibilidade de SDK | *"The DeepSeek API uses an API format compatible with OpenAI/Anthropic."* Usa o SDK da OpenAI mudando `base_url` | idem | leitura direta |

## 2.3 Formato mínimo do corpo e onde ficam system/user

```json
{
  "model": "deepseek-flash",
  "messages": [
    {"role": "system", "content": "Você é ..."},
    {"role": "user",   "content": "Faça ..."}
  ],
  "stream": false
}
```

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| `messages` | obrigatório, `object[]`, `>= 1` | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |
| `model` | obrigatório; valores possíveis: `deepseek-flash`, `deepseek-v4-pro` | idem | leitura direta |
| Papéis aceitos | `system`, `user`, `assistant`, `tool` | idem | leitura direta |
| Instrução de sistema | `{"role":"system","content":"..."}` | idem | leitura direta |
| Parâmetro de modo de raciocínio | `thinking: {"type": "enabled"}` ou `{"type": "disabled"}` (default `enabled`) | idem | leitura direta |
| Esforço de raciocínio | `reasoning_effort`: `none`, `low`, `high`, `max` (default `high`); `minimal`→`low`, `medium`/`xhigh`→`high` | idem | leitura direta |

## 2.4 Saída estruturada em JSON — **crítico (e é o ponto fraco da DeepSeek)**

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Parâmetro | `response_format` | https://api-docs.deepseek.com/guides/json_mode | leitura direta |
| Único valor documentado | `{"type": "json_object"}` | idem | leitura direta |
| Aceita JSON Schema nesse parâmetro? | **Não.** Os valores possíveis de `response_format.type` são apenas `text` e `json_object`. Não existe `json_schema`. | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |
| Obrigação de prompt | *"Include the word \"json\" in the system or user prompt, and provide an example of the desired JSON format to guide the model in outputting valid JSON."* | https://api-docs.deepseek.com/guides/json_mode | leitura direta |
| Risco declarado pela própria DeepSeek | *"When using the JSON Output feature, the API may occasionally return empty content. We are actively working on optimizing this issue."* | idem | leitura direta |
| Truncamento | *"the message content may be partially cut off if finish_reason=\"length\""* | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |
| **Validação por schema — via tool calls** | Existe **apenas** em Tool Calls `strict` (Beta): *"In `strict` mode, the model strictly adheres to the format requirements of the Function's JSON schema when outputting a tool call"* | https://api-docs.deepseek.com/guides/tool_calls | leitura direta |
| Como habilitar `strict` | 1) `base_url="https://api.deepseek.com/beta"`; 2) em `tools`, todo `function` precisa de `"strict": true`; 3) o servidor valida o schema e devolve erro se não conformar | idem | leitura direta |
| Subconjunto de JSON Schema suportado em `strict` | Tipos: `object`, `string`, `number`, `integer`, `boolean`, `array`, `enum`, `anyOf`, além de `$ref`/`$def`. `object`: **todas** as propriedades devem estar em `required` e `additionalProperties` deve ser `false`. **Não** suportados: `minLength`, `maxLength`, `minItems`, `maxItems`. `string` suporta `pattern` e `format` (`email`, `hostname`, `ipv4`, `ipv6`, `uuid`). | idem | leitura direta |
| Restrição de modo | `tool_choice: "required"` e escolha nomeada **não** funcionam em thinking mode (erro 400) | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |

**Veredito para o produto:** na DeepSeek **não existe** `json_schema` em `response_format`. Para saída
validada por schema é preciso usar o caminho de **tool calls com `strict: true` no endpoint `/beta`**,
e mesmo ele é Beta e cobre apenas um subconjunto de JSON Schema. `response_format: json_object`
garante apenas "é JSON válido", **não** aderência ao schema.

## 2.5 IDs de modelo atuais por categoria

| Categoria | Model ID | O que a doc oficial diz | URL de origem | Tipo |
|---|---|---|---|---|
| (a) Raciocínio / análise | `deepseek-v4-pro` | *MODEL VERSION: DeepSeek-V4-Pro-0813*; *"Supports both non-thinking and thinking (default) modes"*; thinking mode default `enabled` | https://api-docs.deepseek.com/quick_start/pricing | leitura direta |
| (a) Raciocínio / análise | `deepseek-flash` | *MODEL VERSION: DeepSeek-V4.1-Flash*; também suporta thinking mode (default) | idem | leitura direta |
| (b) Escrita criativa | `NÃO VERIFICADO` | Nenhuma página oficial da DeepSeek classifica modelo por "escrita criativa". | — | — |
| (c) Classificação / extração barata e rápida | `deepseek-flash` | Modelo de menor preço da tabela oficial; *"Use `deepseek-flash` as the model name."* | https://api-docs.deepseek.com/quick_start/pricing | leitura direta |
| (d) Visão | `deepseek-flash` | *"The `deepseek-flash` model accepts images alongside text"* | https://api-docs.deepseek.com/guides/vision | leitura direta |
| (d) Visão — **NÃO** suportado | `deepseek-v4-pro` | Na tabela de features, a linha `Vision` marca `✓` para `deepseek-flash` e **Not supported** para `deepseek-v4-pro` | https://api-docs.deepseek.com/quick_start/pricing | leitura direta |
| Nomes legados | `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp` | *"are still accepted, but the corresponding models have been retired, their requests are served by the DeepSeek-V4.1-Flash model and billed at the Flash price."* | https://api-docs.deepseek.com/quick_start/pricing | leitura direta |

## 2.6 Preços por 1M de tokens (USD) — há preço **peak** e **off-peak**

Regra oficial: *"Off-peak rates are half of the peak rates. Peak hours are 01:00 - 04:00 and 06:00 -
10:00 UTC, Monday through Friday, excluding Chinese public holidays. All other hours are off-peak,
including weekends and Chinese public holidays in full."*
(https://api-docs.deepseek.com/quick_start/pricing, leitura direta)

| Model ID | Entrada cache HIT off-peak | Entrada cache HIT peak | Entrada cache MISS off-peak | Entrada cache MISS peak | Saída off-peak | Saída peak | URL de origem |
|---|---:|---:|---:|---:|---:|---:|---|
| `deepseek-flash` | $0.003 | $0.006 | $0.15 | $0.30 | $0.60 | $1.20 | https://api-docs.deepseek.com/quick_start/pricing |
| `deepseek-v4-pro` | $0.022 | $0.044 | $0.66 | $1.32 | $1.98 | $3.96 | https://api-docs.deepseek.com/quick_start/pricing |

Regra de dedução lida: *"The expense = number of tokens × price."* e *"Product prices may vary and
DeepSeek reserves the right to adjust them."* (idem)

## 2.7 Contagem de tokens usados na resposta (custo real)

| Campo | Significado | URL de origem | Tipo |
|---|---|---|---|
| `usage.prompt_tokens` | *"Number of tokens in the prompt. It equals prompt_cache_hit_tokens + prompt_cache_miss_tokens."* | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |
| `usage.completion_tokens` | Nº de tokens gerados | idem | leitura direta |
| `usage.total_tokens` | prompt + completion | idem | leitura direta |
| `usage.prompt_tokens_details.prompt_cache_hit_tokens` | tokens de prompt que bateram no cache de contexto | idem | leitura direta |
| `usage.prompt_tokens_details.prompt_cache_miss_tokens` | tokens de prompt que erraram o cache | idem | leitura direta |
| `usage.prompt_tokens_details.cached_tokens` | *"Same as `prompt_cache_hit_tokens`."* | idem | leitura direta |
| `usage.completion_tokens_details.reasoning_tokens` | *"Tokens generated by the model for reasoning."* | idem | leitura direta |
| Uso em streaming | `stream_options.include_usage`; *"Either way, the last chunk before the `data: [DONE]` message carries the token usage statistics for the entire request in its `usage` field."* | idem | leitura direta |

**Custo real é calculável** — e a separação cache hit / cache miss é necessária, porque os dois têm
preços diferentes (ex.: `deepseek-flash` $0.003 vs $0.15 no off-peak).

## 2.8 Visão — se aceita imagem e como declarar

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Aceita imagem? | Sim, no `deepseek-flash` (`deepseek-v4-pro`: **Not supported**) | https://api-docs.deepseek.com/guides/vision | leitura direta |
| Corpo (base64 inline) | `content` é array: `[{"type":"text","text":"..."},{"type":"image_url","image_url":{"url":"data:image/jpeg;base64,<BASE64_DATA>"}}]` | idem | leitura direta |
| Corpo (URL externa) | `{"type":"image_url","image_url":{"url":"https://..."}}` | idem | leitura direta |
| Corpo (Files API) | `{"type":"file","file_id":"file-api-xxxx"}` ou `{"type":"file","file_data":"data:image/jpeg;base64,...","filename":"image.jpg"}` | idem | leitura direta |
| Nível de detalhe | `image_url.detail`: `low` (reduz para 512×512), `high` (= `original`), `original`, `auto` (hoje = `original`) | idem | leitura direta |
| Formatos suportados | JPEG, PNG, GIF, WebP — *"The format is detected from the actual file content, not from the file name or the declared MIME type."* | idem | leitura direta |
| **Restrição** | *"Images are supported in `user` messages only. Images in `system` or `assistant` messages return a `400` error."* | idem | leitura direta |
| Tokens por imagem | Resize automático; teto de **1024 tokens por imagem**; múltiplas imagens contadas independentemente | idem | leitura direta |
| Limites | URL externa ≤ 8192 caracteres; corpo ≤ 48 MiB; imagem ≤ 32 MiB (base64/URL) ou 64 MiB (`file_id`); ≤ 600 imagens por requisição; dimensão ≤ 8192 px por lado (cai para 4096 px com 15+ imagens) | idem | leitura direta |

## 2.9 Limite de tokens de saída

| Item | Valor exato | URL de origem | Tipo |
|---|---|---|---|
| Parâmetro | `max_tokens` (integer, nullable) | https://api-docs.deepseek.com/api/create-chat-completion | leitura direta |
| Faixa | *"The value must be between 1 and 384K (393216)."* | idem | leitura direta |
| Máximo | **384K = 393.216 tokens** | idem | leitura direta |
| Default | *"When not set, the default is 8K in non-thinking mode, 64K in thinking mode (128K with `reasoning_effort` set to `max`)."* | idem | leitura direta |
| Contexto total | **1M** tokens (ambos os modelos) | https://api-docs.deepseek.com/quick_start/pricing | leitura direta |
| Limite de concorrência | `deepseek-flash`: 2500; `deepseek-v4-pro`: 500 (por conta; HTTP 429 acima disso) | idem · https://api-docs.deepseek.com/quick_start/rate_limit | leitura direta |

---

# 3. Restrição contratual: menores de 18 anos / conteúdo infantil

## 3.1 DeepSeek — **leitura direta (HTTP 200)**

Fonte: **DeepSeek Terms of Use**, *Last Update: March 27, 2026* —
https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html — leitura direta em 2026-09-30.

| § | Trecho **literal** | Relevância para o Rebeca |
|---|---|---|
| 2.1 | *"The Services are primarily intended for adults. If you are under 18 years old or the minimum age required in your country, please read these Terms with your legal guardian and use the Services only with the consent of your legal guardian. DeepSeek fully understands the importance of protecting minors and will take corresponding protective measures in accordance with legal requirements and industry mainstream practices."* | Idade do **operador** da conta. O Rebeca opera como adulto — requisito atendível. |
| 3.4 (preâmbulo) | *"You will not use the Services to generate, express or promote content or a chatbot that:"* | O §3.4 abaixo vale para **conteúdo gerado**, não só para a conta. |
| 3.4 (7) | *"(7) exploits, harms, or attempts to exploit or harm minors or exposes minors to such content;"* | Proíbe expor menores a esse tipo de conteúdo. |
| 3.4 (8) | *"(8) are designed to specifically appeal to or present a persona of any person under the age of 18 or the minimum age required in your country;"* | **Risco direto e material.** Um canal infantil cujo personagem/ persona é uma criança ("Luna") pode cair literalmente nesta cláusula. Precisa de leitura jurídica antes de usar DeepSeek como provedor do canal infantil. |
| 3.4 (5) | *"(5) is pornographic, obscene, or sexually explicit (e.g., sexual chatbots);"* | Bloqueio absoluto. |
| 3.1 | *"If you publish or disseminate outputs generated by the Services, you must: (1) proactively verify the authenticity and accuracy of the output content...; (2) clearly indicate that the output content is generated by artificial intelligence..."* | Obrigação de **rotular** conteúdo gerado por IA. Impacta o canal do YouTube. |
| 8.2 | *"...restricting account functions, suspending usage, closing accounts, prohibiting re-registration, deleting relevant content..."* | Sanção contratual em caso de violação. |

## 3.2 OpenAI — leitura direta em `developers.openai.com` (HTTP 200)

| Documento | Trecho **literal** | URL | Tipo |
|---|---|---|---|
| Under-18 guidance | *"Young people have unique needs online and offline, so developers should implement additional safeguards when using our API to serve minors (under 18 years old). These are in addition to requirements under our usage policies and terms and conditions."* | https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance | leitura direta |
| Under-18 guidance | *"Organizations serving minors must comply with all applicable child protection, safety, and privacy laws, including the Children's Online Privacy Protection Act (COPPA). You should not use OpenAI services to process any personal data of children under 13 or the applicable age of digital consent without first implementing zero data retention in our API."* | idem | leitura direta |
| Under-18 guidance | *"Organizations serving minors must take reasonable steps to ensure that the content they are serving to minors via the API is safe and age appropriate, in line with our usage policies to "Keep minors safe.""* — com os deveres listados: *"age-appropriate disclosures"*, *"age-appropriate content filters"*, *"reasonable monitoring and reporting mechanisms, including escalation paths for high-risk interactions"*, *"using age assurance systems"* | idem | leitura direta |
| Under-18 guidance | *"Use OpenAI's most current flagship models, which incorporate the latest safety protections, particularly when building experiences for minors."* | idem | leitura direta |
| Under-18 guidance | *"OpenAI reserves the right to audit organizations for compliance with this policy. Customers who fail to demonstrate compliance may receive warnings and, in cases of repeated or serious noncompliance, may be subject to suspension or termination of API access."* | idem | leitura direta |
| CSAM guidance | *"Never use OpenAI services to exploit, endanger, or sexualize anyone under the age of 18."* | https://developers.openai.com/api/docs/guides/csam-guidance | leitura direta |
| CSAM guidance | *"OpenAI has clear child safety expectations for developers: You are responsible for ensuring that your users use OpenAI services in compliance with applicable laws, including laws that criminalize child sexual abuse and exploitation."* | idem | leitura direta |
| CSAM guidance | Moderation API expõe a categoria `sexual/minors` (*"covering sexual content involving people under 18; this category is text-only"*) | idem | leitura direta |

## 3.3 OpenAI — textos de política (leitura **indireta**: `openai.com` retorna 403)

Todas as URLs abaixo **retornaram HTTP 403** ao fetch direto neste ambiente. Os trechos foram lidos
por proxy de leitura que reproduz a URL oficial. Trate como **fonte primária por via indireta**.

| Documento | Trecho (leitura indireta) | URL (403 no fetch direto) |
|---|---|---|
| Terms of Use (conta individual) | *"Minimum age. You must be at least 13 years old or the minimum age required in your country to consent to use the Services. If you are under 18 you must have your parent or legal guardian's permission to use the Services."* | https://openai.com/policies/terms-of-use/ |
| EU Terms of Use | idem, com *"...and ask them to read these Terms with you."* | https://openai.com/policies/eu-terms-of-use/ |
| OpenAI Services Agreement (**contrato que rege a API**) §3.3 | *"Customer will not, and will not permit End Users to: … (c) allow minors to use OpenAI Services without consent from their parent or guardian"* | https://openai.com/policies/services-agreement/ · https://openai.com/policies/business-terms/ |
| Usage Policies ("Keep minors safe") | *"must never be used to exploit, endanger, or sexualize anyone under 18 years old"*; proíbe *"exposing minors to age-inappropriate content"*, *"underaged access to age-restricted goods or activities"*, *"grooming of minors"* | https://openai.com/policies/usage-policies/ |
| Help Center (produto ChatGPT, **não** a API) | *"ChatGPT is not meant for children under 13, and we require that children ages 13 to 18 obtain parental consent before using ChatGPT."* | https://help.openai.com/en/articles/8313401-is-chatgpt-safe-for-all-ages |

## 3.4 Veredito comparado (pergunta 10)

| Pergunta | OpenAI | DeepSeek |
|---|---|---|
| O provedor restringe o uso em produto/serviço destinado a **menores de 18**? | **Não proíbe em geral.** Exige salvaguardas adicionais auditáveis (filtros por idade, age assurance, ZDR para dado pessoal de <13, COPPA). Sanção possível: suspensão/terminação da API. | **Sim, com cláusula de alto risco.** §3.4(8) proíbe conteúdo *"designed to specifically appeal to or present a persona of any person under the age of 18"*, e §3.4(7) proíbe conteúdo que *"exploits, harms, or attempts to exploit or harm minors or exposes minors to such content"*. |
| Idade mínima do operador da conta | 13+ (ou idade local); <18 exige consentimento de pai/responsável; o Customer não pode permitir menores sem esse consentimento | 18+ sem consentimento de responsável; *"primarily intended for adults"* |
| Nível de evidência | Direta no guia de desenvolvedor; indireta nos textos de política (`openai.com` = 403) | **Direta** (Terms of Use lido em `cdn.deepseek.com`, HTTP 200) |

**Implicação prática para o Rebeca:** para o **canal infantil**, a DeepSeek carrega uma cláusula
(§3.4(8)) que pode ser lida como proibição do próprio caso de uso — um personagem menor de idade.
A OpenAI não proíbe o público-alvo, mas impõe deveres de salvaguarda auditáveis. Ambas as leituras
precisam de validação jurídica (skill `rebeca-lgpd`) antes de decisão de arquitetura.

---

# 4. Síntese comparativa (apoio à decisão de arquitetura)

| Dimensão | OpenAI | DeepSeek |
|---|---|---|
| Endpoint de chat | `POST https://api.openai.com/v1/chat/completions` (e `/v1/responses`) | `POST https://api.deepseek.com/chat/completions` |
| Auth | `Authorization: Bearer <API key>` | `Authorization: Bearer <API key>` |
| **JSON Schema validado** | **Sim**: `response_format.json_schema.strict = true` (Chat Completions) / `text.format` (Responses) | **Não em `response_format`**; só via tool calls `strict: true` em `/beta` (Beta, subconjunto de JSON Schema) |
| Garantia de JSON válido | `json_schema` ou `json_object` | `json_object` (exige a palavra "json" no prompt; pode voltar vazio) |
| Recusa programaticamente detectável | Sim (`refusal`) | `NÃO VERIFICADO` (a doc lida não documenta campo de recusa) |
| Custo real | `usage.prompt_tokens` / `usage.completion_tokens` / `usage.total_tokens` | idem + separação `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens` |
| Visão | Sim, em `gpt-6-astra`, `gpt-6.1-sol`, `gpt-6-luna` | Sim, **apenas** em `deepseek-flash` |
| Máx. tokens de saída | 128.000 por modelo (`max_completion_tokens` / `max_output_tokens`) | 384K = 393.216 (`max_tokens`) |
| Menor preço de entrada | `gpt-5-nano` $0.05/1M (saída $0.40) | `deepseek-flash` $0.15/1M off-peak cache-miss (saída $0.60) |
| Menor preço de saída | `gpt-5-nano` $0.40/1M | `deepseek-flash` $0.60/1M off-peak |
| Menor preço de entrada em cache | `gpt-5-nano` $0.005/1M | `deepseek-flash` $0.003/1M off-peak |
| Restrição sobre menores | Deveres de salvaguarda auditáveis; não proíbe o público-alvo | §3.4(7) e §3.4(8) — risco alto para persona infantil |

> Nota de leitura: a OpenAI tem **catch de cache muito mais barato em proporção** e **JSON Schema
> nativo**; a DeepSeek tem **saída de 384K tokens** e preço absoluto baixo no modo off-peak. O custo
> real de qualquer um dos dois depende de ler `usage` a cada resposta (§1.7 e §2.7).

---

# 5. Lacunas (NÃO VERIFICADO)

1. **`NÃO VERIFICADO` — Modelo recomendado para "escrita criativa" (OpenAI).** Nenhuma página oficial
   de modelos da OpenAI (`models.md`, `models/all.md`, páginas individuais) classifica qualquer modelo
   como "para escrita criativa". Não atribuí nenhum ID a essa categoria.
2. **`NÃO VERIFICADO` — Modelo recomendado para "escrita criativa" (DeepSeek).** Idem para
   `quick_start/pricing` e `api/create-chat-completion`.
3. **`NÃO VERIFICADO` — Lista exaustiva de restrições de JSON Schema em `strict: true` (OpenAI).**
   Confirmei a afirmação *"Only a subset of JSON Schema is supported when `strict` is `true`"* e que
   `additionalProperties: false` aparece nos exemplos oficiais, mas a seção "Supported schemas" com a
   lista completa não foi lida (a página é longa e o conteúdo foi truncado no fetch).
4. **`NÃO VERIFICADO` — Teto numérico global de `max_completion_tokens` / `max_output_tokens` (OpenAI).**
   Só os limites por modelo (128.000) estão documentados nas páginas lidas.
5. **`NÃO VERIFICADO` — Campo de "recusa" programaticamente detectável na DeepSeek.** A documentação
   lida (`create-chat-completion`, `json_mode`, `tool_calls`) não documenta campo equivalente ao
   `refusal` da OpenAI. Também não documenta `finish_reason` de recusa — os valores possíveis lidos são
   `stop`, `length`, `content_filter`, `tool_calls`, `insufficient_system_resource`, `aborted`.
6. **`NÃO VERIFICADO` — Leitura direta dos textos de política da OpenAI.** `openai.com/policies/**`,
   `openai.com/pt-BR/policies/**` e `help.openai.com/en/articles/8313401-*` retornaram **HTTP 403**;
   `cdn.openai.com/policies/terms-of-use.pdf` retornou **404**. Os trechos do §3.3 foram obtidos por
   proxy de leitura (fonte primária por via indireta). A data de vigência do Terms of Use individual
   foi lida como *"Effective: January 1, 2026"*, mas **não** foi possível comparar com revisões
   anteriores.
7. **`NÃO VERIFICADO` — Se a DeepSeek aplica a restrição §3.4(8) a conteúdo infantil não interativo**
   (ex.: vídeo publicado no YouTube, e não um chatbot). A cláusula fala em *"content or a chatbot"*;
   não há documento lido que interprete esse escopo.
8. **`NÃO VERIFICADO` — Endpoint/limite de imagem para `deepseek-v4-pro`.** A tabela oficial marca
   `Vision: Not supported` para esse modelo; não existe documentação alternativa lida que indique
   suporte por outra rota.
9. **`NÃO VERIFICADO` — `platform.openai.com/docs/**`.** Toda tentativa de leitura direta retornou
   **HTTP 403**; a documentação equivalente foi lida em `developers.openai.com`, que é o domínio
   atual indicado pelos próprios redirecionamentos.
10. **`NÃO VERIFICADO` — Preço de tokens de imagem em USD por provedor.** A OpenAI documenta a
   conversão imagem→tokens e o multiplicador por modelo, e a DeepSeek documenta o teto de 1024 tokens
   por imagem, mas **não** há preço separado de imagem: ela é cobrada como token de entrada do modelo.
   Não há linha de preço "por imagem" a citar.
11. **`NÃO VERIFICADO` — `usage` no Responses API da DeepSeek.** O formato de `usage` foi confirmado
    apenas para o Chat Completions. A página de Responses API da DeepSeek não foi lida.
12. **`NÃO VERIFICADO` — Políticas da OpenAI citadas mas não lidas:** Sharing & Publication Policy,
    Connectors/Actions Terms e o DPA, quanto a menções específicas a menores.

---

# 6. Índice de URLs de origem (todas lidas em 2026-09-30)

| # | URL | Assunto | Tipo |
|---|---|---|---|
| 1 | https://developers.openai.com/api/docs/pricing.md | Tabela de preços OpenAI | direta |
| 2 | https://developers.openai.com/api/docs/models.md | Catálogo de modelos OpenAI | direta |
| 3 | https://developers.openai.com/api/docs/models/all.md | Catálogo completo OpenAI | direta |
| 4 | https://developers.openai.com/api/docs/models/gpt-6-astra.md | `gpt-6-astra`: contexto, saída, preço, features | direta |
| 5 | https://developers.openai.com/api/docs/models/gpt-6.1-sol.md | `gpt-6.1-sol` | direta |
| 6 | https://developers.openai.com/api/docs/models/gpt-6-luna.md | `gpt-6-luna` | direta |
| 7 | https://developers.openai.com/api/reference/resources/chat.md | Endpoint, auth, `messages`, `response_format`, `usage` | direta |
| 8 | https://developers.openai.com/api/reference/resources/responses/methods/create.md | `POST /responses` | direta |
| 9 | https://developers.openai.com/api/docs/guides/structured-outputs.md | JSON Schema / `strict` / `refusal` | direta |
| 10 | https://developers.openai.com/api/docs/guides/images-vision.md | Visão OpenAI: corpo, formatos, limites | direta |
| 11 | https://developers.openai.com/api/docs/quickstart.md | Base URL, auth, curl | direta |
| 12 | https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance.md | Menores de 18 na API | direta |
| 13 | https://developers.openai.com/api/docs/guides/csam-guidance.md | CSAM e segurança infantil | direta |
| 14 | https://api-docs.deepseek.com/ | Base URL, auth, endpoint, exemplo curl | direta |
| 15 | https://api-docs.deepseek.com/quick_start/pricing | Modelos, contexto, max output, preços | direta |
| 16 | https://api-docs.deepseek.com/api/create-chat-completion | Endpoint, corpo, `response_format`, `usage` | direta |
| 17 | https://api-docs.deepseek.com/guides/json_mode | JSON Output (só `json_object`) | direta |
| 18 | https://api-docs.deepseek.com/guides/tool_calls | `strict` mode + subconjunto de JSON Schema | direta |
| 19 | https://api-docs.deepseek.com/guides/vision | Imagem: corpo, formatos, limites | direta |
| 20 | https://api-docs.deepseek.com/quick_start/token_usage | Tokenização e contagem | direta |
| 21 | https://api-docs.deepseek.com/quick_start/rate_limit | Concorrência e isolamento | direta |
| 22 | https://cdn.deepseek.com/policies/en-US/deepseek-terms-of-use.html | Terms of Use (27/03/2026), §2.1 e §3.4 | direta |
| 23 | https://openai.com/policies/terms-of-use/ | Idade mínima (conta) | indireta (403 direto) |
| 24 | https://openai.com/policies/eu-terms-of-use/ | Idade mínima (UE) | indireta (403 direto) |
| 25 | https://openai.com/policies/services-agreement/ | §3.3(c) — contrato da API | indireta (403 direto) |
| 26 | https://openai.com/policies/business-terms/ | idem services-agreement | indireta (403 direto) |
| 27 | https://openai.com/policies/usage-policies/ | "Keep minors safe" | indireta (403 direto) |
| 28 | https://help.openai.com/en/articles/8313401-is-chatgpt-safe-for-all-ages | Idade no produto ChatGPT | indireta (403 direto) |
