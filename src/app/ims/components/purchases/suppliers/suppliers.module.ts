import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SuppliersRoutingModule } from './suppliers-routing.module';
import { SuppliersComponent } from './suppliers.component';
import { SupplierFormDialogComponent } from './supplier-form-dialog/supplier-form-dialog.component';
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
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { AvatarGroupModule } from 'primeng/avatargroup';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { SharedModule } from 'src/app/shared/shared.module';
import { GalleriaModule } from 'primeng/galleria';
import { ImageModule } from 'primeng/image';
import { SupplierDetailsComponent } from './supplier-details/supplier-details.component';
import { InventorySharedModule } from '../../inventory/shared/inventory-shared.module';



@NgModule({
    imports: [
        CommonModule,
        SuppliersRoutingModule,
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
        AvatarModule,
        AvatarGroupModule,
        TabViewModule,
        TagModule,
        ChartModule,
        CardModule,
        SharedModule,
        GalleriaModule,
        ImageModule,
        InventorySharedModule
    ],
    declarations: [SuppliersComponent, SupplierDetailsComponent, SupplierFormDialogComponent],
    providers: [ReportingService],
    exports: [SupplierFormDialogComponent],
})
export class SuppliersModule { }
