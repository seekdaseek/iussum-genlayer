# REPORT phase 1.5

Date 2026-11-12. Studionet and Solana devnet only. No mainnet. Devnet USDC spent: 0.08 (80,000 raw) of the demo principal's 4.35.

## What changed in the contract (tests first, every step committed red before green)

| Change | Where |
|---|---|
| Bundle `iussum-genlayer/0.2`. Mandate `iussum/0.3` = iussum v0.2 + `purpose`. The mandate id stays sha256 of the canonical form, so `purpose` is covered. `instruction` is gone, the prompt reads `mandate.purpose` | contract, tests |
| Grant check: the court reads `bundle.grant_tx` from RPC and requires one ApproveChecked and one Memo `iussum v0.3 \| … \| id <64 hex>`, memo id = mandate id, owner = principal, delegate = agent, mint = asset, amount = total_cap, principal the only signer, grant slot not after the payment slot. Anything else: refusal `grant_mismatch` | `extract_grant`, 11 tests |
| Rewriting the purpose after the grant breaks the memo id: tested (`test_rewriting_the_purpose_breaks_the_grant_binding`) | |
| `chain_source` constructor flag `rpc` or `bundle`, validated. The `rpc` instance refuses any bundle with a `chain_record` (`chain_record_not_accepted`); the `bundle` instance requires one. Every stored result, refusals included, carries `chain_source` | tests |
| `delta` on every deterministic scope hit: list of `{field, authorized, actual[, currency]}` in the shape of the ten iussum-apr records (`per_payment_max`, `allow.pay_to`, `allow.resource_prefix`, `expires_at`). For asset, network, agent and not_before (not in iussum-apr) I used the same pattern with the field names `asset`, `network`, `agent`, `not_before`. No delta on model or refusal results | tests |
| `chain_unreachable` records the HTTP status; chain reads are ONE POST PER TRANSACTION with ids `<run tag>:<sha8>:p/g` | see "RPC finding" |

Tests: 125 direct-mode tests pass (was 87). Nine mutations of the new code were each caught on the first run. Lint passes.

## RPC finding (the one failure in this phase)

The first live version sent one JSON-RPC **batch** with both transactions. Runs 1 to 4 worked. Cases real-5 and real-6 came back `chain_unreachable` on every attempt (10 attempts over about 40 minutes, gaps 0 s, 60 s, 120 s, rotation 1 each time). After I made the status visible it was **HTTP 429** from the validators' side. A request from the Mac with the same batch returned 200, and the same transactions fetched as single requests from the validators returned 200 (`results/rpcprobe.json`).

What I tried, in order: spacing the submissions (no effect), unique request ids so no earlier body repeats (no effect), single requests instead of a batch (fixed it). I do not know the cause. The evidence fits "the public devnet RPC answers batches from the validators' network with 429 for some requests", but it does not prove it, and it does not explain why runs 1 to 4 passed. The live contract now sends two single POSTs. I did not add retries. The two rows that failed stay in `results/rows.jsonl` (tags r1, r2 and the `gap`/`d`/`u` probes) and the failures are listed as results; the final-contract runs are the rows below.

## Real devnet cases (iussum's own helpers, read-only; mandate bodies saved in `cases/real/`)

Grant = ApproveChecked + Memo, principal only signer, sent by iussum's `sendTx`. Payment = delegate TransferChecked signed by the agent (iussum's `sendDelegateTransfer`).

| Case | Grant tx | Payment tx | Pay to | Amount (raw USDC) |
|---|---|---|---|---|
| real-1-onpurpose-quote | `3Am72RvyXtyx99ffP3Z7rUYJuBWDV3ijYGFBxGrp9Mjxzq3bh71v3zDGtacnuJG4RcTCuPBtPBTQqpxaW5SNw5Ra` | `45myzeiUC4PH25r1FBLd4Bp1BeL8yQNmSE8tHMEbnEQMLVWfz3aSNBDTGG9Y2Bp5QPDzzuoQUfFaePPePgzB18Jx` | 5hQASo… | 10000 |
| real-2-onpurpose-weather | `24Di2qVLdqWbt3b79fT68Lap8FhJCPpu2fp65QfUkkbwp1SzRynxTuNsRBT14Px2unhhd868c956DhoJsMjsVQA8` | `2y4p1JNj5dMM8ThyysQ1j9ypedsGN3v4wV71TiyMojjxqRttUnWWdsEAQxt1GuWKN1imzeph8gGecxobG5K7XG1S` | 2uh7t2… | 20000 |
| real-3-offpurpose-subscription | `3EUbzNr8NXrLiTiZHaGBG4SHG9bgxAWutnZdgYbQTakxZrcXEJqAkSmYS5N1kNib3iPDJP2RKvtpPmrBt5Za13rK` | `3bLLtBqNaK8c94RP1YYMuhRMhzsXPPUWhSm2r4z4YZJSTmM5b75DUgNxZvbSVdj3J89yxmPNtLU7zkaWY59qg1Bg` | 5hQASo… | 10000 |
| real-4-offpurpose-quantity | `PQy2sNV2voqnfm9L1mm8aZbxMXN2sKKUaw35QwaSquQeAisQ7dVSHXXQC2BJJLbbw7j7pVY5cgLc4FDX3A3bLDT` | `3XXX7A5NcDqxBEgMAf6NvdHG8VNf9WqxHvsrjynizeSfMf822MvMJLLmV9Pc8XvDM3StHo7Qy3FWdbDvyLLgDGgj` | 2uh7t2… | 20000 |
| real-5-scope-overcap | `v8judaqMvmeTfmSnczHJfhwUgb8TVK3toGuaXJGgwtw58M2kWd9j3FAauywyQPk9Kp6F5McEzHJ8kXDsCxDqjpX` | `5nBXBReWRAa3vqeASs34iqEmgCW6Ed7v2XpsoHS6CfTsC21NwrkN7ACMQmxv71b3DAqFUpKd11pDadf7KAD7ZX4A` | 5hQASo… | 10000 |
| real-6-scope-wrongpayto | `5RVnBfPuVm8rwQ1dCzyLp44rczsTNXL1FTe9RKyZjJpYySk2R87dJ3KLghxqsjd4kBevPUuap1ukUpanQwmyK86L` | `5sNtBQV9yp9h3BHE8heXubYbHSS1t2VJa8yoNX4tRgARkQXnCHQFMAymYVAQLJyzG8kn2yLpow1s49AJ8aK6a5zW` | BpunsC… | 10000 |


No case has a seller receipt: a receipt needs iussum's x402 seller gate and facilitator, and I will not forge one. So scope hits carry no "mandate presented" proof and liability is `agent_operator` by iussum's rule. The cases test the court's grant, scope and purpose logic, not receipt handling.

## End to end on the final live instance

Instance `0x0Cf7185AAAF6F63E02243B13230b5386d8dD3b05`, `chain_source=rpc`, deploy tx `0x7e837e7ff59c4bf68dbc75f6e122076cf4f669c73ff29b96726cd10b0d600e39`. One run each, one at a time.

| Case | Tx id | Result (verdict/liable/reason) | Expected | Accepted | Final | Rot | Votes | Leader | Agreeing |
|---|---|---|---|---|---|---|---|---|---|
| real-1-onpurpose-quote | `0x6f3bad63bd0c4f50b357e122e2203efccdb91b090eefd6a52da81b138c676b06` | invalid/principal/in_scope | invalid/principal/in_scope ✓ | 18.1 s | 52.0 s | 0 | {'idle': 2, 'agree': 3} | policy:prd-gemini | openai/gpt-5.4, policy:prd-deepseek |
| real-2-onpurpose-weather | `0x4e5675deea808fb9d6b91683bb3c5fea769496b8c81c73a307593a5a1b2cb018` | invalid/principal/in_scope | invalid/principal/in_scope ✓ | 13.7 s | 47.5 s | 0 | {'agree': 3, 'idle': 2} | policy:prd-sonnet | policy:prd-gemini, policy:prd-gpt-5-4 |
| real-3-offpurpose-subscription | `0x33ef28ab873854cdb46c4da6cdbb5776a5e5de5ad70ed07e57523a823f24ec46` | valid/agent_operator/purpose_mismatch | valid/agent_operator/purpose_mismatch ✓ | 18.0 s | 47.8 s | 0 | {'idle': 2, 'agree': 3} | policy:prd-qwen | policy:prd-gpt-5-4, policy:prd-gemma |
| real-4-offpurpose-quantity | `0x2d17ae0003af96da77c357332278255c3fadfa02ada41119a201368cde3296cf` | valid/agent_operator/purpose_mismatch | valid/agent_operator/purpose_mismatch ✓ | 17.8 s | 47.5 s | 0 | {'idle': 2, 'agree': 3} | openai/gpt-5.4 | policy:prd-gpt-5-4, policy:prd-sonnet |
| real-5-scope-overcap | `0xbb9f80c2c2cc5d268ab37ffbcb7ab6a5bef35475e20b21235b5351202b796640` | valid/agent_operator/amount_over_cap | valid/agent_operator/amount_over_cap ✓ | 9.6 s | 39.2 s | 0 | {'agree': 3, 'idle': 2} | policy:prd-qwen | google/gemini-3-flash-preview, policy:prd-minimax |
| real-6-scope-wrongpayto | `0xdd70f16c195d02d7784b1edabf3fe0008bb8a74789cdff6983a45d27a5d608db` | valid/agent_operator/pay_to_not_allowed | valid/agent_operator/pay_to_not_allowed ✓ | 14.2 s | 43.8 s | 0 | {'agree': 3, 'idle': 2} | policy:prd-grok | policy:prd-gemini, policy:prd-gemma |

- Six of six results equal the expected triple. Four of six reached the model path logic correctly (2 in scope, 2 off purpose); two were decided in plain code with a delta.
- **Finality measured** (submission to FINALIZED): 39.2 s to 52.0 s, median about 47.6 s. Accepted: 9.6 s to 18.1 s.
- Rotations: 0 on the final runs. Earlier attempts on the batch version rotated once each time a validator got 429.
- Disagree votes seen in earlier phase 1.5 runs (not the final ones): real-3 first run on the batch contract had 3 agree, 2 disagree and was still accepted with the right answer; real-1 diagnostic run had 1 disagree.

## NEEDS HIM

Nothing. Continuing into phase 2.
