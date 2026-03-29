import { BadRequestException } from '@nestjs/common';
import { OptionsService } from './options.service';
import { OptionContractStatus, OptionType } from './entities/option-contract.entity';
import { OptionOrderSide, OptionOrderType } from './entities/option-order.entity';

describe('OptionsService', () => {
  const createRepository = () => ({
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    find: jest.fn(),
    save: jest.fn(async (value) => value),
    create: jest.fn((value) => value),
  });

  it('requires a price for limit orders', async () => {
    const contractRepository = createRepository();
    const orderRepository = createRepository();
    const positionRepository = createRepository();
    const auditService = { log: jest.fn() };
    const mobileCacheService = { invalidateTag: jest.fn() };

    contractRepository.findOne.mockResolvedValue({
      id: 'contract-1',
      status: OptionContractStatus.ACTIVE,
      optionType: OptionType.CALL,
      strikePrice: 100,
      markPrice: 110,
      contractSize: 1,
      volatility: 0.4,
      expiryAt: new Date(Date.now() + 60_000),
    });

    const service = new OptionsService(
      contractRepository as never,
      orderRepository as never,
      positionRepository as never,
      auditService as never,
      mobileCacheService as never,
    );

    await expect(
      service.placeOrder('contract-1', {
        userId: 5,
        side: OptionOrderSide.BUY,
        orderType: OptionOrderType.LIMIT,
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
