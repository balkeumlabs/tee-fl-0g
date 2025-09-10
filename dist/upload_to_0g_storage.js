// // dist/upload_to_0g_storage.js
// // Purpose: Produce CID metadata for artifacts.
// // Modes:
// //   - manual: compute sha256; accept --cid from user after GUI upload; output JSON
// //   - ipfs-api: upload to a Kubo-compatible /api/v0/add endpoint; output JSON with real CID
// // Usage:
// //   node dist/upload_to_0g_storage.js --file <path> --dry-run
// //   node dist/upload_to_0g_storage.js --file <path> --cid <bafy...|Qm...>          // manual mode
// //   node dist/upload_to_0g_storage.js --file <path> --name <name>                  // ipfs-api mode
// // Env (.env):
// //   OG_STORAGE_MODE=manual|ipfs-api
// //   OG_STORAGE_API_BASE=... (ipfs-api only)
// //   OG_STORAGE_API_TOKEN=... (optional; ipfs-api only)
// //   OG_GATEWAY_BASE=... (optional; for pretty URLs)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { sha256 } = require('@noble/hashes/sha256');

function readFileBytes(p) {
  if (!fs.existsSync(p)) throw new Error('File not found: ' + p);
  return fs.readFileSync(p);
}
function sha256Hex(bytes) {
  const dig = sha256(bytes);
  return Buffer.from(dig).toString('hex');
}
function parseArgs() {
  const args = process.argv.slice(2);
  const out = { file: null, name: null, cid: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--file') out.file = args[++i];
    else if (a === '--name') out.name = args[++i];
    else if (a === '--cid') out.cid = args[++i];
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!out.file) throw new Error('Missing --file <path>');
  if (!out.name) out.name = path.basename(out.file);
  return out;
}
function looksLikeCid(s) {
  // Basic shape check: base32 bafy... or base58 Qm...
  return typeof s === 'string' && (s.startsWith('bafy') || s.startsWith('Qm')) && s.length > 40;
}
async function uploadViaIpfsApi(filePath, displayName) {
  const stream = fs.createReadStream(filePath);
  const form = new FormData();
  form.append('file', stream, { filepath: displayName });
  form.append('pin', 'true');
  const apiBase = process.env.OG_STORAGE_API_BASE || '';
  if (!apiBase) throw new Error('OG_STORAGE_API_BASE not set');
  const url = apiBase.replace(/\/+$/, '') + '/api/v0/add';
  const headers = { ...form.getHeaders() };
  const token = process.env.OG_STORAGE_API_TOKEN;
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const resp = await axios.post(url, form, {
    headers, maxContentLength: Infinity, maxBodyLength: Infinity, responseType: 'text',
    validateStatus: (s) => s >= 200 && s < 300,
  });
  const lines = String(resp.data).trim().split(/\r?\n/).filter(Boolean);
  const last = JSON.parse(lines[lines.length - 1]);
  return { cid: last.Hash, size: Number(last.Size) || null, name: last.Name || displayName };
}
async function uploadToStorage(filePath, displayName, manualCid) {
  const bytes = readFileBytes(filePath);
  const shaHex = sha256Hex(bytes);
  const mode = (process.env.OG_STORAGE_MODE || 'manual').toLowerCase();
  const gw = (process.env.OG_GATEWAY_BASE || '').replace(/\/+$/, '');
  if (mode === 'manual') {
    if (!looksLikeCid(manualCid)) throw new Error('manual mode requires a valid --cid (bafy... or Qm...)');
    const url = gw && manualCid ? (gw + '/' + manualCid) : null;
    return { cid: manualCid, sha256: shaHex, size: bytes.length, name: displayName, url };
  } else if (mode === 'ipfs-api') {
    const { cid, size, name } = await uploadViaIpfsApi(filePath, displayName);
    const url = gw && cid ? (gw + '/' + cid) : null;
    return { cid, sha256: shaHex, size, name, url };
  } else {
    throw new Error('Unsupported OG_STORAGE_MODE: ' + mode + ' (supported: manual, ipfs-api)');
  }
}
(async () => {
  try {
    const { file, name, cid, dryRun } = parseArgs();
    const bytes = readFileBytes(file);
    const shaHex = sha256Hex(bytes);
    if (dryRun) {
      console.log(JSON.stringify({ cid: null, sha256: shaHex, size: bytes.length, name }, null, 2));
      process.exit(0);
    }
    const out = await uploadToStorage(file, name, cid);
    console.log(JSON.stringify(out, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('[upload_to_0g_storage] Error:', err.message);
    process.exit(1);
  }
})();
