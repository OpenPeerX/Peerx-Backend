import { Controller, Get, Post, Param, Body, Query, ParseIntPipe, Delete } from '@nestjs/common';
import { DataPreparationService } from './services/data-preparation.service';
import { ModelTrainerService } from './services/model-trainer.service';
import { ModelEvaluatorService } from './services/model-evaluator.service';
import { ModelDeployerService } from './services/model-deployer.service';

@Controller('ml-pipeline')
export class MLPipelineController {
  constructor(
    private readonly dataPrepService: DataPreparationService,
    private readonly trainerService: ModelTrainerService,
    private readonly evaluatorService: ModelEvaluatorService,
    private readonly deployerService: ModelDeployerService,
  ) {}

  @Post('train')
  async startTraining(@Body() dto: { modelName: string; config: any }) {
    const job = await this.dataPrepService.createTrainingJob(dto.modelName, dto.config);
    return { jobId: job.jobId, status: job.status };
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return { jobId, status: 'completed' };
  }

  @Get('jobs')
  async listJobs(@Query('status') status?: string) {
    return { jobs: [] };
  }

  @Post('hyperparameter-tune')
  async hyperparameterTune(@Body() dto: { method: string; params: any }) {
    return { status: 'started', method: dto.method };
  }

  @Get('models')
  async listModels() {
    return { models: [] };
  }

  @Get('models/:versionId')
  async getModelDetails(@Param('versionId', ParseIntPipe) versionId: number) {
    return { versionId };
  }

  @Post('deploy')
  async deployModel(@Body() dto: { modelVersionId: number; environment?: string }) {
    return this.deployerService.deployModel(dto.modelVersionId, dto.environment as any);
  }

  @Post('ab-test')
  async setupABTest(@Body() dto: { testId: string; controlModelId: number; testModelId: number }) {
    return this.deployerService.setupABTest(dto.testId, dto.controlModelId, dto.testModelId);
  }

  @Get('ab-test/:testId')
  async getABTestResults(@Param('testId') testId: string) {
    return { testId };
  }

  @Get('metrics')
  async getTrainingMetrics() {
    return { metrics: {} };
  }

  @Get('backtest')
  async runBacktest(@Query('modelVersionId', ParseIntPipe) modelVersionId: number) {
    return this.evaluatorService.runBacktest(modelVersionId, []);
  }

  @Post('retrain')
  async triggerRetraining(@Body() dto: { modelName: string; reason: string }) {
    await this.deployerService.triggerRetraining(dto.modelName, dto.reason);
    return { status: 'triggered' };
  }

  @Post('rollback')
  async rollbackModel(@Body() dto: { modelVersionId: number }) {
    return this.deployerService.rollbackModel(dto.modelVersionId);
  }

  @Get('drift-status')
  async checkDriftStatus() {
    return this.deployerService.detectDataDrift([], []);
  }

  @Delete('jobs/:jobId')
  async cancelJob(@Param('jobId') jobId: string) {
    return { jobId, status: 'cancelled' };
  }
}
