#!/usr/bin/env node
'use strict';

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function sha256(data) {
  return '0x' + crypto.createHash('sha256').update(data).digest('hex');
}

function verifyProof(leaf, proof, root) {
  let current = leaf;
  
  for (const step of proof) {
    if (step.position === 'left') {
      current = sha256(step.sibling + current);
    } else {
      current = sha256(current + step.sibling);
    }
  }
  
  return current === root;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    fail('Usage: node verify_merkle_bundle.js <bundle.json> <directory>');
  }

  const [bundleFile, dir] = args;
  
  if (!fs.existsSync(bundleFile)) {
    fail(`Bundle file does not exist: ${bundleFile}`);
  }

  if (!fs.existsSync(dir)) {
    fail(`Directory does not exist: ${dir}`);
  }

  const bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
  
  if (!bundle.root || !bundle.items) {
    fail('Invalid bundle format');
  }

  console.log(`Verifying bundle with root: ${bundle.root}`);
  console.log(`Items to verify: ${bundle.items.length}`);

  let allValid = true;

  for (const item of bundle.items) {
    const filePath = path.join(dir, item.file);
    
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${item.file}`);
      allValid = false;
      continue;
    }

    const content = fs.readFileSync(filePath);
    const actualHash = sha256(content);
    
    if (actualHash !== item.sha256) {
      console.error(`Hash mismatch for ${item.file}: expected ${item.sha256}, got ${actualHash}`);
      allValid = false;
      continue;
    }

    if (!verifyProof(item.leaf, item.proof, bundle.root)) {
      console.error(`Proof verification failed for ${item.file}`);
      allValid = false;
      continue;
    }

    console.log(`✓ ${item.file} verified`);
  }

  if (allValid) {
    console.log(`bundle: OK ${bundle.root}`);
    process.exit(0);
  } else {
    console.error('bundle: FAILED');
    process.exit(1);
  }
}

main();