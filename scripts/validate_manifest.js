#!/usr/bin/env node
'use strict';

import fs from 'fs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validateManifest(manifest) {
  const errors = [];
  
  // Required fields
  const requiredFields = ['epoch', 'artifacts', 'provenance', 'network'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate artifacts
  if (manifest.artifacts) {
    const requiredArtifacts = ['globalModelHash', 'globalModelCid', 'globalModelUrl'];
    for (const field of requiredArtifacts) {
      if (!manifest.artifacts[field]) {
        errors.push(`Missing required artifact field: ${field}`);
      }
    }
  }

  // Validate provenance
  if (manifest.provenance) {
    const requiredProvenance = ['mode'];
    for (const field of requiredProvenance) {
      if (!manifest.provenance[field]) {
        errors.push(`Missing required provenance field: ${field}`);
      }
    }
  }

  // Validate network
  if (manifest.network) {
    if (!manifest.network.chainId) {
      errors.push('Missing required network field: chainId');
    }
  }

  // Validate epoch
  if (manifest.epoch && (typeof manifest.epoch !== 'number' || manifest.epoch < 1)) {
    errors.push('Epoch must be a positive number');
  }

  return errors;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    fail('Usage: node validate_manifest.js <manifest.json>');
  }

  const manifestFile = args[0];
  
  if (!fs.existsSync(manifestFile)) {
    fail(`Manifest file does not exist: ${manifestFile}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const errors = validateManifest(manifest);
  
  if (errors.length > 0) {
    console.error('Manifest validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('Manifest validation passed');
  console.log(`Epoch: ${manifest.epoch}`);
  console.log(`Mode: ${manifest.provenance?.mode}`);
  console.log(`Chain ID: ${manifest.network?.chainId}`);
  if (manifest.merkleRoot) {
    console.log(`Merkle Root: ${manifest.merkleRoot}`);
  }
}

main();