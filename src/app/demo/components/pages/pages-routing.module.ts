import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'users', loadChildren: () => import('./users/users.module').then(m => m.UsersModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'profile', loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']}},
        { path: 'customers', loadChildren: () => import('./customers/customers.module').then(m => m.CustomersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'products', loadChildren: () => import('./products/products.module').then(m => m.ProductsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'suppliers', loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'categories', loadChildren: () => import('./categories/categories.module').then(m => m.CategoriesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'warehouses', loadChildren: () => import('./warehouses/warehouses.module').then(m => m.WarehousesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'orders', loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']}},
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class PagesRoutingModule { }
