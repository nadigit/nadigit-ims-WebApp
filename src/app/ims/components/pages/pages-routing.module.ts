import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'users', loadChildren: () => import('./users/users.module').then(m => m.UsersModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'settings', loadChildren: () => import('./settings/settings.module').then(m => m.SettingsModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'profile', loadChildren: () => import('./profile/profile.module').then(m => m.ProfileModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']}},
        { path: 'customers', loadChildren: () => import('./customers/customers.module').then(m => m.CustomersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'products', loadChildren: () => import('./products/products.module').then(m => m.ProductsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'suppliers', loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'categories', loadChildren: () => import('./categories/categories.module').then(m => m.CategoriesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'warehouses', loadChildren: () => import('./warehouses/warehouses.module').then(m => m.WarehousesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'shops', loadChildren: () => import('./shops/shops.module').then(m => m.ShopsModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'purchases', loadChildren: () => import('./purchases/purchases.module').then(m => m.PurchasesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: 'expenses', loadChildren: () => import('./expenses/expenses.module').then(m => m.ExpensesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: 'payments', loadChildren: () => import('./payments/payments.module').then(m => m.PaymentsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'refunds', loadChildren: () => import('./refunds/refunds.module').then(m => m.RefundsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'orders', loadChildren: () => import('./orders/orders.module').then(m => m.OrdersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']}},
        { path: 'returns', loadChildren: () => import('./returns/returns.module').then(m => m.ReturnsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']}},
        { path: 'financial-documents', loadChildren: () => import('./financial-documents/financial-documents.module').then(m => m.FinancialDocumentsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR','ACCOUNTANT','AUDITOR']}},
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class PagesRoutingModule { }
