/**
 * scripts/read_update_raw.js
 * Usage: node scripts/read_update_raw.js <EpochManager> [epochId=1] [fromBlock=0]
 */
require("dotenv").config();                 // // Load RPC from .env
const { ethers } = require("ethers");       // // Ethers v6
const fs = require("fs");                   // // File system

(async () => {
  try {
    const rpc   = process.env.RPC_ENDPOINT;                       // // RPC endpoint
    const addr  = process.argv[2];                                // // EpochManager address
    const epoch = parseInt(process.argv[3] || "1", 10);           // // Epoch id
    const fromBlock = process.argv[4] ? parseInt(process.argv[4], 10) : 0;

    if (!rpc || !addr) {
      console.log("Usage: node scripts/read_update_raw.js <EpochManager> [epochId] [fromBlock]");
      process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(rpc);             // // Provider
    const art = JSON.parse(fs.readFileSync(
      "artifacts/contracts/EpochManager.sol/EpochManager.json","utf8"
    ));
    const c = new ethers.Contract(addr, art.abi, provider);       // // Contract

    const latest = await provider.getBlockNumber();               // // Latest block
    const filter = c.filters.UpdateSubmitted(epoch);              // // Event filter
    const logs = await c.queryFilter(filter, fromBlock, latest);  // // Query logs

    console.log("// epoch: " + epoch);
    console.log("// fromBlock: " + fromBlock + " to: " + latest);
    console.log("// updates found: " + logs.length);

    for (let i = 0; i < logs.length; i++) {                       // // Iterate logs
      const ev = logs[i];
      const args = ev.args;
      const submitter  = args[1];
      const updateCid  = args[2];
      const updateHash = args[3];
      console.log("// [" + i + "] submitter=" + submitter + " cid=" + updateCid + " hash=" + updateHash);
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
