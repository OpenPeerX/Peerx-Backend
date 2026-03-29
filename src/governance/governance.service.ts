import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../platform/audit.service';
import { MobileCacheService } from '../platform/mobile-cache.service';
import { GovernanceProposal, ProposalStatus } from './entities/governance-proposal.entity';
import { GovernanceStake } from './entities/governance-stake.entity';
import { GovernanceVote, VoteChoice } from './entities/governance-vote.entity';
import { CreateGovernanceProposalDto } from './dto/create-governance-proposal.dto';
import { CastVoteDto } from './dto/cast-vote.dto';
import { UpsertGovernanceStakeDto } from './dto/upsert-governance-stake.dto';

@Injectable()
export class GovernanceService {
  constructor(
    @InjectRepository(GovernanceProposal)
    private readonly proposalRepository: Repository<GovernanceProposal>,
    @InjectRepository(GovernanceVote)
    private readonly voteRepository: Repository<GovernanceVote>,
    @InjectRepository(GovernanceStake)
    private readonly stakeRepository: Repository<GovernanceStake>,
    private readonly auditService: AuditService,
    private readonly mobileCacheService: MobileCacheService,
  ) {}

  async upsertStake(dto: UpsertGovernanceStakeDto): Promise<GovernanceStake> {
    const existing = await this.stakeRepository.findOne({ where: { userId: dto.userId } });
    const stake = existing ?? this.stakeRepository.create({ userId: dto.userId });
    stake.stakedAmount = dto.stakedAmount;
    const saved = await this.stakeRepository.save(stake);
    await this.auditService.log({
      domain: 'governance',
      action: 'stake.updated',
      actorUserId: dto.userId,
      entityId: saved.id,
      metadata: { stakedAmount: dto.stakedAmount },
    });
    this.invalidateCaches(dto.userId);
    return saved;
  }

  async createProposal(dto: CreateGovernanceProposalDto): Promise<GovernanceProposal> {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be later than startAt');
    }
    const proposal = this.proposalRepository.create({
      title: dto.title,
      description: dto.description,
      proposerUserId: dto.proposerUserId,
      startAt,
      endAt,
      snapshotAt: startAt,
      quorumThreshold: dto.quorumThreshold,
      executable: dto.executable,
      status: ProposalStatus.ACTIVE,
    });
    const saved = await this.proposalRepository.save(proposal);
    await this.auditService.log({
      domain: 'governance',
      action: 'proposal.created',
      actorUserId: dto.proposerUserId,
      entityId: saved.id,
      metadata: { title: saved.title, snapshotAt: saved.snapshotAt.toISOString() },
    });
    this.invalidateCaches(dto.proposerUserId);
    return saved;
  }

  async castVote(proposalId: string, dto: CastVoteDto): Promise<GovernanceVote> {
    const proposal = await this.getProposalOrThrow(proposalId);
    this.assertProposalOpen(proposal);

    const priorVote = await this.voteRepository.findOne({
      where: { proposalId, voterUserId: dto.voterUserId },
    });
    if (priorVote) {
      throw new BadRequestException('User has already voted on this proposal');
    }

    const stake = await this.stakeRepository.findOne({ where: { userId: dto.voterUserId } });
    const votingPower = Number(stake?.stakedAmount ?? 0);
    if (votingPower <= 0) {
      throw new BadRequestException('Voting power is zero at proposal snapshot');
    }

    const vote = await this.voteRepository.save(
      this.voteRepository.create({
        proposalId,
        voterUserId: dto.voterUserId,
        choice: dto.choice,
        votingPower,
        idempotencyKey: dto.idempotencyKey,
      }),
    );

    await this.recomputeProposalTallies(proposal);
    await this.auditService.log({
      domain: 'governance',
      action: 'vote.cast',
      actorUserId: dto.voterUserId,
      entityId: proposalId,
      metadata: { choice: dto.choice, votingPower },
    });
    this.invalidateCaches(dto.voterUserId);
    return vote;
  }

  async tallyProposal(proposalId: string): Promise<GovernanceProposal> {
    const proposal = await this.getProposalOrThrow(proposalId);
    await this.recomputeProposalTallies(proposal);

    const totalParticipation =
      Number(proposal.yesPower) + Number(proposal.noPower) + Number(proposal.abstainPower);
    const passed =
      totalParticipation >= Number(proposal.quorumThreshold) &&
      Number(proposal.yesPower) > Number(proposal.noPower);

    proposal.status = passed ? ProposalStatus.SUCCEEDED : ProposalStatus.DEFEATED;
    const saved = await this.proposalRepository.save(proposal);

    await this.auditService.log({
      domain: 'governance',
      action: 'proposal.tallied',
      entityId: proposalId,
      metadata: {
        passed,
        totalParticipation,
        yesPower: proposal.yesPower,
        noPower: proposal.noPower,
      },
    });

    this.invalidateCaches();
    return saved;
  }

  async executeProposal(proposalId: string): Promise<GovernanceProposal> {
    const proposal = await this.getProposalOrThrow(proposalId);
    if (proposal.status !== ProposalStatus.SUCCEEDED) {
      throw new BadRequestException('Only succeeded proposals can be executed');
    }
    proposal.status = ProposalStatus.EXECUTED;
    proposal.executedAt = new Date();
    proposal.executionResult = {
      enacted: true,
      executedAt: proposal.executedAt.toISOString(),
      hook: 'internal-protocol-update',
    };
    const saved = await this.proposalRepository.save(proposal);
    await this.auditService.log({
      domain: 'governance',
      action: 'proposal.executed',
      entityId: proposalId,
      metadata: saved.executionResult,
    });
    this.invalidateCaches();
    return saved;
  }

  async getProposal(proposalId: string) {
    const proposal = await this.getProposalOrThrow(proposalId);
    const votes = await this.voteRepository.find({
      where: { proposalId },
      order: { createdAt: 'ASC' },
    });
    return {
      ...proposal,
      votes,
      totalParticipation:
        Number(proposal.yesPower) + Number(proposal.noPower) + Number(proposal.abstainPower),
    };
  }

  async listProposals() {
    const proposals = await this.proposalRepository.find({
      order: { createdAt: 'DESC' },
    });
    return Promise.all(proposals.map((proposal) => this.getProposal(proposal.id)));
  }

  async getVoteStatus(proposalId: string) {
    const proposal = await this.getProposal(proposalId);
    return {
      proposalId,
      title: proposal.title,
      status: proposal.status,
      progress: {
        yesPower: Number(proposal.yesPower),
        noPower: Number(proposal.noPower),
        abstainPower: Number(proposal.abstainPower),
        quorumThreshold: Number(proposal.quorumThreshold),
      },
      executable: proposal.executable,
      executedAt: proposal.executedAt ?? null,
    };
  }

  private async getProposalOrThrow(proposalId: string): Promise<GovernanceProposal> {
    const proposal = await this.proposalRepository.findOne({ where: { id: proposalId } });
    if (!proposal) {
      throw new NotFoundException(`Proposal ${proposalId} not found`);
    }
    return proposal;
  }

  private assertProposalOpen(proposal: GovernanceProposal): void {
    const now = new Date();
    if (proposal.status !== ProposalStatus.ACTIVE) {
      throw new BadRequestException('Proposal is not active');
    }
    if (now < proposal.startAt || now > proposal.endAt) {
      throw new BadRequestException('Proposal is outside its voting window');
    }
  }

  private async recomputeProposalTallies(proposal: GovernanceProposal): Promise<void> {
    const votes = await this.voteRepository.find({ where: { proposalId: proposal.id } });
    proposal.yesPower = this.sumVotes(votes, VoteChoice.YES);
    proposal.noPower = this.sumVotes(votes, VoteChoice.NO);
    proposal.abstainPower = this.sumVotes(votes, VoteChoice.ABSTAIN);
    await this.proposalRepository.save(proposal);
  }

  private sumVotes(votes: GovernanceVote[], choice: VoteChoice): number {
    return votes
      .filter((vote) => vote.choice === choice)
      .reduce((sum, vote) => sum + Number(vote.votingPower), 0);
  }

  private invalidateCaches(userId?: number): void {
    this.mobileCacheService.invalidateTag('mobile-dashboard');
    if (userId !== undefined) {
      this.mobileCacheService.invalidateTag(`mobile-user:${userId}`);
    }
  }
}
