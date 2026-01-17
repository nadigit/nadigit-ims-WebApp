import { Injectable } from '@angular/core';
import { BankAccountService } from './bank-account.service';
import { BankTransaction } from '../models/bank-transaction';
import { firstValueFrom } from 'rxjs';
import { PaymentValidationService } from './payment-validation.service';

export interface ReconciliationStatus {
  canProceed: boolean;
  hasTransactions: boolean;
  allReconciled: boolean;
  unreconciledCount: number;
  transactions: BankTransaction[];
}

@Injectable({
  providedIn: 'root'
})
export class ReconciliationValidationService {

  constructor(
    private bankAccountService: BankAccountService,
    private paymentValidationService: PaymentValidationService
  ) { }

  /**
   * Check if a payment method requires reconciliation
   */
  requiresReconciliation(paymentMethod: string | null | undefined): boolean {
    if (!paymentMethod) {
      return false;
    }
    // Only Check and BOE require reconciliation before confirmation/edit/delete
    return this.paymentValidationService.isBankMethod(paymentMethod) && 
           (paymentMethod === 'Check' || paymentMethod === 'BOE');
  }

  /**
   * Check if all bank transactions for a payment are reconciled
   */
  async checkPaymentReconciliationStatus(paymentId: number): Promise<ReconciliationStatus> {
    try {
      const transactions = await firstValueFrom(
        await this.bankAccountService.getTransactionsByPaymentId(paymentId)
      ) || [];
      
      if (transactions.length === 0) {
        return {
          canProceed: true,
          hasTransactions: false,
          allReconciled: true,
          unreconciledCount: 0,
          transactions: []
        };
      }

      const allReconciled = transactions.every(t => t.reconciled === true);
      const unreconciledCount = transactions.filter(t => !t.reconciled).length;

      return {
        canProceed: allReconciled,
        hasTransactions: true,
        allReconciled,
        unreconciledCount,
        transactions
      };
    } catch (error) {
      console.error('Error checking payment reconciliation status:', error);
      // On error, allow proceeding (fail open) - backend will validate anyway
      return {
        canProceed: true,
        hasTransactions: false,
        allReconciled: true,
        unreconciledCount: 0,
        transactions: []
      };
    }
  }

  /**
   * Check if all bank transactions for a refund are reconciled
   */
  async checkRefundReconciliationStatus(refundId: number): Promise<ReconciliationStatus> {
    try {
      const transactions = await firstValueFrom(
        await this.bankAccountService.getTransactionsByRefundId(refundId)
      ) || [];
      
      if (transactions.length === 0) {
        return {
          canProceed: true,
          hasTransactions: false,
          allReconciled: true,
          unreconciledCount: 0,
          transactions: []
        };
      }

      const allReconciled = transactions.every(t => t.reconciled === true);
      const unreconciledCount = transactions.filter(t => !t.reconciled).length;

      return {
        canProceed: allReconciled,
        hasTransactions: true,
        allReconciled,
        unreconciledCount,
        transactions
      };
    } catch (error) {
      console.error('Error checking refund reconciliation status:', error);
      // On error, allow proceeding (fail open) - backend will validate anyway
      return {
        canProceed: true,
        hasTransactions: false,
        allReconciled: true,
        unreconciledCount: 0,
        transactions: []
      };
    }
  }

  /**
   * Check if all bank transactions for an expense are reconciled
   */
  async checkExpenseReconciliationStatus(expenseId: number): Promise<ReconciliationStatus> {
    try {
      const transactions = await firstValueFrom(
        await this.bankAccountService.getTransactionsByExpenseId(expenseId)
      ) || [];
      
      if (transactions.length === 0) {
        return {
          canProceed: true,
          hasTransactions: false,
          allReconciled: true,
          unreconciledCount: 0,
          transactions: []
        };
      }

      const allReconciled = transactions.every(t => t.reconciled === true);
      const unreconciledCount = transactions.filter(t => !t.reconciled).length;

      return {
        canProceed: allReconciled,
        hasTransactions: true,
        allReconciled,
        unreconciledCount,
        transactions
      };
    } catch (error) {
      console.error('Error checking expense reconciliation status:', error);
      // On error, allow proceeding (fail open) - backend will validate anyway
      return {
        canProceed: true,
        hasTransactions: false,
        allReconciled: true,
        unreconciledCount: 0,
        transactions: []
      };
    }
  }

  /**
   * Determine if payment/refund can be confirmed based on payment method and reconciliation status
   */
  async canConfirmPayment(paymentId: number, paymentMethod: string | null | undefined): Promise<boolean> {
    if (!this.requiresReconciliation(paymentMethod)) {
      return true; // Transfer, Cash, Card, Digital Wallet don't require reconciliation
    }
    
    const status = await this.checkPaymentReconciliationStatus(paymentId);
    return status.canProceed;
  }

  /**
   * Determine if refund can be confirmed based on refund method and reconciliation status
   */
  async canConfirmRefund(refundId: number, refundMethod: string | null | undefined): Promise<boolean> {
    if (!this.requiresReconciliation(refundMethod)) {
      return true; // Transfer, Cash, Card don't require reconciliation
    }
    
    const status = await this.checkRefundReconciliationStatus(refundId);
    return status.canProceed;
  }

  /**
   * Determine if expense can be edited/deleted based on payment method and reconciliation status
   */
  async canEditOrDeleteExpense(expenseId: number, paymentMethod: string | null | undefined): Promise<boolean> {
    if (!this.requiresReconciliation(paymentMethod)) {
      return true; // Transfer, Cash don't require reconciliation
    }
    
    const status = await this.checkExpenseReconciliationStatus(expenseId);
    return status.canProceed;
  }
}

