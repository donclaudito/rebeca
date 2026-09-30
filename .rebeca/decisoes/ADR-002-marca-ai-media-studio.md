# ADR-002 — Marca de interface: "AI Media Studio"

## Status
aceito

## Data
2026-02-XX — pendente de data exata; registrado na sessão de construção do protótipo.

## Contexto
`docs/00-visao-produto.md` e todo o repositório chamam o produto de **Rebeca**. Os dois modelos
visuais entregues pelo dono (`imagens/modelo1.jpeg`, `imagens/modelo2.jpeg`) trazem a marca
**AI Media Studio** no cabeçalho, na sidebar e no painel de módulos — e o modelo 1 tem como título
literal "O que é o AI Media Studio?".

A pergunta "qual nome aparece na tela?" foi feita ao dono do produto, porque isso afeta títulos,
sidebar, manifest do PWA, e-mails e documentação voltada ao usuário.

## Decisão
A **marca visível na interface é "AI Media Studio"**. O nome **Rebeca permanece como nome do
projeto/repositório** (docs, agentes, pastas `.rebeca/`, `.dsh/`) nesta fase. A interface usa a
assinatura `AI Media Studio` + o descritor "o seu estúdio de mídia com IA".

## Alternativas descartadas
| Alternativa | Por que foi descartada |
|---|---|
| Usar "Rebeca" na interface | Contraria os modelos que o dono entregou como referência de "a cara" do app. |
| Renomear o repositório, docs e agentes para "AI Media Studio" | Custo alto, sem ganho de produto nesta fase; a orquestra inteira referencia "Rebeca" e o nome de trabalho não aparece para o usuário final. |
| Manter os dois nomes na tela ("Rebeca · AI Media Studio") | Duas marcas na mesma tela confundem o usuário e violam o princípio de simplicidade do §6 da visão de produto. |

## Consequências
- Positivas: fidelidade total aos modelos entregues; protótipo válido sem tocar na documentação da
  orquestra.
- Negativas / custo assumido: existe **uma dívida de nomenclatura** entre marca de interface (AI
  Media Studio) e nome do projeto (Rebeca). Se o produto for lançado, decidir qual nome fica —
  registrar então um ADR que substitui este.
- O que muda para o usuário: ele vê "AI Media Studio" em toda a interface.
- Impacto em isolamento multi-canal: nenhum.
- Impacto em custo por vídeo: nenhum.

## Verificação
`Select-String -Path src\**\*.tsx -Pattern "Rebeca"` deve retornar **0 ocorrências** — nenhum nome de
projeto vaza para a tela. Reavaliar na decisão de lançamento/domínio.

## Quem decidiu
Proposto por `rebeca-orquestrador`. **Aprovado pelo dono do produto** em sessão, na escolha
"AI Media Studio".
