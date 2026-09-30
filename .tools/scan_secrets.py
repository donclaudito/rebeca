#!/usr/bin/env python3
"""Varredura de segredo em texto claro sobre tudo o que o Git rastreia.

Por que não usar `git grep` (que era o que o CI fazia):

1. O Git classifica como binário todo arquivo com byte NUL e `git grep -I` **pula** esses
   arquivos. Este repositório TEM arquivos assim: `.rebeca/evidencias/*.txt` são UTF-16LE,
   gerados por redirecionamento do PowerShell no Windows. Um segredo gravado ali era
   invisível para a varredura anterior (provado pelo `rebeca-qa` em repositório isolado:
   o mesmo `AIza…` é pego em UTF-8 e não é pego em UTF-16LE).
2. O histórico não era varrido (`actions/checkout` traz `fetch-depth: 1`), então segredo
   commitado e depois removido passa batido.

Aqui cada arquivo rastreado é lido em bytes e decodificado tentando UTF-8, depois UTF-16;
o valor encontrado é **mascarado** na saída — o log do CI não pode virar o vazamento.

Uso:  python .tools/scan_secrets.py            # varre o índice/árvore rastreada
      python .tools/scan_secrets.py --history  # varre também todos os blobs do histórico
Saída: exit 0 = limpo; exit 1 = achou (imprime arquivo, linha e padrão).
"""

from __future__ import annotations

import re
import subprocess
import sys

# Padrões ancorados em formato REAL de credencial. Documentação do projeto cita os prefixos
# (`AIza`, `eyJ`, `refresh_token`) — exigir tamanho e alfabeto evita que o próprio manual
# vire falso positivo e derrube o CI sem motivo.
PATTERNS: list[tuple[str, str]] = [
    ("github-token", r"\bgh[pousr]_[A-Za-z0-9]{36}\b"),
    ("github-pat", r"\bgithub_pat_[A-Za-z0-9_]{50,}\b"),
    ("google-api-key", r"\bAIza[0-9A-Za-z_\-]{35}\b"),
    ("google-oauth-client-secret", r"\bGOCSPX-[A-Za-z0-9_\-]{20,}\b"),
    ("google-access-token", r"\bya29\.[A-Za-z0-9_\-]{20,}\b"),
    ("google-refresh-token", r"\b1//[A-Za-z0-9_\-]{30,}\b"),
    ("aws-access-key", r"\bAKIA[0-9A-Z]{16}\b"),
    ("slack-token", r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"),
    # `(?<![A-Za-z0-9])` impede casar prosa do tipo "disk-..." com 32+ alfanuméricos.
    ("openai-key", r"(?<![A-Za-z0-9])sk-[A-Za-z0-9]{32,}\b"),
    ("jwt", r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b"),
    ("private-key-block", r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]

COMPILED = [(name, re.compile(rx)) for name, rx in PATTERNS]
# Arquivo grande aqui é mídia (jpeg/pdf), não texto com credencial.
MAX_BYTES = 2 * 1024 * 1024


def candidate_encodings(raw: bytes) -> list[str]:
    """Codificações a tentar, na ordem em que fazem sentido para o conteúdo.

    Detalhe que quase passou batido: `raw.decode("utf-8")` **sucede** em UTF-16LE de texto
    ASCII, porque o byte NUL é UTF-8 válido. Decodificar em UTF-8 e parar no primeiro
    sucesso produzia uma string com NUL entre cada letra — e o padrão nunca casava. Por isso
    olhamos o conteúdo antes de escolher: BOM, ou NUL nos primeiros bytes, denunciam UTF-16.
    """
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        return ["utf-16", "utf-16-le", "utf-16-be", "utf-8"]
    if b"\x00" in raw[:4096]:
        # Sem BOM, mas com NUL: típico de redirecionamento do PowerShell.
        return ["utf-16-le", "utf-16-be", "utf-16", "utf-8"]
    return ["utf-8"]


def mask(value: str) -> str:
    return f"{value[:4]}…({len(value)} chars)"


def scan(label: str, raw: bytes) -> list[str]:
    if len(raw) > MAX_BYTES:
        return []
    findings: list[str] = []
    seen: set[tuple[int, str, str]] = set()
    for encoding in candidate_encodings(raw):
        try:
            text = raw.decode(encoding)
        except (UnicodeDecodeError, UnicodeError):
            continue
        for lineno, line in enumerate(text.splitlines(), start=1):
            for name, rx in COMPILED:
                match = rx.search(line)
                if match:
                    key = (lineno, name, match.group(0))
                    if key in seen:
                        continue
                    seen.add(key)
                    findings.append(f"{label}:{lineno}: [{name}] {mask(match.group(0))}")
    return findings


def tracked_blobs() -> list[tuple[str, bytes]]:
    out = subprocess.run(
        ["git", "ls-files", "-z"], capture_output=True, check=True
    ).stdout
    blobs = []
    for path in (p for p in out.split(b"\0") if p):
        name = path.decode("utf-8", "replace")
        try:
            with open(name, "rb") as fh:
                blobs.append((name, fh.read()))
        except OSError:
            # Someado por caminho que não existe mais na árvore de trabalho: usa o índice.
            raw = subprocess.run(
                ["git", "show", f":{name}"], capture_output=True
            ).stdout
            blobs.append((name, raw))
    return blobs


def history_blobs() -> list[tuple[str, bytes]]:
    revs = subprocess.run(
        ["git", "rev-list", "--objects", "--all"], capture_output=True, check=True, text=True
    ).stdout.splitlines()
    seen: set[str] = set()
    blobs = []
    for line in revs:
        sha, _, path = line.partition(" ")
        if not path or sha in seen:
            continue
        seen.add(sha)
        raw = subprocess.run(["git", "cat-file", "blob", sha], capture_output=True).stdout
        blobs.append((f"historico:{path}", raw))
    return blobs


def main() -> int:
    tracked = tracked_blobs()
    findings: list[str] = []
    for name, raw in tracked:
        findings += scan(name, raw)

    scanned = len(tracked)
    if "--history" in sys.argv:
        historic = history_blobs()
        scanned += len(historic)
        for name, raw in historic:
            findings += scan(name, raw)

    if findings:
        print("SEGREDO EM TEXTO CLARO ENCONTRADO (valor mascarado de proposito):")
        for line in findings:
            print("  " + line)
        print(
            "\nNao basta apagar o arquivo: segredo commitado esta comprometido. "
            "Rotacione a credencial (rebeca-seguranca) antes de reescrever historico."
        )
        return 1

    escopo = "arvore + historico" if "--history" in sys.argv else "arvore"
    print(f"limpo: nenhum segredo em texto claro em {scanned} blobs ({escopo})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
