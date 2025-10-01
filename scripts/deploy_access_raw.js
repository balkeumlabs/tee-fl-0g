// scripts/deploy_access_raw.js
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

(async () => {
  const rpc = process.env.RPC_ENDPOINT, pk = process.env.PRIVATE_KEY;
  if (!rpc || !pk) throw new Error('Missing RPC_ENDPOINT or PRIVATE_KEY in .env');

  const provider = new ethers.JsonRpcProvider(rpc);              // // Connect to Galileo
  const wallet   = new ethers.Wallet(pk, provider);              // // Signer

  const art = JSON.parse(fs.readFileSync('artifacts/contracts/AccessRegistry.sol/AccessRegistry.json','utf8'));
  const fac = new ethers.ContractFactory(art.abi, art.bytecode, wallet);

  console.log('// Deployer:', await wallet.getAddress());        // // Show deployer
  const c = await fac.deploy();                                  // // Send tx
  console.log('// Deploy tx:', (await c.deploymentTransaction()).hash);
  await c.waitForDeployment();                                   // // Wait mined
  console.log('// AccessRegistry:', await c.getAddress());       // // Print address
})().catch(e => { console.error(e); process.exit(1); });
