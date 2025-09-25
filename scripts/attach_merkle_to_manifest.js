const fs = require('fs');
const manifestPath = process.argv[2] || 'market_manifest.json';
const bundlePath = process.argv[3] || 'bundle.merkle.json';
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const b = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
m.merkleRoot = b.root;
fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2), 'utf8');
console.log('manifest updated with merkleRoot', b.root);

