import { Body, Controller, Get, Param, Post, Query, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PricePredictionService } from '../price-prediction.service';
import {
  BacktestQueryDto,
  PredictionQueryDto,
  RealtimePredictionsQueryDto,
  RetrainModelsDto,
} from '../dto/price-prediction.dto';

@ApiTags('price-predictions')
@Controller('price-predictions')
export class PricePredictionController {
  constructor(private readonly predictionService: PricePredictionService) {}

  @Get('supported-assets')
  @ApiOperation({ summary: 'Get supported top-50 cryptocurrency assets for predictions' })
  getSupportedAssets() {
    return {
      assets: this.predictionService.getSupportedAssets(),
      count: this.predictionService.getSupportedAssets().length,
    };
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Get real-time predictions for top assets' })
  @ApiResponse({ status: 200, description: 'Real-time predictions generated' })
  async getRealtimePredictions(
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: RealtimePredictionsQueryDto,
  ) {
    const timeframe = (query.timeframe ?? '5m') as PredictionTimeframe;
    const limit = query.limit ?? 20;
    const predictions = await this.predictionService.predictTopAssets(timeframe, limit);
    return {
      timeframe,
      generatedAt: new Date().toISOString(),
      predictions,
    };
  }

  @Get(':symbol')
  @ApiOperation({ summary: 'Get prediction for a specific symbol and timeframe' })
  @ApiResponse({ status: 200, description: 'Prediction generated' })
  async getPrediction(
    @Param('symbol') symbol: string,
    @Query(new ValidationPipe({ transform: true, whitelist: true })) query: PredictionQueryDto,
  ) {
    const timeframe = (query.timeframe ?? '5m') as PredictionTimeframe;
    const horizonSteps = query.horizonSteps ?? 1;
    return this.predictionService.predict(symbol, timeframe, horizonSteps);
  }

  @Post('backtest')
  @ApiOperation({ summary: 'Run model backtesting and return validation metrics' })
  async backtest(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: BacktestQueryDto,
  ) {
    return this.predictionService.backtest(
      body.symbol,
      body.timeframe,
      body.lookbackPoints,
      body.horizonSteps,
    );
  }

  @Get('models/metrics')
  @ApiOperation({ summary: 'Get current model metrics, versions, and cache performance' })
  getModelMetrics(@Query('timeframe') timeframe?: '1m' | '5m' | '1h' | '1d') {
    return this.predictionService.getModelMetrics(timeframe);
  }

  @Post('models/retrain')
  @ApiOperation({ summary: 'Trigger model retraining pipeline' })
  async retrain(
    @Body(new ValidationPipe({ transform: true, whitelist: true })) body: RetrainModelsDto,
  ) {
    return this.predictionService.retrain(body.symbols, body.timeframes);
  }
}
