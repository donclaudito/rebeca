#!/usr/bin/env python3
"""Prova adversarial do scanner de segredo (`.tools/scan_secrets.py`).

Por que este arquivo existe: o scanner já disse "limpo" com uma credencial de verdade commitada.
O `git grep -I` que ele substituiu pulava arquivos UTF-16LE; e a primeira versão dos padrões não
casa com a chave da Anthropic (`sk-ant-api03-…`), porque `[A-Za-z0-9]{32,}` para no hífen depois de
`sk-`. Nos dois casos o defeito era o mesmo: **a varredura não errava, ela silenciava**.

Um scanner sem teste é uma afirmação sem prova. Aqui cada padrão tem um positivo (fixture no
formato real, inventada) e o repositório tem negativos (a prosa do próprio projeto, que cita
`AIza`, `sk-ant-api...` e `refresh_token` — e não pode derrubar o CI).

Uso:  python .tools/test_scan_secrets.py
Saída: exit 0 = todos os casos passaram; exit 1 = algum caso falhou.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent


def carregar_scanner():
    spec = importlib.util.spec_from_file_location("scan_secrets", AQUI / "scan_secrets.py")
    assert spec and spec.loader
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


sc = carregar_scanner()

# Fixtures: formato real, valor inventado. Nenhuma destas strings é credencial de ninguém.
POSITIVOS: list[tuple[str, str, str]] = [
    ("anthropic-key", "anthropic", "sk-ant-api03-" + "B" * 95 + "AA"),
    ("anthropic-key", "anthropic-curta", "sk-ant-api03-" + "Z" * 40),
    ("openai-key", "openai", "sk-" + "a" * 48),
    ("openai-key", "deepseek", "sk-" + "f" * 32),
    ("google-api-key", "google-api", "AIza" + "A" * 35),
    ("google-oauth-client-secret", "google-secret", "GOCSPX-" + "b" * 24),
    ("google-refresh-token", "google-refresh", "1//" + "c" * 40),
    ("github-token", "github", "ghp_" + "d" * 36),
    ("aws-access-key", "aws", "AKIA" + "E" * 16),
    ("slack-token", "slack", "xoxb-" + "1234567890abc"),
    ("jwt", "supabase-service-role", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0." + "e" * 43),
    ("private-key-block", "pem", "-----BEGIN RSA PRIVATE KEY-----"),
]

# Prosa que existe neste repositório (docs, skills, ADRs). Não pode virar achado: baseline que
# cresce a cada documento é baseline que ninguém lê.
NEGATIVOS: list[tuple[str, str]] = [
    ("prefixo-documentado", "o prefixo `AIza` identifica chave de API do Google"),
    ("claude-doc", "use sk-ant-api... no cabecalho Authorization"),
    ("refresh_token-prosa", "refresh_token: nunca em log, nunca em prompt"),
    ("client_secret-prosa", "guarde o client_secret no cofre, cifrado"),
    ("hifen-prosa", "o diretorio disk-uso-compartilhado-do-servidor-principal"),
]


def nomes_detectados(rotulo: str, texto: str) -> set[str]:
    return {nome for _, _, nome, _ in sc.scan(rotulo, texto.encode("utf-8"))}


def nomes_detectados_utf16le(rotulo: str, texto: str) -> set[str]:
    """O caso que o `git grep -I` pulava: byte NUL faz o Git tratar o arquivo como binário."""
    return {nome for _, _, nome, _ in sc.scan(rotulo, texto.encode("utf-16-le"))}


def main() -> int:
    falhas: list[str] = []

    for esperado, rotulo, valor in POSITIVOS:
        if esperado not in nomes_detectados(rotulo, valor):
            falhas.append(f"positivo NAO detectado: [{esperado}] em {rotulo}")

    for rotulo, texto in NEGATIVOS:
        achados = nomes_detectados(rotulo, texto)
        if achados:
            falhas.append(f"falso positivo: {rotulo} casou {sorted(achados)}")

    # Mesmo segredo, gravado como o PowerShell grava no Windows: UTF-16LE.
    segredo = "sk-ant-api03-" + "Q" * 60
    if "anthropic-key" not in nomes_detectados_utf16le("utf16le", segredo):
        falhas.append("positivo NAO detectado em UTF-16LE: [anthropic-key]")

    # Mascaramento: o log do CI nao pode virar o vazamento.
    mascara = sc.mask(segredo)
    if segredo in mascara or len(mascara) >= len(segredo):
        falhas.append(f"mask() vazou o valor: {mascara!r}")

    if falhas:
        print("FALHOU na prova do scanner:")
        for linha in falhas:
            print("  " + linha)
        return 1

    print(
        f"ok: {len(POSITIVOS)} positivo(s) detectado(s), {len(NEGATIVOS)} falso(s) positivo(s) "
        f"evitado(s), UTF-16LE coberto, valor mascarado na saida"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
