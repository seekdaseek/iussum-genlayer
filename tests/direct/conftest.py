import copy, hashlib, json, pathlib
import pytest

FX = pathlib.Path(__file__).resolve().parents[1] / "fixtures"
RPC = "https://api.devnet.solana.com"
BUNDLE_V = "iussum-genlayer/0.2"
MANDATE_V = "iussum/0.3"
SDK = "v0.2.16"
PURPOSE = "Buy one 10-call data quote for the BTC price feed from api.example.test."
PRINCIPAL = "BSC8EyZJr19cqzYw3e7UnoDjsNJS4RGiE8rdoo4pJgiU"
AGENT = "4ZUJeT13Kqtv9H6G64QLe5a5EUar2L927nBcYavTPmSi"
MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
SELLER_A = "5hQASoTWuCSjSz3GfUmrVDfUKEvRMDLpqUK1wuUi5Gk7"
SELLER_B = "2uh7t2wh3omQNzzRypGj1rVJhtmJ6HtR4qFy9f2aNbg9"
GRANT_SIG = "G" * 88


def canon(o):
    return json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def _case():
    return json.load(open(FX / "iussum-resolve-case54.json"))["input"]


def pay_doc():
    return json.load(open(FX / "payment-5KsYz26T.json"))


def grant_doc(mandate, memo_id=None, **over):
    """A jsonParsed getTransaction answer for a v0.3 grant: ApproveChecked + Memo, principal the only signer."""
    mid = memo_id or sha(canon(mandate))
    memo = f"iussum v0.3 | agent {mandate['agent']} | asset {mandate['asset']} | total {mandate['total_cap']} | id {mid}"
    ixs = [
        {"program": "spl-token", "programId": "Tokenkeg", "parsed": {"type": "approveChecked", "info": {
            "delegate": over.get("delegate", mandate["agent"]), "mint": over.get("mint", mandate["asset"]),
            "owner": over.get("owner", mandate["principal"]), "source": "SRC",
            "tokenAmount": {"amount": over.get("amount", mandate["total_cap"]), "decimals": 6}}}},
        {"program": "spl-memo", "programId": "Memo", "parsed": over.get("memo", memo)},
    ]
    if over.get("two_memos"):
        ixs.append(copy.deepcopy(ixs[1]))
    signers = over.get("signers", [mandate["principal"]])
    keys = [{"pubkey": k, "signer": True, "writable": True} for k in signers] + [{"pubkey": "SRC", "signer": False, "writable": True}]
    return {"jsonrpc": "2.0", "id": 2, "result": {"slot": over.get("slot", 512000000), "blockTime": 1792415400, "meta": {"err": over.get("err"), "innerInstructions": []},
            "transaction": {"message": {"accountKeys": keys, "instructions": ixs}}}}


def make_bundle(mandate_over=None, receipt=True, receipt_over=None, payment_over=None, purpose=PURPOSE,
                delivered="quote delivered: BTC price feed, 10 calls", presented=True, grant_over=None,
                grant_tx=GRANT_SIG, pay=None, grant=None, chain_record=False, drop=()):
    """The real iussum devnet payment 5KsYz26T... with a v0.3 mandate that allows it. Returns (bundle_json, sha)."""
    c = _case()
    m = copy.deepcopy(c["mandate"])
    m["v"] = MANDATE_V
    m["purpose"] = purpose
    m.update(mandate_over or {})
    mid = sha(canon(m))
    p = {"tx_sig": c["tx_sig"], "network": m["network"], "asset": MINT, "amount": "10000", "pay_to": SELLER_A, "payer": AGENT}
    p.update(payment_over or {})
    d = {}
    if receipt:
        r = copy.deepcopy(c["receipt"])
        r["mandate_id"] = mid if presented else "0" * 64
        r.update(receipt_over or {})
        d["receipt"] = r
    if delivered is not None:
        d["delivered"] = delivered
    b = {"v": BUNDLE_V, "mandate": m, "grant_tx": grant_tx, "payment": p, "delivery": d}
    pd = pay if pay is not None else pay_doc()
    gd = grant if grant is not None else grant_doc(m, **(grant_over or {}))
    if chain_record:
        b["chain_record"] = {"payment": pd, "grant": gd}
    for k in drop:
        b.pop(k, None)
    s = canon(b)
    STATE["mid"], STATE["m"] = mid, m
    if STATE["serve"]:
        STATE["serve"](pd, gd)
    return s, sha(s)


STATE = {"serve": None, "mid": None, "m": None, "pay": None, "status": 200, "vm": None}


@pytest.fixture
def court(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    return direct_deploy("contracts/mandate_court.py", RPC, 65536, "rpc", sdk_version=SDK)


@pytest.fixture
def replay(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    return direct_deploy("contracts/mandate_court.py", RPC, 65536, "bundle", sdk_version=SDK)


@pytest.fixture
def chain(direct_vm, monkeypatch):
    """Serves one batch answer [payment, grant], echoing the request ids. chain(pay_doc, status=...) overrides the payment
    answer; chain(grant=doc) the grant answer; the default grant matches the latest make_bundle mandate.
    STATE["requests"] collects every request body the contract sent."""
    from gltest.direct import wasi_mock
    ov = {"pay": None, "grant": None, "status": 200}
    docs = {}
    STATE["requests"] = []

    def handler(vm, data):
        body = data.get("body")
        req = json.loads(body.decode() if isinstance(body, (bytes, bytearray)) else body)
        assert isinstance(req, dict), "one JSON-RPC request per POST, never a batch"
        STATE["requests"].append(req)
        is_grant = req["params"][0] == GRANT_SIG
        doc = (ov["grant"] if ov["grant"] is not None else docs["grant"]) if is_grant else (ov["pay"] if ov["pay"] is not None else docs["pay"])
        return {"ok": {"response": {"status": ov["status"], "headers": {}, "body": json.dumps(dict(doc, id=req["id"])).encode()}}}

    monkeypatch.setattr(wasi_mock, "_handle_web_request", handler)

    def serve(pd, gd):
        docs["pay"], docs["grant"] = pd, gd

    STATE["serve"] = serve
    STATE["mid"] = None

    def override(pay=None, status=200, grant=None):
        ov["pay"], ov["status"], ov["grant"] = pay, status, grant
        if STATE["m"] is not None:
            serve(pay_doc(), grant_doc(STATE["m"]))

    yield override
    STATE["serve"] = None


@pytest.fixture
def prompts(direct_vm, monkeypatch):
    seen = []
    orig = direct_vm._match_llm_mock

    def spy(prompt):
        seen.append(prompt)
        return orig(prompt)

    monkeypatch.setattr(direct_vm, "_match_llm_mock", spy)
    return seen


def llm(direct_vm, verdict, liable, reason, reasoning="ok"):
    direct_vm.mock_llm(r".*", json.dumps({"verdict": verdict, "liable": liable, "reason": reason, "reasoning": reasoning}))
