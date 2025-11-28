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
import { FileSizePipe } from 'src/app/pipes/file-size.pipe';
import { SharedModule } from 'src/app/shared/shared.module';
import { ProductsTableComponent } from './products-table/products-table.component';


@NgModule({
    imports: [
        CommonModule,
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
        SharedModule
    ],
    declarations: [ProductsComponent, FileSizePipe, ProductsTableComponent],
    providers: [ReportingService, DialogService]
})
export class ProductsModule { }
