import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, firstValueFrom, takeUntil, timeout, catchError, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { AnalysisService, ProfitPeriod, Shop } from 'src/app/services/analysis.service';
import { ReportsService, PurchaseSummary } from 'src/app/services/reports.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-purchase-summary-report',
  templateUrl: './purchase-summary-report.component.html',
  styleUrls: ['../reports-common.css', './purchase-summary-report.component.css']
})
export class PurchaseSummaryReportComponent implements OnInit, OnDestroy {
  loading = true;
  isInitialLoad = true;
  periods: { label: string; value: ProfitPeriod }[] = [];
  selectedPeriod: ProfitPeriod = ProfitPeriod.MONTH;
  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [{ label: 'All Shops', value: null }];
  summary: PurchaseSummary | null = null;
  error: string | null = null;
  currency = 'USD';
  isAdmin = false;

  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();

  constructor(
    private reportsService: ReportsService,
    private analysisService: AnalysisService,
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
    this.translationService.currentLanguage$.subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );

    await this.loadTranslations();
    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadData());

    if (this.isAdmin) {
      await this.loadShops();
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

  private async loadData(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const shopId = this.isAdmin && this.selectedShop ? Number((this.selectedShop as any).shopId) : undefined;
      const obs = await this.reportsService.getPurchaseSummary(this.selectedPeriod, shopId);
      this.summary = await firstValueFrom(obs);
    } catch (e) {
      console.error(e);
      this.error = this.translate.instant('reports_purchase_summary_error');
      this.summary = null;
    } finally {
      this.loading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }
}
