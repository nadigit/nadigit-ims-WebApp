import { Component, OnInit } from '@angular/core';
import { PrimeNGConfig } from 'primeng/api';
import { TranslationService } from './services/translation.service';
import { KeycloakService } from 'keycloak-angular';
import { KeycloakProfile } from 'keycloak-js';
import { AuthenticationService } from './services/authentication.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {

    public profile?: KeycloakProfile;
    private token: string;


    constructor(private primengConfig: PrimeNGConfig, 
                private translateService: TranslationService, 
                public keycloakService: KeycloakService,
                private authService: AuthenticationService,
            ) { }

    async ngOnInit() {
        this.primengConfig.ripple = true;

        // Set language based on user preference (example)
        this.translateService.setLanguage(this.translateService.getPreferredLanguage());

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
            redirectUri: window.location.origin
        });
    }

    logOut() {
        this.keycloakService.logout(window.location.origin)
    }
}
