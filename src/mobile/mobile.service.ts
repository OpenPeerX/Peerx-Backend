import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { GovernanceService } from '../governance/governance.service';
import { LiquidityMiningService } from '../liquidity-mining/liquidity-mining.service';
import { OptionsService } from '../options/options.service';
import { MobileCacheService } from '../platform/mobile-cache.service';

@Injectable()
export class MobileService {
  constructor(
    private readonly governanceService: GovernanceService,
    private readonly optionsService: OptionsService,
    private readonly liquidityMiningService: LiquidityMiningService,
    private readonly mobileCacheService: MobileCacheService,
  ) {}

  async getDashboard(userId: number) {
    const cacheKey = `mobile-dashboard:${userId}`;
    const cached = this.mobileCacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return { cached: true, data: cached };
    }

    const [proposals, positions, liquidity] = await Promise.all([
      this.governanceService.listProposals(),
      this.optionsService.getPositions(userId),
      this.liquidityMiningService.getDashboard(userId),
    ]);

    const data = {
      generatedAt: new Date().toISOString(),
      governance: {
        activeProposalCount: proposals.filter((proposal) => proposal.status === 'ACTIVE').length,
        recent: proposals.slice(0, 5),
      },
      options: {
        positions,
      },
      liquidity,
    };

    this.mobileCacheService.set(cacheKey, data, 30_000, [
      'mobile-dashboard',
      `mobile-user:${userId}`,
    ]);
    return { cached: false, data };
  }

  async getOptionsSnapshot(underlyingAsset: string) {
    const cacheKey = `mobile-options:${underlyingAsset}`;
    const cached = this.mobileCacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return { cached: true, data: cached };
    }
    const chain = await this.optionsService.getOptionChain(underlyingAsset);
    const data = {
      underlyingAsset,
      contracts: chain,
    };
    this.mobileCacheService.set(cacheKey, data, 30_000, ['mobile-dashboard', 'mobile-options']);
    return { cached: false, data };
  }

  createEtag(payload: unknown): string {
    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  }
}
