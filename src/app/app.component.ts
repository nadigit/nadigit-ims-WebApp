import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { TranslationService } from './services/translation.service';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { AuthenticationService } from './services/authentication.service';
import { AppConfigurationService } from './services/app-configuration.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

    public profile?: KeycloakProfile;


    constructor(private primengConfig: PrimeNGConfig,
        private translateService: TranslationService,
        public keycloakService: KeycloakService,
        private authService: AuthenticationService,
        private configService: AppConfigurationService,
    ) { }

    async ngOnInit() {
        this.primengConfig.ripple = true;

        this.translateService.setLanguage(this.translateService.getPreferredLanguage());

        this.configService.loadCurrencyOnce();


        const authenticated = await this.keycloakService.isLoggedIn();
        if (authenticated) {
            this.profile = await this.keycloakService.loadUserProfile();
            console.log(this.keycloakService.getToken)
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
            redirectUri: window.location.origin
        });
    }

    logOut() {
        this.keycloakService.logout(window.location.origin)
    }
}
