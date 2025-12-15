import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RefundsComponent } from './refunds.component';
import { RefundDetailsPageComponent } from './refund-details-page/refund-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: RefundsComponent },
		{ path: ':id', component: RefundDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class RefundsRoutingModule { }
