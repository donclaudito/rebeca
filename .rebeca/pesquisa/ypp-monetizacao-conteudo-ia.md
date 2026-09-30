# YPP — as regras de monetização que decidem se o canal de IA infantil se paga

**Fecha a lacuna L1** que o dossiê D2 e o `rebeca-youtube` declararam como "o maior risco do negócio"
e que nenhum agente conseguiu ler (a página respondia HTTP 200 mas devolvia só o título).
**Autor:** `rebeca-ia-video` + `rebeca-youtube`. **Data:** 2026-09-30.

**Fonte:** https://support.google.com/youtube/answer/1311392 (YouTube channel monetization policies).
**Limite de leitura declarado:** o corpo veio por **extrator de texto de terceiro (`r.jina.ai`)
aplicado sobre a URL oficial**, porque o fetch direto devolve apenas o título (página renderizada por
JS). O conteúdo é o da página oficial e o texto é contínuo e coerente, mas **a mediação é de terceiro**
— releia no navegador antes de transformar qualquer trecho em requisito contratual. A página **não
exibe data de "last updated"** no corpo extraído; o evento datado mais recente é de **15/07/2025**.

---

## 1. A resposta curta: conteúdo de IA infantil **pode** monetizar — e é dito com essas palavras

Isto é o oposto do que se costuma assumir. Na seção *Unsatisfying or Off-putting Content*, entre os
exemplos **permitidos**:

> "Content that expresses your unique creative voice, like **using AI to visualize a unique character
> and narrative you invented**"
> "Content that utilizes creative tools to assist in delivering a unique, well-researched, or creative
> narrative, like **using AI to edit your video scripts or generate a unique background visual** for
> your content"

Ou seja: o YouTube **nomeia explicitamente** o caso de uso da Luna como monetizável. O problema não é
usar IA — é **como**.

## 2. O que reprova — e cada item bate num risco que já mapeamos

### 2.1 "Inauthentic content" (renomeada de "repetitious content" em 15/07/2025)

> "**AI-generated content made with generic or unoriginal templates giving the impression of mass
> production without adding the creator's original, authentic insights or perspective**"
> "Videos where **characters are put in the same situation over and over again with the same outcome**
> (i.e., using a highly similar storyline template across multiple videos)"

E o que **salva** o formato seriado:

> "Similar content, like **a series following a set of characters across episodes** or a channel that
> does product reviews, but in which **each video has a distinct storyline, focus, or concept**"

**Consequência para o Rebeca — é requisito, não preferência:** a série com personagem fixa é
permitida; o que reprova é **repetir o mesmo esqueleto de história**. Isso transforma "variedade de
enredo" numa **restrição dura do gerador de pauta/roteiro**: cada episódio precisa de premissa,
conflito e desfecho distintos, e isso tem de ser **verificável** — não confiado ao acaso do modelo.
O prompt de pauta precisa de um teste adversarial do tipo "dois episódios seguidos têm a mesma
estrutura?".

### 2.2 Clipes de IA inconsistentes são violação nomeada

> "Content that lacks a clear narrative arc or logical progression, such as videos that **stitch
> together unrelated or inconsistent AI clips** to surprise or shock viewers"

O invariante 3 do `AGENTS.md` ("a Luna precisa parecer a mesma em todos os episódios") deixa de ser
qualidade de marca e passa a ser **elegibilidade de monetização**. Consistência de personagem e de
clipe agora tem consequência financeira direta.

### 2.3 ⚠️ "Deceptively educational" — o risco mais específico da Luna

> "_**Deceptively educational:**_ This refers to content that uses titles or thumbnails to trick kids
> into thinking it's educational, when it's really not. **It might promise to teach something, like
> colors or numbers, but show incorrect or unhelpful information.**"

O canal piloto chama-se **"Luna e o Jardim das Cores"** e ensina cores. Esta cláusula incide
**diretamente** sobre o conceito do canal. Erro factual de cor, contagem ou nome num episódio não é
descuido pedagógico — é **critério de desmonetização**.

Isso aciona `rebeca-infantil` de forma nova: não basta "adequado à faixa etária", é preciso
**correção factual verificável** do conteúdo educativo, com registro de quem conferiu.

### 2.4 "Hard to follow" — escrito pensando em geração automática

> "_**Hard to follow:**_ Videos that are confusing or make no sense, often due to jumbled storylines,
> unclear audio, or lack of clear storyline (beginning, middle & end). **This type of video is often
> the result of mass production or autogeneration.**"

A cláusula nomeia o modo de falha exato de um pipeline automatizado. Início-meio-fim explícitos e
áudio claro passam a ser **itens de checklist de publicação**.

### 2.5 Sanção é de canal, não de vídeo

> "If a channel is found to have a **strong focus on low-quality 'made for kids' content, it may be
> suspended** from the YouTube Partner Program."
> "If an individual video is found to violate these quality principles, it may see **limited ad
> earnings or no ad earnings**."

Ou seja: o risco não é perder um vídeo — é perder o canal. E o gatilho é o **conjunto**, não a
exceção. "Um episódio ruim" não é problema; "um padrão de episódios rasos" é.

## 3. O que isto muda no produto

| Antes | Agora (com fonte) |
|---|---|
| "Conteúdo infantil de IA pode ser desmonetizado" (medo genérico) | **Permitido explicitamente**, se narrativa e personagem forem originais |
| Variedade de enredo é qualidade editorial | **Requisito de elegibilidade** — mesmo esqueleto de história em série reprova |
| Consistência de personagem é branding (invariante 3) | Também é **elegibilidade**: "inconsistent AI clips" está nomeado |
| Correção pedagógica é do `rebeca-infantil` | É também **critério de monetização** ("deceptively educational", com "cores" citado) |
| Metadados (título/thumbnail) são SEO | Título/thumbnail que prometem ensino inexistente é **violação** |
| Risco = perder o vídeo | Risco = **suspensão do canal no YPP** |

## 4. Lacunas que continuam abertas

- **Página sem data de atualização legível** no corpo extraído — a versão vigente pode diferir da
  lida. Releitura no navegador necessária.
- **"Quality principles for kids and family content"** (`/answer/10774223`) e **"best practices for
  kids and family content"** não foram lidos: a política acima diz que a **lista de princípios
  aplicados pode crescer** ("We may increase the scope to include more quality principles over
  time"), e é nessa página que a lista viva está.
- **Advertiser-friendly content guidelines** (`/answer/6162278`) — exigidas para receita de anúncio —
  não lidas.
- Se o "made for kids" afeta a disponibilidade de dados de analytics (pergunta do `rebeca-youtube`)
  segue `NÃO VERIFICADO`.
