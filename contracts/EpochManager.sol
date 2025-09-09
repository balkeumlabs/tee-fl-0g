// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// // EpochManager: start epochs, accept update CIDs+hashes, post scores root, publish aggregated model
contract EpochManager {
    address public admin;                                       // // Admin for epoch control
    modifier onlyAdmin(){ require(msg.sender == admin, "not admin"); _; }
    constructor(){ admin = msg.sender; }

    struct EpochMeta {
        bytes32 modelHash;        // // Epoch model version hash
        bytes32 scoresRoot;       // // Merkle root for contributor scores
        string  globalModelCid;   // // CID of aggregated model
        bytes32 globalModelHash;  // // Hash of aggregated model file
        bool    published;        // // Whether publishModel() has been called
    }

    mapping(uint256 => EpochMeta) public epochs;                 // // epochId => meta
    mapping(uint256 => string[])  public epochUpdateCids;        // // epochId => update CIDs
    mapping(uint256 => bytes32[]) public epochUpdateHashes;      // // epochId => update hashes
    mapping(uint256 => address[]) public epochSubmitters;        // // epochId => submitters

    event EpochStarted(uint256 indexed epochId, bytes32 modelHash);
    event UpdateSubmitted(uint256 indexed epochId, address indexed submitter, string updateCid, bytes32 updateHash);
    event ScoresRootPosted(uint256 indexed epochId, bytes32 scoresRoot);
    event ModelPublished(uint256 indexed epochId, string globalModelCid, bytes32 globalModelHash);

    function startEpoch(uint256 epochId, bytes32 modelHash) external onlyAdmin {
        require(epochs[epochId].modelHash == bytes32(0), "exists");
        epochs[epochId].modelHash = modelHash;
        emit EpochStarted(epochId, modelHash);
    }

    function submitUpdate(uint256 epochId, string calldata updateCid, bytes32 updateHash) external {
        require(epochs[epochId].modelHash != bytes32(0), "epoch not started");
        epochUpdateCids[epochId].push(updateCid);
        epochUpdateHashes[epochId].push(updateHash);
        epochSubmitters[epochId].push(msg.sender);
        emit UpdateSubmitted(epochId, msg.sender, updateCid, updateHash);
    }

    function postScoresRoot(uint256 epochId, bytes32 scoresRoot) external onlyAdmin {
        require(epochs[epochId].modelHash != bytes32(0), "epoch not started");
        epochs[epochId].scoresRoot = scoresRoot;
        emit ScoresRootPosted(epochId, scoresRoot);
    }

    function publishModel(uint256 epochId, string calldata globalModelCid, bytes32 globalModelHash) external onlyAdmin {
        require(!epochs[epochId].published, "already");
        epochs[epochId].globalModelCid  = globalModelCid;
        epochs[epochId].globalModelHash = globalModelHash;
        epochs[epochId].published = true;
        emit ModelPublished(epochId, globalModelCid, globalModelHash);
    }
}
