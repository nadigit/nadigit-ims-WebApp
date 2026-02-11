import { Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService, SelectItem, MenuItem, TreeNode, ConfirmationService, LazyLoadEvent } from 'primeng/api';
import { Table } from 'primeng/table';
import { DataView } from 'primeng/dataview';
import { Product, AggregatedProduct, ProductsAggregatedResponse } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Category } from 'src/app/models/category';
import { Warehouse } from 'src/app/models/warehouse';
import { SupplierService } from 'src/app/services/supplier.service';
import { Supplier } from 'src/app/models/supplier';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Country, State } from 'country-state-city';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { DialogService } from 'primeng/dynamicdialog';
import { MeasureUnit } from 'src/app/enums/measure-condition.enum';
import { UploadEvent } from 'src/app/models/uploadEvent';
import { calculateProfit, getAvailableQuantity, getMeasureUnit, getProfitClass, getQuantitySeverity, getWriteOffQuantity, hasWriteOffs } from 'src/app/shared/product-utils';
import { ProductImportComponent } from './product-import/product-import.component';
import { WarehouseFormDialogConfig, WarehouseFormDialogData } from '../warehouses/warehouse-form-dialog/warehouse-form-dialog.component';
import { CategoryFormDialogConfig, CategoryFormDialogData } from '../categories/category-form-dialog/category-form-dialog.component';
import { SupplierFormDialogConfig, SupplierFormDialogData } from '../../purchases/suppliers/supplier-form-dialog/supplier-form-dialog.component';
import { LocationService } from 'src/app/services/location.service';
import { OrganizationService } from 'src/app/services/organization.service';
import { Organization } from 'src/app/models/organization';

interface LazyLoadEventExt extends LazyLoadEvent {
  globalFilter?: string;
  filters?: { [field: string]: any };
}

@Component({
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css', '../inventory.component.css'],
  providers: [MessageService, ConfirmationService]
})

export class ProductsComponent implements OnInit {

  Ressource: string = 'PRODUCTS';

  currency: any;

  scanning: boolean = true;

  filteredProducts: any[] = []; // This will hold filtered products

  searchInput: string = ''; // Search input from user

  nodes: TreeNode[] = [];

  filteredNodes: TreeNode[] = [];

  selectedNodes: TreeNode[] = [];

  barcode: string = '';

  scanTimeout: any;

  notFoundProductDialog: boolean = false;

  productDialog: boolean = false;

  // Dialog configuration for reusable component
  categoryDialogConfig: CategoryFormDialogConfig = {
    visible: false,
    mode: 'create',
    category: {},
    isLoading: false
  };

  // Dialog configuration for reusable component
  supplierDialogConfig: SupplierFormDialogConfig = {
    visible: false,
    mode: 'create',
    supplier: {},
  };

  warehouseDialogConfig: WarehouseFormDialogConfig = {
    visible: false,
    mode: 'create',
    warehouse: {},
    selectedCountry: {},
    submitted: false
  };

  deleteProductDialog: boolean = false;

  archiveProductDialog: boolean = false;

  unArchiveProductDialog: boolean = false;

  deleteProductsDialog: boolean = false;

  products: Product[] = [];

  selectedProducts: Product[] = [];

  // Aggregated view mode
  viewMode: 'standard' | 'aggregated' = 'standard';
  aggregatedProducts: AggregatedProduct[] = [];
  expandedProducts: { [key: number]: boolean } = {}; // Track expanded rows for aggregated products
  
  private readonly VIEW_MODE_STORAGE_KEY = 'productsViewMode';

  // Export state
  isExporting: boolean = false;
  exportProgress: string = '';

  product: Product = {};

  archivedProduct: Product = {};

  categories: Category[] = [];

  category: Category = {};

  warehouses: Warehouse[] = [];

  warehouse: Warehouse = {};

  suppliers: Supplier[] = [];

  supplier: Supplier = {};

  selectedProduct: Product;

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  sortOrder: number = 0;

  sortField: string = '';

  sourceCities: any[] = [];

  targetCities: any[] = [];

  orderCities: any[] = [];

  menuItems: MenuItem[] = [];


  imageURL: any;

  uploadedFile: File | null = null;

  exportColumns!: ExportColumn[];

  isEditMode: boolean = false;

  countries: any = null;

  selectedCountry: any = null;

  states: any = null;

  productDetailDialog: boolean = false;

  profitChartData: any;
  chartOptions: any;

  printOptions: any[] = [];

  lowStockThreshold: number = 10;

  public translations: any = {};

  imagePreviewUrl: string | null = null;
  isImageLoading: boolean = false;
  isDragOver: boolean = false;
  imageZoomDialog: boolean = false;
  recentProductImages: string[] = [];
  isSaving: boolean = false;
  uploadProgress: number = 0;
  existingImageFile: any = null;

  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canReadProduct: boolean = false;
  canArchiveProduct: boolean = false;
  canAddWarehouse: boolean = false;
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;

  isLoading: boolean = true;
  userRoles: any;
  isAdmin: boolean = false;
  measureUnits: any[] = [];
  attributeTypes: any[] = [];

  archivedProductsDialog: boolean = false;
  archivedProducts: Product[] = [];
  filteredArchivedProducts: Product[] = [];
  isLoadingArchived: boolean = false;
  archivedSearchInput: string = '';
  selectedArchivedNodes: any[] = [];

  costingMethods: any[] = [];
  effectiveCostingMethodLabel = '';
  isCostingMethodNone: boolean = false;


  //lazy loading
  totalRecords: number = 0;
  lazyLoading: boolean = true;
  first: number = 0;
  rows: number = 20;
  pageSize: number = 20;
  globalFilter: string = '';
  filters: any = {};
  expirationStatusFilter: string | undefined = undefined;
  // Store current filter values from dropdown filters
  currentCategoryIds: number[] = [];
  currentWarehouseIds: number[] = [];
  currentSupplierIds: number[] = [];
  currentInventoryStatus: string | undefined = undefined;
  currentProductType: string | undefined = undefined;
  lastLazyLoadEvent: LazyLoadEventExt = {
    first: 0,
    rows: 20,
    sortField: 'creationDate',
    sortOrder: -1,
    globalFilter: '',
    filters: {}
  };
  lastSortField: string = 'creationDate';
  lastSortOrder: number = -1; // DESC by default
  private isInitialLoad: boolean = true;
  private lazyLoadCallCount: number = 0;
  lastGlobalFilter: string = '';
  @ViewChild('dt') dt!: Table;
  @ViewChild('filter') filter!: ElementRef;
  @ViewChild(ProductImportComponent) productImportComponent!: ProductImportComponent;


  constructor(private messageService: MessageService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private supplierService: SupplierService,
    private storage: AngularFireStorage,
    private locationService: LocationService,
    private reportingService: ReportingService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
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
    this.costingMethods = [
      { label: this.translate.instant('costing_method_fifo'), value: 'FIFO' },
      { label: this.translate.instant('costing_method_lifo'), value: 'LIFO' },
      { label: this.translate.instant('costing_method_weighted_average'), value: 'WEIGHTED_AVERAGE' },
      { label: this.translate.instant('costing_method_standard_cost'), value: 'STANDARD_COST' },
      { label: this.translate.instant('costing_method_none'), value: 'NONE' }
    ];
  }

  async ngOnInit() {
    // Don't set isLoading here - let loadProducts() handle it
    // Load view mode from localStorage (only for admin users)
    await this.checkPermissions();
    if (this.isAdmin) {
      const savedViewMode = localStorage.getItem(this.VIEW_MODE_STORAGE_KEY);
      if (savedViewMode === 'standard' || savedViewMode === 'aggregated') {
        this.viewMode = savedViewMode;
      }
    }
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.lowStockThreshold = await this.getLowStockThreshold();
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
      this.countries = this.locationService.getAllCountriesWithTranslation();
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.translations = translations;
      this.printOptions = [
        {
          label: translations['standard_label'],
          icon: 'pi pi-tag',
          command: () => this.productService.printLabel(this.selectedProduct, 'STANDARD')
        },
        {
          label: translations['barcode_label'],
          icon: 'pi pi-qrcode',
          command: () => this.productService.printLabel(this.selectedProduct, 'BARCODE')
        },
        {
          label: translations['shipping_label'],
          icon: 'pi pi-truck',
          command: () => this.productService.printLabel(this.selectedProduct, 'SHIPPING')
        }
      ];

    });
    // this.onGetAllProducts();
    this.loadProducts();
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    await this.checkPermissions();

    this.targetCities = [];


    await this.checkPermissions();


    this.cols = [
      { field: 'name', header: this.translateService.instant('product_name') },
      { field: 'reference', header: this.translateService.instant('product_reference') },
      { field: 'quantityAvailable', header: this.translateService.instant('product_quantity') },
      { field: 'buyingPrice', header: this.translateService.instant('product_buying_price') },
      { field: 'sellingPrice', header: this.translateService.instant('product_selling_price') },
      { field: 'Category', header: this.translateService.instant('product_category') },
      { field: 'Warehouse', header: this.translateService.instant('product_warehouse') },
      { field: 'Supplier', header: this.translateService.instant('product_supplier') },
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

    // Load recent images from localStorage
    const savedRecentImages = localStorage.getItem('recentProductImages');
    if (savedRecentImages) {
      this.recentProductImages = JSON.parse(savedRecentImages);
    }
  }

  isStandardCostRequired(): boolean {
    // Effective method must be STANDARD_COST
    const effectiveMethod = this.product?.costingMethod
      || (this.product?.category?.costingMethod !== 'NONE' ? this.product?.category?.costingMethod : null)
      || (this.product?.warehouse?.organization?.costingMethod !== 'NONE' ? this.product?.warehouse?.organization?.costingMethod : null);

    // Standard cost required only if product itself defines STANDARD_COST
    return this.product?.costingMethod === 'STANDARD_COST' && effectiveMethod === 'STANDARD_COST';
  }

  updateEffectiveCostingMethodLabel() {
    const getMethodLabel = (method: string) => {
      if (!method || method === 'NONE') return this.translate.instant('costing_method_none');
      return this.translate.instant('costing_method_' + method.toLowerCase());
    };

    // Product-level
    if (this.product.costingMethod && this.product.costingMethod !== 'NONE') {
      this.effectiveCostingMethodLabel = this.translate.instant(
        'costing_method_defined_at_product',
        { method: getMethodLabel(this.product.costingMethod) }
      );
      this.isCostingMethodNone = false;
      return;
    }

    // Category-level
    if (this.product.category?.costingMethod && this.product.category.costingMethod !== 'NONE') {
      this.effectiveCostingMethodLabel = this.translate.instant(
        'costing_method_inherited_from_category',
        { method: getMethodLabel(this.product.category.costingMethod) }
      );
      this.isCostingMethodNone = false;
      return;
    }

    // Organization-level
    if (this.product.warehouse?.organization?.costingMethod &&
      this.product.warehouse.organization.costingMethod !== 'NONE') {
      this.effectiveCostingMethodLabel = this.translate.instant(
        'costing_method_inherited_from_organization',
        { method: getMethodLabel(this.product.warehouse.organization.costingMethod) }
      );
      this.isCostingMethodNone = false;
      return;
    }

    // Fallback
    this.effectiveCostingMethodLabel = this.translate.instant('costing_method_none_fallback');
    this.isCostingMethodNone = true;
  }

  

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddProduct = this.permissionService.canCreate(this.Ressource);
    this.canEditProduct = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteProduct = this.permissionService.canDelete(this.Ressource);
    this.canReadProduct = this.permissionService.canRead(this.Ressource);
    this.canArchiveProduct = this.permissionService.canArchive(this.Ressource);
    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
  }

  showProductDetails(product: Product) {
    // For aggregated products, pass reference as query param to show all warehouses
    if ((product as any)['_aggregated'] && product.reference && this.isAdmin) {
      this.router.navigate(['/inventory/products', product.productId], {
        queryParams: { reference: product.reference, aggregated: 'true' }
      });
    } else {
      this.router.navigate(['/inventory/products', product.productId]);
    }
    this.deactivateScanning();
  }

  showWarehouseDetails(warehouseId: number): void {
    this.router.navigate(['/inventory/warehouses', warehouseId]);
  }

  getInventorySeverity(status: string): string {
    switch (status) {
      case 'INSTOCK': return 'success';
      case 'LOWSTOCK': return 'warning';
      case 'OUTOFSTOCK': return 'danger';
      default: return 'info';
    }
  }

  prepareProfitChart() {
    this.profitChartData = {
      labels: ['Cost', 'Profit'],
      datasets: [
        {
          data: [this.selectedProduct.buyingPrice,
          this.selectedProduct.sellingPrice - this.selectedProduct.buyingPrice],
          backgroundColor: ['#6366F1', '#10B981'],
          hoverBackgroundColor: ['#8183f4', '#34d399']
        }
      ]
    };

    this.chartOptions = {
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            padding: 20
          }
        }
      },
      cutout: '70%'
    };
  }

  nodeSelect(event: { node: TreeNode }) {
    console.log(event.node);
    // Handle node selection as needed
  }
  nodeUnselect(event: { node: TreeNode }) {
    console.log(event.node);
    // Handle node unselection as needed
  }

  deactivateScanning() {
    this.scanning = false;
    console.log('Scanning deactivated');
  }

  activateScanning() {
    this.scanning = true;
    console.log('Scanning activated');
  }

  applyFilters() {
    let tempProducts = [...this.products];

    console.log("Selected Nodes:", this.selectedNodes);
    const categoryLabel = this.translateService.instant('Categories');
    const warehouseLabel = this.translateService.instant('Warehouses');
    const supplierLabel = this.translateService.instant('Suppliers');


    // Separate filtering for different fields (e.g., categories, warehouses, suppliers)
    const selectedCategories = this.selectedNodes.filter(
      (node) => node.parent?.label === categoryLabel
    );
    const selectedWarehouses = this.selectedNodes.filter(
      (node) => node.parent?.label === warehouseLabel
    );
    const selectedSuppliers = this.selectedNodes.filter(
      (node) => node.parent?.label === supplierLabel
    );

    console.log('Selected Categories:', selectedCategories);
    console.log('Selected Warehouses:', selectedWarehouses);
    console.log('Selected Suppliers:', selectedSuppliers);

    // Apply category filter (inclusive)
    if (selectedCategories.length > 0) {
      tempProducts = tempProducts.filter((product) =>
        selectedCategories.some((category) =>
          this.nodeMatchesProduct(category, product)
        )
      );
    }

    // Apply warehouse filter (strict)
    if (selectedWarehouses.length > 0) {
      tempProducts = tempProducts.filter((product) =>
        selectedWarehouses.every((warehouse) =>
          this.nodeMatchesProduct(warehouse, product)
        )
      );
    }

    // Apply supplier filter (strict)
    if (selectedSuppliers.length > 0) {
      tempProducts = tempProducts.filter((product) =>
        selectedSuppliers.every((supplier) =>
          this.nodeMatchesProduct(supplier, product)
        )
      );
    }

    // Filter by search input (including attributes)
    if (this.searchInput) {
      const searchTerm = this.searchInput.toUpperCase();

      tempProducts = tempProducts.filter(product => {
        // Check main product fields
        const matchesProduct =
          (product.name || '').toUpperCase().includes(searchTerm) ||
          (product.reference || '').toUpperCase().includes(searchTerm) ||
          (product.description || '').toUpperCase().includes(searchTerm) ||
          (product.category?.categoryName || '').toUpperCase().includes(searchTerm) ||
          (product.supplier?.name || '').toUpperCase().includes(searchTerm) ||
          (product.warehouse?.name || '').toUpperCase().includes(searchTerm);

        // Check attributes
        const matchesAttributes = product.attributes?.some(attr => {
          let value = '';
          switch (attr.attributeType) {
            case 'BOOLEAN':
              value = attr.booleanValue ? 'YES' : 'NO';
              break;
            case 'INTEGER':
              value = attr.intValue?.toString() || '';
              break;
            case 'DOUBLE':
              value = attr.doubleValue?.toString() || '';
              break;
            default:
              value = attr.stringValue || '';
          }
          return value.toUpperCase().includes(searchTerm) ||
            (attr.attributeName || '').toUpperCase().includes(searchTerm);
        });

        return matchesProduct || matchesAttributes;
      });
    }

    this.filteredProducts = tempProducts;
  }

  /**
   * Handle filter events from the products-table component (dropdown-based filters)
   */
  onApplyFilters(event: {
    productType?: string;
    categoryIds?: number[];
    warehouseIds?: number[];
    supplierIds?: number[];
    inventoryStatus?: string;
    expirationStatus?: string;
    globalFilter?: string;
  }) {
    this.scanning = false;

    // Store current filter values for export
    this.currentCategoryIds = event.categoryIds || [];
    this.currentWarehouseIds = event.warehouseIds || [];
    this.currentSupplierIds = event.supplierIds || [];
    this.currentInventoryStatus = event.inventoryStatus;
    this.currentProductType = event.productType;

    // ExpirationStatus is a backend filter (batch-aware), so trigger reload when it CHANGES
    const hasExpirationInEvent = Object.prototype.hasOwnProperty.call(event, 'expirationStatus');
    if (hasExpirationInEvent && event.expirationStatus !== this.expirationStatusFilter) {
      this.expirationStatusFilter = event.expirationStatus;

      const updatedFilters = { ...this.lastLazyLoadEvent.filters };
      if (event.expirationStatus) {
        updatedFilters['expirationStatus'] = { value: event.expirationStatus };
      } else {
        // Remove expirationStatus filter if cleared
        delete updatedFilters['expirationStatus'];
      }

      const lazyEvent: LazyLoadEventExt = {
        ...this.lastLazyLoadEvent,
        first: 0,
        filters: updatedFilters
      };

      this.onLazyLoad(lazyEvent);
    }

    // If all filters are cleared, reset filtered products to show all from backend
    const hasNoFilters = (!event.categoryIds || event.categoryIds.length === 0) &&
      (!event.warehouseIds || event.warehouseIds.length === 0) &&
      (!event.supplierIds || event.supplierIds.length === 0) &&
      !event.inventoryStatus && !event.productType && !event.globalFilter && !event.expirationStatus;
    
    if (hasNoFilters) {
      // Reset filtered products to empty array to show all products from backend (lazy loaded)
      this.filteredProducts = [];
      return;
    }

    // Apply filters locally on the current products array (for the current page)
    // Only filter if we have products loaded
    if (!this.products || this.products.length === 0) {
      this.filteredProducts = [];
      return;
    }
    
    let tempProducts = [...this.products];

    if (event.categoryIds && event.categoryIds.length > 0) {
      tempProducts = tempProducts.filter(product => 
        product.category?.categoryId && event.categoryIds!.includes(product.category.categoryId)
      );
    }

    if (event.warehouseIds && event.warehouseIds.length > 0) {
      tempProducts = tempProducts.filter(product => 
        product.warehouse?.warehouseId && event.warehouseIds!.includes(product.warehouse.warehouseId)
      );
    }

    if (event.supplierIds && event.supplierIds.length > 0) {
      tempProducts = tempProducts.filter(product => 
        product.supplier?.supplierId && event.supplierIds!.includes(product.supplier.supplierId)
      );
    }

    if (event.inventoryStatus) {
      tempProducts = tempProducts.filter(product => product.inventoryStatus === event.inventoryStatus);
    }

    if (event.productType) {
      tempProducts = tempProducts.filter(product => {
        if (!product) return false;
        const productType = product.productType || 'PRODUCT';
        return productType === event.productType;
      });
    }

    if (event.globalFilter) {
      const searchTerm = event.globalFilter.toUpperCase();
      tempProducts = tempProducts.filter(product => {
        return (product.name || '').toUpperCase().includes(searchTerm) ||
          (product.reference || '').toUpperCase().includes(searchTerm) ||
          (product.description || '').toUpperCase().includes(searchTerm) ||
          (product.category?.categoryName || '').toUpperCase().includes(searchTerm) ||
          (product.supplier?.name || '').toUpperCase().includes(searchTerm) ||
          (product.warehouse?.name || '').toUpperCase().includes(searchTerm);
      });
    }

    this.filteredProducts = tempProducts;
  }


  nodeMatchesProduct(node: TreeNode, product: any): boolean {
    if (node.children && node.children.length > 0) {
      // Recursively check child nodes
      return node.children.some((child) => this.nodeMatchesProduct(child, product));
    } else {
      // Leaf node: check if product matches the node criteria
      console.log("Leaf Node:", node);
      switch (node.parent?.label) {
        case this.translateService.instant('Categories'):
          return product.category?.categoryName === node.label;
        case this.translateService.instant('Warehouses'):
          return product.warehouse?.name === node.label;
        case this.translateService.instant('Suppliers'):
          return product.supplier?.name === node.label;
        default:
          console.warn("No matching case for node label:", node.label);
          return false; // Default case
      }
    }
  }


  filterNodes() {
    this.filteredNodes = [];
    console.log("All Nodes:", this.nodes);

    if (this.selectedNodes.length === 0) {
      this.filteredNodes = [...this.nodes];
      console.log("Filtered Nodes (No Selection):", this.filteredNodes);
    } else {
      console.log("Selected Nodes for Filtering:", this.selectedNodes);
      this.selectedNodes.forEach((selectedNode) => {
        const node = this.nodes.find((n) => n.label === selectedNode.label);
        if (node) {
          this.filteredNodes.push({
            ...node,
            children: node.children.filter((child) => {
              const filteredProducts = this.products.filter((product) => {
                switch (selectedNode.parent?.label) {
                  case this.translateService.instant('Categories'):
                    return product.category?.categoryName === child.label;
                  case this.translateService.instant('Warehouses'):
                    return product.warehouse?.name === child.label;
                  case this.translateService.instant('Suppliers'):
                    return product.supplier?.name === child.label;
                  default:
                    return false;
                }
              });
              return filteredProducts.length > 0;
            }),
          });
        }
      });
    }
    console.log("Filtered Nodes:", this.filteredNodes);
  }

  searchProductByBarcode(barcode: string) {
    console.log("Searching for product by barcode: ", barcode);
    console.log("Products: ", this.products);
    const product = this.products.find(product => product.reference == barcode.trim());
    console.log("Product: ", product);
    if (product) {
      console.log("Product found: ", product);
      return product;
    } else {
      console.log("Product not found");
      return undefined;
    }
  }

  // Check if a key is a valid alphanumeric character
  isAlphanumeric(key: string): boolean {
    const isAlphaNum = /^[a-zA-Z0-9]$/.test(key);
    return isAlphaNum;
  }

  async processBarcode(): Promise<void> {
    if (this.barcode && this.barcode.trim().length >= 3) {
      const product = await this.searchProductByBarcode(this.barcode);
      console.log("Product: ", product);
      if (product) {
        console.log("Product found");
        this.showProductDetails(product);
      } else {
        console.log(`Product does not exist in stock for barcode: ${this.barcode}`);
        this.openProductNotFound();
      }
      this.barcode = ''; // Clear the barcode buffer after processing
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (this.scanning) {
      const key = event.key;

      // If the key is a valid alphanumeric character, add it to the barcode buffer
      if (this.isAlphanumeric(key)) {
        this.barcode += key;
      }

      // If the Enter key is pressed, process the barcode
      if (key === 'Enter') {
        this.processBarcode();
      }

      // Clear any existing timeout
      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }

      // Set a timeout to process the barcode after 300ms of inactivity
      this.scanTimeout = setTimeout(() => {
        this.processBarcode();
      }, 300);
    }

  }

  openProductNotFound() {
    this.notFoundProductDialog = true;
  }

  openCategoryDialog() {
    if (!this.canAddCategory) return;
    this.categoryDialogConfig = {
      visible: true,
      mode: 'create',
      category: {},
      isLoading: false
    };
    this.category = {};
  }

  openWarehouseDialog() {
    if (!this.canAddWarehouse) return;
    this.warehouseDialogConfig = {
      visible: true,
      mode: 'create',
      warehouse: {},
      selectedCountry: {},
      submitted: false
    };
  }

  openSupplierDialog() {
    if (!this.canAddSupplier) return;
    this.supplierDialogConfig = {
      visible: true,
      mode: 'create',
      supplier: {},
    };
    this.supplier = {};
  }

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    this.product = { ...product };
    this.updateEffectiveCostingMethodLabel();
    this.productDialog = true;
    this.scanning = false;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = true;
    this.product = { ...product };
  }

  async confirmDelete() {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = false;
    await this.onDeleteProduct(this.product.productId);
    this.product = {};
  }

  hideProductDialog() {
    this.productDialog = false;
    this.scanning = true;
    this.submitted = false;
  }

  hideCategoryDialog() {
    this.categoryDialogConfig.visible = false;
  }

  // Category Form Dialog Event Handlers
  onCategoryDialogConfigChange(config: CategoryFormDialogConfig) {
    this.categoryDialogConfig = config;
  }

  onCategorySave(dialogData: CategoryFormDialogData) {
    this.category = dialogData.category;
    this.saveCategory();
  }

  onCategoryCancel() {
    this.hideCategoryDialog();
  }

  hideSupplierDialog() {
    this.supplierDialogConfig.visible = false;
  }

  // Supplier Form Dialog Event Handlers
  onSupplierDialogConfigChange(config: SupplierFormDialogConfig) {
    this.supplierDialogConfig = config;
  }

  onSupplierSave(dialogData: SupplierFormDialogData) {
    this.supplier = dialogData.supplier;
    this.saveSupplier();
  }

  onSupplierCancel() {
    this.hideSupplierDialog();
  }

  hideWarehouseDialog() {
    this.warehouseDialogConfig.visible = false;
    this.warehouseDialogConfig.submitted = false;
  }

  openNew() {
    if (!this.canAddProduct) return;
    this.product = {};
    this.product.measureUnit = MeasureUnit.UNIT;
    this.uploadedFile = null;
    this.submitted = false;
    this.updateEffectiveCostingMethodLabel();
    this.productDialog = true;
    this.scanning = false;
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  // Handler for product form save success event
  onProductFormSaveSuccess(product: Product): void {
    // Reload products to reflect the changes
    this.loadProducts();
    // Reset product
    this.product = {};
  }

  // Handler for product form save error event
  onProductFormSaveError(error: any): void {
    // Error message is already shown by the form component
    // Just log for debugging if needed
    console.error('Product save error:', error);
  }

  // Legacy saveProduct method - kept for backward compatibility if needed
  async saveProduct() {
    this.submitted = true;

    if (
      this.product.name &&
      this.product.reference &&
      this.product.buyingPrice &&
      this.product.sellingPrice &&
      this.product.category &&
      this.product.supplier
    ) {
      if (this.isAdmin && !this.product.warehouse) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('warehouse_required'),
          life: 3000,
        });
        return;
      }

      // 🔍 Check for duplicate product with same reference in the same warehouse
      const isDuplicate = this.products.some(p =>
        p.reference === this.product.reference &&
        p.warehouse?.warehouseId === this.product.warehouse?.warehouseId &&
        p.productId !== this.product.productId // exclude current product if updating
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

      // 📦 Upload product image if any (only if it's a new file)
      if (this.uploadedFile && this.uploadedFile !== this.existingImageFile) {
        this.isSaving = true; // Show saving indicator

        try {
          const filePath = `images/${Date.now()}_${this.uploadedFile.name}`;
          const fileRef = this.storage.ref(filePath);
          const task = this.storage.upload(filePath, this.uploadedFile);

          // Show upload progress
          task.percentageChanges().subscribe(percentage => {
            this.uploadProgress = percentage;
          });

          await lastValueFrom(task.snapshotChanges());
          const url = await lastValueFrom(fileRef.getDownloadURL());
          this.product.productImage = url;

          // Add to recent images
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
        }
      }

      // Clean attributes before saving
      if (this.product.attributes && this.product.attributes.length > 0) {
        this.product.attributes.forEach(attr => {
          // strip transient field if it still exists
          delete attr.value;

          // optionally normalize booleans (Angular checkboxes can send null)
          if (attr.attributeType === 'BOOLEAN' && attr.booleanValue == null) {
            attr.booleanValue = false;
          }
        });
      }

      // ✏️ Update or add product
      if (this.product.productId) {
        this.updateProduct(this.product.productId, this.product)
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
      } else {
        this.addProduct(this.product);
      }

      // ✅ Reset and close dialog
      this.productDialog = false;
      this.product = {};
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

  // editImage() {
  //   this.product.productImage = null;
  //   this.uploadedFile = null;
  // }

  addToRecentImages(imageUrl: string): void {
    // Keep only the 6 most recent images
    this.recentProductImages = [imageUrl, ...this.recentProductImages].slice(0, 6);

    // You might want to persist this to local storage
    localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
  }

  addAttribute() {
    if (!this.product.attributes) {
      this.product.attributes = [];
    }

    this.product.attributes.push({
      attributeName: '',
      attributeType: 'STRING', // default type
      value: ''
    });
  }

  removeAttribute(index: number) {
    if (this.product.attributes && this.product.attributes.length > index) {
      this.product.attributes.splice(index, 1);
    }
  }


  saveCategory() {
    if (this.category.categoryName) {
      this.addCategory(this.category)
        ? this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('category_added'),
          life: 3000
        })
        : this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_new_category'),
          life: 3000
        });
    }
    else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return
    }
    this.categories = [...this.categories];
    this.categoryDialogConfig.visible = false;
    this.category = {};
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
    this.hideWarehouseDialog();
  }

  saveWarehouse() {
    this.warehouseDialogConfig.submitted = true;
    if (this.warehouse.name) {
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
          detail: this.translate.instant('error_while_adding_warehouse'),
          life: 3000
        });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
    this.warehouses = [...this.warehouses];
    this.warehouseDialogConfig.visible = false;
    this.warehouse = {};
  }

  saveSupplier() {
    if (this.supplier.name) {
      this.addSupplier(this.supplier)
        ? this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('supplier_added'),
          life: 3000
        })
        : this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_supplier'),
          life: 3000
        });
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
      return;
    }
    this.suppliers = [...this.suppliers];
    this.supplierDialogConfig.visible = false;
    this.supplier = {};
  }


  // onGlobalFilter(table: Table, event: Event) {
  //   table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  // }

  onFilter(dv: DataView, event: Event) {
    dv.filter((event.target as HTMLInputElement).value);
  }

  clear(table: Table) {
    table.clear();
  }

  getSeverity(status: any) {
    switch (status) {
      case false:
        return 'danger';

      case true:
        return 'success';

      case 'new':
        return 'info';

      case 'negotiation':
        return 'warning';

      case 'renewal':
        return null;

      default:
        return '';
    }
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

        this.nodes.push(categoryNode);
        console.log(this.nodes)
        this.filterNodes();
        console.log(this.categories);
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

        this.nodes.push(warehouseNode);
        this.filterNodes();
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
    });
  }

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers().subscribe({
      next: (response: any) => {
        this.suppliers = response;

        // Create supplier parent node
        const supplierNode = {
          label: this.translateService.instant('Suppliers'), // Ensure this matches your filter logic
          icon: 'pi pi-fw pi-truck',
          children: this.suppliers.map((supplier) => ({
            label: supplier.name,
            data: supplier,
            parent: { label: this.translateService.instant('Suppliers') }, // Add parent reference
          })),
        };

        this.nodes.push(supplierNode);
        this.filterNodes();
        console.log(this.suppliers);
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


  async onGetAllProducts() {
    await this.productService.getProducts()
      .subscribe({
        next: (response: any) => {
          // Ensure response is always an array
          const productsArray = Array.isArray(response) ? response : (response?.content || response?.page?.content || []);
          this.products = productsArray;
          this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          this.filteredProducts = [...this.products];
          this.applyFilters();
          this.filterNodes();
          console.log(this.products);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_products'),
            life: 3000
          });
          console.log(err)
        },
        complete: () => {
          // Set loading to false after data is fully loaded
          this.isLoading = false;
        }
      })
  }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_deleted'),
            life: 3000
          });
          this.onGetAllProducts();
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
          this.onGetAllProducts();
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

  async updateProduct(id: any, product: any): Promise<boolean> {
    console.log('Updating product ID:', id);
    console.log('Product data being sent:', JSON.stringify(product, null, 2));
    
    return new Promise<boolean>((resolve) => {
      this.productService.updateProduct(id, product)
        .subscribe({
          next: (response: any) => {
            console.log('Product update API response:', response);
            console.log('Response status:', response?.status || 'OK');
            console.log('Response body:', response);
            
            // Check if response indicates success
            if (response) {
              // Reload products using lazy loading method to maintain table state
              this.loadProducts();
              resolve(true);
            } else {
              console.warn('Update response was empty or null');
              resolve(false);
            }
          },
          error: (err: any) => {
            console.error('Error updating product:', err);
            console.error('Error status:', err?.status);
            console.error('Error statusText:', err?.statusText);
            console.error('Error body:', err?.error);
            console.error('Full error object:', err);
            
            const errorMessage = err?.error?.message || 
                                err?.error?.error || 
                                err?.message || 
                                this.translate.instant('error_while_updating_product');
            
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: errorMessage,
              life: 5000
            });
            resolve(false);
          },
        });
    });
  }

  async addProduct(data: any): Promise<any> {
    console.log(data);
    await this.productService.saveProduct(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          // Reload products using lazy loading method to maintain table state
          this.loadProducts();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('product_added'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_product'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  async addCategory(data: any): Promise<any> {
    await this.categoryService.saveCategory(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCategories();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_new_category'),
            life: 3000
          });
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
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_warehouse'),
            life: 3000
          });
          console.log(err);
          return false;
        },
      })
  }

  async addSupplier(data: any): Promise<any> {
    await this.supplierService.saveSupplier(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllSuppliers();
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_supplier'),
            life: 3000
          });
          console.error(err);
          return false;
        },
      })
  }

  onSortChange(event: any) {
    const value = event.value;

    if (value.indexOf('!') === 0) {
      this.sortOrder = -1;
      this.sortField = value.substring(1, value.length);
    } else {
      this.sortOrder = 1;
      this.sortField = value;
    }
  }

  async onFileUpload(event: any): Promise<void> {
    const file = event.files[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_image_format'),
        life: 3000,
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5000000) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('image_too_large'),
        life: 3000,
      });
      return;
    }

    // Show loading state
    this.isImageLoading = true;

    // Create preview
    this.imagePreviewUrl = URL.createObjectURL(file);

    // Store the file for upload
    this.uploadedFile = file;

    // Auto-hide loading after a brief moment (image load event will handle it)
    setTimeout(() => {
      if (this.isImageLoading) this.isImageLoading = false;
    }, 2000);
  }

  // Drag and drop handlers
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

      // Create a mock event object for the fileUpload method
      this.onFileUpload({ files: [file] });
    }
  }

  // Image error handler
  onImageError(): void {
    this.isImageLoading = false;
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('error'),
      detail: this.translate.instant('image_load_error'),
      life: 3000,
    });

    // Fallback to default image
    this.imagePreviewUrl = null;
    this.product.productImage = 'assets/core-images/no-image.png';
  }

  // Zoom image
  zoomImage(): void {
    this.imageZoomDialog = true;
  }

  // Select recent image
  selectRecentImage(imageUrl: string): void {
    this.product.productImage = imageUrl;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
  }

  // Enhanced editImage method
  editImage(): void {
    this.product.productImage = null;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
  }

  // Enhanced removeImage method
  removeImage(): void {
    this.product.productImage = null;
    this.imagePreviewUrl = null;
    this.uploadedFile = null;
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

      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Fetch all filtered products from backend using current filter parameters
      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      
      // Build filters object from both table filters and dropdown filters
      const allFilters: any = { ...filters };
      
      // Add dropdown filter values to filters object (use first ID for backend, filter client-side for multiple)
      if (this.currentCategoryIds && this.currentCategoryIds.length > 0) {
        allFilters['categoryId'] = { value: this.currentCategoryIds[0] };
      }
      if (this.currentWarehouseIds && this.currentWarehouseIds.length > 0) {
        allFilters['warehouseId'] = { value: this.currentWarehouseIds[0] };
      }
      if (this.currentSupplierIds && this.currentSupplierIds.length > 0) {
        allFilters['supplierId'] = { value: this.currentSupplierIds[0] };
      }
      if (this.currentInventoryStatus) {
        allFilters['inventoryStatus'] = { value: this.currentInventoryStatus };
      }
      if (this.currentProductType) {
        allFilters['productType'] = { value: this.currentProductType };
      }
      
      const processedFilters = this.processFilters(allFilters);
      
      // Use globalFilter from dropdown if available, otherwise use from lastLazyLoadEvent
      const searchFilter = this.globalFilter || globalFilter || '';
      
      // Fetch all products with pagination loop
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredProducts: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Fetch in chunks of 1000
      let hasMore = true;
      let totalElements = 0;
      
      while (hasMore) {
        const pageResponse: any = await firstValueFrom(
          this.productService.getProductsPaginated(
            currentPage,
            pageSize,
            searchFilter,
            sortField || 'creationDate',
            direction,
            processedFilters
          )
        );
        
        const pageContent = pageResponse?.page?.content || [];
        allFilteredProducts = allFilteredProducts.concat(pageContent);
        totalElements = pageResponse?.page?.totalElements || 0;
        
        // Update progress
        const progressPercent = totalElements > 0 
          ? Math.min(100, Math.round((allFilteredProducts.length / totalElements) * 100))
          : 0;
        this.exportProgress = `${this.translate.instant('fetching_data') || 'Fetching data'}... ${allFilteredProducts.length} / ${totalElements} (${progressPercent}%)`;
        
        // Check if there are more pages
        const totalPages = pageResponse?.page?.totalPages || 0;
        hasMore = currentPage + 1 < totalPages && allFilteredProducts.length < totalElements;
        currentPage++;
        
        // Safety limit to prevent infinite loops
        if (currentPage > 100) {
          console.warn('Export stopped at 100 pages to prevent excessive data fetching');
          break;
        }
      }
      
      this.exportProgress = this.translate.instant('generating_pdf') || 'Generating PDF...';
      
      // Extract products from response
      let filteredProducts = allFilteredProducts.map((p: any) => ({
        ...p,
        productType: p.productType || 'PRODUCT',
        creationDate: p.creationDate ? new Date(p.creationDate) : null,
        archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
        buyingDate: p.buyingDate ? new Date(p.buyingDate) : null,
      }));
      
      // Apply client-side filtering for all dropdown filters to ensure accuracy
      // Category filter
      if (this.currentCategoryIds && this.currentCategoryIds.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.category?.categoryId && this.currentCategoryIds.includes(product.category.categoryId)
        );
      }
      // Warehouse filter
      if (this.currentWarehouseIds && this.currentWarehouseIds.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.warehouse?.warehouseId && this.currentWarehouseIds.includes(product.warehouse.warehouseId)
        );
      }
      // Supplier filter
      if (this.currentSupplierIds && this.currentSupplierIds.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.supplier?.supplierId && this.currentSupplierIds.includes(product.supplier.supplierId)
        );
      }
      // Inventory status filter
      if (this.currentInventoryStatus) {
        filteredProducts = filteredProducts.filter(product => 
          product.inventoryStatus === this.currentInventoryStatus
        );
      }
      // Product type filter
      if (this.currentProductType) {
        filteredProducts = filteredProducts.filter(product => {
          const productType = product.productType || 'PRODUCT';
          return productType === this.currentProductType;
        });
      }
      
      // Create a copy of the products array to avoid modifying the original array
      const modifiedProducts = filteredProducts.map(product => {
        // Create a copy of the product object to modify
        let modifiedProduct = { ...product };

        // Replace supplierName with the 'name' field if 'supplier' is an object
        modifiedProduct['Supplier'] = modifiedProduct.supplier?.name || ''; // Use the 'name' field or an empty string if 'name' is undefined
        modifiedProduct['Warehouse'] = modifiedProduct.warehouse?.name || ''; // Use the 'name' field or an empty string if 'name' is undefined
        modifiedProduct['Category'] = modifiedProduct.category?.categoryName || ''; // Use the 'name' field or an empty string if 'name' is undefined

        return modifiedProduct;
      });

      // Build translated export columns based on organization's default locale
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'name': 'product_name',
        'reference': 'product_reference',
        'description': 'product_description',
        'quantityAvailable': 'product_quantity',
        'buyingPrice': 'product_buying_price',
        'buyingDate': 'product_buying_date',
        'sellingPrice': 'product_selling_price',
        'inventoryStatus': 'product_inventory_status',
        'Category': 'product_category',
        'Warehouse': 'product_warehouse',
        'Supplier': 'product_supplier'
      };
      
      const translatedExportColumns: ExportColumn[] = this.cols.map((col) => {
        const translationKey = translationKeyMap[col.field] || col.field;
        return {
          title: this.translate.instant(translationKey),
          dataKey: col.field
        };
      });
      
      // Get translated title for PDF
      const pdfTitle = this.translate.instant('products_menu_title');
      
      // Export with translated headers and title
      this.reportingService.exportPdf(translatedExportColumns, modifiedProducts, 'products', pdfTitle);
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${modifiedProducts.length} records exported.`,
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

      // Load token and get organization's default locale
      await this.organizationService.loadToken();
      const organization = await firstValueFrom(this.organizationService.getOrganization()) as Organization;
      const defaultLocale = organization?.defaultLocale || 'en';
      
      // Temporarily switch to organization's default locale for translations
      const currentLang = this.translate.currentLang;
      this.translate.use(defaultLocale);
      
      // Wait for translations to load
      await firstValueFrom(this.translate.getTranslation(defaultLocale));
      
      // Fetch all filtered products from backend using current filter parameters
      const { sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;
      const direction = sortOrder === 1 ? 'ASC' : 'DESC';
      
      // Build filters object from both table filters and dropdown filters
      const allFilters: any = { ...filters };
      
      // Add dropdown filter values to filters object (use first ID for backend, filter client-side for multiple)
      if (this.currentCategoryIds && this.currentCategoryIds.length > 0) {
        allFilters['categoryId'] = { value: this.currentCategoryIds[0] };
      }
      if (this.currentWarehouseIds && this.currentWarehouseIds.length > 0) {
        allFilters['warehouseId'] = { value: this.currentWarehouseIds[0] };
      }
      if (this.currentSupplierIds && this.currentSupplierIds.length > 0) {
        allFilters['supplierId'] = { value: this.currentSupplierIds[0] };
      }
      if (this.currentInventoryStatus) {
        allFilters['inventoryStatus'] = { value: this.currentInventoryStatus };
      }
      if (this.currentProductType) {
        allFilters['productType'] = { value: this.currentProductType };
      }
      
      const processedFilters = this.processFilters(allFilters);
      
      // Use globalFilter from dropdown if available, otherwise use from lastLazyLoadEvent
      const searchFilter = this.globalFilter || globalFilter || '';
      
      // Fetch all products with pagination loop
      this.exportProgress = this.translate.instant('fetching_data') || 'Fetching data...';
      let allFilteredProducts: any[] = [];
      let currentPage = 0;
      const pageSize = 1000; // Fetch in chunks of 1000
      let hasMore = true;
      let totalElements = 0;
      
      while (hasMore) {
        const pageResponse: any = await firstValueFrom(
          this.productService.getProductsPaginated(
            currentPage,
            pageSize,
            searchFilter,
            sortField || 'creationDate',
            direction,
            processedFilters
          )
        );
        
        const pageContent = pageResponse?.page?.content || [];
        allFilteredProducts = allFilteredProducts.concat(pageContent);
        totalElements = pageResponse?.page?.totalElements || 0;
        
        // Update progress
        const progressPercent = totalElements > 0 
          ? Math.min(100, Math.round((allFilteredProducts.length / totalElements) * 100))
          : 0;
        this.exportProgress = `${this.translate.instant('fetching_data') || 'Fetching data'}... ${allFilteredProducts.length} / ${totalElements} (${progressPercent}%)`;
        
        // Check if there are more pages
        const totalPages = pageResponse?.page?.totalPages || 0;
        hasMore = currentPage + 1 < totalPages && allFilteredProducts.length < totalElements;
        currentPage++;
        
        // Safety limit to prevent infinite loops
        if (currentPage > 100) {
          console.warn('Export stopped at 100 pages to prevent excessive data fetching');
          break;
        }
      }
      
      this.exportProgress = this.translate.instant('generating_excel') || 'Generating Excel...';
      
      // Extract products from response
      let filteredProducts = allFilteredProducts.map((p: any) => ({
        ...p,
        productType: p.productType || 'PRODUCT',
        creationDate: p.creationDate ? new Date(p.creationDate) : null,
        archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
        buyingDate: p.buyingDate ? new Date(p.buyingDate) : null,
      }));
      
      // Apply client-side filtering for all dropdown filters to ensure accuracy
      // Category filter
      if (this.currentCategoryIds && this.currentCategoryIds.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.category?.categoryId && this.currentCategoryIds.includes(product.category.categoryId)
        );
      }
      // Warehouse filter
      if (this.currentWarehouseIds && this.currentWarehouseIds.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.warehouse?.warehouseId && this.currentWarehouseIds.includes(product.warehouse.warehouseId)
        );
      }
      // Supplier filter
      if (this.currentSupplierIds && this.currentSupplierIds.length > 0) {
        filteredProducts = filteredProducts.filter(product => 
          product.supplier?.supplierId && this.currentSupplierIds.includes(product.supplier.supplierId)
        );
      }
      // Inventory status filter
      if (this.currentInventoryStatus) {
        filteredProducts = filteredProducts.filter(product => 
          product.inventoryStatus === this.currentInventoryStatus
        );
      }
      // Product type filter
      if (this.currentProductType) {
        filteredProducts = filteredProducts.filter(product => {
          const productType = product.productType || 'PRODUCT';
          return productType === this.currentProductType;
        });
      }
      
      // Map column field names to translation keys
      const translationKeyMap: { [key: string]: string } = {
        'name': 'product_name',
        'reference': 'product_reference',
        'quantityAvailable': 'product_quantity',
        'buyingPrice': 'product_buying_price',
        'sellingPrice': 'product_selling_price',
        'Category': 'product_category',
        'Warehouse': 'product_warehouse',
        'Supplier': 'product_supplier'
      };
      
      // Clone the products array to avoid modifying the original array
      const modifiedProducts = filteredProducts.map(product => {
        // Create a copy of the product object to modify
        let modifiedProduct = { ...product };

        modifiedProduct['Supplier'] = product.supplier?.name || '';
        modifiedProduct['Category'] = product.category?.categoryName || '';
        modifiedProduct['Warehouse'] = product.warehouse?.name || '';

        // Remove the column you want to exclude
        delete modifiedProduct.creationDate;
        delete modifiedProduct.productImage;
        delete modifiedProduct.description;
        delete modifiedProduct.buyingDate;
        delete modifiedProduct.inventoryStatus;
        delete modifiedProduct.supplier;
        delete modifiedProduct.warehouse;
        delete modifiedProduct.category;
        delete modifiedProduct.productId; // Exclude productId if it exists

        return modifiedProduct;
      });

      // Create a translated version of the data with translated headers
      // For Excel, we need to create objects with translated keys
      const translatedProducts = modifiedProducts.map(product => {
        const translated: any = {};
        this.cols.forEach(col => {
          const translationKey = translationKeyMap[col.field] || col.field;
          const translatedHeader = this.translate.instant(translationKey);
          translated[translatedHeader] = product[col.field as keyof Product];
        });
        return translated;
      });

      // Now, export the translated array to Excel
      this.reportingService.exportExcel(translatedProducts, 'products');
      
      // Restore original language
      this.translate.use(currentLang);
      
      // Show success message
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('export_completed_successfully') || `Export completed successfully. ${translatedProducts.length} records exported.`,
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

  // Add a method to toggle the editable state
  // toggleEditMode() {
  //   this.isEditMode = !this.isEditMode;
  // }

  onChangeCountry() {
    this.supplier.city = undefined;
  }


  // Method to reset scanning when the dialog is hidden
  resetScanning() {
    this.scanning = true;
  }

  getProfitClass(product: any): string {
    return getProfitClass(product);
  }

  calculateProfit(product: Product): number {
    return calculateProfit(product);
  }

  private parseAttributeValue(attr: any): any {
    switch (attr.attributeType) {
      case 'INTEGER': return Number(attr.value);
      case 'DOUBLE': return Number(attr.value);
      case 'BOOLEAN': return attr.value === true || attr.value === 'true';
      default: return attr.value; // STRING
    }
  }

  getMeasureUnit(product: Product): string {
    return getMeasureUnit(product.measureUnit, product.quantityAvailable);
  }

  getQuantitySeverity(quantity: number): string {
    return getQuantitySeverity(quantity, this.lowStockThreshold);
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

  archiveProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = true;
    this.product = { ...product };
    this.productDialog = false;
  }

  async confirmArchive() {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = false;
    await this.onArchiveProduct(this.product.productId);
    this.product = {};
    this.selectedProduct = {};
  }


  unarchiveProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.unArchiveProductDialog = true;
    this.archivedProduct = { ...product };
  }

  async confirmUnarchive() {
    if (!this.canDeleteProduct) return;
    this.archiveProductDialog = false;
    this.reactivateProduct(this.archivedProduct);
    this.archivedProduct = {};
    this.unArchiveProductDialog = false;
  }

  openArchivedProductsDialog(): void {
    this.deactivateScanning();
    this.archivedProductsDialog = true;
    this.loadArchivedProducts();
  }

  onImportSuccess(): void {
    // Reload products after successful import
    this.loadProducts();
  }

  openImportDialog(): void {
    if (this.productImportComponent) {
      this.productImportComponent.openDialog();
    }
  }

  loadArchivedProducts(): void {
    this.isLoadingArchived = true;
    this.productService.getInactiveProducts().subscribe({
      next: (products: Product[]) => {
        this.archivedProducts = products;
        this.filteredArchivedProducts = products;
        this.isLoadingArchived = false;
      },
      error: (error) => {
        console.error('Error loading archived products:', error);
        this.isLoadingArchived = false;
      }
    });
  }

  applyArchivedFilters(): void {
    let filtered = [...this.archivedProducts];

    // Apply category filter
    if (this.selectedArchivedNodes && this.selectedArchivedNodes.length > 0) {
      const selectedCategoryIds = this.selectedArchivedNodes.map(node => node.key);
      filtered = filtered.filter(product =>
        product.category && selectedCategoryIds.includes(product.category.categoryId.toString())
      );
    }

    // Apply search filter
    if (this.archivedSearchInput) {
      const searchTerm = this.archivedSearchInput.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm) ||
        (product.reference && product.reference.toLowerCase().includes(searchTerm)) ||
        (product.category && product.category.categoryName.toLowerCase().includes(searchTerm))
      );
    }

    this.filteredArchivedProducts = filtered;
  }


  reactivateProduct(product: Product): void {
    this.productService.reactivateProduct(product.productId).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('product_reactivated')
        });
        // Remove from archived list
        this.archivedProducts = this.archivedProducts.filter(p => p.productId !== product.productId);
        this.applyArchivedFilters();
      },
      error: (error) => {
        console.error('Error reactivating product:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('reactivate_product_error')
        });
      }
    });
  }

  onLazyLoad(event: LazyLoadEvent) {
    this.lazyLoadCallCount++;
    
    // Skip if this is the first lazy load call and we've already loaded products manually
    // This prevents the automatic lazy table trigger from reloading with wrong sort order
    if (this.lazyLoadCallCount === 1 && this.products.length > 0) {
      // This is the automatic lazy load trigger after manual load
      // Skip it to prevent double loading
      this.isInitialLoad = false;
      return;
    }
    
    const extendedEvent: LazyLoadEventExt = {
      ...event,
      globalFilter: this.globalFilter
    };

    this.updateLastLazyLoadEvent(extendedEvent);
    this.loadProducts();
  }



  loadProducts() {
    if (this.viewMode === 'aggregated' && this.isAdmin) {
      this.loadAggregatedProducts();
      return;
    }

    this.isLoading = true;
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === 1 ? 'ASC' : 'DESC';
    const processedFilters = this.processFilters(filters);

    console.log('Loading products with parameters:', {
      page,
      size,
      sortField,
      direction,
      globalFilter,
      filters: processedFilters
    });

    this.productService.getProductsPaginated(
      page,
      size,
      globalFilter || '',
      sortField!,
      direction,
      processedFilters
    ).subscribe({
      next: (res: any) => {
        console.log('Paginated products response:', res);
        // Assign the paginated products
        this.products = res.page.content.map((p: any) => ({
          ...p,
          productType: p.productType || 'PRODUCT', // Ensure productType is set
          creationDate: p.creationDate ? new Date(p.creationDate) : null,
          archivedDate: p.archivedDate ? new Date(p.archivedDate) : null,
          buyingDate: p.buyingDate ? new Date(p.buyingDate) : null,
        }));

        // Assign totals from backend
        this.totalRecords = res.totalProducts;
        console.log('Products:', this.products);

        this.isLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_orders'),
          life: 3000
        });
      }
    });
  }

  loadAggregatedProducts() {
    this.isLoading = true;
    const { first, rows, sortField, sortOrder, globalFilter, filters } = this.lastLazyLoadEvent;

    const page = first! / rows!;
    const size = rows!;
    const direction = sortOrder === 1 ? 'ASC' : 'DESC';
    const processedFilters = this.processFilters(filters);

    this.productService.getAggregatedProducts(
      page,
      size,
      globalFilter || '',
      sortField || 'name',
      direction,
      processedFilters
    ).subscribe({
      next: (res: ProductsAggregatedResponse) => {
        console.log('Aggregated products response:', res);
        this.aggregatedProducts = res.products;
        
        // Convert aggregated products to Product format for table compatibility
        this.products = res.products.map((ap: AggregatedProduct) => ({
          productId: ap.warehouseStocks[0]?.productId || 0,
          reference: ap.reference,
          name: ap.name,
          description: ap.description,
          productType: ap.productType || 'PRODUCT',
          quantityAvailable: ap.totalQuantityAvailable,
          netAvailableQuantity: ap.totalNetAvailableQuantity,
          inventoryStatus: ap.overallInventoryStatus,
          sellingPrice: ap.sellingPrice,
          buyingPrice: ap.buyingPrice,
          productImage: ap.productImage,
          category: ap.category,
          supplier: ap.supplier,
          measureUnit: ap.measureUnit,
          active: ap.active,
          expirationDate: ap.earliestExpirationDate,
          // Store aggregated data for later use
          _aggregated: true,
          _warehouseCount: ap.warehouseCount,
          _warehouseStocks: ap.warehouseStocks
        } as any));

        this.totalRecords = res.totalElements;
        this.isLoading = false;
        console.log('Products:', this.products);
      },
      error: (err: any) => {
        console.error('Error loading aggregated products:', err);
        this.isLoading = false;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_products'),
          life: 3000
        });
      }
    });
  }

  toggleViewMode() {
    this.viewMode = this.viewMode === 'standard' ? 'aggregated' : 'standard';
    // Save view mode to localStorage (only for admin users)
    if (this.isAdmin) {
      localStorage.setItem(this.VIEW_MODE_STORAGE_KEY, this.viewMode);
    }
    // Reset to first page when switching views
    this.lastLazyLoadEvent.first = 0;
    // Clear expanded rows when switching views
    this.expandedProducts = {};
    this.loadProducts();
  }

  isProductRowExpanded(productId: number): boolean {
    return !!this.expandedProducts[productId];
  }

  toggleProductRow(productId: number): void {
    this.expandedProducts[productId] = !this.expandedProducts[productId];
  }

  getAggregatedWarehouseStocks(product: any): any[] {
    return product._warehouseStocks || [];
  }

  private updateLastLazyLoadEvent(event: LazyLoadEvent) {
    // Default to DESC (-1) for newest first
    const defaultSortOrder = -1; // DESC - newest first
    let sortOrder = defaultSortOrder;
    
    // On initial load (first lazy load call), always use DESC regardless of what the event says
    // After initial load, respect user's sort choice
    if (this.isInitialLoad || this.lazyLoadCallCount <= 1) {
      sortOrder = defaultSortOrder;
      if (this.lazyLoadCallCount > 0) {
        this.isInitialLoad = false;
      }
    } else {
      // Use event.sortOrder if provided, otherwise keep current sortOrder
      if (event.sortOrder !== undefined && event.sortOrder !== null && event.sortOrder !== 0) {
        if (event.sortOrder === 1 || event.sortOrder === -1) {
          sortOrder = event.sortOrder;
        }
      } else {
        sortOrder = this.lastLazyLoadEvent.sortOrder ?? defaultSortOrder;
      }
    }
    
    this.lastLazyLoadEvent = {
      first: event.first ?? this.lastLazyLoadEvent.first,
      rows: event.rows ?? this.lastLazyLoadEvent.rows,
      sortField: event.sortField ?? this.lastLazyLoadEvent.sortField,
      sortOrder: sortOrder,
      globalFilter: event.globalFilter ?? this.globalFilter,
      filters: event.filters ?? this.lastLazyLoadEvent.filters
    };

    // Store sorting for future reloads
    this.globalFilter = this.lastLazyLoadEvent.globalFilter as string;
  }

  private processFilters(filters: any): any {
    if (!filters) return {};

    const processedFilters: any = {};

    // Process categoryId filter
    if (filters['categoryId'] && filters['categoryId'].value) {
      processedFilters.categoryId = filters['categoryId'].value;
    }

    // Process supplierId filter
    if (filters['supplierId'] && filters['supplierId'].value) {
      processedFilters.supplierId = filters['supplierId'].value;
    }

    // Process warehouseId filter
    if (filters['warehouseId'] && filters['warehouseId'].value) {
      processedFilters.warehouseId = filters['warehouseId'].value;
    }

    // Process creationDate filter
    if (filters['creationDate'] && filters['creationDate'].value) {
      processedFilters.creationDate = filters['creationDate'].value;
    }

    // Process expirationStatus filter (batch-aware, backend filter)
    if (filters['expirationStatus'] && filters['expirationStatus'].value) {
      processedFilters.expirationStatus = filters['expirationStatus'].value;
    }

    return processedFilters;
  }


  onGlobalFilter(event: { globalFilter: string }) {
    this.scanning = false;
    this.globalFilter = event.globalFilter;

    const lazyEvent: LazyLoadEventExt = {
      ...this.lastLazyLoadEvent,
      first: 0,
      globalFilter: this.globalFilter
    };

    this.onLazyLoad(lazyEvent);
  }
}
