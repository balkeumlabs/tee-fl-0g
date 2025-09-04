import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { ethers } from 'ethers';

const RPC = process.env.EVM_RPC || process.env.RPC_ENDPOINT;
if (!RPC) throw new Error('Set EVM_RPC or RPC_ENDPOINT in .env');

const CANDIDATES = [
  '0x57a069a1c980a1E7577b9094b15968A2962d7b33',
  '0x39FDd691B8fA988aE221CB3d0423c5f613Bee56e'
];

const artPath = 'artifacts/contracts/FLAIComputeJobs.sol/FLAIComputeJobs.json';
const art = JSON.parse(readFileSync(artPath,'utf8'));
const runtime = (art.deployedBytecode || '').toLowerCase();
if (!runtime || runtime === '0x') throw new Error('deployedBytecode not found in artifact');

const provider = new ethers.JsonRpcProvider(RPC);
const prefixLenBytes = 64; // compare first 64 bytes
const prefix = runtime.slice(0, 2 + prefixLenBytes*2);

(async () => {
  for (const a of CANDIDATES) {
    const code = (await provider.getCode(a)).toLowerCase();
    const isContract = code !== '0x';
    const prefixMatch = isContract && code.startsWith(prefix);
    console.log(JSON.stringify({ address: a, isContract, codeLen: code.length, prefixMatch }, null, 2));
  }
})().catch(e => { console.error(e); process.exit(1); });
