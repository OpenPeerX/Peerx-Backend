import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateLiquidityPoolDto } from './dto/create-liquidity-pool.dto';
import { CreateLiquidityProgramDto } from './dto/create-liquidity-program.dto';
import { StakeLiquidityDto } from './dto/stake-liquidity.dto';
import { LiquidityMiningService } from './liquidity-mining.service';

@ApiTags('liquidity-mining')
@Controller('liquidity-mining')
export class LiquidityMiningController {
  constructor(private readonly liquidityMiningService: LiquidityMiningService) {}

  @Post('pools')
  createPool(@Body() dto: CreateLiquidityPoolDto) {
    return this.liquidityMiningService.createPool(dto);
  }

  @Post('programs')
  createProgram(@Body() dto: CreateLiquidityProgramDto) {
    return this.liquidityMiningService.createProgram(dto);
  }

  @Post('stakes')
  stake(@Body() dto: StakeLiquidityDto) {
    return this.liquidityMiningService.stake(dto);
  }

  @Post('stakes/:stakeId/unstake')
  unstake(@Param('stakeId') stakeId: string) {
    return this.liquidityMiningService.unstake(stakeId);
  }

  @Post('stakes/:stakeId/claim')
  claim(@Param('stakeId') stakeId: string) {
    return this.liquidityMiningService.claim(stakeId);
  }

  @Get('dashboard/:userId')
  dashboard(@Param('userId') userId: string) {
    return this.liquidityMiningService.getDashboard(Number(userId));
  }

  @Get('analytics')
  analytics() {
    return this.liquidityMiningService.getAnalytics();
  }
}
