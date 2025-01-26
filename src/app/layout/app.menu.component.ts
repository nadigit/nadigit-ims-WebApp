import { Component, OnInit } from '@angular/core';
import { LayoutService } from './service/app.layout.service';
import { KeycloakService } from 'keycloak-angular';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  selector: 'app-menu',
  templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit {

  model: any[] = [];

  constructor(
    public layoutService: LayoutService,
    public keycloakService: KeycloakService,
    private translate: TranslateService,
    private translateService: TranslationService,
  ) { }

  async ngOnInit() {
    const userRoles = await this.keycloakService.getUserRoles();
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.setupMenu(translations, userRoles);
    });
  }

  setupMenu(translations: any, userRoles: string[]) {
    const isAdmin = userRoles.includes('ADMIN');
    
    const inventoryItems = [
      { label: translations['suppliers_menu_title'], icon: 'pi pi-fw pi-truck', routerLink: ['/pages/suppliers'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['customers_menu_title'], icon: 'pi pi-fw pi-users', routerLink: ['/pages/customers'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['warehouses_menu_title'], icon: 'pi pi-fw pi-database', routerLink: ['/pages/warehouses'], roles: ['ADMIN'] },
      { label: translations['shops_menu_title'], icon: 'pi pi-fw pi-sitemap', routerLink: ['/pages/shops'], roles: ['ADMIN'] },
      { label: translations['categories_menu_title'], icon: 'pi pi-fw pi-tag', routerLink: ['/pages/categories'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['products_menu_title'], icon: 'pi pi-fw pi-list', routerLink: ['/pages/products'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['orders_menu_title'], icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/pages/orders'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['returns_menu_title'], icon: 'pi pi-fw pi-replay', routerLink: ['/pages/returns'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['purchases_menu_title'], icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/pages/purchases'], roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
      { label: translations['expenses_menu_title'], icon: 'pi pi-fw pi-dollar', routerLink: ['/pages/expenses'], roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
    ];
  
    // Setup common structure for both admin and non-admin users
    const commonMenu = [
      {
        label: translations['home'],
        items: [
          { label: translations['dashboard'], icon: 'pi pi-fw pi-home', routerLink: ['/'], roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] }
        ]
      },
      {
        label: translations['inventory'],
        icon: 'pi pi-fw pi-briefcase',
        items: inventoryItems
      },
      // {
      //   items: [
      //     { label: translations['logout'], icon: 'pi pi-fw pi-sign-out', command: () => this.logOut() },
      //   ]
      // }
    ];

    const logoutMenu = [
      {
          items: [
              { label: translations['logout'], icon: 'pi pi-fw pi-sign-out', command: () => this.logOut() },
          ]
      }
    ];
  
    if (isAdmin) {
      // Add admin-specific items
      this.model = [
        ...commonMenu,
        {
          label: translations['system_settings'],
          items: [
            { label: translations['users_menu_title'], icon: 'pi pi-fw pi-user', routerLink: ['/pages/users'], roles: ['ADMIN'] },
            { label: translations['settings_menu_title'], icon: 'pi pi-fw pi-wrench', routerLink: ['/pages/settings'], roles: ['ADMIN'] },
          ]
        },
        ...logoutMenu,
      ];
    } else {
      // Non-admin menu remains the same as common, no need for additional check
      this.model = [
        ...commonMenu,
        ...logoutMenu, // Add logout at the end for non-admin
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
    this.keycloakService.logout(window.location.origin);
  }
}