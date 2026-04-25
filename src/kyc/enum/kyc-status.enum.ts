export enum KycStatus {
  PENDING = 'Pending',
  IN_REVIEW = 'InReview',
  VERIFIED = 'Verified',
  REJECTED = 'Rejected',
}

export const TERMINAL_STATES = new Set<KycStatus>([
  KycStatus.VERIFIED,
  KycStatus.REJECTED,
]);

/**
 * KYC Finite State Machine Transition Map
 *
 * Pending → InReview → Verified
 *                    → Rejected
 *
 * Terminal states (Verified, Rejected) are IMMUTABLE
 * except via governance-approved override flow.
 */
export const ALLOWED_TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  [KycStatus.PENDING]: [KycStatus.IN_REVIEW],
  [KycStatus.IN_REVIEW]: [KycStatus.VERIFIED, KycStatus.REJECTED],
  [KycStatus.VERIFIED]: [], // Terminal — no transitions allowed
  [KycStatus.REJECTED]: [], // Terminal — no transitions allowed
};
