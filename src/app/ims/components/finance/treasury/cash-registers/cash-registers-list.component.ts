import { Component, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { ShopService } from 'src/app/services/shop.service';
import { CashRegisterService } from 'src/app/services/cash-register.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { Shop } from 'src/app/models/shop';
import { CashRegister } from 'src/app/models/cashRegister';
import { CashRegisterSession } from 'src/app/models/cashRegisterSession';
import { firstValueFrom } from 'rxjs';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

export interface CashRegisterListRow {
  shop: Shop;
  balance: number;
  isOpen: boolean;
  currentSession: CashRegisterSession | null;
  openedAt?: string | Date;
  openedBy?: string;
}

@Component({
  templateUrl: './cash-registers-list.component.html',
  styleUrls: ['./cash-registers-list.component.css', '../../finance.component.css'],
  providers: [MessageService]
})
export class CashRegistersListComponent implements OnInit {
  TablePageSizeKeys = TablePageSizeKeys;

  @ViewChild('dt') dt!: Table;

  rows: CashRegisterListRow[] = [];
  isLoading = true;
  currency = '';
  globalFilter = '';
  statusFilter: 'all' | 'open' | 'closed' = 'all';

  rowsPerPageOptions = [20, 50, 100];
  pageSize = 20;

  canReadCash = false;

  totalCashBalance = 0;
  openRegistersCount = 0;
  closedRegistersCount = 0;

  constructor(
    private messageService: MessageService,
    private shopService: ShopService,
    private cashRegisterService: CashRegisterService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private permissionService: PermissionService,
    private keycloakService: KeycloakService,
    private configService: AppConfigurationService,
    private router: Router,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.pageSize = this.pageSizeService.initState(TablePageSizeKeys.treasuryCashRegisters, this.rowsPerPageOptions, {
      pageSize: this.pageSize,
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });
    this.translateService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });
    await this.checkPermissions();
    await this.loadRows();
  }

  onTablePage(event: { rows?: number | null }): void {
    this.pageSizeService.applyPageEvent(TablePageSizeKeys.treasuryCashRegisters, this.rowsPerPageOptions, event, this);
  }

  get filteredRows(): CashRegisterListRow[] {
    if (this.statusFilter === 'all') {
      return this.rows;
    }
    if (this.statusFilter === 'open') {
      return this.rows.filter(r => r.isOpen);
    }
    return this.rows.filter(r => !r.isOpen);
  }

  private async checkPermissions(): Promise<void> {
    const profile = await this.keycloakService.loadUserProfile();
    await this.permissionService.init(profile.id!).toPromise();
    this.canReadCash = this.permissionService.canCashRead('SHOPS');
  }

  async loadRows(): Promise<void> {
    this.isLoading = true;
    try {
      const shops = await firstValueFrom(await this.shopService.getShops());
      const shopList: Shop[] = Array.isArray(shops) ? shops : [];

      const rowResults = await Promise.all(
        shopList.map(async (shop): Promise<CashRegisterListRow> => {
          let balance = 0;
          let currentSession: CashRegisterSession | null = null;

          try {
            const register = await firstValueFrom(this.shopService.getCashRegister(shop.shopId!)) as CashRegister;
            balance = register?.totalBalance ?? 0;
          } catch {
            balance = 0;
          }

          try {
            const session$ = await this.cashRegisterService.getCurrentSessionByShop(shop.shopId!);
            currentSession = await firstValueFrom(session$);
          } catch {
            currentSession = null;
          }

          const isOpen = !!currentSession && !currentSession.closed;

          return {
            shop,
            balance,
            isOpen,
            currentSession,
            openedAt: currentSession?.openedAt,
            openedBy: currentSession?.username || currentSession?.fullName || undefined,
          };
        })
      );

      this.rows = rowResults;
      this.recalculateSummary();
    } catch (error) {
      console.error('Error loading cash registers:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_cash_register_data'),
        life: 4000,
      });
      this.rows = [];
    } finally {
      this.isLoading = false;
    }
  }

  private recalculateSummary(): void {
    this.totalCashBalance = this.rows.reduce((sum, r) => sum + (r.balance || 0), 0);
    this.openRegistersCount = this.rows.filter(r => r.isOpen).length;
    this.closedRegistersCount = this.rows.length - this.openRegistersCount;
  }

  onStatusFilterChange(): void {
    // table uses getter filteredRows
  }

  openRegister(row: CashRegisterListRow): void {
    if (!row.shop?.shopId) {
      return;
    }
    void this.router.navigate(['/finance/treasury/cash-registers', row.shop.shopId]);
  }

}
