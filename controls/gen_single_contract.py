"""Generates controls/mandate_court_single.py from contracts/mandate_court.py. The ONLY change: the validator function accepts the leader's answer
unconditionally, so whatever the leader model says finalizes and no agreement check happens. For measurement only; never the product.
    python controls/gen_single_contract.py          # rewrite the control file
"""
import ast, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "contracts" / "mandate_court.py"
OUT = ROOT / "controls" / "mandate_court_single.py"


def make_control(src: str) -> str:
    tree = ast.parse(src)
    fns = [n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "validator_fn"]
    if len(fns) != 1:
        raise ValueError(f"expected exactly one validator_fn, found {len(fns)}")
    fn = fns[0]
    lines = src.split("\n")
    indent = " " * fn.col_offset
    header = lines[fn.lineno - 1]  # the def line, kept byte-identical
    new = [header, f"{indent}    return True"]
    return "\n".join(lines[: fn.lineno - 1] + new + lines[fn.end_lineno:])


if __name__ == "__main__":
    OUT.write_text(make_control(SRC.read_text()))
    print("wrote", OUT)
