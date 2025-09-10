// scripts/attestation_check.js
const fs = require("fs");
function arg(k){ const i=process.argv.indexOf(k); return i>0? process.argv[i+1] : null; }
const attPath = arg("--attestation"); const allowPath = arg("--allowlist");
if(!attPath || !allowPath){ console.error("Usage: --attestation <file> --allowlist <file>"); process.exit(2); }
const att = JSON.parse(fs.readFileSync(attPath,"utf8"));
const allow = JSON.parse(fs.readFileSync(allowPath,"utf8"));
function need(o,p){ const v=p.split(".").reduce((x,k)=> (x&&k in x)? x[k] : null, o); if(v===null){ throw new Error("Missing field: "+p); } }
["provider","epochId","enclave.tee","enclave.mrenclave","enclave.mrsigner","enclave.productId","enclave.svn","nonce","issuedAt","evidenceCid","signature"].forEach(f=>need(att,f));
const ok = (allow.measurementAllowlist||[]).some(m =>
  (m.tee||"").toLowerCase() === String(att.enclave.tee||"").toLowerCase()
  && String(m.mrenclave||"").toLowerCase() === String(att.enclave.mrenclave||"").toLowerCase()
  && String(m.mrsigner||"").toLowerCase() === String(att.enclave.mrsigner||"").toLowerCase()
  && String(m.productId||"") === String(att.enclave.productId||"")
  && Number(att.enclave.svn||0) >= Number(m.minSvn||0)
);
if(!ok){ console.error("Attestation measurement not in allowlist"); process.exit(3); }
console.log(JSON.stringify({ ok:true, provider:att.provider, epochId:att.epochId, tee:att.enclave.tee }, null, 2));
process.exit(0);
