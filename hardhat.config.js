require('dotenv/config');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: { version: "0.8.19", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    galileo: {
      url: process.env.EVM_RPC || process.env.RPC_ENDPOINT,
      accounts: (process.env.WALLET_PRIVATE_KEY ? [process.env.WALLET_PRIVATE_KEY] : [])
    }
  }
};
