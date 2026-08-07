import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Product, AggregatedProduct, WarehouseStockInfo } from 'src/app/models/product';
import { ProductPriceHistory } from 'src/app/models/productPriceHistory';
import { ProductService } from 'src/app/services/product.service';
import { BarcodeService } from 'src/app/services/barcode.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { Category } from 'src/app/models/category';
import { Warehouse } from 'src/app/models/warehouse';
import { Supplier } from 'src/app/models/supplier';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { getMeasureUnit, getAvailableQuantity, hasWriteOffs, getWriteOffQuantity, displayWarehouseStockQuantity, formatLineQuantity, getLineMeasureUnit, lineQuantityMin, lineQuantityStep, lineQuantityDecimals, toWriteOffStorageQuantity } from 'src/app/shared/product-utils';
import { getExpirationInfo, formatExpirationDate, getExpirationStatus, getExpirationSeverity, getExpirationIcon, ExpirationStatus } from 'src/app/shared/product-expiration.utils';
import { ProductBatch, BatchStatus } from 'src/app/models/productBatch';
import { ProductSupplier } from 'src/app/models/product-supplier';
import { 
  BarcodeResponseDTO, 
  BarcodeRequestDTO,
  BarcodeType, 
  BarcodeFormat,
  BarcodeFormatOption,
  getBarcodeFormats,
  getQRCodeFormats,
  LabelSizeOption
} from 'src/app/models/barcode';
import { InventoryWriteOff } from 'src/app/models/write-off';
import { WriteOffService } from 'src/app/services/write-off.service';
import { getPreferredProductImageUrl, resolvePublicAssetUrl } from 'src/app/shared/product-image.utils';
import { BRAND_PROFIT_CHART } from 'src/app/utils/brand-colors';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

const DEFAULT_PRODUCT_IMAGE = 'assets/core-images/no-image.png';
const MAX_INLINE_IMAGE_URL_LENGTH = 200_000;

@Component({
  selector: 'app-product-details-page',
  templateUrl: './product-details-page.component.html',
  styleUrls: ['./product-details-page.component.css', '../products.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class ProductDetailsPageComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  productId!: number;
  product: Product | null = null;
  productGalleryImages: string[] = [];
  /** Stable gallery URLs for the overview tab (updated only when the list changes). */
  galleryImagesForView: string[] = [];
  heroImageUrl = DEFAULT_PRODUCT_IMAGE;
  activeGalleryIndex = 0;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canArchive: boolean = false;
  isAdmin: boolean = false;
  isWarehouseman: boolean = false;
  isVendor: boolean = false;
  userRoles: any;
  Ressource: string = "PRODUCTS";
  
  // Aggregated product support
  isAggregatedView: boolean = false;
  productReference: string | null = null;
  aggregatedProduct: AggregatedProduct | null = null;
  warehouseStocks: WarehouseStockInfo[] = [];
  /** Shown under costing when aggregated SKUs disagree on effective method */
  aggregatedCostingMethodVaries = false;

  // Product form properties
  productDialog: boolean = false;
  categories: Category[] = [];
  suppliers: Supplier[] = [];
  warehouses: Warehouse[] = [];
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;
  /** When set, product form edits this SKU (aggregated breakdown); keeps hero `product` as grouped view. */
  productForForm: Product | null = null;
  readonly emptyExistingProducts: Product[] = [];
  /** When set, stock adjustment applies to this SKU (aggregated breakdown). */
  stockAdjustmentTarget: Product | null = null;

  profitChartData: any;
  chartOptions: any;
  analyticsChartReady: boolean = false;
  printOptions: any[] = [];
  productPriceHistory: ProductPriceHistory[] = [];

  // Barcode Management
  barcodes: BarcodeResponseDTO[] = [];
  barcodesLoading: boolean = false;
  generateBarcodeDialog: boolean = false;
  printBarcodesDialog: boolean = false;
  
  // Generate Barcode Form
  newBarcodeType: BarcodeType = 'BARCODE';
  newBarcodeFormat: BarcodeFormat = 'CODE_128';
  newBarcodeCustomValue: string = '';
  newBarcodeLabel: string = '';
  newBarcodeIsPrimary: boolean = false;
  isGenerating: boolean = false;
  
  // Format Options
  barcodeFormats: BarcodeFormatOption[] = getBarcodeFormats();
  qrcodeFormats: BarcodeFormatOption[] = getQRCodeFormats();
  currentFormats: BarcodeFormatOption[] = this.barcodeFormats;
  
  barcodeTypes: any[] = [];
  
  // Print Options
  labelSizeOptions: LabelSizeOption[] = [];
  selectedLabelSize: string = '3x1';
  printColumns: number = 3;
  selectedBarcodesForPrint: BarcodeResponseDTO[] = [];
  
  // Auto-generate menu items
  autoGenerateMenuItems: any[] = [];

  deleteProductDialog = false;
  archiveProductDialog = false;

  // Stock Adjustment
  stockAdjustmentDialog: boolean = false;
  quantityChange: number = 0;
  adjustmentReason: string = '';
  isAdjustingStock: boolean = false;

  // Batch Management
  batches: ProductBatch[] = [];
  batchesLoading: boolean = false;
  /** When true, the Batches tab also lists depleted / written-off lots (qty 0 / inactive). */
  showDepletedBatches: boolean = false;

  // Approved-vendor list (multi-supplier sourcing)
  productSuppliers: ProductSupplier[] = [];
  productSuppliersLoading: boolean = false;
  vendorDialogVisible: boolean = false;
  vendorSaving: boolean = false;
  editingVendor: ProductSupplier | null = null;
  vendorForm: any = this.emptyVendorForm();

  // Write-Offs Management
  writeOffs: InventoryWriteOff[] = [];
  writeOffsLoading: boolean = false;

  /** When true, sales stock includes approved write-off quantity (same setting as orders/POS). */
  salesStockIncludesApprovedWriteoffQty: boolean = false;

  private readonly destroy$ = new Subject<void>();
  /** Cancels stale in-flight route initializations when navigating quickly. */
  private routeLoadGeneration = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    public productService: ProductService,
    private barcodeService: BarcodeService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private supplierService: SupplierService,
    private writeOffService: WriteOffService,
    public pageSizeService: TablePageSizeService
  ) {
    this.printOptions = [
      {
        label: this.translate.instant('standard_label'),
        icon: 'pi pi-tag',
        command: () => this.productService.printLabel(this.product!, 'STANDARD')
      },
      {
        label: this.translate.instant('barcode_label'),
        icon: 'pi pi-qrcode',
        command: () => this.productService.printLabel(this.product!, 'BARCODE')
      },
      {
        label: this.translate.instant('shipping_label'),
        icon: 'pi pi-truck',
        command: () => this.productService.printLabel(this.product!, 'SHIPPING')
      }
    ];
  }

  async ngOnInit() {
    // Load token first
    // this.productService.loadToken();
    // this.barcodeService.loadToken();

    void this.loadSalesStockConfig();

    this.configService.configurationSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((key) => {
        if (key === 'sales.stock.include.approved.writeoff.quantity') {
          void this.loadSalesStockConfig();
        }
      });
    
    this.configService.currency$
      .pipe(takeUntil(this.destroy$))
      .subscribe(currency => {
        if (currency) {
          this.currency = currency;
        }
      });

    this.translateService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lang => {
        this.translate.use(lang);
        this.initAutoGenerateMenuItems();
      });
    
    this.initAutoGenerateMenuItems();

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      void this.initializePageFromRoute(params.get('id'));
    });
  }

  private async initializePageFromRoute(idParam: string | null): Promise<void> {
    const generation = ++this.routeLoadGeneration;
    const isCurrentRoute = () => generation === this.routeLoadGeneration;

    this.isLoading = true;
    this.activeGalleryIndex = 0;
    this.analyticsChartReady = false;
    this.productGalleryImages = [];
    this.setGalleryImagesForView([]);
    this.heroImageUrl = DEFAULT_PRODUCT_IMAGE;
    this.productId = Number(idParam);
    if (!this.productId || isNaN(this.productId)) {
      this.isLoading = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_product_id'),
        life: 3000
      });
      this.router.navigate(['/inventory/products']);
      return;
    }

    const queryParams = this.route.snapshot.queryParams;
    this.isAggregatedView = queryParams['aggregated'] === 'true' && !!queryParams['reference'];
    this.productReference = queryParams['reference'] || null;

    try {
      const [, , loaded] = await Promise.all([
        this.checkPermissions(),
        this.setUserRoles(),
        this.isAggregatedView && this.productReference && this.isAdmin
          ? this.loadAggregatedProduct()
          : this.loadProduct(),
      ]);

      if (!isCurrentRoute()) {
        return;
      }

      if (!loaded) {
        this.isLoading = false;
        return;
      }

      // Show the page as soon as core product data is ready; secondary panels load in background.
      this.isLoading = false;

      void Promise.all([
        this.loadProductImages(this.product!.productId!),
        this.loadBarcodes(),
        this.loadBatches(),
        this.loadWriteOffs(),
        this.loadProductSuppliers(),
      ]).catch((error) => console.warn('Error loading secondary product details panels', error));

      this.onGetAllCategories();
      this.onGetAllWarehouses();
      this.onGetAllSuppliers();

      if (!isCurrentRoute()) {
        return;
      }

      await this.maybeOpenAdjustStockFromQuery(queryParams);
    } catch (error) {
      console.error('Error initializing product details page', error);
      if (isCurrentRoute()) {
        this.isLoading = false;
      }
    }
  }

  /**
   * Deep link from list: `/inventory/products/:id?openAdjustStock=true`
   */
  private async maybeOpenAdjustStockFromQuery(queryParams: Record<string, unknown>): Promise<void> {
    const raw = queryParams['openAdjustStock'];
    const flag = raw === true || raw === 'true' || raw === '1' || raw === 1;
    if (!flag) return;
    if (this.isAggregatedView || !this.product || this.isService(this.product)) return;
    if (!this.canEdit && !this.isAdmin) return;

    this.openStockAdjustmentDialog();
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { openAdjustStock: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadSalesStockConfig(): Promise<void> {
    try {
      const value = await firstValueFrom(
        await this.configService.getConfigurationValue('sales.stock.include.approved.writeoff.quantity')
      );
      this.salesStockIncludesApprovedWriteoffQty = String(value).toLowerCase() === 'true';
    } catch (e) {
      console.warn('Could not load sales/write-off stock configuration for product details', e);
      this.salesStockIncludesApprovedWriteoffQty = false;
    }
  }

  async loadAggregatedProduct(): Promise<boolean> {
    try {
      this.productGalleryImages = [];
      this.syncGalleryImagesForView();
      this.productService.loadToken();
      
      if (!this.productReference) {
        // Fallback to single product if no reference provided
        return await this.loadProduct();
      }
      
      // Fetch aggregated product by reference using the new endpoint
      const response = await firstValueFrom(
        this.productService.getAggregatedProductByReference(this.productReference)
      ) as AggregatedProduct;
      
      if (response) {
        this.aggregatedProduct = response;
        this.warehouseStocks = this.aggregatedProduct.warehouseStocks || [];
        this.aggregatedCostingMethodVaries = !!this.aggregatedProduct.costingMethodVaries;

        let creationDate: Date | undefined;
        if (this.aggregatedProduct.earliestCreationDate) {
          const d = new Date(this.aggregatedProduct.earliestCreationDate);
          creationDate = isNaN(d.getTime()) ? undefined : d;
        }

        // Convert aggregated product to Product format for compatibility
        this.product = this.prepareProductForDetails({
          productId: this.warehouseStocks[0]?.productId || this.productId,
          reference: this.aggregatedProduct.reference,
          name: this.aggregatedProduct.name,
          description: this.aggregatedProduct.description,
          productType: this.aggregatedProduct.productType || 'PRODUCT',
          quantityAvailable: this.aggregatedProduct.totalQuantityAvailable,
          netAvailableQuantity: this.aggregatedProduct.totalNetAvailableQuantity,
          inventoryStatus: this.aggregatedProduct.overallInventoryStatus,
          sellingPrice: this.aggregatedProduct.sellingPrice,
          buyingPrice: this.aggregatedProduct.buyingPrice,
          productImage: this.aggregatedProduct.productImage,
          category: this.aggregatedProduct.category,
          supplier: this.aggregatedProduct.supplier,
          measureUnit: this.aggregatedProduct.measureUnit,
          expirationDate: this.aggregatedProduct.earliestExpirationDate,
          creationDate,
          costingMethod: this.aggregatedProduct.effectiveCostingMethod,
          _aggregated: true,
          _warehouseCount: this.aggregatedProduct.warehouseCount,
          _warehouseStocks: this.warehouseStocks
        } as any);
        
        this.updateChart();
        this.syncGalleryImagesForView();
        if (this.product.productId) {
          this.onGetProductPriceHistory(this.product.productId);
        }
        return true;
      } else {
        this.warehouseStocks = [];
        this.aggregatedProduct = null;
        this.aggregatedCostingMethodVaries = false;
        return await this.loadProduct();
      }
    } catch (error: any) {
      console.error('Error loading aggregated product:', error);
      // If 404, product not found with reference - fallback to single product
      if (error?.status === 404) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('product_not_found'),
          life: 3000
        });
      }
      this.warehouseStocks = [];
      this.aggregatedProduct = null;
      this.aggregatedCostingMethodVaries = false;
      return await this.loadProduct();
    }
  }

  onTabChange(event: any): void {
    console.log('onTabChange--------------------------------');
    // analytics tab index
    if (event.index === 1) {
      this.analyticsChartReady = false;
  
      setTimeout(() => {
        this.analyticsChartReady = true;
        this.updateChart();
      }, 100);
    }
  }

  async loadProduct(): Promise<boolean> {
    try {
      this.productGalleryImages = [];
      this.syncGalleryImagesForView();
      // Ensure token is loaded
      this.productService.loadToken();
      
      const response = await firstValueFrom(this.productService.getProduct(this.productId));
      
      // Handle different response formats
      if (Array.isArray(response)) {
        // If API returns an array, take the first item
        this.product = this.prepareProductForDetails(response[0] as Product);
      } else if (response && typeof response === 'object') {
        // If API returns an object directly
        this.product = this.prepareProductForDetails(response as Product);
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.product || !this.product.productId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_not_found'),
          life: 3000
        });
        this.router.navigate(['/inventory/products']);
        return false;
      }

      this.aggregatedCostingMethodVaries = false;

      this.updateChart();
      this.syncGalleryImagesForView();
      this.onGetProductPriceHistory(this.product.productId);
      return true;
    } catch (error: any) {
      console.error('Error loading product:', error);
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_product');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      // Don't navigate away immediately, let user see the error
      setTimeout(() => {
        this.router.navigate(['/inventory/products']);
      }, 2000);
      return false;
    }
  }
  
  getAggregatedWarehouseStocks(): WarehouseStockInfo[] {
    if (this.isAggregatedView && this.warehouseStocks.length > 0) {
      return this.warehouseStocks;
    }
    if (this.product && (this.product as any)._warehouseStocks) {
      return (this.product as any)._warehouseStocks;
    }
    return [];
  }
  
  viewWarehouseDetails(warehouseId: number): void {
    this.router.navigate(['/inventory/warehouses', warehouseId]);
  }

  /** Product IDs to load batches, write-offs, and barcodes (all SKUs when aggregated). */
  private getAggregatedProductIdList(): number[] {
    if (this.isAggregatedView && this.warehouseStocks?.length) {
      const ids = this.warehouseStocks
        .map(s => s.productId)
        .filter((id): id is number => id != null && !isNaN(Number(id)));
      return [...new Set(ids.map(Number))];
    }
    const pid = this.product?.productId ?? this.productId;
    return pid != null && !isNaN(Number(pid)) ? [Number(pid)] : [];
  }

  getWarehouseNameForBatch(batch: ProductBatch): string {
    if (batch.warehouseId == null) {
      return '-';
    }
    const wid = Number(batch.warehouseId);
    const stock = this.warehouseStocks.find(s => Number(s.warehouseId) === wid);
    return stock?.warehouseName || '-';
  }

  // ==================== BATCH MANAGEMENT ====================

  async loadBatches(): Promise<void> {
    // Only load batches for products (not services)
    // Note: Batches can exist without expiration dates, so we don't check for product.expirationDate
    if (!this.product || this.product.productType === 'SERVICE') {
      this.batches = [];
      return;
    }

    this.batchesLoading = true;
    try {
      this.productService.loadToken();
      const productIds = this.getAggregatedProductIdList();
      if (productIds.length === 0) {
        this.batches = [];
        return;
      }

      const mapResponseToBatches = (response: any): ProductBatch[] => {
        if (Array.isArray(response)) {
          return response.map((batch: any) => ({
            ...batch,
            expirationDate: batch.expirationDate,
            receiptDate: batch.receiptDate,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt
          }));
        }
        if (response?.content && Array.isArray(response.content)) {
          return response.content.map((batch: any) => ({
            ...batch,
            expirationDate: batch.expirationDate,
            receiptDate: batch.receiptDate
          }));
        }
        return [];
      };

      const merged: ProductBatch[] = [];
      for (const pid of productIds) {
        try {
          const response: any = await firstValueFrom(this.productService.getProductBatches(pid, this.showDepletedBatches));
          merged.push(...mapResponseToBatches(response));
        } catch (err: any) {
          if (err?.status !== 404) {
            console.error('Error loading batches for product', pid, err);
          }
        }
      }

      const byBatchId = new Map<number, ProductBatch>();
      const withoutId: ProductBatch[] = [];
      for (const b of merged) {
        if (b.batchId != null) {
          byBatchId.set(b.batchId, b);
        } else {
          withoutId.push(b);
        }
      }
      this.batches = [...byBatchId.values(), ...withoutId];

      // Sort batches by expiration date (earliest first)
      // Batches without expiration dates are sorted to the end
      this.batches.sort((a, b) => {
        // If both have expiration dates, sort by date
        if (a.expirationDate && b.expirationDate) {
          const dateA = new Date(a.expirationDate).getTime();
          const dateB = new Date(b.expirationDate).getTime();
          return dateA - dateB;
        }
        // If only a has expiration date, a comes first
        if (a.expirationDate && !b.expirationDate) {
          return -1;
        }
        // If only b has expiration date, b comes first
        if (!a.expirationDate && b.expirationDate) {
          return 1;
        }
        // If neither has expiration date, maintain original order
        return 0;
      });
    } catch (error: any) {
      console.error('Error loading batches:', error);
      // Don't show error if batches endpoint doesn't exist yet (404), just set empty array
      if (error?.status !== 404) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_loading_batches') || 'Could not load batches',
          life: 3000
        });
      }
      this.batches = [];
    } finally {
      this.batchesLoading = false;
    }
  }

  /** Toggle whether the Batches tab includes depleted / written-off lots, then reload. */
  onToggleDepletedBatches(): void {
    void this.loadBatches();
  }

  // ---------------------------------------------------------------------
  // Approved-vendor list (multi-supplier sourcing)
  // ---------------------------------------------------------------------

  private emptyVendorForm(): any {
    return {
      supplierId: null,
      supplierSku: '',
      lastPurchasePrice: null,
      leadTimeDays: null,
      minOrderQty: null,
      packSize: null,
      notes: '',
      makeDefault: false,
      active: true,
    };
  }

  /** True when the current user may add/edit/remove approved vendors. */
  get canManageVendors(): boolean {
    return !this.isAggregatedView && (this.canEdit || this.isAdmin);
  }

  /** Suppliers not yet linked to this product (for the add dialog dropdown). */
  get availableVendorSuppliers(): Supplier[] {
    const linked = new Set(this.productSuppliers.map(ps => ps.supplierId));
    return (this.suppliers || []).filter(s => !linked.has(s.supplierId));
  }

  async loadProductSuppliers(): Promise<void> {
    const pid = this.product?.productId ?? this.productId;
    if (!pid) {
      this.productSuppliers = [];
      return;
    }
    this.productSuppliersLoading = true;
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(this.productService.getProductSuppliers(pid));
      this.productSuppliers = Array.isArray(response) ? response : [];
    } catch (error: any) {
      // Silent on 404 (feature/endpoint not present): the panel simply shows empty.
      if (error?.status !== 404) {
        console.error('Error loading product suppliers:', error);
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_loading_product_suppliers') || 'Could not load suppliers',
          life: 3000,
        });
      }
      this.productSuppliers = [];
    } finally {
      this.productSuppliersLoading = false;
    }
  }

  openAddVendorDialog(): void {
    if (!this.canManageVendors) return;
    this.editingVendor = null;
    this.vendorForm = this.emptyVendorForm();
    this.vendorDialogVisible = true;
  }

  openEditVendorDialog(row: ProductSupplier): void {
    if (!this.canManageVendors) return;
    this.editingVendor = row;
    this.vendorForm = {
      supplierId: row.supplierId,
      supplierSku: row.supplierSku ?? '',
      lastPurchasePrice: row.lastPurchasePrice ?? null,
      leadTimeDays: row.leadTimeDays ?? null,
      minOrderQty: row.minOrderQty ?? null,
      packSize: row.packSize ?? null,
      notes: row.notes ?? '',
      makeDefault: !!row.defaultVendor,
      active: row.active !== false,
    };
    this.vendorDialogVisible = true;
  }

  async saveVendor(): Promise<void> {
    const pid = this.product?.productId ?? this.productId;
    if (!pid || this.vendorSaving) return;

    if (!this.editingVendor && !this.vendorForm.supplierId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('vendor_supplier_required') || 'Please select a supplier',
        life: 3000,
      });
      return;
    }

    this.vendorSaving = true;
    try {
      if (this.editingVendor?.productSupplierId) {
        await firstValueFrom(
          this.productService.updateProductSupplier(pid, this.editingVendor.productSupplierId, this.vendorForm)
        );
      } else {
        await firstValueFrom(this.productService.addProductSupplier(pid, this.vendorForm));
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('vendor_saved') || 'Supplier saved',
        life: 2500,
      });
      this.vendorDialogVisible = false;
      await this.loadProductSuppliers();
      // The default vendor may have changed; refresh the product so the header reflects it.
      await this.loadProduct();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || error?.message || this.translate.instant('error_saving_vendor') || 'Could not save supplier',
        life: 4000,
      });
    } finally {
      this.vendorSaving = false;
    }
  }

  async setDefaultVendor(row: ProductSupplier): Promise<void> {
    const pid = this.product?.productId ?? this.productId;
    if (!pid || !row.productSupplierId || row.defaultVendor || !this.canManageVendors) return;
    try {
      await firstValueFrom(this.productService.setDefaultProductSupplier(pid, row.productSupplierId));
      await this.loadProductSuppliers();
      await this.loadProduct();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_saving_vendor') || 'Could not set default supplier',
        life: 4000,
      });
    }
  }

  confirmRemoveVendor(row: ProductSupplier): void {
    const pid = this.product?.productId ?? this.productId;
    if (!pid || !row.productSupplierId || !this.canManageVendors) return;
    this.confirmationService.confirm({
      message: this.translate.instant('vendor_remove_confirm', { name: row.supplierName })
        || `Remove ${row.supplierName} from this product's suppliers?`,
      header: this.translate.instant('confirm') || 'Confirm',
      icon: 'pi pi-exclamation-triangle',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await firstValueFrom(this.productService.removeProductSupplier(pid, row.productSupplierId!));
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('vendor_removed') || 'Supplier removed',
            life: 2500,
          });
          await this.loadProductSuppliers();
          await this.loadProduct();
        } catch (error: any) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: error?.error?.message || this.translate.instant('error_removing_vendor') || 'Could not remove supplier',
            life: 4000,
          });
        }
      },
    });
  }

  getBatchStatus(batch: ProductBatch): BatchStatus {
    if (!batch.expirationDate) return 'ACTIVE';
    const expirationDate = new Date(batch.expirationDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expirationDate.setHours(0, 0, 0, 0);
    return expirationDate < today ? 'EXPIRED' : 'ACTIVE';
  }

  getBatchExpirationStatus(batch: ProductBatch): ExpirationStatus | null {
    if (!batch.expirationDate) return null; // Return null for batches without expiration dates
    return getExpirationStatus({ expirationDate: batch.expirationDate } as Product, 7);
  }

  getBatchSeverity(batch: ProductBatch): string {
    const status = this.getBatchExpirationStatus(batch);
    if (status === null) return 'secondary'; // Use secondary severity for batches without expiration dates
    return getExpirationSeverity(status);
  }

  getBatchIcon(batch: ProductBatch): string {
    const status = this.getBatchExpirationStatus(batch);
    if (status === null) return 'pi pi-info-circle'; // Use info icon for batches without expiration dates
    return getExpirationIcon(status);
  }

  formatBatchDate(date: string | null | undefined): string {
    if (!date) return '-';
    return formatExpirationDate(date) || '-';
  }

  formatBatchBuyingPrice(batch: ProductBatch): string {
    if (batch.buyingPrice != null && batch.buyingPrice !== undefined) {
      return this.formatCurrency(batch.buyingPrice);
    }
    // Show fallback indicator
    return '-';
  }

  formatCurrency(amount: number | null | undefined): string {
    if (amount == null || amount === undefined || isNaN(amount)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  hasCustomBatchPrice(batch: ProductBatch): boolean {
    // Check if batch has a custom price (different from product price or if product price is null)
    if (batch.buyingPrice == null || batch.buyingPrice === undefined) return false;
    if (!this.product || this.product.buyingPrice == null || this.product.buyingPrice === undefined) {
      return true; // Batch has price but product doesn't
    }
    // Account for floating point precision
    return Math.abs(batch.buyingPrice - this.product.buyingPrice) > 0.01;
  }

  getBatchPriceIndicator(batch: ProductBatch): string {
    if (batch.buyingPrice == null || batch.buyingPrice === undefined) return 'uses_product';
    if (this.hasCustomBatchPrice(batch)) return 'custom';
    return 'matches';
  }

  hasMultipleBatches(): boolean {
    return this.batches && this.batches.length > 1;
  }

  getTotalBatchQuantity(): number {
    return this.batches.reduce((sum, batch) => sum + (batch.quantityAvailable || 0), 0);
  }

  /** Batch storage quantity → display units (e.g. 500 → 0.5 kg) for this product. */
  getBatchDisplayQuantity(storageQuantity: number | null | undefined): number {
    return displayWarehouseStockQuantity(this.product, storageQuantity ?? 0);
  }

  formatBatchQuantity(storageQuantity: number | null | undefined): string {
    return formatLineQuantity(this.product, this.getBatchDisplayQuantity(storageQuantity));
  }

  getBatchQuantityUnit(storageQuantity: number | null | undefined): string {
    return getLineMeasureUnit(this.product, this.getBatchDisplayQuantity(storageQuantity));
  }

  formatTotalBatchQuantity(): string {
    return this.formatBatchQuantity(this.getTotalBatchQuantity());
  }

  getTotalBatchValue(): number {
    return this.batches.reduce((sum, batch) => {
      const price = batch.buyingPrice ?? this.product?.buyingPrice ?? 0;
      // price is per display unit; convert the batch's storage quantity before multiplying.
      return sum + (this.getBatchDisplayQuantity(batch.quantityAvailable) * price);
    }, 0);
  }

  // ==================== BATCH SUPPLIER METHODS ====================

  getBatchSupplier(batch: ProductBatch): string {
    if (batch.supplier?.name) {
      return batch.supplier.name;
    }
    return this.product?.supplier?.name || '-';
  }

  isSupplierDifferent(batch: ProductBatch): boolean {
    if (!batch.supplier || !this.product?.supplier) {
      return false; // Can't compare if either is null
    }
    return batch.supplier.supplierId !== this.product.supplier.supplierId;
  }

  formatBatchSupplier(batch: ProductBatch): string {
    const batchSupplier = batch.supplier?.name || null;
    const productSupplier = this.product?.supplier?.name || null;
    
    if (!batchSupplier) {
      return productSupplier ? `${productSupplier} (${this.translate.instant('from_product')})` : '-';
    }
    
    if (batchSupplier === productSupplier) {
      return `${batchSupplier} ✓`;
    }
    
    return `${batchSupplier} ⚠`;
  }

  getBatchSupplierTooltip(batch: ProductBatch): string {
    const batchSupplier = batch.supplier?.name || null;
    const productSupplier = this.product?.supplier?.name || null;
    
    if (!batchSupplier) {
      return productSupplier 
        ? this.translate.instant('batch_uses_product_supplier_tooltip', { supplier: productSupplier })
        : this.translate.instant('batch_no_supplier_tooltip');
    }
    
    if (batchSupplier === productSupplier) {
      return this.translate.instant('batch_supplier_matches_product_tooltip', { supplier: batchSupplier });
    }
    
    return this.translate.instant('batch_supplier_different_tooltip', { 
      batchSupplier: batchSupplier, 
      productSupplier: productSupplier || this.translate.instant('not_specified')
    });
  }

  // ==================== WRITE-OFFS MANAGEMENT ====================

  async loadWriteOffs(): Promise<void> {
    // Only load write-offs for products (not services)
    if (!this.product || this.product.productType === 'SERVICE') {
      this.writeOffs = [];
      return;
    }

    this.writeOffsLoading = true;
    try {
      this.writeOffService.loadToken();
      const productIds = this.getAggregatedProductIdList();
      if (productIds.length === 0) {
        this.writeOffs = [];
        return;
      }

      const mapWriteOff = (writeOff: any): InventoryWriteOff => ({
        ...writeOff,
        product: writeOff.product || (writeOff.productId ? {
          productId: writeOff.productId,
          name: writeOff.productName,
          reference: writeOff.productReference
        } : null),
        warehouse: writeOff.warehouse || (writeOff.warehouseId ? {
          warehouseId: writeOff.warehouseId,
          name: writeOff.warehouseName
        } : null),
        writeOffDate: writeOff.writeOffDate ? new Date(writeOff.writeOffDate) : null,
        approvedDate: writeOff.approvedDate ? new Date(writeOff.approvedDate) : null,
        rejectedDate: writeOff.rejectedDate ? new Date(writeOff.rejectedDate) : null,
        creationDate: writeOff.creationDate ? new Date(writeOff.creationDate) : null
      });

      const merged: InventoryWriteOff[] = [];
      for (const pid of productIds) {
        try {
          const response: any = await firstValueFrom(await this.writeOffService.getWriteOffsByProduct(pid));
          if (Array.isArray(response)) {
            merged.push(...response.map(mapWriteOff));
          }
        } catch (err: any) {
          if (err?.status !== 404) {
            console.error('Error loading write-offs for product', pid, err);
          }
        }
      }

      const byId = new Map<number, InventoryWriteOff>();
      const writeOffsWithoutId: InventoryWriteOff[] = [];
      for (const wo of merged) {
        if (wo.writeOffId != null) {
          byId.set(wo.writeOffId, wo);
        } else {
          writeOffsWithoutId.push(wo);
        }
      }
      this.writeOffs = [...byId.values(), ...writeOffsWithoutId];

      // Sort write-offs by date (most recent first)
      this.writeOffs.sort((a, b) => {
        const dateA = a.writeOffDate ? new Date(a.writeOffDate).getTime() : 0;
        const dateB = b.writeOffDate ? new Date(b.writeOffDate).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error: any) {
      console.error('Error loading write-offs:', error);
      // Don't show error if write-offs endpoint doesn't exist yet (404), just set empty array
      if (error?.status !== 404) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_loading_write_offs') || 'Could not load write-offs',
          life: 3000
        });
      }
      this.writeOffs = [];
    } finally {
      this.writeOffsLoading = false;
    }
  }

  getWriteOffStatusSeverity(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'PENDING') return 'warning';
    if (s === 'APPROVED') return 'success';
    if (s === 'REJECTED') return 'danger';
    return '';
  }

  getWriteOffConditionSeverity(condition: string | undefined): string {
    if (!condition) return '';
    const c = condition.toUpperCase();
    if (c === 'DAMAGED' || c === 'UNUSABLE') return 'danger';
    if (c === 'LOST') return 'warn';
    if (c === 'EXPIRED') return 'info';
    return '';
  }

  getWriteOffConditionLabel(condition: string | undefined): string {
    if (!condition) return 'N/A';
    const key = `item_condition_${condition.toLowerCase()}`;
    return this.translate.instant(key) || condition;
  }

  getWriteOffSourceTypeLabel(sourceType: string | undefined): string {
    if (!sourceType) return 'N/A';
    const key = `write_off_source_type_${sourceType.toLowerCase().replace(/_/g, '_')}`;
    return this.translate.instant(key) || sourceType;
  }

  formatWriteOffDate(date: Date | string | null | undefined): string {
    if (!date) return '-';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString();
    } catch {
      return String(date);
    }
  }

  formatWriteOffCurrency(amount: number | null | undefined): string {
    if (amount == null || amount === undefined || isNaN(amount)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  /** Storage quantity → display quantity for this product (e.g. 500 → 0.5 kg for fractional). */
  getWriteOffDisplayQuantity(writeOff: InventoryWriteOff): number {
    if (writeOff?.displayQuantity != null) {
      return writeOff.displayQuantity;
    }
    return displayWarehouseStockQuantity(this.product, writeOff?.quantity ?? 0);
  }

  /** Formatted display quantity (respects fractional precision) for the write-offs table. */
  formatWriteOffQuantity(writeOff: InventoryWriteOff): string {
    if (writeOff?.quantityLabel) {
      return writeOff.quantityLabel;
    }
    return formatLineQuantity(this.product, this.getWriteOffDisplayQuantity(writeOff));
  }

  /** Translatable unit key for a write-off quantity ('' when no unit should be shown). */
  getWriteOffQuantityUnit(writeOff: InventoryWriteOff): string {
    if (writeOff?.quantityLabel) {
      return '';
    }
    return getLineMeasureUnit(this.product, this.getWriteOffDisplayQuantity(writeOff));
  }

  getTotalWriteOffQuantity(): number {
    return this.writeOffs.reduce((sum, wo) => sum + this.getWriteOffDisplayQuantity(wo), 0);
  }

  /** On-hand quantity in display units (e.g. 0.5 kg) for stock-value calculations. */
  private onHandDisplayQuantity(): number {
    return displayWarehouseStockQuantity(this.product, this.product?.quantityAvailable ?? 0);
  }

  /** Convert any storage quantity for this product to display units (e.g. 500 → 0.5 kg). */
  displayStockQuantity(storageQuantity: number | null | undefined): number {
    return displayWarehouseStockQuantity(this.product, storageQuantity ?? 0);
  }

  formatStockQuantity(storageQuantity: number | null | undefined): string {
    return formatLineQuantity(this.product, this.displayStockQuantity(storageQuantity));
  }

  getStockQuantityUnit(storageQuantity: number | null | undefined): string {
    return getLineMeasureUnit(this.product, this.displayStockQuantity(storageQuantity));
  }

  /** Buying-price valuation: unit price is per display unit, so multiply by display quantity. */
  getStockBuyingValue(): number {
    return (this.product?.buyingPrice || 0) * this.onHandDisplayQuantity();
  }

  getStockSellingValue(): number {
    return (this.product?.sellingPrice || 0) * this.onHandDisplayQuantity();
  }

  getStockProfitValue(): number {
    return ((this.product?.sellingPrice || 0) - (this.product?.buyingPrice || 0)) * this.onHandDisplayQuantity();
  }

  formatTotalWriteOffQuantity(): string {
    return formatLineQuantity(this.product, this.getTotalWriteOffQuantity());
  }

  getTotalWriteOffQuantityUnit(): string {
    return getLineMeasureUnit(this.product, this.getTotalWriteOffQuantity());
  }

  getTotalWriteOffCost(): number {
    return this.writeOffs.reduce((sum, wo) => sum + (wo.writeOffCost || 0), 0);
  }

  viewWriteOffDetails(writeOff: InventoryWriteOff) {
    if (!writeOff.writeOffId) return;
    this.router.navigate(['/inventory/write-offs', writeOff.writeOffId]);
  }

  getWriteOffReasonLabel(reason: string | undefined): string {
    if (!reason) return '-';
    // Check if reason is a predefined value (uppercase) that needs translation
    const upperReason = reason.toUpperCase().trim();
    const translationKey = `write_off_reason_${upperReason.toLowerCase()}`;
    const translated = this.translate.instant(translationKey);
    
    // If translation exists and is different from the key, use it
    if (translated && translated !== translationKey) {
      return translated;
    }
    
    // If it's a predefined reason value, try common reason translations
    if (upperReason === 'DEFECTIVE') {
      return this.translate.instant('return_reason_defective') || reason;
    }
    if (upperReason === 'INCORRECT_ITEM') {
      return this.translate.instant('return_reason_incorrect_item') || reason;
    }
    if (upperReason === 'CHANGE_OF_MIND') {
      return this.translate.instant('return_reason_change_of_mind') || reason;
    }
    if (upperReason === 'OTHER') {
      return this.translate.instant('return_reason_other') || reason;
    }
    
    // For custom reasons, return as-is
    return reason;
  }

  // ==================== BARCODE MANAGEMENT ====================

  initAutoGenerateMenuItems(): void {
    this.autoGenerateMenuItems = [
      { 
        label: this.translate.instant('auto_generate_barcode'), 
        icon: 'pi pi-bolt', 
        command: () => this.autoGenerateBarcode('BARCODE') 
      },
      { 
        label: this.translate.instant('auto_generate_qrcode'), 
        icon: 'pi pi-qrcode', 
        command: () => this.autoGenerateBarcode('QRCODE') 
      }
    ];
    
    this.barcodeTypes = [
      { label: this.translate.instant('barcode_1d'), value: 'BARCODE' },
      { label: this.translate.instant('qr_code_2d'), value: 'QRCODE' }
    ];
    
    this.labelSizeOptions = [
      { value: '2x1', label: '2" x 1" (' + this.translate.instant('label_size_small') + ')', width: 2, height: 1 },
      { value: '3x1', label: '3" x 1" (' + this.translate.instant('label_size_standard') + ')', width: 3, height: 1 },
      { value: '4x2', label: '4" x 2" (' + this.translate.instant('label_size_large') + ')', width: 4, height: 2 },
      { value: 'CUSTOM', label: this.translate.instant('label_size_custom'), width: 0, height: 0 },
    ];
  }

  async loadBarcodes(): Promise<void> {
    const productIds = this.getAggregatedProductIdList();
    if (productIds.length === 0) return;

    this.barcodesLoading = true;
    try {
      this.barcodeService.loadToken();
      const merged: BarcodeResponseDTO[] = [];
      for (const pid of productIds) {
        try {
          const list = await firstValueFrom(this.barcodeService.getProductBarcodes(pid));
          if (Array.isArray(list)) {
            merged.push(...list);
          }
        } catch (err: any) {
          if (err?.status !== 404) {
            console.error('Error loading barcodes for product', pid, err);
          }
        }
      }
      const byBarcodeId = new Map<number, BarcodeResponseDTO>();
      for (const b of merged) {
        if (b.barcodeId != null) {
          byBarcodeId.set(b.barcodeId, b);
        }
      }
      this.barcodes = Array.from(byBarcodeId.values());
    } catch (error: any) {
      console.error('Error loading barcodes:', error);
      // Don't show error if no barcodes exist
      if (error?.status !== 404) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_barcodes'),
          life: 3000
        });
      }
      this.barcodes = [];
    } finally {
      this.barcodesLoading = false;
    }
  }

  openGenerateBarcodeDialog(): void {
    this.newBarcodeType = 'BARCODE';
    this.newBarcodeFormat = 'CODE_128';
    this.newBarcodeCustomValue = '';
    this.newBarcodeLabel = '';
    this.newBarcodeIsPrimary = this.barcodes.length === 0; // First barcode is primary
    this.currentFormats = this.barcodeFormats;
    this.generateBarcodeDialog = true;
  }

  onBarcodeTypeChange(): void {
    if (this.newBarcodeType === 'BARCODE') {
      this.currentFormats = this.barcodeFormats;
      this.newBarcodeFormat = 'CODE_128';
    } else {
      this.currentFormats = this.qrcodeFormats;
      this.newBarcodeFormat = 'QR_CODE';
    }
  }

  async generateBarcode(): Promise<void> {
    const targetProductId = this.product?.productId ?? this.productId;
    if (!targetProductId) return;

    this.isGenerating = true;
    try {
      const request: BarcodeRequestDTO = {
        productId: targetProductId,
        barcodeType: this.newBarcodeType,
        barcodeFormat: this.newBarcodeFormat,
        isPrimary: this.newBarcodeIsPrimary
      };
      
      if (this.newBarcodeCustomValue.trim()) {
        request.customValue = this.newBarcodeCustomValue.trim();
      }
      
      if (this.newBarcodeLabel.trim()) {
        request.label = this.newBarcodeLabel.trim();
      }
      
      const newBarcode = await firstValueFrom(this.barcodeService.generateBarcode(request));
      this.barcodes.push(newBarcode);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('barcode_generated_successfully'),
        life: 3000
      });
      
      this.generateBarcodeDialog = false;
    } catch (error: any) {
      console.error('Error generating barcode:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_generating_barcode'),
        life: 4000
      });
    } finally {
      this.isGenerating = false;
    }
  }

  async autoGenerateBarcode(type: BarcodeType = 'BARCODE'): Promise<void> {
    const targetProductId = this.product?.productId ?? this.productId;
    if (!targetProductId) return;

    this.barcodesLoading = true;
    try {
      const newBarcode = await firstValueFrom(this.barcodeService.autoGenerateBarcode(targetProductId, type));
      this.barcodes.push(newBarcode);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('barcode_generated_successfully'),
        life: 3000
      });
    } catch (error: any) {
      console.error('Error auto-generating barcode:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_generating_barcode'),
        life: 4000
      });
    } finally {
      this.barcodesLoading = false;
    }
  }

  confirmDeleteBarcode(barcode: BarcodeResponseDTO): void {
    this.confirmationService.confirm({
      message: this.translate.instant('delete_barcode_confirmation'),
      header: this.translate.instant('confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteBarcode(barcode)
    });
  }

  async deleteBarcode(barcode: BarcodeResponseDTO): Promise<void> {
    try {
      await firstValueFrom(this.barcodeService.deleteBarcode(barcode.barcodeId));
      this.barcodes = this.barcodes.filter(b => b.barcodeId !== barcode.barcodeId);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('barcode_deleted_successfully'),
        life: 3000
      });
    } catch (error: any) {
      console.error('Error deleting barcode:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_deleting_barcode'),
        life: 4000
      });
    }
  }

  async setPrimaryBarcode(barcode: BarcodeResponseDTO): Promise<void> {
    try {
      await firstValueFrom(this.barcodeService.setPrimaryBarcode(barcode.barcodeId));
      
      // Update local state
      this.barcodes.forEach(b => b.isPrimary = false);
      const updatedBarcode = this.barcodes.find(b => b.barcodeId === barcode.barcodeId);
      if (updatedBarcode) {
        updatedBarcode.isPrimary = true;
      }
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('primary_barcode_set'),
        life: 3000
      });
    } catch (error: any) {
      console.error('Error setting primary barcode:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_setting_primary_barcode'),
        life: 4000
      });
    }
  }

  downloadBarcode(barcode: BarcodeResponseDTO): void {
    const filename = `${this.product?.name || 'barcode'}-${barcode.barcodeValue}`;
    this.barcodeService.downloadBarcodeImage(barcode.barcodeId, filename);
  }

  printSingleBarcode(barcode: BarcodeResponseDTO): void {
    this.selectedBarcodesForPrint = [barcode];
    this.barcodeService.printBarcodes([barcode.barcodeId], this.selectedLabelSize, this.printColumns);
  }

  openPrintDialog(): void {
    this.selectedBarcodesForPrint = [...this.barcodes];
    this.printBarcodesDialog = true;
  }

  printSelectedBarcodes(): void {
    if (this.selectedBarcodesForPrint.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_barcodes_to_print'),
        life: 3000
      });
      return;
    }
    
    const barcodeIds = this.selectedBarcodesForPrint.map(b => b.barcodeId);
    this.barcodeService.printBarcodes(barcodeIds, this.selectedLabelSize, this.printColumns);
    this.printBarcodesDialog = false;
  }

  getBarcodeImageUrl(barcode: BarcodeResponseDTO): string {
    return this.barcodeService.base64ToImageUrl(barcode.imageBase64);
  }

  getPrimaryBarcode(): BarcodeResponseDTO | null {
    return this.barcodes.find(b => b.isPrimary) || this.barcodes[0] || null;
  }

  // ==================== EXISTING METHODS ====================

  updateChart() {
    if (!this.product) return;

    const buyingPrice = Math.max(Number(this.product.buyingPrice || 0), 0);
    const sellingPrice = Math.max(Number(this.product.sellingPrice || 0), 0);
    const profitValue = sellingPrice - buyingPrice;
    const secondSliceValue = Math.abs(profitValue);
    const costLabel = this.translate.instant('cost');
    const profitLabel = profitValue >= 0 ? this.translate.instant('profit') : this.translate.instant('loss');

    this.profitChartData = {
      labels: [costLabel, profitLabel],
      datasets: [
        {
          data: [buyingPrice, secondSliceValue],
          backgroundColor: [
            BRAND_PROFIT_CHART.cost,
            profitValue >= 0 ? BRAND_PROFIT_CHART.profit : BRAND_PROFIT_CHART.loss,
          ],
          hoverBackgroundColor: [
            BRAND_PROFIT_CHART.costHover,
            profitValue >= 0 ? BRAND_PROFIT_CHART.profitHover : BRAND_PROFIT_CHART.lossHover,
          ]
        }
      ]
    };

    this.chartOptions = {
      cutout: '70%',
      responsive: false,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    };
  }

  // onAnalyticsTabOpen(): void {
  //   console.log('onAnalyticsTabOpen--------------------------------');
  //   if (this.analyticsChartReady) return;
  //   setTimeout(() => {
  //     this.analyticsChartReady = true;
  //     this.updateChart();
  //   }, 150);
  // }

  onGetProductPriceHistory(productId: number): void {
    this.productService.getProductPriceHistory(productId).subscribe({
      next: (response: any) => {
        this.productPriceHistory = response;
        console.log('Product price history loaded:', this.productPriceHistory);
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_price_history'),
          life: 3000,
        });
        console.error('Error fetching product price history:', err);
      },
    });
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await firstValueFrom(this.permissionService.init(userId));
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canArchive = this.permissionService.canArchive(this.Ressource);
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
    this.isWarehouseman = this.userRoles.includes('WAREHOUSEMAN');
    this.isVendor = this.userRoles.includes('VENDOR');
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    return 'success';
  }

  getMeasureUnit(unit: string, quantity: number): string {
    return getMeasureUnit(unit, quantity);
  }

  calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

  getEffectiveCostingMethodLabel(product: Product): string {
    const costingMethods = [
      { value: 'FIFO', label: this.translate.instant('costing_method_fifo') },
      { value: 'LIFO', label: this.translate.instant('costing_method_lifo') },
      { value: 'WEIGHTED_AVERAGE', label: this.translate.instant('costing_method_weighted_average') },
      { value: 'STANDARD_COST', label: this.translate.instant('costing_method_standard_cost') },
      { value: 'NONE', label: this.translate.instant('costing_method_none') }
    ];

    if (product.costingMethod) {
      const method = costingMethods.find(m => m.value === product.costingMethod);
      return method?.label || product.costingMethod;
    } else if (product.category?.costingMethod && product.category.costingMethod !== 'NONE') {
      const method = costingMethods.find(m => m.value === product.category?.costingMethod);
      const methodLabel = method?.label || product.category.costingMethod;
      return this.translate.instant('costing_method_inherited_from_category').replace('{{method}}', methodLabel);
    } else if (product.warehouse?.organization?.costingMethod && product.warehouse.organization.costingMethod !== 'NONE') {
      const method = costingMethods.find(m => m.value === product.warehouse?.organization?.costingMethod);
      const methodLabel = method?.label || product.warehouse.organization.costingMethod;
      return this.translate.instant('costing_method_inherited_from_organization').replace('{{method}}', methodLabel);
    } else {
      return this.translate.instant('costing_method_none');
    }
  }

  isService(product: Product): boolean {
    if (!product) return false;
    return product.productType === 'SERVICE';
  }

  isProduct(product: Product): boolean {
    if (!product) return false;
    return !product.productType || product.productType === 'PRODUCT';
  }

  // Write-off integration helpers
  getAvailableQuantity(product: Product): number {
    return getAvailableQuantity(product);
  }

  hasWriteOffs(product: Product): boolean {
    return hasWriteOffs(product);
  }

  getWriteOffQuantity(product: Product): number {
    return getWriteOffQuantity(product);
  }

  getExpirationInfo(product: Product) {
    return getExpirationInfo(product);
  }

  formatExpirationDate(expirationDate: string | Date | null | undefined): string | null {
    return formatExpirationDate(expirationDate);
  }

  getExpirationStatus(product: Product): ExpirationStatus {
    return getExpirationStatus(product);
  }

  getExpirationSeverity(status: ExpirationStatus): string {
    return getExpirationSeverity(status);
  }

  getExpirationIcon(status: ExpirationStatus): string {
    return getExpirationIcon(status);
  }

  // Expose Math for template
  Math = Math;

  getProductImage(product: Product | null | undefined): string {
    return this.normalizeImageUrl(getPreferredProductImageUrl(product));
  }

  selectGalleryImage(index: number): void {
    if (index < 0 || index >= this.galleryImagesForView.length) {
      return;
    }
    this.activeGalleryIndex = index;
  }

  trackGalleryImage(_index: number, imageUrl: string): string {
    return imageUrl;
  }

  private syncGalleryImagesForView(): void {
    if (!this.product) {
      this.heroImageUrl = DEFAULT_PRODUCT_IMAGE;
      this.setGalleryImagesForView([]);
      return;
    }

    if (this.productGalleryImages.length > 0) {
      this.heroImageUrl = this.productGalleryImages[0];
      this.setGalleryImagesForView(this.productGalleryImages);
      return;
    }

    const gallery = Array.isArray((this.product as any).productImages)
      ? (this.product as any).productImages
          .map((img: any) => resolvePublicAssetUrl(img?.imageUrl))
          .filter((url: string) => !!url)
      : [];

    if (gallery.length > 0) {
      const safeGallery = this.safeUniqueImageUrls(gallery);
      this.heroImageUrl = safeGallery[0] || this.getProductImage(this.product);
      this.setGalleryImagesForView(safeGallery.length > 0 ? safeGallery : [this.heroImageUrl]);
      return;
    }

    const fallback = this.getProductImage(this.product);
    this.heroImageUrl = fallback;
    this.setGalleryImagesForView(fallback ? [fallback] : []);
  }

  private setGalleryImagesForView(urls: string[]): void {
    const next = urls.length > 0 ? [...urls] : [];
    if (this.galleryUrlsEqual(this.galleryImagesForView, next)) {
      return;
    }
    this.galleryImagesForView = next;
    if (this.activeGalleryIndex >= next.length) {
      this.activeGalleryIndex = 0;
    }
  }

  private galleryUrlsEqual(current: string[], next: string[]): boolean {
    if (current.length !== next.length) {
      return false;
    }
    return current.every((url, index) => url === next[index]);
  }

  private async loadProductImages(productId: number): Promise<void> {
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(
        this.productService.getProductImages(productId).pipe(
          takeUntil(this.destroy$)
        )
      );
      const gallery = Array.isArray(response)
        ? response
            .map((img: any) => resolvePublicAssetUrl(img?.imageUrl))
            .filter((url: string) => !!url)
        : [];
      this.productGalleryImages = this.safeUniqueImageUrls(gallery);
    } catch (error) {
      this.productGalleryImages = [];
      console.warn('Could not load product gallery images for details page', error);
    } finally {
      this.syncGalleryImagesForView();
    }
  }

  private prepareProductForDetails(product: Product): Product {
    if (!product) {
      return product;
    }

    return {
      ...product,
      productImage: this.normalizeImageUrl(product.productImage),
      productImages: this.safeProductImageRows((product as any).productImages)
    } as Product;
  }

  private safeProductImageRows(images: unknown): unknown[] {
    if (!Array.isArray(images)) {
      return [];
    }

    return images
      .map((img: any) => ({
        ...img,
        imageUrl: this.normalizeImageUrl(img?.imageUrl)
      }))
      .filter((img: any) => !!img.imageUrl);
  }

  private safeUniqueImageUrls(urls: string[]): string[] {
    return Array.from(new Set(
      urls
        .map(url => this.normalizeImageUrl(url))
        .filter(url => !!url)
    ));
  }

  private normalizeImageUrl(rawUrl: unknown): string {
    const resolved = resolvePublicAssetUrl(rawUrl);
    if (!resolved) {
      return '';
    }

    if (this.isOversizedInlineImage(resolved)) {
      return '';
    }

    return resolved;
  }

  private isOversizedInlineImage(url: string): boolean {
    return /^data:image\//i.test(url) && url.length > MAX_INLINE_IMAGE_URL_LENGTH;
  }

  displayAttributeValue(attr: any): string {
    if (!attr) return '';
    switch (attr.attributeType) {
      case 'BOOLEAN':
        return attr.booleanValue ? 'Yes' : 'No';
      case 'INTEGER':
        return attr.intValue?.toString() || '';
      case 'DOUBLE':
        return attr.doubleValue?.toFixed(2) || '';
      default:
        return attr.stringValue || '';
    }
  }

  goBack(): void {
    this.location.back();
  }

  editProduct(): void {
    if ((!this.canEdit && !this.isAdmin) || !this.product) return;
    this.productForForm = null;
    // Ensure form data is loaded
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
  }

  /**
   * Open product form for one warehouse SKU (aggregated product details only).
   */
  async editAggregatedWarehouseSku(stock: WarehouseStockInfo): Promise<void> {
    if ((!this.canEdit && !this.isAdmin) || !stock?.productId) {
      return;
    }
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(this.productService.getProduct(stock.productId));
      const loaded = (Array.isArray(response) ? response[0] : response) as Product;
      if (!loaded?.productId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_not_found'),
          life: 3000,
        });
        return;
      }
      this.productForForm = loaded;
      this.onGetAllCategories();
      this.onGetAllWarehouses();
      this.onGetAllSuppliers();
      this.productDialog = true;
    } catch (e) {
      console.error('Error loading product for warehouse edit:', e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_products'),
        life: 3000,
      });
    }
  }

  hideProductDialog(): void {
    this.productDialog = false;
    this.productForForm = null;
  }

  /** Entity passed to `app-product-form` (warehouse SKU when editing from aggregated breakdown). */
  effectiveProductForForm(): Product {
    return (this.productForForm ?? this.product) as Product;
  }

  openStockAdjustmentDialog(): void {
    if (!this.product || this.isService(this.product)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('services_cannot_have_quantity'),
        life: 3000
      });
      return;
    }
    this.stockAdjustmentTarget = null;
    this.quantityChange = 0;
    this.adjustmentReason = '';
    this.stockAdjustmentDialog = true;
  }

  /**
   * Adjust stock for one warehouse line (aggregated product details).
   */
  async openStockAdjustmentForWarehouseSku(stock: WarehouseStockInfo): Promise<void> {
    if ((!this.canEdit && !this.isAdmin) || !stock?.productId) {
      return;
    }
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(this.productService.getProduct(stock.productId));
      const loaded = (Array.isArray(response) ? response[0] : response) as Product;
      if (!loaded?.productId || this.isService(loaded)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('product_not_found'),
          life: 3000,
        });
        return;
      }
      this.stockAdjustmentTarget = loaded;
      this.quantityChange = 0;
      this.adjustmentReason = '';
      this.stockAdjustmentDialog = true;
    } catch (e) {
      console.error('Error loading product for stock adjustment:', e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_products'),
        life: 3000,
      });
    }
  }

  /** Product used inside the stock adjustment dialog (single SKU). */
  stockAdjustmentContext(): Product | null {
    return this.stockAdjustmentTarget ?? this.product;
  }

  closeStockAdjustmentDialog(): void {
    this.stockAdjustmentDialog = false;
    this.stockAdjustmentTarget = null;
    this.quantityChange = 0;
    this.adjustmentReason = '';
  }

  /** Current stock in display units (e.g. 30 L instead of 30000 mL). */
  getAdjustCurrentDisplay(): number {
    const p = this.stockAdjustmentContext();
    if (!p) return 0;
    return displayWarehouseStockQuantity(p, p.quantityAvailable ?? 0);
  }

  /** Formatted current stock for the dialog header. */
  getAdjustCurrentFormatted(): string {
    const p = this.stockAdjustmentContext();
    if (!p) return '0';
    return formatLineQuantity(p, this.getAdjustCurrentDisplay());
  }

  /** Unit label for current/new stock display. */
  getAdjustUnit(): string {
    return getLineMeasureUnit(this.stockAdjustmentContext(), this.getAdjustCurrentDisplay()) ?? '';
  }

  /** Minimum allowed input value (negative = max decrease to 0). */
  getAdjustMin(): number {
    return -this.getAdjustCurrentDisplay();
  }

  /** Input step for fractional/prepaid products (e.g. 0.001 L). */
  getAdjustStep(): number {
    return lineQuantityStep(this.stockAdjustmentContext());
  }

  /** Decimal places for the input. */
  getAdjustDecimals(): number {
    return lineQuantityDecimals(this.stockAdjustmentContext());
  }

  /** Projected stock in display units after applying quantityChange (display units). */
  getNewQuantity(): number {
    return this.getAdjustCurrentDisplay() + this.quantityChange;
  }

  canAdjustStock(): boolean {
    if (this.quantityChange === 0) return false;
    return this.getNewQuantity() >= 0;
  }

  async adjustStock(): Promise<void> {
    const ctx = this.stockAdjustmentContext();
    if (!ctx || !this.canAdjustStock()) return;

    // Validate
    if (this.quantityChange === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('quantity_change_cannot_be_zero'),
        life: 3000
      });
      return;
    }

    const newQuantity = this.getNewQuantity();
    if (newQuantity < 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('cannot_decrease_stock_below_zero').replace('{0}', this.getAdjustCurrentDisplay().toString()).replace('{1}', this.quantityChange.toString()),
        life: 4000
      });
      return;
    }

    // Convert display-unit change → storage-unit change before sending to backend
    const storageChange = toWriteOffStorageQuantity(ctx, Math.abs(this.quantityChange)) * Math.sign(this.quantityChange);

    this.isAdjustingStock = true;
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(
        this.productService.adjustStock(
          ctx.productId!,
          storageChange,
          this.adjustmentReason
        )
      );

      if (response && typeof response === 'object' && !this.isAggregatedView) {
        this.product = response as Product;
      }

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('stock_adjusted_successfully'),
        life: 3000
      });

      this.closeStockAdjustmentDialog();
      if (this.isAggregatedView && this.productReference) {
        await this.loadAggregatedProduct();
      } else {
        await this.loadProduct();
      }
      await this.loadBatches();
      await this.loadWriteOffs();
    } catch (error: any) {
      console.error('Error adjusting stock:', error);
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_adjusting_stock');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 4000
      });
    } finally {
      this.isAdjustingStock = false;
    }
  }

  quickAdjustStock(change: number): void {
    // Accumulate onto the running change so repeated taps keep adjusting
    // (e.g. tapping +1 three times = +3) instead of resetting to a fixed value.
    const decimals = this.getAdjustDecimals();
    const factor = Math.pow(10, decimals);
    const min = this.getAdjustMin();
    let next = Math.round((this.quantityChange + change) * factor) / factor;
    if (next < min) {
      next = min;
    }
    this.quantityChange = next;
    // Optionally auto-fill reason for quick adjustments
    if (!this.adjustmentReason) {
      if (change > 0) {
        this.adjustmentReason = this.translate.instant('quick_adjustment_add');
      } else {
        this.adjustmentReason = this.translate.instant('quick_adjustment_remove');
      }
    }
  }

  async onProductFormSaveSuccess(productData: Product): Promise<void> {
    console.log('Product form saved successfully:', productData);
    this.productForForm = null;
    this.productDialog = false;
    if (this.isAggregatedView && this.productReference) {
      await this.loadAggregatedProduct();
    } else {
      await this.loadProduct();
    }
    await this.loadBarcodes();
    await this.loadBatches();
    await this.loadWriteOffs();
  }

  onProductFormSaveError(event: { product: Product, error: any }): void {
    console.error('Product form save error:', event.error);
    // Error message is already displayed by the form component
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories().subscribe({
      next: (response: any) => {
        this.categories = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_categories'),
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  async onGetAllWarehouses() {
    await this.warehouseService.getWarehouses().subscribe({
      next: (response: any) => {
        this.warehouses = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_warehouses'),
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers().subscribe({
      next: (response: any) => {
        this.suppliers = response;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_suppliers'),
          life: 3000,
        });
        console.log(err);
      },
    });
  }

  openCategoryDialog(): void {
    // Navigate to categories page or open category dialog
    this.router.navigate(['/inventory/categories']);
  }

  openSupplierDialog(): void {
    // Navigate to suppliers page or open supplier dialog
    this.router.navigate(['/inventory/suppliers']);
  }

  openWarehouseDialog(): void {
    // Navigate to warehouses page or open warehouse dialog
    this.router.navigate(['/inventory/warehouses']);
  }

  deleteProduct(): void {
    if (!this.productId || !this.canDelete) return;
    this.deleteProductDialog = true;
  }

  onProductDeleteConfirmed(productId: number): void {
    if (!this.canDelete) return;
    this.performDeleteProduct(productId, false);
  }

  onProductForceDeleteConfirmed(productId: number): void {
    if (!this.canDelete || !this.isAdmin) return;
    this.performDeleteProduct(productId, true);
  }

  private performDeleteProduct(productId: number, force: boolean): void {
    this.productService.deleteProduct(productId, force).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('product_deleted'),
          life: 3000
        });
        this.router.navigate(['/inventory/products']);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_deleting_product'),
          life: 3000
        });
      }
    });
  }

  archiveProduct(): void {
    if (!this.canArchive) return;
    this.archiveProductDialog = true;
  }

  confirmArchiveProduct(): void {
    if (!this.canArchive) return;
    this.productService.deactivateProduct(this.productId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('product_archived'),
          life: 3000
        });
        this.router.navigate(['/inventory/products']);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_archiving_product'),
          life: 3000
        });
      }
    });
  }
}
