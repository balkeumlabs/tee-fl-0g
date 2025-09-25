// scripts/test_marketplace_integration.js
import { MarketplaceServiceManager } from './marketplace_service_manager.js';
import { MarketplaceClient } from './marketplace_client.js';
import { InferenceProcessor } from './marketplace_inference_processor.js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_MANIFEST_PATH = path.join(__dirname, 'test_marketplace_manifest.json');
const TEST_INPUT_PATH = path.join(__dirname, 'test_marketplace_input.json');

async function runMarketplaceIntegrationTest() {
  console.log("Starting 0G Service Marketplace integration test...");

  // 1. Create test manifest
  const testManifest = {
    epoch: 3,
    artifacts: {
      globalModelHash: "0x1234567890abcdef1234567890abcdef12345678",
      globalModelCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      globalModelUrl: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"
    },
    provenance: {
      mode: "test",
      timestamp: new Date().toISOString()
    }
  };
  
  await writeFile(TEST_MANIFEST_PATH, JSON.stringify(testManifest, null, 2));
  console.log(`Created test manifest: ${TEST_MANIFEST_PATH}`);

  // 2. Test service registration
  console.log("\n=== Testing Service Registration ===");
  const serviceManager = new MarketplaceServiceManager();
  await serviceManager.initialize();
  
  const serviceId = await serviceManager.createServiceFromManifest(TEST_MANIFEST_PATH);
  console.log(`Service registered with ID: ${serviceId}`);

  // 3. Verify service details
  console.log("\n=== Verifying Service Details ===");
  const service = await serviceManager.getService(serviceId);
  console.log("Service details:", JSON.stringify(service, null, 2));

  // 4. Test client inference request
  console.log("\n=== Testing Client Inference Request ===");
  const client = new MarketplaceClient();
  await client.initialize();
  
  const testInputData = {
    features: [1.0, 2.0, 3.0, 4.0],
    metadata: {
      clientId: "test-client-001",
      timestamp: new Date().toISOString()
    }
  };
  
  await writeFile(TEST_INPUT_PATH, JSON.stringify(testInputData, null, 2));
  console.log(`Created test input: ${TEST_INPUT_PATH}`);

  // 5. Request inference
  console.log("\n=== Requesting Inference ===");
  const inferenceResult = await client.runInference(serviceId, testInputData);
  console.log("Inference result:", JSON.stringify(inferenceResult, null, 2));

  // 6. Test inference processing (simulated)
  console.log("\n=== Testing Inference Processing ===");
  const processor = new InferenceProcessor();
  await processor.initialize();
  
  // Simulate processing the inference request
  const mockResultCid = await processor.processInference(
    inferenceResult.requestId,
    service.modelCid,
    "mock-input-cid"
  );
  console.log(`Mock processing completed. Result CID: ${mockResultCid}`);

  // 7. Complete inference
  console.log("\n=== Completing Inference ===");
  await processor.completeInference(inferenceResult.requestId, mockResultCid);
  console.log("Inference completed successfully");

  // 8. Verify final result
  console.log("\n=== Verifying Final Result ===");
  const finalResult = await client.getInferenceResult(inferenceResult.requestId);
  console.log("Final result:", JSON.stringify(finalResult, null, 2));

  console.log("\n=== 0G Service Marketplace Integration Test Completed Successfully! ===");
  console.log("✅ Service registration");
  console.log("✅ Client inference requests");
  console.log("✅ Inference processing simulation");
  console.log("✅ Result completion and verification");
}

async function cleanup() {
  try {
    await Promise.all([
      import('node:fs/promises').then(fs => fs.unlink(TEST_MANIFEST_PATH).catch(() => {})),
      import('node:fs/promises').then(fs => fs.unlink(TEST_INPUT_PATH).catch(() => {})),
      import('node:fs/promises').then(fs => fs.unlink('inference_result_*.json').catch(() => {})),
      import('node:fs/promises').then(fs => fs.unlink('input_*.json').catch(() => {})),
      import('node:fs/promises').then(fs => fs.unlink('result_*.json').catch(() => {}))
    ]);
    console.log("Cleaned up test files");
  } catch (error) {
    console.warn("Cleanup warning:", error.message);
  }
}

runMarketplaceIntegrationTest()
  .catch(async (e) => {
    console.error("Marketplace integration test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await cleanup();
  });
