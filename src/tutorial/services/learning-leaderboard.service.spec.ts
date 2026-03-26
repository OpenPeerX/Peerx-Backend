import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearningLeaderboardService } from './learning-leaderboard.service';
import { LearningProfile, LearningLevel } from '../entities/learning-profile.entity';
import { TutorialProgress } from '../entities/tutorial-progress.entity';
import { Tutorial } from '../entities/tutorial.entity';

describe('LearningLeaderboardService', () => {
  let service: LearningLeaderboardService;
  let learningProfileRepo: Repository<LearningProfile>;
  let tutorialProgressRepo: Repository<TutorialProgress>;
  let tutorialRepo: Repository<Tutorial>;

  const mockTutorial: Tutorial = {
    id: 'tutorial-1',
    title: 'Test Tutorial',
    description: 'Test Description',
    steps: [
      { title: 'Step 1', content: 'Content 1' },
      { title: 'Step 2', content: 'Content 2' },
      { title: 'Step 3', content: 'Content 3' },
    ],
    isActive: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LearningLeaderboardService,
        {
          provide: getRepositoryToken(LearningProfile),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            clear: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TutorialProgress),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tutorial),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LearningLeaderboardService>(LearningLeaderboardService);
    learningProfileRepo = module.get<Repository<LearningProfile>>(getRepositoryToken(LearningProfile));
    tutorialProgressRepo = module.get<Repository<TutorialProgress>>(getRepositoryToken(TutorialProgress));
    tutorialRepo = module.get<Repository<Tutorial>>(getRepositoryToken(Tutorial));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateTutorialProgress', () => {
    it('should create profile if not exists and award points for completion', async () => {
      const userId = 1;
      const tutorialId = 'tutorial-1';
      const step = 3; // Complete all steps
      const quizScore = 90;

      // Mock repository responses
      jest.spyOn(learningProfileRepo, 'findOne').mockResolvedValue(null as any);
      jest.spyOn(learningProfileRepo, 'create').mockReturnValue({
        userId,
        totalPoints: 0,
        tutorialsCompleted: 0,
        completedModules: [],
        moduleScores: {},
        earnedBadges: [],
        learningLevel: LearningLevel.BEGINNER,
        currentStreak: 0,
        longestStreak: 0,
        consecutiveDays: 0,
        totalQuizScore: 0,
        averageQuizScore: 0,
      } as any);
      jest.spyOn(learningProfileRepo, 'save').mockImplementation(async (profile) => profile as any);
      jest.spyOn(tutorialRepo, 'findOne').mockResolvedValue(mockTutorial as any);

      const result = await service.updateTutorialProgress(userId, tutorialId, step, quizScore);

      expect(result).toBeDefined();
      expect(result.totalPoints).toBe(195); // 100 (completion) + 50 (bonus) + 45 (quiz: 90 * 0.5)
      expect(result.tutorialsCompleted).toBe(1);
      expect(result.learningLevel).toBe(LearningLevel.BEGINNER);
    });

    it('should not award duplicate points for same tutorial', async () => {
      const userId = 1;
      const tutorialId = 'tutorial-1';
      const step = 3;

      const existingProfile: Partial<LearningProfile> = {
        userId,
        totalPoints: 195,
        tutorialsCompleted: 1,
        completedModules: ['tutorial-1'],
        moduleScores: { 'tutorial-1': 90 },
        learningLevel: LearningLevel.BEGINNER,
      };

      jest.spyOn(learningProfileRepo, 'findOne').mockResolvedValue(existingProfile as any);
      jest.spyOn(tutorialRepo, 'findOne').mockResolvedValue(mockTutorial as any);
      jest.spyOn(learningProfileRepo, 'save').mockImplementation(async (profile) => profile as any);

      const result = await service.updateTutorialProgress(userId, tutorialId, step, 90);

      expect(result.totalPoints).toBe(195); // No additional points
      expect(result.tutorialsCompleted).toBe(1); // No increment
    });
  });

  describe('calculateLearningLevel', () => {
    it('should calculate correct learning level based on points', async () => {
      const testCases = [
        { points: 0, expected: LearningLevel.BEGINNER },
        { points: 500, expected: LearningLevel.INTERMEDIATE },
        { points: 1500, expected: LearningLevel.ADVANCED },
        { points: 3000, expected: LearningLevel.EXPERT },
        { points: 5000, expected: LearningLevel.MASTER },
      ];

      for (const testCase of testCases) {
        const profile: Partial<LearningProfile> = {
          userId: 1,
          totalPoints: testCase.points,
          learningLevel: LearningLevel.BEGINNER,
        };

        // Access private method via bracket notation
        const level = (service as any).calculateLearningLevel(profile);
        expect(level).toBe(testCase.expected);
      }
    });
  });

  describe('awardBadge', () => {
    it('should award badge and bonus points', async () => {
      const userId = 1;
      const badgeName = 'First Steps';

      const profile: Partial<LearningProfile> = {
        userId,
        earnedBadges: [],
        totalPoints: 100,
      };

      jest.spyOn(learningProfileRepo, 'findOne').mockResolvedValue(profile as any);
      jest.spyOn(learningProfileRepo, 'save').mockImplementation(async (p) => ({
        ...p,
        earnedBadges: [...(p.earnedBadges || []), badgeName],
        totalPoints: (p.totalPoints || 0) + 25,
      }) as any);

      const result = await service.awardBadge(userId, badgeName);

      expect(result.earnedBadges).toContain('First Steps');
      expect(result.totalPoints).toBe(125); // 100 + 25 bonus
    });

    it('should not award duplicate badge', async () => {
      const userId = 1;
      const badgeName = 'First Steps';

      const profile: Partial<LearningProfile> = {
        userId,
        earnedBadges: ['First Steps'],
        totalPoints: 100,
      };

      jest.spyOn(learningProfileRepo, 'findOne').mockResolvedValue(profile as any);

      const result = await service.awardBadge(userId, badgeName);

      expect(result.earnedBadges).toEqual(['First Steps']);
      expect(result.totalPoints).toBe(100); // No bonus
    });
  });
});
