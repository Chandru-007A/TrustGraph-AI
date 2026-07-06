// frontend/lib/api/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Public API service barrel. Always import from `@/lib/api` rather than
// reaching into individual files.
// ─────────────────────────────────────────────────────────────────────────────

export { default as apiClient } from './client';
export { authService } from './auth.service';
export { workflowService } from './workflow.service';
export { walletService } from './wallet.service';
export { paymentService } from './payment.service';
export { paymentCenterService } from './payment-center.service';
export { gatewayService } from './gateway.service';
export { receiptService } from './receipt.service';
export { verifyService } from './verify.service';
export { explainService } from './explain.service';
export { adminService } from './admin.service';
export { tokenStorage } from './token-storage';
export type {
  ApiResponse,
  ApiErrorBody,
  AuthToken,
  AuthTokens,
  User,
  UserRole,
  UserWallet,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshResponse,
} from './types';
export type { LinkWalletPayload } from './wallet.service';
export type {
  PaymentEntitlementRow,
  PaymentEntitlementStatus,
} from './payment.service';
export type {
  PaymentStats,
  PaymentAnalytics,
  PaymentHistoryItem,
  PaymentCenterDetail,
  GetHistoryParams,
} from './payment-center.service';
export type {
  ReceiptRow,
  ReceiptDetail,
  ReceiptTimeline,
  BlockchainAnchor,
  ReceiptsListResponse,
  ReceiptsListParams,
  ReceiptVerificationStatus,
} from './receipt.service';
export type {
  MerkleProofStep,
  NodeVerificationResult,
  ProofVerificationResult,
  WorkflowIntegrityReport,
  MerkleTreeData,
  StoredMerkleProof,
  VerificationListItem,
  VerificationListResponse,
  VerificationDetail,
} from './verify.service';

export type {
  ExplainabilityReport,
  ExplainNode,
} from './explain.service';

export type {
  GatewayBalanceSnapshot,
  GatewayChainBalance,
  GatewayStatus,
  GatewayToken,
  GetBalanceOptions,
} from './gateway.service';
export type {
  SessionStatus,
  PaymentStatus,
  VerificationStatus,
  WorkflowSession,
  Pagination,
  WorkflowSessionsResponse,
  WorkflowStats,
  BlockchainStatus,
  StartWorkflowRequest,
  StartWorkflowResponse,
  NodeStatus,
  WorkflowNode,
  WorkflowMerkleRoot,
  WorkflowSessionDetail,
} from './workflow.types';
