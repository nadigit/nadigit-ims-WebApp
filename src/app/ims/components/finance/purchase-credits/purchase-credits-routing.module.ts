import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';
import { PurchaseCreditsComponent } from './purchase-credits.component';
import { PurchaseCreditDetailsPageComponent } from './purchase-credit-details-page/purchase-credit-details-page.component';

@NgModule({
    imports: [RouterModule.forChild([
        { path: '', component: PurchaseCreditsComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN', 'VENDOR'] } },
        { path: ':id', component: PurchaseCreditDetailsPageComponent, canActivate: [AuthGuard], data: { roles: ['ADMIN', 'VENDOR'] } },
    ])],
    exports: [RouterModule]
})
export class PurchaseCreditsRoutingModule { }

