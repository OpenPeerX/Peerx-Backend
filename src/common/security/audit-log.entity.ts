import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  userId: string;

  @Column()
  action: string;

  @Column({ type: 'json', nullable: true })
  details: unknown | null;

  @Column({ nullable: true })
  ip: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

