import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { WarehouseDeleteImpact } from 'src/app/models/warehouse';
import { WarehouseService } from 'src/app/services/warehouse.service';

@Component({
  selector: 'app-warehouse-delete-dialog',
  templateUrl: './warehouse-delete-dialog.component.html',
  styleUrls: ['../../products/product-action-dialog.shared.scss'],
})
export class WarehouseDeleteDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() warehouseId: number | null | undefined = null;
  /** When true, administrators get a force-delete button even if the warehouse is referenced. */
  @Input() canForceDelete = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<number>();
  /** Emitted when an administrator confirms deletion despite blocking references. */
  @Output() forceConfirmed = new EventEmitter<number>();

  loading = false;
  impact: WarehouseDeleteImpact | null = null;

  constructor(
    private warehouseService: WarehouseService,
    private translate: TranslateService,
    private messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['warehouseId']) && this.visible && this.warehouseId) {
      void this.loadImpact();
    }
    if (changes['visible'] && !this.visible) {
      this.impact = null;
      this.loading = false;
    }
  }

  async loadImpact(): Promise<void> {
    if (!this.warehouseId) {
      return;
    }

    this.loading = true;
    this.impact = null;

    try {
      this.impact = await firstValueFrom(
        this.warehouseService.getWarehouseDeleteImpact(this.warehouseId)
      ) as WarehouseDeleteImpact;
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
    return this.translate.instant('warehouse_delete_impact_' + type.toLowerCase());
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    if (this.loading || !this.impact?.canDelete || !this.warehouseId) {
      return;
    }

    const id = this.warehouseId;
    this.onVisibleChange(false);
    this.confirmed.emit(id);
  }

  /** Whether the force-delete action should be offered (admin + blocked warehouse). */
  get showForceDelete(): boolean {
    return this.canForceDelete && !!this.impact && !this.impact.canDelete;
  }

  onForceConfirm(): void {
    if (this.loading || !this.showForceDelete || !this.warehouseId) {
      return;
    }

    const id = this.warehouseId;
    this.onVisibleChange(false);
    this.forceConfirmed.emit(id);
  }
}
