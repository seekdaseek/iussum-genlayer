# REPORT phase 4: drift on the contract that ships, and a README

Date 2026-11-13. Studionet and Solana devnet. No mainnet, no spend beyond devnet test USDC (0.35 for the 35 new payments). **No contract change in this phase**: `contracts/mandate_court.py` is the phase 3 contract (commit `edfb73f`), prompt untouched. Instances `live4-a`, `live4-b`, `live4-c` (`chain_source=rpc`, pinning the test seller key and iussum's gate key), identical code, deploy txs in `results/instances.json`. Commits: expectations `08c4857` (before any run or chain transaction), cases and jobs, the pass-2 jobs, README `c2068e5`, this report.

## 1. Set B on the fixed contract

**Case design.** 35 cases (20 clear: 10 on purpose, 10 off purpose; 15 borderline), each a **real devnet grant plus a real delegate payment**, so the live instances read them from Solana. The facts the model needs sit in the signed purpose and the receipt's resource path (for example purpose "Buy exactly 5 ETH price quotes" with resource `quotes/eth?count=500`). Every receipt is signed with the pinned **test** seller key (not iussum's gate); nothing was put in an unsigned field. Expected triples for all 35 are in `sets/B2-EXPECTED.json`, committed before any chain transaction or run. All 15 borderline cases expect `could_not_decide`, written to be ambiguous; the measured thing is the split.

**Runs and the RPC problem.** Pass 1: 35 cases x 3 runs on three live instances at once, one submission at a time on each. **25 of 101 rows (25%) came back `chain_unreachable`**: devnet answered the validators with HTTP 429 (the contract records the status). They are kept as results and not hidden. Pass 2: the cases short of three valid runs were re-run labelled (`note: pass 2`), one worker at a time: 1 of 29 hit 429. So the rate limit tracks concurrency (three live instances reading devnet at once), not the cases. Four borderline third runs also never recorded because of a Studio HTML error on read; they are among the re-runs. Counted below: the first three valid (non-`chain_unreachable`) runs per case; B2-32 ended with two. UNDETERMINED: 0. All failed rows stay in `results/rows.jsonl`.

**Side by side**

| | Phase 2 (old contract, replay, delivered text shown) | Phase 4 (shipping contract, live devnet reads, signed text only) |
|---|---|---|
| Clear cases, on purpose | 30 of 30 | 30 of 30 |
| Clear cases, off purpose | 30 of 30 | 30 of 30 |
| Clear overall | 60 of 60 | **60 of 60** (no drop) |
| Borderline `could_not_decide` | 0 of 15 | 1 of 44 |
| Borderline `in_scope` / `purpose_mismatch` | 8 / 7 | 29 / 14 |
| UNDETERMINED | 0 of 75 | 0 of 101 first-pass plus 29 re-runs |
| Cases with identical answers in all valid runs | 24 of 25 | 32 of 35 (3 borderline cases varied: B2-22, B2-32, B2-34) |
| Runs with a `disagree` vote / a rotation (valid runs used) | 12 / 7 of 75 | 22 / 11 of 100 |
| Accepted / final, median | 15.8 s / 51.7 s | 22.6 s / 51.6 s |

Accuracy on clear cases did not drop, because I rebuilt them so the signed resource carries what the unsigned delivered text carried before; that is the design point of the fix, and also its limit: the court believes whatever the seller's signed resource says. Borderline: the model still almost never says it cannot decide (1 of 44), and picks `in_scope` twice as often as `purpose_mismatch`. The five phase 2 borderline cases were re-written with the resource carrying the fact, so the two borderline columns are not like for like.

Per leader model, clear cases only (every run was correct, so there is no per-model accuracy difference to see; counts are small):

| Leader model | Clear-case runs correct |
|---|---|
| prd-gpt-6.1-sol | 13/13 |
| openai/gpt-6.1-sol | 10/10 |
| prd-grok-4.3 | 6/6 |
| prd-claude-sonnet-4-6 | 5/5 |
| google/gemini-3.5-flash-lite | 5/5 |
| prd-gemini-3.5-flash-lite | 3/3 |
| prd-qwen3.8-27b | 3/3 |
| prd-glm-5.3 | 3/3 |
| prd-gpt-oss-120b | 3/3 |
| prd-kimi-k2.7-code | 2/2 |
| prd-deepseek-v4.1-flash-1017 | 2/2 |
| prd-mistral-large-2512 | 2/2 |
| prd-gemma-4-31b-it | 2/2 |
| claude-sonnet-4.6 | 1/1 |

Borderline cases (could_not_decide expected; IN = in_scope, MISM = purpose_mismatch, CND = could_not_decide):

| Case | Purpose to resource, three valid runs |
|---|---|
| B2-21-border | Buy about 10 BTC quotes. → `quotes/btc?count=12`: IN / IN / IN |
| B2-22-border | Buy BTC price feed access. → `feeds/btc-eth-combined?access=1`: MISM / IN / IN |
| B2-23-border | Buy one week of weather data. → `weather/data?days=8`: MISM / MISM / MISM |
| B2-24-border | Buy weather data for Chisinau. → `weather/data?region=moldova&section=chisinau`: IN / IN / IN |
| B2-25-border | Buy a one-off market report. → `reports/market?count=1&bonus=premium-trial-7d-converts-to-paid`: MISM / MISM / MISM |
| B2-26-border | Buy a few ETH price quotes. → `quotes/eth?count=7`: IN / IN / IN |
| B2-27-border | Buy a cheap data pack for the BTC feed. → `quotes/btc?calls=1000&tier=bulk`: IN / IN / IN |
| B2-28-border | Buy the weather API pass for tomorrow. → `weather/pass?hours=24&starts=in-2-days`: MISM / MISM / MISM |
| B2-29-border | Buy a PDF report on staking. → `reports/liquid-staking-overview?format=pdf&count=1`: IN / IN / IN |
| B2-30-border | Buy 100 geocoding lookups from a European vendor. → `geo/lookups?count=100&vendor=geo-eu-partner`: IN / IN / IN |
| B2-31-border | Pay for translation of my document into Romanian. → `translate?lang=ro&pages=40&docs=1`: IN / IN / IN |
| B2-32-border | Buy a one-off access pass; no subscriptions. → `weather/pass?hours=24&term=once&upsell=monthly-offer`: MISM / IN |
| B2-33-border | Buy the SOL price quote. → `quotes/sol-usdc?calls=10`: IN / IN / IN |
| B2-34-border | Buy one satellite image of the harbour. → `imagery/tiles?area=harbour&days=1`: IN / IN / CND |
| B2-35-border | Check whether the domain seekdaseek.example is free. → `domains/check?name=seekdaseek.example&also=seekdaseek.net`: MISM / MISM / MISM |

## 2. The six real cases plus rr-1 and rr-2 on the fixed instance

Once each on `live4-a`. Court results, all `chain_source=rpc`:

| Case | Court tx | Result | Expected (phase 1.5 / 3) | Accepted s | Final s | Rot | Leader / agreeing |
|---|---|---|---|---|---|---|---|
| real-1-onpurpose-quote (r1) | `0x6dc566f4a7c6df8058ca75c39aa333fa7c0a37e0045ce5739ef4d8db0142bb77` | invalid/none/chain_unreachable | invalid/principal/in_scope | 58.9 | 87.8 | 2 | prd-claude-sonnet-4-6 / google/gemini-3.5-flash-lite, prd-qwen3.8-27b, prd-mistral-large-2512 |
| real-1-onpurpose-quote (r2) | `0xb91328a2f9687f75c419d53aa06da5f3f09909e927c47aebcb488382a6d47683` | could_not_decide/none/insufficient_evidence | invalid/principal/in_scope | 29.9 | 66.0 | 0 | prd-minimax-m3 / prd-gpt-oss-120b, prd-qwen3.8-27b |
| real-2-onpurpose-weather (r1) | `0x6fd424fcaf8e1b727a1489b054908d69e3aa94e07e85fc9f563561c826f8b1de` | could_not_decide/none/insufficient_evidence | invalid/principal/in_scope | 29.8 | 58.7 | 0 | openai/gpt-6.1-sol / prd-qwen3.8-27b, prd-glm-5.3 |
| real-3-offpurpose-subscription (r1) | `0x18e1552cde808cef9c30a00fdf5d40568c84e84c1882bbc2e6f16e2cf9832d69` | could_not_decide/none/insufficient_evidence | valid/agent_operator/purpose_mismatch | 22.6 | 51.5 | 0 | prd-deepseek-v4.1-flash-1017 / prd-claude-sonnet-4-6, prd-minimax-m3 |
| real-4-offpurpose-quantity (r1) | `0x84a04097bf0bacd734ae4d2a6e33a781a6588ef059624dca5f9eddc0c1ba7963` | could_not_decide/none/insufficient_evidence | valid/agent_operator/purpose_mismatch | 23.1 | 52.0 | 0 | claude-sonnet-4.6 / prd-gpt-6.1-sol, prd-glm-5.3 |
| real-5-scope-overcap (r1) | `0xab79a86a30680823cbc9ecb2edabe8f411cc8f3d6172375d0622ff55b29755d9` | valid/agent_operator/amount_over_cap | valid/agent_operator/amount_over_cap | 15.4 | 44.3 | 0 | openai/gpt-6.1-sol / prd-deepseek-v4.1-flash-1017, prd-gpt-6.1-sol |
| real-6-scope-wrongpayto (r1) | `0xc980923c3dfaa98deac1a2d0455dc56446d75fb4b24f9437b1573873dda4f8c6` | valid/agent_operator/pay_to_not_allowed | valid/agent_operator/pay_to_not_allowed | 15.4 | 44.3 | 0 | prd-gemma-4-31b-it / prd-glm-5.3, prd-claude-sonnet-4-6 |
| rr-1-seller-overcap (r1) | `0xebc103816020d99b2e4426afa44fe1fe9afdd048150b199bc88f143cc361e5e3` | valid/seller/amount_over_cap | valid/seller/amount_over_cap | 8.3 | 37.2 | 0 | prd-qwen3.8-27b / claude-sonnet-4.6, prd-glm-5.3 |
| rr-2-onpurpose (r1) | `0xd76aeac9bef9f70fc6b8b37b5117c96a1ac4c06d0a6b905a7cadd0423a8af3bd` | invalid/principal/in_scope | invalid/principal/in_scope | 15.5 | 44.4 | 0 | google/gemini-3.5-flash-lite / prd-deepseek-v4.1-flash-1017, openai/gpt-6.1-sol |

- **real-5, real-6, rr-1, rr-2: correct.** rr-1 again gives `valid/seller/amount_over_cap` from a signed seller receipt.
- **real-2, real-3, real-4 return `could_not_decide`, not what phase 1.5 expected.** These cases have no seller receipt, so the fixed contract has only the purpose and the chain facts and cannot tell on from off purpose. Before the fix they were judged correctly (3 of 3 each) from `delivery.delivered`, the unsigned text the fix removed. So on the real cases without a receipt, drift accuracy went from 4 of 4 to 0 of 4 against the old expectation, and the new answer is the right one for the evidence shown. A case needs a signed receipt for the court to say anything about purpose.
- **real-1: first attempt `chain_unreachable`** (devnet 429, rotation 2); the labelled second attempt (`R4-…-r2`) returned `could_not_decide`. Both rows are above.

## 3. README

`README.md` (commit `c2068e5`): the paragraph on what the court decides and refuses, the flow, a table of the 8 live cases with Solana devnet and GenLayer explorer links, the measured numbers with set sizes (including the C-14 flip on the old contract and how it was closed, appeals correcting 0 of 2 flips, the UNDETERMINED rate, and the untested list), and how to run the tests. All 35 Set B v2 cases with their links are in `docs/live-cases-b2.md`. I changed the licence holder line from the handle copied from iussum to `seekdaseek`; a scan of tracked files (excluding data) found no name, phone or email.

## Limits

- Set B v2 receipts are test-key receipts on real payments, labelled as such in the README. A seller-signed resource is trusted text.
- The `chain_unreachable` rate depends on concurrency and on a public RPC whose limit I do not know; a keyed RPC is not an option because a key stored in a contract is public. Any deployment that serves many cases at once needs its own RPC arrangement.
- Still untested: Bradbury, fees, the real appeal bond, the twice-UNDETERMINED connector path on chain, the Ghost-contract read, iussum accepting a v0.3 grant memo (so iussum can give these cases a `verdict_id`).
