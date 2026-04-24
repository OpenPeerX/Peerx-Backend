import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WaitlistUser, WaitlistStatus } from './entities/waitlist-user.entity';
import { WaitlistVerificationToken } from './entities/waitlist-verification-token.entity';
import { NotificationService, NotificationChannel } from '../notification/notification.service';
import * as crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 72;

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectRepository(WaitlistUser)
    private readonly waitlistRepo: Repository<WaitlistUser>,
    @InjectRepository(WaitlistVerificationToken)
    private readonly tokenRepo: Repository<WaitlistVerificationToken>,
    private readonly dataSource: DataSource,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Register a new user for the waitlist
   */
  async signup(
    email: string,
    name?: string,
    referralCode?: string,
    referralSource?: string,
  ): Promise<{ success: boolean; message: string }> {
    // Check for duplicate email
    const existing = await this.waitlistRepo.findOne({
      where: { email },
    });

    if (existing) {
      if (existing.status === WaitlistStatus.VERIFIED) {
        throw new ConflictException('Email already registered and verified');
      } else if (existing.status === WaitlistStatus.INVITED) {
        throw new ConflictException('Email already invited - please check your inbox');
      }
      throw new ConflictException('Email already registered - please verify your email');
    }

    // Create waitlist entry
    const waitlistUser = this.waitlistRepo.create({
      email,
      name,
      referralCode,
      referralSource,
      status: WaitlistStatus.PENDING,
    });

    await this.waitlistRepo.save(waitlistUser);

    // Generate verification token
    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    const verificationToken = this.tokenRepo.create({
      email,
      token,
      expiresAt,
      isUsed: false,
    });

    await this.tokenRepo.save(verificationToken);

    // Send verification email
    try {
      await this.sendVerificationEmail(email, token);
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
      // Don't fail signup if email fails, but log it
    }

    return {
      success: true,
      message: 'Signup successful! Please check your email to verify your account.',
    };
  }

  /**
   * Verify email using token
   */
  async verifyEmail(email: string, token: string): Promise<{ success: boolean; message: string }> {
    // Find token
    const verificationToken = await this.tokenRepo.findOne({
      where: { token, email, isUsed: false },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid or already used token');
    }

    // Check expiration
    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    // Find waitlist user
    const waitlistUser = await this.waitlistRepo.findOne({
      where: { email },
    });

    if (!waitlistUser) {
      throw new NotFoundException('Waitlist entry not found');
    }

    // Update user status
    waitlistUser.status = WaitlistStatus.VERIFIED;
    waitlistUser.verifiedAt = new Date();

    // Mark token as used
    verificationToken.isUsed = true;
    verificationToken.usedAt = new Date();

    await Promise.all([
      this.waitlistRepo.save(waitlistUser),
      this.tokenRepo.save(verificationToken),
    ]);

    this.logger.log(`Email verified successfully: ${email}`);

    return {
      success: true,
      message: 'Email verified successfully! You are now on the waitlist.',
    };
  }

  /**
   * Resend verification email
   */
  async resendVerificationEmail(email: string): Promise<{ success: boolean; message: string }> {
    const waitlistUser = await this.waitlistRepo.findOne({
      where: { email },
    });

    if (!waitlistUser) {
      throw new NotFoundException('Waitlist entry not found');
    }

    if (waitlistUser.status === WaitlistStatus.VERIFIED) {
      throw new BadRequestException('Email already verified');
    }

    if (waitlistUser.status === WaitlistStatus.INVITED) {
      throw new BadRequestException('Already invited - please check your inbox');
    }

    // Invalidate old tokens
    await this.tokenRepo.update(
      { email, isUsed: false },
      { isUsed: true, usedAt: new Date() },
    );

    // Generate new token
    const token = this.generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + TOKEN_EXPIRY_HOURS);

    const verificationToken = this.tokenRepo.create({
      email,
      token,
      expiresAt,
      isUsed: false,
    });

    await this.tokenRepo.save(verificationToken);

    // Send email
    try {
      await this.sendVerificationEmail(email, token);
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
      throw new BadRequestException('Failed to send verification email');
    }

    return {
      success: true,
      message: 'Verification email sent!',
    };
  }

  /**
   * List waitlist entries with filters
   */
  async findAll(query: any) {
    const { status, page = 1, limit = 20 } = query;
    const qb = this.waitlistRepo.createQueryBuilder('w')
      .orderBy('w.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) {
      qb.andWhere('w.status = :status', { status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Manual invite by admin — notifies the user via email that they have been invited.
   */
  async invite(id: string, adminId: string): Promise<WaitlistUser> {
    const entry = await this.waitlistRepo.findOne({ where: { id } });
    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }

    entry.status = WaitlistStatus.INVITED;
    entry.invitedAt = new Date();

    await this.waitlistRepo.save(entry);

    // Notify the user that the feature is now available for them
    try {
      await this.sendInviteNotification(entry.email, entry.name);
    } catch (error) {
      this.logger.error(`Failed to send invite notification to ${entry.email}:`, error);
      // Don't fail the invite if the notification fails
    }

    return entry;
  }

  /**
   * Send invite / feature-available notification email
   */
  private async sendInviteNotification(email: string, name?: string): Promise<void> {
    const greeting = name ? `Hi ${name}` : 'Hi there';
    const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;

    await this.notificationService.send({
      userId: 1, // system user
      type: 'WAITLIST_INVITE',
      channels: [NotificationChannel.Email],
      subject: "You're invited! SwapTrade is ready for you",
      message: `${greeting},\n\nGreat news — you've been invited to access SwapTrade!\n\nClick the link below to get started:\n\n${loginUrl}\n\nWelcome aboard,\nThe SwapTrade Team`,
    });
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(limit: number = 10): Promise<any[]> {
    return this.dataSource.query(
      `SELECT user_id, display_name, points, rank, updated_at
       FROM leaderboard_cache
       WHERE type = 'REFERRALS'
       ORDER BY rank ASC
       LIMIT ?`,
      [limit],
    );
  }

  /**
   * Get waitlist statistics
   */
  async getStats(): Promise<any> {
    const totalSignups = await this.waitlistRepo.count();
    const verifiedUsers = await this.waitlistRepo.count({ 
      where: { status: WaitlistStatus.VERIFIED } 
    });
    const invitedUsers = await this.waitlistRepo.count({ 
      where: { status: WaitlistStatus.INVITED } 
    });

    // Daily aggregates (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySignups = await this.dataSource.query(
      `SELECT date(created_at) as date, count(*) as count
       FROM waitlist_users
       WHERE created_at >= ?
       GROUP BY date(created_at)
       ORDER BY date ASC`,
      [sevenDaysAgo.toISOString()],
    );

    return {
      totalSignups,
      verifiedUsers,
      invitedUsers,
      dailySignups,
    };
  }

  /**
   * Generate secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Send verification email
   */
  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/waitlist/verify?token=${token}&email=${encodeURIComponent(email)}`;

    // Find or create a system user for notifications
    await this.notificationService.send({
      userId: 1, // Use admin/system user ID
      type: 'WAITLIST_VERIFICATION',
      channels: [NotificationChannel.Email],
      subject: 'Verify Your Email - SwapTrade Waitlist',
      message: `Welcome to SwapTrade!\n\nPlease verify your email by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in ${TOKEN_EXPIRY_HOURS} hours.\n\nIf you didn't sign up for SwapTrade, please ignore this email.\n\nBest regards,\nThe SwapTrade Team`,
    });
  }
}
