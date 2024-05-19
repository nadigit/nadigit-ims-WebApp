import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { MenuItem, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { User } from 'src/app/models/user';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Role } from 'src/app/models/role';
import { Credential } from 'src/app/models/credential';
import { Observable } from 'rxjs';

@Component({
  templateUrl: './users.component.html',
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


  items: MenuItem[];

  menuItems: MenuItem[] | undefined;

  activeItem: MenuItem | undefined;

  activeIndex: number = 0;

  userCreationSteps: MenuItem[] | undefined;

  selectedRole: Role;

  isUserInfoValid: boolean = false;

  isUserRoleMapped: boolean = false;

  loading: boolean = false; // Flag to indicate loading state

  constructor(
    private messageService: MessageService,
    private authService: AuthenticationService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private cdr: ChangeDetectorRef,) {
    this.items = [
      {
        label: 'New User',
        icon: 'pi pi-fw pi-user',
      },
      {
        label: 'New Role',
        icon: 'pi pi-fw pi-shield',
      },
    ];

  }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllUsers();
    this.onGetAllRoles();
    this.initializePickList();

    this.usersCols = [
      { field: 'id', header: 'ID' },
      { field: 'firstName', header: 'First Name' },
      { field: 'lastName', header: 'Last Name' },
      { field: 'username', header: 'Username' },
      { field: 'email', header: 'Email' },
      { field: 'enabled', header: 'Enabled' },
    ];
    this.rolesCols = [
      { field: 'id', header: 'ID' },
      { field: 'name', header: 'Name' },
      { field: 'description', header: 'Description' },
    ];

    this.usersExportColumns = this.usersCols.map((col) => ({ title: col.header, dataKey: col.field }));
    this.rolesExportColumns = this.rolesCols.map((col) => ({ title: col.header, dataKey: col.field }));

    this.menuItems = [
      {
        label: 'Users',
        icon: 'pi pi-fw pi-user',
      },
      {
        label: 'Roles',
        icon: 'pi pi-fw pi-shield',
      },
    ];

    this.activeItem = this.menuItems[0];

    this.userCreationSteps = [
      {
        label: 'User Information',
        //command: () => showUserRoleMapping()
      },
      {
        label: 'User Role',
        command: (event: any) => console.log(event.item.label)
      },
    ];
  }
roles:any;
async combineUserRolesData() {
  for (let user of this.users) {
    this.roles = await this.getUserRoles(user.id);
    const userRoles = this.roles.filter(role => role.userId === user.id).map(role => role.name);
    user.roles = userRoles;
  }
}

  onActiveIndexChange(event: number) {
    this.activeIndex = event;
  }

  onActiveItemChange(event: MenuItem) {
    this.activeItem = event;
    console.log(this.activeItem)
  }

  deleteSelected() {
    if (this.activeItem.label == 'Users') {
      this.deleteUsersDialog = true;
      console.log("1")
    } else {
      this.deleteRolesDialog = true;
      console.log("2")
    }
    //this.deleteUsersDialog = true;
  }

  // deleteSelectedRoles() {
  //   this.deleteRolesDialog = true;
  // }

  editUser(user: User) {
    this.user = { ...user };
    this.onGetAllRoles()
    this.initializePickList()
    this.userDialog = true;
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
    if (this.activeItem.label == 'Users') {
      this.deleteUsersDialog = false;
      await this.selectedUsers.forEach(selectedUser => this.onDeleteUser(selectedUser.id));
      this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Users Deleted', life: 3000 });
      this.selectedUsers = [];
    } else {
      this.deleteRolesDialog = false;
      await this.selectedRoles.forEach(selectedRole => this.onDeleteRole(selectedRole.name));
      this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Roles Deleted', life: 3000 });
      this.selectedRoles = [];
    }
  }

  async confirmDelete() {
    if (this.activeItem.label == 'Users') {
      this.deleteUserDialog = false;
      await this.onDeleteUser(this.user.id);
      this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Deleted', life: 3000 });
      this.user = {};
    } else {
      console.log(this.activeItem)
      this.deleteRoleDialog = false;
      await this.onDeleteRole(this.appRole.name);
      this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Role Deleted', life: 3000 });
      this.appRole = {};
    }

  }

  hideDialog() {
    if (this.activeItem.label == 'Users') {
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
    this.initializePickList()
    this.submitted = false;
    if (this.activeItem.label == 'Users') {
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
            observer.error("User roles data is not in the expected format.");
          }
          observer.complete(); // Emit completion signal
        }, error => {
          this.loading = false; // Set loading flag to false if there's an error
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
    if (this.user && this.user.username && this.user.email && this.user.lastName && this.user.firstName && this.userCredential) {
      try {
        this.onGetAllRoles()
        await this.initializePickList().toPromise();
        console.log(this.targetRoles);
        this.isUserInfoValid = true;
      } catch (error) {
        console.error('Error initializing picklist:', error);
        this.isUserInfoValid = false;
        alert("Error initializing picklist. Please try again.");
      }
    } else {
      this.isUserInfoValid = false;
      alert("Please fill up all the required user data.");
    }
  }


  async saveUser() {
    this.submitted = true;
    console.log(this.targetRoles)
    if (this.user.username.trim()) {
      delete this.user.creationDate;
      delete this.user.roles;
      if (this.user.id) {
        //delete this.user.creationDate;

        console.log(this.user)
        console.log(this.userRoles)
        this.saveUserInfoAndRoleMapping(this.user, this.targetRoles) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating user', life: 3000 })
      } else {
        this.user.credentials = [];
        console.log(this.userCredential)
        console.log(this.user.credentials)
        const response = this.saveUserInfoAndRoleMapping(this.user, this.targetRoles) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User created', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding user', life: 3000 }))
        console.log(this.user.credentials)
      }
      this.users = [...this.users];
      this.cdr.detectChanges(); // Detect changes to update the UI
      this.userDialog = false;

      this.user = {};
      this.userCredential = {};
      this.targetRoles = []
    }
    this.isUserInfoValid = false;
    this.cdr.detectChanges(); // Detect changes to update the UI

  }

  saveRole() {
    this.submitted = true;

    if (this.appRole.name.trim()) {
      if (this.appRole.id) {
        console.log(this.appRole)
        this.updateRole(this.appRole.name, this.appRole) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Role Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating role', life: 3000 })
      } else {
        this.addRole(this.appRole) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Role created', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding role', life: 3000 }))
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


  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }






  /////////////////


  clear(table: Table) {
    table.clear();
  }

  getSeverity(status: any) {
    switch (status) {
      case false:
        return 'danger';

      case true:
        return 'success';

      // case 'new':
      //     return 'info';

      // case 'negotiation':
      //     return 'warning';

      // case 'renewal':
      //     return null;

      default:
        return '';
    }
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
        }
      });
  }


  async onGetAllUsers() {
    try {
      const response = await this.authService.getUsers().toPromise();
      this.users = response as User[];
      this.users.forEach(async (user: any) => {
        user.creationDate = new Date(<Date>user.creationDate);
        user.roles = await this.getUserRoles(user.id);
      });
      console.log(this.users);
    } catch (error) {
      console.log(error);
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
        return [];
      }
    } catch (error) {
      console.error(`Error fetching roles for user with ID ${userId}:`, error);
      return [];
    }
  }
  // getUserRoles(userId) {
  //   this.authService.getUserRoles(userId)
  //     .subscribe({
  //       next: (response: any) => {
  //         console.log(response);
  //         return response;
  //       },
  //       error: (err: any) => {
  //         console.log(err)
  //       }
  //     })
  // }

  async onDeleteUser(id: any) {
    await this.authService.deleteUser(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllUsers();
        },
        error(err: any) {
          console.log(err)
        },
      })
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
      // Handle the error
      // ...
    }
  }

  
  async updateUser(id: any, user: any): Promise<boolean> {
    try {
      const response = await this.authService.updateUser(id, user).toPromise();
      console.log(response);
      await this.onGetAllUsers();
      return true;
    } catch (error) {
      console.log(error);
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
      
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  
  async updateUserRoleMapping(id: any, role: any): Promise<boolean> {
    try {
      const response = await this.authService.saveUserRolesMapping(id, role).toPromise();
      console.log(response);
      // this.onGetAllUsers();
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }

  async deleteUserRoleMapping(id: any, role: any): Promise<boolean> {
    try {
      const response = await this.authService.deleteUserRolesMapping(id, role).toPromise();
      console.log(response);
      // this.onGetAllUsers();
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  }
  // async updateUser(id: any, user: any): Promise<any> {
  //   console.log(user)
  //   await this.authService.updateUser(id, user)
  //     .subscribe({
  //       next: (response: any) => {
  //         console.log(response);
  //         this.onGetAllUsers();
  //         return true;
  //       },
  //       error(err: any) {
  //         console.log(err);
  //         return false;
  //       },
  //     })
  // }
  // async addUser(data: any): Promise<any> {
  //   await this.authService.saveUser(data)
  //     .subscribe({
  //       next: (response: any) => {
  //         console.log(response);
  //         this.onGetAllUsers();
  //         return true;
  //       },
  //       error(err: any) {
  //         console.log(err);
  //         return false;
  //       },
  //     })
  // }

  async updateRole(id: any, user: any): Promise<any> {
    console.log(user)
    await this.authService.updateRole(id, user)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllRoles();
          return true;
        },
        error(err: any) {
          console.log(err);
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
          return true;
        },
        error(err: any) {
          console.log(err);
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
        },
        error(err: any) {
          console.log(err)
        },
      })
  }

  //   clear(table: Table) {
  //     table.clear();
  // }




  lockUser(arg0: any) {
    throw new Error('Method not implemented.');
  }



  // createId(): string {
  //   let id = '';
  //   var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  //   for (var i = 0; i < 5; i++) {
  //     id += chars.charAt(Math.floor(Math.random() * chars.length));
  //   }
  //   return id;
  // }





  //   deleteUser(user: User) {
  //     this.confirmationService.confirm({
  //       message: 'Are you sure you want to delete ' + user.userName + '?',
  //       header: 'Confirm',
  //       icon: 'pi pi-exclamation-triangle',
  //       accept: () => {
  //           this.users = this.users.filter((val: any) => val.id !== user.id);
  //           this.user = {};
  //           this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Deleted', life: 3000 });
  //       }
  //   });
  //   }

  //   deleteSelectedUsers() {
  //     this.confirmationService.confirm({
  //       message: 'Are you sure you want to delete the selected user?',
  //       header: 'Confirm',
  //       icon: 'pi pi-exclamation-triangle',
  //       accept: () => {
  //           this.users = this.users.filter((val: any) => !this.selectedUsers?.includes(val));
  //           this.selectedUsers = null;
  //           this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Users Deleted', life: 3000 });
  //       }
  //   });
  //   }

  exportPdf() {
    if(this.activeItem.label =='Users')
    this.reportingService.exportPdf(this.usersExportColumns, this.users, 'users')
    else
    this.reportingService.exportPdf(this.rolesExportColumns, this.appRoles, 'roles')

  }

  exportExcel() {
    if(this.activeItem.label =='Users'){
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


