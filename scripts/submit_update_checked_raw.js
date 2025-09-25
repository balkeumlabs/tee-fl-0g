/* scripts/submit_update_checked_raw.js */
const { spawnSync } = require("child_process");
const path = require("path");

function runNode(scriptPath, args) {
  const proc = spawnSync(process.execPath, [scriptPath, ...args], { stdio: "inherit", env: process.env });
  return proc.status ?? proc.signal ?? 1;
}

const args = process.argv.slice(2);
const attScript = path.resolve(__dirname, "attestation_enforce.js");
const submitScript = path.resolve(__dirname, "submit_update_raw.js");

// 1) Attestation gate (honors ATTESTATION_ENFORCED, ATT_ALLOWLIST_PATH)
const attStatus = runNode(attScript, []);
if (attStatus !== 0) {
  process.exit(attStatus);
}

// 2) Submit (re-use submit_update_raw.js with original args)
const subStatus = runNode(submitScript, args);
process.exit(subStatus);


