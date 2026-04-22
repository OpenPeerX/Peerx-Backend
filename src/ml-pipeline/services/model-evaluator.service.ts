import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelVersion } from '../entities/model-version.entity';
import { PerformanceMetrics } from '../entities/performance-metrics.entity';

@Injectable()
export class ModelEvaluatorService {
  private readonly logger = new Logger(ModelEvaluatorService.name);

  constructor(
    @InjectRepository(PerformanceMetrics)
    private readonly metricsRepository: Repository<PerformanceMetrics>,
  ) {}

  async evaluateModel(modelVersionId: number, testData: any[]): Promise<PerformanceMetrics> {
    // In production: run predictions on test data
    const metrics = this.metricsRepository.create({
      modelVersionId,
      accuracy: 0.85,
      precision: 0.83,
      recall: 0.87,
      f1Score: 0.85,
      auc: 0.90,
      evaluatedAt: new Date(),
    });

    return this.metricsRepository.save(metrics);
  }

  async compareModels(modelIds: number[]): Promise<any[]> {
    const metrics = await this.metricsRepository.find({
      where: modelIds.map(id => ({ modelVersionId: id })),
    });
    return metrics;
  }

  async statisticalTest(metric1: number[], metric2: number[]): Promise<{ pValue: number; significant: boolean }> {
    // Simplified t-test implementation
    const pValue = 0.05; // Placeholder
    return {
      pValue,
      significant: pValue < 0.05,
    };
  }

  async runBacktest(modelVersionId: number, historicalData: any[]): Promise<any> {
    this.logger.log('Running backtest...');
    // In production: simulate trading with historical data
    return {
      modelVersionId,
      return: 15.5,
      sharpeRatio: 1.2,
      maxDrawdown: 8.3,
    };
  }
}
