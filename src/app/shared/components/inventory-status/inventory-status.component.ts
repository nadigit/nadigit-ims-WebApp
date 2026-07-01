import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Single source of truth for rendering a product's inventory status
 * (IN STOCK / LOW STOCK / OUT OF STOCK) as the branded `.product-badge` pill.
 *
 * Colors come from the global badges.scss (`.product-badge.status-*`), and the
 * label from the shared `product_<status>` i18n keys — so every screen shows the
 * exact same style and wording. Unknown/missing status renders a neutral "N/A".
 *
 * Usage: <app-inventory-status [status]="product.inventoryStatus"></app-inventory-status>
 */
@Component({
  selector: 'app-inventory-status',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  template: `
    <span class="product-badge"
      [class.status-instock]="key === 'instock'"
      [class.status-lowstock]="key === 'lowstock'"
      [class.status-outofstock]="key === 'outofstock'">
      {{ key ? ('product_' + key | translate) : naLabel }}
    </span>
  `,
})
export class InventoryStatusComponent {
  /** Inventory status enum value (case-insensitive): INSTOCK | LOWSTOCK | OUTOFSTOCK. */
  @Input() set status(value: string | null | undefined) {
    const normalized = (value ?? '').toString().trim().toLowerCase();
    this.key = (normalized === 'instock' || normalized === 'lowstock' || normalized === 'outofstock')
      ? normalized
      : '';
  }

  /** Text shown when the status is missing/unknown. */
  @Input() naLabel = 'N/A';

  key = '';
}
