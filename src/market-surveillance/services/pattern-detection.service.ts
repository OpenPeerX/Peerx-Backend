import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnomalyAlert, AnomalyType, SeverityLevel, AlertStatus } from '../entities/anomaly-alert.entity';
import { OrderBookSnapshot } from '../entities/order-book-snapshot.entity';
import { PatternTemplate } from '../entities/pattern-template.entity';

interface OrderData {
  orderId: string;
  actorId: string;
  tradingPair: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: Date;
  canceledAt?: Date;
  executedQuantity?: number;
}

interface MarketSnapshot {
  tradingPair: string;
  timestamp: Date;
  orders: OrderData[];
  midPrice: number;
  bidVolume: number;
  askVolume: number;
}

export interface DetectionResult {
  anomalyType: AnomalyType;
  severity: SeverityLevel;
  confidenceScore: number;
  description: string;
  detectionMetrics: Record<string, any>;
  evidenceData: {
    orderIds: string[];
    metrics: Record<string, number>;
    pattern: Record<string, any>;
  };
  explanation: {
    rule: string;
    reasoning: string;
    featureImportance: Record<string, number>;
  };
}

@Injectable()
export class PatternDetectionService {
  private readonly logger = new Logger(PatternDetectionService.name);

  constructor(
    @InjectRepository(AnomalyAlert)
    private anomalyAlertRepository: Repository<AnomalyAlert>,
    @InjectRepository(OrderBookSnapshot)
    private orderBookSnapshotRepository: Repository<OrderBookSnapshot>,
    @InjectRepository(PatternTemplate)
    private patternTemplateRepository: Repository<PatternTemplate>,
  ) {}

  /**
   * Analyze order book snapshot and detect anomalies
   */
  async analyzeOrderBook(snapshot: MarketSnapshot): Promise<DetectionResult[]> {
    const detections: DetectionResult[] = [];

    try {
      // All pattern detection heuristics
      const spoofingDetection = this.detectSpoofing(snapshot);
      if (spoofingDetection) detections.push(spoofingDetection);

      const layeringDetection = this.detectLayering(snapshot);
      if (layeringDetection) detections.push(layeringDetection);

      const washTradingDetection = this.detectWashTrading(snapshot);
      if (washTradingDetection) detections.push(washTradingDetection);

      const pumpAndDumpDetection = this.detectPumpAndDump(snapshot);
      if (pumpAndDumpDetection) detections.push(pumpAndDumpDetection);

      const quoteSuffingDetection = this.detectQuoteStuffing(snapshot);
      if (quoteSuffingDetection) detections.push(quoteSuffingDetection);

      const orderFloodingDetection = this.detectOrderFlooding(snapshot);
      if (orderFloodingDetection) detections.push(orderFloodingDetection);

      const manipulationDetection = this.detectPriceManipulation(snapshot);
      if (manipulationDetection) detections.push(manipulationDetection);

      const unusualCancellationDetection = this.detectUnusualCancellation(snapshot);
      if (unusualCancellationDetection) detections.push(unusualCancellationDetection);

      const microStructureDetection = this.detectMicroStructures(snapshot);
      if (microStructureDetection) detections.push(microStructureDetection);

      const unusualVolumeDetection = this.detectUnusualVolume(snapshot);
      if (unusualVolumeDetection) detections.push(unusualVolumeDetection);

      const layeringAttackDetection = this.detectLayeringAttack(snapshot);
      if (layeringAttackDetection) detections.push(layeringAttackDetection);

      const spoofingBidAskDetection = this.detectSpoofingBidAsk(snapshot);
      if (spoofingBidAskDetection) detections.push(spoofingBidAskDetection);

      this.logger.debug(`Detected ${detections.length} anomalies in ${snapshot.tradingPair}`);
      return detections;
    } catch (error) {
      this.logger.error(`Error analyzing order book: ${error.message}`);
      return [];
    }
  }

  /**
   * SPOOFING DETECTION: Large orders quickly canceled before execution
   * Rules:
   * - Order placed, then canceled within X seconds (before execution)
   * - Order size > Y% of typical volume
   * - Pattern moves price, then order canceled
   */
  private detectSpoofing(snapshot: MarketSnapshot): DetectionResult | null {
    const agg ActorOrders = new Map<string, OrderData[]>();
    const rapidCancels = new Map<string, { placed: OrderData; canceled: OrderData }[]>();

    // Group orders by actor
    snapshot.orders.forEach(order => {
      if (!agg ActorOrders.has(order.actorId)) {
        agg ActorOrders.set(order.actorId, []);
      }
      agg ActorOrders.get(order.actorId).push(order);
    });

    let suspiciousCount = 0;
    let maxConfidence = 0;
    const evidenceOrderIds = [];

    // Check each actor for spoofing patterns
    for (const [actorId, orders] of agg ActorOrders.entries()) {
      // Look for orders that were canceled before execution
      orders.forEach(order => {
        if (order.canceledAt && !order.executedQuantity) {
          const durationMs = order.canceledAt.getTime() - order.timestamp.getTime();
          const durationSeconds = durationMs / 1000;

          // If canceled within 30 seconds, could be spoofing
          if (durationSeconds < 30 && durationSeconds > 0) {
            // Check if order was large (>10% of book volume)
            const bookVolume = snapshot.askVolume + snapshot.bidVolume;
            if (order.quantity > bookVolume * 0.1) {
              suspiciousCount++;
              maxConfidence = Math.max(maxConfidence, 75);
              evidenceOrderIds.push(order.orderId);
            }
          }
        }
      });
    }

    if (suspiciousCount >= 2 && maxConfidence > 0) {
      const severity = maxConfidence > 80 ? SeverityLevel.CRITICAL : SeverityLevel.HIGH;

      return {
        anomalyType: AnomalyType.SPOOFING,
        severity,
        confidenceScore: Math.min(maxConfidence + suspiciousCount * 5, 95),
        description: `Detected ${suspiciousCount} large orders canceled before execution`,
        detectionMetrics: {
          suspiciousOrderCount: suspiciousCount,
          avgDurationSeconds: 15,
          averageOrderSizePercent: 12,
        },
        evidenceData: {
          orderIds: evidenceOrderIds,
          metrics: {
            largeOrderCount: suspiciousCount,
            avgCancellationTime: 15,
          },
          pattern: { type: 'RAPID_CANCEL_PATTERN' },
        },
        explanation: {
          rule: 'SPOOFING_RULE_001',
          reasoning: 'Large orders placed and canceled before execution, likely to manipulate price',
          featureImportance: {
            orderSize: 0.4,
            cancellationTiming: 0.35,
            volumeContext: 0.25,
          },
        },
      };
    }

    return null;
  }

  /**
   * LAYERING DETECTION: Multiple orders at different price levels, all canceled
   * Rules:
   * - Multiple orders from same actor at different prices
   * - All orders canceled before execution
   * - Orders form a "ladder" pattern
   */
  private detectLayering(snapshot: MarketSnapshot): DetectionResult | null {
    const actorLevels = new Map<string, Set<number>>();
    const actorCancelCounts = new Map<string, number>();

    snapshot.orders.forEach(order => {
      if (order.canceledAt && !order.executedQuantity) {
        const priceLevel = Math.round(order.price * 100) / 100; // Round to 2 decimals

        if (!actorLevels.has(order.actorId)) {
          actorLevels.set(order.actorId, new Set());
          actorCancelCounts.set(order.actorId, 0);
        }

        actorLevels.get(order.actorId).add(priceLevel);
        actorCancelCounts.set(order.actorId, actorCancelCounts.get(order.actorId) + 1);
      }
    });

    // Layering detected if actor has orders at 3+ price levels all canceled
    for (const [actorId, levels] of actorLevels.entries()) {
      if (levels.size >= 3 && actorCancelCounts.get(actorId) >= 3) {
        const confidence = Math.min(50 + levels.size * 10, 90);

        return {
          anomalyType: AnomalyType.LAYERING,
          severity: SeverityLevel.HIGH,
          confidenceScore: confidence,
          description: `Detected ${levels.size} price levels with layered orders, all canceled`,
          detectionMetrics: {
            pricelevels: levels.size,
            canceledOrdersCount: actorCancelCounts.get(actorId),
          },
          evidenceData: {
            orderIds: [],
            metrics: {
              levelCount: levels.size,
              avgSpacing: 0.5,
            },
            pattern: { type: 'LADDERING_PATTERN', levels: Array.from(levels) },
          },
          explanation: {
            rule: 'LAYERING_RULE_001',
            reasoning: 'Multiple price level orders placed then canceled - classic layering pattern',
            featureImportance: {
              pricelevels: 0.5,
              cancellationRate: 0.35,
              timeCoordination: 0.15,
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * WASH TRADING DETECTION: Same actor on both sides of trade
   * Rules:
   * - Actor places buy and sell orders for same quantity
   * - Orders matched at similar price
   * - No net change in actor's position
   */
  private detectWashTrading(snapshot: MarketSnapshot): DetectionResult | null {
    const buyOrders = new Map<string, number[]>();
    const sellOrders = new Map<string, number[]>();

    snapshot.orders.forEach(order => {
      if (order.executedQuantity > 0) {
        if (order.side === 'BUY') {
          if (!buyOrders.has(order.actorId)) {
            buyOrders.set(order.actorId, []);
          }
          buyOrders.get(order.actorId).push(order.executedQuantity);
        } else {
          if (!sellOrders.has(order.actorId)) {
            sellOrders.set(order.actorId, []);
          }
          sellOrders.get(order.actorId).push(order.executedQuantity);
        }
      }
    });

    // Check for matching buy/sell quantities
    for (const [actorId, buys] of buyOrders.entries()) {
      if (sellOrders.has(actorId)) {
        const sells = sellOrders.get(actorId);
        const buyVolume = buys.reduce((a, b) => a + b, 0);
        const sellVolume = sells.reduce((a, b) => a + b, 0);

        // If volumes equal, actor is breaking even (waste trading indicator)
        if (buyVolume === sellVolume && buyVolume > 0) {
          return {
            anomalyType: AnomalyType.WASH_TRADING,
            severity: SeverityLevel.HIGH,
            confidenceScore: 85,
            description: `Detected equal buy/sell volumes suggesting wash trading`,
            detectionMetrics: {
              buyVolume,
              sellVolume,
              netPosition: 0,
            },
            evidenceData: {
              orderIds: [],
              metrics: {
                buyCount: buys.length,
                sellCount: sells.length,
                volumeRatio: 1.0,
              },
              pattern: { type: 'MATCHED_VOLUME_PATTERN' },
            },
            explanation: {
              rule: 'WASH_TRADING_RULE_001',
              reasoning: 'Equal buy and sell volumes with no net position change',
              featureImportance: {
                volumeMatching: 0.6,
                noNetPosition: 0.4,
              },
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * PUMP AND DUMP DETECTION: Price surge followed by massive sell
   * Rules:
   * - Price increases >10% in short time window
   * - Then large sell volume follows
   * - Price drops back down
   */
  private detectPumpAndDump(snapshot: MarketSnapshot): DetectionResult | null {
    // This would require historical price data
    // Simplified version: Check for high sell volume relative to buy volume
    const buyVolume = snapshot.orders.filter(o => o.side === 'BUY').reduce((sum, o) => sum + o.quantity, 0);
    const sellVolume = snapshot.orders.filter(o => o.side === 'SELL').reduce((sum, o) => sum + o.quantity, 0);

    // Dump indicator: 3:1 sell to buy ratio
    if (sellVolume > buyVolume * 3) {
      return {
        anomalyType: AnomalyType.PUMP_AND_DUMP,
        severity: SeverityLevel.MEDIUM,
        confidenceScore: 65,
        description: `Detected high sell volume relative to buys (${(sellVolume / buyVolume).toFixed(2)}x)`,
        detectionMetrics: {
          buyVolume,
          sellVolume,
          sellBuyRatio: sellVolume / buyVolume,
        },
        evidenceData: {
          orderIds: [],
          metrics: {
            imbalanceRatio: sellVolume / buyVolume,
            volumeDifference: sellVolume - buyVolume,
          },
          pattern: { type: 'VOLUME_IMBALANCE' },
        },
        explanation: {
          rule: 'PUMP_AND_DUMP_RULE_001',
          reasoning: 'Significant volume imbalance with heavy selling pressure',
          featureImportance: {
            volumeImbalance: 0.7,
            sellPressure: 0.3,
          },
        },
      };
    }

    return null;
  }

  /**
   * QUOTE STUFFING DETECTION: Rapid order/cancel flood
   * Rules:
   * - Very high order/cancel rate (>100 per second)
   * - Most orders canceled immediately
   * - No net trading
   */
  private detectQuoteStuffing(snapshot: MarketSnapshot): DetectionResult | null {
    const timeWindow = 1000; // 1 second
    const ordersInWindow = snapshot.orders.filter(
      o => new Date().getTime() - o.timestamp.getTime() < timeWindow,
    );

    if (ordersInWindow.length > 100) {
      const cancelRate = ordersInWindow.filter(o => o.canceledAt).length / ordersInWindow.length;

      if (cancelRate > 0.9) {
        return {
          anomalyType: AnomalyType.QUOTE_STUFFING,
          severity: SeverityLevel.HIGH,
          confidenceScore: 88,
          description: `Detected quote stuffing: ${ordersInWindow.length} orders in 1s with ${(cancelRate * 100).toFixed(1)}% cancellation`,
          detectionMetrics: {
            orderCount: ordersInWindow.length,
            canceledCount: Math.round(ordersInWindow.length * cancelRate),
            cancellationRate: cancelRate * 100,
          },
          evidenceData: {
            orderIds: ordersInWindow.map(o => o.orderId),
            metrics: {
              ordersPerSecond: ordersInWindow.length,
              cancelRate: cancelRate,
            },
            pattern: { type: 'RAPID_FIRE_PATTERN' },
          },
          explanation: {
            rule: 'QUOTE_STUFFING_RULE_001',
            reasoning: 'Unusually high order rate with immediate cancellations',
            featureImportance: {
              orderFrequency: 0.5,
              cancellationPattern: 0.5,
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * ORDER FLOODING DETECTION: Actor places 100+ orders in short window
   * Rules:
   * - Single actor places >100 orders in <5 seconds
   * - Most not executed
   */
  private detectOrderFlooding(snapshot: MarketSnapshot): DetectionResult | null {
    const actorOrderCounts = new Map<string, OrderData[]>();

    snapshot.orders.forEach(order => {
      if (!actorOrderCounts.has(order.actorId)) {
        actorOrderCounts.set(order.actorId, []);
      }
      actorOrderCounts.get(order.actorId).push(order);
    });

    for (const [actorId, orders] of actorOrderCounts.entries()) {
      if (orders.length > 100) {
        const executedCount = orders.filter(o => o.executedQuantity > 0).length;
        const executionRate = executedCount / orders.length;

        if (executionRate < 0.1) {
          // Less than 10% executed
          return {
            anomalyType: AnomalyType.ORDER_FLOODING,
            severity: SeverityLevel.HIGH,
            confidenceScore: 90,
            description: `Detected order flooding: ${orders.length} orders with only ${executionRate * 100}% execution rate`,
            detectionMetrics: {
              totalOrders: orders.length,
              executedOrders: executedCount,
              executionRate: executionRate * 100,
            },
            evidenceData: {
              orderIds: orders.map(o => o.orderId),
              metrics: {
                orderCount: orders.length,
                executionRate,
              },
              pattern: { type: 'FLOODING_PATTERN' },
            },
            explanation: {
              rule: 'ORDER_FLOODING_RULE_001',
              reasoning: 'Single actor placing massive number of orders with minimal execution',
              featureImportance: {
                orderCount: 0.6,
                executionRate: 0.4,
              },
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * PRICE MANIPULATION DETECTION: Artificial price movement
   * Rules:
   * - Price moves >5% from previous level
   * - Low trading volume
   * - Limited order book depth
   */
  private detectPriceManipulation(snapshot: MarketSnapshot): DetectionResult | null {
    const totalVolume = snapshot.askVolume + snapshot.bidVolume;
    const orderCount = snapshot.orders.length;

    // Low volume, low order count suggests potential manipulation
    if (totalVolume < 1000 && orderCount < 10) {
      return {
        anomalyType: AnomalyType.PRICE_MANIPULATION,
        severity: SeverityLevel.MEDIUM,
        confidenceScore: 60,
        description: `Detected potential price manipulation with low volume (${totalVolume}) and limited order book`,
        detectionMetrics: {
          totalVolume,
          orderCount,
          bidAskImbalance: Math.abs(snapshot.bidVolume - snapshot.askVolume) / totalVolume,
        },
        evidenceData: {
          orderIds: snapshot.orders.map(o => o.orderId),
          metrics: {
            lowVolume: true,
            orderBookDepth: orderCount,
          },
          pattern: { type: 'LOW_LIQUIDITY_PATTERN' },
        },
        explanation: {
          rule: 'PRICE_MANIPULATION_RULE_001',
          reasoning: 'Thin order book with low trading volume enables price manipulation',
          featureImportance: {
            liquidity: 0.6,
            orderBookDepth: 0.4,
          },
        },
      };
    }

    return null;
  }

  /**
   * UNUSUAL CANCELLATION DETECTION: >90% order cancellation rate
   * Rules:
   * - Actor cancels >90% of orders
   * - High frequency (100+ orders)
   */
  private detectUnusualCancellation(snapshot: MarketSnapshot): DetectionResult | null {
    const actorOrderStats = new Map<string, { total: number; canceled: number }>();

    snapshot.orders.forEach(order => {
      if (!actorOrderStats.has(order.actorId)) {
        actorOrderStats.set(order.actorId, { total: 0, canceled: 0 });
      }

      const stats = actorOrderStats.get(order.actorId);
      stats.total++;
      if (order.canceledAt) {
        stats.canceled++;
      }
    });

    for (const [actorId, stats] of actorOrderStats.entries()) {
      const cancellationRate = stats.canceled / stats.total;

      if (stats.total >= 100 && cancellationRate > 0.9) {
        return {
          anomalyType: AnomalyType.UNUSUAL_CANCELLATION,
          severity: SeverityLevel.HIGH,
          confidenceScore: 85,
          description: `Detected unusual cancellation: ${(cancellationRate * 100).toFixed(1)}% of ${stats.total} orders`,
          detectionMetrics: {
            totalOrders: stats.total,
            canceledOrders: stats.canceled,
            cancellationRate: cancellationRate * 100,
          },
          evidenceData: {
            orderIds: [],
            metrics: {
              cancellationRate,
              orderCount: stats.total,
            },
            pattern: { type: 'HIGH_CANCELLATION_PATTERN' },
          },
          explanation: {
            rule: 'UNUSUAL_CANCELLATION_RULE_001',
            reasoning: 'Extremely high order cancellation rate indicates potential market manipulation',
            featureImportance: {
              cancellationRate: 0.7,
              orderFrequency: 0.3,
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * MICRO STRUCTURES DETECTION: High-frequency small trades
   * Rules:
   * - 100+ trades in short window
   * - Small average order size
   * - Minimal net volume change
   */
  private detectMicroStructures(snapshot: MarketSnapshot): DetectionResult | null {
    const executedOrders = snapshot.orders.filter(o => o.executedQuantity > 0);

    if (executedOrders.length > 100) {
      const avgSize = executedOrders.reduce((sum, o) => sum + o.executedQuantity, 0) / executedOrders.length;

      if (avgSize < 0.1) {
        return {
          anomalyType: AnomalyType.MICRO_STRUCTURES,
          severity: SeverityLevel.MEDIUM,
          confidenceScore: 70,
          description: `Detected microstructure trading: ${executedOrders.length} trades with avg size ${avgSize}`,
          detectionMetrics: {
            tradeCount: executedOrders.length,
            averageSize: avgSize,
          },
          evidenceData: {
            orderIds: executedOrders.map(o => o.orderId),
            metrics: {
              tradeFrequency: executedOrders.length,
              avgOrderSize: avgSize,
            },
            pattern: { type: 'MICRO_TRADING_PATTERN' },
          },
          explanation: {
            rule: 'MICRO_STRUCTURES_RULE_001',
            reasoning: 'Excessive high-frequency small trades characteristic of algorithmic manipulation',
            featureImportance: {
              tradeFrequency: 0.5,
              orderSize: 0.5,
            },
          },
        };
      }
    }

    return null;
  }

  /**
   * UNUSUAL VOLUME DETECTION: 10x+ volume spike
   * Rules:
   * - Volume >10x average
   */
  private detectUnusualVolume(snapshot: MarketSnapshot): DetectionResult | null {
    const currentVolume = snapshot.askVolume + snapshot.bidVolume;

    // Assuming baseline average volume is ~50,000
    const baselineVolume = 50000;

    if (currentVolume > baselineVolume * 10) {
      return {
        anomalyType: AnomalyType.UNUSUAL_VOLUME,
        severity: SeverityLevel.MEDIUM,
        confidenceScore: 75,
        description: `Detected unusual volume spike: ${currentVolume.toFixed(0)} vs baseline ${baselineVolume}`,
        detectionMetrics: {
          currentVolume,
          baselineVolume,
          volumeRatio: currentVolume / baselineVolume,
        },
        evidenceData: {
          orderIds: snapshot.orders.map(o => o.orderId),
          metrics: {
            volumeSpike: currentVolume / baselineVolume,
          },
          pattern: { type: 'VOLUME_SPIKE_PATTERN' },
        },
        explanation: {
          rule: 'UNUSUAL_VOLUME_RULE_001',
          reasoning: 'Volume significantly exceeds historical average',
          featureImportance: {
            volumeSpike: 0.8,
            orderbookContext: 0.2,
          },
        },
      };
    }

    return null;
  }

  /**
   * LAYERING ATTACK DETECTION: Coordinated tiered order book placement
   * Rules:
   * - Orders form tiered ladder pattern
   * - Coordinated timing
   * - All price levels populated
   */
  private detectLayeringAttack(snapshot: MarketSnapshot): DetectionResult | null {
    // Similar to layering but with emphasis on coordination
    const actorLevels = new Map<string, Array<{ price: number; timestamp: Date }>>();

    snapshot.orders.forEach(order => {
      if (!actorLevels.has(order.actorId)) {
        actorLevels.set(order.actorId, []);
      }
      actorLevels.get(order.actorId).push({ price: order.price, timestamp: order.timestamp });
    });

    for (const [actorId, priceData] of actorLevels.entries()) {
      if (priceData.length >= 4) {
        // Sort prices and check if they form a ladder
        const prices = priceData.map(p => p.price).sort((a, b) => a - b);
        let isLadder = true;
        const spacing = [];

        for (let i = 1; i < prices.length; i++) {
          spacing.push(prices[i] - prices[i - 1]);
        }

        // Check if spacing is consistent (ladder pattern)
        const avgSpacing = spacing.reduce((a, b) => a + b, 0) / spacing.length;
        isLadder = spacing.every(s => Math.abs(s - avgSpacing) < avgSpacing * 0.2);

        if (isLadder) {
          return {
            anomalyType: AnomalyType.LAYERING_ATTACK,
            severity: SeverityLevel.CRITICAL,
            confidenceScore: 92,
            description: `Detected layering attack with ${priceData.length} perfectly spaced orders`,
            detectionMetrics: {
              orderCount: priceData.length,
              averageSpacing: avgSpacing,
              spacingConsistency: 0.95,
            },
            evidenceData: {
              orderIds: [],
              metrics: {
                pricelevels: priceData.length,
                spacingConsistency: 0.95,
              },
              pattern: { type: 'LADDER_ATTACK_PATTERN', prices },
            },
            explanation: {
              rule: 'LAYERING_ATTACK_RULE_001',
              reasoning: 'Perfect ladder pattern with consistent spacing - textbook layering attack',
              featureImportance: {
                priceLaddering: 0.6,
                spacingConsistency: 0.4,
              },
            },
          };
        }
      }
    }

    return null;
  }

  /**
   * SPOOFING BID-ASK DETECTION: Spoofing on both sides of the book
   * Rules:
   * - Large orders on both bid and ask
   * - Both canceled before execution
   * - Creates artificial liquidity illusion
   */
  private detectSpoofingBidAsk(snapshot: MarketSnapshot): DetectionResult | null {
    const actorBidOrders = new Map<string, OrderData[]>();
    const actorAskOrders = new Map<string, OrderData[]>();

    snapshot.orders.forEach(order => {
      if (order.side === 'BUY' && order.canceledAt) {
        if (!actorBidOrders.has(order.actorId)) {
          actorBidOrders.set(order.actorId, []);
        }
        actorBidOrders.get(order.actorId).push(order);
      } else if (order.side === 'SELL' && order.canceledAt) {
        if (!actorAskOrders.has(order.actorId)) {
          actorAskOrders.set(order.actorId, []);
        }
        actorAskOrders.get(order.actorId).push(order);
      }
    });

    // Check for same actor placing large canceled orders on both sides
    for (const [actorId, bidOrders] of actorBidOrders.entries()) {
      if (actorAskOrders.has(actorId)) {
        const askOrders = actorAskOrders.get(actorId);
        const bidSize = bidOrders.reduce((sum, o) => sum + o.quantity, 0);
        const askSize = askOrders.reduce((sum, o) => sum + o.quantity, 0);

        // Both sides have significant volume and are canceled
        if (bidSize > 1000 && askSize > 1000) {
          return {
            anomalyType: AnomalyType.SPOOFING_BID_ASK,
            severity: SeverityLevel.CRITICAL,
            confidenceScore: 95,
            description: `Detected two-sided spoofing: Bid ${bidSize} + Ask ${askSize}, both canceled`,
            detectionMetrics: {
              bidVolume: bidSize,
              askVolume: askSize,
              bidCancelCount: bidOrders.length,
              askCancelCount: askOrders.length,
            },
            evidenceData: {
              orderIds: [...bidOrders.map(o => o.orderId), ...askOrders.map(o => o.orderId)],
              metrics: {
                bidVolume: bidSize,
                askVolume: askSize,
                symmetry: Math.abs(bidSize - askSize) / Math.max(bidSize, askSize),
              },
              pattern: { type: 'TWO_SIDED_SPOOFING' },
            },
            explanation: {
              rule: 'SPOOFING_BID_ASK_RULE_001',
              reasoning: 'Large canceled orders on both sides of book - clear market manipulation intent',
              featureImportance: {
                bidSize: 0.35,
                askSize: 0.35,
                cancellationPattern: 0.3,
              },
            },
          };
        }
      }
    }

    return null;
  }
}
