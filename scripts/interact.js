const hre = require("hardhat");

async function main() {
  const contractAddress = "0x39FDd691B8fA988aE221CB3d0423c5f613Bee56e"; // your deployed contract

  const Counter = await hre.ethers.getContractFactory("Counter");
  const counter = await Counter.attach(contractAddress);

  // Read count
  const current = await counter.count();
  console.log("Current count:", current.toString());

  // Call increment()
  const tx = await counter.increment();
  await tx.wait();

  // Read updated count
  const updated = await counter.count();
  console.log("Updated count:", updated.toString());
}

main().catch((error) => {
  console.error("Interaction failed:", error);
  process.exitCode = 1;
});
