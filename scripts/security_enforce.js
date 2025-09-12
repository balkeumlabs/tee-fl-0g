'use strict';
const fs = require('fs');
const path = require('path');

function requireEncEnv(){
  var v = (process.env.FL_TEE_PUBKEY_B64||'').trim();
  if(!v) throw new Error('FL_TEE_PUBKEY_B64 missing; encryption required for all submissions.');
  var bytes = 0; try{ bytes = Buffer.from(v,'base64').length; }catch(e){ throw new Error('FL_TEE_PUBKEY_B64 is not valid base64.'); }
  if(bytes !== 32) throw new Error('FL_TEE_PUBKEY_B64 must be 32 bytes (X25519 public key, base64).');
}

function assertEncryptedJson(p){
  var fname = path.basename(String(p||'')).toLowerCase();
  if(!fname.endsWith('.enc.json')) throw new Error('Expected an encrypted update (*.enc.json); got: ' + p);
  return;
}

function maybeScrubPlaintext(opts){
  opts = opts||{}; var fix = !!opts.fix; var root = process.cwd();
  var candidates = [];
  (function walk(dir){
    var entries; try{ entries = fs.readdirSync(dir,{withFileTypes:true}); }catch(_){ return; }
    for(var i=0;i<entries.length;i++){
      var e = entries[i]; var p = path.join(dir,e.name);
      if(e.isDirectory()){ if(e.name==='.git'||e.name==='node_modules'||e.name==='.quarantine') continue; walk(p); }
      else{
        if(/^client_update.*\\.json$/i.test(e.name) && !/\\.enc\\.json$/i.test(e.name)) candidates.push(p);
        if(/^aggregated_model_round.*\\.json$/i.test(e.name)) candidates.push(p);
      }
    }
  })(root);
  if(!candidates.length) return Promise.resolve({ moved: [] });
  if(!fix){
    var list = candidates.map(function(p){ return path.relative(root,p); });
    throw new Error('Plaintext artifacts detected (set FL_ENC_DELETE_PLAINTEXT=1 to auto-quarantine):'+'\\n'+list.join('\\n'));
  }
  var qdir = path.join(root,'.quarantine'); if(!fs.existsSync(qdir)) fs.mkdirSync(qdir);
  var moved = [];
  for(var j=0;j<candidates.length;j++){
    var src = candidates[j]; var dest = path.join(qdir,path.basename(src));
    try{ fs.renameSync(src,dest); moved.push(path.relative(root,dest)); }catch(_){ }
  }
  return Promise.resolve({ moved: moved });
}

module.exports = { requireEncEnv, assertEncryptedJson, maybeScrubPlaintext };
