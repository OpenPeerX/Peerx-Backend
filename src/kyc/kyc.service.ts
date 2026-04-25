import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { KycStateMachineService } from './kyc-state-machine.service';
import { KycRole } from './enum/kyc-role.enum';
import { KycRecord } from './entities/kyc-records.entity';
import { KycStatus } from './enum/kyc-status.enum';

export interface AuthenticatedOperator {
  id: number;
  roles: KycRole[];
}

@Injectable()
export class KycService {
  constructor(
    @InjectRepository(KycRecord)
    private readonly kycRepo: Repository<KycRecord>,
    private readonly dataSource: DataSource,
    private readonly stateMachine: KycStateMachineService,
  ) {}

  // ─── Operator-controlled transitions ──────────────────────────────────────

  async updateStatus(
    targetUserId: number,
    nextStatus: KycStatus,
    operator: AuthenticatedOperator,
    notes?: string,
  ): Promise<KycRecord> {
    this.enforceOperatorRole(operator);
    this.preventSelfAssignment(operator.id, targetUserId);

    return this.dataSource.transaction(async (manager) => {
      const record = await manager.findOne(KycRecord, {
        where: { userId: targetUserId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!record) {
        throw new NotFoundException(
          `KYC record not found for user ${targetUserId}.`,
        );
      }

      // Enforce FSM — throws ForbiddenException for illegal transitions
      this.stateMachine.validateTransition(record.status, nextStatus);

      record.status = nextStatus;
      record.reviewedBy = String(operator.id);
      record.notes = notes ?? record.notes;

      return manager.save(KycRecord, record);
    });
  }

  // ─── Governance override (terminal state mutation) ─────────────────────────

  async governanceOverride(
    targetUserId: number,
    nextStatus: KycStatus,
    governance: AuthenticatedOperator,
    notes: string,
  ): Promise<KycRecord> {
    if (!governance.roles.includes(KycRole.KYC_GOVERNANCE)) {
      throw new ForbiddenException(
        'Only KYC_GOVERNANCE role can override terminal states.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const record = await manager.findOne(KycRecord, {
        where: { userId: targetUserId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!record) {
        throw new NotFoundException(
          `KYC record not found for user ${targetUserId}.`,
        );
      }

      // Governance bypasses FSM guard — but we still require notes
      record.status = nextStatus;
      record.reviewedBy = String(governance.id);
      record.notes = notes;

      return manager.save(KycRecord, record);
    });
  }

  // ─── Read ──────────────────────────────────────────────────────────────────

  async getRecord(userId: number): Promise<KycRecord> {
    const record = await this.kycRepo.findOne({ where: { userId } });
    if (!record) {
      throw new NotFoundException(`KYC record not found for user ${userId}.`);
    }
    return record;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private enforceOperatorRole(operator: AuthenticatedOperator): void {
    if (!operator.roles.includes(KycRole.KYC_OPERATOR)) {
      throw new ForbiddenException(
        'Only KYC_OPERATOR role can update KYC status.',
      );
    }
  }

  private preventSelfAssignment(
    operatorId: number,
    targetUserId: number,
  ): void {
    if (operatorId === targetUserId) {
      throw new ForbiddenException(
        'Self-assignment of KYC status is not permitted.',
      );
    }
  }
}
