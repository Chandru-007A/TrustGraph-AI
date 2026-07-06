# System Architecture: TrustGraph AI (LEO Platform)

## 1. Overview
TrustGraph AI is an enterprise-grade agentic AI orchestration platform designed to provide transparent, verifiable, and economically settled cognitive workflows. It bridges the gap between Large Language Models (LLMs) and cryptographic truth, ensuring every reasoning step is hashed, verified via Merkle Trees, and anchored to the Arc L1 Blockchain.

## 2. Core Components

### 2.1. Frontend (Next.js 14 / App Router)
- **Framework:** Next.js (React), written in TypeScript.
- **Styling:** Tailwind CSS with custom Glassmorphism utilities (`glass-card`, `glass-panel`).
- **State Management:** React Query (TanStack) for server-state caching; Context API for global auth/wallet state.
- **Web3 Integration:** Wagmi + RainbowKit for seamless wallet connection via WalletConnect.

### 2.2. Backend (Node.js / Express)
- **Architecture:** Modular Monolith with Dependency Injection.
- **API:** RESTful endpoints built with Express.
- **Database:** PostgreSQL managed by Prisma ORM.
- **Authentication:** JWT for session handling and Role-Based Access Control (RBAC).

### 2.3. Workflow Engine
The proprietary Workflow Engine orchestrates Directed Acyclic Graphs (DAGs) of AI executions.
- **Dependency Injection:** Evaluates at runtime whether to run `Mock` or `Production` agents.
- **Pipeline:** `Planner → Retriever → Validator → Reasoner → Evidence → Summary → Hash → Merkle → Blockchain → Payment`
- **Agents:** Currently integrated with OpenAI (`gpt-5.5` auto-fallback via `@google/generative-ai` proxy mappings).

### 2.4. Cryptographic Verification (Merkle Engine)
- Every AI node execution hashes its inputs, logic, and outputs.
- A Merkle Root is constructed for every complete session.
- The platform uses `keccak256` for deterministic hashing compatible with EVM smart contracts.

### 2.5. Arc Blockchain & Circle Gateway
- **ReceiptRegistryV2:** An EVM smart contract on the Arc Testnet that stores Workflow Market ID, Trace Hashes, and Confidence Probabilities.
- **Circle Gateway AppKit:** Facilitates cross-chain USDC nanopayments and escrows using the Unified Balance architecture. 

## 3. Data Flow
1. **Request:** User submits a prompt on the Research page.
2. **Orchestration:** Workflow Manager spawns parallel Agent instances.
3. **Execution:** Agents retrieve, validate, and reason over data.
4. **Hashing:** Outputs are hashed and the DAG is finalized.
5. **Anchoring:** The Merkle Root is submitted to Arc Testnet (`publishV2`).
6. **Settlement:** USDC is transferred via Circle Gateway.
7. **Readout:** Frontend dynamically reads `ReceiptV2` events and displays full Proof of Execution.

## 4. Scalability & Resilience
- **Retry Mechanisms:** Exponential backoff wrappers around Circle and Arc SDKs handle transient RPC limits, nonces, and gas unpredictability.
- **Database Optimizations:** Indexed UUIDs and compound lookups prevent N+1 serialization issues on the Receipt Explorer.
- **AI Fallbacks:** Graceful degradation if primary LLM providers face rate limits.
