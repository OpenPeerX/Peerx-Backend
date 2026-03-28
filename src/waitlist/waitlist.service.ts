import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { WaitlistQueryDto }        from './dto/waitlist-query.dto';
import { PatchWaitlistStatusDto }  from './dto/patch-waitlist-status.dto';

@Injectable()
export class WaitlistService {
  constructor(
    @InjectRepository('waitlist_entries')
    private readonly waitlistRepo: Repository<any>,
    private readonly dataSource: DataSource,
  ) {}

  // #201 — list with filters + pagination
  async findAll(query: WaitlistQueryDto) {
    const { status, page, limit } = query;
    const qb = this.waitlistRepo.createQueryBuilder('w')
      .orderBy('w.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (status) qb.andWhere('w.status = :status', { status });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // #201 — manual invite
  async invite(id: string, adminId: string): Promise<any> {
    const entry = await this.waitlistRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    entry.status     = 'invited';
    entry.invited_at = new Date();
    await this.waitlistRepo.save(entry);
    return entry;
  }

  // #201 — patch status
  async patchStatus(id: string, dto: PatchWaitlistStatusDto, adminId: string): Promise<any> {
    const entry = await this.waitlistRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Waitlist entry not found');

    entry.status = dto.status;
    await this.waitlistRepo.save(entry);
    return entry;
  }

  // #199 — leaderboard
  async getLeaderboard(limit: number = 10): Promise<any[]> {
    return this.dataSource.query(
      `SELECT user_id, display_name, points, rank, updated_at
       FROM waitlist_leaderboard
       ORDER BY rank ASC
       LIMIT $1`,
      [limit],
    );
  }

  // #203 — stats
  async getStats(): Promise<any> {
    const totalSignups = await this.waitlistRepo.count();
    const verifiedUsers = await this.waitlistRepo.count({ where: { status: 'verified' } });
    const invitedUsers = await this.waitlistRepo.count({ where: { status: 'invited' } });

    // Daily aggregates (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailySignups = await this.dataSource.query(
      `SELECT date(created_at) as date, count(*) as count
       FROM waitlist_entries
       WHERE created_at >= $1
       GROUP BY date(created_at)
       ORDER BY date ASC`,
      [sevenDaysAgo.toISOString()]
    );

    return {
      totalSignups,
      verifiedUsers,
      invitedUsers,
      dailySignups,
    };
  }
}
