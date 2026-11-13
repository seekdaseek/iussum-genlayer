"""The leader-only control contract differs from the shipping contract in ONE function and nothing else (written before the generator)."""
import ast, difflib, json, pathlib, sys
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests" / "direct"))
sys.path.insert(0, str(ROOT / "controls"))
from conftest import canon, sha, llm, SDK, RPC, make_bundle, SELLER_PUB  # noqa: E402

SHIP = (ROOT / "contracts" / "mandate_court.py").read_text()
CTRL_PATH = ROOT / "controls" / "mandate_court_single.py"


def _validator_span(src):
    tree = ast.parse(src)
    spans = [(n.lineno, n.end_lineno) for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "validator_fn"]
    assert len(spans) == 1, "exactly one validator_fn in the contract"
    return spans[0]


def test_control_file_is_exactly_what_the_generator_makes():
    import gen_single_contract as g
    assert CTRL_PATH.read_text() == g.make_control(SHIP), "regenerate with: python controls/gen_single_contract.py"


def test_only_the_validator_function_differs():
    ctrl = CTRL_PATH.read_text()
    s0, e0 = _validator_span(SHIP)
    a, b = SHIP.splitlines(), ctrl.splitlines()
    changed_in_ship = set()
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op != "equal":
            changed_in_ship.update(range(i1 + 1, max(i2, i1 + 1) + 1))
    assert changed_in_ship, "the control must differ"
    assert all(s0 <= n <= e0 + 1 for n in changed_in_ship), f"lines outside validator_fn changed: {sorted(changed_in_ship)}"
    # everything before and after the function is byte-identical
    assert a[: s0 - 1] == b[: s0 - 1]
    tail = len(a) - e0
    assert a[e0:] == b[len(b) - tail:]


def test_control_validator_accepts_unconditionally():
    ctrl = CTRL_PATH.read_text()
    s, e = _validator_span(ctrl)
    body = "\n".join(ctrl.splitlines()[s - 1:e])
    assert "return True" in body and "leader_fn()" not in body and "isinstance" not in body


def test_control_lints_and_pins_the_same_runner():
    first = lambda t: t.splitlines()[0]
    assert first(CTRL_PATH.read_text()) == first(SHIP)


def test_generator_refuses_a_contract_without_exactly_one_validator_fn():
    import gen_single_contract as g
    with pytest.raises(ValueError):
        g.make_control("x = 1\n")
    with pytest.raises(ValueError):
        g.make_control(SHIP + "\n\ndef validator_fn(x):\n    return x\n")


def test_in_direct_mode_the_control_accepts_a_leader_answer_the_jury_would_reject(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    court = direct_deploy("controls/mandate_court_single.py", RPC, 65536, "bundle", SELLER_PUB, sdk_version=SDK)
    import conftest
    conftest.STATE["serve"] = None
    llm(direct_vm, "valid", "agent_operator", "purpose_mismatch")
    bj, h = make_bundle(chain_record=True)
    court.judge(bj, h, "", "ctl")
    lead = {"verdict": "invalid", "liable": "principal", "reason": "in_scope", "reasoning": "x"}  # differs from what this validator's model says
    assert direct_vm.run_validator(leader_result=lead, index=-1) is True


def test_the_shipping_contract_rejects_the_same_answer(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    court = direct_deploy("contracts/mandate_court.py", RPC, 65536, "bundle", SELLER_PUB, sdk_version=SDK)
    import conftest
    conftest.STATE["serve"] = None
    llm(direct_vm, "valid", "agent_operator", "purpose_mismatch")
    bj, h = make_bundle(chain_record=True)
    court.judge(bj, h, "", "ctl")
    lead = {"verdict": "invalid", "liable": "principal", "reason": "in_scope", "reasoning": "x"}
    assert direct_vm.run_validator(leader_result=lead, index=-1) is False
