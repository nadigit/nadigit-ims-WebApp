import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { MessageService } from 'primeng/api';
import { CashRegisterSession } from 'src/app/models/cashRegisterSession';
import { Shop } from 'src/app/models/shop';
import { CashRegisterService } from 'src/app/services/cash-register.service';
import { ShopService } from 'src/app/services/shop.service';

@Component({
  selector: 'app-cash-register-session',
  templateUrl: './cash-register-session.component.html',
  styleUrl: './cash-register-session.component.css'
})
export class CashRegisterSessionComponent implements OnInit {
  @Input() visible: boolean = false;
  @Output() visibleChange = new EventEmitter<boolean>(); // for two-way binding [(visible)]
  @Output() dialogClosed = new EventEmitter<void>();     // new event to notify parent

  @Output() sessionOpened = new EventEmitter<CashRegisterSession>();
  @Output() sessionClosed = new EventEmitter<CashRegisterSession>();

  currentSession: CashRegisterSession | null = null;
  openingAmount: number | null = null;
  closingAmount: number | null = null;
  declaredDifference: number | null = null;
  notes: string = '';

  isLoading = false;
  hasActiveSession = false;
  profile: any;
  shopId: any;
  shops: Shop[] = [];
  userRoles: any;
  isAdmin: boolean = false;


  constructor(
    private cashRegisterService: CashRegisterService,
    private messageService: MessageService,
    public keycloakService: KeycloakService,
    private shopService: ShopService,
    private translate: TranslateService,
  ) { }

  async ngOnInit(): Promise<void> {
    this.isLoading = true;

    try {
      const profile = await this.keycloakService.loadUserProfile();
      this.profile = profile;

      await this.setUserRoles();

      if (this.isAdmin) {
        this.loadAllShops();
      } else {
        this.shopId = profile?.attributes?.['shop']?.[0];
        if (this.shopId) {
          this.loadCurrentSession();
        }
      }
    } catch (error) {
      console.error('❌ Initialization failed:', error);
    } finally {
      this.isLoading = false;
    }
  }

  get selectedShopName(): string {
    if (!this.shopId || !this.shops?.length) return '';
    const selected = this.shops.find(s => s.shopId === this.shopId);
    return selected ? selected.shopName : '';
  }

  async setUserRoles() {
    this.userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = this.userRoles.includes('ADMIN');
  }

  loadAllShops(): void {
    this.shopService.getShops().subscribe({
      next: (shops: Shop[]) => {
        this.shops = shops;
      },
      error: (err) => console.error('❌ Failed to load shops:', err),
    });
  }


  async loadCurrentSession(): Promise<void> {
    if (!this.shopId) return;
    this.isLoading = true;

    try {
      const session$ = await this.cashRegisterService.getCurrentSessionByShop(this.shopId);
      session$.subscribe({
        next: (session) => {
          this.currentSession = session || undefined;
          this.hasActiveSession = !!(session && !session.closed);
          this.isLoading = false;
        },
        error: (err) => {
          console.error('❌ Failed to load session:', err);
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('❌ Unexpected error while loading session:', error);
      this.isLoading = false;
    }
  }

  onShopChange(): void {
    this.currentSession = undefined;
    this.hasActiveSession = false;
    this.openingAmount = null;
    this.closingAmount = null;
    this.notes = '';
    if (this.shopId) this.loadCurrentSession();
  }

  async openSession(): Promise<void> {
    if (!this.shopId) {
      this.messageService.add({ severity: 'warn', summary: this.translate.instant('missing_shop'), detail: this.translate.instant('please_select_a_shop') });
      return;
    }
    if (this.openingAmount == null || this.openingAmount < 0) {
      this.messageService.add({ severity: 'warn', summary: this.translate.instant('invalid_amount'), detail: this.translate.instant('please_enter_a_valid_opening_amount') });
      return;
    }

    this.isLoading = true;
    try {
      const session$ = await this.cashRegisterService.openSession(this.shopId, this.openingAmount, this.notes);
      session$.subscribe({
        next: (session) => {
          this.currentSession = session;
          this.hasActiveSession = true;
          this.isLoading = false;
          this.sessionOpened.emit(session);
            this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('cash_register_opened'),
            detail: this.translate.instant('cash_register_opened_detail', {
              shop: this.selectedShopName,
              time: new Date(session.openedAt!).toLocaleTimeString()
            })
            });
          this.onDialogClose();
        },
        error: (err) => {
          console.error('❌ Failed to open session:', err);
          this.isLoading = false;
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('failed_to_open_cash_register') });
        }
      });
    } catch (error) {
      console.error('❌ Unexpected error while opening session:', error);
      this.isLoading = false;
    }
  }


  async closeSession(): Promise<void> {
    if (!this.currentSession?.sessionId) {
      this.messageService.add({ severity: 'warn', summary: this.translate.instant('no_active_session'), detail: this.translate.instant('no_open_session_to_close') });
      return;
    }
    if (this.closingAmount == null || this.closingAmount < 0) {
      this.messageService.add({ severity: 'warn', summary: this.translate.instant('invalid_amount'), detail: this.translate.instant('please_enter_a_valid_closing_amount') });
      return;
    }

    this.isLoading = true;
    try {
      const session$ = await this.cashRegisterService.closeSession(this.currentSession.sessionId, this.closingAmount, this.notes);
      session$.subscribe({
        next: (session) => {
          this.currentSession = undefined;
          this.hasActiveSession = false;
          this.isLoading = false;
          this.sessionClosed.emit(session);
            this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('session_closed'),
            detail: this.translate.instant('session_closed_detail', {
              shop: this.selectedShopName,
              time: new Date(session.closedAt!).toLocaleTimeString()
            })
            });
          this.onDialogClose();
        },
        error: (err) => {
          console.error('❌ Failed to close session:', err);
          this.isLoading = false;
          this.messageService.add({ severity: 'error', summary: this.translate.instant('error'), detail: this.translate.instant('failed_to_close_session') });
        }
      });
    } catch (error) {
      console.error('❌ Unexpected error while closing session:', error);
      this.isLoading = false;
    }
  }


  onDialogClose(): void {
    // Reset transient values
    this.openingAmount = null;
    this.closingAmount = null;
    // this.declaredDifference = null;
    this.notes = '';
    this.isLoading = false;

    // Emit both the internal and external close notifications
    this.visible = false;
    this.visibleChange.emit(false);
    this.dialogClosed.emit();
  }

}