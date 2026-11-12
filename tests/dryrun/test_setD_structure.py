"""Local dry run of Set D with a mocked model: finds bundles refused for a reason that is the generator's fault. Changes no expectation."""
import json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "direct"))
from conftest import canon, sha, llm, SDK, RPC

SETS = pathlib.Path(__file__).resolve().parents[2] / "sets"


def test_dry_run(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    pub = open(SETS / "test-seller.pub").read().strip()
    court = direct_deploy("contracts/mandate_court.py", RPC, 65536, "bundle", pub, sdk_version=SDK)
    llm(direct_vm, "invalid", "principal", "in_scope")
    seen = []
    for c in json.load(open(SETS / "setD.json")):
        bj = canon(c["bundle"])
        r = json.loads(court.judge(bj, sha(bj), c.get("resolver", ""), "dry"))
        seen.append((c["id"], r["path"], r["reason"], r.get("unsigned_ignored")))
    print()
    for x in seen: print("DRY", x)
