import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WarehousesComponent } from './warehouses.component';
import { WarehouseDetailsComponent } from './warehouse-details/warehouse-details.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: WarehousesComponent },
		{ path: ':id', component: WarehouseDetailsComponent }
	])],
	exports: [RouterModule]
})
export class WarehousesRoutingModule { }
