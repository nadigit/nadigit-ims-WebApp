import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { Product } from 'src/app/models/product';
import { Category } from 'src/app/models/category';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { MeasureUnit } from 'src/app/enums/measure-condition.enum';
import { ProductService } from 'src/app/services/product.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit, OnChanges {
  @Input() product: Product = {};
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Input() categories: Category[] = [];
  @Input() suppliers: Supplier[] = [];
  @Input() warehouses: Warehouse[] = [];
  @Input() currency: string = 'USD';
  @Input() isAdmin: boolean = false;
  @Input() canAddCategory: boolean = false;
  @Input() canAddSupplier: boolean = false;
  @Input() canAddWarehouse: boolean = false;
  @Input() existingProducts: Product[] = []; // For duplicate checking

  @Output() saveSuccess = new EventEmitter<Product>(); // Emitted when save is successful
  @Output() saveError = new EventEmitter<any>(); // Emitted when save fails
  @Output() cancel = new EventEmitter<void>();
  @Output() categoryAdd = new EventEmitter<void>();
  @Output() supplierAdd = new EventEmitter<void>();
  @Output() warehouseAdd = new EventEmitter<void>();

  submitted: boolean = false;
  uploadedFile: File | null = null;
  imagePreviewUrl: string | null = null;
  isImageLoading: boolean = false;
  isDragOver: boolean = false;
  imageZoomDialog: boolean = false;
  recentProductImages: string[] = [];
  isSaving: boolean = false;
  uploadProgress: number = 0;
  existingImageFile: any = null;

  measureUnits: any[] = [];
  attributeTypes: any[] = [];
  costingMethods: any[] = [];
  effectiveCostingMethodLabel = '';
  isCostingMethodNone: boolean = false;

  localProduct: Product = {};

  constructor(
    private storage: AngularFireStorage,
    private translate: TranslateService,
    private messageService: MessageService,
    private productService: ProductService
  ) {
    this.initializeOptions();
  }

  ngOnInit(): void {
    this.loadRecentImages();
    if (this.product) {
      this.localProduct = { ...this.product };
      this.updateEffectiveCostingMethodLabel();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product']) {
      // Only initialize if dialog is visible (to avoid resetting user selections)
      if (this.visible) {
        this.initializeProduct();
      }
    }
    if (changes['visible']) {
      if (this.visible) {
        // When dialog opens, ensure product is initialized
        // Only reset uploadedFile if user hasn't selected a new file
        this.initializeProduct();
      } else {
        // When dialog closes, reset form
        this.resetForm();
      }
    }
  }

  private initializeProduct(): void {
    if (this.product && Object.keys(this.product).length > 0) {
      // Deep copy to ensure we have a fresh object with all properties
      this.localProduct = { ...this.product };
      
      // Preserve productId when editing
      if (this.product.productId) {
        this.localProduct.productId = this.product.productId;
      }
      
      // Ensure nested objects are also copied
      if (this.product.category) {
        this.localProduct.category = { ...this.product.category };
      }
      if (this.product.supplier) {
        this.localProduct.supplier = { ...this.product.supplier };
      }
      if (this.product.warehouse) {
        this.localProduct.warehouse = { ...this.product.warehouse };
      }
      if (this.product.attributes && Array.isArray(this.product.attributes)) {
        this.localProduct.attributes = this.product.attributes.map(attr => ({
          ...attr,
          value: attr.value !== undefined ? attr.value :
            attr.stringValue ?? attr.intValue ?? attr.doubleValue ?? attr.booleanValue ?? ''
        }));
      }
      
      // Preserve other important fields
      if (this.product.measureUnit) {
        this.localProduct.measureUnit = this.product.measureUnit;
      }
      if (this.product.costingMethod !== undefined) {
        this.localProduct.costingMethod = this.product.costingMethod;
      }
      if (this.product.standardCost !== undefined) {
        this.localProduct.standardCost = this.product.standardCost;
      }
      
      this.updateEffectiveCostingMethodLabel();
      
      // Reset image preview when loading existing product with image
      // Only reset if user hasn't already selected a new file
      if (this.product.productImage && !this.uploadedFile) {
        this.imagePreviewUrl = null;
        this.uploadedFile = null;
        this.isImageLoading = false;
        // Ensure productImage is set on localProduct
        this.localProduct.productImage = this.product.productImage;
      }
    } else {
      this.localProduct = {};
    }
  }

  private initializeOptions(): void {
    this.measureUnits = [
      { value: 'UNIT', label: this.translate.instant('UNIT') },
      { value: 'KG', label: this.translate.instant('KG') },
      { value: 'LITER', label: this.translate.instant('LITER') },
      { value: 'PIECE', label: this.translate.instant('PIECE') },
      { value: 'BOX', label: this.translate.instant('BOX') },
      { value: 'METER', label: this.translate.instant('METER') }
    ];
    this.attributeTypes = [
      { label: this.translate.instant('String'), value: 'STRING' },
      { label: this.translate.instant('Integer'), value: 'INTEGER' },
      { label: this.translate.instant('Double'), value: 'DOUBLE' },
      { label: this.translate.instant('Boolean'), value: 'BOOLEAN' }
    ];
    this.costingMethods = [
      { label: this.translate.instant('costing_method_fifo'), value: 'FIFO' },
      { label: this.translate.instant('costing_method_lifo'), value: 'LIFO' },
      { label: this.translate.instant('costing_method_weighted_average'), value: 'WEIGHTED_AVERAGE' },
      { label: this.translate.instant('costing_method_standard_cost'), value: 'STANDARD_COST' },
      { label: this.translate.instant('costing_method_none'), value: 'NONE' }
    ];
  }

  private loadRecentImages(): void {
    const stored = localStorage.getItem('recentProductImages');
    if (stored) {
      try {
        this.recentProductImages = JSON.parse(stored);
      } catch (e) {
        this.recentProductImages = [];
      }
    }
  }

  resetForm(): void {
    this.submitted = false;
    this.uploadedFile = null;
    this.imagePreviewUrl = null;
    this.isImageLoading = false;
    this.isDragOver = false;
    this.uploadProgress = 0;
    this.existingImageFile = null;
  }

  resetScanning(): void {
    this.resetForm();
  }

  updateEffectiveCostingMethodLabel(): void {
    if (this.localProduct.costingMethod) {
      const method = this.costingMethods.find(m => m.value === this.localProduct.costingMethod);
      this.effectiveCostingMethodLabel = this.translate.instant('product_costing_method') + ': ' + (method?.label || this.localProduct.costingMethod);
      this.isCostingMethodNone = this.localProduct.costingMethod === 'NONE';
    } else if (this.localProduct.category?.costingMethod && this.localProduct.category.costingMethod !== 'NONE') {
      const method = this.costingMethods.find(m => m.value === this.localProduct.category?.costingMethod);
      this.effectiveCostingMethodLabel = this.translate.instant('inherited_from_category') + ': ' + (method?.label || this.localProduct.category.costingMethod);
      this.isCostingMethodNone = false;
    } else if (this.localProduct.warehouse?.organization?.costingMethod && this.localProduct.warehouse.organization.costingMethod !== 'NONE') {
      const method = this.costingMethods.find(m => m.value === this.localProduct.warehouse?.organization?.costingMethod);
      this.effectiveCostingMethodLabel = this.translate.instant('inherited_from_organization') + ': ' + (method?.label || this.localProduct.warehouse.organization.costingMethod);
      this.isCostingMethodNone = false;
    } else {
      this.effectiveCostingMethodLabel = this.translate.instant('costing_method_none');
      this.isCostingMethodNone = true;
    }
  }

  isStandardCostRequired(): boolean {
    return this.localProduct.costingMethod === 'STANDARD_COST';
  }

  async onFileUpload(event: any): Promise<void> {
    const file = event.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_image_format'),
        life: 3000,
      });
      return;
    }

    if (file.size > 5000000) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('image_too_large'),
        life: 3000,
      });
      return;
    }

    this.isImageLoading = true;
    this.imagePreviewUrl = URL.createObjectURL(file);
    this.uploadedFile = file;

    setTimeout(() => {
      if (this.isImageLoading) this.isImageLoading = false;
    }, 2000);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      this.onFileUpload({ files: [file] });
    }
  }

  onImageError(): void {
    this.isImageLoading = false;
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: this.translate.instant('image_load_error'),
      life: 3000,
    });
    this.imagePreviewUrl = null;
    this.localProduct.productImage = 'assets/core-images/no-image.png';
  }

  zoomImage(): void {
    this.imageZoomDialog = true;
  }

  editImage(): void {
    this.localProduct.productImage = null;
    this.uploadedFile = null;
    this.imagePreviewUrl = null;
  }

  removeImage(): void {
    this.localProduct.productImage = null;
    this.uploadedFile = null;
    this.imagePreviewUrl = null;
    this.existingImageFile = null;
  }

  selectRecentImage(imageUrl: string): void {
    this.localProduct.productImage = imageUrl;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
  }

  addAttribute(): void {
    if (!this.localProduct.attributes) {
      this.localProduct.attributes = [];
    }
    this.localProduct.attributes.push({
      attributeName: '',
      attributeType: 'STRING',
      value: ''
    });
  }

  removeAttribute(index: number): void {
    if (this.localProduct.attributes && this.localProduct.attributes.length > index) {
      this.localProduct.attributes.splice(index, 1);
    }
  }

  openCategoryDialog(): void {
    this.categoryAdd.emit();
  }

  openSupplierDialog(): void {
    this.supplierAdd.emit();
  }

  openWarehouseDialog(): void {
    this.warehouseAdd.emit();
  }

  async saveProduct(): Promise<void> {
    this.submitted = true;

    if (
      !this.localProduct.name ||
      !this.localProduct.reference ||
      !this.localProduct.buyingPrice ||
      !this.localProduct.sellingPrice ||
      !this.localProduct.category ||
      !this.localProduct.supplier
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3100,
      });
      return;
    }

    if (this.isAdmin && !this.localProduct.warehouse) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('warehouse_required'),
        life: 3000,
      });
      return;
    }

    // Check for duplicate product
    if (this.existingProducts && this.existingProducts.length > 0) {
      const isDuplicate = this.existingProducts.some(p =>
        p.reference === this.localProduct.reference &&
        p.warehouse?.warehouseId === this.localProduct.warehouse?.warehouseId &&
        p.productId !== this.localProduct.productId
      );

      if (isDuplicate) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('product_already_exists_in_warehouse'),
          life: 4000,
        });
        return;
      }
    }

    // Upload image if a new file was selected
    if (this.uploadedFile) {
      this.isSaving = true;
      try {
        const filePath = `images/${Date.now()}_${this.uploadedFile.name}`;
        const fileRef = this.storage.ref(filePath);
        const task = this.storage.upload(filePath, this.uploadedFile);

        task.percentageChanges().subscribe(percentage => {
          this.uploadProgress = percentage || 0;
        });

        await lastValueFrom(task.snapshotChanges());
        const url = await lastValueFrom(fileRef.getDownloadURL());
        this.localProduct.productImage = url;
        this.addToRecentImages(url);
      } catch (error) {
        console.error('Error uploading file:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_uploading_image'),
          life: 3000,
        });
        this.isSaving = false;
        return;
      } finally {
        this.uploadedFile = null;
        this.uploadProgress = 0;
        this.isSaving = false;
      }
    }

    // Clean attributes before saving (same as legacy method)
    if (this.localProduct.attributes && this.localProduct.attributes.length > 0) {
      this.localProduct.attributes.forEach(attr => {
        // strip transient field if it still exists
        delete attr.value;
        // optionally normalize booleans (Angular checkboxes can send null)
        if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
          attr.booleanValue = false;
        }
      });
    }

    // For updates, merge original product data with local changes to ensure all fields are preserved
    let productToSave: any;
    if (this.localProduct.productId && this.product?.productId) {
      // Merge original product with local changes - backend needs ALL fields
      productToSave = {
        ...this.product,  // Start with original product to preserve all fields
        ...this.localProduct,  // Override with user changes
        // Ensure productId is preserved and is a number
        productId: Number(this.localProduct.productId),
        // Ensure nested objects are properly included
        category: this.localProduct.category || this.product.category,
        supplier: this.localProduct.supplier || this.product.supplier,
        warehouse: this.localProduct.warehouse || this.product.warehouse,
        // Ensure attributes are from localProduct (already cleaned)
        attributes: this.localProduct.attributes || this.product.attributes,
      };
    } else {
      // For new products, use localProduct as-is
      productToSave = { ...this.localProduct };
    }

    // Ensure productId is a number for updates
    if (productToSave.productId) {
      productToSave.productId = Number(productToSave.productId);
    }

    console.log('=== SAVE PRODUCT DEBUG ===');
    console.log('Original product:', this.product);
    console.log('Local product (user changes):', this.localProduct);
    console.log('Product to save (merged):', productToSave);
    console.log('Product ID:', productToSave.productId);
    console.log('===========================');
    
    // Save the product directly in the form component
    this.isSaving = true;
    
    try {
      // Use saveProduct for both create and update (matching warehouse details behavior)
      await this.saveProductToBackend(productToSave);
      
      if (productToSave.productId) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('product_updated'),
          life: 3000,
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('product_added'),
          life: 3000,
        });
      }
      
      this.saveSuccess.emit(productToSave);
      // Close dialog on success
      this.visible = false;
      this.visibleChange.emit(false);
      this.resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      this.saveError.emit({ product: productToSave, error });
    } finally {
      this.isSaving = false;
    }
  }

  // Save product to backend - uses saveProduct (POST) for both create and update
  // This matches the behavior in warehouse-details component
  private async saveProductToBackend(product: any): Promise<void> {
    console.log('=== SAVE PRODUCT TO BACKEND ===');
    console.log('Product data being sent:', JSON.stringify(product, null, 2));
    console.log('Product ID:', product.productId);
    console.log('==============================');
    
    return new Promise<void>((resolve, reject) => {
      this.productService.saveProduct(product)
        .subscribe({
          next: (response: any) => {
            console.log('=== SAVE PRODUCT SUCCESS ===');
            console.log('Product save API response:', response);
            console.log('Response type:', typeof response);
            console.log('============================');
            resolve();
          },
          error: (err: any) => {
            console.error('=== SAVE PRODUCT ERROR ===');
            console.error('Error status:', err?.status);
            console.error('Error statusText:', err?.statusText);
            console.error('Error body:', err?.error);
            console.error('Error message:', err?.message);
            console.error('Full error:', err);
            console.error('==========================');
            
            const errorMessage = err?.error?.message || 
                                err?.error?.error || 
                                err?.message || 
                                (product.productId 
                                  ? this.translate.instant('error_while_updating_product')
                                  : this.translate.instant('error_while_adding_product'));

            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: errorMessage,
              life: 5000
            });
            reject(err);
          },
        });
    });
  }

  cancelForm(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.cancel.emit();
  }

  onDialogHide(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.resetScanning();
  }

  private addToRecentImages(imageUrl: string): void {
    this.recentProductImages = [imageUrl, ...this.recentProductImages].slice(0, 6);
    localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
  }
}

