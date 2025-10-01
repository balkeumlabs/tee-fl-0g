#!/usr/bin/env node
/* scripts/health_check.js - Production health monitoring */

import { ethers } from 'ethers';
import fs from 'fs';

const CONFIG = {
  rpc: process.env.CHAIN_RPC || 'https://evmrpc-testnet.0g.ai',
  accessRegistry: process.env.ACCESS_REGISTRY_ADDR || '0x29029882D92d91024dBA05A43739A397AC1d9557',
  epochManager: process.env.EPOCH_MANAGER_ADDR || '0x39FDd691B8fA988aE221CB3d0423c5f613Bee56e',
  timeout: 10000
};

async function checkRPCHealth() {
  try {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    
    return {
      status: 'healthy',
      blockNumber,
      chainId: network.chainId.toString(),
      responseTime: Date.now()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      responseTime: Date.now()
    };
  }
}

async function checkContractHealth() {
  try {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const code = await provider.getCode(CONFIG.accessRegistry);
    
    return {
      status: code !== '0x' ? 'healthy' : 'unhealthy',
      contract: CONFIG.accessRegistry,
      hasCode: code !== '0x'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}

async function checkStorageHealth() {
  const mode = process.env.OG_STORAGE_MODE || 'manual';
  
  if (mode === 'manual') {
    return { status: 'manual_mode', message: 'Storage in manual mode' };
  }
  
  // Add real storage health checks here when 0G Storage is available
  return { status: 'pending', message: '0G Storage configuration required' };
}

async function runHealthCheck() {
  console.log('🔍 Running FLAI Protocol Health Check...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    rpc: await checkRPCHealth(),
    contracts: await checkContractHealth(),
    storage: await checkStorageHealth()
  };
  
  // Log results
  console.log('📊 Health Check Results:');
  console.log(`RPC Status: ${results.rpc.status}`);
  if (results.rpc.status === 'healthy') {
    console.log(`  Block: ${results.rpc.blockNumber}`);
    console.log(`  Chain ID: ${results.rpc.chainId}`);
  } else {
    console.log(`  Error: ${results.rpc.error}`);
  }
  
  console.log(`\nContract Status: ${results.contracts.status}`);
  if (results.contracts.status === 'healthy') {
    console.log(`  AccessRegistry: ${CONFIG.accessRegistry}`);
  } else {
    console.log(`  Error: ${results.contracts.error}`);
  }
  
  console.log(`\nStorage Status: ${results.storage.status}`);
  console.log(`  Mode: ${process.env.OG_STORAGE_MODE || 'manual'}`);
  
  // Save results
  fs.writeFileSync('health_check_results.json', JSON.stringify(results, null, 2));
  
  // Determine overall health
  const overallHealth = results.rpc.status === 'healthy' && 
                       results.contracts.status === 'healthy';
  
  console.log(`\n🎯 Overall Health: ${overallHealth ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
  
  process.exit(overallHealth ? 0 : 1);
}

runHealthCheck().catch(console.error);
