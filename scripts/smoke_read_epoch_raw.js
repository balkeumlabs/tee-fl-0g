// scripts/smoke_read_epoch_raw.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

(async () => {
  const rpc = process.env.RPC_ENDPOINT;
  const epochAddr = process.argv[2];

  const provider = new ethers.JsonRpcProvider(rpc);
  const art = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json','utf8'));
  const c = new ethers.Contract(epochAddr, art.abi, provider);

  console.log('// admin:', await c.admin());
  const m = await c.epochs(1);
  console.log('// epoch1.modelHash:', m.modelHash);
})();
