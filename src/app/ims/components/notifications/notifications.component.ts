import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { NotificationService } from 'src/app/services/notification.service';
import { Notification } from 'src/app/models/notification';
import { KeycloakService } from 'keycloak-angular';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface NotificationGroup {
  label: string;
  notifications: Notification[];
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  groupedNotifications: NotificationGroup[] = [];
  unreadCount = 0;
  isLoading = false;
  activeTab: 'all' | 'unread' | 'priority' = 'all';
  selectedType: string | null = null;
  searchText = '';
  
  notificationTypes = [
    { value: null, label: 'all_types' },
    { value: 'INVENTORY', label: 'INVENTORY' },
    { value: 'ORDER', label: 'ORDER' },
    { value: 'FINANCIAL', label: 'FINANCIAL' },
    { value: 'SYSTEM', label: 'SYSTEM' },
    { value: 'CUSTOMER_CREDIT', label: 'CUSTOMER_CREDIT' }
  ];

  currentPage = 0;
  pageSize = 20;
  totalRecords = 0;
  hasMorePages = true;

  private destroy$ = new Subject<void>();

  constructor(
    private notificationService: NotificationService,
    private messageService: MessageService,
    private translate: TranslateService,
    private keycloakService: KeycloakService,
    private router: Router
  ) { }

  async ngOnInit() {
    await this.loadNotifications();
    
    // Poll for new notifications every 30 seconds
    interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadUnreadCount();
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadNotifications() {
    this.isLoading = true;
    try {
      await this.notificationService.loadToken();
      
      let observable;
      switch (this.activeTab) {
        case 'unread':
          observable = this.notificationService.getUnreadNotifications(this.currentPage, this.pageSize);
          break;
        case 'priority':
          observable = this.notificationService.getPriorityNotifications(this.currentPage, this.pageSize);
          break;
        default:
          observable = this.notificationService.getNotifications(this.currentPage, this.pageSize);
      }

      observable.subscribe({
        next: (response) => {
          const pageContent = response.page?.content || response.content || [];
          this.notifications = pageContent;
          this.totalRecords = response.page?.totalElements || response.totalElements || 0;
          this.hasMorePages = pageContent.length === this.pageSize;
          this.groupNotifications();
          this.loadUnreadCount();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading notifications:', error);
          this.isLoading = false;
        }
      });
    } catch (error) {
      this.isLoading = false;
    }
  }

  async loadUnreadCount() {
    try {
      await this.notificationService.loadToken();
      this.notificationService.getUnreadCount().subscribe({
        next: (count) => {
          this.unreadCount = count;
        },
        error: (error) => {
          console.error('Error loading unread count:', error);
        }
      });
    } catch (error) {
      // Error handled
    }
  }

  groupNotifications() {
    const groups: NotificationGroup[] = [
      { label: 'today', notifications: [] },
      { label: 'yesterday', notifications: [] },
      { label: 'this_week', notifications: [] },
      { label: 'older', notifications: [] }
    ];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    let filteredNotifications = [...this.notifications];

    // Filter by type
    if (this.selectedType) {
      filteredNotifications = filteredNotifications.filter(n => n.type === this.selectedType);
    }

    // Filter by search text
    if (this.searchText) {
      const searchLower = this.searchText.toLowerCase();
      filteredNotifications = filteredNotifications.filter(n =>
        (n.title?.toLowerCase().includes(searchLower)) ||
        (n.message?.toLowerCase().includes(searchLower))
      );
    }

    filteredNotifications.forEach(notification => {
      if (!notification.creationDate) return;
      
      const notifDate = new Date(notification.creationDate);
      
      if (notifDate >= today) {
        groups[0].notifications.push(notification);
      } else if (notifDate >= yesterday) {
        groups[1].notifications.push(notification);
      } else if (notifDate >= weekAgo) {
        groups[2].notifications.push(notification);
      } else {
        groups[3].notifications.push(notification);
      }
    });

    this.groupedNotifications = groups.filter(g => g.notifications.length > 0);
  }

  onTabChange(tab: 'all' | 'unread' | 'priority') {
    this.activeTab = tab;
    this.currentPage = 0;
    this.loadNotifications();
  }

  onTypeFilterChange() {
    this.groupNotifications();
  }

  onSearchChange() {
    this.groupNotifications();
  }

  async markAsRead(notification: Notification) {
    if (!notification.notificationId || notification.read) return;

    try {
      await this.notificationService.loadToken();
      this.notificationService.markAsRead(notification.notificationId!).subscribe({
        next: () => {
          notification.read = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
          if (this.activeTab === 'unread') {
            this.loadNotifications();
          }
        },
        error: (error) => {
          console.error('Error marking notification as read:', error);
        }
      });
    } catch (error) {
      // Error handled
    }
  }

  async markAllAsRead() {
    try {
      await this.notificationService.loadToken();
      this.notificationService.markAllAsRead().subscribe({
        next: () => {
          this.notifications.forEach(n => n.read = true);
          this.unreadCount = 0;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('all_notifications_marked_read') || 'All notifications marked as read',
            life: 2000
          });
        },
        error: (error) => {
          console.error('Error marking all as read:', error);
        }
      });
    } catch (error) {
      // Error handled
    }
  }

  async deleteNotification(notification: Notification) {
    if (!notification.notificationId) return;

    try {
      await this.notificationService.loadToken();
      this.notificationService.deleteNotification(notification.notificationId!).subscribe({
        next: () => {
          this.notifications = this.notifications.filter(n => n.notificationId !== notification.notificationId);
          if (!notification.read) {
            this.unreadCount = Math.max(0, this.unreadCount - 1);
          }
          this.groupNotifications();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('notification_deleted') || 'Notification deleted',
            life: 2000
          });
        },
        error: (error) => {
          console.error('Error deleting notification:', error);
        }
      });
    } catch (error) {
      // Error handled
    }
  }

  async clearAll() {
    try {
      await this.notificationService.loadToken();
      this.notificationService.clearAllNotifications().subscribe({
        next: () => {
          this.notifications = [];
          this.groupedNotifications = [];
          this.unreadCount = 0;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('all_notifications_cleared') || 'All notifications cleared',
            life: 2000
          });
        },
        error: (error) => {
          console.error('Error clearing notifications:', error);
        }
      });
    } catch (error) {
      // Error handled
    }
  }

  handleNotificationClick(notification: Notification) {
    this.markAsRead(notification);
    if (notification.actionUrl) {
      this.router.navigateByUrl(notification.actionUrl);
    }
  }

  getSeverityClass(severity?: string): string {
    switch (severity?.toUpperCase()) {
      case 'HIGH':
      case 'URGENT':
        return 'severity-high';
      case 'MEDIUM':
        return 'severity-medium';
      case 'LOW':
        return 'severity-low';
      default:
        return 'severity-info';
    }
  }

  getTypeIcon(type?: string): string {
    switch (type?.toUpperCase()) {
      case 'INVENTORY':
        return 'pi-box';
      case 'ORDER':
        return 'pi-shopping-cart';
      case 'FINANCIAL':
        return 'pi-money-bill';
      case 'SYSTEM':
        return 'pi-cog';
      case 'CUSTOMER_CREDIT':
        return 'pi-credit-card';
      default:
        return 'pi-bell';
    }
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return this.translate.instant('just_now') || 'Just now';
    if (diffMins < 60) return `${diffMins} ${this.translate.instant('minutes_ago') || 'minutes ago'}`;
    if (diffHours < 24) return `${diffHours} ${this.translate.instant('hours_ago') || 'hours ago'}`;
    if (diffDays < 7) return `${diffDays} ${this.translate.instant('days_ago') || 'days ago'}`;
    
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(d);
  }
}
