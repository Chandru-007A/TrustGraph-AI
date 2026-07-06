# Judge Quick Start Guide

Welcome to the TrustGraph AI (LEO) Platform. This guide is tailored for hackathon judges to quickly evaluate the architecture and functional implementation of the platform.

## What is TrustGraph AI?
A decentralized orchestration engine that proves AI workflow integrity on the blockchain. We combine Next.js, Express, Prisma, Merkle Trees, Circle Gateway, and the Arc L1 Blockchain.

## Key Files to Review
If you have limited time, please review these core components that demonstrate the technical depth of the project:

### 1. The Merkle Engine
`backend/src/engine/merkle/merkle.service.ts`
- **Why:** Shows how we dynamically construct a deterministic Merkle Tree of AI execution traces, ensuring a 1-to-1 verifiable state between the DB and the Blockchain.

### 2. The Blockchain Registry Adapter
`backend/src/engine/blockchain/receipt-registry.service.ts`
- **Why:** Demonstrates production EVM integration using `ethers.js v6`. Shows the `publishV2` mechanism with our resilient 5-retry exponential backoff wrapper (`withArcRetry`).

### 3. The x402 Protocol Implementation
`backend/src/services/x402.service.ts`
- **Why:** Implements a custom HTTP 402 Payment Required spec, generating ECDSA signatures for paywalling specific AI outputs.

### 4. Dependency Injected Workflow Engine
`backend/src/engine/core/execution.manager.ts`
- **Why:** Shows a robust OOP architecture where AI Agents (Mock vs Production) are cleanly decoupled and injected into generic pipeline nodes.

## How to Test the Flow
1. Open the hosted URL.
2. Sign up and navigate to the **Research** tab.
3. Submit a prompt and observe the DAG execution in real-time.
4. Navigate to the **Verification Center** to view the live Arc Testnet Blockchain anchor.

Thank you for reviewing our project!
