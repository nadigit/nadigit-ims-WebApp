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
    const isCashier = userRoles.includes('CASHIER');
    
    // CASHIER role only sees POS menu
    if (isCashier && !isAdmin) {
      this.model = [
        {
          label: translations['sales'],
          icon: 'pi pi-fw pi-shopping-cart',
          items: [
            { label: translations['pos_menu_title'], icon: 'pi pi-fw pi-desktop', routerLink: ['/pos'], routerLinkActiveOptions: { exact: false } }
          ]
        },
        {
          label: translations['system'],
          icon: 'pi pi-fw pi-desktop',
          items: [
            { label: translations['profile_page_title'] || translations['profile'] || 'Profile', icon: 'pi pi-fw pi-user', routerLink: ['/profile'], routerLinkActiveOptions: { exact: false } },
            { label: translations['system_info'], icon: 'pi pi-fw pi-info-circle', command: () => this.layoutService.triggerSystemInfoLoad() },
            { label: translations['logout'], icon: 'pi pi-fw pi-sign-out', command: () => this.logOut() }
          ]
        }
      ];
      return;
    }

    // --- Menu Items ---
    const inventoryItems = [
      { label: translations['warehouses_menu_title'], icon: 'pi pi-fw pi-database', routerLink: ['/inventory/warehouses'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['shops_menu_title'], icon: 'pi pi-fw pi-sitemap', routerLink: ['/inventory/shops'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['categories_menu_title'], icon: 'pi pi-fw pi-tag', routerLink: ['/inventory/categories'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['products_menu_title'], icon: 'pi pi-fw pi-list', routerLink: ['/inventory/products'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['warehouse_transfers_menu_title'], icon: 'pi pi-fw pi-arrow-right-arrow-left', routerLink: ['/inventory/warehouse-transfers'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['write_offs_menu_title'] || translations['write_offs'], icon: 'pi pi-fw pi-minus-circle', routerLink: ['/inventory/write-offs'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['stock_movements_menu_title'], icon: 'pi pi-fw pi-chart-line', routerLink: ['/inventory/stock-movements'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
    ];

    const purchasesItems = [
      { label: translations['purchases_menu_title'], icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/purchases/purchases'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
      { label: translations['suppliers_menu_title'], icon: 'pi pi-fw pi-truck', routerLink: ['/purchases/suppliers'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
      { label: translations['purchase_returns_menu_title'], icon: 'pi pi-fw pi-replay', routerLink: ['/purchases/purchase-returns'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
    ];

    const salesItems = [
      { label: translations['orders_menu_title'], icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/sales/orders'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['customers_menu_title'], icon: 'pi pi-fw pi-users', routerLink: ['/sales/customers'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['returns_menu_title'], icon: 'pi pi-fw pi-replay', routerLink: ['/sales/returns'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['pos_menu_title'], icon: 'pi pi-fw pi-desktop', routerLink: ['/pos'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN', 'CASHIER'] },
    ];

    const reportsItems = [
      { label: translations['reports_sales_summary'], icon: 'pi pi-fw pi-chart-bar', routerLink: ['/reports/sales'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['reports_purchase_summary'], icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/reports/purchases'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['reports_inventory_snapshot'], icon: 'pi pi-fw pi-box', routerLink: ['/reports/inventory'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['reports_profit_analysis'], icon: 'pi pi-fw pi-chart-line', routerLink: ['/reports/profit'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['credit_reports'], icon: 'pi pi-fw pi-wallet', routerLink: ['/reports/credit'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] },
    ];

    const financeItems = [
      { label: translations['sales_payments'], icon: 'pi pi-fw pi-arrow-down', routerLink: ['/finance/payments/sales'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['purchase_payments'], icon: 'pi pi-fw pi-arrow-up', routerLink: ['/finance/payments/purchase'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['expenses_menu_title'], icon: 'pi pi-fw pi-money-bill', routerLink: ['/finance/expenses'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
      { label: translations['refunds_menu_title'], icon: 'pi pi-fw pi-wallet', routerLink: ['/finance/refunds'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['purchase_credits_menu_title'], icon: 'pi pi-fw pi-wallet', routerLink: ['/finance/purchase-credits'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
      { label: translations['customer_credits_dashboard'], icon: 'pi pi-fw pi-chart-pie', routerLink: ['/finance/credit-management/dashboard'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['bank_accounts_menu_title'], icon: 'pi pi-fw pi-credit-card', routerLink: ['/finance/banking/accounts'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] },
      { label: translations['financial_docs_menu_title'], icon: 'pi pi-fw pi-file', routerLink: ['/finance/financial-documents'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] },
    ];

    const administrationItems = [
      { label: translations['users_menu_title'], icon: 'pi pi-fw pi-user', routerLink: ['/administration/users'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['pricing_menu_title'] || translations['pricing'] || 'Pricing', icon: 'pi pi-fw pi-tags', routerLink: ['/administration/pricing'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['my_company'] || 'My Company', icon: 'pi pi-fw pi-sitemap', routerLink: ['/administration/my-company'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['settings_menu_title'], icon: 'pi pi-fw pi-wrench', routerLink: ['/administration/settings'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['backups_menu_title'] || 'Backups', icon: 'pi pi-fw pi-database', routerLink: ['/administration/backups'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
    ];

    const systemItems = [
      { label: translations['profile_page_title'] || translations['profile'] || 'Profile', icon: 'pi pi-fw pi-user', routerLink: ['/profile'], routerLinkActiveOptions: { exact: false } },
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
        label: translations['purchases'],
        icon: 'pi pi-fw pi-shopping-bag',
        items: purchasesItems
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
      },
      {
        label: translations['reports_menu_title'],
        icon: 'pi pi-fw pi-book',
        items: reportsItems
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
