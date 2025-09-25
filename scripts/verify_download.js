const fs = require('fs');
const { sha256Hex, verifyMerkle } = require('./merkle_verify');
const file = process.argv[2] || 'aggregated_model.json';
const expected = (process.argv[3] || '').replace(/^0x/,'').toLowerCase();
const buf = fs.readFileSync(file);
const got = sha256Hex(buf).toLowerCase();
if (expected && got !== expected) {
  console.error('sha256 mismatch', { expected, got });
  process.exit(1);
}
if (!verifyMerkle([], '0x'+got)) { console.error('merkle verify failed'); process.exit(2); }
console.log('integrity: OK', { sha256: '0x'+got });

