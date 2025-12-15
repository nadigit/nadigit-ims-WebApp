import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { PurchaseService } from 'src/app/services/purchase.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Purchase } from 'src/app/models/purchase';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';
import { Supplier } from 'src/app/models/supplier';
import { SupplierService } from 'src/app/services/supplier.service';
import { ProductService } from 'src/app/services/product.service';
import { Product } from 'src/app/models/product';
import { PurchaseItem } from 'src/app/models/purchaseItem';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { calculateProfit, displayAttributeValue, getLowStockThreshold, getMeasureUnit, getQuantitySeverity } from 'src/app/shared/product-utils';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/compat/storage';

@Component({
  templateUrl: './purchases.component.html',
  styleUrls: ['./purchases.component.css', '../inventory.component.css'],
  providers: [MessageService]
})
export class PurchasesComponent implements OnInit, OnChanges, AfterViewInit {
  @ViewChild('pickList') pickList: ElementRef | undefined;

  Ressource: string = 'PURCHASES';

  purchaseDialog: boolean = false;

  deletePurchaseDialog: boolean = false;

  deletePurchasesDialog: boolean = false;

  purchases: Purchase[] = [];

  purchase: Purchase = {};

  shops: Shop[] = [];

  shop: Shop = {};

  products: Product[] = [];

  product: Product = {};

  suppliers: Supplier[] = [];

  supplier: Supplier = {};

  selectedPurchases: Purchase[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  currency: any;

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  valSwitch: boolean = false;

  sourceProducts: Product[] = [];

  targetProducts: Product[] = [];

  purchaseItems: PurchaseItem[] = [];

  exportColumns!: ExportColumn[];

  barcode: string = '';

  scanTimeout: any;

  scanning: boolean = true;

  TaxEnabledOptions: any[] = [];

  taxEnabled: boolean = false;

  taxRate: number = 0.0;

  canAddPurchase: boolean = false;
  canEditPurchase: boolean = false;
  canDeletePurchase: boolean = false;
  canReadPurchase: boolean = false;
  canProcessPurchase: boolean = false;
  canCancelPurchase: boolean = false;
  isLoading: boolean = true;
  userRoles: any;
  isAdmin: boolean = false;
  maxPurchaseDate: any;


  searchProductInput: string = "";
  searchTimeout: any;
  selectedProduct: Product | null = null;
  productDetailDialog: boolean = false;
  canEditProduct: boolean = false;
  canDeleteProduct: boolean = false;
  canArchiveProduct: boolean = false;
  canReadProduct: boolean = false;
  lowStockThreshold;
  productDialog: boolean = false;
  deleteProductDialog: boolean = false;
  archiveProductDialog: boolean = false;
  imagePreviewUrl: string | null = null;
  isImageLoading: boolean = false;
  isDragOver: boolean = false;
  imageZoomDialog: boolean = false;
  recentProductImages: string[] = [];
  isSaving: boolean = false;
  uploadProgress: number = 0;
  existingImageFile: any = null;
  imageURL: any;
  uploadedFile: File | null = null;

  constructor(private messageService: MessageService,
    private purchaseService: PurchaseService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private shopService: ShopService,
    private supplierService: SupplierService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private storage: AngularFireStorage,
    private productService: ProductService,
    private router: Router) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;
    this.lowStockThreshold = await this.getLowStockThreshold();
    this.maxPurchaseDate = new Date(); // Today's date
    this.maxPurchaseDate.setHours(23, 59, 59, 999); // Include entire current day
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.initializeTranslations();
    this.onGetAllPurchases();
    await this.checkPermissions();
    await this.setUserRoles();
    this.cols = [
      { field: 'id', header: this.translateService.instant('ID') },
      { field: 'supplier', header: this.translateService.instant('supplier') },
      { field: 'purpose', header: this.translateService.instant('purchase_purpose') },
      { field: 'dateOfPurchase', header: this.translateService.instant('purchase_date') },
      { field: 'totalAmount', header: this.translateService.instant('purchase_total_amount') },
      { field: 'shop', header: this.translateService.instant('shop') },
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('purchase' in changes) {
      this.initializePickList();
    }
  }



  private initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang); // Update language
    });

    this.translate
      .getTranslation(this.translateService.getPreferredLanguage())
      .subscribe((translations) => {
        this.TaxEnabledOptions = [
          { label: translations['enabled'], value: true },
          { label: translations['disabled'], value: false },
        ];
      });
  }

  calculateTotalAmount(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.purchaseItemQuantity * product.purchaseItemPricePerUnit;
    }

    // Apply discount first
    total -= this.purchase.discount;

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    // Apply tax if enabled (keep total calculation as is)
    if (this.taxEnabled) {
      total += this.calculateTax(); // Include tax in the total
    }

    // Return the final total
    return total;
  }

  calculateTax(): number {
    // Calculate tax based on the total amount (not including tax itself)
    const totalWithoutTax = this.calculateTotalAmountWithoutTax();
    return this.taxEnabled ? totalWithoutTax * this.taxRate : 0;
  }

  calculateTotalAmountWithoutTax(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      console.log(product.purchaseItemQuantity)
      console.log(product.purchaseItemPricePerUnit)
      total += product.purchaseItemQuantity * product.purchaseItemPricePerUnit;
    }

    // Apply discount first
    total -= this.purchase.discount;

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    console.log(total)
    return total;
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      this.taxRate = response.value;
      console.log("tax:" + this.taxRate)
    });
  }

  ngAfterViewInit() {
    if (this.pickList) {
      // Get all list items in the source and target containers
      const sourceItems = this.pickList.nativeElement.querySelectorAll('.p-picklist-source .p-picklist-item');
      const targetItems = this.pickList.nativeElement.querySelectorAll('.p-picklist-target .p-picklist-item');

      // Disable double-click for source and target items
      this.disableDoubleClick(sourceItems);
      this.disableDoubleClick(targetItems);
    }
  }

  disableDoubleClick(items: NodeListOf<Element>) {
    items.forEach(item => {
      item.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  initializePickList(): void {
    this.sourceProducts = this.getSourceProducts();
    this.targetProducts = this.getTargetProducts();
  }

  getSourceProducts(): Product[] {
    if (this.purchase && this.purchase.purchaseItems && this.purchase.purchaseItems.length > 0) {
      return this.products.filter(product =>
        !this.purchase.purchaseItems.some(targetProduct => targetProduct.product.productId === product.productId)
      );
    } else {
      return this.products;
    }
  }

  getTargetProducts(): Product[] {
    let targetProducts: Product[] = [];
    if (this.purchase && this.purchase.purchaseItems && this.purchase.purchaseItems.length > 0) {
      this.purchase.purchaseItems.forEach(element => {
        targetProducts.push(element.product);
      });
      return targetProducts;
    } else {
      return [];
    }
  }

  onMoveToTarget(event: any): void {
    console.log(event);
    console.log(this.targetProducts);
    // Move the selected product from the source to the target
    this.targetProducts.forEach((product: any) => {
      console.log(product);

      // Iterate over each item in the event
      event.items.forEach((item: any) => {
        // Check if the productId matches
        if (product.productId === item.productId) {
          // Add the orderItemPricePerUnit field and assign the value of sellingPrice from the item
          product.purchaseItemPricePerUnit = item.buyingPrice;
          product.purchaseItemQuantity = 1;
        }
      });
    });
    // Force change detection
    this.cdr.detectChanges();
  }

  moveProductToTarget(product: any): void {
    if (product.quantityAvailable <= 0) {
      console.log('Product quantity is not sufficient to move to target.');
      return;
    }

    const existingProduct = this.targetProducts.find(targetProduct => targetProduct.productId === product.productId);
    if (!existingProduct) {
      const newProduct = { ...product, purchaseItemPricePerUnit: product.buyingPrice, purchaseItemQuantity: 1 };
      this.targetProducts.push(newProduct);
      this.sourceProducts = this.sourceProducts.filter(p => p.productId !== product.productId);
      this.purchaseItems.push(newProduct); // Update orderItems for ngModel binding
      this.cdr.detectChanges(); // Trigger change detection
    } else {
      existingProduct.purchaseItemQuantity += 1;
      this.cdr.detectChanges();
    }
  }

  searchProductByBarcode(barcode: string): Product | undefined {
    return this.sourceProducts.find((p: Product) => p.reference === barcode);
  }

  // Check if a key is a valid alphanumeric character
  isAlphanumeric(key: string): boolean {
    const isAlphaNum = /^[a-zA-Z0-9]$/.test(key);
    return isAlphaNum;
  }

  processBarcode(): void {
    console.log("in process barcode");
    if (this.barcode) {
      const product = this.searchProductByBarcode(this.barcode);
      if (product) {
        console.log("Product found: ", product);
        // Move the product to target using the new method
        this.moveProductToTarget(product);
      } else {
        console.log(`Product does not exist in stock for barcode: ${this.barcode}`);
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

  toggleRow(id: number): void {
    this.expandedRows[id.toString()] = !this.isRowExpanded(id.toString());
    const purchase = this.purchases.find(p => p.purchaseId === id);
  }

  isRowExpanded(id: string): boolean {
    return this.expandedRows[id] === true;
  }

  showPurchaseDetails(purchase: any) {
    this.router.navigate(['/inventory/purchases', purchase.purchaseId]);
  }

  getPurchaseStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PENDING': 'info',
      'APPROVED': 'warning',
      'RECEIVED': 'success',
      'COMPLETED': 'success',
      'CANCELED': 'danger'
    };
    return severityMap[status] || 'info';
  }

  getPurchaseStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PENDING': 'pi pi-clock',
      'APPROVED': 'pi pi-box',
      'RECEIVED': 'pi pi-check-circle',
      'COMPLETED': 'pi pi-flag-fill',
      'CANCELED': 'pi pi-times-circle',
    };
    return iconMap[status] || 'pi pi-question-circle';
  }


  updatePurchaseStatusInBackend(purchase: Purchase) {
    this.purchaseService.updatePurchaseStatus(purchase.purchaseId, purchase).subscribe({
      next: (updatedPurchase) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('success'),
          detail: this.translate.instant('purchase_status_updated')
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('purchase_status_update_failed')
        });
      }
    });
  }

  async cancelPurchase(purchase: Purchase) {
    purchase.purchaseStatus = "CANCELED";
    try {
      this.updatePurchaseStatusInBackend(purchase);
      await this.onGetAllPurchases();
    } catch (error) {
      console.log(error);
    }
  }

  getPaymentStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PAID': 'success',
      'UNPAID': 'warning',
      'PARTIALLY_PAID': 'warning',
    };
    return severityMap[status] || 'warning';
  }

  getPaymentStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PAID': 'pi pi-check-circle',
      'UNPAID': 'pi pi-clock',
      'PARTIALLY_PAID': 'pi pi-percentage'
    };
    return iconMap[status] || 'pi pi-question-circle';
  }

  // Quick action methods
  printPurchaseInvoice(purchase: any) {
    // Implement print functionality
    console.log('Print purchase invoice:', purchase);
  }

  exportPurchaseToPDF(purchase: any) {
    // Implement PDF export functionality
    console.log('Export purchase to PDF:', purchase);
  }

  duplicatePurchase(purchase: any) {
    // Implement duplicate purchase functionality
    console.log('Duplicate purchase:', purchase);
  }

  updateStockFromPurchase(purchase: any) {
    // Implement stock update functionality
    console.log('Update stock from purchase:', purchase);
  }



  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddPurchase = this.permissionService.canCreate(this.Ressource);
    this.canEditPurchase = this.permissionService.canUpdate(this.Ressource);
    this.canDeletePurchase = this.permissionService.canDelete(this.Ressource);
    this.canReadPurchase = this.permissionService.canRead(this.Ressource);
    this.canProcessPurchase = this.permissionService.canProcess(this.Ressource);
    this.canCancelPurchase = this.permissionService.canCancel(this.Ressource);
    this.canEditProduct = this.permissionService.canUpdate('PRODUCTS');
    this.canDeleteProduct = this.permissionService.canDelete('PRODUCTS');
    this.canArchiveProduct = this.permissionService.canArchive('PRODUCTS');
    this.canReadProduct = this.permissionService.canRead('PRODUCTS');
  }

  deleteSelectedPurchases() {
    if (!this.canDeletePurchase) return;
    this.deletePurchasesDialog = true;
  }

  editPurchase(purchase: Purchase) {
    if (!this.canEditPurchase) return;
    this.purchase = { ...purchase };
    this.purchaseItems = this.purchase.purchaseItems.map(item => {
      return {
        purchaseItemId: item.purchaseItemId,
        product: {
          ...item.product,
          purchaseItemQuantity: item.quantityPurchased,
          purchaseItemPricePerUnit: item.buyingPrice,
        },
        quantity: item.quantityPurchased,
        pricePerUnit: item.buyingPrice,
      };
    });
    this.loadProductsForPicker();
    this.initializePickList();
    this.purchaseDialog = true;

    // Add the new fields directly to the order object
    this.purchase.purchaseItems.forEach(item => {
      item.product.purchaseItemQuantity = item.quantityPurchased;
      item.product.purchaseItemPricePerUnit = item.buyingPrice;
    });

    console.log(this.purchase);
  }

  deletePurchase(purchase: Purchase) {
    if (!this.canDeletePurchase) return;
    this.deletePurchaseDialog = true;
    this.purchase = { ...purchase };
  }

  confirmDeleteSelected() {
    this.deletePurchasesDialog = false;
    this.selectedPurchases.forEach(selectedPurchase => this.onDeletePurchase(selectedPurchase.purchaseId));
    this.selectedPurchases = [];
  }

  async confirmDelete() {
    this.deletePurchaseDialog = false;
    await this.onDeletePurchase(this.purchase.purchaseId);
    this.purchase = {};
  }

  hideDialog() {
    this.purchaseDialog = false;
    this.submitted = false;
    this.purchase = {};
  }

  openNew() {
    if (!this.canAddPurchase) return;
    this.purchase = {};
    this.onGetAllShops();
    this.onGetAllSuppliers();
    this.purchase.dateOfPurchase = new Date();
    this.purchase.discount = 0;
    this.purchase.taxEnabled = false;
    this.submitted = false;
    this.targetProducts = [];
    this.purchaseItems = [];
    this.loadProductsForPicker();
    this.initializePickList();
    this.purchaseDialog = true;
  }

  // isPurchaseFinalized(purchase: any): boolean {
  //   const today = new Date();
  //   const dateOfPurchase = new Date(purchase.dateOfPurchase);
  //   return dateOfPurchase.toDateString() === today.toDateString();
  // }

  async savePurchase() {
    this.submitted = true;
    console.log(this.purchase)

    if (this.purchase.purpose) {
      if (this.purchase.dateOfPurchase) {
        // Ensure `dateOfExpense` is a Date object
        const date =
          typeof this.purchase.dateOfPurchase === "string"
            ? new Date(this.purchase.dateOfPurchase)
            : this.purchase.dateOfPurchase;

        // Format the date into YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, "0");

        this.purchase.dateOfPurchase = `${year}-${month}-${day}`; // Convert to string format
      }

      // Check if the customer is selected
      if (!this.purchase.supplier) {
        // Optionally, show an error message or handle it as needed
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('supplier_required'),
          life: 3000
        });
        return; // Exit the method to prevent submission
      }

      if (this.isAdmin && !this.purchase.shop) {
        // Optionally, show an error message or handle it as needed
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('shop_required'),
          life: 3000
        });
        return; // Exit the method to prevent submission
      }

      // Check if at least one product is selected
      if (this.targetProducts.length === 0) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('at_least_one_product_required'),
          life: 3000
        });
        return; // Exit the method to prevent submission
      }

      // Map the target products to order items with the required structure
      const purchaseItems: PurchaseItem[] = this.targetProducts.map(product => ({
        product,
        quantityPurchased: product['purchaseItemQuantity'],
        buyingPrice: product['purchaseItemPricePerUnit']
      }));

      // Create a new order object to avoid modifying the existing one directly
      const newPurchase: Purchase = { ...this.purchase };

      // Assign the new order items to the new order
      newPurchase.purchaseItems = purchaseItems;

      // Remove 'quantity' and 'subTotal' properties from each product in orderItems
      newPurchase.purchaseItems.forEach(purchaseItem => {
        delete purchaseItem.product['purchaseItemQuantity'];
        delete purchaseItem.product['purchaseItemPricePerUnit'];
      });

      newPurchase.taxEnabled = this.taxEnabled;

      console.log(newPurchase);

      try {
        if (newPurchase.purchaseId) {
          await this.updatePurchase(newPurchase.purchaseId, newPurchase);
        } else {

          await this.addPurchase(newPurchase);
        }
      } catch (error) {
        console.error(error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_occurred'),
          life: 3000
        });
      }

      this.purchases = [...this.purchases];
      this.purchaseDialog = false;
      this.purchase = {};
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }


  clear(table: Table) {
    table.clear();
  }

  async onGetAllShops() {
    await this.shopService.getShops().subscribe({
      next: (response: any) => {
        this.shops = response;
        console.log(this.shops);
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_shops'),
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
        console.log(this.shops);
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

  async onGetAllPurchases() {
    await this.purchaseService.getPurchases()
      .subscribe({
        next: (response: any) => {
          this.purchases = response;
          this.purchases.forEach((purchase: any) => {
            if (purchase.shop?.cashRegister?.dailyBalances) {
              delete purchase.shop.cashRegister.dailyBalances;
            }
            purchase.creationDate = new Date(<Date>purchase.creationDate)
            purchase.dateOfPurchase = new Date(<Date>purchase.dateOfPurchase)
            purchase.boeExpirationDate = new Date(<Date>purchase.boeExpirationDate)
            purchase.checkExpirationDate = new Date(<Date>purchase.checkExpirationDate)
          });
          console.log(this.purchases);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_purchases'),
            life: 3000,
          });
          console.error(err)
        },
        complete: () => {
          this.isLoading = false;
        }
      })
  }

  async onDeletePurchase(id: any) {
    await this.purchaseService.deletePurchase(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllPurchases();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('purchase_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_purchase'),
            life: 3000
          });
          console.error(err);
        },
      });
  }

  async updatePurchase(id: any, purchase: any): Promise<any> {
    console.log(purchase)
    purchase.products = this.targetProducts;
    await this.purchaseService.updatePurchase(id, purchase)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllPurchases();
          this.loadProductsForPicker();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('purchase_updated'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_purchase'),
            life: 3000
          });
          return false;
        },
      })
  }

  async addPurchase(purchase: any): Promise<any> {
    console.log(purchase);
    await this.purchaseService.savePurchase(purchase).subscribe({
      next: (response: any) => {
        console.log(response);
        this.onGetAllPurchases();
        this.loadProductsForPicker();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('purchase_added'),
          life: 3000
        });
        return true;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_purchase'),
          life: 3000
        });
        console.log(err);
        return false;
      },
    });
  }



  // async onGetAllProducts() {
  //   await this.productService.getProducts()
  //     .subscribe({
  //       next: (response: any) => {
  //         this.products = response;
  //         this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
  //         console.log(this.products);
  //       },
  //       error: (err: any) => {
  //         this.messageService.add({
  //           severity: 'error',
  //           summary: this.translate.instant('error'),
  //           detail: this.translate.instant('error_while_getting_products'),
  //           life: 3000
  //         });
  //         console.log(err)
  //       },
  //       complete: () => {
  //         // Set loading to false after data is fully loaded
  //         this.isLoading = false;
  //       }
  //     })
  // }





  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.purchases, 'purchases')
  }

  exportExcel() {
    // Clone the purchases array to avoid modifying the original array
    const modifiedPurchases = this.purchases.map(purchase => {
      // Create a copy of the purchase object to modify
      const modifiedPurchase = { ...purchase };

      // Remove the column you want to exclude
      delete modifiedPurchase.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedPurchase['columnToRemove'];

      return modifiedPurchase;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedPurchases, 'purchases');
  }

  loadProductsForPicker(search: string = "") {
    this.productService.searchProductsForPurchase(search).subscribe({
      next: (products: Product[]) => {
        // Remove items that are already selected in target
        this.sourceProducts = (products || []).filter(
          p => !this.targetProducts.some(t => t.productId === p.productId)
        );
      }
    });
  }

  onSearchProducts(event: any) {
    const search = event.target.value;

    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.loadProductsForPicker(search);
    }, 300);
  }

  viewProductDetails(product: Product) {
    if (!product) return;
    this.router.navigate(['/inventory/products', product.productId]);
  }

  getMeasureUnit(product: Product): string {
    return getMeasureUnit(product.measureUnit, product.quantityAvailable);
  }

  getQuantitySeverity(quantity: number): string {
    return getQuantitySeverity(quantity, this.lowStockThreshold);
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

  displayAttributeValue(attr: any): string {
    return displayAttributeValue(attr);
  }

  calculateProfit(product: Product): number {
    return calculateProfit(product);
  }

  editProduct(product: Product) {
    if (!this.canEditProduct) return;
    this.selectedProduct = product;
    this.product = { ...product };
    this.loadProductsForPicker();
    this.initializePickList();
    this.onGetAllShops();
    this.onGetAllSuppliers();
    this.productDialog = true;
    this.scanning = false;
  }

  deleteProduct(product: Product) {
    if (!this.canDeleteProduct) return;
    this.deleteProductDialog = true;
    this.product = { ...product };
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

  async confirmProductDelete() {
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
          this.loadProductsForPicker();
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
          this.loadProductsForPicker();
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

  addToRecentImages(imageUrl: string): void {
    // Keep only the 6 most recent images
    this.recentProductImages = [imageUrl, ...this.recentProductImages].slice(0, 6);

    // You might want to persist this to local storage
    localStorage.setItem('recentProductImages', JSON.stringify(this.recentProductImages));
  }

  async updateProduct(id: any, product: any): Promise<any> {
    console.log(product)
    await this.productService.updateProduct(id, product)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadProductsForPicker();
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

  async addProduct(data: any): Promise<any> {
    console.log(data);
    await this.productService.saveProduct(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.loadProductsForPicker();
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

}
