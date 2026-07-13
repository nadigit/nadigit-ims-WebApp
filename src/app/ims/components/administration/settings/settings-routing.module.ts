import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SettingsComponent } from './settings.component';
import { EmailConfigComponent } from './email-config/email-config.component';
import { NotificationRecipientsComponent } from './notification-recipients/notification-recipients.component';
import { TelegramConfigComponent } from './telegram-config/telegram-config.component';
import { WhatsAppConfigComponent } from './whatsapp-config/whatsapp-config.component';
import { AiIntegrationConfigComponent } from './ai-integration-config/ai-integration-config.component';
import { TrendDataConfigComponent } from './trend-data-config/trend-data-config.component';

@NgModule({
	imports: [RouterModule.forChild([
		{ path: '', component: SettingsComponent },
		{ path: 'email', component: EmailConfigComponent },
		{ path: 'email/recipients', component: NotificationRecipientsComponent },
		{ path: 'telegram', component: TelegramConfigComponent },
		{ path: 'whatsapp', component: WhatsAppConfigComponent },
		{ path: 'ai', component: AiIntegrationConfigComponent },
		{ path: 'trends', component: TrendDataConfigComponent }
	])],
	exports: [RouterModule]
})
export class SettingsRoutingModule { }
