import { RouterModule } from '@angular/router';
import { NgModule } from '@angular/core';
import { NotfoundComponent } from './ims/components/notfound/notfound.component';
import { AppLayoutComponent } from "./layout/app.layout.component";
import { AuthGuard } from './guards/auth.guard';
import { BusinessActivityProfileGuard } from './guards/business-activity-profile.guard';
import { PosEnabledGuard } from './guards/pos-enabled.guard';

@NgModule({
    imports: [
        RouterModule.forRoot([
            {
                path: '', component: AppLayoutComponent,
                canActivate: [AuthGuard, BusinessActivityProfileGuard],
                children: [
                    // Dashboard
                    { path: '', loadChildren: () => import('./ims/components/dashboard/dashboard.module').then(m => m.DashboardModule), canActivate: [AuthGuard], data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN'] } },

                    // Inventory Section
                    {
                        path: 'inventory',
                        loadChildren: () => import('./ims/components/inventory/inventory.module').then(m => m.InventoryModule),
                        canActivate: [AuthGuard],
                        data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN'] }
                    },

                    // Purchases Section
                    {
                        path: 'purchases',
                        loadChildren: () => import('./ims/components/purchases/purchases.module').then(m => m.PurchasesModule),
                        canActivate: [AuthGuard],
                        data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN'] }
                    },

                    // Sales Section
                    {
                        path: 'sales',
                        loadChildren: () => import('./ims/components/sales/sales.module').then(m => m.SalesModule),
                        canActivate: [AuthGuard],
                        data: { roles: ['ADMIN', 'VENDOR'] }
                    },

                    // POS Section
                    {
                        path: 'pos',
                        loadChildren: () => import('./ims/components/pos/pos.module').then(m => m.PosModule),
                        canActivate: [AuthGuard, PosEnabledGuard],
                        data: { roles: ['ADMIN', 'VENDOR', 'CASHIER'] }
                    },

                    // Finance Section
                    {
                        path: 'finance',
                        loadChildren: () => import('./ims/components/finance/finance.module').then(m => m.FinanceModule),
                        canActivate: [AuthGuard],
                        data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN', 'ACCOUNTANT', 'AUDITOR'] }
                    },

                    // Reports (business analytics; credit reports also for ACCOUNTANT / AUDITOR)
                    {
                        path: 'reports',
                        loadChildren: () => import('./ims/components/reports/reports.module').then(m => m.ReportsModule),
                        canActivate: [AuthGuard],
                        data: { roles: ['ADMIN', 'ACCOUNTANT', 'AUDITOR'] }
                    },

                    // Administration Section (Admin Only)
                    {
                        path: 'administration',
                        loadChildren: () => import('./ims/components/administration/administration.module').then(m => m.AdministrationModule),
                        canActivate: [AuthGuard],
                        data: { roles: ['ADMIN'] }
                    },

                    // Profile
                    { path: 'profile', loadChildren: () => import('./ims/components/profile/profile.module').then(m => m.ProfileModule), canActivate: [AuthGuard], data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN', 'CASHIER'] } },
                    
                    // Notifications
                    { path: 'notifications', loadChildren: () => import('./ims/components/notifications/notifications.module').then(m => m.NotificationsModule), canActivate: [AuthGuard], data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN', 'CASHIER'] } },
                    // { path: 'pages', loadChildren: () => import('./ims/components/pages/pages.module').then(m => m.PagesModule), canActivate: [AuthGuard], data: { roles: ['ADMIN', 'VENDOR', 'WAREHOUSEMAN'] } }
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
