import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { LayoutService } from './service/app.layout.service';
import { KeycloakService } from 'keycloak-angular';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ProcessModeService } from 'src/app/services/process-mode.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { SessionAuditService } from 'src/app/services/session-audit.service';

@Component({
  selector: 'app-menu',
  templateUrl: './app.menu.component.html'
})
export class AppMenuComponent implements OnInit, OnDestroy {

  model: any[] = [];

  private processFlagsSub?: Subscription;
  private licenseCapabilitiesSub?: Subscription;

  constructor(
    public layoutService: LayoutService,
    public keycloakService: KeycloakService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private processModeService: ProcessModeService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private sessionAuditService: SessionAuditService,
  ) { }

  async ngOnInit() {
    await this.processModeService.ensureLoaded();
    await this.rebuildMenuFromCurrentFlags();
    this.processFlagsSub = this.processModeService.processFlagsChanged$.subscribe(() => {
      void this.rebuildMenuFromCurrentFlags();
    });
    this.licenseCapabilitiesSub = this.licenseCapabilitiesService.capabilitiesChanged$.subscribe(() => {
      void this.rebuildMenuFromCurrentFlags();
    });
  }

  ngOnDestroy(): void {
    this.processFlagsSub?.unsubscribe();
    this.licenseCapabilitiesSub?.unsubscribe();
  }

  /** Rebuild sidebar model from latest process/POS flags (after settings save or initial load). */
  private async rebuildMenuFromCurrentFlags(): Promise<void> {
    await this.licenseCapabilitiesService.ensureLoaded();
    const userRoles = await this.keycloakService.getUserRoles();
    this.translate.getTranslation(this.translateService.getPreferredLanguage()).subscribe(translations => {
      this.setupMenu(translations, userRoles);
    });
  }

  setupMenu(translations: any, userRoles: string[]) {
    const isAdmin = userRoles.includes('ADMIN');
    const isCashier = userRoles.includes('CASHIER');
    const hasNonCashierOperationalRole = userRoles.some(role => ['ADMIN', 'VENDOR', 'WAREHOUSEMAN', 'ACCOUNTANT', 'AUDITOR'].includes(role));
    const isCashierOnly = isCashier && !hasNonCashierOperationalRole;
    const tier = this.licenseCapabilitiesService.getTier();
    const hideAiMenuBadges = tier === 'STARTER';
    
    // CASHIER role: POS when enabled; otherwise profile-only under System
    if (isCashierOnly) {
      const posEnabled = this.processModeService.posEnabled;
      const cashierMenu: any[] = [];
      if (posEnabled) {
        cashierMenu.push({
          label: translations['sales'],
          icon: 'pi pi-fw pi-shopping-cart',
          items: [
            { label: translations['pos_menu_title'], icon: 'pi pi-fw pi-desktop', routerLink: ['/pos'], routerLinkActiveOptions: { exact: false } }
          ]
        });
      }
      cashierMenu.push({
        label: translations['system'],
        icon: 'pi pi-fw pi-desktop',
        items: [
          { label: translations['profile_page_title'] || translations['profile'] || 'Profile', icon: 'pi pi-fw pi-user', routerLink: ['/profile'], routerLinkActiveOptions: { exact: false } },
          { label: translations['system_info'], icon: 'pi pi-fw pi-info-circle', command: () => this.layoutService.triggerSystemInfoLoad() },
          { label: translations['logout'], icon: 'pi pi-fw pi-sign-out', command: () => this.logOut() }
        ]
      });
      this.model = cashierMenu;
      return;
    }

    // --- Menu Items ---
    const organizationItems = [
      { label: translations['my_company'] || 'My Company', icon: 'pi pi-fw pi-building', routerLink: ['/administration/my-company'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      {
        label: translations['menu_sites_group'],
        icon: 'pi pi-fw pi-map-marker',
        items: [
          { label: translations['warehouses_menu_title'], icon: 'pi pi-fw pi-database', routerLink: ['/inventory/warehouses'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
          { label: translations['shops_menu_title'], icon: 'pi pi-fw pi-sitemap', routerLink: ['/inventory/shops'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
        ],
        roles: ['ADMIN'],
      },
    ];

    const inventoryItems = [
      {
        label: translations['menu_items_catalog_group'],
        icon: 'pi pi-fw pi-box',
        items: [
          { label: translations['categories_menu_title'], icon: 'pi pi-fw pi-tag', routerLink: ['/inventory/categories'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
          { label: translations['products_menu_title'], icon: 'pi pi-fw pi-list', routerLink: ['/inventory/products'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
          { label: translations['product_families_menu_title'], icon: 'pi pi-fw pi-sitemap', routerLink: ['/inventory/product-families'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
        ],
        roles: ['WAREHOUSEMAN', 'ADMIN'],
      },
      {
        label: translations['menu_advanced_group'] || 'Advanced',
        icon: 'pi pi-fw pi-cog',
        items: [
          {
            label: translations['pricing_menu_title'] || translations['pricing'] || 'Pricing',
            icon: 'pi pi-fw pi-tags',
            routerLink: ['/inventory/pricing'],
            routerLinkActiveOptions: { exact: false },
            roles: ['ADMIN'],
            licenseFeature: 'PRICING',
          },
          {
            label: translations['line_options_menu_title'] || translations['line_options_page_title'] || 'Line Options',
            icon: 'pi pi-fw pi-sliders-h',
            routerLink: ['/inventory/line-options'],
            routerLinkActiveOptions: { exact: false },
            roles: ['ADMIN', 'WAREHOUSEMAN'],
          },
          {
            label: translations['line_rules_menu_title'] || translations['line_rules_page_title'] || 'Line Price Rules',
            icon: 'pi pi-fw pi-percentage',
            routerLink: ['/inventory/line-price-rules'],
            routerLinkActiveOptions: { exact: false },
            roles: ['ADMIN', 'WAREHOUSEMAN'],
          },
        ],
        roles: ['ADMIN', 'WAREHOUSEMAN'],
      },
      {
        label: translations['warehouse_transfers_menu_title'],
        icon: 'pi pi-fw pi-arrow-right-arrow-left',
        routerLink: ['/inventory/warehouse-transfers'],
        routerLinkActiveOptions: { exact: false },
        roles: ['WAREHOUSEMAN', 'ADMIN'],
        licenseFeature: 'WAREHOUSE_TRANSFERS',
      },
      {
        label: translations['write_offs_menu_title'] || translations['write_offs'],
        icon: 'pi pi-fw pi-minus-circle',
        routerLink: ['/inventory/write-offs'],
        routerLinkActiveOptions: { exact: false },
        roles: ['WAREHOUSEMAN', 'ADMIN'],
        licenseFeature: 'WRITE_OFFS',
      },
      { label: translations['stock_movements_menu_title'], icon: 'pi pi-fw pi-chart-line', routerLink: ['/inventory/stock-movements'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
    ];

    const docChainRouteMatch = {
      paths: 'exact' as const,
      queryParams: 'exact' as const,
      matrixParams: 'ignored' as const,
      fragment: 'ignored' as const,
    };

    const purchaseDocChainLeaves = [
      {
        label: translations['menu_doc_chain_purchase_all'] || translations['purchase_documents_menu_title'] || translations['purchases_menu_title'],
        icon: 'pi pi-fw pi-folder-open',
        routerLink: ['/purchases/purchases'],
        queryParams: {},
        queryParamsHandling: '',
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_purchase_request'],
        icon: 'pi pi-fw pi-file-edit',
        routerLink: ['/purchases/purchases'],
        queryParams: { purchaseStatus: 'PENDING' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_purchase_po'],
        icon: 'pi pi-fw pi-shopping-bag',
        routerLink: ['/purchases/purchases'],
        queryParams: { purchaseStatus: 'APPROVED' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_purchase_receipt'],
        icon: 'pi pi-fw pi-box',
        routerLink: ['/purchases/purchases'],
        queryParams: { purchaseStatus: 'RECEIVED' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_purchase_closed'],
        icon: 'pi pi-fw pi-check-circle',
        routerLink: ['/purchases/purchases'],
        queryParams: { purchaseStatus: 'COMPLETED' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
      },
    ];

    const purchasesItems = this.processModeService.isPurchaseDocumentChain()
      ? [
          {
            label: translations['menu_doc_chain_purchase_group'] || translations['purchase_documents_menu_title'] || translations['purchases_menu_title'],
            icon: 'pi pi-fw pi-folder',
            items: purchaseDocChainLeaves,
            roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
          },
          { label: translations['suppliers_menu_title'], icon: 'pi pi-fw pi-truck', routerLink: ['/purchases/suppliers'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
          {
            label: translations['purchase_returns_menu_title'],
            icon: 'pi pi-fw pi-replay',
            routerLink: ['/purchases/purchase-returns'],
            routerLinkActiveOptions: { exact: false },
            roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
            licenseFeature: 'PURCHASE_RETURNS',
          },
        ]
      : [
          { label: translations['purchases_menu_title'], icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/purchases/purchases'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
          { label: translations['suppliers_menu_title'], icon: 'pi pi-fw pi-truck', routerLink: ['/purchases/suppliers'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'ADMIN'] },
          {
            label: translations['purchase_returns_menu_title'],
            icon: 'pi pi-fw pi-replay',
            routerLink: ['/purchases/purchase-returns'],
            routerLinkActiveOptions: { exact: false },
            roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'],
            licenseFeature: 'PURCHASE_RETURNS',
          },
        ];

    const salesDocChainLeaves = [
      {
        label: translations['menu_doc_chain_sales_all'] || translations['sales_documents_menu_title'] || translations['orders_menu_title'],
        icon: 'pi pi-fw pi-folder-open',
        routerLink: ['/sales/orders'],
        queryParams: {},
        queryParamsHandling: '',
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_sales_quotes'],
        icon: 'pi pi-fw pi-file-edit',
        routerLink: ['/sales/orders'],
        queryParams: { orderStatus: 'Ordered' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_sales_orders'],
        icon: 'pi pi-fw pi-shopping-cart',
        routerLink: ['/sales/orders'],
        queryParams: { orderStatus: 'Processing' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_sales_deliveries'],
        icon: 'pi pi-fw pi-truck',
        routerLink: ['/sales/orders'],
        queryParams: { orderStatus: 'Delivered' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: translations['menu_doc_chain_sales_invoices'],
        icon: 'pi pi-fw pi-file',
        routerLink: ['/sales/orders'],
        queryParams: { orderStatus: 'Completed' },
        routerLinkActiveOptions: docChainRouteMatch,
        roles: ['VENDOR', 'ADMIN'],
      },
    ];

    const salesItems: any[] = this.processModeService.isSalesDocumentChain()
      ? [
          {
            label: translations['menu_doc_chain_sales_group'] || translations['sales_documents_menu_title'] || translations['orders_menu_title'],
            icon: 'pi pi-fw pi-folder',
            items: salesDocChainLeaves,
            roles: ['VENDOR', 'ADMIN'],
          },
          { label: translations['customers_menu_title'], icon: 'pi pi-fw pi-users', routerLink: ['/sales/customers'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
          {
            label: translations['returns_menu_title'],
            icon: 'pi pi-fw pi-replay',
            routerLink: ['/sales/returns'],
            routerLinkActiveOptions: { exact: false },
            roles: ['VENDOR', 'ADMIN'],
            licenseFeature: 'ORDER_RETURNS',
          },
        ]
      : [
          { label: translations['orders_menu_title'], icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/sales/orders'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
          { label: translations['customers_menu_title'], icon: 'pi pi-fw pi-users', routerLink: ['/sales/customers'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
          {
            label: translations['returns_menu_title'],
            icon: 'pi pi-fw pi-replay',
            routerLink: ['/sales/returns'],
            routerLinkActiveOptions: { exact: false },
            roles: ['VENDOR', 'ADMIN'],
            licenseFeature: 'ORDER_RETURNS',
          },
        ];
    if (this.processModeService.posEnabled) {
      salesItems.push({
        label: translations['pos_menu_title'],
        icon: 'pi pi-fw pi-desktop',
        routerLink: ['/pos'],
        routerLinkActiveOptions: { exact: false },
        roles: ['VENDOR', 'ADMIN', 'CASHIER']
      });
    }

    const reportsOperationalLeaves = [
      {
        label: translations['reports_sales_summary'],
        icon: 'pi pi-fw pi-chart-bar',
        routerLink: ['/reports/sales'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
      {
        label: translations['reports_purchase_summary'],
        icon: 'pi pi-fw pi-shopping-bag',
        routerLink: ['/reports/purchases'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
      {
        label: translations['reports_top_products'],
        icon: 'pi pi-fw pi-sort-amount-down',
        routerLink: ['/reports/top-products'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
      {
        label: translations['reports_inventory_snapshot'],
        icon: 'pi pi-fw pi-box',
        routerLink: ['/reports/inventory'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
      {
        label: translations['reports_movement_title'],
        icon: 'pi pi-fw pi-flag',
        routerLink: ['/reports/product-movement'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
      {
        label: translations['batch_expiry_menu_title'],
        icon: 'pi pi-fw pi-clock',
        routerLink: ['/reports/batch-expiry'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'BATCH_MANAGEMENT',
      },
    ];

    const reportsFinancialLeaves = [
      {
        label: translations['reports_profit_analysis'],
        icon: 'pi pi-fw pi-chart-line',
        routerLink: ['/reports/profit'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
      {
        label: translations['reports_vat_declaration'],
        icon: 'pi pi-fw pi-percentage',
        routerLink: ['/reports/vat'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN', 'ACCOUNTANT'],
        licenseFeature: 'TAX_RULE_ENGINE',
      },
      {
        label: translations['reports_forecasting_title'],
        icon: 'pi pi-fw pi-bolt',
        routerLink: ['/reports/forecasting'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'AI_FORECASTING',
      },
    ];

    const reportsCreditLeaves = [
      {
        label: translations['credit_reports'],
        icon: 'pi pi-fw pi-wallet',
        routerLink: ['/reports/credit'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'],
        licenseFeature: 'REPORTS_AND_ANALYTICS',
      },
    ];

    const reportsItems = [
      {
        label: translations['menu_reports_operational_group'],
        icon: 'pi pi-fw pi-chart-bar',
        items: reportsOperationalLeaves,
        roles: ['ADMIN'],
      },
      {
        label: translations['menu_reports_financial_group'],
        icon: 'pi pi-fw pi-chart-line',
        items: reportsFinancialLeaves,
        roles: ['ADMIN'],
      },
      {
        label: translations['menu_reports_credit_group'],
        icon: 'pi pi-fw pi-shield',
        items: reportsCreditLeaves,
        roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'],
      },
    ];

    const treasuryItems = [
      {
        label: translations['treasury_overview_menu_title'],
        icon: 'pi pi-fw pi-chart-bar',
        routerLink: ['/finance/treasury'],
        routerLinkActiveOptions: { exact: true },
        roles: ['ADMIN', 'VENDOR', 'ACCOUNTANT', 'AUDITOR'],
      },
      {
        label: translations['cash_registers_menu_title'],
        icon: 'pi pi-fw pi-wallet',
        routerLink: ['/finance/treasury/cash-registers'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN', 'VENDOR', 'ACCOUNTANT', 'AUDITOR'],
      },
      {
        label: translations['bank_accounts_menu_title'],
        icon: 'pi pi-fw pi-credit-card',
        routerLink: ['/finance/banking/accounts'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'],
        licenseFeature: 'BANK_ACCOUNTS',
      },
      {
        label: translations['customer_credits_dashboard'],
        icon: 'pi pi-fw pi-chart-pie',
        routerLink: ['/finance/credit-management/dashboard'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'CUSTOMER_CREDITS',
      },
    ];

    const financeItems = [
      {
        label: translations['menu_payments_group'],
        icon: 'pi pi-fw pi-wallet',
        items: [
          { label: translations['sales_payments'], icon: 'pi pi-fw pi-arrow-down', routerLink: ['/finance/payments/sales'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
          { label: translations['purchase_payments'], icon: 'pi pi-fw pi-arrow-up', routerLink: ['/finance/payments/purchase'], routerLinkActiveOptions: { exact: false }, roles: ['VENDOR', 'ADMIN'] },
        ],
        roles: ['VENDOR', 'ADMIN'],
      },
      { label: translations['expenses_menu_title'], icon: 'pi pi-fw pi-money-bill', routerLink: ['/finance/expenses'], routerLinkActiveOptions: { exact: false }, roles: ['WAREHOUSEMAN', 'VENDOR', 'ADMIN'] },
      {
        label: translations['menu_treasury_group'],
        icon: 'pi pi-fw pi-chart-line',
        items: treasuryItems,
        roles: ['ADMIN', 'VENDOR', 'ACCOUNTANT', 'AUDITOR'],
      },
      {
        label: translations['menu_credits_refunds_group'],
        icon: 'pi pi-fw pi-replay',
        items: [
          {
            label: translations['refunds_menu_title'],
            icon: 'pi pi-fw pi-arrow-down-left',
            routerLink: ['/finance/refunds'],
            routerLinkActiveOptions: { exact: false },
            roles: ['VENDOR', 'ADMIN'],
            licenseFeature: 'REFUNDS',
          },
          {
            label: translations['purchase_credits_menu_title'],
            icon: 'pi pi-fw pi-arrow-up-left',
            routerLink: ['/finance/purchase-credits'],
            routerLinkActiveOptions: { exact: false },
            roles: ['VENDOR', 'ADMIN'],
            licenseFeature: 'PURCHASE_CREDITS',
          },
        ],
        roles: ['VENDOR', 'ADMIN'],
      },
      {
        label: translations['financial_docs_menu_title'],
        icon: 'pi pi-fw pi-file',
        routerLink: ['/finance/financial-documents'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'],
        licenseFeature: 'FINANCIAL_DOCUMENTS',
      },
    ];

    const administrationItems = [
      { label: translations['users_menu_title'], icon: 'pi pi-fw pi-user', routerLink: ['/administration/users'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      { label: translations['settings_menu_title'], icon: 'pi pi-fw pi-wrench', routerLink: ['/administration/settings'], routerLinkActiveOptions: { exact: false }, roles: ['ADMIN'] },
      {
        label: translations['backups_menu_title'] || 'Backups',
        icon: 'pi pi-fw pi-database',
        routerLink: ['/administration/backups'],
        routerLinkActiveOptions: { exact: false },
        roles: ['ADMIN'],
        licenseFeature: 'SYSTEM_BACKUPS',
      },
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
        label: translations['organization'],
        icon: 'pi pi-fw pi-building',
        items: organizationItems,
      },
      {
        label: translations['inventory'],
        icon: 'pi pi-fw pi-briefcase',
        items: inventoryItems
      },
      {
        label: translations['purchases'],
        icon: 'pi pi-fw pi-shopping-bag',
        // badge: translations['ai_powered_tag'] || 'AI powered',
        // badgeSeverity: 'info',
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
        // badge: hideAiMenuBadges ? undefined : translations['ai_powered_tag'] || 'AI powered',
        // badgeSeverity: hideAiMenuBadges ? undefined : 'info',
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
      .map((menuItem) => this.filterMenuItemNode(menuItem, userRoles))
      .filter((menuItem): menuItem is any => menuItem !== null);
  }

  /** Role-filter leaves and nested groups; drop empty parents. */
  private filterMenuItemNode(item: any, userRoles: string[]): any | null {
    const next: any = { ...item };
    if (next.items?.length) {
      next.items = next.items
        .map((child: any) => this.filterMenuItemNode(child, userRoles))
        .filter((child: any) => child !== null);
    }
    if (next.items && next.items.length === 0) {
      return null;
    }
    if (next.licenseFeature && !this.licenseCapabilitiesService.isFeatureEnabled(next.licenseFeature)) {
      return null;
    }
    if (next.roles?.length && !next.roles.some((role: string) => userRoles.includes(role))) {
      return null;
    }
    return next;
  }

  logOut() {
    void this.sessionAuditService.logout(window.location.origin);
  }
}
