// src/engine/blockchain/adapters/MockReceiptRegistryAdapter.ts

import { IReceiptRegistryAdapter } from './IReceiptRegistryAdapter';
import { ethers } from 'ethers';
import crypto from 'crypto';
import logger from '../../../utils/logger';

export class MockReceiptRegistryAdapter implements IReceiptRegistryAdapter {
  private contractAddress: string;
  private onRegisteredCb?: (rootHash: string, txHash: string, blockNumber: number) => void;
  private onVerifiedCb?: (rootHash: string, txHash: string, blockNumber: number) => void;
  
  constructor() {
    this.contractAddress = process.env.RECEIPT_REGISTRY_ADDRESS || '0xMockReceiptRegistryV2Address000000000000';
    logger.info(`[MockAdapter] Initialized Mock Adapter for ${this.contractAddress}`);
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  async registerMerkleRoot(rootHash: string): Promise<{ txHash: string; blockNumber?: number }> {
    logger.info(`[MockAdapter] Simulating registration for root: ${rootHash}`);
    
    // Simulate network delay
    await new Promise(res => setTimeout(res, 1500));

    const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');
    const mockBlockNumber = Math.floor(Math.random() * 10000000) + 1000000;

    // Simulate emitting an event if listeners are attached
    if (this.onRegisteredCb) {
      setTimeout(() => {
        this.onRegisteredCb!(rootHash, mockTxHash, mockBlockNumber);
      }, 500);
    }

    return { txHash: mockTxHash, blockNumber: mockBlockNumber };
  }

  async verifyReceipt(rootHash: string): Promise<boolean> {
    logger.info(`[MockAdapter] Simulating verification for root: ${rootHash}`);
    await new Promise(res => setTimeout(res, 800));
    
    const isValid = true; // In a mock, we always say it's valid if it exists
    
    if (this.onVerifiedCb && isValid) {
      const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');
      const mockBlockNumber = Math.floor(Math.random() * 10000000) + 1000000;
      setTimeout(() => {
        this.onVerifiedCb!(rootHash, mockTxHash, mockBlockNumber);
      }, 500);
    }

    return isValid;
  }

  listenForEvents(
    onRegistered: (rootHash: string, txHash: string, blockNumber: number) => void,
    onVerified: (rootHash: string, txHash: string, blockNumber: number) => void
  ): void {
    logger.info(`[MockAdapter] Listeners attached for ReceiptRegistered and ReceiptVerified.`);
    this.onRegisteredCb = onRegistered;
    this.onVerifiedCb = onVerified;
  }

  disconnect(): void {
    logger.info(`[MockAdapter] Disconnected.`);
    this.onRegisteredCb = undefined;
    this.onVerifiedCb = undefined;
  }
}
