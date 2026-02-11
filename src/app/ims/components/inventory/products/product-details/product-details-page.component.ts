import { Component, OnInit } from '@angular/core';
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
import { firstValueFrom } from 'rxjs';
import { getMeasureUnit, getAvailableQuantity, hasWriteOffs, getWriteOffQuantity } from 'src/app/shared/product-utils';
import { getExpirationInfo, formatExpirationDate, getExpirationStatus, getExpirationSeverity, getExpirationIcon, ExpirationStatus } from 'src/app/shared/product-expiration.utils';
import { ProductBatch, BatchStatus } from 'src/app/models/productBatch';
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

@Component({
  selector: 'app-product-details-page',
  templateUrl: './product-details-page.component.html',
  styleUrls: ['./product-details-page.component.css', '../products.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class ProductDetailsPageComponent implements OnInit {
  productId!: number;
  product: Product | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "PRODUCTS";
  
  // Aggregated product support
  isAggregatedView: boolean = false;
  productReference: string | null = null;
  aggregatedProduct: AggregatedProduct | null = null;
  warehouseStocks: WarehouseStockInfo[] = [];

  // Product form properties
  productDialog: boolean = false;
  categories: Category[] = [];
  suppliers: Supplier[] = [];
  warehouses: Warehouse[] = [];
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;
  canAddWarehouse: boolean = false;

  profitChartData: any;
  chartOptions: any;
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

  // Stock Adjustment
  stockAdjustmentDialog: boolean = false;
  quantityChange: number = 0;
  adjustmentReason: string = '';
  isAdjustingStock: boolean = false;

  // Batch Management
  batches: ProductBatch[] = [];
  batchesLoading: boolean = false;

  // Write-Offs Management
  writeOffs: InventoryWriteOff[] = [];
  writeOffsLoading: boolean = false;

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
    private writeOffService: WriteOffService
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
    this.isLoading = true;
    
    // Load token first
    this.productService.loadToken();
    this.barcodeService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.initAutoGenerateMenuItems();
    });
    
    this.initAutoGenerateMenuItems();

    // Combine params and queryParams subscriptions
    this.route.params.subscribe(async params => {
      this.productId = +params['id'];
      if (!this.productId || isNaN(this.productId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_product_id'),
          life: 3000
        });
        this.router.navigate(['/inventory/products']);
        return;
      }
      
      // Get query params synchronously
      const queryParams = this.route.snapshot.queryParams;
      this.isAggregatedView = queryParams['aggregated'] === 'true' && !!queryParams['reference'];
      this.productReference = queryParams['reference'] || null;
      
      await this.checkPermissions();
      await this.setUserRoles();
      
      // Load aggregated product if reference is provided, otherwise load single product
      if (this.isAggregatedView && this.productReference && this.isAdmin) {
        await this.loadAggregatedProduct();
      } else {
        await this.loadProduct();
      }
      
      await this.loadBarcodes();
      await this.loadBatches(); // Load batches for products with expiration dates
      await this.loadWriteOffs(); // Load write-offs for products
      // Load form data when needed
      await this.onGetAllCategories();
      await this.onGetAllWarehouses();
      await this.onGetAllSuppliers();
    });
  }

  async loadAggregatedProduct(): Promise<void> {
    try {
      this.productService.loadToken();
      
      if (!this.productReference) {
        // Fallback to single product if no reference provided
        await this.loadProduct();
        return;
      }
      
      // Fetch aggregated product by reference using the new endpoint
      const response = await firstValueFrom(
        this.productService.getAggregatedProductByReference(this.productReference)
      ) as AggregatedProduct;
      
      if (response) {
        this.aggregatedProduct = response;
        this.warehouseStocks = this.aggregatedProduct.warehouseStocks || [];
        
        // Convert aggregated product to Product format for compatibility
        this.product = {
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
          _aggregated: true,
          _warehouseCount: this.aggregatedProduct.warehouseCount,
          _warehouseStocks: this.warehouseStocks
        } as any;
        
        this.updateChart();
        if (this.product.productId) {
          this.onGetProductPriceHistory(this.product.productId);
        }
        this.isLoading = false;
      } else {
        // Fallback to single product if aggregated not found
        await this.loadProduct();
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
      // Fallback to single product on error
      await this.loadProduct();
    }
  }

  async loadProduct(): Promise<void> {
    try {
      // Ensure token is loaded
      this.productService.loadToken();
      
      const response = await firstValueFrom(this.productService.getProduct(this.productId));
      console.log('Product API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        // If API returns an array, take the first item
        this.product = response[0] as Product;
      } else if (response && typeof response === 'object') {
        // If API returns an object directly
        this.product = response as Product;
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
        return;
      }

      this.updateChart();
      this.onGetProductPriceHistory(this.product.productId);
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading product:', error);
      this.isLoading = false;
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
      const response: any = await firstValueFrom(this.productService.getProductBatches(this.productId));
      
      if (Array.isArray(response)) {
        this.batches = response.map((batch: any) => ({
          ...batch,
          expirationDate: batch.expirationDate,
          receiptDate: batch.receiptDate,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt
        }));
      } else if (response && response.content && Array.isArray(response.content)) {
        // Handle paginated response
        this.batches = response.content.map((batch: any) => ({
          ...batch,
          expirationDate: batch.expirationDate,
          receiptDate: batch.receiptDate
        }));
      } else {
        this.batches = [];
      }

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

  getTotalBatchValue(): number {
    return this.batches.reduce((sum, batch) => {
      const price = batch.buyingPrice ?? this.product?.buyingPrice ?? 0;
      return sum + ((batch.quantityAvailable || 0) * price);
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
      const response: any = await firstValueFrom(await this.writeOffService.getWriteOffsByProduct(this.productId));
      
      if (Array.isArray(response)) {
        this.writeOffs = response.map((writeOff: any) => ({
          ...writeOff,
          // Handle flat format from backend (productId, warehouseId, productName, warehouseName)
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
        }));
      } else {
        this.writeOffs = [];
      }

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

  getTotalWriteOffQuantity(): number {
    return this.writeOffs.reduce((sum, wo) => sum + (wo.quantity || 0), 0);
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
    if (!this.productId) return;
    
    this.barcodesLoading = true;
    try {
      this.barcodeService.loadToken();
      this.barcodes = await firstValueFrom(this.barcodeService.getProductBarcodes(this.productId));
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
    if (!this.productId) return;
    
    this.isGenerating = true;
    try {
      const request: BarcodeRequestDTO = {
        productId: this.productId,
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
    if (!this.productId) return;
    
    this.barcodesLoading = true;
    try {
      const newBarcode = await firstValueFrom(this.barcodeService.autoGenerateBarcode(this.productId, type));
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

    // For services, buyingPrice might be null, use 0 as fallback
    const buyingPrice = this.product.buyingPrice || 0;
    const profitValue = this.product.sellingPrice - buyingPrice;
    const costLabel = this.translate.instant('cost');
    const profitLabel = this.translate.instant('profit');

    this.profitChartData = {
      labels: [costLabel, profitLabel],
      datasets: [
        {
          data: [buyingPrice, profitValue],
          backgroundColor: ['#42A5F5', '#66BB6A'],
          hoverBackgroundColor: ['#64B5F6', '#81C784']
        }
      ]
    };

    this.chartOptions = {
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    };
  }

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
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
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
    if (!this.canEdit || !this.product) return;
    // Ensure form data is loaded
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
  }

  hideProductDialog(): void {
    this.productDialog = false;
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
    this.quantityChange = 0;
    this.adjustmentReason = '';
    this.stockAdjustmentDialog = true;
  }

  closeStockAdjustmentDialog(): void {
    this.stockAdjustmentDialog = false;
    this.quantityChange = 0;
    this.adjustmentReason = '';
  }

  getNewQuantity(): number {
    if (!this.product) return 0;
    return (this.product.quantityAvailable || 0) + this.quantityChange;
  }

  canAdjustStock(): boolean {
    if (this.quantityChange === 0) return false;
    const newQuantity = this.getNewQuantity();
    return newQuantity >= 0;
  }

  async adjustStock(): Promise<void> {
    if (!this.product || !this.canAdjustStock()) return;

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
        detail: this.translate.instant('cannot_decrease_stock_below_zero').replace('{0}', (this.product.quantityAvailable || 0).toString()).replace('{1}', this.quantityChange.toString()),
        life: 4000
      });
      return;
    }

    this.isAdjustingStock = true;
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(
        this.productService.adjustStock(
          this.product.productId!,
          this.quantityChange,
          this.adjustmentReason
        )
      );

      // Update product with response
      if (response && typeof response === 'object') {
        this.product = response as Product;
      }

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('stock_adjusted_successfully'),
        life: 3000
      });

      this.closeStockAdjustmentDialog();
      // Reload product to get updated data
      await this.loadProduct();
      // Reload batches as quantity may have changed
      await this.loadBatches();
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
    this.quantityChange = change;
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
    // Reload the product to reflect changes
    await this.loadProduct();
    // Reload barcodes in case product reference changed
    await this.loadBarcodes();
    // Reload batches in case product expiration date changed
    await this.loadBatches();
    this.productDialog = false;
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
    // Handle delete - could show confirmation dialog first
    if (confirm(this.translate.instant('delete_confirmation_msg_with_param').replace('{0}', this.product?.name || ''))) {
      this.productService.deleteProduct(this.productId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          this.router.navigate(['/inventory/products']);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_product'),
            life: 3000
          });
        }
      });
    }
  }

  archiveProduct(): void {
    if (confirm(this.translate.instant('archive_confirmation_msg_with_param').replace('{0}', this.product?.name || ''))) {
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
        error: (err: any) => {
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
}