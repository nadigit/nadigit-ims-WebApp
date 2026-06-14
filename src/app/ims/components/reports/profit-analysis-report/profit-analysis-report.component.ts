import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, firstValueFrom, takeUntil, timeout, catchError, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { AnalysisService, ProfitPeriod, Shop } from 'src/app/services/analysis.service';

@Component({
  selector: 'app-profit-analysis-report',
  templateUrl: './profit-analysis-report.component.html',
  styleUrls: ['../reports-common.css', './profit-analysis-report.component.css']
})
export class ProfitAnalysisReportComponent implements OnInit, OnDestroy {
  profitLoading = true;
  isInitialLoad = true;
  profitPeriods: { label: string; value: ProfitPeriod }[] = [];
  selectedPeriod: ProfitPeriod = ProfitPeriod.MONTH;
  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [{ label: 'All Shops', value: null }];
  profitData: any;
  error: string | null = null;
  currency = 'USD';
  profitChartData: any = null;
  profitChartOptions: any = null;

  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();

  constructor(
    private analysisService: AnalysisService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private configService: AppConfigurationService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.configService.currency$.subscribe(c => {
      if (c) this.currency = c;
    });
    this.translationService.currentLanguage$.subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );

    await this.loadTranslations();
    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadProfitData());

    await this.loadShops();
    try {
      await this.initProfitChart();
    } catch {
      /* default chart options set in initProfitChart catch */
    }
    this.loadProfitData();
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

  private async loadTranslations(): Promise<void> {
    try {
      const translations = await firstValueFrom(
        this.translate.getTranslation(this.translationService.getPreferredLanguage()).pipe(
          timeout(5000),
          catchError(() => of({}))
        )
      );
      this.profitPeriods = [
        { label: translations['Today'] || 'Today', value: ProfitPeriod.TODAY },
        { label: translations['Yesterday'] || 'Yesterday', value: ProfitPeriod.YESTERDAY },
        { label: translations['This Week'] || 'This Week', value: ProfitPeriod.WEEK },
        { label: translations['This Month'] || 'This Month', value: ProfitPeriod.MONTH },
        { label: translations['Last 6 Months'] || 'Last 6 Months', value: ProfitPeriod.LAST_SIX_MONTHS },
        { label: translations['This Year'] || 'This Year', value: ProfitPeriod.YEAR },
        { label: translations['Last 12 Months'] || 'Last 12 Months', value: ProfitPeriod.LAST_12_MONTHS }
      ];
    } catch {
     this.profitPeriods = [
        { label: 'Today', value: ProfitPeriod.TODAY },
        { label: 'Yesterday', value: ProfitPeriod.YESTERDAY },
        { label: 'This Week', value: ProfitPeriod.WEEK },
        { label: 'This Month', value: ProfitPeriod.MONTH },
        { label: 'Last 6 Months', value: ProfitPeriod.LAST_SIX_MONTHS },
        { label: 'This Year', value: ProfitPeriod.YEAR },
        { label: 'Last 12 Months', value: ProfitPeriod.LAST_12_MONTHS }
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

  async loadProfitData(): Promise<void> {
    this.profitLoading = true;
    this.error = null;
    this.cdr.markForCheck();

    try {
      const shopId = this.selectedShop?.shopId != null ? Number(this.selectedShop.shopId) : undefined;
      const req$ = await this.analysisService.getProfitAnalysis(this.selectedPeriod, shopId);
      const data = await firstValueFrom(req$);
      this.profitData = data;
      await this.updateProfitChart(data);
    } catch (err) {
      this.error = this.translate.instant('reports_profit_load_error');
      console.error('Error loading profit data:', err);
    } finally {
      this.profitLoading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }

  private async updateProfitChart(data: any): Promise<void> {
    try {
      if (!this.profitChartOptions) {
        await this.initProfitChart();
      }

      const translations = await firstValueFrom(
        this.translate.get([
          'financial_overview',
          'revenue',
          'product_costs',
          'refunds',
          'expenses',
          'write_offs',
          'profit_margin'
        ])
      );

      if (!data || data.totalRevenue === undefined || data.totalCosts === undefined) {
        return;
      }

      this.profitChartData = {
        labels: [translations['financial_overview'] || 'Financial Overview'],
        datasets: [
          {
            label: translations['revenue'] || 'Revenue',
            data: [data.totalRevenue || 0],
            backgroundColor: '#4bc0c0',
            borderColor: '#4bc0c0',
            borderWidth: 1
          },
          {
            label: translations['product_costs'] || 'Product Costs',
            data: [-Math.abs(data.totalCosts || 0)],
            backgroundColor: '#ff6384',
            borderColor: '#ff6384',
            borderWidth: 1
          },
          {
            label: translations['refunds'] || 'Refunds',
            data: [-Math.abs(data.totalRefunds || 0)],
            backgroundColor: '#ff9f40',
            borderColor: '#ff9f40',
            borderWidth: 1
          },
          {
            label: translations['expenses'] || 'Expenses',
            data: [-Math.abs(data.totalExpenses || 0)],
            backgroundColor: '#9966ff',
            borderColor: '#9966ff',
            borderWidth: 1
          },
          {
            label: translations['write_offs'] || 'Write-Offs',
            data: [-Math.abs(data.totalWriteOffs || 0)],
            backgroundColor: '#ff9800',
            borderColor: '#ff9800',
            borderWidth: 1
          },
          {
            label: translations['profit_margin'] || 'Net Profit',
            data: [data.netProfit || 0],
            backgroundColor: data.netProfit >= 0 ? '#4bc0c0' : '#ff6384',
            borderColor: data.netProfit >= 0 ? '#4bc0c0' : '#ff6384',
            borderWidth: 1
          }
        ]
      };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error updating profit chart:', error);
      this.profitChartData = { labels: [], datasets: [] };
      this.cdr.markForCheck();
    }
  }

  private async initProfitChart(): Promise<void> {
    try {
      const translations = await firstValueFrom(
        this.translate.get(['financial_overview', 'revenue', 'product_costs', 'refunds', 'expenses', 'profit_net', 'profit_analysis'])
      );

      this.profitChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: false, ticks: { display: true } },
          y: {
            stacked: false,
            ticks: {
              callback: (value: any) =>
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: this.currency || 'USD'
                }).format(value)
            }
          }
        },
        plugins: {
          legend: { position: 'top', display: true },
          title: {
            display: true,
            text: translations['profit_analysis'] || 'Profit Analysis',
            font: { size: 16 }
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                let label = context.dataset.label || '';
                if (label) label += ': ';
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: this.currency || 'USD'
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        }
      };
      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error initializing profit chart:', error);
      this.profitChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: false, ticks: { display: true } },
          y: {
            stacked: false,
            ticks: {
              callback: (value: any) =>
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: this.currency || 'USD'
                }).format(value)
            }
          }
        },
        plugins: {
          legend: { position: 'top', display: true }
        }
      };
      this.cdr.markForCheck();
    }
  }

  calculateIndicatorPosition(): string {
    if (!this.profitData?.totalRevenue) return '50%';
    const marginPercentage = this.calculateProfitMargin();
    const position = 50 + marginPercentage / 2;
    return Math.min(Math.max(position, 5), 95) + '%';
  }

  calculateProfitMargin(): number {
    if (this.profitData?.totalRevenue > 0) {
      return (this.profitData.netProfit / this.profitData.totalRevenue) * 100;
    }
    return 0;
  }

  calculateRevenuePercentage(): number {
    if (!this.profitData || this.profitData.totalRevenue <= 0) {
      return 0;
    }
    const totalCosts = Math.abs(
      (this.profitData.totalCosts || 0) + (this.profitData.totalRefunds || 0) + (this.profitData.totalExpenses || 0)
    );
    const total = this.profitData.totalRevenue + totalCosts;
    if (total === 0) return 0;
    return (this.profitData.totalRevenue / total) * 100;
  }

  calculateCostsPercentage(): number {
    if (!this.profitData || this.profitData.totalRevenue <= 0) {
      return 0;
    }
    const totalCosts = Math.abs(
      (this.profitData.totalCosts || 0) +
        (this.profitData.totalRefunds || 0) +
        (this.profitData.totalExpenses || 0) +
        (this.profitData.totalWriteOffs || 0)
    );
    if (totalCosts === 0) return 0;
    return (totalCosts / this.profitData.totalRevenue) * 100;
  }

  getTotalCosts(): number {
    if (!this.profitData) return 0;
    return Math.abs(
      (this.profitData.totalCosts || 0) +
        (this.profitData.totalRefunds || 0) +
        (this.profitData.totalExpenses || 0) +
        (this.profitData.totalWriteOffs || 0)
    );
  }
}
