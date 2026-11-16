# REPORT-web: public page for the GenLayer Portal

## Result
- **Live URL:** https://mandatecourt.ochinimus.app (HTTPS via Cloudflare, HTTP 200, security headers and a CSP that allows only this origin and the studionet RPC).
- **Logo:** `web/logo.png`, 1024 x 1024 PNG (also served at https://mandatecourt.ochinimus.app/logo.png); drawn by `scripts/mklogo.py`.
- **Both required runs, done from the live page in a real browser (Brave), each with its own throwaway account:**

| Case | GenLayer tx (explorer-studio) | Final triple | Matches recorded expectation | Time to FINALIZED |
|---|---|---|---|---|
| rr-1-seller-overcap | [`0x5f127c883f3e4bd0a383be3a2137d74491ebf602a7a526cc174515833b5a8a15`](https://explorer-studio.genlayer.com/tx/0x5f127c883f3e4bd0a383be3a2137d74491ebf602a7a526cc174515833b5a8a15) | valid / seller / amount_over_cap (plain code, delta shown) | yes | 43 s |
| rr-2-onpurpose | [`0x8d61a725c4cd3e361122a2bf261a5ff45bb778280bcb2af548c886e3e76c1b73`](https://explorer-studio.genlayer.com/tx/0x8d61a725c4cd3e361122a2bf261a5ff45bb778280bcb2af548c886e3e76c1b73) | invalid / principal / in_scope (model jury, 3 agree, 2 idle) | yes | 51 s |

Both ran on the shared instance `live4-a` `0xc33059A88dFD4602d0D0cc2403Cf5C3a94Dc0B5e` (`chain_source=rpc`).

## Portal text
One-liner (171 characters):

> A GenLayer jury that decides if an AI agent's in-limit Solana payment still matched what the person asked for. Fixed answers, 0 of 63 injection runs flipped after the fix.

Description (999 characters):

> MandateCourt is a GenLayer Intelligent Contract that answers one question deterministic rules cannot: an AI agent paid on Solana inside every limit the person signed; was it still what the person asked for? Plain code checks the bundle, the receipt signature and the scope limits first. Validators then read the payment and the signed grant from Solana devnet and must agree on them. Five validators, each running a different model, see only text a party signed (the purpose, the chain facts, the seller's signed receipt) and agree on one of four fixed answers: verdict, liable party, reason. Unsure means could_not_decide. The page lets you judge eight recorded live devnet cases on studionet with a throwaway browser account and shows the transaction lifecycle, the result and the explorer link. Measured: 0 of 63 injection runs flipped toward the attack after a design fix (a single model without a jury flipped 2 of 63); 60 of 60 clear drift cases correct. Source, tests and evidence are public.

## What I built
`web/index.html`, `app.js`, `lib.mjs`, `style.css`, `cases.json`, `vendor/genlayer.js` (genlayer-js 1.1.8 bundled for the browser with esbuild), `contract/mandate_court.py` (the copy the page redeploys), `server.mjs` + `serve.mjs` (zero-dependency static server). The page: throwaway studionet account in `localStorage` (try/catch, in-memory fallback), a picker of the 8 recorded cases with their Solana devnet grant and payment links, a "Judge this case" button, a live timeline (PENDING, PROPOSING, COMMITTING, ACCEPTED, FINALIZED with elapsed seconds and the explorer link; a provisional result is shown at ACCEPTED), then verdict / liable / reason, the delta, the model's stored reasoning, leader model, votes, and whether the result matches the recorded expectation. A five-line "how it works" block sits at the top. If the instance is gone or does not pin the seller's key, the page says so and redeploys the court (the way `scripts/demo.mjs` does), then judges. An UNDETERMINED result is resubmitted once and a second one is shown as `could_not_decide / none / no_consensus` (the connector rule).

Tests first (commits show it): 20 node tests for the page logic (`tests/web/lib.test.mjs`: canonical JSON and sha256 equal the Node runner's, bundle equals the demo's, tag validity, the UNDETERMINED rule equals `scripts/connector-lib.mjs`, instance-usability check), the static server (path traversal, encoded traversal, dotfiles, malformed escapes, mime and headers), its PM2-style entry point, and cache-busting versions. The existing suites still pass.

## Hosting: the route I chose
Cheapest route that matches the existing setup: a static site behind its own Cloudflare tunnel on the VPS, like the other `*.ochinimus.app` services. Alternative considered: GitHub Pages (no VPS), not used because you named the VPS route.
- `/opt/mandatecourt/` with the page in `web/`; PM2 `mandatecourt` (port 3044, 20 MB) and `mandatecourt-tunnel`; named tunnel `mandatecourt`, config `/root/.cloudflared/mandatecourt.yml`, DNS `mandatecourt.ochinimus.app` (CNAME created with `cloudflared tunnel route dns`). Both PM2 processes were started with delete + start + save, never restart. `ochinimus.app` itself and every other hostname were not touched.
- MemAvailable at the two starts: 1,552 MB and 1,501 MB (rule: at least 1,500). The second was one MB over the line, and the box was at 1,634 MB before I began. Anything else started on the VPS soon will not have headroom.
- Mistake caught: the first `route dns mandatecourt ...` call attached the new hostname to another existing tunnel (the config default) for about 20 seconds; I re-pointed it by explicit tunnel id with `--overwrite-dns` and confirmed the output named the new tunnel (`262727e2...`). No existing hostname was affected.
- Mistake caught: the first PM2 start sat online but not listening (the entry check compared `argv[1]` with the script path, which PM2 changes); fixed with a separate entry file and a test that reproduces PM2's argv.
- Finding: Cloudflare rewrote the origin's `no-cache` on `.js` and `.json` files to `max-age=14400`, so a browser kept the old `app.js` after a redeploy. Fix: every asset URL now carries `?v=<content hash>` (`scripts/stamp-web.mjs`, run by `npm run web:build`). Deploy is a tar copy of `web/` to `/opt/mandatecourt/web`, no PM2 restart needed.

## Verification, and what is not verified
- Verified live: page load, both required runs above, and, after the last two code changes (provider prefix stripped from the displayed model label, versioned asset URLs): real-5 and real-6 end to end on the live URL, both matching their recorded expectations. rr-1 and rr-2 ran on the version just before those two changes; the judging code did not change.
- Verified live: the redeploy path. I pointed the browser at a non-existent instance address; the page showed the notice, deployed the court (39 s), judged real-6 on it and returned `valid / agent_operator / pay_to_not_allowed`, matching. I then cleared that test value.
- **Not verified:** the UNDETERMINED resubmit path inside the page (unit-tested through the shared rule, never occurred live); the layout on a phone (the CSS is responsive, I did not look at a phone screen); other browsers than Brave.
- The recorded expectation for real-1 to real-4 (no seller receipt) is `could_not_decide`, the shipping contract's recorded answer, with the earlier expectation shown in the case description. Those four are the cases the court cannot judge without a signed receipt.
- Studionet is documented as temporary and the page depends on it and on the public Solana devnet RPC (the rate limit seen earlier applies). A first visit after a studionet reset costs about a minute more.
- The page shows model labels as the network reports them (provider prefix removed). A visitor who opens the explorer sees whatever the network shows there.

## Repo
README has a "Web page" section and a first-screen link; pushed to the public repo `seekdaseek/iussum-genlayer`, authored `seekdaseek`, no trailers. gitleaks over the full history exits 0 with the existing ignore file.
