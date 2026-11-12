"""Every refusal path. A refusal is verdict invalid, liable none, reason <code>, path refusal, and the model is never asked."""
import json
import pytest
from conftest import make_bundle, canon, sha, pay_doc, SDK

RUN = "t1"


def judge(court, bj, h, resolver="", tag=RUN):
    return json.loads(court.judge(bj, h, resolver, tag))


def refused(r, code):
    assert (r["verdict"], r["liable"], r["reason"], r["path"]) == ("invalid", "none", code, "refusal"), r


@pytest.fixture(autouse=True)
def no_model(prompts):
    yield
    assert prompts == [], "a refusal must never reach a model"


def test_too_large(court, chain):
    bj, h = make_bundle(delivered="x" * 70000)
    refused(judge(court, bj, h), "bundle_too_large")


def test_size_cap_is_exact(direct_vm, direct_deploy, chain, direct_alice):
    bj, h = make_bundle()
    n = len(bj.encode())
    ok = direct_deploy("contracts/mandate_court.py", "https://api.devnet.solana.com", n - 1, "rpc", sdk_version=SDK)
    refused(json.loads(ok.judge(bj, h, "", RUN)), "bundle_too_large")


@pytest.mark.parametrize("tag", ["", "a b", "x" * 33, "tag/../x", "é"])
def test_bad_run_tag(court, chain, tag):
    bj, h = make_bundle()
    refused(judge(court, bj, h, tag=tag), "bad_run_tag")


def test_bad_json(court, chain):
    refused(judge(court, "{not json", sha("{not json")), "bad_json")


@pytest.mark.parametrize("mut", [
    lambda b: b.pop("grant_tx"),
    lambda b: b.update(grant_tx=""),
    lambda b: b.update(v="other/1"),
    lambda b: b.pop("payment"),
    lambda b: b["payment"].update(amount="01"),
    lambda b: b["payment"].update(amount=5),
    lambda b: b["delivery"].update(delivered=7),
    lambda b: b["delivery"]["receipt"].pop("seller"),
])
def test_bad_schema(court, chain, mut):
    bj, _ = make_bundle()
    b = json.loads(bj)
    mut(b)
    s = canon(b)
    refused(judge(court, s, sha(s)), "bad_schema")


@pytest.mark.parametrize("mut", [
    lambda m: m.update(not_before=m["expires_at"]),
    lambda m: m.update(per_payment_max="-1"),
    lambda m: m.update(not_before="1792415301"),
    lambda m: m["allow"].update(pay_to=[]),
    lambda m: m.pop("agent"),
    lambda m: m.pop("purpose"),
    lambda m: m.update(purpose=""),
    lambda m: m.update(purpose=5),
    lambda m: m.update(v="iussum/0.2"),
])
def test_mandate_invalid(court, chain, mut):
    bj, _ = make_bundle()
    b = json.loads(bj)
    mut(b["mandate"])
    s = canon(b)
    refused(judge(court, s, sha(s)), "mandate_invalid")


def test_not_canonical(court, chain):
    bj, _ = make_bundle()
    pretty = json.dumps(json.loads(bj), indent=2, sort_keys=True)
    refused(judge(court, pretty, sha(pretty)), "not_canonical")


def test_hash_mismatch(court, chain):
    bj, h = make_bundle()
    refused(judge(court, bj, "0" * 64), "hash_mismatch")
    refused(judge(court, bj, h.upper()), "hash_mismatch")


@pytest.mark.parametrize("rj", ["{bad", "[]", json.dumps({"verdict": 1, "reason": "x"})])
def test_bad_resolver_json(court, chain, rj):
    bj, h = make_bundle()
    refused(judge(court, bj, h, rj), "bad_resolver_json")


@pytest.mark.parametrize("over", [{"amount": "10001"}, {"tx_sig": "z" * 88}, {"payer": "X"}, {"pay_to": "X"}, {"asset": "X"}, {"network": "solana:other"}])
def test_payment_receipt_mismatch(court, chain, over):
    bj, h = make_bundle(receipt_over=over)
    refused(judge(court, bj, h), "payment_receipt_mismatch")


def test_chain_unreachable(court, chain):
    chain(status=429)
    bj, h = make_bundle()
    refused(judge(court, bj, h), "chain_unreachable")


def test_chain_tx_not_found(court, chain):
    chain({"jsonrpc": "2.0", "id": 1, "result": None})
    bj, h = make_bundle()
    refused(judge(court, bj, h), "chain_tx_not_found")


def test_chain_tx_failed(court, chain):
    d = pay_doc(); d["result"]["meta"]["err"] = {"InstructionError": [2, {"Custom": 1}]}
    chain(d)
    bj, h = make_bundle()
    refused(judge(court, bj, h), "chain_tx_failed")


def test_chain_shape_two_transfers(court, chain):
    d = pay_doc(); ixs = d["result"]["transaction"]["message"]["instructions"]
    ixs.append(next(i for i in ixs if i.get("parsed", {}).get("type") == "transferChecked"))
    chain(d)
    bj, h = make_bundle()
    refused(judge(court, bj, h), "chain_shape")


def test_chain_shape_cpi_transfer(court, chain):
    d = pay_doc(); ixs = d["result"]["transaction"]["message"]["instructions"]
    tc = next(i for i in ixs if i.get("parsed", {}).get("type") == "transferChecked")
    d["result"]["meta"]["innerInstructions"] = [{"index": 0, "instructions": [tc]}]
    chain(d)
    bj, h = make_bundle()
    refused(judge(court, bj, h), "chain_shape")


def test_chain_shape_plain_transfer_or_no_blocktime(court, chain):
    d = pay_doc(); d["result"]["blockTime"] = None
    chain(d)
    bj, h = make_bundle()
    refused(judge(court, bj, h), "chain_shape")


@pytest.mark.parametrize("over", [{"amount": "10000", "pay_to": "2uh7t2wh3omQNzzRypGj1rVJhtmJ6HtR4qFy9f2aNbg9"}, {"payer": "BSC8EyZJr19cqzYw3e7UnoDjsNJS4RGiE8rdoo4pJgiU"}])
def test_chain_mismatch(court, chain, over):
    bj, h = make_bundle(payment_over=over, receipt=False)
    refused(judge(court, bj, h), "chain_mismatch")


def test_chain_mismatch_amount(court, chain):
    bj, h = make_bundle(payment_over={"amount": "9999"}, receipt=False)
    refused(judge(court, bj, h), "chain_mismatch")


def test_principal_mismatch(court, chain):
    bj, h = make_bundle(mandate_over={"principal": "2uh7t2wh3omQNzzRypGj1rVJhtmJ6HtR4qFy9f2aNbg9"})
    refused(judge(court, bj, h), "principal_mismatch")


@pytest.mark.parametrize("res", ["https://api.example.test/v1/../admin", "https://api.example.test/v1/%2e%2e/x", "https://u:p@api.example.test/v1/q", "https://api.example.test\\v1/q"])
def test_resource_not_judgeable(court, chain, res):
    bj, h = make_bundle(receipt_over={"resource": res})
    refused(judge(court, bj, h), "resource_not_judgeable")


@pytest.mark.parametrize("status", [429, 500, 503])
def test_chain_unreachable_records_the_http_status(court, chain, status):
    chain(status=status)
    bj, h = make_bundle()
    r = judge(court, bj, h)
    refused(r, "chain_unreachable")
    assert r["http"] == status
