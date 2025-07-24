// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Counter {
    uint256 public count;

    event Counted(uint256 newValue);

    function increment() public {
        count += 1;
        emit Counted(count);
    }
}