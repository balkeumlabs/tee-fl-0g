const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256Hex(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }

function hashPairHex(aHex, bHex){
  const a = Buffer.from(aHex.replace(/^0x/,''), 'hex');
  const b = Buffer.from(bHex.replace(/^0x/,''), 'hex');
  return '0x' + crypto.createHash('sha256').update(Buffer.concat([a,b])).digest('hex');
}

function verifyProof(leafHex, proof, rootHex){
  let acc = leafHex.toLowerCase();
  for(const step of proof){
    if(step.position === 'left'){
      acc = hashPairHex(step.sibling, acc);
    } else {
      acc = hashPairHex(acc, step.sibling);
    }
  }
  return acc.toLowerCase() === rootHex.toLowerCase();
}

function main(){
  const bundlePath = process.argv[2] || 'bundle.merkle.json';
  const base = process.argv[3] || '.';
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  const baseDir = path.resolve(base);
  let ok = true;
  for(const it of bundle.items){
    const abs = path.join(baseDir, it.file);
    const data = fs.readFileSync(abs);
    const sha = '0x' + sha256Hex(data).toLowerCase();
    if(sha !== it.sha256.toLowerCase()){
      console.error('sha256 mismatch for', it.file);
      ok = false; continue;
    }
    if(!verifyProof(it.leaf, it.proof, bundle.root)){
      console.error('proof invalid for', it.file);
      ok = false; continue;
    }
  }
  if(!ok){ process.exit(1); }
  console.log('bundle: OK', bundle.root);
}

main();


