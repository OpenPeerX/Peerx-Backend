import { Body, Controller, Get, Param, Post, Delete, Patch, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CastVoteDto } from './dto/cast-vote.dto';
import { CreateGovernanceProposalDto } from './dto/create-governance-proposal.dto';
import { UpsertGovernanceStakeDto } from './dto/upsert-governance-stake.dto';
import { UpdateGovernanceProposalDto } from './dto/update-governance-proposal.dto';
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

  @Get('stakes/:userId')
  getUserStake(@Param('userId') userId: string) {
    return this.governanceService.getUserStake(Number(userId));
  }

  @Get('votes/user/:userId')
  getUserVotes(@Param('userId') userId: string) {
    return this.governanceService.getUserVotes(Number(userId));
  }

  @Get('audit')
  getAuditLog(@Query('limit') limit?: string) {
    return this.governanceService.getAuditLog(limit ? Number(limit) : 100);
  }

  @Get('snapshot/:proposalId')
  getVotingSnapshot(@Param('proposalId') proposalId: string) {
    return this.governanceService.getVotingSnapshot(proposalId);
  }

  @Patch('proposals/:proposalId')
  updateProposal(@Param('proposalId') proposalId: string, @Body() dto: UpdateGovernanceProposalDto) {
    return this.governanceService.updateProposal(proposalId, dto);
  }

  @Delete('proposals/:proposalId')
  cancelProposal(@Param('proposalId') proposalId: string) {
    return this.governanceService.cancelProposal(proposalId);
  }

  @Post('proposals/:proposalId/execute')
  execute(@Param('proposalId') proposalId: string) {
    return this.governanceService.executeProposal(proposalId);
  }
}
