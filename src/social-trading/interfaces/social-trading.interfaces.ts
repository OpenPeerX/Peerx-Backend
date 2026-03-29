export interface TradeExecutionEvent {
  tradeId: number;
  userId: number;
  asset: string;
  amount: number;
  price: number;
  type: string;
  executedAt: Date;
  notionalValue: number;
  pnl: number;
}

export interface TraderPerformanceSnapshot {
  traderId: number;
  totalTrades: number;
  totalVolume: number;
  netPnl: number;
  roi: number;
  winRate: number;
  averageTradeSize: number;
  maxDrawdown: number;
  followerCount: number;
  activeCopiers: number;
  copiedVolume: number;
}

export interface LeaderboardEntry {
  rank: number;
  traderId: number;
  displayName: string;
  score: number;
  roi: number;
  winRate: number;
  totalVolume: number;
  followerCount: number;
  activeCopiers: number;
  copiedVolume: number;
}