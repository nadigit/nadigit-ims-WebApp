import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth.guard';

@NgModule({
    imports: [RouterModule.forChild([
        { path: 'customers', loadChildren: () => import('./customers/customers.module').then(m => m.CustomersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','VENDOR']} },
        { path: 'products', loadChildren: () => import('./products/products.module').then(m => m.ProductsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'suppliers', loadChildren: () => import('./suppliers/suppliers.module').then(m => m.SuppliersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'categories', loadChildren: () => import('./categories/categories.module').then(m => m.CategoriesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'warehouses', loadChildren: () => import('./warehouses/warehouses.module').then(m => m.WarehousesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'shops', loadChildren: () => import('./shops/shops.module').then(m => m.ShopsModule), canActivate:[AuthGuard], data : { roles:['ADMIN']} },
        { path: 'purchases', loadChildren: () => import('./purchases/purchases.module').then(m => m.PurchasesModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN','VENDOR']} },
        { path: 'warehouse-transfers', loadChildren: () => import('./warehouse-transfers/warehouse-transfers.module').then(m => m.WarehouseTransfersModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: 'stock-movements', loadChildren: () => import('./stock-movements/stock-movements.module').then(m => m.StockMovementsModule), canActivate:[AuthGuard], data : { roles:['ADMIN','WAREHOUSEMAN']} },
        { path: '**', redirectTo: '/notfound' }
    ])],
    exports: [RouterModule]
})
export class InventoryRoutingModule { }
