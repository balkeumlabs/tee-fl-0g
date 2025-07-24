const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x57a069a1c980a1E7577b9094b15968A2962d7b33";
  const jobs = await ethers.getContractAt("FLAIComputeJobs", contractAddress);

  const jobId = 0;

  const job = await jobs.getJob(jobId);
  console.log("Job", jobId);
  console.log("Client:", job.client);
  console.log("Model Hash:", job.modelHash);
  console.log("Input Hash:", job.inputHash);
  console.log("Result Hash:", job.resultHash);
  console.log("Fee:", ethers.formatEther(job.fee), "OG");
  console.log("Completed:", job.completed);
}

main().catch((error) => {
  console.error("Failed to fetch job:", error);
  process.exitCode = 1;
});
