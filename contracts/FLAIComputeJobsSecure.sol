// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract FLAIComputeJobsSecure is ReentrancyGuard, Ownable {
    uint256 public nextJobId;
    
    // Mapping to track authorized compute providers
    mapping(address => bool) public authorizedProviders;
    
    // Events
    event ProviderAuthorized(address indexed provider);
    event ProviderDeauthorized(address indexed provider);
    event JobSubmitted(uint256 jobId, address indexed client, string modelHash, string inputHash, uint256 fee);
    event JobCompleted(uint256 jobId, string resultHash);

    struct Job {
        address client;
        string modelHash;
        string inputHash;
        string resultHash;
        uint256 fee;
        bool completed;
    }

    mapping(uint256 => Job) public jobs;

    constructor() Ownable(msg.sender) {}

    // Only authorized providers can complete jobs
    modifier onlyAuthorizedProvider() {
        require(authorizedProviders[msg.sender], "Not authorized provider");
        _;
    }

    // Admin functions
    function authorizeProvider(address provider) external onlyOwner {
        authorizedProviders[provider] = true;
        emit ProviderAuthorized(provider);
    }

    function deauthorizeProvider(address provider) external onlyOwner {
        authorizedProviders[provider] = false;
        emit ProviderDeauthorized(provider);
    }

    // Client submits job with fee
    function submitJob(string calldata modelHash, string calldata inputHash) external payable returns (uint256) {
        require(msg.value > 0, "Fee required");
        
        uint256 jobId = nextJobId++;
        jobs[jobId] = Job(msg.sender, modelHash, inputHash, "", msg.value, false);
        emit JobSubmitted(jobId, msg.sender, modelHash, inputHash, msg.value);
        return jobId;
    }

    // Only authorized providers can complete jobs
    function completeJob(uint256 jobId, string calldata resultHash) external onlyAuthorizedProvider nonReentrant {
        Job storage job = jobs[jobId];
        require(!job.completed, "Already completed");
        require(job.client != address(0), "Invalid job");
        
        job.resultHash = resultHash;
        job.completed = true;
        emit JobCompleted(jobId, resultHash);
        
        // Use call instead of transfer for better security
        (bool success, ) = payable(msg.sender).call{value: job.fee}("");
        require(success, "Transfer failed");
    }

    // View function
    function getJob(uint256 jobId) external view returns (
        address client,
        string memory modelHash,
        string memory inputHash,
        string memory resultHash,
        uint256 fee,
        bool completed
    ) {
        Job storage job = jobs[jobId];
        return (
            job.client,
            job.modelHash,
            job.inputHash,
            job.resultHash,
            job.fee,
            job.completed
        );
    }

    // Emergency function for owner to withdraw stuck funds
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
