<!--
PR sem as 7 seções abaixo é devolvido ao autor. Quem escreve não aprova: a revisão padrão é do
`rebeca-qa`, que tenta REFUTAR a entrega. Formato derivado do "Contrato de entrega" de
`docs/01-orquestra-de-agentes.md`.
-->

## O que muda

<!-- 1 linha. Se não cabe em 1 linha, o PR provavelmente deveria ser dividido. -->

## Agente e tarefa

- **agente:** rebeca-<id>
- **tarefa:**
- **status:** concluido | parcial | bloqueado

## Artefato real

<!-- Caminhos de arquivos que existem de verdade neste PR. -->

- [ ] Arquivos abaixo existem no diff:

## Evidência (comando executado + resultado observado)

<!-- Sem isto não está pronto. Cole a saída, não a intenção. -->

| Comando | Resultado |
|---|---|
|  |  |

## Critérios de aceite

<!-- Um por linha, com o critério copiado de docs/04-mapa-funcional.md ou da história. -->

- [ ]

## Invariantes do projeto

- [ ] **Aprovação humana:** este PR não publica, não aprova e não agenda nada sozinho.
- [ ] **Isolamento entre canais:** nenhum dado, asset, prompt ou cache cruza `channelId`; se mexeu
      na camada de dados, o teste de vazamento entre canais foi executado e passa.
- [ ] **Segredo:** nenhum token, chave, `.env` ou credencial em texto claro no diff
      (`git diff --cached` filtrado por `ghp_|gho_|AIza|PRIVATE KEY|sk-` volta vazio).
- [ ] **Custo:** se houve geração paga, a linha foi lançada em `.rebeca/custos.csv`.
- [ ] **Multi-canal:** nada foi codificado para um único canal.

## Decisões (trade-off)

<!-- Escolha com trade-off vira ADR em .rebeca/decisoes/. Escreva "nenhuma" se não houve. -->

- decisão — motivo — alternativa descartada

## Riscos e o que NÃO foi verificado

<!-- Declare o que ficou sem prova. Riscos escondidos viram bug em produção. -->

-

## Próximo

<!-- agente sugerido — o que ele precisa receber. -->

-

