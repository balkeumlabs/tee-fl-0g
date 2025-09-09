/**
 * scripts/read_epoch_meta_raw.js
 * Usage: node scripts/read_epoch_meta_raw.js <EpochManager> <epochId>
 */
require("dotenv").config();                      // // Load RPC from .env
const { ethers } = require("ethers");            // // Ethers v6
const fs = require("fs");                        // // FS

(async () => {
  const rpc = process.env.RPC_ENDPOINT;          // // RPC endpoint
  const addr = process.argv[2];                  // // EpochManager address
  const epoch = parseInt(process.argv[3] || "1", 10); // // Epoch id
  if (!rpc || !addr) { console.error("Usage: node scripts/read_epoch_meta_raw.js <addr> <epochId>"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(rpc);     // // Provider
  const art = JSON.parse(fs.readFileSync("artifacts/contracts/EpochManager.sol/EpochManager.json","utf8")); // // ABI
  const c = new ethers.Contract(addr, art.abi, provider); // // Contract

  const m = await c.epochs(epoch);                      // // Read struct
  console.log("// modelHash: " + m.modelHash);
  console.log("// scoresRoot: " + m.scoresRoot);
  console.log("// globalModelCid: " + m.globalModelCid);
  console.log("// globalModelHash: " + m.globalModelHash);
  console.log("// published: " + m.published);
})();
