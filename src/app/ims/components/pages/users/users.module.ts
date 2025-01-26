import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsersRoutingModule } from './users-routing.module';
import { UsersComponent } from './users.component';
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
import { MultiSelectModule } from 'primeng/multiselect';
import { TooltipModule } from 'primeng/tooltip';


@NgModule({
    imports: [
        CommonModule,
        UsersRoutingModule,
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
        MultiSelectModule,
        TooltipModule
    ],
    declarations: [UsersComponent],
    providers: [ReportingService],
})
export class UsersModule { }
