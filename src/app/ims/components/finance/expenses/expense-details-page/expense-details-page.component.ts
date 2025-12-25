import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService } from 'primeng/api';
import { Expense } from 'src/app/models/expense';
import { ExpenseService } from 'src/app/services/expense.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { firstValueFrom } from 'rxjs';
import { getPaymentMethodIcon, getPaymentMethodSeverity } from 'src/app/shared/payment-utils';

@Component({
  selector: 'app-expense-details-page',
  templateUrl: './expense-details-page.component.html',
  styleUrls: ['./expense-details-page.component.css', '../expenses.component.css', '../../finance.component.css']
})
export class ExpenseDetailsPageComponent implements OnInit {
  expenseId!: number;
  expense: Expense | null = null;
  isLoading: boolean = true;
  currency: string = 'USD';
  expenseEvents: any[] = [];
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  canRead: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "EXPENSES";

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private expenseService: ExpenseService,
    private messageService: MessageService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    // Load token first
    this.expenseService.loadToken();
    
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.expenseId = +params['id'];
      if (!this.expenseId || isNaN(this.expenseId)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_expense_id'),
          life: 3000
        });
        this.router.navigate(['/finance/expenses']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadExpense();
    });
  }

  async loadExpense(): Promise<void> {
    try {
      // Ensure token is loaded
      this.expenseService.loadToken();
      
      const response = await firstValueFrom(this.expenseService.getExpense(this.expenseId));
      console.log('Expense API response:', response);
      
      // Handle different response formats
      if (Array.isArray(response)) {
        this.expense = response[0] as Expense;
      } else if (response && typeof response === 'object') {
        this.expense = response as Expense;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.expense || !this.expense.id) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('expense_not_found'),
          life: 3000
        });
        this.router.navigate(['/finance/expenses']);
        return;
      }

      this.generateExpenseEvents();
      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading expense:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_expense') || 'Error loading expense',
        life: 3000
      });
      this.isLoading = false;
    }
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id;
    await this.permissionService.init(userId).toPromise();
    this.canEdit = this.permissionService.canUpdate(this.Ressource);
    this.canDelete = this.permissionService.canDelete(this.Ressource);
    this.canRead = this.permissionService.canRead(this.Ressource);
  }

  async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  goBack(): void {
    this.location.back();
  }

  generateExpenseEvents() {
    if (!this.expense) return;
    
    this.expenseEvents = [
      {
        status: 'Recorded',
        date: this.expense?.creationDate,
        icon: 'pi pi-plus-circle',
        button: 'Submit for Approval'
      },
      {
        status: 'Pending',
        date: this.expense?.submissionDate,
        icon: 'pi pi-clock',
        button: 'Approve Expense'
      },
      {
        status: 'Approved',
        date: this.expense?.approvalDate,
        icon: 'pi pi-check-circle',
        button: 'Mark as Reimbursed'
      },
      {
        status: 'Reimbursed',
        date: this.expense?.reimbursementDate,
        icon: 'pi pi-flag-fill',
        button: null
      }
    ].filter(event => event.date != null || event.status === 'Recorded');
  }

  getExpenseStatusSeverity(status: string): string {
    const severityMap: { [key: string]: string } = {
      'Recorded': 'info',
      'Pending': 'warning',
      'Approved': 'success',
      'Reimbursed': 'help',
      'Rejected': 'danger'
    };
    return severityMap[status] || 'info';
  }

  getExpenseStatusSeverityTag(status: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const severityMap: { [key: string]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined } = {
      'Recorded': 'info',
      'Pending': 'warn',
      'Approved': 'success',
      'Reimbursed': 'secondary',
      'Rejected': 'danger'
    };
    return severityMap[status] || 'info';
  }

  getExpenseStatusIcon(status: string): string {
    const iconMap: { [key: string]: string } = {
      'Recorded': 'pi pi-plus-circle',
      'Pending': 'pi pi-clock',
      'Approved': 'pi pi-check-circle',
      'Reimbursed': 'pi pi-flag-fill',
      'Rejected': 'pi pi-times-circle'
    };
    return iconMap[status] || 'pi pi-question-circle';
  }

  getPaymentMethodSeverity(method: string): string {
    return getPaymentMethodSeverity(method);
  }

  getPaymentMethodIcon(method: string): string {
    return getPaymentMethodIcon(method);
  }

  getPaymentMethodSeverityTag(method: string): 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined {
    const severityMap: { [key: string]: 'success' | 'secondary' | 'info' | 'warn' | 'danger' | 'contrast' | undefined } = {
      'Cash': 'success',
      'Card': 'info',
      'Transfer': 'secondary',
      'Check': 'warn',
      'BOE': 'contrast'
    };
    return severityMap[method] || 'secondary';
  }

  isCurrentStatus(status: string): boolean {
    return this.expense?.status?.toLowerCase() === status?.toLowerCase();
  }

  getTimelineDetails(status: string): boolean {
    if (status === 'Approved' && this.expense?.approvedBy) return true;
    if (status === 'Reimbursed' && this.expense?.reimbursedBy) return true;
    return false;
  }

  hasExpensePaymentMethodDetails(): boolean {
    return !!(this.expense?.checkNumber || this.expense?.boeNumber ||
      this.expense?.checkExpirationDate ||
      this.expense?.boeExpirationDate);
  }

  previewReceipt(receiptUrl: string): void {
    if (!receiptUrl) return;
    window.open(receiptUrl, '_blank');
  }

  printExpenseReceipt(expense: any): void {
    console.log('Print expense receipt:', expense);
    // Implement print functionality
  }

  exportExpenseToPDF(expense: any): void {
    console.log('Export expense to PDF:', expense);
    // Implement PDF export functionality
  }

  uploadReceipt(expense: any): void {
    console.log('Upload receipt for expense:', expense);
    // Implement upload functionality
  }

  duplicateExpense(expense: any): void {
    console.log('Duplicate expense:', expense);
    // Implement duplicate functionality
  }
}

