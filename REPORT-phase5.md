# REPORT phase 5: close the grant gaps

Date 2026-11-13. Studionet and Solana devnet. No mainnet, no real spend, no Docker. All commits authored `seekdaseek`, tests first for every code change (commit messages say so). 161 pytest tests (152 contract, 8 control harness, 1 dry run) and 16 node tests pass.

## 1. Single-model control: harness built, comparison NOT run

`controls/single_model.py` builds the control: it takes the prompt, the evidence builder and the closed-answer cleaner **from the contract file itself** (it parses `contracts/mandate_court.py` and executes only the top-level functions and constants; no prompt text is copied; a test asserts the source has none). 8 tests (`tests/control/test_single_model.py`), among them: the control's prompt is **byte-identical** to the prompt the contract sends in direct mode for four Set D bundles (injection, buyer complaint, no-receipt, could_not_decide request). It runs the 38 Set C and Set D bundles that reach the model in the jury runs, 3 runs each (114 calls), calls one model directly with a key read from the environment (never printed), and summarises flips toward the attack and accuracy next to the jury's rows (`results/control.jsonl`, `results/control-summary.json`). A dry run builds the prompts (2,325 characters each for the first bundles).

**I could not run it.** The calls need a provider key. The only key I know of is in a file the Mac's deny rule blocks me from reading, and a check of the environment for credentials was refused by the permission layer, so I stopped as the brief says.

**NEEDS HIM: an OpenAI API key.** Validators use OpenAI models, so a model they also use is available; set `OPENAI_API_KEY` in the shell and run `.venv/bin/python controls/single_model.py --model <model id the key can call>`. It costs roughly 114 short calls. Until then the jury-versus-single-model comparison does not exist, and EVIDENCE.md says so. I do not know which way the result will go.

## 2. One-command demo

`node scripts/demo.mjs` (after `npm install`): judges the recorded live case rr-1 (real devnet payment and grant, receipt signed by iussum's seller gate) on studionet, redeploys the court and says so if it is not there, prints the stored triple, the delta, timing and the explorer link, and states whether it matches the recorded expectation. It writes only to `results/demo-*.json`. Run twice here: run 1 deployed (`0x94C67Fb34815F027E11Fa3f9669F5aBBbF280175`) and returned `valid / seller / amount_over_cap`, court tx `0x91bc3530736567b64c53c9895e4477fa80901c1ac5d6e31fe759f02ed6631e54`, accepted 13.8 s, finalized 44.3 s; run 2 reused the instance, tx `0x2d9e5fb98780b497713e62bfb1ec2de543b13a783f151279a137992f368a063e`, 13.7 s and 43.4 s. The expected output is pasted in the README under "Try it". 6 node tests for the helpers.

## 3. docs/genlayer-feedback.md

16 items, ordered by how much each would have helped, each with the exact error text, versions and the date seen: a comment under the pin line makes a deploy fail silently; devnet 429 to validators under batching and concurrency; the stale Bradbury preset in 1.1.8; the 2.0 RC preset on the chain RPC; missing `gen_` methods on studionet; `canAppeal` / `getMinAppealBond` throwing (so the bond is unmeasurable); appeals re-checking the leader; Asimov listed but dead; direct-mode tests 404 on the default SDK version; HTML pages where JSON is expected; quorum-cancelled validators shown as `ERROR`; unstable model labels; a linter false positive; docs names missing from the released SDK; the faucet claim (**marked unverified: I did not try it**, it was relayed to me); explorer pages unreadable from validators.

## 4. docs/EVIDENCE.md

One section per grant criterion, each claim with a link (file, test name, results row or explorer tx), and a closing "Not established" line per section. Two things the checklist said that I could not support and left out: the 20% builder fee figure (the documentation I read says 10% of time-unit fees and 10% of inflation to the developer) and any statement about a team or an outside user.

## 5. Destructive drill: the resubmit path ran on chain, the twice-UNDETERMINED path did not

Time box 28 minutes. I ran 20 genuinely ambiguous cases (Set B v2 borderline cases that had already drawn disagree votes) through the connector on `live4-b`, one at a time. **3 of 20 ended UNDETERMINED for real** (3 rotations, 4 rounds, 3 `disagree` votes each), the connector resubmitted each once, and each resubmission FINALIZED: B2-26 (`0x907eb7ae…d9ce` then `0x130c2083…4cb0`), B2-22 (`0x008fa7a6…4458` then `0x0437af28…239d`), B2-21 (`0x8ccff941…3c3f` then `0x57303050…54d`); all three ended `invalid/principal/in_scope`, source `genlayer`. Full records in `results/drill/`. Of the 20 runs 3 were `chain_unreachable`, 15 in_scope, 2 purpose_mismatch; 10 had a rotation. **Not exercised: the second UNDETERMINED and the `could_not_decide/none/no_consensus` record**; it did not happen in the time box and I did not fake it. That path remains covered by unit tests only. So UNDETERMINED on the shipping contract is not 0: 3 of 20 on cases written to be ambiguous (and 0 in about 230 earlier runs of the fixed contract on non-ambiguous cases plus 101 B2 first-pass runs).

## 6. Housekeeping

- No vendor or tool names in tracked files: the provider prefix on one model label (it appeared in recorded validator data and prose) was normalised in place across the reports and the results files (a pure label edit, `…/claude-sonnet-4.6` to `claude-sonnet-4.6`; all JSON lines still parse), and one sentence naming the environment's permission layer was reworded. Earlier commits still contain the old text in git history.
- README now has "Try it" and the control and demo tests.
- Still untested: Bradbury, fees, the real appeal bond, the Ghost read, iussum accepting a v0.3 grant memo.
