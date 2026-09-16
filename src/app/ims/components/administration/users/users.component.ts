import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { LayoutService } from 'src/app/layout/service/app.layout.service';
import { MenuItem, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ExportContextService } from 'src/app/services/export-context.service';
import { User } from 'src/app/models/user';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Role } from 'src/app/models/role';
import { Credential } from 'src/app/models/credential';
import { firstValueFrom, forkJoin, Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ShopService } from 'src/app/services/shop.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Warehouse } from 'src/app/models/warehouse';
import { Shop } from 'src/app/models/shop';
import { PermissionService } from 'src/app/services/permission.service';
import { ActivatedRoute, Router } from '@angular/router';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';
import { httpErrorMessage } from 'src/app/shared/http-error-message';


@Component({
  templateUrl: './users.component.html',
  styleUrls: ['../administration.component.css', './users.component.css'],
  providers: [MessageService]
})
export class UsersComponent implements OnInit {
  readonly systemRoleNames = ['ADMIN', 'CASHIER', 'VENDOR', 'WAREHOUSEMAN', 'AUDITOR', 'ACCOUNTANT'];

  userDialog: boolean = false;

  roleDialog: boolean = false;

  deleteUserDialog: boolean = false;

  deleteUsersDialog: boolean = false;

  deleteRoleDialog: boolean = false;

  deleteRolesDialog: boolean = false;

  // Admin account controls (reset password / enable-disable)
  resetPasswordDialog: boolean = false;
  resetPasswordValue: string = '';
  resetPasswordTemporary: boolean = false;
  resetPasswordSubmitted: boolean = false;
  resetPasswordSaving: boolean = false;

  toggleStatusDialog: boolean = false;
  statusSaving: boolean = false;

  users: User[] = [];

  user: User = {};

  selectedUsers: User[] = [];

  selectedRoles: Role[] = [];

  submitted: boolean = false;

  usersCols: any[] = [];
  rolesCols: any[] = [];


  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;

  appRoles: Role[] = [];

  appRole: Role = {};

  targetRoles: Role[] = [];

  roleSearchFilter: string = '';

  userRoles: Role[] = [];

  userAppRoles: Role[] = [];

  userCredential: Credential = {};

  valSwitch: boolean = false;

  usersExportColumns!: ExportColumn[];
  rolesExportColumns!: ExportColumn[];

  roles: any;

  items: MenuItem[];

  menuItems: MenuItem[] | undefined;

  activeItem: MenuItem | undefined;

  selectedRole: Role;

  isUserRoleMapped: boolean = false;

  loading: boolean = false; // Flag to indicate loading state

  warehouses: Warehouse[] = [];

  shops: Shop[] = [];

  selectedShop: Shop = {}; // To hold selected shop IDs

  selectedWarehouse: Warehouse = {}; // To hold selected warehouse IDs
  
  posPin: string = ''; // POS PIN for user
  isLoading: boolean = true;
  isInitialLoad: boolean = true;
  rolesLoading: boolean = true;
  rolesInitialLoad: boolean = true;
  isStarterPlan: boolean = false;
  isRoleManagementLocked: boolean = false;
  /** null = no numeric cap (Enterprise / unknown) */
  maxUsersCap: number | null = null;

  constructor(
    private messageService: MessageService,
    private authService: AuthenticationService,
    private reportingService: ReportingService,
    private warehouseService: WarehouseService,
    private shopService: ShopService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private cdr: ChangeDetectorRef,
    private permissionService: PermissionService,
    private router: Router,
    private route: ActivatedRoute,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    public pageSizeService: TablePageSizeService,
    private layoutService: LayoutService,
    private exportContext: ExportContextService) {  

    }

    async ngOnInit() {
      this.isLoading = true;
      this.pageSize = this.pageSizeService.initState(TablePageSizeKeys.users, this.rowsPerPageOptions, {
        pageSize: this.pageSize,
      });
      await this.loadLicenseCapabilities();
  
      // Subscribe to language changes
      this.translateService.currentLanguage$.subscribe(lang => {
          this.translate.use(lang); // Update the language
      });
  
      // Fetch translations asynchronously
      const translations = await this.translate.get([
          'ID', 
          'user_first_name', 
          'user_last_name', 
          'user_username', 
          'user_email',
          'role_name', 
          'role_description',
          'tab_users',
          'tab_roles',
          'user_information',
          'user_role'
      ]).toPromise();
  
      // Initialize usersCols and rolesCols with translations
      this.usersCols = [
          { field: 'id', header: translations['ID'] },
          { field: 'firstName', header: translations['user_first_name'] },
          { field: 'lastName', header: translations['user_last_name'] },
          { field: 'username', header: translations['user_username'] },
          { field: 'email', header: translations['user_email'] },
      ];
  
      this.rolesCols = [
          { field: 'id', header: translations['ID'] },
          { field: 'name', header: translations['role_name'] },
          { field: 'description', header: translations['role_description'] },
      ];
  
      // Initialize export columns
      this.usersExportColumns = this.usersCols.map((col) => ({ title: col.header, dataKey: col.field }));
      this.rolesExportColumns = this.rolesCols.map((col) => ({ title: col.header, dataKey: col.field }));
  
      // Initialize menuItems
      this.menuItems = [
          {
              label: translations['tab_users'],
              icon: 'pi pi-fw pi-user',
          },
          {
              label: translations['tab_roles'],
              icon: 'pi pi-fw pi-shield',
          },
      ];
      if (this.isRoleManagementLocked) {
        this.menuItems = this.menuItems.filter(item => item.icon !== 'pi pi-fw pi-shield');
      }
  
      // Set the active menu item
      this.activeItem = this.menuItems[0];
  
      // Fetch data and initialize other components
      this.onGetAllUsers();
      if (!this.isRoleManagementLocked) {
        this.onGetAllRoles();
      }
      this.onGetAllWarehouses();
      this.onGetAllShops();
      this.initializePickList();
  
      this.isLoading = false;
      await this.openEditFromLink();
  }

  /**
   * The user details page edits through this page's form, the only full user form in the console:
   * it links here with ?edit=<id>, and closing or saving the form returns to that user's details.
   */
  private returnToUserId: string | null = null;
  /** The save the dialog fired, so returning to the details page shows the saved user, not the old one. */
  private pendingUserSave: Promise<void> | null = null;

  private async openEditFromLink(): Promise<void> {
    const id = this.route.snapshot.queryParamMap.get('edit');
    if (!id) {
      return;
    }
    await this.onGetAllUsers();
    let target: User | undefined = this.users?.find((u: any) => String(u.id) === id);
    if (!target) {
      try {
        target = (await firstValueFrom(this.authService.getUser(id))) as User;
      } catch {
        target = undefined;
      }
    }
    if (!target) {
      return;
    }
    this.returnToUserId = id;
    await this.editUser(target);
  }

  async onUserDialogHide(): Promise<void> {
    const id = this.returnToUserId;
    if (!id) {
      return;
    }
    this.returnToUserId = null;
    if (this.pendingUserSave) {
      await this.pendingUserSave.catch(() => undefined);
      this.pendingUserSave = null;
    }
    this.router.navigate(['/administration/users', id]);
  }

  onTablePage(event: any): void {
    this.pageSizeService.applyPageEvent(TablePageSizeKeys.users, this.rowsPerPageOptions, event, this);
  }

  async loadLicenseCapabilities(): Promise<void> {
    try {
      await this.licenseCapabilitiesService.ensureLoaded();
      const tier = this.licenseCapabilitiesService.getTier();
      this.isStarterPlan = tier === 'STARTER';
      this.isRoleManagementLocked = this.isStarterPlan;
      this.maxUsersCap = this.licenseCapabilitiesService.getMaxUsersCap();
    } catch (error) {
      console.warn('Unable to resolve license capabilities, using default behavior.', error);
      this.isStarterPlan = false;
      this.isRoleManagementLocked = false;
      this.maxUsersCap = null;
    }
  }

  /** How many users this plan allows; drives the hint above the table. */
  get userCap(): number | null {
    return this.maxUsersCap;
  }

  get isAtUserCapacity(): boolean {
    const cap = this.maxUsersCap;
    if (cap == null) {
      return false;
    }
    return (this.users?.length || 0) >= cap;
  }

  private isLicenseUpgradeError(error: any): boolean {
    const payload = error?.error || {};
    return error?.status === 403 && payload?.errorCode === 'FEATURE_NOT_LICENSED';
  }

  private showUpgradeCta(detail: string): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('plan_limit_reached_title'),
      detail,
      life: 7000
    });
  }

  goToUpgrade(): void {
    // System Info carries the plan, its features and the activation controls; My Company is the
    // organization's own details and says nothing about the licence.
    this.layoutService.triggerSystemInfoLoad();
  }
  
  
  async combineUserRolesData() {
    for (let user of this.users) {
      this.roles = await this.getUserRoles(user.id);
      const userRoles = this.roles.filter(role => role.userId === user.id).map(role => role.name);
      user.roles = userRoles;
    }
  }

  async onGetAllWarehouses() {
    // Awaited for real, so the user form can pick the user's warehouse from the list once it is loaded.
    try {
      this.warehouses = (await firstValueFrom(this.warehouseService.getWarehouses())) as any;
    } catch (err) {
      console.log(err);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_warehouses'),
        life: 3000
      });
    }
  }

  async onGetAllShops() {
    // Awaited for real, so the user form can pick the user's shop from the list once it is loaded.
    try {
      this.shops = (await firstValueFrom(this.shopService.getShops())) as any;
    } catch (err) {
      console.log(err);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_shops'),
        life: 3000
      });
    }
  }

  onActiveItemChange(event: MenuItem) {
    this.activeItem = event;
    console.log(this.activeItem)
  }

  deleteSelected() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      if (!this.selectedUsers?.length) {
        return;
      }
      this.deleteUsersDialog = true;
    } else {
      if (!this.selectedRoles?.length) {
        return;
      }
      this.deleteRolesDialog = true;
    }
    //this.deleteUsersDialog = true;
  }

  async editUser(user: User) {
    this.user = { ...user };
    this.posPin = user.attributes?.posPin || '';

    // The user's shop and warehouse come from the lists this page already holds, never from a lookup
    // by id: an administrator has no scope (the old per-id calls went out as shops/NaN and
    // warehouses/NaN), and an id left behind by a deleted shop made the server answer 500, both shown
    // to the user as an error on opening the form.
    if (!this.shops?.length) {
      await this.onGetAllShops();
    }
    if (!this.warehouses?.length) {
      await this.onGetAllWarehouses();
    }
    const shopId = Number(user.attributes?.shop);
    const warehouseId = Number(user.attributes?.warehouse);
    this.selectedShop = (shopId > 0 && this.shops?.find((s: any) => Number(s.shopId) === shopId)) || {};
    this.selectedWarehouse = (warehouseId > 0 && this.warehouses?.find((w: any) => Number(w.warehouseId) === warehouseId)) || {};

    if (!this.isRoleManagementLocked) {
      // Pre-select the user's current roles. initializePickList() returns a cold Observable, and this
      // used to call it without subscribing: the request never went out, the form opened with no role
      // ticked (an administrator shown as needing a shop and warehouse), and saving it would have
      // replaced the user's roles with none.
      await this.ensureAppRoles();
      await firstValueFrom(this.initializePickList(), { defaultValue: undefined }).catch(() => undefined);
    }
    this.userDialog = true;
}

  /** The assignable roles, loaded and awaited (onGetAllRoles fills the Roles tab without waiting). */
  private async ensureAppRoles(): Promise<void> {
    if (this.appRoles?.length) {
      return;
    }
    try {
      const response: any = await firstValueFrom(this.authService.getRoles());
      this.appRoles = (response || []).filter((role: any) => !role.composite);
    } catch (err) {
      console.log(err);
    }
  }

  showUserDetails(user: User) {
    this.router.navigate(['/administration/users', user.id]);
  }

  deleteUser(user: User) {
    this.deleteUserDialog = true;
    this.user = { ...user };
  }

  // --- Admin account controls ---------------------------------------------

  openResetPassword(user: User) {
    this.user = { ...user };
    this.resetPasswordValue = '';
    this.resetPasswordTemporary = false;
    this.resetPasswordSubmitted = false;
    this.resetPasswordDialog = true;
  }

  async confirmResetPassword() {
    this.resetPasswordSubmitted = true;
    if (!this.resetPasswordValue || !this.user?.id) {
      return;
    }
    this.resetPasswordSaving = true;
    const credential = {
      type: 'password',
      value: this.resetPasswordValue,
      temporary: this.resetPasswordTemporary
    };
    try {
      await this.authService.changePassword(this.user.id, credential).toPromise();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('password_reset_success'),
        life: 3000
      });
      this.resetPasswordDialog = false;
      this.resetPasswordValue = '';
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_resetting_password'),
        life: 3000
      });
    } finally {
      this.resetPasswordSaving = false;
      this.cdr.detectChanges();
    }
  }

  openToggleStatus(user: User) {
    this.user = { ...user };
    this.toggleStatusDialog = true;
  }

  async confirmToggleStatus() {
    const targetId = this.user?.id;
    if (!targetId) {
      return;
    }
    this.statusSaving = true;
    try {
      // The list view is a brief representation (no attributes); fetch the full
      // user first so toggling `enabled` doesn't wipe shop/warehouse/POS attributes.
      const full: any = await this.authService.getUser(targetId).toPromise();
      const fullUser = Array.isArray(full) ? full[0] : full;
      const newEnabled = !fullUser.enabled;
      fullUser.enabled = newEnabled;
      delete fullUser.credentials; // never resend credentials on update
      await this.authService.updateUser(targetId, fullUser).toPromise();
      await this.onGetAllUsers();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant(newEnabled ? 'user_enabled' : 'user_disabled'),
        life: 3000
      });
      this.toggleStatusDialog = false;
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_updating_status'),
        life: 3000
      });
    } finally {
      this.statusSaving = false;
      this.cdr.detectChanges();
    }
  }

  editRole(appRole: Role) {
    if (this.isSystemRole(appRole?.name)) {
      this.showSystemRoleImmutableMessage();
      return;
    }
    this.appRole = { ...appRole };
    this.roleDialog = true;
  }

  deleteRole(appRole: Role) {
    if (this.isSystemRole(appRole?.name)) {
      this.showSystemRoleImmutableMessage();
      return;
    }
    this.deleteRoleDialog = true;
    this.appRole = { ...appRole };
  }

  showRoleDetails(appRole: Role) {
    if (!appRole?.name) {
      return;
    }
    this.router.navigate(['/administration/users/roles', appRole.name]);
  }


  async confirmDeleteSelected() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      this.deleteUsersDialog = false;
      await this.selectedUsers.forEach(selectedUser => this.onDeleteUser(selectedUser.id));
      this.selectedUsers = [];
    } else {
      this.deleteRolesDialog = false;
      await this.selectedRoles
        .filter(selectedRole => !this.isSystemRole(selectedRole?.name))
        .forEach(selectedRole => this.onDeleteRole(selectedRole.name));
      this.selectedRoles = [];
    }
  }

  async confirmDelete() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      this.deleteUserDialog = false;
      await this.onDeleteUser(this.user.id);
      this.user = {};
    } else {
      console.log(this.activeItem)
      this.deleteRoleDialog = false;
      await this.onDeleteRole(this.appRole.name);
      this.appRole = {};
    }

  }

  hideDialog() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      this.userDialog = false;
    } else {
      this.roleDialog = false;
    }
    this.submitted = false;
    this.roleSearchFilter = '';
    this.isUserRoleMapped = false;
  }

  openNew() {
    if (this.activeItem?.icon == 'pi pi-fw pi-user' && this.isAtUserCapacity) {
      this.showUpgradeCta(this.translate.instant('plan_limit_reached_users', { count: this.maxUsersCap ?? 1 }));
      return;
    }
    this.user = {};
    this.user.enabled = true;
    this.user.credentials = [];
    this.userCredential = {};
    this.selectedShop = {};
    this.selectedWarehouse = {};
    this.posPin = '';
    // A new user starts with no roles; nothing from a previously opened user may carry over.
    this.targetRoles = [];
    this.submitted = false;
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      this.userDialog = true;
    } else {
      this.roleDialog = true;
    }
  }



  initializePickList(): Observable<void> {
    return new Observable<void>((observer) => {
      this.loading = true; // Set loading flag to true

      if (this.user.id) {
        this.authService.getUserRoles(this.user.id).subscribe(userRoles => {
          console.log("User Roles:", userRoles); // Log userRoles to inspect its contents
          if (Array.isArray(userRoles)) {
            let userRoleIds = userRoles.map((role: any) => role.id);
            console.log("User Role IDs:", userRoleIds); // Log userRoleIds to inspect its contents
            console.log(this.appRoles)
            console.log(this.appRoles.filter(role => userRoleIds.includes(role.id)))
            // Filter appRoles to include only roles specified by userRoleIds
            this.targetRoles = this.appRoles.filter(role => userRoleIds.includes(role.id));
            console.log("Target Roles:", this.targetRoles); // Log targetRoles to inspect its contents

            this.loading = false; // Set loading flag to false after initialization is complete
            observer.next();
          } else {
            this.loading = false; // Set loading flag to false if userRoles is not an array
            this.messageService.add({
              severity: 'error',
              summary: this.translate.instant('error'),
              detail: this.translate.instant('error_while_getting_user_roles'),
              life: 3000
            });
            observer.error("User roles data is not in the expected format.");
          }
          observer.complete(); // Emit completion signal
        }, error => {
          this.loading = false; // Set loading flag to false if there's an error
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_user_roles'),
            life: 3000
          });
          observer.error("Error fetching user roles: " + error);
          observer.complete(); // Emit completion signal
        });
      } else {
        this.targetRoles = [];
        this.loading = false;
        observer.next();
        observer.complete(); // Emit completion signal
      }
    });
  }

  get filteredRoles(): Role[] {
    const term = (this.roleSearchFilter || '').trim().toLowerCase();
    if (!term) {
      return this.appRoles;
    }
    return this.appRoles.filter((role) => {
      const label = this.getRoleLabel(role.name).toLowerCase();
      return (
        (role.name || '').toLowerCase().includes(term) ||
        (role.description || '').toLowerCase().includes(term) ||
        label.includes(term)
      );
    });
  }

  isRoleSelected(role: Role): boolean {
    return this.targetRoles.some((selected) => selected.id === role.id);
  }

  toggleRole(role: Role, selected: boolean): void {
    if (selected) {
      if (!this.isRoleSelected(role)) {
        this.targetRoles = [...this.targetRoles, role];
      }
      return;
    }
    this.targetRoles = this.targetRoles.filter((selectedRole) => selectedRole.id !== role.id);
  }

  selectAllRoles(): void {
    this.targetRoles = [...this.appRoles];
  }

  clearSelectedRoles(): void {
    this.targetRoles = [];
  }

  async saveUser() {
    this.submitted = true;
    console.log(this.targetRoles)
    // Ensure shops and warehouses attributes are set as arrays of strings
    this.user.attributes = this.user.attributes || {}; // Ensure attributes object exists

    // An administrator carries no scope: sending one would both contradict the domain rule and
    // leave a stale shop/warehouse behind if a scoped user is later promoted to ADMIN.
    if (this.scopeRequired) {
      this.user.attributes.shop = this.selectedShop ? this.selectedShop.shopId?.toString() : '';
      this.user.attributes.warehouse = this.selectedWarehouse ? this.selectedWarehouse.warehouseId?.toString() : '';
    } else {
      this.user.attributes.shop = '';
      this.user.attributes.warehouse = '';
    }
    this.user.attributes.posPin = this.posPin || ''; // Set POS PIN

    if (this.user.username?.trim() && this.isUserFormValid()) {
      delete this.user.creationDate;
      delete this.user.roles;
      if (this.user.id) {
        //delete this.user.creationDate;

        console.log(this.user)
        console.log(this.userRoles)
        this.pendingUserSave = this.saveUserInfoAndRoleMapping(this.user, this.targetRoles)
      } else {
        this.user.credentials = [];
        console.log(this.userCredential)
        console.log(this.user.credentials)
        const response = this.pendingUserSave = this.saveUserInfoAndRoleMapping(this.user, this.targetRoles)
        console.log(this.user.credentials)
      }
      this.users = [...this.users];
      this.cdr.detectChanges(); // Detect changes to update the UI
      this.userDialog = false;

      this.user = {};
      this.userCredential = {};
      this.targetRoles = [];
      this.posPin = '';
      this.selectedShop = {};
      this.selectedWarehouse = {};
      this.roleSearchFilter = '';
    }
    this.cdr.detectChanges(); // Detect changes to update the UI
  }

  /**
   * Roles that are not tied to a shop or a warehouse.
   *
   * ADMIN reaches everything. ACCOUNTANT and AUDITOR answer to the whole company: their scope is
   * the organization (organization_membership on the server), not premises, so asking them for a
   * shop and a warehouse would attach places they are not limited to. VENDOR, CASHIER and
   * WAREHOUSEMAN work somewhere specific and stay scoped.
   *
   * The server is authoritative and enforces the same rule when roles are granted — see
   * ims.users.scope-exempt-roles. Keep the two in step; if they disagree the server answers 400
   * and names the missing attribute, so a drift is visible rather than silent.
   */
  private static readonly SCOPE_EXEMPT_ROLES = ['ADMIN', 'ACCOUNTANT', 'AUDITOR'];

  get scopeRequired(): boolean {
    const selected = (this.targetRoles || [])
      .map((role) => (role?.name || '').toUpperCase());
    if (!selected.length) {
      return true;
    }
    return !selected.some((name) => UsersComponent.SCOPE_EXEMPT_ROLES.includes(name));
  }

  private isUserFormValid(): boolean {
    const passwordOk = this.user.id ? true : !!this.userCredential?.value;
    const rolesOk = this.isRoleManagementLocked || (this.targetRoles?.length > 0);
    const scopeOk =
      !this.scopeRequired ||
      !!(this.selectedShop?.shopId && this.selectedWarehouse?.warehouseId);
    return !!(
      this.user &&
      this.user.username &&
      this.user.email &&
      this.user.lastName &&
      this.user.firstName &&
      scopeOk &&
      passwordOk &&
      rolesOk
    );
  }

  onPosPinInput(event: any) {
    // Only allow numeric characters
    const value = event.target.value;
    this.posPin = value.replace(/[^0-9]/g, '');
  }

  formatLastLoginDate(lastLoginDate: Date | number | null | undefined): string {
    if (!lastLoginDate) {
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

  async getLastLoginForUser(userId: string): Promise<Date | number | null> {
    try {
      await this.authService.loadToken();
      // Get only LOGIN events, limit to 1, from last 90 days
      const dateFrom = Date.now() - (90 * 24 * 60 * 60 * 1000);
      const dateTo = Date.now();
      
      const events = await this.authService.getUserEvents(userId, 1, dateFrom, dateTo, 'LOGIN').toPromise();
      
      if (Array.isArray(events) && events.length > 0) {
        const loginEvent = events[0];
        if (loginEvent && loginEvent.time) {
          return loginEvent.time;
        }
      }
    } catch (error) {
      console.error(`Error fetching last login for user ${userId}:`, error);
      // Silently fail - don't show error for each user
    }
    return null;
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

  /** Closes only once the server has saved; a failure keeps the dialog open and shows the reason. */
  async saveRole(): Promise<void> {
    this.submitted = true;
    if (!this.appRole.name?.trim()) {
      return;
    }
    if (this.isRoleManagementLocked) {
      this.showUpgradeCta(this.translate.instant('plan_role_management_locked'));
      return;
    }
    const editing = !!this.appRole.id;
    if (this.isSystemRole(this.appRole.name)) {
      this.showSystemRoleImmutableMessage(editing ? 'system_role_immutable' : 'system_role_name_reserved');
      return;
    }
    try {
      if (editing) {
        await firstValueFrom(await this.authService.updateRole(this.appRole.name, this.appRole));
      } else {
        await firstValueFrom(await this.authService.saveRole(this.appRole));
      }
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: httpErrorMessage(err, this.translate.instant(editing ? 'error_while_updating_role' : 'error_while_creating_role')),
        life: 5000
      });
      return;
    }
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant(editing ? 'role_updated' : 'role_created'),
      life: 3000
    });
    this.roleDialog = false;
    this.appRole = {};
    this.submitted = false;
    this.onGetAllRoles();
  }

  findIndexById(id: string): number {
    let index = -1;
    for (let i = 0; i < this.users.length; i++) {
      if (this.users[i].id === id) {
        index = i;
        break;
      }
    }

    return index;
  }


  @ViewChild('dt') dt!: Table;
  @ViewChild('dtRoles') dtRoles!: Table;

  onGlobalFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    // Filter the appropriate table based on active tab
    if (this.activeItem?.icon === 'pi pi-fw pi-user' && this.dt) {
      this.dt.filterGlobal(value, 'contains');
    } else if (this.activeItem?.icon === 'pi pi-fw pi-shield' && this.dtRoles) {
      this.dtRoles.filterGlobal(value, 'contains');
    }
  }




  clear(table: Table) {
    table.clear();
  }


  onGetAllRoles() {
    if (this.isRoleManagementLocked) {
      this.appRoles = [];
      this.rolesLoading = false;
      this.rolesInitialLoad = false;
      return;
    }
    this.rolesLoading = true;
    this.authService.getRoles()
      .pipe(finalize(() => {
        this.rolesLoading = false;
        this.rolesInitialLoad = false;
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: (response: any) => {
          this.appRoles = response.filter((role: any) => !role.composite);
          console.log(this.appRoles);
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_roles'),
            life: 3000
          });
        }
      });
  }


  async onGetAllUsers() {
    this.isLoading = true;
    try {
      const response = await this.authService.getUsers().toPromise();
      this.users = response as User[];
      console.log(this.users)
      this.users.forEach(async (user: any) => {
        user.creationDate = new Date(<Date>user.creationDate);
        user.roles = await this.getUserRoles(user.id);
      });
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_users'),
        life: 3000
      });
    } finally {
      this.isLoading = false;
      this.isInitialLoad = false;
      this.cdr.markForCheck();
    }
  }

  async getUserRoles(userId: string): Promise<string[]> {
    try {
      const rolesResponse = await this.authService.getUserRoles(userId).toPromise();
      if (Array.isArray(rolesResponse)) {
        // Filter out roles with composite set to true
        const roles: string[] = rolesResponse.filter((role: any) => !role.composite)
          .map((role: any) => role.name);
        return roles;
      } else {
        console.error(`Invalid roles response for user with ID ${userId}:`, rolesResponse);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_while_getting_user_roles'),
          life: 3000
        });
        return [];
      }
    } catch (error) {
      console.error(`Error fetching roles for user with ID ${userId}:`, error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_user_roles'),
        life: 3000
      });
      return [];
    }
  }


  async onDeleteUser(id: any) {
    await this.authService.deleteUser(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllUsers();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('user_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_user'),
            life: 3000
          });
        },
      });
  }

  loadingUsers: boolean = false;

  async saveUserInfoAndRoleMapping(user, roles) {
    try {
      // Set loading flag to true to display the loading spinner
      this.loading = true;
      if (this.isStarterPlan) {
        user.realmRoles = ['ADMIN'];
      }

      // Step 1: Update user info
      if (user.id) {
        const updateUserResult = await this.updateUser(user.id, user);
        if (!updateUserResult) {
          throw new Error("Failed to update user information");
        }

        // Step 2: Delete existing user role mapping
        console.log("Update user role mapping");
        const deleteRoleMappingResult = await this.deleteUserRoleMapping(user.id, roles);
        if (!deleteRoleMappingResult) {
          throw new Error("Failed to update user role mapping");
        }
      } else {
        // Capture the password now: saveUser() resets this.userCredential right after
        // it invokes us (without awaiting), so read it before the first await.
        const newPassword = this.userCredential?.value;

        // Create the user WITHOUT an embedded credential. Passwords embedded in the
        // Keycloak user-creation payload are unreliable — Keycloak can silently drop
        // the credential (e.g. when declarative User Profile rejects unmanaged
        // attributes), leaving the account with no usable password. We set it via the
        // dedicated reset-password endpoint below instead (same path the KC admin uses).
        this.user.credentials = [];
        // Add the user
        console.log(user)
        const addedUser = await this.addUser(user);
        if (!addedUser) {
          throw new Error("Failed to create user information");
        }

        // Find the newly added user in the updated list using their unique identifier
        const newlyAddedUser = this.users.find(element => element.username === user.username);
        if (newlyAddedUser) {
          user.id = newlyAddedUser.id;
          console.log(user.id)
        } else {
          throw new Error("Failed to retrieve the ID of the newly added user");
        }

        // Set the password via reset-password so the credential is guaranteed to stick.
        const passwordSet = await this.setUserPassword(user.id, newPassword);
        if (!passwordSet) {
          throw new Error("Failed to set user password");
        }
      }

      // Step 3: Update user role mapping (not available in STARTER).
      if (!this.isRoleManagementLocked) {
        console.log("Update user role mapping");
        const updateRoleMappingResult = await this.updateUserRoleMapping(user.id, roles);
        if (!updateRoleMappingResult) {
          throw new Error("Failed to update user role mapping");
        }
      }
      await this.onGetAllUsers();

      // All transactions are done, set loading flag to false
      this.loading = false;
    } catch (error) {
      console.error("Error:", error);
      // Set loading flag to false in case of error
      this.loading = false;
    }
  }


  async updateUser(id: any, user: any): Promise<boolean> {
    try {
      const response = await this.authService.updateUser(id, user).toPromise();
      console.log(response);
      await this.onGetAllUsers();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('user_updated'),
        life: 3000
      });
      return true;
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_user'),
        life: 3000
      });
      return false;
    }
  }
  async addUser(user: any): Promise<boolean> {
    try {
      // Wait for the response from saveUser
      const response = await this.authService.saveUser(user).toPromise();
      console.log(response);

      // Wait for the list of users to be updated
      await this.onGetAllUsers();

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('user_created'),
        life: 3000
      });

      return true;
    } catch (error) {
      console.log(error);
      if (this.isLicenseUpgradeError(error)) {
        this.showUpgradeCta(this.translate.instant('plan_limit_reached_users', { count: this.maxUsersCap ?? 1 }));
      }
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_creating_user'),
        life: 3000
      });
      return false;
    }
  }

  async setUserPassword(id: any, password: string): Promise<boolean> {
    try {
      const credential = { type: 'password', value: password, temporary: false };
      await this.authService.changePassword(id, credential).toPromise();
      return true;
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_creating_user'),
        life: 3000
      });
      return false;
    }
  }

  async updateUserRoleMapping(id: any, role: any): Promise<boolean> {
    if (this.isRoleManagementLocked) {
      this.showUpgradeCta(this.translate.instant('plan_role_management_locked'));
      return false;
    }
    try {
      const response = await this.authService.saveUserRolesMapping(id, role).toPromise();
      console.log(response);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('user_roles_updated'),
        life: 3000
      });
      return true;
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_updating_user_roles'),
        life: 3000
      });
      return false;
    }
  }

  async deleteUserRoleMapping(id: any, role: any): Promise<boolean> {
    if (this.isRoleManagementLocked) {
      this.showUpgradeCta(this.translate.instant('plan_role_management_locked'));
      return false;
    }
    try {
      const response = await this.authService.deleteUserRolesMapping(id, role).toPromise();
      console.log(response);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('user_roles_deleted'),
        life: 3000
      });
      return true;
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_deleting_user_roles'),
        life: 3000
      });
      return false;
    }
  }


  async onDeleteRole(id: any) {
    if (this.isRoleManagementLocked) {
      this.showUpgradeCta(this.translate.instant('plan_role_management_locked'));
      return;
    }
    if (this.isSystemRole(id)) {
      this.showSystemRoleImmutableMessage();
      return;
    }
    await this.authService.deleteRole(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllRoles();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('role_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_deleting_role'),
            life: 3000
          });
        },
      });
  }



  lockUser(arg0: any) {
    throw new Error('Method not implemented.');
  }

  isSystemRole(roleName: string | undefined): boolean {
    if (!roleName) return false;
    return this.systemRoleNames.includes(roleName.toUpperCase());
  }

  private showSystemRoleImmutableMessage(detailKey = 'system_role_immutable'): void {
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('warning'),
      detail: this.translate.instant(detailKey),
      life: 3500
    });
  }


  /** Which of the two tabs is on screen decides what is exported and what it is called. */
  private get exportingUsers(): boolean {
    return this.activeItem.icon == 'pi pi-fw pi-user';
  }

  async exportPdf(): Promise<void> {
    const titleKey = this.exportingUsers ? 'users_menu_title' : 'roles';
    await this.exportContext.withOrganizationLocale(titleKey, (header) => {
      if (this.exportingUsers) {
        this.reportingService.exportPdf(this.usersExportColumns, this.users, 'users',
          header.title, header.organizationName);
      } else {
        this.reportingService.exportPdf(this.rolesExportColumns, this.appRoles, 'roles',
          header.title, header.organizationName);
      }
    });
  }

  async exportExcel(): Promise<void> {
    const titleKey = this.exportingUsers ? 'users_menu_title' : 'roles';
    await this.exportContext.withOrganizationLocale(titleKey, (header) => {
      if (!this.exportingUsers) {
        this.reportingService.exportExcel(this.appRoles, 'roles', header);
        return;
      }
      // creationDate is dropped from the sheet; copy first so the on-screen list keeps it.
      const modifiedUsers = this.users.map(user => {
        const modifiedUser = { ...user };
        delete modifiedUser.creationDate;
        return modifiedUser;
      });
      this.reportingService.exportExcel(modifiedUsers, 'users', header);
    });
  }


}


