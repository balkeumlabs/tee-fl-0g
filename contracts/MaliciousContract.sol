// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./FLAIComputeJobs.sol";

contract MaliciousContract {
    FLAIComputeJobs public target;
    bool public attacking = false;
    
    constructor(address _target) {
        target = FLAIComputeJobs(_target);
    }
    
    function attack(uint256 jobId) external {
        attacking = true;
        target.completeJob(jobId, "malicious");
    }
    
    receive() external payable {
        if (attacking) {
            attacking = false;
            // Try to reenter (this will fail due to gas limits, but demonstrates vulnerability)
            target.completeJob(0, "reentrant");
        }
    }
}
