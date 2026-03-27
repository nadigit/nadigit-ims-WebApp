import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { EmailConfigComponent } from './email-config/email-config.component';
import { NotificationRecipientsComponent } from './notification-recipients/notification-recipients.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: SettingsComponent },
		{ path: 'email', component: EmailConfigComponent },
		{ path: 'email/recipients', component: NotificationRecipientsComponent }
	])],
	exports: [RouterModule]
})
export class SettingsRoutingModule { }
