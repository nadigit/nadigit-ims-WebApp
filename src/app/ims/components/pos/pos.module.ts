import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PosRoutingModule } from './pos-routing.module';
import { PosComponent } from './pos.component';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { PasswordModule } from 'primeng/password';
import { InputSwitchModule } from 'primeng/inputswitch';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TagModule } from 'primeng/tag';
import { CardModule } from 'primeng/card';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { BadgeModule } from 'primeng/badge';
import { ImageModule } from 'primeng/image';
import { TranslateModule } from '@ngx-translate/core';
import { SpeedDialModule } from 'primeng/speeddial';
import { MessageModule } from 'primeng/message';
import { ScrollerModule } from 'primeng/scroller';
import { SplitButtonModule } from 'primeng/splitbutton';
import { DividerModule } from 'primeng/divider';
import { ZXingScannerModule } from '@zxing/ngx-scanner';


@NgModule({
  declarations: [
    PosComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    PosRoutingModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    InputTextareaModule,
    PasswordModule,
    InputSwitchModule,
    AutoCompleteModule,
    ToastModule,
    CheckboxModule,
    RadioButtonModule,
    TagModule,
    CardModule,
    TooltipModule,
    ProgressSpinnerModule,
    BadgeModule,
    ImageModule,
    TranslateModule,
    SpeedDialModule,
    MessageModule,
    ScrollerModule,
    SplitButtonModule,
    DividerModule,
    ZXingScannerModule
  ]
})
export class PosModule { }


