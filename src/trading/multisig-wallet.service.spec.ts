import { ethers } from 'ethers';
import { MultiSigWalletService } from './multisig-wallet.service';
import { SignatureScheme } from './dto/multisig.dto';
import { EscrowStatus } from './entities/escrow-agreement.entity';

type MockRepo<T = any> = {
  create: jest.Mock;
  save: jest.Mock;
  findOne: jest.Mock;
  find: jest.Mock;
  count: jest.Mock;
};

const createMockRepo = (): MockRepo => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => x),
  findOne: jest.fn(),
  find: jest.fn(async () => []),
  count: jest.fn(async () => 0),
});

describe('MultiSigWalletService', () => {
  let service: MultiSigWalletService;
  let walletRepo: MockRepo;
  let escrowRepo: MockRepo;
  let approvalRepo: MockRepo;
  let tradeRepo: MockRepo;
  let auditRepo: MockRepo;

  beforeEach(() => {
    walletRepo = createMockRepo();
    escrowRepo = createMockRepo();
    approvalRepo = createMockRepo();
    tradeRepo = createMockRepo();
    auditRepo = createMockRepo();

    auditRepo.findOne.mockResolvedValue(null);

    service = new MultiSigWalletService(
      walletRepo as never,
      escrowRepo as never,
      approvalRepo as never,
      tradeRepo as never,
      auditRepo as never,
      { getProvider: jest.fn() } as never,
      { deriveWallet: jest.fn() } as never,
    );
  });

  it('rejects wallet creation when threshold exceeds signer count', async () => {
    await expect(
      service.createWallet({
        name: 'Treasury',
        chainId: 1,
        signers: ['0x111', '0x222'],
        threshold: 3,
      }),
    ).rejects.toThrow('Threshold cannot exceed number of signers');
  });

  it('requires hardware-wallet proof for large transactions', async () => {
    const signer = ethers.Wallet.createRandom();
    const payload = 'approve escrow 1';
    const signature = await signer.signMessage(payload);

    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-1',
      signers: [signer.address.toLowerCase()],
      threshold: 1,
      supportedSignatureSchemes: ['ECDSA'],
      hardwareRequiredAbove: 10000,
      metadata: {},
    });

    escrowRepo.findOne.mockResolvedValue({
      id: 'escrow-1',
      walletId: 'wallet-1',
      amount: 20000,
      status: EscrowStatus.PENDING_APPROVAL,
      requiredApprovals: 1,
      approvedCount: 0,
    });

    approvalRepo.findOne.mockResolvedValue(null);

    await expect(
      service.submitApproval('escrow-1', {
        signerAddress: signer.address,
        payload,
        signature,
        signatureScheme: SignatureScheme.ECDSA,
      }),
    ).rejects.toThrow('Large transactions require hardware-wallet registered signers');
  });

  it('approves escrow when threshold is reached with valid hardware proof', async () => {
    const signer = ethers.Wallet.createRandom();
    const payload = 'approve escrow 2';
    const signature = await signer.signMessage(payload);

    walletRepo.findOne.mockResolvedValue({
      id: 'wallet-2',
      signers: [signer.address.toLowerCase()],
      threshold: 1,
      supportedSignatureSchemes: ['ECDSA', 'EDDSA'],
      hardwareRequiredAbove: 1000,
      metadata: {
        hardwareSigners: {
          [signer.address.toLowerCase()]: { fingerprint: 'ledger-alpha' },
        },
      },
    });

    escrowRepo.findOne.mockResolvedValue({
      id: 'escrow-2',
      walletId: 'wallet-2',
      amount: 5000,
      status: EscrowStatus.PENDING_APPROVAL,
      requiredApprovals: 1,
      approvedCount: 0,
    });

    approvalRepo.findOne.mockResolvedValue(null);
    approvalRepo.count.mockResolvedValue(1);

    const result = await service.submitApproval('escrow-2', {
      signerAddress: signer.address,
      payload,
      signature,
      signatureScheme: SignatureScheme.ECDSA,
      hardwareWalletFingerprint: 'ledger-alpha',
    });

    expect(result.approvalsRemaining).toBe(0);
    expect(result.escrow.status).toBe(EscrowStatus.APPROVED);
  });
});
