// src/tests/end-to-end.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// E2E Verification Script for ReceiptRegistryV2 and x402 Payment Flow
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'assert';
import http from 'http';
import express from 'express';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import { generateAuthTokens } from '../services/token.service';
import { Role } from '@prisma/client';
import app from '../app';
import { workflowService } from '../services/workflow.service';
import { receiptRegistryService } from '../engine/blockchain/receipt-registry.service';
import { verificationService } from '../engine/verify/verify.service';

const TEST_PORT = 5001;
const BASE_URL = `http://localhost:${TEST_PORT}/api/v1`;

// Helper function to perform HTTP requests in tests
function makeRequest(
  options: http.RequestOptions,
  bodyData?: string,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch {
          // Keep raw string
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function runE2E() {
  console.log('🚀 Starting x402 Payment & ReceiptRegistryV2 End-to-End Test Suite...');
  let server: http.Server | null = null;

  try {
    // ─── 0. Seed Database ────────────────────────────────────────────────────
    console.log('\n  ► Step 0: Seeding test user & generating auth tokens...');
    // Clear old data to prevent foreign key or uniqueness errors
    await prisma.paymentEntitlement.deleteMany({});
    await prisma.workflowNode.deleteMany({});
    await prisma.researchSession.deleteMany({});
    await prisma.user.deleteMany({});

    const testUser = await prisma.user.create({
      data: {
        email: 'e2e.buyer@leo.dev',
        displayName: 'E2E Buyer',
        password: 'e2e-test-no-real-password',
        role: Role.CONSUMER,
      },
    });

    const tokens = await generateAuthTokens(testUser.id, Role.CONSUMER);
    const accessToken = tokens.access.token;
    console.log('    ✓ Test user created. Access Token generated.');

    // Start Express server on test port
    server = app.listen(TEST_PORT);
    console.log(`    ✓ Backend server listening on port ${TEST_PORT}.`);

    // ─── 1. Run Workflow ─────────────────────────────────────────────────────
    console.log('\n  ► Step 1: Running workflow by starting a research session...');
    const startRes = await makeRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/v1/workflow/start',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
      JSON.stringify({
        query: 'What is the role of AI in Decentralized Finance?',
        context: {},
      }),
    );

    assert.strictEqual(startRes.status, 200, 'Workflow start should succeed');
    const sessionId = startRes.body.data.sessionId;
    assert.ok(sessionId, 'Should return a valid sessionId');
    console.log(`    ✓ Workflow session started successfully: ${sessionId}`);

    // Retrieve session details to extract node IDs
    const sessionDetailRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/v1/workflow/sessions/${sessionId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    assert.strictEqual(sessionDetailRes.status, 200);
    const nodes = sessionDetailRes.body.data.workflowNodes;
    assert.ok(nodes && nodes.length > 0, 'Workflow should have executed and created nodes');

    // Find the Reasoning Node in the session
    const reasoningNode = nodes.find((n: any) => n.nodeName === 'ReasoningNode');
    assert.ok(reasoningNode, 'Workflow must contain a ReasoningNode');
    const reasoningNodeId = reasoningNode.id;
    console.log(`    ✓ ReasoningNode found with ID: ${reasoningNodeId}`);

    // ─── 2. Publish ReceiptRegistryV2 Receipt ─────────────────────────────────
    console.log('\n  ► Step 2: Publishing Merkle root receipt to ReceiptRegistryV2...');
    const publishReceiptRes = await makeRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/v1/receipt/publish',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
      JSON.stringify({
        workflowId: sessionId,
      }),
    );

    assert.strictEqual(publishReceiptRes.status, 200, 'Publishing receipt should succeed');
    assert.strictEqual(publishReceiptRes.body.data.registrationStatus, 'REGISTERED');
    const onChainReceiptId = publishReceiptRes.body.data.onChainReceiptId;
    console.log(`    ✓ ReceiptRegistryV2 receipt published. On-chain ID: ${onChainReceiptId}`);

    // ─── 3 & 4: Request protected reasoning node & Receive HTTP 402 ──────────
    console.log('\n  ► Step 3 & 4: Requesting reasoning node details (Expecting HTTP 402)...');
    const lockedNodeRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/v1/workflow/reasoning/${reasoningNodeId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    assert.strictEqual(lockedNodeRes.status, 402, 'Unpaid node request must return HTTP 402');
    console.log('    ✓ Request blocked. Server returned HTTP 402 Payment Required.');

    // ─── 5. Verify PAYMENT-REQUIRED header is returned ────────────────────────
    console.log('\n  ► Step 5: Verifying PAYMENT-REQUIRED header exists and is valid...');
    const paymentRequiredHeader = lockedNodeRes.headers['payment-required'] as string;
    assert.ok(paymentRequiredHeader, 'Response headers must include PAYMENT-REQUIRED');

    // Decode Base64 header and verify properties
    const decodedChallenge = JSON.parse(Buffer.from(paymentRequiredHeader, 'base64').toString('utf8'));
    assert.strictEqual(decodedChallenge.x402Version, 2);
    assert.strictEqual(decodedChallenge.error, 'Payment required');
    const accepts = decodedChallenge.accepts[0];
    assert.strictEqual(accepts.scheme, 'exact');
    assert.strictEqual(accepts.currency, 'USDC');
    assert.strictEqual(accepts.amount, '5000', 'Reasoner price should be 5000 atomic units');
    
    const reference = accepts.reference;
    assert.ok(reference, 'Challenge accepts must include payment reference');
    console.log(`    ✓ PAYMENT-REQUIRED challenge validated. Reference: ${reference}`);

    // ─── 6 & 7: Simulate/send PAYMENT-SIGNATURE & Validate ───────────────────
    console.log('\n  ► Step 6 & 7: Simulating PAYMENT-SIGNATURE submission and facilitator validation...');

    // Resolve buyer's wallet using the same keccak256 derivation as the x402 middleware
    // (see src/middlewares/x402.middleware.ts).
    const { ethers } = await import('ethers');
    const userHash = ethers.keccak256(ethers.toUtf8Bytes(testUser.id));
    const buyerWallet = ethers.getAddress(ethers.dataSlice(userHash, 12));

    // Construct valid signature payload
    const signaturePayload = {
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        from: buyerWallet,
        to: '0x5e11e80000000000000000000000000000000000', // default sellerAddress
        value: '5000', // USDC atomic price
        validAfter: '0',
        validBefore: '1751616000',
        nonce: '0x123',
        signature: 'MOCK_SIGNATURE',
        reference: reference,
      },
    };

    const signatureHeader = Buffer.from(JSON.stringify(signaturePayload)).toString('base64');

    // Retry resource request with PAYMENT-SIGNATURE header
    const paidNodeRes = await makeRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/api/v1/workflow/reasoning/${reasoningNodeId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'PAYMENT-SIGNATURE': signatureHeader,
      },
    });

    // ─── 8. Node becomes unlocked ─────────────────────────────────────────────
    console.log('\n  ► Step 8: Verifying node is unlocked...');
    assert.strictEqual(paidNodeRes.status, 200, 'Access should be granted with valid signature');
    
    const paymentResponseHeader = paidNodeRes.headers['payment-response'] as string;
    assert.ok(paymentResponseHeader, 'Unlock response must include PAYMENT-RESPONSE header');
    const responsePayload = JSON.parse(Buffer.from(paymentResponseHeader, 'base64').toString('utf8'));
    assert.strictEqual(responsePayload.success, true);
    assert.strictEqual(responsePayload.paymentStatus, 'PAID');
    console.log(`    ✓ Access Granted. Status: ${responsePayload.paymentStatus}`);

    // ─── 9. Fetch the node successfully ───────────────────────────────────────
    console.log('\n  ► Step 9: Fetching the node details successfully...');
    const nodeDetail = paidNodeRes.body.data;
    assert.strictEqual(nodeDetail.id, reasoningNodeId);
    assert.strictEqual(nodeDetail.nodeName, 'ReasoningNode');
    console.log(`    ✓ Fetched node output: "${nodeDetail.output?.CoT?.slice(0, 50)}..."`);

    // ─── 10. Verify the unlocked node passes Merkle proof verification ────────
    console.log('\n  ► Step 10: Verifying the unlocked node still passes Merkle proof verification...');
    
    // Call node verification route to check integrity hash matches DB state
    const verifyNodeRes = await makeRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/v1/verify/node',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
      JSON.stringify({
        nodeId: reasoningNodeId,
      }),
    );

    assert.strictEqual(verifyNodeRes.status, 200);
    assert.strictEqual(verifyNodeRes.body.data.isValid, true);
    console.log('    ✓ Node hash matches stored value.');

    // Retrieve Merkle proof details to verify leaf proof verification
    const proofRes = await makeRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: `/api/v1/workflow/${sessionId}/proof`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
      JSON.stringify({
        nodeId: reasoningNodeId,
      }),
    );

    assert.strictEqual(proofRes.status, 200);
    const { leafHash, proof, rootHash } = proofRes.body.data;

    // Verify leaf inclusion using verification service
    const verifyProofRes = await makeRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/v1/verify/proof',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      },
      JSON.stringify({
        leafHash,
        proof,
        rootHash,
      }),
    );

    assert.strictEqual(verifyProofRes.status, 200);
    assert.strictEqual(verifyProofRes.body.data.isValid, true, 'Merkle proof inclusion check must succeed');
    console.log('    ✓ Merkle proof is valid. Node hash successfully proved to be in anchored root.');

    console.log('\n🎉 All 10 verification steps completed successfully without errors!');
  } catch (err: any) {
    console.error('\n❌ E2E Verification failed:');
    console.error(err);
    if (server) {
      server.close();
    }
    process.exit(1);
  } finally {
    if (server) {
      server.close();
      console.log('    ✓ Test server closed.');
    }
  }
}

runE2E();
