import { Injectable } from '@angular/core';
import { AuthenticationService } from './authentication.service';
import { map, Observable } from 'rxjs';
import { PermissionsConfig } from '../utils/permissions-config';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  private userRoles: string[] = [];
  private permissions: any = {};

  constructor(private authService: AuthenticationService) { 

  }

  init(userId: string): Observable<void> {
    return this.authService.getUserRoles(userId).pipe(
      map((roles: any) => {
        // Assuming roles are returned as an array of role objects
        this.userRoles = roles.map((role: { name: string }) => role.name);
        console.log('User Roles:', this.userRoles); // Log to verify the correct structure
        this.permissions = this.calculatePermissions(this.userRoles);
      })
    );
  }

  private calculatePermissions(roles: string[]): any {
    const combinedPermissions: Record<string, any> = {};
  
    // Iterate through each role and merge permissions
    roles.forEach(role => {
      Object.keys(PermissionsConfig).forEach(resource => {
        const rolePermissions = PermissionsConfig[resource][role];
        if (rolePermissions) {
          // Initialize permissions if not already done
          if (!combinedPermissions[resource]) {
            combinedPermissions[resource] = { create: false, read: false, update: false, delete: false, process: false, cash_read: false, history_read: false, products_read: false };
          }
  
          combinedPermissions[resource].create ||= rolePermissions.create;
          combinedPermissions[resource].read ||= rolePermissions.read;
          combinedPermissions[resource].update ||= rolePermissions.update;
          combinedPermissions[resource].delete ||= rolePermissions.delete;
          combinedPermissions[resource].process ||= rolePermissions.process;
          combinedPermissions[resource].cash_read ||= rolePermissions.cash_read;
          combinedPermissions[resource].history_read ||= rolePermissions.history_read;
          combinedPermissions[resource].products_read ||= rolePermissions.products_read;
          
        }
      });
    });
  
    return combinedPermissions;
  }
  
  

  canCreate(resource: string): boolean {
    return this.permissions[resource]?.create ?? false;
  }

  canRead(resource: string): boolean {
    return this.permissions[resource]?.read ?? false;
  }

  canUpdate(resource: string): boolean {
    return this.permissions[resource]?.update ?? false;
  }

  canDelete(resource: string): boolean {
    return this.permissions[resource]?.delete ?? false;
  }

  canProcess(resource: string): boolean {
    return this.permissions[resource]?.process ?? false;
  }

  canHistoryRead(resource: string): boolean {
    return this.permissions[resource]?.history_read ?? false;
  }

  canCashRead(resource: string): boolean {
    return this.permissions[resource]?.cash_read ?? false;
  }

  canListProducts(resource: string): boolean {
    return this.permissions[resource]?.products_read ?? false;
  }
}
