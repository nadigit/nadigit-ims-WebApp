import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PurchasesRoutingModule } from './purchases-routing.module';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        PurchasesRoutingModule,
        ButtonModule,
        DropdownModule,
    ]
})
export class PurchasesModule { }
