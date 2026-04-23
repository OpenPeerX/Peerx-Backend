import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MLPipelineController } from './ml-pipeline.controller';
import { DataPreparationService } from './services/data-preparation.service';
import { ModelTrainerService } from './services/model-trainer.service';
import { ModelEvaluatorService } from './services/model-evaluator.service';
import { ModelDeployerService } from './services/model-deployer.service';
import { TrainingJob } from './entities/training-job.entity';
import { ModelVersion } from './entities/model-version.entity';
import { PerformanceMetrics } from './entities/performance-metrics.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrainingJob, ModelVersion, PerformanceMetrics]),
  ],
  controllers: [MLPipelineController],
  providers: [DataPreparationService, ModelTrainerService, ModelEvaluatorService, ModelDeployerService],
  exports: [DataPreparationService, ModelTrainerService, ModelEvaluatorService, ModelDeployerService],
})
export class MLPipelineModule {}
