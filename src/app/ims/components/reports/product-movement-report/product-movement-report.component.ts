import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { Subject, catchError, debounceTime, firstValueFrom, of, takeUntil, timeout } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { AnalysisService, Shop } from 'src/app/services/analysis.service';
import {
  AiIntegrationService,
  ProductMovementItemDTO,
  ProductMovementResponseDTO,
} from 'src/app/services/ai-integration.service';
import { KeycloakService } from 'keycloak-angular';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';

/** Movement bands considered "needs attention" for the concerns-only filter. */
const CONCERN_BANDS = ['AT_RISK_EXPIRY', 'DEAD', 'SLOW'];

@Component({
  selector: 'app-product-movement-report',
  templateUrl: './product-movement-report.component.html',
  styleUrls: ['../reports-common.css', './product-movement-report.component.css'],
})
export class ProductMovementReportComponent implements OnInit, OnDestroy {
  loading = true;
  isInitialLoad = true;
  error: string | null = null;
  isAdmin = false;
  currency = 'USD';
  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [{ label: 'All Shops', value: null }];

  historyDays = 90;
  topItems = 100;
  concernsOnly = true;

  response: ProductMovementResponseDTO | null = null;
  rows: ProductMovementItemDTO[] = [];
  bandChartData: any = null;
  bandChartOptions: any = null;

  deadCount = 0;
  slowCount = 0;
  atRiskCount = 0;
  totalCashTiedUp = 0;
  isReportsFeatureEnabled = true;

  @ViewChild('movementTable') movementTable?: Table;
  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();

  constructor(
    private aiIntegrationService: AiIntegrationService,
    private analysisService: AnalysisService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
  ) {}

  async ngOnInit(): Promise<void> {
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    await this.loadLicenseCapabilities();

    this.configService.currency$.pipe(takeUntil(this.destroy$)).subscribe(c => {
      if (c) this.currency = c;
    });
    this.translationService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.translate.use(this.translationService.getPreferredLanguage());
      this.buildBandChart();
    });
    this.filterChange$.pipe(debounceTime(400), takeUntil(this.destroy$)).subscribe(() => this.loadMovement());

    if (this.isAdmin) {
      await this.loadShops();
    }
    await this.loadMovement();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Debounced trigger wired to every filter control so the report refreshes like the other reports. */
  onFilterChange(): void {
    this.filterChange$.next();
  }

  async loadMovement(): Promise<void> {
    if (!this.isReportsFeatureEnabled) {
      this.error = this.translate.instant('feature_not_licensed') || 'This feature is not available on your current plan.';
      this.loading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const shopId = this.selectedShop ? Number((this.selectedShop as any).shopId) : undefined;
      const response = await firstValueFrom(
        this.aiIntegrationService.getProductMovement({
          limit: this.topItems,
          concernsOnly: this.concernsOnly,
          shopId,
          historyDays: shopId != null ? this.historyDays : undefined,
        }).pipe(timeout(30000)),
      );
      this.response = response;
      this.rows = response?.items ?? [];
      const counts = response?.bandCounts ?? {};
      this.deadCount = counts['DEAD'] ?? 0;
      this.slowCount = counts['SLOW'] ?? 0;
      this.atRiskCount = counts['AT_RISK_EXPIRY'] ?? 0;
      this.totalCashTiedUp = this.rows
        .filter(r => CONCERN_BANDS.includes(r.movementBand))
        .reduce((sum, r) => sum + (r.stockValue || 0), 0);
      this.buildBandChart();
    } catch (e) {
      console.error(e);
      this.error = this.translate.instant('reports_movement_error');
      this.response = null;
      this.rows = [];
      this.bandChartData = null;
      this.deadCount = this.slowCount = this.atRiskCount = 0;
      this.totalCashTiedUp = 0;
    } finally {
      this.loading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }

  getBandSeverity(band?: string | null): 'success' | 'warning' | 'danger' | 'info' {
    switch ((band || '').toUpperCase()) {
      case 'DEAD':
      case 'AT_RISK_EXPIRY':
        return 'danger';
      case 'SLOW':
        return 'warning';
      case 'BEST_SELLER':
        return 'success';
      default:
        return 'info';
    }
  }

  getBandLabel(band?: string | null): string {
    const key = 'movement_band_' + (band || '').toLowerCase();
    const label = this.translate.instant(key);
    return label === key ? (band || '-') : label;
  }

  getActionSeverity(action?: string | null): 'success' | 'warning' | 'danger' | 'info' {
    switch ((action || '').toUpperCase()) {
      case 'LIQUIDATE':
      case 'RETURN_TO_SUPPLIER':
      case 'STOP_REORDER':
        return 'danger';
      case 'DISCOUNT':
      case 'BUNDLE':
        return 'warning';
      case 'PROMOTE':
        return 'success';
      default:
        return 'info';
    }
  }

  getActionLabel(action?: string | null): string {
    const key = 'movement_action_' + (action || '').toLowerCase();
    const label = this.translate.instant(key);
    return label === key ? (action || '-') : label;
  }

  private async loadShops(): Promise<void> {
    try {
      const shops = await firstValueFrom(
        (await this.analysisService.getShops()).pipe(
          timeout(10000),
          catchError(() => of([] as Shop[])),
        ),
      );
      const t = await firstValueFrom(
        this.translate.get(['All Shops']).pipe(catchError(() => of({ 'All Shops': 'All Shops' }))),
      );
      this.shopOptions = [
        { label: t['All Shops'] || 'All Shops', value: null },
        ...(Array.isArray(shops) ? shops : []).map(s => ({ label: s.shopName, value: s })),
      ];
    } catch {
      this.shopOptions = [{ label: 'All Shops', value: null }];
    }
  }

  private buildBandChart(): void {
    const counts = this.response?.bandCounts ?? {};
    const dead = counts['DEAD'] ?? 0;
    const atRisk = counts['AT_RISK_EXPIRY'] ?? 0;
    const slow = counts['SLOW'] ?? 0;
    const steady = counts['STEADY'] ?? 0;
    const best = counts['BEST_SELLER'] ?? 0;
    if (dead + atRisk + slow + steady + best === 0) {
      this.bandChartData = null;
      return;
    }
    this.bandChartData = {
      labels: [
        this.getBandLabel('AT_RISK_EXPIRY'),
        this.getBandLabel('DEAD'),
        this.getBandLabel('SLOW'),
        this.getBandLabel('STEADY'),
        this.getBandLabel('BEST_SELLER'),
      ],
      datasets: [
        {
          data: [atRisk, dead, slow, steady, best],
          backgroundColor: ['#b91c1c', '#dc2626', '#f59e0b', '#3b82f6', '#16a34a'],
        },
      ],
    };
    this.bandChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#64748b' } } },
    };
  }

  exportMovementCsv(): void {
    const rows = this.getFilteredRows();
    if (!rows || rows.length === 0) {
      return;
    }
    const header = [
      'product_id', 'reference', 'name', 'band', 'recommended_action',
      'days_since_last_sale', 'current_stock', 'sell_through_rate', 'stock_value', 'reason',
    ];
    const lines = rows.map(r => [
      r.productId,
      this.escapeCsv(r.productReference),
      this.escapeCsv(r.productName),
      this.escapeCsv(r.movementBand),
      this.escapeCsv(r.recommendedAction),
      r.daysSinceLastSale ?? '',
      r.currentStock ?? 0,
      r.sellThroughRate ?? 0,
      r.stockValue ?? 0,
      this.escapeCsv(r.reason),
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `product_movement_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private getFilteredRows(): ProductMovementItemDTO[] {
    if (!this.movementTable) {
      return this.rows || [];
    }
    const filtered = this.movementTable.filteredValue as ProductMovementItemDTO[] | null | undefined;
    return Array.isArray(filtered) ? filtered : (this.rows || []);
  }

  private escapeCsv(value?: string | null): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  private async loadLicenseCapabilities(): Promise<void> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      this.isReportsFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('REPORTS_AND_ANALYTICS');
    } catch (error) {
      console.warn('Unable to resolve license capabilities for reports.', error);
      this.isReportsFeatureEnabled = true;
    }
  }
}
