import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tutorial } from './entities/tutorial.entity';
import { TutorialProgress } from './entities/tutorial-progress.entity';
import { LearningLeaderboardService } from './services/learning-leaderboard.service';

@Injectable()
export class TutorialService {
  constructor(
    @InjectRepository(Tutorial) private tutorialRepo: Repository<Tutorial>,
    @InjectRepository(TutorialProgress) private progressRepo: Repository<TutorialProgress>,
    private leaderboardService: LearningLeaderboardService,
  ) {}

  async findAll() {
    return this.tutorialRepo.find({ where: { isActive: true } });
  }

  async startTutorial(userId: string, tutorialId: string) {
    const existing = await this.progressRepo.findOne({ where: { userId, tutorial: { id: tutorialId } } });
    if (existing) return existing;

    const tutorial = await this.tutorialRepo.findOne({ where: { id: tutorialId } });
    if (!tutorial) throw new NotFoundException('Tutorial not found');

    const progress = this.progressRepo.create({ userId, tutorial });
    return this.progressRepo.save(progress);
  }

  async updateProgress(userId: string, tutorialId: string, step: number, quizScore?: number) {
    const progress = await this.progressRepo.findOne({ where: { userId, tutorial: { id: tutorialId } } });
    if (!progress) throw new NotFoundException('Progress not found');

    progress.currentStep = step;

    // Mark completed
    const tutorial = await this.tutorialRepo.findOne({ where: { id: tutorialId } });
    if (step >= tutorial!.steps.length) {
      progress.isCompleted = true;
      progress.rewardClaimedAt = new Date();
      
      // Store quiz score if provided
      if (quizScore !== undefined) {
        progress.quizScore = quizScore;
      }
    }

    // Save progress first
    await this.progressRepo.save(progress);

    // Update leaderboard (convert userId to number if needed)
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    if (!isNaN(numericUserId)) {
      await this.leaderboardService.updateTutorialProgress(
        numericUserId,
        tutorialId,
        step,
        quizScore,
      );
    }

    return progress;
  }

  async getProgress(userId: string, tutorialId: string) {
    return this.progressRepo.findOne({ where: { userId, tutorial: { id: tutorialId } } });
  }
}
