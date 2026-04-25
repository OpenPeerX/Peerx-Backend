import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ALLOWED_TRANSITIONS,
  KycStatus,
  TERMINAL_STATES,
} from './enum/kyc-status.enum';

@Injectable()
export class KycStateMachineService {
  /**
   * Validates that a transition from `current` → `next` is allowed.
   * Throws ForbiddenException for terminal states or disallowed moves.
   */
  validateTransition(current: KycStatus, next: KycStatus): void {
    if (TERMINAL_STATES.has(current)) {
      throw new ForbiddenException(
        `KYC status '${current}' is a terminal state and cannot be modified. ` +
          `Use the governance override flow to make changes.`,
      );
    }

    const allowed = ALLOWED_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      throw new ForbiddenException(
        `Invalid KYC state transition: '${current}' → '${next}'. ` +
          `Allowed next states: [${allowed.join(', ') || 'none'}].`,
      );
    }
  }

  isTerminal(status: KycStatus): boolean {
    return TERMINAL_STATES.has(status);
  }

  getAllowedTransitions(status: KycStatus): KycStatus[] {
    return ALLOWED_TRANSITIONS[status] ?? [];
  }
}
