import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { gzipSync } from 'zlib';
import { MobileMetricsService } from '../platform/mobile-metrics.service';
import { MobileService } from './mobile.service';

@Controller('mobile')
export class MobileController {
  constructor(
    private readonly mobileService: MobileService,
    private readonly mobileMetricsService: MobileMetricsService,
  ) {}

  @Get('dashboard/:userId')
  async dashboard(
    @Param('userId') userId: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const startedAt = Date.now();
    const result = await this.mobileService.getDashboard(Number(userId));
    return this.respond(
      response,
      request,
      result.data,
      startedAt,
      result.cached,
      `dashboard:${userId}`,
    );
  }

  @Get('options')
  async optionsSnapshot(
    @Query('underlyingAsset') underlyingAsset: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    const startedAt = Date.now();
    const result = await this.mobileService.getOptionsSnapshot(underlyingAsset);
    return this.respond(
      response,
      request,
      result.data,
      startedAt,
      result.cached,
      `options:${underlyingAsset}`,
    );
  }

  private respond(
    response: Response,
    request: Request,
    payload: unknown,
    startedAt: number,
    cacheHit: boolean,
    route: string,
  ) {
    const etag = this.mobileService.createEtag(payload);
    response.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    response.setHeader('ETag', etag);
    response.setHeader('Vary', 'Accept-Encoding');

    if (request.headers['if-none-match'] === etag) {
      this.mobileMetricsService.record(route, Date.now() - startedAt, cacheHit);
      return response.status(304).send();
    }

    const body = JSON.stringify(payload);
    const acceptsEncoding = request.headers['accept-encoding'] ?? '';
    if (typeof acceptsEncoding === 'string' && acceptsEncoding.includes('gzip')) {
      response.setHeader('Content-Encoding', 'gzip');
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      this.mobileMetricsService.record(route, Date.now() - startedAt, cacheHit);
      return response.send(gzipSync(body));
    }

    this.mobileMetricsService.record(route, Date.now() - startedAt, cacheHit);
    return response.json(payload);
  }
}
