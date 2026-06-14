import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { lastValueFrom } from 'rxjs';
import { Category } from 'src/app/models/category';
import { Supplier } from 'src/app/models/supplier';
import {
  CreateProductFamilyRequest,
  ProductFamily,
  UpdateProductFamilyRequest,
} from 'src/app/models/product-family';
import { ProductFamilyService } from 'src/app/services/product-family.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';

@Component({
  selector: 'app-product-family-form-dialog',
  templateUrl: './product-family-form-dialog.component.html',
  styleUrls: ['./product-family-form-dialog.component.css', '../../inventory.component.css'],
})
export class ProductFamilyFormDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() family: ProductFamily | null = null;
  @Input() categories: Category[] = [];
  @Input() suppliers: Supplier[] = [];

  @Output() saved = new EventEmitter<ProductFamily>();

  submitted = false;
  isSaving = false;
  styleReference = '';
  name = '';
  description = '';
  categoryId: number | null = null;
  supplierId: number | null = null;
  productImage = '';
  variantAxesText = 'Size, Color';

  constructor(
    private productFamilyService: ProductFamilyService,
    private messageService: MessageService,
    private translate: TranslateService,
    public activityProfileService: ActivityProfileService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue || changes['family']) {
      this.resetForm();
    }
  }

  get dialogHeader(): string {
    return this.mode === 'create'
      ? this.translate.instant('product_family_create_title')
      : this.translate.instant('product_family_edit_title');
  }

  private resetForm(): void {
    this.submitted = false;
    if (this.mode === 'edit' && this.family) {
      this.styleReference = this.family.styleReference ?? '';
      this.name = this.family.name ?? '';
      this.description = this.family.description ?? '';
      this.categoryId = this.family.categoryId ?? null;
      this.supplierId = this.family.supplierId ?? null;
      this.productImage = this.family.productImage ?? '';
      this.variantAxesText = (this.family.variantAxes ?? ['Size', 'Color']).join(', ');
    } else {
      this.styleReference = '';
      this.name = '';
      this.description = '';
      this.categoryId = this.categories[0]?.categoryId ?? null;
      this.supplierId = null;
      this.productImage = '';
      this.variantAxesText = this.activityProfileService.isFashionProfile ? 'Size, Color' : 'Size, Color';
    }
  }

  hide(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  parseAxes(): string[] {
    return this.variantAxesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (!this.name?.trim() || !this.categoryId) {
      return;
    }
    if (this.mode === 'create' && !this.styleReference?.trim()) {
      return;
    }
    const axes = this.parseAxes();
    if (axes.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_family_axes_required'),
        life: 4000,
      });
      return;
    }

    this.isSaving = true;
    try {
      let saved: ProductFamily;
      if (this.mode === 'create') {
        const req: CreateProductFamilyRequest = {
          styleReference: this.styleReference.trim(),
          name: this.name.trim(),
          description: this.description?.trim() || undefined,
          categoryId: this.categoryId,
          supplierId: this.supplierId ?? undefined,
          variantAxes: axes,
          productImage: this.productImage?.trim() || undefined,
        };
        saved = await lastValueFrom(this.productFamilyService.create(req));
      } else if (this.family?.productFamilyId) {
        const req: UpdateProductFamilyRequest = {
          name: this.name.trim(),
          description: this.description?.trim() || undefined,
          categoryId: this.categoryId,
          supplierId: this.supplierId ?? undefined,
          variantAxes: axes,
          productImage: this.productImage?.trim() || undefined,
        };
        saved = await lastValueFrom(this.productFamilyService.update(this.family.productFamilyId, req));
      } else {
        return;
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('product_family_saved'),
        life: 3000,
      });
      this.saved.emit(saved);
      this.hide();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: err?.error?.message || err?.message || this.translate.instant('product_family_save_failed'),
        life: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }
}
