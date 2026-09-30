# ADR-005 — Provedores de mídia com IA e teto de custo por vídeo (D2)

## Status
**proposto** — aguarda decisão humana. Nada aqui autoriza gerar mídia paga nem publicar.

## Data
2026-09-30

## Contexto

D2 é a decisão que bloqueia `rebeca-ia-video` e `rebeca-backend`: **quais provedores de IA geram a
mídia do canal e qual o teto de custo por vídeo**. Ela precisa ser tomada antes do primeiro episódio
porque define o orçamento, a arquitetura de abstração de provedor e a viabilidade do negócio.

Três coisas mudaram o problema durante a apuração, e nenhuma delas era conhecida quando a D2 foi
aberta:

1. **O caminho mais barato e tecnicamente mais completo está contratualmente fechado.** O Google
   (Veo/Imagen/Lyria/TTS) veda uso da API em serviço *"directed towards or is likely to be accessed by
   individuals under the age of 18"*. Foi verificado na fonte primária por **duas leituras
   independentes** — e a tentativa de reabrir pelo Vertex também caiu: os *Google Cloud Service
   Specific Terms* §20(d) repetem a restrição com redação **mais ampla**, com suspensão por suspeita
   (§20(f)). **O Google está bloqueado nas três vias** (Developer API, Vertex/Enterprise e revenda).
2. **Duas das treze métricas que o produto promete medir não existem na API oficial** (§3.7), e
   impressões/CTR só saem em relatório em massa. Isso não afeta a D2 diretamente, mas afeta o que o
   produto pode prometer quando o custo for justificado por desempenho.
3. **Existe uma regra de monetização específica para conteúdo infantil de IA** — e ela **permite**
   o caso de uso, mas nomeia cinco modos de falha que reprovam o canal (ver
   `.rebeca/pesquisa/ypp-monetizacao-conteudo-ia.md`).

Se nada for decidido, o projeto continua sem teto, sem provedor definido e sem conseguir provar que
o conteúdo se paga — a pergunta central do negócio.

## Decisão

> **Proposta do especialista, sujeita ao dono do produto.** O teto e os provedores são decisão
> humana; o que segue é a recomendação com o raciocínio exposto.

**1. Adotar uma allow-list chaveada por `(modelo, plano, finalidade, origem)` — não por fornecedor
nem por agregador.** Três motivos verificados: o mesmo fornecedor tem termos diferentes por plano
(Runway: consumidor treina e aceita 13+; Enterprise não treina); a restrição varia por finalidade
(Pika proíbe no *input*, não no output); e **agregador não lava a restrição de origem** — a ToS de
revenda sujeita o modelo chamado aos termos do fabricante. Provedor sem termo lido = fora da lista,
com URL, data de leitura, trecho citado e aprovador registrados como **dado versionado**.

**2. Status inicial da allow-list para público infantil (3–5 anos):**

| Modelo / provedor | Status | Fundamento |
|---|---|---|
| **MiniMax** (Open Platform/API) | `PERMITIDO` | Nenhuma cláusula sobre público-alvo ou output representando menor, em 4 documentos. **Condição:** marcar de forma proeminente o uso de *deep synthesis technology* no conteúdo gerado |
| **Luma** (API/Enterprise) | `PERMITIDO` | Silêncio total sobre público-alvo nos 4 documentos. **Plano importa:** consumidor treina; API/Enterprise têm *No Train Guarantee* |
| **Pika** | `PROIBIDO` | AUP: *"You must not upload any images that depict or appear to depict individuals under the age of 18"* — e o pipeline é image-to-video com character sheet do personagem criança |
| **Alibaba/Wan** | `NÃO VERIFICADO` | Só falta a seção §4.45+ dos Product Terms (as anteriores não restringem). Fecha em navegador |
| **Kling** | `PROIBIDO` | Dois documentos oficiais se contradizem sobre uso comercial; um exige rotular o output com a marca "Kling AI" |
| **Google** (Veo/Imagen/Lyria/TTS) | `PROIBIDO` | Cláusula de menores na Developer API **e** no §20(d) do GCP |
| **Cartesia** | `PROIBIDO` | AUP veda output que represente indivíduos menores de 18 |
| **ElevenLabs** | `PROIBIDO` | PUP 9(r): *"bundled solutions that target anyone under the age of 13"* |

**Ressalva que precisa ficar escrita:** para MiniMax e Luma o status é `PERMITIDO` **por ausência de
cláusula**, não por licença afirmativa. Converter silêncio em certeza exige o pedido escrito de
permissão (opção §5(b) do memo de conformidade). Enquanto ele não existir, o risco é *interpretativo*,
não zero.

**3. Stack e teto propostos para o piloto:**

| Stack | Composição | US$/min | Situação de conformidade hoje |
|---|---|---|---|
| **A — MiniMax-H3 768P** + FLUX.2 klein + Azure S1 Neural + Suno Pro | 8,55 | ✅ **todos os modelos com termo lido e permitido** |
| B — Wan 1080P (US-Virginia) | 17,58 | ❌ depende de termos não lidos |
| B — Wan 1080P (Singapore) | 21,18 | ❌ idem |
| C — Wan com retrabalho 2,0 | 28,73 | ❌ idem |

**Recomendação: piloto na Stack A com teto de US$ 12,00/min.** A razão não é o preço ser baixo — é
que **A é a única stack cujos modelos têm termo lido e permitido**. Fixar teto de US$ 20/min seria
escolher um número que **apenas a stack não conforme** alcança, o que inverte a lógica: o teto passaria
a justificar o fornecedor, em vez do contrário.

O teto é **revisável por dado**: após 4 episódios com custo real em `.rebeca/custos.csv`, recalibrar.
A premissa mais frágil de toda a conta é a **taxa de retrabalho** (fator 1,5 = 33,3% de rejeição, não
50%) — e ela só é substituível por medição real. **Vídeo é ~96% do custo**; a voz do episódio inteiro
custa centavos. Otimizar voz é otimizar o arredondamento.

**4. Restrições de linha de produção que a decisão arrasta** (não são preferência, são gate):

- **Rodapé de rótulo obrigatório** na mídia gerada pela MiniMax (deep synthesis) — requisito de render.
- **Proibido upload de imagem que represente menor** em qualquer provedor cujo termo o vede — o
  character sheet da Luna é um desenho de personagem, e o gate precisa distinguir isso de foto de
  criança real de forma **documentada**, não presumida.
- **Declarar `made for kids`** (`status.selfDeclaredMadeForKids`) em toda publicação do canal infantil.
- **Aviso de certificação no botão de upload** na tela de aprovação (exigência da YouTube API ToS
  §9.1(i)).
- **Variedade de enredo por episódio** e **correção factual do conteúdo educativo** passam a ser
  critérios de elegibilidade de monetização, não qualidade editorial.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Usar Google/Veo por ser o mais barato (≥ US$ 3,86/min) | Contratualmente vedado para serviço dirigido a menores — nas três vias. Verificado na fonte |
| Reabrir o Google via Vertex AI | §20(d) dos GCP Service Specific Terms repete a restrição com redação mais ampla. Duas leituras independentes |
| Ler "API Client" como o software Rebeca e ignorar o público do canal | Exige sustentar que o canal de destino é irrelevante para o contrato. É interpretação de advogado, e o custo do erro é assimétrico (suspensão de conta/projeto) |
| Stack B (Wan) agora | Depende dos termos do Alibaba (não lidos) e a revenda pela Runway **não** resolve: agregador não lava a restrição de origem |
| Teto de US$ 20/min com Stack B | Teto escrito para caber a única stack que hoje não é conforme |
| Declarar a Luna como "não para crianças" | Insustentável: o YouTube obriga declarar e lista exatamente os fatores que a Luna tem |
| Usar o tier de consumidor (Hailuo, Runway consumer, Luma consumer) | Mais barato/treina com dados/idade 13+ — inadequado a uso comercial e a público infantil |

## Consequências

- **Positivas:** o pipeline pode começar com fornecedor contratualmente defensável; o custo fica
  dentro de um teto que a stack escolhida realmente respeita; a allow-list vira dado auditável, não
  opinião de agente.
- **Negativas / custo assumido:** 768P exige upscale para 1080p e 24 fps exige conformação no render;
  a qualidade visual do piloto será menor que a de um provedor bloqueado; o custo por minuto é ~2× o
  do caminho proibido — esse é o **preço da conformidade**, e precisa ser dito ao negócio.
- **O que muda para o usuário:** ele escolhe canal e episódio; a escolha de provedor é invisível
  (invariante 7). O que ele **vê** é o custo real por episódio e o aviso de certificação de upload.
- **Impacto em isolamento multi-canal:** a allow-list é **por canal** — canal adulto pode usar
  fornecedor que o canal infantil não pode. Isso é funcionalidade, não exceção.
- **Impacto em custo por vídeo:** teto de US$ 12/min no piloto; Stack A medida em 8,55/min.

## Verificação

1. **Custo real medido, não estimado:** após 4 episódios, `usd_por_minuto` calculado de
   `.rebeca/custos.csv` (colunas reais `canal`/`conteudo`/`custo_usd`) e comparado ao teto. Sem isso a
   premissa de retrabalho continua sendo chute.
2. **Gate testado adversarialmente:** canal infantil + provedor `PROIBIDO` → chamada **recusada**, com
   log; canal adulto + mesmo provedor → permitida.
3. **Rótulo MiniMax presente** no arquivo renderizado (conferência no `ffprobe`/inspeção de frame).
4. **`made for kids`** em toda publicação do canal infantil.
5. **Reavaliação obrigatória** quando: (i) os termos do Alibaba §4.45+ forem lidos; (ii) o painel de
   custo acusar retrabalho > 50%; (iii) a ANPD ampliar a fiscalização (nov/2026); (iv) qualquer
   provedor publicar nova versão dos termos — **termo que mudou invalida a allow-list até nova
   leitura**.

## Quem decidiu

- **Propôs:** `rebeca-ia-video` (dossiê e números) + `rebeca-lgpd` (memo de conformidade, v2 após
  refutação) + `rebeca-youtube` (spec da API) — com refutação adversarial de `rebeca-qa` e
  recomputação independente do orquestrador.
- **Aprova (pendente):** humano, dono do produto — **obrigatório**, porque a decisão gasta dinheiro,
  define escopo do produto e envolve conteúdo para menores.

### O que continua sendo decisão de advogado (não desta ADR)

1. Se o canal publicado é "API Client"/"Customer Application" para os fins das cláusulas de menores.
2. Se "silêncio contratual" da MiniMax e da Luma é suficiente, ou se é preciso permissão escrita.
3. Se o Rebeca se qualifica como serviço com **controle editorial** (art. 2º IX / art. 39 §1º do ECA
   Digital) — e o que a dispensa alcança.
4. Quem cumpre os arts. 8º, 14 e 17 do ECA Digital na repartição software × canal.
5. Se a camada Medir trata dado pessoal de criança (art. 14 da LGPD).
6. Suficiência dos DPAs e papéis controlador/operador.
