"""Extrator minimo de texto de PDF (FlateDecode + operadores Tj/TJ/'/")."""
import re, sys, zlib

def streams(data: bytes):
    for m in re.finditer(rb"stream\r?\n", data):
        start = m.end()
        end = data.find(b"endstream", start)
        if end == -1:
            continue
        raw = data[start:end]
        head = data[max(0, m.start() - 800):m.start()]
        if b"FlateDecode" in head:
            try:
                raw = zlib.decompress(raw)
            except Exception:
                try:
                    raw = zlib.decompressobj().decompress(raw)
                except Exception:
                    continue
        yield raw

def unescape(s: str) -> str:
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == "\\" and i + 1 < len(s):
            n = s[i + 1]
            mapping = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "(": "(", ")": ")", "\\": "\\"}
            if n in mapping:
                out.append(mapping[n]); i += 2; continue
            if n.isdigit():
                j = i + 1
                oct_digits = ""
                while j < len(s) and len(oct_digits) < 3 and s[j].isdigit():
                    oct_digits += s[j]; j += 1
                out.append(chr(int(oct_digits, 8))); i = j; continue
            out.append(n); i += 2; continue
        out.append(c); i += 1
    return "".join(out)

def decode_literal(raw: bytes) -> str:
    # tenta UTF-16BE se houver BOM, senao latin-1
    if raw[:2] in (b"\xfe\xff",):
        return raw[2:].decode("utf-16-be", "replace")
    return raw.decode("latin-1", "replace")

def text_from_content(content: bytes) -> str:
    try:
        s = content.decode("latin-1")
    except Exception:
        return ""
    parts = []
    # operadores de texto: (..) Tj  |  [..] TJ  |  Td/TD/T* -> quebra
    token = re.compile(
        r"\((?:\\.|[^\\()])*\)\s*Tj"
        r"|\[(?:\\.|[^\\\[\]])*\]\s*TJ"
        r"|(?:T\*|Td|TD|ET)\b"
        r"|\((?:\\.|[^\\()])*\)\s*'",
        re.S,
    )
    for m in token.finditer(s):
        t = m.group(0)
        if t.strip() in ("T*", "Td", "TD", "ET"):
            parts.append("\n")
            continue
        strs = re.findall(r"\((?:\\.|[^\\()])*\)", t, re.S)
        chunk = "".join(unescape(x[1:-1]) for x in strs)
        parts.append(chunk)
    txt = "".join(parts)
    txt = re.sub(r"[ \t]+", " ", txt)
    txt = re.sub(r"\n{2,}", "\n", txt)
    return txt

def hex_strings(content: bytes) -> str:
    s = content.decode("latin-1", "replace")
    out = []
    for m in re.finditer(r"<([0-9A-Fa-f\s]+)>\s*Tj", s):
        h = re.sub(r"\s", "", m.group(1))
        if len(h) % 2:
            h += "0"
        raw = bytes.fromhex(h)
        out.append(decode_literal(raw))
    return "".join(out)

def main(path: str) -> None:
    data = open(path, "rb").read()
    full = []
    for st in streams(data):
        if b"Tj" in st or b"TJ" in st:
            full.append(text_from_content(st))
            hx = hex_strings(st)
            if hx:
                full.append(hx)
    text = "\n".join(full)
    text = re.sub(r"\n{3,}", "\n\n", text)
    print(text)

if __name__ == "__main__":
    main(sys.argv[1])
