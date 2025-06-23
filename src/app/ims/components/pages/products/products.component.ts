import { Component, HostListener, OnInit } from '@angular/core';
import { MessageService, SelectItem, MenuItem, TreeNode } from 'primeng/api';
import { Table } from 'primeng/table';
import { DataView } from 'primeng/dataview';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { CategoryService } from 'src/app/services/category.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Category } from 'src/app/models/category';
import { Warehouse } from 'src/app/models/warehouse';
import { SupplierService } from 'src/app/services/supplier.service';
import { Supplier } from 'src/app/models/supplier';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Country, State } from 'country-state-city';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { DialogService } from 'primeng/dynamicdialog';


interface UploadEvent {
  originalEvent: Event;
  files: File[];
}

@Component({
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css','../pages.component.css'],
  providers: [MessageService]
})

export class ProductsComponent implements OnInit {

  Ressource : string = 'PRODUCTS';

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

  categoryDialog: boolean = false;

  supplierDialog: boolean = false;

  warehouseDialog: boolean = false;

  deleteProductDialog: boolean = false;

  deleteProductsDialog: boolean = false;

  products: Product[] = [];

  product: Product = {};

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

  sortOptions: SelectItem[] = [];

  sortOrder: number = 0;

  sortField: string = '';

  sourceCities: any[] = [];

  targetCities: any[] = [];

  orderCities: any[] = [];

  menuItems: MenuItem[] = [];

  items: MenuItem[] | undefined;

  imageURL: any;

  uploadedFile: File | null = null;

  exportColumns!: ExportColumn[];

  isEditMode: boolean = false;

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  canAddProduct: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canAddWarehouse: boolean = false;
  canAddCategory: boolean = false;
  canAddSupplier: boolean = false;

  isLoading: boolean = true;
  userRoles: any;
  isAdmin: boolean = false;

  
  constructor(private messageService: MessageService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private dialogService: DialogService,    
    private warehouseService: WarehouseService,
    private supplierService: SupplierService,
    private storage: AngularFireStorage,
    private reportingService: ReportingService,
    private configService: AppConfigurationService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,) { 
      this.setUserRoles();
    }

  async ngOnInit() {
    this.isLoading=true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => { // Assuming English
      this.sortOptions = [
        { label: translations['descending_price'], value: '!sellingPrice' },
        { label: translations['ascending_price'], value: 'sellingPrice' },
        { label: translations['availability_desc'], value: 'inventoryStatus' }, // Descending availability
        { label: translations['availability_asc'], value: '!inventoryStatus' } 
      ];
      this.items = [
        {
          label: translations['edit_button'],
          icon: 'pi pi-fw pi-pencil',
          command: () => {
            this.editProduct(this.selectedProduct)
          },
        },
        {
          label: translations['delete_button'],
          icon: 'pi pi-fw pi-trash',
          command: () => {
            this.deleteProduct(this.selectedProduct);
          },
        },
  
      ];
    });
    this.onGetAllProducts();
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();
    // this.onGetCurrecy();
    await this.checkPermissions();

    this.targetCities = [];

    
    await this.checkPermissions();

    // Remove the "Delete" item if the user cannot delete the product
    if (!this.canDeleteProduct) {
      this.items = this.items.filter(item => item.icon !== 'pi pi-fw pi-trash');
    }

    this.cols = [
      { field: 'name', header: this.translateService.instant('product_name') },
      { field: 'reference', header: this.translateService.instant('product_reference') },
      { field: 'description', header: this.translateService.instant('product_description') },
      { field: 'quantityAvailable', header: this.translateService.instant('product_quantity') },
      { field: 'buyingPrice', header: this.translateService.instant('product_buying_price') },
      { field: 'buyingDate', header: this.translateService.instant('product_buying_date') },
      { field: 'sellingPrice', header: this.translateService.instant('product_selling_price') },
      { field: 'inventoryStatus', header: this.translateService.instant('product_inventory_status') },
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

  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddProduct = this.permissionService.canCreate(this.Ressource);
    this.canEditProduct = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteProduct = this.permissionService.canDelete(this.Ressource);

    this.canAddWarehouse = this.permissionService.canCreate('WAREHOUSES');
    this.canAddCategory = this.permissionService.canCreate('CATEGORIES');
    this.canAddSupplier = this.permissionService.canCreate('SUPPLIERS');
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
  
    // Apply search input filter
    if (this.searchInput) {
      const searchTerm = this.searchInput.toUpperCase();
      tempProducts = tempProducts.filter((product) =>
        (product.name || '').toUpperCase().includes(searchTerm) ||
        (product.reference || '').toUpperCase().includes(searchTerm) ||
        (product.description || '').toUpperCase().includes(searchTerm) ||
        (product.category?.categoryName || '').toUpperCase().includes(searchTerm) ||
        (product.supplier?.name || '').toUpperCase().includes(searchTerm) ||
        (product.warehouse?.name || '').toUpperCase().includes(searchTerm)
      );
    }
  
    console.log('Filtered Products:', tempProducts);
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
    return this.products.find(product => product.reference === barcode);
  }

  // Check if a key is a valid alphanumeric character
  isAlphanumeric(key: string): boolean {
    const isAlphaNum = /^[a-zA-Z0-9]$/.test(key);
    return isAlphaNum;
  }

  processBarcode(): void {
    if (this.barcode) {
      const product = this.searchProductByBarcode(this.barcode);
      if (product) {
        console.log("Product found");
        this.editProduct(product);
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
  // deleteSelectedProducts() {
  //   this.deleteProductsDialog = true;
  // }

  openCategoryDialog() {
    if (!this.canAddCategory) return;
    this.category = {};
    this.categoryDialog = true;
  }

  openWarehouseDialog() {
    if (!this.canAddWarehouse) return;
    this.warehouse = {};
    this.warehouseDialog = true;
  }

  openSupplierDialog() {
    if (!this.canAddSupplier) return;
    this.supplier = {};
    this.supplierDialog = true;
  }

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    this.product = { ...product };
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
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product Deleted', life: 3000 });
    this.product = {};
  }

  hideProductDialog() {
    this.productDialog = false;
    this.scanning = true;
    this.submitted = false;
  }

  hideCategoryDialog() {
    this.categoryDialog = false;
  }

  hideSupplierDialog() {
    this.supplierDialog = false;
  }

  hideWarehouseDialog() {
    this.warehouseDialog = false;
  }

  openNew() {
    if (!this.canAddProduct) return;
    this.product = {};
    this.submitted = false;
    this.productDialog = true;
    this.scanning = false;
  }

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async saveProduct() {
    this.submitted = true;
    if (this.product.name && this.product.reference && this.product.quantityAvailable && this.product.buyingPrice && 
      this.product.sellingPrice && this.product.category && this.product.supplier) {
        if (this.isAdmin && !this.product.warehouse) {
          // Optionally, show an error message or handle it as needed
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Warehouse is required.', life: 3000 });
          return; // Exit the method to prevent submission
        }
      if (this.uploadedFile) {
        const filePath = `images/${this.uploadedFile.name}`;
        const fileRef = this.storage.ref(filePath);
        const task = this.storage.upload(filePath, this.uploadedFile);

        try {
          await lastValueFrom(task.snapshotChanges());
          const url = await lastValueFrom(fileRef.getDownloadURL());
          this.product.productImage = url;
          this.uploadedFile = null;
        } catch (error) {
          console.error('Error uploading file:', error);
          this.messageService.add({ severity: 'error', summary: 'Image Error', detail: 'Error while uploading image', life: 3000 })
        }
      }

      if (this.product.productId) {
        this.updateProduct(this.product.productId, this.product)
          ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product Updated', life: 3000 })
          : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating product', life: 3000 });
      } else {
        this.addProduct(this.product)
          ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Product created with success', life: 3000 })
          : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding product', life: 3000 });
      }

      this.productDialog = false;
      this.product = {};
    } else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3100 });
      return;
    }
  }

  editImage() {
    this.product.productImage = null;
    this.uploadedFile = null;
  }
  

  saveCategory() {
    if (this.category.categoryName){
      this.addCategory(this.category) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category created with success', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new category', life: 3000 }))
    } 
    else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields.', life: 3000 });
      return
    }
    this.categories = [...this.categories];
    this.categoryDialog = false;
    this.category = {};
  }

  saveWarehouse() {
    if (this.warehouse.name){
      this.addWarehouse(this.warehouse) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Warehouse created with success', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding user', life: 3000 }))
    } 
    else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields.', life: 3000 });
      return
    }
    this.warehouses = [...this.warehouses];
    this.warehouseDialog = false;
    this.warehouse = {};
  }

  saveSupplier() {
    if (this.supplier.name){
      this.addSupplier(this.supplier) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Supplier created with success', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding supplier', life: 3000 }))
    } 
    else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields.', life: 3000 });
      return
    }
    this.suppliers = [...this.suppliers];
    this.supplierDialog = false;
    this.supplier = {};
  }


  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

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
          summary: 'Error',
          detail: 'Error while getting categories',
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
          summary: 'Error',
          detail: 'Error while getting warehouses',
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
          summary: 'Error',
          detail: 'Error while getting suppliers',
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
          this.products = response;
          this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          this.filteredProducts = [...this.products];
          this.filterNodes();
          console.log(this.products);
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting the list of products', life: 3000 })
          console.log(err)
        },
        complete: () => {
          // Set loading to false after data is fully loaded
          this.isLoading = false;
        }
      })
  }

  // async onGetCurrecy() {
  //   await (await this.configService.getConfigurationValue('currency'))
  //     .subscribe({
  //       next: (response: any) => {
  //         this.currency = response;
  //         console.log(this.currency)
  //       },
  //       error: (err: any) => {
  //         this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting currency', life: 3000 })
  //         console.log(err)
  //       }
  //     })
  // }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllProducts();
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while deleting product', life: 3000 })
          console.log(err)
        },
      })
  }


  async updateProduct(id: any, product: any): Promise<any> {
    console.log(product)
    await this.productService.saveProduct(product)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllProducts();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating the product', life: 3000 })
          console.log(err);
          return false;
        },
      })
  }

  async addProduct(data: any): Promise<any> {
    console.log(data);
    await this.productService.saveProduct(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllProducts();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new product', life: 3000 })
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
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new category', life: 3000 })
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
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new warehouse', life: 3000 })
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
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new supplier', life: 3000 })
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

  async onFileUpload(event: UploadEvent): Promise<void> {
    console.log("in upload");
    const file = event.files[0];

    // Save the file temporarily and update the imageURL
    this.imageURL = URL.createObjectURL(file);

    // Store the actual file for later use
    this.uploadedFile = file;

    // Note: The actual upload to Firebase Storage will happen when the user clicks "Save" in the saveProduct method
  }

  exportPdf() {
    // Create a copy of the products array to avoid modifying the original array
    const modifiedProducts = this.products.map(product => {
      // Create a copy of the product object to modify
      let modifiedProduct = { ...product };

      console.log(modifiedProduct.supplier.name)
      // Replace supplierName with the 'name' field if 'supplier' is an object
      modifiedProduct['Supplier'] = modifiedProduct.supplier.name || ''; // Use the 'name' field or an empty string if 'name' is undefined
      modifiedProduct['Warehouse'] = modifiedProduct.warehouse.name || ''; // Use the 'name' field or an empty string if 'name' is undefined
      modifiedProduct['Category'] = modifiedProduct.category.categoryName || ''; // Use the 'name' field or an empty string if 'name' is undefined


      return modifiedProduct;
    });

    // Now, export the modified array to PDF
    this.reportingService.exportPdf(this.exportColumns, modifiedProducts, 'products');
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedProducts = this.products.map(product => {
      // Create a copy of the supplier object to modify
      let modifiedProduct = { ...product };

      modifiedProduct['Supplier'] = product.supplier.name;
      modifiedProduct['Category'] = product.category.categoryName;
      modifiedProduct['Warehouse'] = product.warehouse.name;

      // Remove the column you want to exclude
      delete modifiedProduct.creationDate;
      delete modifiedProduct.productImage;
      delete modifiedProduct.supplier;
      delete modifiedProduct.warehouse;
      delete modifiedProduct.category;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedProduct;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedProducts, 'products');
  }

  // Add a method to toggle the editable state
  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
  }

  onChangeCountry() {
    this.supplier.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.supplier.country != this.selectedCountry) && (this.supplier.city == undefined)) this.supplier.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

  }

  // Method to reset scanning when the dialog is hidden
  resetScanning() {
    this.scanning = true;
  }

    getProfitClass(product: any): string {
    const profit = this.calculateProfit(product);
    return profit >= 0.3 ? 'text-green-500 font-semibold' :
      profit >= 0.1 ? 'text-blue-500' : 'text-orange-500';
  }

    calculateProfit(product: any): number {
    if (!product.sellingPrice || !product.buyingPrice) return 0;
    return (product.sellingPrice - product.buyingPrice) / product.buyingPrice;
  }

}
