import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, LazyLoadEvent } from 'primeng/api';
import { AuditLog, AuditLogFilters, AuditLogResponse } from 'src/app/models/audit-log';
import { AuditLogService } from 'src/app/services/audit-log.service';
import { Subscription } from 'rxjs';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  selector: 'app-audit-log-table',
  templateUrl: './audit-log-table.component.html',
  styleUrls: ['./audit-log-table.component.css']
})
export class AuditLogTableComponent implements OnInit, OnChanges, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  @Input() userId?: string;
  @Input() showFilters: boolean = true;
  @Input() initialFilters?: AuditLogFilters;

  auditLogs: AuditLog[] = [];
  loading: boolean = false;
  totalRecords: number = 0;
  
  private subscription?: Subscription;
  private langChangeSub?: Subscription;
  private lastUserId?: string;

  // Filters
  filters: AuditLogFilters = {
    page: 0,
    size: 20,
    sortBy: 'timestamp',
    sortDir: 'DESC'
  };

  // Filter UI state
  showFilterPanel: boolean = false;
  selectedActionTypes: string[] = [];
  selectedResourceTypes: string[] = [];
  selectedSuccessStatus: boolean | null = null;
  startDate: Date | null = null;
  endDate: Date | null = null;
  searchText: string = '';

  // Action types for filter - using translated labels
  actionTypes: any[] = [];

  resourceTypes: any[] = [];
  
  private initializeResourceTypes(): void {
    const resourceTypeValues = [
      'PRODUCT', 'ORDER', 'CUSTOMER', 'PURCHASE', 'PAYMENT', 'WAREHOUSE', 'SHOP',
      'SUPPLIER', 'CATEGORY', 'EXPENSE', 'REFUND', 'ORDER_RETURN', 'PURCHASE_RETURN',
      'WRITE_OFF', 'STOCK_MOVEMENT', 'WAREHOUSE_TRANSFER', 'CUSTOMER_CREDIT',
      'FINANCIAL_DOCUMENT', 'INVOICE', 'QUOTE', 'DELIVERY_NOTE', 'CREDIT_NOTE',
      'RECEIPT', 'PROFORMA_INVOICE', 'AUTHENTICATION', 'AUTHORIZATION', 'RATE_LIMIT',
      'REPORT', 'ANALYSIS', 'METRICS', 'CONFIGURATION', 'EMAIL_CONFIG', 'NOTIFICATION',
      'POS', 'CASH_REGISTER', 'BANK_ACCOUNT', 'FILE', 'ORGANIZATION', 'BARCODE'
    ];
    
    this.resourceTypes = resourceTypeValues.map(value => ({
      label: this.getResourceTypeLabel(value),
      value: value
    })).sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Same labels as table status column: translate keys `all`, `success`, `failed` */
  successStatusOptions: { label: string; value: boolean | null }[] = [];

  selectedLog: AuditLog | null = null;
  showDetailDialog: boolean = false;

  constructor(
    private auditLogService: AuditLogService,
    private translate: TranslateService,
    private messageService: MessageService,
    public pageSizeService: TablePageSizeService
  ) {}

  ngOnInit(): void {
    this.filters.size = this.pageSizeService.get(TablePageSizeKeys.auditLog, [10, 20, 50, 100], this.filters.size);
    // Initialize filters
    if (this.userId) {
      this.filters.userId = this.userId;
      this.lastUserId = this.userId;
    }
    if (this.initialFilters) {
      this.filters = { ...this.filters, ...this.initialFilters };
    }
    
    // Initialize action types, resource types, and status filter (same i18n as table)
    this.initializeActionTypes();
    this.initializeResourceTypes();
    this.initializeSuccessStatusOptions();

    this.langChangeSub = this.translate.onLangChange.subscribe(() => {
      this.initializeActionTypes();
      this.initializeResourceTypes();
      this.initializeSuccessStatusOptions();
    });
  }

  private initializeSuccessStatusOptions(): void {
    this.successStatusOptions = [
      { label: this.translate.instant('all'), value: null },
      { label: this.translate.instant('success'), value: true },
      { label: this.translate.instant('failed'), value: false }
    ];
  }
  
  private initializeActionTypes(): void {
    const actionTypeValues = [
      'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE', 'PRODUCT_VIEW',
      'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_DELETE', 'ORDER_VIEW', 'ORDER_CANCEL',
      'CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE', 'CUSTOMER_VIEW',
      'PURCHASE_CREATE', 'PURCHASE_UPDATE', 'PURCHASE_DELETE', 'PURCHASE_VIEW',
      'PAYMENT_CREATE', 'PAYMENT_UPDATE', 'PAYMENT_DELETE', 'PAYMENT_VIEW',
      'WAREHOUSE_CREATE', 'WAREHOUSE_UPDATE', 'WAREHOUSE_DELETE', 'WAREHOUSE_VIEW',
      'SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'SUPPLIER_DELETE', 'SUPPLIER_VIEW',
      'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE', 'CATEGORY_VIEW',
      'EXPENSE_CREATE', 'EXPENSE_UPDATE', 'EXPENSE_DELETE', 'EXPENSE_VIEW',
      'REFUND_CREATE', 'REFUND_UPDATE', 'REFUND_DELETE', 'REFUND_VIEW',
      'USER_LOGIN', 'USER_LOGOUT', 'AUTHENTICATION_FAILURE',
      'AUTHENTICATION', 'AUTHORIZATION', 'RATE_LIMIT',
      'DATA_IMPORT', 'DATA_EXPORT', 'REPORT_GENERATE', 'REPORT_VIEW'
    ];
    
    this.actionTypes = actionTypeValues.map(value => ({
      label: this.getActionTypeLabel(value),
      value: value
    })).sort((a, b) => a.label.localeCompare(b.label));
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Only update userId if it actually changed
    if (changes['userId'] && !changes['userId'].firstChange) {
      const newUserId = changes['userId'].currentValue;
      if (newUserId !== this.lastUserId) {
        this.lastUserId = newUserId;
        if (newUserId) {
          this.filters.userId = newUserId;
        } else {
          delete this.filters.userId;
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    this.langChangeSub?.unsubscribe();
  }

  onLazyLoad(event: LazyLoadEvent): void {
    this.pageSizeService.onPage(TablePageSizeKeys.auditLog, [10, 20, 50, 100], event);
    // Unsubscribe from previous request if still in flight
    if (this.subscription) {
      this.subscription.unsubscribe();
    }

    this.loading = true;
    
    // Update filters from UI and event
    this.updateFiltersFromUI(event);
    
    // Create a copy of filters to avoid mutation issues
    const filtersToUse: AuditLogFilters = {
      ...this.filters
    };

    this.auditLogService.getAuditLogs(filtersToUse).then(observable => {
      this.subscription = observable.subscribe({
        next: (response: AuditLogResponse) => {
          this.auditLogs = response.content || [];
          this.totalRecords = response.totalElements || 0;
          this.loading = false;
        },
        error: (error: any) => {
          console.error('Error loading audit logs:', error);
          
          // Check if error is due to server unavailability
          const isServerUnavailable = this.isServerUnavailable(error);
          
          if (isServerUnavailable) {
            // Don't show error message for server unavailability (handled by interceptor/banner)
            // Just stop loading
            this.loading = false;
            return;
          }
          
          // For other errors, show error message
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_audit_logs'),
            life: 3000
          });
          this.loading = false;
        }
      });
    }).catch((error: any) => {
      console.error('Error loading audit logs:', error);
      
      // Check if error is due to server unavailability
      const isServerUnavailable = this.isServerUnavailable(error);
      
      if (isServerUnavailable) {
        // Don't show error message for server unavailability (handled by interceptor/banner)
        // Just stop loading
        this.loading = false;
        return;
      }
      
      // For other errors, show error message
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_audit_logs'),
        life: 3000
      });
      this.loading = false;
    });
  }

  updateFiltersFromUI(event?: LazyLoadEvent): void {
    // Update userId filter
    if (this.userId) {
      this.filters.userId = this.userId;
    } else if (this.filters.userId && !this.userId) {
      delete this.filters.userId;
    }
    
    // Update action type filter
    if (this.selectedActionTypes.length > 0) {
      this.filters.actionType = this.selectedActionTypes[0];
    } else {
      delete this.filters.actionType;
    }
    
    // Update resource type filter
    if (this.selectedResourceTypes.length > 0) {
      this.filters.resourceType = this.selectedResourceTypes[0];
    } else {
      delete this.filters.resourceType;
    }
    
    // Update success status filter
    if (this.selectedSuccessStatus !== null && this.selectedSuccessStatus !== undefined) {
      this.filters.success = this.selectedSuccessStatus;
    } else {
      delete this.filters.success;
    }
    
    // Update date filters
    if (this.startDate) {
      this.filters.startDate = this.formatDate(this.startDate);
    } else {
      delete this.filters.startDate;
    }
    if (this.endDate) {
      this.filters.endDate = this.formatDate(this.endDate);
    } else {
      delete this.filters.endDate;
    }
    
    // Update pagination from event
    if (event) {
      this.filters.page = event.first ? Math.floor(event.first / (event.rows || 20)) : 0;
      this.filters.size = event.rows || 20;
      
      // Update sorting
      if (event.sortField) {
        this.filters.sortBy = event.sortField;
        this.filters.sortDir = event.sortOrder === 1 ? 'ASC' : 'DESC';
      }
    }
    
    // Ensure default sort
    if (!this.filters.sortBy) {
      this.filters.sortBy = 'timestamp';
    }
    if (!this.filters.sortDir) {
      this.filters.sortDir = 'DESC';
    }
  }

  formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  applyFilters(): void {
    // Trigger lazy load with first page
    this.onLazyLoad({
      first: 0,
      rows: this.filters.size || 20,
      sortField: this.filters.sortBy || 'timestamp',
      sortOrder: this.filters.sortDir === 'ASC' ? 1 : -1
    });
  }

  clearFilters(): void {
    this.selectedActionTypes = [];
    this.selectedResourceTypes = [];
    this.selectedSuccessStatus = null;
    this.startDate = null;
    this.endDate = null;
    this.searchText = '';
    // Trigger lazy load with cleared filters
    this.onLazyLoad({
      first: 0,
      rows: this.filters.size || 20,
      sortField: this.filters.sortBy || 'timestamp',
      sortOrder: this.filters.sortDir === 'ASC' ? 1 : -1
    });
  }

  viewDetails(log: AuditLog): void {
    this.selectedLog = log;
    this.showDetailDialog = true;
  }

  closeDetailDialog(): void {
    this.showDetailDialog = false;
    this.selectedLog = null;
  }

  getActionTypeLabel(actionType: string): string {
    const key = `audit_action_${actionType.toLowerCase()}`;
    const translated = this.translate.instant(key);
    // If translation exists, use it; otherwise format the enum name nicely
    if (translated !== key) {
      return translated;
    }
    // Fallback: convert PRODUCT_CREATE to "Product Create"
    return actionType
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }

  getResourceTypeLabel(resourceType: string): string {
    const key = `audit_resource_${resourceType.toLowerCase()}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : resourceType;
  }

  /**
   * Translate an action description like "Updated product 'Sucre cafe'" into the
   * current locale by translating the verb and entity parts while keeping the
   * resource name (in quotes) as-is.
   */
  translateDescription(description: string): string {
    if (!description) return description;

    // Extract the resource name in quotes (if present) and strip it from the working text
    let resourceRef = '';
    const quoteMatch = description.match(/'([^']+)'$/);
    if (quoteMatch) {
      resourceRef = quoteMatch[0]; // includes quotes, e.g. "'Sucre cafe'"
    }
    let text = quoteMatch ? description.substring(0, description.indexOf("'")).trim() : description.trim();

    // Try to match known verb prefixes (longest first to match "Created new" before "Created")
    const verbPrefixes = [
      'Created new', 'Bulk generated', 'Auto-generated',
      'Updated', 'Deleted', 'Confirmed', 'Cancelled', 'Deactivated', 'Reactivated',
      'Adjusted', 'Opened', 'Closed', 'Started', 'Ended', 'Completed', 'Held',
      'Resumed', 'Processed', 'Generated', 'Issued', 'Approved', 'Rejected',
      'Triggered', 'Enabled', 'Disabled', 'Sent', 'Imported', 'Recorded',
      'Reconciled', 'Reversed', 'Recalculated', 'Added', 'Deposited', 'Withdrew',
      'Set', 'Cleared', 'Uploaded', 'Printed', 'Removed'
    ];

    let translatedVerb = '';
    let entityPart = text;

    for (const prefix of verbPrefixes) {
      if (text.startsWith(prefix)) {
        const verbKey = 'audit_verb_' + prefix.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
        const translated = this.translate.instant(verbKey);
        translatedVerb = translated !== verbKey ? translated : prefix;
        entityPart = text.substring(prefix.length).trim();
        break;
      }
    }

    if (!translatedVerb) {
      // No verb matched - return original
      return description;
    }

    // Translate the entity part
    let translatedEntity = entityPart;
    if (entityPart) {
      const entityKey = 'audit_entity_' + entityPart.toLowerCase().replace(/ /g, '_').replace(/-/g, '_');
      const translated = this.translate.instant(entityKey);
      translatedEntity = translated !== entityKey ? translated : entityPart;
    }

    // Reassemble
    let result = translatedVerb;
    if (translatedEntity) {
      result += ' ' + translatedEntity;
    }
    if (resourceRef) {
      result += ' ' + resourceRef;
    }
    return result;
  }

  translateResponseSummary(summary: string): string {
    if (!summary) return summary;
    if (summary.startsWith('Action completed successfully')) {
      return this.translate.instant('audit_response_success');
    }
    if (summary.startsWith('Action failed')) {
      return this.translate.instant('audit_response_failed');
    }
    return summary;
  }

  getStatusSeverity(success: boolean): string {
    return success ? 'success' : 'danger';
  }

  getStatusIcon(success: boolean): string {
    return success ? 'pi pi-check-circle' : 'pi pi-times-circle';
  }

  getStatusLabel(success: boolean): string {
    return success ? this.translate.instant('success') : this.translate.instant('failed');
  }

  formatTimestamp(timestamp: string): string {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString(this.translate.currentLang || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  navigateToResource(log: AuditLog): void {
    if (!log.resourceType || !log.resourceId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('resource_not_available'),
        life: 3000
      });
      return;
    }

    // Navigate based on resource type
    const routes: { [key: string]: string } = {
      'PRODUCT': '/inventory/products',
      'ORDER': '/sales/orders',
      'CUSTOMER': '/sales/customers',
      'PAYMENT': '/finance/payments'
    };

    const route = routes[log.resourceType];
    if (route) {
      // In a real implementation, you'd use Router to navigate
      // For now, we'll just show a message
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: this.translate.instant('navigate_to_resource_message').replace('{0}', log.resourceType),
        life: 3000
      });
    }
  }

  copyDetails(log: AuditLog): void {
    const details = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(details).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('details_copied'),
        life: 2000
      });
    }).catch(() => {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_copying_details'),
        life: 3000
      });
    });
  }

  filterBySearch(): void {
    // Trigger filter application
    this.applyFilters();
  }

  private isServerUnavailable(error: any): boolean {
    // Check for network errors (status 0) or server errors (5xx, excluding 503 which is maintenance)
    if (error?.status === 0) {
      return true; // Network error, server unreachable
    }
    if (error?.status === 503) {
      return false; // Maintenance mode, handled separately
    }
    if (error?.status >= 500 && error?.status <= 504) {
      return true; // Server errors indicate unavailability
    }
    return false;
  }
}
