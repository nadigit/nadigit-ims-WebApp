import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShopsRoutingModule } from './shops-routing.module';
import { ShopsComponent } from './shops.component';
import { ShopDetailsComponent } from './shop-details/shop-details.component';
import { ShopFormDialogModule } from './shop-form-dialog/shop-form-dialog.module';
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
import { CalendarModule } from 'primeng/calendar';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { SharedModule } from 'src/app/shared/shared.module';
import { AvatarModule } from 'primeng/avatar';
import { BadgeModule } from 'primeng/badge';
import { DividerModule } from 'primeng/divider';
import { PaginatorModule } from 'primeng/paginator';


@NgModule({
    imports: [
        CommonModule,
        ShopsRoutingModule,
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
        CalendarModule,
        ProgressSpinnerModule,
        TooltipModule,
        CardModule,
        TabViewModule,
        TagModule,
        SharedModule,
        AvatarModule,
        BadgeModule,
        DividerModule,
        PaginatorModule,
        ShopFormDialogModule
    ],
    declarations: [ShopsComponent, ShopDetailsComponent],
    providers: [ReportingService],
})
export class ShopsModule { }
