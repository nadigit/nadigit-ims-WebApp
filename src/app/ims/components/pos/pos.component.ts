import { Component, OnDestroy, OnInit, ViewChild, ElementRef, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, debounceTime, takeUntil, interval } from 'rxjs';
import { POSCartDTO, POSCheckoutDTO, POSProductDTO, POSReceiptDTO, PaymentInfo, PaymentMethod } from 'src/app/models/pos';
import { paymentMethodOptions, PaymentMethodOption, getPaymentMethodLabel as getSharedPaymentMethodLabel, getPaymentMethodIcon as getSharedPaymentMethodIcon } from 'src/app/shared/payment-utils';
import { BRAND_ASSETS } from 'src/app/utils/brand-assets';
import { PosService } from 'src/app/services/pos.service';
import { FinancialDocumentsService } from 'src/app/services/financial-documents.service';
import { ShopService } from 'src/app/services/shop.service';
import { CustomerService } from 'src/app/services/customer.service';
import { CategoryService } from 'src/app/services/category.service';
import { OrderService } from 'src/app/services/order.service';
import { ProductService } from 'src/app/services/product.service';
import { WarehouseService } from 'src/app/services/warehouse.service';
import { BarcodeService } from 'src/app/services/barcode.service';
import { CustomerCreditService } from 'src/app/services/customer-credit.service';
import { CreditInfo } from 'src/app/models/credit-info';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { TaxRuleService } from 'src/app/services/tax-rule.service';
import { PosStorageService, PendingSale } from 'src/app/services/pos-storage.service';
import { PwaService } from 'src/app/services/pwa.service';
import { KeycloakService } from 'keycloak-angular';
import { SessionAuditService } from 'src/app/services/session-audit.service';
import { firstValueFrom } from 'rxjs';
import { Warehouse } from 'src/app/models/warehouse';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { ProductFamilyService } from 'src/app/services/product-family.service';
import {
  ProductFamily,
  ProductFamilyInventoryOverview,
  ProductVariantLine,
} from 'src/app/models/product-family';
import { Product } from 'src/app/models/product';
import { getProductVariantSummary } from 'src/app/shared/variant-summary.utils';
import {
  cartItemAsProduct,
  computeCartItemSubtotal,
  formatLineQuantity,
  getCartItemDisplayQuantity,
  getCartItemDisplayStock,
  getLineMeasureUnit,
  lineQuantityDecimals,
  lineQuantityMin,
  lineQuantityStep,
  shouldShowLineMeasureUnit,
} from 'src/app/shared/product-utils';
import { QuantityScale } from 'src/app/utils/quantity-scale.util';
import { POSCartItemDTO } from 'src/app/models/pos';
import { LineOptionSet, LineOption } from 'src/app/models/line-option-set';
import { LineOptionSetService } from 'src/app/services/line-option-set.service';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { BankAccount } from 'src/app/models/bank-account';
import { PaymentValidationService } from 'src/app/services/payment-validation.service';
import { CashRegisterService } from 'src/app/services/cash-register.service';
import { MenuItem } from 'primeng/api';
import { resolvePublicAssetUrl } from 'src/app/shared/product-image.utils';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css'],
  providers: [MessageService]
})
export class PosComponent implements OnInit, OnDestroy {

  /** Display-ready URL for a category's stored (relative) image. */
  categoryImageUrl(category: any): string {
    return resolvePublicAssetUrl(category?.categoryImage);
  }

  /** Slim/expanded state of the POS top bar, remembered per device. */
  private readonly POS_HEADER_COLLAPSED_KEY = 'pos_header_collapsed';
  headerCollapsed = localStorage.getItem('pos_header_collapsed') === 'true';

  toggleHeaderCollapsed(): void {
    this.headerCollapsed = !this.headerCollapsed;
    localStorage.setItem(this.POS_HEADER_COLLAPSED_KEY, String(this.headerCollapsed));
  }

  shopId!: number;
  shops: any[] = [];
  warehouses: Warehouse[] = [];
  selectedWarehouseId: number | null = null;
  private previousSelectedWarehouseId: number | null = null;
  warehouseSwitchDialogVisible: boolean = false;
  pendingWarehouseId: number | null = null;
  customers: any[] = [];
  isAdmin: boolean = false;
  isVendor: boolean = false;

  currency: string = 'USD';

  loading: boolean = true;
  /** Primary logo on dark backgrounds — used by the branded POS loading screen. */
  loadingLogo: string = BRAND_ASSETS.logoDark;
  productsLoading: boolean = false;
  cartSaving: boolean = false;
  taxEnabled: boolean = false;
  taxRate: number = 0.0; // Tax rate as decimal (e.g., 0.2 for 20%)
  /** True when tax.calculation.mode = RULES (per-line tax rule engine active). */
  taxRulesMode: boolean = false;
  /** True when pricing.tax.inclusive = true (prices are TTC; tax extracted, not added). */
  taxInclusive: boolean = false;
  private taxResolveSignature = '';
  private taxResolveSeq = 0;

  // Session & cart
  session: any = null;
  cart: POSCartDTO | null = null;
  holdCarts: POSCartDTO[] = [];
  
  // Session Management
  openSessionDialog: boolean = false;
  closeSessionDialog: boolean = false;
  sessionCashRegisterId: number | null = null;
  sessionNotes: string = '';
  /** Counted opening float, asked for only when the drawer must be opened by hand. */
  sessionOpeningAmount: number | null = null;
  /** Mirrors cash.register.auto.open.session: when false the cashier supplies the float. */
  cashRegisterAutoOpenEnabled: boolean = true;
  closingSessionNotes: string = '';
  reportDownloading: boolean = false;
  xReportFormatMenu: MenuItem[] = [];
  zReportFormatMenu: MenuItem[] = [];

  // Search / scan
  barcodeInput: string = '';
  /**
   * Barcode auto-submit (for keyboard-less terminals where the scanner does not
   * append an Enter/CR suffix). A hardware scanner streams characters in a tight
   * burst; when the burst goes quiet we submit automatically. Manual (human-speed)
   * typing is intentionally NOT auto-submitted — it still uses Enter or the button.
   */
  private barcodeDebounceTimer: any = null;
  private barcodeLastKeyTime = 0;
  private barcodeFastKeystrokes = false;
  /** Max gap (ms) between keystrokes that still counts as scanner-speed input. */
  private readonly BARCODE_SCANNER_MAX_GAP_MS = 40;
  /** Quiet period (ms) after the last keystroke before auto-submitting a scan. */
  private readonly BARCODE_DEBOUNCE_MS = 120;
  /** Fashion / variant POS: browse styles then pick SKU variant. */
  posSellMode: 'styles' | 'sku' = 'styles';
  posStyleFamilies: ProductFamilyInventoryOverview[] = [];
  posStyleFamiliesFiltered: ProductFamilyInventoryOverview[] = [];
  posStyleSearch = '';
  posStyleCatalogLoading = false;
  selectedPosFamily: ProductFamily | null = null;
  posVariantLines: ProductVariantLine[] = [];
  posVariantLinesLoading = false;
  searchQuery: string = '';
  searchResults: POSProductDTO[] = [];
  quickProducts: POSProductDTO[] = [];
  filteredQuickProducts: POSProductDTO[] = [];
  selectedCategoryId: number | null = null;
  selectedCategory: any = null;
  categories: any[] = [];
  filteredCategories: any[] = [];
  productViewMode: 'grid' | 'list' = 'list';
  private searchSubject = new Subject<string>();
  private isSearching: boolean = false;
  
  // Barcode Scanner
  scannerDialog: boolean = false;
  scannerEnabled: boolean = false;
  hasPermission: boolean = false;
  availableDevices: MediaDeviceInfo[] = [];
  currentDevice: MediaDeviceInfo | null = null;
  currentDeviceId: string | null = null;
  lastScanResult: string = '';

  // Checkout
  checkoutDialog: boolean = false;

  // --- Sale-line options (components/cuts) on POS cart lines ---
  /** All active option sets in the org; applicability resolved per line client-side. */
  private allOptionSetsCache: LineOptionSet[] | null = null;
  optionsDialogVisible = false;
  optionsCartItem: POSCartItemDTO | null = null;
  optionsSets: LineOptionSet[] = [];
  optionsWorkingSelections: { [setId: number]: number[] } = {};
  optionsSaving = false;
  receiptDialog: boolean = false;
  checkoutPayments: PaymentInfo[] = [];
  checkoutNotes: string = '';
  printReceipt: boolean = true;
  lastReceipt: POSReceiptDTO | null = null;
  receiptPrinting = false;

  // Hold carts dialog
  holdCartsDialog: boolean = false;
  
  // Confirmation dialog
  confirmResumeDialog: boolean = false;
  confirmResumeMessage: string = '';
  confirmResumeCallback: (() => void) | null = null;
  
  // View cart dialog
  viewCartDialog: boolean = false;
  viewedCart: POSCartDTO | null = null;

  // Fullscreen & Kiosk Mode
  @ViewChild('barcodeInputRef') barcodeInputRef!: ElementRef<HTMLInputElement>;
  isFullscreen: boolean = false;
  
  // Offline Detection
  isOnline: boolean = navigator.onLine;
  onlineStatus: 'online' | 'offline' | 'checking' = navigator.onLine ? 'online' : 'offline';
  pendingSalesCount: number = 0;
  
  // Lock Screen
  isLocked: boolean = false;
  lockPin: string = '';
  lockPinInput: string = '';
  lockPinError: boolean = false; // Track PIN error state for visual feedback
  autoLockTimer: any = null;
  autoLockMinutes: number = 15; // Configurable
  lastActivity: Date = new Date();
  
  // Cashier switching
  currentCashier: any = null;
  switchCashierDialog: boolean = false;
  switchCashierPin: string = '';
  
  // Manager approval
  managerApprovalDialog: boolean = false;
  managerApprovalReason: string = '';
  managerApprovalCallback: (() => void) | null = null;

  // PWA
  canInstallPwa: boolean = false;
  isPwaInstalled: boolean = false;
  updateAvailable: boolean = false;

  // Navigation guard
  private hasActiveCart: boolean = false;
  private navigationAttempted: boolean = false;

  private destroy$ = new Subject<void>();
  private heartbeatInterval: any = null;
  private sessionRefreshInterval: any = null;

  /** Debounced sync for discount / transport / additional charges (avoids race + reset to 0). */
  private static readonly SUMMARY_FIELD_DEBOUNCE_MS = 400;
  private transportDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private additionalChargesDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private discountDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private transportPersistSeq = 0;
  private additionalChargesPersistSeq = 0;
  private discountPersistSeq = 0;
  /** True while user-edited summary values may not match server yet. */
  private summaryFieldsDirty = false;


  // Cart & Customer properties
  selectedCustomer: any = { customerId: null, fullName: 'Walk-in Customer' }; // Default to walk-in
  customerSuggestions: any[] = [];
  discountAmount = 0;
  discountType: 'Amount' | 'Percentage' = 'Amount';
  discountTypes = [
    { label: 'Amount', value: 'Amount' },
    { label: 'Percentage', value: 'Percentage' }
  ];
  transportAmount = 0;
  additionalChargesAmount = 0;
  orderNotes = '';
  paymentAmount = 0;
  
  // Product View properties
  searchSuggestions: any[] = [];
  
  // Quick payment amounts
  quickAmounts: number[] = [10, 20, 50, 100, 200, 500];
  
  // Payment methods - all options for reference
  private allPaymentMethodOptions = paymentMethodOptions;
  // For dropdown, we need just the values
  paymentMethods: PaymentMethod[] = paymentMethodOptions.map(opt => opt.value as PaymentMethod);
  
  // Selected payment method from quick checkout panel radio buttons
  selectedPaymentMethod: PaymentMethod = 'Cash';
  
  // Filtered payment method options for radio buttons (updated when customer changes)
  paymentMethodOptionsList = paymentMethodOptions.filter(opt => opt.value !== 'Credit'); // Default: no Credit
  // Filtered payment methods for dropdown (updated when customer changes)
  availablePaymentMethods: PaymentMethod[] = paymentMethodOptions.map(opt => opt.value as PaymentMethod).filter(m => m !== 'Credit'); // Default: no Credit
  
  // Update available payment methods based on selected customer
  private updateAvailablePaymentMethods(): void {
    const isCreditAllowed = this.isCreditAllowedForCustomer();
    
    if (isCreditAllowed) {
      // Include all payment methods including Credit for regular customers
      this.availablePaymentMethods = [...this.paymentMethods];
      this.paymentMethodOptionsList = [...this.allPaymentMethodOptions];
    } else {
      // Exclude Credit for walk-in customers or no customer
      this.availablePaymentMethods = this.paymentMethods.filter(m => m !== 'Credit');
      this.paymentMethodOptionsList = this.allPaymentMethodOptions.filter(opt => opt.value !== 'Credit');
      // Reset selected method if it was Credit
      if (this.selectedPaymentMethod === 'Credit') {
        this.selectedPaymentMethod = 'Cash';
      }
    }
  }
  
  // Check if Credit payment is allowed for the current customer
  private isCreditAllowedForCustomer(): boolean {
    if (!this.selectedCustomer) {
      return false;
    }
    const currentCustomerId = this.selectedCustomer?.customerId;
    return !!currentCustomerId && !this.isWalkInCustomer(this.selectedCustomer);
  }
  bankAccounts: BankAccount[] = []; // Loaded for Transfer/Check/BOE via BankAccountService
  canReadBankAccounts: boolean = false;
  bankAccountNoticeKey: string | null = null;
  bankAccountNoticeSeverity: 'info' | 'warn' = 'info';
  
  // Credit information
  creditInfo: CreditInfo | null = null;
  creditInfoLoading: boolean = false;
  // Sanitized credit fields for UI/validation (mirrors Orders behavior)
  outstandingBalance: number = 0;
  overdueBalance: number = 0;
  netBalance: number = 0;
  availableCreditLimit: number = 0;
  private isProcessingPaymentChange: boolean = false; // Guard to prevent infinite loops
  
  // PWA Actions
  pwaActions = [];
  
  // Cart Actions
  cartActions = [
    {
      label: 'Hold Cart',
      icon: 'pi pi-pause',
      command: () => this.holdCurrentCart()
    },
    {
      label: 'View Holds',
      icon: 'pi pi-list',
      command: () => this.openHoldCarts()
    },
    {
      label: 'Clear Cart',
      icon: 'pi pi-trash',
      command: () => this.clearCart()
    }
  ];

  /** When false, sellable qty excludes approved write-off totals (matches backend default). */
  salesStockIncludesApprovedWriteoffQty: boolean = false;

  /** When true, server reserves cart lines and enforces allocatable qty; show POS hint and relax strict client cap. */
  salesStockSoftReservationEnabled: boolean = false;

  /** When true, the cashier may override a line's unit price (pricing.allow.custom.override). */
  priceOverrideAllowed: boolean = true;

  /** When true, POS cart lines expose a portion selector (whole/half/quarter/...) → portionFraction. */
  portionSelectionEnabled: boolean = false;
  portionOptions: { label: string; value: number }[] = [
    { label: '1', value: 1 },
    { label: '1/2', value: 0.5 },
    { label: '1/4', value: 0.25 },
    { label: '1/8', value: 0.125 },
  ];

  constructor(
    private posService: PosService,
    private shopService: ShopService,
    private customerService: CustomerService,
    private categoryService: CategoryService,
    private orderService: OrderService,
    private productService: ProductService,
    private warehouseService: WarehouseService,
    private barcodeService: BarcodeService,
    private customerCreditService: CustomerCreditService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private configService: AppConfigurationService,
    private taxRuleService: TaxRuleService,
    private lineOptionSetService: LineOptionSetService,
    private posStorage: PosStorageService,
    private pwaService: PwaService,
    private keycloakService: KeycloakService,
    private sessionAuditService: SessionAuditService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    public activityProfileService: ActivityProfileService,
    private bankAccountService: BankAccountService,
    private paymentValidationService: PaymentValidationService,
    private productFamilyService: ProductFamilyService,
    private financialDocService: FinancialDocumentsService,
    private cashRegisterService: CashRegisterService,
  ) { }

  openProfileSettings(): void {
    void this.router.navigate(['/administration/settings'], { queryParams: { businessProfile: 1 } });
  }

  async ngOnInit() {
    await this.activityProfileService.ensureLoaded();
    this.translationService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
      this.initReportFormatMenus();
    });
    this.initReportFormatMenus();
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    // Search is now handled directly in onSearchChange via autocomplete completeMethod
    // No need for separate debounce subscription

    // Setup offline detection
    this.setupOfflineDetection();

    await this.loadSalesStockConfig();
    await this.loadSalesStockSoftReservationConfig();
    await this.loadPriceOverrideConfig();
    await this.loadPortionSelectionConfig();
    await this.loadCashRegisterAutoOpenConfig();

    this.configService.configurationSaved$
      .pipe(takeUntil(this.destroy$))
      .subscribe((key) => {
        if (!key) {
          return;
        }
        if (key.startsWith('sales.stock')) {
          void (async () => {
            await this.loadSalesStockConfig();
            await this.loadSalesStockSoftReservationConfig();
            this.cdr.markForCheck();
          })();
        }
        if (key === 'pricing.allow.custom.override') {
          void this.loadPriceOverrideConfig().then(() => this.cdr.markForCheck());
        }
        if (key === 'tax') {
          void this.loadTaxRate().then(() => this.cdr.markForCheck());
        }
      });

    // Setup fullscreen
    this.setupFullscreen();
    
    // Setup auto-lock
    this.setupAutoLock();
    
    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup PWA
    this.setupPwa();
    
    // Setup navigation guard
    this.setupNavigationGuard();
    
    // Load from local storage if available
    await this.loadFromLocalStorage();

    // Load tax rate from configuration FIRST, before loading cart
    // This ensures tax calculations are consistent from the start
    await this.loadTaxRate();
    
    // Check if user is admin or vendor
    const userRoles = await this.keycloakService.getUserRoles();
    this.isAdmin = userRoles.includes('ADMIN');
    this.isVendor = userRoles.includes('VENDOR');
    this.canReadBankAccounts = this.isAdmin;
    
    await this.initShopsAndSession();

    if (this.activityProfileService.emphasizeProductVariants) {
      this.posSellMode = 'styles';
      await this.loadPosStyleCatalog();
    }
    
    // Set up periodic session state refresh (every 60 seconds)
    this.sessionRefreshInterval = setInterval(async () => {
      if ((!this.isAdmin || this.shopId) && !this.loading) {
        await this.refreshSessionState();
      }
    }, 60000);
    
    // Load categories
    await this.loadCategories();
    
    // Recalculate tax after cart is loaded if tax is enabled
    // This ensures consistency even if cart was loaded before tax rate
    if (this.cart && this.taxEnabled && this.taxRate > 0) {
      this.recalculateTax();
      this.updateCartTracking();
      this.saveToLocalStorage();
    }
    
    // Auto-focus barcode input
    setTimeout(() => this.focusBarcodeInput(), 100);
    
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.clearSummaryFieldDebounceTimers();
    this.clearBarcodeDebounce();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.sessionRefreshInterval) {
      clearInterval(this.sessionRefreshInterval);
    }
    if (this.autoLockTimer) {
      clearInterval(this.autoLockTimer);
    }
    document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.removeEventListener('mozfullscreenchange', this.onFullscreenChange);
    document.removeEventListener('MSFullscreenChange', this.onFullscreenChange);
  }

  /**
   * Get shopId for API calls
   * - For admins: Returns shopId (required)
   * - For non-admins: Returns undefined (backend will auto-retrieve from JWT)
   */
  private getShopIdForApi(): number | undefined {
    if (this.isAdmin) {
      // For admins, shopId is required
      return this.shopId;
    } else {
      // For non-admins, return undefined - backend will auto-retrieve from JWT
      return undefined;
    }
  }

  private getWarehouseIdForApi(): number | undefined {
    if (!this.isAdmin) {
      return undefined;
    }
    return this.selectedWarehouseId ?? undefined;
  }

  getSelectedWarehouseName(): string {
    if (!this.selectedWarehouseId) {
      return this.translate.instant('select_warehouse');
    }
    const selectedWarehouse = this.warehouses.find(
      w => Number(w.warehouseId) === this.selectedWarehouseId
    );
    return selectedWarehouse?.name || this.translate.instant('select_warehouse');
  }

  private matchesSelectedWarehouse(product: any): boolean {
    if (!this.isAdmin || !this.selectedWarehouseId) {
      return true;
    }
    const productWarehouseId = Number(product?.warehouse?.warehouseId);
    if (!Number.isNaN(productWarehouseId)) {
      return productWarehouseId === this.selectedWarehouseId;
    }
    // Some quick-products payloads do not include warehouse info; in that case
    // keep the product visible instead of filtering everything out.
    const hasWarehouseName = String(product?.warehouseName || '').trim().length > 0;
    if (!hasWarehouseName) {
      return true;
    }
    const selectedWarehouse = this.warehouses.find(w => Number(w.warehouseId) === this.selectedWarehouseId);
    const selectedWarehouseName = (selectedWarehouse?.name || '').toLowerCase();
    const productWarehouseName = String(product?.warehouseName || '').toLowerCase();
    return !!selectedWarehouseName && productWarehouseName === selectedWarehouseName;
  }

  /**
   * Validate shopId selection for admins
   */
  private validateShopIdForAdmin(): boolean {
    if (this.isAdmin && !this.shopId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_a_shop'),
        life: 4000
      });
      return false;
    }
    return true;
  }

  private async initShopsAndSession() {
    try {
      // For admin users, load shops and allow selection
      if (this.isAdmin) {
        (this.shopService as any).loadToken && await (this.shopService as any).loadToken();
        const shopsObs = this.shopService.getShops();
        const shopsResult = await firstValueFrom(shopsObs as any);
        this.shops = Array.isArray(shopsResult) ? shopsResult : [];
        const warehousesObs = this.warehouseService.getWarehouses();
        const warehousesResult = await firstValueFrom(warehousesObs as any);
        this.warehouses = Array.isArray(warehousesResult) ? warehousesResult : [];

        const routeShopId = this.route.snapshot.paramMap.get('shopId');
        if (routeShopId) {
          this.shopId = +routeShopId;
        } else if (this.shops.length > 0) {
          this.shopId = this.shops[0].shopId;
        }
        // Restore persisted warehouse selection; fall back to first warehouse only if no saved choice
        const savedWarehouseId = this.posStorage.getWarehouseId();
        if (savedWarehouseId && this.warehouses.some(w => Number(w.warehouseId) === savedWarehouseId)) {
          this.selectedWarehouseId = savedWarehouseId;
        } else if (this.warehouses.length > 0 && !this.selectedWarehouseId) {
          this.selectedWarehouseId = Number(this.warehouses[0].warehouseId);
          this.posStorage.saveWarehouseId(this.selectedWarehouseId);
        }
        this.previousSelectedWarehouseId = this.selectedWarehouseId;

        if (!this.shopId && this.shops.length === 0) {
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('please_select_a_shop'),
            life: 4000
          });
          return;
        }
      } else {
        (this.shopService as any).loadToken && await (this.shopService as any).loadToken();
        const shopsObs = this.shopService.getShops();
        const shopsResult = await firstValueFrom(shopsObs as any);
        this.shops = Array.isArray(shopsResult) ? shopsResult : [];
        // For non-admin users, backend will auto-retrieve shop from JWT token
        // Never trust or keep a route shopId for Cashier/Vendor users; backend enforces their assigned shop.
        this.shopId = undefined as any;
      }

      await this.loadCustomers();
      await this.ensureSessionAndCart();
      await this.loadQuickProducts();
    } catch (error) {
      console.error('Error initializing POS:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 4000
      });
    }
  }

  async onShopChange() {
    if (!this.shopId || !this.isAdmin) return; // Only allow shop change for admin users
    this.router.navigate(['/pos/shop', this.shopId]);
    this.loading = true;
    await this.ensureSessionAndCart();
    await this.loadQuickProducts();
    this.loading = false;
  }

  onWarehouseChange(event?: any) {
    const nextWarehouseId = event?.value != null ? Number(event.value) : (this.selectedWarehouseId ?? null);
    if (nextWarehouseId == null || Number.isNaN(nextWarehouseId)) {
      this.selectedWarehouseId = this.previousSelectedWarehouseId;
      return;
    }

    const hasCartItems = this.getCurrentCartItemCount() > 0;
    if (hasCartItems) {
      this.pendingWarehouseId = nextWarehouseId;
      this.warehouseSwitchDialogVisible = true;
      return;
    }

    this.applyWarehouseSelection(nextWarehouseId);
  }

  private getCurrentCartItemCount(): number {
    const cartAny: any = this.cart as any;
    const items = Array.isArray(cartAny?.items)
      ? cartAny.items
      : (Array.isArray(cartAny?.cartItems) ? cartAny.cartItems : []);
    return items.length;
  }

  async confirmWarehouseSwitch(): Promise<void> {
    const nextWarehouseId = this.pendingWarehouseId;
    this.warehouseSwitchDialogVisible = false;
    this.pendingWarehouseId = null;
    if (nextWarehouseId == null) {
      this.selectedWarehouseId = this.previousSelectedWarehouseId;
      return;
    }
    await this.clearCart();
    await this.applyWarehouseSelection(nextWarehouseId);
    const warehouseName =
      this.warehouses.find(w => Number(w.warehouseId) === Number(nextWarehouseId))?.name ||
      this.getSelectedWarehouseName();
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('cart_reset_after_warehouse_switch', { warehouse: warehouseName }),
      life: 2500
    });
  }

  cancelWarehouseSwitch(): void {
    this.warehouseSwitchDialogVisible = false;
    this.pendingWarehouseId = null;
    this.selectedWarehouseId = this.previousSelectedWarehouseId;
  }

  private async applyWarehouseSelection(nextWarehouseId: number): Promise<void> {
    this.previousSelectedWarehouseId = nextWarehouseId;
    this.selectedWarehouseId = nextWarehouseId;
    this.posStorage.saveWarehouseId(nextWarehouseId);
    this.selectedCategory = null;
    this.selectedCategoryId = null;
    this.searchQuery = '';
    this.searchResults = [];
    this.searchSuggestions = [];
    this.clearPosStyleSelection();
    if (this.activityProfileService.emphasizeProductVariants) {
      await this.loadPosStyleCatalog();
    }
    await this.loadQuickProducts();
  }

  get posSellModeOptions(): { label: string; value: 'styles' | 'sku' }[] {
    return [
      { label: this.translate.instant('pos_sell_mode_styles'), value: 'styles' },
      { label: this.translate.instant('pos_sell_mode_sku'), value: 'sku' },
    ];
  }

  async loadPosStyleCatalog(): Promise<void> {
    if (!this.activityProfileService.emphasizeProductVariants || this.selectedWarehouseId == null) {
      this.posStyleFamilies = [];
      this.posStyleFamiliesFiltered = [];
      return;
    }
    this.posStyleCatalogLoading = true;
    try {
      const page = await firstValueFrom(
        this.productFamilyService.getInventoryOverviewPage(
          0, 200, this.posStyleSearch.trim() || undefined, this.selectedWarehouseId, true,
        ),
      );
      this.posStyleFamilies = page.families ?? [];
      this.applyPosStyleSearchFilter();
    } catch {
      this.posStyleFamilies = [];
      this.posStyleFamiliesFiltered = [];
    } finally {
      this.posStyleCatalogLoading = false;
      this.cdr.markForCheck();
    }
  }

  onPosStyleSearch(): void {
    this.applyPosStyleSearchFilter();
  }

  private applyPosStyleSearchFilter(): void {
    const q = this.posStyleSearch.trim().toLowerCase();
    if (!q) {
      this.posStyleFamiliesFiltered = [...this.posStyleFamilies];
      return;
    }
    this.posStyleFamiliesFiltered = this.posStyleFamilies.filter((row) => {
      const f = row.family;
      const ref = (f.styleReference ?? '').toLowerCase();
      const name = (f.name ?? '').toLowerCase();
      return ref.includes(q) || name.includes(q);
    });
  }

  async selectPosStyleFamily(row: ProductFamilyInventoryOverview): Promise<void> {
    if (!row.family?.productFamilyId || this.selectedWarehouseId == null) {
      return;
    }
    this.selectedPosFamily = row.family;
    this.posVariantLines = row.variants ?? [];
    this.posVariantLinesLoading = true;
    try {
      const fresh = await firstValueFrom(
        this.productFamilyService.getFamilyInventoryOverview(row.family.productFamilyId, this.selectedWarehouseId),
      );
      this.posVariantLines = fresh.variants ?? [];
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('variant_picker_load_failed'),
        life: 4000,
      });
    } finally {
      this.posVariantLinesLoading = false;
      this.cdr.markForCheck();
    }
  }

  clearPosStyleSelection(): void {
    this.selectedPosFamily = null;
    this.posVariantLines = [];
  }

  posVariantSummary(line: ProductVariantLine): string {
    return line.variantSummary || getProductVariantSummary(line);
  }

  async onPosVariantCardClick(line: ProductVariantLine): Promise<void> {
    const net = line.netAvailableQuantity ?? line.quantityAvailable ?? 0;
    if (!line.productId || net <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_quantity_insufficient'),
        life: 3000,
      });
      return;
    }
    try {
      this.productService.loadToken();
      const product = (await firstValueFrom(this.productService.getProduct(line.productId))) as Product;
      const posProduct = this.mapProductToPosDto(product, line);
      await this.addProductToCart(posProduct, 1);
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('variant_picker_resolve_failed'),
        life: 4000,
      });
    }
  }

  private mapProductToPosDto(product: Product, line?: ProductVariantLine): POSProductDTO {
    const storageQty = product.netAvailableQuantity ?? product.quantityAvailable ?? line?.netAvailableQuantity ?? 0;
    return {
      productId: product.productId,
      name: product.name ?? '',
      reference: product.reference ?? line?.reference ?? '',
      sellingPrice: product.sellingPrice ?? line?.sellingPrice ?? 0,
      buyingPrice: product.buyingPrice ?? line?.buyingPrice ?? 0,
      quantityAvailable: storageQty,
      displayQuantityAvailable: product.displayNetAvailableQuantity
        ?? product.displayQuantityAvailable
        ?? (QuantityScale.isFractional(product)
          ? QuantityScale.toDisplayQuantity(product, storageQty)
          : storageQty),
      inventoryStatus: product.inventoryStatus ?? line?.inventoryStatus ?? 'INSTOCK',
      categoryName: product.category?.categoryName,
      warehouseName: product.warehouse?.name ?? line?.warehouseName,
      imageUrl: product.productImage ?? '',
      measureUnit: product.measureUnit,
      stockTrackingMode: product.stockTrackingMode,
      quantityPrecision: product.quantityPrecision,
    };
  }

  private async openPosFamilyForBarcodeScan(styleReference: string): Promise<boolean> {
    if (!this.activityProfileService.emphasizeProductVariants || this.selectedWarehouseId == null) {
      return false;
    }
    const scan = styleReference.trim();
    if (!scan) {
      return false;
    }
    try {
      const families = await firstValueFrom(this.productFamilyService.list(scan, true));
      const exact = families.find(
        (f) => (f.styleReference ?? '').trim().toUpperCase() === scan.toUpperCase(),
      );
      if (!exact?.productFamilyId) {
        return false;
      }
      const overview = await firstValueFrom(
        this.productFamilyService.getFamilyInventoryOverview(exact.productFamilyId, this.selectedWarehouseId),
      );
      this.posSellMode = 'styles';
      this.selectedPosFamily = overview.family;
      this.posVariantLines = overview.variants ?? [];
      this.cdr.markForCheck();

      const inStock = (overview.variants ?? []).filter(
        (v) => (v.netAvailableQuantity ?? v.quantityAvailable ?? 0) > 0,
      );
      if (inStock.length === 1) {
        await this.onPosVariantCardClick(inStock[0]);
        return true;
      }
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('pos_style_scanned_title'),
        detail: this.translate.instant('pos_style_scanned_pick_variant', { style: exact.styleReference }),
        life: 4000,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async ensureSessionAndCart() {
    await this.refreshSessionState();
    
    if (this.session) {
      try {
        // Always fetch fresh cart from server to avoid stale data
        const activeCart$ = await this.posService.getActiveCart(this.session.sessionId);
        const freshCart = await firstValueFrom(activeCart$);
        // Always normalize to ensure calculations are correct
        this.cart = this.normalizeCartItems(freshCart);
        // Set default walk-in customer if no customer is set
        if (this.cart && !this.cart.customerId && !this.selectedCustomer?.customerId) {
          this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
          this.updateAvailablePaymentMethods();
        }
        // Discount, tax, and notes are synced by normalizeCartItems
      } catch {
        // No active cart, create a new one
        const cart$ = await this.posService.createCart(this.session.sessionId);
        const newCart = await firstValueFrom(cart$);
        // Always normalize to ensure calculations are correct
        this.cart = this.normalizeCartItems(newCart);
        // Set default walk-in customer for new cart
        this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
        this.updateAvailablePaymentMethods();
        // Discount, tax values are synced by normalizeCartItems
        // Reset order notes for new cart
        if (this.cart) {
          this.orderNotes = '';
        }
      }
      this.saveToLocalStorage();
    }
  }

  private async refreshSessionState() {
    // For admins, validate shopId; for non-admins, proceed (backend handles shop)
    if (this.isAdmin && !this.shopId) {
      this.session = null;
      this.cart = null;
      return;
    }

    try {
      const activeSession$ = await this.posService.getActiveSession(this.getShopIdForApi());
      const session = await firstValueFrom(activeSession$);
      
      // Check if session is actually active
      if (session && session.active !== false) {
        this.session = session;
        // Always fetch fresh cart from server to avoid stale data
        if (this.isOnline) {
          try {
            const activeCart$ = await this.posService.getActiveCart(session.sessionId);
            const freshCart = await firstValueFrom(activeCart$);
            this.assignCartFromServer(freshCart);
            if (this.cart) {
              this.taxEnabled = this.cart.taxEnabled || false;
            }
            this.saveToLocalStorage();
          } catch {
            // No active cart, create a new one
            const cart$ = await this.posService.createCart(session.sessionId);
            const newCart = await firstValueFrom(cart$);
            this.assignCartFromServer(newCart);
            if (this.cart) {
              this.taxEnabled = this.cart.taxEnabled || false;
            }
            this.saveToLocalStorage();
          }
        }
      } else {
        // Session exists but is not active (closed)
        this.session = null;
        this.cart = null;
        // Clear stale cart from local storage
        this.posStorage.saveCart(null);
        this.saveToLocalStorage();
      }
    } catch (error: any) {
      // 404 is expected when there's no active session (e.g., after closing)
      // Only log non-404 errors to avoid console noise
      if (error?.status !== 404 && error?.status !== 0) {
        console.error('Error refreshing session state:', error);
      }
      // No active session found or error - this is expected after closing a session
      this.session = null;
      this.cart = null;
      // Clear stale cart from local storage
      this.posStorage.saveCart(null);
      this.saveToLocalStorage();
    }
  }

  private async loadQuickProducts() {
    // For admins, validate shopId; for non-admins, proceed (backend handles shop)
    if (this.isAdmin && !this.shopId) return;
    if (this.isAdmin && !this.selectedWarehouseId) {
      this.quickProducts = [];
      this.filteredQuickProducts = [];
      return;
    }
    
    try {
      const quick$ = await this.posService.getQuickProducts(this.getShopIdForApi(), this.selectedWarehouseId ?? undefined);
      const loadedQuickProducts = await firstValueFrom(quick$);
      this.quickProducts = (loadedQuickProducts || []).filter((product: POSProductDTO) => this.matchesSelectedWarehouse(product));
      this.filteredQuickProducts = [...this.quickProducts];
      this.applyCategoryFilter();
    } catch (error) {
      console.error('Error loading quick products:', error);
    }
  }

  private async loadCategories() {
    try {
      (this.categoryService as any).loadToken && (this.categoryService as any).loadToken();
      const categories$ = this.categoryService.getCategories();
      const categories = await firstValueFrom(categories$);
      this.categories = Array.isArray(categories) ? categories : [];
      // Initialize filtered categories with all categories
      this.filteredCategories = [...this.categories];
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }

  filterCategories(event: any): void {
    const query = event.query?.toLowerCase() || '';
    if (!query) {
      this.filteredCategories = [...this.categories];
    } else {
      this.filteredCategories = this.categories.filter(c =>
        c.categoryName.toLowerCase().includes(query)
      );
    }
  }

  onCategorySelect(): void {
    if (this.selectedCategory?.categoryId != null) {
      const cid = Number(this.selectedCategory.categoryId);
      this.selectedCategoryId = Number.isNaN(cid) ? null : cid;
    } else {
      this.selectedCategoryId = null;
    }
    this.applyCategoryFilter();
  }

  clearCategoryFilter(): void {
    this.selectedCategory = null;
    this.selectedCategoryId = null;
    this.filteredQuickProducts = [...this.quickProducts];
  }

  applyCategoryFilter() {
    if (!this.selectedCategoryId) {
      this.filteredQuickProducts = [...this.quickProducts];
    } else {
      const selectedCategory = this.categories.find(c => Number(c.categoryId) === Number(this.selectedCategoryId));
      if (selectedCategory) {
        this.filteredQuickProducts = this.quickProducts.filter(
          p => this.getProductCategoryName(p).toLowerCase() === String(selectedCategory.categoryName || '').toLowerCase()
        );
      } else {
        this.filteredQuickProducts = [...this.quickProducts];
      }
    }
  }

  private getProductCategoryName(product: any): string {
    return String(product?.categoryName || product?.category?.categoryName || '');
  }

  toggleProductView() {
    this.productViewMode = this.productViewMode === 'grid' ? 'list' : 'grid';
  }

  getProductImageUrl(product: POSProductDTO | any): string {
    let raw = '';
    if (product?.imageUrl) {
      raw = product.imageUrl;
    } else if (product?.productId) {
      // Try to find product in quickProducts by productId
      const found = this.quickProducts.find(p => p.productId === product.productId);
      raw = found?.imageUrl ?? '';
    }
    // Stored URLs are relative (e.g. /api/uploads/products/..). Resolve to an
    // absolute URL against the API host, otherwise the browser requests them
    // from the SPA origin and they 404 (broken images).
    return resolvePublicAssetUrl(raw) || 'assets/core-images/no-image.png';
  }

  getCartItemImage(item: any): string {
    // Try to find product in quickProducts or searchResults
    const product = [...this.quickProducts, ...this.searchResults].find(p => p.productId === item.productId);
    return this.getProductImageUrl(product || {});
  }

  private isWalkInCustomer(customer: any): boolean {
    // Check if customer name matches walk-in customer translations
    const walkInNames = [
      'Walk-in Customer',
      'Client sans rendez',
      'Client de passage',
      'عميل بدون موعد',
      'Cliente sin cita'
    ];
    const fullName = customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.name || '';
    return walkInNames.some(name => fullName.toLowerCase() === name.toLowerCase());
  }

  private async loadCustomers() {
    // Load initial customers for autocomplete suggestions
    try {
      (this.customerService as any).loadToken && await (this.customerService as any).loadToken();
      const customers$ = this.customerService.getCustomers();
      const customers = await firstValueFrom(customers$);
      this.customers = Array.isArray(customers) ? customers : [];
      // Filter out any customers with null ID and walk-in customer names
      // Limit to first 20 customers for initial suggestions
      this.customers = this.customers
        .filter(c => c.customerId != null && !this.isWalkInCustomer(c))
        .slice(0, 20);
      // Add fullName property if not present
      this.customers = this.customers.map(c => ({
        ...c,
        fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown'
      }));
      
      // Set initial suggestions (walk-in + first few customers)
      const walkInLabel = this.translate.instant('walk_in_customer');
      this.customerSuggestions = [
        { customerId: null, fullName: walkInLabel },
        ...this.customers.slice(0, 10) // Show first 10 customers as initial suggestions
      ];
    } catch (error: any) {
      // Handle 403 (Forbidden) errors gracefully - user may not have customer read permission
      // POS can still work with walk-in customers only
      if (error?.status === 403) {
        // Silently handle permission errors - expected for users without customer read access
      } else {
        console.error('Error loading customers:', error);
      }
      this.customers = [];
      const walkInLabel = this.translate.instant('walk_in_customer');
      this.customerSuggestions = [{ customerId: null, fullName: walkInLabel }];
    }
  }

  // ========== Search & scan ==========

  onBarcodeEnter() {
    // Any pending auto-submit is now redundant (Enter/CR arrived or button pressed).
    this.clearBarcodeDebounce();
    this.barcodeFastKeystrokes = false;
    const barcode = this.barcodeInput.trim();
    if (!barcode || !this.shopId) {
      return;
    }
    this.lookupByBarcode(barcode);
  }

  /**
   * Fires on every keystroke in the barcode field. Detects a scanner burst
   * (characters arriving faster than a human can type) and, once the burst goes
   * quiet, submits automatically — so a keyboard-less terminal works even when the
   * scanner is not configured to append an Enter/CR suffix.
   */
  onBarcodeInputChange(value: string) {
    this.clearBarcodeDebounce();

    if (!value) {
      this.barcodeFastKeystrokes = false;
      return;
    }

    const now = Date.now();
    const gap = now - this.barcodeLastKeyTime;
    this.barcodeLastKeyTime = now;

    if (value.length <= 1) {
      // First character of a new sequence — can't judge speed yet.
      this.barcodeFastKeystrokes = false;
    } else if (gap <= this.BARCODE_SCANNER_MAX_GAP_MS) {
      this.barcodeFastKeystrokes = true;
    } else {
      // A human-speed keystroke breaks the scanner assumption.
      this.barcodeFastKeystrokes = false;
    }

    this.barcodeDebounceTimer = setTimeout(() => {
      this.barcodeDebounceTimer = null;
      // Only auto-submit scanner-speed input; manual typing uses Enter or the button.
      if (this.barcodeFastKeystrokes) {
        this.onBarcodeEnter();
      }
    }, this.BARCODE_DEBOUNCE_MS);
  }

  private clearBarcodeDebounce() {
    if (this.barcodeDebounceTimer) {
      clearTimeout(this.barcodeDebounceTimer);
      this.barcodeDebounceTimer = null;
    }
  }

  private async lookupByBarcode(barcode: string) {
    this.productsLoading = true;
    try {
      // First try the new barcode scanning API
      this.barcodeService.loadToken();
      const scanResult = await firstValueFrom(this.barcodeService.scanBarcode(barcode));
      
      if (scanResult.found && scanResult.productId) {
        // Convert scan result to POSProductDTO format
        const product: POSProductDTO = {
          productId: scanResult.productId,
          name: scanResult.productName || '',
          reference: scanResult.productReference || '',
          sellingPrice: scanResult.sellingPrice || 0,
          buyingPrice: scanResult.buyingPrice || 0,
          quantityAvailable: scanResult.quantityAvailable || 0,
          inventoryStatus: scanResult.inventoryStatus || 'INSTOCK',
          categoryName: scanResult.categoryName,
          warehouseName: scanResult.warehouseName,
          imageUrl: scanResult.productImage || '',
          measureUnit: scanResult.measureUnit
        };
        await this.addProductToCart(product, 1);
        this.barcodeInput = '';
      } else {
        if (await this.openPosFamilyForBarcodeScan(barcode)) {
          return;
        }
        await this.fallbackBarcodeSearch(barcode);
      }
    } catch (error: any) {
      console.error('Error with barcode scan API, trying fallback:', error);
      if (await this.openPosFamilyForBarcodeScan(barcode)) {
        return;
      }
      await this.fallbackBarcodeSearch(barcode);
    } finally {
      this.productsLoading = false;
    }
  }

  private async fallbackBarcodeSearch(barcode: string) {
    // For admins, validate shopId
    if (this.isAdmin && !this.validateShopIdForAdmin()) {
      return;
    }

    try {
      const product$ = await this.posService.getProductByBarcode(barcode, this.getShopIdForApi());
      const product = await firstValueFrom(product$);
      await this.addProductToCart(product, 1);
      this.barcodeInput = '';
    } catch (error: any) {
      console.error('Error fetching product by barcode (fallback):', error);
      if (await this.openPosFamilyForBarcodeScan(barcode)) {
        return;
      }
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_not_found_warning'),
        life: 3000
      });
    }
  }

  onSearchChange(event: { query?: string } | string | null | undefined): void {
    const querySource =
      typeof event === 'string'
        ? event
        : (typeof event?.query === 'string' ? event.query : '');
    const query = querySource.trim();
    this.searchQuery = query;

    // Clear previous suggestions immediately to prevent duplicates
    this.searchSuggestions = [];
    this.searchResults = [];

    // Perform search and populate suggestions (empty query loads default products)
    this.performSearch(query);
  }

  private parseInsufficientStockValues(message: string): { available?: number; required?: number } {
    const text = String(message || '');
    const readNumber = (pattern: RegExp): number | undefined => {
      const match = text.match(pattern);
      if (!match?.[1]) {
        return undefined;
      }
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const available = readNumber(/(?:available|disponible)\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    const required = readNumber(/(?:required|requested|requis|demand[ée])\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i);
    return { available, required };
  }

  private getInsufficientStockDetail(
    backendMessage?: string,
    fallbackAvailable?: number,
    fallbackRequired?: number,
  ): string {
    const parsed = this.parseInsufficientStockValues(String(backendMessage || ''));
    const available = parsed.available ?? fallbackAvailable;
    const required = parsed.required ?? fallbackRequired;
    if (available != null && required != null) {
      return this.translate.instant('insufficient_stock', { available, required });
    }
    return this.translate.instant('product_quantity_insufficient');
  }

  private async performSearch(query: string) {
    // For admins, validate shopId
    if (this.isAdmin && !this.validateShopIdForAdmin()) {
      this.searchSuggestions = [];
      this.searchResults = [];
      return;
    }
    if (this.isAdmin && !this.selectedWarehouseId) {
      this.searchSuggestions = [];
      this.searchResults = [];
      return;
    }

    // Prevent multiple simultaneous searches
    if (this.isSearching) {
      return;
    }

    this.isSearching = true;
    this.productsLoading = true;

    try {
      // Use the same search method as orders component (does contains search)
      const res$ = await this.productService.searchProductsForOrder(query, this.getWarehouseIdForApi());
      const products = await firstValueFrom(res$);

      // Normalize response like orders component does
      const normalizedProducts = this.normalizeProductSearchResponse(products);

      console.log('Normalized products for query "' + query + '":', normalizedProducts.length, 'unique products');
      if (normalizedProducts.length > 0) {
        console.log('First product properties:', Object.keys(normalizedProducts[0]));
        console.log('First product ID field:', normalizedProducts[0].productId || normalizedProducts[0].id);
      }

      // Set both searchSuggestions for autocomplete dropdown and searchResults for grid/list display
      const warehouseScoped = normalizedProducts.filter((p: any) => this.matchesSelectedWarehouse(p));
      this.searchSuggestions = [...warehouseScoped]; // Create a new array reference
      this.searchResults = [...warehouseScoped];

      // Force change detection
      this.cdr.detectChanges();
    } catch (error) {
      console.error('Error searching products:', error);
      this.searchSuggestions = [];
      this.searchResults = [];
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_while_getting_products'),
        life: 3000
      });
    } finally {
      this.productsLoading = false;
      this.isSearching = false;
    }
  }

  private normalizeProductSearchResponse(response: any): any[] {
    if (!response) {
      return [];
    }

    let products: any[] = [];

    if (Array.isArray(response)) {
      products = response;
    } else if (response.page?.content && Array.isArray(response.page.content)) {
      products = response.page.content;
    }

    // Remove duplicates based on productId
    const uniqueProducts = products.filter((product, index, self) =>
      index === self.findIndex(p => p.productId === product.productId)
    );

    return uniqueProducts;
  }

  async onQuickProductClick(product: POSProductDTO) {
    await this.addProductToCart(product, 1);
  }

  async onSearchProductClick(product: POSProductDTO) {
    await this.addProductToCart(product, 1);
  }

  // ========== Cart management ==========

  get cartTotal(): number {
    return this.cart?.totalAmount || 0;
  }

  /** Transport + additional charges (non-taxable, not in tax base). */
  private cartNonTaxableExtras(cart: POSCartDTO | null = this.cart): number {
    if (!cart) {
      return 0;
    }
    return (cart.transportAmount || 0) + (cart.additionalChargesAmount || 0);
  }

  private recalculateCartTotalFromParts(cart: POSCartDTO): void {
    const goods = (cart.subtotal || 0) - (cart.discountAmount || 0);
    // In TTC mode the tax is already inside the goods amount, so it is not added again.
    const taxToAdd = this.taxInclusive ? 0 : (cart.taxAmount || 0);
    cart.totalAmount = goods + taxToAdd + this.cartNonTaxableExtras(cart);
  }

  /** Client-side tax for a taxable (goods after discount) amount, honouring TTC mode. */
  private computeClientTax(taxableAmount: number): number {
    if (this.taxRate <= 0) return 0;
    return this.taxInclusive
      ? taxableAmount - taxableAmount / (1 + this.taxRate)
      : taxableAmount * this.taxRate;
  }

  private clearSummaryFieldDebounceTimers(): void {
    if (this.transportDebounceTimer) {
      clearTimeout(this.transportDebounceTimer);
      this.transportDebounceTimer = null;
    }
    if (this.additionalChargesDebounceTimer) {
      clearTimeout(this.additionalChargesDebounceTimer);
      this.additionalChargesDebounceTimer = null;
    }
    if (this.discountDebounceTimer) {
      clearTimeout(this.discountDebounceTimer);
      this.discountDebounceTimer = null;
    }
  }

  private hasPendingSummaryFieldSync(): boolean {
    return !!(
      this.transportDebounceTimer ||
      this.additionalChargesDebounceTimer ||
      this.discountDebounceTimer
    );
  }

  private shouldPreserveLocalSummaryFields(): boolean {
    return this.summaryFieldsDirty || this.hasPendingSummaryFieldSync();
  }

  /** Apply current UI summary fields onto cart and recalculate totals (optimistic). */
  private reconcileUiSummaryFieldsToCart(): void {
    if (!this.cart) {
      return;
    }
    this.cart.transportAmount = this.transportAmount || 0;
    this.cart.additionalChargesAmount = this.additionalChargesAmount || 0;
    this.cart.discountType = this.discountType;
    this.cart.discountAmount = this.computeCartDiscountFromUi();
    this.cart.taxEnabled = this.taxEnabled;
    if (this.taxEnabled && this.taxRate > 0 && !this.isCustomerTaxExempt()) {
      const taxableAmount = (this.cart.subtotal || 0) - (this.cart.discountAmount || 0);
      this.cart.taxAmount = this.computeClientTax(taxableAmount);
    } else {
      this.cart.taxAmount = 0;
    }
    this.recalculateCartTotalFromParts(this.cart);
  }

  private computeCartDiscountFromUi(): number {
    if (!this.cart) {
      return 0;
    }
    const subtotal = this.cart.subtotal || 0;
    if (subtotal <= 0) {
      return 0;
    }
    if (this.discountType === 'Percentage') {
      const pct = Math.min(100, Math.max(0, this.discountAmount || 0));
      return Math.round(subtotal * (pct / 100) * 100) / 100;
    }
    return Math.min(subtotal, Math.max(0, this.discountAmount || 0));
  }

  private assignCartFromServer(cart: POSCartDTO | null): void {
    const preserveLocal = this.shouldPreserveLocalSummaryFields();
    this.cart = this.normalizeCartItems(cart, !preserveLocal);
    if (this.cart && preserveLocal) {
      this.reconcileUiSummaryFieldsToCart();
    } else if (this.cart) {
      this.summaryFieldsDirty = false;
    }
    this.maybeRefreshRuleTaxRate();
  }

  /** A tax-exempt customer is never taxed, regardless of mode or rules (matches backend). */
  isCustomerTaxExempt(): boolean {
    return !!this.selectedCustomer?.taxExempt;
  }

  /**
   * RULES mode only: refreshes the effective (net-weighted) tax rate for the current
   * cart lines so optimistic client-side tax previews match the server's per-line
   * rule resolution between syncs. Deduped by signature; stale responses dropped.
   */
  private maybeRefreshRuleTaxRate(): void {
    if (!this.taxRulesMode || !this.cart?.items?.length) return;
    const lines = this.cart.items
      .filter((it: any) => it?.productId || it?.product?.productId)
      .map((it: any) => ({
        productId: it.productId || it.product?.productId,
        netAmount: Math.max(0, Number(it.subtotal) || 0)
      }));
    if (!lines.length) return;
    const customerId = this.selectedCustomer?.customerId ?? null;
    const signature = JSON.stringify({ c: customerId, l: lines });
    if (signature === this.taxResolveSignature) return;
    this.taxResolveSignature = signature;
    const seq = ++this.taxResolveSeq;
    this.taxRuleService
      .resolveTaxRates({ documentType: 'SALES', customerId, lines })
      .then(obs =>
        obs.subscribe({
          next: res => {
            if (seq !== this.taxResolveSeq) return;
            if (res && typeof res.effectiveRate === 'number' && res.mode === 'RULES') {
              this.taxRate = res.effectiveRate;
            }
          },
          error: () => {
            this.taxResolveSignature = '';
          }
        })
      );
  }

  /** Push pending summary edits to the server before checkout. */
  private async flushSummaryFieldSync(): Promise<void> {
    const hadPending = this.hasPendingSummaryFieldSync();
    this.clearSummaryFieldDebounceTimers();
    if (!this.cart || (!this.summaryFieldsDirty && !hadPending)) {
      return;
    }
    await Promise.all([
      this.persistTransportAmount(),
      this.persistAdditionalCharges(),
      this.persistDiscount()
    ]);
  }

  /**
   * Normalize cart items coming from backend/local storage so UI bindings always work,
   * even if backend uses nested product objects instead of flat productName/productReference.
   * Also ensures totals are calculated if missing.
   * @param cart The cart to normalize
   * @param syncDiscountTax Whether to sync discount and tax values from cart (default: true)
   */
  // ---------------------------------------------------------------------
  // Sale-line options (components/cuts) on POS cart lines
  // ---------------------------------------------------------------------

  /** Fetch every active option set once (cached); applicability resolved per line. */
  private async ensurePosOptionSetsLoaded(items: POSCartItemDTO[]): Promise<void> {
    if (this.allOptionSetsCache || !(items && items.length)) return;
    try {
      const obs = await this.lineOptionSetService.list();
      const res = await firstValueFrom(obs);
      this.allOptionSetsCache = (Array.isArray(res) ? res : []).filter(s => s.active !== false);
    } catch (e: any) {
      if (e?.status !== 404) console.warn('Could not load line option sets', e);
      this.allOptionSetsCache = [];
    }
    this.cdr.detectChanges();
  }

  /** Sets applicable to a cart line: product-scoped, its category-scoped, or global (both null). */
  getPosOptionSets(item: POSCartItemDTO): LineOptionSet[] {
    const pid = item?.productId;
    const cid = item?.categoryId ?? null;
    return (this.allOptionSetsCache || []).filter(s =>
      (s.productId != null && s.productId === pid) ||
      (s.categoryId != null && cid != null && s.categoryId === cid) ||
      (s.productId == null && s.categoryId == null)
    );
  }

  hasCartLineOptions(item: POSCartItemDTO): boolean {
    return this.getPosOptionSets(item).length > 0;
  }

  private parseCsvIds(csv: string | null | undefined): number[] {
    if (!csv) return [];
    return csv.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  }

  cartLineOptionCount(item: POSCartItemDTO): number {
    return this.parseCsvIds(item.selectedOptionIds).length;
  }

  cartLineOptionLabels(item: POSCartItemDTO): string[] {
    const ids = this.parseCsvIds(item.selectedOptionIds);
    if (!ids.length) return [];
    const labels: string[] = [];
    for (const set of this.getPosOptionSets(item)) {
      for (const opt of (set.options || [])) {
        if (opt.lineOptionId != null && ids.includes(opt.lineOptionId)) {
          labels.push(opt.label || opt.code || '');
        }
      }
    }
    return labels;
  }

  openCartOptions(item: POSCartItemDTO): void {
    this.optionsCartItem = item;
    this.optionsSets = this.getPosOptionSets(item);
    // Group the line's current CSV selection into per-set arrays.
    const ids = this.parseCsvIds(item.selectedOptionIds);
    const selections: { [setId: number]: number[] } = {};
    for (const set of this.optionsSets) {
      const setOptionIds = (set.options || []).map(o => o.lineOptionId as number);
      selections[set.lineOptionSetId as number] = ids.filter(id => setOptionIds.includes(id));
    }
    this.optionsWorkingSelections = selections;
    this.optionsDialogVisible = true;
  }

  closeCartOptions(): void {
    this.optionsDialogVisible = false;
    this.optionsCartItem = null;
    this.optionsSets = [];
    this.optionsWorkingSelections = {};
  }

  private workingSelFor(setId: number): number[] {
    return this.optionsWorkingSelections[setId] || (this.optionsWorkingSelections[setId] = []);
  }

  isWorkingSelected(set: LineOptionSet, option: LineOption): boolean {
    return this.workingSelFor(set.lineOptionSetId as number).includes(option.lineOptionId as number);
  }

  toggleWorkingOption(set: LineOptionSet, option: LineOption): void {
    const setId = set.lineOptionSetId as number;
    const optId = option.lineOptionId as number;
    const current = this.workingSelFor(setId);
    const idx = current.indexOf(optId);
    if (set.selectionMode === 'SINGLE') {
      this.optionsWorkingSelections[setId] = idx > -1 && (set.minSelect || 0) === 0 ? [] : [optId];
      return;
    }
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      if (set.maxSelect != null && current.length >= set.maxSelect) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('line_option_max_reached', { max: set.maxSelect }),
          life: 3000,
        });
        return;
      }
      current.push(optId);
    }
  }

  workingSelectionValid(): boolean {
    for (const set of this.optionsSets) {
      const count = this.workingSelFor(set.lineOptionSetId as number).length;
      if (count < (set.minSelect || 0)) return false;
      if (set.maxSelect != null && count > set.maxSelect) return false;
    }
    return true;
  }

  async saveCartOptions(): Promise<void> {
    if (!this.optionsCartItem || !this.cart || this.optionsSaving) return;
    if (!this.workingSelectionValid()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('line_options_line_invalid'),
        life: 3500,
      });
      return;
    }
    const ids: number[] = [];
    for (const arr of Object.values(this.optionsWorkingSelections) as any[]) {
      if (Array.isArray(arr)) ids.push(...(arr as number[]));
    }
    const csv = ids.join(',');
    this.optionsSaving = true;
    try {
      const updated$ = await this.posService.updateCartItem(
        this.optionsCartItem.cartItemId, undefined, undefined, csv);
      this.cart = this.normalizeCartItems(await firstValueFrom(updated$));
      this.updateCartTracking();
      this.saveToLocalStorage();
      this.closeCartOptions();
    } catch (e: any) {
      console.error('Failed to update cart line options', e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: e?.error?.message || this.translate.instant('line_options_error_save'),
        life: 4000,
      });
    } finally {
      this.optionsSaving = false;
    }
  }

  private normalizeCartItems(cart: POSCartDTO | null, syncDiscountTax: boolean = true): POSCartDTO | null {
    if (!cart) {
      return cart;
    }

    const items: any[] = (cart as any).items || (cart as any).cartItems || [];
    (cart as any).items = items.map((item: any) => {
      const product = item.product || item.productDto || {};
      const manualOverride = item.priceOverride ?? item.manualPriceOverride;
      const quantity = item.quantity || 0;
      const pricePerUnit = item.pricePerUnit || 0;
      const stockTrackingMode = item.stockTrackingMode ?? product.stockTrackingMode;
      const measureUnit = item.measureUnit ?? product.measureUnit;
      const displayQuantityAvailable = item.displayQuantityAvailable ?? product.displayQuantityAvailable;
      const normalized: POSCartItemDTO = {
        ...item,
        quantity,
        pricePerUnit,
        stockTrackingMode,
        measureUnit,
        displayQuantityAvailable,
        productName:
          item.productName ||
          product.name ||
          product.productName ||
          '',
        productReference:
          item.productReference ||
          product.reference ||
          product.productReference ||
          '',
        quantityAvailable:
          item.quantityAvailable ??
          product.quantityAvailable ??
          product.stock ??
          0,
      };
      normalized.displayQuantity = getCartItemDisplayQuantity(normalized);
      normalized.subtotal = item.subtotal > 0
        ? item.subtotal
        : computeCartItemSubtotal(normalized);
      return {
        ...normalized,
        manualPriceOverride: manualOverride != null,
        priceOverride: manualOverride ?? item.priceOverride,
      };
    });

    // Preload option sets for the products on the cart so the per-line options control can show.
    void this.ensurePosOptionSetsLoaded(cart.items);

    // Always recalculate subtotal from items
    cart.subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.subtotal || 0);
    }, 0);
    
    // Ensure discount amount is set (default to 0 if missing)
    if (cart.discountAmount === undefined || cart.discountAmount === null) {
      cart.discountAmount = 0;
    }
    
    // Ensure tax amount is set (default to 0 if missing)
    if (cart.taxAmount === undefined || cart.taxAmount === null) {
      cart.taxAmount = 0;
    }
    
    // Ensure taxEnabled is set (default to false if missing)
    if (cart.taxEnabled === undefined || cart.taxEnabled === null) {
      cart.taxEnabled = false;
    }
    
    // Recalculate tax if tax is enabled
    // Always recalculate to ensure consistency, even if tax rate is 0 (will be 0 temporarily)
    if (cart.taxEnabled && !this.isCustomerTaxExempt()) {
      if (this.taxRate > 0) {
        const taxableAmount = (cart.subtotal || 0) - (cart.discountAmount || 0);
        cart.taxAmount = this.computeClientTax(taxableAmount);
      } else {
        // Tax rate not loaded yet, but tax is enabled - set to 0 for now
        // Will be recalculated when tax rate is loaded via loadTaxRate()
        cart.taxAmount = 0;
      }
    } else {
      // Tax is disabled, ensure tax amount is 0
      cart.taxAmount = 0;
    }
    
    // Always recalculate total from subtotal, discount, tax, and non-taxable extras
    this.recalculateCartTotalFromParts(cart);
    
    // Sync all UI values from cart after normalization (unless explicitly disabled)
    if (syncDiscountTax) {
      this.syncDiscountAndTaxFromCart();
    }

    return cart;
  }

  async addProductToCart(product: POSProductDTO, quantity: number) {
    if (!this.session) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_open_session_first'),
        life: 3000
      });
      this.showOpenSessionDialog();
      return;
    }
    if (!this.cart) return;
    if (quantity <= 0) {
      return;
    }
    
    const productMeta = {
      stockTrackingMode: product.stockTrackingMode,
      measureUnit: product.measureUnit,
    } as Product;
    // Services carry no stock and are always sellable — skip all stock validation for them.
    const isServiceProduct = product.productType === 'SERVICE';
    const netAvailable = QuantityScale.isFractional(productMeta)
      ? (product.displayQuantityAvailable ?? QuantityScale.toDisplayQuantity(productMeta, product.quantityAvailable || 0))
      : (product.quantityAvailable || 0);
    if (!isServiceProduct && netAvailable <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_quantity_insufficient'),
        life: 3000
      });
      return;
    }

    // With soft reservations, client qty may not reflect others' holds — let the API enforce when online.
    const skipClientMaxQty =
      isServiceProduct || (this.salesStockSoftReservationEnabled && this.isOnline);
    if (!skipClientMaxQty && quantity > netAvailable) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.getInsufficientStockDetail(undefined, netAvailable, quantity),
        life: 3000
      });
      return;
    }

    this.cartSaving = true;
    try {
      // Use only product.productId, as 'id' does not exist on POSProductDTO
      const productId = product.productId;
      if (!productId) {
        console.error('Product missing productId:', product);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: 'Product ID is missing or invalid',
          life: 3000
        });
        return;
      }

      if (this.isOnline) {
        // Send display quantity; backend converts to storage via toStorageFromUserInput
        const apiQty = QuantityScale.isFractional(productMeta) ? quantity : Math.max(1, Math.round(quantity));
        const updated$ = await this.posService.addItemToCart(this.cart.cartId, productId, apiQty);
        this.cart = this.normalizeCartItems(await firstValueFrom(updated$));
        this.updateCartTracking();
        this.saveToLocalStorage();
      } else {
        // Offline mode - update cart locally
        // This is a simplified version - you may want to queue the operation
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('working_offline'),
          life: 2000
        });
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('product_added_success'),
        life: 2000
      });

      // Additional feedback for scanned products
      if (this.lastScanResult) {
        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('barcode_scanned'),
          detail: this.translate.instant('product_added_via_scan'),
          life: 3000
        });
        this.lastScanResult = ''; // Clear scan result after showing message
      }
    } catch (error: any) {
      console.error('Error adding item to cart:', error);
      // Use user-friendly message if available (from write-off error parsing)
      const msg = error?.userFriendlyMessage || 
                  error?.error?.message || 
                  error?.message ||
                  this.translate.instant('error_occurred');
      
      // Check if it's a stock error
      const isStockError = error?.error?.code === 'insufficient_stock' ||
                          msg.toLowerCase().includes('insufficient stock') ||
                          msg.toLowerCase().includes('written off') ||
                          msg.toLowerCase().includes('reservation');

      this.messageService.add({
        severity: isStockError ? 'warn' : 'error',
        summary: isStockError ? this.translate.instant('warning') : this.translate.instant('error'),
        detail: isStockError ? this.getInsufficientStockDetail(msg) : msg,
        life: 5000
      });
    } finally {
      this.cartSaving = false;
    }
  }

  async onQuantityChange(item: any, newQuantity: number) {
    if (!this.cart) return;
    if (newQuantity <= 0) {
      return;
    }
    
    const displayQty = this.getCartLineDisplayQuantity(item);
    const skipClientMaxQty =
      this.salesStockSoftReservationEnabled && this.isOnline;
    const netAvailable = this.getCartLineDisplayStock(item);
    if (netAvailable > 0) {
      if (!skipClientMaxQty && displayQty > netAvailable) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.getInsufficientStockDetail(undefined, netAvailable, displayQty),
          life: 3000
        });
        return;
      }
    }

    this.cartSaving = true;
    try {
      const priceOverride = this.getManualPriceOverride(item);
      const apiQuantity = this.toApiQuantity(item, displayQty);
      const updated$ = priceOverride != null
        ? await this.posService.updateCartItem(item.cartItemId, apiQuantity, priceOverride)
        : await this.posService.updateCartItem(item.cartItemId, apiQuantity);
      const updatedCart = await firstValueFrom(updated$);
      // Normalize cart to recalculate totals
      this.cart = this.normalizeCartItems(updatedCart);
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error: any) {
      console.error('Error updating cart item:', error);
      // Use user-friendly message if available (from write-off error parsing)
      const msg = error?.userFriendlyMessage || 
                  error?.error?.message || 
                  error?.message ||
                  this.translate.instant('error_occurred');
      
      // Check if it's a stock error
      const isStockError = error?.error?.code === 'insufficient_stock' ||
                          msg.toLowerCase().includes('insufficient stock') ||
                          msg.toLowerCase().includes('written off') ||
                          msg.toLowerCase().includes('reservation');

      this.messageService.add({
        severity: isStockError ? 'warn' : 'error',
        summary: isStockError ? this.translate.instant('warning') : this.translate.instant('error'),
        detail: isStockError ? this.getInsufficientStockDetail(msg) : msg,
        life: 5000
      });
    } finally {
      this.cartSaving = false;
    }
  }

  private getManualPriceOverride(item: any): number | null {
    if (!item) return null;
    if (item.priceOverride !== undefined && item.priceOverride !== null) {
      return item.priceOverride;
    }
    if (item.manualPriceOverride) {
      return item.pricePerUnit ?? null;
    }
    return null;
  }

  async removeItem(item: any) {
    if (!this.cart) return;
    this.cartSaving = true;
    try {
      const updated$ = await this.posService.removeCartItem(item.cartItemId);
      const updatedCart = await firstValueFrom(updated$);
      // Normalize cart to recalculate totals
      this.cart = this.normalizeCartItems(updatedCart);
      this.updateCartTracking();
      this.saveToLocalStorage();
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: this.translate.instant('product_removed_success'),
        life: 2000
      });
    } catch (error) {
      console.error('Error removing cart item:', error);
    } finally {
      this.cartSaving = false;
    }
  }

  onDiscountInput(amount: number | null) {
    if (!this.cart) {
      return;
    }
    if (amount === null || amount === undefined || amount < 0) {
      amount = 0;
    }
    this.discountAmount = amount;
    this.summaryFieldsDirty = true;
    this.reconcileUiSummaryFieldsToCart();
    this.updateCartTracking();
    this.saveToLocalStorage();
    this.scheduleDiscountPersist();
  }

  private scheduleDiscountPersist(): void {
    if (this.discountDebounceTimer) {
      clearTimeout(this.discountDebounceTimer);
    }
    this.discountDebounceTimer = setTimeout(() => {
      this.discountDebounceTimer = null;
      void this.persistDiscount();
    }, PosComponent.SUMMARY_FIELD_DEBOUNCE_MS);
  }

  private async persistDiscount(): Promise<void> {
    if (!this.cart) {
      return;
    }
    const amount = this.discountAmount;
    const type = this.discountType;

    if (amount < 0) {
      return;
    }
    if (type === 'Percentage' && amount > 100) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('discount_percentage_cannot_exceed_100'),
        life: 3000
      });
      return;
    }
    if (type === 'Amount' && amount > (this.cart.subtotal || 0)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('discount_amount_cannot_exceed_subtotal'),
        life: 3000
      });
      return;
    }

    const seq = ++this.discountPersistSeq;
    try {
      const updated$ = await this.posService.updateCartDiscount(this.cart.cartId, amount, type);
      const updatedCart = await firstValueFrom(updated$);
      if (seq !== this.discountPersistSeq || !this.cart) {
        return;
      }
      const previousDiscountAmount = this.discountAmount;
      const previousDiscountType = this.discountType;
      this.cart = this.normalizeCartItems(updatedCart, false);
      this.discountAmount = previousDiscountAmount;
      this.discountType = previousDiscountType;
      this.reconcileUiSummaryFieldsToCart();
      if (this.taxEnabled && this.taxRate > 0) {
        this.recalculateTax();
      }
      this.updateCartTracking();
      this.saveToLocalStorage();
      if (!this.hasPendingSummaryFieldSync()) {
        this.summaryFieldsDirty = false;
      }
    } catch (error) {
      console.error('Error applying discount:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  onDiscountTypeChange() {
    if (!this.cart || !this.cart.subtotal) return;

    const subtotal = this.cart.subtotal || 0;
    if (subtotal <= 0) return;

    this.summaryFieldsDirty = true;
    this.reconcileUiSummaryFieldsToCart();
    this.updateCartTracking();
    this.saveToLocalStorage();
    if (this.discountDebounceTimer) {
      clearTimeout(this.discountDebounceTimer);
      this.discountDebounceTimer = null;
    }
    void this.persistDiscount();
  }

  onTransportAmountChange(amount: number | null) {
    if (!this.cart) return;

    if (amount === null || amount === undefined) {
      amount = 0;
    }
    if (amount < 0) {
      amount = 0;
      this.transportAmount = 0;
    }

    this.transportAmount = amount;
    this.summaryFieldsDirty = true;
    this.reconcileUiSummaryFieldsToCart();
    this.updateCartTracking();
    this.saveToLocalStorage();
    this.scheduleTransportPersist();
  }

  private scheduleTransportPersist(): void {
    if (this.transportDebounceTimer) {
      clearTimeout(this.transportDebounceTimer);
    }
    this.transportDebounceTimer = setTimeout(() => {
      this.transportDebounceTimer = null;
      void this.persistTransportAmount();
    }, PosComponent.SUMMARY_FIELD_DEBOUNCE_MS);
  }

  private async persistTransportAmount(): Promise<void> {
    if (!this.cart) {
      return;
    }
    const amount = this.transportAmount || 0;
    const seq = ++this.transportPersistSeq;
    try {
      const updated$ = await this.posService.updateCartTransport(this.cart.cartId, amount);
      const updatedCart = await firstValueFrom(updated$);
      if (seq !== this.transportPersistSeq || !this.cart) {
        return;
      }
      updatedCart.transportAmount = amount;
      this.cart = this.normalizeCartItems(updatedCart, false);
      this.transportAmount = amount;
      this.cart.transportAmount = amount;
      this.reconcileUiSummaryFieldsToCart();
      this.updateCartTracking();
      this.saveToLocalStorage();
      if (!this.hasPendingSummaryFieldSync()) {
        this.summaryFieldsDirty = false;
      }
    } catch (error) {
      console.error('Error updating transport amount:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  onAdditionalChargesAmountChange(amount: number | null) {
    if (!this.cart) return;

    if (amount === null || amount === undefined) {
      amount = 0;
    }
    if (amount < 0) {
      amount = 0;
      this.additionalChargesAmount = 0;
    }

    this.additionalChargesAmount = amount;
    this.summaryFieldsDirty = true;
    this.reconcileUiSummaryFieldsToCart();
    this.updateCartTracking();
    this.saveToLocalStorage();
    this.scheduleAdditionalChargesPersist();
  }

  private scheduleAdditionalChargesPersist(): void {
    if (this.additionalChargesDebounceTimer) {
      clearTimeout(this.additionalChargesDebounceTimer);
    }
    this.additionalChargesDebounceTimer = setTimeout(() => {
      this.additionalChargesDebounceTimer = null;
      void this.persistAdditionalCharges();
    }, PosComponent.SUMMARY_FIELD_DEBOUNCE_MS);
  }

  private async persistAdditionalCharges(): Promise<void> {
    if (!this.cart) {
      return;
    }
    const amount = this.additionalChargesAmount || 0;
    const seq = ++this.additionalChargesPersistSeq;
    try {
      const updated$ = await this.posService.updateCartAdditionalCharges(this.cart.cartId, amount);
      const updatedCart = await firstValueFrom(updated$);
      if (seq !== this.additionalChargesPersistSeq || !this.cart) {
        return;
      }
      updatedCart.additionalChargesAmount = amount;
      this.cart = this.normalizeCartItems(updatedCart, false);
      this.additionalChargesAmount = amount;
      this.cart.additionalChargesAmount = amount;
      this.reconcileUiSummaryFieldsToCart();
      this.updateCartTracking();
      this.saveToLocalStorage();
      if (!this.hasPendingSummaryFieldSync()) {
        this.summaryFieldsDirty = false;
      }
    } catch (error) {
      console.error('Error updating additional charges:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  onTaxSwitchChange() {
    if (!this.cart) return;
    // Use setTimeout to defer the async call to avoid change detection error
    setTimeout(() => {
      this.toggleTax();
    }, 0);
  }

  async loadTaxRate(): Promise<void> {
    try {
      const modeConfig$ = await this.configService.getConfiguration('tax.calculation.mode');
      const modeConfig: any = await firstValueFrom(modeConfig$).catch(() => null);
      this.taxRulesMode = String(modeConfig?.value || 'GLOBAL').toUpperCase() === 'RULES';
    } catch {
      this.taxRulesMode = false;
    }
    try {
      const incConfig$ = await this.configService.getConfiguration('pricing.tax.inclusive');
      const incConfig: any = await firstValueFrom(incConfig$).catch(() => null);
      this.taxInclusive = String(incConfig?.value).toLowerCase() === 'true';
    } catch {
      this.taxInclusive = false;
    }
    try {
      const config$ = await this.configService.getConfiguration("tax");
      const response = await firstValueFrom(config$);
      this.taxRate = response.value || 0;
      
      // Recalculate tax if cart exists and tax is enabled
      if (this.cart && this.taxEnabled) {
        this.recalculateTax();
        // Update cart tracking and save after recalculation
        this.updateCartTracking();
        this.saveToLocalStorage();
      }
    } catch (error) {
      console.error('Error loading tax rate:', error);
      this.taxRate = 0;
    }
  }

  get displayTaxRate(): number {
    return this.taxRate * 100; // Convert to percentage for display (e.g., 0.2 -> 20)
  }

  recalculateTax() {
    if (!this.cart) {
      return;
    }
    
    // If tax is disabled or the customer is tax-exempt, set tax to 0 and recalculate total
    if (!this.taxEnabled || this.isCustomerTaxExempt()) {
      this.cart.taxAmount = 0;
      const taxableAmount = (this.cart.subtotal || 0) - (this.cart.discountAmount || 0);
      this.cart.totalAmount = taxableAmount + this.cartNonTaxableExtras(this.cart);
      return;
    }
    
    // If tax is enabled but tax rate is not loaded yet, set tax to 0 temporarily
    if (this.taxRate <= 0) {
      this.cart.taxAmount = 0;
      const taxableAmount = (this.cart.subtotal || 0) - (this.cart.discountAmount || 0);
      this.cart.totalAmount = taxableAmount + this.cartNonTaxableExtras(this.cart);
      console.warn('Tax rate not loaded yet, tax amount set to 0 temporarily. Will recalculate when tax rate is available.');
      return;
    }
    
    // Calculate taxable amount (subtotal - discount)
    const taxableAmount = (this.cart.subtotal || 0) - (this.cart.discountAmount || 0);

    // Calculate tax amount (extracted in TTC mode, added on top otherwise)
    this.cart.taxAmount = this.computeClientTax(taxableAmount);
    this.recalculateCartTotalFromParts(this.cart);
  }

  async toggleTax() {
    if (!this.cart) return;
    this.cartSaving = true;
    
    const preservedTransportAmount = this.cart.transportAmount || 0;
    const preservedAdditionalCharges = this.cart.additionalChargesAmount || 0;
    
    try {
      const updated$ = await this.posService.toggleTax(this.cart.cartId, this.taxEnabled);
      const updatedCart = await firstValueFrom(updated$);
      
      // Normalize cart to recalculate totals (this will also sync discount/tax values)
      this.cart = this.normalizeCartItems(updatedCart);
      
      if (this.cart.transportAmount === 0 && preservedTransportAmount > 0) {
        this.cart.transportAmount = preservedTransportAmount;
      }
      if (this.cart.additionalChargesAmount === 0 && preservedAdditionalCharges > 0) {
        this.cart.additionalChargesAmount = preservedAdditionalCharges;
      }
      
      // Recalculate tax using the tax rate from configuration
      // This handles both enabling (recalculate with tax) and disabling (set tax to 0)
      if (this.taxEnabled && this.taxRate > 0) {
        this.recalculateTax();
        // Update cart on backend with recalculated tax
        if (this.cart.taxAmount !== updatedCart.taxAmount) {
          // The backend should handle tax calculation, but we can verify it matches
          console.log('Tax amount calculated:', this.cart.taxAmount, 'Backend tax amount:', updatedCart.taxAmount);
        }
      } else {
        // Tax is disabled, ensure tax amount is 0 and recalculate total
        if (this.cart) {
          this.cart.taxAmount = 0;
          const taxableAmount = (this.cart.subtotal || 0) - (this.cart.discountAmount || 0);
          this.cart.totalAmount = taxableAmount + this.cartNonTaxableExtras(this.cart);
        }
      }
      
      this.transportAmount = this.cart.transportAmount || 0;
      this.additionalChargesAmount = this.cart.additionalChargesAmount || 0;
      
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error toggling tax:', error);
      // Revert the switch state on error
      this.taxEnabled = !this.taxEnabled;
      if (this.cart) {
        this.cart.taxEnabled = this.taxEnabled;
      }
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000
      });
    } finally {
      this.cartSaving = false;
    }
  }

  async onCustomerChange(customerId: number | null) {
    if (!this.cart) return;
    
    // Update selectedCustomer property
    if (customerId) {
      this.selectedCustomer = this.customers.find(c => c.customerId === customerId) || null;
    } else {
      this.selectedCustomer = null;
    }
    
    // Update available payment methods based on customer
    this.updateAvailablePaymentMethods();
    
    this.cartSaving = true;
    try {
      const updated$ = await this.posService.setCustomer(this.cart.cartId, customerId ?? undefined);
      const updatedCart = await firstValueFrom(updated$);
      // Normalize cart to ensure totals are correct
      this.cart = this.normalizeCartItems(updatedCart);
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error setting customer on cart:', error);
    } finally {
      this.cartSaving = false;
    }
  }

  // async onCustomerChange(customerId: number | null) {
  //   if (!this.cart) return;
  //   this.cartSaving = true;
  //   try {
  //     const updated$ = await this.posService.setCustomer(this.cart.cartId, customerId ?? undefined);
  //     this.cart = await firstValueFrom(updated$);
  //     this.updateCartTracking();
  //   } catch (error) {
  //     console.error('Error setting customer on cart:', error);
  //   } finally {
  //     this.cartSaving = false;
  //   }
  // }

  async clearCart() {
    if (!this.session) return;
    this.cartSaving = true;
    try {
      // Cancel current active cart first so backend does not keep returning it as active.
      if (this.cart?.cartId) {
        try {
          await firstValueFrom(await this.posService.cancelCart(this.cart.cartId));
        } catch (cancelError) {
          console.error('Error cancelling current cart before reset:', cancelError);
        }
      }

      const newCart$ = await this.posService.createCart(this.session.sessionId);
      const newCart = await firstValueFrom(newCart$);
      // Normalize cart to ensure totals are correct
      this.cart = this.normalizeCartItems(newCart);
      if (this.cart && !this.cart.customerId && !this.selectedCustomer?.customerId) {
        this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
        this.updateAvailablePaymentMethods();
      }
      this.orderNotes = '';
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error clearing cart:', error);
      // Fallback: guarantee UI/cart reset even if backend call fails.
      this.cart = null;
      this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
      this.orderNotes = '';
      this.updateAvailablePaymentMethods();
      this.updateCartTracking();
      this.saveToLocalStorage();
    } finally {
      this.cartSaving = false;
    }
  }

  // ========== Hold / resume ==========

  async openHoldCarts() {
    // Only admins must pick a shop first; for non-admins the backend resolves
    // the shop from the JWT (getShopIdForApi() returns undefined).
    if (this.isAdmin && !this.shopId) return;
    try {
      const holds$ = await this.posService.getHoldCarts(this.getShopIdForApi());
      const carts = await firstValueFrom(holds$);
      // Normalize all hold carts
      this.holdCarts = Array.isArray(carts) ? carts.map(cart => this.normalizeCartItems(cart)) : [];
      this.holdCartsDialog = true;
    } catch (error) {
      console.error('Error loading hold carts:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_hold_carts'),
        life: 3000
      });
    }
  }

  async holdCurrentCart() {
    if (!this.cart) return;
    if (!this.cart.items || this.cart.items.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_products_selected'),
        life: 3000
      });
      return;
    }
    this.cartSaving = true;
    try {
      await firstValueFrom(await this.posService.holdCart(this.cart.cartId));
      const newCart$ = await this.posService.createCart(this.session.sessionId);
      this.cart = await firstValueFrom(newCart$);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('cart_held_success'),
        life: 2000
      });
    } catch (error) {
      console.error('Error holding cart:', error);
    } finally {
      this.cartSaving = false;
    }
  }

  async resumeCart(cart: POSCartDTO) {
    if (!cart || !cart.cartId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Invalid cart data',
        life: 3000
      });
      return;
    }

    // Check if there's an active cart (backend requires no active cart to resume)
    // We need to handle both carts with items and empty carts
    if (this.cart && this.cart.cartId) {
      const hasItems = this.cart.items && this.cart.items.length > 0;
      
      // Show confirmation dialog instead of browser alert
      this.confirmResumeMessage = hasItems 
        ? this.translate.instant('active_cart_exists') + '<br>' + this.translate.instant('hold_current_cart_and_resume')
        : this.translate.instant('active_cart_exists') + '<br>' + this.translate.instant('clear_current_cart_and_resume');
      
      this.confirmResumeCallback = () => this.proceedWithResume(cart, hasItems);
      this.confirmResumeDialog = true;
      return;
    }
    
    // No active cart, proceed directly
    this.proceedWithResume(cart, false);
  }

  private async proceedWithResume(cart: POSCartDTO, hasItems: boolean) {
    this.confirmResumeDialog = false;
    
    // Hold or cancel the current cart first
    if (this.cart && this.cart.cartId) {
      this.cartSaving = true;
      try {
        if (hasItems) {
          // Hold the cart if it has items
          await firstValueFrom(await this.posService.holdCart(this.cart.cartId));
        } else {
          // Cancel the cart if it's empty (if cancel endpoint exists)
          // Otherwise, just try to hold it anyway
          try {
            await firstValueFrom(await this.posService.cancelCart(this.cart.cartId));
          } catch {
            // If cancel doesn't work, try hold
            await firstValueFrom(await this.posService.holdCart(this.cart.cartId));
          }
        }
        
        // Small delay to ensure backend has processed the hold/cancel
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Don't create a new cart - we want no active cart before resuming
        // The resume operation will create/activate the held cart
      } catch (error) {
        console.error('Error holding/canceling current cart:', error);
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('error_holding_current_cart'),
          life: 3000
        });
        this.cartSaving = false;
        return;
      }
    }

    // Now resume the selected cart
    this.cartSaving = true;
    try {
      const resumed$ = await this.posService.resumeCart(cart.cartId);
      const resumedCart = await firstValueFrom(resumed$);
      console.log('Resumed cart from backend:', resumedCart);
      
      // Normalize the cart to ensure totals are calculated
      this.cart = this.normalizeCartItems(resumedCart);
      
      // Ensure items array is initialized
      if (this.cart && !this.cart.items) {
        this.cart.items = [];
      }
      
      // Log cart totals after normalization
      console.log('Cart after normalization:', {
        cartId: this.cart?.cartId,
        itemsCount: this.cart?.items?.length || 0,
        subtotal: this.cart?.subtotal,
        discountAmount: this.cart?.discountAmount,
        taxAmount: this.cart?.taxAmount,
        totalAmount: this.cart?.totalAmount,
        items: this.cart?.items
      });
      
      // Refresh cart from backend to ensure we have the latest totals
      // This is important because the backend might have different calculations
      if (this.cart && this.cart.cartId && this.session) {
        try {
          const refreshedCart$ = await this.posService.getCart(this.cart.cartId);
          const refreshedCart = await firstValueFrom(refreshedCart$);
          console.log('Refreshed cart from backend:', refreshedCart);
          this.cart = this.normalizeCartItems(refreshedCart);
          
          // Log refreshed totals
          console.log('Cart after refresh:', {
            cartId: this.cart?.cartId,
            itemsCount: this.cart?.items?.length || 0,
            subtotal: this.cart?.subtotal,
            discountAmount: this.cart?.discountAmount,
            taxAmount: this.cart?.taxAmount,
            totalAmount: this.cart?.totalAmount
          });
        } catch (refreshError) {
          console.warn('Could not refresh cart after resume, using normalized cart:', refreshError);
          // Continue with normalized cart if refresh fails
        }
      }
      
      // Update selected customer if cart has a customer
      if (this.cart && this.cart.customerId) {
        // Try to find customer in the list
        const customer = this.customers.find(c => c.customerId === this.cart!.customerId);
        if (customer) {
          this.selectedCustomer = {
            ...customer,
            fullName: customer.fullName || `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
          };
        }
      } else {
        this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
      }
      
      // Update available payment methods based on customer
      this.updateAvailablePaymentMethods();
      
      // Reload hold carts list to reflect changes
      if (this.shopId) {
        try {
          const holds$ = await this.posService.getHoldCarts(this.getShopIdForApi());
          const carts = await firstValueFrom(holds$);
          this.holdCarts = Array.isArray(carts) ? carts.map(c => this.normalizeCartItems(c)) : [];
        } catch (error) {
          console.error('Error reloading hold carts:', error);
        }
      }
      
      this.holdCartsDialog = false;
      this.updateCartTracking();
      this.saveToLocalStorage();
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('cart_resumed_success'),
        life: 2000
      });

      if (resumedCart?.reservationConflictDetected) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: resumedCart.reservationConflictMessage || 'Some items are no longer available in requested quantity. Please adjust the cart to continue.',
          life: 6000
        });
      }
    } catch (error: any) {
      console.error('Error resuming cart:', error);
      const errorMsg = error?.error?.message || error?.message || this.translate.instant('error_resuming_cart');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    } finally {
      this.cartSaving = false;
    }
  }

  viewHoldCart(cart: POSCartDTO) {
    // Show read-only view of the cart
    this.viewedCart = this.normalizeCartItems(cart);
    this.viewCartDialog = true;
  }

  /**
   * Abandon a held sale: releases soft reservations and unblocks session close when stock issues prevent resume.
   */
  async cancelHeldCart(cart: POSCartDTO) {
    if (!cart?.cartId) {
      return;
    }
    const ok = confirm(this.translate.instant('cancel_hold_cart_confirm'));
    if (!ok) {
      return;
    }
    this.cartSaving = true;
    try {
      await firstValueFrom(await this.posService.cancelCart(cart.cartId));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('hold_cart_cancelled'),
        life: 3000
      });
      if (this.shopId) {
        const holds$ = await this.posService.getHoldCarts(this.getShopIdForApi());
        const carts = await firstValueFrom(holds$);
        this.holdCarts = Array.isArray(carts) ? carts.map(c => this.normalizeCartItems(c)) : [];
      }
      if (!this.holdCarts.length) {
        this.holdCartsDialog = false;
      }
    } catch (error: any) {
      console.error('Error cancelling held cart:', error);
      const msg = error?.error?.message || error?.message || this.translate.instant('error_occurred');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 4000
      });
    } finally {
      this.cartSaving = false;
    }
  }

  trackByCartId(index: number, cart: POSCartDTO): any {
    return cart.cartId;
  }

  // ========== Checkout ==========

  async openCheckout() {
    if (!this.session) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_open_session_first'),
        life: 3000
      });
      this.showOpenSessionDialog();
      return;
    }
    if (!this.cart || !this.cart.items || this.cart.items.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_products_selected'),
        life: 3000
      });
      return;
    }
    
    await this.flushSummaryFieldSync();
    this.syncDiscountAndTaxFromCart();
    
    // Reset checkout-specific fields
    // Use the selected payment method from the quick panel radio buttons as default
    // Fall back to Cash if the selected method is not available (e.g., Credit for walk-in)
    let defaultMethod: PaymentMethod = this.selectedPaymentMethod || 'Cash';
    if (!this.availablePaymentMethods.includes(defaultMethod)) {
      defaultMethod = 'Cash';
    }
    
    this.checkoutPayments = [{
      method: defaultMethod,
      amount: this.cart.totalAmount
    }];
    this.checkoutNotes = '';
    this.printReceipt = true;
    
    // Reset all caches (availablePaymentMethods is now computed on demand, no cache needed)
    this._isCreditPaymentCache = null;
    this._lastPaymentMethodsHash = '';
    this._isPaymentValidCache = null;
    this._lastPaymentValidationHash = '';
    
    // Open dialog first to avoid blocking
    this.checkoutDialog = true;

    if (this.needsBankAccount(defaultMethod)) {
      await this.prepareBankPaymentContext(this.checkoutPayments[0]);
    }

    // Admins need accounts in the dropdown even when the user never changed the method control
    if (this.canReadBankAccounts && this.needsBankAccount(defaultMethod) && this.bankAccounts.length === 0) {
      void this.loadBankAccounts();
    }
    
    // Load credit info asynchronously if customer is selected (don't block dialog opening)
    if (this.selectedCustomer?.customerId && !this.isWalkInCustomer(this.selectedCustomer)) {
      // Use setTimeout to load credit info after dialog is rendered
      setTimeout(() => {
        this.loadCreditInfo(this.selectedCustomer.customerId);
      }, 0);
    } else {
      this.creditInfo = null;
    }
  }

  syncDiscountAndTaxFromCart() {
    if (!this.cart) {
      // Reset values if no cart
      this.discountAmount = 0;
      this.discountType = 'Amount';
      this.taxEnabled = false;
      return;
    }
    
    // Sync discount type from cart
    this.discountType = this.cart.discountType || 'Amount';
    
    // Sync discount amount from cart
    // If discount type is Percentage, calculate the percentage value from discountAmount and subtotal
    // Otherwise, use the discount amount directly
    if (this.discountType === 'Percentage' && this.cart.subtotal > 0 && this.cart.discountAmount > 0) {
      // Calculate percentage: (discountAmount / subtotal) * 100
      this.discountAmount = Math.round((this.cart.discountAmount / this.cart.subtotal) * 100 * 100) / 100;
    } else {
      // For Amount type, use discountAmount directly
      this.discountAmount = this.cart.discountAmount || 0;
    }
    
    this.transportAmount = this.cart.transportAmount || 0;
    this.additionalChargesAmount = this.cart.additionalChargesAmount || 0;
    
    // Sync tax enabled state from cart
    const previousTaxEnabled = this.taxEnabled;
    this.taxEnabled = this.cart.taxEnabled || false;
    
    // If tax is enabled and we have a tax rate, recalculate tax to ensure consistency
    // This handles cases where cart was loaded before tax rate was available
    if (this.taxEnabled && this.taxRate > 0) {
      this.recalculateTax();
    } else if (this.taxEnabled && this.taxRate <= 0) {
      // Tax is enabled but rate not loaded yet - will be recalculated when rate loads
      console.log('Tax enabled but rate not loaded yet, will recalculate when rate is available');
    } else if (!this.taxEnabled && previousTaxEnabled) {
      // Tax was just disabled, ensure tax amount is 0
      this.recalculateTax();
    }
    
    // Note: orderNotes is not synced from cart.notes here because:
    // - orderNotes is for UI editing (not saved to cart until checkout)
    // - cart.notes might be from a previous transaction
    // - orderNotes should be reset when creating a new cart, not when loading an existing one
  }

  get totalPaid(): number {
    return this.checkoutPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  get remainingToPay(): number {
    if (!this.cart) return 0;
    const remaining = (this.cart.totalAmount || 0) - this.totalPaid;
    return remaining > 0 ? remaining : 0;
  }

  get changeAmount(): number {
    if (!this.cart) return 0;
    const change = this.totalPaid - (this.cart.totalAmount || 0);
    return change > 0 ? change : 0;
  }

  // Cache for payment validation to avoid repeated calculations
  private _isPaymentValidCache: boolean | null = null;
  private _lastPaymentValidationHash: string = '';
  
  get isPaymentValid(): boolean {
    if (!this.cart || !this.checkoutPayments || this.checkoutPayments.length === 0) {
      this._isPaymentValidCache = false;
      return false;
    }
    
    // Create hash of relevant state for caching
    const total = this.cart.totalAmount || 0;
    const paid = this.totalPaid;
    const paymentMethodsHash = this.checkoutPayments.map(p => `${p.method}:${p.amount}`).join(',');
    const creditInfoHash = this.creditInfo ? `${this.creditInfo.availableCreditLimit}` : 'null';
    const currentHash = `${total}:${paid}:${paymentMethodsHash}:${creditInfoHash}`;
    
    // Return cached value if state hasn't changed
    if (currentHash === this._lastPaymentValidationHash && this._isPaymentValidCache !== null) {
      return this._isPaymentValidCache;
    }
    
    // Calculate validation
    let isValid = false;
    
    // For Credit payment, validation is different
    if (this.isCreditPayment()) {
      // Credit payment is valid if customer is selected and not walk-in
      if (!this.isCreditAvailable()) {
        isValid = false;
      } else if (this.creditInfoLoading) {
        // Credit info is loading - allow checkout (will be validated in completeCheckout)
        isValid = true;
      } else if (!this.creditInfo) {
        // Credit info not loaded yet - allow checkout if customer is valid (backend will handle)
        isValid = true;
      } else {
        const orderAmount = this.cart?.totalAmount || 0;
        if (this.isUnlimitedCreditLimit()) {
          isValid = true;
        } else {
          const availableCredit = this.availableCreditLimit || 0;
          isValid = orderAmount <= availableCredit;
        }
      }
    } else {
      // Regular payment validation
      isValid = Math.abs(total - paid) < 0.01 && paid > 0;
    }
    
    // Cache the result
    this._isPaymentValidCache = isValid;
    this._lastPaymentValidationHash = currentHash;
    
    return isValid;
  }

  addPaymentLine() {
    const remaining = this.remainingToPay;
    this.checkoutPayments.push({
      method: 'Cash',
      amount: remaining > 0 ? remaining : 0
    });
    // Reset caches when payment line is added
    this._isCreditPaymentCache = null;
    this._lastPaymentMethodsHash = '';
    this._isPaymentValidCache = null;
    this._lastPaymentValidationHash = '';
  }

  removePaymentLine(index: number) {
    if (this.checkoutPayments.length === 1) {
      return;
    }
    this.checkoutPayments.splice(index, 1);
    // Reset caches when payment line is removed
    this._isCreditPaymentCache = null;
    this._lastPaymentMethodsHash = '';
    this._isPaymentValidCache = null;
    this._lastPaymentValidationHash = '';
  }

  async onPaymentMethodChange(payment: PaymentInfo, index: number) {
    // Prevent re-entry to avoid infinite loops
    if (this.isProcessingPaymentChange) {
      return;
    }
    
    this.isProcessingPaymentChange = true;
    
    // Reset all caches when payment method changes
    this._isCreditPaymentCache = null;
    this._lastPaymentMethodsHash = '';
    this._isPaymentValidCache = null;
    this._lastPaymentValidationHash = '';
    
    try {
      // Clear optional fields when method changes
      payment.bankAccountId = undefined;
      payment.checkNumber = undefined;
      payment.transactionReference = undefined;
      
      // Handle Credit payment method
      if (payment.method === 'Credit') {
        // Validate walk-in customer first (before making any changes)
        if (!this.selectedCustomer?.customerId || this.isWalkInCustomer(this.selectedCustomer)) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('credit_not_allowed_walk_in'),
            life: 5000
          });
          // Revert to Cash - use setTimeout to avoid change detection loop
          setTimeout(() => {
            payment.method = 'Cash';
            payment.amount = this.cart?.totalAmount || 0;
            this.isProcessingPaymentChange = false;
          }, 0);
          return;
        }
        
        // Credit must be the only payment method - use setTimeout to avoid change detection loop
        if (this.checkoutPayments.length > 1) {
          setTimeout(() => {
            // Create a new payment object to avoid reference issues
            const creditPayment: PaymentInfo = {
              method: 'Credit',
              amount: this.cart?.totalAmount || 0
            };
            this.checkoutPayments = [creditPayment];
            this.isProcessingPaymentChange = false;
          }, 0);
          return;
        }
        
        // Set amount to cart total
        payment.amount = this.cart?.totalAmount || 0;
        
        // Ensure cart has customerId set when Credit is selected
        if (this.cart && this.selectedCustomer?.customerId && this.cart.customerId !== this.selectedCustomer.customerId) {
          try {
            const updated$ = await this.posService.setCustomer(this.cart.cartId, this.selectedCustomer.customerId);
            const updatedCart = await firstValueFrom(updated$);
            this.cart = this.normalizeCartItems(updatedCart);
          } catch (error) {
            console.error('Error setting customer on cart:', error);
            // Don't block - continue anyway
          }
        }
        
        // Load credit info if not already loaded or loading
        if (!this.creditInfo && !this.creditInfoLoading && this.selectedCustomer?.customerId) {
          this.loadCreditInfo(this.selectedCustomer.customerId);
        }
      }
      
      if (this.needsBankAccount(payment.method)) {
        await this.prepareBankPaymentContext(payment);
      }

      // Load bank accounts for admins if needed for Transfer/Check/BOE
      if (this.canReadBankAccounts && this.needsBankAccount(payment.method) && this.bankAccounts.length === 0) {
        await this.loadBankAccounts();
      }

      if (!this.checkoutPayments.some(p => this.needsBankAccount(p.method))) {
        this.bankAccountNoticeKey = null;
      }
    } finally {
      // Reset guard after a short delay to allow change detection to complete
      setTimeout(() => {
        this.isProcessingPaymentChange = false;
      }, 100);
    }
  }

  needsBankAccount(method: PaymentMethod): boolean {
    return ['Transfer', 'Check', 'BOE'].includes(method);
  }

  shouldShowBankAccountSelector(method: PaymentMethod): boolean {
    return this.canReadBankAccounts && this.needsBankAccount(method);
  }

  private async prepareBankPaymentContext(payment: PaymentInfo): Promise<boolean> {
    if (!payment || !this.needsBankAccount(payment.method)) {
      if (payment) {
        payment.bankAccountId = undefined;
      }
      this.bankAccountNoticeKey = null;
      return true;
    }

    if (!this.canReadBankAccounts && !payment.bankAccountId) {
      payment.bankAccountId = this.getPosShopDefaultBankAccountId();
    }

    if (!this.canReadBankAccounts) {
      if (payment.bankAccountId) {
        this.bankAccountNoticeSeverity = 'info';
        this.bankAccountNoticeKey = 'shop_default_bank_account_will_be_used';
      } else {
        this.bankAccountNoticeSeverity = 'warn';
        this.bankAccountNoticeKey = 'no_default_bank_account_assigned_to_shop';
      }
    } else {
      this.bankAccountNoticeKey = null;
    }

    const requireAccount = await this.paymentValidationService.isBankAccountRequired(payment.method);
    if (requireAccount && !payment.bankAccountId && !this.canReadBankAccounts) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_default_bank_account_assigned_to_shop'),
        life: 4000
      });
      return false;
    }

    return true;
  }

  private getPosShopDefaultBankAccountId(): number | undefined {
    const shop = this.resolvePosPaymentShop();
    const raw = shop?.defaultBankAccount?.accountId ?? shop?.defaultBankAccountId;
    const id = this.toPositiveNumber(raw);
    return id;
  }

  private resolvePosPaymentShop(): any | undefined {
    const currentShopId = this.toPositiveNumber(this.shopId);
    if (currentShopId != null) {
      const latest = this.shops.find(shop => this.toPositiveNumber(shop.shopId) === currentShopId);
      if (latest) {
        return latest;
      }
    }

    if (!this.isAdmin) {
      const userShopId = this.getCurrentUserShopIdFromToken();
      const tokenShop = userShopId != null
        ? this.shops.find(shop => this.toPositiveNumber(shop.shopId) === userShopId)
        : undefined;
      if (tokenShop) {
        return tokenShop;
      }
    }

    if (Array.isArray(this.shops) && this.shops.length === 1) {
      return this.shops[0];
    }

    return undefined;
  }

  private getCurrentUserShopIdFromToken(): number | undefined {
    const tokenParsed = this.keycloakService.getKeycloakInstance()?.tokenParsed as any;
    for (const key of ['shop', 'shopId', 'shop_id']) {
      const value = this.readTokenClaimValue(tokenParsed, key);
      const id = this.toPositiveNumber(value);
      if (id != null) {
        return id;
      }
    }
    return undefined;
  }

  private readTokenClaimValue(source: any, key: string): any {
    if (!source) {
      return undefined;
    }
    const direct = source[key];
    if (direct != null) {
      return Array.isArray(direct) ? direct[0] : direct;
    }
    for (const container of ['attributes', 'user_attributes']) {
      const nested = source[container];
      const nestedValue = nested?.[key];
      if (nestedValue != null) {
        return Array.isArray(nestedValue) ? nestedValue[0] : nestedValue;
      }
    }
    return undefined;
  }

  private toPositiveNumber(value: any): number | undefined {
    if (value == null || String(value).trim() === '') {
      return undefined;
    }
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
  }

  needsCheckNumber(method: PaymentMethod): boolean {
    return method === 'Check';
  }

  needsTransactionReference(method: PaymentMethod): boolean {
    return method === 'Transfer';
  }

  async loadBankAccounts(): Promise<void> {
    if (!this.canReadBankAccounts) {
      this.bankAccounts = [];
      return;
    }
    if (this.bankAccounts.length > 0) {
      return;
    }
    try {
      const accounts$ = await this.bankAccountService.getBankAccounts(true);
      const accounts = await firstValueFrom(accounts$);
      this.bankAccounts = Array.isArray(accounts) ? accounts : [];
      if (this.bankAccounts.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: 'No active bank accounts found. Configure accounts under Finance → Banking.',
          life: 6000,
        });
      }
    } catch (err) {
      console.error('POS: failed to load bank accounts', err);
      this.bankAccounts = [];
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: 'Could not load bank accounts. Check your connection and try again.',
        life: 6000,
      });
    } finally {
      this.cdr.markForCheck();
    }
  }

  // Use shared payment utility functions
  getPaymentMethodIcon(method: PaymentMethod): string {
    return getSharedPaymentMethodIcon(method);
  }

  getPaymentMethodLabel(method: PaymentMethod): string {
    return getSharedPaymentMethodLabel(method);
  }

  async completeCheckout() {
    if (!this.cart) return;

    if (this.checkoutPayments.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('at_least_one_product_required'),
        life: 3000
      });
      return;
    }

    // Refresh cart from backend before checkout to ensure we have the latest totals
    // This is critical for resumed carts to avoid payment mismatch errors
    // Preserve transport amount before refreshing (backend might not return it)
    const preservedTransportAmount = this.transportAmount || this.cart?.transportAmount || 0;
    const preservedAdditionalCharges = this.additionalChargesAmount || this.cart?.additionalChargesAmount || 0;
    
    if (this.cart && this.cart.cartId) {
      try {
        console.log('Refreshing cart before checkout:', this.cart.cartId);
        const refreshedCart$ = await this.posService.getCart(this.cart.cartId);
        const refreshedCart = await firstValueFrom(refreshedCart$);
        this.cart = this.normalizeCartItems(refreshedCart);
        
        if (preservedTransportAmount > 0 && (!this.cart.transportAmount || this.cart.transportAmount === 0)) {
          this.cart.transportAmount = preservedTransportAmount;
          this.transportAmount = preservedTransportAmount;
        }
        if (preservedAdditionalCharges > 0 && (!this.cart.additionalChargesAmount || this.cart.additionalChargesAmount === 0)) {
          this.cart.additionalChargesAmount = preservedAdditionalCharges;
          this.additionalChargesAmount = preservedAdditionalCharges;
        }
        
        console.log('Cart refreshed before checkout:', {
          cartId: this.cart?.cartId,
          itemsCount: this.cart?.items?.length || 0,
          subtotal: this.cart?.subtotal,
          discountAmount: this.cart?.discountAmount,
          taxAmount: this.cart?.taxAmount,
          transportAmount: this.cart?.transportAmount,
          additionalChargesAmount: this.cart?.additionalChargesAmount,
          totalAmount: this.cart?.totalAmount
        });
      } catch (refreshError) {
        console.error('Error refreshing cart before checkout:', refreshError);
        // Continue with current cart if refresh fails, but log warning
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_refreshing_cart_before_checkout'),
          life: 3000
        });
      }
    }

    // Recalculate totals to ensure they're correct (including transport amount)
    // Use preserved transport amount (already declared above)
    if (this.cart && this.cart.items && this.cart.items.length > 0) {
      const recalculatedSubtotal = this.cart.items.reduce((sum, item) => {
        return sum + computeCartItemSubtotal(item);
      }, 0);
      
      this.cart.subtotal = recalculatedSubtotal;
      
      // Ensure transport amount is set (use preserved value if cart doesn't have it)
      if (!this.cart.transportAmount && preservedTransportAmount > 0) {
        this.cart.transportAmount = preservedTransportAmount;
        this.transportAmount = preservedTransportAmount;
      }
      if (!this.cart.additionalChargesAmount && preservedAdditionalCharges > 0) {
        this.cart.additionalChargesAmount = preservedAdditionalCharges;
        this.additionalChargesAmount = preservedAdditionalCharges;
      }
      
      this.recalculateCartTotalFromParts(this.cart);
      
      console.log('Recalculated cart totals:', {
        subtotal: this.cart.subtotal,
        discountAmount: this.cart.discountAmount,
        taxAmount: this.cart.taxAmount,
        transportAmount: this.cart.transportAmount,
        additionalChargesAmount: this.cart.additionalChargesAmount,
        totalAmount: this.cart.totalAmount
      });
    }

    const finalTransportAmount = this.cart?.transportAmount || this.transportAmount || 0;
    const finalAdditionalCharges = this.cart?.additionalChargesAmount || this.additionalChargesAmount || 0;
    const subtotal = this.cart?.subtotal || 0;
    const discountAmount = this.cart?.discountAmount || 0;
    const taxAmount = this.cart?.taxAmount || 0;
    const calculatedTotal = subtotal - discountAmount + taxAmount + finalTransportAmount + finalAdditionalCharges;
    
    // Use the calculated total (which includes transport) for validation
    const total = calculatedTotal > 0 ? calculatedTotal : (this.cart?.totalAmount || 0);
    const paid = this.totalPaid;

    console.log('Checkout validation:', {
      subtotal: subtotal,
      discountAmount: discountAmount,
      taxAmount: taxAmount,
      transportAmount: finalTransportAmount,
      additionalChargesAmount: finalAdditionalCharges,
      calculatedTotal: calculatedTotal,
      cartTotal: this.cart?.totalAmount,
      totalUsed: total,
      totalPaid: paid,
      difference: Math.abs(total - paid)
    });

    if (total <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('cart_total_is_zero_cannot_checkout'),
        life: 4000
      });
      return;
    }

    // Validate credit limit if using Credit payment
    const isCredit = this.isCreditPayment();
    if (isCredit) {
      // Ensure customer is selected and not walk-in
      if (!this.selectedCustomer?.customerId || this.isWalkInCustomer(this.selectedCustomer)) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('credit_not_allowed_walk_in'),
          life: 5000
        });
        return;
      }
      
      // Ensure cart has customerId set (try to update, but don't block if it fails)
      if (!this.cart.customerId && this.selectedCustomer?.customerId) {
        // Update cart customerId before checkout
        try {
          const updated$ = await this.posService.setCustomer(this.cart.cartId, this.selectedCustomer.customerId);
          const updatedCart = await firstValueFrom(updated$);
          this.cart = this.normalizeCartItems(updatedCart);
        } catch (error) {
          console.warn('Could not update cart customerId before checkout, will use selectedCustomer:', error);
          // Don't block checkout - we'll use selectedCustomer.customerId in checkoutDto
        }
      }
      
      // If credit info is still loading, wait a bit for it to complete (max 2 seconds)
      if (this.creditInfoLoading) {
        let waitCount = 0;
        while (this.creditInfoLoading && waitCount < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
      }
      
      // Validate credit limit if credit info is available (optional - backend will also validate)
      if (this.creditInfo) {
        const creditValidation = this.validateCreditLimit();
        if (!creditValidation.valid) {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: creditValidation.error || this.translate.instant('credit_limit_exceeded_message'),
            life: 6000
          });
          return;
        }
      }
      // If credit info is not available, proceed anyway - backend will handle validation
    }

    // For Credit payment, skip amount validation (backend handles it)
    if (!isCredit) {
      if (paid <= 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('valid_amount_required'),
          life: 3000
        });
        return;
      }

      const diff = Math.abs(total - paid);
      if (diff > 0.01) {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('payment_amount_mismatch', { 
            cartTotal: total.toFixed(2), 
            paidAmount: paid.toFixed(2),
            difference: diff.toFixed(2)
          }),
          life: 5000
        });
        return;
      }
    }

    for (const payment of this.checkoutPayments) {
      const bankContextReady = await this.prepareBankPaymentContext(payment);
      if (!bankContextReady) {
        return;
      }
    }

    // Check if offline
    const isOffline = !this.isOnline || this.onlineStatus === 'offline';

    // Clean up payment objects - only include relevant optional fields
    // For Credit payment, send empty array or Credit payment with amount
    let cleanedPayments: PaymentInfo[];
    
    if (this.isCreditPayment()) {
      // Credit payment: send Credit payment with amount
      cleanedPayments = [{
        method: 'Credit',
        amount: this.cart?.totalAmount || 0
      }];
    } else {
      cleanedPayments = this.checkoutPayments.map(payment => {
        const cleaned: PaymentInfo = {
          method: payment.method,
          amount: payment.amount
        };
        
        // Add optional fields only if they exist and are relevant
        if (this.needsBankAccount(payment.method) && payment.bankAccountId) {
          cleaned.bankAccountId = payment.bankAccountId;
        }
        if (this.needsCheckNumber(payment.method) && payment.checkNumber) {
          cleaned.checkNumber = payment.checkNumber;
        }
        if (this.needsTransactionReference(payment.method) && payment.transactionReference) {
          cleaned.transactionReference = payment.transactionReference;
        }
        
        return cleaned;
      });
    }

    // Ensure customerId is set for Credit payments
    let finalCustomerId = this.cart.customerId;
    if (isCredit && !finalCustomerId && this.selectedCustomer?.customerId) {
      finalCustomerId = this.selectedCustomer.customerId;
    }
    
    const checkoutDto: POSCheckoutDTO = {
      cartId: this.cart.cartId,
      customerId: finalCustomerId,
      transportAmount: finalTransportAmount,
      additionalChargesAmount: finalAdditionalCharges,
      payments: cleanedPayments,
      notes: this.checkoutNotes,
      printReceipt: this.printReceipt
    };
    
    console.log('Checkout DTO:', {
      cartId: checkoutDto.cartId,
      customerId: checkoutDto.customerId,
      selectedCustomerId: this.selectedCustomer?.customerId,
      cartCustomerId: this.cart.customerId,
      isCredit: isCredit,
      payments: checkoutDto.payments
    });

    this.cartSaving = true;
    try {
      if (this.isOnline) {
        // Online checkout
        const receipt$ = await this.posService.checkout(this.cart.cartId, checkoutDto);
        this.lastReceipt = await firstValueFrom(receipt$);
        this.checkoutDialog = false;
        this.receiptDialog = true;

        // Do NOT auto-open the print window. Printing happens only when the user clicks
        // the print button in the receipt dialog (see printReceiptDialog()).

        if (this.session) {
          const newCart$ = await this.posService.createCart(this.session.sessionId);
          const newCart = await firstValueFrom(newCart$);
          // Normalize cart to ensure totals are correct (this will sync discount/tax values)
          this.cart = this.normalizeCartItems(newCart);
          // Reset order notes for new cart
          this.orderNotes = '';
          this.updateCartTracking();
          this.saveToLocalStorage();
        }

        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('payment_received'),
          life: 3000
        });
      } else {
        // Offline checkout - save as pending sale
        const pendingSale: PendingSale = {
          localSaleId: `LOCAL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          cart: { ...this.cart } as POSCartDTO,
          checkoutDto: checkoutDto,
          timestamp: new Date().toISOString(),
          synced: false
        };
        this.posStorage.savePendingSale(pendingSale);
        this.updatePendingSalesCount();
        
        this.checkoutDialog = false;
        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('info'),
          detail: this.translate.instant('sale_saved_offline'),
          life: 4000
        });
        
        // Create new cart (only if online)
        if (this.session && this.isOnline) {
          try {
            const newCart$ = await this.posService.createCart(this.session.sessionId);
            const newCart = await firstValueFrom(newCart$);
            // Normalize cart to ensure totals are correct
            this.cart = this.normalizeCartItems(newCart);
            this.updateCartTracking();
            this.saveToLocalStorage();
          } catch (error) {
            console.error('Error creating new cart:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error during checkout:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 4000
      });
    } finally {
      this.cartSaving = false;
    }
  }

  closeReceiptDialog() {
    this.receiptDialog = false;
    // Clear cart after closing receipt
    if (this.session) {
      this.ensureSessionAndCart();
    }
  }

  printReceiptDialog() {
    void this.printBackendReceiptPdf();
  }

  private async printBackendReceiptPdf(): Promise<void> {
    if (!this.lastReceipt || this.receiptPrinting) {
      return;
    }

    this.receiptPrinting = true;
    try {
      let docNumber = this.lastReceipt.receiptDocNumber;

      if (!docNumber && this.lastReceipt.primaryPaymentId) {
        const generated: any = await firstValueFrom(
          this.financialDocService.generateReceiptFromPOS(this.lastReceipt.primaryPaymentId)
        );
        docNumber = generated?.number;
        if (docNumber) {
          this.lastReceipt.receiptDocNumber = docNumber;
        }
      }

      if (!docNumber) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('receipt_pdf_not_available') || 'Receipt PDF is not available yet.',
          life: 4000
        });
        return;
      }

      const blob = await firstValueFrom(this.financialDocService.fetchFinancialDocPdf(docNumber));
      this.financialDocService.openPdfBlobInPrintWindow(blob);
    } catch (error) {
      console.error('Error printing receipt PDF:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_printing_receipt') || 'Could not print receipt.',
        life: 4000
      });
    } finally {
      this.receiptPrinting = false;
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.currency || 'USD'
    }).format(amount || 0);
  }

  // Number Pad Methods
  numpadInput(value: string): void {
    if (!this.paymentAmount) {
      this.paymentAmount = 0;
    }
    
    const currentValue = this.paymentAmount.toString();
    
    if (value === '.') {
      // Add decimal point if not already present
      if (!currentValue.includes('.')) {
        this.paymentAmount = parseFloat(currentValue + '.');
      }
    } else if (value === '00') {
      // Add two zeros
      if (currentValue.includes('.')) {
        const parts = currentValue.split('.');
        if (parts[1].length < 2) {
          this.paymentAmount = parseFloat(parts[0] + '.' + parts[1] + '00');
        }
      } else {
        this.paymentAmount = parseFloat(currentValue + '00');
      }
    } else {
      // Regular number input
      if (currentValue.includes('.')) {
        const parts = currentValue.split('.');
        if (parts[1].length < 2) {
          this.paymentAmount = parseFloat(parts[0] + '.' + parts[1] + value);
        }
      } else {
        this.paymentAmount = parseFloat(currentValue + value);
      }
    }
  }

  clearPaymentAmount(): void {
    this.paymentAmount = 0;
  }

  backspacePaymentAmount(): void {
    if (this.paymentAmount > 0) {
      const currentValue = this.paymentAmount.toString();
      if (currentValue.length > 1) {
        this.paymentAmount = parseFloat(currentValue.slice(0, -1)) || 0;
      } else {
        this.paymentAmount = 0;
      }
    }
  }

  setPaymentToTotal(): void {
    if (this.cart && this.cartTotal > 0) {
      this.paymentAmount = this.cartTotal;
    }
  }

  formatQuickAmount(amount: number): string {
    // Format with one decimal place to save space (e.g., "10.0" instead of "10.00")
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: this.currency || 'USD',
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(amount || 0);
  }

  // ========== Fullscreen API ==========
  
  setupFullscreen() {
    this.isFullscreen = this.posStorage.getFullscreenPreference();
    if (this.isFullscreen) {
      setTimeout(() => this.enterFullscreen(), 100);
    }
    
    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', this.onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', this.onFullscreenChange);
    document.addEventListener('mozfullscreenchange', this.onFullscreenChange);
    document.addEventListener('MSFullscreenChange', this.onFullscreenChange);
  }

  onFullscreenChange = () => {
    this.ngZone.run(() => {
      const isFull = !!(document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).mozFullScreenElement || 
        (document as any).msFullscreenElement);
      
      // Update state only if it changed to avoid unnecessary updates
      if (this.isFullscreen !== isFull) {
        this.isFullscreen = isFull;
        this.posStorage.saveFullscreenPreference(isFull);
        this.cdr.detectChanges();
      }
    });
  }

  async enterFullscreen() {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      } else {
        // Fallback: try to request fullscreen on the body or container
        const container = document.querySelector('.pos-container');
        if (container && (container as any).requestFullscreen) {
          await (container as any).requestFullscreen();
        }
      }
      // State will be updated by onFullscreenChange event handler
    } catch (error: any) {
      console.error('Error entering fullscreen:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: error.message || this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  async exitFullscreen() {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        await (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
      // State will be updated by onFullscreenChange event handler
    } catch (error: any) {
      console.error('Error exiting fullscreen:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: error.message || this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  toggleFullscreen() {
    // Check current state first
    const isCurrentlyFullscreen = !!(document.fullscreenElement || 
      (document as any).webkitFullscreenElement || 
      (document as any).mozFullScreenElement || 
      (document as any).msFullscreenElement);
    
    if (isCurrentlyFullscreen) {
      this.exitFullscreen();
    } else {
      this.enterFullscreen();
    }
  }

  // ========== Offline Detection ==========
  
  setupOfflineDetection() {
    // Browser online/offline events
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // API heartbeat check
    this.startHeartbeat();
    
    // Load pending sales count
    this.updatePendingSalesCount();
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      await this.checkApiConnectivity();
    }, 30000); // Check every 30 seconds
  }

  async checkApiConnectivity() {
    this.onlineStatus = 'checking';
    try {
      // Try a lightweight API call and refresh session state
      if (this.shopId) {
        await this.refreshSessionState();
        this.isOnline = true;
        this.onlineStatus = 'online';
        await this.syncPendingSales();
      }
    } catch (error) {
      this.isOnline = false;
      this.onlineStatus = 'offline';
    }
  }

  async handleOnline() {
    this.isOnline = true;
    this.onlineStatus = 'online';
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('connection_restored'),
      life: 3000
    });
    // Refresh cart from server to get fresh data
    await this.refreshCartFromServer();
    this.syncPendingSales();
  }

  /**
   * Force refresh cart from server to avoid stale cached data
   */
  async refreshCartFromServer() {
    if (!this.session || !this.isOnline) return;
    
    try {
      const activeCart$ = await this.posService.getActiveCart(this.session.sessionId);
      const freshCart = await firstValueFrom(activeCart$);
      this.assignCartFromServer(freshCart);
      if (this.cart) {
        this.taxEnabled = this.cart.taxEnabled || false;
      }
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error refreshing cart from server:', error);
      // If cart doesn't exist, create a new one
      try {
        const cart$ = await this.posService.createCart(this.session.sessionId);
        const newCart = await firstValueFrom(cart$);
        this.assignCartFromServer(newCart);
        if (this.cart) {
          this.taxEnabled = this.cart.taxEnabled || false;
        }
        this.saveToLocalStorage();
      } catch (createError) {
        console.error('Error creating new cart:', createError);
      }
    }
  }

  handleOffline() {
    this.isOnline = false;
    this.onlineStatus = 'offline';
    this.messageService.add({
      severity: 'warn',
      summary: this.translate.instant('warning'),
      detail: this.translate.instant('working_offline'),
      life: 4000
    });
  }

  updatePendingSalesCount() {
    this.pendingSalesCount = this.posStorage.getUnsyncedSales().length;
  }

  async syncPendingSales() {
    const unsynced = this.posStorage.getUnsyncedSales();
    for (const sale of unsynced) {
      try {
        const receipt$ = await this.posService.checkout(sale.cart.cartId, sale.checkoutDto);
        await firstValueFrom(receipt$);
        this.posStorage.markSaleSynced(sale.localSaleId);
        this.updatePendingSalesCount();
      } catch (error: any) {
        this.posStorage.markSaleSynced(sale.localSaleId, error?.error?.message || 'Sync failed');
      }
    }
  }

  // ========== Local Storage ==========
  
  async loadFromLocalStorage() {
    // Try to restore session and cart from local storage
    const savedSession = this.posStorage.getSession();
    const savedCart = this.posStorage.getCart();
    const savedShopId = this.posStorage.getShopId();
    const savedQuickProducts = this.posStorage.getQuickProducts();
    
    if (savedShopId) {
      this.shopId = savedShopId;
    }
    
    if (savedQuickProducts && savedQuickProducts.length > 0) {
      this.quickProducts = savedQuickProducts;
    }
    
    // Don't load cart from local storage - always fetch fresh from server to avoid stale data
    // Session and cart will be loaded from API in ensureSessionAndCart()
    // Clear any stale cart data from local storage
    if (savedCart) {
      this.posStorage.saveCart(null);
    }
  }

  saveToLocalStorage() {
    if (this.session) {
      this.posStorage.saveSession(this.session);
    }
    if (this.cart) {
      // Always normalize cart before saving to ensure calculations are correct
      const normalizedCart = this.normalizeCartItems({ ...this.cart });
      if (normalizedCart) {
        this.posStorage.saveCart(normalizedCart);
      }
    }
    if (this.shopId) {
      this.posStorage.saveShopId(this.shopId);
    }
    if (this.selectedWarehouseId) {
      this.posStorage.saveWarehouseId(this.selectedWarehouseId);
    }
    if (this.quickProducts && this.quickProducts.length > 0) {
      this.posStorage.saveQuickProducts(this.quickProducts);
    }
  }

  // ========== Lock Screen ==========
  
  setupAutoLock() {
    // Track user activity
    document.addEventListener('mousedown', () => this.updateActivity());
    document.addEventListener('keydown', () => this.updateActivity());
    document.addEventListener('touchstart', () => this.updateActivity());
    
    // Check for auto-lock every minute
    this.autoLockTimer = setInterval(() => {
      this.checkAutoLock();
    }, 60000);
  }

  updateActivity() {
    this.lastActivity = new Date();
  }

  checkAutoLock() {
    if (this.isLocked) return;
    
    const minutesSinceActivity = (new Date().getTime() - this.lastActivity.getTime()) / (1000 * 60);
    if (minutesSinceActivity >= this.autoLockMinutes) {
      this.lockPos();
    }
  }

  lockPos() {
    this.isLocked = true;
    this.lockPinInput = '';
    this.messageService.add({
      severity: 'info',
      summary: this.translate.instant('info'),
      detail: this.translate.instant('pos_locked'),
      life: 3000
    });
  }

  navigateToProfile() {
    this.router.navigate(['/profile']);
  }

  exitPos() {
    // Navigate to dashboard (main application)
    this.router.navigate(['/']);
  }

  async unlockPos() {
    if (!this.lockPinInput || this.lockPinInput.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_enter_pin'),
        life: 2000
      });
      return;
    }
    
    this.lockPinError = false; // Reset error state
    
    try {
      // Verify PIN from user profile attributes
      const profile = await this.keycloakService.loadUserProfile();
      
      // Keycloak attributes are stored as arrays, get the first element if it exists
      const storedPin = (profile.attributes as any)?.posPin?.[0] || (profile.attributes as any)?.posPin || '';
      
      // Check if PIN is required (user has PIN set)
      if (!storedPin || storedPin === '') {
        // No PIN set - allow unlock for backward compatibility
        this.isLocked = false;
        this.lockPinInput = '';
        this.lockPinError = false;
        this.updateActivity();
        this.focusBarcodeInput();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('pos_unlocked'),
          life: 2000
        });
        return;
      }
      
      // PIN is set - verify it
      const isValid = storedPin === this.lockPinInput;
      
      if (isValid) {
        this.isLocked = false;
        this.lockPinInput = '';
        this.lockPinError = false;
        this.updateActivity();
        this.focusBarcodeInput();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('pos_unlocked'),
          life: 2000
        });
      } else {
        // Invalid PIN - show error
        this.lockPinError = true;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_pin'),
          life: 4000
        });
        
        // Clear input after a short delay to allow user to see the error
        setTimeout(() => {
          this.lockPinInput = '';
          this.lockPinError = false;
        }, 1500);
      }
    } catch (error) {
      console.error('Error unlocking POS:', error);
      this.lockPinError = true;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 4000
      });
      setTimeout(() => {
        this.lockPinInput = '';
        this.lockPinError = false;
      }, 1500);
    }
  }

  // ========== Keyboard Shortcuts ==========
  
  setupKeyboardShortcuts() {
    // ESC key to exit fullscreen or close dialogs
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isFullscreen) {
          this.exitFullscreen();
        }
        if (this.checkoutDialog) {
          this.checkoutDialog = false;
        }
        if (this.receiptDialog) {
          this.receiptDialog = false;
        }
        if (this.holdCartsDialog) {
          this.holdCartsDialog = false;
        }
      }
      
      // Ctrl/Cmd + K to focus barcode input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.focusBarcodeInput();
      }
      
      // Ctrl/Cmd + S to search
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Focus search input if available
      }
    });
  }

  focusBarcodeInput() {
    setTimeout(() => {
      if (this.barcodeInputRef && this.barcodeInputRef.nativeElement) {
        this.barcodeInputRef.nativeElement.focus();
      }
    }, 100);
  }

  // ========== Cashier Switching ==========
  
  async switchCashier() {
    this.switchCashierDialog = true;
    this.switchCashierPin = '';
  }

  async confirmSwitchCashier() {
    // Switch user should logout to Keycloak login page
    this.switchCashierDialog = false;
    this.switchCashierPin = '';
    void this.sessionAuditService.logout(window.location.origin + '/webconsole');
    return;
    
    // Old implementation (commented out - was verifying PIN)
    if (!this.switchCashierPin || this.switchCashierPin.length < 4) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('invalid_pin'),
        life: 3000
      });
      return;
    }

    try {
      // TODO: Implement actual PIN verification and user lookup via backend API
      // For now, this is a placeholder that shows the dialog works
      // In production, you would:
      // 1. Call API to verify PIN and get user info
      // 2. Update the POS session with new userId/username
      // 3. Update currentCashier and session.username
      
      // Simulate verification (replace with actual API call)
      const walkInLabel = this.translate.instant('walk_in_customer');
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('info'),
        detail: 'Cashier switching functionality requires backend API implementation',
        life: 3000
      });

      // Close dialog
      this.switchCashierDialog = false;
      this.switchCashierPin = '';
      
      // TODO: When backend API is ready, implement like this:
      // const userInfo = await this.verifyCashierPin(this.switchCashierPin);
      // if (userInfo) {
      //   this.currentCashier = userInfo;
      //   if (this.session) {
      //     // Update session with new cashier
      //     await this.posService.updateSessionCashier(this.session.sessionId, userInfo.userId);
      //     this.session.username = userInfo.username;
      //     this.session.userId = userInfo.userId;
      //   }
      //   this.messageService.add({
      //     severity: 'success',
      //     summary: this.translate.instant('successful'),
      //     detail: `Switched to cashier: ${userInfo.username}`,
      //     life: 3000
      //   });
      // }
    } catch (error: any) {
      console.error('Error switching cashier:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.message || this.translate.instant('error_occurred'),
        life: 3000
      });
    }
  }

  // ========== Manager Approval ==========
  
  requestManagerApproval(reason: string, callback: () => void) {
    this.managerApprovalReason = reason;
    this.managerApprovalCallback = callback;
    this.managerApprovalDialog = true;
  }

  async confirmManagerApproval() {
    if (!this.lockPinInput || this.lockPinInput.trim() === '') {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_enter_pin'),
        life: 2000
      });
      return;
    }
    
    this.lockPinError = false; // Reset error state
    
    // Verify manager PIN from user profile attributes (same PIN as unlock)
    try {
      const profile = await this.keycloakService.loadUserProfile();
      
      // Keycloak attributes are stored as arrays, get the first element if it exists
      const storedPin = (profile.attributes as any)?.posPin?.[0] || (profile.attributes as any)?.posPin || '';
      
      // Check if PIN is required (user has PIN set)
      if (!storedPin || storedPin === '') {
        // No PIN set - allow approval for backward compatibility
        if (this.managerApprovalCallback) {
          this.managerApprovalCallback();
          this.managerApprovalDialog = false;
          this.managerApprovalCallback = null;
          this.managerApprovalReason = '';
          this.lockPinInput = '';
          this.lockPinError = false;
        }
        return;
      }
      
      // PIN is set - verify it
      const isValid = storedPin === this.lockPinInput;
      
      if (isValid && this.managerApprovalCallback) {
        this.managerApprovalCallback();
        this.managerApprovalDialog = false;
        this.managerApprovalCallback = null;
        this.managerApprovalReason = '';
        this.lockPinInput = '';
        this.lockPinError = false;
      } else {
        // Invalid PIN - show error
        this.lockPinError = true;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_pin'),
          life: 4000
        });
        
        // Clear input after a short delay to allow user to see the error
        setTimeout(() => {
          this.lockPinInput = '';
          this.lockPinError = false;
        }, 1500);
      }
    } catch (error) {
      console.error('Error verifying manager PIN:', error);
      this.lockPinError = true;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 4000
      });
      setTimeout(() => {
        this.lockPinInput = '';
        this.lockPinError = false;
      }, 1500);
    }
  }

  // ========== PWA Management ==========
  
  setupPwa() {
    // Check if PWA can be installed
    this.canInstallPwa = this.pwaService.canInstall();
    this.isPwaInstalled = this.pwaService.isInstalled();
    
    // Listen for install prompt availability
    window.addEventListener('beforeinstallprompt', () => {
      this.canInstallPwa = this.pwaService.canInstall();
    });
    
    // Listen for update availability
    this.pwaService.updateAvailable$.subscribe(available => {
      this.updateAvailable = available;
      if (available) {
        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('update_available'),
          detail: this.translate.instant('new_version_available'),
          life: 5000
        });
      }
    });
    this.setupPwaActions();
  }

  async installPwa() {
    const installed = await this.pwaService.promptInstall();
    if (installed) {
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('pwa_installed'),
        life: 3000
      });
      this.canInstallPwa = false;
      this.isPwaInstalled = true;
    }
  }

  async updatePwa() {
    await this.pwaService.updateServiceWorker();
  }

  // ========== Navigation Guard ==========
  
  setupNavigationGuard() {
    // Track cart state
    this.destroy$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      // Component destroyed
    });
    
    // Update hasActiveCart when cart changes
    // This will be called in cart update methods
  }

  @HostListener('window:beforeunload', ['$event'])
  canDeactivate(event: BeforeUnloadEvent): boolean {
    if (this.cart && this.cart.items && this.cart.items.length > 0) {
      event.preventDefault();
      event.returnValue = '';
      return false;
    }
    return true;
  }

  canLeaveRoute(): boolean {
    if (this.cart && this.cart.items && this.cart.items.length > 0) {
      return confirm(this.translate.instant('active_sale_confirm_leave'));
    }
    return true;
  }

  // Update cart tracking
  updateCartTracking() {
    this.hasActiveCart = !!(this.cart && this.cart.items && this.cart.items.length > 0);
  }

  // ========== Session Management ==========
  
  async showOpenSessionDialog() {
    if (this.isAdmin && !this.shopId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_a_shop'),
        life: 3000
      });
      return;
    }
    this.sessionCashRegisterId = null;
    this.sessionNotes = '';
    this.sessionOpeningAmount = null;
    await this.prefillCashRegisterSessionId();
    this.openSessionDialog = true;
  }

  private async prefillCashRegisterSessionId(): Promise<void> {
    try {
      const shopId = this.getShopIdForApi();
      const session$ = shopId
        ? await this.cashRegisterService.getCurrentSessionByShop(shopId)
        : await this.cashRegisterService.getCurrentSession();
      const currentCashRegisterSession = await firstValueFrom(session$);
      if (currentCashRegisterSession?.sessionId) {
        this.sessionCashRegisterId = currentCashRegisterSession.sessionId;
      }
    } catch (error) {
      console.warn('Could not prefill cash register session id:', error);
    }
  }

  async openSession() {
    if (this.isAdmin && !this.shopId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_a_shop'),
        life: 3000
      });
      return;
    }

    // Check if there's already an active session
    await this.refreshSessionState();
    if (this.session) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('session_already_open'),
        life: 3000
      });
      this.openSessionDialog = false;
      return;
    }

    // Manual mode with no drawer open yet: the counted float is required, not optional.
    if (this.requiresOpeningAmount && (this.sessionOpeningAmount == null || this.sessionOpeningAmount < 0)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('opening_amount_required'),
        life: 3000
      });
      return;
    }

    this.loading = true;
    try {
      // Validate shopId for admins before starting session
      if (this.isAdmin && !this.validateShopIdForAdmin()) {
        this.loading = false;
        return;
      }

      const started$ = await this.posService.startSession(
        this.getShopIdForApi(),
        this.sessionCashRegisterId || undefined,
        this.requiresOpeningAmount ? this.sessionOpeningAmount : undefined
      );
      const newSession = await firstValueFrom(started$);
      
      // Refresh session state to get the full session object from server
      await this.refreshSessionState();
      
      this.openSessionDialog = false;
      this.sessionCashRegisterId = null;
      this.sessionNotes = '';
      this.sessionOpeningAmount = null;
      
      // Create initial cart
      if (this.session) {
        try {
          const cart$ = await this.posService.createCart(this.session.sessionId);
          this.cart = this.normalizeCartItems(await firstValueFrom(cart$));
          this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
          this.updateAvailablePaymentMethods();
        } catch (cartError) {
          console.error('Error creating cart:', cartError);
          // Session is open but cart creation failed, that's okay
        }
        this.saveToLocalStorage();
      }
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('session_opened'),
        detail: this.translate.instant('session_is_currently_open'),
        life: 3000
      });
    } catch (error: any) {
      console.error('Error opening session:', error);
      
      // Refresh session state even on error
      await this.refreshSessionState();
      
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('failed_to_open_session'),
        life: 4000
      });
    } finally {
      this.loading = false;
    }
  }

  async showCloseSessionDialog() {
    console.log('showCloseSessionDialog called');
    console.log('Session:', this.session);
    console.log('Cart:', this.cart);
    console.log('IsLocked:', this.isLocked);
    
    if (!this.session) {
      console.warn('No active session to close');
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_active_session'),
        life: 3000
      });
      return;
    }
    
    // Refresh cart state from backend before checking
    try {
      const activeCart$ = await this.posService.getActiveCart(this.session.sessionId);
      const freshCart = await firstValueFrom(activeCart$);
      this.cart = freshCart ? this.normalizeCartItems(freshCart) : null;
      
      // Check if there are active carts with items
      if (this.cart && this.cart.items && this.cart.items.length > 0) {
        console.warn('Cannot close session with active cart items:', this.cart.items.length);
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('cannot_close_session_with_active_cart'),
          life: 4000
        });
        return;
      }
    } catch (error: any) {
      console.error('Error refreshing cart state:', error);
      // If we can't get the cart, check local state as fallback
      if (this.cart && this.cart.items && this.cart.items.length > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('cannot_close_session_with_active_cart'),
          life: 4000
        });
        return;
      }
    }
    
    // Check for hold/pending carts before allowing session closure
    if (this.shopId) {
      try {
        this.loading = true;
        const holds$ = await this.posService.getHoldCarts(this.getShopIdForApi());
        const holdCarts = await firstValueFrom(holds$);
        const activeHoldCarts = Array.isArray(holdCarts) ? holdCarts.filter(cart => 
          cart && cart.items && cart.items.length > 0
        ) : [];
        
        if (activeHoldCarts.length > 0) {
          console.warn('Cannot close session with hold carts:', activeHoldCarts.length);
          this.loading = false;
          const holdCartsCount = activeHoldCarts.length;
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_close_session_with_hold_carts', { count: holdCartsCount }),
            life: 8000
          });
          // Open hold carts dialog so user can manage them
          this.holdCarts = activeHoldCarts.map(cart => this.normalizeCartItems(cart));
          this.holdCartsDialog = true;
          return;
        }
      } catch (error: any) {
        console.error('Error checking hold carts:', error);
        // Don't block session closure if we can't check hold carts
        // But log the error for debugging
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_checking_hold_carts'),
          life: 3000
        });
      } finally {
        this.loading = false;
      }
    }
    
    console.log('Opening close session dialog');
    this.closingSessionNotes = '';
    this.closeSessionDialog = true;
  }

  async closeSession() {
    if (!this.session || !this.session.sessionId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_active_session'),
        life: 3000
      });
      return;
    }

    // Refresh cart state from backend before closing to ensure we have latest state
    try {
      const activeCart$ = await this.posService.getActiveCart(this.session.sessionId);
      const freshCart = await firstValueFrom(activeCart$);
      this.cart = freshCart ? this.normalizeCartItems(freshCart) : null;
      
      // Check if there are active carts with items
      if (this.cart && this.cart.items && this.cart.items.length > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('cannot_close_session_with_active_cart'),
          life: 4000
        });
        this.closeSessionDialog = false;
        return;
      }
      
      // If there's an active cart (even if empty), cancel it before closing session
      if (this.cart && this.cart.cartId) {
        console.log('Canceling empty active cart before closing session:', this.cart.cartId);
        try {
          await firstValueFrom(await this.posService.cancelCart(this.cart.cartId));
          this.cart = null;
          console.log('Active cart canceled successfully');
        } catch (cancelError: any) {
          console.error('Error canceling empty cart:', cancelError);
          // If cancel fails, still try to proceed - backend will handle it
        }
      }
    } catch (error: any) {
      console.error('Error refreshing cart state before closing:', error);
      // If we can't get the cart, check local state as fallback
      if (this.cart && this.cart.items && this.cart.items.length > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('cannot_close_session_with_active_cart'),
          life: 4000
        });
        this.closeSessionDialog = false;
        return;
      }
    }

    // Final check for hold/pending carts before closing
    if (this.shopId) {
      try {
        const holds$ = await this.posService.getHoldCarts(this.getShopIdForApi());
        const holdCarts = await firstValueFrom(holds$);
        const activeHoldCarts = Array.isArray(holdCarts) ? holdCarts.filter(cart => 
          cart && cart.items && cart.items.length > 0
        ) : [];
        
        if (activeHoldCarts.length > 0) {
          const holdCartsCount = activeHoldCarts.length;
          this.messageService.add({
            severity: 'warn',
            summary: this.translate.instant('warning'),
            detail: this.translate.instant('cannot_close_session_with_hold_carts', { count: holdCartsCount }),
            life: 8000
          });
          this.closeSessionDialog = false;
          // Open hold carts dialog so user can manage them
          this.holdCarts = activeHoldCarts.map(cart => this.normalizeCartItems(cart));
          this.holdCartsDialog = true;
          return;
        }
      } catch (error: any) {
        console.error('Error checking hold carts before closing:', error);
        // Don't block session closure if we can't check hold carts
        // But show a warning
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('error_checking_hold_carts'),
          life: 3000
        });
      }
    }

    this.loading = true;
    try {
      const sessionId = this.session.sessionId;
      await firstValueFrom(await this.posService.endSession(sessionId));
      
      // Close dialog first
      this.closeSessionDialog = false;
      this.closingSessionNotes = '';
      
      // Clear session state immediately since we know it's closed
      this.session = null;
      this.cart = null;
      this.posStorage.saveCart(null);
      this.saveToLocalStorage();
      
      // Refresh session state from server to confirm (handles 404 gracefully)
      await this.refreshSessionState();
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('session_closed'),
        detail: this.translate.instant('session_closed_successfully'),
        life: 3000
      });
    } catch (error: any) {
      console.error('Error closing session:', error);
      
      // Refresh session state even on error to get accurate state
      await this.refreshSessionState();
      
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('failed_to_close_session'),
        life: 4000
      });
    } finally {
      this.loading = false;
    }
  }

  getCashRegisterSessionId(): number | null {
    if (!this.session) {
      return null;
    }
    return this.session.cashRegisterSessionId
      ?? this.session.cashRegisterSession?.sessionId
      ?? null;
  }

  private initReportFormatMenus(): void {
    this.xReportFormatMenu = [
      {
        label: this.translate.instant('pos_report_thermal_pdf'),
        icon: 'pi pi-print',
        command: () => this.downloadXReport('thermal'),
      },
    ];
    this.zReportFormatMenu = [
      {
        label: this.translate.instant('pos_report_thermal_pdf'),
        icon: 'pi pi-print',
        command: () => this.downloadZReport('thermal'),
      },
    ];
  }

  async downloadXReport(format: 'standard' | 'thermal' = 'standard'): Promise<void> {
    const cashRegisterSessionId = this.getCashRegisterSessionId();
    if (!cashRegisterSessionId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('pos_report_no_cash_register_session'),
        life: 4000,
      });
      return;
    }

    this.reportDownloading = true;
    try {
      const response$ = await this.cashRegisterService.downloadXReportPdf(cashRegisterSessionId, format);
      const response: any = await firstValueFrom(response$);
      this.triggerReportPdfDownload(response?.body, `x_report_session_${cashRegisterSessionId}.pdf`);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('pos_x_report_download'),
        life: 3000,
      });
    } catch (error) {
      console.error('Failed to download X report:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('pos_report_download_failed'),
        life: 4000,
      });
    } finally {
      this.reportDownloading = false;
    }
  }

  async downloadZReport(format: 'standard' | 'thermal' = 'standard'): Promise<void> {
    const cashRegisterSessionId = this.getCashRegisterSessionId();
    if (!cashRegisterSessionId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('pos_report_no_cash_register_session'),
        life: 4000,
      });
      return;
    }

    this.reportDownloading = true;
    try {
      const response$ = await this.cashRegisterService.downloadZReportPdf(cashRegisterSessionId, format);
      const response: any = await firstValueFrom(response$);
      this.triggerReportPdfDownload(response?.body, `z_report_session_${cashRegisterSessionId}.pdf`);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('pos_z_report_download'),
        life: 3000,
      });
    } catch (error) {
      console.error('Failed to download Z report:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('pos_report_download_failed'),
        life: 4000,
      });
    } finally {
      this.reportDownloading = false;
    }
  }

  private triggerReportPdfDownload(blob: Blob | null | undefined, filename: string): void {
    if (!blob) {
      return;
    }
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  getSessionDuration(): string {
    if (!this.session || !this.session.startedAt) {
      return '';
    }
    const start = new Date(this.session.startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  getSelectedShopName(): string {
    if (!this.shopId || !this.shops || this.shops.length === 0) {
      return this.translate.instant('select_shop');
    }
    const shop = this.shops.find(s => s.shopId === this.shopId);
    return shop?.shopName || this.translate.instant('select_shop');
  }

  async refreshSessionManually() {
    // Only admins must pick a shop first; non-admins resolve it from the JWT.
    if (this.isAdmin && !this.shopId) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_select_a_shop'),
        life: 3000
      });
      return;
    }
    
    this.loading = true;
    try {
      await this.refreshSessionState();
      if (this.session) {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('session_refreshed'),
          life: 2000
        });
      } else {
        this.messageService.add({
          severity: 'info',
          summary: this.translate.instant('info'),
          detail: this.translate.instant('no_active_session'),
          life: 2000
        });
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    } finally {
      this.loading = false;
    }
  }

  //New added functions
  // Customer search method with lazy loading
  async searchCustomers(event: any) {
    const query = event.query?.trim() || '';
    const walkInLabel = this.translate.instant('walk_in_customer');
    
    try {
      // If we have initial customers loaded, use them for filtering
      if (this.customers.length > 0) {
        if (!query || query.length === 0) {
          // Show initial suggestions when dropdown opens (walk-in + first customers)
          // Filter out any customer with null ID and walk-in customers to avoid duplicates
          const validCustomers = this.customers.filter(c => c.customerId != null && !this.isWalkInCustomer(c)).slice(0, 10);
          this.customerSuggestions = [
            { customerId: null, fullName: walkInLabel },
            ...validCustomers
          ];
          return;
        }
        
        // Filter existing customers (exclude walk-in customer)
        const queryLower = query.toLowerCase();
        const filtered = this.customers.filter(customer => 
          customer.customerId != null && 
          !this.isWalkInCustomer(customer) && (
            customer.fullName?.toLowerCase().includes(queryLower) ||
            customer.email?.toLowerCase().includes(queryLower) ||
            customer.phone?.includes(query) ||
            customer.firstName?.toLowerCase().includes(queryLower) ||
            customer.lastName?.toLowerCase().includes(queryLower)
          )
        );
        
        // Always include walk-in customer as first option
        this.customerSuggestions = [
          { customerId: null, fullName: walkInLabel },
          ...filtered
        ];
      } else {
        // Load all customers if not already loaded
        (this.customerService as any).loadToken && await (this.customerService as any).loadToken();
        const customers$ = this.customerService.getCustomers();
        const allCustomers = await firstValueFrom(customers$);
        this.customers = Array.isArray(allCustomers) ? allCustomers : [];
        this.customers = this.customers
          .filter(c => c.customerId != null && !this.isWalkInCustomer(c))
          .map(c => ({
            ...c,
            fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown'
          }));

        if (!query) {
          this.customerSuggestions = [
            { customerId: null, fullName: walkInLabel },
            ...this.customers.slice(0, 10)
          ];
          return;
        }

        // Filter customers by query
        const queryLower = query.toLowerCase();
        const filtered = this.customers.filter(customer =>
          !this.isWalkInCustomer(customer) && (
            customer.fullName?.toLowerCase().includes(queryLower) ||
            customer.email?.toLowerCase().includes(queryLower) ||
            customer.phone?.includes(query) ||
            customer.firstName?.toLowerCase().includes(queryLower) ||
            customer.lastName?.toLowerCase().includes(queryLower)
          )
        );
        this.customerSuggestions = [
          { customerId: null, fullName: walkInLabel },
          ...filtered
        ];
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      // Fallback to walk-in customer
      this.customerSuggestions = [{ customerId: null, fullName: walkInLabel }];
    }
  }

  onCustomerSelect(event: any) {
    // PrimeNG AutoComplete emits { originalEvent, value }
    const customer = event?.value ?? event;
    this.selectedCustomer = customer;
    // Update available payment methods based on customer
    this.updateAvailablePaymentMethods();
    this.onCustomerChange(customer?.customerId ?? null);
    // Load credit info if customer is selected and not walk-in
    if (customer?.customerId && !this.isWalkInCustomer(customer)) {
      this.loadCreditInfo(customer.customerId);
    } else {
      // Clear credit info for walk-in customers
      this.creditInfo = null;
    }
  }

  // Load credit information for a customer
  async loadCreditInfo(customerId: number) {
    if (!customerId) {
      this.creditInfo = null;
      this.outstandingBalance = 0;
      this.overdueBalance = 0;
      this.netBalance = 0;
      this.availableCreditLimit = 0;
      return;
    }
    
    this.creditInfoLoading = true;
    try {
      this.customerCreditService.loadToken();
      const creditInfo$ = await this.customerCreditService.getCreditInfo(customerId);
      const info = await firstValueFrom(creditInfo$);
      this.creditInfo = info;

      // Sanitize values to handle invalid/unlimited values
      this.outstandingBalance = this.sanitizeValue(info.outstandingBalance);
      this.overdueBalance = this.sanitizeValue(info.overdueBalance);
      this.netBalance = this.sanitizeValue(info.netBalance);
      this.availableCreditLimit = this.sanitizeValue(info.availableCreditLimit);

      // Fallback: some backends return availableCredit but not availableCreditLimit
      const fallbackAvailableCredit = this.sanitizeValue(info.availableCredit);
      if ((this.availableCreditLimit === 0 || this.availableCreditLimit === undefined) && fallbackAvailableCredit !== 0) {
        this.availableCreditLimit = fallbackAvailableCredit;
      }

      // Store original availableCreditLimit for unlimited check
      this.creditInfo.availableCreditLimit = info.availableCreditLimit;
    } catch (error: any) {
      console.error('Error loading credit info:', error);
      // If customer doesn't have credit account, set to null (not an error)
      if (error?.status !== 404) {
        // Only log/show error if it's not a "not found" error
        console.warn('Could not load credit info for customer:', customerId);
      }
      this.creditInfo = null;
      this.outstandingBalance = 0;
      this.overdueBalance = 0;
      this.netBalance = 0;
      this.availableCreditLimit = 0;
    } finally {
      this.creditInfoLoading = false;
    }
  }

  // Check if Credit payment method is available
  isCreditAvailable(): boolean {
    return !!(this.selectedCustomer?.customerId && !this.isWalkInCustomer(this.selectedCustomer));
  }

  // Check if current payment uses Credit method (cached to avoid repeated iterations)
  private _isCreditPaymentCache: boolean | null = null;
  private _lastPaymentMethodsHash: string = '';
  
  isCreditPayment(): boolean {
    // Create a simple hash of payment methods to detect changes
    const currentHash = this.checkoutPayments.map(p => p.method).join(',');
    
    // Only recalculate if payment methods changed
    if (currentHash !== this._lastPaymentMethodsHash) {
      this._isCreditPaymentCache = this.checkoutPayments.some(p => p.method === 'Credit');
      this._lastPaymentMethodsHash = currentHash;
    }
    
    return this._isCreditPaymentCache || false;
  }

  // Validate credit limit before checkout
  validateCreditLimit(): { valid: boolean; error?: string } {
    if (!this.isCreditPayment() || !this.creditInfo) {
      return { valid: true };
    }

    const orderAmount = this.cart?.totalAmount || 0;
    if (this.isUnlimitedCreditLimit()) {
      return { valid: true };
    }
    const availableCredit = this.availableCreditLimit || 0;

    if (orderAmount > availableCredit) {
      const creditLimit = this.creditInfo.creditLimit || 0;
      const outstandingBalance = this.outstandingBalance || 0;
      
      return {
        valid: false,
        error: this.translate.instant('credit_limit_exceeded_message', {
          limit: creditLimit.toFixed(2),
          outstanding: outstandingBalance.toFixed(2),
          available: availableCredit.toFixed(2),
          amount: orderAmount.toFixed(2)
        })
      };
    }

    return { valid: true };
  }

  // Helper method to sanitize invalid values (returns 0 for invalid, or -1 for unlimited)
  private sanitizeValue(value: any): number {
    // 0 is a valid value
    if (value === 0) {
      return 0;
    }

    if (value === undefined || value === null) {
      return 0;
    }

    const valueStr = String(value).toUpperCase();

    // Check for scientific notation with large exponent (represents unlimited)
    if (valueStr.includes('E+')) {
      const match = valueStr.match(/E\+(\d+)/);
      if (match && parseInt(match[1]) >= 15) {
        return -1; // Use -1 to represent unlimited
      }
    }

    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Check if it's 0 after parsing
    if (numValue === 0) {
      return 0;
    }

    const absValue = Math.abs(numValue);

    // Check for invalid values (Infinity, NaN, or extremely large)
    if (!isFinite(numValue) || isNaN(numValue) ||
        absValue > 1e15 ||
        absValue >= Number.MAX_VALUE * 0.9) {
      return -1; // Use -1 to represent unlimited
    }

    return numValue;
  }

  // Check if available credit limit is unlimited
  isUnlimitedCreditLimit(): boolean {
    return this.availableCreditLimit === -1 ||
           (this.creditInfo && this.isInvalidValue(this.creditInfo.availableCreditLimit));
  }

  // Helper method to check if a value is invalid (for unlimited detection)
  private isInvalidValue(value: any): boolean {
    if (value === 0 || value === undefined || value === null) {
      return false;
    }

    const valueStr = String(value).toUpperCase();
    if (valueStr.includes('E+')) {
      const match = valueStr.match(/E\+(\d+)/);
      if (match && parseInt(match[1]) >= 15) {
        return true;
      }
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (numValue === 0) {
      return false;
    }

    const absValue = Math.abs(numValue);
    return !isFinite(numValue) || isNaN(numValue) ||
           absValue > 1e15 ||
           absValue >= Number.MAX_VALUE * 0.9;
  }

  onVariantProductPicked(product: any): void {
    const posProduct = product?.productId
      ? this.mapProductToPosDto(product as Product)
      : product;
    this.addToCart(posProduct);
  }

  addToCart(product: any) {
    this.addProductToCart(product, 1);
  }

  getCartLineDisplayQuantity(item: POSCartItemDTO): number {
    return getCartItemDisplayQuantity(item);
  }

  getCartLineDisplayStock(item: POSCartItemDTO): number {
    return getCartItemDisplayStock(item);
  }

  getCartLineQuantityStep(item: POSCartItemDTO): number {
    return lineQuantityStep(cartItemAsProduct(item));
  }

  getCartLineQuantityMin(item: POSCartItemDTO): number {
    return lineQuantityMin(cartItemAsProduct(item));
  }

  formatCartLineQuantity(item: POSCartItemDTO): string {
    return formatLineQuantity(cartItemAsProduct(item), getCartItemDisplayQuantity(item));
  }

  showCartUnitPriceSuffix(item: POSCartItemDTO): boolean {
    return shouldShowLineMeasureUnit(cartItemAsProduct(item));
  }

  /**
   * Sellable stock for a POS product/variant tile in DISPLAY units (e.g. 0.5 kg, not 500),
   * preferring backend display fields and falling back to storage→display conversion.
   */
  getProductStockDisplay(product: any): number {
    if (!product) {
      return 0;
    }
    if (product.displayNetAvailableQuantity != null) {
      return product.displayNetAvailableQuantity;
    }
    if (product.displayQuantityAvailable != null && product.netAvailableQuantity == null) {
      return product.displayQuantityAvailable;
    }
    const storage = (product.netAvailableQuantity ?? product.quantityAvailable) ?? 0;
    return QuantityScale.toDisplayQuantity(product as Product, storage);
  }

  formatProductStock(product: any): string {
    return formatLineQuantity(product as Product, this.getProductStockDisplay(product));
  }

  getProductStockUnit(product: any): string {
    return getLineMeasureUnit(product as Product, this.getProductStockDisplay(product));
  }

  /** Stock-tag severity from display-unit sellable quantity. */
  getProductStockSeverity(product: any): string {
    const qty = this.getProductStockDisplay(product);
    return qty <= 0 ? 'danger' : qty < 5 ? 'warning' : 'success';
  }

  /** Stock tag label with unit (e.g. "0.5 kg"). */
  getProductStockLabel(product: any): string {
    const unit = this.getProductStockUnit(product);
    return this.formatProductStock(product) + (unit ? ' ' + this.translate.instant(unit) : '');
  }

  /** Max display quantity in cart line editor; soft reservations defer final check to API when online. */
  getCartLineMaxQuantity(item: POSCartItemDTO): number {
    if (this.salesStockSoftReservationEnabled && this.isOnline) {
      return 999999;
    }
    const stock = getCartItemDisplayStock(item);
    return Math.max(this.getCartLineQuantityMin(item), stock || 999);
  }

  isCartPlusQuantityBlocked(item: POSCartItemDTO): boolean {
    if (this.salesStockSoftReservationEnabled && this.isOnline) {
      return false;
    }
    const stock = getCartItemDisplayStock(item);
    return stock > 0 && getCartItemDisplayQuantity(item) >= stock;
  }

  private toApiQuantity(item: POSCartItemDTO, displayQuantity: number): number {
    const product = cartItemAsProduct(item);
    if (QuantityScale.isFractional(product)) {
      // Backend accepts display-unit decimals (e.g. 0.5) and converts to storage internally
      return displayQuantity;
    }
    return Math.max(1, Math.round(displayQuantity));
  }

  onCartDisplayQuantityChange(item: POSCartItemDTO, displayQuantity: number) {
    item.displayQuantity = displayQuantity;
    this.onQuantityChange(item, displayQuantity);
  }

  /**
   * Commit a typed cart quantity (fired on blur/Enter, not per keystroke) so fractional
   * input like "1.5" isn't reset to "1" mid-typing by the async cart refresh. Accepts
   * both '.' and ',' as the decimal separator and clamps to the line's min/max.
   */
  onCartQuantityInput(item: POSCartItemDTO, raw: string): void {
    const parsed = parseFloat(String(raw ?? '').replace(',', '.'));
    if (isNaN(parsed)) {
      return;
    }
    this.updateQuantity(item, parsed);
  }

  updateQuantity(item: POSCartItemDTO, newDisplayQuantity: number) {
    const cap = this.getCartLineMaxQuantity(item);
    const min = this.getCartLineQuantityMin(item);
    const quantity = Math.max(min, Math.min(newDisplayQuantity, cap));
    this.onCartDisplayQuantityChange(item, quantity);
  }

  addPayment(amount: number) {
    this.paymentAmount = amount;
  }

  scrollToCart() {
    // Scroll to cart section smoothly without breaking page scroll
    setTimeout(() => {
      const cartElement = document.querySelector('.pos-cart-items') || 
                         document.querySelector('[class*="cart"]');
      if (cartElement) {
        const elementTop = cartElement.getBoundingClientRect().top + window.pageYOffset;
        const offset = 120; // Offset for sticky header
        const scrollPosition = Math.max(0, elementTop - offset);
        window.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }, 0);
  }

  startBarcodeScanner() {
    // Reset all scanner state
    this.scannerDialog = true;
    this.scannerEnabled = false;
    this.hasPermission = false;
    this.availableDevices = [];
    this.currentDevice = null;
    this.currentDeviceId = null;
    this.lastScanResult = '';

    // Request camera permission and get available devices
    this.requestCameraPermission();
  }

  async requestCameraPermission() {
    try {
      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Stop the stream immediately - we just needed permission
      stream.getTracks().forEach(track => track.stop());
      this.hasPermission = true;
      
      // Get available video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (this.availableDevices.length > 0) {
        // Use the first available camera (usually the default)
        this.currentDevice = this.availableDevices[0];
        this.currentDeviceId = this.currentDevice.deviceId;
        console.log('Camera permission granted, enabling scanner with device:', this.currentDeviceId);
        this.scannerEnabled = true;
        // Trigger change detection to ensure scanner component updates
        this.cdr.detectChanges();
      } else {
        console.warn('No video input devices found');
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('no_camera_found'),
          life: 3000
        });
      }
    } catch (error: any) {
      console.error('Camera permission error:', error);
      this.hasPermission = false;
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.name === 'NotAllowedError' 
          ? this.translate.instant('camera_permission_denied')
          : this.translate.instant('camera_access_error'),
        life: 4000
      });
    }
  }

  onScanSuccess(result: any) {
    console.log('Barcode scan success:', result);
    // The result can be a string or an object with getText() method
    const barcode = typeof result === 'string' ? result : (result?.getText ? result.getText() : result);
    console.log('Extracted barcode:', barcode);

    if (barcode && String(barcode).trim()) {
      const barcodeStr = String(barcode).trim();
      console.log('Processing scanned barcode:', barcodeStr);
      this.lastScanResult = barcodeStr;

      // Close scanner dialog
      this.closeScanner();

      // Process the barcode directly (auto-add to cart)
      this.lookupByBarcode(barcodeStr);
    } else {
      console.warn('Invalid barcode result:', result);
    }
  }

  onScanError(error: any) {
    console.error('Scanner error:', error);
    // Only show critical errors to user
    if (error?.name === 'NotAllowedError' || error?.name === 'NotFoundError') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('camera_access_error'),
        life: 3000
      });
    }
  }

  onCamerasFound(cameras: MediaDeviceInfo[]) {
    console.log('Cameras found by zxing-scanner:', cameras);
    this.availableDevices = cameras;
    if (cameras.length > 0 && !this.currentDevice) {
      this.currentDevice = cameras[0];
      this.currentDeviceId = this.currentDevice.deviceId;
      console.log('Selected default camera:', this.currentDevice.label || this.currentDevice.deviceId);
    }
  }

  onDeviceSelectChange(deviceId: string) {
    const device = this.availableDevices.find(d => d.deviceId === deviceId);
    if (device && device.deviceId !== this.currentDeviceId) {
      console.log('Switching to camera device:', device.label || device.deviceId);
      // Disable scanner temporarily to restart with new device
      this.scannerEnabled = false;
      this.currentDevice = device;
      this.currentDeviceId = device.deviceId;

      // Re-enable scanner after a short delay to ensure proper restart
      setTimeout(() => {
        this.scannerEnabled = true;
        this.cdr.detectChanges();
      }, 100);
    }
  }

  closeScanner() {
    console.log('Closing scanner dialog');
    this.scannerDialog = false;
    this.scannerEnabled = false;
    this.lastScanResult = '';
    this.currentDeviceId = null;
    // Reset permission state when closing
    this.hasPermission = false;
    this.availableDevices = [];
    this.currentDevice = null;
  }

  openSplitPayment() {
    // Open split payment dialog - implement if needed
    this.messageService.add({
      severity: 'info',
      summary: 'Split Payment',
      detail: 'Split payment feature coming soon',
      life: 3000
    });
  }


  onProductSelect(event: any) {
    console.log('onProductSelect event:', event);
    const product = event?.value || event;
    console.log('Extracted product:', product);
    console.log('Product ID:', product?.productId);
    console.log('Product name:', product?.name);

    if (product && product.productId) {
      this.addToCart(product);
      // Clear AFTER PrimeNG finishes its selection cycle. Doing it synchronously here is
      // overwritten by the autocomplete repainting the input with the selected object,
      // which then renders as "[object Object]". Deferring one tick resets it reliably.
      setTimeout(() => {
        this.searchQuery = '';
        this.searchSuggestions = [];
      });
    } else {
      console.error('Invalid product selected:', product);
    }
  }

  // Initialize pwaActions in ngOnInit or after PWA setup
  private setupPwaActions() {
    this.pwaActions = [
      {
        icon: 'pi pi-download',
        command: () => this.installPwa(),
        tooltip: 'Install App',
        visible: this.canInstallPwa && !this.isPwaInstalled
      },
      {
        icon: 'pi pi-refresh',
        command: () => this.updatePwa(),
        tooltip: 'Update App',
        visible: this.updateAvailable
      }
    ];
  }

  async loadSalesStockConfig() {
    try {
      const config = await firstValueFrom(
        await this.configService.getConfiguration('sales.stock.include.approved.writeoff.quantity')
      );
      this.salesStockIncludesApprovedWriteoffQty =
        config?.value === 'true' || config?.value === true;
    } catch (e) {
      console.warn('Could not load sales/write-off stock configuration for POS, defaulting to net sellable qty', e);
      this.salesStockIncludesApprovedWriteoffQty = false;
    }
  }

  async loadSalesStockSoftReservationConfig() {
    try {
      const config = await firstValueFrom(
        await this.configService.getConfiguration('sales.stock.soft.reservation.enabled')
      );
      this.salesStockSoftReservationEnabled =
        config?.value === 'true' || config?.value === true;
    } catch (e) {
      console.warn('Could not load soft reservation configuration for POS, defaulting to off', e);
      this.salesStockSoftReservationEnabled = false;
    }
  }

  /** Loads whether cashiers may override line prices (pricing.allow.custom.override). */
  async loadPriceOverrideConfig() {
    try {
      const config = await firstValueFrom(
        await this.configService.getConfiguration('pricing.allow.custom.override')
      );
      this.priceOverrideAllowed = config?.value === 'true' || config?.value === true;
    } catch (e) {
      console.warn('Could not load price override configuration for POS, defaulting to allowed', e);
      this.priceOverrideAllowed = true;
    }
  }

  /**
   * When cash.register.auto.open.session is off, POS must ask the cashier for the counted opening
   * float instead of silently opening a drawer (or refusing and sending them to another screen).
   */
  async loadCashRegisterAutoOpenConfig() {
    try {
      const config = await firstValueFrom(
        await this.configService.getConfiguration('cash.register.auto.open.session')
      );
      this.cashRegisterAutoOpenEnabled = config?.value === 'true' || config?.value === true;
    } catch (e) {
      console.warn('Could not load cash register auto-open configuration for POS, defaulting to auto', e);
      this.cashRegisterAutoOpenEnabled = true;
    }
  }

  /**
   * True when the start-session dialog must collect an opening float: manual mode and no cash
   * register session already active for this shop.
   */
  get requiresOpeningAmount(): boolean {
    return !this.cashRegisterAutoOpenEnabled && !this.sessionCashRegisterId;
  }

  /** Opt-in per tenant: expose the portion selector on POS cart lines. */
  async loadPortionSelectionConfig() {
    try {
      const config = await firstValueFrom(
        await this.configService.getConfiguration('sales.portion.selection.enabled')
      );
      this.portionSelectionEnabled = config?.value === 'true' || config?.value === true;
    } catch {
      this.portionSelectionEnabled = false;
    }
  }

  /** Human label for a portion fraction (1 → "1", 0.5 → "1/2", ...). */
  portionLabel(fraction: number | null | undefined): string {
    if (fraction == null) return '';
    const map: { [k: string]: string } = { '1': '1', '0.5': '1/2', '0.25': '1/4', '0.125': '1/8' };
    return map[String(fraction)] || String(fraction);
  }

  /** Current portion fraction for a cart line (defaults to whole = 1). */
  getCartLinePortion(item: POSCartItemDTO): number {
    const v = Number(item?.portionFraction);
    return isNaN(v) || v <= 0 ? 1 : v;
  }

  /** Persist a new portion fraction on the cart line; refreshes totals from the server response. */
  async setCartLinePortion(item: POSCartItemDTO, fraction: number): Promise<void> {
    if (!item?.cartItemId || !this.isOnline) return;
    try {
      const updated$ = await this.posService.updateCartItem(item.cartItemId, undefined, undefined, undefined, fraction);
      this.cart = this.normalizeCartItems(await firstValueFrom(updated$));
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (e: any) {
      console.error('Failed to update cart line portion', e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: e?.error?.message || this.translate.instant('error'),
        life: 3000,
      });
    }
  }

  /** Commit a manually typed unit price for a cart line (only when overrides are allowed). */
  onCartUnitPriceInput(item: POSCartItemDTO, raw: string): void {
    if (!this.priceOverrideAllowed) {
      return;
    }
    const parsed = parseFloat(String(raw ?? '').replace(',', '.'));
    if (isNaN(parsed) || parsed < 0) {
      return;
    }
    void this.updateCartItemPrice(item, parsed);
  }

  /** Persist a unit-price override for a cart line via the cart API. */
  async updateCartItemPrice(item: any, newPrice: number): Promise<void> {
    if (!this.priceOverrideAllowed || !this.cart || !item) {
      return;
    }
    item.priceOverride = newPrice;
    item.manualPriceOverride = true;
    this.cartSaving = true;
    try {
      const apiQuantity = this.toApiQuantity(item, this.getCartLineDisplayQuantity(item));
      const updated$ = await this.posService.updateCartItem(item.cartItemId, apiQuantity, newPrice);
      this.cart = this.normalizeCartItems(await firstValueFrom(updated$));
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error: any) {
      console.error('Error updating cart item price:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_occurred'),
        life: 3000,
      });
    } finally {
      this.cartSaving = false;
    }
  }

}


