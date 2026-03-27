import { Test, TestingModule } from '@nestjs/testing';
import { ExchangeRateService } from './exchange-rate.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ExchangeRateService', () => {
  let service: ExchangeRateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ExchangeRateService],
    }).compile();

    service = module.get<ExchangeRateService>(ExchangeRateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should sync exchange rates successfully', async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: {
        rates: {
          EUR: 0.85,
          GBP: 0.75,
        },
      },
    });

    await service.syncExchangeRates();

    expect(service.getRates()).toEqual({ EUR: 0.85, GBP: 0.75 });
    expect(service.getLastUpdate()).toBeDefined();
  });

  it('should handle API failure gracefully', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('API Down'));
    const loggerSpy = jest.spyOn((service as any).logger, 'error');

    await service.syncExchangeRates();

    expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to sync exchange rates: API Down'));
    expect(service.getRates()).toEqual({});
    expect(service.getLastUpdate()).toBeNull();
  });
});
