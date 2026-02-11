import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SuppliersComponent } from './suppliers.component';
import { SupplierDetailsComponent } from './supplier-details/supplier-details.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: SuppliersComponent },
		{ path: ':id', component: SupplierDetailsComponent }
	])],
	exports: [RouterModule]
})
export class SuppliersRoutingModule { }
