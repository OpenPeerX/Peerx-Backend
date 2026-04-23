import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity()
@Index(['symbol', 'date'])
export class Benchmark {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index()
  symbol: string;

  @Column()
  name: string;

  @Column('decimal', { precision: 20, scale: 8 })
  value: number;

  @Column('decimal', { precision: 10, scale: 4, nullable: true })
  dailyReturn: number;

  @Column('json', { nullable: true })
  historicalData: Array<{
    date: string;
    value: number;
    return: number;
  }>;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  @Index()
  date: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
