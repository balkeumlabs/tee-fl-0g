// # Technical Report — TEE-FL on 0G (Galileo)
// // Scope: system model, threat model, crypto plan, protocol flows, and evidence from Epochs 1–2.

// ## System Model & Assumptions
// - Parties: data owners (clients), aggregator, verifiers, chain observers.
// - Network: 0G Galileo testnet (chainId 16601).
// - Contracts: AccessRegistry (permit gating), EpochManager (epochs, roots, publishModel).
// - Assumptions: TEEs provide code identity via measurement and produce attestations; storage provides content addressing via CID.

// ## Threat Model & Trust Boundaries
// - Adversaries: curious clients, malicious aggregators, eavesdroppers.
// - Goals: prevent plaintext exposure outside TEEs; ensure only approved TEEs contribute; anchor integrity on-chain.
// - Boundaries: client device ↔ storage (encrypted), storage ↔ TEE (decrypt inside TEE), TEE ↔ chain (public).

// ## Cryptography & Key Management (planned integration)
// - Key exchange: X25519 (static client pubkey, ephemeral TEE key), derive shared secret.
// - Encryption: AES-256-GCM with explicit nonce per object; header includes scheme, salt, aad.
// - Key storage: TEE-sealed keys; client keys in OS keystore.
// - Hashing: SHA-256 for artifact integrity; stored on-chain with CID.

// ## Protocols
// ### Update Submission
// 1) Client encrypts update -> upload to 0G Storage -> obtain CID.
// 2) Client computes SHA-256 -> call AccessRegistry.isProviderApproved() off-chain.
// 3) If approved, submit on-chain update with CID + hash.
// ### Scoring
// - TEE pulls authorized CIDs, verifies attestation allowlist, runs scoring, posts scoresRoot.
// ### Aggregation
// - TEE FedAvg over qualified updates; compute globalModelHash; publishModel(CID, hash) once per epoch.

// ## On-chain Integration Details
// - Network: 16601; RPC https://evmrpc-testnet.0g.ai.
// - Deployed (galileo):
//   - AccessRegistry = 0xE3bffF639B4522Fa3D1E72973f9BEc040504c21e
//   - EpochManager   = 0x9341619f6B889A12bbb90BbE366405ce363Ab779
// - Invariants: publishModel callable once per epoch id.

// ## Evidence — Epochs 1–2 (PoC)
// - Epoch 1:
//   - scoresRoot: 0x3606b407a32ff354665b0466c0a66f1d23b53e11e24646a437a5c086bf0bb157
//   - globalModelCid: cid://simulated/global-1757444721
//   - globalModelHash: 0x5e47909ae238ac0486826478017e6f5ee1da68c6e8f528249bc858d2bce838fc
//   - published: true
// - Epoch 2:
//   - scoresRoot: 0x391a54342f48a1229d7f87afbbce4593538f0ad05274ae0befc3477ee4c194fb
//   - FedAvg weights ≈ [0.01, -0.01, 0.025]
//   - globalModelCid: cid://simulated/global-1757446457
//   - globalModelHash: 0x2031283ac53a2e8b1c6438b20913bee3b5099e056acb3fd60ea7ae106aed278e
//   - published: true

// ## Reliability & Failure Modes
// - publishModel is single-shot per epoch; mitigation: start new epoch for corrections.
// - RPC instability: retry with exponential backoff.
// - Storage unavailability: keep local cache and verify CID-posted contents.

// ## Reproducibility
// ```powershell
// git switch rao
// npm ci
// npx hardhat compile --config .\hardhat.galileo.js
// node .\scripts\check_balance_raw.js
// pwsh -ExecutionPolicy Bypass -File .\round_controller.ps1 -EpochId 4 -AutoClients 2
// ```
// // Expect: scoresRoot nonzero; global model published for target epoch.

// ## Open Issues & Next Steps
// 1) Real 0G Storage upload tool + CID plumbing.
// 2) Client-side encryption & TEE-only decryption.
// 3) Attestation CID + measurement verification before scoring.
// 4) CI smoke on PRs to rao.
// 5) Contract extensions for attestation metadata & receipts.
// 6) Marketplace mapping for pay-per-inference.
