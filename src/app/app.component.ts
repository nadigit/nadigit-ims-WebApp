import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { TranslationService } from './services/translation.service';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { AuthenticationService } from './services/authentication.service';
import { AppConfigurationService } from './services/app-configuration.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

    public profile?: KeycloakProfile;


    constructor(private primengConfig: PrimeNGConfig,
        private translate: TranslateService,
        private translateService: TranslationService,
        public keycloakService: KeycloakService,
        private authService: AuthenticationService,
        private configService: AppConfigurationService,
    ) { }

    async ngOnInit() {
        this.primengConfig.ripple = true;

        // Set app language
        const preferredLang = this.translateService.getPreferredLanguage();
        this.translateService.setLanguage(preferredLang);
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang);

        });

        // ✅ Load translations and configure PrimeNG globally
        this.translateService.currentLanguage$.subscribe(lang => {
            this.translate.use(lang);

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
                    firstDayOfWeek: 1,
                });
            });

        });

        // Load your currency config once
        this.configService.loadCurrencyOnce();

        // Auth logic
        const authenticated = await this.keycloakService.isLoggedIn();
        if (authenticated) {
            this.profile = await this.keycloakService.loadUserProfile();
            if (this.keycloakService.isTokenExpired()) {
                this.logOut();
            } else {
                this.authService.checkRolesAndRedirect();
            }
        } else {
            await this.login();
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
}
