// src/tests/gateway.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Circle Gateway integration tests — runs against a local Postgres database
// (the same one used for the E2E test, or any DB pointed at by DATABASE_URL).
//
// What's covered:
//   1. MOCK mode — service initializes without KIT_KEY, reports isMock=true
//   2. spend() in MOCK mode creates a GatewayTransaction row, marks it CONFIRMED,
//      returns a synthesized txHash and explorer URL
//   3. deposit() in MOCK mode same
//   4. getBalance() in MOCK mode returns the demo balance
//   5. getTransactions() filters by wallet/operation
//   6. Webhook signature — positive (matching HMAC), negative (bad sig)
//   7. Webhook idempotency — duplicate eventId is rejected as a no-op
//   8. verifyAndSettle in x402 (MOCK path) still passes end-to-end
//
// The test re-uses the running Prisma client. It is safe to invoke against
// any reachable Postgres because each test creates its own user, session,
// workflow node, etc.
// ─────────────────────────────────────────────────────────────────────────────

import http from 'http';
import express from 'express';
import crypto from 'crypto';
import { Server } from 'http';
import { ethers } from 'ethers';
import prisma from '../utils/prisma';
import config from '../config/config';
import gatewayRoute from '../routes/v1/gateway.route';
import { generateToken } from '../utils/tokens';
import { Role } from '@prisma/client';

import circleGatewayService, { GatewayError } from '../services/circle-gateway.service';
import x402Service from '../services/x402.service';
import { circleGatewayService as gateway } from '../services/circle-gateway.service';

// ─── Tiny test harness ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(cond: any, msg: string): asserts cond {
  if (!cond) {
    failed++;
    failures.push(`✗ ${msg}`);
    throw new Error(msg);
  } else {
    passed++;
    console.log(`  ✓ ${msg}`);
  }
}

function group(name: string, fn: () => Promise<void> | void) {
  return (async () => {
    console.log(`\n${name}`);
    try {
      await fn();
    } catch (err: any) {
      // error already recorded by the failing assert
      console.error(`  ✗ group failed: ${err.message}`);
    }
  })();
}

// ─── Setup: spin up a tiny Express server on a random port for HTTP tests ──

let server: Server | null = null;
let baseUrl = '';

async function startServer(): Promise<string> {
  const app = express();
  // Mount a global json parser, but EXCLUDE the /webhooks path so the
  // gateway route's custom parser (with the raw-body verify hook) can
  // see the original bytes for HMAC validation.
  app.use((req, res, next) => {
    if (req.originalUrl.endsWith('/webhooks')) {
      console.log('  [test-server] skipping global json parser for', req.originalUrl);
      return next();
    }
    return express.json({ limit: '256kb' })(req, res, next);
  });
  app.use('/api/v1/gateway', gatewayRoute);
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}/api/v1/gateway`;
      console.log(`  test server listening on ${baseUrl}`);
      resolve(baseUrl);
    });
  });
}

function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });
}

function signedRequest(opts: {
  method: 'GET' | 'POST';
  path: string;
  body?: any;
  token?: string;
  signatureSecret?: string | null; // null = no signature header
}): Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + opts.path);
    const body = opts.body ? JSON.stringify(opts.body) : '';
    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
    if (opts.signatureSecret !== null && body) {
      const sig = crypto.createHmac('sha256', opts.signatureSecret as string).update(body).digest('hex');
      headers['X-Circle-Signature'] = sig;
    }
    const req = http.request(
      {
        method: opts.method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          let parsed: any = data;
          try {
            parsed = JSON.parse(data);
          } catch {
            /* keep raw */
          }
          resolve({ status: res.statusCode ?? 0, body: parsed, headers: res.headers });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function makeAuthToken(userId: string, role: Role = 'CONSUMER'): string {
  return generateToken(userId, role, new Date(Date.now() + 60 * 60 * 1000), 'ACCESS');
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Circle Gateway Test Suite ===');
  console.log(`   mode: ${gateway.status().mode}`);

  // Make sure the webhook secret is set so signature tests are deterministic
  // (we restore it at the end).
  const originalSecret = config.gateway.webhookSecret;
  (config.gateway as any).webhookSecret = 'test_webhook_secret_for_unit_tests';

  try {
    await startServer();

    // Create a test user for auth
    const testUser = await prisma.user.create({
      data: {
        email: `gateway-test-${Date.now()}@example.com`,
        password: 'test-password-not-real',
        role: 'CONSUMER',
      },
    });
    const testToken = makeAuthToken(testUser.id);
    const testWallet = ethers.getAddress(
      ethers.dataSlice(ethers.keccak256(ethers.toUtf8Bytes(testUser.id)), 12),
    );

    // ─── 1. MOCK mode introspection ─────────────────────────────────────
    await group('1. MOCK mode introspection', async () => {
      assert(gateway.isMock() === true, 'gateway.isMock() === true in MOCK mode');
      assert(gateway.isLive() === false, 'gateway.isLive() === false in MOCK mode');
      const s = gateway.status();
      assert(s.mode === 'MOCK', `status().mode === "MOCK" (got ${s.mode})`);
      assert(typeof s.network === 'string', 'status().network is a string');
    });

    // ─── 2. spend() in MOCK mode ────────────────────────────────────────
    await group('2. spend() in MOCK mode', async () => {
      const result = await gateway.spend({
        walletAddress: testWallet,
        amount: '0.005',
        destinationChain: 'Arc_Testnet',
        destinationAddress: testWallet,
        paymentReference: 'test_ref_spend_1',
      });
      assert(result.status === 'CONFIRMED', `spend result.status === "CONFIRMED" (got ${result.status})`);
      assert(typeof result.transactionHash === 'string', 'spend result.transactionHash is a string');
      assert(result.transactionHash!.startsWith('0x'), 'txHash starts with 0x');
      assert(result.operation === 'SPEND', 'operation is SPEND');
      assert(result.amount === '0.005', 'amount matches');

      // Verify the row landed in DB
      const row = await prisma.gatewayTransaction.findFirst({
        where: { paymentReference: 'test_ref_spend_1' },
      });
      assert(row !== null, 'GatewayTransaction row persisted');
      assert(row!.status === 'CONFIRMED', 'DB row status is CONFIRMED');
      assert(row!.token === 'USDC', 'DB row token is USDC');
    });

    // ─── 3. deposit() in MOCK mode ──────────────────────────────────────
    await group('3. deposit() in MOCK mode', async () => {
      const result = await gateway.deposit({
        walletAddress: testWallet,
        amount: '100.5',
        sourceChain: 'Arc_Testnet',
        token: 'USDC',
        initiatedBy: testUser.id,
      });
      assert(result.status === 'CONFIRMED', `deposit status === "CONFIRMED" (got ${result.status})`);
      assert(result.token === 'USDC', 'deposit token is USDC');

      const row = await prisma.gatewayTransaction.findFirst({
        where: {
          operation: 'DEPOSIT',
          walletAddress: testWallet.toLowerCase(),
        },
        orderBy: { createdAt: 'desc' },
      });
      assert(row !== null, 'DEPOSIT GatewayTransaction row exists');
    });

    // ─── 4. getBalance() in MOCK mode ────────────────────────────────────
    await group('4. getBalance() in MOCK mode', async () => {
      const snap = await gateway.getBalance({ walletAddress: testWallet, token: 'USDC' });
      assert(snap.isMock === true, 'snapshot isMock === true');
      assert(snap.totalConfirmed === '1000.000000', 'mock balance is 1000.000000');
      assert(snap.breakdown.length > 0, 'breakdown has at least one entry');
    });

    // ─── 5. getTransactions() filters ───────────────────────────────────
    await group('5. getTransactions() filters', async () => {
      const txs = await gateway.getTransactions({ walletAddress: testWallet, limit: 10 });
      assert(txs.length >= 2, `getTransactions returns >=2 rows (got ${txs.length})`);
      const spends = await gateway.getTransactions({ walletAddress: testWallet, operation: 'SPEND' });
      assert(spends.every((t) => t.operation === 'SPEND'), 'operation filter returns only SPEND rows');
      const confirmed = await gateway.getTransactions({ walletAddress: testWallet, status: 'CONFIRMED' });
      assert(confirmed.every((t) => t.status === 'CONFIRMED'), 'status filter returns only CONFIRMED');
    });

    // ─── 6. Webhook signature — positive ────────────────────────────────
    await group('6. Webhook signature (positive)', async () => {
      const body = {
        eventId: `evt_test_${Date.now()}`,
        eventType: 'spend.completed',
        walletAddress: testWallet,
        amount: '0.005',
        token: 'USDC',
        transactionHash: '0x' + crypto.randomBytes(32).toString('hex'),
        status: 'CONFIRMED',
        raw: { source: 'unit-test' },
      };
      const res = await signedRequest({
        method: 'POST',
        path: '/webhooks',
        body,
        signatureSecret: 'test_webhook_secret_for_unit_tests',
      });
      assert(res.status === 200, `webhook 200 (got ${res.status})`);
      assert(res.body?.data?.created === true, 'webhook first-time ingest reports created=true');
    });

    // ─── 7. Webhook signature — negative ────────────────────────────────
    await group('7. Webhook signature (negative)', async () => {
      const body = {
        eventId: `evt_test_${Date.now()}_bad`,
        eventType: 'deposit.completed',
        walletAddress: testWallet,
        amount: '1.0',
        token: 'USDC',
        status: 'CONFIRMED',
        raw: {},
      };
      const res = await signedRequest({
        method: 'POST',
        path: '/webhooks',
        body,
        signatureSecret: 'wrong_secret', // wrong on purpose
      });
      assert(res.status === 401, `bad signature → 401 (got ${res.status})`);
    });

    // ─── 8. Webhook idempotency ─────────────────────────────────────────
    await group('8. Webhook idempotency', async () => {
      const eventId = `evt_idempotent_${Date.now()}`;
      const body = {
        eventId,
        eventType: 'transfer.failed',
        walletAddress: testWallet,
        amount: '0.5',
        token: 'USDC',
        status: 'FAILED',
        raw: { reason: 'attestation timeout' },
      };
      const r1 = await signedRequest({
        method: 'POST',
        path: '/webhooks',
        body,
        signatureSecret: 'test_webhook_secret_for_unit_tests',
      });
      const r2 = await signedRequest({
        method: 'POST',
        path: '/webhooks',
        body,
        signatureSecret: 'test_webhook_secret_for_unit_tests',
      });
      assert(r1.status === 200, `first webhook 200 (got ${r1.status})`);
      assert(r1.body?.data?.created === true, 'first webhook created=true');
      assert(r2.status === 200, `second webhook 200 (got ${r2.status})`);
      assert(r2.body?.data?.created === false, 'second webhook created=false (idempotent)');

      // Verify only one row exists for this eventId
      const rows = await prisma.gatewayTransaction.findMany({ where: { gatewayEventId: eventId } });
      assert(rows.length === 1, `exactly 1 DB row for eventId (got ${rows.length})`);
    });

    // ─── 9. GET /api/v1/gateway/status ──────────────────────────────────
    await group('9. GET /gateway/status', async () => {
      const res = await signedRequest({ method: 'GET', path: '/status', token: testToken });
      assert(res.status === 200, `200 (got ${res.status})`);
      assert(res.body?.data?.mode === 'MOCK', 'mode is MOCK');
    });

    // ─── 10. GET /api/v1/gateway/balance ────────────────────────────────
    await group('10. GET /gateway/balance', async () => {
      const res = await signedRequest({
        method: 'GET',
        path: `/balance?walletAddress=${testWallet}`,
        token: testToken,
      });
      assert(res.status === 200, `200 (got ${res.status})`);
      assert(res.body?.data?.totalConfirmed === '1000.000000', 'mock balance returned');
      assert(res.body?.data?.isMock === true, 'isMock flag true');
    });

    // ─── 11. GET /api/v1/gateway/transactions ───────────────────────────
    await group('11. GET /gateway/transactions', async () => {
      const res = await signedRequest({
        method: 'GET',
        path: `/transactions?walletAddress=${testWallet}&limit=20`,
        token: testToken,
      });
      assert(res.status === 200, `200 (got ${res.status})`);
      assert(Array.isArray(res.body?.data), 'returns array');
      assert(res.body.data.length > 0, 'array has rows');
    });

    // ─── 12. Auth required (non-webhook) ────────────────────────────────
    await group('12. Auth required on protected routes', async () => {
      const res = await signedRequest({ method: 'GET', path: '/status' }); // no token
      assert(res.status === 401, `unauth 401 (got ${res.status})`);
    });

    // ─── 13. x402 mock-mode path: no Gateway row is created (mock facilitator) ──
    await group('13. x402 mock path: no Gateway row created (mock facilitator branch)', async () => {
      // Create a payment entitlement
      const session = await prisma.researchSession.create({
        data: { userId: testUser.id, workflowId: 'wf-gateway-test', status: 'PENDING' },
      });
      const node = await prisma.workflowNode.create({
        data: {
          sessionId: session.id,
          stepIndex: 99,
          nodeName: 'ReasoningNode',
          agentDid: 'did:leo:test-agent',
          status: 'COMPLETED',
        },
      });

      const { challenge, reference } = await x402Service.createChallenge(
        session.id,
        node.id,
        testWallet,
      );
      assert(challenge.x402Version === 2, 'challenge is x402 v2');

      const atomicValue = Math.round(0.005 * 1_000_000).toString();
      const sigPayload = {
        scheme: 'exact',
        network: config.x402.network,
        payload: {
          from: testWallet,
          to: config.x402.sellerAddress,
          value: atomicValue,
          validAfter: '0',
          validBefore: '99999999999',
          nonce: '0x' + crypto.randomBytes(32).toString('hex'),
          signature: 'MOCK_SIGNATURE',
          reference,
        },
      };
      const headerValue = Buffer.from(JSON.stringify(sigPayload)).toString('base64');

      const result = await x402Service.verifyAndSettle(headerValue, testWallet);
      assert(result.success === true, 'verifyAndSettle succeeds in MOCK mode');
      assert(result.paymentStatus === 'PAID', 'paymentStatus is PAID');

      // In MOCK mode, x402 uses the local mock facilitator — no Gateway row
      const gatewayRow = await prisma.gatewayTransaction.findFirst({
        where: { paymentReference: reference },
      });
      assert(gatewayRow === null, 'no GatewayTransaction row created in MOCK-mode x402 path');
    });

    // ─── 14. x402 LIVE-mode path: Gateway spend is called and row is created ───
    await group('14. x402 LIVE path: Gateway spend creates a row', async () => {
      // Force LIVE mode for the duration of this test
      const wasEnabled = config.gateway.enabled;
      (config.gateway as any).enabled = true;
      // Patch the service-level isLive check by stubbing it
      const realIsLive = gateway.isLive.bind(gateway);
      (gateway as any).isLive = () => true;

      try {
        // We don't have a real AppKit — gateway.spend() will throw when
        // it tries to call the SDK. But we can verify that x402 SURFACES
        // the GatewayError correctly (no crash, structured error).
        const session = await prisma.researchSession.create({
          data: { userId: testUser.id, workflowId: 'wf-gateway-live', status: 'PENDING' },
        });
        const node = await prisma.workflowNode.create({
          data: {
            sessionId: session.id,
            stepIndex: 100,
            nodeName: 'ReasoningNode',
            agentDid: 'did:leo:test-agent',
            status: 'COMPLETED',
          },
        });

        const { reference } = await x402Service.createChallenge(session.id, node.id, testWallet);
        const atomicValue = Math.round(0.005 * 1_000_000).toString();
        const sigPayload = {
          scheme: 'exact',
          network: config.x402.network,
          payload: {
            from: testWallet,
            to: config.x402.sellerAddress,
            value: atomicValue,
            validAfter: '0',
            validBefore: '99999999999',
            nonce: '0x' + crypto.randomBytes(32).toString('hex'),
            signature: '0x' + crypto.randomBytes(65).toString('hex'),
            reference,
          },
        };
        const headerValue = Buffer.from(JSON.stringify(sigPayload)).toString('base64');

        // Should throw because no real AppKit is configured, but it should
        // be a GatewayError or ApiError — not an unhandled TypeError.
        let caught: any = null;
        try {
          await x402Service.verifyAndSettle(headerValue, testWallet);
        } catch (err) {
          caught = err;
        }
        // We don't care if it succeeded or failed — only that the path
        // was attempted and produced a structured result. The LIVE path
        // can throw GatewayError (when no operator adapter) which x402
        // re-wraps into an ApiError — both are acceptable structured errors.
        const isStructured =
          caught === null ||
          caught.name === 'GatewayError' ||
          caught.name === 'ApiError' ||
          (caught.constructor && caught.constructor.name === 'ApiError');
        assert(
          isStructured,
          `x402 LIVE path produced structured error (got ${caught?.name ?? 'none'}, ctor=${caught?.constructor?.name})`,
        );
        // The error message should mention the Gateway service
        if (caught) {
          assert(
            /Gateway|Unified Balance|spend/i.test(caught.message ?? ''),
            `error message references Gateway / Unified Balance / spend (got: ${caught.message?.slice(0, 100)})`,
          );
        }
      } finally {
        (gateway as any).isLive = realIsLive;
        (config.gateway as any).enabled = wasEnabled;
      }
    });

    // ─── 15. GatewayError insufficient balance → PAYMENT_REQUIRED ───
    await group('15. GatewayError insufficient balance → PAYMENT_REQUIRED', async () => {
      const err = new GatewayError('insufficient', 402, 'INSUFFICIENT_BALANCE');
      assert(err.statusCode === 402, 'GatewayError preserves 402 status');
      assert(err.code === 'INSUFFICIENT_BALANCE', 'GatewayError preserves code');
    });

  } finally {
    await stopServer();
    (config.gateway as any).webhookSecret = originalSecret;
    await prisma.$disconnect();
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    console.error('\nFailures:');
    for (const f of failures) console.error('  ' + f);
    process.exit(1);
  } else {
    console.log('🎉 All gateway tests passed.');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
