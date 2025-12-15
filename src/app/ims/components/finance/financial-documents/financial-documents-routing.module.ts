import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FinancialDocumentsComponent } from './financial-documents.component';
import { FinancialDocumentDetailsPageComponent } from './financial-document-details-page/financial-document-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: FinancialDocumentsComponent },
		{ path: ':id', component: FinancialDocumentDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class FinancialDocumentsRoutingModule { }
