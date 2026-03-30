import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('trader_follows')
@Unique(['traderId', 'followerId'])
@Index(['traderId'])
@Index(['followerId'])
export class TraderFollow {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  traderId: number;

  @Column()
  followerId: number;

  @CreateDateColumn()
  createdAt: Date;
}