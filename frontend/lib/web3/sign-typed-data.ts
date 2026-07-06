// frontend/lib/web3/sign-typed-data.ts
// ----------------------------------------------------------------------------
// EIP-712 typed-data builders for the x402 payment envelope.
//
// The Coinbase x402 v2 wire format encodes a `signature` string in the
// `PAYMENT-SIGNATURE` header. For Arc Testnet (chain id 5042002) we sign
// an EIP-712 `Payment` struct with the standard `verifyingContract`
// set to the USDC token contract (`accept.asset`). The server's mock
// facilitator branch accepts any signature that starts with `0x` and
// is the correct length (x402.service.ts → verifyAndSettle:387), and
// the live Circle Gateway branch does not inspect the signature at
// all — it just calls `gateway.spend()`. So a real wagmi signature
// works in BOTH modes without backend changes.
//
// Pure functions only — no React, no network. Lifted out of the modal
// so they can be unit-tested and reused from the history table's
// "View Receipt" link if needed.
// ----------------------------------------------------------------------------

import { ethers } from 'ethers';
import type {
  X402Accept,
  X402SignaturePayload,
} from '@/lib/api/types';

export const X402_EIP712_DOMAIN_NAME = 'LEO x402 Payment';
export const X402_EIP712_DOMAIN_VERSION = '1';

export const X402_EIP712_TYPES = {
  Payment: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'reference', type: 'bytes32' },
  ],
} as const;

export interface BuildEip712MessageArgs {
  accept: X402Accept;
  walletAddress: string;
  chainId: number;
}

export interface Eip712Payload {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  types: typeof X402_EIP712_TYPES;
  primaryType: 'Payment';
  message: {
    from: string;
    to: string;
    value: bigint;
    validAfter: bigint;
    validBefore: bigint;
    reference: `0x${string}`;
  };
}

/** Convert a CAIP-2 network string ("eip155:5042002") to a numeric chain id. */
export function networkToChainId(network: string): number {
  const parts = network.split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid CAIP-2 network string: ${network}`);
  }
  const id = Number(parts[parts.length - 1]);
  if (!Number.isFinite(id)) {
    throw new Error(`Invalid chain id in network string: ${network}`);
  }
  return id;
}

/**
 * Convert an `accept.reference` (a UUID string or hex string) to a
 * 32-byte `bytes32`. If the reference is already 0x-prefixed and
 * exactly 32 bytes, pass it through. Otherwise keccak256-hash the
 * UTF-8 bytes to produce a deterministic 32-byte value.
 */
export function referenceToBytes32(reference: string): `0x${string}` {
  const trimmed = reference.startsWith('0x') || reference.startsWith('0X')
    ? reference.slice(2)
    : reference;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return `0x${trimmed}` as `0x${string}`;
  }
  return ethers.keccak256(ethers.toUtf8Bytes(reference)) as `0x${string}`;
}

/**
 * Build the deterministic EIP-712 message (no signature yet).
 * `value` is converted to `bigint` so wagmi's `useSignTypedData`
 * gets a proper uint256 (not a stringified number).
 */
export function buildEip712Message(
  args: BuildEip712MessageArgs,
): Eip712Payload {
  const { accept, walletAddress, chainId } = args;
  const validBefore = BigInt(
    Math.floor(new Date(accept.expires).getTime() / 1000),
  );
  return {
    domain: {
      name: X402_EIP712_DOMAIN_NAME,
      version: X402_EIP712_DOMAIN_VERSION,
      chainId,
      verifyingContract: accept.asset as `0x${string}`,
    },
    types: X402_EIP712_TYPES,
    primaryType: 'Payment',
    message: {
      from: walletAddress.toLowerCase() as `0x${string}`,
      to: accept.payTo as `0x${string}`,
      value: BigInt(accept.amount),
      validAfter: BigInt(0),
      validBefore,
      reference: referenceToBytes32(accept.reference),
    },
  };
}

export interface BuildSignedEnvelopeArgs {
  accept: X402Accept;
  walletAddress: string;
  /** The signature returned by wagmi's `useSignTypedData` (0x-prefixed hex). */
  signature: `0x${string}`;
  /** Optional override for the `nonce` field; defaults to a timestamp-derived value. */
  nonce?: string;
}

/**
 * Wrap a real signature into the `X402SignaturePayload` envelope the
 * backend expects in the `PAYMENT-SIGNATURE` header.
 */
export function buildSignedEnvelope(
  args: BuildSignedEnvelopeArgs,
): X402SignaturePayload {
  const { accept, walletAddress, signature, nonce } = args;
  return {
    scheme: accept.scheme,
    network: accept.network,
    payload: {
      from: walletAddress.toLowerCase(),
      to: accept.payTo,
      value: accept.amount,
      validAfter: '0',
      validBefore: String(
        Math.floor(new Date(accept.expires).getTime() / 1000),
      ),
      nonce: nonce ?? '0x' + Date.now().toString(16),
      signature,
      reference: accept.reference,
    },
  };
}
