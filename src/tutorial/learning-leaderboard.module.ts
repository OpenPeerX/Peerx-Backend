import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LearningProfile } from './entities/learning-profile.entity';
import { TutorialProgress } from './entities/tutorial-progress.entity';
import { Tutorial } from './entities/tutorial.entity';
import { LearningLeaderboardService } from './services/learning-leaderboard.service';
import { LearningLeaderboardController } from './controllers/learning-leaderboard.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningProfile, TutorialProgress, Tutorial]),
  ],
  providers: [LearningLeaderboardService],
  controllers: [LearningLeaderboardController],
  exports: [LearningLeaderboardService],
})
export class LearningLeaderboardModule {}
