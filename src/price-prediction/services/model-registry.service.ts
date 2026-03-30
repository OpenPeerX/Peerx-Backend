import { Injectable } from '@nestjs/common';
import {
  ModelValidationSnapshot,
  PredictionModelType,
  PredictionTimeframe,
} from '../interfaces/price-prediction.interfaces';

@Injectable()
export class ModelRegistryService {
  private readonly activeVersions = new Map<string, string>();
  private readonly validationSnapshots = new Map<string, ModelValidationSnapshot>();
  private abTrafficSplit = 0.2;

  setActiveVersion(modelType: PredictionModelType, timeframe: PredictionTimeframe, version: string): void {
    this.activeVersions.set(this.makeKey(modelType, timeframe), version);
  }

  getActiveVersion(modelType: PredictionModelType, timeframe: PredictionTimeframe): string | null {
    return this.activeVersions.get(this.makeKey(modelType, timeframe)) ?? null;
  }

  upsertValidationSnapshot(
    timeframe: PredictionTimeframe,
    snapshot: ModelValidationSnapshot,
  ): void {
    this.validationSnapshots.set(this.makeKey(snapshot.modelType, timeframe), snapshot);
  }

  getValidationSnapshots(timeframe?: PredictionTimeframe): ModelValidationSnapshot[] {
    const entries = Array.from(this.validationSnapshots.entries());
    if (!timeframe) {
      return entries.map((entry) => entry[1]);
    }

    return entries
      .filter(([key]) => key.endsWith(`:${timeframe}`))
      .map((entry) => entry[1]);
  }

  setAbTrafficSplit(trafficSplit: number): void {
    this.abTrafficSplit = Math.max(0, Math.min(1, trafficSplit));
  }

  getAbTrafficSplit(): number {
    return this.abTrafficSplit;
  }

  private makeKey(modelType: PredictionModelType, timeframe: PredictionTimeframe): string {
    return `${modelType}:${timeframe}`;
  }
}
