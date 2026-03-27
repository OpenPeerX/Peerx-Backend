import { LearningLevel } from '../entities/learning-profile.entity';

export class LeaderboardEntryDto {
  rank: number;
  userId: number;
  username: string;
  totalPoints: number;
  tutorialsCompleted: number;
  averageQuizScore: number;
  learningLevel: LearningLevel;
  currentStreak: number;
  earnedBadges: string[];
  changeInRank?: number;
}

export class UserLearningProfileDto {
  userId: number;
  username: string;
  totalPoints: number;
  tutorialsCompleted: number;
  totalQuizScore: number;
  averageQuizScore: number;
  currentStreak: number;
  longestStreak: number;
  learningLevel: LearningLevel;
  completedModules: string[];
  moduleScores: Record<string, number>;
  earnedBadges: string[];
  rank?: number;
  percentile?: number;
}

export class LeaderboardResponseDto {
  entries: LeaderboardEntryDto[];
  totalUsers: number;
  userRank?: LeaderboardEntryDto;
  timeFrame: string;
  lastUpdated: Date;
}

export class LearningProgressUpdateDto {
  tutorialId: string;
  step: number;
  quizScore?: number;
  isCompleted?: boolean;
}

export class TutorialCompletionEventDto {
  tutorialId: string;
  quizScore?: number;
  completionTime: Date;
}
