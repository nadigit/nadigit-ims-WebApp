import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrdersRoutingModule } from './orders-routing.module';
import { FilterProductsPipe, OrdersComponent } from './orders.component';
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
import { DataViewModule } from 'primeng/dataview';
import { MenuModule } from 'primeng/menu';
import { ContextMenuModule } from 'primeng/contextmenu';
import { MenubarModule } from 'primeng/menubar';
import { PickListModule } from 'primeng/picklist';
import { TranslateModule } from '@ngx-translate/core';
import { TimelineModule } from 'primeng/timeline';
import { CardModule } from 'primeng/card';
import { GalleriaModule } from 'primeng/galleria';
import { AccordionModule } from 'primeng/accordion';
import { BadgeModule } from 'primeng/badge';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CalendarModule } from 'primeng/calendar';
import { ReportingService } from 'src/app/utils/reporting.service';
import { DisableDblClickDirective } from 'src/app/utils/disable_dblclick.directive';
import { TooltipModule } from 'primeng/tooltip';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { ChipModule } from 'primeng/chip';
import { ReactiveFormsModule } from '@angular/forms';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { InputSwitchModule } from 'primeng/inputswitch';
import { SharedModule } from 'src/app/shared/shared.module';
import { OrdersTableComponent } from './orders-table/orders-table.component';
import { OrderDetailsPageComponent } from './order-details-page/order-details-page.component';

@NgModule({
    imports: [
        CommonModule,
        DataViewModule,
        OrdersRoutingModule,
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
        MenuModule,
        ContextMenuModule,
        MenubarModule,
        PickListModule,
        TranslateModule,
        TimelineModule,
        CardModule,
        GalleriaModule,
        AccordionModule,
        BadgeModule,
        ProgressSpinnerModule,
        SelectButtonModule,
        CalendarModule,
        TooltipModule,
        DynamicDialogModule,
        ChipModule,
        ReactiveFormsModule,
        TabViewModule,
        TagModule,
        AutoCompleteModule,
        InputSwitchModule,
        SharedModule
    ],
    declarations: [OrdersComponent, FilterProductsPipe, DisableDblClickDirective, OrdersTableComponent, OrderDetailsPageComponent],
    providers: [ReportingService]
})
export class OrdersModule { }
