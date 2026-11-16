# REPORT sla: SLA court for paid APIs

Date 2026-11-16. Studionet writes, mainnet reads only, no spend. No change to AgentFeed or its VPS code.

## Live
- Page: https://mandatecourt.ochinimus.app/sla/ (same static server and PM2 process `mandatecourt`, no new process, no new tunnel; `/sla` redirects to `/sla/`). Checked in Brave: picked sla-2, pressed Judge, FINALIZED in 50 s, refund / stale_data, matches expectation, tx `0xc81677724d5de11e180ea77ecdddb67a7326c10937059b3b6e73baea53139407`.
- Contract: `contracts/sla_court.py`, studionet `0x49838F1Bfe771bDF20186C6c07a8E436680a1e69`, deploy tx `0x117025c42a9de88fcb2ebc76113db45ef096a3116d8a43126b0cf1989d0dcf8c`. genvm-lint passes. 74 contract tests, 9 signer tests, 5 new web tests, all green.

## Case txs and final verdicts (all FINALIZED, judged one at a time)
- sla-1-delivered-ok: `0xabbe0442905323b705f80ba8b93caf36eaac2bf4fe589ce569417a744a918cd0` -> no_refund / delivered_ok (deterministic), leader policy:prd-glm-5.3, rotations 0
- sla-2-stale-data: `0x2615cc654ff325e45cfb6e9151e97826d27d4947c306e96967afbb7c9ceb62fb` -> refund / stale_data (deterministic), leader policy:prd-grok-4.3, rotations 0
- sla-3-schema-mismatch: `0x109aadac9682ecfc7ffd0765893912fe04a5719585323bfe4f0149a5ee330e04` -> refund / schema_mismatch (deterministic), leader policy:prd-gpt-6.1-sol, rotations 0
- sla-4-over-window: `0x7ddadf4b2879278ca3068f41a0005d830025d835f1c78fbc0a3376c227c77190` -> could_not_decide / insufficient_evidence (refusal, payment_outside_window), leader policy:prd-minimax-m3, rotations 0
- sla-5-base-delivered-ok: `0x0045e4178933e8dae087017406277adfeeddd95ccae170a21f628eb188ac2a64` -> no_refund / delivered_ok (deterministic), leader policy:prd-claude-sonnet-4-6, rotations 0
- sla-6-grey-age: `0xfed2a46f8cfa315748ab3ea450ba59a1b6accd3dffe9679ffddda9e80577d9be` -> refund / stale_data (model), leader policy:prd-qwen3.8-27b, rotations 0
- sla-7-wrong-resource: `0xdb45b048d541fc2616953522836b55877c9a1ac925e6412699f509cd1e96f787` -> refund / wrong_resource (deterministic), leader policy:prd-glm-5.3, rotations 0
- sla-6-grey-age: `0x06c1e5f0554f7fe5803f4ab5d82f8e0d40865651273c642b474877ddc488b3dc` -> refund / stale_data (model), leader openai/gpt-6.1-sol, rotations 1
- sla-6-grey-age: `0xaa601beb6db0a1b28b105f229ee8a03e4b776d1cf5fdf2f23bc8f87d240f61fe` -> refund / stale_data (model), leader policy:prd-gemini-3.5-flash-lite, rotations 0

Six of seven cases are decided by plain code. sla-6 (data 300 s old, promise 120 s) went to the jury: 3 of 3 runs refund / stale_data, one needed a rotation. Validators read Solana mainnet and Base public RPC without 429 or disagreement in these 10 runs.
Plain-code endings are `could_not_decide / insufficient_evidence` with a refusal code (sla-4: `payment_outside_window`).

## What is NOT verified
- The signer is NOT deployed. Receipts use a stand-in key; the response bodies are fixtures paired with each payment, not what those calls returned. `sla/SERVER-STEPS.md` has the exact steps for the SERVER chat. Only the step 3 edit was tested, on a scratch copy; the rest of the live path, including the interplay with the x402 gate, is UNTESTED.
- No wrong-payee case on chain: no real treasury-history payment goes to another payee. Wrong payee, wrong mint, low amount are unit tests only. The over-window case is a real payment with a receipt dated a day later.
- The model path ran on one case, 3 runs. No accuracy claim. A mixed 429 between leader and validators is untested.
- The SLA numbers (120 s soft, 600 s hard, funding next-time rule, window 30 s before and 600 s after) are my choices from AgentFeed's schema and `/api/status` conventions, not published AgentFeed SLAs.
- Real Base payer address appears in sla/cases bundle data (public chain data, a third party).
- Not tested: Bradbury, fees, appeals for this contract.

## Evidence URL for the portal
Not the main repo URL: https://github.com/seekdaseek/iussum-genlayer/tree/main/sla (folder link, no new repo created). If the portal refuses it, say so and I will run `gh repo create seekdaseek/sla-court` with a split history.

## 180-char one-liner (168 chars)
SLA court for paid x402 APIs on GenLayer: validators read the USDC payment from chain, check the seller's signed receipt and rule refund, no refund or could not decide.

## Description (852 chars, no parentheses)
A buyer paid an x402 API and says the answer was bad. This GenLayer contract rules refund, no refund or could not decide, with a reason from a closed set. Plain code goes first. Validators read the settled USDC transfer from Solana mainnet or Base and check amount, payee, mint and time window, then verify the seller's ed25519 signed receipt and the hash of the answer. Per tool, delivered is defined in code from the published schema and freshness fields: status, schema, asset named, age of data. Only data older than promised but younger than the hard limit reaches the model jury, which also sees the seller's live status. The buyer's complaint is never shown to a model. Seven cases built on real AgentFeed treasury payments were judged live on studionet, six by plain code and one by the jury in three runs. Reuses the MandateCourt library code.
