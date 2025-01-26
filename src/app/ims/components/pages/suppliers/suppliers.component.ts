import { Component, EventEmitter, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Supplier } from 'src/app/models/supplier';
import { Country, State } from 'country-state-city';
import { SupplierService } from 'src/app/services/supplier.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  templateUrl: './suppliers.component.html',
  styleUrls: ['../pages.component.css'],
  providers: [MessageService]
})
export class SuppliersComponent implements OnInit {

  Ressource : string = 'SUPPLIERS';

  supplierDialog: boolean = false;

  deleteSupplierDialog: boolean = false;

  deleteSuppliersDialog: boolean = false;

  suppliers: Supplier[] = [];

  supplier: Supplier = {};

  selectedSuppliers: Supplier[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  exportColumns!: ExportColumn[];

  canAddSupplier: boolean = false;
  canEditSupplier: boolean = false;
  canDeleteSupplier: boolean = false;
  isLoading: boolean = true;
  constructor(private messageService: MessageService,
    private supplierService: SupplierService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,) { }

  async ngOnInit() {
    this.isLoading=true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllSuppliers();
    await this.checkPermissions();
    this.cols = [
      { field: 'supplierId', header: this.translateService.instant('ID') },
      { field: 'name', header: this.translateService.instant('supplier_name') },
      { field: 'email', header: this.translateService.instant('supplier_email') },
      { field: 'phoneNumber', header: this.translateService.instant('supplier_phone_number') },
      { field: 'country', header: this.translateService.instant('supplier_country') },
      { field: 'city', header: this.translateService.instant('supplier_city') },
      { field: 'address', header: this.translateService.instant('supplier_address') },
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
    this.canAddSupplier = this.permissionService.canCreate(this.Ressource);
    this.canEditSupplier = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteSupplier = this.permissionService.canDelete(this.Ressource);

  }

  deleteSelectedSuppliers() {
    if (!this.canDeleteSupplier) return;
    this.deleteSuppliersDialog = true;
  }

  editSupplier(supplier: Supplier) {
    if (!this.canEditSupplier) return;
    this.selectedCountry = {};
    this.supplier = { ...supplier };
    this.supplierDialog = true;
    this.onSelectedCountry(this.supplier.country)
  }

  deleteSupplier(supplier: Supplier) {
    if (!this.canDeleteSupplier) return;
    this.deleteSupplierDialog = true;
    this.supplier = { ...supplier };
  }

  confirmDeleteSelected() {
    this.deleteSuppliersDialog = false;
    this.selectedSuppliers.forEach(selectedSupplier => this.onDeleteSupplier(selectedSupplier.supplierId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Suppliers Deleted', life: 3000 });
    this.selectedSuppliers = [];
  }

  async confirmDelete() {
    this.deleteSupplierDialog = false;
    await this.onDeleteSupplier(this.supplier.supplierId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Supplier Deleted', life: 3000 });
    this.supplier = {};
  }

  hideDialog() {
    this.supplierDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  openNew() {
    if (!this.canAddSupplier) return;
    this.selectedCountry = {};
    this.supplier = {};
    this.submitted = false;
    this.supplierDialog = true;
  }

  saveSupplier() {
    this.submitted = true;
    if (this.supplier.name) {
      if (this.supplier.supplierId) {
        this.updateSupplier(this.supplier.supplierId, this.supplier) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Supplier updated with success', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating supplier', life: 3000 })
      } else {
        this.addSupplier(this.supplier) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Supplier created with success', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding supplier', life: 3000 }))
      }
      this.suppliers = [...this.suppliers];
      this.supplierDialog = false;
      this.supplier = {};
    }
    else{
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

  async onGetAllSuppliers() {
    await this.supplierService.getSuppliers()
      .subscribe({
        next: (response: any) => {
          this.suppliers = response;
          this.suppliers.forEach((supplier: any) => (supplier.creationDate = new Date(<Date>supplier.creationDate)));
        },
        error: (err: any) => {
          console.error(err)
        },
        complete: () =>{
          this.isLoading=false;
        }
      })
  }

  async onDeleteSupplier(id: any) {
    await this.supplierService.deleteSupplier(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllSuppliers();
        },
        error(err: any) {
          console.error(err)
        },
      })
  }


  async updateSupplier(id: any, supplier: any): Promise<any> {
    console.log(supplier)
    await this.supplierService.updateSupplier(id, supplier)
      .subscribe({
        next: (response: any) => {
          this.onGetAllSuppliers();
          return true;
        },
        error(err: any) {
          console.error(err);
          return false;
        },
      })
  }

  async addSupplier(data: any): Promise<any> {
    await this.supplierService.saveSupplier(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllSuppliers();
          return true;
        },
        error(err: any) {
          console.error(err);
          return false;
        },
      })
  }

  onChangeCountry() {
    this.supplier.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.supplier.country != this.selectedCountry) && (this.supplier.city == undefined)) this.supplier.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

  }

  exportPdf() {
    this.reportingService.exportPdf(this.exportColumns, this.suppliers, 'suppliers')
  }

  exportExcel() {
    // Clone the suppliers array to avoid modifying the original array
    const modifiedSuppliers = this.suppliers.map(supplier => {
      // Create a copy of the supplier object to modify
      const modifiedSupplier = { ...supplier };

      // Remove the column you want to exclude
      delete modifiedSupplier.creationDate;

      // Alternatively, if the columnToRemove is a property with a known name, you can use:
      // delete modifiedSupplier['columnToRemove'];

      return modifiedSupplier;
    });

    // Now, export the modified array to Excel
    this.reportingService.exportExcel(modifiedSuppliers,'suppliers');
  }

}
