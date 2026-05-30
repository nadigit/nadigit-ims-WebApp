import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { MenuItem, ConfirmationService } from 'primeng/api';
import { LayoutService } from "./service/app.layout.service";
import { KeycloakService } from 'keycloak-angular';
import { NotificationService } from '../services/notification.service';
import { Notification } from '../models/notification';
import moment from 'moment';
import { KeycloakProfile } from 'keycloak-js';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from '../services/translation.service';
import { Router } from '@angular/router';
import { TieredMenu } from 'primeng/tieredmenu';
import { MessageService } from 'primeng/api';
import { AppConfigurationService } from '../services/app-configuration.service';
import { ActionReminderService } from '../services/action-reminder.service';


@Component({
  selector: 'app-topbar',
  templateUrl: './app.topbar.component.html',
  styleUrl: './app.topbar.component.css',
  providers: [ConfirmationService]
})
export class AppTopBarComponent implements OnInit {
  @ViewChild('notificationMenu') notificationMenu!: TieredMenu;

  items!: MenuItem[];

  notificationVisible: boolean = false;
  notifications: Notification[] = [];
  recentNotifications: Notification[] = [];
  olderNotifications: Notification[] = [];
  recentPage: number = 0;
  notificationsPage: number = 0;
  pageSize: number = 10;
  loadMoreVisible: boolean = true;
  displayedNotificationIds: Set<number> = new Set<number>();
  profile: KeycloakProfile;

  notificationMenuItems: MenuItem[] = [];

  notificationFilters = [
    { type: 'all', label: 'all', active: true },
    { type: 'unread', label: 'unread', active: false },
    { type: 'priority', label: 'priority', active: false },
    { type: 'system', label: 'system', active: false },
    { type: 'inventory', label: 'inventory', active: false },
    { type: 'orders', label: 'orders', active: false },
    { type: 'financial', label: 'financial', active: false }
  ];

  activeFilter = 'all';
  totalUnreadCount = 0;
  loadingMore = false;
  hasMoreNotifications = true;
  selectedNotification: any = null;
  notificationDialogVisible = false;
  searchTerm: string = '';
  filteredRecentNotifications: Notification[] = [];
  filteredOlderNotifications: Notification[] = [];
  filteredPriorityNotifications: Notification[] = [];
  currency: string = '';

  // Permissions
  isAdminUser: boolean = false;
  adminActionReminderCount = 0;

  @ViewChild('menubutton') menuButton!: ElementRef;

  @ViewChild('topbarmenubutton') topbarMenuButton!: ElementRef;

  @ViewChild('topbarmenu') menu!: ElementRef;

  constructor(public layoutService: LayoutService,
    public keycloakService: KeycloakService,
    private notificationService: NotificationService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private confirmationService: ConfirmationService,
    private configService: AppConfigurationService,
    private actionReminderService: ActionReminderService,
    private router: Router) {

  }
  async ngOnInit(): Promise<void> {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.setupMenu(translations);
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.profile = await this.keycloakService.loadUserProfile();
    console.log(this.profile)

    // Determine if current user is admin (can see all notifications)
    const roles = await this.keycloakService.getUserRoles();
    this.isAdminUser = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
    console.log('Topbar user roles:', roles, 'isAdminUser:', this.isAdminUser);
    if (this.isAdminUser) {
      this.loadAdminActionRemindersCount();
    }
    // this.items = [
    //     {
    //         label: 'Settings',
    //         icon: 'pi pi-fw pi-wrench',
    //         routerLink: '/pages/profile'
    //     },
    //     {
    //         label: 'Logout',
    //         icon: 'pi pi-fw pi-power-off',
    //         command: () => this.logOut()
    //     },
    // ];
    this.loadRecentNotifications();
    this.loadNotificationSummary();
    // Initialize filtered arrays
    this.filteredRecentNotifications = [];
    this.filteredOlderNotifications = [];
    this.filteredPriorityNotifications = [];
  }

  loadAdminActionRemindersCount() {
    this.actionReminderService.getAdminActionReminders().subscribe({
      next: (response) => {
        const items = response?.items || [];
        this.adminActionReminderCount = items.reduce((sum, item) => sum + (item.count || 0), 0);
      },
      error: () => {
        this.adminActionReminderCount = 0;
      }
    });
  }

  setupMenu(translations: any) {
    this.items = [
      {
        label: translations['my_account'],
        icon: 'pi pi-fw pi-user-edit',
        routerLink: '/profile'
      },
      {
        label: translations['logout'],
        icon: 'pi pi-fw pi-power-off',
        command: () => this.logOut()
      },
    ];
  }

  // showNotifications() {
  //   console.log("clicked");
  //   const notificationCount = this.recentNotifications?.length ?? 0;
  //   console.log(notificationCount);
  //   this.notificationVisible = !this.notificationVisible;
  // }

  showNotifications() {
    this.notificationVisible = true;
    this.loadNotificationSummary();
    this.filterNotifications(); // Apply filters when opening

    // If there is nothing to show yet but more pages are available,
    // automatically load older notifications to avoid an empty sidebar.
    if (!this.hasFilteredNotifications && this.hasMoreNotifications) {
      this.loadMoreNotifications();
    }
  }

  onNotificationsHide() {
    // Reset filters when sidebar closes
    this.activeFilter = 'all';
    this.notificationFilters.forEach(filter => filter.active = filter.type === 'all');
  }

  loadNotificationSummary() {
    this.notificationService.getNotificationSummary().subscribe(
      (summary: any) => {
        this.totalUnreadCount = summary.totalUnread || 0;
        this.updateFilterCounts(summary);
        console.log('Notification summary loaded:', summary);
      },
      (error: any) => {
        console.error('Error loading notification summary:', error);
        // Fallback to calculating from current notifications
        this.calculateUnreadCount();
      }
    );
  }

  private calculateUnreadCount() {
    this.totalUnreadCount = this.recentNotifications.filter(n => !n.read).length +
      this.olderNotifications.filter(n => !n.read).length;
  }

  private updateFilterCountsAfterRead() {
    const unreadFilter = this.notificationFilters.find(f => f.type === 'unread');
    if (unreadFilter) {
      unreadFilter['count'] = Math.max(0, unreadFilter['count'] - 1);
    }
  }

  private updateAllFilterCounts() {
    this.notificationFilters.forEach(filter => {
      if (filter.type === 'unread') {
        filter['count'] = 0;
      }
    });
  }

  updateFilterCounts(summary: any) {
    this.notificationFilters.forEach(filter => {
      filter['count'] = summary[filter.type] || 0;
    });
  }

  getFilterCount(filterType: string): number {
    const filter = this.notificationFilters.find(f => f.type === filterType);
    return filter?.['count'] || 0;
  }

  toggleFilter(filterType: string) {
    this.activeFilter = filterType;
    this.notificationFilters.forEach(filter => {
      filter.active = filter.type === filterType;
    });
    this.applyFilters();
  }

  applyFilters() {
    this.filterNotifications();
  }

  filterNotifications() {
    // Base collections
    let allRecent = [...this.recentNotifications];
    let allOlder = [...this.olderNotifications];

    // Non-admin users: restrict to stock-related notifications only
    if (!this.isAdminUser) {
      const stockTitles = ['product in low stock', 'product is out of stock', 'product expired', 'product expiring soon'];
      allRecent = allRecent.filter(n => stockTitles.includes(n.title));
      allOlder = allOlder.filter(n => stockTitles.includes(n.title));
    }

    // Update priority notifications first
    // Include expired products as high priority even if not explicitly marked
    const allPriority = [...allRecent, ...allOlder]
      .filter(n => {
        const isHighPriority = n.priority === 'high';
        const isExpired = n.title === 'product expired' || 
                         (n.title && n.title.toLowerCase().includes('expired'));
        return isHighPriority || isExpired;
      })
      .sort((a, b) => {
        // Sort expired products first, then by date
        const aExpired = a.title === 'product expired' || (a.title && a.title.toLowerCase().includes('expired'));
        const bExpired = b.title === 'product expired' || (b.title && b.title.toLowerCase().includes('expired'));
        if (aExpired && !bExpired) return -1;
        if (!aExpired && bExpired) return 1;
        return new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime();
      });

    let filteredRecent = [...allRecent];
    let filteredOlder = [...allOlder];
    let filteredPriority = [...allPriority];

    // Apply active filter
    if (this.activeFilter !== 'all') {
      filteredRecent = filteredRecent.filter(n => this.matchesFilter(n, this.activeFilter));
      filteredOlder = filteredOlder.filter(n => this.matchesFilter(n, this.activeFilter));
      filteredPriority = filteredPriority.filter(n => this.matchesFilter(n, this.activeFilter));
    }

    // Apply search term
    if (this.searchTerm && this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase().trim();
      filteredRecent = filteredRecent.filter(n => 
        this.getNotificationMessage(n).toLowerCase().includes(searchLower) ||
        this.getNotificationTitle(n).toLowerCase().includes(searchLower) ||
        (n.message && n.message.toLowerCase().includes(searchLower))
      );
      filteredOlder = filteredOlder.filter(n => 
        this.getNotificationMessage(n).toLowerCase().includes(searchLower) ||
        this.getNotificationTitle(n).toLowerCase().includes(searchLower) ||
        (n.message && n.message.toLowerCase().includes(searchLower))
      );
      filteredPriority = filteredPriority.filter(n => 
        this.getNotificationMessage(n).toLowerCase().includes(searchLower) ||
        this.getNotificationTitle(n).toLowerCase().includes(searchLower) ||
        (n.message && n.message.toLowerCase().includes(searchLower))
      );
    }

    this.filteredRecentNotifications = filteredRecent;
    this.filteredOlderNotifications = filteredOlder;
    this.filteredPriorityNotifications = filteredPriority;
  }

  matchesFilter(notification: any, filterType: string): boolean {
    switch (filterType) {
      case 'unread':
        return !notification.read;
      case 'priority':
        return notification.priority === 'high';
      case 'system':
        return notification.type === 'system';
      case 'inventory':
        // Include inventory type, category, and expiration-related notifications
        const isInventoryType = notification.type === 'inventory' || notification.category === 'inventory';
        const isExpirationNotification = notification.title === 'product expired' || 
                                        notification.title === 'product expiring soon' ||
                                        (notification.title && (
                                          notification.title.toLowerCase().includes('expired') ||
                                          notification.title.toLowerCase().includes('expiring')
                                        ));
        return isInventoryType || isExpirationNotification;
      case 'orders':
        return notification.type === 'order' || notification.category === 'orders';
      case 'financial':
        return notification.type === 'financial' || notification.category === 'financial';
      default:
        return true;
    }
  }

  onSearchChange() {
    this.filterNotifications();
  }

  clearSearch() {
    this.searchTerm = '';
    this.filterNotifications();
  }

  getNotificationBadgeClass(): string {
    if (this.totalUnreadCount === 0) return 'notification-badge hidden';
    if (this.hasPriorityNotifications) return 'notification-badge priority';
    return 'notification-badge';
  }

  getNotificationSummary(): string {
    if (this.totalUnreadCount === 0) return this.translate.instant('all_caught_up');
    return this.translate.instant('unread_notifications_count', { count: this.totalUnreadCount });
  }

  getNotificationIcon(notification: any): string {
    // Handle expiration-related notifications
    if (notification.title === 'product expired' || 
        (notification.title && notification.title.toLowerCase().includes('expired'))) {
      return 'pi pi-exclamation-triangle';
    }
    if (notification.title === 'product expiring soon' || 
        (notification.title && notification.title.toLowerCase().includes('expiring'))) {
      return 'pi pi-clock';
    }

    const iconMap: { [key: string]: string } = {
      'inventory': 'pi pi-box',
      'order': 'pi pi-shopping-cart',
      'financial': 'pi pi-dollar',
      'system': 'pi pi-cog',
      'user': 'pi pi-user',
      'alert': 'pi pi-exclamation-triangle',
      'success': 'pi pi-check-circle',
      'warning': 'pi pi-exclamation-circle',
      'info': 'pi pi-info-circle'
    };

    return iconMap[notification.type] || iconMap[notification.severity] || 'pi pi-bell';
  }

  getNotificationIconClass(notification: any): string {
    // Handle expiration-related notifications
    if (notification.title === 'product expired' || 
        (notification.title && notification.title.toLowerCase().includes('expired'))) {
      return 'notification-icon-error';
    }
    if (notification.title === 'product expiring soon' || 
        (notification.title && notification.title.toLowerCase().includes('expiring'))) {
      return 'notification-icon-warning';
    }

    const classMap: { [key: string]: string } = {
      'high': 'notification-icon-high',
      'medium': 'notification-icon-medium',
      'low': 'notification-icon-low',
      'success': 'notification-icon-success',
      'warning': 'notification-icon-warning',
      'error': 'notification-icon-error',
      'info': 'notification-icon-info'
    };

    return classMap[notification.priority] || classMap[notification.severity] || 'notification-icon-default';
  }

  getNotificationTitle(notification: any): string {
    const titleMap: { [key: string]: string } = {
      'product in low stock': 'low_stock_alert',
      'product is out of stock': 'out_of_stock_alert',
      'product expired': 'product_expired_notification',
      'product expiring soon': 'product_expiring_soon_notification',
      'order created': 'new_order_received',
      'payment received': 'payment_received',
      'purchase created': 'purchase_created',
      'session opened': 'session_opened',
      'session closed': 'session_closed',
      'system update': 'system_update',
      'inventory audit': 'inventory_audit',
      'write-off created': 'write_off_created_notification',
      'write-off approved': 'write_off_approved_notification',
      'write-off rejected': 'write_off_rejected_notification',
      'credit account created': 'credit_account_created_notification'
    };

    // Also check for case-insensitive matching and partial matches
    if (notification.title) {
      const titleLower = notification.title.toLowerCase();
      if (titleLower.includes('expired') && !titleMap[notification.title]) {
        return 'product_expired_notification';
      }
      if (titleLower.includes('expiring') && !titleMap[notification.title]) {
        return 'product_expiring_soon_notification';
      }
      if (titleLower.includes('write-off') || titleLower.includes('writeoff')) {
        if (titleLower.includes('created')) {
          return 'write_off_created_notification';
        }
        if (titleLower.includes('approved')) {
          return 'write_off_approved_notification';
        }
        if (titleLower.includes('rejected')) {
          return 'write_off_rejected_notification';
        }
      }
      if (titleLower.includes('credit account')) {
        if (titleLower.includes('created')) {
          return 'credit_account_created_notification';
        }
      }
    }

    return titleMap[notification.title] || notification.title;
  }

  getNotificationCategoryKey(notification: any): string {
    if (!notification?.category) {
      return '';
    }
    const raw = String(notification.category).toLowerCase();

    const map: { [key: string]: string } = {
      'inventory': 'inventory',
      'orders': 'orders',
      'order': 'orders',
      'financial': 'financial',
      'finance': 'financial',
      'system': 'system',
      'session': 'sessions',
      'sessions': 'sessions',
      'cash': 'financial',
      'cash_register': 'financial'
    };

    return map[raw] || raw;
  }

  getNotificationMessage(notification: any): string {
    // Handle expiration notifications
    if (notification.title === 'product expired' || 
        (notification.title && notification.title.toLowerCase().includes('expired'))) {
      // Try to extract product name from the raw backend message in a locale-agnostic way
      let productName =
        notification.message?.match(/\(([^)]+)\)/)?.[1] ||            // text in parentheses
        notification.message?.match(/'([^']+)'/)?.[1] ||              // text in single quotes
        notification.message?.split(' - ')?.[0] ||
        notification.message?.split(/has expired|a expiré|ha expirado/i)?.[0] ||
        '';

      // Fallback if we couldn't extract a meaningful name (or got a template placeholder like "{product}")
      if (!productName || productName.includes('{')) {
        productName = this.translate.instant('product') || 'Product';
      }

      return this.translate.instant('product_x_has_expired', { product: productName });
    }
    
    if (notification.title === 'product expiring soon' || 
        (notification.title && notification.title.toLowerCase().includes('expiring'))) {
      const productName = notification.message?.match(/\(([^)]+)\)/)?.[1] || 
                         notification.message?.split(' - ')?.[0] ||
                         notification.message?.split(' is expiring')?.[0] ||
                         'Product';
      const daysMatch = notification.message?.match(/(\d+)\s*days?/i);
      const days = daysMatch ? daysMatch[1] : '7';
      return this.translate.instant('product_x_expiring_soon_days', { product: productName, days: days });
    }

    // Handle product stock notifications
    if (['product in low stock', 'product is out of stock'].includes(notification.title)) {
      const productName = notification.message?.match(/\(([^)]+)\)/)?.[1];
      return this.translate.instant(
        notification.title === 'product in low stock' ?
          'product_x_is_running_low' :
          'product_x_is_out_of_stock',
        { product: productName }
      );
    }

    // Handle purchase created notification
    if (notification.title === 'purchase created') {
      // Extract dynamic fields from backend message.
      // We are lenient on currency so we can re-render it using the configured system currency.
      const regex = /Purchase\s+(.+)\s+created successfully\. Amount:\s*([^\s,]+)[^,]*,\s*Items:\s*(\d+),\s*Supplier:\s*(.+)/i;
      const matches = notification.message?.match(regex);
      if (matches) {
        const [_, reference, rawAmount, itemCount, supplier] = matches;
        const amount = rawAmount.replace(/[^0-9.,-]/g, '');
        return this.translate.instant(
          'purchase_x_created_successfully',
          {
            reference,
            amount,
            itemCount,
            supplier,
            currency: this.currency
          }
        );
      }
    }

    // Handle new order notification (sales order)
    if (notification.title === 'order created') {
      // Example backend message (for reference):
      // "Order SO-001 created successfully. Amount: 1500, Items: 5, Customer: ACME Corp"
      const regex = /Order\s+(.+)\s+created successfully\. Amount:\s*([^\s,]+)[^,]*,\s*Items:\s*(\d+),\s*Customer:\s*(.+)/i;
      const matches = notification.message?.match(regex);
      if (matches) {
        const [_, reference, rawAmount, itemCount, customer] = matches;
        const amount = rawAmount.replace(/[^0-9.,-]/g, '');
        return this.translate.instant(
          'order_x_created_successfully',
          {
            reference,
            amount,
            itemCount,
            customer,
            currency: this.currency
          }
        );
      }
    }

    // Handle cash register session opened notification
    if (notification.title === 'session opened') {
      // Example backend message:
      // "Session 1 opened at 25-11-2025 21:25:00 by admin. Opening amount: $200.00"
      const regex = /Session\s+(\d+)\s+opened at\s+(.+?)\s+by\s+(.+?)\. Opening amount:\s*([^\s,]+)[^,]*/i;
      const matches = notification.message?.match(regex);
      if (matches) {
        const [_, sessionNumber, dateTime, user, rawAmount] = matches;
        const amount = rawAmount.replace(/[^0-9.,-]/g, '');
        return this.translate.instant(
          'session_x_opened_message',
          {
            sessionNumber,
            dateTime,
            user,
            amount,
            currency: this.currency
          }
        );
      }
    }

    // Handle cash register session closed notification
    if (notification.title === 'session closed') {
      // Example backend message (hypothetical):
      // "Session 1 closed at 25-11-2025 22:15:00 by admin. Closing amount: $220.00"
      const regex = /Session\s+(\d+)\s+closed at\s+(.+?)\s+by\s+(.+?)\. Closing amount:\s*([^\s,]+)[^,]*/i;
      const matches = notification.message?.match(regex);
      if (matches) {
        const [_, sessionNumber, dateTime, user, rawAmount] = matches;
        const amount = rawAmount.replace(/[^0-9.,-]/g, '');
        return this.translate.instant(
          'session_x_closed_message',
          {
            sessionNumber,
            dateTime,
            user,
            amount,
            currency: this.currency
          }
        );
      }
    }

    // Handle credit account created notification
    if (notification.title === 'credit account created' || 
        (notification.title && notification.title.toLowerCase().includes('credit account'))) {
      // Backend format: "Credit account created for customer: mohamed zarioh"
      // Try multiple regex patterns to handle variations
      let customerName = 'Customer';
      const message = notification.message || '';
      
      // Pattern 1: "Credit account created for customer: name"
      let regex = /Credit account created for customer:\s*(.+)/i;
      let matches = message.match(regex);
      if (matches && matches[1]) {
        customerName = matches[1].trim();
      } else {
        // Pattern 2: "Credit account created for customer:name" (no space after colon)
        regex = /Credit account created for customer:?\s*(.+)/i;
        matches = message.match(regex);
        if (matches && matches[1]) {
          customerName = matches[1].trim();
        } else {
          // Pattern 3: Try to extract anything after "customer:"
          regex = /customer:?\s*(.+)/i;
          matches = message.match(regex);
          if (matches && matches[1]) {
            customerName = matches[1].trim();
          }
        }
      }
      
      return this.translate.instant(
        'credit_account_created_for_customer',
        { customer: customerName }
      );
    }

    // Handle write-off created notification
    const titleLower = notification.title?.toLowerCase() || '';
    if (titleLower.includes('write-off') || titleLower.includes('writeoff')) {
      if (titleLower.includes('created')) {
        // Backend format: "Write-off WOF-2026-00001 created for 5 units of Product Name (Condition: DAMAGED, Cost: $100.00). Pending approval."
        const regex = /Write-off\s+([A-Z0-9-]+)\s+created for\s+(\d+)\s+units? of\s+(.+?)\s+\(Condition:\s*(.+?),\s*Cost:\s*\$([0-9.]+)[^)]*\)\.\s*(.+)/i;
        const matches = notification.message?.match(regex);
        
        if (matches && matches.length >= 7) {
          const reference = matches[1] || 'N/A';
          const quantity = matches[2] || '0';
          const product = matches[3]?.trim() || 'Product';
          const condition = matches[4]?.trim() || 'N/A';
          const rawCost = matches[5] || '0';
          const status = matches[6]?.trim() || 'Pending approval';
          const cost = rawCost.replace(/[^0-9.,-]/g, '');
          
          return this.translate.instant(
            'write_off_created_notification_message',
            {
              reference,
              quantity,
              product,
              condition,
              cost,
              currency: this.currency || '',
              status
            }
          );
        }
      }
      
      if (titleLower.includes('approved')) {
        // Backend format: "Write-off WOF-2026-00001 for 5 units of Product Name (Cost: $100.00) has been approved by admin."
        const regex = /Write-off\s+([A-Z0-9-]+)\s+for\s+(\d+)\s+units? of\s+(.+?)\s+\(Cost:\s*\$([0-9.]+)[^)]*\)\s+has been approved by\s+(.+?)\./i;
        const matches = notification.message?.match(regex);
        
        if (matches && matches.length >= 6) {
          const reference = matches[1] || 'N/A';
          const quantity = matches[2] || '0';
          const product = matches[3]?.trim() || 'Product';
          const rawCost = matches[4] || '0';
          const approver = matches[5]?.trim() || 'System';
          const cost = rawCost.replace(/[^0-9.,-]/g, '');
          
          return this.translate.instant(
            'write_off_approved_notification_message',
            {
              reference,
              quantity,
              product,
              cost,
              currency: this.currency || '',
              approver
            }
          );
        }
      }
      
      if (titleLower.includes('rejected')) {
        // Backend format: "Write-off WOF-2026-00001 for Product Name has been rejected. Reason: Some reason" or "Write-off WOF-2026-00001 for Product Name has been rejected."
        const regex = /Write-off\s+([A-Z0-9-]+)\s+for\s+(.+?)\s+has been rejected\.(?:\s+Reason:\s+(.+))?/i;
        const matches = notification.message?.match(regex);
        
        if (matches && matches.length >= 2) {
          const reference = matches[1] || 'N/A';
          const product = matches[2]?.trim() || 'Product';
          const rejectionReason = matches[3]?.trim() || '';
          // Format reason with " Reason: " prefix if it exists
          const reason = rejectionReason ? ` Reason: ${rejectionReason}` : '';
          
          return this.translate.instant(
            'write_off_rejected_notification_message',
            {
              reference,
              product,
              reason
            }
          );
        }
      }
    }

    // Default fallback: API may send an i18n key or plain text
    const raw = notification.message;
    if (raw == null || raw === '') {
      return '';
    }
    return this.translate.instant(raw);
  }

  getRelativeTime(date: string): string {
    return moment(date).fromNow();
  }

  getPrioritySeverity(priority: string): string {
    const severityMap: { [key: string]: string } = {
      'high': 'danger',
      'medium': 'warning',
      'low': 'info'
    };
    return severityMap[priority] || 'info';
  }

  getSeverityTag(severity: string): string {
    const severityMap: { [key: string]: string } = {
      'ERROR': 'danger',
      'WARNING': 'warning',
      'INFO': 'info',
      'SUCCESS': 'success'
    };
    return severityMap[severity] || 'info';
  }

  getActionDescription(notification: any): string {
    const keyMap: { [key: string]: string } = {
      'product in low stock': 'action.navigate_to_products_review_stock',
      'product is out of stock': 'action.navigate_to_products_restock',
      'new order': 'action.navigate_to_orders_view_process',
      'payment received': 'action.navigate_to_payments_view',
      'purchase created': 'action.navigate_to_purchases_view'
    };

    const key = keyMap[notification?.title] || 'action.navigate_to_related_section';
    return this.translate.instant(key);
  }

  onNotificationDialogHide() {
    this.selectedNotification = null;
    this.notificationDialogVisible = false;
  }

  handleNotificationClick(notification: any) {
    // Mark as read
    if (!notification.read) {
      this.markAsRead(notification);
    }

    // Show details dialog
    this.viewNotificationDetails(notification);
  }

  // handleNotificationClick(notification: any) {
  //   // Mark as read
  //   if (!notification.read) {
  //     this.markAsRead(notification);
  //   }

  //   // Execute default action
  //   this.executeNotificationAction(notification);
  // }

  markAsRead(notification: any) {
    if (!notification.read && notification.notificationId) {
      this.notificationService.markAsRead(notification.notificationId).subscribe(
        () => {
          notification.read = true;
          this.totalUnreadCount--;
          this.updateFilterCountsAfterRead();
        },
        (error: any) => {
          console.error('Error marking notification as read:', error);
          this.notificationService.showError('failed_to_mark_notification_as_read');
        }
      );
    }
  }

  markAllAsRead() {
    this.notificationService.markAllAsRead().subscribe(
      () => {
        this.recentNotifications.forEach(n => n.read = true);
        this.olderNotifications.forEach(n => n.read = true);
        this.totalUnreadCount = 0;
        this.updateAllFilterCounts();
        this.filterNotifications(); // Refresh filtered arrays
        this.notificationService.showSuccess('all_notifications_marked_as_read');
      },
      (error: any) => {
        console.error('Error marking all notifications as read:', error);
        this.notificationService.showError('failed_to_mark_all_notifications_as_read');
      }
    );
  }

  hasAction(notification: any): boolean {
    const actionableTypes = ['product in low stock', 'product is out of stock', 'new order', 'payment received'];
    return actionableTypes.includes(notification.title);
  }



  executeNotificationAction(notification: any) {
    const actionMap: { [key: string]: () => void } = {
      'product in low stock': () => this.router.navigate(['/inventory/products']),
      'product is out of stock': () => this.router.navigate(['/inventory/products']),
      'new order': () => this.router.navigate(['/sales/orders']),
      'payment received': () => this.router.navigate(['/finance/sales-payments']),
      'purchase created': () => this.router.navigate(['/inventory/purchases']),
      'inventory audit': () => this.router.navigate(['/inventory/warehouses']),
    };

    const action = actionMap[notification.title];
    if (action) {
      action();
      this.notificationVisible = false;
      // Close the notification details dialog if open
      this.notificationDialogVisible = false;
      this.selectedNotification = null;
    }
  }

  showNotificationMenu(notification: any, event: Event) {
    this.selectedNotification = notification;
    this.notificationMenuItems = this.getNotificationMenuItems(notification);
    this.notificationMenu.toggle(event);
  }

  getNotificationMenuItems(notification: any): any[] {
    return [
      {
        label: this.translate.instant('mark_as_read'),
        icon: 'pi pi-check',
        command: () => this.markAsRead(notification),
        visible: !notification.read
      },
      {
        label: this.translate.instant('view_details'),
        icon: 'pi pi-eye',
        command: () => this.viewNotificationDetails(notification)
      },
      {
        separator: true
      },
      {
        label: this.translate.instant('turn_off_this_type'),
        icon: 'pi pi-times-circle',
        command: () => this.muteNotificationType(notification.type)
      },
      {
        label: this.translate.instant('delete'),
        icon: 'pi pi-trash',
        command: () => this.deleteNotification(notification)
      }
    ];
  }



  viewNotificationDetails(notification: any) {
    this.selectedNotification = notification;
    this.notificationDialogVisible = true;

    // Optional: mark it as read immediately
    if (!notification.read) {
      notification.read = true;
      this.markAsRead(notification); // your existing service function
    }
  }

  muteNotificationType(notificationType: string) {
    this.confirmationService.confirm({
      message: this.translate.instant('confirm_mute_notification_type', { type: notificationType }),
      header: this.translate.instant('mute_notifications'),
      icon: 'pi pi-bell-slash',
      accept: () => {
        this.notificationService.muteNotificationType(notificationType).subscribe(
          () => {
            // Show success message
            console.log(`Muted notifications of type: ${notificationType}`);
            // You might want to reload notifications or update UI
          },
          (error: any) => {
            console.error('Error muting notification type:', error);
          }
        );
      }
    });
  }

  deleteNotification(notification: any) {
    if (notification.notificationId) {
      this.notificationService.deleteNotification(notification.notificationId).subscribe(
        () => {
          // Remove from both arrays
          this.recentNotifications = this.recentNotifications.filter(n => n.notificationId !== notification.notificationId);
          this.olderNotifications = this.olderNotifications.filter(n => n.notificationId !== notification.notificationId);

          // Update counts
          if (!notification.read) {
            this.totalUnreadCount--;
            this.updateFilterCountsAfterRead();
          }

          // Refresh filtered arrays
          this.filterNotifications();

          this.notificationService.showSuccess(this.translate.instant('notification_deleted_successfully'));
        },
        (error: any) => {
          console.error('Error deleting notification:', error);
          this.notificationService.showError(this.translate.instant('failed_to_delete_notification'));
        }
      );
    }
  }



  get hasPriorityNotifications(): boolean {
    return this.recentNotifications.some(n => n.priority === 'high') ||
      this.olderNotifications.some(n => n.priority === 'high');
  }

  get priorityNotifications(): any[] {
    return [...this.recentNotifications, ...this.olderNotifications]
      .filter(n => n.priority === 'high')
      .sort((a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
  }

  get hasNotifications(): boolean {
    return this.recentNotifications.length > 0 || this.olderNotifications.length > 0;
  }

  get hasFilteredNotifications(): boolean {
    return this.filteredPriorityNotifications.length > 0 || 
           this.filteredRecentNotifications.length > 0 || 
           this.filteredOlderNotifications.length > 0;
  }

  openNotificationSettings() {
    // Implement notification settings dialog
    console.log('Open notification settings');
  }


  logOut() {
    this.keycloakService.logout(window.location.origin + '/webconsole')
  }

  loadRecentNotifications() {
    this.notificationService.getRecentNotifications(this.recentPage, this.pageSize).subscribe(
      (data: any) => {
        const today = moment().startOf('day');

        // Filter and add notifications to recentNotifications
        const newRecentNotifications = data.content.filter((notification: any) =>
          moment(notification.creationDate).isSameOrAfter(today) && !this.displayedNotificationIds.has(notification.notificationId)
        );

        this.recentNotifications = this.recentNotifications.concat(newRecentNotifications);
        newRecentNotifications.forEach((notification: any) => this.displayedNotificationIds.add(notification.notificationId));

        // Filter and add notifications to olderNotifications
        const newOlderNotifications = data.content.filter((notification: any) =>
          moment(notification.creationDate).isBefore(today) && !this.displayedNotificationIds.has(notification.notificationId)
        );

        this.olderNotifications = this.olderNotifications.concat(newOlderNotifications);
        newOlderNotifications.forEach((notification: any) => this.displayedNotificationIds.add(notification.notificationId));

        if (!data.last) {
          this.recentPage++;
        } else {
          this.loadMoreVisible = false;
        }

        // Apply role-based and UI filters after loading
        this.filterNotifications();

        // Update unread count using filtered lists so non-admins see their own counts
        this.totalUnreadCount = this.filteredRecentNotifications.filter(n => !n.read).length +
          this.filteredOlderNotifications.filter(n => !n.read).length;

        console.log('Recent notifications loaded:', data);
      },

      (error: any) => console.error(error)
    );
  }

  loadMoreNotifications() {
    this.loadingMore = true;
    this.notificationService.getNotifications(this.notificationsPage, this.pageSize).subscribe(
      (data: any) => {
        const newNotifications = data.content.filter((notification: any) =>
          !this.displayedNotificationIds.has(notification.notificationId)
        );

        // Categorize new notifications
        const today = moment().startOf('day');
        newNotifications.forEach((notification: any) => {
          if (moment(notification.creationDate).isSameOrAfter(today)) {
            this.recentNotifications.push(notification);
          } else {
            this.olderNotifications.push(notification);
          }
          this.displayedNotificationIds.add(notification.notificationId);
        });

        this.hasMoreNotifications = !data.last;
        this.notificationsPage++;
        this.loadingMore = false;

        // Apply role-based and UI filters after loading more
        this.filterNotifications();

        // Update unread count using filtered lists
        this.totalUnreadCount = this.filteredRecentNotifications.filter(n => !n.read).length +
          this.filteredOlderNotifications.filter(n => !n.read).length;
      },
      (error: any) => {
        console.error('Error loading more notifications:', error);
        this.loadingMore = false;
      }
    );
  }

  clearAllNotifications() {
    this.notificationService.clearAllNotifications().subscribe(
      () => {
        this.recentNotifications = [];
        this.olderNotifications = [];
        this.filteredRecentNotifications = [];
        this.filteredOlderNotifications = [];
        this.filteredPriorityNotifications = [];
        this.totalUnreadCount = 0;
        this.updateAllFilterCounts();
        this.notificationService.showSuccess('all_notifications_cleared');
      },
      (error: any) => {
        console.error('Error clearing all notifications:', error);
        this.notificationService.showError('failed_to_clear_all_notifications');
      }
    );
  }

  getCustomMessage(notification: Notification): string {
    let notificationTitles = ["product in low stock", "product is out of stock"]

    if (notificationTitles.includes(notification.title)) {
      // Extract product name
      const productNameMatch = notification.message.match(/\(([^)]+)\)/);
      return productNameMatch ? productNameMatch[1] : null;
    }
    return notification.message;
  }

  showSuccess(message: string) {
    this.messageService.clear();
    this.messageService.add({ severity: 'success', summary: this.translate.instant('success'), detail: message });
  }

  showError(message: string) {
    this.messageService.clear();
    this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: message });
  }

  showInfo(message: string) {
    this.messageService.clear();
    this.messageService.add({ severity: 'info', summary: this.translate.instant('info'), detail: message });
  }

  showWarn(message: string) {
    this.messageService.clear();
    this.messageService.add({ severity: 'warn', summary: this.translate.instant('warning'), detail: message });
  }

}
