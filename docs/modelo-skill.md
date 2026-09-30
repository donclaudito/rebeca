# Modelo de skill (obrigatório para todo agente da orquestra)

Toda skill em `.dsh/skills/<id>/SKILL.md` segue exatamente este formato. O harness descobre o arquivo
pelo frontmatter: `name` precisa ser **kebab-case** e igual ao nome da pasta, e `description` é
obrigatória. A skill é carregada sob demanda — o `description` é o gatilho de ativação, então ele
precisa dizer **o que a skill faz e quando usar**.

```markdown
---
name: rebeca-<id>
description: <1-2 frases: o que faz + quando usar>. Use quando <gatilhos concretos>.
---

# <Título legível>

**Missão:** <uma frase que define a responsabilidade única deste agente>.

Você é o especialista em <área> do Rebeca. Leia `docs/00-visao-produto.md` antes de decidir algo de
produto, e `.rebeca/estado.md` para saber onde o projeto está.

## Quando você é chamado
- <situação concreta 1>
- <situação concreta 2>

## O que você recebe
- <entrada obrigatória> (ex.: contrato do arquiteto, roteiro aprovado, métricas do canal)

## O que você entrega
- <artefato real com caminho no repositório>

## Como você trabalha (princípios)
1. <regra prática e verificável>
2. ...

## Checklist antes de dizer "pronto"
- [ ] <verificação concreta, executável>
- [ ] <verificação concreta, executável>

## Anti-padrões (não faça)
- <erro comum nesta área>

## Handoff
- Chama em seguida: `<rebeca-id>` — <o que ele precisa receber>.
- Escala para humano quando: <condição>.
- Entrega no formato "Contrato de entrega" de `docs/01-orquestra-de-agentes.md`.
```

## Regras de escrita

1. **Português (pt-BR)**, direto, sem encher linguiça. Código e identificadores em inglês.
2. **Específico e verificável.** "Rodar `pnpm test` e colar a saída" vale; "garantir qualidade" não.
3. **Sem fato externo inventado.** Endpoint, quota, preço e limite de API entram apenas com fonte;
   caso contrário, marque `NÃO VERIFICADO` e diga como verificar.
4. **Sem código falso.** Se citar código, ele deve ser plausível e coerente com a stack do projeto
   (TypeScript, React, Supabase/Postgres, PowerShell, GitHub Actions, ffmpeg).
5. **Tamanho:** entre 60 e 200 linhas. Skill longa demais não é lida; curta demais não ajuda.
6. **Uma responsabilidade.** Se a skill começa a invadir a área de outra, delegue pelo nome dela.
