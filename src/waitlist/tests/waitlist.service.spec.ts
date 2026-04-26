import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistService } from '../waitlist.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { WaitlistUser, WaitlistStatus, WaitlistType } from '../entities/waitlist-user.entity';
import { WaitlistVerificationToken } from '../entities/waitlist-verification-token.entity';
import { User } from '../../user/entities/user.entity';
import { NotificationService } from '../../notification/notification.service';

const mockQB = {
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
};

const mockRepo = <T>(overrides = {}) => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((x) => x),
  count: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(() => mockQB),
  ...overrides,
});

const mockDS = {
  query: jest.fn().mockResolvedValue([]),
  transaction: jest.fn(async (cb) => cb({
    update: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  })),
};

const mockNotificationService = {
  send: jest.fn().mockResolvedValue({ success: true }),
};

describe('WaitlistService', () => {
  let service: WaitlistService;
  let waitlistRepo: any;
  let tokenRepo: any;
  let userRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    waitlistRepo = mockRepo<WaitlistUser>();
    tokenRepo = mockRepo<WaitlistVerificationToken>();
    userRepo = mockRepo<User>();
    dataSource = mockDS;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: getRepositoryToken(WaitlistUser), useValue: waitlistRepo },
        { provide: getRepositoryToken(WaitlistVerificationToken), useValue: tokenRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  describe('signup', () => {
    it('successfully signs up a new user', async () => {
      waitlistRepo.findOne.mockResolvedValue(null);
      const result = await service.signup('test@example.com', 'Test User');
      
      expect(result.success).toBe(true);
      expect(waitlistRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'test@example.com',
        type: WaitlistType.PLATFORM,
      }));
      expect(waitlistRepo.save).toHaveBeenCalled();
    });

    it('throws ConflictException if already registered and verified', async () => {
      waitlistRepo.findOne.mockResolvedValue({ status: WaitlistStatus.VERIFIED });
      await expect(service.signup('test@example.com')).rejects.toThrow(ConflictException);
    });
  });

  describe('premium waitlist (#336)', () => {
    it('joins premium waitlist and returns position', async () => {
      waitlistRepo.findOne.mockResolvedValue(null);
      waitlistRepo.count.mockResolvedValue(15);
      
      const result = await service.joinPremiumWaitlist('vip@example.com', 'NewFeature', 'pro');
      
      expect(result.success).toBe(true);
      expect(result.position).toBe(15);
      expect(waitlistRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        targetId: 'premium:NewFeature:pro',
      }));
    });

    it('unlocks premium access for user', async () => {
      const entry = { id: 'e1', email: 'user@example.com', type: WaitlistType.PREMIUM_FEATURE, targetId: 'premium:feat' };
      const user = { email: 'user@example.com', isPremium: false };
      
      waitlistRepo.findOne.mockResolvedValue(entry);
      userRepo.findOne.mockResolvedValue(user);
      
      const result = await service.unlockPremiumAccess('e1', 'admin-1');
      
      expect(result.success).toBe(true);
      expect(userRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isPremium: true }));
      expect(mockNotificationService.send).toHaveBeenCalled();
    });
  });

  describe('asset pair waitlist (#333)', () => {
    it('votes for an asset pair', async () => {
      waitlistRepo.findOne.mockResolvedValue(null);
      waitlistRepo.count.mockResolvedValue(10);
      
      const result = await service.joinAssetPairWaitlist('voter@example.com', 'SOL-USD');
      
      expect(result.success).toBe(true);
      expect(result.votes).toBe(10);
      expect(result.thresholdMet).toBe(false);
    });

    it('triggers launch notification when threshold met', async () => {
      waitlistRepo.findOne.mockResolvedValue(null);
      waitlistRepo.count.mockResolvedValue(51); // Above ASSET_PAIR_LAUNCH_THRESHOLD (50)
      waitlistRepo.find.mockResolvedValue([{ email: 'user@example.com' }]);
      
      const result = await service.joinAssetPairWaitlist('trigger@example.com', 'BTC-SOL');
      
      expect(result.thresholdMet).toBe(true);
      expect(mockNotificationService.send).toHaveBeenCalled();
    });
  });
});
