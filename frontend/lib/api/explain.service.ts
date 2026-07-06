// frontend/lib/api/explain.service.ts
import apiClient from './client';

export interface ExplainNode {
  nodeId: string;
  nodeName: string;
  agentDid: string;
  prompt: string | null;
  output: string | null;
  confidence: number | null;
  executionTime: number;
  status: string;
  parentNodes: string[];
  childNodes: string[];
  hashes: { type: string; hashValue: string }[];
  merkleProofAvailable: boolean;
  blockchainReceiptAvailable: boolean;
  evidence: { source: string; url: string; confidence: number; timestamp: string }[];
}

export interface ExplainabilityReport {
  session: {
    id: string;
    status: string;
    totalCost: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
  };
  workflow: {
    nodeCount: number;
    completedCount: number;
    executionTimeMs: number;
  };
  nodes: ExplainNode[];
  merkle: {
    rootHash: string | null;
    leafCount: number;
    depth: number;
    generationMs: number;
    leaves: string[];
    proofs: {
      nodeId: string;
      leafHash: string;
      proof: any;
      isValid: boolean;
    }[];
  } | null;
  blockchain: {
    receiptId: string;
    onChainId: string | null;
    signature: string;
    contract: string | null;
    status: string;
  } | null;
  verification: {
    isValid: boolean;
    durationMs: number;
    verifiedAt: string;
    logs: any[];
  } | null;
}

class ExplainService {
  async getReport(sessionId: string): Promise<ExplainabilityReport> {
    const res = await apiClient.get<ExplainabilityReport>(`/explain/${sessionId}`);
    return res.data;
  }
}

export const explainService = new ExplainService();
