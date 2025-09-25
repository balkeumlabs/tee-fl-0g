// scripts/marketplace_client.js
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JsonRpcProvider, Wallet } from 'ethers';

const OG_MARKETPLACE_RPC = process.env.OG_MARKETPLACE_RPC || process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const OG_MARKETPLACE_PRIVATE_KEY = process.env.OG_MARKETPLACE_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const OG_MARKETPLACE_CONTRACT_ADDRESS = process.env.OG_MARKETPLACE_CONTRACT_ADDRESS || '';

// Marketplace contract ABI for client operations
const MARKETPLACE_ABI = [
  "function requestInference(uint256 serviceId, string memory inputCid) external payable returns (uint256 requestId)",
  "function getInferenceResult(uint256 requestId) external view returns (string memory resultCid, bool completed)",
  "function getService(uint256 serviceId) external view returns (string memory name, string memory description, uint256 pricePerInference, string memory modelCid, address owner, bool active)",
  "event InferenceRequested(uint256 indexed requestId, uint256 indexed serviceId, address indexed requester, string inputCid)",
  "event InferenceCompleted(uint256 indexed requestId, string resultCid)"
];

class MarketplaceClient {
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
    
    console.log(`Initialized marketplace client`);
    console.log(`Contract: ${OG_MARKETPLACE_CONTRACT_ADDRESS}`);
    console.log(`Client: ${await this.signer.getAddress()}`);
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

  async requestInference(serviceId, inputCid) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    // Get service details to determine payment amount
    const service = await this.getService(serviceId);
    const paymentAmount = BigInt(service.pricePerInference);

    console.log(`Requesting inference for service ${serviceId}`);
    console.log(`Service: ${service.name}`);
    console.log(`Input CID: ${inputCid}`);
    console.log(`Payment: ${paymentAmount} wei (${ethers.formatEther(paymentAmount)} ETH)`);

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

  async waitForInference(requestId, maxWaitTime = 300000) { // 5 minutes default
    console.log(`Waiting for inference request ${requestId} to complete...`);
    
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const result = await this.getInferenceResult(requestId);
        
        if (result.completed) {
          console.log(`Inference completed! Result CID: ${result.resultCid}`);
          return result;
        }
        
        console.log(`Inference still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.error(`Error checking inference status: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error(`Inference request ${requestId} did not complete within ${maxWaitTime / 1000} seconds`);
  }

  async downloadResult(resultCid, outputPath) {
    console.log(`Downloading result from CID: ${resultCid}`);
    
    // In a real implementation, this would download from IPFS/0G Storage
    // For now, we'll create a mock result file
    const mockResult = {
      resultCid: resultCid,
      downloadedAt: new Date().toISOString(),
      note: "This is a mock result. In production, this would be downloaded from storage."
    };
    
    await writeFile(outputPath, JSON.stringify(mockResult, null, 2));
    console.log(`Result saved to: ${outputPath}`);
  }

  async createInputData(inputData, outputPath) {
    console.log(`Creating input data file: ${outputPath}`);
    
    const inputFile = {
      data: inputData,
      timestamp: new Date().toISOString(),
      client: await this.signer.getAddress()
    };
    
    await writeFile(outputPath, JSON.stringify(inputFile, null, 2));
    
    // In a real implementation, this would upload to storage and return the CID
    const inputCid = `mock-input-${Date.now()}`;
    console.log(`Input CID: ${inputCid}`);
    
    return inputCid;
  }

  async runInference(serviceId, inputData) {
    try {
      // Create input data file
      const inputPath = `input_${Date.now()}.json`;
      const inputCid = await this.createInputData(inputData, inputPath);
      
      // Request inference
      const requestId = await this.requestInference(serviceId, inputCid);
      
      // Wait for completion
      const result = await this.waitForInference(requestId);
      
      // Download result
      const outputPath = `result_${requestId}.json`;
      await this.downloadResult(result.resultCid, outputPath);
      
      console.log(`Inference completed successfully!`);
      console.log(`  Request ID: ${requestId}`);
      console.log(`  Result CID: ${result.resultCid}`);
      console.log(`  Result file: ${outputPath}`);
      
      return {
        requestId,
        resultCid: result.resultCid,
        resultPath: outputPath
      };
    } catch (error) {
      console.error(`Inference failed: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command) {
    console.error("Usage: node scripts/marketplace_client.js <command> [args...]");
    console.error("Commands:");
    console.error("  get-service <serviceId>");
    console.error("  request <serviceId> <inputCid>");
    console.error("  get-result <requestId>");
    console.error("  wait <requestId> [maxWaitTime]");
    console.error("  run <serviceId> <inputData>");
    process.exit(2);
  }

  const client = new MarketplaceClient();
  await client.initialize();

  try {
    switch (command) {
      case 'get-service':
        if (args.length !== 1) {
          console.error("Usage: get-service <serviceId>");
          process.exit(2);
        }
        const service = await client.getService(args[0]);
        console.log(JSON.stringify(service, null, 2));
        break;

      case 'request':
        if (args.length !== 2) {
          console.error("Usage: request <serviceId> <inputCid>");
          process.exit(2);
        }
        const requestId = await client.requestInference(args[0], args[1]);
        console.log(`Request ID: ${requestId}`);
        break;

      case 'get-result':
        if (args.length !== 1) {
          console.error("Usage: get-result <requestId>");
          process.exit(2);
        }
        const result = await client.getInferenceResult(args[0]);
        console.log(JSON.stringify(result, null, 2));
        break;

      case 'wait':
        if (args.length < 1 || args.length > 2) {
          console.error("Usage: wait <requestId> [maxWaitTime]");
          process.exit(2);
        }
        const maxWait = args[1] ? parseInt(args[1]) : 300000;
        const waitResult = await client.waitForInference(args[0], maxWait);
        console.log(JSON.stringify(waitResult, null, 2));
        break;

      case 'run':
        if (args.length !== 2) {
          console.error("Usage: run <serviceId> <inputData>");
          process.exit(2);
        }
        const inferenceResult = await client.runInference(args[0], args[1]);
        console.log(JSON.stringify(inferenceResult, null, 2));
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

export { MarketplaceClient };
