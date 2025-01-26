import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ReturnsComponent } from './returns.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ReturnsComponent }
	])],
	exports: [RouterModule]
})
export class ReturnsRoutingModule { }
