// scripts/start_epoch_once_raw.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

(async () => {
  const rpc = process.env.RPC_ENDPOINT, pk = process.env.PRIVATE_KEY;
  const epochAddr = process.argv[2];                 // EpochManager address
  const epochId   = parseInt(process.argv[3]||'1');  // Epoch id
  if (!rpc || !pk) throw new Error('Missing RPC_ENDPOINT or PRIVATE_KEY in .env');

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);

  const art = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json','utf8'));
  const c = new ethers.Contract(epochAddr, art.abi, wallet);

  const modelHash = '0x'+'11'.repeat(32);            // Demo 32-byte model hash
  const tx = await c.startEpoch(epochId, modelHash); // Write txn
  console.log('// startEpoch tx:', tx.hash);
  await tx.wait();
})();
