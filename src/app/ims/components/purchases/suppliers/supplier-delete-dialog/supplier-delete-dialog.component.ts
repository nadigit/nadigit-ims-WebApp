import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { SupplierDeleteImpact } from 'src/app/models/supplier';
import { SupplierService } from 'src/app/services/supplier.service';

@Component({
  selector: 'app-supplier-delete-dialog',
  templateUrl: './supplier-delete-dialog.component.html',
  styleUrls: ['../../../inventory/products/product-action-dialog.shared.scss'],
})
export class SupplierDeleteDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() supplierId: number | null | undefined = null;
  /** When true, administrators get a force-delete button when the supplier is force-deletable. */
  @Input() canForceDelete = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<number>();
  /** Emitted when an administrator confirms deletion despite (detachable) references. */
  @Output() forceConfirmed = new EventEmitter<number>();

  loading = false;
  impact: SupplierDeleteImpact | null = null;

  constructor(
    private supplierService: SupplierService,
    private translate: TranslateService,
    private messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['supplierId']) && this.visible && this.supplierId) {
      void this.loadImpact();
    }
    if (changes['visible'] && !this.visible) {
      this.impact = null;
      this.loading = false;
    }
  }

  async loadImpact(): Promise<void> {
    if (!this.supplierId) {
      return;
    }

    this.loading = true;
    this.impact = null;

    try {
      this.impact = await firstValueFrom(
        this.supplierService.getSupplierDeleteImpact(this.supplierId)
      ) as SupplierDeleteImpact;
    } catch {
      this.onVisibleChange(false);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_delete_impact'),
        life: 3000,
      });
    } finally {
      this.loading = false;
    }
  }

  getDeleteImpactLabel(type: string): string {
    return this.translate.instant('supplier_delete_impact_' + type.toLowerCase());
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    if (this.loading || !this.impact?.canDelete || !this.supplierId) {
      return;
    }

    const id = this.supplierId;
    this.onVisibleChange(false);
    this.confirmed.emit(id);
  }

  /** Force is offered only for admins when the supplier is blocked but still force-deletable. */
  get showForceDelete(): boolean {
    return this.canForceDelete && !!this.impact && !this.impact.canDelete && this.impact.forceable;
  }

  onForceConfirm(): void {
    if (this.loading || !this.showForceDelete || !this.supplierId) {
      return;
    }

    const id = this.supplierId;
    this.onVisibleChange(false);
    this.forceConfirmed.emit(id);
  }
}
