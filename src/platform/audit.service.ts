import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditEntry } from './entities/audit-entry.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEntry)
    private readonly auditRepository: Repository<AuditEntry>,
  ) {}

  async log(params: {
    domain: string;
    action: string;
    actorUserId?: number;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<AuditEntry> {
    return this.auditRepository.save(this.auditRepository.create(params));
  }

  async list(domain?: string): Promise<AuditEntry[]> {
    return this.auditRepository.find({
      where: domain ? { domain } : {},
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
