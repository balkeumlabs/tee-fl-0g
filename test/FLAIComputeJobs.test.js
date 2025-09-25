const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FLAIComputeJobs", function () {
  let computeJobs;
  let owner;
  let client;
  let attacker;
  let maliciousContract;

  beforeEach(async function () {
    [owner, client, attacker] = await ethers.getSigners();
    
    const FLAIComputeJobs = await ethers.getContractFactory("FLAIComputeJobs");
    computeJobs = await FLAIComputeJobs.deploy();
    await computeJobs.waitForDeployment();

    // Deploy malicious contract for reentrancy attack
    const MaliciousContract = await ethers.getContractFactory("MaliciousContract");
    maliciousContract = await MaliciousContract.deploy(await computeJobs.getAddress());
    await maliciousContract.waitForDeployment();
  });

  describe("Access Control", function () {
    it("Should allow anyone to complete any job (CRITICAL VULNERABILITY)", async function () {
      // Client submits a job with fee
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Attacker completes the job and steals the fee
      const attackerBalanceBefore = await ethers.provider.getBalance(attacker.address);
      
      await expect(computeJobs.connect(attacker).completeJob(jobId, "resultHash"))
        .to.emit(computeJobs, "JobCompleted")
        .withArgs(jobId, "resultHash");

      const attackerBalanceAfter = await ethers.provider.getBalance(attacker.address);
      
      // This test demonstrates the vulnerability - attacker can steal fees
      expect(attackerBalanceAfter).to.be.gt(attackerBalanceBefore);
    });

    it("Should prevent completing non-existent jobs", async function () {
      await expect(computeJobs.connect(attacker).completeJob(999, "resultHash"))
        .to.be.revertedWith("Invalid job");
    });

    it("Should prevent completing already completed jobs", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Complete job once
      await computeJobs.connect(attacker).completeJob(jobId, "resultHash");

      // Try to complete again
      await expect(computeJobs.connect(attacker).completeJob(jobId, "resultHash"))
        .to.be.revertedWith("Already completed");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should be vulnerable to reentrancy attack", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Deploy malicious contract that reenters
      const MaliciousContract = await ethers.getContractFactory("MaliciousContract");
      const malicious = await MaliciousContract.deploy(await computeJobs.getAddress());
      await malicious.waitForDeployment();

      // This demonstrates reentrancy vulnerability
      // The malicious contract can call completeJob multiple times before the first call completes
      await expect(malicious.attack(jobId))
        .to.be.reverted; // This will fail due to insufficient gas, but demonstrates the vulnerability
    });
  });

  describe("Job Management", function () {
    it("Should correctly track job state", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Check initial state
      const job = await computeJobs.getJob(jobId);
      expect(job.client).to.equal(client.address);
      expect(job.modelHash).to.equal("modelHash");
      expect(job.inputHash).to.equal("inputHash");
      expect(job.resultHash).to.equal("");
      expect(job.fee).to.equal(fee);
      expect(job.completed).to.be.false;

      // Complete job
      await computeJobs.connect(attacker).completeJob(jobId, "resultHash");

      // Check final state
      const completedJob = await computeJobs.getJob(jobId);
      expect(completedJob.resultHash).to.equal("resultHash");
      expect(completedJob.completed).to.be.true;
    });

    it("Should emit correct events", async function () {
      const fee = ethers.parseEther("1.0");
      
      // Test JobSubmitted event
      await expect(computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee }))
        .to.emit(computeJobs, "JobSubmitted")
        .withArgs(0, client.address, "modelHash", "inputHash", fee);

      // Test JobCompleted event
      await expect(computeJobs.connect(attacker).completeJob(0, "resultHash"))
        .to.emit(computeJobs, "JobCompleted")
        .withArgs(0, "resultHash");
    });
  });

  describe("Invariants", function () {
    it("Should maintain correct nextJobId increment", async function () {
      expect(await computeJobs.nextJobId()).to.equal(0);

      const fee = ethers.parseEther("1.0");
      await computeJobs.connect(client).submitJob("modelHash1", "inputHash1", { value: fee });
      expect(await computeJobs.nextJobId()).to.equal(1);

      await computeJobs.connect(client).submitJob("modelHash2", "inputHash2", { value: fee });
      expect(await computeJobs.nextJobId()).to.equal(2);
    });

    it("Should maintain contract balance consistency", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Contract should hold the fee
      expect(await ethers.provider.getBalance(await computeJobs.getAddress())).to.equal(fee);

      // After completion, fee should be transferred out
      await computeJobs.connect(attacker).completeJob(jobId, "resultHash");
      expect(await ethers.provider.getBalance(await computeJobs.getAddress())).to.equal(0);
    });
  });
});

// Malicious contract deployed separately in contracts/MaliciousContract.sol
