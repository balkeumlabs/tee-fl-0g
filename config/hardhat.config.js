require('dotenv/config');
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { 
    compilers: [
      { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 } } },
      { version: "0.8.20", settings: { optimizer: { enabled: true, runs: 200 } } }
    ]
  },
  networks: {
    hardhat: {
      chainId: 1337
    },
    galileo: {
      url: process.env.EVM_RPC || process.env.RPC_ENDPOINT || "https://evmrpc-testnet.0g.ai",
      accounts: (process.env.WALLET_PRIVATE_KEY ? [process.env.WALLET_PRIVATE_KEY] : [])
    },
    mainnet: {
      url: process.env.RPC_ENDPOINT || "https://evmrpc.0g.ai",
      chainId: 16661,
      accounts: (process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [])
    }
  }
};
