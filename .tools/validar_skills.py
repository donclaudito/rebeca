"""Valida as skills da orquestra Rebeca (frontmatter, nome, tamanho, secoes obrigatorias).

Uso:  python .tools/validar_skills.py
Saida: relatorio em texto; exit code 1 se houver erro.
"""
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS = os.path.join(RAIZ, ".dsh", "skills")

# O modelo (docs/modelo-skill.md) escreve a missao como "**Missão:**" e as demais como "## ...".
SECOES = [
    (r"(\*\*Missão:\*\*|^## Missão)", "Missão"),
    (r"^## Quando você é chamado", "Quando você é chamado"),
    (r"^## O que você recebe", "O que você recebe"),
    (r"^## O que você entrega", "O que você entrega"),
    (r"^## Como você trabalha", "Como você trabalha"),
    (r"^## Checklist", "Checklist"),
    (r"^## Anti-padrões", "Anti-padrões"),
    (r"^## Handoff", "Handoff"),
]

# Sinais de texto corrompido por encoding (mojibake) na leitura UTF-8.
MOJIBAKE = re.compile(r"(Ã[\x80-\xbf]|Â[\x80-\xbf]|â€|ï»¿)")

# Linha que afirma numero de fora (quota, preco, limite) sem marcar como nao verificado.
NUMERO_SUSPEITO = re.compile(
    r"(quota|cota|limite|pre[çc]o|custo de|US\$|\$\s?\d|\d+\s?(GB|MB|min|req))",
    re.IGNORECASE,
)
MARCA_NAO_VERIFICADO = re.compile(r"N[ÃA]O VERIFICADO", re.IGNORECASE)

KEBAB = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def ler_frontmatter(texto):
    if not texto.startswith("---"):
        return None
    fim = texto.find("\n---", 3)
    if fim == -1:
        return None
    bloco = texto[3:fim]
    dados = {}
    for linha in bloco.splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#"):
            continue
        if ":" not in linha:
            return None
        chave, valor = linha.split(":", 1)
        dados[chave.strip()] = valor.strip().strip('"').strip("'")
    return dados


def main():
    if not os.path.isdir(SKILLS):
        print(f"ERRO: pasta de skills nao encontrada: {SKILLS}")
        return 1

    dirs = sorted(d for d in os.listdir(SKILLS) if os.path.isdir(os.path.join(SKILLS, d)))
    erros, avisos, ok = [], [], []

    for nome_pasta in dirs:
        caminho = os.path.join(SKILLS, nome_pasta, "SKILL.md")
        if not os.path.isfile(caminho):
            erros.append(f"{nome_pasta}: falta SKILL.md")
            continue

        with open(caminho, encoding="utf-8") as fh:
            texto = fh.read()

        fm = ler_frontmatter(texto)
        if fm is None:
            erros.append(f"{nome_pasta}: frontmatter YAML ausente ou invalido")
            continue

        nome = fm.get("name", "")
        desc = fm.get("description", "")
        extras = set(fm) - {"name", "description", "whenToUse"}

        if not nome:
            erros.append(f"{nome_pasta}: frontmatter sem 'name'")
        elif nome != nome_pasta:
            erros.append(f"{nome_pasta}: name='{nome}' difere da pasta")
        elif not KEBAB.match(nome):
            erros.append(f"{nome_pasta}: name nao e kebab-case")

        if not desc:
            erros.append(f"{nome_pasta}: frontmatter sem 'description'")
        elif len(desc) < 40:
            avisos.append(f"{nome_pasta}: description curta ({len(desc)} chars) — e o gatilho de ativacao")
        if extras:
            avisos.append(f"{nome_pasta}: chaves extras no frontmatter: {sorted(extras)}")

        linhas = texto.count("\n") + 1
        if linhas < 60:
            avisos.append(f"{nome_pasta}: {linhas} linhas (modelo pede 60-200)")
        elif linhas > 200:
            avisos.append(f"{nome_pasta}: {linhas} linhas (modelo pede 60-200)")

        faltando = [rotulo for padrao, rotulo in SECOES if not re.search(padrao, texto, re.M)]
        if faltando:
            erros.append(f"{nome_pasta}: secoes ausentes: {', '.join(faltando)}")

        if MOJIBAKE.search(texto):
            erros.append(f"{nome_pasta}: texto com mojibake (arquivo provavelmente nao esta em UTF-8 limpo)")

        # Aviso (nao erro): numero externo sem a marca NÃO VERIFICADO na mesma linha.
        for num, linha in enumerate(texto.splitlines(), 1):
            if NUMERO_SUSPEITO.search(linha) and not MARCA_NAO_VERIFICADO.search(linha):
                avisos.append(f"{nome_pasta}:{num}: possivel fato externo sem 'NÃO VERIFICADO' -> {linha.strip()[:110]}")
                break

        if not faltando and not any(e.startswith(nome_pasta + ":") for e in erros):
            ok.append(f"{nome_pasta} ({linhas} linhas)")

    print(f"Skills encontradas: {len(dirs)}")
    print(f"\nOK ({len(ok)}):")
    for item in ok:
        print(f"  - {item}")

    if avisos:
        print(f"\nAVISOS ({len(avisos)}):")
        for item in avisos:
            print(f"  ! {item}")

    if erros:
        print(f"\nERROS ({len(erros)}):")
        for item in erros:
            print(f"  X {item}")
        return 1

    print("\nResultado: todas as skills validas.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
