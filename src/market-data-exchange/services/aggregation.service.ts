import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AggregationService {
  private readonly logger = new Logger(AggregationService.name);

  async aggregatePrices(prices: Array<{ exchange: string; price: number; volume?: number }>): Promise<any> {
    if (prices.length === 0) return null;

    const totalPrice = prices.reduce((sum, p) => sum + p.price, 0);
    const totalVolume = prices.reduce((sum, p) => sum + (p.volume || 0), 0);
    const weightedAvgPrice = totalVolume > 0 
      ? prices.reduce((sum, p) => sum + p.price * (p.volume || 0), 0) / totalVolume
      : totalPrice / prices.length;

    return {
      weightedAverage: weightedAvgPrice,
      simpleAverage: totalPrice / prices.length,
      highest: Math.max(...prices.map(p => p.price)),
      lowest: Math.min(...prices.map(p => p.price)),
      totalVolume,
      exchangeCount: prices.length,
    };
  }

  async detectArbitrage(prices: Array<{ exchange: string; bid: number; ask: number }>): Promise<any[]> {
    const opportunities: any[] = [];

    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < prices.length; j++) {
        if (i === j) continue;

        const buyPrice = prices[j].ask;
        const sellPrice = prices[i].bid;
        const profit = sellPrice - buyPrice;

        if (profit > 0) {
          opportunities.push({
            buyExchange: prices[j].exchange,
            sellExchange: prices[i].exchange,
            buyPrice,
            sellPrice,
            profit,
            profitPercent: (profit / buyPrice) * 100,
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
  }

  async detectOutliers(prices: number[], threshold: number = 2): Promise<{ outliers: number[]; mean: number; std: number }> {
    if (prices.length === 0) return { outliers: [], mean: 0, std: 0 };

    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const std = Math.sqrt(variance);

    const outliers = prices.filter(p => Math.abs(p - mean) > threshold * std);

    return { outliers, mean, std };
  }

  async getBestBidAsk(feeds: Array<{ exchange: string; bid: number; ask: number }>): Promise<any> {
    if (feeds.length === 0) return null;

    const bestBid = feeds.reduce((best, feed) => feed.bid > best.bid ? feed : best, feeds[0]);
    const bestAsk = feeds.reduce((best, feed) => feed.ask < best.ask ? feed : best, feeds[0]);

    return {
      bestBid: { exchange: bestBid.exchange, price: bestBid.bid },
      bestAsk: { exchange: bestAsk.exchange, price: bestAsk.ask },
      spread: bestAsk.ask - bestBid.bid,
    };
  }
}
