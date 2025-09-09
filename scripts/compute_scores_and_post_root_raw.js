/**
 * scripts/compute_scores_and_post_root_raw.js
 * Usage: node scripts/compute_scores_and_post_root_raw.js <EpochManager> <epochId> [fromBlock=0]
 */
require("dotenv").config();                      // // Load RPC + PK from .env
const { ethers } = require("ethers");            // // Ethers v6
const fs = require("fs");                        // // FS for reading ABI
const crypto = require("crypto");                // // Node crypto for SHA-256

function merkleRoot(leavesHex) {                 // // Simple SHA-256 Merkle root (pairwise hash)
  if (leavesHex.length === 0) return "0x" + "00".repeat(32);
  let level = leavesHex.map(x => Buffer.from(x.slice(2), "hex"));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = (i + 1 < level.length) ? level[i + 1] : level[i];
      next.push(crypto.createHash("sha256").update(Buffer.concat([a, b])).digest());
    }
    level = next;
  }
  return "0x" + level[0].toString("hex");
}

(async () => {
  const rpc = process.env.RPC_ENDPOINT;          // // RPC endpoint
  const pk  = process.env.PRIVATE_KEY;           // // Admin signer (secret)
  const addr = process.argv[2];                  // // EpochManager address
  const epoch = parseInt(process.argv[3] || "1", 10); // // Epoch id
  const fromBlock = process.argv[4] ? parseInt(process.argv[4], 10) : 0; // // Scan start block
  if (!rpc || !pk || !addr) { console.error("Missing RPC/PK/address"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(rpc);      // // Provider
  const wallet   = new ethers.Wallet(pk, provider);      // // Admin wallet
  const art = JSON.parse(fs.readFileSync("artifacts/contracts/EpochManager.sol/EpochManager.json","utf8")); // // ABI
  const c = new ethers.Contract(addr, art.abi, wallet);  // // Contract

  const latest = await provider.getBlockNumber();        // // End block for query
  const filter = c.filters.UpdateSubmitted(epoch);       // // Event filter by epoch
  const logs = await c.queryFilter(filter, fromBlock, latest); // // Fetch logs
  console.log("// updates found: " + logs.length);

  const leaves = [];                                     // // Build leaves: H(submitter || hash || score)
  for (let i = 0; i < logs.length; i++) {
    const args = logs[i].args;
    const submitter = args[1];                           // // address
    const updateHash = args[3];                          // // bytes32
    const lastByte = parseInt(updateHash.slice(-2), 16); // // dummy score = last byte
    const scoreHex = lastByte.toString(16).padStart(64, "0");
    const leaf = "0x" + crypto.createHash("sha256").update(Buffer.concat([
      Buffer.from(submitter.slice(2), "hex"),
      Buffer.from(updateHash.slice(2), "hex"),
      Buffer.from(scoreHex, "hex")
    ])).digest("hex");
    leaves.push(leaf);
    console.log("// submitter " + submitter + " score " + lastByte);
  }

  const root = merkleRoot(leaves);                       // // Compute Merkle root
  console.log("// scoresRoot: " + root);

  const tx = await c.postScoresRoot(epoch, root);        // // Post root on-chain
  console.log("// postScoresRoot tx: " + tx.hash);
  await tx.wait();                                       // // Wait mined
})();
