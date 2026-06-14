export interface TreasuryRegisterSnapshot {
  shopId: number;
  shopName: string;
  balance: number;
  isOpen: boolean;
  openedAt?: string | Date;
  openedBy?: string;
  closingTime?: string;
  pastClosingTime: boolean;
}

export interface TreasuryActivityItem {
  kind: 'MOVEMENT' | 'COLLECTION';
  shopId: number;
  shopName: string;
  label: string;
  amount: number;
  timestamp: Date;
  movementType?: string;
  performedBy?: string;
}

export interface TreasuryCashFlowRow {
  shopId: number;
  shopName: string;
  registerBalance: number;
  bankAccountId?: number;
  bankAccountName?: string;
  collectionsInPeriod: number;
  hasLinkedBank: boolean;
}

export interface TreasuryOverviewData {
  totalCashBalance: number;
  totalBankBalance: number;
  outstandingCreditBalance: number;
  netLiquidity: number;
  openRegistersCount: number;
  closedRegistersCount: number;
  bankAccountsCount: number;
  customersWithCredit: number;
  totalCollectionsInPeriod: number;
  unlinkedRegistersCount: number;
  activityDays: number;
  registerSnapshots: TreasuryRegisterSnapshot[];
  cashFlowRows: TreasuryCashFlowRow[];
  recentActivity: TreasuryActivityItem[];
  loadedFromAggregateApi: boolean;
}

export interface TreasuryOverviewLoadOptions {
  activityDays?: number;
  includeCash?: boolean;
  includeBank?: boolean;
  includeCredit?: boolean;
}
