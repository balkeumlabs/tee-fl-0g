/* Kubo-compatible uploader: supports Bearer or Basic Authorization.
   Env:
     OG_STORAGE_API_BASE   (e.g., https://ipfs.infura.io:5001 or https://<host>)
     OG_STORAGE_API_TOKEN  (optional; if starts with "Basic " uses Basic, else Bearer)
     OG_GATEWAY_BASE       (e.g., https://infura-ipfs.io/ipfs)
*/
import { readFile } from "node:fs/promises";

const base   = process.env.OG_STORAGE_API_BASE || "";
const token  = (process.env.OG_STORAGE_API_TOKEN || "").trim();
const gwBase = process.env.OG_GATEWAY_BASE || "";

if (!base) {
  console.error("OG_STORAGE_API_BASE is empty");
  process.exit(2);
}

const authHeader = token
  ? (token.toLowerCase().startsWith("basic ") ? token : `Bearer ${token}`)
  : null;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node scripts/upload_ipfs_api.js <file>");
    process.exit(2);
  }
  const buf = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([buf]), filePath);

  const headers = {};
  if (authHeader) headers["Authorization"] = authHeader;

  const url = new URL("/api/v0/add", base).toString();
  const res = await fetch(url, { method: "POST", headers, body: form });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${res.statusText}\n${body}`);
  }

  const text = await res.text();
  // Kubo may return one or more NDJSON lines; take the last JSON line
  const lastLine = text.trim().split(/\r?\n/).filter(Boolean).pop() || "{}";
  let cid = null;

  try {
    const j = JSON.parse(lastLine);
    cid = j.Hash || (j.Cid && (j.Cid["/"] || j.Cid["/cid"]));
  } catch (_) { /* fallthrough */ }

  if (!cid) throw new Error(`No CID in response: ${lastLine}`);

  const out = {
    cid,
    size: buf.byteLength,
    url: gwBase ? `${gwBase.replace(/\/+$/,"")}/${cid}` : `ipfs://${cid}`
  };
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
