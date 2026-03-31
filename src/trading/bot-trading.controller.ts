import {
  Body,
  Controller,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { TradingService } from '../trading/trading.service';
import { MetricsService } from '../metrics/metrics.service';
import { CreateTradeDto } from '../trading/dto/create-trade.dto';
import { ApiKeyGuard } from '../common/security/api-key.guard';
import { PricePredictionService } from '../price-prediction/price-prediction.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('bot-trading')
@Controller('bot/trading')
@UseGuards(ApiKeyGuard)
export class BotTradingController {
  constructor(
    private readonly tradingService: TradingService,
    private readonly metricsService: MetricsService,
    private readonly pricePredictionService: PricePredictionService,
  ) {}

  @Post('swap')
  @ApiOperation({ summary: 'Execute a trade as a bot (API key required)' })
  @ApiResponse({ status: 201, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid trade parameters' })
  @ApiBody({ type: CreateTradeDto })
  async swap(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })) body: CreateTradeDto,
    @Req() req
  ) {
    if (!req.isBot) {
      return { error: 'Only bot API keys can access this endpoint.' };
    }
    // Optionally check permissions here
    const result = await this.tradingService.swap(req.apiKeyOwnerId, body.asset, body.amount, body.price, body.type);
    this.metricsService.recordBotTrade(req.apiKeyOwnerId, body.asset, body.type);
    return result;
  }

  @Post('signal/:symbol')
  @ApiOperation({ summary: 'Get AI trading signal for a symbol (API key required)' })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['1m', '5m', '1h', '1d'] })
  @ApiQuery({ name: 'horizonSteps', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Signal generated successfully' })
  async getSignal(
    @Param('symbol') symbol: string,
    @Query('timeframe') timeframe = '5m',
    @Query('horizonSteps') horizonSteps = '3',
    @Req() req,
  ) {
    if (!req.isBot) {
      return { error: 'Only bot API keys can access this endpoint.' };
    }

    const prediction = await this.pricePredictionService.predict(
      symbol,
      timeframe as '1m' | '5m' | '1h' | '1d',
      Number(horizonSteps),
    );

    return {
      symbol: prediction.symbol,
      timeframe: prediction.timeframe,
      signal: prediction.signal,
      confidence: prediction.confidence,
      predictedPrice: prediction.predictedPrice,
      expectedReturnPct: prediction.expectedReturnPct,
      modelVersion: prediction.modelVersion,
      generatedAt: prediction.generatedAt,
    };
  }
}
