// src/queue/processors/email.processor.spec.ts
import { ConfigService } from '@nestjs/config';
import { EmailJobProcessor } from './email.processor';
import { RedisPoolService } from '../../common/cache/redis-pool.service';
import type { Job } from 'bull';
import type { EmailJobData } from '../queue.service';
import {
  EMAIL_TEMPLATES,
  GENERIC_TEMPLATE,
  renderEmailTemplate,
} from '../../notifications/templates/email.templates';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import * as nodemailer from 'nodemailer';

interface NodemailerMockModule {
  createTransport: jest.Mock;
}

// ── Faithful in-memory Redis fake (SET NX EX, DEL) ───────────────────────────

interface FakeEntry {
  value: string;
  expiresAtMs: number | null;
}

class FakeRedis {
  private store = new Map<string, FakeEntry>();

  nowMs(): number {
    return Date.now();
  }

  set(
    key: string,
    value: string,
    mode?: string,
    ttl?: number,
    nxFlag?: string,
  ): Promise<'OK' | null> {
    const now = this.nowMs();
    const existing = this.store.get(key);
    if (
      existing &&
      (existing.expiresAtMs === null || existing.expiresAtMs > now)
    ) {
      if (nxFlag === 'NX') {
        return Promise.resolve(null);
      }
    }
    this.store.set(key, {
      value,
      expiresAtMs: mode === 'EX' ? now + (ttl ?? 0) * 1000 : null,
    });
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    return Promise.resolve(this.store.delete(key) ? 1 : 0);
  }
}

// ── Job factory ───────────────────────────────────────────────────────────────

function makeJob(data: Partial<EmailJobData>): Job<EmailJobData> {
  return {
    id: 'job-1',
    data: {
      to: 'user@example.com',
      subject: 'Welcome to PeerX!',
      template: 'welcome',
      context: { name: 'Alice' },
      ...data,
    } as EmailJobData,
    opts: { attempts: 3 },
    progress: jest.fn().mockResolvedValue(undefined),
  } as unknown as Job<EmailJobData>;
}

describe('EmailJobProcessor', () => {
  let processor: EmailJobProcessor;
  let fakeRedis: FakeRedis;
  let sendMail: jest.Mock<{ messageId: string }, [Record<string, unknown>]>;

  function buildProcessor(): EmailJobProcessor {
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) => {
        const values: Record<string, unknown> = {
          SMTP_HOST: 'smtp.example.com',
          SMTP_PORT: 587,
          SMTP_SECURE: false,
          SMTP_USER: 'noreply@peerx.com',
          SMTP_PASSWORD: 'secret',
          EMAIL_FROM: 'noreply@peerx.com',
        };
        return values[key] ?? fallback;
      }),
    };
    const redis = {
      provide: RedisPoolService,
      useValue: {
        withClient: (fn: (c: FakeRedis) => Promise<unknown>) => fn(fakeRedis),
      },
    };
    return new EmailJobProcessor(
      configService as unknown as ConfigService,
      redis.useValue as unknown as RedisPoolService,
      { addToDLQ: jest.fn().mockResolvedValue(undefined) } as never,
    );
  }

  beforeEach(() => {
    fakeRedis = new FakeRedis();
    sendMail = jest
      .fn<Promise<{ messageId: string }>, [Record<string, unknown>]>()
      .mockResolvedValue({ messageId: 'msg-1' });
    const nodemailerModule = nodemailer as unknown as NodemailerMockModule;
    nodemailerModule.createTransport.mockReturnValue({ sendMail });
    processor = buildProcessor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends a real transport call with recipient, subject, from, and rendered body', async () => {
    await processor.processEmail(makeJob({}));

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      from: 'noreply@peerx.com',
      to: 'user@example.com',
      subject: 'Welcome to PeerX!',
    });
    expect(String(sendMail.mock.calls[0][0].html)).toContain(
      'Welcome to PeerX, Alice!',
    );
  });

  it('skips a duplicate emailId with zero transport calls', async () => {
    await processor.processEmail(makeJob({}));
    // Bull retries the same job payload after a stall: second run must not send.
    await processor.processEmail(makeJob({}));

    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('throws on SMTP failure and releases the claim so a retry re-sends', async () => {
    sendMail
      .mockRejectedValueOnce(new Error('ECONNREFUSED smtp.example.com:587'))
      .mockResolvedValueOnce({ messageId: 'msg-2' });

    const job = makeJob({});
    await expect(processor.processEmail(job)).rejects.toThrow('ECONNREFUSED');
    // Retry after backoff: the claim was released, so it re-sends.
    await processor.processEmail(job);

    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it('renders the welcome template with context', () => {
    const html = renderEmailTemplate('welcome', { name: 'Alice' });
    expect(html).toContain('Welcome to PeerX, Alice!');
    expect(EMAIL_TEMPLATES.welcome).toBeDefined();
  });

  it('renders the trade-completed template with context', () => {
    const html = renderEmailTemplate('trade-completed', {
      tradeId: 'T-42',
      amount: '100',
      asset: 'USDC',
      price: '1.00',
    });
    expect(html).toContain('Trade ID: T-42');
    expect(html).toContain('Amount: 100');
    expect(EMAIL_TEMPLATES['trade-completed']).toBeDefined();
  });

  it('renders the test template', () => {
    expect(EMAIL_TEMPLATES.test).toBeDefined();
    expect(renderEmailTemplate('test')).toContain('Test Email');
  });

  it('falls back to the generic template for unknown template names', () => {
    expect(renderEmailTemplate('nonexistent')).toBe(GENERIC_TEMPLATE);
  });

  it('HTML-escapes context values', () => {
    const html = renderEmailTemplate('welcome', {
      name: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
