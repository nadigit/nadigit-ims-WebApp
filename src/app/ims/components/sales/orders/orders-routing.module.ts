import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { OrdersComponent } from './orders.component';
import { OrderDetailsPageComponent } from './order-details-page/order-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: OrdersComponent },
		{ path: ':id', component: OrderDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class OrdersRoutingModule { }
