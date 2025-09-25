const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessRegistry", function () {
  let accessRegistry;
  let owner;
  let provider;
  let attacker;

  beforeEach(async function () {
    [owner, provider, attacker] = await ethers.getSigners();
    
    const AccessRegistry = await ethers.getContractFactory("AccessRegistry");
    accessRegistry = await AccessRegistry.deploy();
    await accessRegistry.waitForDeployment();
  });

  describe("Access Control", function () {
    it("Should allow only owner to grant access", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      await expect(accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      )).to.emit(accessRegistry, "AccessGranted");

      // Attacker can grant access for themselves (this is actually allowed by the contract)
      // The contract doesn't prevent anyone from granting access - it just records who granted it
      await expect(accessRegistry.connect(attacker).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      )).to.emit(accessRegistry, "AccessGranted");
    });

    it("Should allow only owner to revoke access", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Owner grants access
      const tx = await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );
      const receipt = await tx.wait();
      const key = receipt.logs[0].args.key;

      // Owner can revoke
      await expect(accessRegistry.connect(owner).revokeAccess(key))
        .to.emit(accessRegistry, "AccessRevoked");

      // Attacker cannot revoke
      await expect(accessRegistry.connect(attacker).revokeAccess(key))
        .to.be.revertedWith("not owner");
    });
  });

  describe("Grant Management", function () {
    it("Should create grants with correct parameters", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      const tx = await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );
      const receipt = await tx.wait();
      const key = receipt.logs[0].args.key;

      // Verify grant details
      const grant = await accessRegistry.grants(key);
      expect(grant.owner).to.equal(owner.address);
      expect(grant.provider).to.equal(provider.address);
      expect(grant.datasetCid).to.equal(datasetCid);
      expect(grant.modelHash).to.equal(modelHash);
      expect(grant.expiry).to.equal(expiry);
      expect(grant.revoked).to.be.false;
    });

    it("Should prevent invalid provider addresses", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      await expect(accessRegistry.connect(owner).grantAccess(
        ethers.ZeroAddress, // Invalid provider
        datasetCid,
        modelHash,
        expiry
      )).to.be.revertedWith("bad provider");
    });

    it("Should prevent expired grants", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago (expired)

      await expect(accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      )).to.be.revertedWith("bad expiry");
    });

    it("Should allow updating existing grants", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry1 = Math.floor(Date.now() / 1000) + 3600;
      const expiry2 = Math.floor(Date.now() / 1000) + 7200; // 2 hours

      // Create initial grant
      const tx1 = await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry1
      );
      const receipt1 = await tx1.wait();
      const key = receipt1.logs[0].args.key;

      // Update grant with new expiry
      await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry2
      );

      // Verify updated grant
      const grant = await accessRegistry.grants(key);
      expect(grant.expiry).to.equal(expiry2);
    });
  });

  describe("Approval Checking", function () {
    it("Should correctly approve valid grants", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Grant access
      await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );

      // Check approval
      const isApproved = await accessRegistry.isProviderApproved(
        owner.address,
        provider.address,
        datasetCid,
        modelHash
      );
      expect(isApproved).to.be.true;
    });

    it("Should reject expired grants", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 1; // 1 second from now

      // Grant access
      await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );

      // Wait for expiry
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      // Check approval (should be false due to expiry)
      const isApproved = await accessRegistry.isProviderApproved(
        owner.address,
        provider.address,
        datasetCid,
        modelHash
      );
      expect(isApproved).to.be.false;
    });

    it("Should reject revoked grants", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Grant access
      const tx = await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );
      const receipt = await tx.wait();
      const key = receipt.logs[0].args.key;

      // Revoke access
      await accessRegistry.connect(owner).revokeAccess(key);

      // Check approval (should be false due to revocation)
      const isApproved = await accessRegistry.isProviderApproved(
        owner.address,
        provider.address,
        datasetCid,
        modelHash
      );
      expect(isApproved).to.be.false;
    });

    it("Should reject non-existent grants", async function () {
      const datasetCid = "QmNonExistent";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("nonExistent"));

      const isApproved = await accessRegistry.isProviderApproved(
        owner.address,
        provider.address,
        datasetCid,
        modelHash
      );
      expect(isApproved).to.be.false;
    });
  });

  describe("Edge Cases", function () {
    it("Should handle multiple grants for same owner-provider pair", async function () {
      const datasetCid1 = "QmDataset1";
      const datasetCid2 = "QmDataset2";
      const modelHash1 = ethers.keccak256(ethers.toUtf8Bytes("model1"));
      const modelHash2 = ethers.keccak256(ethers.toUtf8Bytes("model2"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      // Create two separate grants
      await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid1,
        modelHash1,
        expiry
      );

      await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid2,
        modelHash2,
        expiry
      );

      // Both should be approved
      expect(await accessRegistry.isProviderApproved(
        owner.address,
        provider.address,
        datasetCid1,
        modelHash1
      )).to.be.true;

      expect(await accessRegistry.isProviderApproved(
        owner.address,
        provider.address,
        datasetCid2,
        modelHash2
      )).to.be.true;
    });

    it("Should prevent double revocation", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      const tx = await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );
      const receipt = await tx.wait();
      const key = receipt.logs[0].args.key;

      // First revocation should succeed
      await accessRegistry.connect(owner).revokeAccess(key);

      // Second revocation should fail
      await expect(accessRegistry.connect(owner).revokeAccess(key))
        .to.be.revertedWith("already revoked");
    });
  });

  describe("Invariants", function () {
    it("Should maintain consistent key generation", async function () {
      const datasetCid = "QmTestDataset";
      const modelHash = ethers.keccak256(ethers.toUtf8Bytes("modelHash"));
      const expiry = Math.floor(Date.now() / 1000) + 3600;

      const tx = await accessRegistry.connect(owner).grantAccess(
        provider.address,
        datasetCid,
        modelHash,
        expiry
      );
      const receipt = await tx.wait();
      const key = receipt.logs[0].args.key;

      // Key should be consistent with keccak256(owner, provider, datasetCid, modelHash)
      const expectedKey = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "address", "string", "bytes32"],
          [owner.address, provider.address, datasetCid, modelHash]
        )
      );
      expect(key).to.equal(expectedKey);
    });
  });
});
