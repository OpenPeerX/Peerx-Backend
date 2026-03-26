import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { LearningProfile, LearningLevel } from '../entities/learning-profile.entity';
import { TutorialProgress } from '../entities/tutorial-progress.entity';
import { Tutorial } from '../entities/tutorial.entity';
import { LeaderboardEntryDto, UserLearningProfileDto } from '../dto/leaderboard-response.dto';
import { LeaderboardQueryDto } from '../dto/leaderboard-query.dto';

@Injectable()
export class LearningLeaderboardService {
  private readonly logger = new Logger(LearningLeaderboardService.name);

  // Points configuration
  private readonly TUTORIAL_COMPLETION_POINTS = 100;
  private readonly QUIZ_SCORE_MULTIPLIER = 0.5; // 0.5 points per quiz score point
  private readonly STREAK_BONUS_POINTS = 10;
  private readonly MODULE_COMPLETION_BONUS = 50;

  constructor(
    @InjectRepository(LearningProfile)
    private learningProfileRepo: Repository<LearningProfile>,
    @InjectRepository(TutorialProgress)
    private tutorialProgressRepo: Repository<TutorialProgress>,
    @InjectRepository(Tutorial)
    private tutorialRepo: Repository<Tutorial>,
  ) {}

  /**
   * Get or create learning profile for a user
   */
  async getOrCreateProfile(userId: number): Promise<LearningProfile> {
    let profile = await this.learningProfileRepo.findOne({ where: { userId } });

    if (!profile) {
      profile = this.learningProfileRepo.create({ userId });
      profile = await this.learningProfileRepo.save(profile);
      this.logger.log(`Created learning profile for user ${userId}`);
    }

    return profile;
  }

  /**
   * Update learning profile when tutorial progress is made
   */
  async updateTutorialProgress(
    userId: number,
    tutorialId: string,
    step: number,
    quizScore?: number,
  ): Promise<LearningProfile> {
    const profile = await this.getOrCreateProfile(userId);
    const tutorial = await this.tutorialRepo.findOne({ where: { id: tutorialId } });

    if (!tutorial) {
      throw new NotFoundException(`Tutorial ${tutorialId} not found`);
    }

    // Check if tutorial is completed
    const isCompleted = step >= tutorial.steps.length;

    if (isCompleted && !profile.completedModules.includes(tutorialId)) {
      // Award points for completion
      profile.totalPoints += this.TUTORIAL_COMPLETION_POINTS;
      profile.tutorialsCompleted += 1;
      profile.completedModules.push(tutorialId);

      // Award quiz score bonus if applicable
      if (quizScore !== undefined) {
        profile.totalQuizScore += quizScore;
        profile.moduleScores[tutorialId] = quizScore;
        profile.totalPoints += Math.floor(quizScore * this.QUIZ_SCORE_MULTIPLIER);
      }

      // Recalculate average quiz score
      const completedCount = profile.completedModules.length;
      profile.averageQuizScore = completedCount > 0 
        ? Math.floor(profile.totalQuizScore / completedCount) 
        : 0;

      // Add module completion bonus
      profile.totalPoints += this.MODULE_COMPLETION_BONUS;

      this.logger.log(
        `User ${userId} completed tutorial ${tutorialId}. Points awarded: ${
          this.TUTORIAL_COMPLETION_POINTS + this.MODULE_COMPLETION_BONUS
        }`,
      );
    }

    // Update streak
    await this.updateStreak(profile);

    // Update learning level
    profile.learningLevel = this.calculateLearningLevel(profile);

    // Update timestamp
    profile.lastCalculatedAt = new Date();

    return this.learningProfileRepo.save(profile);
  }

  /**
   * Update activity streak
   */
  private async updateStreak(profile: LearningProfile): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!profile.lastActivityDate) {
      profile.currentStreak = 1;
      profile.longestStreak = 1;
      profile.consecutiveDays = 1;
    } else {
      const lastActivity = new Date(profile.lastActivityDate);
      lastActivity.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff === 0) {
        // Same day, no change
        return;
      } else if (daysDiff === 1) {
        // Consecutive day
        profile.currentStreak += 1;
        profile.consecutiveDays += 1;
        
        // Award streak bonus points
        if (profile.currentStreak > 1) {
          profile.totalPoints += this.STREAK_BONUS_POINTS;
          this.logger.log(`User ${profile.userId} on ${profile.currentStreak}-day streak!`);
        }
      } else {
        // Streak broken
        profile.currentStreak = 1;
        profile.consecutiveDays = 1;
      }
    }

    profile.longestStreak = Math.max(profile.longestStreak, profile.currentStreak);
    profile.lastActivityDate = today;
  }

  /**
   * Calculate learning level based on total points
   */
  private calculateLearningLevel(profile: LearningProfile): LearningLevel {
    const points = profile.totalPoints;

    if (points >= 5000) return LearningLevel.MASTER;
    if (points >= 3000) return LearningLevel.EXPERT;
    if (points >= 1500) return LearningLevel.ADVANCED;
    if (points >= 500) return LearningLevel.INTERMEDIATE;
    return LearningLevel.BEGINNER;
  }

  /**
   * Get leaderboard with rankings
   */
  async getLeaderboard(query: LeaderboardQueryDto): Promise<{
    entries: LeaderboardEntryDto[];
    totalUsers: number;
  }> {
    const { limit = 100, offset = 0, level, timeFrame } = query;

    // Build query conditions
    const whereConditions: any = {};
    
    if (level) {
      whereConditions.learningLevel = level;
    }

    if (timeFrame && timeFrame !== 'all') {
      const dateRange = this.getDateRange(timeFrame);
      whereConditions.lastCalculatedAt = Between(dateRange.start, dateRange.end);
    }

    // Fetch profiles with ordering
    const [profiles, total] = await this.learningProfileRepo.findAndCount({
      where: whereConditions,
      order: { totalPoints: 'DESC', averageQuizScore: 'DESC' },
      take: limit,
      skip: offset,
    });

    // Map to DTOs with rank
    const entries = profiles.map((profile, index) => 
      this.mapToLeaderboardEntry(profile, offset + index + 1),
    );

    return { entries, totalUsers: total };
  }

  /**
   * Get specific user's learning profile with rank
   */
  async getUserProfile(userId: number): Promise<UserLearningProfileDto> {
    const profile = await this.getOrCreateProfile(userId);
    
    // Calculate user's rank
    const rankResult = await this.getUserRank(userId);

    return this.mapToUserProfileDto(profile, rankResult.rank, rankResult.percentile);
  }

  /**
   * Get user's current rank
   */
  async getUserRank(userId: number): Promise<{ rank: number; percentile: number }> {
    const profile = await this.learningProfileRepo.findOne({ where: { userId } });
    
    if (!profile) {
      return { rank: 0, percentile: 0 };
    }

    // Count users with higher points
    const usersAbove = await this.learningProfileRepo.count({
      where: {
        totalPoints: profile.totalPoints > 0 ? MoreThan(profile.totalPoints) : undefined,
      },
    });

    const totalUsers = await this.learningProfileRepo.count();
    const rank = usersAbove + 1;
    const percentile = totalUsers > 0 ? ((totalUsers - rank) / totalUsers) * 100 : 0;

    return { rank, percentile: Math.round(percentile * 100) / 100 };
  }

  /**
   * Get top learners for a specific period
   */
  async getTopLearners(limit: number = 10, timeFrame: 'week' | 'month' | 'year' = 'week'): Promise<LeaderboardEntryDto[]> {
    const dateRange = this.getDateRange(timeFrame);
    
    const profiles = await this.learningProfileRepo.find({
      where: {
        lastCalculatedAt: Between(dateRange.start, dateRange.end),
      },
      order: { totalPoints: 'DESC' },
      take: limit,
    });

    return profiles.map((profile, index) => 
      this.mapToLeaderboardEntry(profile, index + 1),
    );
  }

  /**
   * Award badge to user's learning profile
   */
  async awardBadge(userId: number, badgeName: string): Promise<LearningProfile> {
    const profile = await this.getOrCreateProfile(userId);

    if (!profile.earnedBadges.includes(badgeName)) {
      profile.earnedBadges.push(badgeName);
      profile.totalPoints += 25; // Bonus points for earning a badge
      
      this.logger.log(`Awarded badge "${badgeName}" to user ${userId}`);
      
      return this.learningProfileRepo.save(profile);
    }

    return profile;
  }

  /**
   * Helper: Map LearningProfile to LeaderboardEntryDto
   */
  private mapToLeaderboardEntry(
    profile: LearningProfile,
    rank: number,
  ): LeaderboardEntryDto {
    return {
      rank,
      userId: profile.userId,
      username: `User_${profile.userId}`, // Will be replaced with actual username
      totalPoints: profile.totalPoints,
      tutorialsCompleted: profile.tutorialsCompleted,
      averageQuizScore: profile.averageQuizScore,
      learningLevel: profile.learningLevel,
      currentStreak: profile.currentStreak,
      earnedBadges: profile.earnedBadges,
    };
  }

  /**
   * Helper: Map LearningProfile to UserLearningProfileDto
   */
  private mapToUserProfileDto(
    profile: LearningProfile,
    rank: number,
    percentile: number,
  ): UserLearningProfileDto {
    return {
      userId: profile.userId,
      username: `User_${profile.userId}`,
      totalPoints: profile.totalPoints,
      tutorialsCompleted: profile.tutorialsCompleted,
      totalQuizScore: profile.totalQuizScore,
      averageQuizScore: profile.averageQuizScore,
      currentStreak: profile.currentStreak,
      longestStreak: profile.longestStreak,
      learningLevel: profile.learningLevel,
      completedModules: profile.completedModules,
      moduleScores: profile.moduleScores,
      earnedBadges: profile.earnedBadges,
      rank,
      percentile,
    };
  }

  /**
   * Helper: Get date range for time frame
   */
  private getDateRange(timeFrame: string): { start: Date; end: Date } {
    const now = new Date();
    let start = new Date(now);

    switch (timeFrame) {
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
    }

    return { start, end: now };
  }

  /**
   * Reset all profiles (for testing/admin purposes)
   */
  async resetAllProfiles(): Promise<void> {
    await this.learningProfileRepo.clear();
    this.logger.log('All learning profiles have been reset');
  }

  /**
   * Recalculate all user profiles
   */
  async recalculateAllProfiles(): Promise<number> {
    const allProgress = await this.tutorialProgressRepo.find({
      where: { isCompleted: true },
      relations: ['tutorial'],
    });

    const userIds = [...new Set(allProgress.map(p => p.userId))];
    let updatedCount = 0;

    for (const userIdStr of userIds) {
      try {
        const userId = typeof userIdStr === 'string' ? parseInt(userIdStr) : userIdStr;
        if (!isNaN(userId)) {
          await this.recalculateUserProfile(userId);
          updatedCount++;
        }
      } catch (error) {
        this.logger.error(`Failed to recalculate profile for user ${userIdStr}: ${error.message}`);
      }
    }

    return updatedCount;
  }

  /**
   * Recalculate a single user's profile from scratch
   */
  private async recalculateUserProfile(userId: number): Promise<LearningProfile> {
    const completedTutorials = await this.tutorialProgressRepo.find({
      where: { userId: String(userId), isCompleted: true },
      relations: ['tutorial'],
    });

    const profile = await this.getOrCreateProfile(userId);
    
    // Reset metrics
    profile.totalPoints = 0;
    profile.tutorialsCompleted = 0;
    profile.totalQuizScore = 0;
    profile.completedModules = [];
    profile.moduleScores = {};

    // Recalculate from completed tutorials
    for (const progress of completedTutorials) {
      if (progress.tutorial) {
        profile.totalPoints += this.TUTORIAL_COMPLETION_POINTS + this.MODULE_COMPLETION_BONUS;
        profile.tutorialsCompleted += 1;
        profile.completedModules.push(progress.tutorial.id);
      }
    }

    // Update derived metrics
    if (profile.completedModules.length > 0) {
      profile.averageQuizScore = Math.floor(profile.totalQuizScore / profile.completedModules.length);
    }

    profile.learningLevel = this.calculateLearningLevel(profile);
    profile.lastCalculatedAt = new Date();

    return this.learningProfileRepo.save(profile);
  }
}
