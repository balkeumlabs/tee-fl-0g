const hre = require("hardhat");

async function main() {
  const Counter = await hre.ethers.getContractFactory("Counter");
  const counter = await Counter.deploy();
  await counter.waitForDeployment(); // for Ethers v6

  console.log("Counter deployed to:", await counter.getAddress()); // v6 requires async
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
