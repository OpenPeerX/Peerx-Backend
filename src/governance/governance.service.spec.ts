import { BadRequestException } from '@nestjs/common';
import { GovernanceService } from './governance.service';
import { ProposalStatus } from './entities/governance-proposal.entity';

describe('GovernanceService', () => {
  const createRepository = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
  });

  it('rejects duplicate voting on the same proposal', async () => {
    const proposalRepository = createRepository();
    const voteRepository = createRepository();
    const stakeRepository = createRepository();
    const auditService = { log: jest.fn() };
    const mobileCacheService = { invalidateTag: jest.fn() };

    proposalRepository.findOne.mockResolvedValue({
      id: 'proposal-1',
      status: ProposalStatus.ACTIVE,
      startAt: new Date(Date.now() - 60_000),
      endAt: new Date(Date.now() + 60_000),
    });
    voteRepository.findOne.mockResolvedValue({ id: 'vote-1' });

    const service = new GovernanceService(
      proposalRepository as never,
      voteRepository as never,
      stakeRepository as never,
      auditService as never,
      mobileCacheService as never,
    );

    await expect(
      service.castVote('proposal-1', {
        voterUserId: 7,
        choice: 'YES' as never,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
