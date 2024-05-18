import { EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Component } from '@angular/core';
import { LayoutService } from './service/app.layout.service';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';

@Component({
    selector: 'app-menu',
    templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {

    model: any[] = [];

    userRoles: KeycloakProfile;


    constructor(public layoutService: LayoutService, public keycloakService: KeycloakService) { }

    async ngOnInit() {
        const userRoles = await this.keycloakService.getUserRoles();

        const isAdmin = userRoles.includes('ADMIN');

        if (isAdmin) {
            this.model = [
                {
                    label: 'Home',
                    items: [
                        { label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'], roles: ['ADMIN'] }
                    ]
                },

                {
                    label: 'Inventory',
                    icon: 'pi pi-fw pi-briefcase',
                    items: [
                        { label: 'Suppliers', icon: 'pi pi-fw pi-truck', routerLink: ['/pages/suppliers'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Customers', icon: 'pi pi-fw pi-users', routerLink: ['/pages/customers'], roles: ['VENDOR', 'ADMIN'] },
                        { label: 'Warehouses', icon: 'pi pi-fw pi-sitemap', routerLink: ['/pages/warehouses'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Categories', icon: 'pi pi-fw pi-tag', routerLink: ['/pages/categories'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Products', icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/pages/products'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Orders', icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/pages/orders'], roles: ['VENDOR', 'ADMIN'] },
                    ]
                },
                {
                    label: 'System Settings',
                    items: [
                        { label: 'Users & Permissions', icon: 'pi pi-fw pi-user', routerLink: ['/pages/users'], roles: ['ADMIN'] },
                        { label: 'Logout', icon: 'pi pi-fw pi-sign-out', command: () => this.logOut() },
                    ]
                },
            ];
        } else {
            this.model = [
                {
                    label: 'Inventory',
                    icon: 'pi pi-fw pi-briefcase',
                    items: [
                        { label: 'Suppliers', icon: 'pi pi-fw pi-truck', routerLink: ['/pages/suppliers'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Customers', icon: 'pi pi-fw pi-users', routerLink: ['/pages/customers'], roles: ['VENDOR', 'ADMIN'] },
                        { label: 'Warehouses', icon: 'pi pi-fw pi-sitemap', routerLink: ['/pages/warehouses'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Categories', icon: 'pi pi-fw pi-tag', routerLink: ['/pages/categories'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Products', icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/pages/products'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
                        { label: 'Orders', icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/pages/orders'], roles: ['VENDOR', 'ADMIN'] },
                    ]
                },
                {
                    label: 'System Settings',
                    items: [
                        { label: 'Users & Permissions', icon: 'pi pi-fw pi-user', routerLink: ['/pages/users'], roles: ['ADMIN'] },
                        { label: 'Logout', icon: 'pi pi-fw pi-sign-out', command: () => this.logOut(), },
                    ]
                },
            ];
        }

        // Filter the model based on user roles
        this.model = this.filterMenuItems(this.model, userRoles);
    }

    filterMenuItems(model: any[], userRoles: string[]): any[] {
        return model.map(menuItem => {
            if (menuItem.items) {
                menuItem.items = menuItem.items.filter(item => {
                    // Check if item.roles is defined and not empty
                    if (item.roles && item.roles.length > 0) {
                        return item.roles.some(role => userRoles.includes(role));
                    } else {
                        // If roles are not defined or empty, allow the item
                        return true;
                    }
                });
            }
            return menuItem;
        }).filter(menuItem => !menuItem.items || menuItem.items.length > 0);
    }

    logOut() {
        console.log("logged out");
        this.keycloakService.logout(window.location.origin);
    }

}