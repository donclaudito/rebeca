# ADR-007 — Configuração de IA pela interface: segredos, endereços e escolha de modelo

## Atualização — a escrita foi liberada para quem está autorizado (2026-10-03)

**O que mudou:** o dono do produto relatou que, **no app publicado**, não conseguia cadastrar a chave
das LLM apesar de ter entrado com a conta Google — enquanto no localhost conseguia. O bloqueio era
decisão deste ADR, e a decisão ficou obsoleta.

A objeção original era: *"não existe autenticação nesta fase, então uma rota pública que aceita chave
de API de qualquer visitante é uma vulnerabilidade."* Com o `ADR-014`, existe identidade verificada por
token do Google **e** lista de acesso (`REBECA_ALLOWED_SUBS`) **e** limite de uso. A rota deixou de ser
pública: só o dono a alcança. Manter o bloqueio depois disso não protegia nada — só impedia o app de
ser configurado, e criava uma diferença de comportamento entre localhost e produção sem justificativa
para o usuário.

**Regra nova:**

| Contexto | Escrita |
|---|---|
| Local, sem identidade | permitida (máquina de quem opera) |
| Publicado, requisição **autorizada** pela guarda | **permitida** |
| Publicado, sem identidade ou fora da lista | recusada — 401/403, antes de tocar no corpo |
| Qualquer contexto com `REBECA_SETTINGS_WRITE=1` | permitida |

**O que a mudança arrasta, e que não podia ser escondido:**

1. **O sistema de arquivos de uma função serverless é somente-leitura fora de `/tmp`.** Ligar a escrita
   sem tratar isso teria produzido o pior resultado possível: a requisição passaria na validação e a
   gravação estouraria com `EROFS`. Em ambiente publicado a configuração passa a viver em
   `/tmp/rebeca-segredos/llm.json`.
2. **`/tmp` é por instância e efêmero.** A chave cadastrada vale **até o processo reciclar** — e depois
   some, sem aviso. Isso destrava o uso imediato e é insuficiente como armazenamento definitivo. Por
   isso a visão da tela ganhou `durable`, e a interface **diz com todas as letras** que o que foi salvo
   ali é temporário, apontando a variável de ambiente como o caminho permanente. Fingir durabilidade
   seria pior que bloquear.
3. **Trilha de auditoria.** Toda gravação registra `updatedBy` (e-mail ou `sub` de quem gravou) — é o
   que responde "quem trocou a chave?" quando algo parar de funcionar. O autor é registrado; o valor da
   chave continua nunca saindo do servidor.

**O que continua pendente:** armazenamento durável em produção. `/tmp` não é resposta definitiva —
depende de banco (D1) ou de um armazenamento de chave-valor. Enquanto não existir, a variável de
ambiente segue sendo o caminho permanente, e a tela diz isso.

## Status
**proposto** — implementado e verificado; aguarda aprovação humana dos pontos em "Decisões que
continuam sendo do dono do produto" e a revisão adversarial do `rebeca-qa`. A atualização de
2026-10-03 altera a decisão nº 4 (escrita em ambiente publicado) e a nº 1 de "continua sendo do dono".

## Data
2026-10-01

## Contexto

O `ADR-006` entregou a camada de LLM, mas o caminho para ligá-la era hostil: editar `.env` **no
servidor** e reiniciar o processo. Consequências concretas, todas observadas:

1. Quem opera o app não é necessariamente quem tem acesso ao sistema de arquivos do servidor.
2. Cada experimento — trocar de provedor, testar um modelo, corrigir uma chave digitada errada —
   custava um ciclo de editar arquivo, salvar, reiniciar, voltar ao navegador.
3. Descobrir que a chave estava errada só acontecia ao tentar gerar conteúdo de verdade, e a falha
   aparecia como "o provedor não respondeu" — o usuário culpava o produto, não a chave.
4. Não havia como *ver* qual modelo atende qual função, nem como diferenciar uma função específica.
   O registro existia no código, invisível para quem opera.

O pedido do dono do produto foi direto: **uma área de configurações para colocar os segredos e os
endpoints, e diferenciar cada LLM, para fazer o app funcionar.**

Isso colide de frente com um invariante do projeto: *segredos nunca em texto claro no repositório, em
log ou em prompt*, e a skill `rebeca-seguranca` exige `refresh token` cifrado em cofre. É preciso
separar dois riscos que não são o mesmo:

- **Token OAuth do YouTube** — quem tem, **publica em nome do usuário**. É o ativo crítico, e continua
  exigindo cofre.
- **Chave de provedor de LLM** — quem tem, **gasta dinheiro na conta do dono**. O risco é financeiro,
  não é falar com a audiência de outra pessoa.

A diferença justifica tratamento diferente; **não** justifica chamar arquivo local de cofre.

## Decisão

**1. A configuração vive no servidor, num arquivo fora do controle de versão.**
`.rebeca/segredos/llm.json` (já ignorado pelo git) guarda chaves, endereços e escolhas de modelo.
Gravação atômica (temporário + rename) com permissão restrita; no Windows o `chmod` é praticamente
inócuo e isso está **declarado**, não presumido.

**2. A chave nunca sai do servidor.**
A leitura devolve máscara (`••••7890`) e um indicador de presença. **Não existe rota que devolva o
valor**, e há teste que varre a resposta inteira procurando o valor da chave.

**3. Três estados de campo, e a diferença entre eles é a decisão mais delicada deste ADR.**
Como a tela nunca recebe o valor, o campo de chave volta **vazio** a cada carregamento. Sem cuidado,
salvar o formulário apagaria a chave que o usuário acabou de cadastrar. Então:

| O que a tela envia | Efeito |
|---|---|
| campo ausente | **preserva** a chave atual |
| texto | **define** a chave |
| `null` (botão "remover") | **apaga** a chave |

**4. A escrita é desabilitada quando o app está publicado.**
`settingsWritable()` devolve `false` quando `VERCEL` está presente. Motivo: **não existe autenticação
nesta fase** (D3 aberta), e uma rota pública que aceita chave de API de qualquer visitante é uma
vulnerabilidade — não uma funcionalidade com ressalva. Em produção, o segredo vem do gerenciador de
segredos do servidor. Existe `REBECA_SETTINGS_WRITE=1` para quem quiser assumir isso, e nesse caso a
tela continua dizendo o que está acontecendo.

**5. O endereço do provedor é editável e passa por validação de SSRF.**
Deixar o usuário digitar uma URL que o servidor acessa é o vetor clássico. `assertSafeProviderUrl`
recusa: endereço de metadados de nuvem (`169.254.169.254`, `metadata.google.internal`), faixa privada,
loopback e IPv6 local quando o app está publicado, credencial embutida na URL (`user:senha@`), e
protocolo diferente de http/https. **Endereço local é aceito quando o app não está publicado** —
modelo rodando na própria máquina é caso de uso legítimo de quem opera.

**6. A precedência é: tela > variável de ambiente > padrão do catálogo.**
A tela ganhar do ambiente é escolha deliberada: quem acabou de colar a chave na interface espera que
ela valha. Se o ambiente ganhasse, o usuário salvaria, testaria e veria falhar com a chave antiga —
sem nada na tela explicando por quê.

**7. A escolha de modelo tem dois níveis, e é isso que "diferenciar cada LLM" significa na prática.**
Do mais específico ao mais genérico:

```
modelo da FUNÇÃO  →  modelo do NÍVEL  →  REBECA_MODEL_<NÍVEL>  →  padrão do catálogo  →  simulação
```

O nível agrupa funções por tipo de trabalho (raciocínio, criação, tarefas rápidas, visão); a
sobreposição por função atende o caso específico. A tela lista as **15 funções com o modelo que de
fato as atende**, marcando a origem da escolha — sem isso, "cada LLM diferenciada" seria uma promessa
invisível.

**8. "Testar conexão" faz uma chamada mínima real.**
Prompt mínimo, 64 tokens de saída. É o que transforma "salvei a chave" em "a chave funciona". O custo
**real** aparece no resultado e vai para o livro de custos: teste pago é gasto como qualquer outro, e
teste que não registra custo seria um furo no invariante nº 4.

**9. As três decisões do dono ficam na tela, com o risco escrito.**
As permissões que antes exigiam editar variável de ambiente (`permitir fornecedor de política não
verificada no canal infantil`, `permitir modelo sem preço verificado`, `permitir geração paga sem
registro de custo durável`) passam a ser interruptores visíveis, cada um com a consequência descrita.
Ligar deixa de ser um detalhe de configuração de servidor e passa a ser um ato registrado.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| **Guardar a chave no navegador** (`localStorage`) e enviá-la a cada chamada | A chave vira pública para qualquer script da página, e um XSS a exfiltra. Viola o invariante de segredos. Já recusada no `ADR-006` |
| **Manter só `.env` e documentar melhor** | É o que existia, e falhou por razões práticas: quem opera não tem acesso ao sistema de arquivos, e não havia como testar a chave nem ver qual modelo atende cada função |
| **Habilitar a escrita também em produção** | Sem autenticação (D3 aberta), qualquer visitante poderia cadastrar a própria chave e gastar na conta do dono. Uma rota pública dessas não é "funcionalidade com ressalva", é vulnerabilidade |
| **Guardar as chaves no banco (Supabase)** | Ainda não existe banco. Quando existir (D1), o cofre é o destino, e este arquivo passa a ser só o caminho de desenvolvimento |
| **Cifrar o arquivo com uma senha mestra** | A senha teria de ficar em algum lugar acessível ao processo — o que move o problema, não o resolve — e daria ao usuário a impressão de cofre. Preferimos dizer a verdade: é arquivo local com permissão restrita |
| **Não permitir endereço local** | Impediria usar modelo rodando na própria máquina (Ollama, LM Studio), que é caso legítimo de quem opera e não custa por token |
| **Allowlist fixa de endereços** | Fecharia a porta para proxy corporativo e gateway próprio. A validação por bloqueio cobre o risco real (rede interna e metadados) sem proibir o uso legítimo |
| **Esconder nome de fornecedor também nesta tela** | Nesta tela o operador **precisa** saber qual fornecedor atende o canal infantil — é uma restrição contratual. Continua fora das telas de conteúdo (`docs/04` §5) |
| **Testar conexão por validação de formato da chave** | Formato não prova que a credencial funciona, nem que o endereço responde. Seria um teste que mente |

## Consequências

**O que fica fácil**

- Ligar o app passou a ser: colar a chave, escolher o modelo, clicar em testar. Sem reiniciar nada.
- Erro de credencial aparece **antes** de tentar gerar conteúdo, com mensagem que diz o que fazer.
- A diferenciação por função é visível e editável, com a origem de cada escolha.
- As decisões de risco (menor de idade, preço desconhecido, custo não durável) ficaram explícitas em
  vez de escondidas em variável de ambiente.

**O que fica caro / assumido**

- **O arquivo não é cofre.** Quem lê o disco lê a chave. Está escrito na própria tela, e não só aqui.
  Em produção o caminho correto continua sendo o gerenciador de segredos.
- **A superfície de escrita existe.** Fora da Vercel ela fica aberta em `127.0.0.1` — quem alcança a
  porta de desenvolvimento pode gravar configuração. É aceitável no contexto de máquina local, e
  seria inaceitável exposto. A checagem por `VERCEL` é a defesa, e ela é frágil por natureza: outro
  ambiente publicado que não seja a Vercel **não** é reconhecido. Registrado como limitação.
- **O teste de conexão gasta dinheiro** (pouco, mas gasta) e é uma chamada que o usuário dispara. O
  custo aparece e é registrado, mas o botão é uma porta a mais para gasto.
- **SSRF não está resolvido por completo.** Hosts não são resolvidos na validação — resolvê-los já
  seria fazer a requisição que se quer evitar — e DNS rebinding não é mitigado por checagem de
  string. O que o portão garante é recusar o que é literalmente interno, exigir HTTPS em produção e
  impedir credencial na URL.

**O que precisa ser revisitado**

- **Quando existir autenticação (D3):** a escrita pode e deve ser habilitada em produção, com
  autorização por usuário e trilha de auditoria. Aí o destino do segredo passa a ser o cofre.
- **Quando o Supabase entrar (D1):** chaves e escolhas de modelo migram para tabela com RLS; este
  arquivo vira cache local de desenvolvimento.
- **Quando houver `rebeca-backend`:** taxa de requisição no endpoint de configuração e no teste de
  conexão, para o botão não virar vetor de gasto.
- **Se a Vercel deixar de ser o host:** a heurística `VERCEL` precisa virar uma variável explícita
  (`REBECA_HOSTED=1`), senão um ambiente publicado não será reconhecido como tal.

## Verificação

Ambiente: Node v26.7.0 · pnpm 11.25.0 · Windows.

| Verificação | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm exec tsc --noEmit` | ✅ exit 0 |
| Testes da configuração | `pnpm exec vitest run src/ai/__tests__/settings.test.ts` | ✅ **27/27** |
| Suíte completa | `pnpm exec vitest run` | ✅ **133/133 em 12 arquivos** — `.rebeca/evidencias/vitest-ia.txt` |
| **Determinismo da suíte** | `pnpm exec vitest run` **duas vezes seguidas** | ✅ 133/133 nas duas, 57s cada |
| Build de produção | `pnpm run build` | ✅ exit 0 |
| Leitura da configuração (HTTP real) | `GET /api/ai/settings` | ✅ 5 provedores, 4 níveis, 15 funções, 15 opções de catálogo |
| **A chave volta?** | varredura da resposta HTTP procurando o valor | ✅ **não aparece**; `keyMask=••••7890`, `keySource=configuracao` |
| **SSRF: metadados de nuvem** | `PUT` com `http://169.254.169.254/latest/meta-data` | ✅ HTTP 400 recusado |
| **SSRF: credencial na URL** | `PUT` com `https://user:senha@api.openai.com/...` | ✅ HTTP 400 recusado |
| **Chave implausível** | `PUT` com chave de 3 caracteres | ✅ HTTP 400 recusado |
| Endereço local em modo local | `PUT` com `http://127.0.0.1:5199/mock` | ✅ aceito |
| Escolha por função | `PUT` com `functionModels.criar-roteiro` | ✅ a função passa a resolver aquele modelo, com `origem=funcao` |
| **O endereço configurado é usado** | `POST /api/ai/test` com endereço apontando para caminho inexistente | ✅ o servidor chamou o endereço configurado (HTTP 404 do alvo), com falha tratada |
| Arquivo ignorado pelo git | `git check-ignore -v .rebeca/segredos/llm.json` | ✅ casado por `.rebeca/segredos/`; nada aparece em `git status` |
| Chave de teste removida do disco | inspeção após a verificação | ✅ arquivo removido; nenhuma chave real existe no ambiente |

**Defeito real encontrado pelo teste ponta a ponta com o servidor no ar:**

1. **A chave salva na tela era ignorada na escolha do modelo padrão.** A verificação de "existe chave
   para este provedor?" consultava **apenas** a variável de ambiente. Efeito: o usuário colava a
   chave, salvava, e o app continuava respondendo por simulação sem explicar por quê — exatamente o
   "não funciona" que este ADR existe para resolver. Nenhum teste unitário pegava, porque todos
   configuravam por ambiente. Corrigido em `providerHasKey`, com teste de regressão.
2. **`PUT /api/ai/settings` chegava vazio no servidor de desenvolvimento.** O middleware do Vite lia o
   corpo apenas em `POST`; o `PUT` era descartado e a tela recebia "formato inesperado" — erro do
   encanamento disfarçado de erro de validação. Corrigido, e a verificação acima cobre.

**Não verificado (declarado, não maquiado):**

1. **Nenhuma chamada real a provedor com credencial válida.** O "testar conexão" foi exercitado com
   endereço apontando para um caminho inexistente e sem chave — a **mecânica** está provada (resolve
   chave, resolve endereço, chama, trata erro, mede latência); o **sucesso** contra um provedor de
   verdade depende de uma chave real que não existe neste ambiente.
2. **A gravação recusada em ambiente publicado foi testada por variável**, não em deploy real na
   Vercel. A heurística `VERCEL` é frágil fora da Vercel — ver "o que precisa ser revisitado".
3. **Nenhum teste de render do painel.** O painel é verificado por tipos e por HTTP; não há teste de
   tela para ele (o `AiAction` tem).
4. **Permissão de arquivo no Windows não é verificada** — na prática o `chmod` é inócuo ali, e o
   código declara isso em vez de fingir proteção.
5. **Revisão adversarial do `rebeca-qa` não executada** sobre este ADR e esta entrega.

## Quem decidiu

- **Propôs:** implementação conduzida com as skills `rebeca-seguranca`, `rebeca-backend`,
  `rebeca-react` e `rebeca-arquiteto`.
- **Pedido do dono do produto:** "agregar o configurações à parte para colocar os segredos e os
  endpoints e diferenciar cada LLM para fazer funcionar o app".
- **Aprova (pendente):** os itens de "Decisões que continuam sendo do dono do produto" e a revisão do
  `rebeca-qa`.

## Decisões que continuam sendo do dono do produto

1. **Manter a escrita de configuração desabilitada em produção** enquanto não houver autenticação. Se
   você quiser a tela funcionando no app publicado, é `REBECA_SETTINGS_WRITE=1` — e a decisão de
   assumir essa exposição é sua, não do agente.
2. **Os três interruptores de risco** (política de menores não verificada, modelo sem preço, custo não
   durável). Desligados por padrão; ligar é ato explícito e fica registrado na tela.
3. **Aceitar que o arquivo local não é cofre.** É o preço de "funcionar sem editar `.env`", e ele está
   escrito na interface. Se o dono preferir exigir cofre desde o início, esta decisão muda e a tela
   volta a ser somente leitura.
