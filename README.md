<div align="center">

# 🔗 TrustGraph-AI

**Bridging AI and Trust: End-to-End Verified Intelligence on Blockchain**

*Verifiable AI research, paid seamlessly with stablecoins, anchored forever on-chain.*


[Overview](#-overview) · [The Problem & Solution](#-the-problem--solution) · [How It Works](#-how-it-works) · [Key Features](#-key-features) · [Architecture](#-system-architecture) · [Tech Stack](#-tech-stack) · [Quick Start](#-quick-start) · [Judge Checklist](#-judge-quick-start-checklist) · [Demo Script](#-3-minute-demo-script) · [Security](#-security--privacy) · [Roadmap](#-roadmap) · [FAQ](#-faq) · [License](#-license) · [Contributing](#-contributing) · [Contact](#-contact)

</div>

---

## 🌟 Overview

**TrustGraph-AI** solves a problem every serious AI product will eventually face:

> *"How do I know this AI answer is real, unaltered, and honestly paid for?"*

We combine three pillars into one seamless flow:

| Pillar | What it does |
|---|---|
| 🤖 **Multi-Agent AI** | Planner → Retriever → Validator → Reasoner → Summary agents collaborate transparently |
| 💸 **Instant Micropayments** | Every AI call is paid on-the-fly via **x402**, using a unified **USDC** balance (Circle AppKit) |
| ⛓️ **On-Chain Proof** | Every result is Merkle-hashed and anchored on **Arc**, Circle's stablecoin-native L1 — sub-second finality, ~$0.01 per receipt |

The result: **an AI answer you don't have to just trust — you can verify it.**

---

## 🚩 The Problem & Solution

**TrustGraph-AI** closes both gaps with one integrated stack: **transparent reasoning → pay-per-use micropayments → cryptographic on-chain receipts.**

- ❌ **AI is a black box.** Users can't verify whether an answer is accurate, unaltered, or fabricated — critical in research, finance, and healthcare.
- ❌ **Paying for AI is broken.** API keys, subscriptions, and centralized billing don't work for autonomous agents that need to pay *per call*, *instantly*, *without signup*.

---

## 🔄 How It Works

```mermaid
flowchart TD
    A[👤 User connects wallet] --> B[📝 Submits research query]
    B --> C[🧠 Planner Agent breaks down the task]
    C --> D[🔍 Retriever Agent gathers evidence]
    D --> E[✅ Validator Agent checks data quality]
    E --> F[💭 Reasoner Agent builds the answer]
    F --> G[📄 Summary Agent compiles final output]

    D -.->|402 Payment Required| P[💰 x402 pays instantly with USDC]
    E -.-> P
    F -.-> P
    P --> Q[🏦 Circle AppKit unified USDC balance]

    G --> H[🌳 Merkle root computed from all outputs]
    H --> I[⛓️ Receipt anchored on Arc Testnet]
    I --> J[🔎 User verifies proof on-chain]
    J --> K[📊 Live metrics on Admin Dashboard]
```

**Step-by-step:**

1. **Connect Wallet** — Sign in with MetaMask / WalletConnect via RainbowKit + Wagmi. No accounts, no passwords.
2. **Ask a Question** — Submit any research query through the Research page.
3. **Watch the Agents Work** — A live DAG visualizes each agent (Planner → Retriever → Validator → Reasoner → Summary) as it completes its task.
4. **Pay Per Call, Automatically** — Every AI/data call is metered and paid instantly through the **x402** protocol using your unified **USDC** balance — no pre-paid credits, no API keys.
5. **Get a Verified Answer** — The full reasoning chain, evidence, and structured output are shown in the UI.
6. **On-Chain Receipt** — A Merkle root of the entire workflow is anchored on **Arc Testnet** via the `ReceiptRegistryV2` smart contract — finality in under 1 second, at roughly $0.01.
7. **Verify Anytime** — Anyone can independently confirm that a piece of evidence belongs to the anchored root — tamper-proof, forever.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🧩 **Multi-Agent AI Workflow** | Modular agents output structured JSON only — no unpredictable free text. Supports OpenAI & Gemini with automatic mock fallback. |
| 💳 **Automated Micropayments (x402)** | HTTP-native pay-per-call. Agents receive a `402 Payment Required` and pay instantly in stablecoin. |
| 🏦 **Unified USDC Balance** | One balance across chains via Circle AppKit — deposit on Base/Testnet, spend on Arc/Testnet. |
| ⛓️ **Blockchain-Anchored Receipts** | Every workflow produces a Merkle root anchored on Arc via `ReceiptRegistryV2` — independently verifiable. |
| 🕸️ **DAG Visualization** | Real-time graph of the reasoning chain — see exactly how the answer was derived. |
| 🔍 **Full Explainability** | Every intermediate step, piece of evidence, and reasoning fragment is logged and viewable. |
| 🔐 **Wallet-Native Auth** | Your wallet *is* your identity — no traditional accounts required. |
| 📊 **Live Admin Dashboard** | Real-time system health, workflow queue, payments, and blockchain anchors. |
| 🏗️ **Production-Grade Code** | 100% TypeScript, zero lint/type errors, tested APIs, caching, and error handling throughout. |

---

## 🏛 System Architecture

```mermaid
flowchart LR
    A["👤 User Wallet<br/>(MetaMask / WalletConnect)"] -->|Connect| B["🖥️ Frontend<br/>Next.js + React"]
    B -->|API calls| C["⚙️ Backend<br/>Node.js / Express"]
    C --> D["🤖 AI Models<br/>OpenAI / Gemini"]
    C --> E["💸 x402 Payment<br/>Middleware"]
    C --> F["🏦 Circle AppKit<br/>Unified USDC Balance"]
    C --> G["⛓️ ReceiptRegistryV2<br/>Arc Testnet"]
    C --> H["🔎 Verification Engine"]
    C --> I["🗄️ Supabase<br/>Auth & Postgres"]
    F --> G
```

**Flow summary:** The Next.js frontend authenticates users through RainbowKit/Wagmi wallets and talks to a Node/Express backend. That backend orchestrates AI providers, routes every AI call through the x402 payment middleware, draws funds from a Circle AppKit unified USDC balance, and finally anchors a Merkle receipt on the Arc Testnet. Supabase (Postgres) persists users, workflows, receipts, and payments — and an admin layer polls everything for live metrics.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React, Recharts, React Flow / D3 |
| Wallet & Identity | RainbowKit, Wagmi (MetaMask, WalletConnect) |
| Backend | Node.js, Express, Prisma ORM |
| AI Providers | OpenAI, Google Gemini (pluggable via `AI_PROVIDER`) |
| Payments | x402 protocol (HTTP-native micropayments) |
| Stablecoin Balance | Circle AppKit (Unified USDC Balance) |
| Blockchain | Arc (Circle's stablecoin-native L1) + `ReceiptRegistryV2` contract |
| Database & Auth | Supabase (Postgres + Auth) |
| Quality | TypeScript, ESLint, Prettier, Jest |

---

## 🚀 Quick Start

### Prerequisites
- Node.js & npm/yarn
- A Supabase project or local PostgreSQL instance
- Test API keys: OpenAI/Gemini, WalletConnect, Circle AppKit, Arc Testnet RPC

### 1. Clone the repo
```bash
git clone https://github.com/yourorg/trustgraph-ai.git
cd trustgraph-ai
```

### 2. Configure environment variables

**Backend `.env`**
```env
# Database
DATABASE_URL=postgres://user:pass@db.host:5432/trustgraph
DIRECT_URL=postgres://direct:pass@db.host:5432/trustgraph

# Auth
JWT_SECRET=your_jwt_secret_here

# AI Provider
AI_PROVIDER=openai        # or "gemini"
OPENAI_API_KEY=sk-yourkey
OPENAI_MODEL=gpt-5.5
TEMPERATURE=0.2
MAX_TOKENS=2048
TIMEOUT_MS=60000

# WalletConnect
NEXT_PUBLIC_WC_PROJECT_ID=pk_test_xxx

# Circle Gateway
KIT_KEY=cb_test_abc123
GATEWAY_WALLET_PRIVATE_KEY=0xabc123...
GATEWAY_ENABLED=true

# Arc Blockchain
ARC_RPC_URL=https://rpc-testnet.arc.market
ARC_PRIVATE_KEY=0xdef456...
RECEIPT_REGISTRY_ADDRESS=0x27d93c52fea923f956345af27f61d6bf47f0c4c1
```

**Frontend `.env.local`**
```env
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WC_PROJECT_ID=pk_test_xxx
```

> ⚠️ Never commit real secrets to version control. Use `.env.example` as a template.

### 3. Set up the database
```bash
npx prisma migrate deploy
```

### 4. Run the backend
```bash
cd backend
npm install
npm run start:dev
# health check
curl http://localhost:3000/api/v1/health
```

### 5. Run the frontend
```bash
cd frontend
npm install
npm run dev
# open http://localhost:3001
```

### 6. Connect & Test
1. Sign up and connect a wallet (configured for Arc Testnet).
2. Fund your wallet with test USDC.
3. Submit a research query and watch the agents run.
4. Check your receipt transaction on ArcScan via the link in the Payment Center.

---

## ✅ Judge Quick-Start Checklist

- [ ] Clone repo & install dependencies
- [ ] Populate `.env` files (DB, AI keys, WalletConnect, Circle, Arc RPC)
- [ ] Run `npx prisma migrate deploy`
- [ ] Start backend, confirm `/health` returns OK
- [ ] Start frontend, open the app
- [ ] Register, connect wallet, fund test USDC
- [ ] Submit a query → verify DAG, receipt, and ArcScan transaction
- [ ] Log in as admin → check `/dashboard/admin`
- [ ] Try an edge case (low balance / bad key) → confirm graceful fallback

---

## 🎬 3-Minute Demo Script

| Time | Action |
|---|---|
| 0:00–0:30 | Show landing page, tagline, and value proposition |
| 0:30–1:00 | Connect wallet (MetaMask/WalletConnect) |
| 1:00–1:30 | Fund unified USDC balance, show pending → confirmed deposit |
| 1:30–2:30 | Submit query, narrate the DAG as agents execute in real time |
| 2:30–3:00 | Show the final answer, Arc receipt hash, and live Admin Dashboard |

---

## 🔐 Security & Privacy

- **Immutable Audit Trail** — Every workflow is cryptographically committed on Arc Testnet; tampering breaks the receipt.
- **Minimal Trust Architecture** — AI prompts/responses never touch the client; only structured results are stored. Private keys live only in the backend's secure environment.
- **Wallet-Verified Actions** — Spending and workflow actions require wallet signatures.
- **Data Privacy** — Only non-sensitive workflow metadata is stored; PII is handled by Supabase Auth behind HTTPS + JWT.
- **No Secrets Leak** — Environment secrets are never logged or returned to the client.
- **Rate Limiting & Validation** — Standard API protections guard against abuse and prompt injection.

---

## 🗺 Roadmap

- 🌐 **Mainnet Deployment** — Move from Arc Testnet to Mainnet + other chains via Circle CCTP
- 🧠 **Expanded AI Capabilities** — Add Anthropic, Mistral, and local model support
- 🎨 **Improved UX** — Streaming results, animated DAGs, multi-language support
- 📈 **Advanced Analytics** — Agent performance charts, payment heatmaps, exportable audit logs
- 🧩 **Community & Extensibility** — Open-source core modules, plugin architecture, SDKs
- 🛡️ **Security Hardening** — Formal audit, multi-sig & hardware wallet support
- 🏢 **Use Case Expansion** — Compliance verification, education, enterprise knowledge management

---

## ❓ FAQ

**Why Arc?**
A stablecoin-native L1 with predictable USDC gas, sub-second finality, and USD-denominated costs.

**Does this work on mainnet?**
Yes — Circle AppKit supports cross-chain transfers; Arc Testnet receipts can bridge to mainnet USDC via CCTP.

**What if an AI provider fails?**
The system falls back to a mock provider automatically, and retries transient errors with exponential backoff.

**How is privacy protected?**
Only a wallet and email are required. On-chain receipts store hashes only — never raw personal data.

**What's the catch with x402?**
None — it replaces pre-paid API credits with instant, per-call stablecoin payments. No signup, no API keys.

---

## 📄 License

Released under the **MIT License** — see [`LICENSE`](./LICENSE) for details.

## 🤝 Contributing

Contributions are welcome! Please open an issue or pull request, and check `CONTRIBUTING.md` for guidelines.

## 📬 Contact

- **GitHub:** [github.com/Chandru-007A/TrustGraph-AI](https://github.com/Chandru-007A/TrustGraph-AI)
- **Docs:** `README.md` · `API_REFERENCE.md` · `DEPLOYMENT_GUIDE.md`
- **Email:** contact@trustgraph-ai.org

---

<div align="center">

**TrustGraph-AI** — *AI you don't have to take on faith.*

⭐ If this project impressed you, star the repo and follow along!

</div>
