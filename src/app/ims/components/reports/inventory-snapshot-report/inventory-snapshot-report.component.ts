import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, firstValueFrom, takeUntil, timeout, catchError, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ReportsService, InventorySituation, InventorySituationDelta, InventorySnapshot } from 'src/app/services/reports.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { KeycloakService } from 'keycloak-angular';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

interface WarehouseOption {
  warehouseId: number;
  name: string;
}

@Component({
  selector: 'app-inventory-snapshot-report',
  templateUrl: './inventory-snapshot-report.component.html',
  styleUrls: ['../reports-common.css', './inventory-snapshot-report.component.css']
})
export class InventorySnapshotReportComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  loading = true;
  isInitialLoad = true;
  snapshot: InventorySnapshot | null = null;
  error: string | null = null;
  currency = 'USD';
  isAdmin = false;

  warehouseOptions: SelectItem[] = [];
  selectedWarehouseId: number | null = null;
  expirationWarningDays = 30;
  writeOffLookbackDays = 90;

  asOfDate: Date = new Date();
  maxAsOfDate: Date = new Date();
  includeZeroQuantity = false;
  situation: InventorySituation | null = null;
  situationLoading = false;
  situationInitialLoad = true;
  situationError: string | null = null;
  situationPage = 0;
  situationSize = 50;
  isDownloadingCsv = false;
  isDownloadingExcel = false;
  isDownloadingPdf = false;

  fromDate: Date = new Date(new Date().setDate(new Date().getDate() - 30));
  toDate: Date = new Date();
  deltaOnlyChanges = true;
  delta: InventorySituationDelta | null = null;
  deltaLoading = false;
  deltaInitialLoad = true;
  deltaError: string | null = null;
  deltaPage = 0;
  deltaSize = 50;
  isDownloadingDeltaCsv = false;
  isDownloadingDeltaExcel = false;
  isDownloadingDeltaPdf = false;

  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();
  private readonly situationFilterChange$ = new Subject<void>();

  constructor(
    private reportsService: ReportsService,
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private configService: AppConfigurationService,
    private keycloakService: KeycloakService,
    private cdr: ChangeDetectorRef,
    public pageSizeService: TablePageSizeService
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

    this.situationSize = this.pageSizeService.get(TablePageSizeKeys.inventorySnapshot, [25, 50, 100], this.situationSize);
    this.deltaSize = this.pageSizeService.get(TablePageSizeKeys.inventorySnapshotDelta, [25, 50, 100], this.deltaSize);
    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadData());
    this.situationFilterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.situationPage = 0;
      this.deltaPage = 0;
      this.loadSituation();
      this.loadDelta();
    });

    if (this.isAdmin) {
      await this.loadWarehouses();
    }
    this.loadData();
    this.loadSituation();
    this.loadDelta();
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
    this.situationFilterChange$.next();
  }

  onSituationFilterChange(): void {
    if (this.situationInitialLoad) {
      return;
    }
    this.situationFilterChange$.next();
  }

  onSituationPage(event: { first?: number; rows?: number }): void {
    this.pageSizeService.onPage(TablePageSizeKeys.inventorySnapshot, [25, 50, 100], event);
    const rows = event.rows ?? this.situationSize;
    this.situationPage = Math.floor((event.first ?? 0) / rows);
    this.situationSize = rows;
    this.loadSituation();
  }

  onDeltaPage(event: { first?: number; rows?: number }): void {
    this.pageSizeService.onPage(TablePageSizeKeys.inventorySnapshotDelta, [25, 50, 100], event);
    const rows = event.rows ?? this.deltaSize;
    this.deltaPage = Math.floor((event.first ?? 0) / rows);
    this.deltaSize = rows;
    this.loadDelta();
  }

  async downloadSituation(format: 'csv' | 'excel' | 'pdf'): Promise<void> {
    const loadingKey = format === 'csv'
      ? 'isDownloadingCsv'
      : format === 'excel'
        ? 'isDownloadingExcel'
        : 'isDownloadingPdf';
    (this as any)[loadingKey] = true;
    this.cdr.markForCheck();
    try {
      const asOf = this.formatAsOfDate(this.asOfDate);
      const wid = this.isAdmin ? this.selectedWarehouseId ?? undefined : undefined;
      const response$ = await this.reportsService.downloadInventorySituation(
        asOf,
        format,
        wid,
        this.includeZeroQuantity
      );
      const response: any = await firstValueFrom(response$);
      const blob: Blob = response?.body;
      if (!blob) {
        throw new Error('Empty inventory situation export');
      }
      const header =
        response?.headers?.get?.('Content-Disposition') ||
        response?.headers?.get?.('content-disposition') ||
        null;
      const fallback = `inventory_situation_${asOf}.${this.exportExtension(format)}`;
      const filename = this.extractFilenameFromContentDisposition(header, fallback);
      this.triggerBrowserDownload(blob, filename, format);
    } catch (e) {
      console.error(e);
      this.situationError = this.translate.instant('reports_inventory_situation_export_error');
    } finally {
      (this as any)[loadingKey] = false;
      this.cdr.markForCheck();
    }
  }

  statusSeverity(status: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' {
    switch (status) {
      case 'OUTOFSTOCK':
        return 'danger';
      case 'LOWSTOCK':
        return 'warning';
      case 'INSTOCK':
        return 'success';
      default:
        return 'info';
    }
  }

  statusLabel(status: string | null | undefined): string {
    if (!status) {
      return '';
    }
    const keyMap: Record<string, string> = {
      INSTOCK: 'in_stock',
      LOWSTOCK: 'low_stock',
      OUTOFSTOCK: 'out_of_stock'
    };
    const key = keyMap[status] ?? status;
    return this.translate.instant(key);
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

  private async loadData(): Promise<void> {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();
    try {
      const wid = this.isAdmin ? this.selectedWarehouseId ?? undefined : undefined;
      const ew = Math.min(365, Math.max(1, Math.round(this.expirationWarningDays) || 30));
      const wl = Math.min(730, Math.max(1, Math.round(this.writeOffLookbackDays) || 90));
      const obs = await this.reportsService.getInventorySnapshot(wid, ew, wl);
      this.snapshot = await firstValueFrom(obs);
    } catch (e) {
      console.error(e);
      this.error = this.translate.instant('reports_inventory_snapshot_error');
      this.snapshot = null;
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async downloadDelta(format: 'csv' | 'excel' | 'pdf'): Promise<void> {
    const loadingKey = format === 'csv'
      ? 'isDownloadingDeltaCsv'
      : format === 'excel'
        ? 'isDownloadingDeltaExcel'
        : 'isDownloadingDeltaPdf';
    (this as any)[loadingKey] = true;
    this.cdr.markForCheck();
    try {
      const from = this.formatAsOfDate(this.fromDate);
      const to = this.formatAsOfDate(this.toDate);
      const wid = this.isAdmin ? this.selectedWarehouseId ?? undefined : undefined;
      const response$ = await this.reportsService.downloadInventorySituationDelta(
        from,
        to,
        format,
        wid,
        this.includeZeroQuantity,
        this.deltaOnlyChanges
      );
      const response: any = await firstValueFrom(response$);
      const blob: Blob = response?.body;
      if (!blob) {
        throw new Error('Empty inventory situation delta export');
      }
      const header =
        response?.headers?.get?.('Content-Disposition') ||
        response?.headers?.get?.('content-disposition') ||
        null;
      const fallback = `inventory_situation_delta_${from}_to_${to}.${this.exportExtension(format)}`;
      const filename = this.extractFilenameFromContentDisposition(header, fallback);
      this.triggerBrowserDownload(blob, filename, format);
    } catch (e) {
      console.error(e);
      this.deltaError = this.translate.instant('reports_inventory_situation_delta_export_error');
    } finally {
      (this as any)[loadingKey] = false;
      this.cdr.markForCheck();
    }
  }

  private async loadSituation(): Promise<void> {
    if (this.situationLoading) return;
    this.situationLoading = true;
    this.situationError = null;
    this.cdr.markForCheck();
    try {
      const asOf = this.formatAsOfDate(this.asOfDate);
      const wid = this.isAdmin ? this.selectedWarehouseId ?? undefined : undefined;
      const obs = await this.reportsService.getInventorySituation(
        asOf,
        wid,
        this.includeZeroQuantity,
        this.situationPage,
        this.situationSize
      );
      this.situation = await firstValueFrom(obs);
    } catch (e) {
      console.error(e);
      this.situationError = this.translate.instant('reports_inventory_situation_error');
      this.situation = null;
    } finally {
      this.situationLoading = false;
      this.situationInitialLoad = false;
      this.cdr.markForCheck();
    }
  }

  private async loadDelta(): Promise<void> {
    if (this.fromDate > this.toDate) {
      this.deltaError = this.translate.instant('reports_inventory_situation_delta_invalid_range');
      this.delta = null;
      this.deltaInitialLoad = false;
      return;
    }
    this.deltaLoading = true;
    this.deltaError = null;
    this.cdr.markForCheck();
    try {
      const from = this.formatAsOfDate(this.fromDate);
      const to = this.formatAsOfDate(this.toDate);
      const wid = this.isAdmin ? this.selectedWarehouseId ?? undefined : undefined;
      const obs = await this.reportsService.getInventorySituationDelta(
        from,
        to,
        wid,
        this.includeZeroQuantity,
        this.deltaOnlyChanges,
        this.deltaPage,
        this.deltaSize
      );
      this.delta = await firstValueFrom(obs);
    } catch (e) {
      console.error(e);
      this.deltaError = this.translate.instant('reports_inventory_situation_delta_error');
      this.delta = null;
    } finally {
      this.deltaLoading = false;
      this.deltaInitialLoad = false;
      this.cdr.markForCheck();
    }
  }

  private formatAsOfDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private exportExtension(format: 'csv' | 'excel' | 'pdf'): string {
    switch (format) {
      case 'csv':
        return 'csv';
      case 'excel':
        return 'xlsx';
      case 'pdf':
        return 'pdf';
    }
  }

  private exportMimeType(format: 'csv' | 'excel' | 'pdf'): string {
    switch (format) {
      case 'csv':
        return 'text/csv;charset=utf-8';
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'pdf':
        return 'application/pdf';
    }
  }

  private extractFilenameFromContentDisposition(header: string | null, fallback: string): string {
    if (!header) {
      return fallback;
    }
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(header);
    if (match?.[1]) {
      return decodeURIComponent(match[1].replace(/"/g, ''));
    }
    return fallback;
  }

  private triggerBrowserDownload(blob: Blob, filename: string, format?: 'csv' | 'excel' | 'pdf'): void {
    const mimeType = format ? this.exportMimeType(format) : undefined;
    const downloadBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
    const url = window.URL.createObjectURL(downloadBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
