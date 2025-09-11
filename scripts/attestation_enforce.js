/* scripts/attestation_enforce.js */
const fs=require("fs"), path=require("path");
let argv; try{ argv=require("minimist")(process.argv.slice(2)); }catch(e){
  argv={}; for(const a of process.argv.slice(2)){ const m=a.match(/^--([^=]+)(=(.*))?$/); if(m){ argv[m[1]]=m[3]??true; } }
}
function readJson(p){ return JSON.parse(fs.readFileSync(path.resolve(p),"utf8")); }
try{
  const att = readJson(argv.attestation || "./attestation_example.json");
  const allow = readJson(argv.allowlist || "./attestation_allowlist.json");
  const meas = (att.measurement||"").trim();
  const list = Array.isArray(allow.allow) ? allow.allow.map(x=>String(x).trim()) : [];
  if(!meas){ console.log(JSON.stringify({ok:false,reason:"measurement-missing",measurement:""})); process.exit(2); }
  if(!list.includes(meas)){ console.log(JSON.stringify({ok:false,reason:"measurement-not-allowed",measurement:meas})); process.exit(3); }
  console.log(JSON.stringify({ok:true,measurement:meas})); process.exit(0);
}catch(err){
  console.log(JSON.stringify({ok:false,reason:"exception",message:String(err)})); process.exit(4);
}
