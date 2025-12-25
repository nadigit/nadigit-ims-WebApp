import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { Product } from 'src/app/models/product';
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
import { getMeasureUnit } from 'src/app/shared/product-utils';
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
    private supplierService: SupplierService
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
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadProduct();
      await this.loadBarcodes();
      // Load form data when needed
      await this.onGetAllCategories();
      await this.onGetAllWarehouses();
      await this.onGetAllSuppliers();
    });
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

    const profitValue = this.product.sellingPrice - this.product.buyingPrice;
    const costLabel = this.translate.instant('cost');
    const profitLabel = this.translate.instant('profit');

    this.profitChartData = {
      labels: [costLabel, profitLabel],
      datasets: [
        {
          data: [this.product.buyingPrice, profitValue],
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

  async onProductFormSaveSuccess(productData: Product): Promise<void> {
    console.log('Product form saved successfully:', productData);
    // Reload the product to reflect changes
    await this.loadProduct();
    // Reload barcodes in case product reference changed
    await this.loadBarcodes();
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