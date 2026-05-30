import { Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import { PermissionsConfig } from '../utils/permissions-config';
import { KeycloakService } from 'keycloak-angular';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {

  private userRoles: string[] = [];
  private permissions: any = {};

  constructor(
    private keycloakService: KeycloakService
  ) { 

  }

  init(userId?: string): Observable<void> {
    // Permission checks are always for the currently logged-in user. Reading another user's
    // realm role mappings requires the admin Keycloak proxy and fails for Vendor/Cashier users.
    return from(this.resolveCurrentUserRoles()).pipe(
      map((roles: string[]) => {
        this.userRoles = roles;
        this.permissions = this.calculatePermissions(this.userRoles);
      })
    );
  }

  private async resolveCurrentUserRoles(): Promise<string[]> {
    try {
      const roles = await this.keycloakService.getUserRoles();
      const normalizedRoles = this.normalizeRoleNames(roles);
      if (normalizedRoles.length > 0) {
        return normalizedRoles;
      }
    } catch (error) {
      console.warn('Unable to read roles from KeycloakService; falling back to token roles.', error);
    }

    const tokenParsed = this.keycloakService.getKeycloakInstance()?.tokenParsed as any;
    const tokenRoles: string[] = [
      ...(tokenParsed?.realm_access?.roles || []),
      ...Object.values(tokenParsed?.resource_access || {}).flatMap((resource: any) => resource?.roles || [])
    ];

    return this.normalizeRoleNames(tokenRoles);
  }

  private normalizeRoleNames(roles: any): string[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    return Array.from(new Set(
      roles
        .map((role: any) => (typeof role === 'string' ? role : role?.name))
        .filter(Boolean)
        .map((role: string) => role.trim().toUpperCase())
    ));
  }

  private calculatePermissions(roles: string[]): any {
    const combinedPermissions: Record<string, any> = {};
  
    // Iterate through each role and merge permissions
    roles.forEach(role => {
      Object.keys(PermissionsConfig).forEach(resource => {
        const resourcePermissions = (PermissionsConfig as Record<string, Record<string, Record<string, boolean>>>)[resource];
        const rolePermissions = resourcePermissions?.[role];
        if (rolePermissions) {
          if (!combinedPermissions[resource]) {
            combinedPermissions[resource] = {};
          }

          Object.entries(rolePermissions).forEach(([permission, enabled]) => {
            if (enabled === true) {
              combinedPermissions[resource][permission] = true;
            } else if (combinedPermissions[resource][permission] !== true) {
              combinedPermissions[resource][permission] = false;
            }
          });
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

  canIssueFinDocs(resource: string): boolean{
    return this.permissions[resource]?.issue ?? false;
  }

  canReadDocs(resource: string): boolean{
    return this.permissions[resource]?.read ?? false;
  }

  canConfirm(resource: string): boolean{
    return this.permissions[resource]?.confirm ?? false;
  }

  canCancel(resource: string): boolean{
    return this.permissions[resource]?.cancel ?? false;
  }

  canArchive(resource: string): boolean{
    return this.permissions[resource]?.archive ?? false;
  }

  hasPermission(resource: string, permission: string): boolean {
    return this.permissions[resource]?.[permission] ?? false;
  }

  canApprove(resource: string): boolean {
    return this.hasPermission(resource, 'approve');
  }

  canReject(resource: string): boolean {
    return this.hasPermission(resource, 'reject');
  }
}
