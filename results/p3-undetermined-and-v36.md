# Phase 3 items 3 and 4 (computed from results/rows.jsonl, 270 rows with a tx)

UNDETERMINED (status after 3 rotations, no result stored), by set:

| Set | Rows | UNDETERMINED |
|---|---|---|
| A (replay, vectors) | 84 | 0 |
| B (drift) | 75 | 0 |
| C (adversarial, first runs) | 20 | 2 (C-17, C-20) |
| BT1 (clear B on the tuned prompt) | 20 | 1 (B-18-off) |
| CT1, R, T, U, phase1.5, probe, gap-probe | 20, 12, 9, 9, 12, 6, 3 | 0 |
| All | 270 | 3 (1.1%) |

All three had 3 rotations and 4 rounds with 3 `disagree` votes. In none of the three was a later run of the same bundle UNDETERMINED (C-17: appeal re-submissions gave in_scope, in_scope, purpose_mismatch; C-20 three in_scope; B-18-off 3 of 3 correct on the untuned prompt). Every UNDETERMINED row is a model-path case; no plain-code or refusal row ever was. The 13 appeal re-submissions are not in the table (they are in appeals.jsonl; none was UNDETERMINED).

Vector 36 (no receipt, nothing out of scope on chain; iussum: invalid/principal/in_scope). Court answers: could_not_decide, could_not_decide, in_scope.
Why, from the stored reasoning: the bundle I converted had no receipt and a neutral purpose that says "the API resource requested at the receipt's resource URL", so the model was shown a purpose that points at a receipt that is not there and, in runs 1 and 2, said so ("no actual resource ... resource: null ... no evidence of what specific API resource was requested"). Run 3 answered in_scope by leaning on the synthetic delivered text "Resource delivered as requested", which is unsigned and is no longer shown to the model after the phase 3 fix. The cause is the converted bundle (a synthetic purpose that needs a receipt, on a vector that has none), not the court's bundle format; the contract is left alone.
