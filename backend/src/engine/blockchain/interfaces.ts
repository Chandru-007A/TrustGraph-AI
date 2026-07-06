// src/engine/blockchain/interfaces.ts

export interface ITransactionStatus {
  txHash: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  blockNumber?: number;
  explorerUrl?: string;
  chain: string;
}

export interface IBlockchainReceipt {
  receiptId: string;
  workflowId: string;
  merkleRoot: string;
  signature: string;
  txHash?: string;
  status?: string;
  blockNumber?: number;
  explorerUrl?: string;
  timestamp: Date;
}
