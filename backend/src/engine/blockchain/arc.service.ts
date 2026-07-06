// src/engine/blockchain/arc.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// Production Arc Blockchain Service
//
// Handles anchoring Merkle Roots to Arc L1. In a production environment,
// blockchain interactions are asynchronous and prone to failure (RPC drops,
// gas spikes). Therefore, this service queues transactions as PENDING and 
// relies on a background worker to monitor status and retry.
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from 'ethers';
import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import ApiError from '../../utils/ApiError';
import httpStatus from 'http-status';
import crypto from 'crypto';
import { ITransactionStatus, IBlockchainReceipt } from './interfaces';

export class ArcBlockchainService {
  private provider: ethers.Provider | null = null;
  private wallet: ethers.Wallet | null = null;
  public isMock = true;
  private readonly explorerBaseUrl = process.env.ARC_EXPLORER_URL || 'https://explorer.arc.network/tx/';

  constructor() {
    const rpcUrl = process.env.ARC_RPC_URL;
    const privateKey = process.env.ARC_PRIVATE_KEY;

    if (rpcUrl && privateKey) {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);
        this.isMock = false;
        logger.info(`[ArcBlockchain] Connected to live Arc RPC: ${rpcUrl}`);
      } catch (err: any) {
        logger.warn(`[ArcBlockchain] Failed to connect to RPC. Falling back to Mock. Error: ${err.message}`);
      }
    } else {
      logger.info('[ArcBlockchain] No RPC URL found. Running in MOCK Mode.');
    }
  }

  /**
   * Returns the provider for use by the background worker.
   */
  public getProvider() {
    return this.provider;
  }

  /**
   * Commits the Merkle Root for a specific workflow session.
   * This creates a PENDING transaction that will be executed and monitored
   * by the background worker.
   */
  async commitMerkleRoot(sessionId: string): Promise<{ txId: string; status: string; message: string }> {
    logger.info(`[ArcBlockchain] Committing Merkle root for session ${sessionId}...`);

    const session = await prisma.researchSession.findUnique({
      where: { id: sessionId },
      include: { merkleRoot: true },
    });

    if (!session) throw new ApiError(httpStatus.NOT_FOUND, 'Session not found');
    if (!session.merkleRoot) throw new ApiError(httpStatus.UNPROCESSABLE_ENTITY, 'No Merkle Root found for this session.');

    const existingReceipt = await prisma.blockchainReceipt.findUnique({
      where: { merkleRootId: session.merkleRoot.id },
      include: { transaction: true },
    });

    if (existingReceipt) {
      logger.info(`[ArcBlockchain] Root already queued or anchored. Tx: ${existingReceipt.transaction?.txHash}`);
      return {
        txId: existingReceipt.transaction?.id || '',
        status: existingReceipt.transaction?.status || 'UNKNOWN',
        message: 'Transaction already exists for this Merkle Root.',
      };
    }

    // Sign the rootHash locally to provide cryptographic proof the operator submitted it
    const rootHash = session.merkleRoot.rootHash;
    let signature = '';
    
    if (this.isMock) {
      const mockWallet = ethers.Wallet.createRandom();
      signature = await mockWallet.signMessage(rootHash);
    } else {
      signature = await this.wallet!.signMessage(rootHash);
    }

    // Create the PENDING Transaction record
    const transaction = await prisma.transaction.create({
      data: {
        chain: this.isMock ? 'arc-mock' : 'arc-mainnet',
        status: 'PENDING',
      },
    });

    // Create the BlockchainReceipt linked to the MerkleRoot and the Transaction
    const blockchainReceipt = await prisma.blockchainReceipt.create({
      data: {
        merkleRootId: session.merkleRoot.id,
        signature,
      },
    });

    // Link Transaction back to Receipt
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { receiptId: blockchainReceipt.id },
    });

    logger.info(`[ArcBlockchain] Successfully queued transaction ${transaction.id} for background processing.`);

    return {
      txId: transaction.id,
      status: 'PENDING',
      message: 'Transaction queued. The background worker will anchor it to Arc.',
    };
  }

  /**
   * Retrieves the combined blockchain receipt for a given session.
   */
  async getReceipt(workflowId: string): Promise<IBlockchainReceipt> {
    const session = await prisma.researchSession.findUnique({
      where: { id: workflowId },
      include: { 
        merkleRoot: {
          include: {
            blockchainReceipt: {
              include: { transaction: true }
            }
          }
        } 
      },
    });

    if (!session || !session.merkleRoot || !session.merkleRoot.blockchainReceipt) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Blockchain receipt not found for this workflow');
    }

    const receipt = session.merkleRoot.blockchainReceipt;

    return {
      receiptId: receipt.id,
      workflowId: session.id,
      merkleRoot: session.merkleRoot.rootHash,
      signature: receipt.signature,
      txHash: receipt.transaction?.txHash || undefined,
      status: receipt.transaction?.status,
      blockNumber: receipt.transaction?.blockNumber || undefined,
      explorerUrl: receipt.transaction?.explorerUrl || undefined,
      timestamp: receipt.createdAt,
    };
  }

  /**
   * Checks the status of a specific transaction by its internal ID or TxHash.
   */
  async getTransactionStatus(txHashOrId: string): Promise<ITransactionStatus> {
    const tx = await prisma.transaction.findFirst({
      where: {
        OR: [
          { txHash: txHashOrId },
          { id: txHashOrId }
        ]
      }
    });

    if (!tx) throw new ApiError(httpStatus.NOT_FOUND, 'Transaction not found');

    return {
      txHash: tx.txHash || tx.id,
      status: tx.status as any,
      blockNumber: tx.blockNumber || undefined,
      explorerUrl: tx.explorerUrl || undefined,
      chain: tx.chain,
    };
  }

  /**
   * Forces a retry of a failed transaction.
   */
  async retryTransaction(txHashOrId: string): Promise<{ success: boolean; message: string }> {
    const tx = await prisma.transaction.findFirst({
      where: {
        OR: [
          { txHash: txHashOrId },
          { id: txHashOrId }
        ]
      }
    });

    if (!tx) throw new ApiError(httpStatus.NOT_FOUND, 'Transaction not found');
    
    if (tx.status === 'CONFIRMED') {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Transaction is already confirmed and cannot be retried.');
    }

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        status: 'PENDING',
        retryCount: 0,
        lastError: null,
      }
    });

    logger.info(`[ArcBlockchain] Transaction ${tx.id} reset to PENDING for retry.`);
    return { success: true, message: 'Transaction queued for retry.' };
  }

  /**
   * Internal method used by the worker to actually execute the transaction.
   */
  async executeTransactionOnChain(rootHash: string): Promise<{ txHash: string; blockNumber?: number }> {
    if (this.isMock) {
      const mockTxHash = '0x' + crypto.randomBytes(32).toString('hex');
      const mockBlockNumber = Math.floor(Math.random() * 10000000) + 1000000;
      return { txHash: mockTxHash, blockNumber: mockBlockNumber };
    }

    if (!this.wallet || !this.provider) throw new Error('Wallet or Provider not initialized');

    const abi = ['function recordReceipt(bytes32 rootHash) external'];
    const contractAddress = process.env.ARC_REGISTRY_ADDRESS || ethers.ZeroAddress;
    
    const contract = new ethers.Contract(contractAddress, abi, this.wallet);
    const bytes32Root = rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`;
    
    const tx = await contract.recordReceipt(bytes32Root);
    const receipt = await tx.wait(1); 
    
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }

  /**
   * Internal method used by the worker to verify tx status.
   */
  async verifyTxOnChain(txHash: string): Promise<{ isConfirmed: boolean; blockNumber?: number }> {
    if (this.isMock) return { isConfirmed: true, blockNumber: Math.floor(Math.random() * 10000000) + 1000000 };
    if (!this.provider) throw new Error('Provider not initialized');

    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return { isConfirmed: false };

    return { 
      isConfirmed: receipt.status === 1, 
      blockNumber: receipt.blockNumber 
    };
  }

  public getExplorerUrl(txHash: string): string {
    return `${this.explorerBaseUrl}${txHash}`;
  }
}

export const arcBlockchainService = new ArcBlockchainService();
