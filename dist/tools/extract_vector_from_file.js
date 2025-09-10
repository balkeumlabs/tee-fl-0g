/* dist/tools/extract_vector_from_file.js
   Purpose: Try hard to extract numeric vectors from a JSON file.
   Handles: nested arrays, object-of-numbers, stringified JSON arrays,
            CSV-like strings, base64(JSON), base64(Float32/Float64 binary),
            {"dtype":"float32|float64","data":"<b64>"} shapes. */
const fs = require("fs");

function toNum(x){ if (typeof x==="number" && Number.isFinite(x)) return x;
  if (typeof x==="string" && x.trim()!=="" && !Number.isNaN(+x)) return +x; return null; }

function flattenArray(a){
  const out=[];(function rec(v){
    if (Array.isArray(v)) v.forEach(rec);
    else { const n=toNum(v); if(n===null) throw 0; out.push(n); }
  })(a);
  return out;
}

function objectValuesSorted(o){
  return Object.keys(o).sort().map(k => {
    const n = toNum(o[k]); if (n===null) throw 0; return n;
  });
}

function looksLikeJsonArrayString(s){
  if (typeof s!=="string") return false;
  const t = s.trim();
  return t.startsWith("[") && t.endsWith("]");
}

function tryParseCsvNumbers(s){
  if (typeof s!=="string") return null;
  const parts = s.split(/[,\s]+/).filter(x => x.length>0);
  if (parts.length < 2) return null;
  const nums = parts.map(x => +x);
  if (nums.some(n => Number.isNaN(n))) return null;
  return nums;
}

function isB64(s){ return typeof s==="string" && s.length>=8 && s.length%4===0 && /^[A-Za-z0-9+/=]+$/.test(s); }

function tryB64Json(s){
  try {
    const dec = Buffer.from(s, "base64").toString("utf8");
    if (dec.startsWith("{") || dec.startsWith("[")) return JSON.parse(dec);
    return null;
  } catch { return null; }
}

function tryB64Floats(s){
  try {
    const buf = Buffer.from(s, "base64");
    if (buf.length>=8 && buf.length%8===0){
      const n = buf.length/8, out = new Array(n);
      for (let i=0;i<n;i++) out[i] = buf.readDoubleLE(i*8);
      if (out.every(Number.isFinite)) return out;
    }
    if (buf.length>=4 && buf.length%4===0){
      const n = buf.length/4, out = new Array(n);
      for (let i=0;i<n;i++) out[i] = buf.readFloatLE(i*4);
      if (out.every(Number.isFinite)) return out;
    }
  } catch { /* ignore */ }
  return null;
}

function deepCandidates(node, curPath, out){
  if (Array.isArray(node)){
    try { const v = flattenArray(node); if (v.length) out.push({ path: curPath, method:"array", vec:v }); } catch {}
    for (let i=0;i<node.length;i++) deepCandidates(node[i], curPath+`[${i}]`, out);
    return;
  }
  if (node && typeof node==="object"){
    // object-of-numbers candidate
    try { const vals = objectValuesSorted(node); if (vals.length) out.push({ path: curPath+"{sortedValues}", method:"object", vec:vals }); } catch {}
    // special dtype/data shape
    if (node.dtype && node.data && typeof node.data==="string"){
      const dty = String(node.dtype).toLowerCase();
      const raw = Buffer.from(node.data, "base64");
      try {
        if (dty==="float64" && raw.length%8===0){ const n=raw.length/8, arr=new Array(n); for (let i=0;i<n;i++) arr[i]=raw.readDoubleLE(i*8); out.push({path:curPath+".data<b64-f64>", method:"b64-f64", vec:arr}); }
        if (dty==="float32" && raw.length%4===0){ const n=raw.length/4, arr=new Array(n); for (let i=0;i<n;i++) arr[i]=raw.readFloatLE(i*4); out.push({path:curPath+".data<b64-f32>", method:"b64-f32", vec:arr}); }
      } catch {}
    }
    for (const k of Object.keys(node)){
      const v = node[k];
      // stringified JSON array
      if (typeof v==="string" && looksLikeJsonArrayString(v)) {
        try { const parsed = JSON.parse(v); const flat = flattenArray(parsed); if (flat.length) out.push({ path: curPath+"."+k+"<str-json>", method:"str-json", vec:flat }); } catch {}
      }
      // CSV-ish numbers
      if (typeof v==="string"){
        const csv = tryParseCsvNumbers(v);
        if (csv && csv.length) out.push({ path: curPath+"."+k+"<csv>", method:"csv", vec:csv });
      }
      // base64: JSON or floats
      if (typeof v==="string" && isB64(v)){
        const js = tryB64Json(v);
        if (js){
          try { const flat = Array.isArray(js) ? flattenArray(js) : objectValuesSorted(js);
                if (flat.length) out.push({ path: curPath+"."+k+"<b64-json>", method:"b64-json", vec:flat }); } catch {}
        } else {
          const fl = tryB64Floats(v);
          if (fl && fl.length) out.push({ path: curPath+"."+k+"<b64-floats>", method:"b64-floats", vec:fl });
        }
      }
      deepCandidates(v, curPath+"."+k, out);
    }
  }
}

function extractVectorsFromFile(filePath){
  const buf = fs.readFileSync(filePath);
  let data = null; try { data = JSON.parse(buf.toString("utf8")); } catch {}
  const cands = [];
  if (data!==null) deepCandidates(data, "$", cands);
  // choose longest candidate (most informative)
  cands.sort((a,b)=> (b.vec.length - a.vec.length));
  return cands; // array of {path, method, vec}
}
module.exports = { extractVectorsFromFile };
