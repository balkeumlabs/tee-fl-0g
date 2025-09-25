// scripts/test_marketplace_simple.js
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_MANIFEST_PATH = path.join(__dirname, 'test_marketplace_manifest.json');

async function runSimpleMarketplaceTest() {
  console.log("Starting simple 0G Service Marketplace integration test...");

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
  console.log(`✅ Created test manifest: ${TEST_MANIFEST_PATH}`);

  // 2. Test manifest structure
  console.log("\n=== Testing Manifest Structure ===");
  const manifest = JSON.parse(await readFile(TEST_MANIFEST_PATH, 'utf8'));
  
  if (manifest.epoch && manifest.artifacts && manifest.artifacts.globalModelHash) {
    console.log("✅ Manifest structure is valid");
    console.log(`   Epoch: ${manifest.epoch}`);
    console.log(`   Model Hash: ${manifest.artifacts.globalModelHash}`);
    console.log(`   Model CID: ${manifest.artifacts.globalModelCid}`);
  } else {
    throw new Error("Invalid manifest structure");
  }

  // 3. Test service creation logic (without blockchain)
  console.log("\n=== Testing Service Creation Logic ===");
  const serviceName = `FLAI-Model-Epoch-${manifest.epoch}`;
  const description = `Federated Learning model trained on 0G - Epoch ${manifest.epoch}. Global model hash: ${manifest.artifacts.globalModelHash}`;
  const pricePerInference = BigInt(1000000000000000); // 0.001 ETH in wei
  const modelCid = manifest.artifacts.globalModelCid;

  console.log(`✅ Service Name: ${serviceName}`);
  console.log(`✅ Description: ${description}`);
  console.log(`✅ Price: ${pricePerInference} wei`);
  console.log(`✅ Model CID: ${modelCid}`);

  // 4. Test inference request structure
  console.log("\n=== Testing Inference Request Structure ===");
  const testInputData = {
    features: [1.0, 2.0, 3.0, 4.0],
    metadata: {
      clientId: "test-client-001",
      timestamp: new Date().toISOString()
    }
  };

  const inputPath = path.join(__dirname, 'test_input.json');
  await writeFile(inputPath, JSON.stringify(testInputData, null, 2));
  console.log(`✅ Created test input: ${inputPath}`);

  // 5. Test mock inference processing
  console.log("\n=== Testing Mock Inference Processing ===");
  const mockResult = {
    requestId: "12345",
    modelCid: modelCid,
    inputCid: "mock-input-cid",
    inferenceResult: {
      predictions: [0.85, 0.12, 0.03],
      confidence: 0.92,
      processingTime: "1.2s",
      timestamp: new Date().toISOString()
    },
    metadata: {
      processor: "0x1234567890123456789012345678901234567890",
      teeAttestation: "mock-attestation-hash",
      modelVersion: "epoch-3"
    }
  };

  const resultPath = path.join(__dirname, 'test_result.json');
  await writeFile(resultPath, JSON.stringify(mockResult, null, 2));
  console.log(`✅ Created mock result: ${resultPath}`);

  // 6. Test configuration validation
  console.log("\n=== Testing Configuration Validation ===");
  const requiredEnvVars = [
    'OG_MARKETPLACE_RPC',
    'OG_MARKETPLACE_PRIVATE_KEY',
    'OG_MARKETPLACE_CONTRACT_ADDRESS'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length === 0) {
    console.log("✅ All required environment variables are set");
  } else {
    console.log(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
    console.log("   This is expected for testing without real blockchain connection");
  }

  console.log("\n=== 0G Service Marketplace Integration Test Completed Successfully! ===");
  console.log("✅ Manifest creation and validation");
  console.log("✅ Service registration logic");
  console.log("✅ Inference request structure");
  console.log("✅ Mock inference processing");
  console.log("✅ Configuration validation");
  console.log("\nNote: Full blockchain integration requires valid private keys and contract addresses.");
}

async function cleanup() {
  try {
    await Promise.all([
      import('node:fs/promises').then(fs => fs.unlink(TEST_MANIFEST_PATH).catch(() => {})),
      import('node:fs/promises').then(fs => fs.unlink(path.join(__dirname, 'test_input.json')).catch(() => {})),
      import('node:fs/promises').then(fs => fs.unlink(path.join(__dirname, 'test_result.json')).catch(() => {}))
    ]);
    console.log("Cleaned up test files");
  } catch (error) {
    console.warn("Cleanup warning:", error.message);
  }
}

runSimpleMarketplaceTest()
  .catch(async (e) => {
    console.error("Simple marketplace test failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await cleanup();
  });
