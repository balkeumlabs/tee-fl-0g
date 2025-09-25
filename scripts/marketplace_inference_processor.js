// scripts/marketplace_inference_processor.js
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { JsonRpcProvider, Wallet } from 'ethers';

const OG_MARKETPLACE_RPC = process.env.OG_MARKETPLACE_RPC || process.env.RPC_ENDPOINT || 'https://evmrpc-testnet.0g.ai';
const OG_MARKETPLACE_PRIVATE_KEY = process.env.OG_MARKETPLACE_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const OG_MARKETPLACE_CONTRACT_ADDRESS = process.env.OG_MARKETPLACE_CONTRACT_ADDRESS || '';

// Marketplace contract ABI for inference processing
const MARKETPLACE_ABI = [
  "function completeInference(uint256 requestId, string memory resultCid) external",
  "function getInferenceRequest(uint256 requestId) external view returns (uint256 serviceId, string memory inputCid, address requester, bool completed)",
  "event InferenceCompleted(uint256 indexed requestId, string resultCid)"
];

class InferenceProcessor {
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
    
    console.log(`Initialized inference processor`);
    console.log(`Contract: ${OG_MARKETPLACE_CONTRACT_ADDRESS}`);
    console.log(`Processor: ${await this.signer.getAddress()}`);
  }

  async getInferenceRequest(requestId) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    try {
      const request = await this.contract.getInferenceRequest(requestId);
      return {
        serviceId: request[0].toString(),
        inputCid: request[1],
        requester: request[2],
        completed: request[3]
      };
    } catch (error) {
      console.error(`Failed to get inference request: ${error.message}`);
      throw error;
    }
  }

  async processInference(requestId, modelCid, inputCid) {
    console.log(`Processing inference request ${requestId}`);
    console.log(`Model CID: ${modelCid}`);
    console.log(`Input CID: ${inputCid}`);

    // Simulate TEE-based inference processing
    // In a real implementation, this would:
    // 1. Fetch the model from storage using modelCid
    // 2. Fetch the input data from storage using inputCid
    // 3. Run inference in a TEE environment
    // 4. Encrypt the result
    // 5. Upload the encrypted result to storage
    // 6. Return the result CID

    try {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a mock result
      const mockResult = {
        requestId: requestId,
        modelCid: modelCid,
        inputCid: inputCid,
        inferenceResult: {
          predictions: [0.85, 0.12, 0.03], // Mock prediction scores
          confidence: 0.92,
          processingTime: "1.2s",
          timestamp: new Date().toISOString()
        },
        metadata: {
          processor: await this.signer.getAddress(),
          teeAttestation: "mock-attestation-hash",
          modelVersion: "epoch-3"
        }
      };

      // Write mock result to file
      const resultPath = `inference_result_${requestId}.json`;
      await writeFile(resultPath, JSON.stringify(mockResult, null, 2));

      // In a real implementation, this would upload to storage and return the CID
      const resultCid = `mock-result-${requestId}-${Date.now()}`;
      
      console.log(`Inference completed. Result CID: ${resultCid}`);
      console.log(`Result saved to: ${resultPath}`);

      return resultCid;
    } catch (error) {
      console.error(`Failed to process inference: ${error.message}`);
      throw error;
    }
  }

  async completeInference(requestId, resultCid) {
    if (!this.contract) {
      throw new Error("Contract not initialized. Call initialize() first.");
    }

    console.log(`Completing inference request ${requestId} with result CID: ${resultCid}`);

    try {
      const tx = await this.contract.completeInference(requestId, resultCid);
      console.log(`Completion transaction submitted: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Inference completed successfully`);
      return receipt;
    } catch (error) {
      console.error(`Failed to complete inference: ${error.message}`);
      throw error;
    }
  }

  async processAndComplete(requestId) {
    try {
      // Get the inference request details
      const request = await this.getInferenceRequest(requestId);
      
      if (request.completed) {
        console.log(`Request ${requestId} is already completed`);
        return;
      }

      console.log(`Processing request ${requestId}:`);
      console.log(`  Service ID: ${request.serviceId}`);
      console.log(`  Input CID: ${request.inputCid}`);
      console.log(`  Requester: ${request.requester}`);

      // Get the service details to find the model CID
      // In a real implementation, you'd query the service registry
      const modelCid = `model-for-service-${request.serviceId}`;

      // Process the inference
      const resultCid = await this.processInference(requestId, modelCid, request.inputCid);

      // Complete the inference on-chain
      await this.completeInference(requestId, resultCid);

      console.log(`Successfully processed and completed inference request ${requestId}`);
    } catch (error) {
      console.error(`Failed to process and complete inference: ${error.message}`);
      throw error;
    }
  }
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command) {
    console.error("Usage: node scripts/marketplace_inference_processor.js <command> [args...]");
    console.error("Commands:");
    console.error("  get-request <requestId>");
    console.error("  process <requestId> <modelCid> <inputCid>");
    console.error("  complete <requestId> <resultCid>");
    console.error("  process-and-complete <requestId>");
    process.exit(2);
  }

  const processor = new InferenceProcessor();
  await processor.initialize();

  try {
    switch (command) {
      case 'get-request':
        if (args.length !== 1) {
          console.error("Usage: get-request <requestId>");
          process.exit(2);
        }
        const request = await processor.getInferenceRequest(args[0]);
        console.log(JSON.stringify(request, null, 2));
        break;

      case 'process':
        if (args.length !== 3) {
          console.error("Usage: process <requestId> <modelCid> <inputCid>");
          process.exit(2);
        }
        const [reqId, modelCid, inputCid] = args;
        const resultCid = await processor.processInference(reqId, modelCid, inputCid);
        console.log(`Result CID: ${resultCid}`);
        break;

      case 'complete':
        if (args.length !== 2) {
          console.error("Usage: complete <requestId> <resultCid>");
          process.exit(2);
        }
        const [compReqId, compResultCid] = args;
        await processor.completeInference(compReqId, compResultCid);
        break;

      case 'process-and-complete':
        if (args.length !== 1) {
          console.error("Usage: process-and-complete <requestId>");
          process.exit(2);
        }
        await processor.processAndComplete(args[0]);
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

export { InferenceProcessor };
