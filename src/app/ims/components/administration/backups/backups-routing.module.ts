import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BackupsComponent } from './backups.component';

@NgModule({
  imports: [RouterModule.forChild([
    { path: '', component: BackupsComponent }
  ])],
  exports: [RouterModule]
})
export class BackupsRoutingModule { }
