import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { lastValueFrom } from 'rxjs';
import { Product } from 'src/app/models/product';
import {
  ProductFamily,
  ProductFamilyInventoryOverview,
  ProductVariantLine,
} from 'src/app/models/product-family';
import { ProductFamilyService } from 'src/app/services/product-family.service';
import { ProductService } from 'src/app/services/product.service';
import { AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { distinctAxisValues, findVariantByOptions } from 'src/app/shared/variant-resolution.utils';
import { getProductVariantSummary } from 'src/app/shared/variant-summary.utils';
import { getAvailableQuantity } from 'src/app/shared/product-utils';

@Component({
  selector: 'app-variant-product-picker',
  templateUrl: './variant-product-picker.component.html',
  styleUrls: ['./variant-product-picker.component.css'],
})
export class VariantProductPickerComponent implements OnChanges {
  @Input() warehouseId: number | null = null;
  @Input() currency = 'USD';
  @Input() disabled = false;
  @Input() compact = false;
  @Output() productSelected = new EventEmitter<Product>();

  selectedFamilyModel: ProductFamily | null = null;
  familySuggestions: ProductFamily[] = [];
  familiesLoading = false;

  selectedFamily: ProductFamily | null = null;
  overview: ProductFamilyInventoryOverview | null = null;
  overviewLoading = false;

  selectedOptions: Record<string, string> = {};
  addInProgress = false;

  constructor(
    private productFamilyService: ProductFamilyService,
    private productService: ProductService,
    private messageService: MessageService,
    private translate: TranslateService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['warehouseId'] && !changes['warehouseId'].firstChange) {
      this.clearFamilySelectionInternal();
    }
  }

  get axes(): string[] {
    return this.selectedFamily?.variantAxes ?? [];
  }

  get variants(): ProductVariantLine[] {
    return this.overview?.variants ?? [];
  }

  get resolvedVariant(): ProductVariantLine | null {
    return findVariantByOptions(this.variants, this.axes, this.selectedOptions);
  }

  get allAxesSelected(): boolean {
    return this.axes.every((axis) => !!this.selectedOptions[axis]?.trim());
  }

  get warehouseRequired(): boolean {
    return this.warehouseId == null;
  }

  optionsForAxis(axis: string): { label: string; value: string }[] {
    return distinctAxisValues(this.variants, axis).map((v) => ({ label: v, value: v }));
  }

  filterFamilies(event: { query: string }): void {
    const q = (event?.query ?? '').trim();
    this.familiesLoading = true;
    this.productFamilyService.list(q, true).subscribe({
      next: (families) => {
        this.familySuggestions = families ?? [];
        this.familiesLoading = false;
      },
      error: () => {
        this.familySuggestions = [];
        this.familiesLoading = false;
      },
    });
  }

  onFamilyModelChange(family: ProductFamily | null): void {
    if (!family?.productFamilyId) {
      this.clearFamilySelection();
      return;
    }
    this.selectedFamily = family;
    this.selectedOptions = {};
    void this.loadOverview(family.productFamilyId);
  }

  onFamilySelect(event: AutoCompleteSelectEvent): void {
    const family = (event?.value ?? null) as ProductFamily | null;
    this.selectedFamilyModel = family;
    this.onFamilyModelChange(family);
  }

  clearFamilySelection(): void {
    this.clearFamilySelectionInternal();
  }

  familyDisplayLabel(family: ProductFamily): string {
    if (!family) {
      return '';
    }
    return `${family.styleReference ?? ''} — ${family.name ?? ''}`.trim();
  }

  private clearFamilySelectionInternal(): void {
    this.selectedFamily = null;
    this.selectedFamilyModel = null;
    this.overview = null;
    this.selectedOptions = {};
  }

  private async loadOverview(familyId: number): Promise<void> {
    if (this.warehouseId == null) {
      this.overview = null;
      return;
    }
    this.overviewLoading = true;
    try {
      this.overview = await lastValueFrom(
        this.productFamilyService.getFamilyInventoryOverview(familyId, this.warehouseId),
      );
      for (const axis of this.axes) {
        const values = distinctAxisValues(this.variants, axis);
        if (values.length === 1) {
          this.selectedOptions[axis] = values[0];
        }
      }
    } catch {
      this.overview = null;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('variant_picker_load_failed'),
        life: 4000,
      });
    } finally {
      this.overviewLoading = false;
    }
  }

  variantSummary(line: ProductVariantLine | null): string {
    if (!line) {
      return '';
    }
    return line.variantSummary || getProductVariantSummary(line);
  }

  async addSelectedVariant(): Promise<void> {
    const line = this.resolvedVariant;
    if (!line?.productId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('variant_picker_select_all_axes'),
        life: 3000,
      });
      return;
    }

    const netQty = line.netAvailableQuantity ?? line.quantityAvailable ?? 0;
    if (netQty <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_quantity_insufficient'),
        life: 3000,
      });
      return;
    }

    this.addInProgress = true;
    try {
      this.productService.loadToken();
      const product = (await lastValueFrom(this.productService.getProduct(line.productId))) as Product;
      const available = getAvailableQuantity(product);
      if (available <= 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('product_quantity_insufficient'),
          life: 3000,
        });
        return;
      }
      this.productSelected.emit(product);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('variant_picker_added', {
          reference: product.reference,
          variant: this.variantSummary(line),
        }),
        life: 2500,
      });
      this.selectedOptions = {};
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('variant_picker_resolve_failed'),
        life: 4000,
      });
    } finally {
      this.addInProgress = false;
    }
  }
}
