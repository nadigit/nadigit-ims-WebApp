import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PurchasesComponent } from './purchases.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: PurchasesComponent }
	])],
	exports: [RouterModule]
})
export class PurchasesRoutingModule { }
