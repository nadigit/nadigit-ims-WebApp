import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { ProductService } from 'src/app/services/product.service';
import { BatchExpiryRow } from 'src/app/models/batch-expiry';

@Component({
  selector: 'app-batch-expiry-report',
  templateUrl: './batch-expiry-report.component.html',
  styleUrls: ['../reports-common.css', './batch-expiry-report.component.css'],
})
export class BatchExpiryReportComponent implements OnInit {
  rows: BatchExpiryRow[] = [];
  isLoading = false;
  available = true;

  status: 'all' | 'expired' | 'expiring_soon' = 'all';
  warningDays = 30;
  expiredLookbackDays = 90;

  statusOptions = [
    { label: 'all', value: 'all' },
    { label: 'expired', value: 'expired' },
    { label: 'expiring_soon', value: 'expiring_soon' },
  ];

  constructor(
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.isLoading = true;
    this.available = true;
    try {
      await this.productService.loadToken();
      this.productService.getBatchExpiryOverview(this.status, this.warningDays, this.expiredLookbackDays).subscribe({
        next: (data) => {
          this.rows = (data || []) as BatchExpiryRow[];
          this.sortRows();
          this.isLoading = false;
        },
        error: (err) => {
          this.isLoading = false;
          // 403 = feature not in the current plan; anything else is a load failure.
          if (err?.status === 403) {
            this.available = false;
          } else {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('batch_expiry_load_error'),
              life: 4000,
            });
          }
        },
      });
    } catch {
      this.isLoading = false;
    }
  }

  onFilterChange(): void {
    void this.load();
  }

  /** Expired first, then soonest to expire. */
  private sortRows(): void {
    this.rows.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
  }

  get expiredCount(): number {
    return this.rows.filter((r) => r.status === 'EXPIRED').length;
  }

  get expiringSoonCount(): number {
    return this.rows.filter((r) => r.status === 'EXPIRING_SOON').length;
  }

  statusSeverity(status: string): 'danger' | 'warning' {
    return status === 'EXPIRED' ? 'danger' : 'warning';
  }

  statusLabel(status: string): string {
    return this.translate.instant(status === 'EXPIRED' ? 'expired' : 'expiring_soon');
  }

  /** Human "in N days" / "N days ago" for the countdown column. */
  daysLabel(row: BatchExpiryRow): string {
    const d = row.daysUntilExpiration;
    if (row.status === 'EXPIRED') {
      return this.translate.instant('batch_expiry_days_ago', { days: Math.abs(d) });
    }
    if (d === 0) {
      return this.translate.instant('batch_expiry_today');
    }
    return this.translate.instant('batch_expiry_in_days', { days: d });
  }

  openProduct(row: BatchExpiryRow): void {
    if (row?.productId == null) {
      return;
    }
    this.router.navigateByUrl('/inventory/products/' + row.productId);
  }
}
