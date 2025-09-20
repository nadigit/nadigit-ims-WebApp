import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FinancialDocumentsComponent } from './financial-documents.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: FinancialDocumentsComponent }
	])],
	exports: [RouterModule]
})
export class FinancialDocumentsRoutingModule { }
