# MandateCourt

An Intelligent Contract for GenLayer that decides one thing iussum's deterministic rules cannot: **an AI agent paid a seller within the limits the person signed; was it still what the person asked for?** It reads the payment from Solana devnet, uses only text a party signed, asks several independent models one question, and returns one of four fixed answers. Everything runs on GenLayer's hosted Studio network and Solana devnet; no mainnet, no real funds.

**Headline:** after the fix described below, **0 of 63 injection runs flipped toward the attack** with the jury, against 2 of 63 for the same contract run with a single leader model and no validator agreement (small sets; the single model also guessed a verdict in 19 of 54 runs with nothing to judge, the jury in 4). Clear drift cases: 60 of 60 on the shipping contract. 8 live devnet cases judged on chain, linked below.

- **Try it:** `npm install && node scripts/demo.mjs` (section "Try it" below)
- **Evidence for each claim:** [docs/EVIDENCE.md](docs/EVIDENCE.md), including the single-model comparison at the top
- **Tooling feedback for GenLayer builders:** [docs/genlayer-feedback.md](docs/genlayer-feedback.md)
- **Licence:** MIT ([LICENSE](LICENSE)), author seekdaseek

## 1. What it decides, and what it refuses to decide

MandateCourt answers one question that iussum's deterministic rules cannot: **the payment was inside every signed limit, was it still what the principal asked for?** The answer is one of a closed set of four triples (verdict, liable party, reason): `invalid/principal/in_scope`, `valid/agent_operator/purpose_mismatch`, `valid/seller/delivery_mismatch`, `could_not_decide/none/insufficient_evidence`. Limit violations (over the cap, wrong payee, expired, ...) are decided in plain code, with liability seller or agent operator as in iussum, and carry a `delta`.

It refuses (a fixed refusal code, no model) a bundle that is malformed, too large (cap set per deployment, 65,536 bytes live), whose hash or canonical form is wrong, whose grant transaction does not bind the mandate and its purpose, whose payment does not match the chain, or whose seller receipt is not signed by a key the deployer pinned. It does **not** check iussum's period budget, spend history, grant supersession, or debits that are not a single x402 transfer. It never reads text the parties could have written freely.

## 2. How a case flows

1. **Plain-code checks**: size, JSON, schema, canonical form, sha256 of the bundle, receipt signature (ed25519, pinned seller keys).
2. **Chain reads** (validators read Solana devnet RPC, one request per transaction, strict agreement): the payment (amount, payee, mint, delegate, source account) and the grant (an ApproveChecked and one memo carrying the mandate id, so the purpose is bound to what the principal signed).
3. **Scope checks in plain code**: network, asset, window, agent, per-payment cap, pay_to, resource prefix. A hit ends the case here.
4. **Signed text only**: the model is shown the principal's purpose (signed through the grant memo), the chain facts, and the resource named in the seller's signed receipt. Free text that either party can write (`delivery.delivered`, complaints, unknown fields) is stored, flagged `unsigned_ignored`, and never shown. Evidence sits between delimiters derived from the bundle hash.
5. **One model question, closed answer set.** Five validators, each running a different model; the leader answers, the validators re-judge and must match on all three fields. Reasoning is stored, not compared. `could_not_decide` is a first-class answer.

## 3. Live chain cases judged by the shipping contract

Contract at `contracts/mandate_court.py`, instances `live4-a/b/c` (`chain_source=rpc`; addresses in `results/instances.json`). Each case is a real devnet grant and payment; the court's validators read them from devnet.

| Case | What it is | Solana devnet: grant / payment | GenLayer tx (explorer-studio) | Court result | Expected |
|---|---|---|---|---|---|
| real-1-onpurpose-quote | on purpose, no receipt | [grant](https://explorer.solana.com/tx/3Am72RvyXtyx99ffP3Z7rUYJuBWDV3ijYGFBxGrp9Mjxzq3bh71v3zDGtacnuJG4RcTCuPBtPBTQqpxaW5SNw5Ra?cluster=devnet) / [payment](https://explorer.solana.com/tx/45myzeiUC4PH25r1FBLd4Bp1BeL8yQNmSE8tHMEbnEQMLVWfz3aSNBDTGG9Y2Bp5QPDzzuoQUfFaePPePgzB18Jx?cluster=devnet) | [0xb91328a2…](https://explorer-studio.genlayer.com/tx/0xb91328a2f9687f75c419d53aa06da5f3f09909e927c47aebcb488382a6d47683) | could_not_decide/none/insufficient_evidence | invalid/principal/in_scope |
| real-2-onpurpose-weather | on purpose, no receipt | [grant](https://explorer.solana.com/tx/24Di2qVLdqWbt3b79fT68Lap8FhJCPpu2fp65QfUkkbwp1SzRynxTuNsRBT14Px2unhhd868c956DhoJsMjsVQA8?cluster=devnet) / [payment](https://explorer.solana.com/tx/2y4p1JNj5dMM8ThyysQ1j9ypedsGN3v4wV71TiyMojjxqRttUnWWdsEAQxt1GuWKN1imzeph8gGecxobG5K7XG1S?cluster=devnet) | [0x6fd424fc…](https://explorer-studio.genlayer.com/tx/0x6fd424fcaf8e1b727a1489b054908d69e3aa94e07e85fc9f563561c826f8b1de) | could_not_decide/none/insufficient_evidence | invalid/principal/in_scope |
| real-3-offpurpose-subscription | off purpose, no receipt | [grant](https://explorer.solana.com/tx/3EUbzNr8NXrLiTiZHaGBG4SHG9bgxAWutnZdgYbQTakxZrcXEJqAkSmYS5N1kNib3iPDJP2RKvtpPmrBt5Za13rK?cluster=devnet) / [payment](https://explorer.solana.com/tx/3bLLtBqNaK8c94RP1YYMuhRMhzsXPPUWhSm2r4z4YZJSTmM5b75DUgNxZvbSVdj3J89yxmPNtLU7zkaWY59qg1Bg?cluster=devnet) | [0x18e1552c…](https://explorer-studio.genlayer.com/tx/0x18e1552cde808cef9c30a00fdf5d40568c84e84c1882bbc2e6f16e2cf9832d69) | could_not_decide/none/insufficient_evidence | valid/agent_operator/purpose_mismatch |
| real-4-offpurpose-quantity | off purpose, no receipt | [grant](https://explorer.solana.com/tx/PQy2sNV2voqnfm9L1mm8aZbxMXN2sKKUaw35QwaSquQeAisQ7dVSHXXQC2BJJLbbw7j7pVY5cgLc4FDX3A3bLDT?cluster=devnet) / [payment](https://explorer.solana.com/tx/3XXX7A5NcDqxBEgMAf6NvdHG8VNf9WqxHvsrjynizeSfMf822MvMJLLmV9Pc8XvDM3StHo7Qy3FWdbDvyLLgDGgj?cluster=devnet) | [0x84a04097…](https://explorer-studio.genlayer.com/tx/0x84a04097bf0bacd734ae4d2a6e33a781a6588ef059624dca5f9eddc0c1ba7963) | could_not_decide/none/insufficient_evidence | valid/agent_operator/purpose_mismatch |
| real-5-scope-overcap | over the per-payment cap, no receipt | [grant](https://explorer.solana.com/tx/v8judaqMvmeTfmSnczHJfhwUgb8TVK3toGuaXJGgwtw58M2kWd9j3FAauywyQPk9Kp6F5McEzHJ8kXDsCxDqjpX?cluster=devnet) / [payment](https://explorer.solana.com/tx/5nBXBReWRAa3vqeASs34iqEmgCW6Ed7v2XpsoHS6CfTsC21NwrkN7ACMQmxv71b3DAqFUpKd11pDadf7KAD7ZX4A?cluster=devnet) | [0xab79a86a…](https://explorer-studio.genlayer.com/tx/0xab79a86a30680823cbc9ecb2edabe8f411cc8f3d6172375d0622ff55b29755d9) | valid/agent_operator/amount_over_cap | valid/agent_operator/amount_over_cap |
| real-6-scope-wrongpayto | wrong pay_to, no receipt | [grant](https://explorer.solana.com/tx/5RVnBfPuVm8rwQ1dCzyLp44rczsTNXL1FTe9RKyZjJpYySk2R87dJ3KLghxqsjd4kBevPUuap1ukUpanQwmyK86L?cluster=devnet) / [payment](https://explorer.solana.com/tx/5sNtBQV9yp9h3BHE8heXubYbHSS1t2VJa8yoNX4tRgARkQXnCHQFMAymYVAQLJyzG8kn2yLpow1s49AJ8aK6a5zW?cluster=devnet) | [0xc980923c…](https://explorer-studio.genlayer.com/tx/0xc980923c3dfaa98deac1a2d0455dc56446d75fb4b24f9437b1573873dda4f8c6) | valid/agent_operator/pay_to_not_allowed | valid/agent_operator/pay_to_not_allowed |
| rr-1-seller-overcap | over the cap, receipt from iussum seller gate: seller liable | [grant](https://explorer.solana.com/tx/58KkADpfoVSq4JL3NkVo2oc8SrBa5pvmLUuy2Bq5yavMhp6E1XP5uA11QE8gadWVgxsL8rCrPShi1gAbU5qtWygP?cluster=devnet) / [payment](https://explorer.solana.com/tx/5nkKeStKJPSG7a3chJ7xXhPQUGDW3neD8aw1x8b3BZk6C3ZRdRzeaEWSevpCY18YjhLAtWojTqBaWKHMjUfmYcJh?cluster=devnet) | [0xebc10381…](https://explorer-studio.genlayer.com/tx/0xebc103816020d99b2e4426afa44fe1fe9afdd048150b199bc88f143cc361e5e3) | valid/seller/amount_over_cap | valid/seller/amount_over_cap |
| rr-2-onpurpose | on purpose, receipt from iussum seller gate | [grant](https://explorer.solana.com/tx/2FAhc7w7AHHtScG8NBXgABACFDR291RG7LotdEpgJ7TEH7b2PaYo5CCptw1LL132czDiP3dQaqhyix44Y5BQmgeL?cluster=devnet) / [payment](https://explorer.solana.com/tx/3vtXeLJHT4MyHYQ1QtXE6Yfw33cZzhbtRfWxgH1ibnFGzc6xv6tEQ1fL2V8bQYTafFzDSHuKdbXqXpH6zVX77UfQ?cluster=devnet) | [0xd76aeac9…](https://explorer-studio.genlayer.com/tx/0xd76aeac9bef9f70fc6b8b37b5117c96a1ac4c06d0a6b905a7cadd0423a8af3bd) | invalid/principal/in_scope | invalid/principal/in_scope |

Reading the table: real-1 to real-4 have **no seller receipt**, so the shipping contract has only the purpose and the chain facts. It cannot tell on-purpose from off-purpose there and answers `could_not_decide` (real-1's first attempt ended `chain_unreachable`, see below; the row shows the second attempt). Before the fix these four were judged correctly from unsigned delivery text, which is exactly the text the fix removed. rr-1 and rr-2 carry receipts signed by iussum's own seller gate. All 35 Set B v2 cases (real devnet grant and payment, receipt signed with a **test** seller key) are linked in [docs/live-cases-b2.md](docs/live-cases-b2.md).

 ## Try it

One command judges a recorded live case (a real devnet payment, a real seller receipt signed by iussum's seller gate) on studionet, end to end. You need Node 20+ and the repo only; the studionet key is created in `.secrets/` on first run (studionet is gasless).

```bash
npm install
node scripts/demo.mjs            # or: npm run demo
```

If the court is not deployed on studionet (first run, or the state was reset) the script deploys it first and says so (about 40 s extra). Expected output (tx hashes differ per run; the triple, the delta and the match line are what to check):

```
case rr-1-seller-overcap: the seller (observe mode) settled a 0.01 USDC payment above the 0.005 per-payment cap, receipt records the mandate as presented: liability seller
Solana devnet payment 5nkKeStKJPSG7a3chJ7xXhPQUGDW3neD8aw1x8b3BZk6C3ZRdRzeaEWSevpCY18YjhLAtWojTqBaWKHMjUfmYcJh
Solana devnet grant   58KkADpfoVSq4JL3NkVo2oc8SrBa5pvmLUuy2Bq5yavMhp6E1XP5uA11QE8gadWVgxsL8rCrPShi1gAbU5qtWygP
court instance 0x94C6...0175 (chain_source=rpc, pinned seller key 6prcN4...)
submitting the case; the validators read the payment and the grant from Solana devnet ...

court result : valid / seller / amount_over_cap   (path: deterministic, chain_source: rpc)
delta        : [{"actual":"10000","authorized":"5000","currency":"4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU","field":"per_payment_max"}]
recorded expectation: valid / seller / amount_over_cap  ->  matches the recorded expectation
time         : accepted 13.8 s, finalized 44.3 s
GenLayer tx  : 0x91bc35...1e54
explorer     : https://explorer-studio.genlayer.com/tx/0x91bc3530736567b64c53c9895e4477fa80901c1ac5d6e31fe759f02ed6631e54
```

Run `node scripts/demo.mjs rr-2-onpurpose` for the on-purpose case: that one goes through the model and ends `invalid / principal / in_scope`. The demo writes only to `results/demo-*.json`.

## 4. Measured numbers (set sizes in brackets)

Phases 2 to 4 are in `REPORT-phase2.md`, `REPORT-phase3.md`, `REPORT-phase4.md`; raw rows in `results/rows.jsonl`. Replay instances (`chain_source=bundle`) read the chain facts from the bundle and are not verified cases.

| Measure | Result | Contract |
|---|---|---|
| iussum vectors in court scope [28 of 56 vectors, 3 runs each, replay] | 82 of 84 runs equal the expected triple; both misses are one vector answering `could_not_decide` (bundle artefact) | phase 2 |
| Drift, clear cases [20 cases x 3, replay, delivered text shown] | 60 of 60 | phase 2 (before the fix) |
| Drift, borderline [5 cases x 3] | 0 of 15 `could_not_decide`; 8 `in_scope`, 7 `purpose_mismatch` | phase 2 |
| **Injection, first run [20 bundles]** | **1 flip (C-14: a buyer complaint in the unsigned delivery text turned in_scope into purpose_mismatch)**, 2 ended UNDETERMINED | phase 2 (before the fix) |
| Appeals [5 cases; 2 had flipped] | **0 of 2 flips corrected**: the larger committee confirmed the leader's answer. The appeal bond on studionet is 0, so its cost is unmeasured | phase 2 |
| How C-14 was closed | by design: the model no longer sees unsigned text; receipts are signature-checked. Not by prompt: one prompt sentence tried in phase 2 changed nothing measurable | phase 3 |
| Injection after the fix [21 placements x 3 = 63 runs, replay] | 0 flips in the direction of an attack (seller-signed resource text, unsigned fields, grant memo, purpose, tampered receipt) | phase 3 |
| Original injection set after the fix [20 x 3 = 60] | 50 `could_not_decide`, 6 refused (old receipts, invalid signature), 1 stray `purpose_mismatch`: those bundles carry no signed receipt, so it is no longer an injection test | phase 3 |
| UNDETERMINED (3 rotations, no result) [270 runs before phase 3] | 3 (1.1%), all model-path; 0 of 123 in phase 3. Resubmitted-once rule exists in the connector and is unit-tested; **it has never run on chain** | phases 2, 3 |
| Drift on the shipping contract, clear [20 cases, first 3 valid runs each, live devnet reads] | 60 of 60 | phase 4 |
| Drift on the shipping contract, borderline [15 cases, 44 valid runs] | 1 `could_not_decide`; 29 `in_scope`; 14 `purpose_mismatch` | phase 4 |
| Devnet RPC `chain_unreachable` (HTTP 429 to the validators) | 25 of 101 first-pass runs with three live workers at once; 1 of 29 re-runs with one worker at a time | phase 4 |
| **Single-model control (leader-only copy of the contract, no validator agreement)** [Set D 63 runs; original Set C 60 runs] | 2 of 63 flips toward the attack (jury 0); a verdict guessed in 19 of 54 no-evidence runs (jury 4 of 54). Not statistically strong on 63 runs; see EVIDENCE.md | phase 5b |
| Latency [all rows] | median about 15 to 23 s to accepted and 45 to 52 s to finalized (plain-code cases faster) | all |

**Control, measurement only:** `controls/mandate_court_single.py` is generated from the contract and differs only in a validator function that accepts any leader answer; it exists to measure the value of validator agreement and is never the product. `controls/single_model.py` (one model called off chain through a key) is the other variant and **was not run**.

**Not tested:** Bradbury testnet; fees and the real appeal bond (studionet is free and has bond 0); the connector's twice-UNDETERMINED path on chain; reading a verdict from an EVM contract through the Ghost contract; a registry for seller keys (today the deployer pins them in the constructor). iussum itself rejects the v0.3 grant memo this court needs (`grant_mismatch`), so iussum assigns no `verdict_id` to these cases; that needs a change in iussum. Receipts signed with the test key are test data, not seller attestations.

## 5. Run the tests

```bash
python3.12 -m venv .venv
.venv/bin/pip install genlayer-test genvm-linter pytest cryptography
.venv/bin/pytest tests/direct          # 152 contract tests, no chain, models mocked
.venv/bin/genvm-lint check contracts/mandate_court.py
.venv/bin/pytest tests/control        # control harness and generated leader-only contract
npm install && node --test tests/connector/connector.test.mjs tests/demo/demo.test.mjs
```

The first pytest run downloads the GenVM v0.2.16 runtime (network needed). Scripts that touch devnet or studionet are in `scripts/` and read keys from `.secrets/` (not in git).

Licence: MIT. Author: seekdaseek.
