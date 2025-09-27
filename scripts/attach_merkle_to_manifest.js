#!/usr/bin/env node
'use strict';

import fs from 'fs';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    fail('Usage: node attach_merkle_to_manifest.js <manifest.json> <bundle.json>');
  }

  const [manifestFile, bundleFile] = args;
  
  if (!fs.existsSync(manifestFile)) {
    fail(`Manifest file does not exist: ${manifestFile}`);
  }

  if (!fs.existsSync(bundleFile)) {
    fail(`Bundle file does not exist: ${bundleFile}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  const bundle = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
  
  if (!bundle.root) {
    fail('Invalid bundle format: missing root');
  }

  // Add merkleRoot to manifest
  manifest.merkleRoot = bundle.root;
  
  // Write updated manifest
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
  console.log(`manifest updated with merkleRoot ${bundle.root}`);
}

main();