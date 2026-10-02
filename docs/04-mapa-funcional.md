# 04 — Mapa funcional do AI Media Studio

> **Fonte:** `imagens/modelo1.jpeg` e `imagens/modelo2.jpeg`. Este documento transforma **"estas
> funções"** em itens verificáveis: cada função vira rota, dono e critério de aceite.
> O que a visão de produto (`docs/00-visao-produto.md`) já definia entra como **fonte**; o que só
> apareceu nos modelos entra como **novo — precisa de confirmação do dono**.

## 1. As 10 etapas do ciclo (canônico) × as fontes que o descrevem

Três fontes descrevem o mesmo ciclo e **não** o numeram do mesmo jeito. Confundi-las foi o que
produziu a divergência que existia no código:

| Fonte | Como numera | Última etapa |
|---|---|---|
| `imagens/modelo2.jpeg` (modelo visual) | 9 etapas, com "Agendar / Publicar" **juntas** | `Ajustar` |
| `O APP.pdf` (cliente) | **9 seções numeradas** — a seção 6 é literalmente "Agendar e publicar"; a 9ª é "Melhorar automaticamente" | `Melhorar automaticamente` |
| `docs/00-visao-produto.md` §3 | **10 subseções** (§3.1–§3.10), com `Agendar` (§3.6) e `Publicar` (§3.7) separados — por decisão do dono, ver `ADR-004` | "Melhorar automaticamente" (§3.10) |

**Decisão do dono do produto (registrada nesta sessão):** o ciclo canônico tem **10 etapas** —
`Pesquisar → Planejar → Criar → Revisar → Aprovar → Agendar → Publicar → Medir → Aprender →
Melhorar`.

`Agendar` (o conteúdo aprovado ganha data e horário) passa a ser distinto de `Publicar` (o envio pela
API oficial): fundir as duas apagava a diferença entre "pronto, com data marcada" e "no ar", que é
justamente onde o usuário ainda pode intervir. A etapa que fecha o ciclo se chama **Melhorar**;
`Ajustar` — que era o nome do **modelo visual**, não do PDF — deixa de existir como etapa.

> **Honestidade sobre a fonte — agora com o texto literal em mãos:** o PDF tem **9 seções**, não 10.
> A seção 6 chama-se **"Agendar e publicar"** e trata as duas coisas num bloco só ("então o sistema
> agenda e publica automaticamente no YouTube através da integração oficial"); a seção 7 é "Medir".
> **Portanto o PDF não separa Agendar de Publicar** — a lista de 10 verbos é **refinamento do dono do
> produto**, não transcrição. O texto da seção 6 é compatível com a separação (ela já lista data e
> horário entre os insumos, e "publica" como o ato), mas quem decidiu separar foi o dono: ver
> `ADR-004`. Transcrição integral em `.rebeca/fontes/ciclo-no-pdf.md`.

| # | Verbo canônico | O que o app faz | Onde vive na interface |
|---|---|---|---|
| 1 | Pesquisar | Analisa tendências, palavras-chave e oportunidades | Estratégia |
| 2 | Planejar | Define temas, roteiros, calendário e frequência | Calendário |
| 3 | Criar | Gera roteiros, imagens, vídeos, narração e thumbnails | Conteúdo |
| 4 | Revisar | Usuário assiste, lê e decide | **Revisão** |
| 5 | Aprovar | Aprovação explícita e registrada | Revisão |
| 6 | Agendar | Define data e horário do conteúdo aprovado | Calendário |
| 7 | Publicar | Envia pela API oficial do YouTube | Calendário |
| 8 | Medir | Coleta views, CTR, retenção, receita | Analytics |
| 9 | Aprender | Compara e extrai o que funcionou | Analytics / Aprendizado |
| 10 | Melhorar | Muda a pauta da próxima semana | Início (recomendações) |

**Uma fonte só:** a ordem e os nomes que o código usa vivem em `src/data/cycle.ts` (`CYCLE_ORDER`,
`CYCLE_LABEL`), espelhando a tabela acima. A tela "Como funciona" renderiza a partir deles e o teste
`src/data/__tests__/cycle.test.ts` **lê `docs/00-visao-produto.md` §3** para refutar divergência entre
documento e código. Nenhum arquivo repete a lista de etapas à mão.

**Invariante preservado:** a etapa 5 é **humana**. A IA nunca aprova (§4 da visão de produto; skill
`rebeca-react`, anti-padrão "pré-selecionar a thumbnail vencedora").

## 2. Telas (do desenho da sidebar em ambos os modelos)

| Rota | Tela | Função central | Estado no protótipo |
|---|---|---|---|
| `/c/:id/inicio` | Início | "O que a IA preparou" + plano da semana + KPIs do canal | implementada |
| `/c/:id/conteudo` | Conteúdo | Biblioteca de conteúdos por estado do ciclo | implementada |
| `/c/:id/revisao/:contentId` | Revisão | Assistir → escolher thumbnail → decidir (3 caminhos) | implementada |
| `/c/:id/calendario` | Calendário | Semana editorial, agendar e reagendar | implementada |
| `/c/:id/identidade` | Identidade | Brand Kit, personagens, Character Sheet | implementada |
| `/c/:id/analytics` | Analytics | "Esse conteúdo valeu a pena?" | implementada |
| `/c/:id/monetizacao` | Monetização | Receita, RPM, custo de produção, margem | implementada |
| `/c/:id/configuracoes` | Configurações | Canal, conexão YouTube, preferências | implementada |
| `/portfolio` | Portfólio | Comparar todos os canais (**única tela que cruza canais**, só leitura) | implementada |
| `/como-funciona` | Como funciona | O mapa do produto (modelo 1 §2 + modelo 2 §1) | implementada |

Toda rota de canal carrega o `channelId` na URL — link sem canal é bug (skill `rebeca-react`, §2).

> **Acesso (desde o `ADR-014`):** nenhuma destas telas abre sem sessão autorizada. Sem login, o app
> mostra a tela de entrada no lugar das rotas — e **não** existe rota `/login`: o portão é o que se
> renderiza, não um endereço a mais (endereço de login é um endereço a mais para contornar). Das rotas
> de API, **uma** é pública — `GET /api/auth/config`, que devolve o Client ID (público por definição) —
> e as demais exigem `Authorization: Bearer <ID token do Google>`: `GET /api/auth/me` prova a
> identidade **sem** exigir que ela já esteja na lista de acesso (é por ela que a primeira conta se
> autoriza), e as de IA e de mídia exigem identidade **e** autorização.

## 3. Funções declaradas nos modelos

### 3.1 Cartão de status do canal (modelo 1, canto superior direito)

| Função | Aceite |
|---|---|
| Avatar, nome, tipo e inscritos do canal sempre visíveis | Está no topo em todas as telas, sem clique |
| Views totais (histórico) | `123 mi` com período rotulado |
| Views, receita e publicações dos últimos 28 dias | Cada KPI com período e canal no próprio card |
| Delta vs. período anterior | Verde/vermelho **com sinal e percentual em texto** |

### 3.2 Plano da semana (modelo 1, lateral direita)

| Função | Aceite |
|---|---|
| Dias da semana com o conteúdo previsto | Seg–Dom, cada dia com thumbnail, título curto e horário |
| Atalho "Ver calendário completo" | Leva ao Calendário mantendo o canal |
| Dia sem conteúdo | Mostra "Sem publicação" — nunca um espaço vazio mudo |

### 3.3 Módulos do ciclo (modelo 1, seção 2)

Os 11 módulos aparecem como cards com ícone, título e descrição. No app cada card mostra o **estado
real do canal naquele módulo** e leva à tela correspondente. O módulo **Aprovação** é o único que
ganha badge de pendência.

### 3.4 O app inteligente (modelo 2, seção 3)

| Função | O que significa em produto | Estado |
|---|---|---|
| Análise de performance dos seus vídeos | Comparar cada vídeo com a média do canal, explicitamente ("42% acima da média") | protótipo com dados de exemplo |
| Estudo de canais do mesmo segmento | Benchmark do nicho | **protótipo com dados de exemplo; fonte de dados não escolhida** |
| Sugerir temas com potencial | Pauta recomendada a partir do que funcionou | protótipo |
| Otimizar SEO | Títulos, descrições, tags e thumbnails | protótipo |
| Aprender com aprovações e rejeições | O que o usuário recusa deixa de ser priorizado | protótipo (dados de rejeição semeados) |
| Buscar menor custo | Mesmo resultado com custo menor | protótipo (custo por ativo visível) |

**NÃO VERIFICADO:** "estudo de canais do mesmo segmento" depende de quais dados públicos do YouTube
podem ser coletados legalmente e dentro da quota da API. Antes de virar função real, passa por
`rebeca-youtube` (quota e Termos) e `rebeca-seguranca` (injeção de prompt por conteúdo externo).

### 3.5 Resultado esperado (modelo 2, seção 4)

"Menos ferramentas", "mais automação" e "mais chance de viralização orgânica" **não são telas** — são
a promessa de negócio. Viram métrica de sucesso, não feature:

| Promessa | Como se mede |
|---|---|
| Menos ferramentas | nº de ferramentas externas usadas por semana (meta: 1) |
| Mais automação | % do ciclo executado sem toque humano além da aprovação |
| Mais chance de viralização orgânica | views/impressões e CTR por vídeo contra a média do canal |

### 3.6 Dores que o app elimina (modelo 1, seção 1)

| Dor | Resposta no produto |
|---|---|
| Muito tempo | Job longo roda em segundo plano; o humano só revisa |
| Muitas ferramentas | Uma interface só (§3.3 da visão de produto) |
| Mais custo | Custo real por ativo em `.rebeca/custos.csv`, visível na Monetização |
| Processo manual | Agendamento e publicação automáticos após aprovação |

### 3.7 Papel do usuário (modelo 1, seção 4)

O modelo é explícito: **"Meu trabalho: revisar e aprovar."** Os 5 passos do modelo
(*IA cria → usuário revisa → clica em aprovar → sistema agenda e publica → IA aprende e traz
resultados*) são o roteiro da tela de Revisão e do texto de boas-vindas no Início.

## 4. Multi-canal (modelo 2, seção 2)

| Função | Aceite |
|---|---|
| Um canal por vez, como no YouTube Studio | A interface inteira muda na troca; nada do canal anterior permanece |
| Cada canal com estratégia, branding, calendário e aprendizado próprios | Todo dado é lido por `channelId`; chave de cache começa pelo canal |
| Portfólio para comparar canais | Só leitura e agregado; sem ação de publicar/aprovar |

Canais semeados no protótipo, iguais aos modelos: **Luna e o Jardim das Cores** (723 mil inscritos),
**Arquivo Curioso** (482 mil), **AI Made Simple** (701 mil).

## 5. O que a visão de produto exige e os modelos não mostram

Não estava nos modelos, mas é invariante do projeto e por isso **está no protótipo**:

1. Aprovação humana registrada antes de publicar.
2. Custo real por ativo ao lado da receita (a pergunta "esse conteúdo valeu a pena?").
3. Estados explícitos de carregando / vazio / erro / sucesso em toda consulta.
4. Isolamento por canal verificável por teste.
5. Linguagem de interface 100% pt-BR e **sem termo interno** (nome de provedor, id de job, tabela).

## 6. Lacunas que dependem do dono do produto

| # | Lacuna | Bloqueia |
|---|---|---|
| L1 | Publicar as telas "Como funciona" dentro do app ou manter isso só no material de apresentação? | decisão de produto |
| L2 | A marca de interface é AI Media Studio (ADR-002) — o nome definitivo do produto ainda não foi decidido | lançamento |
| L3 | "Monetização" e "Aprendizado" aparecem nos modelos sem detalhamento de dados | especificação futura |
| L4 | Papéis de acesso (dono / editor / revisor) seguem em aberto (D3) | RLS, permissões de tela |

Nenhuma dessas lacunas impede o protótipo navegável: todas foram implementadas com dados de exemplo
e ficam marcadas na tela como "dados de exemplo".
