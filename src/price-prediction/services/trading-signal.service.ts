import { Injectable } from '@nestjs/common';
import { TradingSignalAction } from '../interfaces/price-prediction.interfaces';

@Injectable()
export class TradingSignalService {
  toSignal(expectedReturnPct: number, confidence: number): TradingSignalAction {
    if (confidence < 45) {
      return 'HOLD';
    }

    if (expectedReturnPct >= 1.5 && confidence >= 55) {
      return 'BUY';
    }

    if (expectedReturnPct <= -1.5 && confidence >= 55) {
      return 'SELL';
    }

    return 'HOLD';
  }
}
