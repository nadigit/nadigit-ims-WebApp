import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { Subject, catchError, firstValueFrom, of, timeout } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AnalysisService, Shop } from 'src/app/services/analysis.service';
import {
  AiIntegrationService,
  ForecastItemDTO,
  ForecastResponseDTO,
} from 'src/app/services/ai-integration.service';
import { KeycloakService } from 'keycloak-angular';
import {
  ForecastNarrativeBlock,
  parseForecastNarrativeBlocks,
} from 'src/app/utils/forecast-narrative-blocks';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { BRAND_COLORS } from 'src/app/utils/brand-colors';

@Component({
  selector: 'app-forecasting-report',
  templateUrl: './forecasting-report.component.html',
  styleUrls: ['../reports-common.css', './forecasting-report.component.css'],
})
export class ForecastingReportComponent implements OnInit, OnDestroy {
  loading = true;
  isInitialLoad = true;
  error: string | null = null;
  isAdmin = false;
  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [{ label: 'All Shops', value: null }];

  historyDays = 90;
  horizonDays = 30;
  topItems = 30;
  withNarrative = false;

  forecast: ForecastResponseDTO | null = null;
  rows: ForecastItemDTO[] = [];
  chartData: any = null;
  chartOptions: any = null;
  riskChartData: any = null;
  riskChartOptions: any = null;
  totalSuggestedReorder = 0;
  highRiskCount = 0;
  /** Parsed once per forecast response — avoids calling a parser on every change-detection cycle in the template. */
  narrativeBlocks: ForecastNarrativeBlock[] = [];
  isAiForecastingFeatureEnabled = true;
  @ViewChild('forecastTable') forecastTable?: Table;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private aiIntegrationService: AiIntegrationService,
    private analysisService: AnalysisService,
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
    this.translationService.currentLanguage$.subscribe(() => {
      this.translate.use(this.translationService.getPreferredLanguage());
      this.buildChart();
    });
    if (this.isAdmin) {
      await this.loadShops();
    }
    await this.loadForecast();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadForecast(): Promise<void> {
    if (!this.isAiForecastingFeatureEnabled) {
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
      const narrativeTimeoutMs = this.withNarrative ? 120000 : 20000;
      const response = await firstValueFrom(
        this.aiIntegrationService.getForecastItems({
          historyDays: this.historyDays,
          horizonDays: this.horizonDays,
          limit: this.topItems,
          shopId,
          withNarrative: this.withNarrative,
        }).pipe(timeout(narrativeTimeoutMs)),
      );
      this.forecast = response;
      this.rows = response?.items ?? [];
      this.narrativeBlocks = parseForecastNarrativeBlocks(response?.narrative);
      this.buildChart();
      this.buildRiskChart();
      this.totalSuggestedReorder = this.rows.reduce((sum, r) => sum + (r.suggestedReorderQty || 0), 0);
      this.highRiskCount = this.rows.filter(r => (r.riskLevel || '').toUpperCase() === 'HIGH').length;
    } catch (e) {
      console.error(e);
      this.error = this.translate.instant('reports_forecasting_error');
      this.forecast = null;
      this.rows = [];
      this.narrativeBlocks = [];
      this.chartData = null;
      this.riskChartData = null;
      this.totalSuggestedReorder = 0;
      this.highRiskCount = 0;
    } finally {
      this.loading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }

  getRiskSeverity(risk?: string | null): 'success' | 'warning' | 'danger' | 'info' {
    const r = (risk || '').toUpperCase();
    if (r === 'HIGH') return 'danger';
    if (r === 'MEDIUM') return 'warning';
    if (r === 'LOW') return 'success';
    return 'info';
  }

  getRiskLabel(risk?: string | null): string {
    const r = (risk || '').toUpperCase();
    if (r === 'HIGH') return this.translate.instant('ai_forecast_risk_high');
    if (r === 'MEDIUM') return this.translate.instant('ai_forecast_risk_medium');
    if (r === 'LOW') return this.translate.instant('ai_forecast_risk_low');
    return risk || '-';
  }

  shouldShowNarrativeHint(): boolean {
    return !this.loading && !!this.forecast && this.withNarrative && !this.forecast?.narrative;
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

  private buildChart(): void {
    const top = (this.rows || []).slice(0, 10);
    if (top.length === 0) {
      this.chartData = null;
      return;
    }
    const labels = top.map(r => r.productReference || r.productName);
    const predicted = top.map(r => r.predictedDemand || 0);
    const stock = top.map(r => r.currentStock || 0);
    this.chartData = {
      labels,
      datasets: [
        {
          label: this.translate.instant('ai_forecast_predicted_demand'),
          data: predicted,
          backgroundColor: BRAND_COLORS.saas,
        },
        {
          label: this.translate.instant('ai_forecast_stock'),
          data: stock,
          backgroundColor: BRAND_COLORS.success,
        },
      ],
    };
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#64748b',
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#64748b' },
          grid: { color: '#e2e8f0' },
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#64748b' },
          grid: { color: '#e2e8f0' },
        },
      },
    };
  }

  private buildRiskChart(): void {
    if (!this.rows || this.rows.length === 0) {
      this.riskChartData = null;
      return;
    }
    const high = this.rows.filter(r => (r.riskLevel || '').toUpperCase() === 'HIGH').length;
    const medium = this.rows.filter(r => (r.riskLevel || '').toUpperCase() === 'MEDIUM').length;
    const low = this.rows.filter(r => (r.riskLevel || '').toUpperCase() === 'LOW').length;
    this.riskChartData = {
      labels: [
        this.translate.instant('ai_forecast_risk_high'),
        this.translate.instant('ai_forecast_risk_medium'),
        this.translate.instant('ai_forecast_risk_low'),
      ],
      datasets: [
        {
          data: [high, medium, low],
          backgroundColor: ['#dc2626', '#f59e0b', '#16a34a'],
        },
      ],
    };
    this.riskChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#64748b' },
        },
      },
    };
  }

  exportForecastCsv(): void {
    const filteredRows = this.getFilteredRows();
    if (!filteredRows || filteredRows.length === 0) {
      return;
    }
    const header = [
      'product_id',
      'reference',
      'name',
      'risk_level',
      'current_stock',
      'predicted_demand',
      'suggested_reorder_qty',
      'stockout_days',
      'confidence',
    ];
    const lines = filteredRows.map(r => [
      r.productId,
      this.escapeCsv(r.productReference),
      this.escapeCsv(r.productName),
      this.escapeCsv(r.riskLevel),
      r.currentStock ?? 0,
      r.predictedDemand ?? 0,
      r.suggestedReorderQty ?? 0,
      r.estimatedStockoutInDays ?? '',
      r.confidence ?? 0,
    ].join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `forecast_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private getFilteredRows(): ForecastItemDTO[] {
    if (!this.forecastTable) {
      return this.rows || [];
    }
    const filtered = this.forecastTable.filteredValue as ForecastItemDTO[] | null | undefined;
    return Array.isArray(filtered) ? filtered : (this.rows || []);
  }

  private escapeCsv(value?: string | null): string {
    const s = String(value ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }

  trackByNarrativeSection(index: number): number {
    return index;
  }

  private async loadLicenseCapabilities(): Promise<void> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      this.isAiForecastingFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('AI_FORECASTING');
    } catch (error) {
      console.warn('Unable to resolve license capabilities for AI forecasting.', error);
      this.isAiForecastingFeatureEnabled = true;
    }
  }
}
