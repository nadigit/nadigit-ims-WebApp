import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryRoutingModule } from './inventory-routing.module';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';

@NgModule({
    declarations: [],
    imports: [
        CommonModule,
        InventoryRoutingModule,
        ButtonModule,
        DropdownModule
    ]
})
export class InventoryModule { }
