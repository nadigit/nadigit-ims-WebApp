import { Injectable } from '@angular/core';
import { LicenseCapabilitiesService } from './license-capabilities.service';
import { AppConfigurationService } from './app-configuration.service';
import { firstValueFrom } from 'rxjs';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PaymentValidationService {
  private requireAccountConfig: boolean | null = null;
  private minimumAmountConfig: number | null = null;
  private configLoaded: boolean = false;

  constructor(
    private configService: AppConfigurationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
  ) {
    this.configService.configurationSaved$.subscribe((key) => {
      if (key?.startsWith('payment.bank.methods.')) {
        this.invalidateBankPaymentConfig();
      }
    });
  }

  private invalidateBankPaymentConfig(): void {
    this.configLoaded = false;
    this.requireAccountConfig = null;
    this.minimumAmountConfig = null;
  }

  /**
   * Check if a payment method is a bank method (Check, Transfer, BOE)
   */
  isBankMethod(method: string): boolean {
    return ['Check', 'Transfer', 'BOE'].includes(method);
  }

  /**
   * Load configuration values from backend
   */
  async loadConfigurations(): Promise<void> {
    if (this.configLoaded) return;

    try {
      // Load require account config
      try {
        const requireAccountObs = await this.configService.getConfigurationValue('payment.bank.methods.require.account');
        const requireAccountValue = await firstValueFrom(requireAccountObs);
        this.requireAccountConfig = String(requireAccountValue).toLowerCase() === 'true';
      } catch (error) {
        console.warn('Could not load require account config, using default:', error);
        this.requireAccountConfig = true; // Default to true
      }

      // Load minimum amount config
      try {
        const minimumAmountObs = await this.configService.getConfigurationValue('payment.bank.methods.minimum.amount');
        const minimumAmountValue = await firstValueFrom(minimumAmountObs);
        this.minimumAmountConfig = parseFloat(String(minimumAmountValue)) || 0;
      } catch (error) {
        console.warn('Could not load minimum amount config, using default:', error);
        this.minimumAmountConfig = 0; // Default to 0
      }

      this.configLoaded = true;
    } catch (error) {
      console.error('Error loading payment validation configurations:', error);
      // Default values if config fails to load
      this.requireAccountConfig = true;
      this.minimumAmountConfig = 0;
      this.configLoaded = true;
    }
  }

  /**
   * Get the require account configuration value
   */
  async getRequireAccount(): Promise<boolean> {
    if (!this.configLoaded) {
      await this.loadConfigurations();
    }
    return this.requireAccountConfig ?? true; // Default to true
  }

  /**
   * Get the minimum amount configuration value
   */
  async getMinimumAmount(): Promise<number> {
    if (!this.configLoaded) {
      await this.loadConfigurations();
    }
    return this.minimumAmountConfig ?? 0; // Default to 0
  }

  /**
   * Validate bank account requirement
   */
  async validateBankAccount(
    method: string,
    bankAccountId: number | null | undefined,
    context: 'payment' | 'expense' | 'refund' | 'credit' = 'payment'
  ): Promise<ValidationResult> {
    if (!this.isBankMethod(method)) {
      return { valid: true };
    }

    const requireAccount = await this.getRequireAccount();
    if (!requireAccount) {
      return { valid: true };
    }

    if (!bankAccountId) {
      const contextLabels: { [key: string]: string } = {
        payment: 'payments',
        expense: 'expenses',
        refund: 'refunds',
        credit: 'purchase credits'
      };
      return {
        valid: false,
        error: `Bank account is required for ${method} ${contextLabels[context]}. Please select a bank account.`
      };
    }

    return { valid: true };
  }

  /**
   * Validate minimum amount requirement
   */
  async validateMinimumAmount(
    method: string,
    amount: number | null | undefined,
    context: 'payment' | 'expense' | 'refund' | 'credit' = 'payment'
  ): Promise<ValidationResult> {
    if (!this.isBankMethod(method)) {
      return { valid: true };
    }

    const minimumAmount = await this.getMinimumAmount();
    if (minimumAmount <= 0) {
      return { valid: true };
    }

    if (!amount || amount < minimumAmount) {
      const contextLabels: { [key: string]: string } = {
        payment: 'payments',
        expense: 'expenses',
        refund: 'refunds',
        credit: 'purchase credits'
      };
      const formattedAmount = amount?.toFixed(2) || '0.00';
      const formattedMinimum = minimumAmount.toFixed(2);
      return {
        valid: false,
        error: `${contextLabels[context].charAt(0).toUpperCase() + contextLabels[context].slice(1)} amount ${formattedAmount} is below the minimum required amount ${formattedMinimum} for ${method} ${contextLabels[context]}.`
      };
    }

    return { valid: true };
  }

  /**
   * Validate both bank account and minimum amount
   */
  async validateBankPayment(
    method: string,
    bankAccountId: number | null | undefined,
    amount: number | null | undefined,
    context: 'payment' | 'expense' | 'refund' | 'credit' = 'payment'
  ): Promise<ValidationResult> {
    // Validate bank account
    const bankAccountValidation = await this.validateBankAccount(method, bankAccountId, context);
    if (!bankAccountValidation.valid) {
      return bankAccountValidation;
    }

    // Validate minimum amount
    const amountValidation = await this.validateMinimumAmount(method, amount, context);
    if (!amountValidation.valid) {
      return amountValidation;
    }

    return { valid: true };
  }

  /**
   * Check if bank account field should be shown
   */
  async shouldShowBankAccountField(method: string): Promise<boolean> {
    if (!this.isBankMethod(method)) {
      return false;
    }
    // Nothing to choose from below PRO: BANK_ACCOUNTS gates /api/bank-accounts, so the list is
    // empty by definition. The payment method itself stays available — a cheque is still a cheque.
    await this.licenseCapabilitiesService.ensureLoaded();
    return this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS');
  }

  /**
   * Check if bank account field is required
   */
  async isBankAccountRequired(method: string): Promise<boolean> {
    if (!this.isBankMethod(method)) {
      return false;
    }
    // payment.bank.methods.require.account only means something where accounts can exist. The
    // backend stopped enforcing it below PRO for exactly that reason; if this still reported
    // "required", the form would block on a field it is not even showing.
    await this.licenseCapabilitiesService.ensureLoaded();
    if (!this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS')) {
      return false;
    }
    return await this.getRequireAccount();
  }

  /**
   * Get minimum amount hint text
   */
  async getMinimumAmountHint(method: string, currency: string = 'USD'): Promise<string | null> {
    if (!this.isBankMethod(method)) {
      return null;
    }

    const minimumAmount = await this.getMinimumAmount();
    if (minimumAmount <= 0) {
      return null;
    }

    return `Minimum amount for ${method} payments: ${minimumAmount.toFixed(2)} ${currency}`;
  }
}

