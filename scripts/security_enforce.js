/* security_enforce.js
// Enforce client-side encryption + optional scrubbing of plaintext artifacts.
// Usage:
//  const sec = require("./security_enforce");
//  sec.requireEncEnv();
//  await sec.assertEncryptedJson("client_update.enc.json");
//  await sec.maybeScrubPlaintext({ fix: process.env.FL_ENC_DELETE_PLAINTEXT === "1" });
*/
const fs = require("fs");
const path = require("path");

function requireEncEnv() {
  // Ensure a TEE public key is present to encrypt-to (policy: no plaintext allowed).
  if (!process.env.FL_TEE_PUBKEY_B64 || !process.env.FL_TEE_PUBKEY_B64.trim()) {
    throw new Error("FL_TEE_PUBKEY_B64 missing; encryption required for all submissions.");
  }
}

async function assertEncryptedJson(p) {
  // Heuristic check: filename *.enc.json and JSON contains enc/ciphertext/nonce/epk
  if (!/\.enc\.json$/i.test(p)) {
    throw new Error(`Expected an encrypted update (*.enc.json); got: ${p}`);
  }
  const raw = await fs.promises.readFile(p, "utf8");
  let j;
  try { j = JSON.parse(raw); } catch { throw new Error("Encrypted file is not valid JSON."); }
  const ok = j.enc || (j.ciphertext && j.nonce && (j.epk || j.header?.epk));
  if (!ok) {
    throw new Error("Encrypted JSON missing fields (enc/ciphertext/nonce/epk).");
  }
}

async function maybeScrubPlaintext(opts = {}) {
  // If fix=true, move plaintext client updates to .quarantine/
  const fix = !!opts.fix;
  const root = process.cwd();
  const plainGlob = [
    "client_update*.json",
    "aggregated_model_round*.json"
  ];

  const candidates = new Set();
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === ".git" || e.name === "node_modules" || e.name === ".quarantine") continue;
        walk(p);
      } else {
        if (/client_update.*\.json$/i.test(e.name) && !/\.enc\.json$/i.test(e.name)) candidates.add(p);
        if (/aggregated_model_round.*\.json$/i.test(e.name)) candidates.add(p);
      }
    }
  }
  walk(root);

  if (!candidates.size) return { moved: [] };

  if (!fix) {
    const list = [...candidates].map(p => path.relative(root, p));
    throw new Error(`Plaintext artifacts detected (set FL_ENC_DELETE_PLAINTEXT=1 to auto-quarantine):\n${list.join("\n")}`);
  }

  const qdir = path.join(root, ".quarantine");
  if (!fs.existsSync(qdir)) fs.mkdirSync(qdir);
  const moved = [];
  for (const p of candidates) {
    const dest = path.join(qdir, path.basename(p));
    fs.renameSync(p, dest);
    moved.push(dest);
  }
  return { moved };
}

module.exports = { requireEncEnv, assertEncryptedJson, maybeScrubPlaintext };
