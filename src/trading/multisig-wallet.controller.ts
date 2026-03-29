import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MultiSigWalletService } from './multisig-wallet.service';
import {
  CreateEscrowDto,
  CreateMultiSigWalletDto,
  RegisterHardwareWalletDto,
  SubmitApprovalDto,
} from './dto/multisig.dto';

@ApiTags('trading-multisig')
@Controller('trading/multisig')
export class MultiSigWalletController {
  constructor(private readonly multiSigService: MultiSigWalletService) {}

  @Post('wallets')
  @ApiOperation({ summary: 'Create a decentralized multi-signature wallet' })
  @ApiBody({ type: CreateMultiSigWalletDto })
  @ApiResponse({ status: 201, description: 'Multi-signature wallet created' })
  createWallet(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateMultiSigWalletDto,
  ) {
    return this.multiSigService.createWallet(dto);
  }

  @Get('wallets/:walletId')
  @ApiOperation({ summary: 'Get multi-signature wallet details' })
  @ApiParam({ name: 'walletId', description: 'Wallet identifier' })
  getWallet(@Param('walletId') walletId: string) {
    return this.multiSigService.getWalletById(walletId);
  }

  @Post('wallets/:walletId/hardware')
  @ApiOperation({ summary: 'Register hardware wallet proof for a signer' })
  @ApiParam({ name: 'walletId', description: 'Wallet identifier' })
  @ApiBody({ type: RegisterHardwareWalletDto })
  registerHardwareWallet(
    @Param('walletId') walletId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: RegisterHardwareWalletDto,
  ) {
    return this.multiSigService.registerHardwareWallet(walletId, dto);
  }

  @Post('escrow')
  @ApiOperation({ summary: 'Create smart-contract-backed escrow request for a trade' })
  @ApiBody({ type: CreateEscrowDto })
  createEscrow(
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateEscrowDto,
  ) {
    return this.multiSigService.createEscrow(dto);
  }

  @Get('escrow/:escrowId')
  @ApiOperation({ summary: 'Get escrow request details' })
  @ApiParam({ name: 'escrowId', description: 'Escrow identifier' })
  getEscrow(@Param('escrowId') escrowId: string) {
    return this.multiSigService.getEscrowById(escrowId);
  }

  @Post('escrow/:escrowId/approve')
  @ApiOperation({ summary: 'Submit signer approval for an escrow request' })
  @ApiParam({ name: 'escrowId', description: 'Escrow identifier' })
  @ApiBody({ type: SubmitApprovalDto })
  submitApproval(
    @Param('escrowId') escrowId: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: SubmitApprovalDto,
  ) {
    return this.multiSigService.submitApproval(escrowId, dto);
  }

  @Get('escrow/:escrowId/approvals')
  @ApiOperation({ summary: 'Get approval trail for an escrow request' })
  @ApiParam({ name: 'escrowId', description: 'Escrow identifier' })
  getApprovals(@Param('escrowId') escrowId: string) {
    return this.multiSigService.getEscrowApprovals(escrowId);
  }

  @Post('escrow/:escrowId/execute')
  @ApiOperation({ summary: 'Execute approved escrow on-chain/off-chain settlement path' })
  @ApiParam({ name: 'escrowId', description: 'Escrow identifier' })
  executeEscrow(@Param('escrowId') escrowId: string) {
    return this.multiSigService.executeEscrow(escrowId);
  }
}
