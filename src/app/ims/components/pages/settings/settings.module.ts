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
import { TabMenuModule } from 'primeng/tabmenu';
import { StepsModule } from 'primeng/steps';
import { PickListModule } from 'primeng/picklist';
import { ChipModule } from 'primeng/chip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ImageModule } from 'primeng/image';
import { InputSwitchModule } from 'primeng/inputswitch';
import { TooltipModule } from 'primeng/tooltip';



@NgModule({
    imports: [
        CommonModule,
        SettingsRoutingModule,
        TableModule,
        FileUploadModule,
        FormsModule,
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
        TabMenuModule,
        StepsModule,
        PickListModule,
        ChipModule,
        ProgressSpinnerModule,
        OrganizationChartModule,
        ImageModule,
        InputSwitchModule,
        TooltipModule
    ],
    schemas: [
        CUSTOM_ELEMENTS_SCHEMA, // or NO_ERRORS_SCHEMA
    ],
    declarations: [SettingsComponent],
    providers: [ReportingService],
})
export class SettingsModule { }
