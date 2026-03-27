import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '@nestjs/config';

// Mock StellarSdk
jest.mock('stellar-sdk', () => {
  return {
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        ledgers: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        call: jest.fn().mockResolvedValue({
          records: [
            {
              sequence: 12345,
              closed_at: '2026-03-27T00:00:00Z',
            },
          ],
        }),
      })),
    },
  };
});

describe('StellarService', () => {
  let service: StellarService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('https://horizon-testnet.stellar.org'),
          },
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should poll stellar network successfully', async () => {
    const loggerSpy = jest.spyOn((service as any).logger, 'log');

    await service.pollStellarNetwork();

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Latest Stellar Ledger: 12345'));
  });

  it('should handle polling failure gracefully', async () => {
    const serverInstance = (service as any).server;
    jest.spyOn(serverInstance.ledgers(), 'call').mockRejectedValueOnce(new Error('Connection failed'));
    const loggerSpy = jest.spyOn((service as any).logger, 'error');

    await service.pollStellarNetwork();

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to poll Stellar network: Connection failed'));
  });
});
