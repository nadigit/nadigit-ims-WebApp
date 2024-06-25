import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Country, State } from 'country-state-city';
import { ShopService } from 'src/app/services/shop.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Shop } from 'src/app/models/shop';

@Component({
  templateUrl: './shops.component.html',
  providers: [MessageService]
})
export class ShopsComponent implements OnInit {

  shopDialog: boolean = false;

  deleteShopDialog: boolean = false;

  deleteShopsDialog: boolean = false;

  shops: Shop[] = [];

  shop: Shop = {};

  selectedShops: Shop[] = [];

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
     private shopService: ShopService,
     private reportingService: ReportingService,
     private translate: TranslateService,
     private translateService: TranslationService) { }

  ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    
    this.onGetAllShops();

    this.cols = [
      { field: 'shopId', header: 'ID' },
      { field: 'shopName', header: 'Name' },
      { field: 'description', header: 'Description' },
      { field: 'city', header: 'City' },
      { field: 'country', header: 'Country' },
      { field: 'address', header: 'Address' },
      { field: 'numberOfEmployees', header: 'Employees Number' }
    ];

    this.statuses = [
      { label: 'INSTOCK', value: 'instock' },
      { label: 'LOWSTOCK', value: 'lowstock' },
      { label: 'OUTOFSTOCK', value: 'outofstock' }
    ];

    this.exportColumns = this.cols.map((col) => ({ title: col.header, dataKey: col.field }));

  }


  deleteSelectedShops() {
    this.deleteShopsDialog = true;
  }

  editShop(shop: Shop) {
    this.selectedCountry = {};
    this.shop = { ...shop };
    this.shopDialog = true;
    console.log(this.shop.country)
    this.onSelectedCountry(this.shop.country)
  }

  deleteShop(shop: Shop) {
    this.deleteShopDialog = true;
    this.shop = { ...shop };
  }

  async confirmDeleteSelected() {
    this.deleteShopsDialog = false;
    await this.selectedShops.forEach(selectedShop => this.onDeleteShop(selectedShop.shopId));
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Shops Deleted', life: 3000 });
    this.selectedShops = [];
  }

  async confirmDelete() {
    this.deleteShopDialog = false;
    await this.onDeleteShop(this.shop.shopId);
    //this.users = this.users.filter(val => val.id !== this.user.id);
    this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Shop Deleted', life: 3000 });
    this.shop = {};
  }

  hideDialog() {
    this.shopDialog = false;
    this.submitted = false;
    this.selectedCountry = {};
  }

  openNew() {
    this.selectedCountry = {};
    this.shop = {};
    this.submitted = false;
    this.shopDialog = true;
  }

  saveShop() {
    this.submitted = true;
    if (this.shop.shopName) {
      if (this.shop.shopId) {
        this.updateShop(this.shop.shopId, this.shop) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Shop Updated', life: 3000 }) : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating shop', life: 3000 })
      } else {
        this.addShop(this.shop) ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Shop Updated', life: 3000 }) : (this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while adding shop', life: 3000 }))
      }
      this.shops = [...this.shops];
      this.shopDialog = false;
      this.shop = {};
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

  async onGetAllShops() {
    await this.shopService.getShops()
      .subscribe({
        next: (response: any) => {
          this.shops = response;
          this.shops.forEach((shop: any) => (shop.creationDate = new Date(<Date>shop.creationDate)));
          console.log(this.shops);
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

  async onDeleteShop(id: any) {
    await this.shopService.deleteShop(id)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
        },
        error(err: any) {
          console.log(err)
        },
      })
  }


  async updateShop(id: any, shop: any): Promise<any> {
    console.log(shop)
    await this.shopService.updateShop(id, shop)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addShop(data: any): Promise<any> {
    await this.shopService.saveShop(data)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  onChangeCountry(){
    this.shop.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    console.log('event :' + event);
    console.log(event.value);
    if ((this.shop.country != this.selectedCountry) && (this.shop.city == undefined)) this.shop.city=undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element; 
      }
    });
    console.log(this.selectedCountry.isoCode)
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

}

exportPdf() {
  this.reportingService.exportPdf(this.exportColumns, this.shops, 'shops')
}

exportExcel() {
  // Clone the suppliers array to avoid modifying the original array
  const modifiedShops = this.shops.map(shop => {
    // Create a copy of the supplier object to modify
    const modifiedShop = { ...shop };

    // Remove the column you want to exclude
    delete modifiedShop.creationDate;

    // Alternatively, if the columnToRemove is a property with a known name, you can use:
    // delete modifiedSupplier['columnToRemove'];

    return modifiedShop;
  });

  // Now, export the modified array to Excel
  this.reportingService.exportExcel(modifiedShops,'shops');
}

}
