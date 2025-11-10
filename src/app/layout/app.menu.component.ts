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

    // --- Menu Items ---
    const inventoryItems = [
      { label: translations['suppliers_menu_title'], icon: 'pi pi-fw pi-truck', routerLink: ['/inventory/suppliers'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['customers_menu_title'], icon: 'pi pi-fw pi-users', routerLink: ['/inventory/customers'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['warehouses_menu_title'], icon: 'pi pi-fw pi-database', routerLink: ['/inventory/warehouses'], roles: ['ADMIN'] },
      { label: translations['shops_menu_title'], icon: 'pi pi-fw pi-sitemap', routerLink: ['/inventory/shops'], roles: ['ADMIN'] },
      { label: translations['categories_menu_title'], icon: 'pi pi-fw pi-tag', routerLink: ['/inventory/categories'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['products_menu_title'], icon: 'pi pi-fw pi-list', routerLink: ['/inventory/products'], roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['purchases_menu_title'], icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/inventory/purchases'], roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
    ];

    const salesItems = [
      { label: translations['orders_menu_title'], icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/sales/orders'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['returns_menu_title'], icon: 'pi pi-fw pi-replay', routerLink: ['/sales/returns'], roles: ['VENDOR', 'ADMIN'] },
    ];

    const financeItems = [
      { label: translations['payments_menu_title'], icon: 'pi pi-fw pi-credit-card', routerLink: ['/finance/payments'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['expenses_menu_title'], icon: 'pi pi-fw pi-money-bill', routerLink: ['/finance/expenses'], roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
      { label: translations['refunds_menu_title'], icon: 'pi pi-fw pi-wallet', routerLink: ['/finance/refunds'], roles: ['VENDOR', 'ADMIN'] },
      { label: translations['financial_docs_menu_title'], icon: 'pi pi-fw pi-file', routerLink: ['/finance/financial-documents'], roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] },
    ];

    const administrationItems = [
      { label: translations['users_menu_title'], icon: 'pi pi-fw pi-user', routerLink: ['/administration/users'], roles: ['ADMIN'] },
      { label: translations['settings_menu_title'], icon: 'pi pi-fw pi-wrench', routerLink: ['/administration/settings'], roles: ['ADMIN'] },
    ];

    const systemItems = [
      { label: translations['system_info'], icon: 'pi pi-fw pi-info-circle', command: () => this.layoutService.triggerSystemInfoLoad() },
      { label: translations['logout'], icon: 'pi pi-fw pi-sign-out', command: () => this.logOut() },
    ];

    // --- Menu Structure ---
    const menu: any[] = [
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
      {
        label: translations['sales'],
        icon: 'pi pi-fw pi-shopping-cart',
        items: salesItems
      },
      {
        label: translations['finance'],
        icon: 'pi pi-fw pi-dollar',
        items: financeItems
      }
    ];

    // Add administration section only for admins
    if (isAdmin) {
      menu.push({
        label: translations['system_settings'],
        icon: 'pi pi-fw pi-cog',
        items: administrationItems
      });
    }

    // Add system and logout at the end for all users
    menu.push({
      label: translations['system'],
      icon: 'pi pi-fw pi-desktop',
      items: systemItems
    });

    // Filter menu items by user roles
    this.model = this.filterMenuItems(menu, userRoles);
  }

  filterMenuItems(model: any[], userRoles: string[]): any[] {
    return model
      .map(menuItem => {
        if (menuItem.items) {
          menuItem.items = menuItem.items.filter(item => {
            return !item.roles || item.roles.some(role => userRoles.includes(role));
          });
        }
        return menuItem;
      })
      .filter(menuItem => !menuItem.items || menuItem.items.length > 0);
  }

  logOut() {
    this.keycloakService.logout(window.location.origin);
  }
}
