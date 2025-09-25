const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256Hex(buf){ return crypto.createHash('sha256').update(buf).digest('hex'); }

function buildLeaves(files){
  return files.map(fp => {
    const data = fs.readFileSync(fp);
    const sha = sha256Hex(data).toLowerCase();
    const leaf = Buffer.from(sha, 'hex');
    return { file: fp, sha256: sha, leaf };
  });
}

function merkleTree(leaves){
  if (leaves.length === 0) return { root: Buffer.from('0'.repeat(64), 'hex'), levels: [] };
  const toPairs = (arr) => arr.map((_,i)=>i).filter(i=>i%2===0).map(i=>[arr[i], arr[i+1] ?? arr[i]]);
  const levels = [];
  let level = leaves.map(x=>x.leaf);
  levels.push(level);
  while(level.length > 1){
    const pairs = toPairs(level);
    level = pairs.map(([a,b]) => crypto.createHash('sha256').update(Buffer.concat([a,b])).digest());
    levels.push(level);
  }
  return { root: level[0], levels };
}

function buildProofs(leaves, levels){
  const proofs = [];
  for(let idx=0; idx<leaves.length; idx++){
    const pathItems = [];
    let i = idx;
    for(let depth=0; depth<levels.length-1; depth++){
      const level = levels[depth];
      const isRight = (i % 2) === 1;
      const sibIndex = isRight ? i - 1 : (i + 1 >= level.length ? i : i + 1);
      const sibling = level[sibIndex];
      pathItems.push({
        position: isRight ? 'left' : 'right',
        sibling: '0x' + sibling.toString('hex')
      });
      i = Math.floor(i/2);
    }
    proofs.push(pathItems);
  }
  return proofs;
}

function main(){
  const dir = process.argv[2] || '.';
  const pattern = process.argv[3] || '.enc.json';
  const out = process.argv[4] || 'bundle.merkle.json';
  const base = path.resolve(dir);
  const all = fs.readdirSync(base).filter(f=>f.endsWith(pattern)).map(f=>path.join(base,f));
  if(all.length === 0){
    console.error('no bundle files found matching', pattern, 'in', base);
  }
  const leaves = buildLeaves(all);
  const tree = merkleTree(leaves);
  const proofs = buildProofs(leaves, tree.levels);
  const rootHex = '0x' + tree.root.toString('hex');
  const outJson = {
    createdAt: new Date().toISOString(),
    baseDir: base,
    pattern,
    root: rootHex,
    items: leaves.map((l, i)=>({ file: path.relative(base, l.file), sha256: '0x'+l.sha256, leaf: '0x'+l.leaf.toString('hex'), proof: proofs[i] }))
  };
  fs.writeFileSync(out, JSON.stringify(outJson, null, 2), 'utf8');
  console.log(rootHex);
}

main();


