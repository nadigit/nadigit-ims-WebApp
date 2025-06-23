export enum RefundMethod {
    ORIGINAL_METHOD = 'ORIGINAL_METHOD',  // Refund via original payment method
    STORE_CREDIT = 'STORE_CREDIT',        // As store credit
    BANK_TRANSFER = 'BANK_TRANSFER',      // Manual bank transfer
    CASH = 'CASH'                         // In-person cash refund
  }