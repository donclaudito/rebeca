# Fase 1 — O personagem: do "gera uma ficha" ao ciclo que o PDF descreve

Origem: `ideabeba.pdf` (texto extraído em `.rebeca/fontes/ideabeba-extraido.txt`), seção *Identidade e
branding*. Decisão do dono em 2026-10-02: começar a adaptação do app ao PDF por esta fase.

## O que o PDF pede, com estas palavras

> *"Eu também quero conseguir conversar com a IA para criar ou modificar personagens. Por exemplo:
> 'Quero criar um cachorro pequeno, divertido e curioso para ser amigo da Luna.' **O sistema gera
> opções. Eu escolho uma.** Depois digo: '**Gostei desse, mas quero as orelhas maiores e sem
> coleira.**' **Ela gera novamente.** Quando eu **aprovar o personagem, ele vira um personagem
> oficial**. A plataforma passa a utilizar aquela mesma identidade em vídeos futuros."*

Quatro batidas: **opções → escolha → refino → aprovação vira oficial.**

## O que já existe (não refaça)

| Peça | Onde |
|---|---|
| Tela de Identidade com Brand Kit e a lista de personagens | `src/features/identidade/IdentidadePage.tsx` §2 (linha ~108) |
| Seção "Criar personagem com a IA": textarea + `AiAction` | `IdentidadePage.tsx` §3 (linha ~158-211) |
| Função registrada `identidade-personagem` | `src/ai/contract.ts:320` |
| Schema da função | `src/ai/schemas.ts:631` |
| Prompt versionado | `.rebeca/prompts/identidade-personagem@v1.md` |
| Tipo `Character` | `src/data/types.ts` (`sheetVersion`, `status: oficial \| em_aprovacao \| rascunho`) |
| Dados de exemplo | `src/data/mock/db.ts:623` |
| Leitura | `src/data/hooks.ts:48` (`useCharacters`) |

## As cinco lacunas — é isto que falta

1. **A função devolve UM personagem, não opções.** O schema (`schemas.ts:641-652`) tem `nome`, `papel`,
   `descricaoVisual`, `tracos`, `promptImagem`, `negativePrompt`, `seed`, `notasConsistencia` — saída
   única. O PDF pede *"o sistema gera opções"*.
2. **Não há escolha.** Nada na tela deixa o humano escolher entre candidatos.
3. **Não há refino.** O PDF pede conversa iterativa ("gostei desse, mas..."). Hoje só dá para reescrever
   a descrição do zero, sem o personagem anterior como contexto.
4. **Nada é gravado.** A tela diz isso em voz alta (linha ~155): *"nada é gravado, nenhum personagem
   nasce oficial"*. Não existe `api.createCharacter`, nem transição para `oficial`.
5. **O Character Sheet continua ausente.** `ArtSlot` é placeholder e `manifest.characterSheet` está
   **fixo em `'ausente'`** (`server/media/manifest.ts:53`), mesmo quando o canal tem personagem
   `oficial` com `sheetVersion`. Enquanto isso, o `rebeca-branding` é dono da arte — esta fase **não**
   resolve a arte, resolve a **ficha** e a **oficialidade**.

## Decisões de desenho (não negociáveis — vêm dos invariantes)

1. **A IA nunca grava nem aprova.** Ela propõe; o humano escolhe, refina e aprova. O caminho é
   `AiAction` (proposta) → escolha → `api.save...` (gravação) → `api.approveCharacter` (oficial).
   Mesmo padrão de `proposeThumbnails` + `approve` em `src/data/client.ts`.
2. **Personagem novo nasce `rascunho`** — nunca `oficial`. Só `approveCharacter` chega a `oficial`, e é
   o único caminho.
3. **Refinar derruba a oficialidade.** Se um personagem `oficial` for refinado, ele volta para
   `em_aprovacao` (ou o refino gera um **novo** rascunho). Prefira o novo rascunho: personagem oficial
   que muda sob os pés de um episódio já gerado quebra o invariante nº 3. **Escolha e documente.**
4. **`sheetVersion` sobe a cada refino aprovado** — é a revisão do Character Sheet.
5. **Tudo escopado por canal.** `channelId` no caminho, na chave de cache e na validação; personagem de
   outro canal é recusado (invariante nº 2). Há teste de vazamento para imitar:
   `src/data/__tests__/channel-scope.test.tsx`.
6. **A interface não mostra fornecedor nem modelo** (`docs/04` §5).
7. **pt-BR na tela e nos textos; identificadores em inglês no código.**
8. **Nada de número ou estado inventado.** O que não existe, a tela diz que não existe.

## Restrições de ambiente (a árvore tem dois escritores — D9)

- **NUNCA use `git add -A` nem `git add .`.** Um `git add` largo de outra sessão já publicou código
  quebrado em produção nesta mesma árvore. Adicione **explicitamente** só os arquivos que você criou.
- **Não toque** em: `vercel.json`, `server/auth/**`, `src/auth/**`, `server/media/http.ts`,
  `src/media/**`, `.rebeca/estado.md`. São de outra frente, em edição ativa.
- O que você **pode** tocar: `src/features/identidade/**`, `src/data/types.ts`, `src/data/client.ts`,
  `src/data/hooks.ts`, `src/data/mock/db.ts`, `src/ai/schemas.ts`, `src/ai/contract.ts`,
  `.rebeca/prompts/identidade-personagem@v2.md` (e **apagar a v1** — `build_prompts.mjs:99` recusa duas
  versões ativas do mesmo `prompt_id`) e `server/ai/prompts.generated.ts` (via `node .tools/build_prompts.mjs`).
- Se mexer no prompt/schema: rode `node .tools/build_prompts.mjs --check`.

## Critério de aceite (as quatro batidas do PDF, verificáveis)

1. Descrever um personagem em português e receber **duas ou três opções** distintas.
2. **Escolher** uma — a escolha é do humano e fica visível na tela.
3. **Refinar** a escolhida por texto ("orelhas maiores, sem coleira") e receber uma nova versão
   derivada dela, com `sheetVersion` maior.
4. **Aprovar** — e só então o personagem vira `oficial`, aparece como oficial na lista, e a tela passa
   a poder dizer que o canal tem ficha canônica.

## Evidência obrigatória antes de dizer "pronto"

- `pnpm exec tsc --noEmit` → exit 0.
- Teste da camada de dados: opções → escolha → refino → aprovação; **recusa de outro canal**; refino de
  oficial não deixa oficial para trás.
- Teste de tela: o ciclo inteiro percorrido, e **nada é gravado sem clique humano**.
- **Prova adversarial por mutação**: desfaça cada garantia e mostre o teste ficando vermelho;
  restaure e confirme por sha256.
- Salve a saída em `.rebeca/evidencias/fase-1-personagem.txt`.

## Handoff

Entregue no formato "Contrato de entrega" de `docs/01-orquestra-de-agentes.md` (status, entregáveis,
evidência, decisões, riscos, próximo). **Não commite** — a árvore tem outros escritores.
