// === SECURITY_ENFORCE_PREAMBLE (auto) ===
const sec = require("./security_enforce");
sec.requireEncEnv();
(async () => {
  try {
    const argv = process.argv.slice(2);
    const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
    let inPath = getArg("--in") || getArg("--input") || getArg("-i");
    if (!inPath) {
      const guess = argv.find(a => /\.enc\.json$/i.test(a));
      if (guess) inPath = guess;
    }
    if (inPath) { await sec.assertEncryptedJson(inPath); }
    await sec.maybeScrubPlaintext({ fix: process.env.FL_ENC_DELETE_PLAINTEXT === "1" });
  } catch (e) {
    console.error("[enforce]", e && e.message ? e.message : e);
    process.exit(1);
  }
})();
// === /SECURITY_ENFORCE_PREAMBLE ===
if (process.env.NO_TX === '1') {
  console.log('// NO_TX set; preambles passed (submit).');
  process.exit(0);
}
// === SEC_ENFORCE_FILEPATH (auto) ===
(() => {
  try {
    const argv = process.argv.slice(2);
    const attIdx = argv.indexOf("--attestation");
    const core = attIdx >= 0 ? argv.slice(0, attIdx) : argv;
    const cand = [...core].reverse().find(a => /\.json$/i.test(a));
    if (cand && !/\.enc\.json$/i.test(cand)) {
      throw new Error("Expected encrypted *.enc.json as filePath; got: " + cand);
    }
  } catch (e) { console.error("[enforce]", e && e.message ? e.message : e); process.exit(1); }
})();
// === /SEC_ENFORCE_FILEPATH ===
//

//
// === ATTESTATION_ENFORCE_PREAMBLE (auto) ===
const { spawnSync } = require("child_process");
(function(){
  const argv = process.argv.slice(2);
  const getArg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i+1] : null; };
  const att = getArg("--attestation");
  if (!att) { console.error("[attest] Missing --attestation <file>"); process.exit(1); }
  const path = require("path");
  const allow = process.env.TEE_ATTEST_MEAS_ALLOWLIST || path.join(__dirname, "attestation_allowlist.json");
  const res = spawnSync(process.execPath, [path.join(__dirname,"attestation_enforce.js"), "--attestation", att, "--allowlist", allow], { stdio: "inherit" });
  if (res.status !== 0) { console.error("[attest] enforcement failed"); process.exit(1); }
})();
// === /ATTESTATION_ENFORCE_PREAMBLE ===
// scripts/submit_update_raw.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const rpc = process.env.RPC_ENDPOINT, pk = process.env.PRIVATE_KEY;
  const epochAddr = process.argv[2];            // EpochManager address
  const epochId   = parseInt(process.argv[3]);  // Epoch id
  const cid       = process.argv[4];            // Storage CID (string)
  const filePath  = process.argv[5];            // Path to update file
  if (!rpc || !pk) throw new Error('Missing RPC_ENDPOINT or PRIVATE_KEY in .env');
  if (!epochAddr || !epochId || !cid || !filePath) {
    console.log('Usage: node scripts/submit_update_raw.js <EpochManager> <epochId> <cid> <filePath>');
    process.exit(1);
  }

  // Compute SHA-256 of the file
  const buf = fs.readFileSync(filePath);
  const hashHex = crypto.createHash('sha256').update(buf).digest('hex');
  const hashBytes32 = '0x' + hashHex;          // 32-byte hex

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);

  const art = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json','utf8'));
  const c = new ethers.Contract(epochAddr, art.abi, wallet);

  console.log('// file:', filePath);
  console.log('// sha256:', hashBytes32);
  console.log('// cid:', cid);

  const tx = await c.submitUpdate(epochId, cid, hashBytes32);
  console.log('// submitUpdate tx:', tx.hash);
  await tx.wait();
})();




