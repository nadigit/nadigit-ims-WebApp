import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'users', loadChildren: () => import('./users/users.module').then(m => m.UsersModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'settings', loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'my-company', loadChildren: () => import('./my-company/my-company.module').then(m => m.MyCompanyModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class AdministrationRoutingModule { }
