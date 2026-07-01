import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryTranslatePipe } from '../pipes/country-translate.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { GalleriaModule } from 'primeng/galleria';
import { TagModule } from 'primeng/tag';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';
import { FileSizePipe } from '../pipes/file-size.pipe';
import { ProductImagePipe } from '../pipes/product-image.pipe';
import { InventoryStatusComponent } from './components/inventory-status/inventory-status.component';
import { ProductQuantityComponent } from './components/product-quantity/product-quantity.component';


@NgModule({
  declarations: [CountryTranslatePipe, FileSizePipe, ProductImagePipe],
  imports: [
    CommonModule,
    TranslateModule,
    DialogModule,
    ChartModule,
    ButtonModule,
    GalleriaModule,
    TagModule,
    SplitButtonModule,
    ProgressBarModule,
    TableModule,
    InventoryStatusComponent,
    ProductQuantityComponent
  ],
  exports: [
    CountryTranslatePipe,
    TranslateModule,
    DialogModule,
    ChartModule,
    ButtonModule,
    GalleriaModule,
    TagModule,
    SplitButtonModule,
    ProgressBarModule,
    TableModule,
    FileSizePipe,
    ProductImagePipe,
    InventoryStatusComponent,
    ProductQuantityComponent
  ]
})
export class SharedModule { }
