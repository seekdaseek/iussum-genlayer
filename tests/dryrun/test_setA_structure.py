"""Local, mocked-LLM dry run of the converted Set A bundles. Purpose: find conversion artefacts (a bundle refused for a reason
that is the converter's fault) before spending chain runs. It does NOT change any expectation."""
import json, pathlib, sys
import pytest
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "direct"))
from conftest import canon, sha, llm, SDK, RPC

SETS = pathlib.Path(__file__).resolve().parents[2] / "sets"
CASES = json.load(open(SETS / "setA.json"))


def test_dry_run(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    court = direct_deploy("contracts/mandate_court.py", RPC, 65536, "bundle", sdk_version=SDK)
    llm(direct_vm, "invalid", "principal", "in_scope")
    bad = []
    for c in CASES:
        bj = canon(c["bundle"])
        try:
            r = json.loads(court.judge(bj, sha(bj), "", "dry"))
        except Exception as e:
            bad.append((c["id"], "EXC " + str(e)[:80])); continue
        got = [r["verdict"], r["liable"], r["reason"]]
        if got != c["expected"]:
            bad.append((c["id"], got, c["expected"]))
    print("\nDRYRUN mismatches:", len(bad))
    for b in bad: print("  ", b)
