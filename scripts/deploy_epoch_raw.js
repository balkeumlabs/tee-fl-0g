// scripts/deploy_epoch_raw.js
require('dotenv').config();
const { ethers } = require('ethers');
const fs = require('fs');

(async () => {
  const rpc = process.env.RPC_ENDPOINT, pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) throw new Error('Missing RPC_ENDPOINT or PRIVATE_KEY in .env');

  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet   = new ethers.Wallet(pk, provider);

  const art = JSON.parse(fs.readFileSync('artifacts/contracts/EpochManager.sol/EpochManager.json','utf8'));
  const fac = new ethers.ContractFactory(art.abi, art.bytecode, wallet);

  console.log('// Deployer:', await wallet.getAddress());
  const c = await fac.deploy();
  console.log('// Deploy tx:', (await c.deploymentTransaction()).hash);
  await c.waitForDeployment();
  console.log('// EpochManager:', await c.getAddress());
})().catch(e => { console.error(e); process.exit(1); });
