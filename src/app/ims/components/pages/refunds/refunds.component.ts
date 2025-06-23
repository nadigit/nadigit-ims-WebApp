import { Component, EventEmitter, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { CustomerService } from 'src/app/services/customer.service';
import { Customer } from 'src/app/models/customer';
import { Order } from 'src/app/models/order';
import { OrderService } from 'src/app/services/order.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { Refund } from 'src/app/models/refund';
import { RefundService } from 'src/app/services/refund.service';
import { RefundMethod } from 'src/app/enums/refund-method.enum';
import { RefundStatus } from 'src/app/enums/refund-status.enum';
import { ReturnService } from 'src/app/services/return.service';
import { OrderReturn } from 'src/app/models/orderReturn';

@Component({
  templateUrl: './refunds.component.html',
  styleUrls: ['./refunds.component.css', '../pages.component.css'],
  providers: [MessageService]
})
export class RefundsComponent implements OnInit {

  Ressource: string = 'REFUNDS';

  refundDialog: boolean = false;

  deleteRefundDialog: boolean = false;

  deleteRefundsDialog: boolean = false;

  currency: any;

  maxRefundAmount: number = 0;

  eligibleReturns: OrderReturn[] = [];

  refunds: Refund[] = [];

  refund: Refund = {};

  customers: Customer[] = [];

  customer: Customer = {};

  selectedRefunds: Refund[] = [];

  unpaidOrders: Order[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  returnStatuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];
  
  userRoles: any;
  isAdmin: boolean = false;

  refundMethods = [
    { value: 'Cash', label: 'refund_method_cash' },
    { value: 'Card', label: 'refund_method_card' },
    { value: 'Check', label: 'refund_method_check' },
    { value: 'BOE', label: 'refund_method_boe' },
    { value: 'Transfer', label: 'refund_method_transfer' },
  ];

  canAddRefund: boolean = false;
  canEditRefund: boolean = false;
  canDeleteRefund: boolean = false;
  isLoading: boolean = true;
  refundStatuses: any[] = [];

  constructor(private messageService: MessageService,
    private refundService: RefundService,
    private customerService: CustomerService,
    private configService: AppConfigurationService,
    private returnService: ReturnService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,) { }

  async ngOnInit() {
    this.isLoading = true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllRefunds();
    this.onGetAllCustomersWithUnpaidOrders(),
    await this.setUserRoles(),
    await this.checkPermissions();
    this.cols = [
      { field: 'refundId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('refund_name') },
      { field: 'email', header: this.translateService.instant('refund_email') },
      { field: 'phoneNumber', header: this.translateService.instant('refund_phone_number') },
      { field: 'country', header: this.translateService.instant('refund_country') },
      { field: 'city', header: this.translateService.instant('refund_city') },
      { field: 'address', header: this.translateService.instant('refund_address') },
    ];

    this.returnStatuses = [
      { label: 'Pending', value: 'PENDING' },
      { label: 'Canceled', value: 'CANCELED' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Partially_Refunded', value: 'PARTIALLY_REFUNDED' },
      { label: 'Processing', value: 'PROCESSING' },
    ];

    this.refundStatuses = [
    { value: 'PENDING', label:'refund_status_pending' },
    { value: 'PROCESSING', label: 'refund_status_processing' },
    { value: 'COMPLETED', label: 'refund_status_completed' }
  ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddRefund = this.permissionService.canCreate(this.Ressource);
    this.canEditRefund = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteRefund = this.permissionService.canDelete(this.Ressource);

  }

  private async setUserRoles() {
        this.userRoles = await this.keycloakService.getUserRoles();
        this.isAdmin = this.userRoles.includes('ADMIN');
    }

  deleteSelectedRefunds() {
    if (!this.canDeleteRefund) return;
    this.deleteRefundsDialog = true;
  }

  editRefund(refund: Refund) {
    if (!this.canEditRefund) return;
    this.refund = { ...refund };
    this.refundDialog = true;
  }

  deleteRefund(refund: Refund) {
    if (!this.canDeleteRefund) return;
    this.deleteRefundDialog = true;
    this.refund = { ...refund };
  }

  confirmDeleteSelected() {
    this.deleteRefundsDialog = false;
    this.selectedRefunds.forEach(selectedRefund => this.onDeleteRefund(selectedRefund.refundId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Refunds Deleted', life: 3000 });
    this.selectedRefunds = [];
  }

  async confirmDelete() {
    this.deleteRefundDialog = false;
    await this.onDeleteRefund(this.refund.refundId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Refund Deleted', life: 3000 });
    this.refund = {};
  }

  hideDialog() {
    this.refundDialog = false;
    this.submitted = false;
  }

  async openNew() {
    if (!this.canAddRefund) return;
    await this.loadEligibleReturns();
    this.refund = {};
    this.refund.refundDate = new Date();
    this.refund.refundMethod = 'Cash';
    this.refund.status = 'PENDING';
    this.submitted = false;
    this.refundDialog = true;
  }

  getReturnDisplayLabel = (ret: OrderReturn): string => {
    if (!ret) { return ''; }

    const returnId = ret.returnId ?? 'N/A';
    const orderId = ret.order?.orderId ?? 'N/A';
    const refundAmt = ret.totalRefundableAmount ?? 0;
    const customer = this.getCustomerDisplayName(ret.order?.customer);

    return `#${returnId} • Order #${orderId} • ${refundAmt} ${this.currency} • ${customer}`;
  };

  // getOrderReturnDisplayLabel = (orderReturn: any): string => {
  //   if (!orderReturn) return '';

  //   const returnId = orderReturn.returnId || 'N/A';
  //   const orderId = orderReturn.order.orderId || 'N/A';
  //   const totalAmount = orderReturn.totalRefundableAmount !== undefined ? orderReturn.totalRefundableAmount : 0;
  //   //const itemCount = order.orderItems.length || 0;
  //   // const itemCount = orderReturn.itemCount !== undefined ? orderReturn.itemCount : this.getSafeItemsCount(order);
  //   const customerName = this.getCustomerDisplayName(orderReturn.order.customer);

  //   //return `#${returnId} • ${totalAmount} • ${itemCount} ${this.translate.instant('items')} • ${customerName}`;
  //   return `#${returnId} Order #${orderId} - ${this.getCustomerDisplayName(orderReturn.order?.customer)}`;
  // }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async saveRefund() {
    this.submitted = true;

    // Validate amount
    if (this.refund.amount <= 0 || this.refund.amount > this.maxRefundAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('refund_amount_invalid')
      });
      return;
    }

    if (this.refund.refundDate) {
      const date =
        typeof this.refund.refundDate === 'string'
          ? new Date(this.refund.refundDate)
          : this.refund.refundDate;
      this.refund.refundDate = this.formatDate(date);
    }

    if (this.refund.checkExpirationDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.refund.checkExpirationDate === "string"
          ? new Date(this.refund.checkExpirationDate)
          : this.refund.checkExpirationDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.refund.checkExpirationDate = `${year}-${month}-${day}`; // Convert to string format
    }
    else if (this.refund.boeExpirationDate) {
      // Ensure `dateOfExpense` is a Date object
      const date =
        typeof this.refund.boeExpirationDate === "string"
          ? new Date(this.refund.boeExpirationDate)
          : this.refund.boeExpirationDate;

      // Format the date into YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
      const day = String(date.getDate()).padStart(2, "0");

      this.refund.boeExpirationDate = `${year}-${month}-${day}`; // Convert to string format
    }


    if (this.refund.orderReturn) {
      let success = false;

      if (this.refund.refundId) {
        success = await this.updateRefund(this.refund.refundId, this.refund);
        this.messageService.add({
          severity: success ? 'success' : 'error',
          summary: success ? 'Successful' : 'Error',
          detail: success ? 'Refund updated with success' : 'Error while updating refund',
          life: 3000,
        });
      } else {
        success = await this.addRefund(this.refund);
        this.messageService.add({
          severity: success ? 'success' : 'error',
          summary: success ? 'Successful' : 'Error',
          detail: success ? 'Refund created with success' : 'Error while adding refund',
          life: 3000,
        });
      }

      if (success) {
        this.refunds = [...this.refunds];
        this.refundDialog = false;
        this.refund = {};
      }
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
    }
  }

  private generateTransactionId(): string {
    return 'TXN-' + Date.now();
  }

  onOrderSelect(order: Order) {
    if (order) {
      this.maxRefundAmount = order.totalAmount - order.totalPaid;
      // Auto-set the amount to the maximum payable (optional)
      this.refund.amount = this.maxRefundAmount;
    } else {
      this.maxRefundAmount = 0;
      this.refund.amount = null;
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
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

  async onGetAllRefunds() {
    await this.refundService.getRefunds()
      .subscribe({
        next: (response: any) => {
          this.refunds = response;
          this.refunds.forEach((refund: any) => {
            refund.creationDate = new Date(<Date>refund.creationDate)
            refund.refundDate = new Date(<Date>refund.refundDate)
            if (refund.checkExpirationDate) {
              refund.checkExpirationDate = new Date(<Date>refund.checkExpirationDate)
            }
            if (refund.boeExpirationDate) {
              refund.boeExpirationDate = new Date(<Date>refund.boeExpirationDate)
            }
          });
        },
        error: (err: any) => {
          console.error(err)
        },
        complete: () => {
          this.isLoading = false;
          console.log(this.refunds)
        }
      })
  }

  async onDeleteRefund(id: any) {
    await this.refundService.deleteRefund(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllRefunds();
        },
        error(err: any) {
          console.error(err)
        },
      })
  }


  async updateRefund(id: any, refund: any): Promise<any> {
    console.log(refund)
    await this.refundService.updateRefund(id, refund)
      .subscribe({
        next: (response: any) => {
          this.onGetAllRefunds();
          return true;
        },
        error(err: any) {
          console.error(err);
          return false;
        },
      })
  }

  addRefund(refund: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.refundService.saveRefund(refund).subscribe({
        next: () => {
          this.onGetAllRefunds();
          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding refund:', err);
          resolve(false);
        }
      });
    });
  }

  async onGetAllCustomersWithUnpaidOrders() {
    await this.customerService.getCustomersWithUnpaidOrders()
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

  async loadEligibleReturns() {
    this.returnService.getReturnsReadyForRefund().subscribe((returns: OrderReturn[]) => {
      this.eligibleReturns = returns.filter(r => r.totalRefundableAmount > 0);
      console.log(this.eligibleReturns);
    });
  }

  onReturnSelect(selectedReturn: OrderReturn) {
    this.maxRefundAmount = selectedReturn.totalRefundableAmount;
    if (this.refund.amount > this.maxRefundAmount) {
      this.refund.amount = this.maxRefundAmount;
    }
  }

  // onCustomerSelect(customer: Customer) {
  //   if (customer?.customerId) {
  //     this.orderService.getUnpaidOrdersByCustomer(customer.customerId).subscribe({
  //       next: (orders: Order[]) => {
  //         this.unpaidOrders = orders;
  //         this.refund.orderReturn = null;
  //       },
  //       error: (err) => {
  //         console.error('Error fetching unpaid orders', err);
  //         this.unpaidOrders = [];
  //       }
  //     });
  //   } else {
  //     this.unpaidOrders = [];
  //   }
  // }


  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.refunds, 'refunds')
  }

  exportExcel() {
    // Clone the refunds array to avoid modifying the original array
    const modifiedRefunds = this.refunds.map(refund => {
      // Create a copy of the refund object to modify
      const modifiedRefund = { ...refund };

      // Remove the column you want to exclude
      delete modifiedRefund.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedRefund['columnToRemove'];

      return modifiedRefund;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedRefunds, 'refunds');
  }

  // async onGetCurrency() {
  //   await (await this.configService.getConfigurationValue('currency'))
  //     .subscribe({
  //       next: (response: any) => {
  //         this.currency = response;
  //         console.log(this.currency)
  //       },
  //       error: (err: any) => {
  //         console.log(err)
  //       }
  //     })
  // }

  getStatusSeverity(status: RefundStatus): string {
    switch (status) {
      case 'COMPLETED': return 'success';
      case 'PROCESSING': return 'info';
      case 'PENDING': return 'warning';
      case 'FAILED': return 'danger';
      default: return '';
    }
  }

  getRefundMethodLabel(method: RefundMethod): string {
    // Add translations as needed
    return {
      'Check': 'refund_method_check',
      'Card': 'refund_method_card',
      'Transfer': 'refund_method_cash',
      'CASH': 'refund_method_transfer',
      'BOE': 'refund_method_boe',
      'DIGITAL_WALLET': 'refund_method_digital_wallet'
    }[method] || method;
  }

  getTotalAmount(): number {
    return this.refunds?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
  }

  getCustomerDisplayName(customer: any): string {
    if (!customer) return 'N/A';

    if (customer.customerType === 'Company') {
      return customer.companyName || 'Unnamed Company';
    }

    return [customer.firstName, customer.lastName]
      .filter(name => name)
      .join(' ') || 'Unnamed Customer';
  }

  getPaymentMethodIcon(method: string): string {
    switch (method) {
      case 'CASH': return 'pi pi-money-bill';
      case 'CARD': return 'pi pi-credit-card';
      case 'TRANSFER': return 'pi pi-bank';
      case 'CHECK': return 'pi pi-file';
      default: return 'pi pi-wallet';
    }
  }

  getPaymentMethodSeverity(method: string): string {
    switch (method) {
      case 'CASH': return 'success';
      case 'CARD': return 'info';
      case 'TRANSFER': return 'warning';
      case 'CHECK': return 'help';
      default: return 'danger';
    }
  }

}
