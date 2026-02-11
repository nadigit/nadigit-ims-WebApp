import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UsersComponent } from './users.component';
import { UserDetailsPageComponent } from './user-details/user-details-page.component';
import { RoleDetailsPageComponent } from './role-details/role-details-page.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: UsersComponent },
		{ path: 'roles/:name', component: RoleDetailsPageComponent },
		{ path: ':id', component: UserDetailsPageComponent }
	])],
	exports: [RouterModule]
})
export class UsersRoutingModule { }
