const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EpochManager", function () {
  let epochManager;
  let admin;
  let submitter;
  let attacker;

  beforeEach(async function () {
    [admin, submitter, attacker] = await ethers.getSigners();
    
    const EpochManager = await ethers.getContractFactory("EpochManager");
    epochManager = await EpochManager.deploy();
    await epochManager.waitForDeployment();
  });

  describe("Access Control", function () {
    it("Should allow only admin to start epochs", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));

      // Admin can start epoch
      await expect(epochManager.connect(admin).startEpoch(epochId, modelHash))
        .to.emit(epochManager, "EpochStarted")
        .withArgs(epochId, modelHash);

      // Non-admin cannot start epoch
      await expect(epochManager.connect(attacker).startEpoch(2, modelHash))
        .to.be.revertedWith("not admin");
    });

    it("Should allow only admin to post scores root", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes("scoresRoot"));

      // Start epoch first
      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Admin can post scores root
      await expect(epochManager.connect(admin).postScoresRoot(epochId, scoresRoot))
        .to.emit(epochManager, "ScoresRootPosted")
        .withArgs(epochId, scoresRoot);

      // Non-admin cannot post scores root
      await expect(epochManager.connect(attacker).postScoresRoot(epochId, scoresRoot))
        .to.be.revertedWith("not admin");
    });

    it("Should allow only admin to publish models", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const globalModelCid = "QmGlobalModel";
      const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes("globalModel"));

      // Start epoch first
      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Admin can publish model
      await expect(epochManager.connect(admin).publishModel(epochId, globalModelCid, globalModelHash))
        .to.emit(epochManager, "ModelPublished")
        .withArgs(epochId, globalModelCid, globalModelHash);

      // Non-admin cannot publish model
      await expect(epochManager.connect(attacker).publishModel(epochId, globalModelCid, globalModelHash))
        .to.be.revertedWith("not admin");
    });

    it("Should allow anyone to submit updates", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const updateCid = "QmUpdate";
      const updateHash = ethers.keccak256(ethers.toUtf8Bytes("update"));

      // Start epoch first
      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Anyone can submit updates
      await expect(epochManager.connect(submitter).submitUpdate(epochId, updateCid, updateHash))
        .to.emit(epochManager, "UpdateSubmitted")
        .withArgs(epochId, submitter.address, updateCid, updateHash);

      await expect(epochManager.connect(attacker).submitUpdate(epochId, updateCid, updateHash))
        .to.emit(epochManager, "UpdateSubmitted")
        .withArgs(epochId, attacker.address, updateCid, updateHash);
    });
  });

  describe("Epoch Lifecycle", function () {
    it("Should prevent starting duplicate epochs", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));

      // Start epoch
      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Try to start same epoch again
      await expect(epochManager.connect(admin).startEpoch(epochId, modelHash))
        .to.be.revertedWith("exists");
    });

    it("Should prevent operations on non-existent epochs", async function () {
      const epochId = 999;
      const updateCid = "QmUpdate";
      const updateHash = ethers.keccak256(ethers.toUtf8Bytes("update"));
      const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes("scoresRoot"));
      const globalModelCid = "QmGlobalModel";
      const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes("globalModel"));

      // All operations should fail on non-existent epoch
      await expect(epochManager.connect(submitter).submitUpdate(epochId, updateCid, updateHash))
        .to.be.revertedWith("epoch not started");

      await expect(epochManager.connect(admin).postScoresRoot(epochId, scoresRoot))
        .to.be.revertedWith("epoch not started");

      await expect(epochManager.connect(admin).publishModel(epochId, globalModelCid, globalModelHash))
        .to.be.revertedWith("epoch not started");
    });

    it("Should prevent double publishing", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const globalModelCid = "QmGlobalModel";
      const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes("globalModel"));

      // Start epoch and publish model
      await epochManager.connect(admin).startEpoch(epochId, modelHash);
      await epochManager.connect(admin).publishModel(epochId, globalModelCid, globalModelHash);

      // Try to publish again
      await expect(epochManager.connect(admin).publishModel(epochId, globalModelCid, globalModelHash))
        .to.be.revertedWith("already");
    });
  });

  describe("Update Management", function () {
    it("Should track multiple updates per epoch", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));

      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Submit multiple updates
      const updates = [
        { cid: "QmUpdate1", hash: ethers.keccak256(ethers.toUtf8Bytes("update1")) },
        { cid: "QmUpdate2", hash: ethers.keccak256(ethers.toUtf8Bytes("update2")) },
        { cid: "QmUpdate3", hash: ethers.keccak256(ethers.toUtf8Bytes("update3")) }
      ];

      for (let i = 0; i < updates.length; i++) {
        await epochManager.connect(submitter).submitUpdate(epochId, updates[i].cid, updates[i].hash);
      }

      // Verify all updates are tracked
      const cids = await epochManager.epochUpdateCids(epochId);
      const hashes = await epochManager.epochUpdateHashes(epochId);
      const submitters = await epochManager.epochSubmitters(epochId);

      expect(cids.length).to.equal(3);
      expect(hashes.length).to.equal(3);
      expect(submitters.length).to.equal(3);

      expect(cids[0]).to.equal("QmUpdate1");
      expect(cids[1]).to.equal("QmUpdate2");
      expect(cids[2]).to.equal("QmUpdate3");

      expect(submitters[0]).to.equal(submitter.address);
      expect(submitters[1]).to.equal(submitter.address);
      expect(submitters[2]).to.equal(submitter.address);
    });

    it("Should track different submitters", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));

      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Different submitters submit updates
      await epochManager.connect(submitter).submitUpdate(epochId, "QmUpdate1", ethers.keccak256(ethers.toUtf8Bytes("update1")));
      await epochManager.connect(attacker).submitUpdate(epochId, "QmUpdate2", ethers.keccak256(ethers.toUtf8Bytes("update2")));

      const submitters = await epochManager.epochSubmitters(epochId);
      expect(submitters[0]).to.equal(submitter.address);
      expect(submitters[1]).to.equal(attacker.address);
    });
  });

  describe("State Management", function () {
    it("Should correctly track epoch metadata", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const scoresRoot = ethers.keccak256(ethers.toUtf8Bytes("scoresRoot"));
      const globalModelCid = "QmGlobalModel";
      const globalModelHash = ethers.keccak256(ethers.toUtf8Bytes("globalModel"));

      // Start epoch
      await epochManager.connect(admin).startEpoch(epochId, modelHash);
      let epoch = await epochManager.epochs(epochId);
      expect(epoch.modelHash).to.equal(modelHash);
      expect(epoch.scoresRoot).to.equal(ethers.ZeroHash);
      expect(epoch.globalModelCid).to.equal("");
      expect(epoch.globalModelHash).to.equal(ethers.ZeroHash);
      expect(epoch.published).to.be.false;

      // Post scores root
      await epochManager.connect(admin).postScoresRoot(epochId, scoresRoot);
      epoch = await epochManager.epochs(epochId);
      expect(epoch.scoresRoot).to.equal(scoresRoot);

      // Publish model
      await epochManager.connect(admin).publishModel(epochId, globalModelCid, globalModelHash);
      epoch = await epochManager.epochs(epochId);
      expect(epoch.globalModelCid).to.equal(globalModelCid);
      expect(epoch.globalModelHash).to.equal(globalModelHash);
      expect(epoch.published).to.be.true;
    });
  });

  describe("Invariants", function () {
    it("Should maintain consistent epoch state", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));

      // Before starting epoch, all arrays should be empty
      expect((await epochManager.epochUpdateCids(epochId)).length).to.equal(0);
      expect((await epochManager.epochUpdateHashes(epochId)).length).to.equal(0);
      expect((await epochManager.epochSubmitters(epochId)).length).to.equal(0);

      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // After starting epoch, arrays should still be empty until updates are submitted
      expect((await epochManager.epochUpdateCids(epochId)).length).to.equal(0);
      expect((await epochManager.epochUpdateHashes(epochId)).length).to.equal(0);
      expect((await epochManager.epochSubmitters(epochId)).length).to.equal(0);
    });

    it("Should maintain array length consistency", async function () {
      const epochId = 1;
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));

      await epochManager.connect(admin).startEpoch(epochId, modelHash);

      // Submit updates
      await epochManager.connect(submitter).submitUpdate(epochId, "QmUpdate1", ethers.keccak256(ethers.toUtf8Bytes("update1")));
      await epochManager.connect(attacker).submitUpdate(epochId, "QmUpdate2", ethers.keccak256(ethers.toUtf8Bytes("update2")));

      // All arrays should have same length
      const cidsLength = (await epochManager.epochUpdateCids(epochId)).length;
      const hashesLength = (await epochManager.epochUpdateHashes(epochId)).length;
      const submittersLength = (await epochManager.epochSubmitters(epochId)).length;

      expect(cidsLength).to.equal(hashesLength);
      expect(hashesLength).to.equal(submittersLength);
      expect(submittersLength).to.equal(2);
    });
  });
});
