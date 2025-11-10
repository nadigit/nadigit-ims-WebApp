import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
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

  purchaseDetailsDialog: boolean = false;
  selectedPurchase: Purchase = null;
  purchaseEvents: any[] = [];

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
    private productService: ProductService) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;
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
    this.onGetAllShops();
    this.onGetAllProducts();
    this.onGetAllSuppliers();
    this.getSourceProducts(),
      this.getTargetProducts(),
      this.initializePickList(),
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

  refreshPurchaseDetails(){
    console.log("refresh purchase")
  }

  showPurchaseDetails(purchase: any) {
    this.selectedPurchase = purchase;
    this.scanning = false;
    this.purchaseDetailsDialog = true;
    this.generatePurchaseEvents();
  }

  hidePurchaseDetailsDialog() {
    this.purchaseDetailsDialog = false;
    this.selectedPurchase = null;
    this.scanning = true;
  }

  generatePurchaseEvents() {
    this.purchaseEvents = [
      {
        status: 'PENDING',
        date: this.selectedPurchase?.dateOfPurchase,
        icon: 'pi pi-shopping-cart',
        button: 'Process Purchase'
      },
      {
        status: 'APPROVED',
        date: this.selectedPurchase?.approvedDate,
        icon: 'pi pi-box',
        button: 'Mark as Received'
      },
      {
        status: 'RECEIVED',
        date: this.selectedPurchase?.receivedDate,
        icon: 'pi pi-check-circle',
        button: 'Complete Purchase'
      },
      {
        status: 'COMPLETED',
        date: this.selectedPurchase?.completionDate,
        icon: 'pi pi-flag-fill',
        button: null
      }
    ].filter(event => event.date != null || event.status === 'PENDING');
    console.log("EVENTS:", this.purchaseEvents);
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

  getPurchaseActionButtonIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'PENDING': 'pi pi-arrow-right',
      'APPROVED': 'pi pi-check',
      'RECEIVED': 'pi pi-flag',
      'CANCELED': 'pi pi-check-circle'
    };
    return iconMap[status] || 'pi pi-arrow-right';
  }

  getPurchaseActionButtonSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'PENDING': 'primary',
      'APPROVED': 'warning',
      'RECEIVED': 'success',
      'CANCELED': 'help'
    };
    return severityMap[status] || 'primary';
  }

  showPurchaseEventButton(event: any): boolean {
    const statusOrder = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'];
    const currentStatusIndex = statusOrder.indexOf(this.selectedPurchase?.purchaseStatus);
    const eventStatusIndex = statusOrder.indexOf(event.status);
    return eventStatusIndex === currentStatusIndex && event.button !== null;
  }

  getPurchaseStatusDescription(status: string): string {
    const descriptions: { [key: string]: string } = {
      'PENDING': this.translate.instant('purchase_status_pending_description'),
      'APPROVED': this.translate.instant('purchase_status_approved_description'),
      'RECEIVED': this.translate.instant('purchase_status_received_description'),
      'COMPLETED': this.translate.instant('purchase_status_completed_description'),
      'CANCELED': this.translate.instant('purchase_status_canceled_description')
    };
    return descriptions[status] || this.translate.instant('status_description_not_available');
  }

  updatePurchaseStatus() {
    const currentStatus = this.selectedPurchase?.purchaseStatus;
    const statusOrder = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    if (currentIndex < statusOrder.length - 1) {
      const nextStatus = statusOrder[currentIndex + 1];
      this.selectedPurchase.purchaseStatus = nextStatus;
      this.updatePurchaseStatusInBackend(this.selectedPurchase);
    }
  }

  updatePurchaseStatusInBackend(purchase: Purchase) {
    this.purchaseService.updatePurchaseStatus(purchase.purchaseId, purchase).subscribe({
      next: (updatedPurchase) => {
        this.selectedPurchase = updatedPurchase; // si dialog ouvert
        this.generatePurchaseEvents();
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

    console.log('Update purchase status to:', purchase.purchaseStatus);
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

  getPurchaseSubtotal(): number {
    return this.selectedPurchase?.purchaseItems?.reduce((sum: number, item: any) =>
      sum + (item.totalCost || 0), 0) || 0;
  }

  isPurchaseEventActive(event: any): boolean {
    const statusPurchase = ['PENDING', 'APPROVED', 'RECEIVED', 'COMPLETED', 'CANCELED', 'RETURNED', 'PARTIAL_RETURN', 'RETURN_PENDING'];
    const currentStatusIndex = statusPurchase.indexOf(this.selectedPurchase?.purchaseStatus);
    const eventStatusIndex = statusPurchase.indexOf(event.status);
    console.log(eventStatusIndex);
    return eventStatusIndex <= currentStatusIndex;
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
    this.purchaseDialog = true;
    this.initializePickList();

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
    this.purchase.dateOfPurchase = new Date();
    this.purchase.discount = 0;
    this.purchase.taxEnabled = false;
    this.submitted = false;
    this.targetProducts = [];
    this.purchaseItems = [];
    this.onGetAllProducts();
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
          this.onGetAllProducts();
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
        this.onGetAllProducts();
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



  async onGetAllProducts() {
    await this.productService.getProducts()
      .subscribe({
        next: (response: any) => {
          this.products = response;
          this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
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



}


