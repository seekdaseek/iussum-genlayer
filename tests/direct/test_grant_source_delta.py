"""Phase 1.5: grant memo check, purpose bound by the mandate id, chain_source flag, delta output."""
import json
import pytest
from conftest import make_bundle, canon, sha, pay_doc, grant_doc, llm, SDK, RPC, PURPOSE, AGENT, MINT, SELLER_A, SELLER_B

RUN = "g1"


def judge(c, bj, h, resolver="", tag=RUN):
    return json.loads(c.judge(bj, h, resolver, tag))


def refused(r, code):
    assert (r["verdict"], r["liable"], r["reason"], r["path"]) == ("invalid", "none", code, "refusal"), r


# ---- grant ---------------------------------------------------------------------------------------
@pytest.mark.parametrize("over", [
    {"memo": "iussum v0.3 | agent X | id " + "0" * 64},           # memo carries another mandate id
    {"memo": "iussum v0.3 | no id at the end"},                   # not a grant memo
    {"memo": "iussum v0.2 | x | id " + "a" * 64},                 # wrong memo version
    {"two_memos": True},
    {"owner": "2uh7t2wh3omQNzzRypGj1rVJhtmJ6HtR4qFy9f2aNbg9"},    # approve by another owner
    {"delegate": "2uh7t2wh3omQNzzRypGj1rVJhtmJ6HtR4qFy9f2aNbg9"},
    {"mint": "So11111111111111111111111111111111111111112"},
    {"amount": "999999"},                                         # != total_cap
    {"signers": ["BSC8EyZJr19cqzYw3e7UnoDjsNJS4RGiE8rdoo4pJgiU", "2uh7t2wh3omQNzzRypGj1rVJhtmJ6HtR4qFy9f2aNbg9"]},
    {"slot": 512812333},                                          # grant AFTER the payment (slot 512812332)
    {"err": {"InstructionError": [0, "x"]}},
], ids=["other_id", "no_id", "memo_version", "two_memos", "owner", "delegate", "mint", "amount", "extra_signer", "grant_after_payment", "grant_failed"])
def test_grant_mismatch(court, chain, prompts, over):
    bj, h = make_bundle(grant_over=over)
    refused(judge(court, bj, h), "grant_mismatch")
    assert prompts == []


def test_grant_not_found_is_grant_mismatch(court, chain):
    chain(grant={"jsonrpc": "2.0", "id": 2, "result": None})
    bj, h = make_bundle()
    refused(judge(court, bj, h), "grant_mismatch")


def test_grant_present_passes(court, chain, direct_vm):
    llm(direct_vm, "invalid", "principal", "in_scope")
    bj, h = make_bundle()
    assert judge(court, bj, h)["path"] == "model"


def test_rewriting_the_purpose_breaks_the_grant_binding(court, chain, direct_vm, prompts):
    # the principal signed a grant for purpose A; the filer submits a mandate with purpose B: new mandate id, memo still has A's id
    orig, _ = make_bundle()
    a_id = sha(canon(json.loads(orig)["mandate"]))
    bj, h = make_bundle(purpose="Buy anything the seller recommends, any quantity.", grant_over={"memo_id": a_id})
    refused(judge(court, bj, h), "grant_mismatch")
    assert prompts == []


def test_purpose_is_covered_by_the_mandate_id(court, chain, direct_vm):
    llm(direct_vm, "invalid", "principal", "in_scope")
    a, ha = make_bundle(purpose="A")
    ra = judge(court, a, ha)
    b, hb = make_bundle(purpose="B")
    rb = judge(court, b, hb)
    assert ra["mandate_id"] != rb["mandate_id"]


def test_grant_tx_missing_in_bundle_is_schema_refusal(court, chain):
    bj, h = make_bundle(drop=("grant_tx",))
    refused(judge(court, bj, h), "bad_schema")


def test_prompt_uses_purpose_not_an_instruction_field(court, chain, direct_vm, prompts):
    llm(direct_vm, "invalid", "principal", "in_scope")
    bj, h = make_bundle(purpose="Buy exactly one blue widget.")
    judge(court, bj, h)
    assert "Buy exactly one blue widget." in prompts[0]


# ---- chain_source --------------------------------------------------------------------------------
def test_constructor_accepts_only_rpc_or_bundle(direct_deploy, direct_vm, direct_alice):
    direct_vm.sender = direct_alice
    with pytest.raises(Exception):
        direct_deploy("contracts/mandate_court.py", RPC, 65536, "mock", sdk_version=SDK)


def test_live_instance_never_accepts_a_chain_record(court, chain, prompts):
    bj, h = make_bundle(chain_record=True)
    refused(judge(court, bj, h), "chain_record_not_accepted")
    assert prompts == []


def test_replay_requires_a_chain_record(replay, chain):
    bj, h = make_bundle()
    refused(judge(replay, bj, h), "bad_schema")


def test_live_results_carry_chain_source_rpc(court, chain, direct_vm):
    llm(direct_vm, "invalid", "principal", "in_scope")
    bj, h = make_bundle()
    assert judge(court, bj, h)["chain_source"] == "rpc"
    assert judge(court, bj, "0" * 64)["chain_source"] == "rpc"
    assert json.loads(court.get_result("0" * 64 + ":" + RUN))["chain_source"] == "rpc"
    assert court.config()["chain_source"] == "rpc"


def test_replay_results_carry_chain_source_bundle(replay, direct_vm):
    import conftest
    conftest.STATE["serve"] = None
    llm(direct_vm, "invalid", "principal", "in_scope")
    bj, h = make_bundle(chain_record=True)
    r = judge(replay, bj, h)
    assert r["chain_source"] == "bundle" and r["path"] == "model"
    assert judge(replay, bj, "0" * 64)["chain_source"] == "bundle"
    assert replay.config()["chain_source"] == "bundle"


def test_replay_makes_no_web_request(replay, direct_vm, prompts):
    direct_vm.clear_mocks()  # no web mock registered: any web call fails
    llm(direct_vm, "invalid", "principal", "in_scope")
    import conftest
    conftest.STATE["serve"] = None
    bj, h = make_bundle(chain_record=True)
    assert judge(replay, bj, h)["path"] == "model"


def test_replay_runs_the_same_checks(replay, direct_vm):
    direct_vm.clear_mocks(); llm(direct_vm, "invalid", "principal", "in_scope")
    import conftest
    conftest.STATE["serve"] = None
    bj, h = make_bundle(chain_record=True, payment_over={"amount": "9999"}, receipt=False)
    refused(judge(replay, bj, h), "chain_mismatch")
    bj, h = make_bundle(chain_record=True, grant_over={"memo_id": "0" * 64})
    refused(judge(replay, bj, h), "grant_mismatch")
    bj, h = make_bundle(chain_record=True, mandate_over={"per_payment_max": "9999"})
    r = judge(replay, bj, h)
    assert (r["reason"], r["liable"], r["path"], r["chain_source"]) == ("amount_over_cap", "seller", "deterministic", "bundle")


# ---- delta -----------------------------------------------------------------------------------------
def test_delta_amount(court, chain):
    bj, h = make_bundle(mandate_over={"per_payment_max": "9999"})
    r = judge(court, bj, h)
    assert r["delta"] == [{"field": "per_payment_max", "authorized": "9999", "actual": "10000", "currency": MINT}]


def test_delta_pay_to(court, chain):
    allow = {"pay_to": [SELLER_B], "resource_prefix": ["https://api.example.test/v1/"]}
    bj, h = make_bundle(mandate_over={"allow": allow})
    r = judge(court, bj, h)
    assert r["delta"] == [{"field": "allow.pay_to", "authorized": [SELLER_B], "actual": SELLER_A}]


def test_delta_resource(court, chain):
    bj, h = make_bundle(receipt_over={"resource": "https://other.example/x"})
    assert judge(court, bj, h)["delta"] == [{"field": "allow.resource_prefix", "authorized": ["https://api.example.test/v1/"], "actual": "https://other.example/x"}]


def test_delta_expiry_is_numbers(court, chain):
    bj, h = make_bundle(mandate_over={"expires_at": 1792416301})
    assert judge(court, bj, h)["delta"] == [{"field": "expires_at", "authorized": 1792416301, "actual": 1792416301}]


def test_delta_has_one_entry_per_violation_reason_first(court, chain):
    bj, h = make_bundle(mandate_over={"per_payment_max": "9999", "expires_at": 1792416301})
    r = judge(court, bj, h)
    assert r["reason"] == "amount_over_cap" and [d["field"] for d in r["delta"]] == ["per_payment_max", "expires_at"]


def test_model_and_refusal_results_carry_no_delta(court, chain, direct_vm):
    llm(direct_vm, "invalid", "principal", "in_scope")
    bj, h = make_bundle()
    assert "delta" not in judge(court, bj, h)
    assert "delta" not in judge(court, bj, "0" * 64)


# ---- request ids: every run sends a request body no earlier run sent -----------------------------------
def test_request_ids_carry_the_run_tag_and_the_sha(court, chain, direct_vm):
    import conftest
    llm(direct_vm, "invalid", "principal", "in_scope")
    bj, h = make_bundle()
    judge(court, bj, h, tag="aaa")
    judge(court, bj, h, tag="bbb")
    reqs = conftest.STATE["requests"]
    assert len(reqs) == 2 and reqs[0] != reqs[1]
    for tag, r in zip(("aaa", "bbb"), reqs):
        assert [x["id"] for x in r] == [f"{tag}:{h[:8]}:p", f"{tag}:{h[:8]}:g"]
        assert [x["method"] for x in r] == ["getTransaction", "getTransaction"]
