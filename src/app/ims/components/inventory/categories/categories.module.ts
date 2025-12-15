import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoriesRoutingModule } from './categories-routing.module';
import { CategoriesComponent } from './categories.component';
import { CategoryDetailsComponent } from './category-details/category-details.component';
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
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { TagModule } from 'primeng/tag';
import { ImageModule } from 'primeng/image';
import { GalleriaModule } from 'primeng/galleria';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { SharedModule } from 'src/app/shared/shared.module';



@NgModule({
    imports: [
        CommonModule,
        CategoriesRoutingModule,
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
        ProgressSpinnerModule,
        TooltipModule,
        TagModule,
        ImageModule,
        GalleriaModule,
        CardModule,
        CheckboxModule,
        SharedModule
    ],
    declarations: [CategoriesComponent, CategoryDetailsComponent],
    providers: [ReportingService]
})
export class CategoriesModule { }
