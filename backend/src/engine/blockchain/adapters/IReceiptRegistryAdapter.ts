// src/engine/blockchain/adapters/IReceiptRegistryAdapter.ts

export interface IReceiptRegistryAdapter {
  /**
   * Returns the blockchain address of the contract being interacted with.
   */
  getContractAddress(): string;

  /**
   * Registers a workflow's Merkle root on-chain.
   * Resolves with the Transaction Hash.
   */
  registerMerkleRoot(rootHash: string): Promise<{ txHash: string, blockNumber?: number }>;

  /**
   * Verifies if a specific Merkle root exists and is valid on-chain.
   * Resolves with a boolean indicating validity.
   */
  verifyReceipt(rootHash: string): Promise<boolean>;

  /**
   * Sets up real-time event listeners on the contract.
   */
  listenForEvents(
    onRegistered: (rootHash: string, txHash: string, blockNumber: number) => void,
    onVerified: (rootHash: string, txHash: string, blockNumber: number) => void
  ): void;

  /**
   * Closes the connection and stops listening to events.
   */
  disconnect(): void;
}
