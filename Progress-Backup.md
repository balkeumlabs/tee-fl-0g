# Project Progress — FLAI on 0G (TEE-based)

<sub>Last update: 2025-09-14 19:42:20 UTC</sub>

<!-- OVERALL_START -->
### Overall Project Completion
![Completion](https://img.shields.io/badge/completion-48%25-orange)
<!-- OVERALL_END -->



| Stage | % Completed | Notes |
|---|---:|---|
| 1) Data Upload → Encrypted datasets to 0G Storage | ![70%](https://img.shields.io/badge/-60%25-yellow) | Local encryption + envelope done; uploader + dry-run meta in place; 0G Storage maintenance blocks end-to-end. |
| 2) Access Grant → On-chain keys to approved TEE | ![40%](https://img.shields.io/badge/-40%25-orange) | AccessRegistry deployed + off-chain gating flow; key grant + model ACL wiring TBD. |
| 3) Local Training [TEE] | ![40%](https://img.shields.io/badge/-40%25-orange) | Local training + encrypted update envelopes; no enclave yet; unwrap-to-temp path validated. |
| 4) Update Submission (chain + storage) | ![85%](https://img.shields.io/badge/-85%25-yellowgreen) | On-chain submit working; artifacts hashed; storage CID pending maintenance. |
| 5) Scoring [TEE] | ![70%](https://img.shields.io/badge/-70%25-yellow) | Deterministic dummy scoring; scoresRoot posted on-chain; enclave attestation placeholders exist. |
| 6) Aggregation [TEE] | ![70%](https://img.shields.io/badge/-70%25-yellow) | FedAvg working; aggregated model + SHA-256; publishModel emits; not inside TEE yet. |
| 7) Iteration | ![75%](https://img.shields.io/badge/-60%25-yellow) | Multi-round orchestration runs; reproducible workspaces + logs. |
| 8) Final Model → Sealed + versioned + marketplace | ![50%](https://img.shields.io/badge/-50%25-yellow) | Aggregated model + storage meta; Marketplace submission not wired. |
| 9) Inference [TEE] via Marketplace | ![0%](https://img.shields.io/badge/-0%25-red) | Not started; needs hosted model + marketplace SDK alignment. |
| 10) Revenue Split | ![0%](https://img.shields.io/badge/-0%25-red) | Not implemented; requires additional on-chain logic. |



