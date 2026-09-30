# Evidências — verificação do protótipo AI Media Studio

Logs brutos das execuções que sustentam o que está afirmado em `.rebeca/estado.md`.
Ambiente: Node v26.7.0 · pnpm 11.25.0 · TypeScript 7.0.2 · Vite 8.3.1 · Windows.

| Arquivo | Comando | Resultado |
|---|---|---|
| `vitest.txt` | `pnpm exec vitest run` | exit 0 · **8 testes, 8 passando**, 2 arquivos |
| `vitest-limpo.txt` | idem, com códigos ANSI removidos | versão legível do anterior |
| `build.txt` | `pnpm run build` (`tsc --noEmit && vite build`) | exit 0 · 1969 módulos · `dist/` gerado |

## Servidor local

```
pnpm run dev
→ VITE v8.3.1 ready
→ http://127.0.0.1:5173/

GET /                                        → 200
GET /c/luna/revisao/luna-borboletas          → 200  (fallback de SPA)
GET /portfolio                               → 200
GET /src/main.tsx                            → 200
```

## Defeitos encontrados pela verificação (e corrigidos)

Nenhum destes foi previsto no desenho. Os dois apareceram **porque** a verificação foi executada, não
por leitura de código.

| # | Sintoma | Causa raiz | Correção | Como foi provado |
|---|---|---|---|---|
| 1 | Trocar de canal não fazia nada: o menu fechava e a tela continuava no canal anterior | O listener de `mousedown` no documento fechava o menu entre o `mousedown` e o `click`; o elemento da opção saía do DOM e o evento `click` nunca chegava nele | Backdrop no lugar do listener de documento; cada opção passou a ser um `<Link>` real; a limpeza de cache saiu do botão e foi para o `ChannelLayout` | `src/data/__tests__/channel-scope.test.tsx` — falhava antes, passa agora |
| 2 | `pnpm run dev` morria com `EBUSY: resource busy or locked, watch ...tmpdir` | O watcher do Vite observava diretórios temporários de gravação atômica (em `.rebeca/` e na raiz) e, sem listener de `error` no `FSWatcher`, o Node encerrava o processo | `server.watch.ignored` com as pastas que não são app + `**/*.tmpdir/**`, e um plugin `watchErrorGuard` que transforma falha de watcher em aviso | Servidor no ar (job `pwsh-50`), gravação atômica na raiz executada, três requisições seguidas → HTTP 200 |

O defeito 2 aconteceu **duas vezes** com sintomas diferentes antes de ser entendido: primeiro ao gravar
`.rebeca/estado.md`, depois ao gravar `.gitignore`. A causa era a mesma.

## Lacunas declaradas

Ver a seção "Não verificado" em `.rebeca/estado.md`. Em resumo: **não houve conferência visual
pixel a pixel** (não há navegador automatizado nesta sessão), a arte 3D/Luna dos modelos não foi
reproduzida, e axe-core/viewport de celular ainda não rodaram.
