import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ExpensesComponent } from './expenses.component';
import { ExpenseDetailsPageComponent } from './expense-details-page/expense-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ExpensesComponent },
		{ path: ':id', component: ExpenseDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class ExpensesRoutingModule { }
