import copy, hashlib, json, pathlib
import pytest

FX = pathlib.Path(__file__).resolve().parents[1] / "fixtures"
RPC = "https://api.devnet.solana.com"
SCHEMA = "iussum-genlayer/0.1"


def canon(o):
    return json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def _case():
    return json.load(open(FX / "iussum-resolve-case54.json"))["input"]


def make_bundle(mandate_over=None, receipt=True, receipt_over=None, payment_over=None,
                instruction="Buy one 10-call data quote for the BTC price feed from api.example.test.",
                delivered="quote delivered: BTC price feed, 10 calls", presented=True):
    """The real iussum devnet payment 5KsYz26T... with a mandate that allows it. Returns (bundle_json, sha)."""
    c = _case()
    m = copy.deepcopy(c["mandate"])
    m.update(mandate_over or {})
    mid = sha(canon(m))
    p = {"tx_sig": c["tx_sig"], "network": m["network"], "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
         "amount": "10000", "pay_to": "5hQASoTWuCSjSz3GfUmrVDfUKEvRMDLpqUK1wuUi5Gk7", "payer": "4ZUJeT13Kqtv9H6G64QLe5a5EUar2L927nBcYavTPmSi"}  # the real delegate that signed
    p.update(payment_over or {})
    d = {}
    if receipt:
        r = copy.deepcopy(c["receipt"])
        r["mandate_id"] = mid if presented else "0" * 64
        r.update(receipt_over or {})
        d["receipt"] = r
    if delivered is not None:
        d["delivered"] = delivered
    b = {"v": SCHEMA, "instruction": instruction, "mandate": m, "payment": p, "delivery": d}
    s = canon(b)
    return s, sha(s)


def chain_json():
    return json.load(open(FX / "payment-5KsYz26T.json"))


@pytest.fixture
def court(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    return direct_deploy("contracts/mandate_court.py", RPC, 65536, sdk_version="v0.2.16")


@pytest.fixture
def chain(direct_vm):
    """Serve the recorded devnet getTransaction answer."""
    def serve(doc=None, status=200):
        direct_vm.clear_mocks()
        body = json.dumps(chain_json() if doc is None else doc).encode()
        direct_vm.mock_web(r"api\.devnet\.solana\.com", {"response": {"status": status, "headers": {}, "body": body}, "method": "POST"})
    serve()
    return serve


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
