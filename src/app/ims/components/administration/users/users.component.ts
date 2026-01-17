import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { User } from 'src/app/models/user';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Role } from 'src/app/models/role';
import { Credential } from 'src/app/models/credential';
import { forkJoin, Observable } from 'rxjs';
import { ShopService } from 'src/app/services/shop.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { Warehouse } from 'src/app/models/warehouse';
import { Shop } from 'src/app/models/shop';
import { PermissionService } from 'src/app/services/permission.service';
import { Router } from '@angular/router';


@Component({
  templateUrl: './users.component.html',
  styleUrls: ['../administration.component.css'],
  providers: [MessageService]
})
export class UsersComponent implements OnInit {

  userDialog: boolean = false;

  roleDialog: boolean = false;

  deleteUserDialog: boolean = false;

  deleteUsersDialog: boolean = false;

  deleteRoleDialog: boolean = false;

  deleteRolesDialog: boolean = false;

  users: User[] = [];

  user: User = {};

  selectedUsers: User[] = [];

  selectedRoles: Role[] = [];

  submitted: boolean = false;

  usersCols: any[] = [];
  rolesCols: any[] = [];


  rowsPerPageOptions = [20, 50, 100];

  appRoles: Role[] = [];

  appRole: Role = {};

  sourceRoles: Role[] = [];

  targetRoles: Role[] = [];

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

  activeIndex: number = 0;

  userCreationSteps: MenuItem[] | undefined;

  selectedRole: Role;

  isUserInfoValid: boolean = false;

  isUserRoleMapped: boolean = false;

  loading: boolean = false; // Flag to indicate loading state

  warehouses: Warehouse[] = [];

  shops: Shop[] = [];

  selectedShop: Shop = {}; // To hold selected shop IDs

  selectedWarehouse: Warehouse = {}; // To hold selected warehouse IDs
  
  posPin: string = ''; // POS PIN for user
  isLoading: boolean = true;


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
    private router: Router) {  

    }

    async ngOnInit() {
      this.isLoading = true;
  
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
  
      // Set the active menu item
      this.activeItem = this.menuItems[0];
  
      // Initialize user creation steps
      this.userCreationSteps = [
          {
              label: translations['user_information'],
              // command: () => showUserRoleMapping()
          },
          {
              label: translations['user_role'],
              command: (event: any) => console.log(event.item.label)
          },
      ];
  
      // Fetch data and initialize other components
      this.onGetAllUsers();
      this.onGetAllRoles();
      this.onGetAllWarehouses();
      this.onGetAllShops();
      this.initializePickList();
  
      this.isLoading = false;
  }
  
  
  async combineUserRolesData() {
    for (let user of this.users) {
      this.roles = await this.getUserRoles(user.id);
      const userRoles = this.roles.filter(role => role.userId === user.id).map(role => role.name);
      user.roles = userRoles;
    }
  }

  async onGetAllWarehouses() {
    await this.warehouseService.getWarehouses()
      .subscribe({
        next: (response: any) => {
          this.warehouses = response;
          console.log(this.warehouses);
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_warehouses'),
            life: 3000
          });
        }
      })
  }

  async onGetAllShops() {
    await this.shopService.getShops()
      .subscribe({
        next: (response: any) => {
          this.shops = response;
          console.log(this.shops);
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_getting_shops'),
            life: 3000
          });
        }
      })
  }

  onActiveIndexChange(event: number) {
    this.activeIndex = event;
  }

  onActiveItemChange(event: MenuItem) {
    this.activeItem = event;
    console.log(this.activeItem)
  }

  deleteSelected() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      this.deleteUsersDialog = true;
    } else {
      this.deleteRolesDialog = true;
    }
    //this.deleteUsersDialog = true;
  }

  async editUser(user: User) {
    this.user = { ...user };
    const warehouseId = Number(user.attributes?.warehouse);
    const shopId = Number(user.attributes?.shop);
    
    // Load POS PIN from user attributes
    this.posPin = user.attributes?.posPin || '';
    try {
        // Use forkJoin to combine both observables
        const result = await forkJoin({
            warehouse: this.warehouseService.getWarehouse(warehouseId),
            shop: this.shopService.getShop(shopId)
        }).toPromise();

        this.selectedWarehouse = result.warehouse;
        this.selectedShop = result.shop;

    } catch (error) {
        console.error(error);
        this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_loading_user_data'),
            life: 3000
        });
    }

    this.onGetAllRoles();
    this.initializePickList();
    this.userDialog = true;
}

  showUserDetails(user: User) {
    this.router.navigate(['/administration/users', user.id]);
  }

  deleteUser(user: User) {
    this.deleteUserDialog = true;
    this.user = { ...user };
  }

  editRole(appRole: Role) {
    this.appRole = { ...appRole };
    this.roleDialog = true;
  }

  deleteRole(appRole: Role) {
    this.deleteRoleDialog = true;
    this.appRole = { ...appRole };
  }


  async confirmDeleteSelected() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      this.deleteUsersDialog = false;
      await this.selectedUsers.forEach(selectedUser => this.onDeleteUser(selectedUser.id));
      this.selectedUsers = [];
    } else {
      this.deleteRolesDialog = false;
      await this.selectedRoles.forEach(selectedRole => this.onDeleteRole(selectedRole.name));
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
    this.isUserInfoValid = false;
    this.isUserRoleMapped = false;
  }

  openNew() {
    this.user = {};
    this.user.enabled = true;
    this.user.credentials = [];
    this.userCredential = {};
    this.selectedShop = {};
    this.selectedWarehouse = {};
    this.posPin = '';
    this.initializePickList()
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

            // Filter sourceRoles to remove roles that exist in targetRoles
            this.sourceRoles = this.appRoles.filter(role => !this.targetRoles.some(targetRole => targetRole.id === role.id));

            console.log("Source Roles:", this.sourceRoles); // Log sourceRoles to inspect its contents

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
        // If user ID is not available, set targetRoles to an empty array
        this.targetRoles = [];
        // Set sourceRoles to include all appRoles
        this.sourceRoles = this.appRoles;
        this.loading = false;
        observer.next();
        observer.complete(); // Emit completion signal
      }
    });
  }

  onMoveToTarget(event: any): void {
    // Move the selected roles from the source to the target
    event.items.forEach((role: any) => {
      if (!this.targetRoles.includes(role)) {
        this.targetRoles.push(role);
        this.sourceRoles = this.sourceRoles.filter(r => r !== role);
      }
    });
  }

  onMoveToSource(event: any): void {
    // Move the selected roles from the target to the source
    event.items.forEach((role: any) => {
      // Assuming role.id is a unique identifier for roles
      const roleIdToRemove = role.id;

      // Filter out the role with the matching ID from targetRoles
      this.targetRoles = this.targetRoles.filter(r => r.id !== roleIdToRemove);

      // Check if the role already exists in sourceRoles
      const roleExistsInSource = this.sourceRoles.some(r => r.id === roleIdToRemove);

      // Add the role back to sourceRoles only if it doesn't already exist
      if (!roleExistsInSource) {
        const roleToAdd = this.appRoles.find(r => r.id === roleIdToRemove);
        if (roleToAdd) {
          this.sourceRoles.push(roleToAdd);
        }
      }
    });
  }

  async NextRoleDialog() {
    this.submitted=true;
    if (this.user && this.user.username && this.user.email && this.user.lastName && this.user.firstName && this.userCredential) {
      try {
      this.onGetAllRoles()
      await this.initializePickList().toPromise();
      console.log(this.targetRoles);
      this.isUserInfoValid = true;
      } catch (error) {
      console.error('Error initializing picklist:', error);
      this.isUserInfoValid = false;
      alert(this.translate.instant('error_initializing_picklist') || "Error initializing picklist. Please try again.");
      }
    } else {
      this.isUserInfoValid = false;
      this.messageService.add({ 
      severity: 'error', 
      summary: this.translate.instant('error'), 
      detail: this.translate.instant('please_fill_required_user_data'), 
      life: 3000 
      });
      return;
    }
  }


  async saveUser() {
    this.submitted = true;
    console.log(this.targetRoles)
    // Ensure shops and warehouses attributes are set as arrays of strings
    this.user.attributes = this.user.attributes || {}; // Ensure attributes object exists

    this.user.attributes.shop = this.selectedShop ? this.selectedShop.shopId?.toString() : ''; // Set single shop as string
    this.user.attributes.warehouse = this.selectedWarehouse ? this.selectedWarehouse.warehouseId?.toString() : ''; // Set single warehouse as string
    this.user.attributes.posPin = this.posPin || ''; // Set POS PIN

    if (this.user.username.trim()) {
      delete this.user.creationDate;
      delete this.user.roles;
      if (this.user.id) {
        //delete this.user.creationDate;

        console.log(this.user)
        console.log(this.userRoles)
        this.saveUserInfoAndRoleMapping(this.user, this.targetRoles)
      } else {
        this.user.credentials = [];
        console.log(this.userCredential)
        console.log(this.user.credentials)
        const response = this.saveUserInfoAndRoleMapping(this.user, this.targetRoles)
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
    }
    this.isUserInfoValid = false;
    this.cdr.detectChanges(); // Detect changes to update the UI
  }

  onPosPinInput(event: any) {
    // Only allow numeric characters
    const value = event.target.value;
    this.posPin = value.replace(/[^0-9]/g, '');
  }

  saveRole() {
    this.submitted = true;

    if (this.appRole.name.trim()) {
      if (this.appRole.id) {
        console.log(this.appRole)
        this.updateRole(this.appRole.name, this.appRole)
      } else {
        this.addRole(this.appRole)
      }
      this.appRoles = [...this.appRoles];

      this.roleDialog = false;
      this.appRole = {};
    }
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
    this.authService.getRoles()
      .subscribe({
        next: (response: any) => {
          // Filter out roles with composite set to true
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
    try {
      const response = await this.authService.getUsers().toPromise();
      this.users = response as User[];
      console.log(this.users)
      this.users.forEach(async (user: any) => {
        user.creationDate = new Date(<Date>user.creationDate);
        user.roles = await this.getUserRoles(user.id);
      });
      this.isLoading = false;
    } catch (error) {
      console.log(error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_users'),
        life: 3000
      });
      this.isLoading = false;
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
        this.userCredential.temporary = false;
        this.userCredential.type = "password";
        this.user.credentials.push(this.userCredential);
        console.log(this.userCredential)
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

      }

      // Step 3: Update user role mapping
      console.log("Update user role mapping");
      const updateRoleMappingResult = await this.updateUserRoleMapping(user.id, roles);
      if (!updateRoleMappingResult) {
        throw new Error("Failed to update user role mapping");
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


  async updateRole(id: any, user: any): Promise<any> {
    console.log(user)
    await this.authService.updateRole(id, user)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllRoles();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('role_updated'),
            life: 3000
          });
          return true;
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_updating_role'),
            life: 3000
          });
          return false;
        },
      })
  }
  async addRole(data: any): Promise<any> {
    await this.authService.saveRole(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllRoles();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('role_created'),
            life: 3000
          });
          return true;
        },
        error(err: any) {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_while_creating_role'),
            life: 3000
          });
          return false;
        },
      })
  }

  async onDeleteRole(id: any) {
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


  exportPdf() {
    if (this.activeItem.icon == 'pi pi-fw pi-user')
      this.reportingService.exportPdf(this.usersExportColumns, this.users, 'users')
    else
      this.reportingService.exportPdf(this.rolesExportColumns, this.appRoles, 'roles')

  }

  exportExcel() {
    if (this.activeItem.icon == 'pi pi-fw pi-user') {
      // Clone the users array to avoid modifying the original array
      const modifiedUsers = this.users.map(user => {
        // Create a copy of the user object to modify
        const modifiedUser = { ...user };

        // Remove the column you want to exclude
        delete modifiedUser.creationDate;

        // Alternatively, if the columnToRemove is a property with a known name, you can use:
        // delete modifiedSupplier['columnToRemove'];

        return modifiedUser;
      });

      // Now, export the modified array to Excel
      this.reportingService.exportExcel(modifiedUsers, 'users');
    } else {
      this.reportingService.exportExcel(this.appRoles, 'roles');
    }
  }


}


