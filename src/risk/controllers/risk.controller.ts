import { Controller, Get, Post, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RiskService } from '../services/risk.service';
import { RiskOrderService } from '../services/risk-order.service';
import { PortfolioService } from '../../portfolio/portfolio.service';
import { RiskOrderType, RiskOrderSide } from '../entities/risk-order.entity';

@ApiTags('Risk Management')
@Controller('api/risk')
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
    private readonly riskOrderService: RiskOrderService,
    private readonly portfolioService: PortfolioService,
  ) {}

  @Get('dashboard/:userId')
  @ApiOperation({ summary: 'Get a comprehensive risk dashboard for a user' })
  async getDashboard(@Param('userId', ParseIntPipe) userId: number) {
    const profile = await this.riskService.getOrCreateProfile(userId);
    const summary = await this.portfolioService.getPortfolioSummary(userId.toString());

    const volatility = this.riskService.calculatePortfolioVolatility(summary.assets);
    const varValue = this.riskService.calculateParametricVaR(summary.totalValue, volatility);
    const cvarValue = this.riskService.calculateCVaR(summary.totalValue, volatility);
    const stressTests = this.riskService.performStressTests(summary.totalValue, summary.assets);
    const diversification = this.riskService.analyzeDiversification(summary.assets, profile.positionLimit);

    return {
      userId,
      portfolioValue: summary.totalValue,
      volatility: `${volatility.toFixed(2)}%`,
      dailyVaR: varValue,
      dailyCVaR: cvarValue,
      maxDrawdownLimit: profile.maxDrawdownLimit,
      diversification,
      stressTests,
    };
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create a new automated risk order (Stop-Loss or Take-Profit)' })
  async createRiskOrder(
    @Body('userId') userId: number,
    @Body('asset') asset: string,
    @Body('orderType') orderType: RiskOrderType,
    @Body('side') side: RiskOrderSide,
    @Body('amount') amount: number,
    @Body('triggerPrice') triggerPrice: number,
  ) {
    return this.riskOrderService.createRiskOrder(userId, asset, orderType, side, amount, triggerPrice);
  }

  @Get('orders/:userId')
  @ApiOperation({ summary: 'Get all active risk orders for a user' })
  async getActiveOrders(@Param('userId', ParseIntPipe) userId: number) {
    return this.riskOrderService.getActiveOrders(userId);
  }

  @Post('orders/:orderId/cancel')
  @ApiOperation({ summary: 'Cancel an active risk order' })
  async cancelRiskOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body('userId') userId: number,
  ) {
    const success = await this.riskOrderService.cancelRiskOrder(userId, orderId);
    return { success, message: success ? 'Order cancelled' : 'Failed to cancel order' };
  }

  @Post('position-size')
  @ApiOperation({ summary: 'Calculate dynamic position sizing based on risk tolerance' })
  async calculatePositionSize(
    @Body('userId') userId: number,
    @Body('riskTolerance') riskTolerance: number, // percentage, e.g. 0.02 = 2%
    @Body('entryPrice') entryPrice: number,
    @Body('stopLossPrice') stopLossPrice: number,
  ) {
    const summary = await this.portfolioService.getPortfolioSummary(userId.toString());
    const size = this.riskService.calculatePositionSize(
      summary.totalValue,
      riskTolerance,
      entryPrice,
      stopLossPrice
    );
    
    return {
      portfolioValue: summary.totalValue,
      riskTolerance,
      recommendedShares: size,
      tradeCapital: Number((size * entryPrice).toFixed(4)),
    };
  }
}
