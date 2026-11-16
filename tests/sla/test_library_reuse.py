"""The SLA court reuses MandateCourt's code as a library: the shared functions must be byte-identical, nothing else is copied."""
import ast, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
LIB = ("canon", "sha256_hex", "_is_amount", "_recover_x", "_padd", "_pmul", "_peq", "_decompress", "ed25519_verify", "b58decode", "_status")
LIB_ASSIGN = ("_P", "_Q", "_D", "_I", "_B58", "_GY", "_GX", "_G")


def segs(path, names, assigns):
    src = path.read_text()
    out = {}
    for n in ast.parse(src).body:
        if isinstance(n, ast.FunctionDef) and n.name in names:
            out[n.name] = ast.get_source_segment(src, n)
        if isinstance(n, ast.Assign) and isinstance(n.targets[0], ast.Name) and n.targets[0].id in assigns:
            out[n.targets[0].id] = ast.get_source_segment(src, n)
    return out


def test_shared_code_is_byte_identical():
    a = segs(ROOT / "contracts/mandate_court.py", LIB, LIB_ASSIGN)
    b = segs(ROOT / "contracts/sla_court.py", LIB, LIB_ASSIGN)
    assert set(a) == set(LIB) | set(LIB_ASSIGN)
    assert a == b


def test_generated_file_is_current():
    subprocess.run([sys.executable, str(ROOT / "sla/gen_sla_contract.py"), "--check"], check=True)


def test_mandate_court_logic_is_not_copied_whole():
    s = (ROOT / "contracts/sla_court.py").read_text()
    for forbidden in ("class MandateCourt", "def scope_violations", "def extract_grant", "def mandate_v02_id"):
        assert forbidden not in s


def test_receipt_check_is_the_sla_one():
    a = segs(ROOT / "contracts/mandate_court.py", ("verify_receipt",), ())
    b = segs(ROOT / "contracts/sla_court.py", ("verify_receipt",), ())
    assert a["verify_receipt"] != b["verify_receipt"] and "iussum-sla/0.1 receipt" in b["verify_receipt"]
