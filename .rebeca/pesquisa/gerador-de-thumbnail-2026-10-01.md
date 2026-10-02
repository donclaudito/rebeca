# Gerador de thumbnail — apuração em fonte primária (2026-10-01)

**Por que este documento existe.** O `ADR-010` decidiu o pipeline de mídia e o `ADR-005` decidiu os
provedores — mas nenhum dos dois cobre **thumbnail**: não existe etapa de thumbnail em
`spec-midia.json`, `criar-thumbnail` é função de LLM (devolve **conceito**, não imagem) e nenhum arquivo
`option-*` existe no repositório. O dono do produto pediu: *"a arte da thumbnail não tem gerador em canto
nenhum, procure um que funcione"*.

**Método.** Leitura das páginas **oficiais** de cada fornecedor. Onde a página oficial é renderizada por
JavaScript e o `web_fetch` devolveu vazio (ToS/Privacy/Pricing da MiniMax), o texto da **própria página
oficial** foi obtido por extrator de terceiro (`r.jina.ai`) — registrado aqui porque muda a força da
evidência. **Nenhum blog foi usado como fonte de fato.** O que não deu para ler está marcado
`NÃO VERIFICADO`.

**Recorte que importa:** o canal piloto é infantil (3–5 anos) e o personagem é uma criança **desenhada**.
O gate não é preço — é saber se o fornecedor permite usar a API para produto cujo público são menores de
18 anos. O Google é `PROIBIDO` justamente por isso (`gemini-api/terms`, "Age Requirements").

---

## 1. MiniMax `image-01` — **o candidato mais defensável**

| Item | Fato verificado | Fonte |
|---|---|---|
| Modelo e endpoint | `POST https://api.minimax.io/v1/image_generation`, `model: "image-01"` | [image-generation-t2i](https://platform.minimax.io/docs/api-reference/image-generation-t2i) |
| **Preço** | **US$ 0,0035 por imagem** | [pricing-paygo](https://platform.minimax.io/docs/guides/pricing-paygo) |
| **16:9 nativo** | `aspect_ratio: 16:9` → **1280×720** — exatamente o tamanho da thumbnail do YouTube | [image-generation-t2i](https://platform.minimax.io/docs/api-reference/image-generation-t2i) |
| Teto de resolução | `width`/`height` até **2048**, divisível por 8 | idem |
| **Consistência** | `subject_reference`: *"preserves the subject's key characteristics… same virtual character in different contexts"* — **1 imagem de referência por request** | [image-generation](https://platform.minimax.io/docs/guides/image-generation) · [image-generation-i2i](https://platform.minimax.io/docs/api-reference/image-generation-i2i) |
| **Público-alvo / menores** | **NENHUMA cláusula.** As duas menções de idade são sobre o **titular da conta**, não sobre a audiência: ToS *"if you are under 18, please read this Agreement with a guardian"* e Privacy §7 *"Our Services is not intended for children under 16 years of age"* | [ToS](https://platform.minimax.io/protocol/terms-of-service) · [Privacy](https://platform.minimax.io/protocol/privacy-policy) |
| Uso comercial | *"you retain your ownership rights in Client input and generated content"* — e nenhuma proibição comercial | ToS, *Intellectual Property* |
| Treinamento com seus dados | *"We may use the input and generated content to provide, maintain, develop, and improve our Services"* — **sem opt-out** (0 ocorrências de "opt-out" no texto integral) | ToS, *Intellectual Property* 3 |

**Custo real de um conjunto de thumbnails:** 4 opções × US$ 0,0035 = **US$ 0,014**. O `ADR-005` já dizia
que otimizar os itens baratos do episódio é otimizar o arredondamento — vídeo é ~96% do custo. É este o
caso: o gerador de thumbnail inteiro custa menos que um milésimo de um episódio.

**Por que este é o candidato certo, e não só o mais barato:** a MiniMax **já está na allow-list do
`ADR-005` como `PERMITIDO`** para este canal, com quatro documentos lidos. Escolher `image-01` **estende
uma entrada já aprovada de vídeo para imagem**, em vez de abrir um fornecedor novo — que é exatamente a
lógica que o `ADR-005` recusa inverter ("o teto passando a justificar o fornecedor").

**Ressalva honesta:** `subject_reference` é documentado para **retrato frontal** (foto) e aceita **uma**
imagem. Para personagem de desenho isso é plausível, mas **não é garantido** pela documentação —
`NÃO VERIFICADO` até um teste real.

## 2. Luma — também sem cláusula de público, com ressalvas

| Item | Fato verificado | Fonte |
|---|---|---|
| API nova (Agents) | `uni-1` (US$ 0,0404/imagem) · `uni-1-max` (US$ 0,1000) | [pricing](https://docs.agents.lumalabs.ai/guides/pricing/) |
| API legada | `photon-1` · `photon-flash-1` — **preço NÃO VERIFICADO** (a página de billing redireciona para a home) | — |
| 16:9 | suportado; resolução declarada "2048-pixel (2K)" num documento e "o modelo escolhe" em outro → **pixels exatos NÃO VERIFICADOS** (exigiria downscale para 1280×720) | [generation](https://docs.agents.lumalabs.ai/guides/images/generation/) · [FAQ](https://docs.agents.lumalabs.ai/guides/faq/) |
| Referência de personagem | `image_ref` até **9** imagens (API nova); `character_ref` com até 4 (legada) | [image-generation](https://docs.lumalabs.ai/docs/image-generation) |
| **Público-alvo / menores** | **NENHUMA cláusula.** O que existe é sobre o **titular** (ToS §3.3: *"Users under 13 are not authorized"*, aviso COPPA) e sobre **conteúdo proibido** (*"exploiting or harming children"*, *"sexualize children"*) | [ToS](https://lumalabs.ai/legal/terms-of-service) · [Enterprise ToS](https://lumalabs.ai/legal/enterprise-terms-of-service) |
| Uso comercial | *"Images & Videos created using the API are allowed for commercial use"*; exige assinatura paga ativa | [FAQ](https://docs.lumalabs.ai/docs/faq) |
| **Treinamento — documentos se contradizem** | API Terms §10: *"Luma will not use any Input… or Output… to train"*. Mas a página de preço da API nova diz que **só o Provisioned Throughput** tem a garantia: *"No-train guarantee: pay-as-you-go → No; provisioned → Yes"* | [api-terms-of-use](https://lumalabs.ai/legal/api-terms-of-use) · [pricing](https://docs.agents.lumalabs.ai/guides/pricing/) |

**Leitura:** a Luma é defensável no quesito público, e é a **única das duas com garantia escrita de
"no-train"** — mas só no tier Provisioned Throughput. Em compensação custa **~12× mais** que a MiniMax por
imagem e **não entrega 1280×720 nativo**.

## 3. O que a apuração **refutou** e o que ela **descobriu de quebra**

1. **`fal.ai` não tem cláusula de público menor** — o AUP foi lido na íntegra e o que existe sobre
   criança é proibição de exploração/CSAM, não de produto infantil. **Mas** o ToS exige que os *End
   Users* de uma solução integrada tenham 18+ e o §6(c) permite usar *Usage Data* para desenvolver
   modelos. Como agregador, a fal também **não lava** a restrição do modelo de origem (regra do
   `ADR-005`). Fica como rota de conveniência, não como escolha primária.
2. **A Black Forest Labs não tem cláusula de público-alvo** ([ToS](https://bfl.ai/legal/terms-of-service),
   revisado em 2026-08-01) — mas treina com o seu conteúdo por padrão (opt-out só por e-mail) e o §1.3(e)
   tem redação restritiva sobre exploração comercial. Os **pesos** do FLUX.2 [klein] são licenciados por
   assinatura, **com limite de domínios** ([licensing](https://bfl.ai/licensing)).
3. **Lacuna encontrada no `ADR-005`:** a Stack A aprovada inclui **"FLUX.2 klein"** como modelo de
   imagem, mas **a BFL não aparece na tabela de allow-list daquele ADR** — nem com `PERMITIDO`, nem com
   `NÃO VERIFICADO`. O modelo de imagem da stack aprovada **nunca teve termo lido registrado**. Isso não
   invalida a stack; invalida a *suposição* de que ela estava coberta.
4. **Consequência boa:** adotar a MiniMax `image-01` para imagem **fecha essa lacuna por cima** — o
   fornecedor de imagem passa a ser o mesmo do vídeo, já `PERMITIDO`, com termo lido.

## 4. Recomendação

**MiniMax `image-01`**, por três razões nesta ordem — e a ordem importa:

1. **Conformidade:** nenhuma cláusula de público-alvo nos documentos oficiais, e o fornecedor **já está
   `PERMITIDO`** na allow-list do `ADR-005` para este canal.
2. **Encaixe técnico:** entrega **1280×720 nativo** em 16:9 — o tamanho exato da thumbnail, sem upscale
   nem downscale — e aceita imagem de referência para manter o personagem.
3. **Custo:** US$ 0,0035/imagem; o conjunto de 4 opções custa **US$ 0,014**, dentro do teto D5 de
   US$ 60/mês por uma margem de quatro ordens de grandeza.

**Luma** fica como alternativa registrada, preferível apenas se a política interna exigir garantia
contratual de *no-train* — e aí no tier Provisioned Throughput.

## 5. O que continua faltando (e nenhum fornecedor resolve)

- **A referência oficial da Luna não existe.** `.rebeca/brand/` não existe: sem Brand Kit e sem
  Character Sheet. O `subject_reference` da MiniMax aceita **1 imagem frontal** — ou seja, a dívida cai
  de "Character Sheet completo com 4–6 expressões e poses" para **uma imagem de referência aprovada**.
  É menor do que parecia, mas ainda é arte que ninguém produziu, e é do `rebeca-branding`.
- **Não existe etapa de thumbnail no pipeline.** `spec-midia.json` não tem a seção, e
  `MediaStage` (`src/media/contract.ts`) não tem o valor. O gerador precisa ser construído atrás da
  interface `ImageProvider` que já existe (invariante nº 7).
- **Nenhuma chamada real foi feita.** Não há chave da MiniMax nesta máquina; os fatos acima vêm de
  documentação oficial lida hoje, não de execução.

## 6. `NÃO VERIFICADO` — declarado, não maquiado

1. Qualquer chave de API da MiniMax ou da Luma existe no ambiente? **Não verificado** (e não deve ser
   presumido).
2. Preço oficial da API legada da Luma (`photon-1`/`photon-flash-1`).
3. Resolução exata por proporção na API nova da Luma.
4. `image-01-live` (aparece no enum do OpenAPI de image-to-image, sem documentação em prosa).
5. `lumalabs.ai/aup` retorna **404** hoje — a AUP autônoma da Luma não pôde ser lida.
6. Mecanismo de opt-out de treino em qualquer dos dois fornecedores: **não existe** nos textos lidos.
7. Trechos obtidos por extrator de terceiro (`r.jina.ai`) sobre páginas oficiais da MiniMax — reler no
   navegador antes de virar requisito contratual, pela mesma regra que o `ADR-005` já aplicou à página de
   monetização do YouTube.
