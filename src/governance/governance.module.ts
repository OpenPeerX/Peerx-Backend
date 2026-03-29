import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GovernanceProposal } from './entities/governance-proposal.entity';
import { GovernanceStake } from './entities/governance-stake.entity';
import { GovernanceVote } from './entities/governance-vote.entity';
import { GovernanceController } from './governance.controller';
import { GovernanceService } from './governance.service';

@Module({
  imports: [TypeOrmModule.forFeature([GovernanceProposal, GovernanceVote, GovernanceStake])],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
