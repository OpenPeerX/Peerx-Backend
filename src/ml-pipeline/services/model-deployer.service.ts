import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelVersion, DeploymentStatus } from '../entities/model-version.entity';

@Injectable()
export class ModelDeployerService {
  private readonly logger = new Logger(ModelDeployerService.name);
  private activeTests: Map<string, any> = new Map();

  constructor(
    @InjectRepository(ModelVersion)
    private readonly modelVersionRepository: Repository<ModelVersion>,
  ) {}

  async deployModel(modelVersionId: number, environment: 'staging' | 'production' = 'staging'): Promise<ModelVersion> {
    const model = await this.modelVersionRepository.findOne({ where: { id: modelVersionId } });
    if (!model) throw new Error('Model version not found');

    model.deploymentStatus = environment === 'production' ? DeploymentStatus.PRODUCTION : DeploymentStatus.STAGING;
    model.isActive = true;

    return this.modelVersionRepository.save(model);
  }

  async setupABTest(testId: string, controlModelId: number, testModelId: number, trafficSplit: number = 0.5): Promise<any> {
    const test = {
      testId,
      controlModelId,
      testModelId,
      trafficSplit,
      startTime: new Date(),
      metrics: { control: {}, test: {} },
    };

    this.activeTests.set(testId, test);
    return test;
  }

  async detectDataDrift(currentData: any[], referenceData: any[]): Promise<{ drift: boolean; score: number }> {
    // Simplified drift detection
    const score = 0.1; // Placeholder
    return {
      drift: score > 0.05,
      score,
    };
  }

  async triggerRetraining(modelName: string, reason: string): Promise<void> {
    this.logger.log(`Triggering retraining for ${modelName}: ${reason}`);
    // In production: create new training job
  }

  async rollbackModel(modelVersionId: number): Promise<ModelVersion> {
    const model = await this.modelVersionRepository.findOne({ where: { id: modelVersionId } });
    if (!model) throw new Error('Model version not found');

    model.isActive = false;
    model.deploymentStatus = DeploymentStatus.ARCHIVED;

    return this.modelVersionRepository.save(model);
  }

  async getActiveModel(modelName: string): Promise<ModelVersion | null> {
    return this.modelVersionRepository.findOne({
      where: { modelName, isActive: true },
    });
  }
}
