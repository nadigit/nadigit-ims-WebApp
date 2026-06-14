import { Component, OnDestroy, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { TranslationService } from './services/translation.service';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { AuthenticationService } from './services/authentication.service';
import { AppConfigurationService } from './services/app-configuration.service';
import { TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { BackendStatusService } from './services/backend-status.service';
import { ProcessModeService } from './services/process-mode.service';
import { ActivityProfileService } from './services/activity-profile.service';
import { Subscription } from 'rxjs';
import { buildKeycloakRedirectUri } from './utils/keycloak-redirect.util';
import { SessionAuditService } from './services/session-audit.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {

    public profile?: KeycloakProfile;
    backendUnavailable$!: Observable<boolean>;

    /** Shown when API reports profileSelectionRequired (org profile not set). */
    showActivityProfileBanner = false;
    isAdmin = false;
    private readonly activityProfileBannerStorageKey = 'ims_activity_profile_banner_dismissed';
    private activityProfileCtxSub?: Subscription;

    constructor(private primengConfig: PrimeNGConfig,
        private translate: TranslateService,
        private translateService: TranslationService,
        public keycloakService: KeycloakService,
        private authService: AuthenticationService,
        private configService: AppConfigurationService,
        private backendStatusService: BackendStatusService,
        private processModeService: ProcessModeService,
        public activityProfileService: ActivityProfileService,
        private sessionAuditService: SessionAuditService,
    ) { }

    async ngOnInit() {
        this.primengConfig.ripple = true;

        // Track backend availability for global UX banner
        this.backendUnavailable$ = this.backendStatusService.backendUnavailable$;
        
        // Add/remove body class when backend status changes
        this.backendUnavailable$.subscribe(isUnavailable => {
            if (isUnavailable) {
                document.body.classList.add('backend-unavailable');
            } else {
                document.body.classList.remove('backend-unavailable');
            }
        });

        // Set app language
        const preferredLang = this.translateService.getPreferredLanguage();
        this.translateService.setLanguage(preferredLang);
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang);

        });

        // ✅ Load translations and configure PrimeNG globally
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang);
            
            // Configure PrimeNG RTL
            const isRTL = lang === 'ar';
            this.primengConfig.ripple = true;
            // Note: PrimeNG components will automatically respect the dir attribute on html/body

            this.translate.get([
                'starts_with', 'contains', 'not_contains', 'ends_with', 'equals', 'not_equals',
                'no_filter', 'less_than', 'less_than_or_equal_to', 'greater_than', 'greater_than_or_equal_to',
                'is', 'is_not', 'before', 'after', 'clear', 'apply', 'match_all', 'match_any',
                'add_rule', 'remove_rule', 'date_is', 'date_is_not', 'date_before', 'date_after',
                'today', 'month_names', 'month_names_short', 'day_names', 'day_names_short', 'day_names_min'
            ]).subscribe(translations => {
                this.primengConfig.setTranslation({
                    // Filters
                    startsWith: translations['starts_with'],
                    contains: translations['contains'],
                    notContains: translations['not_contains'],
                    endsWith: translations['ends_with'],
                    equals: translations['equals'],
                    notEquals: translations['not_equals'],
                    noFilter: translations['no_filter'],
                    lt: translations['less_than'],
                    lte: translations['less_than_or_equal_to'],
                    gt: translations['greater_than'],
                    gte: translations['greater_than_or_equal_to'],
                    is: translations['is'],
                    isNot: translations['is_not'],
                    before: translations['before'],
                    after: translations['after'],
                    clear: translations['clear'],
                    apply: translations['apply'],
                    matchAll: translations['match_all'],
                    matchAny: translations['match_any'],
                    addRule: translations['add_rule'],
                    removeRule: translations['remove_rule'],
                    dateIs: translations['date_is'],
                    dateIsNot: translations['date_is_not'],
                    dateBefore: translations['date_before'],
                    dateAfter: translations['date_after'],

                    // 📅 Calendar
                    today: translations['today'],
                    dayNames: translations['day_names']?.split(','),
                    dayNamesShort: translations['day_names_short']?.split(','),
                    dayNamesMin: translations['day_names_min']?.split(','),
                    monthNames: translations['month_names']?.split(','),
                    monthNamesShort: translations['month_names_short']?.split(','),
                    firstDayOfWeek: isRTL ? 6 : 1, // Saturday for Arabic, Monday for others
                });
            });

        });

        // Load your currency config once
        this.configService.loadCurrencyOnce();

        // Auth logic
        const authenticated = await this.keycloakService.isLoggedIn();
        if (authenticated) {
            // Try to load user profile, but don't block if it fails (e.g., CASHIER users may not have view-profile permission)
            // Profile will be loaded when needed (e.g., in profile component)
            try {
                this.profile = await this.keycloakService.loadUserProfile();
            } catch (error) {
                // Silently handle error - expected for users without view-profile permission (e.g., CASHIER role)
                // Profile loading is optional here and will be handled when actually needed
            }
            
            if (this.keycloakService.isTokenExpired()) {
                this.logOut();
            } else {
                await this.processModeService.ensureLoaded();
                try {
                    await this.activityProfileService.ensureLoaded();
                    this.refreshActivityProfileBannerVisibility();
                    this.activityProfileCtxSub = this.activityProfileService.contextChanged$.subscribe(() =>
                        this.refreshActivityProfileBannerVisibility(),
                    );
                } catch {
                    /* non-blocking */
                }
                try {
                    const roles = await this.keycloakService.getUserRoles();
                    this.isAdmin = Array.isArray(roles) && roles.includes('ADMIN');
                } catch {
                    this.isAdmin = false;
                }
                await this.sessionAuditService.recordLoginIfNeeded();
                await this.authService.checkRolesAndRedirect();
            }
        } else {
            await this.login();
        }
    }

    ngOnDestroy(): void {
        this.activityProfileCtxSub?.unsubscribe();
    }

    private refreshActivityProfileBannerVisibility(): void {
        const dismissed = sessionStorage.getItem(this.activityProfileBannerStorageKey) === '1';
        this.showActivityProfileBanner =
            !dismissed && this.activityProfileService.profileSelectionRequired === true;
    }

    dismissActivityProfileBanner(): void {
        sessionStorage.setItem(this.activityProfileBannerStorageKey, '1');
        this.refreshActivityProfileBannerVisibility();
    }

    async login() {
        await this.keycloakService.login({
            redirectUri: buildKeycloakRedirectUri()
        });
    }

    logOut() {
        void this.sessionAuditService.logout(window.location.origin + '/webconsole');
    }
}
