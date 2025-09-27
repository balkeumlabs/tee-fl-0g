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

function buildMerkleTree(items) {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  const nextLevel = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1] || left; // Duplicate last item if odd number
    const combined = left + right;
    nextLevel.push(sha256(combined));
  }

  return buildMerkleTree(nextLevel);
}

function generateProof(items, targetIndex) {
  const proof = [];
  let currentItems = [...items];
  let currentIndex = targetIndex;

  while (currentItems.length > 1) {
    const nextLevel = [];
    const isLeft = currentIndex % 2 === 0;
    const siblingIndex = isLeft ? currentIndex + 1 : currentIndex - 1;
    
    if (siblingIndex < currentItems.length) {
      proof.push({
        position: isLeft ? 'right' : 'left',
        sibling: currentItems[siblingIndex]
      });
    }

    for (let i = 0; i < currentItems.length; i += 2) {
      const left = currentItems[i];
      const right = currentItems[i + 1] || left;
      const combined = left + right;
      nextLevel.push(sha256(combined));
    }

    currentItems = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    fail('Usage: node build_merkle_bundle.js <directory> <pattern> <output>');
  }

  const [dir, pattern, output] = args;
  
  if (!fs.existsSync(dir)) {
    fail(`Directory does not exist: ${dir}`);
  }

  const files = fs.readdirSync(dir)
    .filter(file => file.includes(pattern.replace('*', '')))
    .sort();

  if (files.length === 0) {
    fail(`No files found matching pattern: ${pattern}`);
  }

  const items = [];
  const bundle = {
    createdAt: new Date().toISOString(),
    baseDir: path.resolve(dir),
    pattern: pattern,
    root: null,
    items: []
  };

  // Read files and create hashes
  for (const file of files) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath);
    const hash = sha256(content);
    
    items.push(hash);
    bundle.items.push({
      file: file,
      sha256: hash,
      leaf: hash,
      proof: []
    });
  }

  // Build Merkle tree
  const root = buildMerkleTree(items);
  bundle.root = root;

  // Generate proofs for each item
  for (let i = 0; i < bundle.items.length; i++) {
    bundle.items[i].proof = generateProof(items, i);
  }

  // Write bundle
  fs.writeFileSync(output, JSON.stringify(bundle, null, 2));
  console.log(`Merkle bundle created: ${output}`);
  console.log(`Root: ${root}`);
  console.log(`Items: ${items.length}`);
}

main();