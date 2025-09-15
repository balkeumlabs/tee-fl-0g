const { ethers } = require("ethers");
function argOf(f){ const i=process.argv.indexOf(f); return (i>-1 && i+1<process.argv.length) ? process.argv[i+1] : null; }
const scoresRoot = argOf("--scoresRoot"); const modelHash  = argOf("--modelHash");
const isHex32 = s => typeof s==="string" && /^0x[0-9a-fA-F]{64}$/.test(s);
if (!isHex32(scoresRoot) || !isHex32(modelHash)) { console.error("Usage: node scripts/anchor_onchain.js --scoresRoot 0x<32B> --modelHash 0x<32B>"); process.exit(2); }

const epochAbi = [
  "function recordScoresRoot(bytes32 root) external",
  "function publishModel(bytes32 modelHash) external"
];

const iface = new ethers.Interface(epochAbi);
const data1 = iface.encodeFunctionData("recordScoresRoot",[scoresRoot]);
const data2 = iface.encodeFunctionData("publishModel",[modelHash]);
const epochAddr = process.env.EPOCH_MANAGER_ADDR || "<unset>";

console.log(JSON.stringify({ preview:{ scoresRoot, modelHash, calls:[ {to:epochAddr, data:data1}, {to:epochAddr, data:data2} ] }}));

if (process.env.CHAIN_RPC_URL && process.env.PRIVATE_KEY && process.env.EPOCH_MANAGER_ADDR) {
  const provider = new ethers.JsonRpcProvider(process.env.CHAIN_RPC_URL);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const epoch    = new ethers.Contract(process.env.EPOCH_MANAGER_ADDR, epochAbi, wallet);
  (async () => {
    const tx1 = await epoch.recordScoresRoot(scoresRoot); const r1 = await tx1.wait();
    const tx2 = await epoch.publishModel(modelHash);      const r2 = await tx2.wait();
    console.log(JSON.stringify({ sent:true, txs:[r1?.hash||r1?.transactionHash, r2?.hash||r2?.transactionHash] }));
  })().catch(e => { console.error(e.message||e); process.exit(1); });
} else {
  console.log(JSON.stringify({ sent:false, reason:"missing secrets or contract address" }));
}
