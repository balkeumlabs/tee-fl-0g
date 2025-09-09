// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// // AccessRegistry: dataset owners grant time-boxed read access on dataset+model to a TEE provider
contract AccessRegistry {
    struct Grant {
        address owner;            // // Dataset owner
        address provider;         // // Approved TEE provider
        string datasetCid;        // // 0G Storage CID (encrypted dataset)
        bytes32 modelHash;        // // Model version hash (32 bytes)
        uint64  expiry;           // // Unix expiry (seconds)
        bool    revoked;          // // Early revocation flag
    }

    // // Key = keccak256(owner, provider, datasetCid, modelHash)
    mapping(bytes32 => Grant) public grants;

    event AccessGranted(bytes32 indexed key, address indexed owner, address indexed provider, string datasetCid, bytes32 modelHash, uint64 expiry);
    event AccessRevoked(bytes32 indexed key, address indexed owner);

    // // Create or update a grant; only the dataset owner (msg.sender)
    function grantAccess(address provider, string calldata datasetCid, bytes32 modelHash, uint64 expiry) external returns (bytes32 key) {
        require(provider != address(0), "bad provider");
        require(expiry > block.timestamp, "bad expiry");
        key = keccak256(abi.encodePacked(msg.sender, provider, datasetCid, modelHash));
        grants[key] = Grant({ owner: msg.sender, provider: provider, datasetCid: datasetCid, modelHash: modelHash, expiry: expiry, revoked: false });
        emit AccessGranted(key, msg.sender, provider, datasetCid, modelHash, expiry);
    }

    // // Revoke an existing grant; only owner may call
    function revokeAccess(bytes32 key) external {
        Grant storage g = grants[key];
        require(g.owner == msg.sender, "not owner");
        require(!g.revoked, "already revoked");
        g.revoked = true;
        emit AccessRevoked(key, msg.sender);
    }

    // // Check approval at current time
    function isProviderApproved(address owner, address provider, string calldata datasetCid, bytes32 modelHash) external view returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(owner, provider, datasetCid, modelHash));
        Grant storage g = grants[key];
        if (g.revoked || g.expiry <= block.timestamp) return false;
        return g.owner == owner && g.provider == provider;
    }
}
