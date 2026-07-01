import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import { Product } from 'src/app/models/product';
import { LowStockThresholdService } from 'src/app/services/low-stock-threshold.service';
import {
  formatProductStockLabel,
  getAvailableQuantity,
  getMeasureUnit,
  getQuantitySeverity,
} from 'src/app/shared/product-utils';

/**
 * Single source of truth for rendering a product's available stock as a colored
 * tag (green / amber low-stock / red out-of-stock) with the quantity + unit and
 * an out-of-stock icon.
 *
 * The low-stock threshold comes from {@link LowStockThresholdService} so the
 * amber "low stock" styling is applied consistently everywhere — previously each
 * page wired its own (and some omitted the threshold, so they never showed amber).
 *
 * Usage: <app-product-quantity [product]="product"></app-product-quantity>
 * Pass [quantity] to display a specific figure (e.g. a per-warehouse stock) while
 * still using the product's unit + the shared severity rules.
 */
@Component({
  selector: 'app-product-quantity',
  standalone: true,
  imports: [CommonModule, TranslateModule, TagModule],
  template: `
    <p-tag
      [severity]="severity"
      [value]="label.quantity + ' ' + (label.unit | translate)"
      [icon]="qty <= 0 ? 'pi pi-exclamation-triangle' : ''"
      [styleClass]="styleClass">
    </p-tag>
  `,
})
export class ProductQuantityComponent implements OnInit {
  /** Product whose available stock is shown (also provides the measure unit). */
  @Input() product!: Product;
  /** Optional explicit quantity (display units); defaults to the product's available/sellable stock. */
  @Input() quantity?: number | null;
  /** Extra classes forwarded to the p-tag (e.g. 'has-writeoff', 'text-xs'). */
  @Input() styleClass = '';

  constructor(private lowStock: LowStockThresholdService) {}

  ngOnInit(): void {
    this.lowStock.ensureLoaded();
  }

  get qty(): number {
    return this.quantity != null ? this.quantity : getAvailableQuantity(this.product);
  }

  get label(): { quantity: string; unit: string } {
    if (this.quantity != null) {
      return {
        quantity: String(this.quantity),
        unit: getMeasureUnit(this.product?.measureUnit || 'UNIT', this.quantity),
      };
    }
    return formatProductStockLabel(this.product);
  }

  get severity(): string {
    return getQuantitySeverity(this.qty, this.lowStock.value);
  }
}
