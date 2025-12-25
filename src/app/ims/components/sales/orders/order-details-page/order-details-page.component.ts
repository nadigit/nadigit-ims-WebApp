import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Order } from 'src/app/models/order';
import { OrderService } from 'src/app/services/order.service';
import { PaymentService } from 'src/app/services/payment.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { Product } from 'src/app/models/product';
import { OrderReturn } from 'src/app/models/orderReturn';
import { Payment } from 'src/app/models/payment';
import { firstValueFrom } from 'rxjs';
import { getPaymentStatusSeverity } from 'src/app/shared/payment-utils';

interface EventItem {
  status?: string;
  date?: Date | string | null;
  icon?: string;
  color?: string;
  image?: string;
  button?: string;
  buttonDescription?: string;
}

@Component({
  selector: 'app-order-details-page',
  templateUrl: './order-details-page.component.html',
  styleUrls: ['./order-details-page.component.css', '../orders.component.css']
})
export class OrderDetailsPageComponent implements OnInit {
  orderId!: number;
  order: Order | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canProcess: boolean = false;
  canCancel: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "ORDERS";

  events: EventItem[] = [];
  originalEvents: EventItem[] = [];
  orderReturns: OrderReturn[] = [];
  orderPayments: Payment[] = [];
  images: any[] = [];
  
  taxRate: number = 0.0;
  
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private orderService: OrderService,
    private paymentService: PaymentService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    public financialDocService: FinancialDocumentsService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.orderService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.orderId = +params['id'];
      if (!this.orderId || isNaN(this.orderId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_order_id'),
          life: 3000
        });
        this.router.navigate(['/sales/orders']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.initializeEvents();
      await this.loadOrder();
    });
  }

  async initializeEvents() {
    const translations = await firstValueFrom(
      this.translate.getTranslation(this.translateService.getPreferredLanguage())
    );
    
    this.events = [
      {
        status: 'Ordered',
        date: null,
        icon: 'pi pi-shopping-cart',
        color: '#9C27B0',
        image: 'game-controller.jpg',
        button: translations['process_order_button'],
        buttonDescription: translations['generate_quote'],
      },
      {
        status: 'Canceled',
        date: null,
        icon: 'pi pi-times-circle',
        color: '#FF5722'
      },
      {
        status: 'Processing',
        date: null,
        icon: 'pi pi-cog',
        color: '#673AB7',
        button: translations['deliver_order_button'],
        buttonDescription: translations['generate_purchase_order']
      },
      {
        status: 'Delivered',
        date: null,
        icon: 'pi pi-truck',
        color: '#2196F3',
        button: translations['complete_order_button'],
        buttonDescription: translations['generate_delivery_order']
      },
      {
        status: 'Completed',
        date: null,
        icon: 'pi pi-check-circle',
        color: '#4CAF50',
        buttonDescription: translations['generate_invoice']
      },
      {
        status: 'Return_Pending',
        date: null,
        icon: 'pi pi-clock',
        color: '#FFC107',
      },
      {
        status: 'Partial_Return',
        date: null,
        icon: 'pi pi-undo',
        color: '#FF9800',
        buttonDescription: translations['generate_return_order']
      },
      {
        status: 'Returned',
        date: null,
        icon: 'pi pi-undo',
        color: '#607D8B',
        buttonDescription: translations['generate_return_order']
      },
    ];
    
    this.originalEvents = [...this.events];
  }

  async loadOrder(): Promise<void> {
    try {
      // Ensure token is loaded
      this.orderService.loadToken();
      
      const response = await firstValueFrom(this.orderService.getOrder(this.orderId));
      console.log('Order API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.order = response[0] as Order;
      } else if (response && typeof response === 'object') {
        this.order = response as Order;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.order || !this.order.orderId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('order_not_found'),
          life: 3000
        });
        this.router.navigate(['/sales/orders']);
        return;
      }

      await this.onGetOrderPayments(this.order.orderId);
      await this.onGetAllOrderReturn(this.order.orderId);
      
      this.images = [];
      if (this.order.orderItems) {
        this.order.orderItems.forEach(item => {
          this.images.push(item.product?.productImage ?? 'assets/core-images/no-image.png');
        });
      }

      this.buildOrderTimeline();
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading order:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_order') || 'Error loading order',
        life: 3000
      });
      this.isLoading = false;
    }
  }

  buildOrderTimeline(): void {
    if (!this.order) return;

    // Find the index of the current status
    const currentStatusIndex = this.originalEvents.findIndex(event => event.status === this.order?.orderStatus);

    // Filter events up to the current status
    const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);

    // Conditional filtering based on order status
    switch (this.order.orderStatus) {
      case 'Return_Pending':
      case 'Processing':
        this.events = filteredEvents.filter(
          event => !['Canceled'].includes(event.status || '')
        );
        break;
      case 'Canceled':
        this.events = filteredEvents.filter(
          event => !['Processing', 'Delivered', 'Completed', 'Return_Pending', 'Returned', 'Partial_Return'].includes(event.status || '')
        );
        break;
      case 'Delivered':
        this.events = filteredEvents.filter(
          event => !['Canceled'].includes(event.status || '')
        );
        break;
      case 'Completed':
        this.events = filteredEvents.filter(
          event => !['Partial_Return', 'Returned', 'Return_Pending', 'Canceled'].includes(event.status || '')
        );
        break;
      case 'Returned':
        this.events = filteredEvents.filter(
          event => !['Partial_Return', 'Canceled'].includes(event.status || '')
        );
        break;
      case 'Partial_Return':
        this.events = filteredEvents.filter(
          event => !['Returned', 'Canceled'].includes(event.status || '')
        );
        break;
      default:
        this.events = filteredEvents;
        break;
    }

    this.syncEventDates(this.events);
  }

  syncEventDates(events: EventItem[]): void {
    if (!this.order) return;
    
    events.forEach(event => {
      switch (event.status) {
        case 'Ordered':
          event.date = this.order?.orderDate ? new Date(this.order.orderDate) : null;
          break;
        case 'Processing':
          event.date = this.order?.processingDate ? new Date(this.order.processingDate) : null;
          break;
        case 'Delivered':
          event.date = this.order?.deliveryDate ? new Date(this.order.deliveryDate) : null;
          break;
        case 'Completed':
          event.date = this.order?.completeDate ? new Date(this.order.completeDate) : null;
          break;
        case 'Canceled':
          event.date = this.order?.cancelDate ? new Date(this.order.cancelDate) : null;
          break;
        case 'Return_Pending':
          event.date = this.order?.returnPendingDate ? new Date(this.order.returnPendingDate) : null;
          break;
        case 'Partial_Return':
        case 'Returned':
          event.date = this.order?.returnDate ? new Date(this.order.returnDate) : null;
          break;
        default:
          event.date = this.order?.orderDate ? new Date(this.order.orderDate) : null;
          break;
      }
    });
  }

  async onGetAllOrderReturn(orderId: number) {
    try {
      const response = await firstValueFrom(this.orderService.getOrdersReturns(orderId));
      this.orderReturns = (response as OrderReturn[]) || [];
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_order_return_items'),
        life: 3000
      });
    }
  }

  async onGetOrderPayments(orderId: number) {
    try {
      const response = await firstValueFrom(this.paymentService.getPaymentsByOrderId(orderId));
      this.orderPayments = (response as Payment[]) || [];
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_order_payments'),
        life: 3000
      });
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canProcess = this.permissionService.canProcess(this.Ressource);
    this.canCancel = this.permissionService.canCancel(this.Ressource);
  }

  async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  goBack(): void {
    this.location.back();
  }

  showEventButton(event: any): boolean {
    if (!this.order) return false;
    const statusMatches = event.status === this.order.orderStatus;
    const hasButton = !!event.button;
    const isDelivered = event.status === 'Delivered';
    const isPaid = this.order.paymentStatus === 'PAID';

    if (!hasButton || !statusMatches) return false;
    if (isDelivered && !isPaid) return false;
    return true;
  }

  isEventActive(event: any): boolean {
    return event.status === this.order?.orderStatus;
  }

  getStatusDescription(status: string): string {
    const descriptions: { [key: string]: string } = {
      'PROCESSING': this.translate.instant('order_under_processing'),
      'DELIVERED': this.order?.paymentStatus === 'PAID'
        ? this.translate.instant('order_delivered_tocomplete_text')
        : this.translate.instant('order_payment_required_text'),
      'COMPLETED': this.translate.instant('order_completed_text'),
      'CANCELED': this.translate.instant('order_canceled_text'),
      'PARTIAL_RETURN': this.translate.instant('order_partial_return_text'),
      'RETURNED': this.translate.instant('order_return_text')
    };
    return descriptions[status] || '';
  }

  getActionButtonIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ORDERED': return 'pi pi-cog';
      case 'PROCESSING': return 'pi pi-truck';
      case 'DELIVERED': return 'pi pi-check';
      case 'RETURN_PENDING': return 'pi pi-check';
      default: return 'pi pi-arrow-right';
    }
  }

  getActionButtonSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ORDERED': return 'warning';
      case 'PROCESSING': return 'info';
      case 'DELIVERED': return 'success';
      case 'RETURN_PENDING': return 'help';
      default: return 'primary';
    }
  }

  getPaymentStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'PAID': return 'pi pi-check';
      case 'PENDING': return 'pi pi-clock';
      case 'FAILED': return 'pi pi-times';
      case 'PARTIAL': return 'pi pi-exclamation-circle';
      default: return 'pi pi-credit-card';
    }
  }

  getPaymentStatusSeverity(status: string): string {
    return getPaymentStatusSeverity(status);
  }

  getOrderStatusSeverity(status: string): "success" | "secondary" | "info" | "warn" | "danger" | "contrast" | undefined {
    switch (status?.toLowerCase()) {
      case 'ordered': return 'warn';
      case 'processing': return 'info';
      case 'delivered': return 'info';
      case 'completed': return 'success';
      case 'canceled': return 'danger';
      case 'return_pending': return 'warn';
      case 'partial_return': return 'warn';
      case 'returned': return 'secondary';
      default: return 'secondary';
    }
  }

  getOrderSubtotal(): number {
    if (!this.order?.orderItems) return 0;
    return this.order.orderItems.reduce((total, item) =>
      total + (item.quantity * item.pricePerUnit), 0);
  }

  calculateOrderDiscount(): number {
    if (!this.order?.discount) return 0;
    if (this.order.discountType === 'Percentage') {
      return (this.getOrderSubtotal() * this.order.discount) / 100;
    }
    return this.order.discount;
  }

  calculateOrderTax(): number {
    if (!this.order?.taxEnabled) return 0;
    const subtotal = this.getOrderSubtotal();
    const discountAmount = this.calculateOrderDiscount();
    const taxableAmount = subtotal - discountAmount;
    return taxableAmount * this.taxRate;
  }

  allowCancelOrder(): boolean {
    return this.order?.orderStatus === 'Ordered';
  }

  async cancelOrder() {
    if (!this.order) return;
    
    try {
      this.order.orderStatus = "Canceled";
      await firstValueFrom(this.orderService.updateOrderStatus(this.order.orderId, this.order));
      
      // Find the index of the 'Canceled' status in the original events array
      const cancelStatusIndex = this.originalEvents.findIndex(event => event.status === 'Canceled');

      // Filter the original events array to include all events up to the 'Canceled' status
      const filteredEvents = this.originalEvents.slice(0, cancelStatusIndex + 1);

      // Assign the filtered events to the events array
      if (this.order.orderStatus === 'Canceled') {
        this.events = filteredEvents.filter(event => 
          event.status !== 'Delivered' && 
          event.status !== 'Completed' && 
          event.status !== 'Returned' && 
          event.status !== 'Partial_Return' && 
          event.status !== 'Processing' && 
          event.status !== 'Return_Pending'
        );
      } else {
        this.events = filteredEvents;
      }
      
      this.syncEventDates(this.events);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_canceled'),
        life: 3000
      });
      
      // Reload order to get updated data
      await this.loadOrder();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_canceling_order'),
        life: 3000
      });
    }
  }

  async updateOrderStatus() {
    if (!this.order || this.order.orderStatus === 'Canceled') return;
    
    try {
      const currentStatus = this.order.orderStatus;
      let nextStatus = '';
      
      switch (currentStatus) {
        case 'Ordered':
          nextStatus = 'Processing';
          break;
        case 'Processing':
          nextStatus = 'Delivered';
          break;
        case 'Delivered':
          nextStatus = 'Completed';
          break;
        default:
          return;
      }
      
      this.order.orderStatus = nextStatus as any;
      await firstValueFrom(this.orderService.updateOrderStatus(this.order.orderId, this.order));
      
      // Find the index of the next status in the original events array
      const currentStatusIndex = this.originalEvents.findIndex(event => event.status === nextStatus);

      // Filter the original events array to include all events up to the next status
      const filteredEvents = this.originalEvents.slice(0, currentStatusIndex + 1);

      // Assign the filtered events to the events array
      this.events = filteredEvents;
      this.syncEventDates(this.events);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_status_updated'),
        life: 3000
      });
      
      // Reload order to get updated data
      await this.loadOrder();
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_order'),
        life: 3000
      });
    }
  }

  generateInvoice(order: Order) {
    this.financialDocService.generateInvoiceFromOrder(order.orderId).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('invoice_generated_successfully'),
          life: 3000
        });
        // Reload order to get updated invoice status
        this.loadOrder();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_generating_invoice'),
          life: 3000
        });
      }
    });
  }

  viewProductDetails(product: Product) {
    if (!product) return;
    this.router.navigate(['/inventory/products', product.productId]);
  }
}

