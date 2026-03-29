import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, And } from 'typeorm';
import { FXRate } from '../entities/fx-rate.entity';
import {
  CreateFXRateDto,
  UpdateFXRateDto,
  ConversionResultDto,
  FXRateHistoryDto,
  VolatilityAlertDto,
} from '../dto/fx-rate.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class FXRateService {
  private readonly logger = new Logger(FXRateService.name);

  constructor(
    @InjectRepository(FXRate)
    private fxRateRepository: Repository<FXRate>,
  ) {}

  /**
   * Create or update FX rate
   */
  async upsertFXRate(dto: CreateFXRateDto): Promise<FXRate> {
    const { fromCurrency, toCurrency, rate, source } = dto;

    let fxRate = await this.fxRateRepository.findOne({
      where: { fromCurrency, toCurrency, isActive: true },
      order: { timestamp: 'DESC' },
    });

    if (fxRate && fxRate.expiration > new Date()) {
      // Update existing active rate
      fxRate.rate = new Decimal(rate).toNumber();
      fxRate.source = source;
      fxRate.confidence = dto.confidence ?? 85;
      fxRate.minRate = dto.minRate ?? new Decimal(rate).times(0.99).toNumber();
      fxRate.maxRate = dto.maxRate ?? new Decimal(rate).times(1.01).toNumber();
      fxRate.metadata = dto.metadata ?? null;

      // Calculate historical changes
      const previous24h = await this.get24hAverageRate(fromCurrency, toCurrency);
      if (previous24h) {
        const change = new Decimal(rate).minus(previous24h).dividedBy(previous24h).times(100);
        fxRate.changePercent24h = change.toNumber();
      }
    } else {
      // Create new rate
      fxRate = this.fxRateRepository.create({
        fromCurrency,
        toCurrency,
        rate: new Decimal(rate).toNumber(),
        source,
        sourceUrl: dto.sourceUrl,
        confidence: dto.confidence ?? 85,
        minRate: dto.minRate ?? new Decimal(rate).times(0.99).toNumber(),
        maxRate: dto.maxRate ?? new Decimal(rate).times(1.01).toNumber(),
        timestamp: new Date(),
        expiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isActive: true,
        metadata: dto.metadata,
      });
    }

    // Calculate volatility
    fxRate.volatilityIndex = await this.calculateVolatilityIndex(fromCurrency, toCurrency);

    await this.fxRateRepository.save(fxRate);
    this.logger.log(`FX Rate updated: ${fromCurrency}/${toCurrency} = ${rate}`);

    return fxRate;
  }

  /**
   * Convert amount from one currency to another
   */
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    preferredSource?: string,
  ): Promise<ConversionResultDto> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (fromCurrency === toCurrency) {
      return {
        amount,
        fromCurrency,
        toCurrency,
        convertedAmount: amount,
        fxRate: 1,
        source: 'IDENTITY',
        confidence: 100,
        timestamp: new Date(),
        expiration: new Date(),
      };
    }

    // Get active FX rate
    let fxRate = await this.getActiveRate(fromCurrency, toCurrency, preferredSource);

    // If not found, try reverse conversion
    if (!fxRate) {
      const reverseRate = await this.getActiveRate(toCurrency, fromCurrency, preferredSource);
      if (reverseRate) {
        const rate = new Decimal(1).dividedBy(reverseRate.rate);
        return {
          amount,
          fromCurrency,
          toCurrency,
          convertedAmount: new Decimal(amount).times(rate).toNumber(),
          fxRate: rate.toNumber(),
          source: reverseRate.source,
          confidence: reverseRate.confidence,
          timestamp: reverseRate.timestamp,
          expiration: reverseRate.expiration,
          volatilityIndex: reverseRate.volatilityIndex,
        };
      }
    }

    if (!fxRate) {
      throw new NotFoundException(`No FX rate found for ${fromCurrency}/${toCurrency}`);
    }

    // Check if rate is expired
    if (fxRate.expiration < new Date()) {
      this.logger.warn(`FX rate expired: ${fromCurrency}/${toCurrency}`);
      throw new BadRequestException('FX rate has expired');
    }

    const convertedAmount = new Decimal(amount).times(fxRate.rate).toNumber();

    this.logger.debug(
      `Converted ${amount} ${fromCurrency} to ${convertedAmount} ${toCurrency} at rate ${fxRate.rate}`,
    );

    return {
      amount,
      fromCurrency,
      toCurrency,
      convertedAmount,
      fxRate: fxRate.rate,
      source: fxRate.source,
      confidence: fxRate.confidence,
      timestamp: fxRate.timestamp,
      expiration: fxRate.expiration,
      volatilityIndex: fxRate.volatilityIndex,
    };
  }

  /**
   * Get active FX rate
   */
  async getActiveRate(
    fromCurrency: string,
    toCurrency: string,
    preferredSource?: string,
  ): Promise<FXRate | null> {
    const query = this.fxRateRepository
      .createQueryBuilder('fx')
      .where('fx.fromCurrency = :fromCurrency', { fromCurrency })
      .andWhere('fx.toCurrency = :toCurrency', { toCurrency })
      .andWhere('fx.isActive = true')
      .andWhere('fx.expiration > :now', { now: new Date() })
      .orderBy('fx.confidence', 'DESC')
      .addOrderBy('fx.timestamp', 'DESC')
      .limit(1);

    if (preferredSource) {
      query.andWhere('fx.source = :source', { source: preferredSource });
    }

    return query.getOne();
  }

  /**
   * Get FX rate history
   */
  async getHistory(dto: FXRateHistoryDto): Promise<FXRate[]> {
    const { fromCurrency, toCurrency, days = 30 } = dto;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.fxRateRepository
      .createQueryBuilder('fx')
      .where('fx.fromCurrency = :fromCurrency', { fromCurrency })
      .andWhere('fx.toCurrency = :toCurrency', { toCurrency })
      .andWhere('fx.timestamp >= :cutoffDate', { cutoffDate })
      .orderBy('fx.timestamp', 'DESC')
      .skip(dto.skipRecords ?? 0)
      .take(dto.takeRecords ?? 100)
      .getMany();
  }

  /**
   * Calculate volatility index (0-100)
   */
  async calculateVolatilityIndex(fromCurrency: string, toCurrency: string): Promise<number> {
    const history = await this.getHistory({
      fromCurrency,
      toCurrency,
      days: 30,
      skipRecords: 0,
      takeRecords: 1000,
    });

    if (history.length < 10) {
      return 0;
    }

    const rates = history.map((h) => new Decimal(h.rate));
    const average = rates.reduce((a, b) => a.plus(b)).dividedBy(rates.length);

    // Calculate standard deviation
    const variance = rates
      .map((r) => r.minus(average).pow(2))
      .reduce((a, b) => a.plus(b))
      .dividedBy(rates.length);

    const stdDev = variance.sqrt();
    const coefficient = stdDev.dividedBy(average);

    // Convert to 0-100 scale (higher CV = higher volatility)
    // Typical CV ranges from 0.01 to 0.5 for most currencies
    const volatility = Math.min(100, coefficient.times(100).toNumber());

    return volatility;
  }

  /**
   * Get 24h average rate
   */
  private async get24hAverageRate(fromCurrency: string, toCurrency: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await this.fxRateRepository
      .createQueryBuilder('fx')
      .select('AVG(fx.rate)', 'average')
      .where('fx.fromCurrency = :fromCurrency', { fromCurrency })
      .andWhere('fx.toCurrency = :toCurrency', { toCurrency })
      .andWhere('fx.timestamp >= :cutoffDate', { cutoffDate: twentyFourHoursAgo })
      .getRawOne();

    return result?.average ? parseFloat(result.average) : null;
  }

  /**
   * Check volatility alert
   */
  async checkVolatilityAlert(
    fromCurrency: string,
    toCurrency: string,
    threshold: number = 10,
  ): Promise<VolatilityAlertDto | null> {
    const currentRate = await this.getActiveRate(fromCurrency, toCurrency);
    if (!currentRate) {
      return null;
    }

    const volatility = await this.calculateVolatilityIndex(fromCurrency, toCurrency);

    if (volatility > threshold) {
      const change24h = currentRate.changePercent24h ?? 0;
      const change7d = currentRate.changePercent7d ?? 0;

      let severity = 'LOW';
      if (volatility > 50) severity = 'CRITICAL';
      else if (volatility > 30) severity = 'HIGH';
      else if (volatility > 20) severity = 'MEDIUM';

      return {
        fromCurrency,
        toCurrency,
        currentVolatility: volatility,
        threshold,
        changePercent24h: change24h,
        changePercent7d: change7d,
        severity,
      };
    }

    return null;
  }

  /**
   * Expire old rates
   */
  async expireOldRates(): Promise<number> {
    const result = await this.fxRateRepository.update(
      {
        expiration: LessThan(new Date()),
        isActive: true,
      },
      { isActive: false },
    );

    this.logger.log(`Expired ${result.affected} old FX rates`);
    return result.affected ?? 0;
  }

  /**
   * Get routing path for settlement
   */
  async getOptimalRoutingPath(
    fromCurrency: string,
    toCurrency: string,
    amount: number,
  ): Promise<{
    routingPath: string;
    expectedRate: number;
    estimatedFee: number;
    estimatedTime: number; // in minutes
  }> {
    const fxRate = await this.getActiveRate(fromCurrency, toCurrency);

    if (!fxRate) {
      throw new NotFoundException(`No FX rate found for optimal routing`);
    }

    // Determine optimal routing based on volatility and amount
    const volatility = fxRate.volatilityIndex ?? 0;
    let routine = 'DIRECT';
    let estimatedTime = 5; // minutes

    if (volatility > 30) {
      routine = 'BRIDGE'; // Use bridge if high volatility
      estimatedTime = 15;
    } else if (amount > 1000000) {
      routine = 'STABLECOIN_SWAP'; // Large amounts use stablecoin
      estimatedTime = 10;
    }

    const estimatedFee = new Decimal(amount).times(0.001).toNumber(); // 0.1% fee

    return {
      routingPath: routine,
      expectedRate: fxRate.rate,
      estimatedFee,
      estimatedTime,
    };
  }

  /**
   * Get FX statistics
   */
  async getFxStatistics(
    fromCurrency: string,
    toCurrency: string,
    days: number = 30,
  ): Promise<{
    minRate: number;
    maxRate: number;
    avgRate: number;
    volatility: number;
    changePercent: number;
  }> {
    const history = await this.getHistory({
      fromCurrency,
      toCurrency,
      days,
      skipRecords: 0,
      takeRecords: 1000,
    });

    if (history.length === 0) {
      throw new NotFoundException('No FX rate history found');
    }

    const rates = history.map((h) => new Decimal(h.rate));
    const minRate = Decimal.min(...rates).toNumber();
    const maxRate = Decimal.max(...rates).toNumber();
    const avgRate = rates.reduce((a, b) => a.plus(b)).dividedBy(rates.length).toNumber();
    const volatility = await this.calculateVolatilityIndex(fromCurrency, toCurrency);

    const firstRate = rates[rates.length - 1];
    const lastRate = rates[0];
    const changePercent = lastRate.minus(firstRate).dividedBy(firstRate).times(100).toNumber();

    return {
      minRate,
      maxRate,
      avgRate,
      volatility,
      changePercent,
    };
  }
}
