import { Injectable, effect, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { brandAppIconForScheme, brandFaviconForScheme } from 'src/app/utils/brand-assets';

export type MenuDisplayMode = 'expanded' | 'compact' | 'hover';

export interface AppConfig {
    inputStyle: string;
    colorScheme: string;
    theme: string;
    ripple: boolean;
    menuMode: string;
    menuDisplayMode: MenuDisplayMode;
    scale: number;
}

interface LayoutState {
    staticMenuDesktopInactive: boolean;
    overlayMenuActive: boolean;
    profileSidebarVisible: boolean;
    configSidebarVisible: boolean;
    staticMenuMobileActive: boolean;
    menuHoverActive: boolean;
}

@Injectable({
    providedIn: 'root',
})
export class LayoutService {
    private static initialColorScheme(): 'light' | 'dark' {
        if (typeof localStorage === 'undefined') {
            return 'light';
        }
        return localStorage.getItem('darkMode') === 'dark' ? 'dark' : 'light';
    }

    private static initialMenuDisplayMode(): MenuDisplayMode {
        if (typeof localStorage === 'undefined') {
            return 'expanded';
        }
        const saved = localStorage.getItem('menuDisplayMode');
        if (saved === 'compact' || saved === 'hover') {
            return saved;
        }
        return 'expanded';
    }

    private static readonly bootColorScheme = LayoutService.initialColorScheme();

    _config: AppConfig = {
        ripple: false,
        inputStyle: 'outlined',
        menuMode: 'static',
        menuDisplayMode: LayoutService.initialMenuDisplayMode(),
        colorScheme: LayoutService.bootColorScheme,
        theme: LayoutService.bootColorScheme === 'dark' ? 'lara-dark-indigo' : 'lara-light-indigo',
        scale: 14,
    };

    public systemInfo: any = {};
    public showSystemInfoDialog: boolean = false;

    systemInfoLoaded$ = new Subject<void>();



    config = signal<AppConfig>(this._config);

    state: LayoutState = {
        staticMenuDesktopInactive: false,
        overlayMenuActive: false,
        profileSidebarVisible: false,
        configSidebarVisible: false,
        staticMenuMobileActive: false,
        menuHoverActive: false,
    };

    /** Prevents re-expanding until the pointer leaves the sidebar after a navigation click. */
    private menuHoverExpandSuppressed = false;

    private readonly _menuHoverExpanded = signal(false);

    readonly menuHoverExpanded = this._menuHoverExpanded.asReadonly();

    private configUpdate = new Subject<AppConfig>();

    private overlayOpen = new Subject<any>();

    configUpdate$ = this.configUpdate.asObservable();

    overlayOpen$ = this.overlayOpen.asObservable();

    private copilotToggleRequest = new Subject<void>();
    copilotToggle$ = this.copilotToggleRequest.asObservable();

    private readonly _copilotPanelOpen = signal(false);
    readonly copilotPanelOpen = this._copilotPanelOpen.asReadonly();

    private readonly _copilotUnreadCount = signal(0);
    readonly copilotUnreadCount = this._copilotUnreadCount.asReadonly();

    requestCopilotToggle(): void {
        this.copilotToggleRequest.next();
    }

    setCopilotPanelOpen(open: boolean): void {
        this._copilotPanelOpen.set(open);
    }

    setCopilotUnreadCount(count: number): void {
        this._copilotUnreadCount.set(Math.min(Math.max(0, count), 99));
    }

    constructor(private appConfigService: AppConfigurationService) {
        effect(() => {
            const config = this.config();
            if (this.updateStyle(config)) {
                this.changeTheme();
            } else {
                this.ensureThemeStylesheet(config);
            }
            this.applyDocumentColorScheme(config.colorScheme);
            this.changeScale(config.scale);
            this.onConfigUpdate();
        });

    }

    updateStyle(config: AppConfig) {
        return (
            config.theme !== this._config.theme ||
            config.colorScheme !== this._config.colorScheme
        );
    }

    triggerSystemInfoLoad() {
        console.log('Triggering system info load...');
        this.loadSystemInfo().then(() => {
            console.log('System info loaded, opening dialog...');
            console.log('System Info:', this.systemInfo);
            console.log('Dialog will open')
            this.showSystemInfoDialog = true;
            console.log('System info loaded and dialog opened');
        });
    }

    async loadSystemInfo() {
        try {
            const obs = await this.appConfigService.getSystemInfo();
            obs.subscribe({
                next: (data) => {
                    const flatObject = {};
                    const toCamel = (str: string) => str.replace(/\.(\w)/g, (_, c) => c.toUpperCase());
                    for (const item of data) {
                        const key = toCamel(item.key);
                        flatObject[key] = item.value;
                    }
                    this.systemInfo = flatObject;
                    this.systemInfoLoaded$.next();
                    console.log('Parsed system info:', this.systemInfo);
                },
                error: (err) => {
                    console.error('Failed to load system info:', err);
                    // fallback
                    this.systemInfo = {
                        appName: 'Nadigit IMS',
                        appVersion: '2026.0.1',
                        supportWebsite: 'https://nadigit.com',
                        supportEmail: 'support@nadigit.ma',
                        supportPhone: '+212-536-336-166',
                        licenseCustomer: 'ElectroMadrid',
                        licenseProduct: 'Nadigit-IMS',
                        licenseExpiresAt: '2026-12-31'
                    };
                    this.systemInfoLoaded$.next();
                }
            });
        } catch (error) {
            console.error('Error loading system info:', error);
        }
    }


    onMenuToggle() {
        if (this.isOverlay()) {
            this.state.overlayMenuActive = !this.state.overlayMenuActive;
            if (this.state.overlayMenuActive) {
                this.overlayOpen.next(null);
            }
        }

        if (this.isDesktop()) {
            this.state.staticMenuDesktopInactive =
                !this.state.staticMenuDesktopInactive;
        } else {
            this.state.staticMenuMobileActive =
                !this.state.staticMenuMobileActive;

            if (this.state.staticMenuMobileActive) {
                this.overlayOpen.next(null);
            }
        }
    }

    showProfileSidebar() {
        this.state.profileSidebarVisible = !this.state.profileSidebarVisible;
        if (this.state.profileSidebarVisible) {
            this.overlayOpen.next(null);
        }
    }

    showConfigSidebar() {
        this.state.configSidebarVisible = true;
    }

    isOverlay() {
        return this.config().menuMode === 'overlay';
    }

    isDesktop() {
        return window.innerWidth > 991;
    }

    isMobile() {
        return !this.isDesktop();
    }

    isMenuCompact(): boolean {
        return this.isDesktop() && this.config().menuDisplayMode === 'compact';
    }

    isMenuHoverMode(): boolean {
        return this.isDesktop() && this.config().menuDisplayMode === 'hover';
    }

    isMenuHoverExpanded(): boolean {
        return this.isMenuHoverMode() && this._menuHoverExpanded();
    }

    onSidebarMouseEnter(): void {
        if (!this.isMenuHoverMode() || this.menuHoverExpandSuppressed) {
            return;
        }
        this._menuHoverExpanded.set(true);
        this.state.menuHoverActive = true;
    }

    onSidebarMouseLeave(): void {
        if (!this.isMenuHoverMode()) {
            return;
        }
        this._menuHoverExpanded.set(false);
        this.state.menuHoverActive = false;
        this.menuHoverExpandSuppressed = false;
    }

    collapseMenuHover(): void {
        if (!this.isMenuHoverMode()) {
            return;
        }
        this._menuHoverExpanded.set(false);
        this.state.menuHoverActive = false;
        this.menuHoverExpandSuppressed = true;
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.closest('.layout-sidebar')) {
            active.blur();
        }
    }

    onConfigUpdate() {
        this._config = { ...this.config() };
        this.configUpdate.next(this.config());
    }

    changeTheme() {
        this.replaceThemeLink(this.themeStylesheetHref(this.config().theme));
    }

    private themeStylesheetHref(theme: string): string {
        return `assets/layout/styles/theme/${theme}/theme.css`;
    }

    private ensureThemeStylesheet(config: AppConfig) {
        const themeLink = document.getElementById('theme-css') as HTMLLinkElement | null;
        if (!themeLink) {
            return;
        }
        const expected = this.themeStylesheetHref(config.theme);
        const current = themeLink.getAttribute('href') ?? '';
        if (current.includes(`/${config.theme}/`)) {
            return;
        }
        this.replaceThemeLink(expected);
    }

    replaceThemeLink(href: string) {
        const id = 'theme-css';
        let themeLink = <HTMLLinkElement>document.getElementById(id);
        const cloneLinkElement = <HTMLLinkElement>themeLink.cloneNode(true);

        cloneLinkElement.setAttribute('href', href);
        cloneLinkElement.setAttribute('id', id + '-clone');

        themeLink.parentNode!.insertBefore(
            cloneLinkElement,
            themeLink.nextSibling
        );
        cloneLinkElement.addEventListener('load', () => {
            themeLink.remove();
            cloneLinkElement.setAttribute('id', id);
        });
    }

    changeScale(value: number) {
        document.documentElement.style.fontSize = `${value}px`;
    }

    private applyDocumentColorScheme(colorScheme: string) {
        const root = document.documentElement;
        const isDark = colorScheme === 'dark';
        root.setAttribute('color-scheme', colorScheme);
        root.classList.toggle('layout-theme-dark', isDark);
        root.classList.toggle('layout-theme-light', !isDark);
        this.applyFavicon(colorScheme);
        this.applyAppTouchIcon(colorScheme);
    }

    private applyFavicon(colorScheme: string) {
        const link =
            document.getElementById('app-favicon') as HTMLLinkElement | null
            ?? document.querySelector('link[rel="icon"]');
        if (link) {
            link.href = brandFaviconForScheme(colorScheme);
        }
    }

    private applyAppTouchIcon(colorScheme: string) {
        const link =
            document.getElementById('app-touch-icon') as HTMLLinkElement | null
            ?? document.querySelector('link[rel="apple-touch-icon"]');
        if (link) {
            link.href = brandAppIconForScheme(colorScheme);
        }
    }
}
