import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductsRoutingModule } from './products-routing.module';
import { ProductsComponent } from './products.component';
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
import { TranslateModule } from '@ngx-translate/core';
import { ReportingService } from 'src/app/utils/reporting.service';
import { TieredMenuModule } from 'primeng/tieredmenu';
import { TooltipModule } from 'primeng/tooltip';
import { ImageModule } from 'primeng/image';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { TreeSelectModule } from 'primeng/treeselect';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { DialogService, DynamicDialogModule } from 'primeng/dynamicdialog';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ChartModule } from 'primeng/chart';
import { GalleriaModule } from 'primeng/galleria';
import { SplitButtonModule } from 'primeng/splitbutton';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PaginatorModule } from 'primeng/paginator';
import { MultiSelectModule } from 'primeng/multiselect';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ListboxModule } from 'primeng/listbox';
import { CheckboxModule } from 'primeng/checkbox';
import { CalendarModule } from 'primeng/calendar';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { ProductsTableComponent } from './products-table/products-table.component';
import { ProductDetailsPageComponent } from './product-details/product-details-page.component';
import { ProductImportComponent } from './product-import/product-import.component';
import { SharedModule } from 'src/app/shared/shared.module';
import { InventorySharedModule } from '../shared/inventory-shared.module';
import { CategoriesModule } from '../categories/categories.module';
import { SuppliersModule } from '../../purchases/suppliers/suppliers.module';


@NgModule({
    imports: [
        CommonModule,
        SharedModule,
        DataViewModule,
        ProductsRoutingModule,
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
        DynamicDialogModule,
        MenuModule,
        ContextMenuModule,
        MenubarModule,
        TranslateModule,
        TieredMenuModule,
        TooltipModule,
        ImageModule,
        ZXingScannerModule,
        TreeSelectModule,
        ProgressSpinnerModule,
        TagModule,
        ProgressBarModule,
        ChartModule,
        GalleriaModule,
        SplitButtonModule,
        SelectButtonModule,
        PaginatorModule,
        MultiSelectModule,
        ConfirmDialogModule,
        ListboxModule,
        CheckboxModule,
        CalendarModule,
        TabViewModule,
        BadgeModule,
        DividerModule,
        InventorySharedModule,
        CategoriesModule,
        SuppliersModule,
    ],
    declarations: [ProductsComponent, ProductsTableComponent, ProductDetailsPageComponent, ProductImportComponent],
    providers: [ReportingService, DialogService],
    exports: [InventorySharedModule]
})
export class ProductsModule { }
