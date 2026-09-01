import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import {
  ReportsService,
  StaffPerformance,
  StaffPerformanceRow,
  StaffKpiRoleContext
} from 'src/app/services/reports.service';

const ROLE_LABEL_KEYS: { value: StaffKpiRoleContext; labelKey: string }[] = [
  { value: 'CASHIER', labelKey: 'staff_kpi_role_cashier' },
  { value: 'VENDOR', labelKey: 'staff_kpi_role_vendor' },
  { value: 'WAREHOUSEMAN', labelKey: 'staff_kpi_role_warehouseman' },
  { value: 'GENERIC', labelKey: 'staff_kpi_activity' }
];

const PERIOD_PRESETS: { value: number; labelKey: string }[] = [
  { value: 7, labelKey: 'staff_kpi_range_7' },
  { value: 30, labelKey: 'staff_kpi_range_30' },
  { value: 90, labelKey: 'staff_kpi_range_90' }
];

/**
 * ADMIN staff performance report.
 *
 * Renders one role group at a time from the KPI keys the backend supplies, so adding a metric in
 * P2/P3 needs no change here. Two rules the backend enforces and this component must honour:
 *
 *  - `available === false` means the deployment cannot produce the group at all. Show the reason,
 *    never a table of zeros — in a performance report a zero reads as "this person did nothing".
 *  - `leaderboardEnabled === false` means ranks must not be shown, either because the customer
 *    switched ranking off or because the group is too small for a ranking to mean anything.
 */
@Component({
  selector: 'app-staff-performance-report',
  templateUrl: './staff-performance-report.component.html',
  styleUrls: ['../reports-common.css', './staff-performance-report.component.css']
})
export class StaffPerformanceReportComponent implements OnInit, OnDestroy {
  loading = true;
  error: string | null = null;
  currency = 'MAD';

  /** Role group segmented control; labels are filled in once translations are ready. */
  roleOptions: SelectItem[] = [];
  activeRole: StaffKpiRoleContext = 'CASHIER';

  /** Period presets, as a dropdown to match the other report pages. */
  periodOptions: SelectItem[] = [];
  selectedDays = 30;

  /** Custom start/end range, used instead of the presets when switched on. */
  useCustomRange = false;
  fromDate: Date | null = null;
  toDate: Date | null = null;
  /** Mirrors the server-side cap so an impossible range is refused before the round trip. */
  readonly maxRangeDays = 731;

  /**
   * The deployment's configured `app.timezone`. Business days are the app's days, not the
   * browser's: an admin abroad asking for "last 30 days" must get the same window the nightly job
   * wrote, otherwise the edges of the period silently shift. Falls back to the browser zone only
   * if the setting cannot be read.
   */
  private appTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  data: StaffPerformance | null = null;

  /** Metrics shown as headline tiles; the rest stay in the table. */
  readonly headlineMetrics: { [key in StaffKpiRoleContext]?: string[] } = {
    CASHIER: ['netSales', 'transactionsCount', 'cashVarianceAbs', 'discountRate'],
    // Margin before revenue: revenue alone rewards discounting your way up the board.
    VENDOR: ['grossMargin', 'marginRate', 'netSalesExTax', 'overdueAr'],
    WAREHOUSEMAN: ['movementLines', 'receiptsCount', 'adjustmentsCount', 'writeoffsValue'],
    GENERIC: ['auditActions', 'auditFailures', 'auditFailureRate']
  };

  /** Metrics rendered as money, as a percentage, or as a duration. */
  private readonly moneyMetrics = new Set([
    'netSales', 'grossSales', 'totalDiscount', 'avgBasket', 'refundsValue',
    'cashOverShort', 'cashVarianceAbs', 'payCash', 'payCard', 'payCredit', 'payOther',
    'netSalesExTax', 'cogs', 'grossMargin', 'avgOrderValue', 'discountGranted',
    'returnsValue', 'invoicedAmount', 'collectedAmount', 'overdueAr',
    'adjustmentsValue', 'writeoffsValue'
  ]);
  private readonly rateMetrics = new Set([
    'discountRate', 'marginRate', 'returnRate', 'collectionRate', 'batchComplianceRate',
    'auditFailureRate'
  ]);
  private readonly durationMetrics = new Set(['avgTransactionSeconds', 'avgTransferLeadMinutes']);

  exporting = false;

  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();

  constructor(
    private reportsService: ReportsService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private configService: AppConfigurationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.configService.currency$.subscribe(c => {
      if (c) this.currency = c;
    });
    this.translationService.currentLanguage$.subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );

    this.filterChange$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.loadData());

    this.buildFilterOptions();
    this.translationService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.buildFilterOptions());

    this.loadTimeZoneThenData();
  }

  /** Option labels go through translate.instant, so they are rebuilt when the language changes. */
  private buildFilterOptions(): void {
    this.roleOptions = ROLE_LABEL_KEYS.map(r => ({
      label: this.translate.instant(r.labelKey),
      value: r.value
    }));
    this.periodOptions = PERIOD_PRESETS.map(p => ({
      label: this.translate.instant(p.labelKey),
      value: p.value
    }));
  }

  /** Reads app.timezone before the first query so the default period is right from the start. */
  private async loadTimeZoneThenData(): Promise<void> {
    try {
      const tz$ = await this.configService.getConfigurationValue('app.timezone');
      tz$.pipe(takeUntil(this.destroy$)).subscribe({
        next: tz => {
          if (tz && this.isValidTimeZone(tz)) {
            this.appTimeZone = tz;
          }
          this.loadData();
        },
        error: () => this.loadData()
      });
    } catch {
      this.loadData();
    }
  }

  private isValidTimeZone(tz: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onRoleChange(): void {
    this.filterChange$.next();
  }

  onFilterChange(): void {
    this.filterChange$.next();
  }

  onCustomRangeToggle(): void {
    if (!this.useCustomRange) {
      this.fromDate = null;
      this.toDate = null;
      this.error = null;
      this.filterChange$.next();
      return;
    }
    // Seed the pickers from the preset currently shown, so switching modes is not a blank slate.
    const range = this.presetRange();
    this.fromDate = this.isoToLocalDate(range.from);
    this.toDate = this.isoToLocalDate(range.to);
    this.filterChange$.next();
  }

  /**
   * The window to query, resolved once so the table and the export can never disagree. Returns null
   * when a custom range is selected but incomplete or invalid.
   */
  private resolveRange(): { from: string; to: string } | null {
    if (!this.useCustomRange) {
      return this.presetRange();
    }
    if (!this.fromDate || !this.toDate) {
      return null;
    }
    if (this.toDate < this.fromDate) {
      this.error = this.translate.instant('staff_kpi_range_invalid');
      return null;
    }
    const days = this.daysBetween(this.toIsoDate(this.fromDate), this.toIsoDate(this.toDate));
    if (days > this.maxRangeDays) {
      this.error = this.translate.instant('staff_kpi_range_too_long');
      return null;
    }
    // The picked dates are calendar dates; send them verbatim and let the backend treat them as
    // business dates in app.timezone.
    return { from: this.toIsoDate(this.fromDate), to: this.toIsoDate(this.toDate) };
  }

  /** Preset window ending on TODAY IN THE APP TIMEZONE, not the browser's. */
  private presetRange(): { from: string; to: string } {
    const to = this.todayInAppZone();
    return { from: this.shiftIsoDate(to, -(this.selectedDays - 1)), to };
  }

  /** Today as yyyy-MM-dd in the configured app timezone. */
  private todayInAppZone(): string {
    // en-CA formats as yyyy-MM-dd, and timeZone does the zone conversion for us.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.appTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  }

  /** Date arithmetic done in UTC so it cannot drift across a DST boundary. */
  private shiftIsoDate(iso: string, deltaDays: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const shifted = new Date(Date.UTC(y, m - 1, d));
    shifted.setUTCDate(shifted.getUTCDate() + deltaDays);
    return shifted.toISOString().slice(0, 10);
  }

  private daysBetween(fromIso: string, toIso: string): number {
    const [fy, fm, fd] = fromIso.split('-').map(Number);
    const [ty, tm, td] = toIso.split('-').map(Number);
    const diff = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
    return Math.round(diff / 86400000) + 1;
  }

  /** Converts an app-timezone calendar date back to a local Date for the pickers. */
  private isoToLocalDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  async loadData(): Promise<void> {
    this.error = null;
    const range = this.resolveRange();
    if (!range) {
      // Incomplete or invalid custom range: leave the previous view in place rather than firing a
      // request that would fail, and stop the spinner.
      this.loading = false;
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    try {
      const request$ = await this.reportsService.getStaffPerformance(
        this.activeRole,
        range.from,
        range.to
      );
      request$.pipe(takeUntil(this.destroy$)).subscribe({
        next: result => {
          this.data = result;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          this.error = err?.error?.message || this.translate.instant('staff_kpi_load_error');
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
    } catch (err: any) {
      this.error = err?.message || this.translate.instant('staff_kpi_load_error');
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  // --- rendering helpers ---------------------------------------------------

  get headlineKeys(): string[] {
    if (!this.data?.available) {
      return [];
    }
    const preferred = this.headlineMetrics[this.activeRole] ?? [];
    return preferred.filter(k => this.data!.metricKeys.includes(k));
  }

  metricLabel(key: string): string {
    return this.translate.instant('staff_kpi_metric_' + key);
  }

  formatMetric(key: string, value: number | undefined): string {
    const v = value ?? 0;
    if (this.rateMetrics.has(key)) {
      return (v * 100).toFixed(1) + '%';
    }
    if (this.durationMetrics.has(key)) {
      return this.formatDuration(key, v);
    }
    if (this.moneyMetrics.has(key)) {
      return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${this.currency}`;
    }
    return v.toLocaleString();
  }

  private formatDuration(key: string, value: number): string {
    const seconds = key === 'avgTransferLeadMinutes' ? value * 60 : value;
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    }
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    }
    return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  /**
   * Percentage change against the previous window. Returns null when there is no previous value to
   * compare against — showing "+100%" against a zero baseline would invent a trend.
   */
  deltaPercent(row: StaffPerformanceRow, key: string): number | null {
    const previous = row.previousMetrics?.[key];
    const current = row.metrics?.[key] ?? 0;
    if (previous == null || previous === 0) {
      return null;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  /**
   * Whether a positive delta should read as good. Lower is better for variance, discounts, refunds
   * and checkout time, so the colour must not simply follow the sign.
   */
  isImprovement(key: string, delta: number): boolean {
    const lowerIsBetter = new Set([
      'cashVarianceAbs', 'sessionsOutOfTolerance', 'discountRate', 'totalDiscount',
      'refundsCount', 'refundsValue', 'avgTransactionSeconds', 'returnRate', 'returnsValue',
      'returnsCount', 'discountGranted', 'writeoffsCount', 'writeoffsValue', 'overdueAr',
      'auditFailures', 'auditFailureRate', 'avgTransferLeadMinutes'
    ]);
    return lowerIsBetter.has(key) ? delta < 0 : delta > 0;
  }

  teamMedian(key: string): number {
    return this.data?.teamMedians?.[key] ?? 0;
  }

  /**
   * Headline figure for a tile: the team total for additive metrics, the median for derived ones.
   * A team "discount rate" cannot be a sum of rates, so those fall back to the median.
   */
  tileValue(key: string): number {
    const total = this.data?.teamTotals?.[key];
    return total != null ? total : this.teamMedian(key);
  }

  get unavailableMessageKey(): string {
    switch (this.data?.availabilityReason) {
      case 'MODULE_DISABLED':
        return 'staff_kpi_unavailable_module_disabled';
      case 'FEATURE_NOT_LICENSED':
        return 'staff_kpi_unavailable_not_licensed';
      case 'NOT_IMPLEMENTED':
        return 'staff_kpi_unavailable_not_implemented';
      default:
        return 'staff_kpi_unavailable_generic';
    }
  }

  get leaderboardNoticeKey(): string | null {
    if (!this.data || this.data.leaderboardEnabled) {
      return null;
    }
    return this.data.leaderboardSuppressedReason === 'TOO_FEW_MEMBERS'
      ? 'staff_kpi_leaderboard_too_few'
      : 'staff_kpi_leaderboard_disabled';
  }

  get showUnattributedWarning(): boolean {
    return (this.data?.unattributedShare ?? 0) > 0.05;
  }

  get unattributedPercent(): string {
    return ((this.data?.unattributedShare ?? 0) * 100).toFixed(0);
  }

  /**
   * Downloads the current view. The blob is turned into an object URL and clicked, then revoked -
   * the API needs an Authorization header, so a plain href would return 401.
   */
  async exportReport(format: 'csv' | 'xlsx'): Promise<void> {
    if (this.exporting || !this.data?.available) {
      return;
    }
    const range = this.resolveRange();
    if (!range) {
      return;
    }
    this.exporting = true;

    try {
      const request$ = await this.reportsService.exportStaffPerformance(
        this.activeRole,
        range.from,
        range.to,
        format
      );
      request$.pipe(takeUntil(this.destroy$)).subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download =
            `staff_performance_${this.activeRole.toLowerCase()}`
            + `_${range.from}_to_${range.to}.${format}`;
          link.click();
          URL.revokeObjectURL(url);
          this.exporting = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = this.translate.instant('staff_kpi_export_error');
          this.exporting = false;
          this.cdr.markForCheck();
        }
      });
    } catch {
      this.error = this.translate.instant('staff_kpi_export_error');
      this.exporting = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Formats as yyyy-MM-dd from LOCAL parts, not toISOString().
   *
   * p-calendar returns local midnight, and toISOString() converts to UTC — in any timezone ahead of
   * UTC (Morocco is UTC+1) that rolls the date back a day, so a period picked as 1-30 September
   * would be queried as 31 August-29 September. Matches formatDateParam in the other reports.
   */
  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /** Rank column + employee + active days + one column per metric. */
  get tableColumnCount(): number {
    const base = this.data?.leaderboardEnabled ? 3 : 2;
    return base + (this.data?.metricKeys?.length || 0);
  }

  /**
   * Accent colour for a headline tile, following the shared reports-stat-tile variants: green for
   * money earned, red for money or errors leaking out, orange for things to watch, blue otherwise.
   */
  tileAccentClass(key: string): string {
    const green = ['netSales', 'netSalesExTax', 'grossMargin', 'collectedAmount', 'receiptsCount'];
    const red = ['cashVarianceAbs', 'overdueAr', 'writeoffsValue', 'auditFailures'];
    const orange = ['discountRate', 'adjustmentsCount', 'auditFailureRate'];
    if (green.includes(key)) {
      return 'reports-stat-tile--accent-green';
    }
    if (red.includes(key)) {
      return 'reports-stat-tile--accent-red';
    }
    if (orange.includes(key)) {
      return 'reports-stat-tile--accent-orange';
    }
    return 'reports-stat-tile--accent-blue';
  }

  trackByUser(_index: number, row: StaffPerformanceRow): number {
    return row.appUserId;
  }

  trackByKey(_index: number, key: string): string {
    return key;
  }
}
