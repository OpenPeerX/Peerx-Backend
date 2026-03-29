import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

export interface OptimizationOptions {
  compress?: boolean;
  minify?: boolean;
  cache?: boolean;
  streaming?: boolean;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface OptimizedResponse {
  body: Buffer | string;
  headers: Record<string, string>;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  optimizationTime: number;
}

@Injectable()
export class ResponseOptimizationService {
  private readonly logger = new Logger(ResponseOptimizationService.name);

  constructor(private readonly configService: ConfigService) {}

  async optimizeResponse(
    body: any,
    contentType: string,
    options: OptimizationOptions = {}
  ): Promise<OptimizedResponse> {
    const startTime = Date.now();
    const config = this.configService.get('edge');

    // Convert body to string if needed
    let bodyString: string;
    if (typeof body === 'object') {
      bodyString = JSON.stringify(body);
    } else {
      bodyString = String(body);
    }

    const originalSize = Buffer.byteLength(bodyString, 'utf8');
    let compressed = false;
    let optimizedBody: Buffer | string = bodyString;

    // Apply compression if enabled and meets threshold
    if (
      options.compress !== false &&
      config?.optimization?.compression?.enabled &&
      originalSize >= (config.optimization.compression.threshold || 1024)
    ) {
      const compressionResult = await this.compressBody(
        bodyString,
        contentType,
        config.optimization.compression
      );
      
      if (compressionResult) {
        optimizedBody = compressionResult.buffer;
        compressed = true;
      }
    }

    // Apply minification for JSON responses
    if (
      options.minify !== false &&
      contentType.includes('application/json') &&
      typeof body === 'object'
    ) {
      optimizedBody = JSON.stringify(body);
    }

    const compressedSize = Buffer.byteLength(
      optimizedBody instanceof Buffer ? optimizedBody : Buffer.from(optimizedBody),
      'utf8'
    );

    const compressionRatio = originalSize > 0 
      ? ((originalSize - compressedSize) / originalSize) * 100 
      : 0;

    const optimizationTime = Date.now() - startTime;

    // Build response headers
    const headers = this.buildOptimizationHeaders(
      compressed,
      contentType,
      compressedSize,
      config
    );

    return {
      body: optimizedBody,
      headers,
      compressed,
      originalSize,
      compressedSize,
      compressionRatio,
      optimizationTime,
    };
  }

  private async compressBody(
    body: string,
    contentType: string,
    compressionConfig: any
  ): Promise<{ buffer: Buffer; algorithm: string } | null> {
    const supportedTypes = compressionConfig.types || [
      'application/json',
      'text/html',
      'text/css',
      'application/javascript',
    ];

    if (!supportedTypes.some((type: string) => contentType.includes(type))) {
      return null;
    }

    const level = compressionConfig.level || 6;
    const buffer = Buffer.from(body, 'utf8');

    try {
      // Try Brotli first (best compression)
      if (zlib.constants && zlib.constants.BROTLI_PARAM_QUALITY) {
        const brotliResult = await brotliCompress(buffer, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: Math.min(level, 11),
          },
        });
        
        if (brotliResult.length < buffer.length * 0.9) {
          return { buffer: brotliResult, algorithm: 'br' };
        }
      }

      // Try gzip
      const gzipResult = await gzip(buffer, { level });
      if (gzipResult.length < buffer.length * 0.9) {
        return { buffer: gzipResult, algorithm: 'gzip' };
      }

      // Try deflate
      const deflateResult = await deflate(buffer, { level });
      if (deflateResult.length < buffer.length * 0.9) {
        return { buffer: deflateResult, algorithm: 'deflate' };
      }

      return null;
    } catch (error) {
      this.logger.warn(`Compression failed: ${error.message}`);
      return null;
    }
  }

  private buildOptimizationHeaders(
    compressed: boolean,
    contentType: string,
    contentLength: number,
    config: any
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Length': contentLength.toString(),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    };

    if (compressed) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
    }

    // Add cache control headers
    if (config?.optimization?.keepAlive?.enabled) {
      headers['Connection'] = 'keep-alive';
      headers['Keep-Alive'] = `timeout=${config.optimization.keepAlive.timeout || 65}, max=${config.optimization.keepAlive.maxRequests || 1000}`;
    }

    // Add performance headers
    headers['X-Response-Time'] = '0ms'; // Will be updated by interceptor
    headers['X-Edge-Optimized'] = 'true';

    return headers;
  }

  async optimizeJsonResponse(data: any): Promise<{
    optimized: string;
    originalSize: number;
    optimizedSize: number;
    savings: number;
  }> {
    const original = JSON.stringify(data);
    const originalSize = Buffer.byteLength(original, 'utf8');

    // Remove unnecessary whitespace
    const minified = JSON.stringify(data);
    const optimizedSize = Buffer.byteLength(minified, 'utf8');

    // Further optimization: remove null values, empty arrays, empty objects
    const optimized = this.deepOptimize(data);
    const finalOptimized = JSON.stringify(optimized);
    const finalSize = Buffer.byteLength(finalOptimized, 'utf8');

    return {
      optimized: finalOptimized,
      originalSize,
      optimizedSize: finalSize,
      savings: ((originalSize - finalSize) / originalSize) * 100,
    };
  }

  private deepOptimize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj
        .map(item => this.deepOptimize(item))
        .filter(item => item !== null && item !== undefined);
    }

    if (obj && typeof obj === 'object') {
      const optimized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const optimizedValue = this.deepOptimize(value);
        if (
          optimizedValue !== null &&
          optimizedValue !== undefined &&
          !(Array.isArray(optimizedValue) && optimizedValue.length === 0) &&
          !(typeof optimizedValue === 'object' && Object.keys(optimizedValue).length === 0)
        ) {
          optimized[key] = optimizedValue;
        }
      }
      return optimized;
    }

    return obj;
  }

  async streamResponse(
    data: any,
    chunkSize: number = 1024
  ): Promise<{
    chunks: Buffer[];
    totalSize: number;
    chunkCount: number;
  }> {
    const jsonString = JSON.stringify(data);
    const buffer = Buffer.from(jsonString, 'utf8');
    const chunks: Buffer[] = [];

    for (let i = 0; i < buffer.length; i += chunkSize) {
      chunks.push(buffer.slice(i, i + chunkSize));
    }

    return {
      chunks,
      totalSize: buffer.length,
      chunkCount: chunks.length,
    };
  }

  async batchOptimize(
    responses: Array<{ body: any; contentType: string }>
  ): Promise<OptimizedResponse[]> {
    const startTime = Date.now();
    
    const optimized = await Promise.all(
      responses.map(response =>
        this.optimizeResponse(response.body, response.contentType)
      )
    );

    const totalTime = Date.now() - startTime;
    const totalOriginal = optimized.reduce((sum, r) => sum + r.originalSize, 0);
    const totalCompressed = optimized.reduce((sum, r) => sum + r.compressedSize, 0);
    const totalSavings = ((totalOriginal - totalCompressed) / totalOriginal) * 100;

    this.logger.debug(
      `Batch optimized ${responses.length} responses in ${totalTime}ms ` +
      `(${totalSavings.toFixed(2)}% size reduction)`
    );

    return optimized;
  }

  getCompressionStats(): {
    supportedAlgorithms: string[];
    defaultAlgorithm: string;
    compressionLevel: number;
    threshold: number;
  } {
    const config = this.configService.get('edge');
    return {
      supportedAlgorithms: ['br', 'gzip', 'deflate'],
      defaultAlgorithm: 'gzip',
      compressionLevel: config?.optimization?.compression?.level || 6,
      threshold: config?.optimization?.compression?.threshold || 1024,
    };
  }
}
