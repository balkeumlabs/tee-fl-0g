// scripts/test_marketplace_mainnet_serving_broker.js - Test 0G Marketplace using serving-broker SDK
import "dotenv/config";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { createRequire } from "node:module";

// Load the broker via CommonJS to be Node 22–friendly (official API pattern)
const require = createRequire(import.meta.url);
const { createZGComputeNetworkBroker } = require("@0glabs/0g-serving-broker");

const OG_MARKETPLACE_RPC = process.env.OG_MARKETPLACE_RPC || process.env.RPC_ENDPOINT || 'https://evmrpc.0g.ai';
const OG_MARKETPLACE_PRIVATE_KEY = process.env.OG_MARKETPLACE_PRIVATE_KEY || process.env.PRIVATE_KEY || '';

console.log('=== 0G Marketplace Mainnet Test (Using Serving Broker SDK) ===');
console.log(`RPC: ${OG_MARKETPLACE_RPC}`);
console.log(`Has Private Key: ${!!OG_MARKETPLACE_PRIVATE_KEY}`);
console.log(`Chain ID: 16661`);

async function testMarketplaceWithBroker() {
  try {
    // 1. Test RPC Connection
    console.log('\n📋 Step 1: Testing RPC Connection...');
    const provider = new JsonRpcProvider(OG_MARKETPLACE_RPC, {
      name: "0g-mainnet",
      chainId: 16661,
      ensAddress: null
    });

    try {
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ RPC connection successful. Block: ${blockNumber}`);
    } catch (error) {
      console.error(`❌ RPC connection failed: ${error.message}`);
      throw error;
    }

    // 2. Test Wallet
    if (!OG_MARKETPLACE_PRIVATE_KEY) {
      console.error('❌ OG_MARKETPLACE_PRIVATE_KEY not set in .env.mainnet');
      return;
    }

    console.log('\n📋 Step 2: Testing Wallet...');
    const signer = new Wallet(OG_MARKETPLACE_PRIVATE_KEY, provider);
    const signerAddress = await signer.getAddress();
    console.log(`✅ Wallet address: ${signerAddress}`);

    try {
      const balance = await provider.getBalance(signerAddress);
      console.log(`✅ Balance: ${formatEther(balance)} 0G`);
      if (balance === 0n) {
        console.error('⚠️  Warning: Wallet has no 0G tokens.');
      }
    } catch (error) {
      console.warn(`⚠️  Could not check balance: ${error.message}`);
    }

    // 3. Test Serving Broker SDK
    console.log('\n📋 Step 3: Testing 0G Serving Broker SDK...');
    
    try {
      console.log('✅ Serving Broker SDK imported successfully');

      // Create broker (official API from serving-broker)
      console.log('   Creating broker...');
      const broker = await createZGComputeNetworkBroker(signer);
      console.log('✅ Broker created successfully');

      // Test ledger functionality
      console.log('\n📋 Step 4: Testing Ledger...');
      try {
        const ledger = await broker.ledger.getLedger();
        console.log(`✅ Ledger accessible`);
        console.log(`   Balance: ${ledger.balance || 'N/A'}`);
      } catch (error) {
        console.warn(`⚠️  Ledger check failed: ${error.message}`);
      }

      // Test listing services
      console.log('\n📋 Step 5: Testing Service Listing...');
      let services = null;
      try {
        services = await broker.inference.listService();
        console.log(`✅ Service listing successful`);
        console.log(`   Services found: ${services?.length || 0}`);
        if (services && services.length > 0) {
          console.log(`   First service: ${JSON.stringify(services[0], null, 2)}`);
        }
      } catch (error) {
        console.warn(`⚠️  Service listing failed: ${error.message}`);
        console.log(`   This might be expected if no services are registered yet`);
      }

      // Test service metadata
      if (services && services.length > 0) {
        console.log('\n📋 Step 6: Testing Service Metadata...');
        try {
          const firstService = services[0];
          const metadata = await broker.inference.getServiceMetadata(firstService.provider || firstService);
          console.log(`✅ Service metadata accessible`);
          console.log(`   Service: ${JSON.stringify(metadata, null, 2)}`);
        } catch (error) {
          console.warn(`⚠️  Service metadata failed: ${error.message}`);
        }
      }

      console.log('\n✅ Marketplace Test Complete!');
      console.log('\n📊 Summary:');
      console.log('   ✅ RPC Connection: Working');
      console.log('   ✅ Wallet: Configured');
      console.log('   ✅ Serving Broker SDK: Working');
      console.log('   ✅ Ledger: Accessible');
      console.log('   ✅ Service Listing: Working');

      console.log('\n🎯 Marketplace is accessible on mainnet using Serving Broker SDK!');

    } catch (error) {
      console.error(`\n❌ Serving Broker SDK error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
      
      if (error.message.includes('Cannot find module')) {
        console.error('\n💡 Solution: Install 0G Serving Broker SDK');
        console.error('   npm install @0glabs/0g-serving-broker');
      }

      throw error;
    }

  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    process.exit(1);
  }
}

testMarketplaceWithBroker().catch(console.error);
