import { Injectable, Logger } from '@nestjs/common';
import { OptimizationRequestDto } from '../dto/optimization-request.dto';
import { BacktestResultsDto } from '../dto/optimization-response.dto';

interface HistoricalData {
  date: Date;
  prices: Record<string, number>;
  volumes: Record<string, number>;
}

interface Trade {
  date: Date;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
}

interface PortfolioSnapshot {
  date: Date;
  value: number;
  allocations: Record<string, number>;
  cash: number;
}

@Injectable()
export class BacktestingService {
  private readonly logger = new Logger(BacktestingService.name);

  async runBacktest(
    optimizedAllocation: Record<string, number>,
    request: OptimizationRequestDto,
    startDate: Date,
    endDate: Date,
  ): Promise<BacktestResultsDto> {
    this.logger.log(`Running backtest from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    try {
      // Fetch historical data
      const historicalData = await this.getHistoricalData(
        Object.keys(optimizedAllocation),
        startDate,
        endDate,
      );

      // Initialize portfolio
      const initialPortfolio = this.initializePortfolio(optimizedAllocation, historicalData[0]);
      
      // Run simulation
      const { snapshots, trades } = this.simulatePortfolio(
        initialPortfolio,
        optimizedAllocation,
        historicalData,
        request,
      );

      // Calculate performance metrics
      const metrics = this.calculatePerformanceMetrics(snapshots, trades);

      return {
        startDate,
        endDate,
        ...metrics,
      };
    } catch (error) {
      this.logger.error('Backtest failed:', error);
      throw error;
    }
  }

  private async getHistoricalData(
    symbols: string[],
    startDate: Date,
    endDate: Date,
  ): Promise<HistoricalData[]> {
    // In production, this would fetch real historical data from APIs like Alpha Vantage, Yahoo Finance, etc.
    const data: HistoricalData[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const prices: Record<string, number> = {};
      const volumes: Record<string, number> = {};

      for (const symbol of symbols) {
        const basePrice = this.getBasePrice(symbol);
        const randomWalk = this.generateRandomWalk(basePrice, startDate, currentDate);
        prices[symbol] = randomWalk;
        volumes[symbol] = Math.random() * 1000000 + 100000;
      }

      data.push({
        date: new Date(currentDate),
        prices,
        volumes,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }

  private getBasePrice(symbol: string): number {
    const prices: Record<string, number> = {
      BTC: 45000,
      ETH: 3000,
      AAPL: 150,
      GOOGL: 2500,
      MSFT: 300,
    };
    return prices[symbol] || 100;
  }

  private generateRandomWalk(basePrice: number, startDate: Date, currentDate: Date): number {
    const daysDiff = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const trend = 0.0001; // Daily trend
    const volatility = 0.02; // Daily volatility
    
    let price = basePrice;
    for (let i = 0; i < daysDiff; i++) {
      const randomReturn = trend + (Math.random() - 0.5) * volatility;
      price *= (1 + randomReturn);
    }
    
    return price;
  }

  private initializePortfolio(
    allocations: Record<string, number>,
    initialData: HistoricalData,
  ): PortfolioSnapshot {
    const totalValue = 100000; // $100,000 initial portfolio
    const cash = totalValue * 0.05; // 5% cash
    const investedValue = totalValue - cash;

    const portfolioAllocations: Record<string, number> = {};

    for (const [symbol, allocation] of Object.entries(allocations)) {
      const symbolValue = investedValue * allocation;
      const price = initialData.prices[symbol];
      portfolioAllocations[symbol] = symbolValue / price;
    }

    return {
      date: initialData.date,
      value: totalValue,
      allocations: portfolioAllocations,
      cash,
    };
  }

  private simulatePortfolio(
    initialPortfolio: PortfolioSnapshot,
    targetAllocation: Record<string, number>,
    historicalData: HistoricalData[],
    request: OptimizationRequestDto,
  ): { snapshots: PortfolioSnapshot[]; trades: Trade[] } {
    const snapshots: PortfolioSnapshot[] = [initialPortfolio];
    const trades: Trade[] = [];
    let currentPortfolio = { ...initialPortfolio };

    const rebalancingFrequency = request.rebalancingFrequency || 30; // Default 30 days
    let lastRebalanceDate = initialPortfolio.date;

    for (let i = 1; i < historicalData.length; i++) {
      const data = historicalData[i];
      const previousData = historicalData[i - 1];

      // Update portfolio value based on price changes
      let portfolioValue = currentPortfolio.cash;
      const newAllocations: Record<string, number> = {};

      for (const [symbol, quantity] of Object.entries(currentPortfolio.allocations)) {
        const currentPrice = data.prices[symbol];
        const previousPrice = previousData.prices[symbol];
        const symbolValue = quantity * currentPrice;
        portfolioValue += symbolValue;
        newAllocations[symbol] = quantity;
      }

      // Check if rebalancing is needed
      const daysSinceRebalance = Math.floor(
        (data.date.getTime() - lastRebalanceDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceRebalance >= rebalancingFrequency) {
        const { updatedPortfolio, newTrades } = this.rebalancePortfolio(
          currentPortfolio,
          targetAllocation,
          data.prices,
          portfolioValue,
        );

        trades.push(...newTrades);
        currentPortfolio = updatedPortfolio;
        lastRebalanceDate = data.date;
      } else {
        currentPortfolio = {
          date: data.date,
          value: portfolioValue,
          allocations: newAllocations,
          cash: currentPortfolio.cash,
        };
      }

      snapshots.push(currentPortfolio);
    }

    return { snapshots, trades };
  }

  private rebalancePortfolio(
    portfolio: PortfolioSnapshot,
    targetAllocation: Record<string, number>,
    currentPrices: Record<string, number>,
    totalValue: number,
  ): { updatedPortfolio: PortfolioSnapshot; newTrades: Trade[] } {
    const trades: Trade[] = [];
    const updatedAllocations: Record<string, number> = { ...portfolio.allocations };
    let updatedCash = portfolio.cash;

    // Calculate current allocations
    const currentAllocations: Record<string, number> = {};
    const investedValue = totalValue - updatedCash;

    for (const [symbol, quantity] of Object.entries(portfolio.allocations)) {
      const value = quantity * currentPrices[symbol];
      currentAllocations[symbol] = value / investedValue;
    }

    // Rebalance to target allocation
    for (const [symbol, targetWeight] of Object.entries(targetAllocation)) {
      const currentWeight = currentAllocations[symbol] || 0;
      const targetValue = investedValue * targetWeight;
      const currentValue = (portfolio.allocations[symbol] || 0) * currentPrices[symbol];
      const difference = targetValue - currentValue;

      if (Math.abs(difference) > targetValue * 0.01) { // Only rebalance if difference > 1%
        const price = currentPrices[symbol];
        const quantity = Math.abs(difference) / price;
        const tradeType = difference > 0 ? 'buy' : 'sell';

        trades.push({
          date: portfolio.date,
          symbol,
          type: tradeType,
          quantity,
          price,
        });

        if (tradeType === 'buy') {
          updatedAllocations[symbol] = (portfolio.allocations[symbol] || 0) + quantity;
          updatedCash -= difference;
        } else {
          updatedAllocations[symbol] = Math.max(0, (portfolio.allocations[symbol] || 0) - quantity);
          updatedCash += Math.abs(difference);
        }
      }
    }

    const updatedPortfolio: PortfolioSnapshot = {
      date: portfolio.date,
      value: totalValue,
      allocations: updatedAllocations,
      cash: updatedCash,
    };

    return { updatedPortfolio, newTrades: trades };
  }

  private calculatePerformanceMetrics(
    snapshots: PortfolioSnapshot[],
    trades: Trade[],
  ): Omit<BacktestResultsDto, 'startDate' | 'endDate'> {
    if (snapshots.length < 2) {
      throw new Error('Insufficient data for performance calculation');
    }

    const initialValue = snapshots[0].value;
    const finalValue = snapshots[snapshots.length - 1].value;
    const days = Math.floor(
      (snapshots[snapshots.length - 1].date.getTime() - snapshots[0].date.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    // Basic returns
    const totalReturn = (finalValue - initialValue) / initialValue;
    const annualizedReturn = Math.pow(1 + totalReturn, 365 / days) - 1;

    // Calculate daily returns for volatility
    const dailyReturns: number[] = [];
    for (let i = 1; i < snapshots.length; i++) {
      const dailyReturn = (snapshots[i].value - snapshots[i - 1].value) / snapshots[i - 1].value;
      dailyReturns.push(dailyReturn);
    }

    // Volatility
    const meanReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / dailyReturns.length;
    const dailyVolatility = Math.sqrt(variance);
    const annualizedVolatility = dailyVolatility * Math.sqrt(365);

    // Maximum drawdown
    let maxDrawdown = 0;
    let peak = initialValue;
    for (const snapshot of snapshots) {
      if (snapshot.value > peak) {
        peak = snapshot.value;
      }
      const drawdown = (peak - snapshot.value) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }

    // Sharpe ratio (assuming 2% risk-free rate)
    const riskFreeRate = 0.02;
    const sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedVolatility;

    // Trade statistics
    const winningTrades = trades.filter(trade => {
      // Simplified win calculation - in production, track actual P&L per trade
      return Math.random() > 0.4; // Mock 60% win rate
    });

    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;

    // Average holding period
    const holdingPeriods: number[] = [];
    const symbolGroups = trades.reduce((groups, trade) => {
      if (!groups[trade.symbol]) {
        groups[trade.symbol] = [];
      }
      groups[trade.symbol].push(trade);
      return groups;
    }, {} as Record<string, Trade[]>);

    for (const symbolTrades of Object.values(symbolGroups)) {
      for (let i = 0; i < symbolTrades.length - 1; i += 2) {
        if (i + 1 < symbolTrades.length) {
          const days = Math.floor(
            (symbolTrades[i + 1].date.getTime() - symbolTrades[i].date.getTime()) /
              (1000 * 60 * 60 * 24),
          );
          holdingPeriods.push(days);
        }
      }
    }

    const averageHoldingPeriod = holdingPeriods.length > 0 
      ? holdingPeriods.reduce((sum, period) => sum + period, 0) / holdingPeriods.length 
      : 0;

    return {
      totalReturn,
      annualizedReturn,
      annualizedVolatility,
      maxDrawdown,
      sharpeRatio,
      tradesExecuted: trades.length,
      winRate,
      averageHoldingPeriod,
    };
  }
}
