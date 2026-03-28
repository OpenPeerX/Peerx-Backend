import { Test, TestingModule }  from '@nestjs/testing';
import { ReferralService }      from '../referral.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken }   from '@nestjs/typeorm';
import { DataSource }           from 'typeorm';

const mockRepo = (overrides = {}) => ({
  findOne: jest.fn(),
  count:   jest.fn().mockResolvedValue(0),
  create:  jest.fn((x) => x),
  save:    jest.fn(),
  ...overrides,
});

const mockDataSource = {
  transaction: jest.fn(async (cb) => cb({
    create: jest.fn((_, x) => x),
    save:   jest.fn(),
  })),
};

describe('ReferralService', () => {
  let service: ReferralService;
  let referralRepo: any;
  let waitlistRepo: any;

  beforeEach(async () => {
    referralRepo = mockRepo();
    waitlistRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: getRepositoryToken('waitlist_referrals'),      useValue: referralRepo },
        { provide: getRepositoryToken('waitlist_referral_points'), useValue: mockRepo()  },
        { provide: getRepositoryToken('waitlist_entries'),         useValue: waitlistRepo },
        { provide: DataSource,                                     useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  it('blocks self-referral', async () => {
    waitlistRepo.findOne
      .mockResolvedValueOnce({ id: 'user-1', status: 'verified', referral_code: 'CODE1' })
      .mockResolvedValueOnce({ id: 'user-1', referral_code: 'CODE1' });

    await expect(
      service.processReferralCallback('user-1', 'CODE1', '1.2.3.4'),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks duplicate attribution', async () => {
    waitlistRepo.findOne
      .mockResolvedValueOnce({ id: 'user-2', status: 'verified' })
      .mockResolvedValueOnce({ id: 'user-1' });
    referralRepo.findOne.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.processReferralCallback('user-2', 'CODE1', '1.2.3.4'),
    ).rejects.toThrow(ConflictException);
  });

  it('awards point on clean referral', async () => {
    waitlistRepo.findOne
      .mockResolvedValueOnce({ id: 'user-2', status: 'verified', email: 'a@example.com' })
      .mockResolvedValueOnce({ id: 'user-1' });
    referralRepo.findOne.mockResolvedValueOnce(null);
    referralRepo.count.mockResolvedValue(0);
    waitlistRepo.count.mockResolvedValue(0);

    const result = await service.processReferralCallback('user-2', 'CODE1', '1.2.3.4');
    expect(result.success).toBe(true);
    expect(mockDataSource.transaction).toHaveBeenCalled();
  });

  it('flags high-fraud-score referrals', async () => {
    waitlistRepo.count.mockResolvedValue(15);
    const score = await service.computeFraudScore('ref-1', 'bot@suspicious.com', '9.9.9.9');
    expect(score).toBeGreaterThanOrEqual(40);
  });

  it('rejects unverified referee', async () => {
    waitlistRepo.findOne
      .mockResolvedValueOnce({ id: 'user-2', status: 'pending' })
      .mockResolvedValueOnce({ id: 'user-1' });

    await expect(
      service.processReferralCallback('user-2', 'CODE1', '1.2.3.4'),
    ).rejects.toThrow(BadRequestException);
  });
});
