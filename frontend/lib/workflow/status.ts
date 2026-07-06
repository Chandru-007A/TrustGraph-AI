// frontend/lib/workflow/status.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers that derive PaymentStatus and VerificationStatus from a
// session's raw `status` field. Centralised so the table, badges, and
// filter all use the exact same rules.
//
//   PENDING    → unpaid  + pending verification
//   RUNNING    → paid    + pending verification
//   COMPLETED  → paid    + verified
//   FAILED     → refunded + verification failed
//   DISPUTED   → paid    + verification failed
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PaymentStatus,
  SessionStatus,
  VerificationStatus,
  WorkflowSession,
} from '@/lib/api/workflow.types';

export function derivePaymentStatus(status: SessionStatus): PaymentStatus {
  switch (status) {
    case 'PENDING':
      return 'unpaid';
    case 'RUNNING':
    case 'COMPLETED':
    case 'DISPUTED':
      return 'paid';
    case 'FAILED':
      return 'refunded';
  }
}

export function deriveVerificationStatus(status: SessionStatus): VerificationStatus {
  switch (status) {
    case 'PENDING':
    case 'RUNNING':
      return 'pending';
    case 'COMPLETED':
      return 'verified';
    case 'FAILED':
    case 'DISPUTED':
      return 'failed';
  }
}

/** A row in the workflow list, with derived fields pre-computed. */
export interface WorkflowRow extends WorkflowSession {
  paymentStatus: PaymentStatus;
  verificationStatus: VerificationStatus;
}

export function withDerivedStatus(session: WorkflowSession): WorkflowRow {
  return {
    ...session,
    paymentStatus: derivePaymentStatus(session.status),
    verificationStatus: deriveVerificationStatus(session.status),
  };
}

/** A reusable lowercase human label for any of the three status enums. */
export function humanize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}
