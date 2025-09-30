#!/usr/bin/env node
/* scripts/alert_monitor.js - Production alerting system */

import fs from 'fs';
import { ethers } from 'ethers';

const ALERT_CONFIG = {
  rpc: process.env.CHAIN_RPC || 'https://evmrpc-testnet.0g.ai',
  accessRegistry: process.env.ACCESS_REGISTRY_ADDR || '0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e',
  thresholds: {
    responseTime: 30000, // 30 seconds
    errorRate: 0.1, // 10%
    blockDelay: 300 // 5 minutes
  }
};

class AlertMonitor {
  constructor() {
    this.alerts = [];
    this.metrics = {
      rpcCalls: 0,
      rpcErrors: 0,
      lastBlockTime: Date.now()
    };
  }

  async checkRPCResponseTime() {
    const start = Date.now();
    try {
      const provider = new ethers.JsonRpcProvider(ALERT_CONFIG.rpc);
      await provider.getBlockNumber();
      const responseTime = Date.now() - start;
      
      if (responseTime > ALERT_CONFIG.thresholds.responseTime) {
        this.addAlert('HIGH_RESPONSE_TIME', {
          responseTime,
          threshold: ALERT_CONFIG.thresholds.responseTime
        });
      }
      
      this.metrics.rpcCalls++;
      return responseTime;
    } catch (error) {
      this.metrics.rpcErrors++;
      this.addAlert('RPC_ERROR', { error: error.message });
      throw error;
    }
  }

  async checkBlockDelay() {
    try {
      const provider = new ethers.JsonRpcProvider(ALERT_CONFIG.rpc);
      const block = await provider.getBlock('latest');
      const blockTime = block.timestamp * 1000;
      const delay = Date.now() - blockTime;
      
      if (delay > ALERT_CONFIG.thresholds.blockDelay * 1000) {
        this.addAlert('BLOCK_DELAY', {
          delay: delay / 1000,
          threshold: ALERT_CONFIG.thresholds.blockDelay
        });
      }
      
      this.metrics.lastBlockTime = blockTime;
    } catch (error) {
      this.addAlert('BLOCK_CHECK_ERROR', { error: error.message });
    }
  }

  checkErrorRate() {
    const errorRate = this.metrics.rpcErrors / Math.max(this.metrics.rpcCalls, 1);
    
    if (errorRate > ALERT_CONFIG.thresholds.errorRate) {
      this.addAlert('HIGH_ERROR_RATE', {
        errorRate: errorRate * 100,
        threshold: ALERT_CONFIG.thresholds.errorRate * 100,
        calls: this.metrics.rpcCalls,
        errors: this.metrics.rpcErrors
      });
    }
  }

  addAlert(type, data) {
    const alert = {
      type,
      timestamp: new Date().toISOString(),
      severity: this.getSeverity(type),
      data
    };
    
    this.alerts.push(alert);
    console.log(`🚨 ALERT: ${type} - ${JSON.stringify(data)}`);
    
    // Save to file for external monitoring
    this.saveAlerts();
  }

  getSeverity(type) {
    const severityMap = {
      'HIGH_RESPONSE_TIME': 'WARNING',
      'RPC_ERROR': 'CRITICAL',
      'BLOCK_DELAY': 'WARNING',
      'BLOCK_CHECK_ERROR': 'CRITICAL',
      'HIGH_ERROR_RATE': 'CRITICAL'
    };
    
    return severityMap[type] || 'INFO';
  }

  saveAlerts() {
    const alertData = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      alerts: this.alerts,
      summary: {
        totalAlerts: this.alerts.length,
        criticalAlerts: this.alerts.filter(a => a.severity === 'CRITICAL').length,
        warningAlerts: this.alerts.filter(a => a.severity === 'WARNING').length
      }
    };
    
    fs.writeFileSync('alert_monitor_results.json', JSON.stringify(alertData, null, 2));
  }

  async runMonitoring() {
    console.log('🔍 Starting FLAI Protocol Alert Monitoring...\n');
    
    try {
      // Check RPC response time
      const responseTime = await this.checkRPCResponseTime();
      console.log(`✅ RPC Response Time: ${responseTime}ms`);
      
      // Check block delay
      await this.checkBlockDelay();
      console.log(`✅ Block Delay Check: OK`);
      
      // Check error rate
      this.checkErrorRate();
      console.log(`✅ Error Rate Check: ${(this.metrics.rpcErrors / Math.max(this.metrics.rpcCalls, 1) * 100).toFixed(2)}%`);
      
      // Summary
      console.log(`\n📊 Monitoring Summary:`);
      console.log(`  RPC Calls: ${this.metrics.rpcCalls}`);
      console.log(`  RPC Errors: ${this.metrics.rpcErrors}`);
      console.log(`  Total Alerts: ${this.alerts.length}`);
      
      if (this.alerts.length === 0) {
        console.log(`\n🎯 Status: ✅ ALL SYSTEMS HEALTHY`);
      } else {
        console.log(`\n🎯 Status: ⚠️  ${this.alerts.length} ALERTS ACTIVE`);
      }
      
    } catch (error) {
      console.error('❌ Monitoring failed:', error.message);
      process.exit(1);
    }
  }
}

// Run monitoring
const monitor = new AlertMonitor();
monitor.runMonitoring().catch(console.error);
