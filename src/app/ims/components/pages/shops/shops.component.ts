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
import * as XLSX from 'xlsx';
import { DatePipe } from '@angular/common';
import { Purchase } from 'src/app/models/purchase';
import { Expense } from 'src/app/models/expense';
import { LocationService } from 'src/app/services/location.service';

@Component({
  templateUrl: './shops.component.html',
  styleUrls: ['./shops.component.css', '../pages.component.css'],
  providers: [MessageService, DatePipe]
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

  selectedShop: Shop = {};

  submitted: boolean = false;

  cols: any[] = [];

  statuses: any[] = [];

  rowsPerPageOptions = [20, 50, 100];

  valSwitch: boolean = false;

  countries: any;

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
  canReadShop: boolean = false;
  canDeleteShop: boolean = false;
  canReadCash: boolean = false;

  isLoading: boolean = false;

  cashRegisterSettingsDialog: boolean = false;
  currency: any = '';

  shopDetailsDialog: boolean = false;
  loading: boolean = false;
  loadingPurchases: boolean = false;
  loadingExpenses: boolean = false;
  cashRegisterData: any;
  organizationData: any;
  purchaseStats: any;
  expenseStats: any;
  recentPurchases: Purchase[] = [];
  recentExpenses: Expense[] = [];

  dailyDifferenceTrend: number = 0;
  dailyDifferencePercentage: number = 0;


  constructor(private messageService: MessageService,
    private shopService: ShopService,
    private datePipe: DatePipe,
    private reportingService: ReportingService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private locationService: LocationService,
    private permissionService: PermissionService,
    private configService: AppConfigurationService,
    public keycloakService: KeycloakService,) { }

  async ngOnInit() {
    const defaultStartDate = new Date();
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    this.startDate = defaultStartDate;
    this.endDate = new Date();
    this.today = new Date();
    this.isLoading = true;
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
        console.log('Currency:', currency);
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.countries = this.locationService.getAllCountriesWithTranslation();

    });
    await this.checkPermissions();
    this.onGetAllShops();
    // this.onGetCurrecy();

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

  getPurchaseStatusSeverity(status: string): string {
    switch (status?.toLowerCase()) {
        case 'completed':
            return 'success';
        case 'pending':
            return 'warning';
        case 'cancelled':
            return 'danger';
        default:
            return 'info';
    }
}

getPaymentMethodSeverity(method: string): string {
    switch (method?.toLowerCase()) {
        case 'cash':
            return 'success';
        case 'credit':
            return 'warning';
        case 'check':
            return 'help';
        case 'transfer':
            return 'info';
        default:
            return 'danger';
    }
}

  async loadShopDetails(): Promise<void> {
    this.loading = true;
    console.log('Loading shop details for:', this.shop);
    try {
      await Promise.all([
        this.loadCashRegisterData(),
        this.loadOrganizationData(),
        this.loadPurchaseStats(),
        this.loadExpenseStats(),
        this.loadRecentPurchases(),
        this.loadRecentExpenses()
      ]);
    } catch (error) {
      console.error('Error loading shop details:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_shop_details'),
        life: 3000
      });
    } finally {
      this.loading = false;
    }
  }

  async loadCashRegisterData(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.cashRegisterData = await this.shopService.getCashRegister(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading cash register:', error);
      this.cashRegisterData = null;
    }
  }

  async loadOrganizationData(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.organizationData = await this.shopService.fetchOrganizationData(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading organization:', error);
      this.organizationData = null;
    }
  }

  async loadPurchaseStats(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.purchaseStats = await this.shopService.fetchPurchaseStats(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading purchase stats:', error);
      this.purchaseStats = { count: 0, total: 0 };
    }
  }

  async loadExpenseStats(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    try {
      this.expenseStats = await this.shopService.fetchExpenseStats(this.selectedShop.shopId).toPromise();
    } catch (error) {
      console.error('Error loading expense stats:', error);
      this.expenseStats = { count: 0, total: 0 };
    }
  }

  async loadRecentPurchases(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    this.loadingPurchases = true;
    try {
      this.recentPurchases = await this.shopService.fetchRecentPurchases(this.selectedShop.shopId).toPromise() as Purchase[];
    } catch (error) {
      console.error('Error loading recent purchases:', error);
      this.recentPurchases = [];
    } finally {
      this.loadingPurchases = false;
    }
  }

  async loadRecentExpenses(): Promise<void> {
    if (!this.selectedShop.shopId) return;
    this.loadingExpenses = true;
    try {
      this.recentExpenses = await this.shopService.fetchRecentExpenses(this.selectedShop.shopId).toPromise() as Expense[];
    } catch (error) {
      console.error('Error loading recent expenses:', error);
      this.recentExpenses = [];
    } finally {
      this.loadingExpenses = false;
    }
  }

  refreshData(): void {
    Promise.all([
      this.fetchCashRegisterData(this.shop.shopId),
      this.onGetShopCashRegister()
    ]);
  }

  exportToExcel(): void {
    const dataToExport = this.filteredBalances.map(balance => ({
      'Date': this.datePipe.transform(balance.balanceDate, 'mediumDate'),
      'Opening Balance': balance.openingBalance,
      'Closing Balance': balance.closingBalance,
      'Daily Difference': balance.dailyDifference
    }));

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook: XLSX.WorkBook = { Sheets: { 'data': worksheet }, SheetNames: ['data'] };
    XLSX.writeFile(workbook, `CashRegister_${this.shop.shopName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  printReport(): void {
    window.print();
  }


  isToday(date: Date): boolean {
    if (!date) return false;
    const balanceDate = new Date(date);
    const today = new Date();
    return (
      balanceDate.getDate() === today.getDate() &&
      balanceDate.getMonth() === today.getMonth() &&
      balanceDate.getFullYear() === today.getFullYear()
    );
  }


  calculateTotalsAndTrends(): void {
    // Calculate trend (compare with previous period)
    if (this.filteredBalances.length > 1) {
      const currentPeriodSum = this.filteredBalances.slice(-7).reduce(
        (sum, balance) => sum + (balance.dailyDifference || 0), 0
      );
      const previousPeriodSum = this.filteredBalances.slice(-14, -7).reduce(
        (sum, balance) => sum + (balance.dailyDifference || 0), 0
      );

      this.dailyDifferenceTrend = currentPeriodSum - previousPeriodSum;
      this.dailyDifferencePercentage = previousPeriodSum !== 0 ?
        (this.dailyDifferenceTrend / Math.abs(previousPeriodSum)) * 100 : 0;
    } else {
      this.dailyDifferenceTrend = 0;
      this.dailyDifferencePercentage = 0;
    }
  }

  clearDateFilter(): void {
    this.startDate = null;
    this.endDate = null;
    this.filterByDateRange();
  }

  async checkPermissions() {
    const profile = await this.keycloakService.loadUserProfile();
    const userId = profile.id; // Fetch user ID

    await this.permissionService.init(userId).toPromise(); // Initialize permissions
    this.canAddShop = this.permissionService.canCreate(this.Ressource);
    this.canEditShop = this.permissionService.canUpdate(this.Ressource);
    this.canReadShop = this.permissionService.canRead(this.Ressource);
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
    if (this.shop.country) {
      this.onSelectedCountry(this.shop.country)
    }
  }

  async showShopDetailsDialog(shop: Shop): Promise<void> {
    console.log('Selected shop:', shop);

    this.selectedShop = {
      ...shop,
      creationDate: shop.creationDate ? new Date(shop.creationDate) : null
    };

    this.shopDetailsDialog = true;

    await this.loadShopDetails();
    console.log('Shop details loaded:', this.selectedShop);
  }

  hideShopDetailsDialog(): void {
    this.shopDetailsDialog = false;
    this.cashRegisterData = null;
    this.organizationData = null;
    this.purchaseStats = null;
    this.expenseStats = null;
    this.recentPurchases = [];
    this.recentExpenses = [];
  }

  deleteShop(shop: Shop) {
    this.deleteShopDialog = true;
    this.shop = { ...shop };
  }

  async confirmDeleteSelected() {
    this.deleteShopsDialog = false;
    await Promise.all(this.selectedShops.map(selectedShop => this.onDeleteShop(selectedShop.shopId)));
    this.selectedShops = [];
  }

  async confirmDelete() {
    this.deleteShopDialog = false;
    await this.onDeleteShop(this.shop.shopId);
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
    console.log(this.shop);
    if (this.shop.shopName) {
      if (this.shop.shopId) {
        this.updateShop(this.shop.shopId, this.shop)
          ? this.messageService.add({ 
              severity: 'success', 
              summary: this.translate.instant('successful'), 
              detail: this.translate.instant('shop_updated'), 
              life: 3000 
            })
          : this.messageService.add({ 
              severity: 'error', 
              summary: this.translate.instant('error'), 
              detail: this.translate.instant('error_updating_shop'), 
              life: 3000 
            });
      } else {
        this.addShop(this.shop)
          ? this.messageService.add({ 
              severity: 'success', 
              summary: this.translate.instant('successful'), 
              detail: this.translate.instant('shop_added'), 
              life: 3000 
            })
          : this.messageService.add({ 
              severity: 'error', 
              summary: this.translate.instant('error'), 
              detail: this.translate.instant('error_adding_shop'), 
              life: 3000 
            });
      }
      this.shops = [...this.shops];
      this.shopDialog = false;
      this.shop = {};
    } else {
      this.messageService.add({ 
        severity: 'error', 
        summary: this.translate.instant('error'), 
        detail: this.translate.instant('please_fill_required_fields'), 
        life: 3000 
      });
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
      ? this.messageService.add({ 
        severity: 'success', 
        summary: this.translate.instant('successful'), 
        detail: this.translate.instant('cash_register_updated'), 
        life: 3000 
        })
      : this.messageService.add({ 
        severity: 'error', 
        summary: this.translate.instant('error'), 
        detail: this.translate.instant('error_updating_cash_register'), 
        life: 3000 
        });

      // Close dialog and reset cashRegister object
      this.cashRegisterSettingsDialog = false;
      this.cashRegister = {};
    } else {
      // Show error if required fields are missing
      this.messageService.add({ 
      severity: 'error', 
      summary: this.translate.instant('error'), 
      detail: this.translate.instant('please_fill_required_fields'), 
      life: 3000 
      });
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

  private convertTimeStringToDate(timeString: string): Date {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  async onGetShopCashRegister() {
    try {
      const response = await (this.shopService.getCashRegister(this.shop.shopId)).toPromise();
      this.cashRegister = response;

      // Convert time strings to Date objects
      if (this.cashRegister.openingTime && this.cashRegister.closingTime) {
        if (typeof this.cashRegister.openingTime === 'string') {
          this.cashRegister.openingTime = this.convertTimeStringToDate(this.cashRegister.openingTime);
        }
        if (typeof this.cashRegister.closingTime === 'string') {
          this.cashRegister.closingTime = this.convertTimeStringToDate(this.cashRegister.closingTime);
        }
      }

      this.filterByDateRange();
      this.calculateTotalsAndTrends();

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('cash_register_data_refreshed')
      });
    } catch (err) {
      console.error(err);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_cash_register_data')
      });
    }
  }

  async onDeleteShop(id: any) {
    await (await this.shopService.deleteShop(id))
      .subscribe({
        next: (response: any) => {
          console.log(response);
          this.onGetAllShops();
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('successful'),
            detail: this.translate.instant('shop_deleted'),
            life: 3000
          });
        },
        error: (err: any) => {
          console.log(err);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_deleting_shop'),
            life: 3000
          });
        },
      });
  }

  async updateShop(id: any, shop: any): Promise<any> {
    this.shopService.updateShop(id, shop)
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
    if ((this.shop.country != this.selectedCountry) && (this.shop.city == undefined)) this.shop.city = undefined;
    this.countries.forEach(element => {
      if (element.name === event) {
        this.selectedCountry = element;
      }
    });
    this.states = this.locationService.getStatesByCountryCode(this.selectedCountry.isoCode);
  }

  filterCountry(value: any, filter: string): boolean {
    // Convert both to lowercase for case-insensitive comparison
    const normalizedFilter = filter.toLowerCase();

    // Check both original name and translated name
    return (
      value.name.toLowerCase().includes(normalizedFilter) ||
      value.translatedName.toLowerCase().includes(normalizedFilter)
    );
  }
  
  async openCashRegisterDialog(shop: any) {
    this.cashRegister = {};
    this.shop = shop;

    // Reset filters
    this.startDate = null;
    this.endDate = null;

    // Parallel loading of both data sources
    await Promise.all([
      this.fetchCashRegisterData(shop.shopId),
      this.onGetShopCashRegister()
    ]);

    this.cashRegisterDialog = true;
  }


  async fetchCashRegisterData(shopId: number): Promise<void> {
    try {
      const data = await (await this.shopService.fetchCashRegisterData(shopId)).toPromise();
      console.log('Fetched cash register data:', data);
      const balances: DailyBalance[] = Array.isArray(data) ? data : [];
      this.dailyBalances = balances.map(balance => ({
        ...balance,
        balanceDate: new Date(balance.balanceDate).toISOString() // Convert to string as required by DailyBalance
      }));
      this.filteredBalances = [...this.dailyBalances];
      this.calculateTotalDailyDifference(this.filteredBalances);
    } catch (error) {
      console.error('Error fetching cash register data:', error);
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to fetch daily balances'
      });
    }
  }

  formatDateForFilter(date: any): Date {
    if (!date) return null;
    if (date instanceof Date) return date;
    return new Date(date);
  }

  filterByDateRange() {
    // Validate dates
    if (this.startDate && this.endDate && this.startDate > this.endDate) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('invalid_date_range'),
        detail: this.translate.instant('start_date_cannot_be_after_end_date')
      });
      return;
    }

    // If both dates are selected, filter balances
    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);
      end.setHours(23, 59, 59, 999); // Include entire end day

      this.filteredBalances = this.dailyBalances.filter((balance) => {
        const balanceDate = new Date(balance.balanceDate);
        return balanceDate >= start && balanceDate <= end;
      });
    } else {
      // Show all balances if no filter
      this.filteredBalances = [...this.dailyBalances];
    }

    // Calculate totals
    this.calculateTotalDailyDifference(this.filteredBalances);
    this.calculateTotalsAndTrends();
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

}
