import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { NotfoundComponent } from './ims/components/notfound/notfound.component';
import { AppLayoutComponent } from "./layout/app.layout.component";
import { AuthGuard } from './guards/auth.guard';

@NgModule({
    imports: [
        RouterModule.forRoot([
            {
                path: '', component: AppLayoutComponent,
                children: [
                    { path: '', loadChildren: () => import('./ims/components/dashboard/dashboard.module').then(m => m.DashboardModule), canActivate:[AuthGuard], data : { roles: ['ADMIN']} },
                    { path: 'pages', loadChildren: () => import('./ims/components/pages/pages.module').then(m => m.PagesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR','WAREHOUSEMAN']} }
                ]
            },
            { path: 'auth', loadChildren: () => import('./ims/components/auth/auth.module').then(m => m.AuthModule) },
            { path: 'notfound', component: NotfoundComponent },
            { path: '**', redirectTo: '/notfound' },
        ], { scrollPositionRestoration: 'enabled', anchorScrolling: 'enabled', onSameUrlNavigation: 'reload' })
    ],
    exports: [RouterModule]
})
export class AppRoutingModule {
}
