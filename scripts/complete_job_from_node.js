const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x57a069a1c980a1E7577b9094b15968A2962d7b33";
  const jobs = await ethers.getContractAt("FLAIComputeJobs", contractAddress);

  const jobId = 1;  // New job ID
  const resultHash = "f4247a08c3bf4ea001e6c2074e045572ea508a58dc4cca0d44d7e367676d09b7"; // Hash from Python

  const tx = await jobs.completeJob(jobId, resultHash);
  await tx.wait();

  console.log("✅ Completed job", jobId, "with result hash:", resultHash);
}

main().catch((error) => {
  console.error("❌ Error completing job:", error);
  process.exitCode = 1;
});
