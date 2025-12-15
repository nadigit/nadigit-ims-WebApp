import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ShopsComponent } from './shops.component';
import { ShopDetailsComponent } from './shop-details/shop-details.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ShopsComponent },
		{ path: ':id', component: ShopDetailsComponent }
	])],
	exports: [RouterModule]
})
export class ShopsRoutingModule { }
