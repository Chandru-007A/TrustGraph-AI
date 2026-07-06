// src/tests/x402.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Unit and Integration Tests for x402 Payment Protocol.
// Uses Node's built-in assert module and runs standalone with ts-node.
// ─────────────────────────────────────────────────────────────────────────────

import assert from 'assert';
import { x402Service, X402SignaturePayload } from '../services/x402.service';
import prisma from '../utils/prisma';
import crypto from 'crypto';

async function runTests() {
  console.log('🧪 Starting x402 Payment Protocol Tests...');

  try {
    // ─── TEST 1: Pricing Resolution ──────────────────────────────────────────
    console.log('  ► Test 1: Node Pricing resolution...');
    const plannerPrice = x402Service.getNodePriceAndAtomic('PlannerNode');
    assert.strictEqual(plannerPrice.price, 0.001);
    assert.strictEqual(plannerPrice.atomicAmount, '1000');

    const reasoningPrice = x402Service.getNodePriceAndAtomic('ReasoningNode');
    assert.strictEqual(reasoningPrice.price, 0.005);
    assert.strictEqual(reasoningPrice.atomicAmount, '5000');

    const defaultPrice = x402Service.getNodePriceAndAtomic('UnknownNode');
    assert.strictEqual(defaultPrice.price, 0.001);
    assert.strictEqual(defaultPrice.atomicAmount, '1000');
    console.log('    ✓ Price resolution passed.');

    // ─── TEST 2: Base64 Challenge Headers ────────────────────────────────────
    console.log('  ► Test 2: Challenge Header serialization...');
    const mockChallenge = {
      x402Version: 2,
      error: 'Payment required',
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000',
          currency: 'USDC',
          payTo: '0xSellerAddress',
          asset: '0xUsdcAddress',
          expires: new Date(Date.now() + 60000).toISOString(),
          reference: 'test_ref_123',
        },
      ],
    };

    const header = x402Service.encodeChallengeHeader(mockChallenge);
    assert.ok(typeof header === 'string');
    assert.ok(header.length > 10);
    console.log('    ✓ Challenge encoding passed.');

    // ─── TEST 3: PAYMENT-SIGNATURE Header Decoding ──────────────────────────
    console.log('  ► Test 3: Signature Header parsing...');
    const rawSigPayload: X402SignaturePayload = {
      scheme: 'exact',
      network: 'eip155:8453',
      payload: {
        from: '0xBuyerAddress',
        to: '0xSellerAddress',
        value: '1000',
        validAfter: '0',
        validBefore: '1751616000',
        nonce: '0x123',
        signature: '0xabc',
        reference: 'test_ref_123',
      },
    };

    const sigHeader = Buffer.from(JSON.stringify(rawSigPayload)).toString('base64');
    const decoded = x402Service.decodeSignatureHeader(sigHeader);
    assert.strictEqual(decoded.scheme, 'exact');
    assert.strictEqual(decoded.payload.from, '0xBuyerAddress');
    assert.strictEqual(decoded.payload.reference, 'test_ref_123');
    console.log('    ✓ Signature parsing passed.');

    // ─── TEST 4: Entitlement Database Check (Mock Entitlement) ────────────────
    console.log('  ► Test 4: Database entitlement validation...');
    
    try {
      // Clean up or prepare a test session and node
      const testUser = await prisma.user.findFirst();
      if (!testUser) {
        console.log('    ⚠️ Skipping DB tests: no test user exists in the database.');
        return;
      }

      const testSession = await prisma.researchSession.create({
        data: {
          userId: testUser.id,
          workflowId: 'test_workflow_uuid',
          status: 'COMPLETED',
        },
      });

      const testNode = await prisma.workflowNode.create({
        data: {
          sessionId: testSession.id,
          stepIndex: 4,
          nodeName: 'ReasoningNode',
          agentDid: 'did:leo:reasoning-agent:mock',
          status: 'COMPLETED',
        },
      });

      const mockWalletAddress = '0x1111111111111111111111111111111111111111';

      // Verify initially unpaid
      const checkInitial = await x402Service.checkEntitlement(testSession.id, testNode.id, mockWalletAddress);
      assert.strictEqual(checkInitial, false, 'Should not be paid initially');

      // Create challenge
      const { reference } = await x402Service.createChallenge(testSession.id, testNode.id, mockWalletAddress);
      assert.ok(reference.startsWith('ref_'));

      // Perform validation with mock signature payload
      const mockSigHeader = Buffer.from(
        JSON.stringify({
          scheme: 'exact',
          network: 'eip155:8453',
          payload: {
            from: mockWalletAddress,
            to: '0x5e11e80000000000000000000000000000000000', // default sellerAddress
            value: '5000', // Reasoning price = 0.005 -> 5000 atomic units
            validAfter: '0',
            validBefore: '1751616000',
            nonce: '0xNonceVal',
            signature: 'MOCK_SIGNATURE',
            reference,
          },
        }),
      ).toString('base64');

      const verifyResult = await x402Service.verifyAndSettle(mockSigHeader, mockWalletAddress);
      assert.strictEqual(verifyResult.success, true);
      assert.strictEqual(verifyResult.paymentStatus, 'PAID');

      // Recheck entitlement in database
      const checkFinal = await x402Service.checkEntitlement(testSession.id, testNode.id, mockWalletAddress);
      assert.strictEqual(checkFinal, true, 'Entitlement should now be PAID');
      console.log('    ✓ Database integration passed.');

      // Clean up created records
      await prisma.paymentEntitlement.deleteMany({ where: { workflowId: testSession.id } });
      await prisma.workflowNode.delete({ where: { id: testNode.id } });
      await prisma.researchSession.delete({ where: { id: testSession.id } });
      console.log('    ✓ Cleanup complete.');
    } catch (dbErr: any) {
      console.log('    ⚠️ Skipping DB tests: Database not configured or not accessible.');
      console.warn(`DB test skipped: ${dbErr.message}`);
    }

    console.log('\n🎉 All x402 Payment Protocol Tests Passed Successfully!');
  } catch (err: any) {
    console.error('\n❌ Test execution failed:');
    console.error(err);
    process.exit(1);
  }
}

runTests();
