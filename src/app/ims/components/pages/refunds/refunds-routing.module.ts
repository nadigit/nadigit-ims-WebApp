import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { RefundsComponent } from './refunds.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: RefundsComponent }
	])],
	exports: [RouterModule]
})
export class RefundsRoutingModule { }
