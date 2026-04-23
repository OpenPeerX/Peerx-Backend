import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrainingJob, TrainingJobStatus } from '../entities/training-job.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DataPreparationService {
  private readonly logger = new Logger(DataPreparationService.name);

  constructor(
    @InjectRepository(TrainingJob)
    private readonly trainingJobRepository: Repository<TrainingJob>,
  ) {}

  async extractTrainingData(config: any): Promise<any[]> {
    this.logger.log('Extracting training data...');
    // In production: fetch from database, APIs, etc.
    return [];
  }

  async engineerFeatures(data: any[]): Promise<any[]> {
    this.logger.log('Engineering features...');
    // In production: apply feature engineering transformations
    return data;
  }

  async splitData(data: any[], testSplit: number = 0.2): Promise<{ train: any[]; test: any[] }> {
    const splitIndex = Math.floor(data.length * (1 - testSplit));
    return {
      train: data.slice(0, splitIndex),
      test: data.slice(splitIndex),
    };
  }

  async createCVFolds(data: any[], numFolds: number = 5): Promise<any[][]> {
    const foldSize = Math.floor(data.length / numFolds);
    const folds: any[][] = [];
    
    for (let i = 0; i < numFolds; i++) {
      const start = i * foldSize;
      const end = i === numFolds - 1 ? data.length : (i + 1) * foldSize;
      folds.push(data.slice(start, end));
    }
    
    return folds;
  }

  async normalizeData(data: any[]): Promise<any[]> {
    this.logger.log('Normalizing data...');
    // In production: apply normalization/standardization
    return data;
  }

  async createTrainingJob(modelName: string, config: any): Promise<TrainingJob> {
    const job = this.trainingJobRepository.create({
      jobId: uuidv4(),
      modelName,
      status: TrainingJobStatus.PENDING,
      configuration: config,
    });

    return this.trainingJobRepository.save(job);
  }
}
