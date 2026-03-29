import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('strategy_comments')
@Index(['strategyId', 'createdAt'])
export class StrategyComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  strategyId: number;

  @Column()
  userId: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;
}