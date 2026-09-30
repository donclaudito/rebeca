# Rebeca — Visão de Produto (fonte de verdade)

> Extraído de `O APP.pdf` (documento de visão do cliente). **Este arquivo é a fonte de verdade do
> produto.** Nenhum agente desta orquestra deve contradizer este documento; se uma decisão técnica
> exigir mudar algo aqui, abre-se um ADR em `.rebeca/decisoes/` e pede-se aprovação humana.

## 1. O problema

Já existe IA capaz de fazer quase tudo na produção de conteúdo: ideias, roteiros, personagens,
imagens, vozes, músicas, vídeos, thumbnails. O que **não** existe é o processo integrado.

Hoje, para operar um canal de YouTube feito com IA, a pessoa encadeia 5 a 10 ferramentas
diferentes: pesquisa em uma, roteiro em outra, personagem em outra, vídeo pago em outra, voz/música
em outra, thumbnail, título/descrição, upload manual no YouTube Studio, configuração, agendamento —
e, dias depois, volta para olhar se funcionou.

**Conclusão:** apesar de existir IA para praticamente todas as etapas, a operação continua exigindo
muito trabalho humano e ferramentas fragmentadas.

## 2. A tese

> O Rebeca é um **sistema operacional para canais de mídia**: uma central inteligente que opera
> praticamente todo o ciclo de vida de um canal de YouTube com IA em um único lugar.

Não é "mais um gerador de vídeo". É como dar ao usuário uma pequena **equipe de mídia virtual**
(estratégia, pesquisa, roteiro, criação, edição, SEO, thumbnails, publicação, analytics,
otimização) executada pela IA dentro do mesmo sistema.

**Diferencial literal do PDF:** *"Em vez de vender uma ferramenta de vídeo, estamos criando um
sistema operacional para canais de mídia."*

## 3. O ciclo central (o coração do produto)

```
Pesquisar → Planejar → Criar → Revisar → Aprovar → Agendar → Publicar → Medir → Aprender → Melhorar
                                    ↑                                                    │
                                    └──────────────── ciclo contínuo ────────────────────┘
```

### 3.1 Pesquisar
Entender o mercado daquele canal: assuntos, tendências, palavras-chave, comportamento do público,
canais concorrentes. Perguntas que a IA deve responder:

- Que tipo de assunto está gerando interesse?
- Qual duração costuma funcionar?
- Que formato de título funciona?
- Quais thumbnails parecem gerar mais cliques?
- Vídeo longo ou Short? Com que frequência os líderes publicam?
- Quais temas estão saturados? Onde existe oportunidade?

**Regra:** a intenção não é copiar concorrentes — é entender o que funciona e usar como inteligência
para criar conteúdo **original**.

### 3.2 Planejar
Estratégia editorial e calendário. Ex.: *"Esta semana recomendamos dois vídeos longos e três
Shorts"* + calendário (Seg: vídeo X, Ter: Short Y, Qui: vídeo Z, Sex: Short, Dom: Short). O usuário
não decide manualmente o que postar todo dia.

### 3.3 Criar
Produção do conteúdo dentro da mesma plataforma: ideia, roteiro, personagens, cenas, imagens,
animações, voz, música, edição, vídeo final, versão Short, thumbnail, título, descrição, SEO,
metadata.

**Regra:** por trás, o sistema pode usar várias APIs e modelos; para o usuário deve parecer **uma
única ferramenta**. Ele nunca precisa saber qual serviço gerou a voz, o vídeo ou a imagem.

### 3.4 Revisar (o principal trabalho humano)
A IA entrega e o usuário decide. Ex.: *"4 conteúdos aguardando aprovação."* O usuário abre, assiste,
vê título/descrição, escolhe entre 3-4 thumbnails, edita se quiser. Então:

- Gostou → **Aprovar e agendar**
- Gostou da ideia, não da execução → **Gerar nova versão**
- Não gostou de nada → **Substituir conteúdo**

Esta deve ser **a parte mais simples da experiência**.

### 3.5 Aprovar
**Nada é publicado sem aprovação do usuário**, pelo menos no modelo inicial. O usuário é o
**editor-chefe**; a IA faz o trabalho pesado; o humano toma a decisão final.
Fluxo: `IA cria → usuário revisa → usuário aprova → sistema publica`.

### 3.6 Agendar
O conteúdo aprovado ganha **canal, data e horário** — e mais nada disso precisa ser digitado no
YouTube Studio. O sistema já sabe título, descrição, thumbnail, playlist, público, idioma, categoria
e as configurações necessárias.

**Por que esta etapa existe separada da seguinte (decisão do dono do produto):** agendar é o último
momento em que o usuário ainda pode mudar algo sem custo. Enquanto a etapa não existia como estado
próprio, um conteúdo apenas agendado era indistinguível de um conteúdo no ar, e a interface não tinha
como dizer a verdade sobre ele. Ver `ADR-004-ciclo-canonico-10-etapas.md`.

> **Nota de fonte (texto literal já recebido):** o PDF numera o ciclo em **9 seções** e a seção 6
> chama-se literalmente **"Agendar e publicar"**, tratando as duas coisas num bloco só. O PDF,
> portanto, **não** separa estas etapas — a separação é refinamento do dono do produto registrado
> nesta sessão, não transcrição. O texto da seção 6 é compatível com ela: já lista data e horário
> como insumos e "publica" como o ato. Transcrição integral em `.rebeca/fontes/ciclo-no-pdf.md`.

### 3.7 Publicar
Na data marcada, o envio acontece automaticamente pela **integração oficial** (YouTube Data API),
sem upload manual. Publicar é irreversível na prática: por isso é etapa própria, e por isso nada é
publicado sem a aprovação registrada em 3.5.

### 3.8 Medir
Após a publicação, o trabalho não termina. Acompanhar via YouTube Analytics: visualizações,
impressões, CTR, retenção, watch time, inscritos, receita, RPM, performance de Shorts, de vídeos,
horários, temas, thumbnails.

> ⚠️ **Promessa maior que a fonte de dados oficial (achado verificado — decisão humana pendente).**
> A pesquisa em `.rebeca/pesquisa/youtube-api-publicacao-spec.md` conclui que **RPM**, **horários** e
> **temas** *não existem* na YouTube Analytics API, e que impressões/CTR de thumbnail só saem em
> relatório em massa (Reach reports), não por `reports.query`; a latência declarada é de "48 to 72
> hours". Duas saídas, e a escolha é do dono do produto: (a) derivar RPM de `receita ÷ views` e
> calcular "horário" e "tema" por agregação própria dentro do Rebeca, ou (b) ajustar a promessa aqui.
> Enquanto não for decidido, isto é **NÃO VERIFICADO** como função entregável — não é requisito
> cumprido.

### 3.9 Aprender
Comparar resultados. Exemplos do PDF:

- Vídeos sobre animais tiveram 37% mais retenção.
- Thumbnails com o personagem maior tiveram CTR maior.
- Shorts de 30s funcionaram melhor que os de 50s.
- Vídeos às 17h performaram melhor.
- Histórias sobre amizade performaram pior que cores e animais.

Também aprende com o **comportamento do usuário**: thumbnails sempre rejeitadas, pedidos recorrentes
de ritmo mais rápido, tipos de conteúdo sempre recusados deixam de ser priorizados.

### 3.10 Melhorar automaticamente
O aprendizado influencia a semana seguinte. O sistema **fica mais inteligente conforme usa dados
reais** — não repete a mesma fórmula infinitamente.
Ciclo: `produzir → publicar → medir → aprender → produzir melhor`.

*(O nome `Ajustar` aparece em `imagens/modelo2.jpeg`. O vocabulário canônico do produto é
**Melhorar**; `Ajustar` não é nome de etapa — ver `ADR-004`.)*

## 4. Multi-canal (arquitetura de produto, não feature)

- A plataforma **não** é feita só para a Luna. Luna é o primeiro caso.
- Canais previstos: **Luna e o Jardim das Cores**, **Arquivo Curioso**, **AI Made Simple**, além de
  canais de história, ciência, negócios ou qualquer outro segmento.
- Cada canal tem **sua própria inteligência, identidade, estratégia e aprendizado**.
- O usuário trabalha em **um canal por vez** (como no YouTube Studio), trocando pelo seletor no canto
  superior direito; ao trocar, **toda a interface muda** (calendário, conteúdo, estratégia,
  analytics, branding, receita, aprendizado) — isso evita confusão.
- Existe uma página de **Portfólio** para comparar todos os canais de forma consolidada.

**Implicação técnica obrigatória:** isolamento de dados por canal em todas as camadas (banco,
storage, cache, prompts, métricas). Vazamento cruzado entre canais é bug crítico.

## 5. Identidade e branding por canal

Dentro do sistema, por canal: personagens, logo, avatar, banner, cores, fontes, estilo visual,
descrição, tom de voz, materiais de divulgação, thumbnails, **Character Sheets** e **Brand Book**.

Conversa com a IA para criar/modificar personagens:

> "Quero criar um cachorro pequeno, divertido e curioso para ser amigo da Luna." → o sistema gera
> opções → "Gostei desse, mas quero as orelhas maiores e sem coleira." → gera de novo → ao aprovar,
> o personagem vira **oficial** e passa a ser usado em vídeos futuros.

**Requisito de consistência:** *"a Luna precisa continuar parecendo a Luna em todos os episódios"* —
consistência de personagem entre episódios é requisito funcional, não detalhe estético.

### Materiais de divulgação
Depois de um vídeo (ex.: *Luna e as Borboletas Coloridas*), gerar automaticamente: thumbnail,
Short, post de Instagram, Story, capa de Reel, capa de TikTok, post na comunidade do YouTube, imagem
promocional e texto de divulgação — todos com o **mesmo Brand Kit**.

## 6. Princípio de UX: o app NÃO deve parecer complexo

O backend pode ser extremamente sofisticado (APIs, vários modelos, banco, automação, agentes,
sistemas de vídeo/imagem, YouTube API, Analytics API). A interface ideal é quase:

```
Escolha o canal → Veja o que a IA preparou → Revise → Aprove → Pronto
```

Tudo que for tecnicamente complexo acontece **por trás**.

## 7. Papel do usuário

O app faz ~90% do trabalho operacional. O usuário **não** é editor de vídeo, não é especialista em
SEO, não precisa ser especialista em YouTube nem saber escrever prompts complexos.

**O papel dele é: direção + revisão + aprovação.**

Cena-alvo (do PDF):

```
"Luna e o Jardim das Cores — 4 conteúdos aguardando aprovação."
→ clico, assisto, escolho thumbnail, talvez mude o título, aprovo.
→ o sistema agenda e publica.
→ dias depois: "Esse vídeo teve performance 42% superior à média do canal.
   A retenção foi maior entre 0:30 e 2:20. Conteúdos com borboletas e animais
   estão funcionando melhor. Recomendamos produzir mais dois conteúdos
   relacionados na próxima semana."
```

## 8. Objetivo de negócio

Produzir conteúdo com **maior chance de crescimento orgânico com o menor custo operacional
possível**. Otimizar simultaneamente: qualidade, custo de produção, tempo, visualizações, retenção,
crescimento e receita.

A pergunta não é "esse vídeo teve muitas views?", é **"esse conteúdo valeu a pena?"**.

| | Vídeo A | Vídeo B |
|---|---|---|
| Views | 500 mil | 250 mil |
| Custo de produção | US$ 80 | US$ 15 |
| Receita | US$ 900 | US$ 1.100 |

O vídeo B é provavelmente muito mais interessante para o negócio — **a plataforma deve aprender
isso.** Portanto: toda geração de conteúdo precisa registrar **custo real por ativo** (tokens, API,
render, tempo humano) para permitir esse cálculo.

## 9. Em uma frase

> O Rebeca é uma plataforma inteligente que centraliza toda a operação de canais criados com IA.
> Ele pesquisa oportunidades, planeja conteúdo, cria vídeos e identidade, prepara SEO e thumbnails,
> permite aprovação humana, publica automaticamente no YouTube, acompanha os resultados e utiliza
> esses dados para melhorar continuamente a estratégia de cada canal.

Versão ainda mais simples: *"Hoje uma pessoa precisa usar cinco ou dez ferramentas diferentes para
operar um canal de YouTube com IA. Nós queremos transformar todo esse processo em um único aplicativo
inteligente. A IA faz o trabalho. A pessoa dirige e aprova."*

## 10. Requisitos não-funcionais implícitos (derivados — precisam de confirmação humana)

Estes itens **não** estão no PDF, mas decorrem dele. Marcar como "a confirmar" até o dono do produto
decidir:

1. **Multiusuário / multiusuário-por-canal** — quem mais além do dono acessa? (equipe, editor,
   revisor?) Impacta modelo de papéis e RLS.
2. **Custo por canal** — limite/orçamento mensal de geração por canal com trava automática.
3. **Fila e idempotência** — geração de vídeo é longa (minutos); o app precisa de jobs
   persistentes, retomada e nunca publicar duas vezes o mesmo vídeo.
4. **Direitos e licenças** — voz clonada, música, imagem: quais provedores permitem uso comercial?
5. **Conformidade** — conteúdo infantil (Luna) aciona regras de proteção a menores e COPPA/YouTube
   Kids; dados de usuário acionam LGPD e ECA Digital (Lei 15.211/2025). Ver agente `rebeca-lgpd`.
6. **Custo de IA por vídeo** — precisa caber em centavos/dólares por minuto para o negócio fechar.
7. **Offline/PWA** — o usuário revisa conteúdo no celular; aprovação e leitura precisam funcionar
   bem em mobile e com rede instável.
8. **Auditoria** — toda publicação deve ter trilha: quem aprovou, quando, com qual versão do
   roteiro/prompt/thumbnail.
