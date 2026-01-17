import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UsersComponent } from './users.component';
import { UserDetailsPageComponent } from './user-details/user-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: UsersComponent },
		{ path: ':id', component: UserDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class UsersRoutingModule { }
