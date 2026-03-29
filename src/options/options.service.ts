import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../platform/audit.service';
import { MobileCacheService } from '../platform/mobile-cache.service';
import {
  OptionContract,
  OptionContractStatus,
  OptionType,
} from './entities/option-contract.entity';
import {
  OptionOrder,
  OptionOrderSide,
  OptionOrderStatus,
  OptionOrderType,
} from './entities/option-order.entity';
import { OptionPosition } from './entities/option-position.entity';
import { CreateOptionContractDto } from './dto/create-option-contract.dto';
import { PlaceOptionOrderDto } from './dto/place-option-order.dto';

@Injectable()
export class OptionsService {
  constructor(
    @InjectRepository(OptionContract)
    private readonly contractRepository: Repository<OptionContract>,
    @InjectRepository(OptionOrder)
    private readonly orderRepository: Repository<OptionOrder>,
    @InjectRepository(OptionPosition)
    private readonly positionRepository: Repository<OptionPosition>,
    private readonly auditService: AuditService,
    private readonly mobileCacheService: MobileCacheService,
  ) {}

  async createContract(dto: CreateOptionContractDto): Promise<OptionContract> {
    const contract = await this.contractRepository.save(
      this.contractRepository.create({
        ...dto,
        expiryAt: new Date(dto.expiryAt),
      }),
    );
    await this.auditService.log({
      domain: 'options',
      action: 'contract.created',
      entityId: contract.id,
      metadata: { underlyingAsset: contract.underlyingAsset, strikePrice: contract.strikePrice },
    });
    this.invalidateOptionsCaches();
    return contract;
  }

  async placeOrder(contractId: string, dto: PlaceOptionOrderDto) {
    const contract = await this.getContractOrThrow(contractId);
    if (contract.status !== OptionContractStatus.ACTIVE || contract.expiryAt <= new Date()) {
      throw new BadRequestException('Contract is not active');
    }
    if (dto.orderType === OptionOrderType.LIMIT && dto.limitPrice === undefined) {
      throw new BadRequestException('Limit orders require limitPrice');
    }

    const greeks = this.calculateGreeks(contract);
    const marginRequirement = this.calculateMargin(contract, dto.side, dto.quantity, greeks);
    const order = await this.orderRepository.save(
      this.orderRepository.create({
        contractId,
        userId: dto.userId,
        side: dto.side,
        orderType: dto.orderType,
        quantity: dto.quantity,
        limitPrice: dto.limitPrice,
        greeks,
        marginRequirement,
      }),
    );

    const matches = await this.matchOrder(contract, order);
    await this.refreshPositionRisk(contractId);
    await this.auditService.log({
      domain: 'options',
      action: 'order.placed',
      actorUserId: dto.userId,
      entityId: order.id,
      metadata: { contractId, matches: matches.length, marginRequirement },
    });
    this.invalidateOptionsCaches(dto.userId);
    return {
      order: await this.orderRepository.findOneByOrFail({ id: order.id }),
      matches,
    };
  }

  async getOptionChain(underlyingAsset: string) {
    const contracts = await this.contractRepository.find({
      where: { underlyingAsset },
      order: { expiryAt: 'ASC', strikePrice: 'ASC' },
    });
    return contracts.map((contract) => ({
      ...contract,
      analytics: {
        openInterest: undefined,
        greeks: this.calculateGreeks(contract),
      },
    }));
  }

  async getPositions(userId: number) {
    const positions = await this.positionRepository.find({ where: { userId } });
    const contracts = await this.contractRepository.find();
    const contractMap = new Map(contracts.map((contract) => [contract.id, contract]));
    return positions.map((position) => {
      const contract = contractMap.get(position.contractId);
      return {
        ...position,
        contract,
        pnl: {
          realized: Number(position.realizedPnl),
          unrealized: Number(position.unrealizedPnl),
        },
      };
    });
  }

  async processExpiries(settlementPrices?: Record<string, number>) {
    const now = new Date();
    const contracts = await this.contractRepository.find({
      where: { status: OptionContractStatus.ACTIVE },
    });
    const processed: Array<Record<string, unknown>> = [];

    for (const contract of contracts) {
      if (contract.expiryAt > now) {
        continue;
      }
      const settlementPrice =
        settlementPrices?.[contract.underlyingAsset] ?? Number(contract.markPrice);
      contract.status = OptionContractStatus.SETTLED;
      contract.settlementPrice = settlementPrice;
      await this.contractRepository.save(contract);

      const positions = await this.positionRepository.find({ where: { contractId: contract.id } });
      for (const position of positions) {
        const intrinsic = this.calculateIntrinsicValue(contract, settlementPrice);
        const netLong = Number(position.longQuantity) - Number(position.shortQuantity);
        position.unrealizedPnl = 0;
        position.realizedPnl = Number(position.realizedPnl) + netLong * intrinsic * Number(contract.contractSize);
        await this.positionRepository.save(position);
      }

      processed.push({
        contractId: contract.id,
        settlementPrice,
      });
    }

    if (processed.length > 0) {
      await this.auditService.log({
        domain: 'options',
        action: 'expiry.processed',
        metadata: { processed },
      });
      this.invalidateOptionsCaches();
    }

    return processed;
  }

  private async getContractOrThrow(contractId: string): Promise<OptionContract> {
    const contract = await this.contractRepository.findOne({ where: { id: contractId } });
    if (!contract) {
      throw new NotFoundException(`Option contract ${contractId} not found`);
    }
    return contract;
  }

  private calculateGreeks(contract: OptionContract) {
    const spot = Number(contract.markPrice);
    const strike = Number(contract.strikePrice);
    const moneyness = strike === 0 ? 0 : (spot - strike) / strike;
    const delta = contract.optionType === OptionType.CALL ? 0.5 + moneyness : -0.5 + moneyness;
    return {
      delta: Number(delta.toFixed(4)),
      gamma: Number((Number(contract.volatility) * 0.08).toFixed(4)),
      theta: Number((-0.02 * Number(contract.volatility)).toFixed(4)),
      vega: Number((0.12 * Number(contract.volatility)).toFixed(4)),
    };
  }

  private calculateMargin(
    contract: OptionContract,
    side: OptionOrderSide,
    quantity: number,
    greeks: Record<string, number>,
  ): number {
    const base = Number(contract.markPrice) * quantity * Number(contract.contractSize);
    if (side === OptionOrderSide.BUY) {
      return Number((base * 0.2).toFixed(8));
    }
    return Number((base * (0.4 + Math.abs(greeks.delta) + greeks.gamma)).toFixed(8));
  }

  private async matchOrder(contract: OptionContract, order: OptionOrder) {
    const oppositeSide =
      order.side === OptionOrderSide.BUY ? OptionOrderSide.SELL : OptionOrderSide.BUY;
    const restingOrders = await this.orderRepository.find({
      where: {
        contractId: contract.id,
        side: oppositeSide,
        status: OptionOrderStatus.OPEN,
      },
      order: { createdAt: 'ASC' },
    });

    let remaining = Number(order.quantity);
    const matches: Array<Record<string, unknown>> = [];

    for (const restingOrder of restingOrders) {
      if (remaining <= 0) {
        break;
      }
      if (!this.isPriceMatch(order, restingOrder, Number(contract.markPrice))) {
        continue;
      }

      const restingRemaining = Number(restingOrder.quantity) - Number(restingOrder.filledQuantity);
      const fillQuantity = Math.min(remaining, restingRemaining);
      const fillPrice =
        order.orderType === OptionOrderType.MARKET
          ? Number(restingOrder.limitPrice ?? contract.markPrice)
          : Number(order.limitPrice ?? restingOrder.limitPrice ?? contract.markPrice);

      remaining -= fillQuantity;
      restingOrder.filledQuantity = Number(restingOrder.filledQuantity) + fillQuantity;
      restingOrder.averageFillPrice = fillPrice;
      restingOrder.status =
        Number(restingOrder.filledQuantity) >= Number(restingOrder.quantity)
          ? OptionOrderStatus.FILLED
          : OptionOrderStatus.PARTIALLY_FILLED;
      await this.orderRepository.save(restingOrder);

      order.filledQuantity = Number(order.filledQuantity) + fillQuantity;
      order.averageFillPrice = fillPrice;
      order.status =
        Number(order.filledQuantity) >= Number(order.quantity)
          ? OptionOrderStatus.FILLED
          : OptionOrderStatus.PARTIALLY_FILLED;
      await this.orderRepository.save(order);

      await this.applyFill(contract, order.userId, order.side, fillQuantity, fillPrice);
      await this.applyFill(contract, restingOrder.userId, restingOrder.side, fillQuantity, fillPrice);

      matches.push({
        makerOrderId: restingOrder.id,
        takerOrderId: order.id,
        quantity: fillQuantity,
        price: fillPrice,
      });
    }

    return matches;
  }

  private isPriceMatch(order: OptionOrder, restingOrder: OptionOrder, markPrice: number): boolean {
    if (order.orderType === OptionOrderType.MARKET) {
      return true;
    }
    const incomingPrice = Number(order.limitPrice ?? markPrice);
    const restingPrice = Number(restingOrder.limitPrice ?? markPrice);
    return order.side === OptionOrderSide.BUY
      ? incomingPrice >= restingPrice
      : incomingPrice <= restingPrice;
  }

  private async applyFill(
    contract: OptionContract,
    userId: number,
    side: OptionOrderSide,
    fillQuantity: number,
    fillPrice: number,
  ): Promise<void> {
    let position = await this.positionRepository.findOne({
      where: { contractId: contract.id, userId },
    });
    if (!position) {
      position = this.positionRepository.create({
        contractId: contract.id,
        userId,
        longQuantity: 0,
        shortQuantity: 0,
        averageEntryPrice: 0,
        marginHeld: 0,
        realizedPnl: 0,
        unrealizedPnl: 0,
      });
    }

    if (side === OptionOrderSide.BUY) {
      position.longQuantity = Number(position.longQuantity) + fillQuantity;
    } else {
      position.shortQuantity = Number(position.shortQuantity) + fillQuantity;
    }

    position.averageEntryPrice = fillPrice;
    position.marginHeld = this.calculateMargin(
      contract,
      side,
      Number(position.shortQuantity),
      this.calculateGreeks(contract),
    );

    const netLong = Number(position.longQuantity) - Number(position.shortQuantity);
    position.unrealizedPnl = Number(
      ((Number(contract.markPrice) - Number(position.averageEntryPrice)) *
        netLong *
        Number(contract.contractSize)).toFixed(8),
    );

    await this.positionRepository.save(position);
  }

  private async refreshPositionRisk(contractId: string): Promise<void> {
    const contract = await this.getContractOrThrow(contractId);
    const positions = await this.positionRepository.find({ where: { contractId } });
    for (const position of positions) {
      const netLong = Number(position.longQuantity) - Number(position.shortQuantity);
      position.marginHeld = this.calculateMargin(
        contract,
        OptionOrderSide.SELL,
        Math.max(Number(position.shortQuantity), 0),
        this.calculateGreeks(contract),
      );
      position.unrealizedPnl = Number(
        ((Number(contract.markPrice) - Number(position.averageEntryPrice)) *
          netLong *
          Number(contract.contractSize)).toFixed(8),
      );
      await this.positionRepository.save(position);
    }
  }

  private calculateIntrinsicValue(contract: OptionContract, settlementPrice: number): number {
    const strike = Number(contract.strikePrice);
    return contract.optionType === OptionType.CALL
      ? Math.max(0, settlementPrice - strike)
      : Math.max(0, strike - settlementPrice);
  }

  private invalidateOptionsCaches(userId?: number): void {
    this.mobileCacheService.invalidateTag('mobile-dashboard');
    this.mobileCacheService.invalidateTag('mobile-options');
    if (userId !== undefined) {
      this.mobileCacheService.invalidateTag(`mobile-user:${userId}`);
    }
  }
}
