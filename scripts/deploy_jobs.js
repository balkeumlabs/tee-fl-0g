const hre = require("hardhat");

async function main() {
  const Jobs = await hre.ethers.getContractFactory("FLAIComputeJobs");
  const jobs = await Jobs.deploy();
  await jobs.waitForDeployment();

  console.log("FLAIComputeJobs deployed to:", await jobs.getAddress());
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
