import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { NotificationPreferencesComponent } from './notification-preferences/notification-preferences.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: ProfileComponent },
		{ path: 'notifications', component: NotificationPreferencesComponent }
	])],
	exports: [RouterModule]
})
export class ProfileRoutingModule { }
