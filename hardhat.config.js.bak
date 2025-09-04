require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox"); // 👈 REQUIRED for ethers to work

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    galileo: {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16601,
      accounts: [`0x${process.env.PRIVATE_KEY}`]
    }
  }
};
