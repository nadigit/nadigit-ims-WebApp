import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, firstValueFrom, takeUntil, timeout, catchError, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { AnalysisService, ProfitPeriod, Shop } from 'src/app/services/analysis.service';
import { ReportsService, TopSellingProducts } from 'src/app/services/reports.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { KeycloakService } from 'keycloak-angular';
import { BRAND_COLORS } from 'src/app/utils/brand-colors';

interface WarehouseOption {
  warehouseId: number;
  name: string;
}

@Component({
  selector: 'app-top-selling-products-report',
  templateUrl: './top-selling-products-report.component.html',
  styleUrls: ['../reports-common.css', './top-selling-products-report.component.css']
})
export class TopSellingProductsReportComponent implements OnInit, OnDestroy {
  loading = true;
  isInitialLoad = true;
  exporting = false;
  periods: { label: string; value: ProfitPeriod }[] = [];
  selectedPeriod: ProfitPeriod = ProfitPeriod.MONTH;
  useCustomRange = false;
  fromDate: Date | null = null;
  toDate: Date | null = null;
  productLimit = 20;
  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [{ label: 'All Shops', value: null }];
  selectedWarehouseId: number | null = null;
  warehouseOptions: SelectItem[] = [];
  report: TopSellingProducts | null = null;
  error: string | null = null;
  currency = 'USD';
  isAdmin = false;
  chartData: any = null;
  chartOptions: any = null;
  /** Height grows with the number of bars so labels never overlap and bars stay readable. */
  chartHeight = 360;

  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();
  private readonly chartPalette = [
    BRAND_COLORS.saas,
    BRAND_COLORS.cyan,
    BRAND_COLORS.success,
    BRAND_COLORS.premium,
    BRAND_COLORS.corporate,
    '#6366F1',
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316'
  ];

  constructor(
    private reportsService: ReportsService,
    private analysisService: AnalysisService,
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private configService: AppConfigurationService,
    private keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');

    this.configService.currency$.subscribe(c => {
      if (c) this.currency = c;
    });
    this.translationService.currentLanguage$.subscribe(() => {
      this.translate.use(this.translationService.getPreferredLanguage());
      this.initChartOptions();
      if (this.report) {
        this.updateChart(this.report);
      }
    });

    await this.loadTranslations();
    await this.initChartOptions();
    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadData());

    if (this.isAdmin) {
      await Promise.all([this.loadShops(), this.loadWarehouses()]);
    }
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChange(): void {
    if (this.isInitialLoad) {
      return;
    }
    this.filterChange$.next();
  }

  onCustomRangeToggle(): void {
    if (!this.useCustomRange) {
      this.fromDate = null;
      this.toDate = null;
    }
    this.onFilterChange();
  }

  formatDateParam(value: Date | null): string | undefined {
    if (!value) return undefined;
    const d = value instanceof Date ? value : new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  async exportReport(format: 'csv' | 'excel'): Promise<void> {
    if (this.exporting) return;
    this.exporting = true;
    this.cdr.markForCheck();
    try {
      const options = this.buildRequestOptions();
      const response$ = await this.reportsService.downloadTopSellingProducts({ ...options, format });
      const response = await firstValueFrom(response$.pipe(timeout(120000)));
      const blob = response.body;
      if (!blob) {
        throw new Error('Empty export');
      }
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fallback = `top_selling_products.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const filename = match?.[1] || fallback;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      this.error = await firstValueFrom(
        this.translate.get('reports_top_products_export_error').pipe(catchError(() => of('Export failed')))
      );
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  private buildRequestOptions(): {
    period?: ProfitPeriod;
    fromDate?: string;
    toDate?: string;
    shopId?: number;
    warehouseId?: number;
    limit: number;
  } {
    const limit = Math.min(100, Math.max(1, Math.round(this.productLimit) || 20));
    const shopId = this.selectedShop?.shopId;
    const warehouseId = this.isAdmin ? (this.selectedWarehouseId ?? undefined) : undefined;
    if (this.useCustomRange && this.fromDate && this.toDate) {
      return {
        fromDate: this.formatDateParam(this.fromDate),
        toDate: this.formatDateParam(this.toDate),
        shopId,
        warehouseId,
        limit
      };
    }
    return { period: this.selectedPeriod, shopId, warehouseId, limit };
  }

  private async loadTranslations(): Promise<void> {
    try {
      const translations = await firstValueFrom(
        this.translate.getTranslation(this.translationService.getPreferredLanguage()).pipe(
          timeout(5000),
          catchError(() => of({}))
        )
      );
      this.periods = [
        { label: translations['Today'] || 'Today', value: ProfitPeriod.TODAY },
        { label: translations['Yesterday'] || 'Yesterday', value: ProfitPeriod.YESTERDAY },
        { label: translations['This Week'] || 'This Week', value: ProfitPeriod.WEEK },
        { label: translations['This Month'] || 'This Month', value: ProfitPeriod.MONTH },
        { label: translations['Last 6 Months'] || 'Last 6 Months', value: ProfitPeriod.LAST_SIX_MONTHS },
        { label: translations['This Year'] || 'This Year', value: ProfitPeriod.YEAR },
        { label: translations['Last 12 Months'] || 'Last 12 Months', value: ProfitPeriod.LAST_12_MONTHS }
      ];
    } catch {
      this.periods = [
        { label: 'Today', value: ProfitPeriod.TODAY },
        { label: 'This Month', value: ProfitPeriod.MONTH }
      ];
    }
  }

  private async loadShops(): Promise<void> {
    try {
      const obs = await this.analysisService.getShops();
      const shops = await firstValueFrom(obs.pipe(timeout(10000), catchError(() => of([] as Shop[]))));
      const t = await firstValueFrom(
        this.translate.get(['All Shops']).pipe(catchError(() => of({ 'All Shops': 'All Shops' })))
      );
      this.shopOptions = [
        { label: t['All Shops'] || 'All Shops', value: null },
        ...(Array.isArray(shops) ? shops : []).map(s => ({ label: s.shopName, value: s }))
      ];
    } catch {
      this.shopOptions = [{ label: 'All Shops', value: null }];
    }
    this.cdr.markForCheck();
  }

  private async loadWarehouses(): Promise<void> {
    try {
      await this.warehouseService.loadToken();
      const list = await firstValueFrom(
        this.warehouseService.getWarehouses().pipe(timeout(15000), catchError(() => of([])))
      );
      const t = await firstValueFrom(
        this.translate.get(['reports_all_warehouses']).pipe(catchError(() => of({ reports_all_warehouses: 'All warehouses' })))
      );
      const allLabel = t['reports_all_warehouses'] || 'All warehouses';
      const warehouses = Array.isArray(list) ? (list as WarehouseOption[]) : [];
      this.warehouseOptions = [
        { label: allLabel, value: null },
        ...warehouses.map(w => ({ label: w.name, value: w.warehouseId }))
      ];
    } catch {
      this.warehouseOptions = [];
    }
    this.cdr.markForCheck();
  }

  private async initChartOptions(): Promise<void> {
    const qtyLabel = await firstValueFrom(
      this.translate.get('reports_top_products_quantity_sold').pipe(catchError(() => of('Qty sold')))
    );
    this.chartOptions = {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 4, right: 16, top: 4, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => `${qtyLabel}: ${ctx.parsed?.x ?? ctx.raw ?? 0}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          border: { display: false },
          ticks: { precision: 0, color: '#64748b' },
          grid: { color: '#eef2f6' }
        },
        y: {
          border: { display: false },
          ticks: {
            autoSkip: false,
            color: '#334155',
            font: { size: 12 }
          },
          grid: { display: false }
        }
      }
    };
  }

  private updateChart(report: TopSellingProducts): void {
    const lines = (report.lines || []).slice(0, Math.min(15, report.lines?.length || 0));
    const labels = lines.map(line => this.truncateLabel(line.name || line.reference || `#${line.rank}`, 28));
    const data = lines.map(line => line.quantitySold);
    const colors = lines.map((_, i) => this.chartPalette[i % this.chartPalette.length]);

    // Give each bar a comfortable row (~38px) so labels stay legible however many products there are.
    this.chartHeight = Math.max(340, lines.length * 38 + 80);

    this.chartData = {
      labels,
      datasets: [
        {
          label: 'Qty sold',
          data,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 0,
          borderRadius: 6,
          categoryPercentage: 0.72,
          barPercentage: 0.9,
          maxBarThickness: 30
        }
      ]
    };
    this.cdr.markForCheck();
  }

  private truncateLabel(value: string, max: number): string {
    if (!value || value.length <= max) {
      return value;
    }
    return `${value.slice(0, max - 1)}…`;
  }

  private async loadData(): Promise<void> {
    if (this.useCustomRange && (!this.fromDate || !this.toDate)) {
      return;
    }
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const options = this.buildRequestOptions();
      const obs = await this.reportsService.getTopSellingProducts(options);
      this.report = await firstValueFrom(obs.pipe(timeout(30000)));
      this.updateChart(this.report);
    } catch {
      this.report = null;
      this.chartData = null;
      this.error = await firstValueFrom(
        this.translate.get('reports_top_products_error').pipe(catchError(() => of('Could not load report')))
      );
    } finally {
      this.loading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }
}
