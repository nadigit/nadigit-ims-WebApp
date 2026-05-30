import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, MenuItem } from 'primeng/api';
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
import { FinancialDocument } from 'src/app/models/financialDocument';
import { firstValueFrom, Subscription } from 'rxjs';
import { getPaymentStatusSeverity } from 'src/app/shared/payment-utils';
import { ProcessModeService } from 'src/app/services/process-mode.service';
import { getPreferredProductImageUrl } from 'src/app/shared/product-image.utils';

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
export class OrderDetailsPageComponent implements OnInit, OnDestroy {
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
  proformaInvoiceDocNumber: string | null = null;
  invoiceDocNumber: string | null = null;
  purchaseOrderDocNumber: string | null = null;
  deliveryOrderDocNumber: string | null = null;
  quoteDocNumber: string | null = null;
  
  // Status guide visibility (persisted in localStorage)
  showStatusGuide: boolean = true;

  /** Mirrors admin setting sales.process.mode === DOCUMENT_CHAIN */
  salesDocumentChainMode = false;
  documentChainSteps: MenuItem[] = [];
  documentChainActiveIndex = 0;

  private processFlagsSub?: Subscription;

  // Financial document generation loading flags
  isGeneratingInvoice: boolean = false;
  isGeneratingProformaInvoice: boolean = false;
  isGeneratingPurchaseOrder: boolean = false;
  isGeneratingDeliveryOrder: boolean = false;
  isGeneratingQuote: boolean = false;
  
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
    public financialDocService: FinancialDocumentsService,
    private processModeService: ProcessModeService,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.orderService.loadToken();

    await this.processModeService.ensureLoaded();
    this.salesDocumentChainMode = this.processModeService.isSalesDocumentChain();

    this.processFlagsSub = this.processModeService.processFlagsChanged$.subscribe(() => {
      void this.applySalesProcessFlagsAfterSettingsSave();
    });

    // Load status guide visibility preference from localStorage
    const savedPreference = localStorage.getItem('orderDetails_showStatusGuide');
    this.showStatusGuide = savedPreference !== 'false'; // Default to true if not set
    
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

  ngOnDestroy(): void {
    this.processFlagsSub?.unsubscribe();
  }

  private async applySalesProcessFlagsAfterSettingsSave(): Promise<void> {
    this.salesDocumentChainMode = this.processModeService.isSalesDocumentChain();
    await this.initializeEvents();
    if (this.order) {
      this.buildOrderTimeline();
      this.refreshDocumentChainStepper();
    }
    this.cdr.markForCheck();
  }

  hideStatusGuide() {
    this.showStatusGuide = false;
    localStorage.setItem('orderDetails_showStatusGuide', 'false');
  }

  showStatusGuideAgain() {
    this.showStatusGuide = true;
    localStorage.setItem('orderDetails_showStatusGuide', 'true');
  }

  async initializeEvents() {
    const translations = await firstValueFrom(
      this.translate.getTranslation(this.translateService.getPreferredLanguage())
    );
    const dc = this.salesDocumentChainMode;

    this.events = [
      {
        status: 'Ordered',
        date: null,
        icon: 'pi pi-shopping-cart',
        color: '#9C27B0',
        image: 'game-controller.jpg',
        button: dc ? translations['doc_chain_timeline_btn_to_processing'] : translations['process_order_button'],
        buttonDescription: dc ? translations['doc_chain_timeline_hint_ordered'] : translations['generate_quote'],
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
        button: dc ? translations['doc_chain_timeline_btn_to_delivered'] : translations['deliver_order_button'],
        buttonDescription: dc ? translations['doc_chain_timeline_hint_processing'] : translations['generate_purchase_order']
      },
      {
        status: 'Delivered',
        date: null,
        icon: 'pi pi-truck',
        color: '#2196F3',
        button: dc ? translations['doc_chain_timeline_btn_to_completed'] : translations['complete_order_button'],
        buttonDescription: dc ? translations['doc_chain_timeline_hint_delivered'] : translations['generate_delivery_order']
      },
      {
        status: 'Completed',
        date: null,
        icon: 'pi pi-check-circle',
        color: '#4CAF50',
        buttonDescription: dc ? translations['doc_chain_timeline_hint_completed'] : translations['generate_invoice']
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
      await this.checkForProformaInvoice(this.order.orderId);
      await this.checkForInvoice(this.order.orderId);
      await this.checkForPurchaseOrder(this.order.orderId);
      await this.checkForDeliveryOrder(this.order.orderId);
      await this.checkForQuote(this.order.orderId);
      
      this.images = [];
      if (this.order.orderItems) {
        this.order.orderItems.forEach(item => {
          this.images.push(getPreferredProductImageUrl(item.product));
        });
      }

      this.buildOrderTimeline();
      this.refreshDocumentChainStepper();
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

  private refreshDocumentChainStepper(): void {
    if (!this.salesDocumentChainMode || !this.order) {
      this.documentChainSteps = [];
      this.documentChainActiveIndex = 0;
      return;
    }
    const L = (key: string) => this.translate.instant(key);
    this.documentChainSteps = [
      { label: L('doc_chain_step_sales_ordered') },
      { label: L('doc_chain_step_fulfillment') },
      { label: L('doc_chain_step_shipment') },
      { label: L('doc_chain_step_closure') },
    ];
    switch (this.order.orderStatus) {
      case 'Ordered':
        this.documentChainActiveIndex = 0;
        break;
      case 'Processing':
        this.documentChainActiveIndex = 1;
        break;
      case 'Delivered':
        this.documentChainActiveIndex = 2;
        break;
      case 'Completed':
        this.documentChainActiveIndex = 3;
        break;
      default:
        this.documentChainActiveIndex = 0;
        break;
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

  /** i18n key for hero order-status tag (document-chain wording when enabled). */
  getHeroOrderStatusKey(): string {
    if (!this.order?.orderStatus) return '';
    const s = this.order.orderStatus.toLowerCase();
    return (this.salesDocumentChainMode ? 'doc_chain_order_status_' : 'order_status_') + s;
  }

  /** i18n key for hero payment-status tag (document-chain wording when enabled). */
  getHeroPaymentStatusKey(): string {
    if (!this.order?.paymentStatus) return '';
    const s = this.order.paymentStatus.toLowerCase();
    return (this.salesDocumentChainMode ? 'doc_chain_order_payment_status_' : 'order_payment_status_') + s;
  }

  showEventButton(event: any): boolean {
    if (!this.order) return false;
    const statusMatches = event.status === this.order.orderStatus;
    const hasButton = !!event.button;

    if (!hasButton || !statusMatches) return false;
    return true;
  }

  isEventActive(event: any): boolean {
    return event.status === this.order?.orderStatus;
  }

  getStatusDescription(status: string): string {
    const norm = status?.toUpperCase().replace(/-/g, '_');
    if (this.salesDocumentChainMode) {
      const paid = this.order?.paymentStatus === 'PAID';
      const dc: { [key: string]: string } = {
        'ORDERED': this.translate.instant('doc_chain_status_ordered'),
        'PROCESSING': this.translate.instant('doc_chain_status_processing'),
        'DELIVERED': paid
          ? this.translate.instant('doc_chain_status_delivered_paid')
          : this.translate.instant('doc_chain_status_delivered_unpaid'),
        'COMPLETED': this.translate.instant('doc_chain_status_completed'),
        'CANCELED': this.translate.instant('order_canceled_text'),
        'PARTIAL_RETURN': this.translate.instant('order_partial_return_text'),
        'RETURNED': this.translate.instant('order_return_text'),
        'RETURN_PENDING': this.translate.instant('order_under_processing'),
      };
      return dc[norm] || '';
    }
    const descriptions: { [key: string]: string } = {
      'PROCESSING': this.translate.instant('order_under_processing'),
      'DELIVERED': this.translate.instant('order_delivered_tocomplete_text'),
      'COMPLETED': this.translate.instant('order_completed_text'),
      'CANCELED': this.translate.instant('order_canceled_text'),
      'PARTIAL_RETURN': this.translate.instant('order_partial_return_text'),
      'RETURNED': this.translate.instant('order_return_text')
    };
    return descriptions[norm] || '';
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

  // Navigate back to orders list and open the order in edit mode
  editOrder(): void {
    if (!this.order || !this.order.orderId) {
      return;
    }
    this.router.navigate(['/sales/orders'], {
      queryParams: { editOrderId: this.order.orderId }
    });
  }

  getOrderSubtotal(): number {
    if (!this.order?.orderItems) return 0;
    return this.order.orderItems.reduce((total, item) =>
      total + (item.lineNetAmount ?? ((item.quantity || 0) * (item.pricePerUnit || 0))), 0);
  }

  calculateOrderDiscount(): number {
    if (!this.order) return 0;
    const netSubtotal = this.getOrderSubtotal();
    const taxAmount = this.order.taxAmount || 0;
    const transportAmount = this.order.transportAmount || 0;
    return Math.max(0, netSubtotal + taxAmount + transportAmount - (this.order.totalAmount || 0));
  }

  calculateOrderTax(): number {
    return this.order?.taxAmount || 0;
  }

  getOrderLineTaxTotal(): number {
    if (!this.order?.orderItems) return 0;
    return this.order.orderItems.reduce((total, item) => total + (item.lineTaxAmount || 0), 0);
  }

  getOrderLineGrossTotal(): number {
    if (!this.order?.orderItems) return 0;
    return this.order.orderItems.reduce(
      (total, item) => total + (item.lineGrossAmount ?? (item.lineNetAmount ?? ((item.quantity || 0) * (item.pricePerUnit || 0))) + (item.lineTaxAmount || 0)),
      0
    );
  }

  formatTaxRate(rate?: number | null): string {
    if (rate == null) return '—';
    return `${(rate * 100).toFixed(2)}%`;
  }

  // Cost and Profit helper methods
  getProfitMarginSeverity(margin: number | null | undefined): string {
    if (margin == null) return 'secondary';
    if (margin >= 30) return 'success'; // High margin - Green
    if (margin >= 15) return 'warning'; // Medium margin - Yellow/Orange
    return 'danger'; // Low margin - Red
  }

  getProfitMarginClass(margin: number | null | undefined): string {
    if (margin == null) return '';
    if (margin >= 30) return 'high-margin';
    if (margin >= 15) return 'medium-margin';
    return 'low-margin';
  }

  hasCostInfo(): boolean {
    return this.order?.totalCost != null && this.order?.totalCost !== undefined;
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
    if (!order?.orderId) { return; }
    this.isGeneratingInvoice = true;
    this.financialDocService.generateInvoiceFromOrder(order.orderId).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('invoice_generated_successfully'),
          life: 3000
        });
        // Reload order to get updated document status
        this.loadOrder();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_generating_invoice'),
          life: 3000
        });
      },
      complete: () => {
        this.isGeneratingInvoice = false;
      }
    });
  }

  async checkForProformaInvoice(orderId: number): Promise<void> {
    try {
      this.financialDocService.loadToken();
      const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
      const financialDocs = this.extractFinancialDocs(response);
      const proformaInvoice = financialDocs.find(
        (doc: FinancialDocument) => 
          doc.docType === 'PROFORMA_INVOICE' && 
          doc.order?.orderId === orderId
      );
      
      this.proformaInvoiceDocNumber = proformaInvoice?.docNumber || null;
    } catch (error: any) {
      console.error('Error checking for proforma invoice:', error);
      // Don't show error to user, just log it
      this.proformaInvoiceDocNumber = null;
    }
  }

  async checkForInvoice(orderId: number): Promise<void> {
    try {
      this.financialDocService.loadToken();
      const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
      const financialDocs = this.extractFinancialDocs(response);
      const invoice = financialDocs.find(
        (doc: FinancialDocument) => 
          doc.docType === 'INVOICE' && 
          doc.order?.orderId === orderId
      );
      
      this.invoiceDocNumber = invoice?.docNumber || null;
    } catch (error: any) {
      console.error('Error checking for invoice:', error);
      // Don't show error to user, just log it
      this.invoiceDocNumber = null;
    }
  }

  generateProformaInvoice(order: Order) {
    if (!order?.orderId) { return; }
    this.isGeneratingProformaInvoice = true;
    this.financialDocService.generateProformaInvoiceFromOrder(order.orderId, {
      origin: 'BACK_OFFICE'
    }).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('proforma_invoice_generated_successfully') || 'Proforma invoice generated successfully',
          life: 3000
        });
        // Reload order to get updated document status
        this.loadOrder();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_generating_proforma_invoice') || 'Error while generating proforma invoice',
          life: 3000
        });
      },
      complete: () => {
        this.isGeneratingProformaInvoice = false;
      }
    });
  }

  viewProformaInvoice() {
    if (this.proformaInvoiceDocNumber) {
      this.financialDocService.printFinancialDoc(this.proformaInvoiceDocNumber);
    }
  }

  viewInvoice() {
    if (this.invoiceDocNumber) {
      this.financialDocService.printFinancialDoc(this.invoiceDocNumber);
    }
  }

  async checkForPurchaseOrder(orderId: number): Promise<void> {
    try {
      this.financialDocService.loadToken();
      const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
      const financialDocs = this.extractFinancialDocs(response);
      const purchaseOrder = financialDocs.find(
        (doc: FinancialDocument) => 
          doc.docType === 'PURCHASE_ORDER' && 
          doc.order?.orderId === orderId
      );
      
      this.purchaseOrderDocNumber = purchaseOrder?.docNumber || null;
    } catch (error: any) {
      console.error('Error checking for purchase order:', error);
      this.purchaseOrderDocNumber = null;
    }
  }

  async checkForDeliveryOrder(orderId: number): Promise<void> {
    try {
      this.financialDocService.loadToken();
      const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
      const financialDocs = this.extractFinancialDocs(response);
      const deliveryOrder = financialDocs.find(
        (doc: FinancialDocument) => 
          doc.docType === 'DELIVERY_NOTE' && 
          doc.order?.orderId === orderId
      );
      
      this.deliveryOrderDocNumber = deliveryOrder?.docNumber || null;
    } catch (error: any) {
      console.error('Error checking for delivery order:', error);
      this.deliveryOrderDocNumber = null;
    }
  }

  generatePurchaseOrder(order: Order) {
    if (!order?.orderId) { return; }
    this.isGeneratingPurchaseOrder = true;
    this.financialDocService.generatePurchaseOrderFromOrder(order.orderId).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('purchase_order_generated') || 'Purchase order generated successfully',
          life: 3000
        });
        // Reload order to get updated document status
        this.loadOrder();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_generating_purchase_order') || 'Error generating purchase order',
          life: 3000
        });
      },
      complete: () => {
        this.isGeneratingPurchaseOrder = false;
      }
    });
  }

  generateDeliveryOrder(order: Order) {
    if (!order?.orderId) { return; }
    this.isGeneratingDeliveryOrder = true;
    this.financialDocService.generateDeliveryOrderFromOrder(order.orderId).subscribe({
      next: async (response: any) => {
        // Try to extract the generated delivery note document number directly from the response
        const docNumber =
          response?.docNumber ||
          response?.document?.docNumber ||
          response?.financialDocument?.docNumber ||
          response?.data?.docNumber;

        if (docNumber) {
          this.deliveryOrderDocNumber = docNumber;
        } else if (this.order?.orderId) {
          // Fallback: re-check from backend if response shape is unknown
          await this.checkForDeliveryOrder(this.order.orderId);
        }

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('delivery_order_generated') || 'Delivery order generated successfully',
          life: 3000
        });

        // Reload order to refresh timeline and other document flags
        this.loadOrder();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_generating_delivery_order') || 'Error generating delivery order',
          life: 3000
        });
      },
      complete: () => {
        this.isGeneratingDeliveryOrder = false;
      }
    });
  }

  viewPurchaseOrder() {
    if (this.purchaseOrderDocNumber) {
      this.financialDocService.printFinancialDoc(this.purchaseOrderDocNumber);
    }
  }

  viewDeliveryOrder() {
    if (this.deliveryOrderDocNumber) {
      this.financialDocService.printFinancialDoc(this.deliveryOrderDocNumber);
    }
  }

  async checkForQuote(orderId: number): Promise<void> {
    try {
      this.financialDocService.loadToken();
      const response = await firstValueFrom(this.financialDocService.getFinancialDocs());
      const financialDocs = this.extractFinancialDocs(response);
      const quote = financialDocs.find(
        (doc: FinancialDocument) => 
          doc.docType === 'QUOTE' && 
          doc.order?.orderId === orderId
      );
      
      this.quoteDocNumber = quote?.docNumber || null;
    } catch (error: any) {
      console.error('Error checking for quote:', error);
      this.quoteDocNumber = null;
    }
  }

  generateQuote(order: Order) {
    if (!order?.orderId) { return; }
    this.isGeneratingQuote = true;
    this.financialDocService.generateQuoteFromOrder(order.orderId).subscribe({
      next: (response: any) => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('quote_generated_successfully') || 'Quote generated successfully',
          life: 3000
        });
        // Reload order to get updated document status
        this.loadOrder();
      },
      error: (error: any) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_generating_quote') || 'Error while generating quote',
          life: 3000
        });
      },
      complete: () => {
        this.isGeneratingQuote = false;
      }
    });
  }

  viewQuote() {
    if (this.quoteDocNumber) {
      this.financialDocService.printFinancialDoc(this.quoteDocNumber);
    }
  }

  /**
   * Normalize various possible financial documents API response shapes
   * into a simple FinancialDocument[] for local lookups.
   */
  private extractFinancialDocs(response: any): FinancialDocument[] {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response as FinancialDocument[];
    }

    if (Array.isArray(response.page?.content)) {
      return response.page.content as FinancialDocument[];
    }

    if (Array.isArray(response.content)) {
      return response.content as FinancialDocument[];
    }

    return [];
  }

  // Helper methods to check document eligibility based on order status
  isQuoteEligible(): boolean {
    if (!this.order) return false;
    const status = this.order.orderStatus;
    return status === 'Ordered' || status === 'Processing' || status === 'Delivered' || status === 'Completed';
  }

  isPurchaseOrderEligible(): boolean {
    if (!this.order) return false;
    const status = this.order.orderStatus;
    return status === 'Ordered' || status === 'Processing' || status === 'Delivered' || status === 'Completed';
  }

  isDeliveryNoteEligible(): boolean {
    if (!this.order) return false;
    const status = this.order.orderStatus;
    return status === 'Processing' || status === 'Delivered' || status === 'Completed';
  }

  isInvoiceEligible(): boolean {
    if (!this.order) return false;
    const status = this.order.orderStatus;
    // Invoice eligible: Processing, Delivered, Completed (not Ordered, Canceled, Return_Pending, Returned)
    return status !== 'Ordered' && status !== 'Canceled' && status !== 'Return_Pending' && status !== 'Returned';
  }

  async processOrder() {
    if (!this.order || this.order.orderStatus !== 'Ordered') return;
    
    try {
      this.order.orderStatus = 'Processing';
      this.order.processingDate = new Date();
      await firstValueFrom(this.orderService.updateOrderStatus(this.order.orderId, this.order));
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_under_processing'),
        life: 3000
      });
      
      // Reload order to refresh the UI
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

  async deliverOrder() {
    if (!this.order || this.order.orderStatus !== 'Processing') return;
    
    try {
      this.order.orderStatus = 'Delivered';
      this.order.deliveryDate = new Date();
      await firstValueFrom(this.orderService.updateOrderStatus(this.order.orderId, this.order));
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_delivered'),
        life: 3000
      });
      
      // Reload order to refresh the UI
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

  async completeOrder() {
    if (!this.order || this.order.orderStatus !== 'Delivered') return;
    
    try {
      this.order.orderStatus = 'Completed';
      this.order.completeDate = new Date();
      await firstValueFrom(this.orderService.updateOrderStatus(this.order.orderId, this.order));
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('order_completed_text'),
        life: 3000
      });
      
      // Reload order to refresh the UI
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

  viewProductDetails(product: Product) {
    if (!product) return;
    this.router.navigate(['/inventory/products', product.productId]);
  }
}

