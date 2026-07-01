import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { ProductDeleteImpact } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';

@Component({
  selector: 'app-product-delete-dialog',
  templateUrl: './product-delete-dialog.component.html',
  styleUrls: ['../product-action-dialog.shared.scss'],
})
export class ProductDeleteDialogComponent implements OnChanges {
  @Input() visible = false;
  @Input() productId: number | null | undefined = null;
  /** When true, administrators get a force-delete button even if the product is referenced. */
  @Input() canForceDelete = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() confirmed = new EventEmitter<number>();
  /** Emitted when an administrator confirms deletion despite blocking references. */
  @Output() forceConfirmed = new EventEmitter<number>();

  loading = false;
  impact: ProductDeleteImpact | null = null;

  constructor(
    private productService: ProductService,
    private translate: TranslateService,
    private messageService: MessageService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['visible'] || changes['productId']) && this.visible && this.productId) {
      void this.loadImpact();
    }
    if (changes['visible'] && !this.visible) {
      this.impact = null;
      this.loading = false;
    }
  }

  async loadImpact(): Promise<void> {
    if (!this.productId) {
      return;
    }

    this.loading = true;
    this.impact = null;

    try {
      this.impact = await firstValueFrom(
        this.productService.getProductDeleteImpact(this.productId)
      ) as ProductDeleteImpact;
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
    return this.translate.instant('product_delete_impact_' + type.toLowerCase());
  }

  onVisibleChange(value: boolean): void {
    this.visibleChange.emit(value);
  }

  onCancel(): void {
    this.onVisibleChange(false);
  }

  onConfirm(): void {
    if (this.loading || !this.impact?.canDelete || !this.productId) {
      return;
    }

    const id = this.productId;
    this.onVisibleChange(false);
    this.confirmed.emit(id);
  }

  /** Whether the force-delete action should be offered (admin + blocked product). */
  get showForceDelete(): boolean {
    return this.canForceDelete && !!this.impact && !this.impact.canDelete;
  }

  onForceConfirm(): void {
    if (this.loading || !this.showForceDelete || !this.productId) {
      return;
    }

    const id = this.productId;
    this.onVisibleChange(false);
    this.forceConfirmed.emit(id);
  }
}
