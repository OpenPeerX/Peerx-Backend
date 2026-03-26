import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { LearningLeaderboardService } from '../services/learning-leaderboard.service';
import { LeaderboardQueryDto } from '../dto/leaderboard-query.dto';
import { TutorialCompletionEventDto } from '../dto/leaderboard-response.dto';

@Controller('learning')
export class LearningLeaderboardController {
  constructor(
    private readonly leaderboardService: LearningLeaderboardService,
  ) {}

  /**
   * GET /learning/leaderboard - Get global leaderboard
   */
  @Get('leaderboard')
  async getLeaderboard(@Query() query: LeaderboardQueryDto) {
    const result = await this.leaderboardService.getLeaderboard(query);
    
    return {
      entries: result.entries,
      totalUsers: result.totalUsers,
      timeFrame: query.timeFrame || 'all',
      lastUpdated: new Date(),
    };
  }

  /**
   * GET /learning/leaderboard/top - Get top learners for specific period
   */
  @Get('leaderboard/top')
  async getTopLearners(
    @Query('limit') limit: number = 10,
    @Query('timeFrame') timeFrame: 'week' | 'month' | 'year' = 'week',
  ) {
    return this.leaderboardService.getTopLearners(limit, timeFrame);
  }

  /**
   * GET /learning/profile - Get current user's learning profile
   */
  @Get('profile')
  async getUserProfile(@Req() req) {
    const userId = req.user.id;
    return this.leaderboardService.getUserProfile(userId);
  }

  /**
   * GET /learning/profile/:userId - Get specific user's learning profile
   */
  @Get('profile/:userId')
  async getSpecificUserProfile(@Param('userId') userId: number) {
    return this.leaderboardService.getUserProfile(userId);
  }

  /**
   * GET /learning/rank - Get current user's rank
   */
  @Get('rank')
  async getUserRank(@Req() req) {
    const userId = req.user.id;
    return this.leaderboardService.getUserRank(userId);
  }

  /**
   * POST /learning/tutorial/complete - Record tutorial completion
   */
  @Post('tutorial/complete')
  @HttpCode(HttpStatus.OK)
  async completeTutorial(
    @Req() req,
    @Body() data: TutorialCompletionEventDto,
  ) {
    const userId = req.user.id;
    const profile = await this.leaderboardService.updateTutorialProgress(
      userId,
      data.tutorialId,
      999, // Mark as fully completed
      data.quizScore,
    );

    return {
      message: 'Tutorial completion recorded',
      points: profile.totalPoints,
      tutorialsCompleted: profile.tutorialsCompleted,
      learningLevel: profile.learningLevel,
    };
  }

  /**
   * PATCH /learning/tutorial/progress - Update tutorial progress
   */
  @Patch('tutorial/progress')
  async updateProgress(
    @Req() req,
    @Body('tutorialId') tutorialId: string,
    @Body('step') step: number,
    @Body('quizScore') quizScore?: number,
  ) {
    const userId = req.user.id;
    const profile = await this.leaderboardService.updateTutorialProgress(
      userId,
      tutorialId,
      step,
      quizScore,
    );

    return {
      message: 'Progress updated',
      currentStep: step,
      points: profile.totalPoints,
      isCompleted: step >= 999, // Assuming 999 means completed
    };
  }

  /**
   * POST /learning/badge/:badgeName - Award badge to current user (for gamification)
   */
  @Post('badge/:badgeName')
  @HttpCode(HttpStatus.OK)
  async awardBadge(@Req() req, @Param('badgeName') badgeName: string) {
    const userId = req.user.id;
    const profile = await this.leaderboardService.awardBadge(userId, badgeName);

    return {
      message: `Badge "${badgeName}" awarded`,
      earnedBadges: profile.earnedBadges,
      totalPoints: profile.totalPoints,
    };
  }

  /**
   * GET /learning/stats - Get learning statistics overview
   */
  @Get('stats')
  async getLearningStats() {
    const totalLearners = await this.leaderboardService['learningProfileRepo'].count();
    
    // Get distribution of learning levels
    const allProfiles = await this.leaderboardService['learningProfileRepo'].find({
      select: ['learningLevel'],
    });

    const levelDistribution = allProfiles.reduce((acc, profile) => {
      acc[profile.learningLevel] = (acc[profile.learningLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalLearners,
      levelDistribution,
      lastUpdated: new Date(),
    };
  }

  /**
   * ADMIN: POST /learning/admin/recalculate - Recalculate all profiles
   */
  @Post('admin/recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculateAll() {
    const updatedCount = await this.leaderboardService.recalculateAllProfiles();
    
    return {
      message: 'All profiles recalculated',
      updatedCount,
    };
  }

  /**
   * ADMIN: DELETE /learning/admin/reset - Reset all learning profiles
   */
  @Delete('admin/reset')
  @HttpCode(HttpStatus.OK)
  async resetAll() {
    await this.leaderboardService.resetAllProfiles();
    
    return {
      message: 'All learning profiles have been reset',
    };
  }
}
