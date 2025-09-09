/**
 * scripts/aggregate_and_publish_raw.js
 * Usage: node scripts/aggregate_and_publish_raw.js <EpochManager> <epochId> <outputJsonPath> <globalCid> <updateJson1> [updateJson2 ...]
 */
require("dotenv").config();                      // // Load RPC + PK
const { ethers } = require("ethers");            // // Ethers v6
const fs = require("fs");                        // // File system
const crypto = require("crypto");                // // Hashing

function fedAvg(files) {                         // // Simple FedAvg: mean of arrays
  const arrs = files.map(p => JSON.parse(fs.readFileSync(p,"utf8")).weights_delta);
  if (arrs.length === 0) throw new Error("No updates");
  const len = arrs[0].length;
  for (const a of arrs) if (a.length !== len) throw new Error("Mismatched lengths");
  const sum = new Array(len).fill(0);
  for (const a of arrs) for (let i = 0; i < len; i++) sum[i] += a[i];
  return sum.map(x => x / arrs.length);
}

(async () => {
  const rpc = process.env.RPC_ENDPOINT;          // // RPC endpoint
  const pk  = process.env.PRIVATE_KEY;           // // Admin signer (secret)
  const addr = process.argv[2];                  // // EpochManager address
  const epoch = parseInt(process.argv[3] || "1", 10); // // Epoch id
  const outPath = process.argv[4] || "aggregated_model.json";     // // Output JSON path
  const globalCid = process.argv[5] || ("cid://simulated/global-" + Date.now()); // // CID for aggregated model
  const updates = process.argv.slice(6);         // // List of update JSON files
  if (!rpc || !pk || !addr) { console.error("Missing RPC/PK/address"); process.exit(1); }

  const weights = fedAvg(updates);               // // Aggregate client updates
  const payload = { epoch: epoch, ts: new Date().toISOString(), weights: weights };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));    // // Write aggregated file

  const buf = fs.readFileSync(outPath);         // // Compute SHA-256 of aggregated file
  const hash = "0x" + crypto.createHash("sha256").update(buf).digest("hex");

  console.log("// aggregated file: " + outPath);
  console.log("// sha256: " + hash);
  console.log("// global CID: " + globalCid);

  const provider = new ethers.JsonRpcProvider(rpc);               // // Provider
  const wallet   = new ethers.Wallet(pk, provider);               // // Admin wallet
  const art = JSON.parse(fs.readFileSync("artifacts/contracts/EpochManager.sol/EpochManager.json","utf8")); // // ABI
  const c = new ethers.Contract(addr, art.abi, wallet);           // // Contract

  const tx = await c.publishModel(epoch, globalCid, hash);        // // Publish aggregated model
  console.log("// publishModel tx: " + tx.hash);
  await tx.wait();                                                // // Wait mined
})();
