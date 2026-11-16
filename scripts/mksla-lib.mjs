// Pure builder of web/sla/cases.json from sla/cases/*.json and results/sla-rows.jsonl. Tested in tests/web/sla-data.test.mjs.
export const paymentUrl = (c) => (c.network === "solana" ? `https://explorer.solana.com/tx/${c.payment_tx}` : `https://basescan.org/tx/${c.payment_tx}`);
export function slaPageData({ cases, rows, instance }) {
  return {
    instance: instance.address, seller_key: instance.seller_key, deploy_tx: instance.deploy_tx,
    rpc_solana: "https://api.mainnet-beta.solana.com", rpc_base: "https://mainnet.base.org", status_url: "https://x402.ochinimus.app/api/status",
    pay_to_solana: "4a8o45skRPcyjAdyR8yES215Swvh8uTpZD6KLarhxCJ7", pay_to_base: "0x22DB3A9686EE5261e7Bf3ed4f91277232E8076e6",
    cases: cases.map((c) => ({
      id: c.id, title: c.title, network: c.network, tool: c.tool, payment_tx: c.payment_tx, payment_url: paymentUrl(c), chain_facts: c.chain_facts,
      served_at: c.served_at, expected: c.expected, labels: c.labels, bundle_json: c.bundle_json, sha: c.sha,
      recorded: rows.filter((r) => r.case_id === c.id && r.status === "FINALIZED" && r.result)
        .map((r) => ({ tx: r.tx, result: r.result, refusal: r.stored?.refusal ?? null, leader_model: r.leader_model ?? null, votes: r.vote_tally ?? null })),
    })),
  };
}
