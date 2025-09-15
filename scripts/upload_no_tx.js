const { statSync, readFileSync, appendFileSync, mkdirSync, existsSync } = require("fs");
const { createHash } = require("crypto");

// Usage: node scripts/upload_no_tx.js --file <path> --kind <update|model|scores> [--note "..."]
function argOf(f){ const i = process.argv.indexOf(f); return (i>-1 && i+1<process.argv.length) ? process.argv[i+1] : null; }
const file = argOf("--file"); const kind = argOf("--kind")||"blob"; const note = argOf("--note")||"";
if (!file) { console.error("Missing --file"); process.exit(2); }

const buf = readFileSync(file);
const sha256_hex = createHash("sha256").update(buf).digest("hex");
const size_bytes = statSync(file).size;
const pseudo_cid = `sha256:${sha256_hex}`;
const created_at_utc = new Date().toISOString();

const rec = { kind, file, size_bytes, sha256_hex, pseudo_cid, note, created_at_utc };
const outDir = "artifacts";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
appendFileSync(`${outDir}/manifest.jsonl`, JSON.stringify(rec) + "\n");

console.log(JSON.stringify({ ok:true, wrote:`${outDir}/manifest.jsonl`, sha256_hex, pseudo_cid }));
