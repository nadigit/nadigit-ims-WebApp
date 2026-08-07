import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { TranslateService } from '@ngx-translate/core';
import { MessageService, ConfirmationService } from 'primeng/api';
import { User } from 'src/app/models/user';
import { Role } from 'src/app/models/role';
import { KeycloakEvent } from 'src/app/models/keycloak-event';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TranslationService } from 'src/app/services/translation.service';
import { ShopService } from 'src/app/services/shop.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Shop } from 'src/app/models/shop';
import { Warehouse } from 'src/app/models/warehouse';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-user-details-page',
  templateUrl: './user-details-page.component.html',
  styleUrls: ['./user-details-page.component.css', '../../administration.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class UserDetailsPageComponent implements OnInit {
  userId!: string;
  user: User | null = null;
  isLoading: boolean = true;
  
  canEdit: boolean = false;
  canDelete: boolean = false;
  isAdmin: boolean = false;
  userRoles: any;
  Ressource: string = "USERS";

  // User form properties
  userDialog: boolean = false;
  shops: Shop[] = [];
  warehouses: Warehouse[] = [];
  selectedShop: Shop = {};
  selectedWarehouse: Warehouse = {};
  posPin: string = '';

  // User roles
  userRealmRoles: Role[] = [];

  // User events
  userEvents: KeycloakEvent[] = [];
  eventsLoading: boolean = false;

  // Admin account controls (reset password / enable-disable)
  resetPasswordDialog: boolean = false;
  resetPasswordValue: string = '';
  resetPasswordTemporary: boolean = false;
  resetPasswordSubmitted: boolean = false;
  resetPasswordSaving: boolean = false;
  statusSaving: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private authService: AuthenticationService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private translateService: TranslationService,
    private shopService: ShopService,
    private warehouseService: WarehouseService
  ) {}

  async ngOnInit() {
    this.isLoading = true;
    
    this.configService.currency$.subscribe(currency => {
      // Currency subscription if needed
    });

    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });

    this.route.params.subscribe(async params => {
      this.userId = params['id'];
      if (!this.userId) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_user_id'),
          life: 3000
        });
        this.router.navigate(['/administration/users']);
        return;
      }
      await this.checkPermissions();
      await this.setUserRoles();
      await this.loadUser();
      await this.loadUserRoles();
      await this.loadUserEvents();
      await this.loadShops();
      await this.loadWarehouses();
    });
  }

  async loadUser(): Promise<void> {
    try {
      await this.authService.loadToken();
      const response = await firstValueFrom(this.authService.getUser(this.userId));
      
      if (Array.isArray(response)) {
        this.user = response[0] as User;
      } else if (response && typeof response === 'object') {
        this.user = response as User;
      } else {
        throw new Error('Unexpected response format from API');
      }
      
      if (!this.user || !this.user.id) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('user_not_found'),
          life: 3000
        });
        this.router.navigate(['/administration/users']);
        return;
      }

      // Extract attributes
      if (this.user.attributes) {
        this.posPin = (this.user.attributes as any)?.posPin?.[0] || (this.user.attributes as any)?.posPin || '';
        const shopId = (this.user.attributes as any)?.shop?.[0] || (this.user.attributes as any)?.shop;
        const warehouseId = (this.user.attributes as any)?.warehouse?.[0] || (this.user.attributes as any)?.warehouse;
        
        if (shopId) {
          this.selectedShop = this.shops.find(s => s.shopId === +shopId) || {};
        }
        if (warehouseId) {
          this.selectedWarehouse = this.warehouses.find(w => w.warehouseId === +warehouseId) || {};
        }
      }

      this.isLoading = false;
    } catch (error: any) {
      console.error('Error loading user:', error);
      this.isLoading = false;
      const errorMessage = error?.error?.message || error?.message || this.translate.instant('error_loading_user');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMessage,
        life: 3000
      });
      setTimeout(() => {
        this.router.navigate(['/administration/users']);
      }, 2000);
    }
  }

  async loadUserRoles(): Promise<void> {
    if (!this.userId) return;
    
    try {
      const roles = await firstValueFrom(this.authService.getUserRoles(this.userId));
      if (Array.isArray(roles)) {
        this.userRealmRoles = roles.map((role: any) => ({ name: role.name || role } as Role));
      }
    } catch (error: any) {
      console.error('Error loading user roles:', error);
      this.userRealmRoles = [];
    }
  }

  async loadShops(): Promise<void> {
    try {
      const response = await firstValueFrom(this.shopService.getShops());
      this.shops = Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error loading shops:', error);
      this.shops = [];
    }
  }

  async loadWarehouses(): Promise<void> {
    try {
      const response = await firstValueFrom(this.warehouseService.getWarehouses());
      this.warehouses = Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error loading warehouses:', error);
      this.warehouses = [];
    }
  }

  async checkPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await this.permissionService.init(userId).toPromise();
      this.canEdit = this.permissionService.canUpdate(this.Ressource);
      this.canDelete = this.permissionService.canDelete(this.Ressource);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  private async setUserRoles() {
    try {
      this.userRoles = await this.keycloakService.getUserRoles();
      this.isAdmin = this.userRoles.includes('ADMIN');
    } catch (error) {
      console.error('Error setting user roles:', error);
    }
  }

  goBack(): void {
    this.location.back();
  }

  editUser(): void {
    if (!this.canEdit || !this.user) return;
    this.userDialog = true;
  }

  hideUserDialog(): void {
    this.userDialog = false;
  }

  async onUserFormSaveSuccess(userData: User): Promise<void> {
    console.log('User form saved successfully:', userData);
    await this.loadUser();
    await this.loadUserRoles();
    this.userDialog = false;
  }

  onUserFormSaveError(event: { user: User, error: any }): void {
    console.error('User form save error:', event.error);
  }

  deleteUser(): void {
    if (!this.canDelete || !this.user) return;
    
    this.confirmationService.confirm({
      message: this.translate.instant('delete_confirmation_msg_with_param').replace('{0}', this.user.username || ''),
      header: this.translate.instant('confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => {
        this.authService.deleteUser(this.userId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: this.translate.instant('successful'),
              detail: this.translate.instant('user_deleted'),
              life: 3000
            });
            this.router.navigate(['/administration/users']);
          },
          error: (err: any) => {
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_deleting_user'),
              life: 3000
            });
          }
        });
      }
    });
  }

  // --- Admin account controls ---------------------------------------------

  openResetPassword(): void {
    if (!this.canEdit || !this.user) return;
    this.resetPasswordValue = '';
    this.resetPasswordTemporary = false;
    this.resetPasswordSubmitted = false;
    this.resetPasswordDialog = true;
  }

  async confirmResetPassword(): Promise<void> {
    this.resetPasswordSubmitted = true;
    if (!this.resetPasswordValue || !this.user) return;
    this.resetPasswordSaving = true;
    const credential = {
      type: 'password',
      value: this.resetPasswordValue,
      temporary: this.resetPasswordTemporary
    };
    try {
      await firstValueFrom(this.authService.changePassword(this.userId, credential));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('password_reset_success'),
        life: 3000
      });
      this.resetPasswordDialog = false;
      this.resetPasswordValue = '';
    } catch (error) {
      console.error('Error resetting password:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_resetting_password'),
        life: 3000
      });
    } finally {
      this.resetPasswordSaving = false;
    }
  }

  toggleStatus(): void {
    if (!this.canEdit || !this.user) return;
    const enabling = !this.user.enabled;
    this.confirmationService.confirm({
      message: this.translate.instant(enabling ? 'enable_user_confirm' : 'disable_user_confirm'),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        await this.applyStatus(enabling);
      }
    });
  }

  private async applyStatus(enabled: boolean): Promise<void> {
    if (!this.user) return;
    this.statusSaving = true;
    try {
      // this.user is the full representation from getUser(), so it carries attributes;
      // send it back with only `enabled` changed. Never resend credentials on update.
      const payload: any = { ...this.user, enabled };
      delete payload.credentials;
      await firstValueFrom(this.authService.updateUser(this.userId, payload));
      await this.loadUser();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant(enabled ? 'user_enabled' : 'user_disabled'),
        life: 3000
      });
    } catch (error) {
      console.error('Error updating account status:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_updating_status'),
        life: 3000
      });
    } finally {
      this.statusSaving = false;
    }
  }

  getStatusSeverity(enabled: boolean | undefined): string {
    return enabled ? 'success' : 'danger';
  }

  getStatusLabel(enabled: boolean | undefined): string {
    return enabled ? this.translate.instant('enabled') : this.translate.instant('disabled');
  }

  getFullName(): string {
    if (!this.user) return '';
    const firstName = this.user.firstName || '';
    const lastName = this.user.lastName || '';
    return `${firstName} ${lastName}`.trim() || this.user.username || '';
  }

  getRoleLabel(roleName: string): string {
    if (!roleName) return '';
    const key = `user_role_${roleName.toLowerCase()}`;
    const translated = this.translate.instant(key);
    if (translated && translated !== key) {
      return translated;
    }
    return roleName
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  async loadUserEvents(): Promise<void> {
    if (!this.userId) return;
    
    this.eventsLoading = true;
    try {
      await this.authService.loadToken();
      
      // Get events from last 365 days to find last login (even if it was a while ago)
      const dateFrom = Date.now() - (365 * 24 * 60 * 60 * 1000);
      const dateTo = Date.now();
      
      const events = await firstValueFrom(
        this.authService.getUserEvents(this.userId, 100, dateFrom, dateTo)
      );
      
      if (Array.isArray(events)) {
        this.userEvents = events.sort((a, b) => (b.time || 0) - (a.time || 0)); // Most recent first
      }
    } catch (error: any) {
      console.error('Error loading user events:', error);
      // Don't show error if events API is not enabled in Keycloak
      if (error?.status !== 404) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_loading_user_events'),
          life: 3000
        });
      }
      this.userEvents = [];
    } finally {
      this.eventsLoading = false;
    }
  }

  getEventTypeLabel(type: string): string {
    const eventLabels: { [key: string]: string } = {
      'LOGIN': 'login_event',
      'LOGOUT': 'logout_event',
      'LOGIN_ERROR': 'login_error',
      'REGISTER': 'register_event',
      'UPDATE_PASSWORD': 'password_changed',
      'UPDATE_PROFILE': 'profile_updated',
      'UPDATE_EMAIL': 'email_updated',
      'SEND_VERIFY_EMAIL': 'verification_email_sent',
      'VERIFY_EMAIL': 'email_verified',
      'SEND_RESET_PASSWORD': 'reset_password_email_sent',
      'RESET_PASSWORD': 'password_reset',
      'REMOVE_FEDERATED_IDENTITY': 'federated_identity_removed',
      'REVOKE_GRANT': 'grant_revoked',
      'SEND_IDENTITY_PROVIDER_LINK': 'identity_provider_link_sent',
      'REMOVE_TOTP': 'totp_removed',
      'UPDATE_TOTP': 'totp_updated'
    };
    return this.translate.instant(eventLabels[type] || type);
  }

  getEventIcon(type: string): string {
    if (type?.includes('LOGIN')) return 'pi pi-sign-in';
    if (type?.includes('LOGOUT')) return 'pi pi-sign-out';
    if (type?.includes('PASSWORD')) return 'pi pi-key';
    if (type?.includes('EMAIL') || type?.includes('VERIFY')) return 'pi pi-envelope';
    if (type?.includes('REGISTER')) return 'pi pi-user-plus';
    if (type?.includes('ERROR')) return 'pi pi-exclamation-triangle';
    return 'pi pi-circle';
  }

  getEventSeverity(type: string): string {
    if (type?.includes('ERROR')) return 'danger';
    if (type?.includes('LOGIN') || type?.includes('REGISTER')) return 'success';
    if (type?.includes('UPDATE') || type?.includes('PASSWORD')) return 'info';
    return 'secondary';
  }

  getEventDetails(event: KeycloakEvent): string {
    if (!event.details) return '';
    const details = Object.entries(event.details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    return details || '-';
  }

  formatLastLoginDate(lastLoginDate: Date | number | null | undefined): string {
    if (!lastLoginDate) {
      // Try to get from events if available
      const lastLoginEvent = this.userEvents.find(e => e.type === 'LOGIN');
      if (lastLoginEvent && lastLoginEvent.time) {
        const date = new Date(lastLoginEvent.time);
        return date.toLocaleString(this.translate.currentLang || 'en', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      return this.translate.instant('never') || 'Never';
    }
    
    let date: Date;
    if (typeof lastLoginDate === 'number') {
      date = new Date(lastLoginDate);
    } else {
      date = new Date(lastLoginDate);
    }
    
    if (isNaN(date.getTime())) {
      return this.translate.instant('never') || 'Never';
    }
    
    return date.toLocaleString(this.translate.currentLang || 'en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getLastLoginDate(): string {
    // First try to get from user object if backend provides it
    if (this.user?.lastLoginDate) {
      return this.formatLastLoginDate(this.user.lastLoginDate);
    }
    
    // Otherwise, extract from user events (most recent LOGIN event)
    if (this.userEvents && this.userEvents.length > 0) {
      // Find the most recent LOGIN event (events are already sorted by time descending)
      const lastLoginEvent = this.userEvents.find(e => e.type === 'LOGIN' && e.time);
      if (lastLoginEvent && lastLoginEvent.time) {
        return this.formatLastLoginDate(lastLoginEvent.time);
      }
    }
    
    return this.translate.instant('never') || 'Never';
  }
}

