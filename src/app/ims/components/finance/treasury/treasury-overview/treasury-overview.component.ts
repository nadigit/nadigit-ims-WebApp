import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportContextService } from 'src/app/services/export-context.service';
import { TreasuryService } from 'src/app/services/treasury.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import {
  TreasuryActivityItem,
  TreasuryCashFlowRow,
  TreasuryRegisterSnapshot,
} from 'src/app/models/treasury-overview';

@Component({
  templateUrl: './treasury-overview.component.html',
  styleUrls: ['./treasury-overview.component.css', '../../finance.component.css'],
  providers: [MessageService],
})
export class TreasuryOverviewComponent implements OnInit {
  isLoading = true;
  isExporting = false;
  currency = '';
  activityDays = 7;
  activityPeriodOptions = [
    { label: '7', value: 7 },
    { label: '14', value: 14 },
    { label: '30', value: 30 },
  ];

  totalCashBalance = 0;
  totalBankBalance = 0;
  outstandingCreditBalance = 0;
  netLiquidity = 0;

  openRegistersCount = 0;
  closedRegistersCount = 0;
  bankAccountsCount = 0;
  customersWithCredit = 0;

  registerSnapshots: TreasuryRegisterSnapshot[] = [];
  openRegisters: TreasuryRegisterSnapshot[] = [];
  pastClosingAlerts: TreasuryRegisterSnapshot[] = [];
  recentActivity: TreasuryActivityItem[] = [];
  cashFlowRows: TreasuryCashFlowRow[] = [];
  totalCollectionsInPeriod = 0;
  unlinkedRegistersCount = 0;
  loadedFromAggregateApi = false;

  canReadCash = false;
  canReadBank = false;
  canViewCredit = false;
  bankAccountsEnabled = false;
  customerCreditsEnabled = false;
  isAdmin = false;

  constructor(
    private messageService: MessageService,
    private treasuryService: TreasuryService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private reportingService: ReportingService,
    private router: Router,
  
    private exportContext: ExportContextService) {}

  async ngOnInit(): Promise<void> {
    this.configService.currency$.subscribe(c => {
      if (c) {
        this.currency = c;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => this.translate.use(lang));

    await this.licenseCapabilitiesService.ensureLoaded();
    this.bankAccountsEnabled = this.licenseCapabilitiesService.isFeatureEnabled('BANK_ACCOUNTS');
    this.customerCreditsEnabled = this.licenseCapabilitiesService.isFeatureEnabled('CUSTOMER_CREDITS');

    await this.checkPermissions();
    await this.loadDashboard();
  }

  private async checkPermissions(): Promise<void> {
    const profile = await this.keycloakService.loadUserProfile();
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    await this.permissionService.init(profile.id!).toPromise();
    this.canReadCash = this.permissionService.canCashRead('SHOPS');
    this.canReadBank = this.bankAccountsEnabled && this.permissionService.canRead('BANK_ACCOUNTS');
    this.canViewCredit = this.customerCreditsEnabled && this.isAdmin;
  }

  async loadDashboard(): Promise<void> {
    this.isLoading = true;
    try {
      const data = await this.treasuryService.loadOverview({
        activityDays: this.activityDays,
        includeCash: this.canReadCash,
        includeBank: this.canReadBank,
        includeCredit: this.canViewCredit,
      });

      this.totalCashBalance = data.totalCashBalance;
      this.totalBankBalance = data.totalBankBalance;
      this.outstandingCreditBalance = data.outstandingCreditBalance;
      this.netLiquidity = data.netLiquidity;
      this.openRegistersCount = data.openRegistersCount;
      this.closedRegistersCount = data.closedRegistersCount;
      this.bankAccountsCount = data.bankAccountsCount;
      this.customersWithCredit = data.customersWithCredit;
      this.totalCollectionsInPeriod = data.totalCollectionsInPeriod;
      this.unlinkedRegistersCount = data.unlinkedRegistersCount;
      this.loadedFromAggregateApi = data.loadedFromAggregateApi;
      this.registerSnapshots = data.registerSnapshots;
      this.openRegisters = data.registerSnapshots.filter(s => s.isOpen);
      this.pastClosingAlerts = data.registerSnapshots.filter(s => s.pastClosingTime);
      this.cashFlowRows = data.cashFlowRows;
      this.recentActivity = data.recentActivity;
    } catch (error) {
      console.error('Error loading treasury overview:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_dashboard_data'),
        life: 4000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  async onActivityPeriodChange(): Promise<void> {
    await this.loadDashboard();
  }

  async refresh(): Promise<void> {
    await this.loadDashboard();
  }

  async exportExcel(): Promise<void> {
    if (this.isExporting) {
      return;
    }
    this.isExporting = true;
    try {
      const t = this.translate;
      const summaryRows = [
        { metric: t.instant('total_cash_balance'), value: this.totalCashBalance },
        ...(this.canReadBank ? [{ metric: t.instant('treasury_total_bank_balance'), value: this.totalBankBalance }] : []),
        ...(this.canViewCredit ? [{ metric: t.instant('outstanding_credit_balance'), value: this.outstandingCreditBalance }] : []),
        { metric: t.instant('treasury_net_liquidity'), value: this.netLiquidity },
        { metric: t.instant('treasury_total_collections_period', { days: this.activityDays }), value: this.totalCollectionsInPeriod },
      ].map(row => ({
        [t.instant('treasury_export_metric')]: row.metric,
        [t.instant('treasury_export_value')]: row.value,
      }));

      const cashFlowExport = this.cashFlowRows.map(row => ({
        [t.instant('shop_name')]: row.shopName,
        [t.instant('cash_register_balance')]: row.registerBalance,
        ...(this.canReadBank ? {
          [t.instant('treasury_register_to_bank')]: row.hasLinkedBank ? row.bankAccountName : t.instant('treasury_no_linked_bank'),
          [t.instant('treasury_collections_period', { days: this.activityDays })]: row.collectionsInPeriod,
        } : {}),
      }));

      const activityExport = this.recentActivity.map(item => ({
        [t.instant('shop_name')]: item.shopName,
        [t.instant('type')]: item.kind === 'COLLECTION'
          ? t.instant('collections')
          : t.instant('movement_' + (item.movementType || '').toLowerCase()),
        [t.instant('amount')]: item.amount,
        [t.instant('timestamp')]: item.timestamp.toLocaleString(),
        [t.instant('performed_by')]: item.performedBy || '',
      }));

      const xlsx = await import('xlsx');
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryRows), t.instant('treasury_export_summary_sheet'));
      if (cashFlowExport.length) {
        xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(cashFlowExport), t.instant('treasury_cash_flow_title'));
      }
      if (activityExport.length) {
        xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(activityExport), t.instant('treasury_recent_activity'));
      }

      const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' });
      this.reportingService.saveAsExcelFile(buffer, 'treasury-overview');
    } catch (error) {
      console.error('Treasury Excel export failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting'),
        life: 4000,
      });
    } finally {
      this.isExporting = false;
    }
  }

  async exportPdf(): Promise<void> {
    if (this.isExporting) {
      return;
    }
    this.isExporting = true;
    try {
      // Everything below is translated, so it is built inside the callback where the
      // organization's locale is the active one.
      await this.exportContext.withOrganizationLocale('treasury_overview_title', (header) => {
      const t = this.translate;
      const exportColumns: ExportColumn[] = [
        { title: t.instant('shop_name'), dataKey: 'shopName' },
        { title: t.instant('cash_register_balance'), dataKey: 'registerBalance' },
      ];
      if (this.canReadBank) {
        exportColumns.push(
          { title: t.instant('treasury_register_to_bank'), dataKey: 'bankAccount' },
          { title: t.instant('treasury_collections_period', { days: this.activityDays }), dataKey: 'collectionsInPeriod' },
        );
      }

      const exportData = this.cashFlowRows.map(row => ({
        shopName: row.shopName,
        registerBalance: row.registerBalance,
        bankAccount: row.hasLinkedBank ? row.bankAccountName : t.instant('treasury_no_linked_bank'),
        collectionsInPeriod: row.collectionsInPeriod,
      }));

      const title = `${header.title} — ${header.generatedAt}`;
      this.reportingService.exportPdf(exportColumns, exportData, 'treasury-overview', title,
        header.organizationName);
      });
    } catch (error) {
      console.error('Treasury PDF export failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting'),
        life: 4000,
      });
    } finally {
      this.isExporting = false;
    }
  }

  navigateToCashRegisters(): void {
    void this.router.navigate(['/finance/treasury/cash-registers']);
  }

  navigateToRegister(shopId: number): void {
    void this.router.navigate(['/finance/treasury/cash-registers', shopId]);
  }

  navigateToBankAccounts(): void {
    void this.router.navigate(['/finance/banking/accounts']);
  }

  navigateToCustomerCredits(): void {
    void this.router.navigate(['/finance/credit-management/dashboard']);
  }

  getMovementSeverity(type?: string): string {
    switch (type) {
      case 'DEPOSIT': return 'success';
      case 'WITHDRAWAL': return 'danger';
      case 'EXPENSE': return 'warning';
      default: return 'info';
    }
  }
}
