import { Component, EventEmitter, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
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

@Component({
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.css', '../pages.component.css'],
  providers: [MessageService]
})
export class PaymentsComponent implements OnInit {

  Ressource: string = 'PAYMENTS';

  paymentDialog: boolean = false;

  deletePaymentDialog: boolean = false;

  deletePaymentsDialog: boolean = false;

  currency: any;

  maxPaymentAmount: number = 0;

  payments: Payment[] = [];

  payment: Payment = {};

  customers: Customer[] = [];

  customer: Customer = {};

  selectedPayments: Payment[] = [];

  unpaidOrders: Order[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  exportColumns!: ExportColumn[];

  isSaving: boolean = false;
  paymentMethodOptions: any[] = [];

  canAddPayment: boolean = false;
  canEditPayment: boolean = false;
  canDeletePayment: boolean = false;
  isLoading: boolean = true;
  constructor(private messageService: MessageService,
    private paymentService: PaymentService,
    private customerService: CustomerService,
    private configService: AppConfigurationService,
    private orderService: OrderService,
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
    this.onGetAllPayments();
    // this.onGetCurrency(),
      this.onGetAllCustomersWithUnpaidOrders(),
      await this.checkPermissions();
    this.cols = [
      { field: 'paymentId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('payment_name') },
      { field: 'email', header: this.translateService.instant('payment_email') },
      { field: 'phoneNumber', header: this.translateService.instant('payment_phone_number') },
      { field: 'country', header: this.translateService.instant('payment_country') },
      { field: 'city', header: this.translateService.instant('payment_city') },
      { field: 'address', header: this.translateService.instant('payment_address') },
    ];
    
    this.paymentMethodOptions = [
    { label: this.translate.instant('payment_method_cash'), value: 'Cash', icon: 'pi pi-money-bill' },
    { label: this.translate.instant('payment_method_card'), value: 'Card', icon: 'pi pi-credit-card' },
    { label: this.translate.instant('payment_method_check'), value: 'Check', icon: 'pi pi-file-edit' },
    { label: this.translate.instant('payment_method_transfer'), value: 'Transfer', icon: 'pi pi-bank' },
    { label: this.translate.instant('payment_method_boe'), value: 'BOE', icon: 'pi pi-file' }
];


    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddPayment = this.permissionService.canCreate(this.Ressource);
    this.canEditPayment = this.permissionService.canUpdate(this.Ressource);
    this.canDeletePayment = this.permissionService.canDelete(this.Ressource);

  }

  deleteSelectedPayments() {
    if (!this.canDeletePayment) return;
    this.deletePaymentsDialog = true;
  }

  editPayment(payment: Payment) {
    if (!this.canEditPayment) return;

    // Clone the payment and set it
    this.payment = { ...payment };

    // Manually trigger order selection logic
    if (this.payment.order) {
      this.onOrderSelect(this.payment.order);
    }

    this.paymentDialog = true;
    this.submitted = false; // Reset validation state
  }

  deletePayment(payment: Payment) {
    if (!this.canDeletePayment) return;
    this.deletePaymentDialog = true;
    this.payment = { ...payment };
  }

  confirmDeleteSelected() {
    this.deletePaymentsDialog = false;
    this.selectedPayments.forEach(selectedPayment => this.onDeletePayment(selectedPayment.paymentId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Payments Deleted', life: 3000 });
    this.selectedPayments = [];
  }

  async confirmDelete() {
    this.deletePaymentDialog = false;
    await this.onDeletePayment(this.payment.paymentId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Payment Deleted', life: 3000 });
    this.payment = {};
  }

  hideDialog() {
    this.paymentDialog = false;
    this.submitted = false;
  }

  openNew() {
    if (!this.canAddPayment) return;
    this.payment = {};
    this.payment.paymentDate = new Date();
    this.payment.paymentMethod = "Cash";
    this.submitted = false;
    this.paymentDialog = true;
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  //   async savePaymentOLD() {
  //     this.submitted = true;

  //     // Validate required fields
  //     if (!this.payment.order || !this.payment.amount || !this.payment.paymentMethod || !this.payment.paymentDate) {
  //         this.messageService.add({
  //             severity: 'error',
  //             summary: this.translate.instant('error'),
  //             detail: this.translate.instant('required_fields_missing')
  //         });
  //         return;
  //     }

  //     // Validate amount (changed <= to < for 0.01)
  //     if (this.payment.amount < 0.01 || this.payment.amount > this.maxPaymentAmount) {
  //         this.messageService.add({
  //             severity: 'error',
  //             summary: this.translate.instant('error'),
  //             detail: this.translate.instant('payment_amount_invalid', {
  //                 max: this.maxPaymentAmount.toFixed(2)
  //             })
  //         });
  //         return;
  //     }

  //     // Validate payment method specific fields
  //     if (this.payment.paymentMethod === 'Check' && !this.payment.checkNumber) {
  //         this.messageService.add({
  //             severity: 'error',
  //             summary: this.translate.instant('error'),
  //             detail: this.translate.instant('check_number_required')
  //         });
  //         return;
  //     }

  //       if (this.payment.paymentDate) {
  //         // Ensure `dateOfExpense` is a Date object
  //         const date =
  //           typeof this.payment.paymentDate === "string"
  //             ? new Date(this.payment.paymentDate)
  //             : this.payment.paymentDate;

  //         // Format the date into YYYY-MM-DD
  //         const year = date.getFullYear();
  //         const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  //         const day = String(date.getDate()).padStart(2, "0");

  //         this.payment.paymentDate = `${year}-${month}-${day}`; // Convert to string format
  //       }

  //       if (this.payment.checkExpirationDate) {
  //         // Ensure `dateOfExpense` is a Date object
  //         const date =
  //           typeof this.payment.checkExpirationDate === "string"
  //             ? new Date(this.payment.checkExpirationDate)
  //             : this.payment.checkExpirationDate;

  //         // Format the date into YYYY-MM-DD
  //         const year = date.getFullYear();
  //         const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  //         const day = String(date.getDate()).padStart(2, "0");

  //         this.payment.checkExpirationDate = `${year}-${month}-${day}`; // Convert to string format
  //       }

  //       if (this.payment.boeExpirationDate) {
  //         // Ensure `dateOfExpense` is a Date object
  //         const date =
  //           typeof this.payment.boeExpirationDate === "string"
  //             ? new Date(this.payment.boeExpirationDate)
  //             : this.payment.boeExpirationDate;

  //         // Format the date into YYYY-MM-DD
  //         const year = date.getFullYear();
  //         const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  //         const day = String(date.getDate()).padStart(2, "0");

  //         this.payment.boeExpirationDate = `${year}-${month}-${day}`; // Convert to string format
  //       }

  //     try {
  //         // Verify payment won't exceed order total (server-side validation)
  //         const order = this.payment.order;
  //         const otherPaymentsTotal = order.payments
  //             .filter(p => p.paymentId !== this.payment.paymentId)
  //             .reduce((sum, p) => sum + p.amount, 0);

  //         if (otherPaymentsTotal + this.payment.amount > order.totalAmount) {
  //             throw new Error(this.translate.instant('payment_exceeds_order_total'));
  //         }

  //         let success = false;
  //         let action: string;

  //         if (this.payment.paymentId) {
  //           console.log('Attempting to update payment ID:', this.payment.paymentId);
  //           success = await this.updatePayment(this.payment.paymentId, this.payment);
  //           action = 'updated';
  //         } else {
  //             this.payment.transactionId = this.generateTransactionId();
  //             success = await this.addPayment(this.payment);
  //             action = 'created';
  //         }

  //         if (success) {
  //             this.messageService.add({
  //                 severity: 'success',
  //                 summary: this.translate.instant('success'),
  //                 detail: this.translate.instant(`payment_${action}_success`),
  //                 life: 3000
  //             });

  //             this.payments = [...this.payments];
  //             this.paymentDialog = false;
  //             this.payment = {};
  //             this.onGetAllPayments(); // Refresh payments list
  //         } else {
  //             throw new Error(this.translate.instant(`payment_${action}_error`));
  //         }
  //     } catch (error) {
  //         this.messageService.add({
  //             severity: 'error',
  //             summary: this.translate.instant('error'),
  //             detail: error.message || this.translate.instant('save_error'),
  //             life: 3000
  //         });
  //         console.error('Payment save error:', error);
  //     }
  // }

  async savePayment() {
    this.submitted = true;
    console.log(this.payment)

    if (!this.payment.order || !this.payment.amount || !this.payment.paymentMethod || !this.payment.paymentDate) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('required_fields_missing')
      });
      return;
    }

    if (this.payment.amount < 0.01 || this.payment.amount > this.maxPaymentAmount) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('payment_amount_invalid', {
          max: this.maxPaymentAmount.toFixed(2)
        })
      });
      return;
    }


    if (this.payment.order) {
    const order = await this.loadPaymentsForOrder(this.payment.order.orderId);
    console.log('Loaded order:', order);

    const payments = order?.payments || []; // safely fallback to empty array

    const otherPaymentsTotal = payments
      .filter(p => p.paymentId !== this.payment.paymentId)
      .reduce((sum, p) => sum + p.amount, 0);

    if (otherPaymentsTotal + this.payment.amount > order.totalAmount) {
      throw new Error(this.translate.instant('payment_exceeds_order_total'));
    }


      if (this.payment.paymentDate) {
        // Ensure `dateOfExpense` is a Date object
        const date =
          typeof this.payment.paymentDate === "string"
            ? new Date(this.payment.paymentDate)
            : this.payment.paymentDate;

        // Format the date into YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, "0");

        this.payment.paymentDate = `${year}-${month}-${day}`; // Convert to string format
      }

      if (this.payment.checkExpirationDate) {
        // Ensure `dateOfExpense` is a Date object
        const date =
          typeof this.payment.checkExpirationDate === "string"
            ? new Date(this.payment.checkExpirationDate)
            : this.payment.checkExpirationDate;

        // Format the date into YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, "0");

        this.payment.checkExpirationDate = `${year}-${month}-${day}`; // Convert to string format
      }
      else if (this.payment.boeExpirationDate) {
        // Ensure `dateOfExpense` is a Date object
        const date =
          typeof this.payment.boeExpirationDate === "string"
            ? new Date(this.payment.boeExpirationDate)
            : this.payment.boeExpirationDate;

        // Format the date into YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
        const day = String(date.getDate()).padStart(2, "0");

        this.payment.boeExpirationDate = `${year}-${month}-${day}`; // Convert to string format
      }

      this.isSaving = true;
      try {
        if (this.payment.paymentId) {
          await this.updatePayment(this.payment.paymentId, this.payment);
          this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Payment Updated', life: 3000 });
        } else {
          await this.addPayment(this.payment);
          this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Payment Added', life: 3000 });
        }
      } catch (error) {
        console.error(error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error occurred', life: 3000 });
      } finally {
        this.isSaving = false;
      }

      this.payments = [...this.payments];
      this.paymentDialog = false;
      this.payment = {};
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

  async onGetAllPayments() {
    await this.paymentService.getPayments()
      .subscribe({
        next: (response: any) => {
          this.payments = response;
          this.payments.forEach((payment: any) => {
            payment.creationDate = new Date(<Date>payment.creationDate)
            payment.paymentDate = new Date(<Date>payment.paymentDate)
            if (payment.checkExpirationDate) {
              payment.checkExpirationDate = new Date(<Date>payment.checkExpirationDate)
            }
            if (payment.boeExpirationDate) {
              payment.boeExpirationDate = new Date(<Date>payment.boeExpirationDate)
            }
          });
        },
        error: (err: any) => {
          console.error(err)
        },
        complete: () => {
          this.isLoading = false;
          console.log(this.payments)
        }
      })
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
          summary: 'Error',
          detail: 'Error loading payments for order',
          life: 3000
        });
        throw error;
      });
  }

  async onDeletePayment(id: any) {
    await this.paymentService.deletePayment(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllPayments();
        },
        error(err: any) {
          console.error(err)
        },
      })
  }


  async updatePayment(id: any, payment: any): Promise<any> {
    console.log(payment)
    console.log(id)
    await this.paymentService.updatePayment(id, payment)
      .subscribe({
        next: (response: any) => {
          this.onGetAllPayments();
          console.log(response);
          return true;
        },
        error(err: any) {
          console.error(err);
          return false;
        },
      })
  }

  addPayment(data: any): Promise<boolean> {
    const { order, amount, paymentMethod } = data;
    return new Promise((resolve) => {
      this.paymentService.savePayment(order.orderId, amount, paymentMethod).subscribe({
        next: () => {
          this.onGetAllPayments();
          resolve(true);
        },
        error: (err: any) => {
          console.error('Error adding payment:', err);
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
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting customers', life: 3000 })
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
        }
      });
    } else {
      this.unpaidOrders = [];
    }
  }


  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.payments, 'payments')
  }

  exportExcel() {
    // Clone the payments array to avoid modifying the original array
    const modifiedPayments = this.payments.map(payment => {
      // Create a copy of the payment object to modify
      const modifiedPayment = { ...payment };

      // Remove the column you want to exclude
      delete modifiedPayment.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedPayment['columnToRemove'];

      return modifiedPayment;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedPayments, 'payments');
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
    switch (status) {
      case 'PAID': return 'success';
      case 'PARTIAL': return 'info';
      case 'PENDING': return 'warning';
      case 'OVERDUE': return 'danger';
      default: return '';
    }
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
        case 'cash':
            return 'success';
        case 'credit':
            return 'warning';
        case 'check':
            return 'help';
        case 'transfer':
            return 'info';
        default:
            return 'danger';
    }
}


}
