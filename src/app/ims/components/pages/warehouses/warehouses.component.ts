import { Component, EventEmitter, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Warehouse } from 'src/app/models/warehouse';
import { Country, State } from 'country-state-city';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  templateUrl: './warehouses.component.html',
  styleUrls: ['../pages.component.css'],
  providers: [MessageService]
})
export class WarehousesComponent implements OnInit {

  Ressource : string = 'WAREHOUSES';

  warehouseDialog: boolean = false;

  deleteWarehouseDialog: boolean = false;

  deleteWarehousesDialog: boolean = false;

  warehouses: Warehouse[] = [];

  warehouse: Warehouse = {};

  selectedWarehouses: Warehouse[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  exportColumns!: ExportColumn[];

  canAddWarehouse: boolean = false;
  canEditWarehouse: boolean = false;
  canDeleteWarehouse: boolean = false;

  isLoading: boolean = true;

  constructor(private messageService: MessageService,
     private warehouseService: WarehouseService,
     private reportingService: ReportingService,
     private translate: TranslateService,
     private translateService: TranslationService,
     private permissionService: PermissionService,
     public keycloakService: KeycloakService,) { }

  async ngOnInit() {
    this.isLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    await this.checkPermissions();
    this.onGetAllWarehouses();

    this.cols = [
      { field: 'warehouseId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('warehouse_name') },
      { field: 'description', header: this.translateService.instant('warehouse_description') },
      { field: 'city', header: this.translateService.instant('warehouse_city') },
      { field: 'country', header: this.translateService.instant('warehouse_country') },
      { field: 'address', header: this.translateService.instant('warehouse_address') }
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddWarehouse = this.permissionService.canCreate(this.Ressource);
    this.canEditWarehouse = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteWarehouse = this.permissionService.canDelete(this.Ressource);

  }

  deleteSelectedWarehouses() {
    if (!this.canDeleteWarehouse) return;
    this.deleteWarehousesDialog = true;
  }

  editWarehouse(warehouse: Warehouse) {
    if (!this.canEditWarehouse) return;
    this.selectedCountry = {};
    this.warehouse = { ...warehouse };
    this.warehouseDialog = true;
    console.log(this.warehouse.country)
    this.onSelectedCountry(this.warehouse.country)
  }

  deleteWarehouse(warehouse: Warehouse) {
    if (!this.canDeleteWarehouse) return;
    this.deleteWarehouseDialog = true;
    this.warehouse = { ...warehouse };
  }

  async confirmDeleteSelected() {
    this.deleteWarehousesDialog = false;
    await this.selectedWarehouses.forEach(selectedWarehouse => this.onDeleteWarehouse(selectedWarehouse.warehouseId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Warehouses Deleted', life: 3000 });
    this.selectedWarehouses = [];
  }

  async confirmDelete() {
    this.deleteWarehouseDialog = false;
    await this.onDeleteWarehouse(this.warehouse.warehouseId);
    //this.users = this.users.filter(val => val.id !== this.user.id);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Warehouse Deleted', life: 3000 });
    this.warehouse = {};
  }

  hideDialog() {
    this.warehouseDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  openNew() {
    if (!this.canAddWarehouse) return;
    this.selectedCountry = {};
    this.warehouse = {};
    this.submitted = false;
    this.warehouseDialog = true;
  }

  saveWarehouse() {
    this.submitted = true;
    if (this.warehouse.name) {
      if (this.warehouse.warehouseId) {
        this.updateWarehouse(this.warehouse.warehouseId, this.warehouse) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Warehouse Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating warehouse', life: 3000 })
      } else {
        this.addWarehouse(this.warehouse) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Warehouse Updated', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding warehouse', life: 3000 }))
      }
      this.warehouses = [...this.warehouses];
      this.warehouseDialog = false;
      this.warehouse = {};
    } else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
      return;
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }
 

  clear(table: Table) {
    table.clear();
  }

  getSeverity(status: any) {
    switch (status) {
      case false:
        return 'danger';

      case true:
        return 'success';

      case 'new':
        return 'info';

      case 'negotiation':
        return 'warning';

      case 'renewal':
        return null;

      default:
        return '';
    }
  }

  async onGetAllWarehouses() {
    await this.warehouseService.getWarehouses()
      .subscribe({
        next: (response: any) => {
          this.warehouses = response;
          this.warehouses.forEach((warehouse: any) => (warehouse.creationDate = new Date(<Date>warehouse.creationDate)));
          console.log(this.warehouses);
        },
        error: (err: any) => {
          console.log(err)
        },
        complete: () =>{
          this.isLoading=false;
        }
      })
  }

  async onDeleteWarehouse(id: any) {
    await this.warehouseService.deleteWarehouse(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
        },
        error(err: any) {
          console.log(err)
        },
      })
  }


  async updateWarehouse(id: any, warehouse: any): Promise<any> {
    console.log(warehouse)
    await this.warehouseService.updateWarehouse(id, warehouse)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addWarehouse(data: any): Promise<any> {
    await this.warehouseService.saveWarehouse(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllWarehouses();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  // async onSelectedCountry(selectedCountry: any) {
  //   console.log(this.warehouse.country)
  //     this.countries.forEach(element => {
  //       if ((this.warehouse.country != this.selectedCountry) && (this.warehouse.country != undefined)) this.warehouse.city=undefined;
  //       if (element.name === selectedCountry) {
  //         this.selectedCountry = element; 
  //       }
  //     });
  //   this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);
  //   console.log(this.states);
  // }
  
  onChangeCountry(){
    this.warehouse.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    console.log('event :' + event);
    console.log(event.value);
    if ((this.warehouse.country != this.selectedCountry) && (this.warehouse.city == undefined)) this.warehouse.city=undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element; 
      }
    });
    console.log(this.selectedCountry.isoCode)
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

}

exportPdf() {
  this.reportingService.exportPdf(this.exportColumns, this.warehouses, 'warehouses')
}

exportExcel() {
  // Clone the suppliers array to avoid modifying the original array
  const modifiedWarehouses = this.warehouses.map(warehouse => {
    // Create a copy of the supplier object to modify
    const modifiedWarehouse = { ...warehouse };

    // Remove the column you want to exclude
    delete modifiedWarehouse.creationDate;

    // Alternatively, if the columnToRemove is a property with a known name, you can use:
    // delete modifiedSupplier['columnToRemove'];

    return modifiedWarehouse;
  });

  // Now, export the modified array to Excel
  this.reportingService.exportExcel(modifiedWarehouses,'warehouses');
}

}
