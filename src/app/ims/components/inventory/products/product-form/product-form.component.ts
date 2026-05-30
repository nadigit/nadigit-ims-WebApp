import { Component, ElementRef, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { Product } from 'src/app/models/product';
import { Category } from 'src/app/models/category';
import { Supplier } from 'src/app/models/supplier';
import { Warehouse } from 'src/app/models/warehouse';
import { lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { MeasureUnit } from 'src/app/enums/measure-condition.enum';
import { ProductService } from 'src/app/services/product.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';

@Component({
  selector: 'app-product-form',
  templateUrl: './product-form.component.html',
  styleUrls: ['./product-form.component.css']
})
export class ProductFormComponent implements OnInit, OnChanges {
  @ViewChild('galleryReplaceInput') galleryReplaceInput?: ElementRef<HTMLInputElement>;
  readonly productDescriptionMaxLength = 500;

  productImages: any[] = [];
  isGalleryLoading: boolean = false;
  draggedImageId: number | null = null;
  galleryDragOverId: number | null = null;
  reorderFlashImageId: number | null = null;
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
  pendingUploadFiles: File[] = [];
  /** Blob URLs for pending (unsaved) multi-file selection — must be revoked on clear */
  pendingPreviewUrls: string[] = [];
  /** Which pending thumbnail is shown in the hero preview */
  selectedPendingIndex = 0;
  pendingDraggedIndex: number | null = null;
  pendingDragOverIndex: number | null = null;
  imagePreviewUrl: string | null = null;
  isImageLoading: boolean = false;
  isDragOver: boolean = false;
  imageZoomDialog: boolean = false;
  recentProductImages: string[] = [];
  isSaving: boolean = false;
  uploadProgress: number = 0;
  existingImageFile: any = null;

  measureUnits: any[] = [];
  measureUnitsForCurrentType: any[] = []; // Cached measure units for current product type
  attributeTypes: any[] = [];
  costingMethods: any[] = [];
  effectiveCostingMethodLabel = '';
  isCostingMethodNone: boolean = false;
  productTypeOptions: any[] = [];
  profileAwareProductTypeOptions: any[] = [];

  // Expiration date
  hasExpirationDate: boolean = false;
  expirationDateValue: Date | null = null;
  todayDate: Date = new Date();

  localProduct: Product = {};
  backendFieldErrors: Record<string, string> = {};

  constructor(
    private translate: TranslateService,
    private messageService: MessageService,
    private productService: ProductService,
    public activityProfileService: ActivityProfileService,
  ) {
    this.initializeOptions();
  }

  ngOnInit(): void {
    this.loadRecentImages();
    void this.activityProfileService.ensureLoaded().then(() => {
      this.applyProfileProductTypePolicy();
      this.applyProfileDrivenDefaultsForNewProduct();
    });
    if (this.product && Object.keys(this.product).length > 0) {
      this.localProduct = { ...this.product };
      // Ensure productType is set
      if (!this.localProduct.productType) {
        this.localProduct.productType = 'PRODUCT';
      }
      this.updateMeasureUnitsForType();
      this.updateEffectiveCostingMethodLabel();
    } else if (!this.localProduct || Object.keys(this.localProduct).length === 0) {
      // Initialize with defaults if no product provided
      this.localProduct = {
        productType: 'PRODUCT',
        quantityAvailable: 0
      };
      this.applyProfileDrivenDefaultsForNewProduct();
      this.updateMeasureUnitsForType();
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
        this.applyProfileProductTypePolicy();
        this.applyProfileDrivenDefaultsForNewProduct();
        this.applyDefaultWarehouseIfSingle();
      } else {
        // When dialog closes, reset form
        this.resetForm();
      }
    }
    // When warehouses input changes, and we are editing/creating a product, apply default if needed
    if (changes['warehouses'] && this.visible) {
      this.applyDefaultWarehouseIfSingle();
    }
  }

  /**
   * UX Helper: if there is exactly one warehouse, preselect it for products
   * Does NOT override an existing warehouse selection.
   */
  private applyDefaultWarehouseIfSingle(): void {
    if (!this.isProduct()) return;
    if (this.isAggregatedEditMode()) return;
    if (!this.warehouses || this.warehouses.length !== 1) return;
    if (this.localProduct && this.localProduct.warehouse) return;

    this.localProduct = {
      ...this.localProduct,
      warehouse: this.warehouses[0]
    };
  }

  private initializeProduct(): void {
    this.clearPendingLocalPreviews();
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
    this.isImageLoading = false;

    if (this.product && Object.keys(this.product).length > 0) {
      // Deep copy to ensure we have a fresh object with all properties
      this.localProduct = { ...this.product };
      
      // Set default productType if not set
      if (!this.localProduct.productType) {
        this.localProduct.productType = 'PRODUCT';
      }
      
      // Update measure units for the current product type
      this.updateMeasureUnitsForType();
      
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
      this.hydrateWarehouseFromAggregatedContext();
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
      
      // Initialize expiration date
      if (this.product.expirationDate) {
        this.hasExpirationDate = true;
        this.expirationDateValue = this.product.expirationDate instanceof Date 
          ? this.product.expirationDate 
          : new Date(this.product.expirationDate);
        this.localProduct.expirationDate = this.product.expirationDate;
      } else {
        this.hasExpirationDate = false;
        this.expirationDateValue = null;
        this.localProduct.expirationDate = null;
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
      if (this.localProduct.productId) {
        void this.loadProductImages(this.localProduct.productId);
      } else {
        this.productImages = [];
      }
    } else {
      this.localProduct = {
        productType: 'PRODUCT', // Default to PRODUCT
        quantityAvailable: 0 // Default quantity for products
      };
      // Initialize expiration date fields
      this.hasExpirationDate = false;
      this.expirationDateValue = null;
      this.localProduct.expirationDate = null;
      this.applyProfileDrivenDefaultsForNewProduct();
      // Update measure units for the default product type
      this.updateMeasureUnitsForType();
      this.productImages = [];
    }
  }

  private async loadProductImages(productId: number): Promise<void> {
    if (!productId) return;
    this.isGalleryLoading = true;
    try {
      this.productService.loadToken();
      const images = await lastValueFrom(this.productService.getProductImages(productId));
      const raw = Array.isArray(images) ? images : [];
      // API may return `imageId` instead of `id`; normalize so drag/reorder uses stable keys.
      this.productImages = raw.map((im: any) => {
        const idNum = Number(im?.id ?? im?.imageId);
        return {
          ...im,
          id: Number.isFinite(idNum) ? idNum : im?.id ?? im?.imageId,
        };
      });
      const primary = this.productImages.find((img: any) => !!img?.primaryImage);
      if (primary?.imageUrl) {
        this.localProduct.productImage = primary.imageUrl;
      } else if (this.productImages.length > 0) {
        this.localProduct.productImage = this.productImages[0].imageUrl;
      }
    } catch (error) {
      console.error('Error loading product gallery:', error);
      this.productImages = [];
    } finally {
      this.isGalleryLoading = false;
    }
  }

  private isAggregatedEditMode(): boolean {
    return !!this.localProduct?.productId && !!(this.product as any)?._aggregated;
  }

  private hydrateWarehouseFromAggregatedContext(): void {
    if (!this.isAggregatedEditMode() || this.localProduct.warehouse) {
      return;
    }
    const warehouseStocks = (this.product as any)?._warehouseStocks;
    if (!Array.isArray(warehouseStocks) || warehouseStocks.length === 0) {
      return;
    }
    const productId = Number(this.localProduct.productId);
    const stockForCurrentProduct =
      warehouseStocks.find((s: any) => Number(s?.productId) === productId) ?? warehouseStocks[0];
    const stockWarehouseId = Number(stockForCurrentProduct?.warehouseId);
    if (!stockWarehouseId) {
      return;
    }
    const fromKnownWarehouses = this.warehouses?.find((w) => Number(w.warehouseId) === stockWarehouseId);
    this.localProduct.warehouse = fromKnownWarehouses
      ? { ...fromKnownWarehouses }
      : { warehouseId: stockWarehouseId, name: stockForCurrentProduct?.warehouseName } as Warehouse;
  }

  private applyProfileDrivenDefaultsForNewProduct(): void {
    void this.applyProfileDrivenDefaultsForNewProductAsync();
  }

  /**
   * Waits for activity profile context (including organization defaultLocale) before applying
   * pharmacy/fashion defaults so fashion attribute titles match the organization locale.
   */
  private async applyProfileDrivenDefaultsForNewProductAsync(): Promise<void> {
    await this.activityProfileService.ensureLoaded();
    if (!this.localProduct || this.localProduct.productId || !this.isProduct()) {
      return;
    }

    if (this.activityProfileService.isPharmacyProfile) {
      this.localProduct.productType = 'PRODUCT';
      this.hasExpirationDate = true;
      if (!this.expirationDateValue) {
        this.expirationDateValue = new Date();
      }
      if (!this.localProduct.expirationDate) {
        this.localProduct.expirationDate = this.expirationDateValue;
      }
      if (!this.localProduct.costingMethod || this.localProduct.costingMethod === 'NONE') {
        this.localProduct.costingMethod = 'FIFO';
      }
    }

    if (this.activityProfileService.isFashionProfile) {
      this.ensureFashionStarterAttributes();
    }
  }

  private applyProfileProductTypePolicy(): void {
    this.profileAwareProductTypeOptions = this.productTypeOptions.map((opt) => ({
      ...opt,
      disabled: this.activityProfileService.isPharmacyProfile && opt.value === 'SERVICE',
    }));
    if (this.activityProfileService.isPharmacyProfile && this.localProduct?.productType === 'SERVICE') {
      this.localProduct.productType = 'PRODUCT';
      this.onProductTypeChange();
    }
  }

  private static readonly FASHION_SIZE_NAME_SYNONYMS = new Set([
    'size',
    'taille',
    'talla',
    'taglia',
    'groesse',
    'größe',
    'misura',
  ]);

  private static readonly FASHION_COLOR_NAME_SYNONYMS = new Set([
    'color',
    'colour',
    'couleur',
    'farbe',
    'colore',
  ]);

  private normalizeFashionAttributeName(name: unknown): string {
    return String(name ?? '')
      .trim()
      .toLowerCase();
  }

  private attributeNameMatchesFashionSize(name: unknown): boolean {
    return ProductFormComponent.FASHION_SIZE_NAME_SYNONYMS.has(this.normalizeFashionAttributeName(name));
  }

  private attributeNameMatchesFashionColor(name: unknown): boolean {
    return ProductFormComponent.FASHION_COLOR_NAME_SYNONYMS.has(this.normalizeFashionAttributeName(name));
  }

  /** Display labels for auto-added fashion rows; keyed by organization default locale (BCP47 prefix). */
  private resolveFashionStarterAttributeLabels(): { size: string; color: string } {
    const fromOrg = this.activityProfileService.context?.defaultLocale;
    const raw =
      (fromOrg != null && String(fromOrg).trim() !== '' ? String(fromOrg).trim() : '') ||
      this.translate.currentLang ||
      'en';
    const lang = String(raw)
      .trim()
      .split(/[-_]/)[0]
      .toLowerCase();
    const byLang: Record<string, { size: string; color: string }> = {
      en: { size: 'Size', color: 'Color' },
      fr: { size: 'Taille', color: 'Couleur' },
      es: { size: 'Talla', color: 'Color' },
      ar: { size: 'المقاس', color: 'اللون' },
      de: { size: 'Größe', color: 'Farbe' },
      it: { size: 'Taglia', color: 'Colore' },
    };
    return byLang[lang] ?? byLang['en'];
  }

  private ensureFashionStarterAttributes(): void {
    if (!this.localProduct.attributes) {
      this.localProduct.attributes = [];
    }
    const labels = this.resolveFashionStarterAttributeLabels();
    const hasSize = this.localProduct.attributes.some((a: any) =>
      this.attributeNameMatchesFashionSize(a?.attributeName),
    );
    const hasColor = this.localProduct.attributes.some((a: any) =>
      this.attributeNameMatchesFashionColor(a?.attributeName),
    );
    if (!hasSize) {
      this.localProduct.attributes.push({
        attributeName: labels.size,
        attributeType: 'STRING',
        value: '',
      });
    }
    if (!hasColor) {
      this.localProduct.attributes.push({
        attributeName: labels.color,
        attributeType: 'STRING',
        value: '',
      });
    }
  }

  private getAttributeTextValue(attr: any): string {
    if (!attr) {
      return '';
    }
    const raw = attr.value ?? attr.stringValue ?? attr.intValue ?? attr.doubleValue ?? '';
    return String(raw).trim();
  }

  private findFashionSizeAttributeValue(): string {
    if (!this.localProduct?.attributes || this.localProduct.attributes.length === 0) {
      return '';
    }
    const found = this.localProduct.attributes.find((a: any) =>
      this.attributeNameMatchesFashionSize(a?.attributeName),
    );
    return this.getAttributeTextValue(found);
  }

  private findFashionColorAttributeValue(): string {
    if (!this.localProduct?.attributes || this.localProduct.attributes.length === 0) {
      return '';
    }
    const found = this.localProduct.attributes.find((a: any) =>
      this.attributeNameMatchesFashionColor(a?.attributeName),
    );
    return this.getAttributeTextValue(found);
  }

  private hasFashionRequiredAttributes(): boolean {
    const size = this.findFashionSizeAttributeValue();
    const color = this.findFashionColorAttributeValue();
    return size.length > 0 && color.length > 0;
  }

  isPharmacyExpirationInvalid(): boolean {
    if (!this.activityProfileService.isPharmacyProfile || !this.isProduct() || !this.hasExpirationDate || !this.expirationDateValue) {
      return false;
    }
    const d = this.expirationDateValue instanceof Date ? this.expirationDateValue : new Date(this.expirationDateValue);
    if (isNaN(d.getTime())) {
      return true;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  }

  private initializeOptions(): void {
    this.productTypeOptions = [
      { label: this.translate.instant('product_type_product'), value: 'PRODUCT' },
      { label: this.translate.instant('product_type_service'), value: 'SERVICE' }
    ];
    this.profileAwareProductTypeOptions = [...this.productTypeOptions];
    
    this.measureUnits = [
      { value: MeasureUnit.UNIT, label: this.translate.instant('UNIT') },
      { value: MeasureUnit.KG, label: this.translate.instant('KG') },
      { value: MeasureUnit.LITER, label: this.translate.instant('LITER') },
      { value: MeasureUnit.PIECE, label: this.translate.instant('PIECE') },
      { value: MeasureUnit.BOX, label: this.translate.instant('BOX') },
      { value: MeasureUnit.METER, label: this.translate.instant('METER') },
      // Service-specific units
      { value: MeasureUnit.HOUR, label: this.translate.instant('HOUR') },
      { value: MeasureUnit.SESSION, label: this.translate.instant('SESSION') },
      { value: MeasureUnit.DAY, label: this.translate.instant('DAY') },
      { value: MeasureUnit.MONTH, label: this.translate.instant('MONTH') },
      { value: MeasureUnit.YEAR, label: this.translate.instant('YEAR') },
      { value: MeasureUnit.SERVICE_UNIT, label: this.translate.instant('SERVICE_UNIT') }
    ];
    
    // Initialize measure units for current type (default to product units)
    // This will be updated when product is initialized or type changes
    this.updateMeasureUnitsForType();
    
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

  // Helper methods for product type
  isService(): boolean {
    return this.localProduct.productType === 'SERVICE';
  }

  isProduct(): boolean {
    return !this.localProduct.productType || this.localProduct.productType === 'PRODUCT';
  }

  onProductTypeChange(): void {
    // When switching to SERVICE, clear product-specific fields
    if (this.isService()) {
      this.localProduct.warehouse = null;
      this.localProduct.quantityAvailable = null;
      this.localProduct.inventoryStatus = null;
      this.localProduct.costingMethod = null; // Services don't need costing methods
      this.localProduct.standardCost = null; // Services don't need standard cost
      // Set default measure unit for services if not set
      if (!this.localProduct.measureUnit) {
        this.localProduct.measureUnit = MeasureUnit.SERVICE_UNIT;
      }
    } else {
      // When switching to PRODUCT, clear service-specific fields
      this.localProduct.serviceProvider = null;
      this.localProduct.estimatedDurationMinutes = null;
      this.localProduct.serviceCategory = null;
      // Set default measure unit for products if not set
      if (!this.localProduct.measureUnit) {
        this.localProduct.measureUnit = MeasureUnit.UNIT;
      }
      // Set default quantity for products
      if (this.localProduct.quantityAvailable === null || this.localProduct.quantityAvailable === undefined) {
        this.localProduct.quantityAvailable = 0;
      }
    }
    
    // Update cached measure units for current type
    this.updateMeasureUnitsForType();
    // Update effective costing method label (only relevant for products)
    if (this.isProduct()) {
      this.updateEffectiveCostingMethodLabel();
    }
  }

  private updateMeasureUnitsForType(): void {
    // Safety check: if localProduct is not initialized, default to product units
    if (!this.localProduct || !this.localProduct.productType) {
      this.measureUnitsForCurrentType = this.measureUnits.filter(u => 
        ![MeasureUnit.HOUR, MeasureUnit.SESSION, MeasureUnit.DAY, MeasureUnit.MONTH, MeasureUnit.YEAR, MeasureUnit.SERVICE_UNIT].includes(u.value)
      );
      return;
    }
    
    if (this.localProduct.productType === 'SERVICE') {
      this.measureUnitsForCurrentType = this.measureUnits.filter(u => 
        [MeasureUnit.HOUR, MeasureUnit.SESSION, MeasureUnit.DAY, MeasureUnit.MONTH, MeasureUnit.YEAR, MeasureUnit.SERVICE_UNIT].includes(u.value)
      );
    } else {
      this.measureUnitsForCurrentType = this.measureUnits.filter(u => 
        ![MeasureUnit.HOUR, MeasureUnit.SESSION, MeasureUnit.DAY, MeasureUnit.MONTH, MeasureUnit.YEAR, MeasureUnit.SERVICE_UNIT].includes(u.value)
      );
    }
  }

  /**
   * Backend often returns paths like `/api/stock/...`. The browser resolves those against the SPA
   * origin (e.g. localhost:4200), not the API (8090), so image requests 404 unless we prefix the API origin
   * (same pattern as {@link ProductService}).
   * Fully-qualified http(s) URLs are returned unchanged (e.g. CDN / Firebase — may still 403 when expired).
   */
  resolvePublicImageUrl(url: string | null | undefined): string {
    if (url == null) return '';
    const s = String(url).trim();
    if (!s || s.startsWith('blob:')) return '';
    if (s.startsWith('assets/')) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (s.startsWith('//')) {
      return `${typeof window !== 'undefined' ? window.location.protocol : 'http:'}${s}`;
    }
    if (s.startsWith('/')) {
      const env = (typeof window !== 'undefined' ? (window as unknown as { __env?: Record<string, string> }).__env : undefined) || {};
      const apiProtocol = env['apiProtocol'] || 'http';
      const apiHost = env['apiHost'] || 'localhost';
      const apiPort = env['apiPort'] || '8090';
      return `${apiProtocol}://${apiHost}:${apiPort}${s}`;
    }
    return s;
  }

  onRecentImageError(failedUrl: string): void {
    const failedResolved = this.resolvePublicImageUrl(failedUrl);
    const next = this.recentProductImages.filter((u) => {
      const r = this.resolvePublicImageUrl(u);
      return r !== failedResolved && u !== failedUrl;
    });
    if (next.length !== this.recentProductImages.length) {
      this.recentProductImages = next;
      try {
        localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
      } catch {
        /* ignore quota */
      }
    }
  }

  private loadRecentImages(): void {
    const stored = localStorage.getItem('recentProductImages');
    if (!stored) {
      this.recentProductImages = [];
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        this.recentProductImages = [];
        return;
      }
      const seen = new Set<string>();
      const next: string[] = [];
      for (const item of parsed) {
        if (typeof item !== 'string') continue;
        const resolved = this.resolvePublicImageUrl(item.trim());
        if (!resolved) continue;
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        next.push(resolved);
        if (next.length >= 6) break;
      }
      this.recentProductImages = next;
      localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
    } catch {
      this.recentProductImages = [];
      try {
        localStorage.removeItem('recentProductImages');
      } catch {
        /* ignore */
      }
    }
  }

  resetForm(): void {
    this.submitted = false;
    this.uploadedFile = null;
    this.clearPendingLocalPreviews();
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
    const resolvedFiles =
      event?.files ??
      event?.currentFiles ??
      event?.originalEvent?.target?.files ??
      event?.target?.files ??
      [];
    const files: File[] = Array.from(resolvedFiles as ArrayLike<File>);
    if (!files.length) return;

    const validFiles: File[] = [];
    for (const file of files) {
      if (!file?.type?.startsWith('image/')) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_image_format'),
          life: 2500,
        });
        continue;
      }
      if (file.size > 5000000) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('image_too_large'),
          life: 2500,
        });
        continue;
      }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    if (this.localProduct?.productId) {
      this.isSaving = true;
      try {
        this.productService.loadToken();
        for (const file of validFiles) {
          const created = await lastValueFrom(
            this.productService.uploadAndAttachProductImage(this.localProduct.productId, file)
          );
          if (created?.imageUrl) {
            this.addToRecentImages(created.imageUrl);
          }
        }
        await this.loadProductImages(this.localProduct.productId);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: `${validFiles.length} ${this.translate.instant('product_image')} added`,
          life: 2500,
        });
      } catch (error) {
        console.error('Error uploading product gallery image:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_uploading_image'),
          life: 3000,
        });
      } finally {
        this.isSaving = false;
      }
      return;
    }

    if (this.pendingUploadFiles.length > 0) {
      this.appendPendingUploadFiles(validFiles);
    } else {
      this.applyPendingUploadSelection(validFiles);
    }

    setTimeout(() => {
      if (this.isImageLoading) this.isImageLoading = false;
    }, 2000);
  }

  private clearPendingLocalPreviews(): void {
    for (const url of this.pendingPreviewUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }
    this.pendingPreviewUrls = [];
    this.pendingUploadFiles = [];
    this.selectedPendingIndex = 0;
    this.pendingDraggedIndex = null;
    this.pendingDragOverIndex = null;
  }

  private applyPendingUploadSelection(validFiles: File[]): void {
    this.clearPendingLocalPreviews();
    this.pendingUploadFiles = [...validFiles];
    this.pendingPreviewUrls = validFiles.map((f) => URL.createObjectURL(f));
    this.selectedPendingIndex = 0;
    this.uploadedFile = validFiles[0];
    this.imagePreviewUrl = this.pendingPreviewUrls[0];
    this.isImageLoading = true;
  }

  /** Append new local files to the pending gallery (new product before save). */
  private appendPendingUploadFiles(validFiles: File[]): void {
    if (!validFiles.length) return;
    for (const file of validFiles) {
      this.pendingUploadFiles.push(file);
      this.pendingPreviewUrls.push(URL.createObjectURL(file));
    }
    if (this.selectedPendingIndex < 0 || this.selectedPendingIndex >= this.pendingPreviewUrls.length) {
      this.selectedPendingIndex = 0;
    }
    this.uploadedFile = this.pendingUploadFiles[this.selectedPendingIndex] ?? null;
    this.imagePreviewUrl = this.pendingPreviewUrls[this.selectedPendingIndex] ?? null;
    this.localProduct.productImage = this.imagePreviewUrl;
    this.isImageLoading = true;
  }

  selectPendingPreview(index: number): void {
    if (index < 0 || index >= this.pendingPreviewUrls.length) return;
    this.selectedPendingIndex = index;
    this.imagePreviewUrl = this.pendingPreviewUrls[index];
    this.uploadedFile = this.pendingUploadFiles[index] ?? null;
  }

  removePendingPreview(index: number): void {
    if (index < 0 || index >= this.pendingPreviewUrls.length) return;
    try {
      URL.revokeObjectURL(this.pendingPreviewUrls[index]);
    } catch {
      /* ignore */
    }
    this.pendingPreviewUrls.splice(index, 1);
    this.pendingUploadFiles.splice(index, 1);
    if (this.pendingPreviewUrls.length === 0) {
      this.uploadedFile = null;
      this.imagePreviewUrl = null;
      this.selectedPendingIndex = 0;
      this.localProduct.productImage = null;
      return;
    }
    if (this.selectedPendingIndex >= this.pendingPreviewUrls.length) {
      this.selectedPendingIndex = this.pendingPreviewUrls.length - 1;
    }
    this.imagePreviewUrl = this.pendingPreviewUrls[this.selectedPendingIndex];
    this.uploadedFile = this.pendingUploadFiles[this.selectedPendingIndex] ?? null;
  }

  onPendingGalleryDragStart(event: DragEvent, index: number): void {
    if (index < 0 || index >= this.pendingPreviewUrls.length) {
      event.preventDefault();
      return;
    }
    this.pendingDraggedIndex = index;
    try {
      event.dataTransfer?.setData('text/plain', String(index));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    } catch {
      /* ignore */
    }
  }

  onPendingGalleryDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    if (index >= 0 && index < this.pendingPreviewUrls.length) {
      this.pendingDragOverIndex = index;
    }
  }

  onPendingGalleryDrop(event: DragEvent, index: number): void {
    event.preventDefault();
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      void this.onFileUpload({ files: Array.from(droppedFiles) });
      this.pendingDraggedIndex = null;
      this.pendingDragOverIndex = null;
      return;
    }
    const from = this.pendingDraggedIndex;
    const to = index;
    if (
      from == null ||
      to < 0 ||
      to >= this.pendingPreviewUrls.length ||
      from === to
    ) {
      this.pendingDraggedIndex = null;
      this.pendingDragOverIndex = null;
      return;
    }

    const movedPreview = this.pendingPreviewUrls.splice(from, 1)[0];
    const movedFile = this.pendingUploadFiles.splice(from, 1)[0];
    this.pendingPreviewUrls.splice(to, 0, movedPreview);
    this.pendingUploadFiles.splice(to, 0, movedFile);

    if (this.selectedPendingIndex === from) {
      this.selectedPendingIndex = to;
    } else if (from < this.selectedPendingIndex && to >= this.selectedPendingIndex) {
      this.selectedPendingIndex -= 1;
    } else if (from > this.selectedPendingIndex && to <= this.selectedPendingIndex) {
      this.selectedPendingIndex += 1;
    }

    this.imagePreviewUrl = this.pendingPreviewUrls[this.selectedPendingIndex] ?? null;
    this.uploadedFile = this.pendingUploadFiles[this.selectedPendingIndex] ?? null;

    this.pendingDraggedIndex = null;
    this.pendingDragOverIndex = null;
  }

  onPendingGalleryDragEnd(): void {
    this.pendingDraggedIndex = null;
    this.pendingDragOverIndex = null;
  }

  movePendingPreviewUp(index: number): void {
    this.movePendingPreview(index, index - 1);
  }

  movePendingPreviewDown(index: number): void {
    this.movePendingPreview(index, index + 1);
  }

  private movePendingPreview(from: number, to: number): void {
    if (
      from < 0 ||
      from >= this.pendingPreviewUrls.length ||
      to < 0 ||
      to >= this.pendingPreviewUrls.length ||
      from === to
    ) {
      return;
    }

    const movedPreview = this.pendingPreviewUrls.splice(from, 1)[0];
    const movedFile = this.pendingUploadFiles.splice(from, 1)[0];
    this.pendingPreviewUrls.splice(to, 0, movedPreview);
    this.pendingUploadFiles.splice(to, 0, movedFile);

    if (this.selectedPendingIndex === from) {
      this.selectedPendingIndex = to;
    } else if (from < this.selectedPendingIndex && to >= this.selectedPendingIndex) {
      this.selectedPendingIndex -= 1;
    } else if (from > this.selectedPendingIndex && to <= this.selectedPendingIndex) {
      this.selectedPendingIndex += 1;
    }

    this.imagePreviewUrl = this.pendingPreviewUrls[this.selectedPendingIndex] ?? null;
    this.uploadedFile = this.pendingUploadFiles[this.selectedPendingIndex] ?? null;
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
      this.onFileUpload({ files: Array.from(event.dataTransfer.files) });
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

  getCurrentImageSource(): string {
    let raw = '';
    // Saved product: gallery order + primary from API; allow hero to follow a clicked thumbnail
    if (this.localProduct?.productId && this.productImages?.length) {
      const urls = new Set(this.productImages.map((img: any) => img?.imageUrl).filter(Boolean));
      if (this.localProduct.productImage && urls.has(this.localProduct.productImage)) {
        raw = this.localProduct.productImage;
      } else {
        const primary = this.productImages.find((img: any) => !!img?.primaryImage);
        raw = primary?.imageUrl || this.productImages[0].imageUrl || '';
      }
    } else if (this.imagePreviewUrl) {
      return this.imagePreviewUrl;
    } else if (this.localProduct?.productImage) {
      raw = this.localProduct.productImage;
    }
    if (!raw) {
      return 'assets/core-images/no-image.png';
    }
    if (raw.startsWith('blob:') || raw.startsWith('assets/')) {
      return raw;
    }
    return this.resolvePublicImageUrl(raw) || raw;
  }

  /** Whether two stored image URL strings refer to the same asset (path / resolved URL). */
  galleryImageUrlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    const sa = String(a ?? '').trim();
    const sb = String(b ?? '').trim();
    if (!sa || !sb) return false;
    const ra = this.resolvePublicImageUrl(sa);
    const rb = this.resolvePublicImageUrl(sb);
    if (ra === rb) return true;
    try {
      const pa = new URL(ra, 'http://local.invalid').pathname;
      const pb = new URL(rb, 'http://local.invalid').pathname;
      return pa === pb;
    } catch {
      return false;
    }
  }

  /**
   * Gallery row that corresponds to the image currently shown in the hero
   * (clicked thumbnail or primary / first when unset).
   */
  resolveHeroGalleryRow(): any | null {
    if (!this.productImages?.length) return null;
    const heroRaw = this.localProduct?.productImage;
    if (!heroRaw) {
      return this.productImages.find((img: any) => img?.primaryImage) || this.productImages[0] || null;
    }
    for (const img of this.productImages) {
      const u = img?.imageUrl;
      if (!u) continue;
      if (this.galleryImageUrlsMatch(heroRaw, u)) {
        return img;
      }
    }
    return this.productImages.find((img: any) => img?.primaryImage) || this.productImages[0] || null;
  }

  isGalleryThumbHero(img: any): boolean {
    const heroUrl = this.localProduct?.productImage;
    if (!heroUrl || !img?.imageUrl) return false;
    return this.galleryImageUrlsMatch(heroUrl, img.imageUrl);
  }

  private triggerGalleryReplacePicker(): void {
    const el = this.galleryReplaceInput?.nativeElement;
    if (el) {
      el.value = '';
      el.click();
    }
  }

  editImage(): void {
    // Saved product: always open the file picker — never fall through to clearing the hero.
    // (Previously we only opened when galleryRowId(resolveHeroGalleryRow()) was set; missing/odd
    // API ids or URL mismatch left users with a cleared image and no picker.)
    if (this.localProduct?.productId) {
      this.triggerGalleryReplacePicker();
      return;
    }
    if (this.pendingPreviewUrls?.length > 0) {
      this.triggerGalleryReplacePicker();
      return;
    }
    this.localProduct.productImage = null;
    this.uploadedFile = null;
    this.clearPendingLocalPreviews();
    this.imagePreviewUrl = null;
  }

  async onReplaceImageFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (!files.length) return;
    const file = files[0];
    if (!file.type?.startsWith('image/')) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_image_format'),
        life: 2500,
      });
      return;
    }
    if (file.size > 5000000) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('image_too_large'),
        life: 2500,
      });
      return;
    }

    if (this.localProduct?.productId && this.productImages?.length > 0) {
      let row = this.resolveHeroGalleryRow();
      let imageId = this.galleryRowId(row);
      if (imageId == null) {
        row =
          this.productImages.find((g: any) => this.galleryRowId(g) != null) ?? null;
        imageId = this.galleryRowId(row);
      }
      if (imageId != null) {
        await this.replaceGalleryImage(imageId, file);
        return;
      }
    }

    if (!this.localProduct?.productId && this.pendingPreviewUrls?.length > 0) {
      this.replacePendingPreviewAt(this.selectedPendingIndex, file);
      return;
    }

    if (!this.localProduct?.productId && (this.localProduct.productImage || this.imagePreviewUrl)) {
      this.applyPendingUploadSelection([file]);
      return;
    }

    await this.onFileUpload({ files: [file] });
  }

  private replacePendingPreviewAt(index: number, file: File): void {
    if (index < 0 || index >= this.pendingPreviewUrls.length || index >= this.pendingUploadFiles.length) {
      return;
    }
    try {
      URL.revokeObjectURL(this.pendingPreviewUrls[index]);
    } catch {
      /* ignore */
    }
    this.pendingUploadFiles[index] = file;
    this.pendingPreviewUrls[index] = URL.createObjectURL(file);
    this.selectedPendingIndex = index;
    this.uploadedFile = file;
    this.imagePreviewUrl = this.pendingPreviewUrls[index];
    this.localProduct.productImage = this.imagePreviewUrl;
    this.isImageLoading = true;
  }

  private async replaceGalleryImageFallback(imageId: number, file: File): Promise<void> {
    const pid = this.localProduct!.productId!;
    const orderedBefore = this.productImages
      .map((g: any) => this.galleryRowId(g))
      .filter((n): n is number => n != null);
    const idx = orderedBefore.indexOf(imageId);
    if (idx < 0) {
      throw new Error('replace fallback: image not in gallery');
    }

    await lastValueFrom(this.productService.deleteProductImage(pid, imageId));
    const created = await lastValueFrom(this.productService.uploadAndAttachProductImage(pid, file));
    await this.loadProductImages(pid);

    const newId = this.galleryRowId(created);
    const idsAfter = this.productImages
      .map((g: any) => this.galleryRowId(g))
      .filter((n): n is number => n != null);
    if (newId == null || !idsAfter.includes(newId)) {
      return;
    }
    const withoutNew = idsAfter.filter((id) => id !== newId);
    const insertAt = Math.min(idx, withoutNew.length);
    const reordered = [...withoutNew.slice(0, insertAt), newId, ...withoutNew.slice(insertAt)];
    if (reordered.length !== idsAfter.length) {
      return;
    }
    await lastValueFrom(this.productService.reorderProductImages(pid, reordered));
    await this.loadProductImages(pid);
  }

  private async replaceGalleryImage(imageId: number, file: File): Promise<void> {
    const pid = this.localProduct!.productId!;
    const slotIndex = this.productImages.findIndex((g: any) => this.galleryRowId(g) === imageId);
    this.isSaving = true;
    try {
      this.productService.loadToken();
      try {
        await lastValueFrom(this.productService.replaceProductImage(pid, imageId, file));
      } catch (err: any) {
        const code = err?.status;
        if (code === 404 || code === 405 || code === 501) {
          await this.replaceGalleryImageFallback(imageId, file);
        } else {
          throw err;
        }
      }
      await this.loadProductImages(pid);
      const i = slotIndex >= 0 ? Math.min(slotIndex, Math.max(0, this.productImages.length - 1)) : 0;
      const row = this.productImages[i];
      if (row?.imageUrl) {
        this.localProduct.productImage = row.imageUrl;
      }
      if (row?.imageUrl) {
        this.addToRecentImages(row.imageUrl);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('product_image'),
        life: 2200,
      });
    } catch (error) {
      console.error('Replace gallery image failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_uploading_image'),
        life: 3000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  removeImage(): void {
    if (this.localProduct?.productId && this.productImages?.length) {
      const row = this.resolveHeroGalleryRow();
      const id = this.galleryRowId(row);
      if (id != null) {
        void this.deleteGalleryImage(id);
        return;
      }
    }
    if (!this.localProduct?.productId && this.pendingPreviewUrls?.length > 1) {
      this.removePendingPreview(this.selectedPendingIndex);
      return;
    }
    if (!this.localProduct?.productId && this.pendingPreviewUrls?.length === 1) {
      this.removePendingPreview(0);
      return;
    }
    this.localProduct.productImage = null;
    this.uploadedFile = null;
    this.clearPendingLocalPreviews();
    this.imagePreviewUrl = null;
    this.existingImageFile = null;
  }

  selectRecentImage(imageUrl: string): void {
    if (this.localProduct?.productId) {
      void this.attachRecentImageToExistingProduct(imageUrl);
      return;
    }
    this.localProduct.productImage = imageUrl;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
    this.clearPendingLocalPreviews();
  }

  onGallerySetPrimaryClick(img: any): void {
    const id = this.galleryRowId(img);
    if (id != null) void this.setGalleryPrimary(id);
  }

  onGalleryDeleteClick(img: any): void {
    const id = this.galleryRowId(img);
    if (id != null) void this.deleteGalleryImage(id);
  }

  async setGalleryPrimary(imageId: number): Promise<void> {
    if (!this.localProduct?.productId || !imageId) return;
    try {
      this.productService.loadToken();
      await lastValueFrom(this.productService.setPrimaryProductImage(this.localProduct.productId, imageId));
      await this.loadProductImages(this.localProduct.productId);
    } catch (error) {
      console.error('Error setting primary image:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Failed to set primary image.',
        life: 2500,
      });
    }
  }

  async deleteGalleryImage(imageId: number): Promise<void> {
    if (!this.localProduct?.productId || !imageId) return;
    try {
      this.productService.loadToken();
      await lastValueFrom(this.productService.deleteProductImage(this.localProduct.productId, imageId));
      await this.loadProductImages(this.localProduct.productId);
      if (!this.productImages.length) {
        this.localProduct.productImage = null;
      }
    } catch (error) {
      console.error('Error deleting gallery image:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Failed to delete image.',
        life: 2500,
      });
    }
  }

  /** Numeric image row id (gallery JSON may use `id` or `imageId`). */
  galleryRowId(img: any): number | null {
    const v = img?.id ?? img?.imageId;
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  onGalleryDragStart(event: DragEvent, img: any): void {
    const id = this.galleryRowId(img);
    if (id == null) {
      event.preventDefault();
      return;
    }
    this.draggedImageId = id;
    try {
      event.dataTransfer?.setData('text/plain', String(id));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    } catch {
      /* ignore */
    }
  }

  onGalleryDragOver(event: DragEvent, img: any): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    const id = this.galleryRowId(img);
    if (id != null) {
      this.galleryDragOverId = id;
    }
  }

  onGalleryDrop(event: DragEvent, img: any): void {
    event.preventDefault();
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      void this.onFileUpload({ files: Array.from(droppedFiles) });
      this.draggedImageId = null;
      this.galleryDragOverId = null;
      return;
    }
    const targetImageId = this.galleryRowId(img);
    if (
      !this.localProduct?.productId ||
      this.draggedImageId == null ||
      targetImageId == null ||
      this.draggedImageId === targetImageId
    ) {
      this.draggedImageId = null;
      this.galleryDragOverId = null;
      return;
    }

    const currentIds = this.productImages
      .map((g: any) => this.galleryRowId(g))
      .filter((n): n is number => n != null);
    const fromIndex = currentIds.indexOf(this.draggedImageId);
    const toIndex = currentIds.indexOf(targetImageId);
    if (fromIndex < 0 || toIndex < 0) {
      this.draggedImageId = null;
      this.galleryDragOverId = null;
      return;
    }

    const reordered = [...currentIds];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    void this.reorderGallery(reordered, moved);

    this.draggedImageId = null;
    this.galleryDragOverId = null;
  }

  onGalleryDragEnd(): void {
    this.draggedImageId = null;
    this.galleryDragOverId = null;
  }

  private async reorderGallery(imageIds: number[], movedImageId?: number): Promise<void> {
    if (!this.localProduct?.productId || !imageIds?.length) return;
    try {
      this.productService.loadToken();
      await lastValueFrom(this.productService.reorderProductImages(this.localProduct.productId, imageIds));
      await this.loadProductImages(this.localProduct.productId);
      if (movedImageId) {
        this.reorderFlashImageId = movedImageId;
        setTimeout(() => {
          if (this.reorderFlashImageId === movedImageId) {
            this.reorderFlashImageId = null;
          }
        }, 700);
      }
    } catch (error) {
      console.error('Error reordering gallery images:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Failed to reorder images.',
        life: 2500,
      });
    }
  }

  private async attachRecentImageToExistingProduct(imageUrl: string): Promise<void> {
    if (!this.localProduct?.productId || !imageUrl) return;
    const pid = this.localProduct.productId;
    const resolved = imageUrl.trim();
    try {
      this.productService.loadToken();
      await lastValueFrom(this.productService.attachProductImageUrl(pid, resolved));
      await this.loadProductImages(pid);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('product_image'),
        life: 2200,
      });
    } catch (linkErr) {
      console.warn('attachProductImageUrl failed, trying fetch+upload fallback:', linkErr);
      try {
        const res = await fetch(resolved, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) {
          throw new Error(`fetch ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob?.type?.startsWith('image/')) {
          throw new Error('not an image response');
        }
        const ext = blob.type.includes('png')
          ? 'png'
          : blob.type.includes('webp')
            ? 'webp'
            : blob.type.includes('gif')
              ? 'gif'
              : 'jpg';
        const file = new File([blob], `recent-image.${ext}`, { type: blob.type });
        this.productService.loadToken();
        await lastValueFrom(this.productService.uploadAndAttachProductImage(pid, file));
        this.addToRecentImages(resolved);
        await this.loadProductImages(pid);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('product_image'),
          life: 2200,
        });
      } catch (fallbackErr) {
        console.error('Error linking recent image:', linkErr, fallbackErr);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_uploading_image'),
          life: 2500,
        });
      }
    }
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

  onExpirationDateToggle(): void {
    if (!this.hasExpirationDate) {
      // Clear expiration date when checkbox is unchecked
      this.expirationDateValue = null;
      this.localProduct.expirationDate = null;
    }
  }

  async saveProduct(): Promise<void> {
    this.submitted = true;
    this.backendFieldErrors = {};

    // Ensure productType is set
    if (!this.localProduct.productType) {
      this.localProduct.productType = 'PRODUCT';
    }

    // Common validations
    if (
      !this.localProduct.name ||
      !this.localProduct.reference ||
      !this.localProduct.sellingPrice ||
      !this.localProduct.category
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3100,
      });
      return;
    }

    if ((this.localProduct.description?.length ?? 0) > this.productDescriptionMaxLength) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('max_500_characters'),
        life: 3000,
      });
      return;
    }

    // Type-specific validations
    if (this.isProduct()) {
      // Products require supplier and warehouse (if admin)
      if (!this.localProduct.supplier) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_supplier') + ' ' + this.translate.instant('is_required_label'),
          life: 3000,
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

      // Ensure quantity is set for products (default to 0)
      if (this.localProduct.quantityAvailable === null || this.localProduct.quantityAvailable === undefined) {
        this.localProduct.quantityAvailable = 0;
      }

      if (this.activityProfileService.isPharmacyProfile) {
        if (!this.hasExpirationDate || !this.expirationDateValue) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('profile_mode_pharmacy_expiration_required'),
            life: 4000,
          });
          return;
        }
        const expiration = this.expirationDateValue instanceof Date
          ? this.expirationDateValue
          : new Date(this.expirationDateValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (isNaN(expiration.getTime()) || expiration < today) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('profile_mode_pharmacy_expiration_future'),
            life: 4000,
          });
          return;
        }
      }

      if (this.activityProfileService.isFashionProfile && !this.hasFashionRequiredAttributes()) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('profile_mode_fashion_size_color_required'),
          life: 4000,
        });
        return;
      }
    } else if (this.isService()) {
      // Services cannot have warehouse or quantity
      if (this.localProduct.warehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('services_cannot_have_warehouse'),
          life: 3000,
        });
        return;
      }

      if (this.localProduct.quantityAvailable !== null && this.localProduct.quantityAvailable !== undefined) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('services_cannot_have_quantity'),
          life: 3000,
        });
        return;
      }

      // Clear service-incompatible fields
      this.localProduct.warehouse = null;
      this.localProduct.quantityAvailable = null;
      this.localProduct.inventoryStatus = null;
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

    const selectedFiles = this.pendingUploadFiles.length > 0
      ? [...this.pendingUploadFiles]
      : (this.uploadedFile ? [this.uploadedFile] : []);
    const additionalGalleryFiles = !this.localProduct?.productId && selectedFiles.length > 1
      ? selectedFiles.slice(1)
      : [];

    // Upload primary image if selected (for create flow)
    if (selectedFiles.length > 0) {
      this.isSaving = true;
      try {
        this.uploadProgress = 30;
        this.productService.loadToken();
        const uploadResp = await lastValueFrom(this.productService.uploadProductImage(selectedFiles[0]));
        const url = uploadResp?.url;
        if (!url) {
          throw new Error('Invalid upload response: missing image URL');
        }
        this.uploadProgress = 100;
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
        this.clearPendingLocalPreviews();
        this.imagePreviewUrl = null;
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

    // Handle expiration date
    if (this.hasExpirationDate && this.expirationDateValue) {
      // Convert Date to ISO string format (YYYY-MM-DD)
      if (this.expirationDateValue instanceof Date) {
        this.localProduct.expirationDate = this.expirationDateValue.toISOString().split('T')[0];
      } else {
        this.localProduct.expirationDate = this.expirationDateValue;
      }
    } else {
      // Clear expiration date if checkbox is unchecked
      this.localProduct.expirationDate = null;
    }

    // Clean up fields based on product type before saving
    if (this.isService()) {
      // Services: remove product-specific fields including expiration date and costing methods
      this.localProduct.warehouse = null;
      this.localProduct.quantityAvailable = null;
      this.localProduct.inventoryStatus = null;
      this.localProduct.expirationDate = null; // Services don't expire
      this.localProduct.costingMethod = null; // Services don't need costing methods
      this.localProduct.standardCost = null; // Services don't need standard cost
    } else {
      // Products: remove service-specific fields
      this.localProduct.serviceProvider = null;
      this.localProduct.estimatedDurationMinutes = null;
      this.localProduct.serviceCategory = null;
    }

    // Build a sanitized payload to avoid sending aggregated/transient UI fields
    const productToSave = this.buildProductPayload();

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
      const savedProduct = await this.saveProductToBackend(productToSave);
      if (!productToSave.productId && additionalGalleryFiles.length > 0) {
        const raw = savedProduct as any;
        const createdProductId = Number(
          raw?.productId ?? raw?.id ?? raw?.product?.productId ?? raw?.data?.productId
        );
        if (createdProductId) {
          await this.uploadAdditionalGalleryImages(createdProductId, additionalGalleryFiles);
        }
      }
      
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

  // Save product to backend: POST for create, PUT for update
  private async saveProductToBackend(product: any): Promise<any> {
    console.log('=== SAVE PRODUCT TO BACKEND ===');
    console.log('Product data being sent:', JSON.stringify(product, null, 2));
    console.log('Product ID:', product.productId);
    console.log('==============================');
    
    return new Promise<any>((resolve, reject) => {
      const request$ = product.productId
        ? this.productService.updateProduct(product.productId, product)
        : this.productService.saveProduct(product);
      request$
        .subscribe({
          next: (response: any) => {
            console.log('=== SAVE PRODUCT SUCCESS ===');
            console.log('Product save API response:', response);
            console.log('Response type:', typeof response);
            console.log('============================');
            resolve(response);
          },
          error: (err: any) => {
            console.error('=== SAVE PRODUCT ERROR ===');
            console.error('Error status:', err?.status);
            console.error('Error statusText:', err?.statusText);
            console.error('Error body:', err?.error);
            console.error('Error message:', err?.message);
            console.error('Full error:', err);
            console.error('==========================');
            
            const validationErrors = Array.isArray(err?.error?.validationErrors) ? err.error.validationErrors : [];
            if (validationErrors.length > 0) {
              this.backendFieldErrors = {};
              for (const ve of validationErrors) {
                const field = String(ve?.field ?? '').trim();
                const message = String(ve?.message ?? '').trim();
                if (field && message) {
                  this.backendFieldErrors[field] = message;
                }
              }
            }

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

  private async uploadAdditionalGalleryImages(productId: number, files: File[]): Promise<void> {
    if (!productId || !files?.length) return;
    try {
      this.productService.loadToken();
      for (const file of files) {
        await lastValueFrom(this.productService.uploadAndAttachProductImage(productId, file));
      }
    } catch (error) {
      console.error('Error uploading additional gallery images:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: 'Product saved, but some additional images failed to upload.',
        life: 4000
      });
    }
  }

  /**
   * Keep API payload strictly aligned with backend Product entity fields.
   * Avoid leaking aggregated/transient properties (e.g. _warehouseStocks, activeBarcodes, etc.).
   */
  private buildProductPayload(): any {
    const payload: any = {
      productId: this.localProduct.productId != null ? Number(this.localProduct.productId) : undefined,
      reference: this.localProduct.reference,
      name: this.localProduct.name,
      description: this.localProduct.description ?? null,
      productType: this.localProduct.productType || 'PRODUCT',
      quantityAvailable: this.localProduct.quantityAvailable ?? (this.isProduct() ? 0 : null),
      buyingPrice: this.localProduct.buyingPrice ?? null,
      sellingPrice: this.localProduct.sellingPrice,
      inventoryStatus: this.localProduct.inventoryStatus ?? null,
      productImage: this.localProduct.productImage ?? null,
      category: this.localProduct.category?.categoryId != null ? { categoryId: this.localProduct.category.categoryId } : null,
      supplier: this.localProduct.supplier?.supplierId != null ? { supplierId: this.localProduct.supplier.supplierId } : null,
      warehouse: this.localProduct.warehouse?.warehouseId != null ? { warehouseId: this.localProduct.warehouse.warehouseId } : null,
      attributes: this.localProduct.attributes ?? [],
      measureUnit: this.localProduct.measureUnit,
      active: this.localProduct['active'] ?? true,
      standardCost: this.localProduct.standardCost ?? null,
      costingMethod: this.localProduct.costingMethod ?? null,
      serviceProvider: this.localProduct.serviceProvider ?? null,
      estimatedDurationMinutes: this.localProduct.estimatedDurationMinutes ?? null,
      serviceCategory: this.localProduct.serviceCategory ?? null,
      expirationDate: this.localProduct.expirationDate ?? null,
    };

    // ProductType-specific cleanup
    if (payload.productType === 'SERVICE') {
      payload.warehouse = null;
      payload.quantityAvailable = null;
      payload.inventoryStatus = null;
      payload.expirationDate = null;
      payload.costingMethod = null;
      payload.standardCost = null;
    } else {
      payload.serviceProvider = null;
      payload.estimatedDurationMinutes = null;
      payload.serviceCategory = null;
    }

    return payload;
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
    const resolved = this.resolvePublicImageUrl(imageUrl.trim());
    if (!resolved) return;
    const withoutDup = this.recentProductImages.filter(
      (u) => this.resolvePublicImageUrl(u) !== resolved
    );
    this.recentProductImages = [resolved, ...withoutDup].slice(0, 6);
    localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
  }
}

