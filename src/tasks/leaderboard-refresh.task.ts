import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class LeaderboardRefreshTask {
  private readonly logger = new Logger(LeaderboardRefreshTask.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async refreshLeaderboard() {
    this.logger.log('Refreshing waitlist_leaderboard materialized view');
    await this.dataSource.query(
      'REFRESH MATERIALIZED VIEW CONCURRENTLY waitlist_leaderboard'
    );
    this.logger.log('Leaderboard refreshed');
  }
}
