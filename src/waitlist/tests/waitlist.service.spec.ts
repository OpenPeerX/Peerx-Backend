import { Test, TestingModule } from '@nestjs/testing';
import { WaitlistService }     from '../waitlist.service';
import { NotFoundException }   from '@nestjs/common';
import { getRepositoryToken }  from '@nestjs/typeorm';
import { DataSource }          from 'typeorm';

const mockQB = {
  orderBy:        jest.fn().mockReturnThis(),
  skip:           jest.fn().mockReturnThis(),
  take:           jest.fn().mockReturnThis(),
  andWhere:       jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
};

const mockRepo = (overrides = {}) => ({
  findOne:            jest.fn(),
  save:               jest.fn(),
  create:             jest.fn((x) => x),
  createQueryBuilder: jest.fn(() => mockQB),
  ...overrides,
});

const mockDS = { query: jest.fn().mockResolvedValue([]) };

describe('WaitlistService', () => {
  let service: WaitlistService;
  let repo: any;

  beforeEach(async () => {
    repo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: getRepositoryToken('waitlist_entries'), useValue: repo },
        { provide: DataSource,                             useValue: mockDS },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
  });

  it('returns paginated waitlist', async () => {
    const result = await service.findAll({ page: 1, limit: 10 });
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('totalPages');
  });

  it('throws NotFoundException for missing invite target', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.invite('bad-id', 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('updates status correctly', async () => {
    const entry = { id: 'e1', status: 'pending' };
    repo.findOne.mockResolvedValueOnce(entry);
    await service.patchStatus('e1', { status: 'invited' as any }, 'admin-1');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'invited' }));
  });

  it('queries leaderboard from materialized view', async () => {
    await service.getLeaderboard(10);
    expect(mockDS.query).toHaveBeenCalledWith(expect.stringContaining('waitlist_leaderboard'), [10]);
  });
});
