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
from pathlib import Path

# Achados revisados como falso positivo (com justificativa datada dentro do arquivo).
BASELINE_PATH = Path(__file__).with_name("scan_secrets.baseline")

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


def scan(label: str, raw: bytes) -> list[tuple[str, int, str, str]]:
    """Devolve (rotulo, linha, nome-do-padrao, valor-encontrado)."""
    if len(raw) > MAX_BYTES:
        return []
    findings: list[tuple[str, int, str, str]] = []
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
                    findings.append((label, lineno, name, match.group(0)))
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
    """Todo blob já commitado, em UMA chamada ao git.

    A primeira versão disparava um `git cat-file blob <sha>` por objeto: 331 spawns de processo,
    ~150 ms cada no Windows — 55 s de varredura. `--batch` lê tudo de um pipe só (medido: ~1 s).
    """
    revs = subprocess.run(
        ["git", "rev-list", "--objects", "--all"], capture_output=True, check=True, text=True
    ).stdout.splitlines()

    sha_to_path: dict[str, str] = {}
    for line in revs:
        sha, _, path = line.partition(" ")
        if sha and sha not in sha_to_path:
            # `rev-list --objects` também lista trees, que não têm caminho; o catálogo devolve
            # o tipo e nós descartamos o que não for blob.
            sha_to_path[sha] = path or sha

    if not sha_to_path:
        return []

    proc = subprocess.run(
        ["git", "cat-file", "--batch"],
        input="\n".join(sha_to_path).encode("utf-8"),
        capture_output=True,
        check=True,
    )

    data = proc.stdout
    blobs: list[tuple[str, bytes]] = []
    pos = 0
    while pos < len(data):
        newline = data.find(b"\n", pos)
        if newline == -1:
            break
        header = data[pos:newline].decode("utf-8", "replace").split()
        if len(header) < 3:
            break
        sha, otype, size_raw = header[0], header[1], header[2]
        try:
            size = int(size_raw)
        except ValueError:
            break
        content = data[newline + 1 : newline + 1 + size]
        pos = newline + 1 + size + 1  # pula o "\n" separador que o git escreve
        if otype == "blob":
            blobs.append((f"historico:{sha_to_path.get(sha, sha)}", content))
    return blobs


def load_baseline() -> set[tuple[str, str]]:
    """Pares (caminho, nome-do-padrão) revisados como falso positivo. Ver o arquivo."""
    if not BASELINE_PATH.exists():
        return set()
    entries: set[tuple[str, str]] = set()
    for raw_line in BASELINE_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.split("#", 1)[0].strip()
        parts = line.split()
        if len(parts) >= 2:
            entries.add((parts[0], parts[1]))
    return entries


def main() -> int:
    baseline = load_baseline()
    tracked = tracked_blobs()
    raw_findings: list[tuple[str, int, str, str]] = []
    for name, raw in tracked:
        raw_findings += scan(name, raw)

    scanned = len(tracked)
    if "--history" in sys.argv:
        historic = history_blobs()
        scanned += len(historic)
        for name, raw in historic:
            raw_findings += scan(name, raw)

    findings: list[str] = []
    ignorados = 0
    for label, lineno, name, value in raw_findings:
        caminho = label.split("historico:", 1)[-1]
        if (caminho, name) in baseline:
            ignorados += 1
            continue
        findings.append(f"{label}:{lineno}: [{name}] {mask(value)}")

    if ignorados:
        # Visível de propósito: baseline silencioso esconde regressão.
        print(f"{ignorados} achado(s) ignorado(s) pelo baseline revisado (.tools/scan_secrets.baseline)")

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
