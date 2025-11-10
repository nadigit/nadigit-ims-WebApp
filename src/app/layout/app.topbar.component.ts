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
    private router: Router) {

  }
  async ngOnInit(): Promise<void> {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.setupMenu(translations);
    });
    this.profile = await this.keycloakService.loadUserProfile();
    console.log(this.profile)
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
    // Implement filtering logic based on activeFilter
    // This would filter your recentNotifications and olderNotifications arrays
    // For now, we'll just reload all notifications
    this.loadRecentNotifications();
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
      'new order': 'new_order_received',
      'payment received': 'payment_received',
      'purchase created': 'purchase_created',
      'system update': 'system_update',
      'inventory audit': 'inventory_audit'
    };

    return titleMap[notification.title] || notification.title;
  }

  getNotificationMessage(notification: any): string {
    // Handle product stock notifications
    if (['product in low stock', 'product is out of stock'].includes(notification.title)) {
      const productName = notification.message.match(/\(([^)]+)\)/)?.[1];
      return this.translate.instant(
        notification.title === 'product in low stock' ?
          'product_x_is_running_low' :
          'product_x_is_out_of_stock',
        { product: productName }
      );
    }

    // Handle purchase created notification
    if (notification.title === 'purchase_created') {
      // Extract dynamic fields from backend message
      const regex = /Purchase (.+) created successfully\. Amount: \$([\d.]+), Items: (\d+), Supplier: (.+)/;
      const matches = notification.message.match(regex);
      if (matches) {
        const [_, reference, amount, itemCount, supplier] = matches;
        return this.translate.instant(
          'purchase_x_created_successfully',
          { reference, amount, itemCount, supplier }
        );
      }
    }

    // Default fallback
    return notification.message;
  };

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
      'product in low stock': () => this.router.navigate(['/pages/products']),
      'product is out of stock': () => this.router.navigate(['/pages/products']),
      'new order': () => this.router.navigate(['/pages/orders']),
      'payment received': () => this.router.navigate(['/pages/payments']),
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

  openNotificationSettings() {
    // Implement notification settings dialog
    console.log('Open notification settings');
  }


  logOut() {
    this.keycloakService.logout(window.location.origin)
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

        // Update unread count
        this.totalUnreadCount = this.recentNotifications.filter(n => !n.read).length +
          this.olderNotifications.filter(n => !n.read).length;

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

        // Update unread count
        this.totalUnreadCount = this.recentNotifications.filter(n => !n.read).length +
          this.olderNotifications.filter(n => !n.read).length;
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
