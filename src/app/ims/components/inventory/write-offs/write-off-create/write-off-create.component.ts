import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryWriteOff, WriteOffSourceType } from 'src/app/models/write-off';
import { WriteOffService } from 'src/app/services/write-off.service';
import { ProductService } from 'src/app/services/product.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Product } from 'src/app/models/product';
import { Warehouse } from 'src/app/models/warehouse';
import { ProductBatch } from 'src/app/models/productBatch';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-write-off-create',
  templateUrl: './write-off-create.component.html',
  styleUrls: ['./write-off-create.component.css', '../write-offs.component.css']
})
export class WriteOffCreateComponent implements OnInit {
  writeOffForm!: FormGroup;
  isSubmitting: boolean = false;
  
  // Dropdowns
  products: Product[] = [];
  warehouses: Warehouse[] = [];
  batches: ProductBatch[] = [];
  conditionOptions: any[] = [];
  sourceTypeOptions: any[] = [];
  
  // Selected product
  selectedProduct: Product | null = null;
  selectedWarehouse: Warehouse | null = null;
  selectedBatch: ProductBatch | null = null;
  loadingBatches: boolean = false;
  
  // Permissions
  canCreateWriteOff: boolean = false;
  resource: string = 'INVENTORY_WRITE_OFFS';
  
  // Currency
  currency: string = 'USD';

  constructor(
    private fb: FormBuilder,
    private writeOffService: WriteOffService,
    private productService: ProductService,
    private warehouseService: WarehouseService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private router: Router,
    private configService: AppConfigurationService
  ) {
    this.initForm();
  }

  async ngOnInit() {
    // Load currency
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    await this.configService.loadCurrencyOnce();
    
    await this.setPermissions();
    await this.initializeTranslations();
    await this.loadInitialData();
    
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });
  }

  async setPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await this.permissionService.init(userId).toPromise();
      this.canCreateWriteOff = this.permissionService.canCreate(this.resource);
      
      if (!this.canCreateWriteOff) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('access_denied_text'),
          life: 3000
        });
        this.router.navigate(['/inventory/write-offs']);
      }
    } catch (error) {
      console.error('Error setting permissions:', error);
    }
  }

  initForm() {
    this.writeOffForm = this.fb.group({
      productId: [null, Validators.required],
      warehouseId: [null, Validators.required],
      batchId: [null],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      condition: [null, Validators.required],
      sourceType: ['MANUAL_ADJUSTMENT', Validators.required],
      reason: ['', Validators.required],
      notes: ['']
    });
  }

  async initializeTranslations() {
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe((translations) => {
      this.conditionOptions = [
        { label: translations['item_condition_damaged'] || 'DAMAGED', value: 'DAMAGED' },
        { label: translations['item_condition_unusable'] || 'UNUSABLE', value: 'UNUSABLE' },
        { label: translations['item_condition_lost'] || 'LOST', value: 'LOST' },
        { label: translations['item_condition_expired'] || 'EXPIRED', value: 'EXPIRED' }
      ];
      
      this.sourceTypeOptions = [
        { label: translations['write_off_source_type_manual_adjustment'] || 'MANUAL_ADJUSTMENT', value: 'MANUAL_ADJUSTMENT' },
        { label: translations['write_off_source_type_damage_incident'] || 'DAMAGE_INCIDENT', value: 'DAMAGE_INCIDENT' },
        { label: translations['write_off_source_type_theft'] || 'THEFT', value: 'THEFT' },
        { label: translations['write_off_source_type_quality_control'] || 'QUALITY_CONTROL', value: 'QUALITY_CONTROL' }
      ];
    });
  }

  async loadInitialData() {
    await this.loadProducts();
    await this.loadWarehouses();
  }

  async loadProducts() {
    try {
      this.productService.getProductsPaginated(0, 1000).subscribe({
        next: (response: any) => {
          const productsList = Array.isArray(response) ? response : (response?.content || []);
          // Filter only physical products (not services)
          this.products = productsList.filter((p: Product) => p.productType !== 'SERVICE');
        },
        error: (err: any) => {
          console.error('Error loading products:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_products'),
            life: 3000
          });
        }
      });
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }

  async loadWarehouses() {
    try {
      this.warehouseService.getWarehouses().subscribe({
        next: (response: any) => {
          const warehousesList = Array.isArray(response) ? response : (response || []);
          this.warehouses = warehousesList;
        },
        error: (err: any) => {
          console.error('Error loading warehouses:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_warehouses'),
            life: 3000
          });
        }
      });
    } catch (error) {
      console.error('Error loading warehouses:', error);
    }
  }

  onProductChange() {
    const productId = this.writeOffForm.get('productId')?.value;
    if (productId) {
      this.selectedProduct = this.products.find(p => p.productId === productId) || null;
      this.writeOffForm.patchValue({ batchId: null });
      this.selectedBatch = null;
      this.batches = [];
      
      // Load batches if product and warehouse are selected
      if (this.selectedProduct && this.writeOffForm.get('warehouseId')?.value) {
        this.loadBatches();
      }
    } else {
      this.selectedProduct = null;
      this.selectedBatch = null;
      this.batches = [];
    }
  }

  onWarehouseChange() {
    const warehouseId = this.writeOffForm.get('warehouseId')?.value;
    if (warehouseId) {
      this.selectedWarehouse = this.warehouses.find(w => w.warehouseId === warehouseId) || null;
      this.writeOffForm.patchValue({ batchId: null });
      this.selectedBatch = null;
      this.batches = [];
      
      // Load batches if product and warehouse are selected
      if (this.selectedProduct && warehouseId) {
        this.loadBatches();
      }
    } else {
      this.selectedWarehouse = null;
      this.selectedBatch = null;
      this.batches = [];
    }
  }

  async loadBatches() {
    const productId = this.writeOffForm.get('productId')?.value;
    if (!productId) return;

    this.loadingBatches = true;
    try {
      this.productService.getProductBatches(productId).subscribe({
        next: (response: any) => {
          const batchesList = Array.isArray(response) ? response : (response || []);
          // Filter batches by warehouse if warehouse is selected
          const warehouseId = this.writeOffForm.get('warehouseId')?.value;
          if (warehouseId) {
            this.batches = batchesList.filter((b: ProductBatch) => 
              b.warehouseId === warehouseId && b.quantityAvailable > 0
            );
          } else {
            this.batches = batchesList.filter((b: ProductBatch) => b.quantityAvailable > 0);
          }
          this.loadingBatches = false;
        },
        error: (err: any) => {
          console.error('Error loading batches:', err);
          this.batches = [];
          this.loadingBatches = false;
        }
      });
    } catch (error) {
      console.error('Error loading batches:', error);
      this.loadingBatches = false;
    }
  }

  onBatchChange() {
    const batchId = this.writeOffForm.get('batchId')?.value;
    if (batchId) {
      this.selectedBatch = this.batches.find(b => b.batchId === batchId) || null;
      // Set max quantity to batch available quantity
      if (this.selectedBatch && this.selectedBatch.quantityAvailable) {
        const quantityControl = this.writeOffForm.get('quantity');
        if (quantityControl) {
          quantityControl.setValidators([
            Validators.required,
            Validators.min(0.01),
            Validators.max(this.selectedBatch.quantityAvailable)
          ]);
          quantityControl.updateValueAndValidity();
        }
      }
    } else {
      this.selectedBatch = null;
      // Reset max validator
      const quantityControl = this.writeOffForm.get('quantity');
      if (quantityControl) {
        quantityControl.setValidators([Validators.required, Validators.min(0.01)]);
        quantityControl.updateValueAndValidity();
      }
    }
  }

  getMaxQuantity(): number {
    if (this.selectedBatch) {
      return this.selectedBatch.quantityAvailable || 0;
    }
    if (this.selectedProduct) {
      return this.selectedProduct.quantityAvailable || 0;
    }
    return 0;
  }

  getEstimatedCost(): number {
    const quantity = this.writeOffForm.get('quantity')?.value || 0;
    if (this.selectedBatch && this.selectedBatch.buyingPrice) {
      return quantity * this.selectedBatch.buyingPrice;
    }
    if (this.selectedProduct && this.selectedProduct.buyingPrice) {
      return quantity * this.selectedProduct.buyingPrice;
    }
    return 0;
  }

  async onSubmit() {
    if (this.writeOffForm.invalid || !this.canCreateWriteOff) {
      this.markFormGroupTouched(this.writeOffForm);
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.writeOffForm.value;
      
      const writeOff: InventoryWriteOff = {
        product: this.selectedProduct || undefined,
        warehouse: this.selectedWarehouse || undefined,
        batch: this.selectedBatch || null,
        quantity: formValue.quantity,
        condition: formValue.condition,
        sourceType: formValue.sourceType,
        reason: formValue.reason,
        notes: formValue.notes || undefined,
        status: 'PENDING'
      };

      const response = await firstValueFrom(await this.writeOffService.createWriteOff(writeOff));
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('write_off_created_successfully') || 'Write-off created successfully',
        life: 3000
      });

      // Navigate to write-off detail page
      if (response.writeOffId) {
        this.router.navigate(['/inventory/write-offs', response.writeOffId]);
      } else {
        this.router.navigate(['/inventory/write-offs']);
      }
    } catch (error: any) {
      console.error('Error creating write-off:', error);
      this.isSubmitting = false;
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_creating_write_off') || 'Error creating write-off';
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 5000
      });
    }
  }

  markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  onCancel() {
    this.router.navigate(['/inventory/write-offs']);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.writeOffForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }
}

