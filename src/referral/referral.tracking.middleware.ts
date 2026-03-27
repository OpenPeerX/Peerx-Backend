import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export const REFERRAL_SESSION_KEY = 'referral_code';

@Injectable()
export class ReferralTrackingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const refCode = req.query['ref'] as string;
    if (refCode && /^[A-Z0-9]{6,20}$/.test(refCode)) {
      // Store in session; persists through registration flow
      (req.session as any)[REFERRAL_SESSION_KEY] = refCode;
    }
    next();
  }
}
