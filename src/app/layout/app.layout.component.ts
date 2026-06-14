import { Component, ElementRef, HostListener, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom, interval, Subscription } from 'rxjs';
import { LayoutService } from "./service/app.layout.service";
import { AppSidebarComponent } from "./app.sidebar.component";
import { AppTopBarComponent } from './app.topbar.component';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { CashRegisterService } from '../services/cash-register.service';
import { MessageService } from 'primeng/api';
import { CashRegisterSession } from '../models/cashRegisterSession';
import { Shop } from '../models/shop';
import { Warehouse } from '../models/warehouse';
import { ShopService } from '../services/shop.service';
import { WarehouseService } from '../services/warehouse.service';
import { SupplierService } from '../services/supplier.service';
import { MaintenanceStatus } from '../models/maintenance';
import { MaintenanceService } from '../services/maintenance.service';
import { LicenseCapabilitiesService, LicenseDowngradeImpactResponse } from '../services/license-capabilities.service';
import { buildKeycloakRedirectUri } from '../utils/keycloak-redirect.util';
import { SessionAuditService } from '../services/session-audit.service';
import { NadiPilotActionDTO, NadiPilotResponseDTO, AiIntegrationService } from '../services/ai-integration.service';
import { Supplier } from '../models/supplier';
import { BRAND_ASSETS } from '../utils/brand-assets';

@Component({
    selector: 'app-layout',
    templateUrl: './app.layout.component.html',
    styleUrl: './app.layout.component.css'
})
export class AppLayoutComponent implements OnDestroy, OnInit {

    overlayMenuOpenSubscription: Subscription;
    copilotToggleSubscription?: Subscription;
    maintenancePollingSub?: Subscription;

    menuOutsideClickListener: any;

    profileMenuOutsideClickListener: any;

    auth: any = false;

    public profile?: KeycloakProfile;

    currentYear = new Date().getFullYear();
    readonly brandAssets = BRAND_ASSETS;
    daysUntilExpiration: number | null = null;
    showCashRegisterDialog = false;
    isAdmin: boolean = false;
    isVendor: boolean = false;
    isWarehouseman: boolean = false;
    isCashier: boolean = false;
    userRoles: any;
    isCashRegisterOpen = false;
    currentSession: any;

    shops: Shop[] = [];
    warehouses: Warehouse[] = [];
    suppliers: Supplier[] = [];

    licenseProgress: number | null = null;
    licenseProgressColor: string = 'bg-green-500';


    private readonly defaultFeatureKeys: string[] = [
        'feature_1',
        'feature_2',
        'feature_3',
        'feature_4',
        'feature_5',
        'feature_7',
        'feature_8',
        'feature_9',
        'feature_10',
        'feature_11',
        'feature_12',
        'feature_13',
        'feature_14',
        'feature_15',
        'feature_16',
        'feature_17',
        'feature_19',
        'feature_21',
        'feature_22',
        'feature_23',
        'feature_25',
        'feature_29'
    ];
    planFeatures: Array<{ label: string; enabled: boolean }> = [];

    @ViewChild(AppSidebarComponent) appSidebar!: AppSidebarComponent;

    @ViewChild(AppTopBarComponent) appTopbar!: AppTopBarComponent;
    @ViewChild('copilotInputField') copilotInputField?: ElementRef<HTMLTextAreaElement>;

    isPosRoute: boolean = false;
    maintenanceStatus: MaintenanceStatus | null = null;

    showLicensePlanBanner = false;
    licensePlanBannerTitle = '';
    licensePlanBannerMessage = '';
    licensePlanUsersText = '';
    licensePlanWarehousesText = '';
    licensePlanShopsText = '';
    licenseCurrentTier = '';
    licenseRegistrationKey = '';
    offlineLicenseFile: File | null = null;
    updatingLicense = false;
    showDowngradeImpactDialog = false;
    downgradeImpact: LicenseDowngradeImpactResponse | null = null;
    pendingDowngradeAction: 'offline' | 'registration' | null = null;
    copilotPrompt = '';
    copilotLoading = false;
    copilotResponse: NadiPilotResponseDTO | null = null;
    copilotHistory: Array<{ prompt: string; response: NadiPilotResponseDTO; at: string }> = [];
    copilotSelectedShopId: number | null = null;
    copilotSelectedWarehouseId: number | null = null;
    copilotSelectedSupplierId: number | null = null;
    isCopilotOpen = false;
    copilotUnreadCount = 0;
    isCopilotHistoryExpanded = false;
    selectedCopilotHistoryKey: string | null = null;
    showCopilotScopeDialog = false;
    showCopilotEvidence = false;
    readonly copilotHistoryStorageKey = 'ims.aiCopilot.history.v1';
    readonly copilotModeStorageKey = 'ims.aiCopilot.mode.v1';
    copilotMode: 'simple' | 'advanced' = 'simple';

    constructor(public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router,
        private translate: TranslateService,
        public keycloakService: KeycloakService,
        private cashRegisterService: CashRegisterService,
        private messageService: MessageService,
        private shopService: ShopService,
        private warehouseService: WarehouseService,
        private supplierService: SupplierService,
        private maintenanceService: MaintenanceService,
        private licenseCapabilitiesService: LicenseCapabilitiesService,
        private aiIntegrationService: AiIntegrationService,
        private sessionAuditService: SessionAuditService,
    ) {

        // Detect POS routes to hide sidebar/topbar
        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
            .subscribe((event: NavigationEnd) => {
                this.isPosRoute = event.url.startsWith('/pos');
            });

        // Check initial route
        this.isPosRoute = this.router.url.startsWith('/pos');

        this.overlayMenuOpenSubscription = this.layoutService.overlayOpen$.subscribe(() => {
            if (!this.menuOutsideClickListener) {
                this.menuOutsideClickListener = this.renderer.listen('document', 'click', event => {
                    const isOutsideClicked = !(this.appSidebar.el.nativeElement.isSameNode(event.target) || this.appSidebar.el.nativeElement.contains(event.target)
                        || this.appTopbar.menuButton.nativeElement.isSameNode(event.target) || this.appTopbar.menuButton.nativeElement.contains(event.target));

                    if (isOutsideClicked) {
                        this.hideMenu();
                    }
                });
            }

            if (!this.profileMenuOutsideClickListener) {
                this.profileMenuOutsideClickListener = this.renderer.listen('document', 'click', event => {
                    const isOutsideClicked = !(this.appTopbar.menu.nativeElement.isSameNode(event.target) || this.appTopbar.menu.nativeElement.contains(event.target)
                        || this.appTopbar.topbarMenuButton.nativeElement.isSameNode(event.target) || this.appTopbar.topbarMenuButton.nativeElement.contains(event.target));

                    if (isOutsideClicked) {
                        this.hideProfileMenu();
                    }
                });
            }

            if (this.layoutService.state.staticMenuMobileActive) {
                this.blockBodyScroll();
            }
        });

        this.router.events.pipe(filter(event => event instanceof NavigationEnd))
            .subscribe(() => {
                this.hideMenu();
                this.hideProfileMenu();
                this.layoutService.collapseMenuHover();
                this.closeCopilotPanel(false);
                this.loadMaintenanceStatus();
            });

        this.copilotToggleSubscription = this.layoutService.copilotToggle$.subscribe(() => {
            this.toggleCopilotPanel();
        });
    }
    async ngOnInit(): Promise<void> {
        if (this.keycloakService.isTokenExpired()) {
            await this.login();
        }

        // await this.loadCashRegisterSession();

        this.layoutService.systemInfoLoaded$.subscribe(() => {
            this.calculateDaysUntilExpiration();
        });

        await this.setUserRoles();
        await this.onGetAllShops();
        await this.onGetAllWarehouses();
        await this.onGetAllSuppliers();
        this.loadCopilotHistory();
        this.loadCopilotMode();
        this.syncCopilotUiState();
        await this.loadMaintenanceStatus();
        this.startMaintenancePolling();
        try {
            await this.licenseCapabilitiesService.ensureLoaded();
            this.buildLicensePlanBanner();
            this.buildLicenseFeatureList();
        } catch {
            this.showLicensePlanBanner = false;
            this.buildFallbackFeatureList();
        }
    }

    private buildLicensePlanBanner(): void {
        const snap = this.licenseCapabilitiesService.getSnapshot();
        if (!snap?.tier) {
            this.showLicensePlanBanner = false;
            this.licensePlanUsersText = '';
            this.licensePlanWarehousesText = '';
            this.licensePlanShopsText = '';
            this.licenseCurrentTier = '';
            return;
        }
        const limits = snap.tierLimits || {};
        const tierUpper = (snap.tier || '').toUpperCase();
        this.licenseCurrentTier = String(snap.tier).toUpperCase();
        this.licensePlanBannerTitle = this.translate.instant('license_plan_title', { tier: snap.tier });
        this.licensePlanUsersText = this.formatLicenseLimit('users', limits.maxUsers);
        this.licensePlanWarehousesText = this.formatLicenseLimit('warehouses', limits.maxWarehouses);
        this.licensePlanShopsText = this.formatLicenseLimit('shops', limits.maxShops);
        const capabilities = this.translate.instant('license_plan_includes', {
            users: this.licensePlanUsersText,
            warehouses: this.licensePlanWarehousesText,
            shops: this.licensePlanShopsText,
        });
        const upgradeHint = this.translate.instant(this.getLicenseUpgradeHintKey(tierUpper));
        const detail = `${capabilities} ${upgradeHint}`.trim();
        this.licensePlanBannerMessage = detail;
        this.showLicensePlanBanner = true;
    }

    get enabledPlanFeatures(): Array<{ label: string; enabled: boolean }> {
        return this.planFeatures.filter((feature) => feature.enabled);
    }

    get lockedPlanFeatures(): Array<{ label: string; enabled: boolean }> {
        return this.planFeatures.filter((feature) => !feature.enabled);
    }

    private buildLicenseFeatureList(): void {
        const snap = this.licenseCapabilitiesService.getSnapshot();
        const features = snap?.features;
        if (!features || Object.keys(features).length === 0) {
            this.buildFallbackFeatureList();
            return;
        }

        const orderedFeatureKeys = [
            'MULTI_USER',
            'MULTI_SHOP',
            'MULTI_WAREHOUSE',
            'PRICING',
            'WAREHOUSE_TRANSFERS',
            'WRITE_OFFS',
            'BARCODE_MANAGEMENT',
            'BATCH_MANAGEMENT',
            'PURCHASE_RETURNS',
            'ORDER_RETURNS',
            'PURCHASE_CREDITS',
            'REFUNDS',
            'BANK_ACCOUNTS',
            'FINANCIAL_DOCUMENTS',
            'CUSTOMER_CREDITS',
            'REPORTS_AND_ANALYTICS',
            'AI_INVOICE_ENHANCEMENT',
            'AI_FORECASTING',
            'AI_COPILOT',
            'STOCK_SOFT_RESERVATION',
            'TAX_RULE_ENGINE',
            'BUSINESS_ACTIVITY_PROFILE',
            'TELEGRAM_NOTIFICATIONS',
            'WHATSAPP_NOTIFICATIONS',
            'SYSTEM_BACKUPS',
        ];

        const known = new Set(orderedFeatureKeys);
        const extra = Object.keys(features)
            .filter((key) => !known.has(key) && key !== 'ENTERPRISE_EXTENSIONS')
            .sort();

        const finalKeys = [...orderedFeatureKeys, ...extra];
        this.planFeatures = finalKeys.map((key) => ({
            label: this.resolveLicenseFeatureLabel(key),
            enabled: features[key] === true,
        }));
    }

    private buildFallbackFeatureList(): void {
        this.planFeatures = this.defaultFeatureKeys.map((key) => ({
            label: this.translate.instant(key),
            enabled: true,
        }));
    }

    private resolveLicenseFeatureLabel(featureKey: string): string {
        const translationKeyByFeature: Record<string, string> = {
            MULTI_USER: 'users_menu_title',
            MULTI_SHOP: 'shops_menu_title',
            MULTI_WAREHOUSE: 'warehouses_menu_title',
            PRICING: 'pricing_menu_title',
            WAREHOUSE_TRANSFERS: 'warehouse_transfers_menu_title',
            WRITE_OFFS: 'write_offs_menu_title',
            BARCODE_MANAGEMENT: 'feature_16',
            PURCHASE_RETURNS: 'purchase_returns_menu_title',
            ORDER_RETURNS: 'returns_menu_title',
            PURCHASE_CREDITS: 'purchase_credits_menu_title',
            REFUNDS: 'refunds_menu_title',
            BANK_ACCOUNTS: 'bank_accounts_menu_title',
            FINANCIAL_DOCUMENTS: 'financial_docs_menu_title',
            CUSTOMER_CREDITS: 'customer_credits_dashboard',
            REPORTS_AND_ANALYTICS: 'reports_menu_title',
            AI_COPILOT: 'ai_copilot_title',
            TAX_RULE_ENGINE: 'tax_rules_menu_title',
            TELEGRAM_NOTIFICATIONS: 'telegram_configuration',
            WHATSAPP_NOTIFICATIONS: 'whatsapp_configuration',
            SYSTEM_BACKUPS: 'backups_menu_title',
        };

        const i18nKey = translationKeyByFeature[featureKey];
        if (i18nKey) {
            return this.translate.instant(i18nKey);
        }
        return this.humanizeFeatureKey(featureKey);
    }

    private humanizeFeatureKey(featureKey: string): string {
        return featureKey
            .toLowerCase()
            .split('_')
            .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
            .join(' ');
    }

    isCurrentTier(tier: string): boolean {
        return (tier || '').toUpperCase() === this.licenseCurrentTier;
    }

    private getLicenseUpgradeHintKey(tierUpper: string): string {
        if (tierUpper === 'STARTER') {
            return 'license_plan_upgrade_starter';
        }
        if (tierUpper === 'PRO') {
            return 'license_plan_upgrade_pro';
        }
        if (tierUpper === 'BUSINESS') {
            return 'license_plan_upgrade_business';
        }
        return 'license_plan_upgrade_enterprise';
    }

    private formatLicenseLimit(entity: 'users' | 'warehouses' | 'shops', value: number | undefined): string {
        if (value == null || value < 0) {
            return this.translate.instant(`license_limit_${entity}_unlimited`);
        }
        if (value === 1) {
            return this.translate.instant(`license_limit_${entity}_single`);
        }
        return this.translate.instant(`license_limit_${entity}_multi`, { count: value });
    }

    async loadCashRegisterSession(shopId?: number): Promise<void> {
        try {
            // For admins, load session of selected shop; otherwise user's shop
            const session$ = shopId
                ? await this.cashRegisterService.getCurrentSessionByShop(shopId)
                : await this.cashRegisterService.getCurrentSession();

            this.currentSession = await firstValueFrom(session$);
            this.isCashRegisterOpen = !!this.currentSession;

            if (this.currentSession) {
                this.cashRegisterService.setCurrentSession(this.currentSession);
            }

        } catch (err) {
            console.error('❌ Error loading cash register session:', err);
            this.isCashRegisterOpen = false;
        }
    }


    promptToOpenRegister() {
        this.messageService.add({
            severity: 'warn',
            summary: 'Cash Register Closed',
            detail: 'Please open your cash register before processing sales.',
            life: 4000
        });

        this.showCashRegisterDialog = true;
    }

    calculateDaysUntilExpiration() {
        console.log('Calculating days until license expiration...');
        const expiresAtStr = this.layoutService.systemInfo?.licenseExpiresAt;
        if (!expiresAtStr) return;

        try {
            const expirationDate = new Date(expiresAtStr);
            const today = new Date();
            const diffTime = expirationDate.getTime() - today.getTime();

            if (diffTime < 0) {
                console.warn('License has already expired.');
                this.daysUntilExpiration = 0;
                this.licenseProgress = 100;
                this.licenseProgressColor = 'bg-red-500';
                return;
            }

            if (isNaN(diffTime)) {
                console.error('Invalid expiration date:', expiresAtStr);
                this.daysUntilExpiration = null;
                this.licenseProgress = null;
                return;
            }

            this.daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // 🧮 Dynamically calculate progress:
            //   - If license started 1 year ago → assume ~365 days
            //   - Otherwise estimate from remaining days
            // If backend provides start date: use it for accuracy
            const startDate = this.layoutService.systemInfo?.licenseStartAt
                ? new Date(this.layoutService.systemInfo.licenseStartAt)
                : new Date(expirationDate.getTime() - 365 * 24 * 60 * 60 * 1000); // assume 1 year license

            const totalDays = Math.ceil((expirationDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const usedDays = totalDays - this.daysUntilExpiration;
            this.licenseProgress = Math.min(100, Math.max(0, (usedDays / totalDays) * 100));

            // 🎨 Adjust color based on time left
            if (this.daysUntilExpiration > 30) {
                this.licenseProgressColor = 'bg-green-500';
            } else if (this.daysUntilExpiration > 7) {
                this.licenseProgressColor = 'bg-orange-500';
            } else {
                this.licenseProgressColor = 'bg-red-500';
            }

            console.log(`Days until expiration: ${this.daysUntilExpiration}, Progress: ${this.licenseProgress}%`);

        } catch (e) {
            console.error('Error calculating license expiration:', e);
            this.daysUntilExpiration = null;
            this.licenseProgress = null;
        }
    }

    hideMenu() {
        this.layoutService.state.overlayMenuActive = false;
        this.layoutService.state.staticMenuMobileActive = false;
        this.layoutService.state.menuHoverActive = false;
        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
            this.menuOutsideClickListener = null;
        }
        this.unblockBodyScroll();
    }

    hideProfileMenu() {
        this.layoutService.state.profileSidebarVisible = false;
        if (this.profileMenuOutsideClickListener) {
            this.profileMenuOutsideClickListener();
            this.profileMenuOutsideClickListener = null;
        }
    }

    blockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.add('blocked-scroll');
        }
        else {
            document.body.className += ' blocked-scroll';
        }
    }

    unblockBodyScroll(): void {
        if (document.body.classList) {
            document.body.classList.remove('blocked-scroll');
        }
        else {
            document.body.className = document.body.className.replace(new RegExp('(^|\\b)' +
                'blocked-scroll'.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
        }
    }

    get containerClass() {
        return {
            'layout-theme-light': this.layoutService.config().colorScheme === 'light',
            'layout-theme-dark': this.layoutService.config().colorScheme === 'dark',
            'layout-overlay': this.layoutService.config().menuMode === 'overlay',
            'layout-static': this.layoutService.config().menuMode === 'static',
            'layout-static-inactive': this.layoutService.state.staticMenuDesktopInactive && this.layoutService.config().menuMode === 'static',
            'layout-menu-compact': this.layoutService.config().menuDisplayMode === 'compact',
            'layout-menu-hover': this.layoutService.config().menuDisplayMode === 'hover',
            'layout-menu-expanded': this.layoutService.config().menuDisplayMode === 'expanded',
            'layout-overlay-active': this.layoutService.state.overlayMenuActive,
            'layout-mobile-active': this.layoutService.state.staticMenuMobileActive,
            'p-input-filled': this.layoutService.config().inputStyle === 'filled',
            'p-ripple-disabled': !this.layoutService.config().ripple
        }
    }

    ngOnDestroy() {
        if (this.overlayMenuOpenSubscription) {
            this.overlayMenuOpenSubscription.unsubscribe();
        }

        if (this.menuOutsideClickListener) {
            this.menuOutsideClickListener();
        }
        if (this.maintenancePollingSub) {
            this.maintenancePollingSub.unsubscribe();
            this.maintenancePollingSub = undefined;
        }
        if (this.copilotToggleSubscription) {
            this.copilotToggleSubscription.unsubscribe();
        }
    }

    async login() {
        await this.keycloakService.login({
            redirectUri: buildKeycloakRedirectUri()
        });
    }

    logOut() {
        void this.sessionAuditService.logout(window.location.origin + '/webconsole');
    }

    onSessionOpened(session: any): void {
        this.isCashRegisterOpen = true;
        this.currentSession = session;
        this.cashRegisterService.setCurrentSession(session);
    }

    onSessionClosed(): void {
        this.isCashRegisterOpen = false;
        this.currentSession = null;
        // this.cashRegisterService.clearCurrentSession?.();
    }

    private async setUserRoles() {
        this.userRoles = await this.keycloakService.getUserRoles();
        this.isAdmin = this.userRoles.includes('ADMIN');
        this.isVendor = this.userRoles.includes('VENDOR');
        this.isWarehouseman = this.userRoles.includes('WAREHOUSEMAN');
        this.isCashier = this.userRoles.includes('CASHIER');
        const hasNonCashierOperationalRole = this.isAdmin || this.isVendor || this.isWarehouseman || this.userRoles.includes('ACCOUNTANT') || this.userRoles.includes('AUDITOR');
        const isCashierOnly = this.isCashier && !hasNonCashierOperationalRole;
        
        // Redirect only cashier-only users to POS. Mixed-role users keep their broader navigation.
        if (isCashierOnly && !this.router.url.startsWith('/pos')) {
            this.router.navigate(['/pos']);
        }
    }

    onCashRegisterDialogClosed(): void {
        console.log('🟡 Cash register dialog closed by user');
        this.showCashRegisterDialog = false;
    }

    onCashRegisterOpened(session: CashRegisterSession): void {
        console.log('✅ Cash register opened:', session);
        this.isCashRegisterOpen = true;
        this.showCashRegisterDialog = false; // hide after open
    }

    onCashRegisterClosed(session: CashRegisterSession): void {
        console.log('🔴 Cash register closed:', session);
        this.isCashRegisterOpen = false;
    }

    async onGetAllShops() {
        await (await this.shopService.getShops())
            .subscribe({
                next: (response: any) => {
                    this.shops = response;
                },
                error: (err: any) => {
                    console.log(err)
                }
            })
    }

    async onGetAllWarehouses() {
        await this.warehouseService.loadToken();
        this.warehouseService.getWarehouses().subscribe({
            next: (response: any) => {
                this.warehouses = response || [];
            },
            error: (err: any) => {
                console.log(err);
                this.warehouses = [];
            }
        });
    }

    async onGetAllSuppliers() {
        this.supplierService.jwt = await this.keycloakService.getToken();
        this.supplierService.getSuppliers().subscribe({
            next: (response: any) => {
                this.suppliers = response || [];
            },
            error: (err: any) => {
                console.log(err);
                this.suppliers = [];
            }
        });
    }

    getLicenseSeverity(days: number): string {
        if (days > 30) return 'success';
        if (days > 0) return 'warning';
        return 'danger';
    }

    getLicenseTileClass(days: number | null): string {
        if (days === null) return 'ims-icon-tile--neutral';
        if (days > 30) return 'ims-icon-tile--green';
        if (days > 0) return 'ims-icon-tile--amber';
        return 'ims-icon-tile--danger';
    }

    hasLicenseStatus(): boolean {
        return this.daysUntilExpiration !== null || !!this.layoutService.systemInfo?.licenseExpiresAt;
    }

    getLicenseStatusSeverity(): string {
        if (this.daysUntilExpiration !== null) {
            return this.getLicenseSeverity(this.daysUntilExpiration);
        }
        return this.layoutService.systemInfo?.licenseExpiresAt ? 'success' : 'warning';
    }

    getLicenseStatusLabel(): string {
        if (this.daysUntilExpiration !== null) {
            return this.getLicenseStatusText(this.daysUntilExpiration);
        }
        if (this.layoutService.systemInfo?.licenseExpiresAt) {
            return this.translate.instant('active');
        }
        return '—';
    }

    getLicenseStatusText(days: number): string {
        if (days > 30) return this.translate.instant('active');
        if (days > 0) return this.translate.instant('expiring_soon');
        return this.translate.instant('expired');
    }

    getDomainName(url: string): string {
        return url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') || '';
    }

    async copyToClipboard(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            // Show success message (you can use a toast service)
            console.log('Copied to clipboard:', text);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    async loadMaintenanceStatus(): Promise<void> {
        try {
            const status$ = await this.maintenanceService.getStatus();
            this.maintenanceStatus = await firstValueFrom(status$);
        } catch (error) {
            // Avoid noisy errors for background polling
            this.maintenanceStatus = this.maintenanceStatus || null;
        }
    }

    startMaintenancePolling(): void {
        if (this.maintenancePollingSub) {
            return;
        }
        this.maintenancePollingSub = interval(30000).subscribe(async () => {
            await this.loadMaintenanceStatus();
        });
    }

    getMaintenanceBannerText(): string {
        if (!this.maintenanceStatus?.enabled) {
            return '';
        }
        if (this.maintenanceStatus.message) {
            return `${this.translate.instant('maintenance_banner_message')}: ${this.maintenanceStatus.message}`;
        }
        return this.translate.instant('maintenance_banner_active');
    }

    formatLicenseExpirationDate(): string {
        const expiresAtStr = this.layoutService.systemInfo?.licenseExpiresAt;
        if (!expiresAtStr) {
            return 'Loading...';
        }
        try {
            // Extract just the date part (YYYY-MM-DD) from ISO string
            const date = new Date(expiresAtStr);
            if (isNaN(date.getTime())) {
                return expiresAtStr.split('T')[0]; // Fallback: try to extract date from string
            }
            // Format as YYYY-MM-DD
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } catch (e) {
            // Fallback: try to extract date part from string
            return expiresAtStr.split('T')[0] || expiresAtStr;
        }
    }

    onOfflineLicenseSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        this.offlineLicenseFile = input?.files && input.files.length > 0 ? input.files[0] : null;
    }

    async updateRegistrationKeyLicense(): Promise<void> {
        if (!this.licenseRegistrationKey?.trim()) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('license_update_toast_title'),
                detail: this.translate.instant('license_update_registration_required'),
                life: 3500
            });
            return;
        }
        this.updatingLicense = true;
        try {
            await this.licenseCapabilitiesService.updateRegistrationKeyWithConfirmation(this.licenseRegistrationKey.trim(), false);
            await this.layoutService.loadSystemInfo();
            this.calculateDaysUntilExpiration();
            this.buildLicensePlanBanner();
            this.buildLicenseFeatureList();
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('license_update_toast_title'),
                detail: this.translate.instant('license_update_registration_success'),
                life: 4000
            });
            this.licenseRegistrationKey = '';
        } catch (error: any) {
            const downgradeRequired = error?.status === 409 && error?.error?.errorCode === 'DOWNGRADE_CONFIRMATION_REQUIRED';
            if (downgradeRequired && error?.error?.impact) {
                this.pendingDowngradeAction = 'registration';
                this.downgradeImpact = error.error.impact;
                this.showDowngradeImpactDialog = true;
                return;
            }
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('license_update_toast_title'),
                detail: error?.error?.message || this.translate.instant('license_update_registration_failed'),
                life: 5000
            });
        } finally {
            this.updatingLicense = false;
        }
    }

    async uploadOfflineLicenseFile(): Promise<void> {
        if (!this.offlineLicenseFile) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('license_update_toast_title'),
                detail: this.translate.instant('license_update_offline_select_required'),
                life: 3500
            });
            return;
        }
        const shouldHold = await this.preflightOfflineLicenseDowngradeImpact(this.offlineLicenseFile);
        if (shouldHold) {
            return;
        }
        await this.executeOfflineLicenseUpload();
    }

    async confirmDowngradeAndUpload(): Promise<void> {
        this.showDowngradeImpactDialog = false;
        if (this.pendingDowngradeAction === 'registration') {
            await this.executeRegistrationKeyUpdate(true);
            return;
        }
        await this.executeOfflineLicenseUpload(true);
    }

    cancelDowngradeUpload(): void {
        this.showDowngradeImpactDialog = false;
        this.pendingDowngradeAction = null;
    }

    hasDowngradeImpactDetails(): boolean {
        return (
            (this.downgradeImpact?.newlyBlockedFeatures?.length || 0) > 0 ||
            (this.downgradeImpact?.limitBreaches?.length || 0) > 0 ||
            (this.downgradeImpact?.newlyBlockedApiPrefixes?.length || 0) > 0
        );
    }

    getReadableBlockedFeatures(features: string[] | undefined): string[] {
        if (!features || features.length === 0) {
            return [];
        }
        return features.map((feature) => this.resolveLicenseFeatureLabel(feature));
    }

    getReadableApiModules(prefixes: string[] | undefined): string[] {
        if (!prefixes || prefixes.length === 0) {
            return [];
        }
        const map: Record<string, string> = {
            '/api/warehouse-transfers': this.translate.instant('warehouse_transfers_menu_title'),
            '/api/financial-documents': this.translate.instant('financial_docs_menu_title'),
            '/api/purchase-credits': this.translate.instant('purchase_credits_menu_title'),
            '/api/refunds': this.translate.instant('refunds_menu_title'),
            '/api/purchase-returns': this.translate.instant('purchase_returns_menu_title'),
            '/api/returns': this.translate.instant('returns_menu_title'),
            '/api/reports': this.translate.instant('reports_menu_title'),
            '/api/analysis': this.translate.instant('reports_menu_title'),
            '/api/backups': this.translate.instant('backups_menu_title'),
            '/api/restores': this.translate.instant('backups_menu_title'),
            '/api/bank-accounts': this.translate.instant('bank_accounts_menu_title'),
            '/api/inventory-write-offs': this.translate.instant('write_offs_menu_title'),
            '/api/pricing': this.translate.instant('pricing_menu_title'),
            '/api/tax-rules': this.translate.instant('tax_rules_menu_title')
        };
        return prefixes.map((prefix) => map[prefix] || prefix);
    }

    getLimitBreachLabel(resource: string): string {
        const normalized = (resource || '').trim().toLowerCase();
        if (normalized.includes('warehouse')) {
            return this.translate.instant('warehouses_menu_title');
        }
        if (normalized.includes('shop')) {
            return this.translate.instant('shops_menu_title');
        }
        if (normalized.includes('user')) {
            return this.translate.instant('users_menu_title');
        }
        return resource;
    }

    getLimitBreachActionLabel(resource: string): string {
        const normalized = (resource || '').trim().toLowerCase();
        if (normalized.includes('warehouse')) {
            return this.translate.instant('license_downgrade_action_warehouses');
        }
        if (normalized.includes('shop')) {
            return this.translate.instant('license_downgrade_action_shops');
        }
        if (normalized.includes('user')) {
            return this.translate.instant('license_downgrade_action_users');
        }
        return this.translate.instant('view_details');
    }

    getLimitBreachActionHint(resource: string): string {
        const normalized = (resource || '').trim().toLowerCase();
        if (normalized.includes('warehouse')) {
            return this.translate.instant('license_downgrade_action_hint_warehouses');
        }
        if (normalized.includes('shop')) {
            return this.translate.instant('license_downgrade_action_hint_shops');
        }
        if (normalized.includes('user')) {
            return this.translate.instant('license_downgrade_action_hint_users');
        }
        return '';
    }

    canNavigateLimitBreach(resource: string): boolean {
        return this.getLimitBreachRoute(resource) !== null;
    }

    async navigateLimitBreach(resource: string): Promise<void> {
        const route = this.getLimitBreachRoute(resource);
        if (!route) {
            return;
        }
        this.showDowngradeImpactDialog = false;
        await this.router.navigate(route);
    }

    private getLimitBreachRoute(resource: string): any[] | null {
        const normalized = (resource || '').trim().toLowerCase();
        if (normalized.includes('warehouse')) {
            return ['/inventory/warehouses'];
        }
        if (normalized.includes('shop')) {
            return ['/inventory/shops'];
        }
        if (normalized.includes('user')) {
            return ['/administration/users'];
        }
        return null;
    }

    private async preflightOfflineLicenseDowngradeImpact(file: File): Promise<boolean> {
        try {
            const targetPlan = await this.extractTargetPlan(file);
            if (!targetPlan) {
                return false;
            }
            const impact = await this.licenseCapabilitiesService.getDowngradeImpact(targetPlan);
            if (impact.downgrade) {
                this.pendingDowngradeAction = 'offline';
                this.downgradeImpact = impact;
                this.showDowngradeImpactDialog = true;
                return true;
            }
        } catch {
            // If preflight fails, allow upload attempt and surface backend errors from upload endpoint.
        }
        return false;
    }

    private async extractTargetPlan(file: File): Promise<string | null> {
        try {
            const content = await file.text();
            const parsed = JSON.parse(content);
            const plan = parsed?.license?.plan ?? parsed?.plan;
            return typeof plan === 'string' && plan.trim().length > 0 ? plan.trim() : null;
        } catch {
            return null;
        }
    }

    private async executeOfflineLicenseUpload(confirmDowngrade = false): Promise<void> {
        if (!this.offlineLicenseFile) {
            return;
        }
        this.updatingLicense = true;
        try {
            await this.licenseCapabilitiesService.uploadOfflineLicense(this.offlineLicenseFile, confirmDowngrade);
            await this.layoutService.loadSystemInfo();
            this.calculateDaysUntilExpiration();
            this.buildLicensePlanBanner();
            this.buildLicenseFeatureList();
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('license_update_toast_title'),
                detail: this.translate.instant('license_update_offline_success'),
                life: 4000
            });
            this.downgradeImpact = null;
            this.showDowngradeImpactDialog = false;
            this.pendingDowngradeAction = null;
            this.offlineLicenseFile = null;
        } catch (error: any) {
            const downgradeRequired = error?.status === 409 && error?.error?.errorCode === 'DOWNGRADE_CONFIRMATION_REQUIRED';
            if (downgradeRequired && error?.error?.impact) {
                this.pendingDowngradeAction = 'offline';
                this.downgradeImpact = error.error.impact;
                this.showDowngradeImpactDialog = true;
                return;
            }
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('license_update_toast_title'),
                detail: error?.error?.message || this.translate.instant('license_update_offline_failed'),
                life: 5000
            });
        } finally {
            this.updatingLicense = false;
        }
    }

    private async executeRegistrationKeyUpdate(confirmDowngrade = false): Promise<void> {
        if (!this.licenseRegistrationKey?.trim()) {
            return;
        }
        this.updatingLicense = true;
        try {
            await this.licenseCapabilitiesService.updateRegistrationKeyWithConfirmation(this.licenseRegistrationKey.trim(), confirmDowngrade);
            await this.layoutService.loadSystemInfo();
            this.calculateDaysUntilExpiration();
            this.buildLicensePlanBanner();
            this.buildLicenseFeatureList();
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('license_update_toast_title'),
                detail: this.translate.instant('license_update_registration_success'),
                life: 4000
            });
            this.licenseRegistrationKey = '';
            this.downgradeImpact = null;
            this.showDowngradeImpactDialog = false;
            this.pendingDowngradeAction = null;
        } catch (error: any) {
            const downgradeRequired = error?.status === 409 && error?.error?.errorCode === 'DOWNGRADE_CONFIRMATION_REQUIRED';
            if (downgradeRequired && error?.error?.impact) {
                this.pendingDowngradeAction = 'registration';
                this.downgradeImpact = error.error.impact;
                this.showDowngradeImpactDialog = true;
                return;
            }
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('license_update_toast_title'),
                detail: error?.error?.message || this.translate.instant('license_update_registration_failed'),
                life: 5000
            });
        } finally {
            this.updatingLicense = false;
        }
    }

    async askAiCopilot(): Promise<void> {
        const message = (this.copilotPrompt || '').trim();
        if (!message) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_prompt_required'),
                life: 3000
            });
            return;
        }
        this.copilotLoading = true;
        try {
            const catalogListQuestion = this.isCopilotCatalogListQuestion(message);
            const response$ = this.aiIntegrationService.askNadiPilot({
                message,
                limit: 25,
                ...(this.copilotSelectedShopId != null ? { shopId: this.copilotSelectedShopId } : {}),
                ...(!catalogListQuestion && this.copilotSelectedWarehouseId != null
                    ? { warehouseId: this.copilotSelectedWarehouseId }
                    : {}),
            });
            this.copilotResponse = await firstValueFrom(response$);
            this.copilotHistory = [
                {
                    prompt: message,
                    response: this.copilotResponse,
                    at: new Date().toISOString()
                },
                ...this.copilotHistory
            ].slice(0, 12);
            this.persistCopilotHistory();
            if (!this.isCopilotOpen) {
                this.copilotUnreadCount = Math.min(this.copilotUnreadCount + 1, 99);
                this.syncCopilotUiState();
            }
        } catch (error: any) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('ai_copilot_title'),
                detail: error?.error?.message || this.translate.instant('ai_copilot_request_failed'),
                life: 5000
            });
        } finally {
            this.copilotLoading = false;
        }
    }

    setCopilotPrompt(prompt: string): void {
        this.copilotPrompt = prompt;
    }

    setCopilotPromptByKey(key: string): void {
        this.copilotPrompt = this.translate.instant(key);
        if (!this.isCopilotOpen) {
            this.openCopilotPanel();
        }
    }

    clearCopilotHistory(): void {
        this.copilotHistory = [];
        this.isCopilotHistoryExpanded = false;
        this.selectedCopilotHistoryKey = null;
        this.persistCopilotHistory();
    }

    toggleCopilotHistoryExpanded(): void {
        this.isCopilotHistoryExpanded = !this.isCopilotHistoryExpanded;
    }

    get displayedCopilotHistory(): Array<{ prompt: string; response: NadiPilotResponseDTO; at: string }> {
        return this.isCopilotHistoryExpanded ? this.copilotHistory : this.copilotHistory.slice(0, 3);
    }

    get displayedCopilotHistoryGroups(): Array<{ label: string; items: Array<{ prompt: string; response: NadiPilotResponseDTO; at: string }> }> {
        const grouped = new Map<string, Array<{ prompt: string; response: NadiPilotResponseDTO; at: string }>>();
        for (const item of this.displayedCopilotHistory) {
            const label = this.getCopilotHistoryDateLabel(item.at);
            const items = grouped.get(label) || [];
            items.push(item);
            grouped.set(label, items);
        }
        return Array.from(grouped.entries()).map(([label, items]) => ({ label, items }));
    }

    getCopilotHistoryKey(item: { prompt: string; at: string }): string {
        return `${item.at}::${item.prompt}`;
    }

    usePromptFromHistory(prompt: string): void {
        this.copilotPrompt = prompt || '';
        setTimeout(() => this.copilotInputField?.nativeElement?.focus(), 0);
    }

    onCopilotHistoryItemSelected(item: { prompt: string; at: string }): void {
        this.selectedCopilotHistoryKey = this.getCopilotHistoryKey(item);
        this.usePromptFromHistory(item.prompt);
    }

    applyCopilotFollowUpQuestion(question: string): void {
        this.copilotPrompt = (question || '').trim();
        if (!this.copilotPrompt) {
            return;
        }
        this.askAiCopilot();
    }

    openCopilotScopeSettings(): void {
        this.showCopilotScopeDialog = true;
    }

    setCopilotMode(mode: 'simple' | 'advanced'): void {
        this.copilotMode = mode;
        this.showCopilotEvidence = mode === 'advanced';
        this.persistCopilotMode();
    }

    isCopilotAdvancedMode(): boolean {
        return this.copilotMode === 'advanced';
    }

    getVisibleCopilotWarnings(warnings: string[] | null | undefined): string[] {
        const items = Array.isArray(warnings) ? warnings.filter(w => !!(w || '').trim()) : [];
        if (this.isCopilotAdvancedMode()) {
            return items;
        }
        return items.filter(w => this.isCriticalCopilotWarning(w));
    }

    getVisibleCopilotConfidenceReasons(reasons: string[] | null | undefined): string[] {
        return Array.isArray(reasons)
            ? reasons.filter(reason => !!(reason || '').trim()).slice(0, this.isCopilotAdvancedMode() ? 8 : 3)
            : [];
    }

    getCopilotEvidenceGroups(evidence: NadiPilotResponseDTO['evidence'] | null | undefined): Array<{ title: string; items: NadiPilotResponseDTO['evidence'] }> {
        const items = Array.isArray(evidence) ? evidence : [];
        const groups = [
            {
                title: this.translate.instant('ai_copilot_evidence_scope_stock'),
                codes: ['catalogActiveProducts', 'activeProductsScoped', 'stockManagedProducts', 'serviceProductsExcluded', 'stockBasis', 'incomingStock', 'batchExpiry', 'inventoryRiskHighlights', 'dataQualityWarnings']
            },
            {
                title: this.translate.instant('ai_copilot_evidence_demand_forecast'),
                codes: ['topSelling30d', 'highRiskCount', 'predictedDemand', 'suggestedReorderTotal', 'itemRisk']
            },
            {
                title: this.translate.instant('ai_copilot_evidence_business'),
                codes: ['sales30dCount', 'sales30dAmount', 'sales30dPaid', 'sales30dOutstanding', 'sales30dGrossMargin', 'sales30dGrossMarginPercent', 'purchases30dCount', 'purchases30dAmount', 'purchases30dPaid', 'purchases30dOutstanding', 'salesTrend30dPercent', 'purchasesTrend30dPercent', 'expenses30d', 'expensesTrend30dPercent', 'refunds30dCashImpact', 'refundsTrend30dPercent', 'distinctCustomers30d', 'distinctCustomersTrend30dPercent', 'orderReturns30dCount', 'orderReturnsRefundable30d', 'writeOffCost30d', 'writeOffTrend30dPercent', 'topCustomersSales30d', 'topSuppliersPurchase30d']
            }
        ];
        const used = new Set<string>();
        const result = groups
            .map(group => {
                const groupedItems = items.filter(item => group.codes.includes(item.code));
                groupedItems.forEach(item => used.add(item.code));
                return { title: group.title, items: groupedItems };
            })
            .filter(group => group.items.length > 0);
        const otherItems = items.filter(item => !used.has(item.code));
        if (otherItems.length > 0) {
            result.push({ title: this.translate.instant('ai_copilot_evidence_other'), items: otherItems });
        }
        return result;
    }

    isCopilotCatalogListQuestion(message: string): boolean {
        const q = (message || '').toLowerCase();
        if (!q) {
            return false;
        }
        if (/how many|count|number of/.test(q)) {
            return false;
        }
        const mentionsProducts = /product|products|sku|skus|catalog|item|items/.test(q);
        const listIntent = /list|show|give me|display|enumerate|what are|which|all|names/.test(q);
        return mentionsProducts && (listIntent || /list of|list all|product list/.test(q));
    }

    showCopilotCatalogScopeHint(): boolean {
        return this.copilotSelectedWarehouseId != null;
    }

    getCopilotScopeSummary(): string {
        const shop = this.shops.find(s => s.shopId === this.copilotSelectedShopId)?.shopName || this.translate.instant('all');
        const warehouse = this.warehouses.find(w => w.warehouseId === this.copilotSelectedWarehouseId)?.name || this.translate.instant('all');
        const supplier = this.suppliers.find(s => s.supplierId === this.copilotSelectedSupplierId)?.name || this.translate.instant('select_supplier');
        return this.translate.instant('ai_copilot_scope_summary', { shop, warehouse, supplier });
    }

    getCopilotScopeCompactSummary(): string {
        const shop = this.shops.find(s => s.shopId === this.copilotSelectedShopId)?.shopName || this.translate.instant('all');
        const warehouse = this.warehouses.find(w => w.warehouseId === this.copilotSelectedWarehouseId)?.name || this.translate.instant('all');
        const supplier = this.suppliers.find(s => s.supplierId === this.copilotSelectedSupplierId)?.name || this.translate.instant('select_supplier');
        return `${shop} · ${warehouse} · ${supplier}`;
    }

    getFormattedCopilotAnswer(answer: string | null | undefined): string {
        const normalized = (answer || '').trim();
        if (!normalized) {
            return '';
        }
        return normalized
            .replace(/\s*-\s+/g, '\n- ')
            .replace(/\. ([A-Z])/g, '.\n$1')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    formatCopilotHistoryTime(iso: string): string {
        if (!iso) {
            return '';
        }
        try {
            return new Date(iso).toLocaleString();
        } catch {
            return iso;
        }
    }

    private getCopilotHistoryDateLabel(iso: string): string {
        if (!iso) {
            return this.translate.instant('history');
        }
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) {
            return this.translate.instant('history');
        }
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfEntry = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffDays = Math.round((startOfToday.getTime() - startOfEntry.getTime()) / 86400000);
        if (diffDays === 0) {
            return this.translate.instant('today');
        }
        if (diffDays === 1) {
            return this.translate.instant('yesterday');
        }
        return date.toLocaleDateString();
    }

    applyCopilotAction(action: NadiPilotActionDTO): void {
        const confirmed = window.confirm(this.translate.instant('ai_copilot_action_confirm', { title: action.title }));
        if (!confirmed) {
            return;
        }
        if (action.actionType === 'DRAFT_REORDER') {
            this.executeDraftReorderAction(action);
            return;
        }
        this.messageService.add({
            severity: 'info',
            summary: this.translate.instant('ai_copilot_title'),
            detail: this.translate.instant('ai_copilot_action_not_supported'),
            life: 3500
        });
    }

    private async executeDraftReorderAction(action: NadiPilotActionDTO): Promise<void> {
        if (!action.productId || !action.quantity || action.quantity <= 0) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_action_missing_data'),
                life: 4000
            });
            return;
        }
        if (!this.copilotSelectedSupplierId || !this.copilotSelectedShopId || !this.copilotSelectedWarehouseId) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_scope_required'),
                life: 4500
            });
            return;
        }

        this.copilotLoading = true;
        try {
            const response = await firstValueFrom(
                this.aiIntegrationService.createNadiPilotDraftReorder({
                    productId: action.productId,
                    quantity: action.quantity,
                    supplierId: this.copilotSelectedSupplierId,
                    shopId: this.copilotSelectedShopId,
                    warehouseId: this.copilotSelectedWarehouseId,
                    purpose: `AI Copilot reorder - ${action.title}`
                })
            );
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_action_created', { ref: response.reference }),
                life: 5000
            });
            this.router.navigate(['/purchases']);
        } catch (error: any) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('ai_copilot_title'),
                detail: error?.error?.message || this.translate.instant('ai_copilot_action_failed'),
                life: 5000
            });
        } finally {
            this.copilotLoading = false;
        }
    }

    async applyAllCopilotReorders(): Promise<void> {
        const result = this.copilotResponse;
        if (!result?.recommendedActions?.length) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_no_actions'),
                life: 3500
            });
            return;
        }
        if (!this.copilotSelectedSupplierId || !this.copilotSelectedShopId || !this.copilotSelectedWarehouseId) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_scope_required'),
                life: 4500
            });
            return;
        }
        const lines = result.recommendedActions
            .filter(a => a.actionType === 'DRAFT_REORDER' && a.productId && a.quantity && a.quantity > 0)
            .map(a => ({
                productId: Number(a.productId),
                quantity: Number(a.quantity)
            }));
        if (!lines.length) {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_action_missing_data'),
                life: 4000
            });
            return;
        }

        const confirmed = window.confirm(this.translate.instant('ai_copilot_apply_all_confirm', { count: lines.length }));
        if (!confirmed) {
            return;
        }
        this.copilotLoading = true;
        try {
            const response = await firstValueFrom(
                this.aiIntegrationService.createNadiPilotDraftReorderBatch({
                    lines,
                    supplierId: this.copilotSelectedSupplierId,
                    shopId: this.copilotSelectedShopId,
                    warehouseId: this.copilotSelectedWarehouseId,
                    purpose: `AI Copilot batch reorder (${lines.length} lines)`
                })
            );
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_batch_created', { ref: response.reference, count: lines.length }),
                life: 5000
            });
            this.router.navigate(['/purchases']);
        } catch (error: any) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('ai_copilot_title'),
                detail: error?.error?.message || this.translate.instant('ai_copilot_action_failed'),
                life: 5000
            });
        } finally {
            this.copilotLoading = false;
        }
    }

    hasCopilotScopeSelection(): boolean {
        return !!this.copilotSelectedSupplierId && !!this.copilotSelectedShopId && !!this.copilotSelectedWarehouseId;
    }

    getCopilotValidReorderLineCount(): number {
        const actions = this.copilotResponse?.recommendedActions || [];
        return actions.filter(a => a.actionType === 'DRAFT_REORDER' && !!a.productId && !!a.quantity && a.quantity > 0).length;
    }

    canApplyAllCopilotReorders(): boolean {
        return !this.copilotLoading && this.hasCopilotScopeSelection() && this.getCopilotValidReorderLineCount() > 0;
    }

    canApplyCopilotAction(action: NadiPilotActionDTO): boolean {
        return !this.copilotLoading
            && this.hasCopilotScopeSelection()
            && action.actionType === 'DRAFT_REORDER'
            && !!action.productId
            && !!action.quantity
            && action.quantity > 0;
    }

    private loadCopilotHistory(): void {
        try {
            const raw = localStorage.getItem(this.copilotHistoryStorageKey);
            if (!raw) {
                this.copilotHistory = [];
                return;
            }
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.copilotHistory = parsed.slice(0, 12);
            } else {
                this.copilotHistory = [];
            }
        } catch {
            this.copilotHistory = [];
        }
    }

    private persistCopilotHistory(): void {
        try {
            localStorage.setItem(this.copilotHistoryStorageKey, JSON.stringify(this.copilotHistory.slice(0, 12)));
        } catch {
            // No-op: storage may be unavailable in restricted environments.
        }
    }

    private loadCopilotMode(): void {
        try {
            const raw = localStorage.getItem(this.copilotModeStorageKey);
            if (raw === 'advanced' || raw === 'simple') {
                this.copilotMode = raw;
            } else {
                this.copilotMode = 'simple';
            }
            this.showCopilotEvidence = this.copilotMode === 'advanced';
        } catch {
            this.copilotMode = 'simple';
            this.showCopilotEvidence = false;
        }
    }

    private persistCopilotMode(): void {
        try {
            localStorage.setItem(this.copilotModeStorageKey, this.copilotMode);
        } catch {
            // No-op for restricted storage environments.
        }
    }

    private isCriticalCopilotWarning(message: string): boolean {
        const value = (message || '').toLowerCase();
        return value.includes('error')
            || value.includes('failed')
            || value.includes('exception')
            || value.includes('unable')
            || value.includes('unavailable')
            || value.includes('forbidden')
            || value.includes('denied')
            || value.includes('timeout');
    }

    toggleCopilotPanel(): void {
        if (this.isCopilotOpen) {
            this.closeCopilotPanel();
            return;
        }
        this.openCopilotPanel();
    }

    openCopilotPanel(): void {
        this.isCopilotOpen = true;
        this.copilotUnreadCount = 0;
        this.syncCopilotUiState();
        setTimeout(() => this.copilotInputField?.nativeElement?.focus(), 0);
    }

    closeCopilotPanel(restoreFocus = true): void {
        this.isCopilotOpen = false;
        this.syncCopilotUiState();
        if (restoreFocus) {
            setTimeout(() => this.appTopbar?.copilotTopbarBtn?.nativeElement?.focus(), 0);
        }
    }

    private syncCopilotUiState(): void {
        this.layoutService.setCopilotPanelOpen(this.isCopilotOpen);
        this.layoutService.setCopilotUnreadCount(this.copilotUnreadCount);
    }

    @HostListener('document:keydown.escape')
    onEscapePressed(): void {
        if (this.isCopilotOpen) {
            this.closeCopilotPanel();
        }
    }


}
