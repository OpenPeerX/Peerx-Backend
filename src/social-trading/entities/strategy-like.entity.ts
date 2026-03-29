import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('strategy_likes')
@Unique(['strategyId', 'userId'])
@Index(['strategyId'])
export class StrategyLike {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  strategyId: number;

  @Column()
  userId: number;

  @CreateDateColumn()
  createdAt: Date;
}