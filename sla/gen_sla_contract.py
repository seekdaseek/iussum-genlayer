#!/usr/bin/env python3
"""Build contracts/sla_court.py from sla/sla_court.template.py plus selected functions of contracts/mandate_court.py.

The GenVM takes one file per contract, so MandateCourt's code is reused by extraction, not by hand copy: the functions in
LIB are lifted byte for byte from contracts/mandate_court.py (a test diffs them). Nothing else of MandateCourt is included.
Usage: gen_sla_contract.py [--check]
"""
import ast
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "contracts/mandate_court.py"
TEMPLATE = ROOT / "sla/sla_court.template.py"
OUT = ROOT / "contracts/sla_court.py"
LIB = ("canon", "sha256_hex", "_is_amount", "_recover_x", "_padd", "_pmul", "_peq", "_decompress", "ed25519_verify", "b58decode", "_status")
LIB_ASSIGN = ("_P", "_Q", "_D", "_I", "_B58", "_GY", "_GX", "_G")
MARK = "# @@LIBRARY@@"


def library() -> str:
    src = SRC.read_text()
    parts = []
    for n in ast.parse(src).body:
        if isinstance(n, ast.FunctionDef) and n.name in LIB:
            parts.append(ast.get_source_segment(src, n))
        elif isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id in LIB_ASSIGN:
            parts.append(ast.get_source_segment(src, n))
    names = {p.split("(")[0].split("=")[0].replace("def ", "").strip() for p in parts}
    assert names == set(LIB) | set(LIB_ASSIGN), names ^ (set(LIB) | set(LIB_ASSIGN))
    return "\n\n\n".join(parts)


def build() -> str:
    t = TEMPLATE.read_text()
    assert t.count(MARK) == 1
    return t.replace(MARK, "# ---- reused from contracts/mandate_court.py by sla/gen_sla_contract.py (byte-identical, tested) ----\n" + library())


if __name__ == "__main__":
    out = build()
    if "--check" in sys.argv:
        if OUT.read_text() != out:
            sys.exit("contracts/sla_court.py is not current: run sla/gen_sla_contract.py")
    else:
        OUT.write_text(out)
