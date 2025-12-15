import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProductsComponent } from './products.component';
import { ProductDetailsPageComponent } from './product-details/product-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ProductsComponent },
		{ path: ':id', component: ProductDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class ProductsRoutingModule { }
