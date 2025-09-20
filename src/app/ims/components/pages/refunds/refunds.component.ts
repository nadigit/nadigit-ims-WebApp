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
  maxRefundDate: Date;

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
    this.maxRefundDate = new Date(); // Today's date
    this.maxRefundDate.setHours(23, 59, 59, 999); // Include entire current day
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
      { value: 'PENDING', label: 'refund_status_pending' },
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

  async editRefund(refund: Refund) {
    if (!this.canEditRefund) return;
    await this.loadEligibleReturns();
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
    this.selectedRefunds = [];
  }

  async confirmDelete() {
    this.deleteRefundDialog = false;
    await this.onDeleteRefund(this.refund.refundId);
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

  isRefundValidForUpdate(refund: any): boolean {
    const today = new Date();
    const refundDate = new Date(refund.refundDate);
    return refundDate.toDateString() === today.toDateString();
  }

  getReturnDisplayLabel = (ret: OrderReturn): string => {
    if (!ret) { return ''; }

    const returnId = ret.returnId ?? 'N/A';
    const reference = ret.order?.reference ?? 'N/A';
    const refundAmt = ret.totalRefundableAmount ?? 0;
    const customer = this.getCustomerDisplayName(ret.order?.customer);

    return `#${returnId} • ${this.translate.instant('order')} #${reference} • ${refundAmt} ${this.currency} • ${customer}`;
  };

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async saveRefund() {
    this.submitted = true;

    console.log(this.refund);

    if (!this.refund.orderReturn) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (this.refund.amount <= 0 || this.refund.amount > this.maxRefundAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('refund_amount_invalid')
      });
      return;
    }

    if (!this.refund.refundDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (!this.refund.refundMethod) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields')
      });
      return;
    }

    if (
      this.refund.refundMethod === 'Check' &&
      (!this.refund.checkNumber || !this.refund.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required')
      });
      return;
    }

    if (
      this.refund.refundMethod === 'BOE' &&
      (!this.refund.boeNumber || !this.refund.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required')
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
      const date =
        typeof this.refund.checkExpirationDate === 'string'
          ? new Date(this.refund.checkExpirationDate)
          : this.refund.checkExpirationDate;
      this.refund.checkExpirationDate = this.formatDate(date);
    }

    if (this.refund.boeExpirationDate) {
      const date =
        typeof this.refund.boeExpirationDate === 'string'
          ? new Date(this.refund.boeExpirationDate)
          : this.refund.boeExpirationDate;
      this.refund.boeExpirationDate = this.formatDate(date);
    }

    if (this.refund.orderReturn) {
      let success = false;

      if (this.refund.refundId) {
        success = await this.updateRefund(this.refund.refundId, this.refund);
      } else {
        success = await this.addRefund(this.refund);
      }

      if (success) {
        this.refunds = [...this.refunds];
        this.refundDialog = false;
        this.refund = {};
      }
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
        life: 3000
      });
    }
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
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_refunds'),
            life: 3000
          });
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
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('refund_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_refund'),
            life: 3000
          });
        },
      });
  }


  async updateRefund(id: any, refund: any): Promise<any> {
    console.log(refund)
    await this.refundService.updateRefund(id, refund)
      .subscribe({
        next: (response: any) => {
          this.onGetAllRefunds();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('refund_updated'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.error(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_refund'),
            life: 3000
          });
          return false;
        },
      })
  }

  addRefund(refund: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.refundService.saveRefund(refund).subscribe({
        next: () => {
          this.onGetAllRefunds();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('refund_added'),
            life: 3000
          });
          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding refund:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_adding_refund'),
            life: 3000
          });
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
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_customers'),
            life: 3000
          });
        }
      })
  }

  async loadEligibleReturns() {
    this.returnService.getReturnsReadyForRefund().subscribe((returns: OrderReturn[]) => {
      this.eligibleReturns = returns.filter(r => r.totalRefundableAmount > 0);
      console.log(this.eligibleReturns);
    });
  }

  compareReturns = (o1: OrderReturn, o2: OrderReturn): boolean =>
  o1 && o2 ? o1.returnId === o2.returnId : o1 === o2;

  onReturnSelect(selectedReturn: OrderReturn) {
    if (!selectedReturn) {
      this.maxRefundAmount = 0;
      return;
    }

    const totalRefundable = selectedReturn.totalRefundableAmount || 0;

    const totalAlreadyRefunded = selectedReturn.refunds?.reduce((sum, refund) => {
      return sum + (refund.amount || 0);
    }, 0) || 0;

    this.maxRefundAmount = totalRefundable - totalAlreadyRefunded;

    // Ensure current refund doesn't exceed max
    if (this.refund.amount > this.maxRefundAmount) {
      this.refund.amount = this.maxRefundAmount;
    }
  }

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

  getRefundedAmount(orderReturn: OrderReturn): number {
    if (!orderReturn.refunds || orderReturn.refunds.length === 0) return 0;
    return orderReturn.refunds.reduce((sum, refund) => sum + (refund.amount || 0), 0);
  }

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
      'Cash': 'refund_method_transfer',
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
    switch (method?.toLowerCase()) {
      case 'cash': return 'success';
      case 'card': return 'info';
      case 'transfer': return 'warning';
      case 'check': return 'help';
      case 'boe': return 'help';
      default: return 'danger';
    }
  }

}
