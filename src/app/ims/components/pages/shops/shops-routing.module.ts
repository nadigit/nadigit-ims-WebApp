import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ShopsComponent } from './shops.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ShopsComponent }
	])],
	exports: [RouterModule]
})
export class ShopsRoutingModule { }
