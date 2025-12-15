import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MyCompanyRoutingModule } from './my-company-routing.module';
import { MyCompanyComponent } from './my-company.component';
import { FileUploadModule } from 'primeng/fileupload';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { DialogModule } from 'primeng/dialog';
import { TranslateModule } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { ImageModule } from 'primeng/image';
import { TooltipModule } from 'primeng/tooltip';
import { SharedModule } from 'src/app/shared/shared.module';
import { CardModule } from 'primeng/card';

@NgModule({
    imports: [
        CommonModule,
        MyCompanyRoutingModule,
        FileUploadModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        InputTextModule,
        InputTextareaModule,
        DropdownModule,
        DialogModule,
        TranslateModule,
        ProgressSpinnerModule,
        OrganizationChartModule,
        ImageModule,
        TooltipModule,
        SharedModule,
        CardModule
    ],
    schemas: [
        CUSTOM_ELEMENTS_SCHEMA,
    ],
    declarations: [MyCompanyComponent],
})
export class MyCompanyModule { }

