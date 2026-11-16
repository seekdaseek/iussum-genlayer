import base64, hashlib, json, pathlib
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from cryptography.hazmat.primitives import serialization

SDK = "v0.2.16"
RPC_SOL = "https://api.mainnet-beta.solana.com"
RPC_BASE = "https://mainnet.base.org"
STATUS_URL = "https://x402.ochinimus.app/api/status"
HOST = "https://x402.ochinimus.app"
PAYTO_SOL = "4a8o45skRPcyjAdyR8yES215Swvh8uTpZD6KLarhxCJ7"
PAYTO_BASE = "0x22db3a9686ee5261e7bf3ed4f91277232e8076e6"
USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDC_BASE = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
PAYER_SOL = "Gack9UtqfeZxFA1LqeqjLgC3JGuD7rS6CsSHKoXsD4Tu"
PAYER_BASE = "0x82cef1cdc34d65cf690235dc24e823a6585a6f86"
SIG_SOL = "S" * 88
SIG_BASE = "0x" + "ab" * 32
BLOCK_TIME = 1794575116
B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
BUNDLE_V = "iussum-sla/0.1"
RECEIPT_V = "iussum-sla/0.1"


def b58encode(b: bytes) -> str:
    n = int.from_bytes(b, "big"); out = ""
    while n:
        n, r = divmod(n, 58); out = B58[r] + out
    return "1" * (len(b) - len(b.lstrip(b"\0"))) + out


def _key(seed_byte):
    k = Ed25519PrivateKey.from_private_bytes(bytes([seed_byte]) * 32)
    return k, b58encode(k.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw))


SELLER_KEY, SELLER_PUB = _key(11)
OTHER_KEY, OTHER_PUB = _key(12)


def canon(o):
    return json.dumps(o, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def sign_receipt(body, key=SELLER_KEY):
    b = {k: v for k, v in body.items() if k != "signature"}
    return {**b, "signature": base64.b64encode(key.sign(("iussum-sla/0.1 receipt\n" + canon(b)).encode())).decode()}


def price_body(symbol="SOL", price=107.06, publish_time=None, tool="get_sol_price", extra=None):
    d = {"symbol": symbol, "price": price, "confidence": None, "publish_time": publish_time, "source": "on-chain DEX mid"}
    d.update(extra or {})
    return {"tool": tool, "data": d, "paid": True}


def funding_body(symbol="ETHUSDT", next_ms=None, venues=True):
    d = {"symbol": symbol, "note": "n", "source": "s"}
    if venues:
        d["venues"] = {"hyperliquid": {"funding_rate_raw": 0.0000125, "next_funding_time": next_ms}}
    return {"tool": "get_funding_rate", "data": d, "paid": True}


def sol_doc(amount="1000", mint=USDC_SOL, dest=PAYTO_SOL, authority=PAYER_SOL, block_time=BLOCK_TIME, err=None, extra_move=False):
    ix = {"program": "spl-token", "parsed": {"type": "transferChecked", "info": {"authority": authority, "destination": "DST", "source": "SRC", "mint": mint,
          "tokenAmount": {"amount": amount, "decimals": 6}}}}
    ixs = [ix] + ([ix] if extra_move else [])
    return {"jsonrpc": "2.0", "id": "x", "result": {"slot": 5, "blockTime": block_time, "meta": {"err": err, "innerInstructions": [],
            "preTokenBalances": [{"accountIndex": 1, "owner": authority}], "postTokenBalances": [{"accountIndex": 1, "owner": authority}, {"accountIndex": 2, "owner": dest}]},
            "transaction": {"message": {"accountKeys": [{"pubkey": authority}, {"pubkey": "SRC"}, {"pubkey": "DST"}], "instructions": ixs}}}}


def _t(addr):
    return "0x" + addr[2:].rjust(64, "0")


def base_docs(amount=1000, to=PAYTO_BASE, frm=PAYER_BASE, token=USDC_BASE, status="0x1", ts=BLOCK_TIME, transfers=1):
    log = {"address": token, "topics": ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef", _t(frm), _t(to)], "data": hex(amount)}
    auth = {"address": token, "topics": ["0x98de503528ee59b575ef0c0a2576a82497bfc029a5685b209e9ec333479b10a5", _t(frm), "0x" + "0d" * 32], "data": "0x"}
    rec = {"jsonrpc": "2.0", "id": "x", "result": {"status": status, "blockNumber": "0x10", "logs": [auth] + [log] * transfers}}
    blk = {"jsonrpc": "2.0", "id": "x", "result": {"number": "0x10", "timestamp": hex(ts)}}
    return rec, blk


STATE = {"requests": [], "status_calls": 0}


def make_case(tool="get_sol_price", network="solana", body=None, served_delta=3, http_status=200, resource=None, complaint="the price was wrong, refund me",
              receipt=True, receipt_over=None, signer=None, payment_over=None, body_text=None, drop_body_hash=False, chain=None, query=""):
    bt = BLOCK_TIME
    served = bt + served_delta
    if body is None:
        body = price_body(publish_time=served - 20) if tool == "get_sol_price" else price_body("BTC", 80000.0, served - 20, "get_btc_price")
    text = body_text if body_text is not None else json.dumps(body, separators=(",", ":"))
    path = {"get_sol_price": "/api/sol-price", "get_btc_price": "/api/btc-price", "get_funding_rate": "/api/funding-rate"}.get(tool, "/api/other")
    sig = SIG_SOL if network == "solana" else SIG_BASE
    pay = {"tx_sig": sig, "network": network, "asset": USDC_SOL if network == "solana" else USDC_BASE, "amount": "1000" if tool != "get_funding_rate" else "5000",
           "pay_to": PAYTO_SOL if network == "solana" else PAYTO_BASE, "payer": PAYER_SOL if network == "solana" else PAYER_BASE}
    pay.update(payment_over or {})
    d = {"body": text}
    if receipt:
        r = {"v": RECEIPT_V, "seller": SELLER_PUB, "tx_sig": sig, "tool": tool, "resource": resource or (HOST + path + query), "http_status": http_status,
             "served_at": served, "body_sha256": sha(text)}
        r.update(receipt_over or {})
        if drop_body_hash:
            r.pop("body_sha256")
        d["receipt"] = sign_receipt(r, signer or SELLER_KEY)
    b = {"v": BUNDLE_V, "tool": tool, "payment": pay, "delivery": d}
    if complaint is not None:
        b["complaint"] = complaint
    s = canon(b)
    STATE["chain"] = chain if chain is not None else ({"sol": sol_doc(amount=pay["amount"])} if network == "solana" else {"base": base_docs(amount=int(pay["amount"]))})
    return s, sha(s)


@pytest.fixture
def court(direct_vm, direct_deploy, direct_alice):
    direct_vm.sender = direct_alice
    return direct_deploy("contracts/sla_court.py", RPC_SOL, RPC_BASE, STATUS_URL, 65536, SELLER_PUB, PAYTO_SOL, PAYTO_BASE, sdk_version=SDK)


@pytest.fixture
def chain(direct_vm, monkeypatch):
    """Serves the docs make_case prepared. Records every request body. One JSON-RPC object per POST, never a batch."""
    from gltest.direct import wasi_mock
    STATE["requests"] = []
    STATE["status_calls"] = 0
    ov = {"status": 200, "none": False, "status_doc": {"ok": True, "problems": []}, "status_status": 200}

    def handler(vm, data):
        url, method = data.get("url", ""), data.get("method", "GET")
        if url == STATUS_URL:
            STATE["status_calls"] += 1
            return {"ok": {"response": {"status": ov["status_status"], "headers": {}, "body": json.dumps(ov["status_doc"]).encode()}}}
        body = data.get("body")
        req = json.loads(body.decode() if isinstance(body, (bytes, bytearray)) else body)
        assert isinstance(req, dict), "one JSON-RPC request per POST, never a batch"
        STATE["requests"].append((url, req))
        c = STATE["chain"]
        if ov["none"]:
            doc = {"jsonrpc": "2.0", "id": req["id"], "result": None}
        elif req["method"] == "getTransaction":
            doc = dict(c["sol"], id=req["id"])
        elif req["method"] == "eth_getTransactionReceipt":
            doc = dict(c["base"][0], id=req["id"])
        else:
            doc = dict(c["base"][1], id=req["id"])
        return {"ok": {"response": {"status": ov["status"], "headers": {}, "body": json.dumps(doc).encode()}}}

    monkeypatch.setattr(wasi_mock, "_handle_web_request", handler)
    return ov


@pytest.fixture
def prompts(direct_vm, monkeypatch):
    seen = []
    orig = direct_vm._match_llm_mock

    def spy(prompt):
        seen.append(prompt)
        return orig(prompt)

    monkeypatch.setattr(direct_vm, "_match_llm_mock", spy)
    return seen


def llm(direct_vm, verdict, reason, reasoning="ok"):
    direct_vm.mock_llm(r".*", json.dumps({"verdict": verdict, "reason": reason, "reasoning": reasoning}))
