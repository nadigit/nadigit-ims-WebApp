import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProductFamiliesComponent } from './product-families.component';

@NgModule({
  imports: [RouterModule.forChild([{ path: '', component: ProductFamiliesComponent }])],
  exports: [RouterModule],
})
export class ProductFamiliesRoutingModule {}
