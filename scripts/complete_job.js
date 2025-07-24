const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x57a069a1c980a1E7577b9094b15968A2962d7b33";
  const jobs = await ethers.getContractAt("FLAIComputeJobs", contractAddress);

  const jobId = 0; // the ID from your previous submission
  const resultHash = "QmResultHashExample789"; // would represent output from a TEE or model run

  const tx = await jobs.completeJob(jobId, resultHash);
  await tx.wait();

  console.log("Job", jobId, "marked as complete with result hash:", resultHash);
}

main().catch((error) => {
  console.error("Completion failed:", error);
  process.exitCode = 1;
});
