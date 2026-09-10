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
import { ConfirmationService, MessageService } from 'primeng/api';
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
import { TourService } from '../services/tour.service';
import { NadiPilotActionDTO, NadiPilotBriefingDTO, NadiPilotMessage, NadiPilotNavigationDTO, NadiPilotProposedActionDTO, NadiPilotResponseDTO, AiIntegrationService, AiAvailability } from '../services/ai-integration.service';
import { buildCopilotPageContext } from '../utils/copilot-page-context';
import { PurchaseImportService } from '../services/purchase-import.service';
import { ProductImportService } from '../services/product-import.service';
import { PurchaseImportOptions, PurchaseImportPreview } from '../models/purchase-import.model';
import { ImportPreview as ProductImportPreview } from '../models/product-import.model';
import { Supplier } from '../models/supplier';
import { BRAND_ASSETS } from '../utils/brand-assets';

@Component({
    selector: 'app-layout',
    templateUrl: './app.layout.component.html',
    styleUrl: './app.layout.component.css',
    providers: [ConfirmationService]
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
    @ViewChild('copilotThreadEl') copilotThreadEl?: ElementRef<HTMLElement>;
    @ViewChild('copilotFileInput') copilotFileInput?: ElementRef<HTMLInputElement>;

    // Chat attachment import flow (invoice → purchase, CSV/Excel → products or purchases)
    copilotAttachment: File | null = null;
    copilotAttachmentTarget: 'invoice' | 'purchases_csv' | 'products_csv' | null = null;
    copilotAttachmentBusy = false;
    copilotImportCreateSuppliers = false;
    copilotImportCreateProducts = false;
    copilotPurchasePreview: PurchaseImportPreview | null = null;
    copilotProductPreview: ProductImportPreview | null = null;

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

    // Voice dictation (Web Speech API) — lets the user speak into the composer.
    copilotVoiceSupported = typeof window !== 'undefined'
        && (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));
    copilotListening = false;
    private copilotRecognition: any = null;
    private copilotVoiceBaseText = '';
    copilotResponse: NadiPilotResponseDTO | null = null;
    copilotHistory: Array<{ prompt: string; response: NadiPilotResponseDTO; at: string }> = [];
    copilotSelectedShopId: number | null = null;
    copilotSelectedWarehouseId: number | null = null;
    copilotSelectedSupplierId: number | null = null;
    isCopilotOpen = false;
    copilotUnreadCount = 0;
    showCopilotScopeDialog = false;
    showCopilotEvidence = false;
    readonly copilotHistoryStorageKey = 'ims.aiCopilot.history.v1';
    readonly copilotModeStorageKey = 'ims.aiCopilot.mode.v1';
    readonly copilotWidthStorageKey = 'ims.aiCopilot.width.v1';
    /** Current user id/username — used to scope per-user localStorage so chats don't leak between users on the same browser. */
    private copilotUserId = 'default';
    copilotMode: 'simple' | 'advanced' = 'simple';
    copilotPendingPrompt: string | null = null;
    /** Key of the user turn currently being edited inline, or null when no message is being edited. */
    copilotEditingTurnKey: string | null = null;
    /** Working copy of the message text while an inline edit is in progress. */
    copilotEditDraft = '';
    copilotExpanded = false;
    copilotActionLoading = false;
    private copilotActionDoneKeys = new Set<string>();
    copilotStreaming = false;
    /** null until asked; see loadCopilotAvailability(). */
    aiAvailability: AiAvailability | null = null;
    copilotStreamingText = '';
    copilotStreamingStatus: string | null = null;
    copilotBriefing: NadiPilotBriefingDTO | null = null;
    copilotBriefingLoading = false;
    private copilotEvidenceOpenKeys = new Set<string>();
    private copilotResizeActive = false;
    readonly copilotSuggestedPrompts: Array<{ key: string; icon: string }> = [
        { key: 'ai_copilot_prompt_stockout', icon: 'pi-exclamation-circle' },
        { key: 'ai_copilot_prompt_reorder', icon: 'pi-shopping-cart' },
        { key: 'ai_copilot_prompt_risk', icon: 'pi-chart-line' },
        { key: 'ai_copilot_prompt_trends', icon: 'pi-star' },
        { key: 'ai_copilot_prompt_season', icon: 'pi-calendar' },
    ];

    constructor(public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router,
        private translate: TranslateService,
        private confirmationService: ConfirmationService,
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
        private tourService: TourService,
        private purchaseImportService: PurchaseImportService,
        private productImportService: ProductImportService,
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

        // First-login welcome tour (skipped on the cashier-only POS layout,
        // which hides the topbar/sidebar anchors the tour points at).
        if (!this.isPosRoute) {
            void this.tourService.maybeStartWelcomeTour();
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
        if (this.copilotRecognition) {
            try { this.copilotRecognition.abort(); } catch { /* ignore */ }
            this.copilotRecognition = null;
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
        // Capture the current user so per-user localStorage keys (e.g. NadiPilot chat) stay isolated.
        try {
            const profile = await this.keycloakService.loadUserProfile();
            this.copilotUserId = profile.username || profile.id || 'default';
        } catch {
            this.copilotUserId = 'default';
        }
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
        if (normalized.includes('organization')) {
            return this.translate.instant('organizations');
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
        if (normalized.includes('organization')) {
            return this.translate.instant('license_downgrade_action_organizations');
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
        if (normalized.includes('organization')) {
            return this.translate.instant('license_downgrade_action_hint_organizations');
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
        if (normalized.includes('organization')) {
            return ['/administration/my-company'];
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
        // Stop any active dictation so its final transcript is committed before we send.
        if (this.copilotListening) {
            this.stopCopilotDictation();
        }
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
        this.copilotPrompt = '';
        this.copilotPendingPrompt = message;
        this.copilotLoading = true;
        this.copilotStreaming = true;
        this.copilotStreamingText = '';
        this.copilotStreamingStatus = null;
        this.scrollCopilotThreadToBottom();

        const catalogListQuestion = this.isCopilotCatalogListQuestion(message);
        const history = this.buildCopilotConversationHistory();
        const pageContext = buildCopilotPageContext(this.router.url);
        const payload = {
            message,
            limit: 25,
            ...(this.copilotSelectedShopId != null ? { shopId: this.copilotSelectedShopId } : {}),
            ...(!catalogListQuestion && this.copilotSelectedWarehouseId != null
                ? { warehouseId: this.copilotSelectedWarehouseId }
                : {}),
            ...(history.length ? { history } : {}),
            ...(pageContext ? { pageContext } : {}),
        };

        try {
            // Preferred path: stream the answer over SSE for a live typing effect.
            const response = await this.aiIntegrationService.askNadiPilotStream(payload, {
                onStatus: area => { this.copilotStreamingStatus = this.copilotStatusLabel(area); },
                onToken: text => { this.copilotStreamingText += text; this.scrollCopilotThreadToBottom(); },
            });
            this.finalizeCopilotResponse(message, response);
        } catch (streamError) {
            // Fallback: non-streaming request (older backend, proxy without SSE, etc.).
            try {
                const response = await firstValueFrom(this.aiIntegrationService.askNadiPilot(payload));
                this.finalizeCopilotResponse(message, response);
            } catch (error: any) {
                this.messageService.add({
                    severity: 'error',
                    summary: this.translate.instant('ai_copilot_title'),
                    detail: error?.error?.message || this.translate.instant('ai_copilot_request_failed'),
                    life: 5000
                });
            }
        } finally {
            this.copilotLoading = false;
            this.copilotStreaming = false;
            this.copilotStreamingText = '';
            this.copilotStreamingStatus = null;
            this.copilotPendingPrompt = null;
            this.scrollCopilotThreadToBottom();
        }
    }

    private finalizeCopilotResponse(prompt: string, response: NadiPilotResponseDTO): void {
        this.copilotResponse = response;
        this.copilotHistory = [
            { prompt, response, at: new Date().toISOString() },
            ...this.copilotHistory
        ].slice(0, 12);
        this.persistCopilotHistory();
        if (!this.isCopilotOpen) {
            this.copilotUnreadCount = Math.min(this.copilotUnreadCount + 1, 99);
            this.syncCopilotUiState();
        }
    }

    private copilotStatusLabel(area: string): string {
        const key = 'ai_copilot_status_' + (area || 'working');
        const value = this.translate.instant(key);
        return value === key ? this.translate.instant('ai_copilot_status_working') : value;
    }

    /**
     * Builds chronological user/assistant turns from the most recent local history so the backend
     * agent has conversation memory for follow-up questions. copilotHistory is newest-first.
     */
    private buildCopilotConversationHistory(): NadiPilotMessage[] {
        const recent = this.copilotHistory.slice(0, 4).reverse();
        const turns: NadiPilotMessage[] = [];
        for (const entry of recent) {
            const prompt = (entry?.prompt || '').trim();
            const answer = (entry?.response?.answer || '').trim();
            if (prompt) {
                turns.push({ role: 'user', content: prompt });
            }
            if (answer) {
                turns.push({ role: 'assistant', content: answer });
            }
        }
        return turns;
    }

    /** Conversation turns oldest-first for the chat thread (copilotHistory is stored newest-first). */
    get copilotThread(): Array<{ prompt: string; response: NadiPilotResponseDTO; at: string }> {
        return [...this.copilotHistory].reverse();
    }

    trackCopilotTurn(_index: number, turn: { prompt: string; at: string }): string {
        return `${turn.at}::${turn.prompt}`;
    }

    onCopilotComposerKeydown(event: KeyboardEvent): void {
        // Enter sends; Shift+Enter inserts a newline.
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.askAiCopilot();
        }
    }

    /** Toggle voice dictation into the composer using the browser's Web Speech API. */
    toggleCopilotDictation(): void {
        if (this.copilotListening) {
            this.stopCopilotDictation();
        } else {
            this.startCopilotDictation();
        }
    }

    private startCopilotDictation(): void {
        if (!this.copilotVoiceSupported || this.copilotListening) {
            return;
        }
        const SpeechRecognitionImpl: any = (window as any).SpeechRecognition
            || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionImpl) {
            return;
        }

        const recognition = new SpeechRecognitionImpl();
        recognition.lang = this.copilotVoiceLocale();
        recognition.continuous = true;
        recognition.interimResults = true;

        // Keep whatever was already typed so dictation appends rather than replaces.
        this.copilotVoiceBaseText = this.copilotPrompt || '';

        recognition.onresult = (event: any) => {
            let finalText = '';
            let interimText = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0]?.transcript ?? '';
                if (event.results[i].isFinal) {
                    finalText += transcript;
                } else {
                    interimText += transcript;
                }
            }
            if (finalText) {
                this.copilotVoiceBaseText = this.appendSpokenText(this.copilotVoiceBaseText, finalText);
            }
            this.copilotPrompt = interimText
                ? this.appendSpokenText(this.copilotVoiceBaseText, interimText)
                : this.copilotVoiceBaseText;
        };

        recognition.onerror = (event: any) => {
            const err = event?.error;
            if (err === 'no-speech' || err === 'aborted') {
                return; // benign — user paused or stopped manually
            }
            const detailKey = (err === 'not-allowed' || err === 'service-not-allowed')
                ? 'ai_copilot_voice_denied'
                : 'ai_copilot_voice_error';
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant(detailKey),
                life: 4000
            });
        };

        recognition.onend = () => {
            this.copilotListening = false;
            this.copilotRecognition = null;
            // Drop any trailing interim text that never finalized.
            this.copilotPrompt = this.copilotVoiceBaseText;
            setTimeout(() => this.copilotInputField?.nativeElement?.focus(), 0);
        };

        try {
            recognition.start();
            this.copilotRecognition = recognition;
            this.copilotListening = true;
        } catch {
            this.copilotListening = false;
            this.copilotRecognition = null;
        }
    }

    private stopCopilotDictation(): void {
        if (!this.copilotRecognition) {
            this.copilotListening = false;
            return;
        }
        try {
            this.copilotRecognition.stop();
        } catch {
            /* ignore — onend still resets state */
        }
    }

    /** Join dictated text onto existing text with a single separating space when needed. */
    private appendSpokenText(base: string, addition: string): string {
        const trimmedAddition = addition.replace(/^\s+/, '');
        if (!base) {
            return trimmedAddition;
        }
        return /\s$/.test(base) ? base + trimmedAddition : base + ' ' + trimmedAddition;
    }

    /** Map the active UI language to a BCP-47 locale for speech recognition. */
    private copilotVoiceLocale(): string {
        const map: { [k: string]: string } = {
            en: 'en-US',
            fr: 'fr-FR',
            es: 'es-ES',
            ar: 'ar-SA'
        };
        const lang = (this.translate.currentLang || this.translate.defaultLang || 'en').slice(0, 2).toLowerCase();
        return map[lang] || 'en-US';
    }

    toggleCopilotExpanded(): void {
        this.copilotExpanded = !this.copilotExpanded;
        this.scrollCopilotThreadToBottom();
    }

    proposalFieldKeys(action: NadiPilotProposedActionDTO | null | undefined): string[] {
        return action?.fields ? Object.keys(action.fields) : [];
    }

    actionFieldLabel(field: string): string {
        const map: { [k: string]: string } = {
            firstName: 'first_name', lastName: 'last_name', companyName: 'company_name',
            email: 'email', phoneNumber: 'phone_number', city: 'city',
            name: 'name', amount: 'amount', purpose: 'purpose',
            customer: 'customer', order: 'order', documentType: 'ai_copilot_field_document_type',
            category: 'category', description: 'description', sellingPrice: 'selling_price',
        };
        return map[field] || field;
    }

    removeProposalLine(action: NadiPilotProposedActionDTO, index: number): void {
        if (action?.lines && index >= 0 && index < action.lines.length) {
            action.lines.splice(index, 1);
        }
    }

    // ---- Chat attachment import flow ----

    /** Whether this user's roles allow any chat-attachment import at all (shows the paperclip). */
    get copilotAttachmentTargetsAvailable(): boolean {
        return this.isAdmin || this.isWarehouseman || this.isVendor;
    }

    /** Import targets available for the attached file, filtered by file kind and user role. */
    get copilotAttachmentTargets(): Array<'invoice' | 'purchases_csv' | 'products_csv'> {
        if (!this.copilotAttachment) {
            return [];
        }
        const name = this.copilotAttachment.name.toLowerCase();
        const isDocument = /\.(pdf|png|jpe?g)$/.test(name);
        const isSheet = /\.(csv|xlsx|xls)$/.test(name);
        const targets: Array<'invoice' | 'purchases_csv' | 'products_csv'> = [];
        if (isDocument && (this.isAdmin || this.isWarehouseman || this.isVendor)) {
            targets.push('invoice');
        }
        if (isSheet) {
            if (this.isAdmin || this.isWarehouseman || this.isVendor) {
                targets.push('purchases_csv');
            }
            if (this.isAdmin || this.isWarehouseman) {
                targets.push('products_csv');
            }
        }
        return targets;
    }

    onCopilotAttachClick(): void {
        if (this.copilotAttachmentBusy) {
            return;
        }
        this.copilotFileInput?.nativeElement?.click();
    }

    onCopilotFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input?.files && input.files.length ? input.files[0] : null;
        if (input) {
            input.value = '';
        }
        if (!file) {
            return;
        }
        this.copilotAttachment = file;
        this.copilotPurchasePreview = null;
        this.copilotProductPreview = null;
        this.copilotImportCreateSuppliers = false;
        this.copilotImportCreateProducts = false;
        const targets = this.copilotAttachmentTargets;
        if (!targets.length) {
            this.copilotAttachment = null;
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_attach_unsupported'),
                life: 5000,
            });
            return;
        }
        this.copilotAttachmentTarget = targets[0];
        this.scrollCopilotThreadToBottom();
    }

    clearCopilotAttachment(): void {
        this.copilotAttachment = null;
        this.copilotAttachmentTarget = null;
        this.copilotPurchasePreview = null;
        this.copilotProductPreview = null;
        this.copilotAttachmentBusy = false;
    }

    setCopilotAttachmentTarget(target: 'invoice' | 'purchases_csv' | 'products_csv'): void {
        this.copilotAttachmentTarget = target;
        this.copilotPurchasePreview = null;
        this.copilotProductPreview = null;
    }

    /** Shared purchase-import options from the copilot scope + inline checkboxes. */
    private copilotPurchaseImportOptions(): PurchaseImportOptions {
        return {
            createMissingSuppliers: this.copilotImportCreateSuppliers,
            createMissingProducts: this.copilotImportCreateProducts,
            ...(this.copilotSelectedShopId != null ? { defaultShopId: this.copilotSelectedShopId } : {}),
            ...(this.copilotSelectedWarehouseId != null ? { defaultWarehouseId: this.copilotSelectedWarehouseId } : {}),
        };
    }

    async analyzeCopilotAttachment(): Promise<void> {
        if (!this.copilotAttachment || !this.copilotAttachmentTarget || this.copilotAttachmentBusy) {
            return;
        }
        this.copilotAttachmentBusy = true;
        try {
            if (this.copilotAttachmentTarget === 'invoice') {
                this.copilotPurchasePreview = await firstValueFrom(
                    await this.purchaseImportService.previewParsedInvoice(this.copilotAttachment, {}, this.copilotPurchaseImportOptions()));
            } else if (this.copilotAttachmentTarget === 'purchases_csv') {
                this.copilotPurchasePreview = await firstValueFrom(
                    await this.purchaseImportService.previewImport(this.copilotAttachment, 10, this.copilotPurchaseImportOptions()));
            } else {
                this.copilotProductPreview = await firstValueFrom(
                    this.productImportService.previewImport(this.copilotAttachment, 10, {
                        ...(this.copilotSelectedWarehouseId != null ? { defaultWarehouseId: this.copilotSelectedWarehouseId } : {}),
                    }));
            }
            this.scrollCopilotThreadToBottom();
        } catch (error: any) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('ai_copilot_title'),
                detail: error?.error?.message || this.translate.instant('ai_copilot_attach_analyze_failed'),
                life: 6000,
            });
        } finally {
            this.copilotAttachmentBusy = false;
        }
    }

    /** True when the analyzed attachment has something importable. */
    get canConfirmCopilotImport(): boolean {
        if (this.copilotPurchasePreview) {
            return (this.copilotPurchasePreview.estimatedPurchases || 0) > 0;
        }
        if (this.copilotProductPreview) {
            return ((this.copilotProductPreview.estimatedCreates || 0) + (this.copilotProductPreview.estimatedUpdates || 0)) > 0;
        }
        return false;
    }

    async confirmCopilotAttachmentImport(): Promise<void> {
        if (!this.copilotAttachment || !this.copilotAttachmentTarget || this.copilotAttachmentBusy) {
            return;
        }
        this.copilotAttachmentBusy = true;
        try {
            let detail = '';
            if (this.copilotAttachmentTarget === 'invoice') {
                const res = await firstValueFrom(
                    await this.purchaseImportService.importFromInvoice(this.copilotAttachment, {}, this.copilotPurchaseImportOptions()));
                detail = this.translate.instant('ai_copilot_attach_purchases_imported',
                    { purchases: res.purchasesCreated, items: res.itemsCreated });
            } else if (this.copilotAttachmentTarget === 'purchases_csv') {
                const res = await firstValueFrom(
                    await this.purchaseImportService.executeImport(this.copilotAttachment, this.copilotPurchaseImportOptions()));
                detail = this.translate.instant('ai_copilot_attach_purchases_imported',
                    { purchases: res.purchasesCreated, items: res.itemsCreated });
            } else {
                const res = await firstValueFrom(
                    this.productImportService.executeImport(this.copilotAttachment, {
                        ...(this.copilotSelectedWarehouseId != null ? { defaultWarehouseId: this.copilotSelectedWarehouseId } : {}),
                    }));
                detail = this.translate.instant('ai_copilot_attach_products_imported',
                    { created: res.created, updated: res.updated });
            }
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('ai_copilot_title'),
                detail,
                life: 6000,
            });
            this.clearCopilotAttachment();
        } catch (error: any) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('ai_copilot_title'),
                detail: error?.error?.message || this.translate.instant('ai_copilot_action_failed'),
                life: 6000,
            });
        } finally {
            this.copilotAttachmentBusy = false;
        }
    }

    /** Hands the file flow off to the full import wizard (product mapping, per-line review, options). */
    openFullImportScreen(): void {
        const target = this.copilotAttachmentTarget;
        this.clearCopilotAttachment();
        this.closeCopilotPanel(false);
        if (target === 'products_csv') {
            this.router.navigate(['/inventory/products'], { queryParams: { import: 1 } });
        } else {
            this.router.navigate(['/purchases/purchases'], { queryParams: { import: 1 } });
        }
    }

    proposalTitle(action: NadiPilotProposedActionDTO | null | undefined): string {
        if (action?.summary?.trim()) {
            return action.summary.trim();
        }
        const key = action?.type === 'create_supplier' ? 'ai_copilot_create_supplier_title'
            : action?.type === 'create_expense' ? 'ai_copilot_create_expense_title'
                : action?.type === 'create_order' ? 'ai_copilot_create_order_title'
                    : action?.type === 'create_purchase' ? 'ai_copilot_create_purchase_title'
                        : action?.type === 'compose_order' ? 'ai_copilot_compose_order_title'
                            : action?.type === 'generate_document' ? 'ai_copilot_generate_document_title'
                                : action?.type === 'create_product' ? 'ai_copilot_create_product_title'
                                    : 'ai_copilot_create_customer_title';
        return this.translate.instant(key);
    }

    isPrepareAction(action: NadiPilotProposedActionDTO | null | undefined): boolean {
        return action?.type === 'create_order' || action?.type === 'create_purchase' || action?.type === 'create_product';
    }

    proposalConfirmLabel(action: NadiPilotProposedActionDTO | null | undefined): string {
        if (action?.type === 'create_order') {
            return this.translate.instant('ai_copilot_action_prepare_order');
        }
        if (action?.type === 'create_purchase') {
            return this.translate.instant('ai_copilot_action_prepare_purchase');
        }
        if (action?.type === 'create_product') {
            return this.translate.instant('ai_copilot_action_prepare_product');
        }
        if (action?.type === 'compose_order') {
            return this.translate.instant('ai_copilot_action_create_order');
        }
        if (action?.type === 'generate_document') {
            return this.translate.instant('ai_copilot_action_generate_document');
        }
        return this.translate.instant('ai_copilot_action_confirm_create');
    }

    isCopilotActionDone(turn: { at: string; prompt: string }): boolean {
        return this.copilotActionDoneKeys.has(this.getCopilotHistoryKey(turn));
    }

    dismissCopilotProposedAction(turn: { at: string; prompt: string }): void {
        this.copilotActionDoneKeys.add(this.getCopilotHistoryKey(turn));
    }

    async confirmCopilotProposedAction(turn: { at: string; prompt: string; response: NadiPilotResponseDTO }): Promise<void> {
        const action = turn?.response?.proposedAction;
        if (!action) {
            return;
        }
        // create_order / create_purchase / create_product are "prepare + open the create screen" — navigate, no DB write here.
        if (action.type === 'create_order' || action.type === 'create_purchase' || action.type === 'create_product') {
            const f = action.fields || {};
            this.copilotActionDoneKeys.add(this.getCopilotHistoryKey(turn));
            this.closeCopilotPanel(false);
            if (action.type === 'create_product') {
                this.router.navigate(['/inventory/products'], {
                    queryParams: {
                        newProduct: 1,
                        ...(f['name'] ? { name: f['name'] } : {}),
                        ...(f['category'] ? { category: f['category'] } : {}),
                        ...(f['description'] ? { description: f['description'] } : {}),
                        ...(f['sellingPrice'] ? { sellingPrice: f['sellingPrice'] } : {}),
                    },
                });
                this.messageService.add({
                    severity: 'info',
                    summary: this.translate.instant('ai_copilot_title'),
                    detail: this.translate.instant('ai_copilot_product_prepared'),
                    life: 4000,
                });
            } else if (action.type === 'create_order') {
                this.router.navigate(['/sales/orders'], {
                    queryParams: { newOrder: 1, ...(f['customer'] ? { customer: f['customer'] } : {}) },
                });
                this.messageService.add({
                    severity: 'info',
                    summary: this.translate.instant('ai_copilot_title'),
                    detail: this.translate.instant('ai_copilot_order_prepared'),
                    life: 4000,
                });
            } else {
                this.router.navigate(['/purchases/purchases'], {
                    queryParams: { newPurchase: 1, ...(f['supplier'] ? { supplier: f['supplier'] } : {}) },
                });
                this.messageService.add({
                    severity: 'info',
                    summary: this.translate.instant('ai_copilot_title'),
                    detail: this.translate.instant('ai_copilot_purchase_prepared'),
                    life: 4000,
                });
            }
            return;
        }
        this.copilotActionLoading = true;
        try {
            const f = action.fields || {};
            let detail = '';
            if (action.type === 'create_customer') {
                const res = await firstValueFrom(this.aiIntegrationService.createNadiPilotCustomer({
                    firstName: f['firstName'], lastName: f['lastName'], companyName: f['companyName'],
                    email: f['email'], phoneNumber: f['phoneNumber'], city: f['city'],
                }));
                detail = this.translate.instant('ai_copilot_customer_created', { name: res.name });
            } else if (action.type === 'create_supplier') {
                const res = await firstValueFrom(this.aiIntegrationService.createNadiPilotSupplier({
                    name: f['name'], email: f['email'], phoneNumber: f['phoneNumber'], city: f['city'],
                }));
                detail = this.translate.instant('ai_copilot_supplier_created', { name: res.name });
            } else if (action.type === 'create_expense') {
                const amount = f['amount'] != null && f['amount'] !== '' ? Number(f['amount']) : undefined;
                const res = await firstValueFrom(this.aiIntegrationService.createNadiPilotExpense({
                    amount, purpose: f['purpose'],
                    ...(this.copilotSelectedShopId != null ? { shopId: this.copilotSelectedShopId } : {}),
                }));
                detail = this.translate.instant('ai_copilot_expense_created', { ref: res.reference });
            } else if (action.type === 'compose_order') {
                const lines = (action.lines || [])
                    .map(l => ({ product: (l.product || '').trim(), quantity: Number(l.quantity) }))
                    .filter(l => !!l.product && Number.isFinite(l.quantity) && l.quantity > 0);
                if (!lines.length) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: this.translate.instant('ai_copilot_title'),
                        detail: this.translate.instant('ai_copilot_order_lines_required'),
                        life: 5000,
                    });
                    return;
                }
                const res = await firstValueFrom(this.aiIntegrationService.composeNadiPilotOrder({
                    customer: f['customer'],
                    ...(f['documentType']?.trim() ? { documentType: f['documentType'].trim() } : {}),
                    ...(this.copilotSelectedShopId != null ? { shopId: this.copilotSelectedShopId } : {}),
                    ...(this.copilotSelectedWarehouseId != null ? { warehouseId: this.copilotSelectedWarehouseId } : {}),
                    lines,
                }));
                detail = this.translate.instant('ai_copilot_order_created', { ref: res.reference });
                if (res.fileUrl) {
                    window.open(res.fileUrl, '_blank');
                } else if (res.documentError) {
                    this.messageService.add({
                        severity: 'warn',
                        summary: this.translate.instant('ai_copilot_title'),
                        detail: this.translate.instant('ai_copilot_document_failed', { reason: res.documentError }),
                        life: 8000,
                    });
                }
            } else if (action.type === 'generate_document') {
                const res = await firstValueFrom(this.aiIntegrationService.generateNadiPilotDocument({
                    order: f['order'] || '',
                    documentType: f['documentType'] || '',
                }));
                detail = this.translate.instant('ai_copilot_document_generated', { number: res.documentNumber });
                if (res.fileUrl) {
                    window.open(res.fileUrl, '_blank');
                }
            } else {
                return;
            }
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('ai_copilot_title'),
                detail,
                life: 5000,
            });
            this.copilotActionDoneKeys.add(this.getCopilotHistoryKey(turn));
        } catch (error: any) {
            this.messageService.add({
                severity: 'error',
                summary: this.translate.instant('ai_copilot_title'),
                detail: error?.error?.message || this.translate.instant('ai_copilot_action_failed'),
                life: 5000,
            });
        } finally {
            this.copilotActionLoading = false;
        }
    }

    copilotCardIcon(type: string | null | undefined): string {
        switch (type) {
            case 'customer': return 'pi-user';
            case 'supplier': return 'pi-truck';
            case 'order': return 'pi-shopping-cart';
            case 'purchase': return 'pi-shopping-bag';
            case 'expense': return 'pi-wallet';
            case 'order_return': return 'pi-replay';
            case 'product': return 'pi-box';
            case 'kpi': return 'pi-chart-bar';
            case 'opportunity': return 'pi-star';
            case 'season': return 'pi-calendar';
            case 'basket': return 'pi-link';
            case 'pricing': return 'pi-tag';
            default: return 'pi-info-circle';
        }
    }

    getCopilotConfidenceClass(confidence: number | null | undefined): string {
        const value = typeof confidence === 'number' ? confidence : 0;
        if (value >= 0.75) {
            return 'is-high';
        }
        if (value >= 0.5) {
            return 'is-medium';
        }
        return 'is-low';
    }

    isCopilotEvidenceOpen(turn: { at: string; prompt: string }): boolean {
        return this.copilotEvidenceOpenKeys.has(this.getCopilotHistoryKey(turn));
    }

    toggleCopilotEvidenceFor(turn: { at: string; prompt: string }): void {
        const key = this.getCopilotHistoryKey(turn);
        if (this.copilotEvidenceOpenKeys.has(key)) {
            this.copilotEvidenceOpenKeys.delete(key);
        } else {
            this.copilotEvidenceOpenKeys.add(key);
        }
    }

    private scrollCopilotThreadToBottom(): void {
        setTimeout(() => {
            const el = this.copilotThreadEl?.nativeElement;
            if (el) {
                el.scrollTop = el.scrollHeight;
            }
        }, 60);
    }

    /**
     * Minimal, safe Markdown-to-HTML for assistant answers. Escapes HTML first, then applies a small
     * subset (headings, bold, inline code, italics, bullet and numbered lists, paragraphs). The result
     * is bound via [innerHTML]; Angular's sanitizer strips anything unsafe.
     */
    renderCopilotMarkdown(answer: string | null | undefined): string {
        const src = (answer || '').trim();
        if (!src) {
            return '';
        }
        const escape = (s: string) => s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const inline = (s: string) => escape(s)
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/(^|[\s(])_([^_]+)_(?=[\s).,!?]|$)/g, '$1<em>$2</em>');
        const lines = src.split(/\r?\n/);
        const out: string[] = [];
        let listType: 'ul' | 'ol' | null = null;
        let para: string[] = [];
        const closeList = () => {
            if (listType) {
                out.push(`</${listType}>`);
                listType = null;
            }
        };
        const flushPara = () => {
            if (para.length) {
                out.push(`<p>${para.map(inline).join('<br>')}</p>`);
                para = [];
            }
        };
        for (const raw of lines) {
            const line = raw.trim();
            if (!line) {
                flushPara();
                closeList();
                continue;
            }
            const heading = /^#{1,6}\s+(.*)$/.exec(line);
            const bullet = /^[-*•]\s+(.*)$/.exec(line);
            const ordered = /^\d+[.)]\s+(.*)$/.exec(line);
            if (heading) {
                flushPara();
                closeList();
                out.push(`<h4 class="copilot-md-h">${inline(heading[1])}</h4>`);
            } else if (bullet) {
                flushPara();
                if (listType !== 'ul') {
                    closeList();
                    out.push('<ul>');
                    listType = 'ul';
                }
                out.push(`<li>${inline(bullet[1])}</li>`);
            } else if (ordered) {
                flushPara();
                if (listType !== 'ol') {
                    closeList();
                    out.push('<ol>');
                    listType = 'ol';
                }
                out.push(`<li>${inline(ordered[1])}</li>`);
            } else {
                closeList();
                para.push(line);
            }
        }
        flushPara();
        closeList();
        return out.join('');
    }

    startCopilotResize(event: MouseEvent): void {
        event.preventDefault();
        this.copilotResizeActive = true;
        const min = 360;
        const max = Math.min(window.innerWidth - 80, 900);
        const onMove = (e: MouseEvent) => {
            if (!this.copilotResizeActive) {
                return;
            }
            const width = Math.max(min, Math.min(max, window.innerWidth - e.clientX));
            document.documentElement.style.setProperty('--copilot-panel-width', `${width}px`);
        };
        const onUp = () => {
            this.copilotResizeActive = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            const current = getComputedStyle(document.documentElement).getPropertyValue('--copilot-panel-width').trim();
            if (current) {
                try {
                    localStorage.setItem(this.copilotWidthStorageKey, current);
                } catch {
                    // storage may be unavailable
                }
            }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    private restoreCopilotPanelWidth(): void {
        try {
            const saved = localStorage.getItem(this.copilotWidthStorageKey);
            if (saved) {
                document.documentElement.style.setProperty('--copilot-panel-width', saved);
            }
        } catch {
            // storage may be unavailable
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
        this.cancelCopilotEdit();
        this.copilotHistory = [];
        this.persistCopilotHistory();
    }

    /** Stable key for a conversation turn (used to track which evidence sections are expanded). */
    getCopilotHistoryKey(item: { prompt: string; at: string }): string {
        return `${item.at}::${item.prompt}`;
    }

    // --- Per-message actions (copy / edit / resend / regenerate) ---

    /** Index of a thread turn inside the newest-first copilotHistory, or -1 if not found. */
    private copilotTurnIndex(turn: { prompt: string; at: string }): number {
        const key = this.getCopilotHistoryKey(turn);
        return this.copilotHistory.findIndex(h => this.getCopilotHistoryKey(h) === key);
    }

    /** Copy a user prompt to the clipboard. */
    copyCopilotPrompt(turn: { prompt: string }): void {
        this.copyCopilotMessageText(turn?.prompt);
    }

    /** Copy an assistant answer to the clipboard. */
    copyCopilotAnswer(turn: { response?: NadiPilotResponseDTO | null }): void {
        this.copyCopilotMessageText(turn?.response?.answer);
    }

    private async copyCopilotMessageText(text: string | null | undefined): Promise<void> {
        const value = (text || '').trim();
        if (!value) {
            return;
        }
        try {
            await navigator.clipboard.writeText(value);
            this.messageService.add({
                severity: 'success',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_msg_copied'),
                life: 2000
            });
        } catch {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: this.translate.instant('ai_copilot_msg_copy_failed'),
                life: 3000
            });
        }
    }

    /** True when the given user turn is currently being edited inline. */
    isCopilotEditing(turn: { prompt: string; at: string }): boolean {
        return this.copilotEditingTurnKey != null
            && this.copilotEditingTurnKey === this.getCopilotHistoryKey(turn);
    }

    /** Begin inline editing of a user message. */
    startCopilotEdit(turn: { prompt: string; at: string }): void {
        if (this.copilotLoading) {
            return;
        }
        this.copilotEditingTurnKey = this.getCopilotHistoryKey(turn);
        this.copilotEditDraft = turn?.prompt || '';
    }

    /** Discard the inline edit without sending. */
    cancelCopilotEdit(): void {
        this.copilotEditingTurnKey = null;
        this.copilotEditDraft = '';
    }

    /**
     * Save an inline edit: drop this turn and everything after it (like modern copilots), then
     * re-ask with the edited text so the conversation regenerates from that point.
     */
    submitCopilotEdit(turn: { prompt: string; at: string }): void {
        if (this.copilotLoading) {
            return;
        }
        const message = (this.copilotEditDraft || '').trim();
        if (!message) {
            return;
        }
        this.truncateCopilotHistoryFrom(turn);
        this.cancelCopilotEdit();
        this.copilotPrompt = message;
        this.askAiCopilot();
    }

    onCopilotEditKeydown(event: KeyboardEvent, turn: { prompt: string; at: string }): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.submitCopilotEdit(turn);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            this.cancelCopilotEdit();
        }
    }

    /** Resend the same user message as a new turn (duplicate). */
    resendCopilotTurn(turn: { prompt: string; at: string }): void {
        if (this.copilotLoading) {
            return;
        }
        const message = (turn?.prompt || '').trim();
        if (!message) {
            return;
        }
        this.copilotPrompt = message;
        this.askAiCopilot();
    }

    /** Regenerate the assistant reply for a turn: drop it and everything after, then re-ask. */
    regenerateCopilotTurn(turn: { prompt: string; at: string }): void {
        if (this.copilotLoading) {
            return;
        }
        const message = (turn?.prompt || '').trim();
        if (!message) {
            return;
        }
        this.truncateCopilotHistoryFrom(turn);
        this.copilotPrompt = message;
        this.askAiCopilot();
    }

    /** Ask for confirmation (anchored popup) before removing a conversation turn. */
    confirmDeleteCopilotTurn(event: Event, turn: { prompt: string; at: string }): void {
        if (this.copilotLoading) {
            return;
        }
        this.confirmationService.confirm({
            key: 'copilotMsgDelete',
            target: event.currentTarget as EventTarget,
            message: this.translate.instant('ai_copilot_msg_delete_confirm'),
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: this.translate.instant('ai_copilot_msg_delete'),
            rejectLabel: this.translate.instant('ai_copilot_msg_edit_cancel'),
            acceptButtonStyleClass: 'p-button-danger p-button-sm',
            rejectButtonStyleClass: 'p-button-text p-button-sm',
            accept: () => this.deleteCopilotTurn(turn)
        });
    }

    /** Delete a single conversation turn (user prompt + its assistant reply) from the thread. */
    deleteCopilotTurn(turn: { prompt: string; at: string }): void {
        if (this.copilotLoading) {
            return;
        }
        const idx = this.copilotTurnIndex(turn);
        if (idx < 0) {
            return;
        }
        if (this.isCopilotEditing(turn)) {
            this.cancelCopilotEdit();
        }
        this.copilotHistory = [
            ...this.copilotHistory.slice(0, idx),
            ...this.copilotHistory.slice(idx + 1)
        ];
        this.persistCopilotHistory();
    }

    /** Remove the given turn and every turn newer than it (history is newest-first). */
    private truncateCopilotHistoryFrom(turn: { prompt: string; at: string }): void {
        const idx = this.copilotTurnIndex(turn);
        if (idx >= 0) {
            this.copilotHistory = this.copilotHistory.slice(idx + 1);
            this.persistCopilotHistory();
        }
    }

    /** Admin shortcut from the rate-limit notice: open the AI provider settings page. */
    openAiProviderSettings(): void {
        this.closeCopilotPanel(false);
        this.router.navigateByUrl('/administration/settings/ai').catch(() => {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: '/administration/settings/ai',
                life: 3000
            });
        });
    }

    navigateFromCopilot(nav: NadiPilotNavigationDTO): void {
        if (!nav?.route) {
            return;
        }
        this.router.navigateByUrl(nav.route).catch(() => {
            this.messageService.add({
                severity: 'warn',
                summary: this.translate.instant('ai_copilot_title'),
                detail: nav.route,
                life: 3000
            });
        });
        this.closeCopilotPanel(false);
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

    async applyAllCopilotReorders(result: NadiPilotResponseDTO | null = this.copilotResponse): Promise<void> {
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

    getCopilotValidReorderLineCount(result: NadiPilotResponseDTO | null = this.copilotResponse): number {
        const actions = result?.recommendedActions || [];
        return actions.filter(a => a.actionType === 'DRAFT_REORDER' && !!a.productId && !!a.quantity && a.quantity > 0).length;
    }

    canApplyAllCopilotReorders(result: NadiPilotResponseDTO | null = this.copilotResponse): boolean {
        return !this.copilotLoading && this.hasCopilotScopeSelection() && this.getCopilotValidReorderLineCount(result) > 0;
    }

    canApplyCopilotAction(action: NadiPilotActionDTO): boolean {
        return !this.copilotLoading
            && this.hasCopilotScopeSelection()
            && action.actionType === 'DRAFT_REORDER'
            && !!action.productId
            && !!action.quantity
            && action.quantity > 0;
    }

    /** Per-user localStorage key so one user's NadiPilot chat can't leak to another on the same browser. */
    private copilotScopedKey(base: string): string {
        return `${base}.${this.copilotUserId}`;
    }

    private loadCopilotHistory(): void {
        // Purge the legacy shared (non-user-scoped) key that leaked chats across users.
        try {
            localStorage.removeItem(this.copilotHistoryStorageKey);
        } catch {
            // ignore
        }
        try {
            const raw = localStorage.getItem(this.copilotScopedKey(this.copilotHistoryStorageKey));
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
            localStorage.setItem(this.copilotScopedKey(this.copilotHistoryStorageKey), JSON.stringify(this.copilotHistory.slice(0, 12)));
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

    get canUseCopilot(): boolean {
        return this.isAdmin || this.isVendor || this.isWarehouseman
            || (Array.isArray(this.userRoles)
                && (this.userRoles.includes('ACCOUNTANT') || this.userRoles.includes('AUDITOR')));
    }

    private loadCopilotBriefing(): void {
        if (this.copilotBriefingLoading) {
            return;
        }
        this.copilotBriefingLoading = true;
        this.aiIntegrationService.getNadiPilotBriefing({
            ...(this.copilotSelectedShopId != null ? { shopId: this.copilotSelectedShopId } : {}),
            ...(this.copilotSelectedWarehouseId != null ? { warehouseId: this.copilotSelectedWarehouseId } : {}),
        }).subscribe({
            next: briefing => {
                this.copilotBriefing = briefing;
                this.copilotBriefingLoading = false;
            },
            error: () => {
                this.copilotBriefingLoading = false;
            },
        });
    }

    openCopilotPanel(): void {
        this.isCopilotOpen = true;
        this.copilotUnreadCount = 0;
        this.restoreCopilotPanelWidth();
        this.syncCopilotUiState();
        void this.loadCopilotAvailability();
        this.loadCopilotBriefing();
        setTimeout(() => this.copilotInputField?.nativeElement?.focus(), 0);
        this.scrollCopilotThreadToBottom();
    }

    /**
     * Asks once per session whether an AI provider is configured, so the panel can say so instead
     * of accepting questions that cannot be answered.
     *
     * A failed request leaves the panel usable: a transport problem is not evidence that AI is
     * unconfigured, and wrongly locking the composer is worse than the question failing.
     */
    private async loadCopilotAvailability(): Promise<void> {
        if (this.aiAvailability) {
            return;
        }
        try {
            this.aiAvailability = await this.aiIntegrationService.getAvailability();
        } catch {
            this.aiAvailability = null;
        }
    }

    /** True only on a definite "no provider" answer — never on a missing or failed one. */
    get aiUnavailable(): boolean {
        return this.aiAvailability?.available === false;
    }

    /** Translation key describing what is missing; the admin variant names the fix. */
    get aiUnavailableMessageKey(): string {
        const reason = this.aiAvailability?.reason;
        const suffix = this.aiAvailability?.configurable ? 'admin' : 'user';
        switch (reason) {
            case 'INTEGRATION_DISABLED':
                return `ai_copilot_unavailable_disabled_${suffix}`;
            case 'MISSING_API_KEY':
                return `ai_copilot_unavailable_key_${suffix}`;
            default:
                return `ai_copilot_unavailable_provider_${suffix}`;
        }
    }

    /** Admins get a link straight to the AI section of Settings; everyone else gets the message. */
    openAiSettings(): void {
        this.closeCopilotPanel(false);
        void this.router.navigate(['/administration/settings'], { queryParams: { tab: 'integrations' } });
    }

    closeCopilotPanel(restoreFocus = true): void {
        if (this.copilotListening) {
            this.stopCopilotDictation();
        }
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

    @HostListener('document:keydown', ['$event'])
    onGlobalCopilotShortcut(event: KeyboardEvent): void {
        // Ctrl/Cmd+K toggles NadiPilot from anywhere (admins only, outside POS).
        if ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K')) {
            if (!this.isAdmin || this.isPosRoute) {
                return;
            }
            event.preventDefault();
            this.toggleCopilotPanel();
        }
    }


}
