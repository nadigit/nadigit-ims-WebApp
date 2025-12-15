import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReturnsComponent } from './returns.component';
import { ReturnDetailsPageComponent } from './return-details-page/return-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ReturnsComponent },
		{ path: ':id', component: ReturnDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class ReturnsRoutingModule { }
