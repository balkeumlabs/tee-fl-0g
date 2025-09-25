const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FLAIComputeJobsSecure", function () {
  let computeJobs;
  let owner;
  let client;
  let authorizedProvider;
  let unauthorizedProvider;

  beforeEach(async function () {
    [owner, client, authorizedProvider, unauthorizedProvider] = await ethers.getSigners();
    
    const FLAIComputeJobsSecure = await ethers.getContractFactory("FLAIComputeJobsSecure");
    computeJobs = await FLAIComputeJobsSecure.deploy();
    await computeJobs.waitForDeployment();

    // Authorize a provider
    await computeJobs.connect(owner).authorizeProvider(authorizedProvider.address);
  });

  describe("Access Control", function () {
    it("Should prevent unauthorized providers from completing jobs", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Unauthorized provider cannot complete job
      await expect(computeJobs.connect(unauthorizedProvider).completeJob(jobId, "resultHash"))
        .to.be.revertedWith("Not authorized provider");
    });

    it("Should allow only authorized providers to complete jobs", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Authorized provider can complete job
      await expect(computeJobs.connect(authorizedProvider).completeJob(jobId, "resultHash"))
        .to.emit(computeJobs, "JobCompleted")
        .withArgs(jobId, "resultHash");
    });

    it("Should allow only owner to authorize providers", async function () {
      // Owner can authorize
      await expect(computeJobs.connect(owner).authorizeProvider(unauthorizedProvider.address))
        .to.emit(computeJobs, "ProviderAuthorized")
        .withArgs(unauthorizedProvider.address);

      // Non-owner cannot authorize
      await expect(computeJobs.connect(client).authorizeProvider(unauthorizedProvider.address))
        .to.be.revertedWithCustomError(computeJobs, "OwnableUnauthorizedAccount");
    });

    it("Should allow only owner to deauthorize providers", async function () {
      // Owner can deauthorize
      await expect(computeJobs.connect(owner).deauthorizeProvider(authorizedProvider.address))
        .to.emit(computeJobs, "ProviderDeauthorized")
        .withArgs(authorizedProvider.address);

      // Non-owner cannot deauthorize
      await expect(computeJobs.connect(client).deauthorizeProvider(authorizedProvider.address))
        .to.be.revertedWithCustomError(computeJobs, "OwnableUnauthorizedAccount");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks", async function () {
      const fee = ethers.parseEther("1.0");
      const tx = await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });
      const receipt = await tx.wait();
      const jobId = receipt.logs[0].args.jobId;

      // Deploy malicious contract
      const MaliciousContract = await ethers.getContractFactory("MaliciousContract");
      const malicious = await MaliciousContract.deploy(await computeJobs.getAddress());
      await malicious.waitForDeployment();

      // Authorize malicious contract as provider
      await computeJobs.connect(owner).authorizeProvider(await malicious.getAddress());

      // Reentrancy attack should fail
      await expect(malicious.attack(jobId))
        .to.be.revertedWith("ReentrancyGuard: reentrant call");
    });
  });

  describe("Job Management", function () {
    it("Should require fee for job submission", async function () {
      await expect(computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: 0 }))
        .to.be.revertedWith("Fee required");
    });

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
      await computeJobs.connect(authorizedProvider).completeJob(jobId, "resultHash");

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
      await expect(computeJobs.connect(authorizedProvider).completeJob(0, "resultHash"))
        .to.emit(computeJobs, "JobCompleted")
        .withArgs(0, "resultHash");
    });
  });

  describe("Provider Management", function () {
    it("Should track provider authorization status", async function () {
      expect(await computeJobs.authorizedProviders(authorizedProvider.address)).to.be.true;
      expect(await computeJobs.authorizedProviders(unauthorizedProvider.address)).to.be.false;
    });

    it("Should allow deauthorizing and re-authorizing providers", async function () {
      // Deauthorize
      await computeJobs.connect(owner).deauthorizeProvider(authorizedProvider.address);
      expect(await computeJobs.authorizedProviders(authorizedProvider.address)).to.be.false;

      // Re-authorize
      await computeJobs.connect(owner).authorizeProvider(authorizedProvider.address);
      expect(await computeJobs.authorizedProviders(authorizedProvider.address)).to.be.true;
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow owner to withdraw stuck funds", async function () {
      const fee = ethers.parseEther("1.0");
      await computeJobs.connect(client).submitJob("modelHash", "inputHash", { value: fee });

      const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);
      await computeJobs.connect(owner).emergencyWithdraw();
      const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);

      expect(ownerBalanceAfter).to.be.gt(ownerBalanceBefore);
      expect(await ethers.provider.getBalance(await computeJobs.getAddress())).to.equal(0);
    });

    it("Should prevent non-owner from emergency withdraw", async function () {
      await expect(computeJobs.connect(client).emergencyWithdraw())
        .to.be.revertedWithCustomError(computeJobs, "OwnableUnauthorizedAccount");
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
      await computeJobs.connect(authorizedProvider).completeJob(jobId, "resultHash");
      expect(await ethers.provider.getBalance(await computeJobs.getAddress())).to.equal(0);
    });
  });
});
