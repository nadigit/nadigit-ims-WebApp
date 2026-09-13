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
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { MessageService } from 'primeng/api';
import { MaintenanceInterceptor } from './interceptors/maintenance.interceptor';
import { BackendUnavailableInterceptor } from './interceptors/backend-unavailable.interceptor';
import { AcceptLanguageInterceptor } from './interceptors/accept-language.interceptor';
import { OrganizationScopeInterceptor } from './interceptors/organization-scope.interceptor';
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
                preset: Lara,
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
        // { provide: LocationStrategy, useClass: HashLocationStrategy },
        { provide: APP_INITIALIZER, deps: [KeycloakService], useFactory: initializeKeycloak, multi: true },
        provideHttpClient(withInterceptorsFromDi())
    ] })
export class AppModule { }
