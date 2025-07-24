// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract FLAIComputeJobs {
    uint256 public nextJobId;

    struct Job {
        address client;
        string modelHash;
        string inputHash;
        string resultHash;
        uint256 fee;
        bool completed;
    }

    mapping(uint256 => Job) public jobs;

    event JobSubmitted(uint256 jobId, address indexed client, string modelHash, string inputHash, uint256 fee);
    event JobCompleted(uint256 jobId, string resultHash);

    function submitJob(string calldata modelHash, string calldata inputHash) external payable returns (uint256) {
        uint256 jobId = nextJobId++;
        jobs[jobId] = Job(msg.sender, modelHash, inputHash, "", msg.value, false);
        emit JobSubmitted(jobId, msg.sender, modelHash, inputHash, msg.value);
        return jobId;
    }

    function completeJob(uint256 jobId, string calldata resultHash) external {
        Job storage job = jobs[jobId];
        require(!job.completed, "Already completed");
        require(job.client != address(0), "Invalid job");
        job.resultHash = resultHash;
        job.completed = true;
        emit JobCompleted(jobId, resultHash);
        payable(msg.sender).transfer(job.fee); // reward whoever computed the result
    }

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
}
