export interface OutstandingAging {
  "0-30": number;
  "31-60": number;
  "61-90": number;
  "90+": number;
}

export class CreditInfo {
  // Existing fields
  availableCredit?: number;
  creditBalance?: number;
  creditLimit?: number;
  status?: string;
  totalCreditIssued?: number;
  totalCreditUsed?: number;
  
  // ⚠️ NEW FIELDS
  availableCreditLimit?: number;          // Remaining available credit limit
  outstandingBalance?: number;            // Total unpaid orders (customer owes)
  overdueBalance?: number;                // Overdue amount
  netBalance?: number;                    // Outstanding - Credit (positive = customer owes)
  outstandingAging?: OutstandingAging;    // Aging breakdown
  creditTermsDays?: number | null;        // Payment terms in days
}

