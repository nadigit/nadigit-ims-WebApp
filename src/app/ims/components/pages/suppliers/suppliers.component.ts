import { Component, EventEmitter, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Supplier } from 'src/app/models/supplier';
import { Country, State } from 'country-state-city';
import { SupplierService } from 'src/app/services/supplier.service';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  templateUrl: './suppliers.component.html',
  providers: [MessageService]
})
export class SuppliersComponent implements OnInit {

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

  constructor(private messageService: MessageService,
    private supplierService: SupplierService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService) { }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    this.onGetAllSuppliers();

    this.cols = [
      { field: 'supplierId', header: 'ID' },
      { field: 'name', header: 'Name' },
      { field: 'email', header: 'Email' },
      { field: 'phoneNumber', header: 'Phone Number' },
      { field: 'country', header: 'Country' },
      { field: 'city', header: 'City' },
      { field: 'address', header: 'Address' },
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }


  deleteSelectedSuppliers() {
    this.deleteSuppliersDialog = true;
  }

  editSupplier(supplier: Supplier) {
    this.selectedCountry = {};
    this.supplier = { ...supplier };
    this.supplierDialog = true;
    this.onSelectedCountry(this.supplier.country)
  }

  deleteSupplier(supplier: Supplier) {
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
