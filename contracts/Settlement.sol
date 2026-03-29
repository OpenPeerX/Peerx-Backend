// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Settlement {
    struct Escrow {
        address buyer;
        address seller;
        uint256 amount;
        address token;
        bool released;
    }

    struct MultiSigConfig {
        uint256 threshold;
        mapping(address => bool) isSigner;
    }

    mapping(bytes32 => Escrow) public escrows;
    mapping(bytes32 => MultiSigConfig) private multiSigConfigs;
    mapping(bytes32 => mapping(address => bool)) public escrowApprovals;
    mapping(bytes32 => uint256) public approvalCount;

    event TradeSettled(
        uint256 indexed tradeId,
        address buyer,
        address seller,
        uint256 amount,
        address token
    );

    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        address token
    );

    event EscrowApproved(bytes32 indexed escrowId, address indexed signer, uint256 approvals);
    event EscrowReleased(bytes32 indexed escrowId, address indexed seller, uint256 amount, address token);

    function configureMultiSig(
        string calldata escrowId,
        address[] calldata signers,
        uint256 threshold
    ) external {
        require(signers.length >= 2, "Need at least two signers");
        require(threshold >= 2 && threshold <= signers.length, "Invalid threshold");

        bytes32 escrowHash = keccak256(bytes(escrowId));
        MultiSigConfig storage cfg = multiSigConfigs[escrowHash];
        cfg.threshold = threshold;

        for (uint256 i = 0; i < signers.length; i++) {
            cfg.isSigner[signers[i]] = true;
        }
    }

    function lockEscrow(
        string calldata escrowId,
        address buyer,
        address seller,
        uint256 amount,
        address token
    ) external {
        require(amount > 0, "Amount must be positive");
        require(seller != address(0), "Invalid seller");

        bytes32 escrowHash = keccak256(bytes(escrowId));
        Escrow storage existing = escrows[escrowHash];
        require(existing.amount == 0, "Escrow already exists");

        escrows[escrowHash] = Escrow({
            buyer: buyer,
            seller: seller,
            amount: amount,
            token: token,
            released: false
        });

        emit EscrowCreated(escrowHash, buyer, seller, amount, token);
    }

    function approveEscrow(string calldata escrowId) external {
        bytes32 escrowHash = keccak256(bytes(escrowId));
        MultiSigConfig storage cfg = multiSigConfigs[escrowHash];
        require(cfg.threshold > 0, "Multisig not configured");
        require(cfg.isSigner[msg.sender], "Signer not authorized");
        require(!escrowApprovals[escrowHash][msg.sender], "Signer already approved");

        escrowApprovals[escrowHash][msg.sender] = true;
        approvalCount[escrowHash] += 1;

        emit EscrowApproved(escrowHash, msg.sender, approvalCount[escrowHash]);
    }

    function releaseEscrow(
        string calldata escrowId,
        address seller,
        uint256 amount,
        address token
    ) external {
        bytes32 escrowHash = keccak256(bytes(escrowId));
        Escrow storage escrow = escrows[escrowHash];
        MultiSigConfig storage cfg = multiSigConfigs[escrowHash];

        require(escrow.amount > 0, "Escrow not found");
        require(!escrow.released, "Escrow already released");
        require(cfg.threshold > 0, "Multisig not configured");
        require(approvalCount[escrowHash] >= cfg.threshold, "Insufficient approvals");
        require(escrow.seller == seller, "Seller mismatch");
        require(escrow.amount == amount, "Amount mismatch");
        require(escrow.token == token, "Token mismatch");

        escrow.released = true;
        emit EscrowReleased(escrowHash, seller, amount, token);

        // In production: token transfer call or native transfer would happen here.
    }

    function settleTrade(
        uint256 tradeId,
        address buyer,
        address seller,
        uint256 amount,
        address token
    ) external {
        emit TradeSettled(tradeId, buyer, seller, amount, token);
        // In production: token.transferFrom(buyer, seller, amount); require success
    }
}
