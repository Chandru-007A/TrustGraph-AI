# Hackathon Demo Guide

This guide is designed for the presenter to flawlessly execute the live demo.

## Setup Before Presenting
1. Ensure both Frontend and Backend are running in `production` mode (`pnpm start`).
2. Have a MetaMask or Coinbase Wallet extension unlocked and connected to the Arc Testnet.
3. Ensure the wallet has a small amount of Testnet ARC for gas (though the platform subsidizes via the operator).
4. Pre-register a fresh demo user account.

## The Walkthrough

### 1. The Home & Login (0:00 - 1:00)
- Showcase the Glassmorphism UI.
- Log in with the pre-registered user.
- **Action:** Connect Wallet using the Top Navigation bar. Watch the RainbowKit modal pop up and authenticate seamlessly.

### 2. The Agentic Workflow (1:00 - 3:00)
- Navigate to the **Research** tab.
- Enter a complex prompt (e.g., "Analyze the regulatory differences between US and EU stablecoin frameworks.")
- Click "Generate".
- **Action:** Switch to the **DAG Monitor** and watch the AI agents execute in parallel. Highlight the Planner, Retriever, and Reasoner nodes.

### 3. Verification & Blockchain (3:00 - 4:00)
- Once the workflow completes, navigate to the **Verification Center**.
- **Action:** Point out the live `verifyInclusion()` result. 
- Click on the Explorer link to show the real Arc Testnet transaction that just occurred in the background.

### 4. AI Explainability (4:00 - 5:00)
- Go to the **Explainability** dashboard.
- Show the granular step-by-step reasoning trace. Explain that the hash of this exact trace is what is anchored on-chain.

### 5. Monetization & x402 (5:00 - 6:00)
- Visit the **Payment Center**.
- **Action:** Execute a mock or live Circle Gateway spend. Show how the platform monetizes AI outputs cryptographically.

## Fallback Contingencies
- If the Arc RPC is slow, explain the 5-retry exponential backoff architecture.
- If the OpenAI proxy fails, point out the graceful degradation to the mock workflow layer without crashing the UI.
