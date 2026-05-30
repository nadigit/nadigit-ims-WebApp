import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsRoutingModule } from './settings-routing.module';
import { SettingsComponent } from './settings.component';
import { TableModule } from 'primeng/table';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { RatingModule } from 'primeng/rating';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { RadioButtonModule } from 'primeng/radiobutton';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ReportingService } from 'src/app/utils/reporting.service';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { SharedModule } from 'src/app/shared/shared.module';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { CheckboxModule } from 'primeng/checkbox';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';
import { InputSwitchModule } from 'primeng/inputswitch';
import { DividerModule } from 'primeng/divider';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PanelModule } from 'primeng/panel';
import { EmailConfigComponent } from './email-config/email-config.component';
import { NotificationRecipientsComponent } from './notification-recipients/notification-recipients.component';
import { TelegramConfigComponent } from './telegram-config/telegram-config.component';
import { WhatsAppConfigComponent } from './whatsapp-config/whatsapp-config.component';
import { AiIntegrationConfigComponent } from './ai-integration-config/ai-integration-config.component';
import { ReactiveFormsModule } from '@angular/forms';
import { TaxRulesUiModule } from '../../finance/tax-rules/tax-rules-ui.module';


@NgModule({
    imports: [
        CommonModule,
        SettingsRoutingModule,
        TableModule,
        FileUploadModule,
        FormsModule,
        ReactiveFormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        RatingModule,
        InputTextModule,
        InputTextareaModule,
        DropdownModule,
        RadioButtonModule,
        InputNumberModule,
        DialogModule,
        TranslateModule,
        SplitButtonModule,
        ProgressSpinnerModule,
        SharedModule,
        CardModule,
        TabViewModule,
        TagModule,
        CheckboxModule,
        SelectButtonModule,
        TooltipModule,
        InputSwitchModule,
        DividerModule,
        ConfirmDialogModule,
        PanelModule,
        TaxRulesUiModule
    ],
    schemas: [
        CUSTOM_ELEMENTS_SCHEMA, // or NO_ERRORS_SCHEMA
    ],
    declarations: [
        SettingsComponent,
        EmailConfigComponent,
        NotificationRecipientsComponent,
        TelegramConfigComponent,
        WhatsAppConfigComponent,
        AiIntegrationConfigComponent
    ],
    providers: [ReportingService],
})
export class SettingsModule { }
