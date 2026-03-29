import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateGovernanceProposalDto } from './dto/create-governance-proposal.dto';
import { UpsertGovernanceStakeDto } from './dto/upsert-governance-stake.dto';
import { GovernanceService } from './governance.service';

@ApiTags('governance')
@Controller('governance')
export class GovernanceController {
  constructor(private readonly governanceService: GovernanceService) {}

  @Post('stakes')
  upsertStake(@Body() dto: UpsertGovernanceStakeDto) {
    return this.governanceService.upsertStake(dto);
  }

  @Post('proposals')
  createProposal(@Body() dto: CreateGovernanceProposalDto) {
    return this.governanceService.createProposal(dto);
  }

  @Get('proposals')
  listProposals() {
    return this.governanceService.listProposals();
  }

  @Get('proposals/:proposalId')
  getProposal(@Param('proposalId') proposalId: string) {
    return this.governanceService.getProposal(proposalId);
  }

  @Get('proposals/:proposalId/status')
  getProposalStatus(@Param('proposalId') proposalId: string) {
    return this.governanceService.getVoteStatus(proposalId);
  }

  @Post('proposals/:proposalId/votes')
  castVote(@Param('proposalId') proposalId: string, @Body() dto: CastVoteDto) {
    return this.governanceService.castVote(proposalId, dto);
  }

  @Post('proposals/:proposalId/tally')
  tally(@Param('proposalId') proposalId: string) {
    return this.governanceService.tallyProposal(proposalId);
  }

  @Post('proposals/:proposalId/execute')
  execute(@Param('proposalId') proposalId: string) {
    return this.governanceService.executeProposal(proposalId);
  }
}
