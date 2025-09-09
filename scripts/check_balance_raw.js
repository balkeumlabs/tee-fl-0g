require('dotenv').config();                                   // // Load env
const { ethers } = require('ethers');                         // // Ethers v6
(async () => {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_ENDPOINT);
  const wallet   = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const [addr, net, bal] = [await wallet.getAddress(), await provider.getNetwork(), await provider.getBalance(await wallet.getAddress())];
  console.log('// address:', addr);
  console.log('// chainId:', Number(net.chainId));
  console.log('// balance:', ethers.formatEther(bal), 'ETH');
})();
