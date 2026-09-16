import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { TagModule } from 'primeng/tag';
import { Subscription } from 'rxjs';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { getPreferredProductImageUrl } from 'src/app/shared/product-image.utils';
import {
  formatProductStockLabel,
  getProductTypeBadgeIcon,
  getProductTypeBadgeKey,
  getProductTypeBadgeSeverity,
  getWriteOffQuantity,
  hasWriteOffs,
} from 'src/app/shared/product-utils';
import { getProductVariantSummary } from 'src/app/shared/variant-summary.utils';

/**
 * One product, as a row in a product picker's list.
 *
 * Every screen that lets the user pick a product (orders, purchases, transfers, write-offs, pricing,
 * tax and line rules, filters) renders its suggestions with this, so a product reads the same wherever
 * it is chosen. The orders form's picker is the reference: image, name with its type badge, reference,
 * category and price, and the stock line.
 *
 * Use it as the item template of a `p-autoComplete` carrying `styleClass="ims-product-picker"`:
 *
 *   <ng-template let-product pTemplate="item"><app-product-option [product]="product"></app-product-option></ng-template>
 *
 * Look lives in ims-product-picker.scss, shared with the picker field itself.
 */
@Component({
  selector: 'app-product-option',
  standalone: true,
  imports: [CommonModule, TranslateModule, TagModule],
  template: `
    <div class="ims-product-option" *ngIf="product">
      <img [src]="imageUrl" [alt]="product.name || ''" class="ims-product-option__image" />
      <div class="ims-product-option__details">
        <div class="ims-product-option__title">
          <span class="ims-product-option__name">{{ product.name }}</span>
          <p-tag [value]="badgeKey | translate" [severity]="$any(badgeSeverity)" [icon]="badgeIcon"
            styleClass="text-xs"></p-tag>
        </div>
        <div class="ims-product-option__reference" *ngIf="product.reference">{{ product.reference }}</div>
        <small class="ims-product-option__meta" *ngIf="metaLine">{{ metaLine }}</small>
        <small class="ims-product-option__line" *ngIf="variantSummary">
          {{ 'variant' | translate }}: <strong>{{ variantSummary }}</strong>
        </small>
        <small class="ims-product-option__line" *ngIf="showStock && isStocked">
          <span>{{ 'stock' | translate }}: {{ stockText }}</span>
          <span *ngIf="writeOffQuantity > 0" class="ims-product-option__writeoff">
            <i class="pi pi-exclamation-triangle text-xs"></i>
            {{ writeOffQuantity }} {{ 'written_off' | translate }}
          </span>
        </small>
        <small class="ims-product-option__line" *ngIf="isService && product.serviceProvider">
          {{ 'service_provider' | translate }}: {{ product.serviceProvider }}
        </small>
        <!-- Page-specific lines (a return's ordered and remaining quantities) go here. -->
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class ProductOptionComponent implements OnInit, OnDestroy {
  @Input() product: any;
  /** Which price the meta line shows next to the category. */
  @Input() price: 'selling' | 'buying' | 'none' = 'selling';
  /** Show the stock line for stocked items. Off where stock means nothing (rules, overrides). */
  @Input() showStock = true;
  /**
   * Stock to show instead of the product's own available quantity, for pickers that know better
   * (a transfer's source warehouse). Plain number or preformatted text.
   */
  @Input() stock?: number | string | null;
  /** Price to show instead of the product's own (a return line's unit price on the order). */
  @Input() amount?: number | string | null;
  /** Currency code; the organisation's currency when omitted. */
  @Input() currency?: string | null;

  private orgCurrency: string | null = null;
  private sub?: Subscription;

  constructor(private config: AppConfigurationService, private activityProfile: ActivityProfileService) {}

  ngOnInit(): void {
    this.sub = this.config.currency$.subscribe((c) => (this.orgCurrency = c));
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get imageUrl(): string {
    return getPreferredProductImageUrl(this.product);
  }

  get isService(): boolean {
    return this.product?.productType === 'SERVICE';
  }

  get isStocked(): boolean {
    return !this.isService;
  }

  get badgeKey(): string {
    return getProductTypeBadgeKey(this.product);
  }

  get badgeSeverity(): string {
    return getProductTypeBadgeSeverity(this.product);
  }

  get badgeIcon(): string {
    return getProductTypeBadgeIcon(this.product);
  }

  get metaLine(): string {
    const parts: string[] = [];
    const category = this.product?.category?.categoryName ?? this.product?.categoryName;
    if (category) {
      parts.push(category);
    }
    const amount = this.amount !== undefined ? this.amount
      : this.price === 'buying' ? this.product?.buyingPrice
      : this.price === 'selling' ? this.product?.sellingPrice : null;
    if (amount !== null && amount !== undefined && amount !== '') {
      const currency = this.currency ?? this.orgCurrency ?? '';
      parts.push(`${currency} ${amount}`.trim());
    }
    return parts.join(' • ');
  }

  get variantSummary(): string {
    return this.activityProfile.isFashionProfile ? getProductVariantSummary(this.product) : '';
  }

  get stockText(): string {
    if (this.stock !== undefined && this.stock !== null && this.stock !== '') {
      return String(this.stock);
    }
    // Quantity only, as the orders picker shows it; fractional items keep their precision.
    return formatProductStockLabel(this.product).quantity;
  }

  get writeOffQuantity(): number {
    return this.product && hasWriteOffs(this.product) ? getWriteOffQuantity(this.product) : 0;
  }
}
