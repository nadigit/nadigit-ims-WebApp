import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { PurchaseReturnDeleteImpact } from 'src/app/models/purchaseReturn';
import { PurchaseReturnService } from 'src/app/services/purchase-return.service';

@Component({
  selector: 'app-purchase-return-delete-dialog',
  templateUrl: './purchase-return-delete-dialog.component.html',
  styleUrls: ['../../../inventory/products/product-action-dialog.shared.scss'],
})
export class PurchaseReturnDeleteDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() returnId: number | null | undefined = null;
  /** When true, administrators get a force-delete button when the return is force-deletable. */
  @Input() canForceDelete = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<number>();
  /** Emitted when an administrator confirms deletion despite issued supplier credits. */
  @Output() forceConfirmed = new EventEmitter<number>();

  loading = false;
  impact: PurchaseReturnDeleteImpact | null = null;

  constructor(
    private purchaseReturnService: PurchaseReturnService,
    private translate: TranslateService,
    private messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['returnId']) && this.visible && this.returnId) {
      void this.loadImpact();
    }
    if (changes['visible'] && !this.visible) {
      this.impact = null;
      this.loading = false;
    }
  }

  async loadImpact(): Promise<void> {
    if (!this.returnId) {
      return;
    }

    this.loading = true;
    this.impact = null;

    try {
      this.impact = await firstValueFrom(
        this.purchaseReturnService.getReturnDeleteImpact(this.returnId)
      ) as PurchaseReturnDeleteImpact;
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
    return this.translate.instant('purchase_return_delete_impact_' + type.toLowerCase());
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    if (this.loading || !this.impact?.canDelete || !this.returnId) {
      return;
    }

    const id = this.returnId;
    this.onVisibleChange(false);
    this.confirmed.emit(id);
  }

  /** Force is offered only for admins when the return is blocked but still force-deletable. */
  get showForceDelete(): boolean {
    return this.canForceDelete && !!this.impact && !this.impact.canDelete && this.impact.forceable;
  }

  onForceConfirm(): void {
    if (this.loading || !this.showForceDelete || !this.returnId) {
      return;
    }

    const id = this.returnId;
    this.onVisibleChange(false);
    this.forceConfirmed.emit(id);
  }
}
