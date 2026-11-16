# SERVER-STEPS: turn on the AgentFeed SLA receipt signer

Status: NOT DEPLOYED. Nothing here has been run on the VPS. The SLA court's demo cases use a stand-in seller key because this step has not happened.
Everything below runs from the Mac with `ssh solwatch '...'` (the VPS is `root@solwatch`). Do the steps in order, one block at a time.

What changes on AgentFeed: one new file `lib/sla-signer.cjs`, one new `app.use(...)` line in `server.js`, one new env var pair in `.env`.
With `SLA_SIGN` unset or not `1` the middleware is a pass-through: it does not wrap `res.end`, and the paid flow is byte-identical.
With it on, a paid, settled, HTTP 200 answer of `/api/sol-price`, `/api/btc-price` or `/api/funding-rate` gets one extra response header, `X-SLA-Receipt`. Body, status and all other headers are unchanged. Any error while signing is swallowed and the original answer is sent.

Tested so far: the signer module (9 tests, including a check of its signature by the court's own python verifier) and the step 3 `sed` edit, run on a scratch copy of server.js in /tmp on the VPS (one match, `node --check` passed, scratch file removed). UNTESTED: steps 1, 2, 4 and 5 on the live box, and the interplay with the live x402 gate. Step 5 is the test that settles it.

## 0. Gate (do not skip)

~~~
ssh solwatch 'grep MemAvailable /proc/meminfo; pm2 describe agentfeed | grep -E "status|restarts|exec cwd"; cd /opt/agentfeed && git status --short | head -5'
~~~

MemAvailable must be at least 1500000 kB. The box's git history diverged from origin in Sep 2026: compare files, never SHAs. Do not `git pull` here.

## 1. Upload the module and check its hash before installing

On the Mac, in the iussum-genlayer repo:

~~~
shasum -a 256 sla/agentfeed-signer/sla-signer.cjs
scp sla/agentfeed-signer/sla-signer.cjs solwatch:/tmp/sla-signer.cjs
ssh solwatch 'sha256sum /tmp/sla-signer.cjs; wc -c /tmp/sla-signer.cjs'
~~~

The two hashes must match and the size must be non-zero. Then:

~~~
ssh solwatch 'install -m 0644 /tmp/sla-signer.cjs /opt/agentfeed/lib/sla-signer.cjs && node --check /opt/agentfeed/lib/sla-signer.cjs && echo ok'
~~~

## 2. Make the signing key on the box (the private seed never leaves it, never goes in chat)

~~~
ssh solwatch 'cd /opt/agentfeed && umask 077 && [ ! -e .sla-signer.seed ] && node -e "process.stdout.write(require(\"crypto\").randomBytes(32).toString(\"hex\")+\"\\n\")" > .sla-signer.seed; ls -l .sla-signer.seed; wc -c .sla-signer.seed'
~~~

Expected: mode `-rw-------`, 65 bytes. Print ONLY the public key (the court pins this):

~~~
ssh solwatch 'cd /opt/agentfeed && node -e "
const s=require(\"./lib/sla-signer.cjs\"),c=require(\"crypto\");
const seed=require(\"fs\").readFileSync(\".sla-signer.seed\",\"utf8\").trim();
const k=c.createPrivateKey({key:Buffer.concat([Buffer.from(\"302e020100300506032b657004220420\",\"hex\"),Buffer.from(seed,\"hex\")]),format:\"der\",type:\"pkcs8\"});
console.log(s.b58encode(c.createPublicKey(k).export({format:\"der\",type:\"spki\"}).subarray(12)));"'
~~~

Keep that base58 string: it is the `seller_key` constructor argument of the SLA court. The court is deployed fresh with it (or the owner redeploys); the stand-in key in the demo is replaced.

## 3. Mount it in server.js

Back the file up, then insert one line directly BEFORE `app.use(skipForKey(x402v1.challengeBody));` (currently server.js line 220), so the wrapper sits outside both the v1 layer and the x402 v2 gate and is the `end()` they finally call after settlement:

~~~
ssh solwatch 'cd /opt/agentfeed && cp server.js server.js.bak-pre-sla-$(date +%Y%m%dT%H%M%SZ) && grep -c "app.use(skipForKey(x402v1.challengeBody));" server.js'
~~~

Expect `1`. Then (BSD sed is not involved, this runs on the VPS):

~~~
ssh solwatch 'cd /opt/agentfeed && sed -i "s|^app.use(skipForKey(x402v1.challengeBody));|app.use(require(\"./lib/sla-signer.cjs\").slaSigner({ enabled: process.env.SLA_SIGN === \"1\", seedHex: process.env.SLA_SIGN_SEED_FILE ? require(\"fs\").readFileSync(process.env.SLA_SIGN_SEED_FILE, \"utf8\").trim() : \"\" }));\n&|" server.js && node --check server.js && grep -n "sla-signer" server.js'
~~~

## 4. Turn the flag on and reload (PM2 trap: restart does not reload .env)

~~~
ssh solwatch 'cd /opt/agentfeed && printf "SLA_SIGN=1\nSLA_SIGN_SEED_FILE=/opt/agentfeed/.sla-signer.seed\n" >> .env && pm2 describe agentfeed | grep -E "script path|exec cwd|args"'
~~~

Note the script path, cwd and any inline env from `pm2 describe`, then `pm2 delete agentfeed`, start it again the same way, `pm2 save`. Use the `vps-ops` procedure; do not use `pm2 restart`.

## 5. Check, in this order

1. `curl -s https://x402.ochinimus.app/api/status` still `ok:true`, and `/api/sample/sol-price` unchanged.
2. One paid call from the QA payer (Gack9, `/opt/agentfeed/test-client.mjs`, `$0.001`) on `/api/sol-price`: the response must carry `X-SLA-Receipt` (base64 JSON with `tx_sig`, `served_at`, `body_sha256`, `signature`), and the body must be what it was before.
3. Verify that receipt with the court's own verifier: decode the header, drop `signature`, check ed25519 over `"iussum-sla/0.1 receipt\n" + canonical JSON`. `tests/sla/signer.test.mjs` shows the python check against the court's library functions.
4. Unpaid and error paths: a request without payment (402) and a 400 must carry no `X-SLA-Receipt`.

## Rollback

~~~
ssh solwatch 'cd /opt/agentfeed && sed -i "/sla-signer.cjs/d" server.js && node --check server.js && sed -i "/^SLA_SIGN/d" .env'
~~~

Then `pm2 delete agentfeed` and start it again as in step 4. The flag alone is a faster off switch: set `SLA_SIGN=0`, delete and start again.

## What this does not do

It does not sign the other 90+ routes, does not touch the payment, settlement or `calls` table code, and does not publish the key anywhere. The seller key in the court is a deploy-time argument; rotating it means deploying a new court instance.
