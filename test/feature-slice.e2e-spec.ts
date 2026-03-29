import { Test, TestingModule } from '@nestjs/testing';
import { gunzipSync } from 'zlib';
import { AppModule } from '../src/app.module';
import { GovernanceController } from '../src/governance/governance.controller';
import { LiquidityMiningController } from '../src/liquidity-mining/liquidity-mining.controller';
import { MobileController } from '../src/mobile/mobile.controller';
import { PlatformController } from '../src/platform/platform.controller';
import { OptionsController } from '../src/options/options.controller';

describe('Feature Slice Integration', () => {
  let moduleRef: TestingModule;
  let governanceController: GovernanceController;
  let optionsController: OptionsController;
  let liquidityMiningController: LiquidityMiningController;
  let mobileController: MobileController;
  let platformController: PlatformController;

  jest.setTimeout(20000);

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    governanceController = moduleRef.get(GovernanceController);
    optionsController = moduleRef.get(OptionsController);
    liquidityMiningController = moduleRef.get(LiquidityMiningController);
    mobileController = moduleRef.get(MobileController);
    platformController = moduleRef.get(PlatformController);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('runs governance, options, liquidity, and mobile flows through wired controllers', async () => {
    const userId = Number(`${Date.now()}`.slice(-6));
    const counterpartyUserId = userId + 1;

    await governanceController.upsertStake({ userId, stakedAmount: 250 });

    const proposal = await governanceController.createProposal({
      title: 'Upgrade fees',
      description: 'Reduce taker fees for the next protocol epoch.',
      proposerUserId: userId,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 60_000).toISOString(),
      quorumThreshold: 100,
      executable: true,
    });

    await governanceController.castVote(proposal.id, {
      voterUserId: userId,
      choice: 'YES' as never,
    });

    const tallied = await governanceController.tally(proposal.id);
    expect(tallied.status).toBe('SUCCEEDED');

    const contract = await optionsController.createContract({
      underlyingAsset: 'BTC',
      optionType: 'CALL' as never,
      strikePrice: 50000,
      expiryAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      markPrice: 52000,
      contractSize: 1,
      volatility: 0.45,
    });

    await optionsController.placeOrder(contract.id, {
      userId: counterpartyUserId,
      side: 'SELL' as never,
      orderType: 'LIMIT' as never,
      quantity: 1,
      limitPrice: 1200,
    });

    await optionsController.placeOrder(contract.id, {
      userId,
      side: 'BUY' as never,
      orderType: 'MARKET' as never,
      quantity: 1,
    });

    const pool = await liquidityMiningController.createPool({
      pairSymbol: 'BTC/USDC',
      currentDepth: 10000,
      targetDepth: 20000,
      baseApr: 14,
      rewardToken: 'SWAP',
      contractAddress: '0xpool-1',
    });

    const program = await liquidityMiningController.createProgram({
      poolId: pool.id,
      startAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      vestingDays: 7,
      rewardBudget: 100000,
    });

    await liquidityMiningController.stake({
      userId,
      poolId: pool.id,
      programId: program.id,
      amount: 500,
    });

    const response = createMockResponse();
    await mobileController.dashboard(
      String(userId),
      { headers: { 'accept-encoding': 'gzip' } } as never,
      response as never,
    );

    expect(response.headers['Content-Encoding']).toBe('gzip');
    expect(response.headers.ETag).toBeDefined();

    const inflated = JSON.parse(gunzipSync(response.payload as Buffer).toString('utf-8'));
    expect(inflated.governance.recent.length).toBeGreaterThanOrEqual(1);
    expect(
      inflated.governance.recent.some(
        (entry: { id: string; status: string }) => entry.id === proposal.id && entry.status === 'SUCCEEDED',
      ),
    ).toBe(true);
    expect(inflated.options.positions).toHaveLength(1);
    expect(inflated.liquidity.totalStaked).toBe(500);

    const notModifiedResponse = createMockResponse();
    await mobileController.dashboard(
      String(userId),
      { headers: { 'if-none-match': response.headers.ETag } } as never,
      notModifiedResponse as never,
    );
    expect(notModifiedResponse.statusCode).toBe(304);

    const metrics = platformController.mobileMetrics();
    expect(metrics.requestCount).toBeGreaterThanOrEqual(2);
  });
});

function createMockResponse() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    payload: undefined as Buffer | undefined,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload?: Buffer) {
      this.payload = payload;
      return this;
    },
    json(payload: unknown) {
      this.payload = Buffer.from(JSON.stringify(payload));
      return this;
    },
  };
}
