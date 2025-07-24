const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x57a069a1c980a1E7577b9094b15968A2962d7b33"; // Your deployed contract
  const jobs = await ethers.getContractAt("FLAIComputeJobs", contractAddress);

  const modelHash = "0x635d8733affec9beb3834d5d9b661fedc8e8e531f48b2e9ed9ab8a4cf3a01a5a";
  const inputHash = "0x2260b090d4442056cd997b0aa791ed4db56948d765ddb4b6a6843f4a42657bd5";
  const fee = ethers.parseEther("0.01");

  const tx = await jobs.submitJob(modelHash, inputHash, { value: fee });
  await tx.wait();

  console.log("✅ Submitted new job with model and input hashes.");
}

main().catch((error) => {
  console.error("❌ Error submitting job:", error);
  process.exitCode = 1;
});
