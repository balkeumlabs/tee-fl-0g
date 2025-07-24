import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import {
  StorageNode,
  Uploader,
  defaultUploadOption,
  ZgFile,
  getFlowContract
} from '@0glabs/0g-ts-sdk';
import { JsonRpcProvider, Wallet } from 'ethers';

async function uploadFile(filePath: string) {
  const absPath = path.resolve(filePath);
  const handle = await fs.promises.open(absPath, 'r');
  const stat = fs.statSync(absPath);
  const fileSize = stat.size;

  const zgFile = new ZgFile(handle, fileSize);

  const nodes = [
    new StorageNode('https://node1.storage.0g.ai'),
    new StorageNode('https://node2.storage.0g.ai')
  ];

  const providerRpc = 'https://rpc-storage-testnet.0g.ai';
  const provider = new JsonRpcProvider(providerRpc);
  const signer = new Wallet(process.env.PRIVATE_KEY!, provider);

  const flow = await getFlowContract(providerRpc, signer);
  const uploader = new Uploader(nodes, providerRpc, flow);

  const [rootHash, error] = await uploader.uploadFile(zgFile, defaultUploadOption);

  if (error) {
    console.error(`${filePath} upload failed:`, error);
  } else {
    console.log(`${filePath} uploaded successfully`);
    console.log(`Root Hash: ${rootHash}`);
  }
}

async function main() {
  await uploadFile('model.json');
  await uploadFile('data.json');
}

main().catch(console.error);
