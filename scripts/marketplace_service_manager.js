// scripts/marketplace_service_manager.js
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JsonRpcProvider, Wallet } from 'ethers';

const OG_MARKETPLACE_RPC = process.env.OG_MARKETPLACE_RPC || process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const OG_MARKETPLACE_PRIVATE_KEY = process.env.OG_MARKETPLACE_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const OG_MARKETPLACE_CONTRACT_ADDRESS = process.env.OG_MARKETPLACE_CONTRACT_ADDRESS || '';
const OG_MARKETPLACE_SERVICE_ID = process.env.OG_MARKETPLACE_SERVICE_ID || '';

function sha256Hex(buf) {
  return '0x' + createHash('sha256').update(buf).digest('hex');
}

// Simple marketplace service contract ABI (minimal interface)
const MARKETPLACE_ABI = [
  "function registerService(string memory name, string memory description, uint256 pricePerInference, string memory modelCid) external returns (uint256 serviceId)",
  "function updateService(uint256 serviceId, string memory modelCid, uint256 pricePerInference) external",
  "function requestInference(uint256 serviceId, string memory inputCid) external payable returns (uint256 requestId)",
  "function getService(uint256 serviceId) external view returns (string memory name, string memory description, uint256 pricePerInference, string memory modelCid, address owner, bool active)",
  "function getInferenceResult(uint256 requestId) external view returns (string memory resultCid, bool completed)",
  "event ServiceRegistered(uint256 indexed serviceId, address indexed owner, string name, uint256 pricePerInference)",
  "event InferenceRequested(uint256 indexed requestId, uint256 indexed serviceId, address indexed requester, string inputCid)",
  "event InferenceCompleted(uint256 indexed requestId, string resultCid)"
];

class MarketplaceServiceManager {
  constructor() {
    this.provider = new JsonRpcProvider(OG_MARKETPLACE_RPC);
    this.signer = new Wallet(OG_MARKETPLACE_PRIVATE_KEY, this.provider);
    this.contract = null;
  }

  async initialize() {
    if (!OG_MARKETPLACE_CONTRACT_ADDRESS) {
      throw new Error("OG_MARKETPLACE_CONTRACT_ADDRESS not set");
    }
    
    this.contract = new ethers.Contract(
      OG_MARKETPLACE_CONTRACT_ADDRESS,
      MARKETPLACE_ABI,
      this.signer
    );
    
    console.log(`Initialized marketplace service manager`);
    console.log(`Contract: ${OG_MARKETPLACE_CONTRACT_ADDRESS}`);
    console.log(`Signer: ${await this.signer.getAddress()}`);
  }

  async registerService(serviceName, description, pricePerInference, modelCid) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    console.log(`Registering service: ${serviceName}`);
    console.log(`Description: ${description}`);
    console.log(`Price per inference: ${pricePerInference} wei`);
    console.log(`Model CID: ${modelCid}`);

    try {
      const tx = await this.contract.registerService(
        serviceName,
        description,
        pricePerInference,
        modelCid
      );
      
      console.log(`Transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      // Extract service ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed.name === 'ServiceRegistered';
        } catch (e) {
          return false;
        }
      });
      
      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        const serviceId = parsed.args.serviceId.toString();
        console.log(`Service registered with ID: ${serviceId}`);
        return serviceId;
      } else {
        throw new Error("ServiceRegistered event not found in transaction receipt");
      }
    } catch (error) {
      console.error(`Failed to register service: ${error.message}`);
      throw error;
    }
  }

  async updateService(serviceId, modelCid, pricePerInference) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    console.log(`Updating service ${serviceId}`);
    console.log(`New model CID: ${modelCid}`);
    console.log(`New price: ${pricePerInference} wei`);

    try {
      const tx = await this.contract.updateService(serviceId, modelCid, pricePerInference);
      console.log(`Update transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Service updated successfully`);
      return receipt;
    } catch (error) {
      console.error(`Failed to update service: ${error.message}`);
      throw error;
    }
  }

  async requestInference(serviceId, inputCid, paymentAmount) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    console.log(`Requesting inference for service ${serviceId}`);
    console.log(`Input CID: ${inputCid}`);
    console.log(`Payment: ${paymentAmount} wei`);

    try {
      const tx = await this.contract.requestInference(serviceId, inputCid, {
        value: paymentAmount
      });
      
      console.log(`Inference request submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      
      // Extract request ID from event
      const event = receipt.logs.find(log => {
        try {
          const parsed = this.contract.interface.parseLog(log);
          return parsed.name === 'InferenceRequested';
        } catch (e) {
          return false;
        }
      });
      
      if (event) {
        const parsed = this.contract.interface.parseLog(event);
        const requestId = parsed.args.requestId.toString();
        console.log(`Inference request ID: ${requestId}`);
        return requestId;
      } else {
        throw new Error("InferenceRequested event not found in transaction receipt");
      }
    } catch (error) {
      console.error(`Failed to request inference: ${error.message}`);
      throw error;
    }
  }

  async getService(serviceId) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    try {
      const service = await this.contract.getService(serviceId);
      return {
        name: service[0],
        description: service[1],
        pricePerInference: service[2].toString(),
        modelCid: service[3],
        owner: service[4],
        active: service[5]
      };
    } catch (error) {
      console.error(`Failed to get service: ${error.message}`);
      throw error;
    }
  }

  async getInferenceResult(requestId) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    try {
      const result = await this.contract.getInferenceResult(requestId);
      return {
        resultCid: result[0],
        completed: result[1]
      };
    } catch (error) {
      console.error(`Failed to get inference result: ${error.message}`);
      throw error;
    }
  }

  async createServiceFromManifest(manifestPath) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    
    const serviceName = `FLAI-Model-Epoch-${manifest.epoch}`;
    const description = `Federated Learning model trained on 0G - Epoch ${manifest.epoch}. Global model hash: ${manifest.artifacts.globalModelHash}`;
    const pricePerInference = BigInt(1000000000000000); // 0.001 ETH in wei
    const modelCid = manifest.artifacts.globalModelCid;

    return await this.registerService(serviceName, description, pricePerInference, modelCid);
  }
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command) {
    console.error("Usage: node scripts/marketplace_service_manager.js <command> [args...]");
    console.error("Commands:");
    console.error("  register <name> <description> <price> <modelCid>");
    console.error("  update <serviceId> <modelCid> <price>");
    console.error("  request <serviceId> <inputCid> <payment>");
    console.error("  get-service <serviceId>");
    console.error("  get-result <requestId>");
    console.error("  create-from-manifest <manifestPath>");
    process.exit(2);
  }

  const manager = new MarketplaceServiceManager();
  await manager.initialize();

  try {
    switch (command) {
      case 'register':
        if (args.length !== 4) {
          console.error("Usage: register <name> <description> <price> <modelCid>");
          process.exit(2);
        }
        const [name, description, price, modelCid] = args;
        await manager.registerService(name, description, BigInt(price), modelCid);
        break;

      case 'update':
        if (args.length !== 3) {
          console.error("Usage: update <serviceId> <modelCid> <price>");
          process.exit(2);
        }
        const [serviceId, newModelCid, newPrice] = args;
        await manager.updateService(serviceId, newModelCid, BigInt(newPrice));
        break;

      case 'request':
        if (args.length !== 3) {
          console.error("Usage: request <serviceId> <inputCid> <payment>");
          process.exit(2);
        }
        const [reqServiceId, inputCid, payment] = args;
        await manager.requestInference(reqServiceId, inputCid, BigInt(payment));
        break;

      case 'get-service':
        if (args.length !== 1) {
          console.error("Usage: get-service <serviceId>");
          process.exit(2);
        }
        const service = await manager.getService(args[0]);
        console.log(JSON.stringify(service, null, 2));
        break;

      case 'get-result':
        if (args.length !== 1) {
          console.error("Usage: get-result <requestId>");
          process.exit(2);
        }
        const result = await manager.getInferenceResult(args[0]);
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'create-from-manifest':
        if (args.length !== 1) {
          console.error("Usage: create-from-manifest <manifestPath>");
          process.exit(2);
        }
        const manifestServiceId = await manager.createServiceFromManifest(args[0]);
        console.log(`Service created with ID: ${manifestServiceId}`);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(2);
    }
  } catch (error) {
    console.error(`Command failed: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((e) => {
    console.error(e.stack || String(e));
    process.exit(1);
  });
}

export { MarketplaceServiceManager, sha256Hex };
