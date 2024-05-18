import { Component, OnInit } from '@angular/core';
import { MessageService, SelectItem, MenuItem } from 'primeng/api';
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
import { finalize, lastValueFrom } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Country, State } from 'country-state-city';


interface UploadEvent {
  originalEvent: Event;
  files: File[];
}

@Component({
  templateUrl: './products.component.html',
  styleUrls: ['./products.component.css'],
  providers: [MessageService]
})

export class ProductsComponent implements OnInit {

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

  rowsPerPageOptions = [5, 10, 20];

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

  constructor(private messageService: MessageService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private warehouseService: WarehouseService,
    private supplierService: SupplierService,
    private storage: AngularFireStorage,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService) { }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => { // Assuming English
      this.sortOptions = [
        { label: translations['descending_price'], value: '!buyingPrice' },
        { label: translations['ascending_price'], value: 'buyingPrice' }
      ];
    });
    this.onGetAllProducts();
    this.onGetAllCategories();
    this.onGetAllWarehouses();
    this.onGetAllSuppliers();

    this.targetCities = [];


    this.sortOptions = [
      { label: 'Descending Price', value: '!buyingPrice' },
      { label: 'Ascending Price', value: 'buyingPrice' }
    ];


    this.items = [
      {
        label: 'Update',
        icon: 'pi pi-fw pi-pencil',
        command: () => {
          this.editProduct(this.selectedProduct)
        },
      },
      {
        label: 'Delete',
        icon: 'pi pi-fw pi-trash',
        command: () => {
          this.deleteProduct(this.selectedProduct);
        },
      },

    ];
    this.cols = [
      { field: 'name', header: 'Name' },
      { field: 'reference', header: 'Reference' },
      { field: 'description', header: 'Description' },
      { field: 'quantityAvailable', header: 'Quantity' },
      { field: 'buyingPrice', header: 'Buying Price' },
      { field: 'buyingDate', header: 'Buying Date' },
      { field: 'sellingPrice', header: 'Selling Price' },
      { field: 'inventoryStatus', header: 'Inventory Status' },
      { field: 'Category', header: 'Category' },
      { field: 'Warehouse', header: 'Warehouse' },
      { field: 'Supplier', header: 'Supplier' },
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }


  // deleteSelectedProducts() {
  //   this.deleteProductsDialog = true;
  // }

  openCategoryDialog(){
    this.category = {};
    this.categoryDialog = true;
  }

  openWarehouseDialog(){
    this.warehouse = {};
    this.warehouseDialog = true;
  }

  openSupplierDialog(){
    this.supplier = {};
    this.supplierDialog = true;
  }

  editProduct(product: Product) {
    this.selectedProduct = product;
    this.product = { ...product };
    this.productDialog = true;
  }

  deleteProduct(product: Product) {
    this.deleteProductDialog = true;
    this.product = { ...product };
  }

  // async confirmDeleteSelected() {
  //   this.deleteProductsDialog = false;
  //   await this.selectedProducts.forEach(selectedProduct => this.onDeleteProduct(selectedProduct.productId));
  //   this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Users Deleted', life: 3000 });
  //   this.selectedProducts = [];
  // }

  async confirmDelete() {
    this.deleteProductDialog = false;
    await this.onDeleteProduct(this.product.productId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Deleted', life: 3000 });
    this.product = {};
  }

  hideProductDialog() {
    this.productDialog = false;
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
    this.product = {};
    this.submitted = false;
    this.productDialog = true;
  }

  async saveProduct() {
    this.submitted = true;
    if (this.product.name) {
      if (!this.product.productImage) {
        // If the uploadedFile is set, proceed with uploading to Firebase Storage
        if (this.uploadedFile) {
          const filePath = `images/${this.uploadedFile.name}`;
          const fileRef = this.storage.ref(filePath);
          const task = this.storage.upload(filePath, this.uploadedFile);

          try {
            await lastValueFrom(task.snapshotChanges());

            const url = await lastValueFrom(fileRef.getDownloadURL());

            // Update the product's image URL after successful upload
            this.product.productImage = url;

            // Reset uploadedFile after upload, whether successful or not
            this.uploadedFile = null;
          } catch (error) {
            console.error('Error uploading file:', error);
            // Handle the error, possibly show a message to the user
          }
        }

      }
      if (this.product.productId) {
        this.updateProduct(this.product.productId, this.product) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating user', life: 3000 })
      } else {
        this.addProduct(this.product) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Updated', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding user', life: 3000 }))
      }
      this.products = [...this.products];
      this.productDialog = false;
      this.product = {};
    }
  }

  saveCategory() {
      this.addCategory(this.category) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Category created', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new category', life: 3000 }))
      this.categories = [...this.categories];
      this.categoryDialog = false;
      this.category = {};
  }

  saveWarehouse() {
      this.addWarehouse(this.warehouse) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Updated', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding user', life: 3000 }))
      this.warehouses = [...this.warehouses];
      this.warehouseDialog = false;
      this.warehouse = {};
    }

    saveSupplier() {
        this.addSupplier(this.supplier) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Supplier created with success', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding supplier', life: 3000 }))
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
    await this.categoryService.getCategories()
      .subscribe({
        next: (response: any) => {
          this.categories = response;
          //this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          console.log(this.categories);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onGetAllWarehouses() {
    await this.warehouseService.getWarehouses()
      .subscribe({
        next: (response: any) => {
          this.warehouses = response;
          //this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          console.log(this.warehouses);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers()
      .subscribe({
        next: (response: any) => {
          this.suppliers = response;
          //this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          console.log(this.warehouses);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onGetAllProducts() {
    await this.productService.getProducts()
      .subscribe({
        next: (response: any) => {
          this.products = response;
          this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          console.log(this.products);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onDeleteProduct(id: any) {
    await this.productService.deleteProduct(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllProducts();
        },
        error(err: any) {
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

  async addSupplier(data: any): Promise<any> {
    await this.supplierService.saveSupplier(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllSuppliers();
          return true;
        },
        error(err: any) {
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
    this.reportingService.exportExcel(modifiedProducts,'products');
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


}
