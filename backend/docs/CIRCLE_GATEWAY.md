# Circle Gateway — Unified Balance Integration

> **Status:** ✅ LIVE integration with `@circle-fin/app-kit` 1.8.1 + `@circle-fin/adapter-viem-v2` 1.12.1 + `viem` 2.x.
> **Mode:** MOCK by default. Set `KIT_KEY` to enable real Unified Balance operations.

This document covers the architecture, spend lifecycle, webhook lifecycle, x402
integration, REST API, and operational runbook for the Circle Gateway integration.

---

## 1. What this is

LEO's payment settlement layer is a thin wrapper around the **official Circle App
Kit** (`@circle-fin/app-kit`) and the **viem v2 adapter**
(`@circle-fin/adapter-viem-v2`). We do **not** build a custom wallet, do **not**
hand-roll signing, and do **not** re-implement the Gateway protocol. The wrapper:

- Initializes the AppKit with our operator's viem adapter
- Exposes a small REST surface for the operator UI and the x402 settlement path
- Persists every deposit, spend, balance snapshot, and webhook event into
  `GatewayTransaction` for audit and replay protection
- Subscribes to AppKit lifecycle events and mirrors them into the same audit log

The x402 payment protocol is **unchanged** — Gateway is its *payment backend*.

---

## 2. Architecture

```
                          ┌────────────────────────────────────────────────┐
                          │           LEO Backend (this repo)              │
   Client                 │                                                │
     │                    │   ┌─────────────────────┐                       │
     │  GET /workflow/:id │   │   x402 Middleware   │                       │
     │ /node/:id          │   │                     │                       │
     │                    │   │  Returns HTTP 402   │                       │
     ├───────────────────►│   │  with PAYMENT-      │                       │
     │                    │   │  REQUIRED header    │                       │
     │  402 + challenge   │   └──────────┬──────────┘                       │
     │◄───────────────────┤              │                                  │
     │                    │              ▼                                  │
     │  POST + PAYMENT-   │   ┌─────────────────────┐                       │
     │  SIGNATURE         │   │   x402Service       │                       │
     ├───────────────────►│   │  .verifyAndSettle() │                       │
     │                    │   └──────────┬──────────┘                       │
     │  200 + unlock      │              │                                  │
     │◄───────────────────┤              │ LIVE branch only                │
     │                    │              ▼                                  │
     │                    │   ┌─────────────────────┐                       │
     │                    │   │  CircleGateway-     │                       │
     │                    │   │  Service.spend()    │                       │
     │                    │   └──────────┬──────────┘                       │
     │                    │              │                                  │
     │                    │              ▼                                  │
     │                    │   ┌─────────────────────┐                       │
     │                    │   │  @circle-fin/app-kit│                       │
     │                    │   │  UnifiedBalance     │──► AppKit events ─┐   │
     │                    │   │  .spend()           │                   │   │
     │                    │   └──────────┬──────────┘                   │   │
     │                    │              │                              ▼   │
     │                    │              ▼                  ┌────────────┐ │
     │                    │   ┌─────────────────────┐       │ Audit log  │ │
     │                    │   │ GatewayTransaction  │◄──────┤ (rows in   │ │
     │                    │   │ (Postgres)          │       │ Prisma)    │ │
     │                    │   └─────────────────────┘       └────────────┘ │
     │                    │                                                │
     │                    │   ┌─────────────────────┐                       │
     │  POST /gateway/    │   │  REST API           │                       │
     │  webhook           │◄──┤  /deposit, /spend,  │                       │
     │  (from Circle)     │   │  /balance, /txs     │                       │
     │                    │   └─────────────────────┘                       │
     └────────────────────┴────────────────────────────────────────────────┘
```

### Components

| Component | Path | Responsibility |
|---|---|---|
| `circle-gateway.service.ts` | `src/services/` | Singleton, AppKit init, deposit/spend/balance/tx history, event subscription, webhook ingest |
| `gateway.controller.ts` | `src/controllers/` | REST handlers |
| `gateway.route.ts` | `src/routes/v1/` | Express router + zod validation |
| `gateway-webhook.middleware.ts` | `src/middlewares/` | Raw-body capture for HMAC validation |
| `GatewayTransaction` | `prisma/schema.prisma` | Audit log for every Gateway operation |

---

## 3. Unified Balance Flow

Circle's Unified Balance aggregates USDC deposited on any supported chain
(Arc_Testnet, Ethereum, Base, Arbitrum, Optimism, …) into a single spendable
balance. From that balance, the operator (or any delegate) can **Spend** USDC
directly onto a destination chain — no bridging required, no per-chain liquidity
fragmentation.

```
                      ┌──────────────────┐
   Source chain       │                  │       Destination chain
   (Arc_Testnet,      │   Unified        │       (Arc_Testnet, Ethereum,
    Ethereum, …)  ──► │   Balance        │ ──►    Base, …)
                      │   (per-account)  │
                      └──────────────────┘
                              ▲
                              │
                       spend() / deposit()
                              │
                       ┌──────────────┐
                       │  AppKit      │
                       │  + viem-v2   │
                       │  adapter     │
                       └──────────────┘
```

In LEO, the operator's viem adapter signs the spend. The destination address
(merchant) receives the minted USDC. Every step emits a lifecycle event that
the audit log captures.

---

## 4. Spend Lifecycle

```
   x402 client                       x402Service                  CircleGatewayService                 AppKit / Chain
       │                                  │                                │                                │
       │  POST + PAYMENT-SIGNATURE       │                                │                                │
       ├─────────────────────────────────►│                                │                                │
       │                                  │                                │                                │
       │                                  │  spend({ amount, dest })       │                                │
       │                                  ├───────────────────────────────►│                                │
       │                                  │                                │  INSERT GatewayTransaction     │
       │                                  │                                │  (PENDING, x402 ref)           │
       │                                  │                                │                                │
       │                                  │                                │  spend(params)                 │
       │                                  │                                ├───────────────────────────────►│
       │                                  │                                │  gateway.spend.started         │
       │                                  │                                │◄───────────────────────────────┤
       │                                  │                                │  → audit row PENDING → BROADCAST│
       │                                  │                                │                                │
       │                                  │                                │  buildBurnIntents              │
       │                                  │                                │  signBurnIntents               │
       │                                  │                                │  fetchAttestation              │
       │                                  │                                │  mint (destination chain)      │
       │                                  │                                │                                │
       │                                  │                                │  gateway.spend.succeeded       │
       │                                  │                                │◄───────────────────────────────┤
       │                                  │                                │  → audit row BROADCAST → CONFIRMED
       │                                  │                                │  → txHash, transferId, fees    │
       │                                  │                                │                                │
       │                                  │  { success: true, txHash }     │                                │
       │                                  │◄───────────────────────────────┤                                │
       │  200 + PAYMENT-RESPONSE          │                                │                                │
       │◄─────────────────────────────────┤                                │                                │
       │                                  │                                │                                │

   Failure paths:
     - gateway.spend.failed       → audit row FAILED, x402 returns 402
     - insufficient balance        → mapped to HTTP 402 (per x402 spec)
     - on-chain revert             → mapped to HTTP 502
     - attestation timeout         → mapped to HTTP 502
```

The spend path is **idempotent** at the x402 layer (the `paymentReference` on
`PaymentEntitlement` is unique). The Gateway layer adds a second idempotency
key on `gatewayEventId` for webhook replay protection.

---

## 5. Webhook Lifecycle

Circle Gateway sends four types of async events. All are HMAC-SHA256 signed
with `GATEWAY_WEBHOOK_SECRET` and delivered to `POST /api/v1/gateway/webhooks`.

| Event | When | Effect in LEO |
|---|---|---|
| `deposit.completed` | USDC successfully deposited into Unified Balance | Audit row: `DEPOSIT` / `CONFIRMED` |
| `deposit.failed`    | Deposit reverted on chain            | Audit row: `DEPOSIT` / `FAILED` |
| `spend.completed`   | Spend minted on destination chain   | Audit row: `SPEND` / `CONFIRMED` |
| `spend.failed`      | Spend reverted                       | Audit row: `SPEND` / `FAILED` |
| `transfer.failed`   | Cross-chain transfer failed          | Audit row: `SPEND` / `FAILED` |
| `balance.updated`   | Balance changed outside our spend    | Audit row: `BALANCE` snapshot |

### Webhook contract

- **Method:** `POST`
- **Path:** `/api/v1/gateway/webhooks`
- **Auth:** HMAC-SHA256 of the *raw* body, header `X-Circle-Signature: <hex>`
- **Secret:** `GATEWAY_WEBHOOK_SECRET` (configured in `.env`)
- **Idempotency:** `eventId` — duplicates are acknowledged with `created: false`

### Idempotency / duplicate prevention

```ts
const existing = await prisma.gatewayTransaction.findFirst({
  where: { gatewayEventId: evt.eventId },
});
if (existing) {
  return { created: false, row: this.toTxResult(existing) };
}
```

In MOCK mode (no `GATEWAY_WEBHOOK_SECRET` set) the service **accepts all
webhooks without signature validation** and logs a warning. This keeps dev
environments unblocked. **Production must set the secret.**

---

## 6. x402 Integration

The x402 protocol is **unchanged**. The settlement layer (`x402Service.verifyAndSettle`)
now has three branches:

```
   1. config.x402.facilitatorUrl set    → call Coinbase facilitator (existing)
   2. circleGatewayService.isLive()     → call Unified Balance spend() (NEW)
   3. otherwise                          → local mock facilitator (existing, dev)
```

### Mapped errors

| Gateway error           | HTTP code   | x402 response              |
|-------------------------|-------------|----------------------------|
| Insufficient balance    | 402         | `paymentStatus: FAILED`    |
| On-chain revert         | 502         | `ApiError(502)`            |
| Attestation timeout     | 502         | `ApiError(502)`            |
| Network/rpc error       | 502         | `ApiError(502)`            |

### Headers

- `PAYMENT-REQUIRED` (request) — base64-encoded `X402Challenge` JSON
- `PAYMENT-RESPONSE` (response) — base64-encoded `X402SettlementResult` JSON
- `PAYMENT-SIGNATURE` (request) — base64-encoded client signature payload

These are unchanged from the original x402 spec.

---

## 7. REST API

All endpoints except `POST /gateway/webhooks` require an `Authorization: Bearer
<jwt>` header. The webhook endpoint is signature-protected instead.

| Method | Path | Description |
|---|---|---|
| `GET`  | `/api/v1/gateway/status`           | Runtime mode (LIVE / MOCK), network, operator address |
| `POST` | `/api/v1/gateway/deposit`          | Deposit USDC into Unified Balance |
| `POST` | `/api/v1/gateway/spend`            | Spend USDC from Unified Balance |
| `GET`  | `/api/v1/gateway/balance`          | Aggregated balance (per-chain breakdown) |
| `GET`  | `/api/v1/gateway/transactions`     | Audit log, filterable by wallet/op/status |
| `GET`  | `/api/v1/gateway/transactions/:id` | Single transaction by id |
| `POST` | `/api/v1/gateway/webhooks`         | Circle Gateway async events (HMAC-protected) |

See `docs/CIRCLE_GATEWAY.postman_collection.json` for a ready-to-import
Postman collection with all seven endpoints pre-populated.

---

## 8. Environment Variables

| Var | Required for LIVE | Description |
|---|---|---|
| `GATEWAY_ENABLED`      | yes | `"true"` to enable. Defaults to MOCK when unset. |
| `KIT_KEY`              | yes | Circle App Kit API key (`x-app-kit-key` header). |
| `CIRCLE_GATEWAY_KEY`   | no  | Circle Gateway API key (some endpoints). |
| `GATEWAY_RPC_URL`      | no  | Custom Arc Testnet RPC. Defaults to public RPC. |
| `GATEWAY_WALLET_PRIVATE_KEY` | yes | Operator EVM private key. **Never commit.** |
| `GATEWAY_WEBHOOK_SECRET` | no  | HMAC-SHA256 secret for webhook validation. **Set in production.** |
| `GATEWAY_DELEGATE_ADDRESS` | no | Address delegated to spend from operator balance. |
| `UNIFIED_BALANCE_NETWORK` | no | `Arc_Testnet` (default) or `Arc`. |

**Never commit secrets.** All keys are read from `.env` at boot; rotate them by
updating `.env` and restarting the process.

---

## 9. Database

`GatewayTransaction` is the single source of truth for all Gateway activity.

```prisma
model GatewayTransaction {
  id                  String   @id @default(uuid())
  operation           String   // DEPOSIT | SPEND | BALANCE | WEBHOOK
  workflowId          String?
  nodeId              String?
  paymentReference    String?
  paymentEntitlementId String?
  transactionHash     String?
  gatewayTransferId   String?
  gatewayEventId      String?  // Webhook idempotency key
  webhookEventType    String?
  walletAddress       String
  amount              Decimal  @db.Decimal(18, 6)
  token               String   @default("USDC")
  sourceChain         String?
  destinationChain    String?
  network             String   @default("eip155:5042002")
  status              GatewayTxStatus
  errorMessage        String?
  feeAmount           Decimal?
  feeToken            String?
  explorerUrl         String?
  initiatedBy         String?
  metadata            Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  confirmedAt         DateTime?
}
```

Indexes: `operation`, `status`, `walletAddress`, `(workflowId, nodeId)`,
`paymentReference`, `gatewayEventId`, `transactionHash`, `createdAt`.

---

## 10. Operations Runbook

### Switching from MOCK to LIVE

1. Acquire a Circle App Kit key from the Circle developer portal.
2. Set the following in `.env`:
   ```
   GATEWAY_ENABLED=true
   KIT_KEY=<your_key>
   GATEWAY_WALLET_PRIVATE_KEY=<0x-prefixed operator key>
   GATEWAY_WEBHOOK_SECRET=<random 32+ char string>
   ```
3. Fund the operator's Gateway account by depositing USDC through the
   `POST /api/v1/gateway/deposit` endpoint (or directly via the App Kit).
4. Register the webhook URL in the Circle developer portal:
   `https://<your-domain>/api/v1/gateway/webhooks`
5. Restart the backend.
6. Verify with `GET /api/v1/gateway/status` — should return `"mode": "LIVE"`.
7. Run `npm test` (the gateway test suite covers both MOCK and LIVE paths).

### Rotating secrets

- `KIT_KEY` — update `.env`, restart. No DB impact.
- `GATEWAY_WEBHOOK_SECRET` — update `.env`, **re-register the webhook in the
  Circle portal with the new secret** (or the new value is useless), restart.
- `GATEWAY_WALLET_PRIVATE_KEY` — never rotate without funding the new operator
  first; existing spends in-flight may revert.

### Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| `Operator adapter not configured` | `GATEWAY_WALLET_PRIVATE_KEY` missing or invalid | Add/fix the key, restart |
| `Insufficient balance` | Operator's Unified Balance < spend amount | Fund the operator via `/deposit` |
| `Attestation expired` | Slow network, spend took > 5 min | Retry the spend; check `gateway.spend.retry` flow |
| `Bad gateway` 502 | Network error or RPC failure | Check `GATEWAY_RPC_URL`; retry |
| Webhooks ignored | `GATEWAY_WEBHOOK_SECRET` mismatch | Verify the secret matches the Circle portal config |

---

## 11. Testing

### Unit + integration

```bash
# Compile and run the gateway test suite
npx tsc
node dist/tests/gateway.test.js
```

The suite covers:
- MOCK/LIVE introspection
- spend, deposit, balance, transactions
- Webhook signature validation (positive + negative)
- Webhook idempotency
- REST endpoint authorization
- x402 → Gateway spend path (both MOCK and LIVE branches)

### 10-step E2E

The existing 10-step E2E test (`node dist/tests/end-to-end.test.js`) continues to
pass in MOCK mode. In LIVE mode, step 6/7 (PAYMENT-SIGNATURE settlement) will
trigger a real Gateway spend and the `GatewayTransaction` table will record it.

### Postman

Import `docs/CIRCLE_GATEWAY.postman_collection.json`. The collection includes:
- All 5 REST endpoints (auth-protected, requires a valid JWT)
- The 4 webhook events (no auth, requires `GATEWAY_WEBHOOK_SECRET` for signature)

---

## 12. References

- [@circle-fin/app-kit on npm](https://www.npmjs.com/package/@circle-fin/app-kit)
- [@circle-fin/adapter-viem-v2 on npm](https://www.npmjs.com/package/@circle-fin/adapter-viem-v2)
- [viem v2 documentation](https://viem.sh/)
- [Coinbase x402 protocol](https://www.x402.org/)
- LEO's existing 10-step E2E test: `src/tests/end-to-end.test.ts`
- LEO's x402 service: `src/services/x402.service.ts`
- LEO's workflow engine: `src/engine/core/base.node.ts`
- LEO's Merkle engine: `src/engine/merkle/merkle.service.ts`
- LEO's ReceiptRegistryV2: `src/engine/blockchain/receipt-registry.service.ts`
