import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OptionsModule } from '../src/options/options.module';
import { OptionsService } from '../src/options/options.service';
import { OptionsController } from '../src/options/options.controller';
import { OptionContract, OptionContractStatus, OptionType } from '../src/options/entities/option-contract.entity';
import { OptionOrder, OptionOrderSide, OptionOrderType, OptionOrderStatus } from '../src/options/entities/option-order.entity';
import { OptionPosition } from '../src/options/entities/option-position.entity';
import { CreateOptionContractDto } from '../src/options/dto/create-option-contract.dto';
import { PlaceOptionOrderDto } from '../src/options/dto/place-option-order.dto';
import { CancelOptionOrderDto } from '../src/options/dto/cancel-option-order.dto';
import { UpdateOptionContractDto } from '../src/options/dto/update-option-contract.dto';

describe('Options Trading Integration Tests', () => {
  let module: TestingModule;
  let optionsService: OptionsService;
  let optionsController: OptionsController;

  beforeAll(async () => {
    const testConfig = {
      type: 'sqlite',
      database: ':memory:',
      entities: [OptionContract, OptionOrder, OptionPosition],
      synchronize: true,
    };

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testConfig),
        OptionsModule,
      ],
    }).compile();

    optionsService = module.get<OptionsService>(OptionsService);
    optionsController = module.get<OptionsController>(OptionsController);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Options Contract Management', () => {
    it('should create a new option contract', async () => {
      const dto: CreateOptionContractDto = {
        underlyingAsset: 'BTC',
        optionType: OptionType.CALL,
        strikePrice: 50000,
        expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        markPrice: 52000,
        contractSize: 1,
        volatility: 0.5,
      };

      const contract = await optionsController.createContract(dto);
      
      expect(contract).toBeDefined();
      expect(contract.underlyingAsset).toBe(dto.underlyingAsset);
      expect(contract.optionType).toBe(dto.optionType);
      expect(contract.strikePrice).toBe(dto.strikePrice);
      expect(contract.status).toBe(OptionContractStatus.ACTIVE);
    });

    it('should retrieve option contract by ID', async () => {
      const dto: CreateOptionContractDto = {
        underlyingAsset: 'ETH',
        optionType: OptionType.PUT,
        strikePrice: 3000,
        expiryAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        markPrice: 2800,
        contractSize: 10,
        volatility: 0.8,
      };

      const created = await optionsController.createContract(dto);
      const retrieved = await optionsController.getContract(created.id);
      
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.underlyingAsset).toBe(dto.underlyingAsset);
    });

    it('should update option contract', async () => {
      const dto: CreateOptionContractDto = {
        underlyingAsset: 'BTC',
        optionType: OptionType.CALL,
        strikePrice: 45000,
        expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        markPrice: 46000,
        contractSize: 1,
        volatility: 0.4,
      };

      const created = await optionsController.createContract(dto);
      const updateDto: UpdateOptionContractDto = {
        markPrice: 47000,
        volatility: 0.45,
      };

      const updated = await optionsController.updateContract(created.id, updateDto);
      
      expect(updated.markPrice).toBe(updateDto.markPrice);
      expect(updated.volatility).toBe(updateDto.volatility);
    });

    it('should delete option contract', async () => {
      const dto: CreateOptionContractDto = {
        underlyingAsset: 'BTC',
        optionType: OptionType.CALL,
        strikePrice: 40000,
        expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        markPrice: 41000,
        contractSize: 1,
        volatility: 0.3,
      };

      const created = await optionsController.createContract(dto);
      
      expect(await optionsController.getContract(created.id)).toBeDefined();
      
      await optionsController.deleteContract(created.id);
      
      await expect(optionsController.getContract(created.id)).rejects.toThrow();
    });
  });

  describe('Options Order Management', () => {
    let contractId: string;

    beforeEach(async () => {
      const dto: CreateOptionContractDto = {
        underlyingAsset: 'BTC',
        optionType: OptionType.CALL,
        strikePrice: 50000,
        expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        markPrice: 52000,
        contractSize: 1,
        volatility: 0.5,
      };

      const contract = await optionsController.createContract(dto);
      contractId = contract.id;
    });

    it('should place a market buy order', async () => {
      const dto: PlaceOptionOrderDto = {
        userId: 1,
        side: OptionOrderSide.BUY,
        orderType: OptionOrderType.MARKET,
        quantity: 10,
      };

      const result = await optionsController.placeOrder(contractId, dto);
      
      expect(result).toBeDefined();
      expect(result.order).toBeDefined();
      expect(result.order.contractId).toBe(contractId);
      expect(result.order.userId).toBe(dto.userId);
      expect(result.order.side).toBe(dto.side);
      expect(result.order.orderType).toBe(dto.orderType);
      expect(result.order.quantity).toBe(dto.quantity);
      expect(result.matches).toBeDefined();
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should place a limit sell order', async () => {
      const dto: PlaceOptionOrderDto = {
        userId: 2,
        side: OptionOrderSide.SELL,
        orderType: OptionOrderType.LIMIT,
        quantity: 5,
        limitPrice: 1500,
      };

      const result = await optionsController.placeOrder(contractId, dto);
      
      expect(result).toBeDefined();
      expect(result.order.limitPrice).toBe(dto.limitPrice);
    });

    it('should cancel an order', async () => {
      const dto: PlaceOptionOrderDto = {
        userId: 3,
        side: OptionOrderSide.BUY,
        orderType: OptionOrderType.LIMIT,
        quantity: 8,
        limitPrice: 1200,
      };

      const placed = await optionsController.placeOrder(contractId, dto);
      const cancelDto: CancelOptionOrderDto = {
        reason: 'Test cancellation',
      };

      const cancelled = await optionsController.cancelOrder(placed.order.id, cancelDto);
      
      expect(cancelled.status).toBe(OptionOrderStatus.CANCELLED);
    });

    it('should get user orders', async () => {
      const userId = 4;
      const dto: PlaceOptionOrderDto = {
        userId,
        side: OptionOrderSide.BUY,
        orderType: OptionOrderType.MARKET,
        quantity: 3,
      };

      await optionsController.placeOrder(contractId, dto);
      const userOrders = await optionsController.getUserOrders(userId.toString());
      
      expect(Array.isArray(userOrders)).toBe(true);
      expect(userOrders.length).toBeGreaterThan(0);
      expect(userOrders[0].userId).toBe(userId);
    });
  });

  describe('Options Risk Management', () => {
    let contractId: string;
    const userId = 5;

    beforeEach(async () => {
      const dto: CreateOptionContractDto = {
        underlyingAsset: 'ETH',
        optionType: OptionType.PUT,
        strikePrice: 3000,
        expiryAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        markPrice: 2800,
        contractSize: 10,
        volatility: 0.8,
      };

      const contract = await optionsController.createContract(dto);
      contractId = contract.id;

      const orderDto: PlaceOptionOrderDto = {
        userId,
        side: OptionOrderSide.BUY,
        orderType: OptionOrderType.MARKET,
        quantity: 5,
      };

      await optionsController.placeOrder(contractId, orderDto);
    });

    it('should get user positions', async () => {
      const positions = await optionsController.getPositions(userId.toString());
      
      expect(Array.isArray(positions)).toBe(true);
      expect(positions.length).toBeGreaterThan(0);
      expect(positions[0].userId).toBe(userId);
      expect(positions[0].contract).toBeDefined();
      expect(positions[0].pnl).toBeDefined();
    });

    it('should get user risk metrics', async () => {
      const risk = await optionsController.getUserRisk(userId.toString());
      
      expect(risk).toBeDefined();
      expect(risk.userId).toBe(userId);
      expect(risk.totalMarginHeld).toBeDefined();
      expect(risk.totalUnrealizedPnl).toBeDefined();
      expect(risk.totalRealizedPnl).toBeDefined();
      expect(risk.netPnl).toBeDefined();
      expect(risk.positionCount).toBeDefined();
      expect(Array.isArray(risk.riskBreakdown)).toBe(true);
    });

    it('should get contract Greeks', async () => {
      const greeks = await optionsController.getContractGreeks(contractId);
      
      expect(greeks).toBeDefined();
      expect(greeks.contractId).toBe(contractId);
      expect(greeks.greeks).toBeDefined();
      expect(greeks.greeks.delta).toBeDefined();
      expect(greeks.greeks.gamma).toBeDefined();
      expect(greeks.greeks.theta).toBeDefined();
      expect(greeks.greeks.vega).toBeDefined();
      expect(greeks.timeToExpiry).toBeDefined();
    });

    it('should get order book', async () => {
      const orderBook = await optionsController.getOrderBook(contractId);
      
      expect(orderBook).toBeDefined();
      expect(orderBook.contractId).toBe(contractId);
      expect(Array.isArray(orderBook.buys)).toBe(true);
      expect(Array.isArray(orderBook.sells)).toBe(true);
      expect(orderBook.spread).toBeDefined();
    });
  });

  describe('Options Chain and Expiry', () => {
    it('should get option chain for underlying asset', async () => {
      // Create multiple contracts for the same underlying
      const contracts = [
        {
          underlyingAsset: 'BTC',
          optionType: OptionType.CALL,
          strikePrice: 45000,
          expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          markPrice: 46000,
          contractSize: 1,
          volatility: 0.4,
        },
        {
          underlyingAsset: 'BTC',
          optionType: OptionType.CALL,
          strikePrice: 50000,
          expiryAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          markPrice: 52000,
          contractSize: 1,
          volatility: 0.5,
        },
        {
          underlyingAsset: 'BTC',
          optionType: OptionType.PUT,
          strikePrice: 48000,
          expiryAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          markPrice: 47000,
          contractSize: 1,
          volatility: 0.6,
        },
      ];

      for (const dto of contracts) {
        await optionsController.createContract(dto);
      }

      const optionChain = await optionsController.getOptionChain('BTC');
      
      expect(Array.isArray(optionChain)).toBe(true);
      expect(optionChain.length).toBe(3);
      expect(optionChain[0].underlyingAsset).toBe('BTC');
      expect(optionChain[0].analytics).toBeDefined();
      expect(optionChain[0].analytics.greeks).toBeDefined();
    });

    it('should process expiries', async () => {
      // Create an expired contract
      const expiredDto: CreateOptionContractDto = {
        underlyingAsset: 'BTC',
        optionType: OptionType.CALL,
        strikePrice: 40000,
        expiryAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        markPrice: 41000,
        contractSize: 1,
        volatility: 0.3,
      };

      await optionsController.createContract(expiredDto);

      const result = await optionsController.processExpiry({
        settlementPrices: { BTC: 42000 },
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].contractId).toBeDefined();
      expect(result[0].settlementPrice).toBeDefined();
    });
  });
});
