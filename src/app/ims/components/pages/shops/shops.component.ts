import { Component, OnInit } from '@angular/core';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { Country, State } from 'country-state-city';
import { ShopService } from 'src/app/services/shop.service';
import { TranslationService } from 'src/app/services/translation.service';
import { TranslateService } from '@ngx-translate/core';
import { ExportColumn, ReportingService } from 'src/app/utils/reporting.service';
import { Shop } from 'src/app/models/shop';
import { CashRegister } from 'src/app/models/cashRegister';
import { DailyBalance } from 'src/app/models/dailyBalance';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';

@Component({
  templateUrl: './shops.component.html',
  styleUrls: ['./shops.component.css', '../pages.component.css'],
  providers: [MessageService]
})
export class ShopsComponent implements OnInit {

  Ressource: string = 'SHOPS';

  shopDialog: boolean = false;

  deleteShopDialog: boolean = false;

  deleteShopsDialog: boolean = false;

  shops: Shop[] = [];

  shop: Shop = {};

  cashRegister: CashRegister = {};

  selectedShops: Shop[] = [];

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  countries: any = Country.getAllCountries();

  selectedCountry: any = null;

  states: any = null;

  today: Date;

  cashRegisterDialog: boolean = false;
  dailyBalances: DailyBalance[] = [];
  selectedDate: Date;
  filteredBalances: DailyBalance[] = [];  // Store the filtered balances
  totalDailyDifference: number = 0;
  startDate: Date | null = null; // Initialize start date
  endDate: Date | null = null;   // Initialize end date

  exportColumns!: ExportColumn[];

  canAddShop: boolean = false;
  canEditShop: boolean = false;
  canDeleteShop: boolean = false;
  canReadCash: boolean = false;

  isLoading: boolean = false;

  cashRegisterSettingsDialog: boolean = false;
  currency: any ='';


  constructor(private messageService: MessageService,
    private shopService: ShopService,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private configService: AppConfigurationService,
    public keycloakService: KeycloakService,) { }

  async ngOnInit() {
    this.today = new Date();
    this.isLoading = true;
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang); // Use the translate service to update language
    });
    await this.checkPermissions();
    this.onGetAllShops();
    this.onGetCurrecy();

    this.cols = [
      { field: 'shopId', header: this.translateService.instant('ID') },
      { field: 'shopName', header: this.translateService.instant('shop_name') },
      { field: 'description', header: this.translateService.instant('shop_description') },
      { field: 'city', header: this.translateService.instant('shop_city') },
      { field: 'country', header: this.translateService.instant('shop_country') },
      { field: 'address', header: this.translateService.instant('shop_address') },
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
    this.canAddShop = this.permissionService.canCreate(this.Ressource);
    this.canEditShop = this.permissionService.canUpdate(this.Ressource);
    this.canDeleteShop = this.permissionService.canDelete(this.Ressource);
    this.canReadCash = this.permissionService.canCashRead(this.Ressource);

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

  async openSettingsDialog() {
    this.cashRegisterSettingsDialog = true;
  }

  hideSettingsDialog() {
    this.cashRegisterSettingsDialog = false;
    this.cashRegister = {};
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
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill out the required fields', life: 3000 });
      return;
    }
  }

  updateCashRegister() {
    this.submitted = true;
  
    // Check if openingTime and closingTime exist and format them
    if (this.cashRegister.openingTime && this.cashRegister.closingTime) {
      // Function to format Date object as a LocalTime string ("HH:mm:ss")
      const formatDateToLocalTime = (date: Date): string => {
        return date.toTimeString().split(' ')[0]; // Extracts "HH:mm:ss" portion
      };
  
      // Format openingTime and closingTime to LocalTime strings
      this.cashRegister.openingTime = formatDateToLocalTime(new Date(this.cashRegister.openingTime));
      this.cashRegister.closingTime = formatDateToLocalTime(new Date(this.cashRegister.closingTime));
  
      // Call saveCashRegister with formatted cashRegister data
      const success = this.saveCashRegister(this.shop.shopId, this.cashRegister);
  
      // Show success or error message based on the result
      success 
        ? this.messageService.add({ severity: 'success', summary: 'Successful', detail: 'Cash Register Updated', life: 3000 })
        : this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error while updating cash register', life: 3000 });
  
      // Close dialog and reset cashRegister object
      this.cashRegisterSettingsDialog = false;
      this.cashRegister = {};
    } else {
      // Show error if required fields are missing
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

  async onGetAllShops() {
    await (await this.shopService.getShops())
      .subscribe({
        next: (response: any) => {
          this.shops = response;
          this.shops.forEach((shop: any) => (shop.creationDate = new Date(<Date>shop.creationDate)));
          console.log(this.shops);
        },
        error: (err: any) => {
          console.log(err)
        },
        complete: () => {
          this.isLoading = false;
        },
      })
  }

  async onGetShopCashRegister() {
    await (await this.shopService.getCashRegister(this.shop.shopId)).subscribe({
      next: (response: any) => {
        this.cashRegister = response;

        // Temporarily cast to `any` to allow assigning a Date
        if (this.cashRegister.openingTime && this.cashRegister.closingTime) {
          this.cashRegister.openingTime = this.convertTimeStringToDate(this.cashRegister.openingTime as any);
          this.cashRegister.closingTime = this.convertTimeStringToDate(this.cashRegister.closingTime as any);
        }

        console.log(this.cashRegister);
      },
      error: (err: any) => {
        console.log(err);
      }
    });
  }

  async onDeleteShop(id: any) {
    await (await this.shopService.deleteShop(id))
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
    await (await this.shopService.updateShop(id, shop))
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

  async saveCashRegister(id: any, cashRegister: any): Promise<any> {
    console.log(cashRegister)
    await this.shopService.updateCashRegister(id, cashRegister)
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetShopCashRegister();
          return true;
        },
        error(err: any) {
          console.log(err);
          return false;
        },
      })
  }

  async addShop(data: any): Promise<any> {
    await (await this.shopService.saveShop(data))
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

  onChangeCountry() {
    this.shop.city = undefined;
    console.log("clear city")
  }

  onSelectedCountry(event) {
    console.log('event :' + event);
    console.log(event.value);
    if ((this.shop.country != this.selectedCountry) && (this.shop.city == undefined)) this.shop.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    console.log(this.selectedCountry.isoCode)
    this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);

  }

  async openCashRegisterDialog(shop: any) {
    this.cashRegister = {};
    this.shop = shop;
    this.fetchCashRegisterData(shop.shopId); // Fetch the cash register data for the selected shop
    await this.onGetShopCashRegister();
    this.cashRegisterDialog = true;
  }

  async fetchCashRegisterData(shopId: number): Promise<void> {
    (await this.shopService.fetchCashRegisterData(shopId)).subscribe(
      (data: DailyBalance[]) => {
        this.dailyBalances = data;  // Store the fetched data
        this.filteredBalances = [...data];  // Initially, filtered balances are the same as all balances
        this.calculateTotalDailyDifference(this.filteredBalances);  // Calculate the total daily difference
      },
      error => {
        console.error('Error fetching cash register data:', error);
      }
    );
  }

  // Modify filter method to handle date range
  filterByDateRange() {
    // If both dates are selected, filter balances based on the date range
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999); // Include the end date till the end of the day

      this.filteredBalances = this.dailyBalances.filter((balance) => {
        const balanceDate = new Date(balance.balanceDate);
        return balanceDate >= start && balanceDate <= end;
      });
    } else {
      // If no dates are selected, show all balances
      this.filteredBalances = [...this.dailyBalances];
    }

    // Recalculate the total daily difference after filtering
    this.calculateTotalDailyDifference(this.filteredBalances);
  }

  calculateTotalDailyDifference(balances: DailyBalance[]) {
    this.totalDailyDifference = balances.reduce((total, balance) => {
      return total + balance.dailyDifference;
    }, 0);
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
    this.reportingService.exportExcel(modifiedShops, 'shops');
  }

  private convertTimeStringToDate(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0);
    return date;
  }

  async onGetCurrecy() {
    await (await this.configService.getConfigurationValue('currency'))
      .subscribe({
        next: (response: any) => {
          this.currency = response;
          console.log(this.currency)
        },
        error: (err: any) => {
          console.log(err)
        }
      })
  }

}
