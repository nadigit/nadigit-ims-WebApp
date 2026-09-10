import { NgModule } from '@angular/core';
import { FeatureLockedComponent } from 'src/app/shared/feature-locked';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WarehousesRoutingModule } from './warehouses-routing.module';
import { WarehousesComponent } from './warehouses.component';
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
import { SharedModule } from 'src/app/shared/shared.module';
import { GalleriaModule } from 'primeng/galleria';
import { ImageModule } from 'primeng/image';
import { WarehouseDetailsComponent } from './warehouse-details/warehouse-details.component';
import { WarehouseFormDialogComponent } from './warehouse-form-dialog/warehouse-form-dialog.component';
import { CardModule } from 'primeng/card';
import { AvatarModule } from 'primeng/avatar';
import { TabViewModule } from 'primeng/tabview';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { CheckboxModule } from 'primeng/checkbox';
import { InventorySharedModule } from '../shared/inventory-shared.module';
import { ProductsModule } from '../products/products.module';

@NgModule({
    imports: [
    FeatureLockedComponent,
        CommonModule,
        WarehousesRoutingModule,
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
        SharedModule,
        ImageModule,
        GalleriaModule,
        CardModule,
        AvatarModule,
        TabViewModule,
        BadgeModule,
        DividerModule,
        CheckboxModule,
        InventorySharedModule,
        ProductsModule,
    ],
    declarations: [WarehousesComponent, WarehouseDetailsComponent],
    providers: [ReportingService],
    exports: [],
})
export class WarehousesModule { }
