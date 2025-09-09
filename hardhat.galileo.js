// hardhat.galileo.js - plugin-free config using only solidity + networks
require('dotenv').config();                                // Load .env (PRIVATE_KEY, RPC_ENDPOINT)

const RPC  = process.env.RPC_ENDPOINT || '';               // 0G Galileo RPC
const PK   = process.env.PRIVATE_KEY || '';                // Deployer private key (secret)
const ACCS = PK ? [PK] : [];                               // Accounts array for Hardhat

module.exports = {
  solidity: {
    compilers: [                                           // Support common 0.8.x pragmas used in repo
      { version: '0.8.26' }, { version: '0.8.24' }, { version: '0.8.20' }
    ]
  },
  networks: {
    galileo: { url: RPC, accounts: ACCS }                  // Use .env values for the network
  }
};
