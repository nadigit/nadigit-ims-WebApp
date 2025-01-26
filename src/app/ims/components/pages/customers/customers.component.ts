import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Customer } from 'src/app/models/customer';
import { Country, State } from 'country-state-city';
import { CustomerService } from 'src/app/services/customer.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Order } from 'src/app/models/order';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  templateUrl: './customers.component.html',
  styleUrls: ['../pages.component.css'],
  providers: [MessageService]
})
export class CustomersComponent implements OnInit {

  Ressource: string = 'CUSTOMERS';

  first = 0;

  rows = 10;

  customerDialog: boolean = false;

  deleteCustomerDialog: boolean = false;

  deleteCustomersDialog: boolean = false;

  customers: Customer[] = [];

  customer: Customer = {};

  selectedCustomers: Customer[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  displayHistoryDialog: boolean = false;

  customerOrders: Order[] = [];

  exportColumns!: ExportColumn[];

  // Permissions
  canAddCustomer: boolean = false;
  canEditCustomer: boolean = false;
  canDeleteCustomer: boolean = false;
  canReadHistory: boolean = false;
  isLoading: boolean = true;

  constructor(private messageService: MessageService, 
    private customerService: CustomerService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    public keycloakService: KeycloakService,
    private translateService: TranslationService,
    private permissionService: PermissionService,) { }

  async ngOnInit() {
    this.isLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });

    await this.checkPermissions();
    this.onGetAllCustomers();

    this.cols = [
      { field: 'customerId', header: this.translateService.instant('customer_id') },
      { field: 'firstName', header: this.translateService.instant('customer_first_name') },
      { field: 'lastName', header: this.translateService.instant('customer_last_name') },
      { field: 'email', header: this.translateService.instant('customer_email') },
      { field: 'country', header: this.translateService.instant('customer_country') },
      { field: 'city', header: this.translateService.instant('customer_city') },
      { field: 'address', header: this.translateService.instant('customer_address') },
      { field: 'zip', header: this.translateService.instant('customer_zip') },
      { field: 'phoneNumber', header: this.translateService.instant('customer_phone_number') },
      { field: 'customerType', header: this.translateService.instant('customer_type') },
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }


  deleteSelectedCustomers() {
    if (!this.canDeleteCustomer) return;
    this.deleteCustomersDialog = true;
  }

  editCustomer(customer: Customer) {
    if (!this.canEditCustomer) return;
    this.selectedCountry = {};
    this.customer = { ...customer };
    this.customerDialog = true;
    this.onSelectedCountry(this.customer.country)
  }

  deleteCustomer(customer: Customer) {
    if (!this.canDeleteCustomer) return;
    this.deleteCustomerDialog = true;
    this.customer = { ...customer };
  }

  async confirmDeleteSelected() {
    this.deleteCustomersDialog = false;
    await this.selectedCustomers.forEach(selectedCustomer => this.onDeleteCustomer(selectedCustomer.customerId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customers Deleted', life: 3000 });
    this.selectedCustomers = [];
  }

  async confirmDelete() {
    this.deleteCustomerDialog = false;
    await this.onDeleteCustomer(this.customer.customerId);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Deleted', life: 3000 });
    this.customer = {};
  }

  hideDialog() {
    this.customerDialog = false;
    this.submitted = false;
    this.displayHistoryDialog = false;
    this.selectedCountry = {};
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddCustomer = this.permissionService.canCreate(this.Ressource);
    this.canEditCustomer = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteCustomer = this.permissionService.canDelete(this.Ressource);
    this.canReadHistory = this.permissionService.canHistoryRead(this.Ressource);
  }

  openNew() {
    if (!this.canAddCustomer) return;
    this.selectedCountry = {};
    this.customer = {};
    this.submitted = false;
    this.customerDialog = true;
  }

  saveCustomer() {
    this.submitted = true;

    if (!this.customer.customerType) {
      this.messageService.add({ severity: 'warn', summary: 'No values entered', detail: 'Customer Type is required' });
      return; // Exit the method to prevent submission
    }

    if (this.customer.customerType==='Particular' && !this.customer.cin) {
      this.messageService.add({ severity: 'warn', summary: 'No values entered', detail: 'CIN is required' });
      return; // Exit the method to prevent submission
    } else if(this.customer.customerType==='Company' && !this.customer.ice){
      this.messageService.add({ severity: 'warn', summary: 'No values entered', detail: 'ICE is required' });
      return;
    }
    

    if (this.customer.firstName && this.customer.lastName) {
      if (this.customer.customerId) {
        this.updateCustomer(this.customer.customerId, this.customer) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating customer', life: 3000 })
      } else {
        this.addCustomer(this.customer) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Added', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding customer', life: 3000 }))
      }
      this.customers = [...this.customers];
      this.customerDialog = false;
      this.customer = {};
    } else{
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
      return;
    }
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }
 

  async onGetAllCustomers() {
    await this.customerService.getCustomers()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          this.customers.forEach((customer: any) => (customer.creationDate = new Date(<Date>customer.creationDate)));
        },
        error: (err: any) => {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting customers', life: 3000 })
          console.log(err)
        },
        complete: () => {
          // Set loading to false after data is fully loaded
          this.isLoading = false;
      }
      })
  }

  async onDeleteCustomer(id: any) {
    await this.customerService.deleteCustomer(id)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCustomers();
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while deleting customer', life: 3000 })
          console.log(err)
        },
      })
  }


  async updateCustomer(id: any, customer: any): Promise<any> {
    await this.customerService.updateCustomer(id, customer)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCustomers();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating customer', life: 3000 })
          console.log(err);
          return false;
        },
      })
  }

  async addCustomer(data: any): Promise<any> {
    await this.customerService.saveCustomer(data)
      .subscribe({
        next: (response: any) => {
          this.onGetAllCustomers();
          return true;
        },
        error(err: any) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding new customer', life: 3000 })
          console.log(err);
          return false;
        },
      })
  }
  
  onChangeCountry(){
    this.customer.city = undefined;
  }

  onSelectedCountry(event) {
    if ((this.customer.country != this.selectedCountry) && (this.customer.city == undefined)) this.customer.city=undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element; 
      }
    });
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

}

  openCustomerHistoryDialog(customer: Customer) {
    if (!this.canReadHistory) return;
    this.customerOrders=[];
    this.customer = { ...customer };
    this.displayHistoryDialog = true;
    this.getCustomerOrders(this.customer.customerId)
  }


  async getCustomerOrders(id: any){
  await this.customerService.getCustomerOrders(id)
    .subscribe({
      next: (response: any) => {
        this.customerOrders = response;
        this.customerOrders.forEach((customer: any) => (customer.creationDate = new Date(<Date>customer.creationDate)));
      },
      error: (err: any) => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while getting customer orders', life: 3000 })
        console.log(err)
      }
    });
}

exportPdf() {
  this.reportingService.exportPdf(this.exportColumns, this.customers, 'customers')
}

exportExcel() {
  // Clone the suppliers array to avoid modifying the original array
  const modifiedCustomers = this.customers.map(customer => {
    // Create a copy of the supplier object to modify
    const modifiedCustomer = { ...customer };

    // Remove the column you want to exclude
    delete modifiedCustomer.creationDate;

    // Alternatively, if the columnToRemove is a property with a known name, you can use:
    // delete modifiedSupplier['columnToRemove'];

    return modifiedCustomer;
  });

  // Now, export the modified array to Excel
  this.reportingService.exportExcel(modifiedCustomers,'customers');
}

next() {
  this.first = this.first + this.rows;
}

prev() {
  this.first = this.first - this.rows;
}

reset() {
  this.first = 0;
}

pageChange(event) {
  this.first = event.first;
  this.rows = event.rows;
}

isLastPage(): boolean {
  return this.customerOrders ? this.first === this.customerOrders.length - this.rows : true;
}

isFirstPage(): boolean {
  return this.customerOrders ? this.first === 0 : true;
}

}
