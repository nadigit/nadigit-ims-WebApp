import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackupsRoutingModule } from './backups-routing.module';
import { BackupsComponent } from './backups.component';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { TranslateModule } from '@ngx-translate/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    BackupsRoutingModule,
    ButtonModule,
    TableModule,
    ToastModule,
    DialogModule,
    ConfirmDialogModule,
    TagModule,
    ProgressSpinnerModule,
    TooltipModule,
    CardModule,
    DropdownModule,
    CheckboxModule,
    InputTextModule,
    InputTextareaModule,
    TranslateModule
  ],
  declarations: [BackupsComponent]
})
export class BackupsModule { }
