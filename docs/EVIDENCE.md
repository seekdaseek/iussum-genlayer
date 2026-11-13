# Evidence map

Each claim has a link a reviewer can open: a file, a test name, a results row, or an explorer transaction. Explorer: `https://explorer-studio.genlayer.com/tx/<hash>` (studionet state is documented as temporary, so raw records are also saved under `results/`). Numbers carry their set sizes. Where a claim is about something I did NOT establish, it says so.

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
| Not established | Bradbury deployment, fees, the real appeal bond (studionet bond is 0), the connector's twice-UNDETERMINED path on chain (see `REPORT-phase5.md`), a single-model comparison number (harness built, run needs a provider key) |

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
