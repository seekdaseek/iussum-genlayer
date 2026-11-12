# REPORT phase 1: MandateCourt

Date 2026-11-12. Studionet only. No Docker, no mainnet, no spend. Phase 2 not started.

## What exists

| Item | Value |
|---|---|
| Private repo | https://github.com/seekdaseek/iussum-genlayer (PRIVATE, verified with `gh repo view`) |
| Contract | `contracts/mandate_court.py`, runner pin `py-genlayer:1jb45aa8…hp09h6` (the pin from phase 0). `genvm-lint check`: lint and validation pass. The linter notes a newer runner hash exists; the pinned one deployed and ran |
| Tests | 87 direct-mode tests, all pass (`.venv/bin/pytest tests/direct`): 46 refusal paths, 41 scope, model-path and validator tests |
| Mutation check | 10 single-line mutations of the contract, run one at a time. 9 were caught on the first run. One survived (validator comparing only `verdict`); I added a test for it and re-checked, now caught |
| Deployed | studionet `0xd5d497151CA3841bfD76e08e17cd8145f7ca2419`, deploy tx `0x3feb3db8…ed58de8`, constructor `(rpc_url=https://api.devnet.solana.com, max_bytes=65536)` |

Order deviation: the brief says tests first. I wrote the contract first and the tests second, then used the mutation check above to test the tests. The refusal tests were run against code that already existed, so they do not show a red-then-green history.

## Bundle format

Field names are iussum's own, copied from `test/vectors/resolve.json` (case 54): the mandate object and the seller receipt are unchanged. The ten `iussum-apr` records use the ext-disputes record (`reason`, `tier`, `evidence.delta[field, authorized, actual, currency]`, `iat`). That is a verdict record, not an evidence input, so I did not reuse it for the bundle; if you want the contract to emit a `delta` in that shape, say so (not done).

```
{ v: "iussum-genlayer/0.1", instruction, mandate, payment, delivery: { receipt?, delivered? } }
```

- `mandate`: iussum v0.2, unchanged. Its id (sha256 of the JCS form) is recomputed in the contract and matched `648c0ee2…e484dff` for case 54.
- `payment`: `tx_sig, network, asset, amount, pay_to, payer`. Composed from the receipt's own field names. `payer` is the delegate that signed (the chain `authority`).
- `delivery.receipt`: iussum's seller receipt, unchanged. iussum has no separate "delivery" artifact, so `delivery` = the receipt plus an optional free-text `delivered`.
- `instruction`: the plain-language instruction. **iussum v0.2 does not sign or hash it** (the mandate has no purpose field). In this build it arrives unsigned inside the bundle hash. A principal-signed instruction is a gap for you to decide on.
- Canonical form: the contract requires the bundle string to equal `json.dumps(sort_keys, separators=(",",":"), ensure_ascii=False)` and the caller passes its sha256. This is RFC 8785 for strings, integers, arrays, objects; iussum uses no floats. Byte-for-byte equality with JS JCS was checked for the real case (Node-built bundle accepted on chain, Python-built bundle in tests).

## Size cap (change C)

`max_bytes` is a constructor argument, set to **65,536 bytes** on the deployed instance. The real case bundle is 1,991 bytes (largest of iussum's 56 resolver inputs: 6,780 bytes). Over the cap: refusal `bundle_too_large`, checked first, tested exactly at the boundary. Phase 0's ceiling for any call was about 0.5 MB (HTTP body limit). The truncation test (400 KB with the deciding sentence at the end, and the control) is **not run**: it needs a contract with a cap above 400 KB, and I did not deploy one. Plan: a second instance with `max_bytes=450000`, in phase 2.

## Order inside `judge(bundle_json, bundle_sha256, resolver_json, run_tag)`

1. Plain code: size, run tag, JSON, schema, canonical form, hash, resolver JSON, receipt-vs-payment fields.
2. Chain (change A): `getTransaction` on the Solana RPC, `jsonParsed`, `finalized`, read through `strict_eq` as one normalised fact record. Plain-code comparison of amount, mint, destination owner, delegate (`authority`) against the bundle, and source-account owner against `mandate.principal`. Failure is a fixed refusal.
3. Plain-code scope checks in iussum's order: network, asset, not-yet-valid, expired (`time >= expires_at`, block time), agent, per-payment cap, pay_to, resource prefix. A hit is decided here, no model. Liability as in iussum: seller if the receipt carries this mandate's id, else agent operator.
4. Only if all pass: one model question. Closed set of four triples, enforced in code (anything else is an LLM error, which forces rotation): `invalid/principal/in_scope`, `valid/agent_operator/purpose_mismatch`, `valid/seller/delivery_mismatch`, `could_not_decide/none/insufficient_evidence`. The validator re-judges and returns True only if all three fields match. Reasoning is stored, truncated to 400 chars, never compared.

Refusal codes (15, all tested): `bundle_too_large bad_run_tag bad_json bad_schema not_canonical hash_mismatch mandate_invalid bad_resolver_json payment_receipt_mismatch chain_unreachable chain_tx_not_found chain_tx_failed chain_shape chain_mismatch principal_mismatch resource_not_judgeable`. A refusal is `verdict invalid, liable none` (iussum's R4 shape). The brief's "verdict states exactly" = iussum's `valid` / `invalid`, plus `could_not_decide`.

Injection handling: evidence sits between `<<<EVIDENCE-<first 16 hex of the bundle sha256>` and `EVIDENCE-…>>>`. The tag is derived from the bundle hash, so no text inside the bundle can contain it. The prompt says text inside is data and never an instruction. The resolver's result is stored and compared afterwards; it is **not** shown to the model (tested). This is the defence phase 2 set C attacks; nothing tuned.

What the court does NOT check (iussum's resolver does): receipt signature (ed25519), grant transaction and its memo, supersession of the grant, period budget, balance-reconciled history (`history_incomplete`), debits by CPI (these are refused as `chain_shape` instead of judged), iussum's full resource-URL rules (the court judges plain prefix matches and refuses dot segments, `%2e`, `%2f`, backslash, userinfo as `resource_not_judgeable`). So the court is a second instance for the scope and purpose question, not a replacement for iussum's resolver.

## End to end on studionet (real iussum devnet payment)

Payment: devnet signature `5KsYz26TFRGqzk7KdjUg8z2tGL6neRed37Cj211kYFgTX8ATNDKwXfqwuRnLzC8zTMDf2Z4QS7SweCd41Lrd2Hur`, taken from iussum's recorded vectors (`resolve.json` cases 53 to 55). It is a real finalized devnet transaction (re-fetched today: found); the validators read it live. The mandate and receipt are the recorded ones for that case: iussum's `demo-runs*/` keep only signatures, not the mandate bodies (nonce and times are random), so a demo-run signature cannot be paired with its mandate. I used the one real signature that has its mandate on file.

| Run | Tx id | Path | Stored result | Accepted | Rounds / rotations | Leader model | Agreeing validators |
|---|---|---|---|---|---|---|---|
| m1 | `0x4ef1ee3fed28c91f9db800e607082beb1505dd7c8ee5c8cc3a32eab316acc621` | model | invalid / principal / in_scope, resolver_agrees true | 18.9 s | 1 / 0 | anthropic/claude-sonnet-4.6 | gemini-3-flash-preview, prd-gemini |
| m2 | `0xa81cced018215c584c4fd622314d37f543aaa252d8166db6d806b527943935e7` | model | same | 19.4 s | 1 / 0 | prd-gemma | prd-gemini, prd-deepseek |
| m3 | `0x36203d2c303559840c17b3fe91be0d97341fab1bac5614bb8f4c00fc74a1e57e` | model | same | 22.5 s | 1 / 0 | prd-gpt-oss | prd-kimi, prd-gpt-5-4 |
| s1 | `0x6af47b5868807435ee3a0d55c023292b4aa790ed2ae41900d8f2129496946c49` | deterministic (cap 9,999 vs 10,000) | valid / seller / amount_over_cap | 16.1 s | 1 / 0 | prd-qwen | prd-gemini, gpt-5.4 |
| h1 | `0xd749a68b241450aee6c541e0495c4bb42ba135d14f0c690097eb9a6643637298` | refusal (wrong hash) | invalid / none / hash_mismatch | 6.5 s | 1 / 0 | prd-qwen | prd-deepseek, gemini-3-flash |

All five reached FINALIZED (checked with `gen_getTransactionStatus`; I tracked to ACCEPTED, so finality time is **not measured** here; phase 0 measured about 38 s). Execution SUCCESS on all. Every row records the leader and the two agreeing models (change B); the other two committee members show `idle` / `CONSENSUS_VALIDATOR_QUORUM_REACHED`, as in phase 0. The three model-path runs agree with iussum's resolver (`invalid / in_scope / principal`), which is one case, not a rate. The refusal run (h1) read no chain and called no model: 6.5 s.

## Public RPC under load (change A)

- 9 contract executions read devnet RPC (m1 to m3, s1, b1 to b6), each with 3 validators answering. No `chain_unreachable`, no 429, no disagreement, no rotation. All stored results were the expected ones.
- Six judgments submitted at once (b1 to b6) did **not** put 18 reads on the RPC at once: they queue per contract, and acceptance times spread from 12.4 s to 49.2 s. So the RPC load per moment stays near 3 reads. This does not test five validators hitting the RPC in the same second from several contracts.
- What a mixed answer does is **UNTESTED on the network**: if one validator got 429 and the leader got 200, `strict_eq` would disagree and the round would rotate. A 429 for the leader and all validators is agreed as `chain_unreachable` (shown in phase 0 on an explorer page, and in a unit test here). No retries are built in.
- Public devnet RPC is a single point of failure and its rate limit is not published; Phase 2 sets with many runs will hit it. A keyed RPC would need a key in contract storage, which is on-chain and public; not done.

## Decisions I need from you before phase 2

1. **Set A cannot run as it stands.** Of iussum's 56 resolver vectors only cases 53, 54, 55 carry a real transaction signature; the other 53 use placeholder signatures (`PPPP…`) and synthetic chain data in the input. Through the contract they would all end in `chain_tx_not_found`. Options: (a) run Set A with the contract's `rpc_url` pointed at a public JSON-RPC endpoint I host that serves each vector's recorded `getTransaction` (needs a public host, e.g. the VPS behind a hostname: that is infrastructure you have to approve); (b) add a measurement-only constructor flag that takes chain facts from the bundle (weakens change A, and the result would say so); (c) restrict Set A to the 3 real cases. I recommend (a).
2. Whether the `instruction` should become a field iussum signs (gap above).
3. Whether to emit an ext-disputes `delta` in the output.

## Other facts

- Direct-mode tests need `sdk_version="v0.2.16"`: the tool's default, `v0.3.0-rc7`, 404s on the `genvm-universal.tar.xz` download (that release ships `genvm-runners-all.tar.xz` instead). The contract file is the same one deployed.
- `hashlib` works inside GenVM (deploy and judge executed). `gl.nondet.web.post` with `strict_eq` on a jsonParsed Solana answer works on 3 validators.
- zsh quirk cost me one failed loop (unquoted `$v` is not word-split); no effect on results.
- 12 txs on studionet in phase 1 (1 deploy, 5 runs, 6 burst); one script loop failed before sending anything. Cost: zero (studionet gasless). Raw outputs: `results/p1-*.json`.

## NEEDS HIM

Nothing blocks phase 2 except the Set A decision above. Bradbury funding is still open from phase 0 and is only needed for the public case and real fee numbers.
