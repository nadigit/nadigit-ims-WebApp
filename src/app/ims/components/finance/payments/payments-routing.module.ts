import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { PaymentsComponent } from './payments.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: PaymentsComponent }
	])],
	exports: [RouterModule]
})
export class PaymentsRoutingModule { }
