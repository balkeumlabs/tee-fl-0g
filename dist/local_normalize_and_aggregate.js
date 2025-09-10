/* dist/local_normalize_and_aggregate.js (hardened) */
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { sha256 } = require("@noble/hashes/sha256");

function arg(n,d){ const i=process.argv.indexOf(n); return i>=0 && i+1<process.argv.length ? process.argv[i+1] : d; }
const inDir  = path.resolve(arg("--in-dir","."));
const outDir = path.resolve(arg("--out-dir",inDir));
const onMismatch = (arg("--on-mismatch","strict")||"strict").toLowerCase();
const forcePath  = arg("--force-path", null);

function toNum(x){ if (typeof x==="number"&&Number.isFinite(x)) return x; if (typeof x==="string"&&x.trim()!==""&&!Number.isNaN(+x)) return +x; return null; }
function looksLikeJsonArrayString(s){ if (typeof s!=="string") return false; const t=s.trim(); return t.startsWith("[") && t.endsWith("]"); }
function tryParseCsvNumbers(s){ if (typeof s!=="string") return null; const parts=s.split(/[,\s]+/).filter(x=>x.length>0); if (parts.length<2) return null; const nums=parts.map(x=>+x); if (nums.some(Number.isNaN)) return null; return nums; }
function isB64(s){ return typeof s==="string" && s.length>=8 && s.length%4===0 && /^[A-Za-z0-9+/=]+$/.test(s); }
function tryB64Json(s){ try { const dec=Buffer.from(s,"base64").toString("utf8"); if (dec.startsWith("{")||dec.startsWith("[")) return JSON.parse(dec); } catch{} return null; }
function tryB64Floats(s){
  try {
    const buf = Buffer.from(s,"base64");
    if (buf.length>=8 && buf.length%8===0){ const n=buf.length/8, arr=new Array(n); for (let i=0;i<n;i++) arr[i]=buf.readDoubleLE(i*8); if (arr.every(Number.isFinite)) return arr; }
    if (buf.length>=4 && buf.length%4===0){ const n=buf.length/4, arr=new Array(n); for (let i=0;i<n;i++) arr[i]=buf.readFloatLE(i*4); if (arr.every(Number.isFinite)) return arr; }
  } catch {}
  return null;
}
function flattenArray(a){ const out=[];(function rec(v){ if (Array.isArray(v)) v.forEach(rec); else { const n=toNum(v); if(n===null) throw new Error("Non-numeric in array"); out.push(n); } })(a); return out; }
function objectValuesSorted(o){ return Object.keys(o).sort().map(k=>{ const n=toNum(o[k]); if(n===null) throw new Error("Non-numeric object value"); return n; }); }

/* Coerce ANY value into a numeric vector if possible */
function coerceToVector(val){
  if (val==null) return null;
  if (Array.isArray(val)) { try { return flattenArray(val); } catch { return null; } }
  if (typeof val==="object"){
    // {"dtype":"float32|float64","data":"<b64>"}
    if (val.dtype && val.data && typeof val.data==="string"){
      const dtype=String(val.dtype).toLowerCase(); const raw=Buffer.from(val.data,"base64");
      try {
        if (dtype==="float64" && raw.length%8===0){ const n=raw.length/8, a=new Array(n); for (let i=0;i<n;i++) a[i]=raw.readDoubleLE(i*8); if (a.every(Number.isFinite)) return a; }
        if (dtype==="float32" && raw.length%4===0){ const n=raw.length/4, a=new Array(n); for (let i=0;i<n;i++) a[i]=raw.readFloatLE(i*4); if (a.every(Number.isFinite)) return a; }
      } catch {}
    }
    // object-of-numbers
    try { const vals = objectValuesSorted(val); if (vals.length) return vals; } catch {}
  }
  if (typeof val==="string"){
    if (looksLikeJsonArrayString(val)) { try { const js=JSON.parse(val); return coerceToVector(js); } catch {} }
    const csv = tryParseCsvNumbers(val); if (csv) return csv;
    if (isB64(val)){
      const js = tryB64Json(val); if (js) { const v=coerceToVector(js); if (v) return v; }
      const f  = tryB64Floats(val); if (f) return f;
    }
  }
  return null;
}

/* Minimal JSONPath-ish resolver that also supports <b64> on segments */
function getByPath(root, p){
  if (!p || p[0] !== "$") return null;
  let cur = root;
  const segs = p.slice(1).split(".").filter(Boolean); // '$.a.b[0]' -> ['a','b[0]']
  for (let seg of segs){
    const useB64 = seg.endsWith("<b64>"); if (useB64) seg = seg.slice(0,-5); // strip <b64>
    const m = seg.match(/^([^\[\]]+)((\[\d+\])*)$/); if (!m) return null;
    const key = m[1];
    if (key && key!=="$"){
      if (!cur || typeof cur!=="object" || !(key in cur)) return null;
      cur = cur[key];
    }
    if (useB64 && typeof cur==="string" && isB64(cur)){
      try {
        const dec = Buffer.from(cur,"base64").toString("utf8");
        if (dec.startsWith("{")||dec.startsWith("[")) cur = JSON.parse(dec);
      } catch { return null; }
    }
    const idxMatches = (m[2]||"").match(/\[(\d+)\]/g) || [];
    for (const im of idxMatches){
      const idx = parseInt(im.slice(1,-1),10);
      if (!Array.isArray(cur) || idx<0 || idx>=cur.length) return null;
      cur = cur[idx];
    }
  }
  return cur;
}

function deepCandidates(node, curPath, out){
  if (Array.isArray(node)){
    try { const v=flattenArray(node); if (v.length) out.push({ path: curPath, vec: v }); } catch {}
    for (let i=0;i<node.length;i++) deepCandidates(node[i], curPath+`[${i}]`, out);
    return;
  }
  if (node && typeof node==="object"){
    try { const vals=objectValuesSorted(node); if (vals.length) out.push({ path: curPath+"{sortedValues}", vec: vals }); } catch {}
    for (const k of Object.keys(node)){
      const v=node[k];
      // extras: strings that could be vectors
      if (typeof v==="string"){
        if (looksLikeJsonArrayString(v)){ try { const js=JSON.parse(v); const vec=coerceToVector(js); if (vec&&vec.length) out.push({ path: curPath+"."+k+"<str-json>", vec }); } catch {}
        }
        const csv = tryParseCsvNumbers(v); if (csv&&csv.length) out.push({ path: curPath+"."+k+"<csv>", vec: csv });
        if (isB64(v)){
          const js = tryB64Json(v); if (js){ const vec=coerceToVector(js); if (vec&&vec.length) out.push({ path: curPath+"."+k+"<b64-json>", vec }); }
          const fl = tryB64Floats(v); if (fl&&fl.length) out.push({ path: curPath+"."+k+"<b64-floats>", vec: fl });
        }
      }
      deepCandidates(v, curPath+"."+k, out);
    }
  }
}

function preferredCandidate(cands){
  const pref = [".weights",".weights_delta",".params",".w",".theta",".coef",".coefficients",".payload.update",".model.weights",".update"];
  for (const p of pref){ const hit=cands.find(c=>c.path.endsWith(p)||c.path.includes(p)); if (hit) return hit; }
  return cands.sort((a,b)=>b.vec.length - a.vec.length)[0] || null;
}

if (!fs.existsSync(inDir)) { console.error("Input directory not found: "+inDir); process.exit(1); }
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir,{recursive:true});

const files = fs.readdirSync(inDir).filter(f => /^client_update.*\.json$/i.test(f) && !/\.enc\.json$/i.test(f));
if (files.length===0){ console.error("No client_update*.json in "+inDir); process.exit(1); }

const entries=[]; let maxLen=0;
for (const f of files){
  const full = path.join(inDir,f);
  const buf  = fs.readFileSync(full);
  const sha  = Buffer.from(sha256(buf)).toString("hex");
  let vec=null, pathUsed=null, err=null;
  try {
    const data = JSON.parse(buf.toString("utf8"));
    if (forcePath){
      const val = getByPath(data, forcePath);
      vec = coerceToVector(val);
      if (vec && vec.length){ pathUsed = forcePath; }
      else { err = "force-path resolved but not a numeric vector"; }
    } else {
      const cands=[]; deepCandidates(data,"$",cands);
      const chosen=preferredCandidate(cands);
      if (chosen){ vec=chosen.vec; pathUsed=chosen.path; } else { err="no numeric arrays found"; }
    }
    if (vec){ maxLen=Math.max(maxLen, vec.length); }
  } catch(e){ err=String(e.message||e); }
  entries.push({ file:f, sha256:sha, bytes:buf.length, path: pathUsed, length: vec?vec.length:0, ok: !!vec, error: err, vector: vec||null });
}

let ok = entries.filter(e=>e.ok);
if (ok.length===0){
  fs.writeFileSync(path.join(outDir,"normalized_inputs.json"), JSON.stringify(entries,null,2));
  fs.writeFileSync(path.join(outDir,"scores.json"), JSON.stringify({ totalFiles: files.length, ok:0 }, null, 2));
  fs.writeFileSync(path.join(outDir,"aggregated_model.json"), JSON.stringify({ note:"no numeric weights found after deep normalization" }, null, 2));
  console.log(JSON.stringify({ inDir, outDir, files: files.length, ok:0, reason:"no extractable vectors (deep/hardened)" }, null, 2));
  process.exit(0);
}

if (onMismatch==="strict"){
  const L = ok[0].length;
  if (!ok.every(e=>e.length===L)){
    fs.writeFileSync(path.join(outDir,"normalized_inputs.json"), JSON.stringify(entries,null,2));
    console.error("Vector length mismatch; use --on-mismatch pad");
    process.exit(2);
  }
} else if (onMismatch==="pad"){
  ok = ok.map(e => {
    if (e.length===maxLen) return e;
    const v=e.vector.slice(); while (v.length<maxLen) v.push(0);
    return { ...e, vector:v, length:maxLen };
  });
}

const sum = new Array(maxLen).fill(0);
for (const e of ok){ for (let i=0;i<maxLen;i++) sum[i]+=e.vector[i]; }
const avg = sum.map(x=>x/ok.length);

fs.writeFileSync(path.join(outDir,"normalized_inputs.json"), JSON.stringify(entries,null,2));
fs.writeFileSync(path.join(outDir,"scores.json"), JSON.stringify({ totalFiles: files.length, ok: ok.length, maxLen, onMismatch, forcePath: forcePath || null }, null, 2));
fs.writeFileSync(path.join(outDir,"aggregated_model.json"), JSON.stringify({ weights: avg, count: ok.length }, null, 2));

console.log(JSON.stringify({
  inDir, outDir, files: files.length, ok: ok.length, maxLen, onMismatch, forcePath: forcePath || null,
  normalizedPath: path.join(outDir,"normalized_inputs.json"),
  scoresPath: path.join(outDir,"scores.json"),
  aggregatedPath: path.join(outDir,"aggregated_model.json")
}, null, 2));
