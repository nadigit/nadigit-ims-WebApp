import { Component, EventEmitter, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Customer } from 'src/app/models/customer';
import { Country, State } from 'country-state-city';
import { CustomerService } from 'src/app/services/customer.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';

@Component({
  templateUrl: './customers.component.html',
  providers: [MessageService]
})
export class CustomersComponent implements OnInit {

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

  valSwitch: boolean = false;

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  exportColumns!: ExportColumn[];

  constructor(private messageService: MessageService, 
    private customerService: CustomerService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService) { }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    console.log(this.countries)
    this.onGetAllCustomers();

    this.cols = [
      { field: 'customerId', header: 'ID' },
      { field: 'firstName', header: 'First Name' },
      { field: 'lastName', header: 'Last Name' },
      { field: 'email', header: 'Email' },
      { field: 'country', header: 'Country' },
      { field: 'city', header: 'City' },
      { field: 'address', header: 'Address' },
      { field: 'zip', header: 'Zip' },
      { field: 'phoneNumber', header: 'Phone Number' },
      { field: 'customerType', header: 'Customer Type' },
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];
    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));
  }


  deleteSelectedCustomers() {
    this.deleteCustomersDialog = true;
  }

  editCustomer(customer: Customer) {
    this.selectedCountry = {};
    this.customer = { ...customer };
    this.customerDialog = true;
    console.log(this.customer.country)
    this.onSelectedCountry(this.customer.country)
  }

  deleteCustomer(customer: Customer) {
    this.deleteCustomerDialog = true;
    this.customer = { ...customer };
  }

  async confirmDeleteSelected() {
    this.deleteCustomersDialog = false;
    await this.selectedCustomers.forEach(selectedCustomer => this.onDeleteCustomer(selectedCustomer.customerId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Users Deleted', life: 3000 });
    this.selectedCustomers = [];
  }

  async confirmDelete() {
    this.deleteCustomerDialog = false;
    await this.onDeleteCustomer(this.customer.customerId);
    //this.users = this.users.filter(val => val.id !== this.user.id);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'User Deleted', life: 3000 });
    this.customer = {};
  }

  hideDialog() {
    this.customerDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  openNew() {
    this.selectedCountry = {};
    this.customer = {};
    this.submitted = false;
    this.customerDialog = true;
  }

  saveCustomer() {
    this.submitted = true;
    if (this.customer.firstName && this.customer.lastName) {
      if (this.customer.customerId) {
        this.updateCustomer(this.customer.customerId, this.customer) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating customer', life: 3000 })
      } else {
        this.addCustomer(this.customer) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Customer Added', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding customer', life: 3000 }))
      }
      this.customers = [...this.customers];
      this.customerDialog = false;
      this.customer = {};
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

  async onGetAllCustomers() {
    await this.customerService.getCustomers()
      .subscribe({
        next: (response: any) => {
          this.customers = response;
          this.customers.forEach((customer: any) => (customer.creationDate = new Date(<Date>customer.creationDate)));
          console.log(this.customers);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onDeleteCustomer(id: any) {
    await this.customerService.deleteCustomer(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCustomers();
        },
        error(err: any) {
          console.log(err)
        },
      })
  }


  async updateCustomer(id: any, customer: any): Promise<any> {
    console.log(customer)
    await this.customerService.updateCustomer(id, customer)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCustomers();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addCustomer(data: any): Promise<any> {
    await this.customerService.saveCustomer(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllCustomers();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  // async onSelectedCountry(selectedCountry: any) {
  //   console.log(this.customer.country)
  //     this.countries.forEach(element => {
  //       if ((this.customer.country != this.selectedCountry) && (this.customer.country != undefined)) this.customer.city=undefined;
  //       if (element.name === selectedCountry) {
  //         this.selectedCountry = element; 
  //       }
  //     });
  //   this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);
  //   console.log(this.states);
  // }
  
  onChangeCountry(){
    this.customer.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    console.log('event :' + event);
    console.log(event.value);
    if ((this.customer.country != this.selectedCountry) && (this.customer.city == undefined)) this.customer.city=undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element; 
      }
    });
    console.log(this.selectedCountry.isoCode)
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

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

}
