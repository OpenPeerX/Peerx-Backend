// src/stellar/stellar.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { StellarService } from './stellar.service';
import { ConfigService } from '../config/config.service';

describe('StellarService', () => {
  let service: StellarService;
  let configService: ConfigService;

  const mockConfigService = {
    stellar: {
      horizonUrl: 'https://horizon-testnet.stellar.org',
      usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StellarService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StellarService>(StellarService);
    configService = module.get<ConfigService>(ConfigService);
    
    // Manually trigger initialization if not handled by Nest testing
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize the horizon server', () => {
    const server = service.getServer();
    expect(server).toBeDefined();
    // In newer stellar-sdk versions, the server object has various properties
    expect(server.serverURL.toString()).toContain('horizon-testnet.stellar.org');
  });

  it('should return the correct USDC issuer', () => {
    expect(service.getUsdcIssuer()).toBe(mockConfigService.stellar.usdcIssuer);
  });

  describe('getServer', () => {
    it('should return the horizon server instance', () => {
      expect(service.getServer()).toBeDefined();
    });
  });

  describe('getUsdcBalance', () => {
    it('should filter balances and return the USDC balance for the configured issuer', async () => {
      const mockPublicKey = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
      const mockBalances = [
        { asset_type: 'native', balance: '100.0000000' },
        { asset_code: 'USDC', asset_issuer: mockConfigService.stellar.usdcIssuer, balance: '50.25' },
        { asset_code: 'OTHER', asset_issuer: 'OTHER_ISSUER', balance: '10.00' }
      ];

      jest.spyOn(service, 'getBalances').mockResolvedValue(mockBalances as any[]);
      
      const balance = await service.getUsdcBalance(mockPublicKey);
      expect(balance).toBe('50.25');
    });

    it('should return "0" if USDC balance is not found', async () => {
      const mockPublicKey = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
      const mockBalances = [
        { asset_type: 'native', balance: '100.0000000' }
      ];

      jest.spyOn(service, 'getBalances').mockResolvedValue(mockBalances as any[]);
      
      const balance = await service.getUsdcBalance(mockPublicKey);
      expect(balance).toBe('0');
    });
  });
});
