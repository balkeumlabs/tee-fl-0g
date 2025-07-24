const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x57a069a1c980a1E7577b9094b15968A2962d7b33"; // your deployed contract
  const jobs = await ethers.getContractAt("FLAIComputeJobs", contractAddress);

  const modelHash = "QmModelHashExample123"; // replace with real IPFS/0gStorage hash later
  const inputHash = "QmInputHashExample456"; // ditto

  const tx = await jobs.submitJob(modelHash, inputHash, {
    value: ethers.parseEther("0.01") // reward to compute node
  });
  const receipt = await tx.wait();

  const event = receipt.logs.find(log => log.fragment.name === "JobSubmitted");
  const jobId = event.args.jobId;

  console.log("Submitted job ID:", jobId.toString());
}

main().catch((error) => {
  console.error("Submission failed:", error);
  process.exitCode = 1;
});
