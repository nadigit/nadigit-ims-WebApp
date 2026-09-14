import { APP_INITIALIZER, NgModule } from '@angular/core';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AppLayoutModule } from './layout/app.layout.module';
import { NotfoundComponent } from './ims/components/notfound/notfound.component';
import { environment } from '../environments/environment';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import {KeycloakAngularModule, KeycloakService} from "keycloak-angular";
import { providePrimeNG } from 'primeng/config';
import Lara from '@primeng/themes/lara';
import { definePreset } from '@primeng/themes';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { MessageService } from 'primeng/api';
import { MaintenanceInterceptor } from './interceptors/maintenance.interceptor';
import { BackendUnavailableInterceptor } from './interceptors/backend-unavailable.interceptor';
import { AcceptLanguageInterceptor } from './interceptors/accept-language.interceptor';
import { OrganizationScopeInterceptor } from './interceptors/organization-scope.interceptor';
import { RateLimitRetryInterceptor } from './interceptors/rate-limit-retry.interceptor';
import { buildKeycloakRedirectUri } from './utils/keycloak-redirect.util';
import { BrandLogoComponent } from './shared/brand-logo';
import { LicenseActivationComponent } from './shared/license-activation';
import { LicenseRequiredInterceptor } from './interceptors/license-required.interceptor';



// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient) {
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

function initializeKeycloak(keycloak: KeycloakService) {
    return () =>
      keycloak.init({
        config: {
          url: environment.keycloak.authority,
          realm: environment.keycloak.realm,
          clientId: environment.keycloak.clientId,
        },
        initOptions: {
            onLoad: 'login-required',  // automatically checks login state
            checkLoginIframe: false,  // iframe to monitor login session
            redirectUri: buildKeycloakRedirectUri(),
            // silentCheckSsoRedirectUri:
            //     window.location.origin + '/assets/keycloak/silent-check-sso.html',
            // You can enable token refresh handling
        }
        // initOptions: {
        //     onLoad: 'check-sso',  // automatically checks login state
        //     checkLoginIframe: true,  // iframe to monitor login session
        //     silentCheckSsoRedirectUri:
        //         window.location.origin + '/assets/keycloak/silent-check-sso.html',
        //     // You can enable token refresh handling
        // }
      });
  }


/**
 * Lara, repainted in the brand blue.
 *
 * The stock preset's primary palette is emerald, so out of the box every accent PrimeNG owns —
 * selected toggle buttons, links, focus rings, progress bars — came out green while the rest of
 * the app stayed #1E5EFF. These are the same ten stops already declared as --primary-50..900 in
 * nadigit-brand.scss; they are repeated here because the theme is generated in TypeScript at
 * runtime and cannot read a CSS custom property. Keep the two in step.
 */
const NadigitLara = definePreset(Lara, {
    semantic: {
        primary: {
            50: '#EEF3FF',
            100: '#D6E4FF',
            200: '#ADC8FF',
            300: '#84ABFF',
            400: '#5188FF',
            500: '#1E5EFF',
            600: '#1850E0',
            700: '#1340B8',
            800: '#0E3190',
            900: '#092368',
            950: '#061845',
        },
    },
});

@NgModule({ declarations: [
        AppComponent, NotfoundComponent
    ],
    bootstrap: [AppComponent], imports: [AppRoutingModule,
        AppLayoutModule,
        BrowserModule,
        OrganizationChartModule,
        ZXingScannerModule,
        TranslateModule.forRoot({
            loader: {
                provide: TranslateLoader,
                useFactory: HttpLoaderFactory,
                deps: [HttpClient]
            },
            useDefaultLang: true
            // Other desired configurations...
        }),
        KeycloakAngularModule,
        BrandLogoComponent,
        LicenseActivationComponent], providers: [
        // Lara with an indigo primary is what the vendored lara-light-indigo theme was, so the
        // starting point matches what the product looked like on PrimeNG 17.
        //
        // darkModeSelector reuses the class the layout service already toggles on <html>, so dark
        // mode stops being a stylesheet swap and becomes what it always should have been: a class.
        //
        // cssLayer matters more than either. PrimeNG 18 generates its CSS at runtime, and this app
        // carries 14,033 .p-* selectors written against the old theme. Layered styles lose to
        // unlayered ones whatever the specificity, so naming a layer here keeps every one of those
        // overrides in charge instead of leaving the outcome to source order.
        providePrimeNG({
            theme: {
                preset: NadigitLara,
                options: {
                    darkModeSelector: '.layout-theme-dark',
                    cssLayer: { name: 'primeng', order: 'primeng' },
                },
            },
        }),
        MessageService,
        TranslateService,
        {
            provide: HTTP_INTERCEPTORS,
            useClass: LicenseRequiredInterceptor,
            multi: true
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: MaintenanceInterceptor,
            multi: true
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: BackendUnavailableInterceptor,
            multi: true
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: AcceptLanguageInterceptor,
            multi: true
        },
        {
            provide: HTTP_INTERCEPTORS,
            useClass: OrganizationScopeInterceptor,
            multi: true
        },
        // Last on purpose: a rate-limit refusal it retries away never reaches the interceptors above.
        {
            provide: HTTP_INTERCEPTORS,
            useClass: RateLimitRetryInterceptor,
            multi: true
        },
        // { provide: LocationStrategy, useClass: HashLocationStrategy },
        { provide: APP_INITIALIZER, deps: [KeycloakService], useFactory: initializeKeycloak, multi: true },
        provideHttpClient(withInterceptorsFromDi())
    ] })
export class AppModule { }
