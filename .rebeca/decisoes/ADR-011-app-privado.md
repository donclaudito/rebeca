# ADR-011 — O app publicado é privado (e não indexável)

## Status
proposto — a camada 2 está implementada e verificada; a camada 1 (proteção de deploy) **não foi
ligada** e depende de ação do dono. Revisado adversarialmente pelo `rebeca-qa` (`docs/qa/QA-011-app-privado.md`):
veredito **REFUTADO em escopo restrito** — o código passou, e sete achados de texto/afirmação foram
corrigidos nesta revisão.

## Data
2026-10-01

## Contexto

O app está publicado em `https://rebeca-odda.vercel.app` e **responde a qualquer visitante**. Medido
nesta sessão, não herdado: `GET /api/ai/status` → **HTTP 200** com o catálogo de provedores, sem
credencial nenhuma. O `ADR-007` já desligou a **escrita** de segredo em ambiente publicado (a tela de
Configurações não deixa colar chave), mas isso resolve metade do problema: quem alcança o endereço
continua consumindo a cota e, no dia em que houver `OPENAI_API_KEY` na Vercel, **consome a chave paga
do dono**. É exatamente o que o aviso da própria tela de Configurações diz ao usuário.

O `D3` (modelo de acesso: só o dono, ou equipe com papéis) segue **aberto** e a autenticação de
verdade pertence à F1 (Supabase Auth + RLS). O que **não** pode esperar a F1 é a exposição: um
protótipo com rotas que gastam dinheiro não deve estar aberto enquanto a decisão de acesso não chega.

O que acontece se nada for decidido: a URL continua pública, indexável e consumível; e a proteção
efetiva passa a depender de alguém lembrar de um toggle de painel que ninguém registrou.

## Decisão

**O app publicado é um ambiente privado de operação.** "Privado" é implementado em camadas
independentes, da mais externa para a mais interna:

| # | Camada | O que cobre | Estado |
|---|---|---|---|
| 1 | **Proteção de deploy da Vercel** — *Vercel Authentication* com escopo **All Deployments** | todas as requisições, inclusive `/api/*` — a plataforma exige autenticação **antes** de qualquer middleware, arquivo ou função | ⏳ ação do dono (1 clique por projeto) |
| 2 | **Não indexar / não arquivar** — `X-Robots-Tag`, `public/robots.txt` e `<meta name="robots">` | busca e arquivamento da URL; sobrevive a host que não aplique cabeçalhos (a meta tag) | ✅ implementado e testado |
| 3 | **Autenticação das rotas de IA** | quem pode chamar `/api/ai/*`, com identidade e trilha | ⏳ F1 (`D3`) — ou portão de sessão antes, se o dono pedir |

A camada 1 é a que **fecha a porta hoje**, e ela é gratuita: *Vercel Authentication* e o escopo *All
Deployments* constam como **Included** no plano Hobby (fonte abaixo). A camada 2 **não substitui**
controle de acesso — ela só impede que a URL seja encontrada e guardada por terceiros; quem souber o
endereço ainda chega. Está escrita assim no próprio `robots.txt`, para ninguém confundir as duas.

Ordem de execução importa: **ligar a camada 1 primeiro**, para que qualquer push posterior já nasça
protegido. (`NÃO VERIFICADO`: que a proteção alcance **deploys já existentes** e no ato da ativação é
**inferência** da leitura da doc — a frase que fala explicitamente de "past production deployments" só
existe nas variantes **legadas**, e a doc atual não promete imediatez. O `rebeca-qa` levantou isso.)

### Fato de fonte (verificado, com data)

- Deployment Protection "requires authentication for **all** requests, including those to Routing
  Middleware"; escopo **All Deployments** = "secure all deployments (both preview and production),
  restricting public access entirely". — <https://vercel.com/docs/deployment-protection>, `last_updated: 2026-09-15`, lido em 2026-10-01.
- Disponibilidade por plano: **Vercel Authentication / Standard Protection / All Deployments =
  "Included" no Hobby**; *Password Protection* = "Not available" no Hobby e US$ 20/mês por projeto no
  Pro. — <https://vercel.com/docs/deployment-protection/usage-and-pricing>, `last_updated: 2026-09-15`, lido em 2026-10-01.

## Alternativas descartadas

| Alternativa | Por que foi descartada |
|---|---|
| **Password Protection da Vercel** (senha compartilhada) | **Não existe no plano Hobby** e custa US$ 20/mês por projeto no Pro. Fonte acima. O desejo de "senha simples" não muda o plano. |
| **Deixar como está e confiar no `ADR-007`** | O `ADR-007` barra a **escrita** de segredo, não o **uso** das rotas. `GET /api/ai/status` e `POST /api/ai/generate` seguem abertos — a segunda gasta dinheiro. |
| **Só `robots.txt` / `noindex`** | Custa quase nada e por isso está incluído, mas **não é controle de acesso**: qualquer um com a URL continua entrando. Vender isso como "privado" seria mentira. |
| **Portão de senha caseiro agora** (cookie de sessão assinado + tela de login + middleware no edge) | Redundante com a camada 1 enquanto ela existir, e provavelmente descartável quando a F1 trouxer Supabase Auth. Fica como **opção explícita do dono**, não como default — e, se for feito, tem de ser *fail-closed* (sem segredo configurado, ninguém entra). |
| **Tirar o app do ar** (apagar o deploy e usar só local) | Fecha a porta, mas joga fora o único ambiente em que o dono abre o app do celular. Fica como último recurso, não como decisão silenciosa. |

## Consequências

- **Positivas:** a superfície pública deixa de existir para terceiros; a URL para de ser indexada e
  arquivada; a decisão fica registrada, então o próximo deploy não reabre a porta por esquecimento.
- **Negativas / custo assumido:** abrir o app publicado passa a exigir **login na conta Vercel** — o
  dono precisa estar logado no navegador onde abrir (ou conceder acesso a um usuário). Quem quiser
  testar sem login continua com `pnpm dev` em `localhost:5173`, que **não** é afetado por nada disto.
  As ferramentas automatizadas (e2e, `curl`) precisarão do *Protection Bypass for Automation*.
- **O que muda para o usuário:** hoje, qualquer visitante vê o app; depois, só quem o dono autorizar.
- **Impacto em isolamento multi-canal:** nenhum — a camada 1 protege o deploy inteiro; ela não
  substitui o `channel_id` no dado (invariante nº 2), que continua sendo o isolamento real.
- **Impacto em custo por vídeo:** nenhum. O efeito é sobre **quem** pode disparar gasto, não sobre o
  preço.
- **Existe mais de um projeto na Vercel recebendo este repositório** (`rebeca-odda` e `rebeca`, ver
  `ADR-003`). A camada 1 vale **por projeto**: proteger um só deixa o outro aberto.

## Verificação

- **Camada 2, agora:** `pnpm exec vitest run src/__tests__/headers.test.ts` → **11/11** (3 casos
  novos: `X-Robots-Tag`, `robots.txt`, meta tag). Prova adversarial executada: removidas as três
  camadas de propósito, os **3 casos ficam vermelhos** e os arquivos voltam byte a byte idênticos —
  `.rebeca/evidencias/adversarial-noindex.txt`. Tipos: `pnpm exec tsc --noEmit` → exit 0.
- **Camada 1, pelo dono:** depois de ligar, `https://rebeca-odda.vercel.app/api/ai/status` **sem
  sessão** deve deixar de devolver 200 (redireciona para login da Vercel / recusa). Esse é o teste que
  fecha o `ADR` — enquanto ele não for feito, a camada 1 fica **não verificada**.
- **Prazo de reavaliação:** ao fechar `D3` (F1), esta decisão é revisitada — a autenticação de
  verdade (Supabase Auth + RLS) substitui a dependência do painel.

## Quem decidiu

Proposto pelo agente (skill `rebeca-seguranca`) a pedido do dono do produto ("fazer ele privado"), em
2026-10-01. **A camada 1 exige ação do humano** no painel da Vercel — o agente não tem credencial da
Vercel nesta sessão e **não** afirma que ela foi ligada.
