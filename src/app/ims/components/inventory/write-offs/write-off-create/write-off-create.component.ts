import { Component, OnInit, OnChanges, OnDestroy, SimpleChanges, Input, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { InventoryWriteOff, WriteOffSourceType, CreateWriteOffRequest } from 'src/app/models/write-off';
import { WriteOffService } from 'src/app/services/write-off.service';
import { ProductService } from 'src/app/services/product.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Product } from 'src/app/models/product';
import { Warehouse } from 'src/app/models/warehouse';
import { ProductBatch } from 'src/app/models/productBatch';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { firstValueFrom, combineLatest, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-write-off-create',
  templateUrl: './write-off-create.component.html',
  styleUrls: ['./write-off-create.component.css', '../write-offs.component.css']
})
export class WriteOffCreateComponent implements OnInit, OnChanges, OnDestroy {
  writeOffForm!: FormGroup;
  isSubmitting: boolean = false;

  @Input() visible: boolean = false;
  /** Mirrors global `writeoff.auto.approve === false` from parent (manual approval workflow). */
  @Input() manualApprovalWorkflowHint: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() writeOffCreated = new EventEmitter<void>();
  
  // Dropdowns
  products: Product[] = [];
  productSuggestions: Product[] = [];
  productSuggestionsLoading: boolean = false;
  warehouses: Warehouse[] = [];
  /** Options for the warehouse dropdown (all warehouses for admins; assigned only for restricted users). */
  warehousesForDropdown: Warehouse[] = [];
  batches: ProductBatch[] = [];
  conditionOptions: any[] = [];
  sourceTypeOptions: any[] = [];
  
  // Selected product
  selectedProduct: Product | null = null;
  selectedWarehouse: Warehouse | null = null;
  selectedBatch: ProductBatch | null = null;
  loadingBatches: boolean = false;
  private latestProductSuggestionToken = 0;
  
  // Permissions
  canCreateWriteOff: boolean = false;
  resource: string = 'INVENTORY_WRITE_OFFS';
  isAdmin: boolean = false;
  /** Keycloak user attribute `warehouse` (see user administration). */
  userAssignedWarehouseId: number | null = null;
  
  // Currency
  currency: string = 'USD';
  
  // Subscription management
  private destroy$ = new Subject<void>();

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
    private configService: AppConfigurationService,
    private cdr: ChangeDetectorRef
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

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && changes['visible'].currentValue === true) {
      // Reset form and component state when dialog opens
      // Only reset if this is a change from false to true (not initial creation)
      if (changes['visible'].previousValue === false || changes['visible'].previousValue === undefined) {
        this.resetComponentState();
        this.applyDefaultWarehouseOnOpen();
      }
    }
  }

  private resetComponentState() {
    // Reset selected items
    this.selectedProduct = null;
    this.selectedWarehouse = null;
    this.selectedBatch = null;

    // Reset validation state
    this.isSubmitting = false;

    // Clear batches since they depend on warehouse selection
    this.batches = [];
    this.productSuggestions = [];
    this.productSuggestionsLoading = false;

    // Reset form if it exists
    if (this.writeOffForm) {
      this.writeOffForm.reset({
        quantity: 1,
        sourceType: 'MANUAL_ADJUSTMENT',
        notes: ''
      });
      this.syncWarehouseSelectionDisabledState();

      // Reset form validation state
      Object.keys(this.writeOffForm.controls).forEach(key => {
        const control = this.writeOffForm.get(key);
        if (control) {
          control.setErrors(null);
          control.markAsUntouched();
          control.markAsPristine();
        }
      });
    }
  }

  async setPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      this.userAssignedWarehouseId = this.parseAssignedWarehouseIdFromProfile(profile);
      const roles = await this.keycloakService.getUserRoles();
      this.isAdmin = roles.includes('ADMIN');
      await this.permissionService.init(userId).toPromise();
      this.canCreateWriteOff = this.permissionService.canCreate(this.resource);
      this.syncWarehouseSelectionDisabledState();
      
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

  private parseAssignedWarehouseIdFromProfile(profile: KeycloakProfile): number | null {
    const attrs = profile?.attributes as Record<string, string[]> | undefined;
    if (!attrs) return null;
    const raw = attrs['warehouse']?.[0];
    if (raw == null || String(raw).trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  get isWarehouseSelectionLocked(): boolean {
    return !this.isAdmin && this.userAssignedWarehouseId != null;
  }

  private syncWarehouseSelectionDisabledState(): void {
    const warehouseControl = this.writeOffForm?.get('warehouseId');
    if (!warehouseControl) {
      return;
    }

    if (this.isWarehouseSelectionLocked) {
      warehouseControl.disable({ emitEvent: false });
    } else {
      warehouseControl.enable({ emitEvent: false });
    }
  }

  private rebuildWarehousesForDropdown(): void {
    if (this.isAdmin || this.userAssignedWarehouseId == null) {
      this.warehousesForDropdown = [...this.warehouses];
    } else {
      this.warehousesForDropdown = this.warehouses.filter(
        (w) => Number(w.warehouseId) === Number(this.userAssignedWarehouseId)
      );
    }
  }

  initForm() {
    this.writeOffForm = this.fb.group({
      productId: [{value: null, disabled: true}, Validators.required], // Will store the product object, not just ID - disabled by default
      warehouseId: [null, Validators.required],
      batchId: [null],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      condition: [null, Validators.required],
      sourceType: ['MANUAL_ADJUSTMENT'], // Optional, defaults to MANUAL_ADJUSTMENT
      reason: [''], // Optional, max 500 chars
      notes: [''] // Optional
    });
    
    // Set up subscription to manage productId disabled state
    this.setupProductIdDisabledState();
  }
  
  private setupProductIdDisabledState() {
    // Watch warehouseId value changes
    this.writeOffForm.get('warehouseId')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Use setTimeout to avoid change detection errors
        setTimeout(() => {
          this.updateProductIdDisabledState();
        }, 0);
      });
    
    // Initial state update
    setTimeout(() => {
      this.updateProductIdDisabledState();
    }, 0);
  }
  
  private updateProductIdDisabledState() {
    const warehouseId = this.writeOffForm.get('warehouseId')?.value;
    const shouldDisable = !warehouseId || this.productSuggestionsLoading;
    
    const productIdControl = this.writeOffForm.get('productId');
    if (productIdControl) {
      if (shouldDisable) {
        if (!productIdControl.disabled) {
          productIdControl.disable({ emitEvent: false });
        }
      } else {
        if (productIdControl.disabled) {
          productIdControl.enable({ emitEvent: false });
        }
      }
    }
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
        { label: translations['write_off_source_type_order_return'] || 'ORDER_RETURN', value: 'ORDER_RETURN' },
        { label: translations['write_off_source_type_purchase_return'] || 'PURCHASE_RETURN', value: 'PURCHASE_RETURN' },
        { label: translations['write_off_source_type_expiration'] || 'EXPIRATION', value: 'EXPIRATION' },
        { label: translations['write_off_source_type_damage_incident'] || 'DAMAGE_INCIDENT', value: 'DAMAGE_INCIDENT' },
        { label: translations['write_off_source_type_theft'] || 'THEFT', value: 'THEFT' },
        { label: translations['write_off_source_type_quality_control'] || 'QUALITY_CONTROL', value: 'QUALITY_CONTROL' }
      ];
    });
  }

  async loadInitialData() {
    await this.loadWarehouses();
  }

  async loadWarehouses() {
    try {
      this.warehouseService.getWarehouses().subscribe({
        next: (response: any) => {
          const warehousesList = Array.isArray(response) ? response : (response || []);
          this.warehouses = warehousesList;
          this.rebuildWarehousesForDropdown();
          if (this.visible) {
            this.applyDefaultWarehouseOnOpen();
          }
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

  /**
   * Preselect warehouse when the dialog opens: assigned warehouse for restricted users,
   * otherwise the sole warehouse if only one exists.
   */
  private applyDefaultWarehouseOnOpen(): void {
    const currentWarehouseId = this.writeOffForm.get('warehouseId')?.value;
    if (currentWarehouseId) {
      return;
    }

    let warehouse: Warehouse | null = null;

    if (this.isWarehouseSelectionLocked && this.userAssignedWarehouseId != null) {
      warehouse =
        this.warehouses.find((w) => Number(w.warehouseId) === Number(this.userAssignedWarehouseId)) || null;
    } else if (this.warehouses?.length === 1) {
      const w = this.warehouses[0];
      warehouse = w?.warehouseId != null ? w : null;
    }

    if (!warehouse?.warehouseId) {
      return;
    }

    this.writeOffForm.patchValue({ warehouseId: warehouse.warehouseId });
    this.selectedWarehouse = warehouse;

    setTimeout(() => {
      if (this.writeOffForm.get('warehouseId')?.value) {
        this.filterProducts({ query: '' });
      }
      this.updateProductIdDisabledState();
    }, 100);

    const productValue = this.writeOffForm.get('productId')?.value;
    if (productValue) {
      const productId =
        typeof productValue === 'object' && productValue.productId ? productValue.productId : productValue;
      if (productId) {
        this.loadBatches();
      }
    }
  }

  onProductChange(event?: any) {
    // Handle onClear event (when product is cleared)
    if (event === undefined || event === null || (event && !event.value)) {
      this.selectedProduct = null;
      this.selectedBatch = null;
      this.batches = [];
      return;
    }
    
    // Get the selected product from the event
    let productValue: any;
    if (event && event.value) {
      // Event from onSelect contains the selected product
      productValue = event.value;
    } else {
      // Fallback to form value
      productValue = this.writeOffForm.get('productId')?.value;
    }
    
    if (productValue) {
      // Autocomplete returns the full product object when [field] is not set
      const product = typeof productValue === 'object' ? productValue : 
                     this.productSuggestions.find(p => p.productId === productValue);
      
      if (product && product.productId) {
        this.selectedProduct = product;
        // Ensure the form control has the full product object
        this.writeOffForm.patchValue({ productId: product }, { emitEvent: false });
        this.writeOffForm.patchValue({ batchId: null }, { emitEvent: false });
        this.selectedBatch = null;
        this.batches = [];
        
        // Load batches if product and warehouse are selected
        if (this.selectedProduct && this.writeOffForm.get('warehouseId')?.value) {
          this.loadBatches();
        }
      } else {
        this.selectedProduct = null;
      }
    } else {
      // Product was cleared
      this.selectedProduct = null;
      this.selectedBatch = null;
      this.batches = [];
    }
  }

  onWarehouseChange() {
    const warehouseId = this.writeOffForm.get('warehouseId')?.value;
    if (warehouseId) {
      this.selectedWarehouse = this.warehouses.find(w => w.warehouseId === warehouseId) || null;
      // Clear product selection when warehouse changes
      this.writeOffForm.patchValue({ productId: null });
      this.selectedProduct = null;
      this.writeOffForm.patchValue({ batchId: null });
      this.selectedBatch = null;
      this.batches = [];
      this.productSuggestions = [];
    } else {
      this.selectedWarehouse = null;
      this.selectedProduct = null;
      this.selectedBatch = null;
      this.batches = [];
      this.productSuggestions = [];
    }
    // Update productId disabled state when warehouse changes (use setTimeout to avoid change detection errors)
    setTimeout(() => {
      this.updateProductIdDisabledState();
    }, 0);
  }

  /**
   * Quantity still available to write off (prefers net when API sends it).
   */
  private getAvailableQuantityForWriteOff(p: Product): number {
    const toNum = (v: unknown): number => {
      if (v == null || v === '') return NaN;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    };
    const net = toNum(p.netAvailableQuantity);
    if (!Number.isNaN(net)) {
      return net;
    }
    const qty = toNum(p.quantityAvailable);
    return Number.isNaN(qty) ? 0 : qty;
  }

  private hasAvailableStockForWriteOff(p: Product): boolean {
    return this.getAvailableQuantityForWriteOff(p) > 0;
  }

  /**
   * Filter products for autocomplete - only shows products from selected warehouse
   */
  filterProducts(event: any): void {
    const warehouseId = this.writeOffForm.get('warehouseId')?.value;
    if (!warehouseId) {
      this.productSuggestions = [];
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_warehouse_first') || 'Please select a warehouse first',
        life: 3000
      });
      return;
    }

    const query = (event?.query || '').trim();
    const requestToken = ++this.latestProductSuggestionToken;

    // Defer loading state change to avoid change detection error
    Promise.resolve().then(() => {
      this.productSuggestionsLoading = true;
      setTimeout(() => {
        this.updateProductIdDisabledState();
      }, 0);
    });

    // Load products from the selected warehouse
    this.warehouseService.loadToken();
    this.warehouseService.getProductsByWarehouse(warehouseId).subscribe({
      next: (response: any) => {
        // Check if this is still the latest request
        if (requestToken !== this.latestProductSuggestionToken) {
          return;
        }

        const productsList = Array.isArray(response) ? response : (response?.content || []);
        // Physical products only, with stock to write off
        let filteredProducts = productsList.filter((p: Product) => p.productType !== 'SERVICE');
        filteredProducts = filteredProducts.filter((p: Product) => this.hasAvailableStockForWriteOff(p));

        // Apply search query filter if provided
        if (query) {
          const queryLower = query.toLowerCase();
          filteredProducts = filteredProducts.filter((p: Product) => 
            (p.name && p.name.toLowerCase().includes(queryLower)) ||
            (p.reference && p.reference.toLowerCase().includes(queryLower))
          );
        }

        this.productSuggestions = filteredProducts;
        
        // Defer loading state change to avoid change detection error
        Promise.resolve().then(() => {
          this.productSuggestionsLoading = false;
          setTimeout(() => {
            this.updateProductIdDisabledState();
          }, 0);
        });
      },
      error: (error: any) => {
        console.error('Error loading products for warehouse:', error);
        
        // Check if this is still the latest request
        if (requestToken !== this.latestProductSuggestionToken) {
          return;
        }

        this.productSuggestions = [];
        // Defer loading state change to avoid change detection error
        Promise.resolve().then(() => {
          this.productSuggestionsLoading = false;
          setTimeout(() => {
            this.updateProductIdDisabledState();
          }, 0);
        });
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_products'),
          life: 3000
        });
      }
    });
  }

  async loadBatches() {
    const productValue = this.writeOffForm.get('productId')?.value;
    if (!productValue) return;

    // Extract productId from product object or use the value directly if it's already an ID
    const productId = typeof productValue === 'object' && productValue.productId 
      ? productValue.productId 
      : productValue;

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
      return this.getAvailableQuantityForWriteOff(this.selectedProduct);
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

    // Validate required fields
    if (!this.selectedProduct || !this.selectedProduct.productId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('product_required') || 'Product is required',
        life: 3000
      });
      return;
    }

    if (!this.selectedWarehouse || !this.selectedWarehouse.warehouseId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('warehouse_required') || 'Warehouse is required',
        life: 3000
      });
      return;
    }

    this.isSubmitting = true;

    try {
      const formValue = this.writeOffForm.value;
      
      // Ensure we have the productId - try multiple ways to get it
      let productId: number | undefined;
      if (this.selectedProduct?.productId) {
        productId = this.selectedProduct.productId;
      } else {
        // Fallback: try to get from form value
        const productValue = formValue.productId;
        if (typeof productValue === 'object' && productValue?.productId) {
          productId = productValue.productId;
        } else if (typeof productValue === 'number') {
          productId = productValue;
        }
      }

      // Ensure we have the warehouseId
      let warehouseId: number | undefined;
      if (this.selectedWarehouse?.warehouseId) {
        warehouseId = this.selectedWarehouse.warehouseId;
      } else {
        warehouseId = formValue.warehouseId;
      }

      if (!productId) {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_required') || 'Product is required',
          life: 3000
        });
        return;
      }

      if (!warehouseId) {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('warehouse_required') || 'Warehouse is required',
          life: 3000
        });
        return;
      }

      if (
        !this.isAdmin &&
        this.userAssignedWarehouseId != null &&
        Number(warehouseId) !== Number(this.userAssignedWarehouseId)
      ) {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('write_off_assigned_warehouse_only'),
          life: 3000
        });
        return;
      }
      
      // Build request according to new API structure
      const request: CreateWriteOffRequest = {
        productId: productId,
        warehouseId: warehouseId,
        quantity: formValue.quantity,
        condition: formValue.condition,
        sourceType: formValue.sourceType || 'MANUAL_ADJUSTMENT',
        reason: formValue.reason || undefined,
        notes: formValue.notes || undefined
      };

      // Add batchId if a batch is selected
      if (this.selectedBatch && this.selectedBatch.batchId) {
        request.batchId = this.selectedBatch.batchId;
      }

      console.log('Creating write-off with request:', request);

      const response = await firstValueFrom(await this.writeOffService.createWriteOff(request));
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('write_off_created_successfully') || 'Write-off created successfully',
        life: 3000
      });

      this.writeOffCreated.emit();
      this.visibleChange.emit(false);
    } catch (error: any) {
      console.error('Error creating write-off:', error);
      this.isSubmitting = false;
      
      // Handle specific error messages from backend
      let errorMessage = this.translate.instant('error_creating_write_off') || 'Error creating write-off';
      
      if (error?.error?.message) {
        errorMessage = error.error.message;
      } else if (error?.status === 400) {
        errorMessage = this.translate.instant('validation_error') + ': ' + (error?.error?.message || 'Invalid data');
      } else if (error?.status === 404) {
        errorMessage = error?.error?.message || this.translate.instant('product_or_warehouse_not_found') || 'Product or warehouse not found';
      }
      
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
    this.visibleChange.emit(false);
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.writeOffForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  getSelectedProductDisplay(): string {
    const product = this.getSelectedProductForDisplay();
    if (!product) return '';
    return product.name + (product.reference ? ` (${product.reference})` : '');
  }
  
  getSelectedProductForDisplay(): Product | null {
    // First check selectedProduct
    if (this.selectedProduct && this.selectedProduct.name) {
      return this.selectedProduct;
    }
    
    // Fallback to form value
    const productValue = this.writeOffForm.get('productId')?.value;
    if (productValue && typeof productValue === 'object' && productValue.name) {
      // Update selectedProduct if it's not set
      if (!this.selectedProduct) {
        this.selectedProduct = productValue;
      }
      return productValue;
    }
    
    return null;
  }
  
  onProductInputFocus() {
    // When input is focused, ensure the form control value is properly set
    // This prevents showing [object Object] when the field is focused
    const productValue = this.writeOffForm.get('productId')?.value;
    if (productValue && typeof productValue === 'object') {
      // The overlay will handle the display, input stays transparent
      // We just need to ensure selectedProduct is set
      if (!this.selectedProduct && productValue.name) {
        this.selectedProduct = productValue;
      }
    }
  }
  
  onProductInputBlur() {
    // When input loses focus, ensure selectedProduct is synced with form value
    const productValue = this.writeOffForm.get('productId')?.value;
    if (productValue && typeof productValue === 'object' && productValue.name) {
      this.selectedProduct = productValue;
    } else if (!productValue) {
      this.selectedProduct = null;
    }
  }
  
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

