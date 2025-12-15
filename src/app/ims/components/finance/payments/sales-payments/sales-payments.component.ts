import { Component, EventEmitter, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { LazyLoadEvent, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Payment } from 'src/app/models/payment';
import { PaymentService } from 'src/app/services/payment.service';
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
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { getPaymentMethodLabel, paymentMethodOptions, getPaymentMethodIcon, getPaymentMethodSeverity, getPaymentStatusSeverity, getPaymentStatusIcon } from 'src/app/shared/payment-utils';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { BankTransaction } from 'src/app/models/bank-transaction';
import { firstValueFrom } from 'rxjs';

@Component({
  templateUrl: './sales-payments.component.html',
  styleUrls: ['./sales-payments.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class SalesPaymentsComponent implements OnInit {

  @ViewChild('dt') dt!: Table;
  totalRecords: number = 0;
  pageSize: number = 20;
  globalFilter: string = '';

  Ressource: string = 'PAYMENTS';

  paymentDialog: boolean = false;

  deletePaymentDialog: boolean = false;

  confirmPaymentDialog: boolean = false;

  deletePaymentsDialog: boolean = false;

  currency: any;

  maxPaymentAmount: number = 0;

  payments: Payment[] = [];

  payment: Payment = {};

  customers: Customer[] = [];

  customer: Customer = {};

  selectedPayments: Payment[] = [];

  unpaidOrders: Order[] = [];

  bankAccounts: BankAccount[] = [];
  selectedBankAccount: BankAccount | null = null;

  submitted: boolean = false;

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];

  isSaving: boolean = false;

  paymentMethodOptions = paymentMethodOptions;

  showCashRegisterWarning = false;

  maxPaymentDate: Date;

  canAddPayment: boolean = false;
  canEditPayment: boolean = false;
  canDeletePayment: boolean = false;
  canReadPayment: boolean = false;
  canConfirmPayment: boolean = false;
  isLoading: boolean = false;
  canBeDeleted: boolean;
  cols: any[];

  lastLazyLoadEvent?: LazyLoadEvent;

  constructor(private messageService: MessageService,
    private paymentService: PaymentService,
    private customerService: CustomerService,
    private configService: AppConfigurationService,
    private orderService: OrderService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private financialDocService: FinancialDocumentsService,
    private bankAccountService: BankAccountService,
    private router: Router) { }

  async ngOnInit() {
    this.isLoading = true;
    this.maxPaymentDate = new Date(); // Today's date
    this.maxPaymentDate.setHours(23, 59, 59, 999); // Include entire current day
    this.pageSize = 20;
    this.totalRecords = 0; // will be updated after first fetch
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    await this.checkPermissions();
    this.cols = [
      { field: 'transactionId', header: 'payment_transaction_id' },
      { field: 'orderReference', header: 'order_reference' },
      { field: 'customerFullName', header: 'order_customer' },
      { field: 'amount', header: 'amount' },
      { field: 'paymentStatus', header: 'payment_status' },
      { field: 'paymentMethod', header: 'payment_method' },
      { field: 'paymentDate', header: 'payment_date' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
    await this.loadBankAccounts();
    this.isLoading = false;
  }

  async loadBankAccounts() {
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      this.bankAccounts = await firstValueFrom(accounts$);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddPayment = this.permissionService.canCreate(this.Ressource);
    this.canEditPayment = this.permissionService.canUpdate(this.Ressource);
    this.canDeletePayment = this.permissionService.canDelete(this.Ressource);
    this.canReadPayment = this.permissionService.canRead(this.Ressource);
    this.canConfirmPayment = this.permissionService.canConfirm(this.Ressource);
  }

  deleteSelectedPayments() {
    if (!this.canDeletePayment) return;
    this.deletePaymentsDialog = true;
  }

  editPayment(payment: Payment) {
    if (!this.canEditPayment) return;

    // Clone the payment and set it
    this.payment = { ...payment };

    // Fix: Re-map customer object for dropdown binding
    if (payment.customerId) {
      const fullCustomer = this.customers.find(c => c.customerId === payment.customerId);
      if (fullCustomer) {
        this.payment.customer = fullCustomer;
      }
    }

    this.orderService.getOrder(payment.orderId).toPromise().then(order => {
      this.payment.order = order;
      this.onOrderSelect(this.payment.order!);
    }).catch(err => {
      console.error('Error fetching order for payment:', err);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_fetching_order_for_payment'),
        life: 3000
      });
    });

    // Set max payment amount based on selected order
    this.onOrderSelect(this.payment.order!);

    this.paymentDialog = true;
    this.submitted = false; // Reset validation state
  }

  async viewPaymentDetails(payment: any): Promise<void> {
    if (!payment || !payment.paymentId) return;
    this.router.navigate(['/finance/payments/sales', payment.paymentId]);
  }


  deletePayment(payment: Payment) {
    if (!this.canDeletePayment) return;
    this.deletePaymentDialog = true;
    this.payment = { ...payment };
  }

  openConfirmPayment(payment: Payment) {
    if (!this.canConfirmPayment) return;
    this.confirmPaymentDialog = true;
    this.payment = { ...payment };
  }

  confirmDeleteSelected() {
    this.deletePaymentsDialog = false;
    const selected = this.selectedPayments || [];
    console.log('Deleting selected payments:', selected);
    selected.forEach(payment => this.onDeletePayment(payment.paymentId));
    this.selectedPayments = []; // clear selections
  }

  async confirmDelete() {
    this.deletePaymentDialog = false;
    await this.onDeletePayment(this.payment.paymentId);
    this.payment = {};
  }

  async confirmPayment() {
    this.confirmPaymentDialog = false;
    await this.onConfirmPayment(this.payment.paymentId);
    this.payment = {};
  }

  hideDialog() {
    this.paymentDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddPayment) return;
    this.payment = {};
    this.selectedBankAccount = null;
    this.onGetAllCustomersWithUnpaidOrders();
    this.payment.paymentDate = new Date();
    this.payment.paymentMethod = "Cash";
    this.payment.direction = 'INCOMING';
    this.submitted = false;
    this.paymentDialog = true;
  }

  checkCashRegisterStatus() {
    if (!this.payment.paymentDate || this.payment.paymentMethod !== 'Cash') {
      this.showCashRegisterWarning = false;
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paymentDate = new Date(this.payment.paymentDate);
    paymentDate.setHours(0, 0, 0, 0);

    this.showCashRegisterWarning = paymentDate < today;
  }

  hasPaymentMethodDetails(): boolean {
    return !!(this.payment?.checkNumber || this.payment?.boeNumber ||
      this.payment?.checkExpirationDate ||
      this.payment?.boeExpirationDate);
  }

  // Calculate remaining balance
  getRemainingBalance(): number {
    if (!this.payment?.order?.totalAmount || !this.payment?.order?.totalPaid) return 0;
    return this.payment.order.totalAmount - this.payment.order.totalPaid;
  }

  downloadPaymentPDF(payment: any): void {
    // Implement PDF download logic
    console.log('Downloading payment PDF:', payment);
  }

  sendReceiptByEmail(payment: any): void {
    // Implement email sending logic
    console.log('Sending receipt by email:', payment);
  }

  viewOrder(orderId: number): void {
    // Implement order viewing logic
    console.log('Viewing order:', orderId);
  }


  isPaymentNotSettled(payment: Payment): boolean {
    const today = new Date();
    const paymentDate = new Date(payment.paymentDate);

    const isToday =
      paymentDate.getFullYear() === today.getFullYear() &&
      paymentDate.getMonth() === today.getMonth() &&
      paymentDate.getDate() === today.getDate();

    return isToday && payment.paymentStatus !== 'SETTLED';
  }


  async savePayment() {
    this.submitted = true;
    console.log('Saving payment:', this.payment);

    // 🔹 Required field validation
    if (
      !this.payment.order || !this.payment.customer ||
      !this.payment.amount ||
      !this.payment.paymentMethod ||
      !this.payment.paymentDate
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('please_fill_required_fields'),
      });
      return;
    }

    // 🔹 Validate amount range
    if (this.payment.amount < 0.01 || this.payment.amount > this.maxPaymentAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid', {
          max: this.maxPaymentAmount.toFixed(2),
        }),
      });
      return;
    }

    // 🔹 Warn if paying cash when register is closed
    if (this.showCashRegisterWarning && this.payment.paymentMethod === 'Cash') {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('note'),
        detail: this.translate.instant('cash_register_closed_warning'),
        life: 5000,
      });
    }

    // 🔹 Validate bank account for Transfer, Check, or BOE
    const requiresBankAccount = ['Transfer', 'Check', 'BOE'].includes(this.payment.paymentMethod);
    if (requiresBankAccount && !this.selectedBankAccount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_account_required'),
      });
      return;
    }

    // 🔹 Validate extra fields for Check / BOE
    if (
      this.payment.paymentMethod === 'Check' &&
      (!this.payment.checkNumber || !this.payment.checkExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('check_fields_required'),
      });
      return;
    }

    if (
      this.payment.paymentMethod === 'BOE' &&
      (!this.payment.boeNumber || !this.payment.boeExpirationDate)
    ) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('boe_fields_required'),
      });
      return;
    }

    // 🔹 Overpayment check
    if (this.payment.order) {
      const order = await this.loadPaymentsForOrder(this.payment.order.orderId);
      const payments = order?.payments || [];
      const otherPaymentsTotal = payments
        .filter(p => p.paymentId !== this.payment.paymentId)
        .reduce((sum, p) => sum + p.amount, 0);

      if (otherPaymentsTotal + this.payment.amount > order.totalAmount) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('payment_exceeds_order_total'),
        });
        return;
      }
    }

    // 🔹 Normalize all date fields
    const formatDate = (date: any): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    this.payment.paymentDate = formatDate(this.payment.paymentDate);
    if (this.payment.checkExpirationDate)
      this.payment.checkExpirationDate = formatDate(this.payment.checkExpirationDate);
    if (this.payment.boeExpirationDate)
      this.payment.boeExpirationDate = formatDate(this.payment.boeExpirationDate);

    // 🔹 Save or update payment
    this.isSaving = true;
    let savedPayment: Payment | null = null;
    try {
      if (this.payment.paymentId) {
        await this.updatePayment(this.payment.paymentId, this.payment);
        savedPayment = this.payment;
      } else {
        savedPayment = await this.addPayment(this.payment);
      }

      // 🔹 Record bank transaction if payment method requires it
      if (requiresBankAccount && this.selectedBankAccount && savedPayment) {
        await this.recordBankTransaction(savedPayment);
      }
    } catch (error) {
      console.error(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000,
      });
    } finally {
      this.isSaving = false;
    }

    // 🔹 Refresh & reset form
    this.payments = [...this.payments];
    this.paymentDialog = false;
    this.payment = {};
    this.selectedBankAccount = null;
  }

  async recordBankTransaction(payment: Payment) {
    if (!this.selectedBankAccount || !payment.paymentId) return;

    try {
      // Format date to ISO string (YYYY-MM-DD)
      const formatDateToString = (date: string | Date | undefined): string => {
        if (!date) return new Date().toISOString().split('T')[0];
        if (typeof date === 'string') return date.split('T')[0];
        const d = date as Date;
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const transaction: BankTransaction = {
        account: this.selectedBankAccount,
        type: 'RECEIPT',
        amount: payment.amount || 0,
        transactionDate: formatDateToString(payment.paymentDate),
        description: `Payment received from ${payment.customer?.fullName || 'Customer'} - Order ${payment.order?.reference || ''}`,
        reference: payment.transactionId || `PAY-${payment.paymentId}`,
        checkNumber: payment.checkNumber,
        payment: { paymentId: payment.paymentId },
        reconciled: false
      };

      const transaction$ = await this.bankAccountService.recordTransaction(
        this.selectedBankAccount.accountId!,
        transaction
      );
      await firstValueFrom(transaction$);
    } catch (error) {
      console.error('Error recording bank transaction:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('payment_saved_but_bank_transaction_failed'),
        life: 5000,
      });
    }
  }


  showPaymentHistory() {
    // Implement payment history view
  }

  async onOrderSelect(order: Order) {
    if (!order) {
      this.maxPaymentAmount = 0;
      this.payment.amount = null;
      return;
    }

    order.payments = await this.loadPaymentsForOrder(this.payment.order.orderId);

    console.log(order.payments)
    // Calculate total paid excluding THIS payment (if editing)
    const otherPaymentsTotal = order.payments
      ?.filter(p => p.paymentId !== this.payment?.paymentId)
      ?.reduce((sum, p) => sum + p.amount, 0) || 0;

    // Calculate maximum allowed amount
    if (this.payment?.paymentId) {
      // When editing: can increase up to remaining balance + current payment amount
      this.maxPaymentAmount = (order.totalAmount - otherPaymentsTotal);
    } else {
      // When creating new: can only pay remaining balance
      this.maxPaymentAmount = (order.totalAmount - order.totalPaid);
    }

    // Auto-set amount to max if not set or invalid
    if (!this.payment.amount || this.payment.amount > this.maxPaymentAmount) {
      this.payment.amount = Math.min(this.maxPaymentAmount, order.totalAmount);
    }
  }

  onGlobalFilter(event: { globalFilter: string, context?: 'incoming' | 'outgoing' }) {
    const { globalFilter } = event;
    this.globalFilter = globalFilter;

    // Trigger lazy load manually with first page
    const lazyEvent: any = {
      first: 0,
      rows: this.pageSize,
      sortField: null,
      sortOrder: null,
      filters: {},
      globalFilter: this.globalFilter
    };

    this.onLazyLoad(lazyEvent);
  }


  clear(table: Table) {
    table.clear();
  }

  onLazyLoad(event: any) {
    this.lastLazyLoadEvent = event;

    // Add sort info to event
    const sortBy = event.sortField || 'paymentDate'; // default sort field
    const sortOrder = event.sortOrder === 1 ? 'ASC' : 'DESC';

    this.loadPayments({ ...event, sortBy, direction: sortOrder });
  }

  loadPayments(event?: any) {
    const page = event?.first ? event.first / event.rows! : 0;
    const size = event?.rows || this.pageSize;
    const sortBy = event?.sortBy || 'paymentDate';
    const direction = event?.direction || 'DESC';

    this.paymentService.getPayments('incoming', page, size, this.globalFilter, sortBy, direction)
      .subscribe({
        next: (res: any) => {
          console.log(res);
          this.payments = res.content.map((p: any) => {
            return {
              ...p,
              customerFullName: p.customerType === 'Company'
                ? p.customerCompany
                : `${p.customerFirstName} ${p.customerLastName}`,
              paymentDate: p.paymentDate ? new Date(p.paymentDate) : null,
              creationDate: p.creationDate ? new Date(p.creationDate) : null,
              hasReceipt: !!p.receiptNumber
            };
          });
          this.totalRecords = res.totalElements;
          console.log(res);
        },
        error: (err) => console.error(err)
      });
  }



  async loadPaymentsForOrder(orderId: any) {
    return this.paymentService.getPaymentsByOrderId(orderId)
      .toPromise()
      .then((response: any) => {
        return response;
      })
      .catch((error: any) => {
        console.error('Error loading payments for order:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_loading_payments_for_order'),
          life: 3000
        });
        throw error;
      });
  }

  async onDeletePayment(id: any) {
    this.paymentService.deletePayment(id).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('payment_deleted'),
          life: 3000
        });

        if (this.lastLazyLoadEvent) {
          this.onLazyLoad(this.lastLazyLoadEvent);
        }
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_deleting_payment'),
          life: 3000
        });
      }
    });
  }

  async updatePayment(
    id: any,
    payment: any
  ): Promise<any> {
    this.paymentService.updatePayment(id, payment).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('payment_updated'),
          life: 3000
        });

        if (this.lastLazyLoadEvent) {
          this.onLazyLoad(this.lastLazyLoadEvent);
        }
      },
      error: (err: any) => {
        console.error(err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_updating_payment'),
          life: 3000
        });
      }
    });
  }

  addPayment(payment: any): Promise<Payment | null> {
    return new Promise((resolve) => {
      this.paymentService.savePayment(payment).subscribe({
        next: (savedPayment: Payment) => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('payment_added'),
            life: 3000
          });

          // Reset paginator to first page
          if (this.dt) {
            this.dt.first = 0;
          }

          // Reload the first page
          this.onLazyLoad(
            { first: 0, rows: this.lastLazyLoadEvent?.rows || this.pageSize }
          );

          resolve(savedPayment);
        },
        error: (err: any) => {
          console.error('Error adding payment:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_confirming_payment'),
            life: 3000
          });
          resolve(null);
        }
      });
    });
  }

  onConfirmPayment(paymentId: any): Promise<boolean> {
    return new Promise((resolve) => {
      this.paymentService.confirmPayment(paymentId).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('payment_confirmed'),
            life: 3000
          });

          if (this.lastLazyLoadEvent) {
            this.onLazyLoad(this.lastLazyLoadEvent);
          }

          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding payment:', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_payment'),
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
            fullName: this.getCustomerDisplayName(customer)
          }));
          console.log(this.customers);
        },
        error: (err: any) => {
          console.error('Error fetching customers with unpaid orders', err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_customers'),
            life: 3000
          });
        }
      })
  }

  onCustomerSelect(customer: Customer) {
    if (customer?.customerId) {
      this.orderService.getUnpaidOrdersByCustomer(customer.customerId).subscribe({
        next: (orders: Order[]) => {
          console.log(orders);
          this.unpaidOrders = orders;
          this.payment.order = null;
        },
        error: (err) => {
          console.error('Error fetching unpaid orders', err);
          this.unpaidOrders = [];
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_fetching_unpaid_orders'),
            life: 3000
          });
        }
      });
    } else {
      this.unpaidOrders = [];
    }
  }


  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.payments, 'sales-payments')
  }

  exportExcel() {
    // Clone the payments array to avoid modifying the original array
    const modifiedPayments = this.payments.map(payment => {
      // Create a copy of the payment object to modify
      const modifiedPayment = { ...payment };

      // Remove the column you want to exclude
      delete modifiedPayment.creationDate;

      return modifiedPayment;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedPayments, 'sales-payments');
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

  getPaymentStatusSeverity(status: string): string {
    return getPaymentStatusSeverity(status);
  }

  getPaymentStatusIcon(status: string): string {
    return getPaymentStatusIcon(status);
  }

  getReceiptStatusSeverity(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ISSUED': return 'success';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'danger';
      default: return 'info';
    }
  }

  getReceiptStatusIcon(status: string): string {
    switch (status?.toUpperCase()) {
      case 'ISSUED': return 'pi pi-check';
      case 'PENDING': return 'pi pi-clock';
      case 'CANCELLED': return 'pi pi-times';
      default: return 'pi pi-file';
    }
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentMethodLabel(paymentMethod: string) {
    return getPaymentMethodLabel(paymentMethod);
  }

  viewReceipt(payment: any) {
    this.paymentService.getReceipt(payment.paymentId).subscribe({
      next: (blob: Blob) => {
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
      },
      error: (err) => {
        console.error('Error fetching receipt:', err);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_fetching_receipt'),
        });
      }
    });
  }

  printReceipt(docNumber: any): void {
    this.financialDocService.printFinancialDoc(docNumber);
  }

  generateReceipt(paymentId) {
    this.financialDocService.generateReceiptFromPOS(paymentId).subscribe({
      next: (res: any) => {
        // Reuse the existing logic to open the PDF
        this.financialDocService.printFinancialDoc(res.number);

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('receipt_generated'),
          detail: res.number,
        });
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('receipt_generation_failed'),
        });
      }

    });
  }

}

