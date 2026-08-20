import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { CrossChainBridgeService } from './cross-chain-bridge.service';
import {
  CrossChainBridge,
  BridgeStatus,
} from '../entities/cross-chain-bridge.entity';
import { BridgeApproval } from '../entities/bridge-approval.entity';
import { BlockchainNetwork } from '../entities/blockchain-transaction.entity';
import { StellarService } from './stellar.service';
import { BlockchainException } from '../../error/exceptions/blockchain.exception';

// uuid@14 ships ESM-only dist files that ts-jest cannot load; the service
// chain (StellarService → correlation-id) imports it transitively, so provide
// a CJS mock to keep this spec runnable under the default jest config.
jest.mock('uuid', () => ({ v4: () => 'fixed-uuid-v4' }));

const mockBridgeRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const mockStellarService = () => ({
  withdraw: jest.fn(),
});

const bridgeConfig = {
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === 'BRIDGE_MULTISIG_THRESHOLD') return 2;
    if (key === 'BRIDGE_SIGNER_IDS') return 'signer-1,signer-2,signer-3';
    return fallback;
  }),
};

describe('CrossChainBridgeService', () => {
  let service: CrossChainBridgeService;
  let bridgeRepo: ReturnType<typeof mockBridgeRepo>;
  let stellarService: jest.Mocked<StellarService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossChainBridgeService,
        { provide: ConfigService, useValue: bridgeConfig },
        {
          provide: getRepositoryToken(CrossChainBridge),
          useFactory: mockBridgeRepo,
        },
        {
          provide: getRepositoryToken(BridgeApproval),
          useFactory: () => ({
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          }),
        },
        { provide: StellarService, useFactory: mockStellarService },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (cb) =>
              cb({
                findOne: jest.fn(),
                getRepository: jest.fn(),
                createQueryBuilder: jest.fn(),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(CrossChainBridgeService);
    bridgeRepo = module.get(getRepositoryToken(CrossChainBridge));
    stellarService = module.get(StellarService);
  });

  describe('initiateBridge', () => {
    it('creates and saves a bridge record', async () => {
      const bridge = {
        id: 'b1',
        status: BridgeStatus.INITIATED,
      } as CrossChainBridge;
      bridgeRepo.create.mockReturnValue(bridge);
      bridgeRepo.save.mockResolvedValue(bridge);

      const result = await service.initiateBridge(
        'user-1',
        BlockchainNetwork.ETHEREUM,
        BlockchainNetwork.STELLAR,
        '0xABC',
        'GDEST',
        '100',
      );

      expect(bridgeRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: BridgeStatus.INITIATED,
          multisigThreshold: 2,
        }),
      );
      expect(result).toBe(bridge);
    });
  });

  describe('getBridgeHealth', () => {
    it('returns healthy when locked amount is below threshold', async () => {
      bridgeRepo.count.mockResolvedValue(1);
      bridgeRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '500' }),
      });

      const result = await service.getBridgeHealth();
      expect(result.healthy).toBe(true);
      expect(result.alertMessage).toBeUndefined();
    });

    it('returns unhealthy when locked amount exceeds threshold', async () => {
      bridgeRepo.count.mockResolvedValue(5);
      bridgeRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '15000' }),
      });

      const result = await service.getBridgeHealth();
      expect(result.healthy).toBe(false);
      expect(result.alertMessage).toContain('15000');
    });
  });
});

/**
 * Real-DB suite for the signer-aware approval flow.
 *
 * The unique (bridgeId, signerId) constraint is enforced by a real in-memory
 * SQLite DataSource (BridgeApproval has no postgres-only column types). The
 * bridge row itself cannot be created on sqlite because CrossChainBridge uses
 * a `jsonb` column, so the bridge counter is modeled in memory and the atomic
 * `multisigApprovals + 1` UPDATE is applied atomically — which is exactly the
 * guarantee the service relies on, and is what distinguishes the fix from the
 * old `bridge.multisigApprovals += 1` read-modify-write.
 */
describe('CrossChainBridgeService — signer-bound approvals', () => {
  let dataSource: DataSource;
  let service: CrossChainBridgeService;
  let stellarService: { withdraw: jest.Mock };

  // Shared, mutable bridge state — concurrent service calls interleave on it
  // exactly like concurrent DB transactions would.
  const bridgeRows = new Map<string, any>();
  const bridgeSave = jest.fn();

  const makeBridge = (overrides: Partial<CrossChainBridge> = {}) => ({
    id: 'b1',
    userId: 'user-1',
    sourceNetwork: BlockchainNetwork.ETHEREUM,
    destinationNetwork: BlockchainNetwork.STELLAR,
    sourceAddress: '0xSRC',
    destinationAddress: 'GDEST',
    amount: '50',
    status: BridgeStatus.INITIATED,
    multisigApprovals: 0,
    multisigThreshold: 2,
    ...overrides,
  });

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [BridgeApproval],
      synchronize: true,
    });
    await dataSource.initialize();

    const approvalRepo = dataSource.getRepository(BridgeApproval);

    // Manager that reads/writes the in-memory bridge model and delegates
    // approval persistence to the real sqlite repository.
    const manager: any = {
      findOne: jest.fn(async (entity: any, opts: any) => {
        if (entity === CrossChainBridge) {
          return bridgeRows.get(opts.where.id) ?? null;
        }
        if (entity === BridgeApproval) {
          return approvalRepo.findOne({
            where: {
              bridgeId: opts.where.bridgeId,
              signerId: opts.where.signerId,
            },
          });
        }
        return null;
      }),
      getRepository: jest.fn(() => approvalRepo),
      createQueryBuilder: jest.fn(() => {
        let updateFn: ((row: any) => void) | null = null;
        let whereId: string | undefined;
        let statuses: string[] = [];
        const builder: any = {
          update: jest.fn(() => builder),
          set: jest.fn((expr: Record<string, () => string>) => {
            // Atomic UPDATE: apply the raw SQL expression, never a stale
            // in-memory value captured before the write.
            updateFn = (row) => {
              if (expr.multisigApprovals) {
                // multisigApprovals = multisigApprovals + 1
                row.multisigApprovals = Number(row.multisigApprovals) + 1;
              }
              if (expr.status) {
                row.status = expr.status;
              }
            };
            return builder;
          }),
          where: jest.fn((_cond: string, params: any) => {
            whereId = params.id;
            return builder;
          }),
          andWhere: jest.fn((_cond: string, params: any) => {
            statuses = params.statuses ?? [];
            return builder;
          }),
          execute: jest.fn(async () => {
            const row = bridgeRows.get(whereId!);
            if (!row) return { affected: 0 };
            if (statuses.length > 0 && !statuses.includes(row.status)) {
              return { affected: 0 };
            }
            updateFn?.(row);
            return { affected: 1 };
          }),
        };
        return builder;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CrossChainBridgeService,
        { provide: ConfigService, useValue: bridgeConfig },
        {
          provide: getRepositoryToken(CrossChainBridge),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: bridgeSave,
          },
        },
        {
          provide: getRepositoryToken(BridgeApproval),
          useValue: approvalRepo,
        },
        { provide: StellarService, useValue: { withdraw: jest.fn() } },
        {
          provide: DataSource,
          useValue: { transaction: async (cb: any) => cb(manager) },
        },
      ],
    }).compile();

    service = module.get(CrossChainBridgeService);
    stellarService = module.get(StellarService);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource
      .getRepository(BridgeApproval)
      .createQueryBuilder()
      .delete()
      .execute();
    bridgeRows.clear();
    bridgeSave.mockReset();
    bridgeSave.mockImplementation(async (b: any) => {
      bridgeRows.set(b.id, b);
      return b;
    });
    stellarService.withdraw.mockReset();
    stellarService.withdraw.mockResolvedValue({ txHash: 'tx_hash' });
  });

  it('throws if bridge not found', async () => {
    await expect(service.addApproval('missing-id', 'signer-1')).rejects.toThrow(
      BlockchainException,
    );
  });

  it('rejects a signer that is not in the authorized set', async () => {
    bridgeRows.set('b1', makeBridge());

    await expect(service.addApproval('b1', 'unknown-signer')).rejects.toThrow(
      BlockchainException,
    );
  });

  it('rejects a bridge that is not awaiting approvals', async () => {
    bridgeRows.set('b1', makeBridge({ status: BridgeStatus.COMPLETED }));

    await expect(service.addApproval('b1', 'signer-1')).rejects.toThrow(
      BlockchainException,
    );
  });

  it('rejects a second approval from the same signer (unique constraint)', async () => {
    bridgeRows.set('b1', makeBridge());
    await service.addApproval('b1', 'signer-1');

    await expect(service.addApproval('b1', 'signer-1')).rejects.toThrow(
      BlockchainException,
    );
  });

  it('increments approval count without executing below threshold', async () => {
    bridgeRows.set('b1', makeBridge());

    const result = await service.addApproval('b1', 'signer-1');
    expect(result.multisigApprovals).toBe(1);
    expect(result.status).toBe(BridgeStatus.INITIATED);
    expect(stellarService.withdraw).not.toHaveBeenCalled();
  });

  it('a single signer cannot reach the threshold alone', async () => {
    bridgeRows.set('b1', makeBridge());

    await service.addApproval('b1', 'signer-1');
    await expect(service.addApproval('b1', 'signer-1')).rejects.toThrow(
      BlockchainException,
    );

    const after = bridgeRows.get('b1');
    expect(after.multisigApprovals).toBe(1);
    expect(after.status).toBe(BridgeStatus.INITIATED);
    expect(stellarService.withdraw).not.toHaveBeenCalled();
  });

  it('executes the bridge exactly once when the threshold is reached', async () => {
    bridgeRows.set('b1', makeBridge());

    await service.addApproval('b1', 'signer-1');
    const result = await service.addApproval('b1', 'signer-2');

    expect(result.status).toBe(BridgeStatus.COMPLETED);
    expect(stellarService.withdraw).toHaveBeenCalledTimes(1);
    expect(stellarService.withdraw).toHaveBeenCalledWith(
      'user-1',
      'GDEST',
      '50',
      'bridge:b1',
    );
  });

  it('refunds on bridge execution failure', async () => {
    stellarService.withdraw.mockRejectedValueOnce(new Error('network error'));
    bridgeRows.set(
      'b1',
      makeBridge({ sourceNetwork: BlockchainNetwork.STELLAR }),
    );

    await service.addApproval('b1', 'signer-1');
    await expect(service.addApproval('b1', 'signer-2')).rejects.toThrow(
      BlockchainException,
    );

    const after = bridgeRows.get('b1');
    expect(stellarService.withdraw).toHaveBeenCalledTimes(2); // execute + refund
    expect(after.status).toBe(BridgeStatus.REFUNDED);
  });

  it('does not drop an approval when approvals race (no lost update)', async () => {
    bridgeRows.set('b1', makeBridge());

    await Promise.all([
      service.addApproval('b1', 'signer-1'),
      service.addApproval('b1', 'signer-2'),
    ]);

    const after = bridgeRows.get('b1');
    expect(after.multisigApprovals).toBe(2);

    const approvals = await dataSource
      .getRepository(BridgeApproval)
      .find({ where: { bridgeId: 'b1' } });
    expect(approvals).toHaveLength(2);
    expect(stellarService.withdraw).toHaveBeenCalledTimes(1);
  });

  it('does not double-execute when the threshold is crossed in parallel', async () => {
    bridgeRows.set('b1', makeBridge({ multisigApprovals: 1 }));

    await Promise.all([
      service.addApproval('b1', 'signer-1'),
      service.addApproval('b1', 'signer-2'),
    ]);

    // Only the transaction that flipped the status may execute.
    expect(stellarService.withdraw).toHaveBeenCalledTimes(1);
  });
});
