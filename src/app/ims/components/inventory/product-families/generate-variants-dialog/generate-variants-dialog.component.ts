import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { lastValueFrom } from 'rxjs';
import { Warehouse } from 'src/app/models/warehouse';
import { GenerateProductVariantsRequest, ProductFamily } from 'src/app/models/product-family';
import { ProductFamilyService } from 'src/app/services/product-family.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-generate-variants-dialog',
  templateUrl: './generate-variants-dialog.component.html',
  styleUrls: ['./generate-variants-dialog.component.css'],
})
export class GenerateVariantsDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() family: ProductFamily | null = null;
  @Input() warehouses: Warehouse[] = [];
  @Input() currency = 'USD';

  @Output() generated = new EventEmitter<void>();

  warehouseId: number | null = null;
  sellingPrice = 0;
  buyingPrice = 0;
  initialQuantity = 0;
  axisValues: Record<string, string> = {};
  axisNewValue: Record<string, string> = {};
  isSaving = false;
  submitted = false;
  isAdmin = false;

  constructor(
    private productFamilyService: ProductFamilyService,
    private messageService: MessageService,
    private translate: TranslateService,
    private keycloakService: KeycloakService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue || changes['family']) {
      void this.initAdminAndReset();
    }
  }

  private async initAdminAndReset(): Promise<void> {
    const roles = await this.keycloakService.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    this.reset();
  }

  get axes(): string[] {
    return this.family?.variantAxes ?? [];
  }

  getValuesForAxis(axis: string): string[] {
    const raw = this.axisValues[axis] ?? '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  addValueToAxis(axis: string): void {
    const v = (this.axisNewValue[axis] ?? '').trim();
    if (!v) {
      return;
    }
    const existing = this.getValuesForAxis(axis);
    if (existing.some((e) => e.toLowerCase() === v.toLowerCase())) {
      this.axisNewValue[axis] = '';
      return;
    }
    const next = [...existing, v];
    this.axisValues[axis] = next.join(', ');
    this.axisNewValue[axis] = '';
  }

  removeValueFromAxis(axis: string, value: string): void {
    const next = this.getValuesForAxis(axis).filter((v) => v !== value);
    this.axisValues[axis] = next.join(', ');
  }

  private reset(): void {
    this.submitted = false;
    this.sellingPrice = 0;
    this.buyingPrice = 0;
    this.initialQuantity = 0;
    this.axisValues = {};
    this.axisNewValue = {};
    for (const axis of this.axes) {
      this.axisValues[axis] = '';
      this.axisNewValue[axis] = '';
    }
    if (this.warehouses.length === 1) {
      this.warehouseId = this.warehouses[0].warehouseId ?? null;
    } else {
      this.warehouseId = null;
    }
  }

  hide(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  buildOptionValues(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const axis of this.axes) {
      result[axis] = this.getValuesForAxis(axis);
    }
    return result;
  }

  expectedCombinationCount(): number {
    let count = 1;
    for (const axis of this.axes) {
      const n = this.getValuesForAxis(axis).length;
      if (n === 0) {
        return 0;
      }
      count *= n;
    }
    return count;
  }

  async generate(): Promise<void> {
    this.submitted = true;
    if (!this.family?.productFamilyId) {
      return;
    }
    if (!this.family.supplierId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_family_supplier_required_for_variants'),
        life: 5000,
      });
      return;
    }
    if (this.isAdmin && !this.warehouseId) {
      return;
    }
    if (this.sellingPrice <= 0) {
      return;
    }
    if (this.buyingPrice < 0) {
      return;
    }
    const optionValues = this.buildOptionValues();
    for (const axis of this.axes) {
      if (!optionValues[axis]?.length) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('product_family_axis_values_required', { axis }),
          life: 4000,
        });
        return;
      }
    }

    const req: GenerateProductVariantsRequest = {
      warehouseId: this.warehouseId ?? undefined,
      optionValues,
      sellingPrice: this.sellingPrice,
      buyingPrice: this.buyingPrice,
      initialQuantity: this.initialQuantity ?? 0,
    };

    this.isSaving = true;
    try {
      const res = await lastValueFrom(
        this.productFamilyService.generateVariants(this.family.productFamilyId, req),
      );
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('product_family_variants_generated', {
          created: res.createdCount,
          skipped: res.skippedCount,
        }),
        life: 5000,
      });
      this.generated.emit();
      this.hide();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: err?.error?.message || err?.message || this.translate.instant('product_family_variants_failed'),
        life: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }
}
