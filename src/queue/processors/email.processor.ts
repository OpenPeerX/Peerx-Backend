// src/queue/processors/email.processor.ts
import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { QueueName } from '../queue.constants';
import { EmailJobData } from '../queue.service';import {
  DeadLetterQueueService,
  DLQReason,
  isPermanentFailure,
} from '../dead-letter-queue.service';
  import { RedisPoolService } from '../../common/cache/redis-pool.service';
import { renderEmailTemplate } from '../../notifications/templates/email.templates';

/**
 * Minimal typing for the Nodemailer surface this processor uses. The
 * project declares `nodemailer` as an ambient module (no @types package is
 * installed), so we type the transport contract explicitly rather than
 * spreading `any`.
 */
interface SmtpTransport {
  sendMail(
    options: Record<string, unknown>,
  ): Promise<{ messageId?: string; accepted?: string[] }>;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

interface NodemailerModule {
  createTransport(options: Record<string, unknown>): SmtpTransport;
}

/** How long a sent-marker survives (30 days, matching DLQ retention). */
const SENT_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60;

const sentKey = (emailId: string) => `email:sent:${emailId}`;

/**
 * Email Job Processor
 *
 * Real, config-driven SMTP delivery via Nodemailer. The transport is built
 * from the existing `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` /
 * `SMTP_PASSWORD` / `EMAIL_FROM` variables, and delivery errors are rethrown
 * so Bull's configured backoff retries the job (the sibling
 * `NotificationsModule.EmailService` deliberately swallows errors for
 * graceful degradation, which would defeat queue retries — that is why the
 * queue path owns its transport).
 *
 * Delivery is idempotent across retries and horizontally scaled workers: an
 * atomic `SET ... NX EX` claim keyed by `emailId` (recipients + subject +
 * template) is taken before sending. A retry of an already-sent email finds
 * the claim and skips; a failure releases the claim so the retry actually
 * re-sends. The claim is released on failure, so exactly the jobs that
 * genuinely failed are retried.
 *
 * Jobs that exhaust Bull's retry budget (permanent failure) are recorded in
 * the durable dead-letter queue for operator recovery.
 */
@Processor(QueueName.EMAILS)
export class EmailJobProcessor {
  private readonly logger = new Logger(EmailJobProcessor.name);
  private readonly transporter: SmtpTransport;
  private readonly from: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisPoolService,
    private readonly dlqService: DeadLetterQueueService,
  ) {
    const smtp = this.readSmtpConfig();
    this.transporter = this.createTransport(smtp);
    this.from = this.configService.get<string>(
      'EMAIL_FROM',
      'notifications@peerx.com',
    );
  }

  @Process({ concurrency: 3 })
  async processEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, context } = job.data;

    this.logger.log(
      `Processing email job ${job.id}: ${subject} to ${Array.isArray(to) ? to.join(', ') : to}`,
    );

    try {
      await job.progress(10);

      if (!to || !subject || !template) {
        throw new Error('Invalid email data');
      }

      const emailId = this.generateEmailId(job.data);
      const claimed = await this.claimSend(emailId);

      if (!claimed) {
        this.logger.warn(`Email ${emailId} already sent, skipping`);
        await job.progress(100);
        return;
      }

      try {
        await job.progress(30);
        const html = this.renderTemplate(template, context);
        await job.progress(50);
        await this.sendEmail({
          to,
          subject,
          html,
          attachments: job.data.attachments,
        });
        await job.progress(80);
      } catch (error) {
        // Release the claim so Bull's retry re-sends this email.
        await this.releaseSend(emailId);
        throw error;
      }

      await job.progress(100);

      this.logger.log(`Email sent successfully: ${subject}`);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Failed to process email job ${job.id}:`, err.stack);
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job<EmailJobData>): void {
    this.logger.debug(`Email job ${job.id} is now active`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job<EmailJobData>): void {
    this.logger.log(`Email job ${job.id} completed: ${job.data.subject}`);
  }

  @OnQueueFailed()
  onFailed(job: Job<EmailJobData>, error: Error): void {
    const attempts = job.opts.attempts || 3;
    this.logger.error(
      `Email job ${job.id} failed. Subject: ${job.data.subject}. ` +
        `Attempt ${job.attemptsMade}/${attempts}`,
      error.stack,
    );

    if (isPermanentFailure(job)) {
      this.logger.error(
        `Email job ${job.id} permanently failed. Subject: ${job.data.subject}`,
      );
      this.notifyAdminOfFailure(job, error);
      void this.dlqService.addToDLQ(
        job,
        error,
        DLQReason.MAX_RETRIES_EXCEEDED,
        QueueName.EMAILS,
      );
    }
  }

  // ==================== Delivery ====================

  private readSmtpConfig(): SmtpConfig {
    return {
      host: this.configService.get<string>('SMTP_HOST', ''),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      user: this.configService.get<string>('SMTP_USER'),
      pass: this.configService.get<string>('SMTP_PASSWORD'),
    };
  }

  private createTransport(smtp: SmtpConfig): SmtpTransport {
    const options: Record<string, unknown> = {
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
    };
    if (smtp.user || smtp.pass) {
      options.auth = { user: smtp.user, pass: smtp.pass };
    }
    const nodemailerModule = nodemailer as unknown as NodemailerModule;
    return nodemailerModule.createTransport(options);
  }

  private async sendEmail(data: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
  }): Promise<void> {
    const info = await this.transporter.sendMail({
      from: this.from,
      to: data.to,
      subject: data.subject,
      html: data.html,
      attachments: data.attachments,
    });
    this.logger.debug(
      `Email sent to ${Array.isArray(data.to) ? data.to.join(', ') : data.to} messageId=${info.messageId}`,
    );
  }

  private renderTemplate(
    template: string,
    context?: Record<string, any>,
  ): string {
    return renderEmailTemplate(template, context);
  }

  private generateEmailId(data: EmailJobData): string {
    const recipients = Array.isArray(data.to)
      ? data.to.sort().join(',')
      : data.to;
    return `${recipients}-${data.subject}-${data.template}`;
  }

  // ==================== Durable idempotent send tracking ====================

  /**
   * Atomically claim a send. Returns `true` when this worker won the claim
   * and must send; `false` when the email was already sent (by this worker
   * earlier, by a retry, or by another instance).
   */
  private async claimSend(emailId: string): Promise<boolean> {
    const claimed = await this.redis.withClient((client) =>
      client.set(sentKey(emailId), '1', 'EX', SENT_MARKER_TTL_SECONDS, 'NX'),
    );
    return claimed === 'OK';
  }

  private async releaseSend(emailId: string): Promise<void> {
    await this.redis.withClient((client) => client.del(sentKey(emailId)));
  }

  // ==================== Admin alerts ====================

  private notifyAdminOfFailure(job: Job<EmailJobData>, error: Error): void {
    const recipients = Array.isArray(job.data.to)
      ? job.data.to.join(', ')
      : job.data.to;
    this.logger.error(
      `ADMIN ALERT: Email permanently failed\n` +
        `Job ID: ${job.id}\n` +
        `Subject: ${job.data.subject}\n` +
        `Recipients: ${recipients}\n` +
        `Error: ${error.message}`,
    );
  }
}
