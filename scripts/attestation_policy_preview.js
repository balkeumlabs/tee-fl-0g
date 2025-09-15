/* scripts/attestation_policy_preview.js */
const fs = require("fs");
function loadJson(p){ return JSON.parse(fs.readFileSync(p, "utf8")); }
function decide(policy, ev) {
  const why = [];
  if (policy.enforce_debug && ev.debug === true) why.push("debug build not allowed");
  if (policy.allowed_signers && !policy.allowed_signers.includes(ev.signer)) why.push("signer not allowed");
  if (policy.allowed_measurements && !policy.allowed_measurements.includes(ev.measurement)) why.push("measurement not allowed");
  if (typeof policy.min_isvsvn === "number" && ev.isvsvn < policy.min_isvsvn) why.push("isvsvn below minimum");
  return { ok: why.length === 0, why };
}
const policyPath = process.argv[2] || "attestation/policy.json";
const evidencePath = process.argv[3] || null;
const policy = loadJson(policyPath);
const out = { policy: { ...policy, notes: policy.notes || "" } };
if (evidencePath && fs.existsSync(evidencePath)) {
  const ev = loadJson(evidencePath);
  const res = decide(policy, ev);
  out.decision = { input: ev, ...res };
}
console.log(JSON.stringify(out, null, 2));
