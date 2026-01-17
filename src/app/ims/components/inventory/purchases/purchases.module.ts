import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PurchasesRoutingModule } from './purchases-routing.module';
import { PurchasesComponent } from './purchases.component';
import { PurchaseDetailsPageComponent } from './purchase-details-page/purchase-details-page.component';
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
import { ReportingService } from 'src/app/utils/reporting.service';
import { TranslateModule } from '@ngx-translate/core';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { CalendarModule } from 'primeng/calendar';
import { TooltipModule } from 'primeng/tooltip';
import { PickListModule } from 'primeng/picklist';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { TimelineModule } from 'primeng/timeline';
import { SharedModule } from 'src/app/shared/shared.module';
import { AccordionModule } from 'primeng/accordion';
import { ChipModule } from 'primeng/chip';
import { BadgeModule } from 'primeng/badge';
import { TabViewModule } from 'primeng/tabview';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { SliderModule } from 'primeng/slider';
import { PurchaseImportComponent } from './purchase-import/purchase-import.component';
import { ProductsModule } from '../products/products.module';

@NgModule({
    imports: [
        CommonModule,
        PurchasesRoutingModule,
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
        CalendarModule,
        TooltipModule,
        PickListModule,
        SelectButtonModule,
        TagModule,
        TimelineModule,
        SharedModule,
        AccordionModule,
        ChipModule,
        BadgeModule,
        TabViewModule,
        DividerModule,
        CheckboxModule,
        SliderModule,
        ProductsModule // Import ProductsModule to use ProductFormComponent
    ],
    declarations: [PurchasesComponent, PurchaseDetailsPageComponent, PurchaseImportComponent],
    providers: [ReportingService],
})
export class PurchasesModule { }
