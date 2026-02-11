import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'suppliers', loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'purchases', loadChildren: () => import('./purchases/purchases.module').then(m => m.PurchasesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: 'purchase-returns', loadChildren: () => import('./purchase-returns/purchase-returns.module').then(m => m.PurchaseReturnsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class PurchasesRoutingModule { }
