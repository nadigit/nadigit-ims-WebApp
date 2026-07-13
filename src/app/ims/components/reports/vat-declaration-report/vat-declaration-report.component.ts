import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, firstValueFrom, takeUntil, timeout, catchError, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { AnalysisService, Shop } from 'src/app/services/analysis.service';
import { ReportsService, VatDeclaration } from 'src/app/services/reports.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-vat-declaration-report',
  templateUrl: './vat-declaration-report.component.html',
  styleUrls: ['../reports-common.css', './vat-declaration-report.component.css']
})
export class VatDeclarationReportComponent implements OnInit, OnDestroy {
  loading = true;
  isInitialLoad = true;
  exporting = false;

  fromDate: Date = this.startOfMonth();
  toDate: Date = new Date();

  selectedShop: Shop | null = null;
  shopOptions: SelectItem[] = [{ label: 'All Shops', value: null }];

  report: VatDeclaration | null = null;
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

    this.configService.currency$.pipe(takeUntil(this.destroy$)).subscribe(c => {
      if (c) this.currency = c;
    });
    this.translationService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );

    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadData());

    if (this.isAdmin) {
      await this.loadShops();
    }
    await this.loadData();
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

  private startOfMonth(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  private formatDateParam(value: Date | null): string {
    const d = value instanceof Date ? value : new Date(value ?? Date.now());
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** True when the report has no sales and no purchase VAT rows. */
  get isEmpty(): boolean {
    return !!this.report
      && (this.report.outputVat?.length ?? 0) === 0
      && (this.report.inputVat?.length ?? 0) === 0;
  }

  async exportReport(format: 'csv' | 'excel'): Promise<void> {
    if (this.exporting || !this.report) return;
    this.exporting = true;
    this.cdr.markForCheck();
    try {
      const from = this.formatDateParam(this.fromDate);
      const to = this.formatDateParam(this.toDate);
      const shopId = this.selectedShop?.shopId;
      const response$ = await this.reportsService.downloadVatDeclaration(from, to, format, shopId);
      const response = await firstValueFrom(response$.pipe(timeout(120000)));
      const blob = response.body;
      if (!blob) {
        throw new Error('Empty export');
      }
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fallback = `vat_declaration.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const filename = match?.[1] || fallback;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      this.error = await firstValueFrom(
        this.translate.get('reports_vat_export_error').pipe(catchError(() => of('Export failed')))
      );
    } finally {
      this.exporting = false;
      this.cdr.markForCheck();
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
    if (!this.fromDate || !this.toDate) {
      return;
    }
    if (this.toDate < this.fromDate) {
      this.error = await firstValueFrom(
        this.translate.get('reports_vat_invalid_range').pipe(catchError(() => of('End date is before start date')))
      );
      this.report = null;
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const from = this.formatDateParam(this.fromDate);
      const to = this.formatDateParam(this.toDate);
      const shopId = this.selectedShop?.shopId;
      const obs = await this.reportsService.getVatDeclaration(from, to, shopId);
      this.report = await firstValueFrom(obs.pipe(timeout(30000)));
    } catch {
      this.report = null;
      this.error = await firstValueFrom(
        this.translate.get('reports_vat_error').pipe(catchError(() => of('Could not load report')))
      );
    } finally {
      this.loading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }
}
