# ADR-001 — Stack do front do AI Media Studio (decisão D1, parte front)

## Status
aceito

## Data
2026-02-XX — pendente de data exata; registrado na sessão de construção do protótipo.

## Contexto
`docs/00-visao-produto.md` exige uma interface radicalmente simples (`Escolha o canal → Veja o que a
IA preparou → Revise → Aprove → Pronto`) sobre um backend sofisticado. A decisão **D1** de
`.rebeca/estado.md` ("stack do front e do backend") estava aberta e bloqueava toda a fase F1 —
nenhuma linha de código existia no repositório.

O dono do produto entregou dois modelos visuais (`imagens/modelo1.jpeg` e `imagens/modelo2.jpeg`) e
pediu um **protótipo navegável fiel a eles, com dados de exemplo**. Isso torna a stack do front a
única parte de D1 que precisa ser fechada agora; a stack do **backend** continua aberta.

## Decisão
O front é **React 19 + Vite + TypeScript (strict) + Tailwind CSS v4**, com **react-router-dom** para
rotas escopadas por canal e **@tanstack/react-query** como camada de dados do cliente.
Toda rota vive sob `/c/:channelId/...`. O protótipo roda com dados de exemplo em `src/data/mock/`,
atrás da mesma interface que o backend real vai implementar depois — trocar mock por API não pode
exigir mudar componente.

## Alternativas descartadas
| Alternativa | Por que foi descartada |
|---|---|
| CSS Modules sem Tailwind | A fidelidade visual dos modelos depende de um sistema de tokens (gradiente, vidro, brilho, borda ciano) repetido em dezenas de cards; sem utilitários + `@theme` o custo de manutenção sobe e o design system não fica executável. |
| Next.js | O protótipo é uma SPA autenticada, sem necessidade de SSR/SEO; adiciona um servidor Node e superfície de deploy que o usuário não pediu (D6, "onde roda", segue aberta). |
| Backend real (Supabase + jobs + YouTube) nesta rodada | Depende de D2-D6 (provedores, teto de custo, onde roda) e de credenciais que não existem; bloquearia a validação visual que o dono do produto pediu. |
| Estado global próprio (Context + reducer) no lugar do react-query | O invariante nº 2 exige invalidação limpa de cache na troca de canal; `queryClient.removeQueries` por prefixo de chave é a forma verificável de garantir isso. |

## Consequências
- Positivas: design system executável (`src/styles/tokens.css`), troca de canal testável por
  inspeção de cache, e o protótipo já nasce com a forma final das rotas.
- Negativas / custo assumido: Tailwind v4 ainda é recente; a stack do **backend** (D1, segunda
  metade) e as decisões D2-D6 permanecem abertas e bloqueiam a fase de dados reais.
- O que muda para o usuário: nada de comportamento — o ganho é poder ver e criticar o app antes de
  haver backend.
- Impacto em isolamento multi-canal: positivo. `QueryKey` sempre começa por `['channel', channelId]`
  e o teste `src/data/__tests__/channel-scope.test.tsx` refuta vazamento entre canais.
- Impacto em custo por vídeo: nenhum direto. O protótipo não chama provedor pago e não lança linha
  em `.rebeca/custos.csv`.

## Verificação
`pnpm exec tsc --noEmit` sem erro, `pnpm exec vitest run` verde (incluindo o teste de escopo por
canal), `pnpm run build` gerando `dist/`, e o app servindo em `http://127.0.0.1:5173` com as telas
dos dois modelos navegáveis. Reavaliar quando o backend for escolhido (D1, segunda metade): se ele
for Supabase puro, o react-query continua; se virar serviço separado, muda só o adaptador em
`src/data/`.

## Quem decidiu
Proposto por `rebeca-orquestrador` + `rebeca-react`. **Aprovado pelo dono do produto** em sessão,
na escolha "React + Vite + TypeScript + Tailwind".
