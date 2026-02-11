import { Component, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
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
import { ShopService } from '../services/shop.service';
import { MaintenanceStatus } from '../models/maintenance';
import { MaintenanceService } from '../services/maintenance.service';

@Component({
    selector: 'app-layout',
    templateUrl: './app.layout.component.html',
    styleUrl: './app.layout.component.css'
})
export class AppLayoutComponent implements OnDestroy, OnInit {

    overlayMenuOpenSubscription: Subscription;
    maintenancePollingSub?: Subscription;

    menuOutsideClickListener: any;

    profileMenuOutsideClickListener: any;

    auth: any = false;

    public profile?: KeycloakProfile;

    currentYear = new Date().getFullYear();
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

    licenseProgress: number | null = null;
    licenseProgressColor: string = 'bg-green-500';


    featureKeys: string[] = [
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

    @ViewChild(AppSidebarComponent) appSidebar!: AppSidebarComponent;

    @ViewChild(AppTopBarComponent) appTopbar!: AppTopBarComponent;

    isPosRoute: boolean = false;
    maintenanceStatus: MaintenanceStatus | null = null;

    constructor(public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router,
        private translate: TranslateService,
        public keycloakService: KeycloakService,
        private cashRegisterService: CashRegisterService,
        private messageService: MessageService,
        private shopService: ShopService,
        private maintenanceService: MaintenanceService,
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
                this.loadMaintenanceStatus();
            });
    }
    async ngOnInit(): Promise<void> {
        if (this.keycloakService.isTokenExpired()) {
            await this.login();
        }

        await this.loadCashRegisterSession();

        this.layoutService.systemInfoLoaded$.subscribe(() => {
            this.calculateDaysUntilExpiration();
        });

        await this.setUserRoles();
        await this.onGetAllShops();
        await this.loadMaintenanceStatus();
        this.startMaintenancePolling();
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
    }

    async login() {
        await this.keycloakService.login({
            redirectUri: window.location.origin + '/webconsole'
        });
    }

    logOut() {
        this.keycloakService.logout(window.location.origin + '/webconsole')
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
        
        // Redirect CASHIER to POS if not already there
        if (this.isCashier && !this.router.url.startsWith('/pos')) {
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

    getLicenseSeverity(days: number): string {
        if (days > 30) return 'success';
        if (days > 0) return 'warning';
        return 'danger';
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


}
