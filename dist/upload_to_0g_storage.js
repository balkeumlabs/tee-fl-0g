"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const _0g_ts_sdk_1 = require("@0glabs/0g-ts-sdk");
const ethers_1 = require("ethers");
async function uploadFile(filePath) {
    const absPath = path_1.default.resolve(filePath);
    const handle = await fs_1.default.promises.open(absPath, 'r');
    const stat = fs_1.default.statSync(absPath);
    const fileSize = stat.size;
    const zgFile = new _0g_ts_sdk_1.ZgFile(handle, fileSize);
    const nodes = [
        new _0g_ts_sdk_1.StorageNode('https://node1.storage.0g.ai'),
        new _0g_ts_sdk_1.StorageNode('https://node2.storage.0g.ai')
    ];
    const providerRpc = 'https://rpc.0g-chain.dev';
    const provider = new ethers_1.JsonRpcProvider(providerRpc);
    const signer = new ethers_1.Wallet(process.env.PRIVATE_KEY, provider);
    const flow = await (0, _0g_ts_sdk_1.getFlowContract)(providerRpc, signer);
    const uploader = new _0g_ts_sdk_1.Uploader(nodes, providerRpc, flow);
    const [rootHash, error] = await uploader.uploadFile(zgFile, _0g_ts_sdk_1.defaultUploadOption);
    if (error) {
        console.error(`${filePath} upload failed:`, error);
    }
    else {
        console.log(`${filePath} uploaded successfully`);
        console.log(`Root Hash: ${rootHash}`);
    }
}
async function main() {
    await uploadFile('model.json');
    await uploadFile('data.json');
    await uploadFile('./tee_fl_node/config.json');
}
main().catch(console.error);
