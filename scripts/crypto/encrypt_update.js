#!/usr/bin/env node
const fs = require('fs');
const crypto = require('crypto');

const args = process.argv;
const inIdx = args.indexOf('--in');
const outIdx = args.indexOf('--out');
if (inIdx < 0 || outIdx < 0 || !args[inIdx+1] || !args[outIdx+1]) {
  console.error('usage: encrypt_update.js --in <in> --out <out>');
  process.exit(2);
}
const inp = args[inIdx+1];
const outp = args[outIdx+1];

const data = fs.readFileSync(inp, 'utf8');           // no-op "encryption" for CI
fs.writeFileSync(outp, data);
const sha = crypto.createHash('sha256').update(data).digest('hex');
process.stdout.write(JSON.stringify({ out: outp, size: Buffer.byteLength(data), sha256: sha }) + '\n');
