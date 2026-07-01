import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { OrderDeleteImpact } from 'src/app/models/order';
import { OrderService } from 'src/app/services/order.service';

@Component({
  selector: 'app-order-delete-dialog',
  templateUrl: './order-delete-dialog.component.html',
  styleUrls: ['../../../inventory/products/product-action-dialog.shared.scss'],
})
export class OrderDeleteDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() orderId: number | null | undefined = null;
  /** When true, administrators get a force-delete button even if the order is referenced. */
  @Input() canForceDelete = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<number>();
  /** Emitted when an administrator confirms deletion despite blocking references. */
  @Output() forceConfirmed = new EventEmitter<number>();

  loading = false;
  impact: OrderDeleteImpact | null = null;

  constructor(
    private orderService: OrderService,
    private translate: TranslateService,
    private messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['orderId']) && this.visible && this.orderId) {
      void this.loadImpact();
    }
    if (changes['visible'] && !this.visible) {
      this.impact = null;
      this.loading = false;
    }
  }

  async loadImpact(): Promise<void> {
    if (!this.orderId) {
      return;
    }

    this.loading = true;
    this.impact = null;

    try {
      this.impact = await firstValueFrom(
        this.orderService.getOrderDeleteImpact(this.orderId)
      ) as OrderDeleteImpact;
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
    return this.translate.instant('order_delete_impact_' + type.toLowerCase());
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    if (this.loading || !this.impact?.canDelete || !this.orderId) {
      return;
    }

    const id = this.orderId;
    this.onVisibleChange(false);
    this.confirmed.emit(id);
  }

  /** Whether the force-delete action should be offered (admin + blocked order). */
  get showForceDelete(): boolean {
    return this.canForceDelete && !!this.impact && !this.impact.canDelete;
  }

  onForceConfirm(): void {
    if (this.loading || !this.showForceDelete || !this.orderId) {
      return;
    }

    const id = this.orderId;
    this.onVisibleChange(false);
    this.forceConfirmed.emit(id);
  }
}
