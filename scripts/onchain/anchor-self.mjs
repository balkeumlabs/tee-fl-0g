import 'dotenv/config';
import { ethers } from 'ethers';

const RPC = process.env.EVM_RPC || process.env.RPC_ENDPOINT;
const PK  = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
const DRY = process.env.DRY_RUN ?? '1';

const [ , , roundStr, hashArg ] = process.argv;
if (!RPC || !PK) throw new Error('Missing EVM_RPC / WALLET_PRIVATE_KEY');
if (!roundStr) throw new Error('Usage: anchor-self.mjs <round> <keccak>');
if (!hashArg || !hashArg.startsWith('0x') || hashArg.length !== 66) throw new Error('keccak must be 0x + 64 hex');

const round = Number(roundStr);
if (!Number.isInteger(round) || round < 0 || round > 0xffffffff) throw new Error('round must be 0..2^32-1');

const provider = new ethers.JsonRpcProvider(RPC);
const wallet   = new ethers.Wallet(PK, provider);
const from     = await wallet.getAddress();

// Calldata: 0x464C4149 ('FLAI') + round(uint32 BE) + hash(32 bytes)
const prefix = Buffer.from('FLAI','ascii');
const rbuf   = Buffer.alloc(4); rbuf.writeUInt32BE(round, 0);
const hbuf   = Buffer.from(hashArg.slice(2), 'hex');
const data   = '0x' + Buffer.concat([prefix, rbuf, hbuf]).toString('hex');

console.log(JSON.stringify({ dryRun: DRY, to: from, round, hash: hashArg, dataLen: data.length }, null, 2));

if (DRY === '1') {
  const gas = await provider.estimateGas({ from, to: from, data, value: 0 });
  console.log('EST_GAS:', gas.toString());
  process.exit(0);
}

const tx = await wallet.sendTransaction({ to: from, data, value: 0 });
console.log('TX_HASH:', tx.hash);
const rc = await tx.wait();
console.log('STATUS:', rc.status);
