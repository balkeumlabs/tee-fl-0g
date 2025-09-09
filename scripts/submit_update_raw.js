// scripts/submit_update_raw.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');
const crypto = require('crypto');

(async () => {
  const rpc = process.env.RPC_ENDPOINT, pk = process.env.PRIVATE_KEY;
  const epochAddr = process.argv[2];            // EpochManager address
  const epochId   = parseInt(process.argv[3]);  // Epoch id
  const cid       = process.argv[4];            // Storage CID (string)
  const filePath  = process.argv[5];            // Path to update file
  if (!rpc || !pk) throw new Error('Missing RPC_ENDPOINT or PRIVATE_KEY in .env');
  if (!epochAddr || !epochId || !cid || !filePath) {
    console.log('Usage: node scripts/submit_update_raw.js <EpochManager> <epochId> <cid> <filePath>');
    process.exit(1);
  }

  // Compute SHA-256 of the file
  const buf = fs.readFileSync(filePath);
  const hashHex = crypto.createHash('sha256').update(buf).digest('hex');
  const hashBytes32 = '0x' + hashHex;          // 32-byte hex

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);

  const art = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json','utf8'));
  const c = new ethers.Contract(epochAddr, art.abi, wallet);

  console.log('// file:', filePath);
  console.log('// sha256:', hashBytes32);
  console.log('// cid:', cid);

  const tx = await c.submitUpdate(epochId, cid, hashBytes32);
  console.log('// submitUpdate tx:', tx.hash);
  await tx.wait();
})();
