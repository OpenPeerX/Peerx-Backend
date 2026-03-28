import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OptimizationRequestDto } from '../dto/optimization-request.dto';
import { OptimizationResponseDto } from '../dto/optimization-response.dto';
import { PortfolioOptimizerService } from '../services/portfolio-optimizer.service';
import { MLPredictionService } from '../services/ml-prediction.service';
import { BacktestingService } from '../services/backtesting.service';

@ApiTags('AI Portfolio Optimization')
@Controller('portfolio/ai-optimization')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AIOptimizationController {
  private readonly logger = new Logger(AIOptimizationController.name);

  constructor(
    private readonly portfolioOptimizerService: PortfolioOptimizerService,
    private readonly mlPredictionService: MLPredictionService,
    private readonly backtestingService: BacktestingService,
  ) {}

  @Post('optimize')
  @ApiOperation({ summary: 'Optimize portfolio using AI algorithms' })
  @ApiResponse({ status: 200, description: 'Portfolio optimization completed', type: OptimizationResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid request parameters' })
  async optimizePortfolio(
    @Request() req: any,
    @Body() optimizationRequest: OptimizationRequestDto,
  ): Promise<OptimizationResponseDto> {
    try {
      const userId = req.user.id;
      
      // Get current portfolio allocation
      const currentAssets = await this.getCurrentPortfolioAllocation(userId);
      
      if (Object.keys(currentAssets).length === 0) {
        throw new BadRequestException('No assets found in current portfolio');
      }

      this.logger.log(`Starting AI portfolio optimization for user ${userId}`);
      
      const result = await this.portfolioOptimizerService.optimizePortfolio(
        userId,
        optimizationRequest,
        currentAssets,
      );

      this.logger.log(`Portfolio optimization completed for user ${userId}`);
      return result;
    } catch (error) {
      this.logger.error('Portfolio optimization failed:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('optimizations/:id')
  @ApiOperation({ summary: 'Get optimization result by ID' })
  @ApiResponse({ status: 200, description: 'Optimization result retrieved', type: OptimizationResponseDto })
  @ApiResponse({ status: 404, description: 'Optimization not found' })
  async getOptimization(@Param('id') id: string): Promise<OptimizationResponseDto> {
    try {
      return await this.portfolioOptimizerService.getOptimizationById(id);
    } catch (error) {
      this.logger.error(`Failed to get optimization ${id}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('optimizations')
  @ApiOperation({ summary: 'Get user optimization history' })
  @ApiResponse({ status: 200, description: 'Optimization history retrieved', type: [OptimizationResponseDto] })
  async getUserOptimizations(@Request() req: any): Promise<OptimizationResponseDto[]> {
    try {
      const userId = req.user.id;
      return await this.portfolioOptimizerService.getUserOptimizations(userId);
    } catch (error) {
      this.logger.error('Failed to get user optimizations:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('predict/:symbol')
  @ApiOperation({ summary: 'Generate AI prediction for specific asset' })
  @ApiResponse({ status: 200, description: 'Prediction generated successfully' })
  async generatePrediction(
    @Param('symbol') symbol: string,
    @Query('horizon') horizon: string = '1m',
  ) {
    try {
      const predictionHorizon = this.validateHorizon(horizon);
      const prediction = await this.mlPredictionService.generatePricePredictions([symbol], predictionHorizon);
      
      return {
        symbol,
        horizon: predictionHorizon,
        prediction: prediction[0],
      };
    } catch (error) {
      this.logger.error(`Failed to generate prediction for ${symbol}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('predictions/:symbol')
  @ApiOperation({ summary: 'Get historical predictions for asset' })
  @ApiResponse({ status: 200, description: 'Historical predictions retrieved' })
  async getPredictions(
    @Param('symbol') symbol: string,
    @Query('horizon') horizon?: string,
    @Query('limit') limit: number = 50,
  ) {
    try {
      return await this.mlPredictionService.getHistoricalPredictions(symbol, horizon, limit);
    } catch (error) {
      this.logger.error(`Failed to get predictions for ${symbol}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('backtest/:optimizationId')
  @ApiOperation({ summary: 'Run backtest on optimization result' })
  @ApiResponse({ status: 200, description: 'Backtest completed successfully' })
  async runBacktest(
    @Param('optimizationId') optimizationId: string,
    @Body() backtestRequest: { startDate: string; endDate: string },
  ) {
    try {
      const optimization = await this.portfolioOptimizerService.getOptimizationById(optimizationId);
      const startDate = new Date(backtestRequest.startDate);
      const endDate = new Date(backtestRequest.endDate);

      if (startDate >= endDate) {
        throw new BadRequestException('Start date must be before end date');
      }

      const backtestResults = await this.backtestingService.runBacktest(
        optimization.assetAllocations.reduce((acc, asset) => {
          acc[asset.symbol] = asset.weight;
          return acc;
        }, {} as Record<string, number>),
        {} as OptimizationRequestDto, // Would need to store original request
        startDate,
        endDate,
      );

      return {
        optimizationId,
        backtestResults,
      };
    } catch (error) {
      this.logger.error(`Failed to run backtest for optimization ${optimizationId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('accuracy/:symbol')
  @ApiOperation({ summary: 'Get prediction accuracy for asset' })
  @ApiResponse({ status: 200, description: 'Prediction accuracy retrieved' })
  async getPredictionAccuracy(
    @Param('symbol') symbol: string,
    @Query('horizon') horizon: string = '1m',
  ) {
    try {
      const predictionHorizon = this.validateHorizon(horizon);
      const accuracy = await this.mlPredictionService.getPredictionAccuracy(symbol, predictionHorizon);
      
      return {
        symbol,
        horizon: predictionHorizon,
        accuracy,
      };
    } catch (error) {
      this.logger.error(`Failed to get prediction accuracy for ${symbol}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('execute/:optimizationId')
  @ApiOperation({ summary: 'Execute optimization trades' })
  @ApiResponse({ status: 200, description: 'Optimization executed successfully' })
  async executeOptimization(@Param('optimizationId') optimizationId: string, @Request() req: any) {
    try {
      const userId = req.user.id;
      const result = await this.portfolioOptimizerService.executeOptimization(optimizationId, userId);
      
      return {
        optimizationId,
        executionResult: result,
      };
    } catch (error) {
      this.logger.error(`Failed to execute optimization ${optimizationId}:`, error);
      throw new BadRequestException(error.message);
    }
  }

  private async getCurrentPortfolioAllocation(userId: string): Promise<Record<string, number>> {
    // This would integrate with the existing portfolio service
    // For now, return mock data
    return {
      BTC: 0.4,
      ETH: 0.3,
      AAPL: 0.2,
      MSFT: 0.1,
    };
  }

  private validateHorizon(horizon: string): string {
    const validHorizons = ['1d', '1w', '1m', '3m', '6m', '1y'];
    if (!validHorizons.includes(horizon)) {
      throw new BadRequestException(`Invalid horizon. Must be one of: ${validHorizons.join(', ')}`);
    }
    return horizon;
  }
}
