/* eslint-disable no-console */
// scripts/attestation_embed.js
// Usage: node scripts/attestation_embed.js <attestation.json>
// Prints {"attestationHash":"0x..."} to stdout
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const p = process.argv[2];
if (!p) {
  console.error("Usage: node scripts/attestation_embed.js <attestation.json>");
  process.exit(2);
}
const raw = readFileSync(p);
const hash = "0x" + crypto.createHash("sha256").update(raw).digest("hex");
console.log(JSON.stringify({ attestationHash: hash }, null, 2));