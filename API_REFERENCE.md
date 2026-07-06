# API Reference: TrustGraph AI (LEO)

## 1. Authentication
`POST /api/v1/auth/register`
- Registers a new user with `email`, `password`.

`POST /api/v1/auth/login`
- Authenticates a user and returns a JWT token.

## 2. Workflows
`POST /api/v1/workflow/start`
- **Body:** `{ prompt: string }`
- **Description:** Initiates a new AI orchestration workflow session. Spawns asynchronous LLM parallel reasoning steps.
- **Returns:** `{ sessionId: string, status: "RUNNING" }`

`GET /api/v1/workflow/:sessionId/status`
- **Description:** Returns the live progress of a workflow DAG execution.

`GET /api/v1/workflow/list`
- **Description:** Retrieves the paginated history of all workflow sessions for the authenticated user.

## 3. Receipt Explorer & Cryptography
`GET /api/v1/receipt/list`
- **Description:** Returns all paginated Blockchain Receipts representing fully settled workflows.

`GET /api/v1/receipt/:id`
- **Description:** Returns the rich detail of a single transaction, including the Trace Hash, Merkle Root, Confidence Probability, and linked Arc Block Explorer URL.

## 4. Verification Center
`GET /api/v1/verify/:workflowId`
- **Description:** Executes a live `verifyInclusion()` against the Merkle Tree stored in the DB and matches it against the stored `BlockchainReceipt` signature.

## 5. Explainability & Audit Trail
`GET /api/v1/explain/:sessionId`
- **Description:** Surfaces the internal metadata of the LLM pipeline, including raw reasoning logs, extracted evidence, agent DIDs, and the final synthetic response.

## 6. Payments (Circle Gateway)
`GET /api/v1/gateway/status`
- **Description:** Returns the Unified Balance Gateway status, connectivity state, and the operator's testnet wallet address.

`POST /api/v1/gateway/spend`
- **Description:** Deducts USDC from the user's WalletConnect balance for consuming a discrete piece of intellectual property (x402).
