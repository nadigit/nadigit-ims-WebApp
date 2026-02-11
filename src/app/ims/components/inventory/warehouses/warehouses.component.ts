import { Component, EventEmitter, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Warehouse } from 'src/app/models/warehouse';
import { Country, State } from 'country-state-city';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { LocationService } from 'src/app/services/location.service';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { Supplier } from 'src/app/models/supplier';
import { Category } from 'src/app/models/category';
import { CategoryService } from 'src/app/services/category.service';
import { SupplierService } from 'src/app/services/supplier.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { UploadEvent } from 'src/app/models/uploadEvent';
import { WarehouseFormDialogComponent, WarehouseFormDialogConfig, WarehouseFormDialogData } from './warehouse-form-dialog/warehouse-form-dialog.component';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';



@Component({
  templateUrl: './warehouses.component.html',
  styleUrls: ['./warehouses.component.css', '../inventory.component.css'],
  providers: [MessageService]
})
export class WarehousesComponent implements OnInit {

  Ressource: string = 'WAREHOUSES';

  warehouseDialogConfig: WarehouseFormDialogConfig = {
    visible: false,
    mode: 'create',
    warehouse: {},
    selectedCountry: {},
    submitted: false
  };

  deleteWarehouseDialog: boolean = false;

  deleteWarehousesDialog: boolean = false;

  warehouses: Warehouse[] = [];

  warehouse: Warehouse = {};

  selectedWarehouses: Warehouse[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  countries: any;

  selectedCountry: any = null;

  states: any = null;

  exportColumns!: ExportColumn[];

  lowStockThreshold;

  canAddWarehouse: boolean = false;
  canEditWarehouse: boolean = false;
  canDeleteWarehouse: boolean = false;
  canReadWarehouse: boolean = false;

  isLoading: boolean = true;
  isExporting: boolean = false;
  exportProgress: string = '';

  currency: any;


  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  isAdmin: boolean = false;
  measureUnits: any[] = [];
  attributeTypes: any[] = [];
  deleteProductDialog: boolean = false;
  selectedProduct: Product;
  productDetailDialog: boolean = false;
  productDialog: boolean = false;
  userRoles: any;
  suppliers: Supplier[] = [];
  categories: Category[] = [];
  imageURL: any;
  uploadedFile: File | null = null;

  archiveProductDialog: boolean = false;

  constructor(private messageService: MessageService,
    private warehouseService: WarehouseService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private supplierService: SupplierService,
    private storage: AngularFireStorage,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private configService: AppConfigurationService,
    private locationService: LocationService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private router: Router,
    private organizationService: OrganizationService) {
    this.setUserRoles();

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
  }

  async ngOnInit() {
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.isLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });
    this.lowStockThreshold = await this.getLowStockThreshold();
    await this.checkPermissions();
    this.onGetAllWarehouses();

    this.cols = [
      { field: 'warehouseId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('warehouse_name') },
      { field: 'description', header: this.translateService.instant('warehouse_description') },
      { field: 'city', header: this.translateService.instant('warehouse_city') },
      { field: 'country', header: this.translateService.instant('warehouse_country') },
      { field: 'address', header: this.translateService.instant('warehouse_address') }
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddWarehouse = this.permissionService.canCreate(this.Ressource);
    this.canEditWarehouse = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteWarehouse = this.permissionService.canDelete(this.Ressource);
    this.canReadWarehouse = this.permissionService.canRead(this.Ressource);
    this.canAddProduct = this.permissionService.canCreate('PRODUCTS');
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
  }

  deleteSelectedWarehouses() {
    if (!this.canDeleteWarehouse) return;
    this.deleteWarehousesDialog = true;
  }

  getStatusIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'instock': return 'pi pi-check-circle text-green-500';
      case 'lowstock': return 'pi pi-exclamation-circle text-yellow-500';
      case 'outofstock': return 'pi pi-times-circle text-red-500';
      default: return 'pi pi-question-circle';
    }
  }

  editWarehouse(warehouse: Warehouse) {
    if (!this.canEditWarehouse) return;
    this.selectedCountry = {};
    this.warehouseDialogConfig = {
      visible: true,
      mode: 'edit',
      warehouse: { ...warehouse },
      selectedCountry: {},
      submitted: false
    };
    console.log(this.warehouseDialogConfig.warehouse.country)
    this.onSelectedCountry(this.warehouseDialogConfig.warehouse.country)
  }


  deleteWarehouse(warehouse: Warehouse) {
    if (!this.canDeleteWarehouse) return;
    this.deleteWarehouseDialog = true;
    this.warehouse = { ...warehouse };
  }

  async confirmDeleteSelected() {
    this.deleteWarehousesDialog = false;
    await this.selectedWarehouses.forEach(selectedWarehouse => this.onDeleteWarehouse(selectedWarehouse.warehouseId));
    this.selectedWarehouses = [];
  }

  async confirmDelete() {
    this.deleteWarehouseDialog = false;
    await this.onDeleteWarehouse(this.warehouse.warehouseId);
    this.warehouse = {};
  }

  hideDialog() {
    this.warehouseDialogConfig.visible = false;
    this.warehouseDialogConfig.submitted = false;
    this.selectedCountry = {};
  }

  openNew() {
    if (!this.canAddWarehouse) return;
    this.selectedCountry = {};
    this.warehouseDialogConfig = {
      visible: true,
      mode: 'create',
      warehouse: {},
      selectedCountry: {},
      submitted: false
    };
  }

  openWarehouseDetails(warehouse: Warehouse) {
    if (!this.canReadWarehouse) return;
    this.router.navigate(['/inventory/warehouses', warehouse.warehouseId]);
  }


  onWarehouseSave(dialogData: WarehouseFormDialogData) {
    this.warehouse = dialogData.warehouse;
    this.selectedCountry = dialogData.selectedCountry;
    this.saveWarehouse();
  }

  onWarehouseDialogConfigChange(config: WarehouseFormDialogConfig) {
    this.warehouseDialogConfig = config;
  }

  onWarehouseCancel() {
    this.hideDialog();
  }

  saveWarehouse() {
    this.warehouseDialogConfig.submitted = true;
    if (this.warehouse.name) {
      if (this.warehouse.warehouseId) {
        this.updateWarehouse(this.warehouse.warehouseId, this.warehouse)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('warehouse_updated'),
            life: 3000
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_warehouse'),
            life: 3000
          });
      } else {
        this.addWarehouse(this.warehouse)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('warehouse_added'),
            life: 3000
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_warehouse'),
            life: 3000
          });
      }
      this.warehouses = [...this.warehouses];
      this.warehouseDialogConfig.visible = false;
      this.warehouse = {};
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
  }

  @ViewChild('dt') dt!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    if (this.dt) {
      this.dt.filterGlobal(value, 'contains');
    }
  }


  clear(table: Table) {
    table.clear();
  }

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers()
      .subscribe({
        next: (response: any) => {
          this.suppliers = response;
          this.suppliers.forEach((supplier: any) => (supplier.creationDate = new Date(<Date>supplier.creationDate)));
        },
        error: (err: any) => {
          console.error(err)
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_getting_suppliers'),
            life: 3000
          });
        },
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onDeleteWarehouse(id: any) {
    await this.warehouseService.deleteWarehouse(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('warehouse_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_warehouse'),
            life: 3000
          });
        },
      });
  }


  async updateWarehouse(id: any, warehouse: any): Promise<any> {
    console.log(warehouse)
    await this.warehouseService.updateWarehouse(id, warehouse)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addWarehouse(data: any): Promise<any> {
    await this.warehouseService.saveWarehouse(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  onChangeCountry() {
    this.warehouse.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    if ((this.warehouse.country != this.selectedCountry) && (this.warehouse.city == undefined)) this.warehouse.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
  }

  filterCountry(value: any, filter: string): boolean {
    // Convert both to lowercase for case-insensitive comparison
    const normalizedFilter = filter.toLowerCase();

    // Check both original name and translated name
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
  }

  async exportPdf() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_pdf_please_wait') || 'Exporting PDF, please wait...',
        life: 3000
      });

      // Get filtered warehouses from table (or all if no filter applied)
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      const filteredWarehouses = this.dt?.filteredValue || this.warehouses || [];
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Build translated export columns based on organization's default locale
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'warehouseId': 'ID',
        'name': 'warehouse_name',
        'description': 'warehouse_description',
        'city': 'warehouse_city',
        'country': 'warehouse_country',
        'address': 'warehouse_address'
      };
      
      const translatedExportColumns: ExportColumn[] = this.cols
        .filter((col) => col.field !== 'warehouseId') // Exclude ID column
        .map((col) => {
          const translationKey = translationKeyMap[col.field] || col.field;
          return {
            title: this.translate.instant(translationKey),
            dataKey: col.field
          };
        });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('warehouses_menu_title');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, filteredWarehouses, 'warehouses', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${filteredWarehouses.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting PDF',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  async exportExcel() {
    if (this.isExporting) {
      return; // Prevent multiple simultaneous exports
    }

    try {
      this.isExporting = true;
      this.exportProgress = this.translate.instant('preparing_export') || 'Preparing export...';
      
      // Show initial loading message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('exporting'),
        detail: this.translate.instant('exporting_excel_please_wait') || 'Exporting Excel, please wait...',
        life: 3000
      });

      // Get filtered warehouses from table (or all if no filter applied)
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      const filteredWarehouses = this.dt?.filteredValue || this.warehouses || [];
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'warehouseId': 'ID',
        'name': 'warehouse_name',
        'description': 'warehouse_description',
        'city': 'warehouse_city',
        'country': 'warehouse_country',
        'address': 'warehouse_address'
      };
      
      // Clone the warehouses array to avoid modifying the original array
      const modifiedWarehouses = filteredWarehouses.map(warehouse => {
        // Create a copy of the warehouse object to modify
        const modifiedWarehouse = { ...warehouse };

        // Remove the column you want to exclude
        delete modifiedWarehouse.creationDate;

        return modifiedWarehouse;
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedWarehouses = modifiedWarehouses.map(warehouse => {
        const translated: any = {};
        this.cols.forEach(col => {
          // Exclude ID and creationDate columns
          if (col.field !== 'creationDate' && col.field !== 'warehouseId') {
            const translationKey = translationKeyMap[col.field] || col.field;
            const translatedHeader = this.translate.instant(translationKey);
            translated[translatedHeader] = warehouse[col.field as keyof Warehouse];
          }
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedWarehouses, 'warehouses');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${translatedWarehouses.length} records exported.`,
        life: 3000
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_exporting') || 'Error exporting Excel',
        life: 5000
      });
    } finally {
      this.isExporting = false;
      this.exportProgress = '';
    }
  }

  getMeasureUnit(unit: string, quantity: number): string {
    if (!unit) return 'UNIT'; // fallback

    const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];

    if (quantity > 1 && pluralizable.includes(unit)) {
      return `${unit}_plural`;
    }

    return unit;
  }

  getQuantitySeverity(quantity: number): string {
    if (quantity === undefined || quantity === null) return 'info';
    if (quantity <= 0) return 'danger';
    if (quantity < this.lowStockThreshold) return 'warning';
    return 'success';
  }

  async getLowStockThreshold(): Promise<number> {
    let threshold: any;
    try {
      const value = await firstValueFrom(await this.configService.getConfiguration('lowStockThreshold'));

      threshold = (value !== undefined && value !== null)
        ? Number(value.value)
        : 10;
      return threshold;
    } catch (error) {
      console.error('Error fetching low stock threshold:', error);
      threshold = 10; // fallback value
      return threshold;
    }
  }

  viewProductDetails(product: Product) {
    this.router.navigate(['/inventory/products', product.productId]);
  }

  // Convert attribute value for display
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

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    this.productDialog = true;
  }

  addAttribute() {
    if (!this.selectedProduct.attributes) {
      this.selectedProduct.attributes = [];
    }

    this.selectedProduct.attributes.push({
      attributeName: '',
      attributeType: 'STRING', // default type
      value: ''
    });
  }

  removeAttribute(index: number) {
    if (this.selectedProduct.attributes && this.selectedProduct.attributes.length > index) {
      this.selectedProduct.attributes.splice(index, 1);
    }
  }

  editImage() {
    this.selectedProduct.productImage = null;
    this.uploadedFile = null;
  }

  async saveProduct() {
    this.submitted = true;

    if (
      this.selectedProduct.name &&
      this.selectedProduct.reference &&
      this.selectedProduct.quantityAvailable &&
      this.selectedProduct.buyingPrice &&
      this.selectedProduct.sellingPrice &&
      this.selectedProduct.category &&
      this.selectedProduct.supplier
    ) {
      if (this.isAdmin && !this.selectedProduct.warehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('warehouse_required'),
          life: 3000,
        });
        return;
      }

      // Note: Duplicate product validation is handled by the backend

      // 📦 Upload product image if any
      if (this.uploadedFile) {
        const filePath = `images/${this.uploadedFile.name}`;
        const fileRef = this.storage.ref(filePath);
        const task = this.storage.upload(filePath, this.uploadedFile);

        try {
          await lastValueFrom(task.snapshotChanges());
          const url = await lastValueFrom(fileRef.getDownloadURL());
          this.selectedProduct.productImage = url;
          this.uploadedFile = null;
        } catch (error) {
          console.error('Error uploading file:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_uploading_image'),
            life: 3000,
          });
          return;
        }
      }

      // Clean attributes before saving
      if (this.selectedProduct.attributes && this.selectedProduct.attributes.length > 0) {
        this.selectedProduct.attributes.forEach(attr => {
          // strip transient field if it still exists
          delete attr.value;

          // optionally normalize booleans (Angular checkboxes can send null)
          if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
            attr.booleanValue = false;
          }
        });
      }

      // ✏️ Update or add product
      if (this.selectedProduct.productId) {
        this.updateProduct(this.selectedProduct.productId, this.selectedProduct)
          ? this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_updated'),
            life: 3000,
          })
          : this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_product'),
            life: 3000,
          });
      }

      // ✅ Reset and close dialog
      this.productDialog = false;
      // this.selectedProduct = {};
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3100,
      });
      return;
    }
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = true;
    this.selectedProduct = { ...product };
  }

  async confirmProductDelete() {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = false;
    await this.onDeleteProduct(this.selectedProduct.productId);
    this.selectedProduct = {};
  }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: async (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          this.onGetAllWarehouses();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_product'),
            life: 3000
          });
          console.log(err);
        },
      })
  }

  async updateProduct(id: any, product: any): Promise<any> {
    console.log(product)
    await this.productService.saveProduct(product)
      .subscribe({
        next: async (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_product'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async onGetAllCategories() {
    await this.categoryService.getCategories().subscribe({
      next: async (response: any) => {
        this.categories = response;

        // Create category parent node
        const categoryNode = {
          label: await this.translateService.instant('Categories'), // Ensure this matches your filter logic
          icon: 'pi pi-fw pi-tag',
          children: this.categories.map((category) => ({
            label: category.categoryName,
            data: category,
            parent: { label: this.translateService.instant('Categories') }, // Add parent reference
          })),
        };
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

        // Create warehouse parent node
        const warehouseNode = {
          label: this.translateService.instant('Warehouses'), // Ensure this matches your filter logic
          icon: 'pi pi-fw pi-database',
          children: this.warehouses.map((warehouse) => ({
            label: warehouse.name,
            data: warehouse,
            parent: { label: this.translateService.instant('Warehouses') }, // Add parent reference
          })),
        };
        console.log(this.warehouses);
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
      complete: () => {
        this.isLoading = false;
      }
    });
  }

  async onFileUpload(event: UploadEvent): Promise<void> {
    console.log("in upload");
    const file = event.files[0];

    // Save the file temporarily and update the imageURL
    this.imageURL = URL.createObjectURL(file);

    // Store the actual file for later use
    this.uploadedFile = file;

    // Note: The actual upload to Firebase Storage will happen when the user clicks "Save" in the saveProduct method
  }

  calculateProfit(product: Product): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

  archiveProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = true;
    this.selectedProduct = { ...product };
    this.productDialog = false;
  }

  async confirmArchive() {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = false;
    await this.onArchiveProduct(this.selectedProduct.productId);
    this.selectedProduct = {};
  }

  async onArchiveProduct(id: any) {
    await this.productService.deactivateProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_archived'),
            life: 3000
          });
          this.onGetAllWarehouses();
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_archiving_product'),
            life: 3000
          });
          console.log(err);
        },
      })
  }

  hideProductDialog() {
    this.productDialog = false;
    this.submitted = false;
  }

  // Product Form Component Event Handlers
  onProductSaveSuccess(product: Product) {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('product_added'),
      life: 3000
    });
    this.productDialog = false;
    // TODO: Reload warehouse/product data if needed
  }

  onProductSaveError(error: any) {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: this.translate.instant('error_adding_product'),
      life: 3000
    });
  }

  onProductCancel() {
    this.hideProductDialog();
  }

}
