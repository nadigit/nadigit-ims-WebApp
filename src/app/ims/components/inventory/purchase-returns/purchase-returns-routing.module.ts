import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { PurchaseReturnsComponent } from './purchase-returns.component';
import { PurchaseReturnDetailsPageComponent } from './purchase-return-details-page/purchase-return-details-page.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: PurchaseReturnsComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN', 'WAREHOUSEMAN', 'VENDOR'] } },
        { path: ':id', component: PurchaseReturnDetailsPageComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN', 'WAREHOUSEMAN', 'VENDOR'] } },
    ])],
    exports: [RouterModule]
})
export class PurchaseReturnsRoutingModule { }

