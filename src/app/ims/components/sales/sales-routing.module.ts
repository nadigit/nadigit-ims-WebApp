import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { LicenseFeatureGuard } from 'src/app/guards/license-feature.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'orders', loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']}},
        { path: 'returns', loadChildren: () => import('./returns/returns.module').then(m => m.ReturnsModule), canActivate:[AuthGuard, LicenseFeatureGuard], data : { roles:['ADMIN','VENDOR'], licenseFeature: 'ORDER_RETURNS'}},
        { path: 'customers', loadChildren: () => import('./customers/customers.module').then(m => m.CustomersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']}},
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class SalesRoutingModule { }
