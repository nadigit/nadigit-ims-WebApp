import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
import { MessageService, SelectItem, MenuItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { DataView } from 'primeng/dataview';
import { OrderService } from 'src/app/services/order.service';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { Order } from 'src/app/models/order';
import { InvoiceService } from 'src/app/services/invoice.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { OrderReturn } from 'src/app/models/orderReturn';
import { ReturnItem } from 'src/app/models/returnItem';
import { ReturnService } from 'src/app/services/return.service';


@Pipe({
  name: 'filterProducts'
})
export class FilterProductsPipe implements PipeTransform {
  transform(source: any[], selectedProducts: any[]): any[] {
    // Your filtering logic here
    return source.filter(product => !selectedProducts.includes(product));
  }
}

@Component({
  templateUrl: './returns.component.html',
  styleUrls: ['./returns.component.css', '../pages.component.css'],
  providers: [MessageService]
})
export class ReturnsComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild('pickList') pickList: ElementRef | undefined;

  Ressource: string = 'RETURNS';

  currency: any;

  returnDialog: boolean = false;

  detailsDialog: boolean = false;


  deleteReturnDialog: boolean = false;

  deleteReturnsDialog: boolean = false;

  products: Product[] = [];

  product: Product = {};

  returns: OrderReturn[] = [];

  return: OrderReturn = {};

  orders: Order[] = [];

  selectedProducts: Product[] = [];

  otherTemplate: Product[] = [];

  selectedReturns: OrderReturn[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  sortOptions: SelectItem[] = [];

  sortReturn: number = 0;

  sortField: string = '';

  menuItems: MenuItem[] = [];

  items: MenuItem[] | undefined;

  sourceProducts: Product[] = [];

  targetProducts: Product[] = [];

  returnItems: ReturnItem[] = [];

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  exportColumns!: ExportColumn[];

  originalEvents: any[];

  statusDate: any;
  userRoles: any;
  isAdmin: boolean = false;

  selectedItems: any[] = [];  // Selected order items for return

  returnReason: string = '';
  returnNotes: string | null = null;

  orderReturns: any;

  images: any[];

  responsiveOptions: any[] = [
    {
      breakpoint: '1024px',
      numVisible: 5
    },
    {
      breakpoint: '768px',
      numVisible: 3
    },
    {
      breakpoint: '560px',
      numVisible: 1
    }
  ];

  loading: boolean = false;

  barcode: string = '';

  scanTimeout: any;

  scanning: boolean = true;

  TaxEnabledOptions: any[] = [];

  taxEnabled: boolean = false;

  taxRate: number = 0.0;

  // Permissions
  canAddReturn: boolean = false;
  canEditReturn: boolean = false;
  canDeleteReturn: boolean = false;

  isLoading: boolean = true;

  @ViewChild('filter') filter!: ElementRef;

  constructor(private messageService: MessageService,
    private returnService: ReturnService,
    private orderService: OrderService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private invoiceService: InvoiceService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
  ) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;

    // Set up translation and events
    this.initializeTranslations();

    // Load data
    await Promise.all([
      this.onGetAllReturns(),
      this.getSourceProducts(),
      this.getTargetProducts(),
      this.initializePickList(),
      this.onGetCurrency(),
      this.setUserRoles(),
      this.checkPermissions(),
    ]);

    // Initialize table columns and statuses
    this.initializeTableColumns();

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
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

  private async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  private initializeTableColumns() {
    this.cols = [
      { field: 'orderId', header: this.translateService.instant('order_id') },
      { field: 'orderStatus', header: this.translateService.instant('order_status') },
      { field: 'Customer', header: this.translateService.instant('order_customer') },
      { field: 'orderDate', header: this.translateService.instant('order_ordered_on') },
      { field: 'deliveryDate', header: this.translateService.instant('order_delivered_on') },
      { field: 'completeDate', header: this.translateService.instant('order_completed_on') },
      { field: 'totalAmount', header: this.translateService.instant('order_total_amount') },
    ];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('return' in changes) {
      this.initializePickList();
    }
  }


  ngAfterViewInit() {
    if (this.pickList) {
      // Get all list items in the source and target containers
      const sourceItems = this.pickList.nativeElement.querySelectorAll('.p-picklist-source .p-picklist-item');
      const targetItems = this.pickList.nativeElement.querySelectorAll('.p-picklist-target .p-picklist-item');

    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddReturn = this.permissionService.canCreate(this.Ressource);
    this.canEditReturn = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteReturn = this.permissionService.canDelete(this.Ressource);

  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      this.taxRate = response.value;
      console.log("tax:" + this.taxRate)
    });
  }

  toggleRow(returnID: string): void {
    this.expandedRows[returnID] = !this.expandedRows[returnID];
  }

  isRowExpanded(returnID: string): boolean {
    return this.expandedRows[returnID] === true;
  }

  hideDialog() {
    this.returnDialog = false;
    this.submitted = false;
  }

  initializePickList(): void {
    this.sourceProducts = this.getSourceProducts();
    this.targetProducts = this.getTargetProducts();
  }


  getSourceProducts(): Product[] {
    console.log("in get source products");
    if (this.return && this.return.order && this.return.order.orderItems?.length > 0) {
      return this.return.order.orderItems
        .map(orderItem => orderItem.product) // Extract products from order items
        .filter(product =>
          !this.return.returnItems?.some(
            returnItem => returnItem.product.productId === product.productId // Not already part of return items
          )
        );
    } else {
      // Return empty array if no order or order items exist
      return [];
    }
  }

  getTargetProducts(): Product[] {
    let targetProducts: Product[] = [];
    if (this.return && this.return.returnItems && this.return.returnItems.length > 0) {
      this.return.returnItems.forEach(element => {
        targetProducts.push(element.product);
      });
      return targetProducts;
    } else {
      return [];
    }
  }

  deleteSelectedReturns() {
    if (!this.canDeleteReturn) return;
    this.deleteReturnsDialog = true;
  }

  editReturn(orderReturn: OrderReturn) {
    if (!this.canEditReturn) return;
  
    // Clone the orderReturn to this.return to prevent side-effects
    this.return = { ...orderReturn };
  
    // Initialize returnItems by mapping the return data to the required structure
    this.returnItems = this.return.returnItems.map(item => {
      return {
        returnItemId: item.returnItemId,
        product: {
          ...item.product,
          returnItemQuantity: item.returnedQuantity,
          returnItemPricePerUnit: item.refundAmount,
        },
        returnedQuantity: item.returnedQuantity,
        refundAmount: item.refundAmount,
      };
    });
  
    // Set the return dialog to true
    this.returnDialog = true;
  
    // Initialize pick list
    this.initializePickList();
  
    // Add the new fields directly to the order object for consistency
    this.return.returnItems.forEach(item => {
      item.product.returnItemQuantity = item.returnedQuantity;
      item.product.returnItemPricePerUnit = item.refundAmount;
    });
  
    // Ensure targetProducts are updated with the current return items
    this.targetProducts = [...this.returnItems.map(item => item.product)];
  
    // Log the return to verify
    console.log(this.return);
  }
  


  // Update the remaining quantity after return
  updateRemainingQuantity(item: any) {
    item.remainingQuantity = item.quantity - item.returnedQuantity;

    // Log to see if returnedQuantity is updated
    console.log('Updated returnedQuantity:', item.returnedQuantity);
  }

  updateReturnedQuantity(item: any) {
    // Update the corresponding item in selectedItems with the new returnedQuantity value
    const selectedItem = this.selectedItems.find(si => si.orderItemId === item.orderItemId);
    if (selectedItem) {
      selectedItem.returnedQuantity = item.returnedQuantity;
    }
    // Optionally update remainingQuantity here as well
    this.updateRemainingQuantity(item);
  }

  deleteReturn(orderReturn: OrderReturn) {
    if (!this.canDeleteReturn) return;
    this.deleteReturnDialog = true;
    this.return = { ...orderReturn };
  }

  async confirmDeleteSelected() {
    this.deleteReturnsDialog = false;
    await this.selectedReturns.forEach(selectedReturn => this.onDeleteReturn(selectedReturn.returnId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Returns Deleted', life: 3000 });
    this.selectedReturns = [];
  }

  async confirmDelete() {
    this.deleteReturnDialog = false;
    await this.onDeleteReturn(this.return.returnId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Return Deleted', life: 3000 });
    this.return = {};
  }

  hideDetailsDialog() {
    this.detailsDialog = false;

  }

  openNew() {
    if (!this.canAddReturn) return;
    this.return = {};
    this.targetProducts = [];
    this.returnItems = [];
    this.submitted = false;
    this.returnDialog = true;
    this.onGetAllOrders(),
    this.initializePickList();

  }

  async saveReturn() {
    console.log(this.return)
    this.submitted = true;

    // if (Object.keys(this.targetProducts).length === 0) {
    //   this.messageService.add({ severity: 'warn', summary: 'No items returned', detail: 'Please specify the product to return' });
    //   return;
    // }

    if (!this.return.reason || this.return.reason.trim() === '') {
      this.messageService.add({ severity: 'warn', summary: 'Reason required', detail: 'Please provide a reason for the return.' });
      return;
    }

    // Check Product Selection
    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No items returned',
        detail: 'At least one product must be selected.',
        life: 3000,
      });
      return;
    }

    // Prepare Order Items
    const returnItems: ReturnItem[] = this.targetProducts.map((product) => ({
      product,
      returnedQuantity: product['returnItemQuantity'],
      refundAmount: product['returnItemPricePerUnit'],
    }));

    console.log(returnItems)
    // Create New Order Object
    const newOrderReturn: OrderReturn = {
      ...this.return,
      returnItems,
    };

    console.log(newOrderReturn)

    // Cleanup: Remove temporary fields from products
    newOrderReturn.returnItems.forEach((orderItem) => {
      delete orderItem.product['returnItemQuantity'];
      delete orderItem.product['returnItemPricePerUnit'];
    });

    try {
      if (newOrderReturn.returnId) {
        // await this.updateReturn(newOrderReturn.returnId, newOrderReturn);
        // this.messageService.add({
        //   severity: 'success',
        //   summary: 'Successful',
        //   detail: 'Return Updated',
        //   life: 3000,
        // });
        return;
      } else {
        await this.addReturn(newOrderReturn);
        this.messageService.add({
          severity: 'success',
          summary: 'Successful',
          detail: 'Return Added',
          life: 3000,
        });
      }
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Error occurred',
        life: 3000,
      });
    }

    this.returns = [...this.returns];
    this.returnDialog = false;
    this.return = {};
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

  async onGetAllReturns() {
    try {
      const response = await this.returnService.getReturns().toPromise();
      console.log(response)
      this.returns = response as OrderReturn[];

      // Order the orders by orderDate in descending order
      // this.returns.sort((a, b) => b.returnDate.getTime() - a.returnDate.getTime());

      console.log(this.returns)
      this.isLoading = false;
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting returns', life: 3000 });
    }
  }

  async onDeleteReturn(id: any) {
    await this.returnService.deleteReturn(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllReturns();
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while deleting the return', life: 3000 })
          console.log(err)
        },
      })
  }


  // async updateReturn(id: any, orderReturn: any): Promise<any> {
  //   console.log(orderReturn)
  //   // orderReturn.products = this.targetProducts;
  //   await this.returnService.updateReturn(id, orderReturn)
  //     .subscribe({
  //       next: (response: any) => {
  //         console.log(response);
  //         this.onGetAllReturns();
  //         return true;
  //       },
  //       error(err: any) {
  //         this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating the error', life: 3000 })
  //         return false;
  //       },
  //     })
  // }

  async addReturn(orderReturn: any): Promise<any> {
    console.log(orderReturn);

    await this.returnService.saveReturn(orderReturn).subscribe({
      next: (response: any) => {
        console.log(response);
        this.onGetAllReturns();
        return true;
      },
      error(err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new return', life: 3000 })
        console.log(err);
        return false;
      },
    });
  }

  async onGetAllOrders() {
    try {
      const response = await this.orderService.getDeliveredOrders().toPromise();
      this.orders = response as Order[];
      this.isLoading = false;
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting orders', life: 3000 });
    }
  }

  onSortChange(event: any) {
    const value = event.value;

    if (value.indexOf('!') === 0) {
      this.sortReturn = -1;
      this.sortField = value.substring(1, value.length);
    } else {
      this.sortReturn = 1;
      this.sortField = value;
    }
  }

  downloadInvoice(orderId: number, status: string): void {
    console.log("status: " + status)
    this.invoiceService.generateInvoice(orderId, status).subscribe((data: Blob) => {
      const blob = new Blob([data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url); // or use FileSaver or another library for download
    });
  }

  exportPdf() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedReturns = this.returns.map(orderReturn => {
      // Create a copy of the supplier object to modify
      const modifiedReturn = { ...orderReturn };
      if (orderReturn.order)
        modifiedReturn['Order'] = orderReturn.order.orderId;

      // Remove the column you want to exclude
      delete modifiedReturn.creationDate;
      delete modifiedReturn.order;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedReturn;
    });

    // Now, export the modified array to PDF
    this.reportingService.exportPdf(this.exportColumns, modifiedReturns, 'returns')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedReturns = this.returns.map(orderReturn => {
      // Create a copy of the supplier object to modify
      const modifiedReturn = { ...orderReturn };
      if (orderReturn.order)
        modifiedReturn['Order'] = orderReturn.order.orderId;

      // Remove the column you want to exclude
      delete modifiedReturn.creationDate;
      delete modifiedReturn.order;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedReturn;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedReturns, 'returns');
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
          product.returnItemPricePerUnit = item.sellingPrice;
          product.returnItemQuantity = 1;
        }
      });
    });
    // Force change detection
    this.cdr.detectChanges();
    console.log(this.targetProducts);
  }

  //function to move scanned products to target
  moveProductToTarget(product: any): void {
    if (product.quantityAvailable <= 0) {
      console.log('Product quantity is not sufficient to move to target.');
      return;
    }

    const existingProduct = this.targetProducts.find(targetProduct => targetProduct.productId === product.productId);
    if (!existingProduct) {
      const newProduct = { ...product, returnItemPricePerUnit: product.sellingPrice, returnItemQuantity: 1 };
      this.targetProducts.push(newProduct);
      this.sourceProducts = this.sourceProducts.filter(p => p.productId !== product.productId);
      this.returnItems.push(newProduct); // Update orderItems for ngModel binding
      this.cdr.detectChanges(); // Trigger change detection
    } else {
      existingProduct.returnItemQuantity += 1;
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

  async onGetCurrency() {
    await (await this.configService.getConfigurationValue('currency'))
      .subscribe({
        next: (response: any) => {
          this.currency = response;
          console.log(this.currency)
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  calculateTotalAmount(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.returnItemQuantity * product.returnItemPricePerUnit;
    }

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    // Return the final total
    return total;
  }

}
