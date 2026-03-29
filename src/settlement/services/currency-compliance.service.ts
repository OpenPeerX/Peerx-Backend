import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyConfig, ComplianceLevel } from '../entities/currency-config.entity';
import {
  CurrencyComplianceCheckDto,
  ComplianceCheckResultDto,
} from '../dto/currency-config.dto';
import { Decimal } from 'decimal.js';

@Injectable()
export class CurrencyComplianceService {
  private readonly logger = new Logger(CurrencyComplianceService.name);

  // High-risk countries (OFAC list)
  private readonly highRiskCountries = [
    'KP', // North Korea
    'IR', // Iran
    'SY', // Syria
    'CU', // Cuba
  ];

  // Restricted currencies
  private readonly restrictedCurrencies = ['KPW', 'IRR', 'SYP', 'CUP'];

  constructor(
    @InjectRepository(CurrencyConfig)
    private currencyConfigRepository: Repository<CurrencyConfig>,
  ) {}

  /**
   * Perform comprehensive compliance check
   */
  async performComplianceCheck(
    dto: CurrencyComplianceCheckDto,
  ): Promise<ComplianceCheckResultDto> {
    const { currency, amount, recipientCountry, senderCountry, transactionPurpose } = dto;

    const config = await this.currencyConfigRepository.findOne({
      where: { currency, isEnabled: true },
    });

    if (!config) {
      throw new BadRequestException(`Currency ${currency} is not supported or disabled`);
    }

    let flaggedForReview = false;
    let riskLevel = 'LOW';
    const recommendations: string[] = [];

    // 1. Check if currency is restricted
    if (this.restrictedCurrencies.includes(currency)) {
      flaggedForReview = true;
      riskLevel = 'CRITICAL';
      recommendations.push('Currency is on restricted list - manual review required');
    }

    // 2. Check high-risk countries
    if (recipientCountry && this.highRiskCountries.includes(recipientCountry)) {
      flaggedForReview = true;
      riskLevel = 'CRITICAL';
      recommendations.push(`Recipient country ${recipientCountry} is high-risk`);
    }

    if (senderCountry && this.highRiskCountries.includes(senderCountry)) {
      flaggedForReview = true;
      riskLevel = 'CRITICAL';
      recommendations.push(`Sender country ${senderCountry} is high-risk`);
    }

    // 3. Check settlement limits
    const limitCheck = await this.checkSettlementLimits(currency, amount);
    if (!limitCheck.isWithinLimits) {
      flaggedForReview = true;
      if (riskLevel !== 'CRITICAL') {
        riskLevel = 'HIGH';
      }
      recommendations.push(...limitCheck.warnings);
    }

    // 4. Amount-based risk assessment
    const amountRisk = this.assessAmountRisk(currency, amount, config);
    if (amountRisk.flagged) {
      flaggedForReview = true;
      if (amountRisk.riskLevel === 'CRITICAL') {
        riskLevel = 'CRITICAL';
      } else if (amountRisk.riskLevel === 'HIGH' && riskLevel !== 'CRITICAL') {
        riskLevel = 'HIGH';
      }
      recommendations.push(...amountRisk.recommendations);
    }

    // 5. Transaction purpose assessment
    const purposeRisk = this.assessTransactionPurpose(transactionPurpose);
    if (purposeRisk.flagged) {
      flaggedForReview = true;
      if (purposeRisk.riskLevel === 'CRITICAL') {
        riskLevel = 'CRITICAL';
      } else if (purposeRisk.riskLevel === 'HIGH' && riskLevel !== 'CRITICAL') {
        riskLevel = 'HIGH';
      }
      recommendations.push(...purposeRisk.recommendations);
    }

    // 6. Compliance level determines requirements
    const requiresAml = config.requiresAmlCheck || riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
    const requiresKyc = config.requiresKycVerification || riskLevel === 'HIGH' || riskLevel === 'CRITICAL';
    const requiresManualApproval = config.requiresManualApproval || flaggedForReview;

    this.logger.log(
      `Compliance check for ${currency}: Risk=${riskLevel}, FlaggedForReview=${flaggedForReview}`,
    );

    return {
      currency,
      amount,
      complianceLevel: config.complianceLevel,
      requiresAml,
      requiresKyc,
      requiresManualApproval,
      recommendations,
      riskLevel,
      flaggedForReview,
    };
  }

  /**
   * Check settlement limits
   */
  async checkSettlementLimits(
    currency: string,
    amount: number,
  ): Promise<{
    isWithinLimits: boolean;
    warnings: string[];
  }> {
    const config = await this.currencyConfigRepository.findOne({
      where: { currency },
    });

    if (!config) {
      return {
        isWithinLimits: false,
        warnings: [`Currency ${currency} configuration not found`],
      };
    }

    const warnings: string[] = [];
    const amountDecimal = new Decimal(amount);
    const minDecimal = new Decimal(config.minSettlementAmount);
    const maxDecimal = new Decimal(config.maxSettlementAmount);

    if (amountDecimal.lessThan(minDecimal)) {
      warnings.push(`Amount below minimum settlement (${config.minSettlementAmount} ${currency})`);
    }

    if (amountDecimal.greaterThan(maxDecimal)) {
      warnings.push(`Amount exceeds maximum settlement (${config.maxSettlementAmount} ${currency})`);
    }

    // Check daily and monthly limits
    // In real implementation, would query actual used amounts
    if (config.dailyLimitAmount) {
      if (amountDecimal.greaterThan(config.dailyLimitAmount)) {
        warnings.push(`Amount approaches daily limit (${config.dailyLimitAmount} ${currency})`);
      }
    }

    if (config.monthlyLimitAmount) {
      if (amountDecimal.greaterThan(config.monthlyLimitAmount)) {
        warnings.push(`Amount approaches monthly limit (${config.monthlyLimitAmount} ${currency})`);
      }
    }

    return {
      isWithinLimits: warnings.length === 0,
      warnings,
    };
  }

  /**
   * Assess risk based on amount
   */
  private assessAmountRisk(
    currency: string,
    amount: number,
    config: CurrencyConfig,
  ): {
    flagged: boolean;
    riskLevel: string;
    recommendations: string[];
  } {
    const amountDecimal = new Decimal(amount);
    const recommendations: string[] = [];
    let riskLevel = 'LOW';
    let flagged = false;

    // Very large transactions
    const largeThreshold = new Decimal(config.maxSettlementAmount ?? 1000000).times(0.8);
    if (amountDecimal.greaterThan(largeThreshold)) {
      flagged = true;
      riskLevel = 'HIGH';
      recommendations.push(`Large transaction amount (${amount} ${currency})`);
    }

    // Very small transactions (potential structuring)
    const minThreshold = new Decimal(config.minSettlementAmount ?? 1000).times(1.5);
    const smallThreshold = new Decimal(10000);
    if (
      amountDecimal.greaterThan(smallThreshold) &&
      amountDecimal.lessThan(minThreshold)
    ) {
      flagged = true;
      riskLevel = 'MEDIUM';
      recommendations.push('Transaction amount may indicate potential structuring');
    }

    // Round number amounts (potential risk indicator)
    const roundedAmount = Math.round(amount);
    if (amount === roundedAmount && roundedAmount % 100000 === 0) {
      recommendations.push('Exact round number - verify legitimacy');
    }

    return { flagged, riskLevel, recommendations };
  }

  /**
   * Assess transaction purpose risk
   */
  private assessTransactionPurpose(purpose?: string): {
    flagged: boolean;
    riskLevel: string;
    recommendations: string[];
  } {
    const recommendations: string[] = [];
    let riskLevel = 'LOW';
    let flagged = false;

    if (!purpose) {
      recommendations.push('No transaction purpose provided');
      return { flagged, riskLevel, recommendations };
    }

    const highRiskKeywords = [
      'money laundering',
      'sanctions evasion',
      'terrorist',
      'drug',
      'illegal',
      'cash',
    ];
    const lowRiskKeywords = [
      'salary',
      'dividend',
      'refund',
      'payment',
      'invoice',
      'trade',
      'service',
    ];

    const purposeLower = purpose.toLowerCase();

    // Check for high-risk keywords
    for (const keyword of highRiskKeywords) {
      if (purposeLower.includes(keyword)) {
        flagged = true;
        riskLevel = 'CRITICAL';
        recommendations.push(`High-risk keyword detected: ${keyword}`);
        break;
      }
    }

    // No low-risk keywords found
    if (!lowRiskKeywords.some((kw) => purposeLower.includes(kw))) {
      flagged = true;
      if (riskLevel !== 'CRITICAL') {
        riskLevel = 'MEDIUM';
      }
      recommendations.push('Unclear transaction purpose - verify legitimacy');
    }

    return { flagged, riskLevel, recommendations };
  }

  /**
   * Check AML compliance
   */
  async checkAmlCompliance(currency: string, amount: number): Promise<boolean> {
    const config = await this.currencyConfigRepository.findOne({
      where: { currency, requiresAmlCheck: true },
    });

    if (!config) {
      return true; // No AML check required
    }

    // In real implementation, would call AML service/API
    const amountDecimal = new Decimal(amount);
    const threshold = new Decimal(10000); // AML threshold

    if (amountDecimal.greaterThan(threshold)) {
      this.logger.warn(`AML check required for amount: ${amount} ${currency}`);
      return false; // Requires manual review
    }

    return true;
  }

  /**
   * Check KYC compliance
   */
  async checkKycCompliance(userId: string, currency: string): Promise<boolean> {
    const config = await this.currencyConfigRepository.findOne({
      where: { currency, requiresKycVerification: true },
    });

    if (!config) {
      return true; // No KYC check required
    }

    // In real implementation, would verify user KYC status
    this.logger.log(`KYC check required for user: ${userId}, currency: ${currency}`);
    return false; // Requires manual verification
  }

  /**
   * Get compliance summary
   */
  async getComplianceSummary(currency: string): Promise<{
    currency: string;
    complianceLevel: ComplianceLevel;
    requiresAml: boolean;
    requiresKyc: boolean;
    requiresManualApproval: boolean;
    minAmount: number;
    maxAmount: number;
  }> {
    const config = await this.currencyConfigRepository.findOne({
      where: { currency },
    });

    if (!config) {
      throw new BadRequestException(`Currency ${currency} not found`);
    }

    return {
      currency,
      complianceLevel: config.complianceLevel,
      requiresAml: config.requiresAmlCheck,
      requiresKyc: config.requiresKycVerification,
      requiresManualApproval: config.requiresManualApproval,
      minAmount: parseFloat(config.minSettlementAmount.toString()),
      maxAmount: parseFloat(config.maxSettlementAmount.toString()),
    };
  }
}
