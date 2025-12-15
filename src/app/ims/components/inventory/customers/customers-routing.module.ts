import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CustomersComponent } from './customers.component';
import { CustomerDetailsComponent } from './customer-details/customer-details.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: CustomersComponent },
		{ path: ':id', component: CustomerDetailsComponent }
	])],
	exports: [RouterModule]
})
export class CustomersRoutingModule { }
