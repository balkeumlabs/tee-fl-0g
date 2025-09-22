/* eslint-disable no-console */
// scripts/make_market_manifest.js
// Usage:
// node scripts/make_market_manifest.js --epoch 3 --globalModelPath aggregated_model.json --cid <cid> --url <url> --attestation attestation.json [--out market_manifest.json]
// Computes globalModelHash (sha256 of file contents), embeds contracts and commit SHA, prints path to manifest.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import crypto from "node:crypto";

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i+1] : undefined;
}

const epoch = Number(argVal("--epoch"));
const modelPath = argVal("--globalModelPath") ?? "aggregated_model.json";
const cid = argVal("--cid") ?? "";
const url = argVal("--url") ?? (cid ? `ipfs://${cid}` : "");
const out = argVal("--out") ?? "market_manifest.json";
const attestPath = argVal("--attestation");

// // Compute model hash
const modelBytes = readFileSync(modelPath);
const globalModelHash = "0x" + crypto.createHash("sha256").update(modelBytes).digest("hex");

// // Contracts (defaults; override by env if needed)
const AccessRegistry = process.env.ACCESS_REGISTRY ?? "0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e";
const EpochManager  = process.env.EPOCH_MANAGER  ?? "0x9341619f6B889A12bbb90BbE366405ce363Ab779";
const chainId = Number(process.env.CHAIN_ID ?? 16601);

// // Commit SHA
let commit = "";
try { commit = execSync("git rev-parse HEAD").toString().trim(); } catch {}

// // Optional attestation hash
let attestationHash = "";
if (attestPath) {
  const a = readFileSync(attestPath);
  attestationHash = "0x" + crypto.createHash("sha256").update(a).digest("hex");
}

// // Manifest
const manifest = {
  epoch,
  network: { chainId, rpc: process.env.RPC_ENDPOINT ?? "https://evmrpc-testnet.0g.ai" },
  contracts: { AccessRegistry, EpochManager },
  artifacts: {
    globalModelPath: modelPath,
    globalModelHash,
    globalModelCid: cid || null,
    globalModelUrl: url || null
  },
  provenance: {
    commit,
    attestationHash: attestationHash || null,
    createdAt: new Date().toISOString()
  }
};

writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(out);