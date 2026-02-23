/**
 * Swap Service
 *
 * Orchestrates single, batch, and multi-leg swap execution.
 * Synchronous path retained for backward compatibility.
 * Async path routes through Bull job queue with slippage protection.
 */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Balance } from '../balance/balance.entity';
import { VirtualAsset } from '../trading/entities/virtual-asset.entity';
import { CreateSwapDto } from './dto/create-swap.dto';


@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  /** Default slippage tolerance: 0.5% */
  private readonly DEFAULT_SLIPPAGE = 0.005;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Balance)
    private readonly balanceRepo: Repository<Balance>,
    @InjectRepository(VirtualAsset)
    private readonly assetRepo: Repository<VirtualAsset>,

  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Primary entry point
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Execute or queue a swap depending on `dto.async`.
   *
   * - `async: false` (default) → synchronous execution, returns final balances.
   * - `async: true`            → queued execution, returns job/swap IDs immediately.
   * - `route` provided         → multi-leg saga execution via intermediate assets.
   */
  async executeSwap(
    dto: CreateSwapDto,
  ): Promise<SwapResult | AsyncSwapResult> {
    const { userId, from, to, amount } = dto;
    const slippage = dto.slippageTolerance ?? this.DEFAULT_SLIPPAGE;

    this.validateSwapRequest(dto);
    await this.assertAssetsExist(from, to);

    // ── Multi-leg path ───────────────────────────────────────────────────────
    if (dto.route && dto.route.length > 2) {
      return this.executeMultiLegSwap(userId, dto.route, amount, slippage);
    }

    // ── Get price quote and check liquidity ──────────────────────────────────
    const quote = await this.pricingService.getQuote(from, to, amount);

    const { sufficient } = await this.pricingService.checkLiquidity(
      from,
      to,
      amount,
    );
    if (!sufficient) {
      throw new BadRequestException(
        `Insufficient liquidity for ${from}→${to} swap of ${amount}`,
      );
    }

    // ── Async (queued) path ──────────────────────────────────────────────────
    if (dto.async) {
      return this.queueSingleSwap(userId, from, to, amount, slippage, quote);
    }

    // ── Synchronous path ─────────────────────────────────────────────────────
    return this.executeSyncSwap(userId, from, to, amount, slippage, quote);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Batch swap
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Submit multiple swaps as a single batch job.
   * Returns a batchId and jobId for status polling.
   */
  async executeBatchSwap(dto: BatchSwapDto): Promise<BatchSwapResponseDto> {
    const { userId, swaps, atomic = false } = dto;
    const batchId = uuidv4();

    // Quote and validate all legs upfront
    const quotes = await Promise.all(
      swaps.map(async (s) => {
        await this.assertAssetsExist(s.from, s.to);
        return this.pricingService.getQuote(s.from, s.to, s.amount);
      }),
    );

    // Persist all SwapHistory records immediately so callers can poll status
    const swapRecords = swaps.map((s, i) =>
      this.swapHistoryRepo.create({
        userId,
        fromAsset: s.from,
        toAsset: s.to,
        amountIn: s.amount,
        quotedRate: quotes[i].rate,
        slippageTolerance: s.slippageTolerance ?? this.DEFAULT_SLIPPAGE,
        status: SwapStatus.PENDING,
        swapType: SwapType.BATCH,
        batchId,
      }),
    );

    const saved = await this.swapHistoryRepo.save(swapRecords);
    const swapIds = saved.map((r) => r.id);

    // Queue the batch job
    const job = await this.queueService.addBatchSwapJob({
      type: 'batch',
      batchId,
      userId,
      atomic,
      swapIds,
    });

    // Attach job ID to records
    await this.swapHistoryRepo.update(swapIds, { jobId: String(job.id) });

    this.logger.log(
      `Batch swap queued: batchId=${batchId} jobId=${job.id} count=${swapIds.length}`,
    );

    return {
      batchId,
      jobIds: [String(job.id)],
      queued: swapIds.length,
      estimatedProcessingMs: swapIds.length * 50, // rough estimate
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Swap history
  // ──────────────────────────────────────────────────────────────────────────

  async getSwapHistory(
    userId: string,
    query: SwapHistoryQueryDto,
  ): Promise<SwapHistoryResponseDto> {
    const limit  = Math.min(query.limit  ?? 20, 100);
    const offset = query.offset ?? 0;

    const qb = this.swapHistoryRepo
      .createQueryBuilder('s')
      .where('s.userId = :userId', { userId })
      .orderBy('s.createdAt', 'DESC')
      .skip(offset)
      .take(limit);

    if (query.status)    qb.andWhere('s.status = :status', { status: query.status });
    if (query.fromAsset) qb.andWhere('s.fromAsset = :from', { from: query.fromAsset });
    if (query.toAsset)   qb.andWhere('s.toAsset = :to',   { to: query.toAsset });

    const [entries, total] = await qb.getManyAndCount();

    const data: SwapHistoryEntryDto[] = entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      fromAsset: e.fromAsset,
      toAsset: e.toAsset,
      amountIn: Number(e.amountIn),
      amountOut: e.amountOut !== null ? Number(e.amountOut) : null,
      quotedRate: Number(e.quotedRate),
      executedRate: e.executedRate !== null ? Number(e.executedRate) : null,
      slippageTolerance: Number(e.slippageTolerance),
      actualSlippage: e.actualSlippage !== null ? Number(e.actualSlippage) : null,
      priceImpact: e.priceImpact !== null ? Number(e.priceImpact) : null,
      status: e.status,
      swapType: e.swapType,
      route: e.route,
      retryCount: e.retryCount,
      errorMessage: e.errorMessage,
      jobId: e.jobId,
      batchId: e.batchId,
      executedAt: e.executedAt?.toISOString() ?? null,
      settledAt: e.settledAt?.toISOString() ?? null,
      createdAt: e.createdAt.toISOString(),
    }));

    return { data, total, limit, offset, hasMore: offset + limit < total };
  }

  /**
   * Get a single swap by ID (for status polling).
   */
  async getSwapById(userId: string, swapId: string): Promise<SwapHistoryEntryDto> {
    const swap = await this.swapHistoryRepo.findOne({
      where: { id: swapId, userId },
    });

    if (!swap) {
      throw new NotFoundException(`Swap ${swapId} not found`);
    }

    return {
      id: swap.id,
      userId: swap.userId,
      fromAsset: swap.fromAsset,
      toAsset: swap.toAsset,
      amountIn: Number(swap.amountIn),
      amountOut: swap.amountOut !== null ? Number(swap.amountOut) : null,
      quotedRate: Number(swap.quotedRate),
      executedRate: swap.executedRate !== null ? Number(swap.executedRate) : null,
      slippageTolerance: Number(swap.slippageTolerance),
      actualSlippage: swap.actualSlippage !== null ? Number(swap.actualSlippage) : null,
      priceImpact: swap.priceImpact !== null ? Number(swap.priceImpact) : null,
      status: swap.status,
      swapType: swap.swapType,
      route: swap.route,
      retryCount: swap.retryCount,
      errorMessage: swap.errorMessage,
      jobId: swap.jobId,
      batchId: swap.batchId,
      executedAt: swap.executedAt?.toISOString() ?? null,
      settledAt: swap.settledAt?.toISOString() ?? null,
      createdAt: swap.createdAt.toISOString(),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Legacy sync API — kept for backward compatibility with existing callers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * @deprecated Use executeSwap() with async: false instead.
   *             Retained for backward compatibility.
   */
  async swap(
    userId: string,
    fromSymbol: string,
    toSymbol: string,
    amount: number,
  ): Promise<SwapResult> {
    return this.executeSwap({
      userId,
      from: fromSymbol,
      to: toSymbol,
      amount,
      async: false,
    }) as Promise<SwapResult>;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private — synchronous swap execution
  // ──────────────────────────────────────────────────────────────────────────

  private async executeSyncSwap(
    userId: string,
    from: string,
    to: string,
    amount: number,
    slippageTolerance: number,
    quote: import('./swap-pricing.service').PriceQuote,
  ): Promise<SwapResult> {
    // Create a pending history record
    const historyRecord = await this.swapHistoryRepo.save(
      this.swapHistoryRepo.create({
        userId,
        fromAsset: from,
        toAsset: to,
        amountIn: amount,
        quotedRate: quote.rate,
        priceImpact: quote.priceImpact,
        slippageTolerance,
        status: SwapStatus.PENDING,
        swapType: SwapType.SINGLE,
        route: quote.route,
      }),
    );

    try {
      await this.swapHistoryRepo.update(historyRecord.id, {
        status: SwapStatus.PROCESSING,
      });

      const result = await this.dataSource.transaction(async (manager) => {
        return this.settlementService.settle(historyRecord.id, manager);
      });

      // Fetch updated balances for the response
      const [fromBalance, toBalance] = await Promise.all([
        this.balanceRepo.findOne({ where: { userId, asset: from } }),
        this.balanceRepo.findOne({ where: { userId, asset: to } }),
      ]);

      return {
        userId,
        from: { asset: from, balance: Number(fromBalance?.balance ?? 0) },
        to: { asset: to, balance: Number(toBalance?.balance ?? 0) },
      };
    } catch (err) {
      this.logger.error(`Sync swap failed: ${err.message}`);
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private — async (queued) single swap
  // ──────────────────────────────────────────────────────────────────────────

  private async queueSingleSwap(
    userId: string,
    from: string,
    to: string,
    amount: number,
    slippageTolerance: number,
    quote: import('./swap-pricing.service').PriceQuote,
  ): Promise<AsyncSwapResult> {
    const swapId = uuidv4();

    // Persist before queuing so the record exists for status polling
    await this.swapHistoryRepo.save(
      this.swapHistoryRepo.create({
        id: swapId,
        userId,
        fromAsset: from,
        toAsset: to,
        amountIn: amount,
        quotedRate: quote.rate,
        priceImpact: quote.priceImpact,
        slippageTolerance,
        status: SwapStatus.PENDING,
        swapType: SwapType.BATCH,
        route: quote.route,
      }),
    );

    const job = await this.queueService.addSingleSwapJob({
      type: 'single',
      swapId,
      userId,
      fromAsset: from,
      toAsset: to,
      amountIn: amount,
      slippageTolerance,
      quotedRate: quote.rate,
    });

    await this.swapHistoryRepo.update(swapId, { jobId: String(job.id) });

    return {
      swapId,
      jobId: String(job.id),
      status: SwapStatus.PENDING,
      quotedRate: quote.rate,
      estimatedAmountOut: quote.amountOut,
      priceImpact: quote.priceImpact,
      slippageTolerance,
    };
  }

