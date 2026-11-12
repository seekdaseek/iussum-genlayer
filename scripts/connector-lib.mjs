// Caller-side rule (not in the contract): an UNDETERMINED case is resubmitted once; if it is UNDETERMINED again the connector records
// could_not_decide/none/no_consensus next to the GenLayer tx ids, so a case never ends with no answer.
export const NO_CONSENSUS = ["could_not_decide", "none", "no_consensus"];
const undetermined = (a) => a.status === "UNDETERMINED";
export function nextStep(attempts) {
  if (attempts.length === 0) return "submit";
  const last = attempts[attempts.length - 1];
  if (undetermined(last) && attempts.length === 1) return "resubmit";
  return "stop";
}
export function outcome(attempts) {
  if (nextStep(attempts) === "resubmit") throw new Error("one UNDETERMINED attempt: resubmit once before asking for an outcome");
  if (nextStep(attempts) === "submit") throw new Error("no attempt yet");
  const last = attempts[attempts.length - 1];
  const txs = attempts.map((a) => a.tx);
  if (last.error) throw new Error("submission error is not an outcome: " + last.error);
  if (undetermined(last)) { const [verdict, liable, reason] = NO_CONSENSUS; return { source: "connector", verdict, liable, reason, attempts: attempts.length, txs }; }
  if (!last.result) throw new Error("finalized attempt without a stored result");
  const [verdict, liable, reason] = last.result;
  return { source: "genlayer", verdict, liable, reason, attempts: attempts.length, txs };
}
