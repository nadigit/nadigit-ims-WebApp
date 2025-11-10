import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryTranslatePipe } from '../pipes/country-translate.pipe';
import { ProductDetailsComponent } from '../ims/components/inventory/products/product-details/product-details.component';
import { TranslateModule } from '@ngx-translate/core';
import { DialogModule } from 'primeng/dialog';
import { ChartModule } from 'primeng/chart';
import { ButtonModule } from 'primeng/button';
import { GalleriaModule } from 'primeng/galleria';
import { TagModule } from 'primeng/tag';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';


@NgModule({
  declarations: [CountryTranslatePipe, ProductDetailsComponent],
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
    TableModule
  ],
  exports: [
    CountryTranslatePipe, 
    ProductDetailsComponent,
    TranslateModule,
    DialogModule,
    ChartModule,
    ButtonModule,
    GalleriaModule,
    TagModule,
    SplitButtonModule,
    ProgressBarModule,
    TableModule
  ]
})
export class SharedModule { }
