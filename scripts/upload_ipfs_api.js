/* eslint-disable no-console */
// scripts/upload_ipfs_api.js
// Node >=18 required (global fetch/FormData/Blob via undici)
// Usage: node scripts/upload_ipfs_api.js <filePath> [--name <fname>]
import { readFileSync } from "node:fs";               // // read file bytes
import { basename } from "node:path";                 // // filename default
import process from "node:process";                   // // read env/args

// // Env configuration (see .env.example)
const API_BASE = (process.env.OG_STORAGE_API_BASE ?? "").replace(/\/$/, "");
const API_TOKEN = process.env.OG_STORAGE_API_TOKEN ?? "";             // // optional Bearer
const GATEWAY_BASE = (process.env.OG_GATEWAY_BASE ?? "").replace(/\/$/, "");

if (!API_BASE) {
  console.error("OG_STORAGE_API_BASE is required");
  process.exit(2);
}

// // CLI parsing
const args = process.argv.slice(2);
if (!args[0]) {
  console.error("Usage: node scripts/upload_ipfs_api.js <filePath> [--name <fname>]");
  process.exit(2);
}
const filePath = args[0];
const nameArgIdx = args.indexOf("--name");
const fileName = nameArgIdx >= 0 && args[nameArgIdx+1] ? args[nameArgIdx+1] : basename(filePath);

// // Build endpoint: accept both ".../api/v0" and base roots
const addPath = /\/api\/v0$/.test(API_BASE) ? `${API_BASE}/add` : `${API_BASE}/api/v0/add`;

// // Construct multipart with undici FormData/Blob (Node 18+)
const bytes = readFileSync(filePath);
const form = new FormData();
form.set("file", new Blob([bytes], { type: "application/octet-stream" }), fileName);
form.set("pin", "true");

// // Auth header only if token provided
const headers = API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};

const resp = await fetch(addPath, { method: "POST", headers, body: form });
// // Some IPFS APIs return NDJSON/text; try JSON first, then parse text
let cid = "", size = 0;
const text = await resp.text();
try {
  const j = JSON.parse(text);
  cid = j.Hash || j.Cid || j.cid || "";
  size = Number(j.Size || j.size || 0) || 0;
} catch {
  // // Fallback: regex extract Hash:"<cid>"
  const m = text.match(/"?(Hash|Cid|cid)"?\s*[:=]\s*"?([a-zA-Z0-9]+)"?/);
  if (m) cid = m[2];
  const s = text.match(/"?(Size|size)"?\s*[:=]\s*"?(\d+)"?/);
  if (s) size = Number(s[2]);
}

if (!resp.ok || !cid) {
  console.error("Upload failed:", resp.status, resp.statusText, text.slice(0, 2000));
  process.exit(1);
}

// // Gateway URL if provided
const url = GATEWAY_BASE ? `${GATEWAY_BASE}/ipfs/${cid}` : `ipfs://${cid}`;

console.log(JSON.stringify({ cid, size, url }, null, 2));