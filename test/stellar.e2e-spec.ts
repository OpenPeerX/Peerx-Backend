// test/stellar.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { StellarModule } from '../src/stellar/stellar.module';
import { StellarService } from '../src/stellar/stellar.service';
import { ConfigModule } from '../src/config/config.module';

describe('StellarController (e2e)', () => {
  let app: INestApplication;
  
  // Mock public key and balances
  const validPublicKey = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
  const invalidPublicKey = 'INVALID_KEY';
  const nonExistentPublicKey = 'GDRS654HGODN5U7R7Z4ND2S7I3M7B2R6X7B2D2X7B2D2X7B2D2X7B2D2'; // Valid format but doesn't exist

  const mockStellarService = {
    getUsdcBalance: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule, StellarModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .compile();

    app = moduleFixture.createNestApplication();
    // Path prefix is set globally in main.ts/api-versioning.ts, 
    // but in tests we need to manually set it if we want to match /api/...
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/stellar/balance/:publicKey', () => {
    it('should return 200 and the USDC balance for a valid public key', async () => {
      const mockBalance = '150.75';
      mockStellarService.getUsdcBalance.mockResolvedValue(mockBalance);

      const response = await request(app.getHttpServer())
        .get(`/api/stellar/balance/${validPublicKey}`)
        .expect(HttpStatus.OK);

      expect(response.body).toEqual({
        publicKey: validPublicKey,
        asset: 'USDC',
        balance: mockBalance,
      });
      expect(mockStellarService.getUsdcBalance).toHaveBeenCalledWith(validPublicKey);
    });

    it('should return 400 for an invalid public key format', async () => {
      await request(app.getHttpServer())
        .get(`/api/stellar/balance/${invalidPublicKey}`)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 if the account is not found on the network', async () => {
      mockStellarService.getUsdcBalance.mockRejectedValue({
        response: { status: 404 },
        message: 'Not Found'
      });

      await request(app.getHttpServer())
        .get(`/api/stellar/balance/${nonExistentPublicKey}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 500 for other unexpected errors from the network', async () => {
      mockStellarService.getUsdcBalance.mockRejectedValue(new Error('Stellar network error'));

      await request(app.getHttpServer())
        .get(`/api/stellar/balance/${validPublicKey}`)
        .expect(HttpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
