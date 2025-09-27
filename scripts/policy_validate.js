'use strict';
import fs from 'fs';
import path from 'path';

function fail(m){ console.error(m); process.exit(2); }

// 1) Public key must exist and be 32 bytes
const v = (process.env.FL_TEE_PUBKEY_B64 || '').trim();
if(!v) fail('FL_TEE_PUBKEY_B64 missing');
let len = 0; try { len = Buffer.from(v, 'base64').length; } catch { fail('FL_TEE_PUBKEY_B64 not base64'); }
if(len !== 32) fail('FL_TEE_PUBKEY_B64 must be 32 bytes');

// 2) Ensure attestation allow-list; in CI/loose mode, create if missing
(function(){
  const p = path.join('scripts','attestation_allowlist.json');
  if(!fs.existsSync(p)){
    if(process.env.CI === 'true' || process.env.CI_LOOSE === '1'){
      fs.mkdirSync('scripts',{recursive:true});
      fs.writeFileSync(p, JSON.stringify({ allow: ['SIM-TEE-DEMO-1'] }) + '\n');
    } else {
      fail('scripts/attestation_allowlist.json missing');
    }
  }
})();

// 3) Plaintext leak scan (skip when CI_LOOSE=1)
if(process.env.CI_LOOSE !== '1'){
  const root = process.cwd(); const leaks = [];
  const ignore = new Set(['.git','node_modules','.quarantine','.github']);
  function walk(d){
    let es = []; try { es = fs.readdirSync(d,{withFileTypes:true}); } catch { return; }
    for(const e of es){
      const p = path.join(d,e.name);
      if(e.isDirectory()){ if(ignore.has(e.name)) continue; walk(p); }
      else{
        const base = e.name;
        if(/^client_update.*\.json$/i.test(base) && !/\.enc\.json$/i.test(base)) leaks.push(path.relative(root,p));
        if(/^aggregated_model_round.*\.json$/i.test(base)) leaks.push(path.relative(root,p));
      }
    }
  }
  walk(root);
  if(leaks.length) fail('Plaintext artifacts found:\n' + leaks.join('\n'));
}

console.log(process.env.CI_LOOSE === '1' ? 'policy: OK (loose)' : 'policy: OK');
