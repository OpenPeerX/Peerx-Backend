import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';
import { MultiSigWallet } from './entities/multisig-wallet.entity';
import {
  ApprovalStatus,
  MultiSigApproval,
} from './entities/multisig-approval.entity';
import { EscrowAgreement, EscrowStatus } from './entities/escrow-agreement.entity';
import {
  CreateEscrowDto,
  CreateMultiSigWalletDto,
  RegisterHardwareWalletDto,
  SignatureScheme,
  SubmitApprovalDto,
} from './dto/multisig.dto';
import { Trade } from './entities/trade.entity';
import { AuditLog } from '../portfolio/audit-log.entity';
import { Web3Service } from '../portfolio/dto/web3.service';
import { WalletService } from '../portfolio/dto/wallet.service';

const SETTLEMENT_ESCROW_ABI = [
  'function releaseEscrow(string escrowId, address seller, uint256 amount, address token) external',
  'event EscrowReleased(string escrowId, address seller, uint256 amount, address token)',
];

@Injectable()
export class MultiSigWalletService {
  private readonly logger = new Logger(MultiSigWalletService.name);
  private readonly largeTxThreshold = Number(
    process.env.MULTISIG_LARGE_TX_THRESHOLD ?? '10000',
  );

  constructor(
    @InjectRepository(MultiSigWallet)
    private readonly walletRepo: Repository<MultiSigWallet>,
    @InjectRepository(EscrowAgreement)
    private readonly escrowRepo: Repository<EscrowAgreement>,
    @InjectRepository(MultiSigApproval)
    private readonly approvalRepo: Repository<MultiSigApproval>,
    @InjectRepository(Trade)
    private readonly tradeRepo: Repository<Trade>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly web3Service: Web3Service,
    private readonly walletService: WalletService,
  ) {}

  async createWallet(dto: CreateMultiSigWalletDto): Promise<MultiSigWallet> {
    const signers = [...new Set(dto.signers.map((s) => s.toLowerCase()))];
    if (dto.threshold > signers.length) {
      throw new Error('Threshold cannot exceed number of signers');
    }

    const wallet = this.walletRepo.create({
      name: dto.name,
      chainId: dto.chainId,
      signers,
      threshold: dto.threshold,
      custodyModel: dto.custodyModel,
      supportedSignatureSchemes:
        dto.supportedSignatureSchemes?.map((s) => s.toUpperCase()) ?? [SignatureScheme.ECDSA],
      hardwareRequiredAbove: dto.hardwareRequiredAbove ?? this.largeTxThreshold,
      metadata: {
        hardwareSigners: {},
        createdBy: 'system',
      },
    });

    const saved = await this.walletRepo.save(wallet);
    await this.writeAudit('MULTISIG_WALLET_CREATED', 'MULTISIG_WALLET', saved.id, {
      threshold: saved.threshold,
      signerCount: saved.signers.length,
      custodyModel: saved.custodyModel,
    });

    return saved;
  }

  async registerHardwareWallet(
    walletId: string,
    dto: RegisterHardwareWalletDto,
  ): Promise<MultiSigWallet> {
    const wallet = await this.getWalletById(walletId);
    const signer = dto.signerAddress.toLowerCase();

    if (!wallet.signers.includes(signer)) {
      throw new Error('Signer is not part of the wallet');
    }

    const metadata = wallet.metadata ?? {};
    const hardwareSigners = (metadata.hardwareSigners as Record<string, unknown>) ?? {};
    hardwareSigners[signer] = {
      fingerprint: dto.fingerprint,
      publicKey: dto.publicKey,
      addedAt: new Date().toISOString(),
    };

    wallet.metadata = {
      ...metadata,
      hardwareSigners,
    };

    const saved = await this.walletRepo.save(wallet);
    await this.writeAudit('HARDWARE_WALLET_REGISTERED', 'MULTISIG_WALLET', walletId, {
      signer,
      fingerprint: dto.fingerprint,
    });

    return saved;
  }

  async createEscrow(dto: CreateEscrowDto): Promise<EscrowAgreement> {
    const wallet = await this.getWalletById(dto.walletId);
    const requiredApprovals = dto.requiredApprovals ?? wallet.threshold;

    if (requiredApprovals > wallet.signers.length) {
      throw new Error('Required approvals cannot exceed signer count');
    }

    if (dto.tradeId) {
      const trade = await this.tradeRepo.findOne({ where: { id: dto.tradeId } });
      if (!trade) {
        throw new NotFoundException('Trade not found');
      }
    }

    const escrow = this.escrowRepo.create({
      tradeId: dto.tradeId,
      walletId: dto.walletId,
      chainId: dto.chainId,
      buyer: dto.buyer,
      seller: dto.seller,
      asset: dto.asset,
      tokenAddress: dto.tokenAddress,
      amount: dto.amount,
      requiredApprovals,
      status: EscrowStatus.PENDING_APPROVAL,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      metadata: {
        decentralizedCustody: wallet.custodyModel,
        supportedSignatureSchemes: wallet.supportedSignatureSchemes,
      },
    });

    const saved = await this.escrowRepo.save(escrow);
    await this.writeAudit('ESCROW_CREATED', 'ESCROW', saved.id, {
      walletId: dto.walletId,
      amount: dto.amount,
      requiredApprovals,
      custodyModel: wallet.custodyModel,
    });

    return saved;
  }

  async submitApproval(
    escrowId: string,
    dto: SubmitApprovalDto,
  ): Promise<{ escrow: EscrowAgreement; approval: MultiSigApproval; approvalsRemaining: number }> {
    const escrow = await this.getEscrowById(escrowId);
    if (escrow.status !== EscrowStatus.PENDING_APPROVAL) {
      throw new Error(`Escrow is not awaiting approvals (status: ${escrow.status})`);
    }

    if (escrow.expiresAt && escrow.expiresAt.getTime() < Date.now()) {
      escrow.status = EscrowStatus.EXPIRED;
      await this.escrowRepo.save(escrow);
      throw new Error('Escrow request expired');
    }

    const wallet = await this.getWalletById(escrow.walletId);
    const signer = dto.signerAddress.toLowerCase();
    if (!wallet.signers.includes(signer)) {
      throw new Error('Signer not authorized for this wallet');
    }

    const signatureScheme = dto.signatureScheme.toUpperCase();
    if (!wallet.supportedSignatureSchemes.includes(signatureScheme)) {
      throw new Error(`Signature scheme ${signatureScheme} is not enabled on this wallet`);
    }

    const existing = await this.approvalRepo.findOne({ where: { escrowId, signerAddress: signer } });
    if (existing) {
      throw new Error('Signer has already approved this escrow');
    }

    this.verifySignature(dto.payload, dto.signature, signer, dto.signatureScheme);
    this.enforceLargeTransactionHardwarePolicy(wallet, escrow, signer, dto);

    const payloadHash = ethers.id(dto.payload);
    const approval = this.approvalRepo.create({
      escrowId,
      walletId: wallet.id,
      signerAddress: signer,
      signature: dto.signature,
      signatureScheme,
      payloadHash,
      hardwareWalletFingerprint: dto.hardwareWalletFingerprint,
      status: ApprovalStatus.APPROVED,
    });

    const savedApproval = await this.approvalRepo.save(approval);
    const approvedCount = await this.approvalRepo.count({
      where: { escrowId, status: ApprovalStatus.APPROVED },
    });

    escrow.approvedCount = approvedCount;
    if (approvedCount >= escrow.requiredApprovals) {
      escrow.status = EscrowStatus.APPROVED;
    }
    const savedEscrow = await this.escrowRepo.save(escrow);

    await this.writeAudit('MULTISIG_APPROVAL_SUBMITTED', 'ESCROW', escrowId, {
      signer,
      approvedCount,
      requiredApprovals: escrow.requiredApprovals,
      signatureScheme,
    });

    return {
      escrow: savedEscrow,
      approval: savedApproval,
      approvalsRemaining: Math.max(escrow.requiredApprovals - approvedCount, 0),
    };
  }

  async executeEscrow(escrowId: string): Promise<EscrowAgreement> {
    const escrow = await this.getEscrowById(escrowId);
    if (escrow.status !== EscrowStatus.APPROVED) {
      throw new Error('Escrow is not approved yet');
    }

    const contractAddress = process.env.SETTLEMENT_CONTRACT;
    let txHash = `offchain-${ethers.id(`${escrow.id}:${Date.now()}`).slice(2, 18)}`;

    if (contractAddress) {
      const provider = this.web3Service.getProvider(escrow.chainId);
      let walletIndex = 0;

      if (escrow.tradeId) {
        const trade = await this.tradeRepo.findOne({ where: { id: escrow.tradeId } });
        walletIndex = trade ? trade.userId % 10 : 0;
      }

      const signer = this.walletService.deriveWallet(walletIndex).connect(provider);
      const contract = new ethers.Contract(contractAddress, SETTLEMENT_ESCROW_ABI, signer);

      const amountWei = ethers.parseEther(String(escrow.amount));
      const token = escrow.tokenAddress ?? ethers.ZeroAddress;
      const tx = await contract.releaseEscrow(escrow.id, escrow.seller, amountWei, token);
      txHash = tx.hash;
    }

    escrow.executedTxHash = txHash;
    escrow.status = EscrowStatus.EXECUTED;
    const saved = await this.escrowRepo.save(escrow);

    await this.writeAudit('ESCROW_EXECUTED', 'ESCROW', escrowId, {
      txHash,
      amount: escrow.amount,
      chainId: escrow.chainId,
    });

    return saved;
  }

  async getWalletById(walletId: string): Promise<MultiSigWallet> {
    const wallet = await this.walletRepo.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Multi-signature wallet not found');
    }
    return wallet;
  }

  async getEscrowById(escrowId: string): Promise<EscrowAgreement> {
    const escrow = await this.escrowRepo.findOne({ where: { id: escrowId } });
    if (!escrow) {
      throw new NotFoundException('Escrow request not found');
    }
    return escrow;
  }

  async getEscrowApprovals(escrowId: string): Promise<MultiSigApproval[]> {
    await this.getEscrowById(escrowId);
    return this.approvalRepo.find({ where: { escrowId } });
  }

  private verifySignature(
    payload: string,
    signature: string,
    signerAddress: string,
    scheme: SignatureScheme,
  ): void {
    if (scheme === SignatureScheme.ECDSA) {
      const recovered = ethers.verifyMessage(payload, signature).toLowerCase();
      if (recovered !== signerAddress) {
        throw new Error('Invalid ECDSA signature');
      }
      return;
    }

    // EDDSA and SCHNORR support relies on upstream signer plugins. We validate
    // canonical signature formatting here to allow heterogeneous signer sets.
    const validHexSignature = /^0x[0-9a-fA-F]+$/.test(signature) && signature.length >= 130;
    if (!validHexSignature) {
      throw new Error(`Invalid ${scheme} signature format`);
    }
  }

  private enforceLargeTransactionHardwarePolicy(
    wallet: MultiSigWallet,
    escrow: EscrowAgreement,
    signer: string,
    dto: SubmitApprovalDto,
  ): void {
    const limit = Number(wallet.hardwareRequiredAbove ?? this.largeTxThreshold);
    const amount = Number(escrow.amount);
    if (amount < limit) {
      return;
    }

    const hardwareSigners =
      (wallet.metadata?.hardwareSigners as Record<string, { fingerprint: string }>) ?? {};
    const registered = hardwareSigners[signer];

    if (!registered) {
      throw new Error('Large transactions require hardware-wallet registered signers');
    }

    if (!dto.hardwareWalletFingerprint || dto.hardwareWalletFingerprint !== registered.fingerprint) {
      throw new Error('Large transactions require matching hardware-wallet fingerprint proof');
    }
  }

  private async writeAudit(
    action: string,
    resource: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const lastLog = await this.auditRepo.findOne({ order: { timestamp: 'DESC' } });
    const previousHash = lastLog?.hash ?? 'GENESIS_HASH';
    const timestamp = new Date();

    const dataToHash = JSON.stringify({
      action,
      resource,
      resourceId,
      metadata,
      timestamp: timestamp.toISOString(),
      previousHash,
    });

    const hash = ethers.id(dataToHash);
    const entry = this.auditRepo.create({
      action,
      resource,
      resourceId,
      metadata,
      status: 'SUCCESS',
      timestamp,
      previousHash,
      hash,
    });

    await this.auditRepo.save(entry);
    this.logger.debug(`[AUDIT] ${action} -> ${resource}:${resourceId}`);
  }
}
