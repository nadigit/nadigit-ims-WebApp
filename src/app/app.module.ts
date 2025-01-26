import { APP_INITIALIZER, NgModule } from '@angular/core';
import { HashLocationStrategy, LocationStrategy } from '@angular/common';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AppLayoutModule } from './layout/app.layout.module';
import { NotfoundComponent } from './ims/components/notfound/notfound.component';
import { AngularFireModule } from '@angular/fire/compat';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { environment } from '../environments/environment';
import { TranslateLoader, TranslateModule, TranslateService } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { BrowserModule } from '@angular/platform-browser';
import {KeycloakAngularModule, KeycloakService} from "keycloak-angular";
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { MessageService } from 'primeng/api';


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
            silentCheckSsoRedirectUri:
                window.location.origin + '/assets/keycloak/silent-check-sso.html',
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


@NgModule({
    declarations: [
        AppComponent, NotfoundComponent
    ],
    imports: [
        AppRoutingModule,
        AppLayoutModule,
        BrowserModule,
        AngularFireModule.initializeApp(environment.firebaseConfig),
        AngularFireStorageModule,
        HttpClientModule,
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
    ],
    providers: [
        MessageService,
        TranslateService,
        { provide: LocationStrategy, useClass: HashLocationStrategy },
        {provide : APP_INITIALIZER, deps : [KeycloakService],useFactory : initializeKeycloak, multi : true}
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
