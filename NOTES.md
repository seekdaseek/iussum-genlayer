# NOTES: sources for every name used in phase 0

Read 2026-11-12. "docs:N" means line N of https://docs.genlayer.com/full-documentation.txt
as downloaded that day (1,072,148 bytes, 24,805 lines). "skill:N" means line N of
https://raw.githubusercontent.com/genlayerlabs/skills/77631f764dc7b69deddd9998be85c802111c2670/plugins/genlayer-dev/skills/write-contract/SKILL.md .
"cli-skill" is `.../skills/genlayer-cli/SKILL.md` at the same commit.
"Ran" says whether the name was executed here and what happened.

## Sources read

| Source | Result |
|---|---|
| https://docs.genlayer.com/full-documentation.txt | 200, read sections Networks, Optimistic Democracy, Equivalence Principle (both pages), Appeals, Finality, Economic model, Non-determinism, Calling LLMs, Web Access, First Contract, Deploying, Network Configuration, Prompt Injection, Consensus v0.6 Migration |
| https://sdk.genlayer.com/main/ | 200. It is the GenVM spec site. `genindex.html` has no entry for any Python API name below, so names come from the docs and the skill and are confirmed by execution. `impl-spec/04-fees.html` read for fee formulas |
| genlayerlabs/skills @ 77631f7 (2026-10-21) | write-contract and genlayer-cli skills read in full |
| https://raw.githubusercontent.com/internet-court/internet-court-skill/main/README.md | 200, 208 lines. No evidence format; "Solana" appears only in the Execution row and vendored table |

## Contract-side names

| Name | Source | Ran |
|---|---|---|
| `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` (runner pin, first line) | docs:4309, skill:24 | yes, deploy accepted on studionet |
| `py-genlayer:test` / `:latest` rejected on all networks | skill:19 | UNTESTED (not tried) |
| `from genlayer import *` | docs:4316 | yes |
| `class X(gl.Contract)` | docs:4327 | yes |
| `@gl.public.view`, `@gl.public.write` | docs:4329 | yes |
| storage types `str`, `u256` as class-level annotations | docs:4347, skill:314 | yes |
| `gl.nondet.exec_prompt(prompt, response_format="json")` | docs:3598, docs:3725 | yes, returns a dict |
| `gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` | docs:3406, docs:3503 | yes |
| `gl.vm.Return`, `leaders_res.calldata` | docs:3431, docs:3579 | yes |
| `gl.vm.UserError` | docs:5333, skill:268 (docs:3694 writes `gl.UserError`; both forms appear) | `gl.vm.UserError` compiled; raise path not hit |
| `gl.eq_principle.strict_eq(fn)` | docs:3466 | yes |
| `gl.eq_principle.prompt_comparative`, `prompt_non_comparative` | docs:3480, docs:3491 | UNTESTED |
| `gl.nondet.web.get(url)` → `.body` (bytes) | docs:3401, docs:3892 | yes |
| `gl.nondet.web.post(url, body=bytes, headers=dict)` | skill:491 (docs only show `web.request(url, method='POST', body={})`, docs:3830) | yes, `web.post` ran |
| response status field: docs say `.status_code` (docs:3835), skill says `.status` (skill:267) | disagreement | contract accepts either via getattr; an integer status came back (200/403/429). Which attribute supplied it is UNTESTED |
| `gl.nondet.web.render(url, mode='html')` | docs:3848 | ran. example.com: SUCCESS but marker not found in `str(result)` (return type unverified). explorer.solana.com: contract_error |
| `gl.nondet.web.render(url, mode='screenshot')`, `images=[...]` (limit two) | docs:3862, docs:3647 | UNTESTED |

## Client-side names (genlayer-js 1.1.8, npm `latest`)

| Name | Source | Ran |
|---|---|---|
| `createClient({chain, account})`, `createAccount(key)`, `generatePrivateKey()` | docs:4271, docs:10190; exports listed from the installed package | yes |
| `chains.studionet` (61999, https://studio.genlayer.com/api) | installed package; docs:1689 | yes |
| `client.deployContract({code, args})` | docs:6099 | yes |
| `client.writeContract({address, functionName, args, value})` | docs:2679 | yes |
| `client.readContract({address, functionName, args, jsonSafeReturn})` | docs:15851 | yes |
| `client.getTransaction({hash})` → `statusName`, `consensus_data.votes` | docs:9178 | yes |
| `client.canAppeal`, `getMinAppealBond`, `appealTransaction({txId, value})` | installed package types (docs:887 shows the 2.0 form `getAppealCharge`) | `appealTransaction` ran; `getMinAppealBond` throws on studionet: "Appeal bond calculation not supported on this chain"; `canAppeal` throws "canAppeal not supported on this chain (missing appealsContract)" |
| raw RPC `gen_getTransactionStatus`, `gen_getContractSchema`, `eth_getTransactionByHash` | docs:1117 | yes on studionet |
| raw RPC `gen_getTransactionReceipt`, `gen_getContractState` | docs:1117, docs:14341 | studionet: -32601 method not found |

## CLI

`genlayer` 0.39.2 (npm `latest`) installed locally, used only for `genlayer network list`:
localnet, studionet, testnet-asimov, testnet-bradbury. Docs list no Asimov at all (0 matches);
cli-skill lists it. Tested: `https://rpc-asimov.genlayer.com` returns Cloudflare 522.
RC tags exist: genlayer 0.40.0-rc.6, genlayer-js 2.0.0-rc.3 (docs:1768-1775 call these the v0.6 family).

## Networks probed 2026-11-12

| Network | Chain id | GenLayer RPC | Result |
|---|---|---|---|
| studionet | 61999 (0xf22f) | https://studio.genlayer.com/api | live, deploy + writes work, balance 0 |
| studio-dev | 61997 (0xf22d) | https://studio-dev.genlayer.com/api | answers eth_chainId; not deployed to (needs RC tooling, docs:1711) |
| testnet Bradbury | 4221 (0x107d) | https://rpc-bradbury.genlayer.com (from genlayer-js 1.1.8 preset) | live, block 0 hash 0x17d89764…df97e4 matches docs:1675, answers gen_* methods. Chain RPC https://rpc.testnet-chain.genlayer.com is live but has no gen_* methods (as docs:1656 says) |
| testnet Asimov | 4221 | https://rpc-asimov.genlayer.com | 522, dead |

Bradbury SDK mismatch: genlayer-js 1.1.8 `testnetBradbury.consensusMainContract` = 0x0112Bf6e…271D has NO code on the current chain. genlayer-js 2.0.0-rc.3 uses 0x2E2766cb…A019, which has code, but its preset RPC is the chain RPC that lacks gen_* methods. AddressManager 0x3F71AE08…38E0 (docs:1675) has code.

## Rules that shaped the probe

- Custom leader/validator pair is the recommended pattern; validator must re-run and compare decision fields (docs:5227, docs:5294-5339, skill:164).
- Storage writes only after the nondet block (docs:3413).
- Rate limit on studionet: 60 req/min, 1000/hr, 10000/day per IP; 32 in-flight txs per sender (cli-skill).
- Accepted is not final and is not execution success (docs:1098-1102, docs:1819-1822).
