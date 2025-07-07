import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CountryTranslatePipe } from '../pipes/country-translate.pipe';



@NgModule({
  declarations: [CountryTranslatePipe],
  imports: [CommonModule],
  exports: [CountryTranslatePipe]
})
export class SharedModule { }
