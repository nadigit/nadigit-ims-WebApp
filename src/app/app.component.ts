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

        console.log('KC Host:', (window as any).__env.kcHost);
    console.log('API Protocol:', (window as any).__env.apiProtocol);
    console.log('API Host:', (window as any).__env.apiHost);
    console.log('API Port:', (window as any).__env.apiPort);
        this.primengConfig.ripple = true;

        // Set language based on user preference (example)
        this.translateService.setLanguage(this.translateService.getPreferredLanguage());

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
