import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MyCompanyComponent } from './my-company.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: MyCompanyComponent }
	])],
	exports: [RouterModule]
})
export class MyCompanyRoutingModule { }

