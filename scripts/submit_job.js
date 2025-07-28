const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const contractAddress = "0x57a069a1c980a1E7577b9094b15968A2962d7b33";
  const jobs = await ethers.getContractAt("FLAIComputeJobs", contractAddress);

  const modelHash = "QmModelHashExample123"; // or real 0g hash if you want
  const inputHash = "QmInputHashExample456"; // same

  const tx = await jobs.submitJob(modelHash, inputHash, {
    value: ethers.parseEther("0.01")
  });

  const receipt = await tx.wait();
  const event = receipt.logs.find(log => log.fragment.name === "JobSubmitted");

  const jobId = event.args.jobId;
  console.log("✅ New Job Submitted with ID:", jobId.toString());
}

main().catch(console.error);
