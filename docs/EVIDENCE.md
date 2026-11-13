# Evidence map

Each claim has a link a reviewer can open: a file, a test name, a results row, or an explorer transaction. Explorer: `https://explorer-studio.genlayer.com/tx/<hash>` (studionet state is documented as temporary, so raw records are also saved under `results/`). Numbers carry their set sizes. Where a claim is about something I did NOT establish, it says so.

## Single-model control (the thing the jury has to beat)

**One model alone did worse than the jury on both measures, by small margins on small sets.** On the 63 injection runs of Set D, the jury produced 0 flips toward the attack; the same bundles through a leader-only copy of the contract (no validator agreement) produced 2 (D-B05 and D-B08, both run 1, leader `prd-gemini-3.5-flash-lite`). On the 60 runs of the original injection bundles, which carry no signed receipt and so give the model nothing to judge, the jury answered `could_not_decide` in 50 of 54 model-path runs and the single model in 35 of 54: the single model guessed a verdict in 19 runs where the jury guessed in 4. Two flips against none is not statistically meaningful on 63 runs; the guessing gap (19 against 4 of 54) is larger. The jury also did not win everywhere: on the clear Set D cases both were right in every run except those 2.

| | Jury (shipping contract) | Single model (leader-only copy) |
|---|---|---|
| Set D, 63 runs: flips toward the attack | 0 | 2 |
| Set D: correct (60 of 63 clear; 3 runs of D-B10 have an ambiguous expectation and are counted separately) | 60 | 58 |
| Set D: runs with a validator `disagree` vote / rotation | 7 / 2 | 0 / 0 (by construction) |
| Original Set C bundles, no signed receipt, 54 model-path runs: `could_not_decide` | 50 | 35 |
| same: a verdict given (`in_scope` or `purpose_mismatch`) | 4 | 19 |

How it was run: `controls/mandate_court_single.py` is **generated** from `contracts/mandate_court.py` by `controls/gen_single_contract.py`; a test (`tests/control/test_control_contract.py`) asserts that the generated file is exactly what the generator makes and that only the validator function differs (it returns `True` and never re-judges). Prompt, input builder, plain-code checks, receipt check and answer set are byte-identical. It exists only for measurement and is never the product. Same bundles (Set C original x3 and Set D x3, 123 runs), run on three control instances at once on studionet (bundle mode makes no devnet reads, so the 429 lesson does not apply; the Studio rate limit was not hit). Rows with leader model, answer and tx id: `results/control-single.jsonl`; analysis `results/analysis5.json`, `scripts/analyze5.py`. The off-chain variant `controls/single_model.py` (calls one model through a key) **was not run**.

Per leader model, model-path runs (Set C original and Set D together; models with at least 6 runs in the two systems combined; a "flip" is the opposite of the expected triple, so in the original set it means a guess, not an attack):

| Leader model | Jury: runs / correct / flips | Single model: runs / correct / flips |
|---|---|---|
| prd-gpt-6.1-sol | 17 / 6 / 2 | 19 / 11 / 0 |
| openai/gpt-6.1-sol | 10 / 4 / 0 | 13 / 7 / 0 |
| prd-claude-sonnet-4-6 | 11 / 9 / 0 | 10 / 7 / 2 |
| prd-gpt-oss-120b | 8 / 5 / 0 | 9 / 6 / 0 |
| prd-gemini-3.5-flash-lite | 2 / 1 / 1 | 13 / 7 / 4 |
| prd-qwen3.8-27b | 6 / 1 / 0 | 6 / 3 / 0 |
| prd-mistral-large-2512 | 3 / 2 / 0 | 7 / 7 / 0 |
| prd-grok-4.3 | 6 / 2 / 1 | 4 / 1 / 0 |
| prd-gemma-4-31b-it | 8 / 3 / 0 | 2 / 1 / 0 |
| claude-sonnet-4.6 | 6 / 3 / 0 | 4 / 3 / 1 |
| prd-glm-5.3 | 6 / 1 / 0 | 4 / 0 / 1 |
| prd-minimax-m3 | 4 / 1 / 0 | 6 / 3 / 0 |
| prd-kimi-k2.7-code | 2 / 1 / 0 | 7 / 4 / 2 |
| prd-deepseek-v4.1-flash-1017 | 4 / 1 / 0 | 5 / 1 / 1 |
| google/gemini-3.5-flash-lite | 3 / 3 / 0 | 5 / 3 / 2 |

Caveats: each system's leader models are drawn by the network, so the two columns are not the same models run on the same inputs; the single model is whichever leader the network picked, not a fixed model. The jury and the single model share the same prompt, so this measures the value of validator agreement, not of the prompt.

## Technical feasibility

| Claim | Where to check |
|---|---|
| A working Intelligent Contract in Python on GenVM: plain-code checks, chain reads, scope checks, one model question, closed answer set | `contracts/mandate_court.py`; `genvm-lint check` passes (README section 5) |
| 161 pytest tests (152 contract tests, 8 control-harness tests, 1 local dry run) and 15 node tests pass | `tests/direct`, `tests/control`, `tests/connector`, `tests/demo` |
| The equivalence principle is a custom leader and validator pair that must match three enum fields; reasoning is stored but never compared | tests `test_validator_accepts_same_triple_different_prose` and `test_validator_compares_liable_and_reason_not_just_verdict` in `tests/direct/test_scope_and_model.py` |
| Validators read Solana devnet (payment and grant) with strict agreement, one request per transaction | test `test_requests_are_single_and_ids_carry_the_run_tag_and_the_sha` in `tests/direct/test_grant_source_delta.py`; first live read `NOTES.md` and `REPORT-phase0.md` section 4.3 |
| The grant memo binds the mandate id, so the purpose cannot be rewritten after signing | test `test_rewriting_the_purpose_breaks_the_grant_binding` (`tests/direct/test_grant_source_delta.py`) |
| The seller receipt's ed25519 signature is checked in plain code in the contract, against pinned keys; the verifier agrees with iussum's own 7 receipt vectors and the RFC 8032 vectors | tests `test_contract_verifier_agrees_with_iussum_on_its_receipt_vectors`, `test_ed25519_rfc8032_vectors`, `test_bad_signature_is_refused_before_anything_else` (`tests/direct/test_receipt_signature.py`) |
| Text the parties can write freely never reaches the model | tests `test_delivered_text_never_reaches_the_model`, `test_unknown_unsigned_fields_do_not_reach_the_model` (same file) |
| 8 live Solana devnet cases judged on studionet by the shipping contract, with explorer links | README section 3 table; raw rows `results/rows.jsonl` (set `R4`); all 35 Set B v2 chain cases in [docs/live-cases-b2.md](live-cases-b2.md) |
| Seller liability from a real seller receipt: `valid / seller / amount_over_cap` | court tx [0xebc10381...](https://explorer-studio.genlayer.com/tx/0xebc103816020d99b2e4426afa44fe1fe9afdd048150b199bc88f143cc361e5e3) (case `rr-1-seller-overcap`, set `R4`); first run in `REPORT-phase3.md` section 5 |
| One command reproduces a case end to end | `scripts/demo.mjs`, README "Try it", `tests/demo/demo.test.mjs`; two recorded runs in `logs/demo-run1.log` and `logs/demo-run2.log` (ignored by git; the rows are in `results/demo-rows.jsonl`) |
| Drift: 60 of 60 clear cases correct on the shipping contract (20 cases x 3, live devnet reads) | `REPORT-phase4.md` section 1; `sets/B2-EXPECTED.json` (committed before any run, commit `08c4857`); rows with set `B2` |
| The injection hole was found, measured and closed by design: 1 flip in the first run of 20 bundles; 0 flips toward an attack in 63 runs after the fix | flip row: set `C`, case `C-14`, tag `C-14-r1`, tx [0x9aabebd4...](https://explorer-studio.genlayer.com/tx/0x9aabebd42e1f6266d0d777e89d96fb9b736bedeeabd849991b6f07dd4c76aa91); `REPORT-phase2.md` (Set C), `REPORT-phase3.md` section 2; rows with set `D`; expectations `sets/EXPECTED-phase3.json` |
| The bad numbers are published: appeals corrected 0 of 2 flips; UNDETERMINED 3 of 270 runs; borderline cases almost never `could_not_decide` (1 of 44); real cases without a receipt answer `could_not_decide` | `results/appeals.jsonl`; `results/p3-undetermined-and-v36.md`; `REPORT-phase4.md` sections 1 and 2 |
| Tests were written before the code in each step | commits `e4b9e37`, `99f548f`, `73377ba`, `40781bf`, `96801fb`, `de12a14`, `7a3ab3d` (messages say "tests first") |
| Not established | Bradbury deployment, fees, the real appeal bond (studionet bond is 0), the connector's twice-UNDETERMINED path on chain (the once-UNDETERMINED resubmit ran 3 times, `REPORT-phase5.md`), the off-chain single-model variant `controls/single_model.py` (built, not run; the on-chain leader-only control above replaces it) |

## Ecosystem impact

| Claim | Where to check |
|---|---|
| The Internet Court skill README, as read on 2026-11-12, specifies no evidence format and shows Solana only as execution skills; MandateCourt adds a defined bundle and a Solana x402 case path | source: `https://raw.githubusercontent.com/internet-court/internet-court-skill/main/README.md`; `NOTES.md` (sources table); bundle format in `README.md` section 2 and `REPORT-phase1-5.md` |
| It answers the public objection that both sides will prompt the judge, with published adversarial numbers and a fix by design rather than by prompt | `REPORT-phase2.md` (C-14), `REPORT-phase3.md` (Set D, 63 runs), one prompt sentence tried first and found to change nothing measurable (`REPORT-phase2.md`, "Prompt change 1") |
| A Solana x402 payment rail case set, not only EVM | `cases/real`, `cases/real-receipt`, `cases/b2` (real devnet grants and payments) |
| Tooling feedback for the next builder, with exact error texts | [docs/genlayer-feedback.md](genlayer-feedback.md) (16 items) |
| Reusable pieces: a pure-Python ed25519 and base58 inside a contract, the connector rule for UNDETERMINED, a harness for adversarial sets | `contracts/mandate_court.py`, `scripts/connector-lib.mjs`, `scripts/mkc2.mjs`, `scripts/analyze3.py` |
| Not established | any outside user or design partner; any usage of the court by someone other than me |

## Team experience

| Claim | Where to check |
|---|---|
| A solo project with a complete, checkable history: every step is a commit, authored `seekdaseek`, tests before code, reports per phase | `git log` (41 commits at the time of writing); `REPORT-phase0.md` to `REPORT-phase5.md` |
| It builds on an existing Solana codebase I wrote: iussum (mandate, payment gate, deterministic resolver, golden vectors) | `https://github.com/seekdaseek/iussum`; the court uses its receipts and its seller gate unmodified (`scripts/mkreceipt-cases.mjs` imports them read-only) |
| Honest handling of failure: wrong expectations and invalid controls are reported as mine | `REPORT-phase2.md` (truncation v1 control invalid), `REPORT-phase3.md` (D-B10 expectation), `REPORT-phase4.md` (`chain_unreachable` rate) |
| Not established | a team beyond one person |

## Long-term viability

| Claim | Where to check |
|---|---|
| Per-case cost on studionet is zero; the real cost on a network that charges is not measured | `REPORT-phase0.md` section 4.4; `docs/genlayer-feedback.md` item 5 |
| The documentation I read (economic model page, 2026-11-12) gives the contract developer 10% of gross time-unit fees and 10% of protocol inflation; I did not find a 20% figure | `docs.genlayer.com/full-documentation.txt`, "Economic model", reproduced in `NOTES.md` |
| Known limits are written down: public RPC rate limits depend on concurrency; seller keys are pinned per deployment (no registry); iussum does not yet accept the v0.3 grant memo this court needs, so it assigns no `verdict_id` to these cases; studionet state is temporary | `README.md` section 4 ("Not tested"), `REPORT-phase3.md` section 5, `REPORT-phase4.md` "Limits" |
| Not established | who pays per case, a revenue model, a mainnet or Bradbury deployment |
