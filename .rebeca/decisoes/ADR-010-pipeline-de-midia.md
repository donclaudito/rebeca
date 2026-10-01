# ADR-010 — Pipeline de mídia: a máquina que transforma roteiro em vídeo

## Status
**proposto** — o desenho está fechado; a **Fase 0 está em implementação** (esqueleto com provedores
simulados, custo zero) e a evidência dela é anexada a este ADR quando fechar. A **D2 foi aprovada em
2026-10-01** (`ADR-005` aceito: Stack A, teto de **US$ 12,00/min**) e a **D5** ficou em
**US$ 60,00/mês** — com isso a Fase 1 deixou de depender de escolha de provedor. Ela depende agora de
duas coisas concretas: o **Character Sheet** da Luna (arte, `rebeca-branding`) e a **D1** (onde roda o
job longo).

## Data
2026-10-01

## Contexto

O app mostra um "player" na tela de Revisão que **não toca nada**: é um espaço reservado com a duração
do dado de exemplo. A pergunta do dono do produto foi direta — *"não aparece nada, está funcionando?"* —
e a resposta honesta é **não**, porque **não existe um único arquivo de vídeo no repositório**. A
metade de texto da etapa "Criar" existe (15 prompts, `criar-roteiro`, `criar-cena`, `criar-thumbnail`,
`identidade-personagem`, com custo real lançado); a metade de **mídia** não existe.

O `ADR-005` já decidiu **quais** provedores podem gerar a mídia e por quanto (allow-list por canal,
Stack A a US$ 8,55/min, teto proposto de US$ 12/min) — e está aguardando aprovação humana. O que
**não** existia era a decisão de **como a máquina é construída**: contratos, ordem das etapas,
idempotência, onde o custo entra, como o Short nasce do longo e como o resultado não vira lixo caro
quando um provedor cai. Este ADR decide isso.

Quatro invariantes do `AGENTS.md` moldam o desenho, e um requisito de produto o fecha:

1. **nº 3 — consistência de personagem.** A Luna precisa parecer a mesma em todos os episódios; sem
   isso o canal perde a identidade (e, pelo `ADR-005`, arrisca elegibilidade de monetização).
2. **nº 4 — custo é requisito.** Vídeo é ~96% do custo do episódio; sem custo real por ativo, a
   pergunta "esse conteúdo valeu a pena?" não tem resposta.
3. **nº 7 — provedores são substituíveis.** Trocar MiniMax por Luma, ou FLUX por outro, não pode
   exigir mudar roteiro, timeline ou tela.
4. **nº 2 — isolamento entre canais.** Todo asset vive no caminho do canal; a allow-list de provedor
   **varia por canal** (o infantil não pode usar o que o adulto pode).
5. **Requisito 3 da visão de produto:** geração de vídeo é longa (minutos) — exige job persistente,
   retomada e **nunca** pagar duas vezes pelo mesmo ativo.

## Decisão

**1. Duas fases, com um portão entre elas.**
- **Fase 0 — máquina provada com custo zero.** Provedores **simulados** geram arquivos **de verdade**
  com ffmpeg local (imagem, clipe, voz, trilha). Serve para provar timeline, formatos, legenda,
  idempotência, custo e caminho determinístico **antes** de qualquer centavo. É o que o `ADR-006` fez
  com o LLM: primeiro o contrato e o simulado, depois a chave.
- **Fase 1 — provedor real.** Entra quando o `ADR-005` for ratificado. O gate é o mesmo do canal
  infantil: provedor sem termo lido e permitido para o público daquele canal **não é chamado** —
  a allow-list é dado versionado, não comentário.

**2. Quatro interfaces, um contrato de retorno.** `ImageProvider`, `VideoProvider`, `TtsProvider` e
`MusicProvider` devolvem sempre a mesma forma (`path`, `providerId`, `model`, `costUsd`, `hash`,
`simulated`). Nenhuma etapa conhece o nome do fornecedor; o registro vive num arquivo só. É o
invariante nº 7 virando estrutura.

**3. A timeline é a fonte da verdade.** A duração da fala é **medida** pelo TTS (`ffprobe`), e é ela
que determina a duração da cena e o tempo da legenda. O `.srt` sai da mesma timeline do vídeo —
áudio fora de sincronia é bug, não estética. Duração de cena **nunca** é digitada à mão.

**4. Nome determinístico e manifesto por episódio.** `hash = sha256(entrada + versão do prompt +
provedor/modelo + parâmetros)`. Mesma entrada ⇒ mesmo caminho; nada de `final_v2_final.mp4`. O
`meta.json` do episódio guarda, por etapa, o hash de entrada, o provedor, o modelo, a versão do prompt,
a duração, o custo e se foi simulado. **Asset aprovado nunca é sobrescrito**: nova execução cria `v2`.

**5. Idempotência antes de gastar.** A chave é calculada **antes** da chamada; se o manifesto já tem o
ativo com o mesmo hash, ele é reusado e **nada é pago de novo**. Reexecutar o episódio inteiro é uma
operação segura — e há teste que roda duas vezes e exige **zero linha nova** no livro de custos.

**6. Render é contrato, não preferência.** Longo **1920×1080, 30 fps**, H.264 `crf 18`, `yuv420p`, AAC
192k, `+faststart`; Short **1080×1920** por recorte vertical **do mesmo material** (não um segundo
render). O alvo de loudness está declarado na spec do canal como `NÃO VERIFICADO` até ser conferido na
documentação oficial — o repositório não inventa número de plataforma. Quando o provedor de vídeo for
a MiniMax, o **rodapé de rótulo de *deep synthesis*** exigido pelo `ADR-005` é requisito de render,
verificado no arquivo final — não uma recomendação.

> **Nota de licença (registrada em 2026-10-01, verificação independente):** o encoder escolhido,
> **`libx264`, é GPL**, e a própria FFmpeg diz que *"if those parts get used the GPL applies to all of
> FFmpeg"*, recomendando *"make sure your program is not using any GPL libraries (notably libx264)"*
> para quem quer ficar só em LGPL. **Hoje não há obrigação de distribuição** porque o Rebeca *executa*
> um binário ffmpeg em servidor (SaaS) — não distribui o binário nem o liga ao produto. A obrigação
> nasceria no dia em que o render for embarcado no aplicativo do usuário. Fica como decisão
> consciente: se um dia o render for distribuído, trocar para um encoder compatível ou passar a
> cumprir a GPL. Fonte: `ffmpeg.org/legal.html`, em
> `.rebeca/pesquisa/provedores-midia-e-voz-2026-10-01.md`.

**7. Job longo, checkpoint e cancelamento.** Cada etapa grava seu artefato e seu checkpoint no
manifesto; retomar parte do último passo concluído. **Gerar vídeo dentro do request HTTP é proibido**
por desenho — a Fase 0 roda por CLI justamente para que, quando a fila existir (D1), o mesmo pipeline
seja executado por um worker sem reescrita.

**8. Custo medido, não estimado — e teto como portão.** Todo ativo pago entra em `.rebeca/custos.csv`
pelo **mesmo** `recordCost` da camada de LLM (um escritor de CSV só). O `usd_por_minuto` sai do arquivo
**renderizado** (`ffprobe`), nunca do tempo de geração, e é comparado ao teto do canal: estourou, o
pipeline **para** e escala para humano em vez de continuar gastando.

**9. Consistência de personagem como verificação, não como esperança.** Toda cena carrega a imagem de
referência oficial e o `character_id`; divergiu, regenera **aquela cena** — nunca o episódio. Enquanto
o **Character Sheet** não existir (dívida do `rebeca-branding`), a Fase 1 não gera cena real de
personagem: a F0 usa uma referência sintética e o manifesto registra que é sintética.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Esperar a D2 para começar qualquer coisa | A máquina (timeline, formatos, idempotência, custo, caminho) é independente do fornecedor e podia ser provada hoje, a custo zero. Adiar era trocar trabalho por espera |
| Gerar o Short como um segundo render completo | Pagaria de novo pelo mesmo conteúdo e abriria divergência entre longo e Short. O Short é um recorte com enquadramento |
| Guardar asset fora de `.rebeca/assets/<canal>/…` | Vazamento entre canais (invariante nº 2) e perda de rastreabilidade do custo |
| Reusar a abstração de LLM para mídia | São contratos diferentes: mídia devolve **arquivo** (não texto), custa por segundo/imagem e precisa de duração medida. Forçar um contrato só faria os dois piorarem |
| Confiar no tempo de geração como duração do vídeo | `tempo_min` é tempo de máquina, não duração do arquivo; usar isso falsearia o custo por minuto — o número que decide o negócio |
| Rodar o render dentro da rota HTTP | Request de minutos morre em timeout de plataforma e não tem retomada (é o defeito do "504" que o dono já viu no dev server) |

## Consequências

- **Positivas:** o pipeline existe e é executável hoje sem gastar nada; a Fase 1 é plugar provedor, não
  redesenhar; o custo por minuto vira medida, não estimativa; trocar de fornecedor é trocar uma linha
  do registro; e o Short sai do longo sem custo adicional.
- **Negativas / custo assumido:** a F0 produz vídeo sintético, que **não** serve para publicar — é
  prova de máquina; o upscale para 1080p (exigido pela Stack A em 768P, ver `ADR-005`) entra como etapa
  de render e pode custar qualidade; e enquanto o Character Sheet não existir, a Fase 1 fica parada na
  parte de personagem.
- **Impacto no isolamento multi-canal:** o caminho do asset e a allow-list de provedor são **por
  canal**; o mesmo pipeline serve canal adulto e infantil com regras diferentes.
- **Impacto no custo:** teto de US$ 12/min proposto no `ADR-005` passa a ser **verificável** a cada
  episódio, com o número saindo do arquivo renderizado.

## Verificação

**Fase 0 — o que a entrega tem de mostrar (evidência anexada ao fechar, não afirmada antes):**
`pnpm exec tsc --noEmit` exit 0; testes de mídia verdes (nome determinístico, idempotência sem linha
nova de custo, isolamento de canal, consistência timeline↔legenda, custo zero não virando número
inventado); render real com `ffprobe` confirmando `1920,1080,30/1` no longo e `1080,1920` no Short;
**duas execuções seguidas sem linha nova** em `.rebeca/custos.csv`; loudness medido com
`loudnorm=print_format=summary`; `Get-ChildItem -Filter "*final*"` → 0; e o portão de teto
(`src/media/limits.ts`) provado por teste com custo injetado.

**Fase 1 (a fazer, depois da D2):** gate do canal infantil recusando provedor proibido (com log);
rodapé de rótulo presente no arquivo renderizado; `made for kids` em toda publicação; custo real de 4
episódios comparado ao teto; reavaliação obrigatória quando um termo de provedor mudar (termo novo
**invalida** a allow-list até nova leitura).

## Quem decide

- **Propôs:** `rebeca-ia-video` + `rebeca-backend` + `rebeca-arquiteto` (desenho), sobre o dossiê de
  provedores e conformidade do `ADR-005`.
- **Aprova (pendente):** humano, dono do produto — a Fase 1 gasta dinheiro real e envolve conteúdo
  para menores. O que continua sendo decisão de advogado está listado no `ADR-005` e **não** é
  resolvido aqui.
