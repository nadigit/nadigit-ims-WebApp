import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdministrationRoutingModule } from './administration-routing.module';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        AdministrationRoutingModule,
        ButtonModule,
        DropdownModule
    ]
})
export class AdministrationModule { }
