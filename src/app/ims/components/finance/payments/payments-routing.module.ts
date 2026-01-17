import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SalesPaymentsComponent } from './sales-payments/sales-payments.component';
import { PurchasePaymentsComponent } from './purchase-payments/purchase-payments.component';
import { SalesPaymentDetailsPageComponent } from './sales-payment-details-page/sales-payment-details-page.component';
import { PurchasePaymentDetailsPageComponent } from './purchase-payment-details-page/purchase-payment-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', redirectTo: 'sales', pathMatch: 'full' },
		{ path: 'sales', component: SalesPaymentsComponent },
		{ path: 'sales/:id', component: SalesPaymentDetailsPageComponent },
		{ path: 'purchase', component: PurchasePaymentsComponent },
		{ path: 'purchase/:id', component: PurchasePaymentDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class PaymentsRoutingModule { }
