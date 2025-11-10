import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
import { MessageService, SelectItem, MenuItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { DataView } from 'primeng/dataview';
import { OrderService } from 'src/app/services/order.service';
import { Product } from 'src/app/models/product';
import { Order } from 'src/app/models/order';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { OrderReturn } from 'src/app/models/orderReturn';
import { ReturnItem } from 'src/app/models/returnItem';
import { ReturnService } from 'src/app/services/return.service';
import { ReturnStatus } from 'src/app/enums/return-status.enum';
import { OrderItem } from 'src/app/models/orderItem';
import { Customer } from 'src/app/models/customer';
import { CustomerService } from 'src/app/services/customer.service';
import { Refund } from 'src/app/models/refund';
import { firstValueFrom } from 'rxjs';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';


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
  styleUrls: ['./returns.component.css', '../sales.component.css'],
  providers: [MessageService]
})
export class ReturnsComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild('pickList') pickList: ElementRef | undefined;

  Ressource: string = 'RETURNS';

  currency: any;

  returnDialog: boolean = false;

  detailsDialog: boolean = false;

  returnDetailsDialog: boolean = false;

  deleteReturnDialog: boolean = false;

  cancelReturnDialog: boolean = false;

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

  customers: Customer[] = [];

  customer: Customer = {};

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

  Math = Math;

  returnReasons: any[];

  itemConditions: any[] = [];

  // Permissions
  canAddReturn: boolean = false;
  canEditReturn: boolean = false;
  canDeleteReturn: boolean = false;

  isLoading: boolean = true;

  @ViewChild('filter') filter!: ElementRef;
  canReadReturn: boolean = false;
  canCancelReturn: boolean = false;
  lowStockThreshold: number = 10;
  
  constructor(private messageService: MessageService,
    private returnService: ReturnService,
    private orderService: OrderService,
    private customerService: CustomerService,
    private cdr: ChangeDetectorRef,
    private configService: AppConfigurationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private financialDocService: FinancialDocumentsService,
    public keycloakService: KeycloakService,
  ) {
    this.loadTaxRate();
  }

  async ngOnInit() {
    this.isLoading = true;

    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });

    this.lowStockThreshold = await this.getLowStockThreshold();


    // Set up translation and events
    this.initializeTranslations();


    // Load data
    await Promise.all([
      this.onGetAllReturns(),
      this.getSourceProducts(),
      this.getTargetProducts(),
      this.initializePickList(),
      this.onGetAllCustomers(),
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

        this.returnReasons = [
          { label: translations['return_reason_defective'], value: 'DEFECTIVE' },
          { label: translations['return_reason_incorrect_item'], value: 'INCORRECT_ITEM' },
          { label: translations['return_reason_change_of_mind'], value: 'CHANGE_OF_MIND' },
          { label: translations['return_reason_other'], value: 'OTHER' }
        ];

        this.itemConditions = [
          { label: translations['item_condition_new'], value: 'NEW' },
          { label: translations['item_condition_used'], value: 'USED' },
          { label: translations['item_condition_damaged'], value: 'DAMAGED' }
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
    this.canReadReturn = this.permissionService.canRead(this.Ressource);
    this.canCancelReturn = this.permissionService.canProcess(this.Ressource);
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

  getOrderDisplayLabel = (order: any): string => {
    if (!order) return '';

    const reference = order.reference || 'N/A';
    const totalAmount = order.totalAmount;
    //const itemCount = order.orderItems.length || 0;
    const itemCount = order.itemCount !== undefined ? order.itemCount : this.getSafeItemsCount(order);
    const customerName = this.getCustomerDisplayName(order.customer);

    return `#${reference} • ${totalAmount} • ${itemCount} ${this.translate.instant('items')} • ${customerName}`;
  }


  getSafeItemsCount(order: any): number {
    // Safest possible item count implementation
    try {
      if (!order) return 0;
      if (!order.orderItems) return 0;
      if (!Array.isArray(order.orderItems)) return 0;
      return order.orderItems.length;
    } catch (e) {
      console.warn('Error counting order items:', e);
      return 0;
    }
  }


  getCustomerDisplayName(customer: any): string {
    if (!customer) return this.translate.instant('no_customer');

    if (customer.customerType === 'Company') {
      return customer.companyName || this.translate.instant('unnamed_company');
    }

    const firstName = customer.firstName || '';
    const lastName = customer.lastName || '';
    return firstName || lastName ?
      `${firstName} ${lastName}`.trim() :
      this.translate.instant('unnamed_customer');
  }


  getSourceProducts(): Product[] {
    console.log("in get source products");

    if (this.return && this.return.order && this.return.order.orderItems?.length > 0) {
      return this.return.order.orderItems
        .filter(orderItem =>
          !this.return.returnItems?.some(
            returnItem => returnItem.product.productId === orderItem.product?.productId
          )
        )
        .map(orderItem => {
          const product = { ...orderItem.product }; // Clone to avoid mutating original object

          // Attach useful data from orderItem
          product.orderItem = orderItem;
          product.orderItemPricePerUnit = orderItem.pricePerUnit; // ✅ Set the price here

          return product;
        });
    } else {
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
          returnItemCondition: item.condition || 'NEW',
          returnItemReason: item.reason || 'INCORRECT_ITEM',
        },
        returnedQuantity: item.returnedQuantity,
        refundAmount: item.refundAmount,
        condition: item.condition || 'NEW',
        reason: item.reason || 'INCORRECT_ITEM',
      };
    });
    console.log(this.returnItems);

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

  cancelReturn(orderReturn: OrderReturn) {
    if (!this.canProcessRefund) return;
    this.cancelReturnDialog = true;
    this.return = { ...orderReturn };
  }

  async confirmDeleteSelected() {
    this.deleteReturnsDialog = false;
    await this.selectedReturns.forEach(selectedReturn => this.onDeleteReturn(selectedReturn.returnId));
    this.selectedReturns = [];
  }

  async confirmDelete() {
    this.deleteReturnDialog = false;
    await this.onDeleteReturn(this.return.returnId);
    this.return = {};
  }

  async confirmCancelReturn(){
    this.cancelReturnDialog = false;
    await this.onCancelReturn(this.return.returnId);
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
    this.return.returnDate = new Date();
    this.submitted = false;
    this.onGetAllOrders(),
      this.initializePickList();
    this.returnDialog = true;

  }

  private findOrderItemForProduct(product: Product): OrderItem | undefined {
    return this.return.order?.orderItems?.find(
      item => item.product.productId === product.productId
    );
  }

  async saveReturn() {
    console.log(this.return)
    this.submitted = true;

    // Check Product Selection
    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('no_items_returned'),
        detail: this.translate.instant('at_least_one_product_must_be_selected'),
        life: 3000,
      });
      return;
    }

    // Validate all products have OrderItem references
    const productsWithoutOrderItem = this.targetProducts.filter(
      p => !p.orderItem
    );

    if (productsWithoutOrderItem.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('invalid_products'),
        detail: this.translate.instant('some_products_missing_order_references'),
        life: 3000,
      });
      return;
    }

    if (this.return.returnDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.return.returnDate === "string"
          ? new Date(this.return.returnDate)
          : this.return.returnDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.return.returnDate = `${year}-${month}-${day}`; // Convert to string format
    }

    // Prepare Order Items
    const returnItems: ReturnItem[] = this.targetProducts.map((product) => {
      const refundAmount = product.returnItemPricePerUnit * product.returnItemQuantity;
      return {
        product: product,
        returnedQuantity: product.returnItemQuantity,
        refundAmount: refundAmount,
        condition: product.returnItemCondition || 'NEW', // Default to 'NEW' if not specified
        orderItem: product.orderItem,
        reason: product.returnItemReason || 'INCORRECT_ITEM', // Default to 'INCORRECT_ITEM' if not specified
      } as ReturnItem;
    });

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
      delete orderItem.product['orderItem']
      delete orderItem.product['returnItemCondition'];
      delete orderItem.product['returnItemReason'];
    });

    try {
      if (newOrderReturn.returnId) {
        await this.updateReturn(newOrderReturn.returnId, newOrderReturn);
        return;
      } else {
        await this.addReturn(newOrderReturn);
      }
    } catch (error) {
      console.error('Return creation failed:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('failed_to_process_return') + (error.message ? `: ${error.message}` : ''),
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


  getConditionSeverity(condition: any): string {
    switch (condition) {
      case 'NEW': return 'success';
      case 'USED': return 'warning';
      case 'DAMAGED': return 'danger';
      default: return 'info';
    }
  }


  async onGetAllReturns() {
    try {
      const response = await this.returnService.getReturns().toPromise();
      console.log(response)
      this.returns = response as OrderReturn[];
      this.returns.forEach((returnObj: any) => {
        returnObj.creationDate = new Date(<Date>returnObj.creationDate)
        returnObj.returnDate = new Date(<Date>returnObj.returnDate)
      });

      console.log(this.returns)
      this.isLoading = false;

    } catch (error) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_returns'),
        life: 3000
      });
    }
  }

  async onDeleteReturn(id: any) {
    await this.returnService.deleteReturn(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllReturns();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('return_deleted_successfully'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_return'),
            life: 3000
          });
          console.log(err);
        },
      });
  }


  async onCancelReturn(id: any) {
    this.returnService.cancelReturn(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllReturns();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('return_canceled_successfully'),
            life: 3000
          });
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_canceling_return'),
            life: 3000
          });
          console.log(err);
        },
      });
  }


  async updateReturn(id: any, orderReturn: any): Promise<any> {
    console.log(orderReturn);
    await this.returnService.updateReturn(id, orderReturn)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllReturns();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('return_updated_successfully'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_return'),
            life: 3000
          });
          return false;
        },
      });
  }

  async addReturn(orderReturn: any): Promise<any> {
    console.log(orderReturn);

    await this.returnService.saveReturn(orderReturn).subscribe({
      next: (response: any) => {
        console.log(response);
        this.onGetAllReturns();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('return_added_successfully'),
          life: 3000
        });
        return true;
      },
      error: (err: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_adding_return'),
          life: 3000
        });
        console.log(err);
        return false;
      },
    });
  }


  async onGetAllOrders() {
    try {
      this.isLoading = true;
      const response = await this.orderService.getEligibleOrdersForReturn().toPromise();

      // Preprocess orders to include itemCount
      this.orders = (response as Order[]).map(order => ({
        ...order,
        itemCount: this.calculateOrderItemsCount(order)
      }));

      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_orders'),
        life: 3000
      });
      console.error('Error fetching orders:', error);
    }
  }

  calculateOrderItemsCount(order: Order): number {
    try {
      // Check if orderItems exists and is an array
      if (order?.orderItems && Array.isArray(order.orderItems)) {
        return order.orderItems.length;
      }
      return 0;
    } catch (e) {
      console.warn('Error calculating order items count:', e);
      return 0;
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

  async onGetAllCustomers() {
    await this.customerService.getCustomers()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          this.customers = this.customers.map(customer => ({
            ...customer,
            fullName: this.getCustomerDisplayName(customer)
          }));
          console.log(this.customers);
        },
        error: (err: any) => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_customers'),
            life: 3000
          });
        }
      })
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
        const orderItem = this.findOrderItemForProduct(product);
        console.log(orderItem);

        if (!orderItem) {
          console.error('Original order item not found for product:', product);
          return;
        }
        // Check if the productId matches
        if (product.productId === item.productId) {
          console.log(item);
          product.returnItemPricePerUnit = item.orderItemPricePerUnit || item.sellingPrice;
          product.returnItemQuantity = 1;
          product.returnItemCondition = 'NEW'; // Default condition
          product.returnItemReason = 'INCORRECT_ITEM'; // Default to global reason
          product.orderItem = orderItem; // Add the orderItem field
        }
        console.log(product);
      });
    });
    // Force change detection
    this.cdr.detectChanges();
    console.log(this.targetProducts);
  }

  //function to move scanned products to target
  moveProductToTarget(product: any): void {
    if (product.quantityAvailable <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('insufficient_quantity'),
        detail: this.translate.instant('product_quantity_not_sufficient_to_move'),
        life: 3000,
      });
      console.log('Product quantity is not sufficient to move to target.');
      return;
    }

    const existingProduct = this.targetProducts.find(targetProduct => targetProduct.productId === product.productId);
    if (!existingProduct) {
      const newProduct = { ...product, returnItemPricePerUnit: product.sellingPrice, returnItemQuantity: 1, returnItemCondition: 'NEW', returnItemReason: 'INCORRECT_ITEM' };
      newProduct.orderItem = this.findOrderItemForProduct(product);
      if (!newProduct.orderItem) {
        console.error('Original order item not found for product:', product);
        return;
      }
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

  openReturnDetailsDialog(returnData: OrderReturn): void {
    this.return = { ...returnData };
    this.returnDetailsDialog = true;
  }

  getReturnReasonLabel(reason: string): string {
    const found = this.returnReasons.find(r => r.value === reason);
    return found ? found.label : reason;
  }

  getRefundMethodIcon(method: string): string {
    switch (method) {
      case 'Cash': return 'pi pi-money-bill';
      case 'Card': return 'pi pi-credit-card';
      case 'Transfer': return 'pi pi-bank';
      case 'Check': return 'pi pi-file-edit';
      case 'BOE': return 'pi pi-file-edit';
      default: return 'pi pi-dollar';
    }
  }

  getRefundStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'success';
      case 'processing': return 'info';
      case 'completed': return 'warning';
      case 'failed': return 'danger';
      default: return 'danger';
    }
  }


  getRefundMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
      case 'cash': return 'success';
      case 'card': return 'info';
      case 'transfer': return 'warning';
      case 'check': return 'help';
      case 'boe': return 'help';
      default: return 'danger';
    }
  }

  canProcessRefund(): boolean {
    return this.return?.returnStatus !== ReturnStatus.COMPLETED &&
      this.return?.totalRefundableAmount > 0;
  }

  viewOrder(order: Order): void {
    // Implement your order view logic
    console.log('View order:', order);
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('order_details'),
      detail: this.translate.instant('showing_details_for_order', { orderId: order.orderId })
    });
  }

  processRefund(): void {
    // Implement your refund processing logic
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('process_refund'),
      detail: this.translate.instant('opening_refund_dialog')
    });
  }

  printReturn(): void {
    window.print();
  }

  generateReturnNote(orderReturn: OrderReturn) {
      this.financialDocService.generateReturnNoteFromReturn(orderReturn.returnId).subscribe({
        next: (res: any) => {
          // this.invoiceDialogVisible = false;
  
          // Reuse the existing logic to open the PDF
          this.financialDocService.printFinancialDoc(res.number);
  
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('invoice_generated'),
            detail: res.number,
          });
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('invoice_generation_failed'),
          });
        }
      });
    }

  exportToPDF(): void {
    // Implement PDF export logic
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('export_pdf'),
      detail: this.translate.instant('return_exported_pdf')
    });
  }

  /**
   * Check if a refund is currently active in the timeline
   */
  isRefundActive(refund: Refund): boolean {
    if (!this.return?.refunds || this.return.refunds.length === 0) {
      return false;
    }

    // Assuming the most recent refund is active, or use your business logic
    const latestRefund = this.return.refunds[this.return.refunds.length - 1];
    return refund.refundId === latestRefund.refundId;
  }


  /**
   * Get condition label for display
   */
  getConditionLabel(condition: string): string {
    const conditionItem = this.itemConditions?.find(item => item.value === condition);
    return conditionItem?.label || condition || 'N/A';
  }

  /**
   * Get return status severity for tags
   */
  getReturnStatusSeverity(status: ReturnStatus): string {
    const statusSeverity: { [key: string]: string } = {
      'PENDING': 'warning',
      'APPROVED': 'success',
      'REJECTED': 'danger',
      'COMPLETED': 'success',
      'CANCELLED': 'danger',
      'PROCESSING': 'info'
    };

    return statusSeverity[status] || 'info';
  }


  /**
   * Refresh return details
   */
  refreshReturnDetails(): void {
    if (this.return?.returnId) {
      // Implement your refresh logic here
      console.log('Refreshing return details:', this.return.returnId);

      // Example implementation:
      // this.returnService.getReturnById(this.return.returnId).subscribe({
      //     next: (returnData) => {
      //         this.return = returnData;
      //     },
      //     error: (error) => {
      //         this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to refresh return details'});
      //     }
      // });
    }
  }


  /**
   * Calculate total refunded amount
   */
  getTotalRefundedAmount(): number {
    if (!this.return?.refunds || this.return.refunds.length === 0) {
      return 0;
    }

    return this.return.refunds.reduce((total: number, refund: Refund) => {
      return total + (refund.amount || 0);
    }, 0);
  }

  /**
   * Get remaining refundable amount
   */
  getRemainingRefundableAmount(): number {
    const totalRefundable = this.return?.totalRefundableAmount || 0;
    const totalRefunded = this.getTotalRefundedAmount();
    return Math.max(0, totalRefundable - totalRefunded);
  }

  /**
   * Check if return is fully refunded
   */
  isFullyRefunded(): boolean {
    return this.getRemainingRefundableAmount() <= 0;
  }

    getMeasureUnit(product: Product): string {
      if (!product.measureUnit) return 'UNIT'; // fallback
  
      const pluralizable = ['UNIT', 'PIECE', 'BOX', 'METER'];
  
      if (product.quantityAvailable > 1 && pluralizable.includes(product.measureUnit)) {
        return `${product.measureUnit}_plural`;
      }
  
      return product.measureUnit;
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

}
