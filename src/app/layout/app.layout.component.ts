import { Component, OnDestroy, OnInit, Renderer2, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { LayoutService } from "./service/app.layout.service";
import { AppSidebarComponent } from "./app.sidebar.component";
import { AppTopBarComponent } from './app.topbar.component';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
    selector: 'app-layout',
    templateUrl: './app.layout.component.html'
})
export class AppLayoutComponent implements OnDestroy, OnInit {

    overlayMenuOpenSubscription: Subscription;

    menuOutsideClickListener: any;

    profileMenuOutsideClickListener: any;

    auth: any = false;

    public profile?: KeycloakProfile;

    currentYear = new Date().getFullYear();
    daysUntilExpiration: number | null = null;

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

    constructor(public layoutService: LayoutService,
        public renderer: Renderer2,
        public router: Router,
        public keycloakService: KeycloakService,
        private translate: TranslateService,
        private translateService: TranslationService,
    ) {

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
            });
    }
    ngOnInit(): void {

        if (this.keycloakService.isTokenExpired()) {
            this.login();
        }

        this.layoutService.systemInfoLoaded$.subscribe(() => {
            this.calculateDaysUntilExpiration();
        });

    }

    calculateDaysUntilExpiration() {
        console.log('Calculating days until license expiration...');
        console.log('License expiration date:', this.layoutService.systemInfo?.licenseExpiresAt);
        if (!this.layoutService.systemInfo?.licenseExpiresAt) return;

        try {
            const expirationDate = new Date(this.layoutService.systemInfo.licenseExpiresAt);
            const today = new Date();
            const diffTime = expirationDate.getTime() - today.getTime();
            if (diffTime < 0) {
                console.warn('License has already expired.');
                this.daysUntilExpiration = 0;
                return;
            }
            if (isNaN(diffTime)) {
                console.error('Invalid expiration date:', this.layoutService.systemInfo.licenseExpiresAt);
                this.daysUntilExpiration = null;
                return;
            }
            console.log('Expiration date:', expirationDate);
            console.log('Current date:', today);
            console.log('Difference in milliseconds:', diffTime);
            console.log('Difference in days:', Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
            // Calculate days until expiration
            this.daysUntilExpiration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            console.log(`Days until license expiration: ${this.daysUntilExpiration}`);
        } catch (e) {
            console.error('Error calculating license expiration:', e);
            this.daysUntilExpiration = null;
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
    }

    async login() {
        await this.keycloakService.login({
            redirectUri: window.location.origin
        });
    }

    logOut() {
        this.keycloakService.logout(window.location.origin)
    }

}
