import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { WarehousesComponent } from './warehouses.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: WarehousesComponent }
	])],
	exports: [RouterModule]
})
export class WarehousesRoutingModule { }
