import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { SelectItem } from 'primeng/api';
import { Subject, debounceTime, firstValueFrom, takeUntil, timeout, catchError, of } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ReportsService, InventorySnapshot } from 'src/app/services/reports.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { KeycloakService } from 'keycloak-angular';

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
  loading = false;
  snapshot: InventorySnapshot | null = null;
  error: string | null = null;
  currency = 'USD';
  isAdmin = false;

  warehouseOptions: SelectItem[] = [];
  selectedWarehouseId: number | null = null;
  /** Days ahead for “expiring soon” (sent to API, clamped 1–365 server-side). */
  expirationWarningDays = 30;
  /** Days lookback for approved write-off breakdown (1–730 server-side). */
  writeOffLookbackDays = 90;

  private readonly destroy$ = new Subject<void>();
  private readonly filterChange$ = new Subject<void>();

  constructor(
    private reportsService: ReportsService,
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
    this.translationService.currentLanguage$.subscribe(() =>
      this.translate.use(this.translationService.getPreferredLanguage())
    );

    this.filterChange$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadData());

    if (this.isAdmin) {
      await this.loadWarehouses();
    }
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChange(): void {
    this.filterChange$.next();
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
    if (this.loading) return;
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
}
