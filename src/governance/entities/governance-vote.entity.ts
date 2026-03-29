import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum VoteChoice {
  YES = 'YES',
  NO = 'NO',
  ABSTAIN = 'ABSTAIN',
}

@Entity('governance_votes')
@Unique(['proposalId', 'voterUserId'])
export class GovernanceVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  proposalId: string;

  @Column()
  voterUserId: number;

  @Column({ type: 'varchar' })
  choice: VoteChoice;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  votingPower: number;

  @Column({ nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn()
  createdAt: Date;
}
