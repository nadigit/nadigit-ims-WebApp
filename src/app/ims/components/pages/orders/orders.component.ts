import { ChangeDetectorRef, Component, ElementRef, OnChanges, OnInit, Pipe, PipeTransform, SimpleChanges, ViewChild } from '@angular/core';
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

interface EventItem {
  status?: string;
  date?: string;
  icon?: string;
  color?: string;
  image?: string;
  button?: string;
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
  styleUrls: ['./orders.component.css'],
  providers: [MessageService]
})
export class OrdersComponent implements OnInit, OnChanges {

  events: EventItem[];

  orderDialog: boolean = false;

  detailsDialog: boolean = false;

  customerDialog: boolean = false;

  deleteOrderDialog: boolean = false;

  deleteOrdersDialog: boolean = false;

  products: Product[] = [];

  customers: Customer[] = [];

  customer: Customer = {};

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

  expandedRows: { [key: string]: boolean } = {}; // Keep track of expanded rows

  orderItems: OrderItem[] = [];

  exportColumns!: ExportColumn[];

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  originalEvents: any[];

  statusDate: any;


  statusSequences: { [key: string]: string[] } = {
    'Ordered': ['Processing'],
    'Processing': ['Delivered'],
    'Delivered': [],
    // 'Cancelled': [],    
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


  @ViewChild('filter') filter!: ElementRef;

  constructor(private messageService: MessageService,
    private orderService: OrderService,
    private productService: ProductService,
    private customerService: CustomerService,
    private cdr: ChangeDetectorRef,
    private invoiceService: InvoiceService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
  ) {
    // this.events = [
    //   { status: 'Ordered', date: 'test', icon: 'pi pi-print', color: '#9C27B0', image: 'game-controller.jpg', button: 'process_order_button' },
    //   { status: 'Processing', date: 'test', icon: 'pi pi-print', color: '#673AB7', button: 'deliver_order_button' },
    //   { status: 'Delivered', date: 'test', icon: 'pi pi-print', color: '#607D8B' },
    //   { status: 'Canceled', date: 'test', icon: 'pi pi-times-circle', color: '#FF9800' },
    // ];

  }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.events = [
        { status: 'Ordered', date: 'test', icon: 'pi pi-print', color: '#9C27B0', image: 'game-controller.jpg', button: translations['process_order_button'] },
        { status: 'Processing', date: 'test', icon: 'pi pi-print', color: '#673AB7', button: translations['deliver_order_button'] },
        { status: 'Delivered', date: 'test', icon: 'pi pi-print', color: '#607D8B' },
        { status: 'Canceled', date: 'test', icon: 'pi pi-times-circle', color: '#FF9800' },
      ];
    });
    this.onGetAllProducts();
    this.onGetAllCustomers();
    this.onGetAllOrders();
    this.getSourceProducts();
    this.getTargetProducts();
    this.initializePickList();

    this.cols = [
      { field: 'orderId', header: 'ID' },
      { field: 'orderStatus', header: 'Status' },
      { field: 'orderDate', header: 'Ordered On' },
      { field: 'deliveryDate', header: 'Delivered ON' },
      { field: 'totalAmount', header: 'Total Amount' },
      { field: 'customer', header: 'Customer' },
    ];


    this.statuses = [
      { label: 'Ordered', value: 'Ordered' },
      { label: 'Delivered', value: 'Delivered' },
      { label: 'Canceled', value: 'Canceled' },
      { label: 'Completed', value: 'Completed' },
      { label: 'Returned', value: 'Returned' },
      { label: 'Processing', value: 'Processing' },
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));


  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('order' in changes) {
      this.initializePickList();
    }
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
        !this.order.orderItems.some(targetProduct => targetProduct.product.productId === product.productId)
      );
    } else {
      return this.products;
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
    this.customer = {};
    this.customerDialog = true;
  }

  deleteSelectedOrders() {
    this.deleteOrdersDialog = true;
  }

  editOrder(order: Order) {
    this.order = { ...order };
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

  deleteOrder(order: Order) {
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

  hideDetailsDialog() {
    this.detailsDialog = false;
  }

  openNew() {
    this.order = {};
    this.order.paymentMethod = "Cash";
    this.targetProducts = [];
    this.orderItems = [];
    this.submitted = false;
    this.orderDialog = true;
    this.onGetAllProducts();
    this.initializePickList();

  }

  async saveOrder() {
    this.submitted = true;

    // Map the target products to order items with the required structure
    const orderItems: OrderItem[] = this.targetProducts.map(product => ({
      product,
      quantity: product['orderItemQuantity'],
      pricePerUnit: product['orderItemPricePerUnit']
    }));

    // Create a new order object to avoid modifying the existing one directly
    const newOrder: Order = { ...this.order };

    // Assign the new order items to the new order
    newOrder.orderItems = orderItems;

    // Remove 'quantity' and 'subTotal' properties from each product in orderItems
    newOrder.orderItems.forEach(orderItem => {
      delete orderItem.product['orderItemQuantity'];
      delete orderItem.product['orderItemPricePerUnit'];
    });

    console.log(newOrder);

    try {
      if (newOrder.orderId) {
        await this.updateOrder(newOrder.orderId, newOrder);
        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Order Updated', life: 3000 });
      } else {

        await this.addOrder(newOrder);
        this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Order Added', life: 3000 });
      }
    } catch (error) {
      console.error(error);
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error occurred', life: 3000 });
    }

    this.orders = [...this.orders];
    this.orderDialog = false;
    this.order = {};
  }

  saveCustomer() {

    this.addCustomer(this.customer) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Added', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding customer', life: 3000 }))

    this.customers = [...this.customers];
    this.customerDialog = false;
    this.customer = {};
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
          console.log(this.customers);
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting customers', life: 3000 })
        }
      })
  }

  async onGetAllOrders() {
    try {
      const response = await this.orderService.getOrders().toPromise();
      this.orders = response as Order[];
      this.orders.forEach((productOrder: any) => (
        productOrder.deliveryDate = new Date(<Date>productOrder.deliveryDate),
        productOrder.expiryDate = new Date(<Date>productOrder.expiryDate),
        productOrder.orderDate = new Date(<Date>productOrder.orderDate),
        productOrder.completeDate = new Date(<Date>productOrder.completeDate),
        productOrder.cancelDate = new Date(<Date>productOrder.cancelDate),
        productOrder.returnDate = new Date(<Date>productOrder.returnDate),
        productOrder.processingDate = new Date(<Date>productOrder.processingDate)
      ));
      console.log(this.orders);
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
    console.log("invoiiiiiiice")
    console.log("statstatus: " + status)
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

    this.order.orderItems.forEach(item => {
      this.images.push(item.product.productImage);
    });

    // If originalEvents is not initialized or if it's empty, copy events array
    if (!this.originalEvents || this.originalEvents.length === 0) {
      this.originalEvents = [...this.events];
    }

    // Find the index of the current status
    const currentStatusIndex = this.originalEvents.findIndex(event => event.status === this.order.orderStatus);

    // Filter the original events array to include all events up to the current status
    const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);

    // If the order status is 'Canceled', filter out the 'Delivered' event
    if (this.order.orderStatus === 'Canceled') {
      this.events = filteredEvents.filter(event => event.status !== 'Delivered');
    } else {
      // Assign the filtered events to the events array
      this.events = filteredEvents;
    }

    this.syncEventDates(this.events);

    this.detailsDialog = true;
  }

  async editOrderStatus(id: any, order: any): Promise<boolean> {
    try {
      const response = await this.orderService.updateOrderStatus(id, order).toPromise();
      console.log(response);
      await this.onGetAllOrders(); // Wait for the orders to be updated
      this.cdr.detectChanges(); // Detect changes to update the UI
      return true;
    } catch (error) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating the order', life: 3000 });
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


  syncEventDates(events) {
    events.forEach(event => {
      switch (event.status) {
        case 'Ordered':
          event.date = this.order.orderDate.toString();
          break;
        case 'Processing':
          event.date = this.order.processingDate.toString();
          break;
        case 'Delivered':
          event.date = this.order.deliveryDate.toString();
          break;
        case 'Canceled':
          event.date = this.order.cancelDate.toString();
          break;
        // case 'Returned':
        //   event.date = this.order.returnDate.toString();
        //   break;
        // case 'Completed':
        //   event.date = this.order.processingDate.toString();
        //   break;
        // Add cases for other statuses if needed
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
        this.events = filteredEvents.filter(event => event.status !== 'Delivered');
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


  calculateTotalAmount(): number {
    let total = 0;
    for (const product of this.targetProducts) {
      total += product.orderItemQuantity * product.orderItemPricePerUnit;
    }
    return total;
  }


}
