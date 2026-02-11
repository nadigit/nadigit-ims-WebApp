import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PurchasesComponent } from './purchases.component';
import { PurchaseDetailsPageComponent } from './purchase-details-page/purchase-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: PurchasesComponent },
		{ path: ':id', component: PurchaseDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class PurchasesRoutingModule { }
