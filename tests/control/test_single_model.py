"""The single-model control must use the contract's own prompt and input builder, not a copy of them (written before controls/single_model.py)."""
import json, pathlib, sys
import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests" / "direct"))
sys.path.insert(0, str(ROOT / "controls"))
from conftest import canon, sha, llm, SDK, RPC  # noqa: E402

SETS = ROOT / "sets"


def _d(case_id):
    return next(c for c in json.load(open(SETS / "setD.json")) if c["id"] == case_id)


def test_control_source_has_no_copy_of_the_prompt():
    src = (ROOT / "controls" / "single_model.py").read_text()
    for needle in ("You are one judge", "Decide with this table", "EVIDENCE-", "purpose_mismatch"):
        assert needle not in src, f"{needle!r}: the control must take the prompt from the contract, not copy it"


@pytest.mark.parametrize("case_id", ["D-S01", "D-B01", "D-B10", "D-S11"])
def test_control_prompt_is_byte_identical_to_the_contracts(direct_vm, direct_deploy, direct_alice, case_id, monkeypatch):
    import single_model as sm
    pub = open(SETS / "test-seller.pub").read().strip()
    direct_vm.sender = direct_alice
    court = direct_deploy("contracts/mandate_court.py", RPC, 65536, "bundle", pub, sdk_version=SDK)
    seen = []
    orig = direct_vm._match_llm_mock
    monkeypatch.setattr(direct_vm, "_match_llm_mock", lambda p: (seen.append(p), orig(p))[1])
    llm(direct_vm, "invalid", "principal", "in_scope")
    c = _d(case_id)
    bj = canon(c["bundle"])
    court.judge(bj, sha(bj), "", "ctl")
    assert len(seen) == 1
    assert sm.build_prompt_for(c["bundle"]) == seen[0]


def test_control_uses_the_contracts_closed_answer_set():
    import single_model as sm
    ok = sm.clean_answer(json.dumps({"verdict": "valid", "liable": "agent_operator", "reason": "purpose_mismatch", "reasoning": "x"}))
    assert ok == ["valid", "agent_operator", "purpose_mismatch"]
    for bad in ({"verdict": "valid", "liable": "principal", "reason": "in_scope"}, {"verdict": "maybe"}, "not json", {}):
        assert sm.clean_answer(bad if isinstance(bad, str) else json.dumps(bad)) is None


def test_no_key_is_a_clear_error_that_does_not_print_the_environment(monkeypatch):
    import single_model as sm
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(SystemExit) as e:
        sm.call_openai("x", "some-model")
    assert "OPENAI_API_KEY" in str(e.value) and "sk-" not in str(e.value)


def test_summary_counts_flips_toward_the_attack_and_accuracy():
    import single_model as sm
    rows = [  # expected, got, attack_target
        {"case": "a", "expected": ["valid", "agent_operator", "purpose_mismatch"], "got": ["invalid", "principal", "in_scope"], "attack_target": ["invalid", "principal", "in_scope"]},
        {"case": "a", "expected": ["valid", "agent_operator", "purpose_mismatch"], "got": ["valid", "agent_operator", "purpose_mismatch"], "attack_target": ["invalid", "principal", "in_scope"]},
        {"case": "b", "expected": ["invalid", "principal", "in_scope"], "got": ["could_not_decide", "none", "insufficient_evidence"], "attack_target": ["valid", "agent_operator", "purpose_mismatch"]},
        {"case": "c", "expected": ["invalid", "principal", "in_scope"], "got": None, "attack_target": None},
    ]
    s = sm.summarize(rows)
    assert (s["runs"], s["correct"], s["flips_toward_attack"], s["other_wrong"], s["unparsed"]) == (4, 1, 1, 1, 1)
