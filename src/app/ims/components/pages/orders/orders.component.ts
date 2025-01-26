import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
import { MessageService, SelectItem, MenuItem } from 'primeng/api';
import { Table } from 'primeng/table';
import { DataView } from 'primeng/dataview';
import { OrderService } from 'src/app/services/order.service';
import { Product } from 'src/app/models/product';
import { ProductService } from 'src/app/services/product.service';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { OrderItem } from 'src/app/models/orderItem';
import { InvoiceService } from 'src/app/services/invoice.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Country, State } from 'country-state-city';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { Shop } from 'src/app/models/shop';
import { ShopService } from 'src/app/services/shop.service';

interface EventItem {
  status?: string;
  date?: string;
  icon?: string;
  color?: string;
  image?: string;
  button?: string;
  buttonDescription?: string
}

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
  templateUrl: './orders.component.html',
  styleUrls: ['./orders.component.css', '../pages.component.css'],
  providers: [MessageService]
})
export class OrdersComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild('pickList') pickList: ElementRef | undefined;

  Ressource: string = 'ORDERS';

  currency: any;

  events: EventItem[];

  orderDialog: boolean = false;

  detailsDialog: boolean = false;

  customerDialog: boolean = false;

  shopDialog: boolean = false;

  orderReturnDialog: boolean = false;

  deleteOrderDialog: boolean = false;

  deleteOrdersDialog: boolean = false;

  products: Product[] = [];

  customers: Customer[] = [];

  customer: Customer = {};

  shops: Shop[] = [];

  shop: Shop = {};

  product: Product = {};

  orders: Order[] = [];

  order: Order = {};

  selectedProducts: Product[] = [];

  otherTemplate: Product[] = [];

  selectedOrders: Order[] = [];

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

  sourceProducts: Product[] = [];

  targetProducts: Product[] = [];

  orderItems: OrderItem[] = [];

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  exportColumns!: ExportColumn[];

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  originalEvents: any[];

  statusDate: any;
  userRoles: any;
  isAdmin: boolean = false;

  selectedItems: any[] = [];  // Selected order items for return

  discountType: 'Amount' | 'Percentage'; // Default type is "amount"

  returnReason: string = '';
  returnNotes: string | null = null;

  orderReturns: any;



  statusSequences: { [key: string]: string[] } = {
    'Ordered': ['Processing'],
    'Processing': ['Delivered'],
    'Delivered': ['Completed'],
    'Partial_Return': ['Completed'],
    'Completed': [],
    'Cancelled': [],
    'Returned': [],
  };

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

  discountTypeOptions: any;

  // Permissions
  canAddCustomer: boolean = false;
  canAddShop: boolean = false;
  canAddOrder: boolean = false;
  canEditOrder: boolean = false;
  canDeleteOrder: boolean = false;
  canProcessOrder: boolean = false;

  isLoading: boolean = true;

  @ViewChild('filter') filter!: ElementRef;

  constructor(private messageService: MessageService,
    private orderService: OrderService,
    private productService: ProductService,
    private customerService: CustomerService,
    private shopService: ShopService,
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
      this.onGetAllProducts(),
      this.onGetAllCustomers(),
      this.onGetAllShops(),
      this.onGetAllOrders(),
      this.getSourceProducts(),
      this.getTargetProducts(),
      this.initializePickList(),
      this.onGetCurrency(),
      this.setUserRoles(),
      this.checkPermissions(),
    ]);

    // Initialize table columns and statuses
    this.initializeTableColumns();
    this.initializeStatuses();

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }

  private initializeTranslations() {
    this.translateService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang); // Update language
    });

    this.translate
      .getTranslation(this.translateService.getPreferredLanguage())
      .subscribe((translations) => {
        this.discountTypeOptions = [
          { label: 'amount', value: 'Amount' },
          { label: 'percentage', value: 'Percentage' }
        ];
        this.events = [
          {
            status: 'Ordered',
            date: 'test',
            icon: 'pi pi-print',
            color: '#9C27B0',
            image: 'game-controller.jpg',
            button: translations['process_order_button'],
            buttonDescription: translations['generate_quote'],
          },
          {
            status: 'Processing',
            date: 'test',
            icon: 'pi pi-print',
            color: '#673AB7',
            button: translations['deliver_order_button'],
            buttonDescription: translations['generate_purchase_order']
          },
          {
            status: 'Delivered',
            date: 'test',
            icon: 'pi pi-print',
            color: '#607D8B',
            button: translations['complete_order_button'],
            buttonDescription: translations['generate_delivery_order']
          },
          {
            status: 'Partial_Return',
            date: 'test',
            icon: 'pi pi-print',
            color: '#607C6A',
            button: translations['complete_order_button'],
            buttonDescription: translations['generate_return_order']
          },
          { 
            status: 'Completed', 
            date: 'test', 
            icon: 'pi pi-print', 
            color: '#608b68',
            buttonDescription: translations['generate_invoice']
          },
          { 
            status: 'Canceled', 
            date: 'test', 
            icon: 'pi pi-times-circle', 
            color: '#FF9800' 
          },
          { 
            status: 'Returned', 
            date: 'test', 
            icon: 'pi pi-print', 
            color: '#FF9800',
            buttonDescription: translations['generate_return_order']
          },
        ];

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

  private initializeStatuses() {
    this.statuses = [
      { label: 'Ordered', value: 'Ordered' },
      { label: 'Delivered', value: 'Delivered' },
      { label: 'Canceled', value: 'Canceled' },
      { label: 'Completed', value: 'Completed' },
      { label: 'Returned', value: 'Returned' },
      { label: 'Partial_Return', value: 'Partial_Return' },
      { label: 'Processing', value: 'Processing' },
    ];
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('order' in changes) {
      this.initializePickList();
    }
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

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddOrder = this.permissionService.canCreate(this.Ressource);
    this.canEditOrder = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteOrder = this.permissionService.canDelete(this.Ressource);
    this.canProcessOrder = this.permissionService.canProcess(this.Ressource);

    this.canAddCustomer = this.permissionService.canCreate('CUSTOMERS');
    this.canAddShop = this.permissionService.canCreate('SHOPS');
  }

  async loadTaxRate() {
    (await this.configService.getConfiguration("tax")).subscribe((response: any) => {
      this.taxRate = response.value;
      console.log("tax:" + this.taxRate)
    });
  }

  toggleRow(orderID: string): void {
    this.expandedRows[orderID] = !this.expandedRows[orderID];
  }

  isRowExpanded(orderID: string): boolean {
    return this.expandedRows[orderID] === true;
  }

  initializePickList(): void {
    this.sourceProducts = this.getSourceProducts();
    this.targetProducts = this.getTargetProducts();
  }

  getSourceProducts(): Product[] {
    if (this.order && this.order.orderItems && this.order.orderItems.length > 0) {
      return this.products.filter(product =>
        product.quantityAvailable > 0 &&
        !this.order.orderItems.some(targetProduct => targetProduct.product.productId === product.productId)
      );
    } else {
      return this.products.filter(product => product.quantityAvailable > 0);
    }
  }

  getTargetProducts(): Product[] {
    let targetProducts: Product[] = [];
    if (this.order && this.order.orderItems && this.order.orderItems.length > 0) {
      this.order.orderItems.forEach(element => {
        targetProducts.push(element.product);
      });
      return targetProducts;
    } else {
      return [];
    }
  }


  openCustomerDialog() {
    if (!this.canAddCustomer) return;
    this.customer = {};
    this.customerDialog = true;
  }

  openShopDialog() {
    if (!this.canAddShop) return;
    this.shop = {};
    this.shopDialog = true;
  }

  deleteSelectedOrders() {
    if (!this.canDeleteOrder) return;
    this.deleteOrdersDialog = true;
  }

  editOrder(order: Order) {
    if (!this.canEditOrder) return;
    this.order = { ...order };
    console.log(this.discountType);
    console.log(this.order);
    this.discountType = this.order.discountType as "Amount" | "Percentage";
    console.log(this.discountType);
    this.orderItems = this.order.orderItems.map(item => {
      return {
        orderItemId: item.orderItemId,
        product: {
          ...item.product,
          orderItemQuantity: item.quantity,
          orderItemPricePerUnit: item.pricePerUnit,
        },
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
      };
    });
    this.orderDialog = true;
    this.initializePickList();

    // Add the new fields directly to the order object
    this.order.orderItems.forEach(item => {
      item.product.orderItemQuantity = item.quantity;
      item.product.orderItemPricePerUnit = item.pricePerUnit;
    });

    console.log(this.order);
  }

  openOrderReturn(order: Order) {
    if (!this.canProcessOrder) return;
    this.order = { ...order };
    this.selectedItems = order.orderItems.map(item => ({
      ...item,
      returnedQuantity: 0, // Ensure this is initialized to 0
      remainingQuantity: item.quantity
    }));
    console.log('Selected Items:', this.selectedItems);  // Add this for debugging
    this.orderReturnDialog = true;
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

  // Save the order return (submit to backend)
  saveOrderReturn() {
    console.log(this.selectedItems);

    // Prepare the return data in a Map format (orderItemId => returnedQuantity)
    const returnedItems = this.selectedItems.reduce((acc: any, item: any) => {
      console.log('Item returned quantity:', item.returnedQuantity); // Debugging log
      if (item.returnedQuantity > 0) {
        acc[item.orderItemId] = item.returnedQuantity; // Use orderItemId as the key
      }
      return acc;
    }, {});

    console.log('Returned Items:', returnedItems); // Debugging log

    if (Object.keys(returnedItems).length === 0) {
      this.messageService.add({ severity: 'warn', summary: 'No items returned', detail: 'Please specify the quantity to return' });
      return;
    }

    if (!this.returnReason || this.returnReason.trim() === '') {
      this.messageService.add({ severity: 'warn', summary: 'Reason required', detail: 'Please provide a reason for the return.' });
      return;
    }

    // Call the API to process the return
    this.orderService
      .processReturn(this.order.orderId, returnedItems, this.returnReason, this.returnNotes || null)
      .subscribe({
        next: (response) => {
          this.messageService.add({ severity: 'success', summary: 'Return processed', detail: 'The order return has been successfully processed.' });
          this.hideOrderReturnDialog();
          this.onGetAllOrders();
        },
        error: (err) => {
          console.error('Error processing return:', err); // Debugging log
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'There was an error processing the return.' });
        }
      });

    // Refresh the orders and reset dialog
    this.orders = [...this.orders];
    this.orderReturnDialog = false;
    this.order = {};
  }

  deleteOrder(order: Order) {
    if (!this.canDeleteOrder) return;
    this.deleteOrderDialog = true;
    this.order = { ...order };
  }

  async confirmDeleteSelected() {
    this.deleteOrdersDialog = false;
    await this.selectedOrders.forEach(selectedOrder => this.onDeleteOrder(selectedOrder.orderId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Orders Deleted', life: 3000 });
    this.selectedOrders = [];
  }

  async confirmDelete() {
    this.deleteOrderDialog = false;
    await this.onDeleteOrder(this.order.orderId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Order Deleted', life: 3000 });
    this.order = {};
  }

  hideDialog() {
    this.orderDialog = false;
    this.submitted = false;
  }

  hideCustomerDialog() {
    this.customerDialog = false;
  }
  hideShopDialog() {
    this.shopDialog = false;
  }

  hideDetailsDialog() {
    this.detailsDialog = false;

  }
  hideOrderReturnDialog() {
    this.orderReturnDialog = false;
  }

  openNew() {
    if (!this.canAddOrder) return;
    this.order = {};
    this.order.paymentMethod = "Cash";
    this.discountType = "Amount";
    this.order.discount = 0;
    this.order.taxEnabled = false;
    this.targetProducts = [];
    this.orderItems = [];
    this.submitted = false;
    this.orderDialog = true;
    this.onGetAllProducts();
    this.initializePickList();

  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async saveOrder() {
    this.submitted = true;

    // Validate Discount Type and Ensure Proper Handling
    if (this.discountType === 'Percentage' && this.order.discount > 100) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Percentage discount cannot exceed 100%',
        life: 3000,
      });
      return;
    }

    // Format Date Fields for Backend
    if (this.order.paymentMethod === 'Check' && this.order.checkExpirationDate) {
      const date =
        typeof this.order.checkExpirationDate === 'string'
          ? new Date(this.order.checkExpirationDate)
          : this.order.checkExpirationDate;
      this.order.checkExpirationDate = this.formatDate(date);
    } else if (this.order.paymentMethod === 'BOE' && this.order.boeExpirationDate) {
      const date =
        typeof this.order.boeExpirationDate === 'string'
          ? new Date(this.order.boeExpirationDate)
          : this.order.boeExpirationDate;
      this.order.boeExpirationDate = this.formatDate(date);
    }

    // Check Customer Selection
    if (!this.order.customer) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Customer is required.',
        life: 3000,
      });
      return;
    }

    // Check Shop Selection (if admin)
    if (this.isAdmin && !this.order.shop) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Shop is required.',
        life: 3000,
      });
      return;
    }

    // Check Product Selection
    if (this.targetProducts.length === 0) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'At least one product must be selected.',
        life: 3000,
      });
      return;
    }

    // Prepare Order Items
    const orderItems: OrderItem[] = this.targetProducts.map((product) => ({
      product,
      quantity: product['orderItemQuantity'],
      pricePerUnit: product['orderItemPricePerUnit'],
    }));

    // Create New Order Object
    const newOrder: Order = {
      ...this.order,
      orderItems,
      taxEnabled: this.taxEnabled,
      discountType: this.discountType, // Pass discount type as it is
      discount: this.order.discount, // Pass discount value without conversion
    };

    // Cleanup: Remove temporary fields from products
    newOrder.orderItems.forEach((orderItem) => {
      delete orderItem.product['orderItemQuantity'];
      delete orderItem.product['orderItemPricePerUnit'];
    });

    try {
      if (newOrder.orderId) {
        await this.updateOrder(newOrder.orderId, newOrder);
        this.messageService.add({
          severity: 'success',
          summary: 'Successful',
          detail: 'Order Updated',
          life: 3000,
        });
      } else {
        await this.addOrder(newOrder);
        this.messageService.add({
          severity: 'success',
          summary: 'Successful',
          detail: 'Order Added',
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

    this.orders = [...this.orders];
    this.orderDialog = false;
    this.order = {};
  }

  saveCustomer() {
    if (this.customer.firstName && this.customer.lastName) {
      this.addCustomer(this.customer) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Added', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding customer', life: 3000 }))
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
      return;
    }
    this.customers = [...this.customers];
    this.customerDialog = false;
    this.customer = {};
  }

  saveShop() {
    if (this.shop.shopName) {
      this.addCustomer(this.shop) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Shop Added', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding shop', life: 3000 }))
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
      return;
    }
    this.shops = [...this.shops];
    this.shopDialog = false;
    this.shop = {};
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



  async onGetAllProducts() {
    await this.productService.getProducts()
      .subscribe({
        next: (response: any) => {
          this.products = response;
          this.products.forEach((product: any) => (product.creationDate = new Date(<Date>product.creationDate)));
          console.log(this.products);
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting products', life: 3000 })
        }
      })
  }

  async onGetAllCustomers() {
    await this.customerService.getCustomers()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          this.customers = this.customers.map(customer => ({
            ...customer,
            fullName: `${customer.firstName} ${customer.lastName}`
          }));
          console.log(this.customers);
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting customers', life: 3000 })
        }
      })
  }

  async onGetAllShops() {
    await this.shopService.getShops()
      .subscribe({
        next: (response: any) => {
          this.shops = response;
          console.log(this.shops);
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting shops', life: 3000 })
        }
      })
  }

  async onGetAllOrderReturn(orderId) {
    await this.orderService.getOrdersReturns(orderId)
      .subscribe({
        next: (response: any) => {
          this.orderReturns = response;
          console.log(this.orderReturns);
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting order return items', life: 3000 })
        }
      })
  }

  async onGetAllOrders() {
    try {
      const response = await this.orderService.getOrders().toPromise();
      this.orders = response as Order[];

      this.orders.forEach((productOrder: any) => {
        // Convert dates only if they are not null or undefined
        if (productOrder.deliveryDate) {
          productOrder.deliveryDate = new Date(productOrder.deliveryDate);
        }
        if (productOrder.expiryDate) {
          productOrder.expiryDate = new Date(productOrder.expiryDate);
        }
        if (productOrder.orderDate) {
          productOrder.orderDate = new Date(productOrder.orderDate);
        }
        if (productOrder.completeDate) {
          productOrder.completeDate = new Date(productOrder.completeDate);
        }
        if (productOrder.cancelDate) {
          productOrder.cancelDate = new Date(productOrder.cancelDate);
        }
        if (productOrder.returnDate) {
          productOrder.returnDate = new Date(productOrder.returnDate);
        }
        if (productOrder.processingDate) {
          productOrder.processingDate = new Date(productOrder.processingDate);
        }
        if (productOrder.checkExpirationDate) {
          productOrder.checkExpirationDate = new Date(productOrder.checkExpirationDate);
        }
        if (productOrder.boeExpirationDate) {
          productOrder.boeExpirationDate = new Date(productOrder.boeExpirationDate);
        }
        // Add a computed field for product names
        productOrder.productDetails = productOrder.orderItems
          .map((item: any) => `${item.product.name} (Ref: ${item.product.reference})`)
          .join(', ');
      });

      // Order the orders by orderDate in descending order
      this.orders.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());

      console.log(this.orders)
      this.isLoading = false;
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting orders', life: 3000 });
    }
  }

  async onDeleteOrder(id: any) {
    await this.orderService.deleteOrder(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllOrders();
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while deleting the order', life: 3000 })
          console.log(err)
        },
      })
  }


  async updateOrder(id: any, order: any): Promise<any> {
    console.log(order)
    order.products = this.targetProducts;
    await this.orderService.updateOrder(id, order)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllOrders();
          this.onGetAllProducts();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating the order', life: 3000 })
          return false;
        },
      })
  }

  async addOrder(order: any): Promise<any> {
    console.log(order);

    await this.orderService.saveOrder(order).subscribe({
      next: (response: any) => {
        console.log(response);
        this.onGetAllOrders();
        this.onGetAllProducts();
        return true;
      },
      error(err: any) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new order', life: 3000 })
        console.log(err);
        return false;
      },
    });
  }

  async addCustomer(data: any): Promise<any> {
    await this.customerService.saveCustomer(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCustomers();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new customer', life: 3000 })
          console.log(err);
          return false;
        },
      })
  }

  async addShop(data: any): Promise<any> {
    await this.shopService.saveShop(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new shop', life: 3000 })
          console.log(err);
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
    const modifiedOrders = this.orders.map(order => {
      // Create a copy of the supplier object to modify
      const modifiedOrder = { ...order };
      if (order.customer)
        modifiedOrder['Customer'] = order.customer.firstName + ' ' + order.customer.lastName;

      // Remove the column you want to exclude
      delete modifiedOrder.creationDate;
      delete modifiedOrder.customer;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedOrder;
    });

    // Now, export the modified array to PDF
    this.reportingService.exportPdf(this.exportColumns, modifiedOrders, 'orders')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedOrders = this.orders.map(order => {
      // Create a copy of the supplier object to modify
      const modifiedOrder = { ...order };
      if (order.customer)
        modifiedOrder['Customer'] = order.customer.firstName + ' ' + order.customer.lastName;

      // Remove the column you want to exclude
      delete modifiedOrder.creationDate;
      delete modifiedOrder.customer;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedOrder;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedOrders, 'orders');
  }

  onChangeCountry() {
    this.customer.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.customer.country != this.selectedCountry) && (this.customer.city == undefined)) this.customer.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

  }

  showOrderStatus(order) {
    this.order = { ...order };
    this.images = [];
    this.onGetAllOrderReturn(this.order.orderId);
  
    this.order.orderItems.forEach(item => {
      this.images.push(item.product.productImage);
    });
  
    // Initialize originalEvents if not already initialized
    if (!this.originalEvents || this.originalEvents.length === 0) {
      this.originalEvents = [...this.events];
    }
  
    // Find the index of the current status
    const currentStatusIndex = this.originalEvents.findIndex(event => event.status === this.order.orderStatus);
  
    // Filter events up to the current status
    const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);
  
    // Conditional filtering based on order status
    switch (this.order.orderStatus) {
      case 'Canceled':
        this.events = filteredEvents.filter(
          event => !['Delivered', 'Completed', 'Returned', 'Partial_Return'].includes(event.status)
        );
        break;
      case 'Returned':
        this.events = filteredEvents.filter(
          event => !['Partial_Return', 'Canceled', 'Completed'].includes(event.status)
        );
        break;
      case 'Completed':
        if (!this.order.returnDate) {
          this.events = filteredEvents.filter(
            event => !['Partial_Return', 'Returned'].includes(event.status)
          );
        } else {
          this.events = filteredEvents;
        }
        break;
      default:
        this.events = filteredEvents;
        break;
    }
  
    this.syncEventDates(this.events);
  
    this.detailsDialog = true;
  }
  

  async editOrderStatus(id: any, order: any): Promise<boolean> {
    try {
      const response = await this.orderService.updateOrderStatus(id, order).toPromise();
      console.log(response);
  
      await this.onGetAllOrders(); // Wait for updated orders
      this.cdr.detectChanges(); // Manually trigger change detection
  
      return true;
    } catch (error) {
      this.messageService.add({ 
        severity: 'error', 
        summary: 'Error', 
        detail: 'Error while updating the order', 
        life: 3000 
      });
      return false;
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
          product.orderItemPricePerUnit = item.sellingPrice;
          product.orderItemQuantity = 1;
        }
      });
    });
    // Force change detection
    this.cdr.detectChanges();
  }

  //function to move scanned products to target
  moveProductToTarget(product: any): void {
    if (product.quantityAvailable <= 0) {
      console.log('Product quantity is not sufficient to move to target.');
      return;
    }

    const existingProduct = this.targetProducts.find(targetProduct => targetProduct.productId === product.productId);
    if (!existingProduct) {
      const newProduct = { ...product, orderItemPricePerUnit: product.sellingPrice, orderItemQuantity: 1 };
      this.targetProducts.push(newProduct);
      this.sourceProducts = this.sourceProducts.filter(p => p.productId !== product.productId);
      this.orderItems.push(newProduct); // Update orderItems for ngModel binding
      this.cdr.detectChanges(); // Trigger change detection
    } else {
      existingProduct.orderItemQuantity += 1;
      this.cdr.detectChanges();
    }
  }



  async updateOrderStatus() {
    if (this.order.orderStatus != 'Canceled')
      try {
        this.loading = true; // Set loading flag to true

        // Get the current status of the order
        const currentStatus = this.order.orderStatus;

        // Find the sequence for the current status
        const sequence = this.statusSequences[currentStatus];

        // If there are no next statuses in the sequence, exit the method
        if (!sequence || sequence.length === 0) {
          return;
        }

        // Progress to the next status in the sequence (assuming only one next status)
        const nextStatus = sequence[0]; // Assuming only one next status

        // Update the order status
        this.order.orderStatus = nextStatus;

        // Update the existing events with the corresponding date from the order
        await this.editOrderStatus(this.order.orderId, this.order);

        // Find the index of the current status in the original events array
        const currentStatusIndex = this.originalEvents.findIndex(event => event.status === nextStatus);

        // Filter the original events array to include all events up to the current status
        const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);

        // Assign the filtered events to the events array
        this.events = filteredEvents;
        this.cdr.detectChanges(); // Detect changes to update the UI

        this.syncEventDates(this.events);

        // window.location.reload();

      } finally {
        this.loading = false; // Set loading flag to false when the operation is completed
      }
  }


  syncEventDates(events: any[]) {
    events.forEach(event => {
      switch (event.status) {
        case 'Ordered':
          event.date = this.order.orderDate ? new Date(this.order.orderDate) : null;
          break;
        case 'Processing':
          event.date = this.order.processingDate ? new Date(this.order.processingDate) : null;
          break;
        case 'Delivered':
          event.date = this.order.deliveryDate ? new Date(this.order.deliveryDate) : null;
          break;
        case 'Completed':
          event.date = this.order.completeDate ? new Date(this.order.completeDate) : null;
          break;
        case 'Canceled':
          event.date = this.order.cancelDate ? new Date(this.order.cancelDate) : null;
          break;
        case 'Partial_Return':
        case 'Returned':
          event.date = this.order.returnDate ? new Date(this.order.returnDate) : null;
          break;
        default:
          event.date = this.order.orderDate ? new Date(this.order.orderDate) : null;
          break;
      }
    });
  }

  canCancelOrder(order: Order): boolean {
    return order.orderStatus === 'Processing'; // Adjust the condition based on your status criteria
  }

  async cancelOrder(order: Order) {
    try {
      this.order.orderStatus = "Canceled";
      // Update the existing events with the corresponding date from the order
      await this.editOrderStatus(this.order.orderId, this.order);
      // Find the index of the 'Canceled' status in the original events array
      const cancelStatusIndex = this.originalEvents.findIndex(event => event.status === 'Canceled');

      // Filter the original events array to include all events up to the 'Canceled' status
      const filteredEvents = this.originalEvents.slice(0, cancelStatusIndex + 1);

      // Assign the filtered events to the events array
      if (this.order.orderStatus === 'Canceled') {
        this.events = filteredEvents.filter(event => event.status !== 'Delivered' && event.status !== 'Completed');
      } else {
        // Assign the filtered events to the events array
        this.events = filteredEvents;
      }
      this.syncEventDates(this.events);
      this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Order Canceled', life: 3000 });
      this.cdr.detectChanges(); // Detect changes to update the UI

    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while canceling order', life: 3000 });
    }

  }

  onDiscountChange(): void {
    if (this.discountType === 'Percentage') {
      // If percentage, convert it to an amount
      this.order.discount = Math.min(this.order.discount, 100); // Ensure percentage does not exceed 100%
    }
    // Additional logic for handling the discount input can go here
  }

  calculateTotalAmount(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.orderItemQuantity * product.orderItemPricePerUnit;
    }

    // Apply discount
    if (this.discountType === 'Percentage') {
      // Calculate discount as a percentage
      total -= total * (this.order.discount / 100);
    } else {
      // Calculate discount as a fixed amount
      total -= this.order.discount;
    }

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    // Apply tax if enabled
    if (this.taxEnabled) {
      total += this.calculateTax(total); // Pass the discounted total to calculate tax
    }

    // Return the final total
    return total;
  }

  calculateTax(totalWithoutTax: number): number {
    // Calculate tax based on the total amount after discount
    console.log(totalWithoutTax)
    return this.taxEnabled ? totalWithoutTax * this.taxRate : 0;
  }

  getTotalWithoutTax(): number {
    let total = 0;
    for (const product of this.targetProducts) {
      total += product.orderItemQuantity * product.orderItemPricePerUnit;
    }
    return total - this.order.discount;
  }

  calculateTotalAmountWithoutTax(): number {
    let total = 0;

    // Calculate the total based on product quantities and prices
    for (const product of this.targetProducts) {
      total += product.orderItemQuantity * product.orderItemPricePerUnit;
    }

    // Apply discount
    if (this.discountType === 'Percentage') {
      total -= total * (this.order.discount / 100);
    } else {
      total -= this.order.discount;
    }

    // Ensure the total is not below zero after applying the discount
    if (total < 0) {
      total = 0;
    }

    return total;
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

}
