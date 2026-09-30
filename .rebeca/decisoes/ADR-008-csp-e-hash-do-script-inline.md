# ADR-008 — CSP estrito no deploy, com hash para o único script inline

> **Numeração (estado final):** esta decisão nasceu como ADR-007 e virou **008** porque uma sessão
> paralela gravou `ADR-007-linguagem-visual-youtube.md` no mesmo minuto (ela já tinha um `ADR-006` e
> um `ADR-006-camada-de-llm-por-funcao.md`, resolvendo o próprio duplicado). Ao ceder o número, o ADR
> de linguagem visual terminou em **`ADR-009-linguagem-visual-youtube.md`**; o **`ADR-007` fica
> vazio de propósito**, como registro do número disputado. `docs/03-design-system.md` referencia os
> dois corretamente (o 009 para a linguagem visual, o 008 para o contrato de CSP). Ver §7 do
> `docs/seguranca/threat-model.md` — numeração de ADR e `estado.md` não aceitam dois escritores.

## Status
aceito (decisão técnica dentro do escopo de segurança; não muda produto, não gasta dinheiro, não
envolve dado pessoal — por isso não exigiu aprovação humana)

## Data
2026-09-30

## Contexto

O `vercel.json` declarava `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` e
`Permissions-Policy`, mas **nenhum `Content-Security-Policy`** e nenhum `Strict-Transport-Security`.
Sem CSP, a única defesa contra XSS era o escape automático do React — uma camada só. O produto vai
guardar token OAuth de canal e, portanto, vai virar alvo que justifica defesa em profundidade.

Ao mesmo tempo, a interface ganhou um **script inline** no `index.html` para aplicar o tema antes da
primeira pintura (sem ele a tela pisca clara antes de virar escura; ver `src/app/theme.tsx`). Script
inline é exatamente o que um CSP estrito bloqueia.

Se nada fosse decidido: ou o app fica sem CSP (superfície aberta), ou o CSP entra com
`'unsafe-inline'` — que na prática **desliga** a proteção contra injeção de script e ainda dá a
falsa sensação de controle.

## Decisão

`vercel.json` passa a enviar CSP estrito, com o script de tema autorizado por **hash sha256** — não
por `'unsafe-inline'`:

```
default-src 'self'; script-src 'self' 'sha256-qpRjRiAYTMBLET8G9KOyANYuFR15hjD791gTZufxShc=';
style-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self';
object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none';
upgrade-insecure-requests
```

Mais `Strict-Transport-Security: max-age=63072000; includeSubDomains` e
`Cross-Origin-Opener-Policy: same-origin`.

O hash foi calculado do **artefato de produção** (`vite build` → `dist/index.html`), não do fonte, e
conferido byte a byte: o script inline tem 524 bytes e o mesmo sha256 nos dois arquivos.

O hash é valor derivado e envelhece em silêncio: editar um comentário do script passa a bloquear o
tema, e o sintoma é uma piscada na tela, não um erro. Por isso
`src/__tests__/headers.test.ts` lê `index.html` e `vercel.json` do disco e **falha se o hash
autorizado divergir do script que o documento carrega** — e recusa `'unsafe-inline'`/`'unsafe-eval'`
em `script-src`. Mesma mecânica de `src/data/__tests__/cycle.test.ts`, que lê `docs/00`.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| Não enviar CSP | Deixa a única defesa contra XSS como o escape do React. Em app que vai guardar token de canal, é pouco. |
| CSP com `'unsafe-inline'` em `script-src` | Desliga a proteção contra script injetado e ainda parece controle. Pior que não ter, porque engana. |
| Remover o script inline e aplicar o tema pelo React | Volta a piscada clara na primeira pintura (o defeito que o script existe para corrigir). |
| `nonce` por resposta | Exige servidor gerando HTML a cada requisição. O deploy é estático (Vercel + `dist/`); não há onde gerar nonce sem inventar uma função de borda. |
| Gerar o CSP no build (plugin) com o hash calculado | Mais correto no longo prazo, mas muda `vite.config.ts` — que estava sendo reescrito por outra sessão no momento desta decisão. Fica como evolução natural se o script inline passar a mudar com frequência. |

## Consequências

- **Positivas:** o deploy ganha a camada que faltava contra XSS; `object-src`, `base-uri`,
  `form-action` e `frame-ancestors` fecham os vetores que sobram quando só `default-src` é declarado;
  HSTS impede downgrade para HTTP; o hash não pode divergir em silêncio (teste).
- **Negativas / custo assumido:** editar o script inline **exige** atualizar o hash, e o teste cobra
  isso. `img-src`/`connect-src` fechados em `'self'` vão precisar das origens reais quando os
  provedores de mídia e o Storage entrarem — apertar agora e esquecer de soltar depois quebra a tela;
  soltar `*` depois desfaz o controle.
- **O que muda para o usuário:** nada visível. O tema continua aplicando antes da primeira pintura.
- **Impacto em isolamento multi-canal:** nenhum direto. CSP é defesa por origem, não por canal.
- **Impacto em custo por vídeo:** nenhum.
- **Efeito colateral conhecido:** a `Vercel Toolbar` (preview) usa script inline e origens da Vercel;
  com `script-src` por hash ela tende a não carregar em **preview**. Em produção não há toolbar.
  `NÃO VERIFICADO` — não há deploy para observar. Se incomodar, a saída é um cabeçalho por ambiente,
  não afrouxar produção.

## Verificação

- `pnpm exec vitest run src/__tests__/headers.test.ts` → **8/8** (`.rebeca/evidencias/seguranca-headers.txt`).
- Prova adversarial: trocar um caractere do hash deixa o teste **vermelho** (executado, restaurado).
- `pnpm exec vite build` → `dist/index.html` com 1 script inline (o de tema), 1 script externo,
  1 folha de estilo externa, **0** `<style>` e **0** atributo `style=`.
- Pendente: observar os cabeçalhos na resposta real. Só depois do import do dono na Vercel.

## Quem decidiu

Agente `rebeca-seguranca` (auditoria de 2026-09-30). Decisão técnica sem trade-off de produto, custo
ou dado pessoal — não exigiu aprovação humana. Reavaliar quando existir URL de produção: aí os
cabeçalhos passam de "declarados" a "observados", com `curl -I` na rota profunda.
