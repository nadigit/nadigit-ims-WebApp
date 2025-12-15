import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CategoriesComponent } from './categories.component';
import { CategoryDetailsComponent } from './category-details/category-details.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: CategoriesComponent },
		{ path: ':id', component: CategoryDetailsComponent }
	])],
	exports: [RouterModule]
})
export class CategoriesRoutingModule { }
