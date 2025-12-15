import { Component, OnDestroy, OnInit, ViewChild, ElementRef, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Subject, debounceTime, takeUntil, interval } from 'rxjs';
import { POSCartDTO, POSCheckoutDTO, POSProductDTO, POSReceiptDTO, PaymentInfo } from 'src/app/models/pos';
import { PosService } from 'src/app/services/pos.service';
import { ShopService } from 'src/app/services/shop.service';
import { CustomerService } from 'src/app/services/customer.service';
import { CategoryService } from 'src/app/services/category.service';
import { OrderService } from 'src/app/services/order.service';
import { ReturnService } from 'src/app/services/return.service';
import { RefundService } from 'src/app/services/refund.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { PosStorageService, PendingSale } from 'src/app/services/pos-storage.service';
import { PwaService } from 'src/app/services/pwa.service';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-pos',
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.css'],
  providers: [MessageService]
})
export class PosComponent implements OnInit, OnDestroy {

  shopId!: number;
  shops: any[] = [];
  customers: any[] = [];

  currency: string = 'USD';

  loading: boolean = true;
  productsLoading: boolean = false;
  cartSaving: boolean = false;
  taxEnabled: boolean = false;

  // Session & cart
  session: any = null;
  cart: POSCartDTO | null = null;
  holdCarts: POSCartDTO[] = [];
  
  // Session Management
  openSessionDialog: boolean = false;
  closeSessionDialog: boolean = false;
  sessionCashRegisterId: number | null = null;
  sessionNotes: string = '';
  closingSessionNotes: string = '';

  // Search / scan
  barcodeInput: string = '';
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
  receiptDialog: boolean = false;
  checkoutPayments: PaymentInfo[] = [];
  checkoutNotes: string = '';
  printReceipt: boolean = true;
  lastReceipt: POSReceiptDTO | null = null;

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


  // Cart & Customer properties
  selectedCustomer: any = { customerId: null, fullName: 'Walk-in Customer' }; // Default to walk-in
  customerSuggestions: any[] = [];
  discountAmount = 0;
  discountType = 'Amount';
  discountTypes = [
    { label: 'Amount', value: 'Amount' },
    { label: 'Percentage', value: 'Percentage' }
  ];
  orderNotes = '';
  paymentAmount = 0;
  
  // Product View properties
  searchSuggestions: any[] = [];
  
  // Quick payment amounts
  quickAmounts: number[] = [10, 20, 50, 100, 200, 500];
  
  // Payment methods
  paymentMethods = [
    { value: 'cash', label: 'Cash', icon: 'pi pi-money-bill' },
    { value: 'card', label: 'Card', icon: 'pi pi-credit-card' },
    { value: 'transfer', label: 'Transfer', icon: 'pi pi-bank' },
    { value: 'digital_wallet', label: 'Digital Wallet', icon: 'pi pi-mobile' }
  ];
  selectedPaymentMethod = 'cash';
  
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

  // Returns & Refunds
  activeTab: 'sales' | 'returns' = 'sales';
  returnOrderSearch: string = '';
  returnOrderSuggestions: any[] = [];
  selectedOrderForReturn: any = null;
  returnItems: any[] = [];
  returnDialog: boolean = false;
  refundDialog: boolean = false;
  selectedReturn: any = null;
  refundAmount: number = 0;
  refundMethod: string = 'cash';
  refundNotes: string = '';
  returnReasons = [
    { label: 'Defective', value: 'DEFECTIVE' },
    { label: 'Wrong Item', value: 'INCORRECT_ITEM' },
    { label: 'Damaged', value: 'DAMAGED' },
    { label: 'Not as Described', value: 'NOT_AS_DESCRIBED' },
    { label: 'Customer Request', value: 'CUSTOMER_REQUEST' },
    { label: 'Other', value: 'OTHER' }
  ];
  itemConditions = [
    { label: 'New', value: 'NEW' },
    { label: 'Used', value: 'USED' },
    { label: 'Damaged', value: 'DAMAGED' }
  ];


  constructor(
    private posService: PosService,
    private shopService: ShopService,
    private customerService: CustomerService,
    private categoryService: CategoryService,
    private orderService: OrderService,
    private returnService: ReturnService,
    private refundService: RefundService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private configService: AppConfigurationService,
    private posStorage: PosStorageService,
    private pwaService: PwaService,
    private keycloakService: KeycloakService,
    private route: ActivatedRoute,
    private router: Router,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) { }

  async ngOnInit() {
    this.translationService.currentLanguage$.subscribe(lang => {
      this.translate.use(lang);
    });
    this.configService.currency$.subscribe(currency => {
      if (currency) {
        this.currency = currency;
      }
    });

    // Search is now handled directly in onSearchChange via autocomplete completeMethod
    // No need for separate debounce subscription

    // Setup offline detection
    this.setupOfflineDetection();
    
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

    await this.initShopsAndSession();
    
    // Set up periodic session state refresh (every 60 seconds)
    this.sessionRefreshInterval = setInterval(async () => {
      if (this.shopId && !this.loading) {
        await this.refreshSessionState();
      }
    }, 60000);
    
    // Load categories
    await this.loadCategories();
    
    // Auto-focus barcode input
    setTimeout(() => this.focusBarcodeInput(), 100);
    
    this.loading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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

  private async initShopsAndSession() {
    try {
      (this.shopService as any).loadToken && await (this.shopService as any).loadToken();
      const shopsObs = this.shopService.getShops();
      const shopsResult = await firstValueFrom(shopsObs as any);
      this.shops = Array.isArray(shopsResult) ? shopsResult : [];

      const routeShopId = this.route.snapshot.paramMap.get('shopId');
      if (routeShopId) {
        this.shopId = +routeShopId;
      } else if (this.shops.length > 0) {
        this.shopId = this.shops[0].shopId;
      }

      if (!this.shopId && this.shops.length === 0) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('please_select_a_shop'),
          life: 4000
        });
        return;
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
    if (!this.shopId) return;
    this.router.navigate(['/pos/shop', this.shopId]);
    this.loading = true;
    await this.ensureSessionAndCart();
    await this.loadQuickProducts();
    this.loading = false;
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
        }
        // Sync taxEnabled with cart state
        if (this.cart) {
          this.taxEnabled = this.cart.taxEnabled || false;
        }
      } catch {
        // No active cart, create a new one
        const cart$ = await this.posService.createCart(this.session.sessionId);
        const newCart = await firstValueFrom(cart$);
        // Always normalize to ensure calculations are correct
        this.cart = this.normalizeCartItems(newCart);
        // Set default walk-in customer for new cart
        this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
        if (this.cart) {
          this.taxEnabled = this.cart.taxEnabled || false;
        }
      }
      this.saveToLocalStorage();
    }
  }

  private async refreshSessionState() {
    if (!this.shopId) {
      this.session = null;
      this.cart = null;
      return;
    }

    try {
      const activeSession$ = await this.posService.getActiveSession(this.shopId);
      const session = await firstValueFrom(activeSession$);
      
      // Check if session is actually active
      if (session && session.active !== false) {
        this.session = session;
        // Always fetch fresh cart from server to avoid stale data
        if (this.isOnline) {
          try {
            const activeCart$ = await this.posService.getActiveCart(session.sessionId);
            const freshCart = await firstValueFrom(activeCart$);
            // Always normalize to ensure calculations are correct
            this.cart = this.normalizeCartItems(freshCart);
            if (this.cart) {
              this.taxEnabled = this.cart.taxEnabled || false;
            }
            this.saveToLocalStorage();
          } catch {
            // No active cart, create a new one
            const cart$ = await this.posService.createCart(session.sessionId);
            const newCart = await firstValueFrom(cart$);
            this.cart = this.normalizeCartItems(newCart);
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
      // No active session found or error
      this.session = null;
      this.cart = null;
      // Clear stale cart from local storage
      this.posStorage.saveCart(null);
      this.saveToLocalStorage();
    }
  }

  private async loadQuickProducts() {
    if (!this.shopId) return;
    try {
      const quick$ = await this.posService.getQuickProducts(this.shopId);
      this.quickProducts = await firstValueFrom(quick$);
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
    if (this.selectedCategory?.categoryId) {
      this.selectedCategoryId = this.selectedCategory.categoryId;
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
      const selectedCategory = this.categories.find(c => c.categoryId === this.selectedCategoryId);
      if (selectedCategory) {
        this.filteredQuickProducts = this.quickProducts.filter(
          p => p.categoryName === selectedCategory.categoryName
        );
      } else {
        this.filteredQuickProducts = [...this.quickProducts];
      }
    }
  }

  toggleProductView() {
    this.productViewMode = this.productViewMode === 'grid' ? 'list' : 'grid';
  }

  getProductImageUrl(product: POSProductDTO | any): string {
    if (product?.imageUrl) {
      return product.imageUrl;
    }
    // Try to find product in quickProducts by productId
    if (product?.productId) {
      const found = this.quickProducts.find(p => p.productId === product.productId);
      if (found?.imageUrl) {
        return found.imageUrl;
      }
    }
    return 'assets/core-images/no-image.png';
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
    } catch (error) {
      console.error('Error loading customers:', error);
      this.customers = [];
      const walkInLabel = this.translate.instant('walk_in_customer');
      this.customerSuggestions = [{ customerId: null, fullName: walkInLabel }];
    }
  }

  // ========== Search & scan ==========

  onBarcodeEnter() {
    const barcode = this.barcodeInput.trim();
    if (!barcode || !this.shopId) {
      return;
    }
    this.lookupByBarcode(barcode);
  }

  private async lookupByBarcode(barcode: string) {
    this.productsLoading = true;
    try {
      const product$ = await this.posService.getProductByBarcode(barcode, this.shopId);
      const product = await firstValueFrom(product$);
      await this.addProductToCart(product, 1);
      this.barcodeInput = '';
    } catch (error: any) {
      console.error('Error fetching product by barcode:', error);
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_not_found_warning'),
        life: 3000
      });
    } finally {
      this.productsLoading = false;
    }
  }

  onSearchChange(event: any) {
    const query = event.query?.trim() || '';
    this.searchQuery = query; // Update the search query model
    if (!query || query.length < 1) {
      this.searchSuggestions = [];
      this.searchResults = [];
      return;
    }
    // Perform search and populate suggestions
    this.performSearch(query);
  }

  private async performSearch(query: string) {
    if (!this.shopId || !query || query.length < 1) {
      this.searchSuggestions = [];
      this.searchResults = [];
      return;
    }
    this.productsLoading = true;
    try {
      const res$ = await this.posService.searchProducts(query, this.shopId, 0, 50);
      const res = await firstValueFrom(res$);
      const products = res.content || [];
      console.log('Search results:', products.length, 'products found for query:', query);
      // Set both searchSuggestions for autocomplete dropdown and searchResults for grid/list display
      this.searchSuggestions = products;
      this.searchResults = products;
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
    }
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

  /**
   * Normalize cart items coming from backend/local storage so UI bindings always work,
   * even if backend uses nested product objects instead of flat productName/productReference.
   * Also ensures totals are calculated if missing.
   */
  private normalizeCartItems(cart: POSCartDTO | null): POSCartDTO | null {
    if (!cart) {
      return cart;
    }

    const items: any[] = (cart as any).items || (cart as any).cartItems || [];
    (cart as any).items = items.map((item: any) => {
      const product = item.product || item.productDto || {};
      
      // Always recalculate subtotal from quantity and price
      const quantity = item.quantity || 0;
      const pricePerUnit = item.pricePerUnit || item.price || 0;
      const subtotal = quantity * pricePerUnit;
      
      return {
        ...item,
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
        quantity: quantity,
        pricePerUnit: pricePerUnit,
        subtotal: subtotal
      };
    });

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
    
    // Sync taxEnabled property with cart.taxEnabled
    this.taxEnabled = cart.taxEnabled;
    
    // Always recalculate total from subtotal, discount, and tax
    cart.totalAmount = cart.subtotal - (cart.discountAmount || 0) + (cart.taxAmount || 0);

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
    if (product.quantityAvailable <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('product_quantity_insufficient'),
        life: 3000
      });
      return;
    }

    this.cartSaving = true;
    try {
      if (this.isOnline) {
        const updated$ = await this.posService.addItemToCart(this.cart.cartId, product.productId, quantity);
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
    } catch (error: any) {
      console.error('Error adding item to cart:', error);
      const msg = error?.error?.message || this.translate.instant('error_occurred');
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

  async onQuantityChange(item: any, newQuantity: number) {
    if (!this.cart) return;
    if (newQuantity <= 0) {
      return;
    }
    this.cartSaving = true;
    try {
      const updated$ = await this.posService.updateCartItem(item.cartItemId, newQuantity);
      const updatedCart = await firstValueFrom(updated$);
      // Normalize cart to recalculate totals
      this.cart = this.normalizeCartItems(updatedCart);
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error updating cart item:', error);
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

  async applyDiscount(amount: number, type: 'Amount' | 'Percentage') {
    if (!this.cart) return;
    if (amount < 0) {
      return;
    }
    this.cartSaving = true;
    try {
      const updated$ = await this.posService.updateCartDiscount(this.cart.cartId, amount, type);
      const updatedCart = await firstValueFrom(updated$);
      // Normalize cart to recalculate totals
      this.cart = this.normalizeCartItems(updatedCart);
      this.updateCartTracking();
      this.saveToLocalStorage();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('discount_applied'),
        life: 2000
      });
    } catch (error) {
      console.error('Error applying discount:', error);
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

  onTaxSwitchChange() {
    if (!this.cart) return;
    // Use setTimeout to defer the async call to avoid change detection error
    setTimeout(() => {
      this.toggleTax();
    }, 0);
  }

  async toggleTax() {
    if (!this.cart) return;
    this.cartSaving = true;
    try {
      const updated$ = await this.posService.toggleTax(this.cart.cartId, this.taxEnabled);
      const updatedCart = await firstValueFrom(updated$);
      
      // Normalize cart to recalculate totals
      this.cart = this.normalizeCartItems(updatedCart);
      
      // Ensure taxEnabled is properly set and sync with local property
      if (this.cart) {
        this.cart.taxEnabled = this.cart.taxEnabled ?? this.taxEnabled;
        this.taxEnabled = this.cart.taxEnabled;
      }
      
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
      const newCart$ = await this.posService.createCart(this.session.sessionId);
      const newCart = await firstValueFrom(newCart$);
      // Normalize cart to ensure totals are correct
      this.cart = this.normalizeCartItems(newCart);
      this.updateCartTracking();
      this.saveToLocalStorage();
    } catch (error) {
      console.error('Error clearing cart:', error);
    } finally {
      this.cartSaving = false;
    }
  }

  // ========== Hold / resume ==========

  async openHoldCarts() {
    if (!this.shopId) return;
    try {
      const holds$ = await this.posService.getHoldCarts(this.shopId);
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
      this.cart = this.normalizeCartItems(resumedCart);
      
      // Ensure items array is initialized
      if (this.cart && !this.cart.items) {
        this.cart.items = [];
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
      
      // Reload hold carts list to reflect changes
      if (this.shopId) {
        try {
          const holds$ = await this.posService.getHoldCarts(this.shopId);
          const carts = await firstValueFrom(holds$);
          this.holdCarts = Array.isArray(carts) ? carts.map(c => this.normalizeCartItems(c)) : [];
        } catch (error) {
          console.error('Error reloading hold carts:', error);
        }
      }
      
      this.holdCartsDialog = false;
      this.saveToLocalStorage();
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('cart_resumed_success'),
        life: 2000
      });
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

  trackByCartId(index: number, cart: POSCartDTO): any {
    return cart.cartId;
  }

  // ========== Checkout ==========

  openCheckout() {
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
    this.checkoutPayments = [{
      method: 'Cash',
      amount: this.cart.totalAmount
    }];
    this.checkoutNotes = '';
    this.printReceipt = true;
    this.checkoutDialog = true;
  }

  get totalPaid(): number {
    return this.checkoutPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  get remainingToPay(): number {
    if (!this.cart) return 0;
    return (this.cart.totalAmount || 0) - this.totalPaid;
  }

  addPaymentLine() {
    this.checkoutPayments.push({
      method: 'Cash',
      amount: 0
    });
  }

  removePaymentLine(index: number) {
    if (this.checkoutPayments.length === 1) {
      return;
    }
    this.checkoutPayments.splice(index, 1);
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

    const total = this.cart.totalAmount || 0;
    const paid = this.totalPaid;

    if (total <= 0 || paid <= 0) {
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
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('payment_amount_invalid'),
        life: 3000
      });
      return;
    }

    // Check if offline
    const isOffline = !this.isOnline || this.onlineStatus === 'offline';

    const checkoutDto: POSCheckoutDTO = {
      cartId: this.cart.cartId,
      customerId: this.cart.customerId,
      payments: this.checkoutPayments,
      notes: this.checkoutNotes,
      printReceipt: this.printReceipt
    };

    this.cartSaving = true;
    try {
      if (this.isOnline) {
        // Online checkout
        const receipt$ = await this.posService.checkout(this.cart.cartId, checkoutDto);
        this.lastReceipt = await firstValueFrom(receipt$);
        this.checkoutDialog = false;
        this.receiptDialog = true;

        if (this.session) {
          const newCart$ = await this.posService.createCart(this.session.sessionId);
          const newCart = await firstValueFrom(newCart$);
          // Normalize cart to ensure totals are correct
          this.cart = this.normalizeCartItems(newCart);
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
    if (this.lastReceipt) {
      window.print();
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
      // Always normalize to ensure calculations are correct
      this.cart = this.normalizeCartItems(freshCart);
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
        this.cart = this.normalizeCartItems(newCart);
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

  async unlockPos() {
    if (!this.lockPinInput) return;
    
    try {
      // Verify PIN - you can integrate with your auth service
      const profile = await this.keycloakService.loadUserProfile();
      // For now, we'll use a simple check - you should implement proper PIN verification
      // This is a placeholder - implement your actual PIN verification logic
      const isValid = true; // Replace with actual PIN check
      
      if (isValid) {
        this.isLocked = false;
        this.lockPinInput = '';
        this.updateActivity();
        this.focusBarcodeInput();
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('pos_unlocked'),
          life: 2000
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('error'),
          detail: this.translate.instant('invalid_pin'),
          life: 3000
        });
        this.lockPinInput = '';
      }
    } catch (error) {
      console.error('Error unlocking POS:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_occurred'),
        life: 3000
      });
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
    // Verify manager PIN
    const isValid = true; // Replace with actual manager PIN check
    
    if (isValid && this.managerApprovalCallback) {
      this.managerApprovalCallback();
      this.managerApprovalDialog = false;
      this.managerApprovalCallback = null;
      this.managerApprovalReason = '';
    } else {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_pin'),
        life: 3000
      });
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
  
  showOpenSessionDialog() {
    if (!this.shopId) {
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
    this.openSessionDialog = true;
  }

  async openSession() {
    if (!this.shopId) {
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

    this.loading = true;
    try {
      const started$ = await this.posService.startSession(
        this.shopId,
        this.sessionCashRegisterId || undefined
      );
      const newSession = await firstValueFrom(started$);
      
      // Refresh session state to get the full session object from server
      await this.refreshSessionState();
      
      this.openSessionDialog = false;
      this.sessionCashRegisterId = null;
      this.sessionNotes = '';
      
      // Create initial cart
      if (this.session) {
        try {
          const cart$ = await this.posService.createCart(this.session.sessionId);
          this.cart = this.normalizeCartItems(await firstValueFrom(cart$));
          this.selectedCustomer = { customerId: null, fullName: 'Walk-in Customer' };
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

  showCloseSessionDialog() {
    if (!this.session) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('no_active_session'),
        life: 3000
      });
      return;
    }
    
    // Check if there are active carts with items
    if (this.cart && this.cart.items && this.cart.items.length > 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('cannot_close_session_with_active_cart'),
        life: 4000
      });
      return;
    }
    
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

    // Final check for active carts
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

    this.loading = true;
    try {
      const sessionId = this.session.sessionId;
      await firstValueFrom(await this.posService.endSession(sessionId));
      
      // Close dialog first
      this.closeSessionDialog = false;
      this.closingSessionNotes = '';
      
      // Refresh session state from server to confirm it's closed
      await this.refreshSessionState();
      
      // Double-check that session is actually closed
      if (this.session && this.session.sessionId === sessionId) {
        // Session still exists, force clear it
        console.warn('Session still exists after close, forcing clear');
        this.session = null;
        this.cart = null;
        this.saveToLocalStorage();
      }
      
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
    if (!this.shopId) {
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
        // Load all customers if not already loaded (for broader search)
        if (query.length >= 1) {
          (this.customerService as any).loadToken && await (this.customerService as any).loadToken();
          const customers$ = this.customerService.getCustomers();
          const allCustomers = await firstValueFrom(customers$);
          this.customers = Array.isArray(allCustomers) ? allCustomers : [];
          // Add fullName property if not present and filter out null IDs and walk-in customers
          this.customers = this.customers
            .filter(c => c.customerId != null && !this.isWalkInCustomer(c))
            .map(c => ({
              ...c,
              fullName: c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unknown'
            }));
          
          if (!query || query.length === 0) {
            // Show initial suggestions
            this.customerSuggestions = [
              { customerId: null, fullName: walkInLabel },
              ...this.customers.slice(0, 10)
            ];
            return;
          }
          
          // Filter customers by query (exclude walk-in customer)
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
          
          // Always include walk-in customer as first option
          this.customerSuggestions = [
            { customerId: null, fullName: walkInLabel },
            ...filtered
          ];
        } else {
          // Show initial suggestions when no query
          this.customerSuggestions = [{ customerId: null, fullName: walkInLabel }];
        }
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      // Fallback to walk-in customer
      this.customerSuggestions = [{ customerId: null, fullName: walkInLabel }];
    }
  }

  onCustomerSelect(customer: any) {
    this.selectedCustomer = customer;
    this.onCustomerChange(customer.customerId);
  }

  addToCart(product: any) {
    this.addProductToCart(product, 1);
  }

  updateQuantity(item: any, newQuantity: number) {
    const quantity = Math.max(1, Math.min(newQuantity, item.quantityAvailable || 999));
    this.onQuantityChange(item, quantity);
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
    this.scannerDialog = true;
    this.scannerEnabled = false;
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
        this.scannerEnabled = true;
      } else {
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
    // The result can be a string or an object with getText() method
    const barcode = typeof result === 'string' ? result : (result?.getText ? result.getText() : result);
    if (barcode && String(barcode).trim()) {
      const barcodeStr = String(barcode).trim();
      this.lastScanResult = barcodeStr;
      // Close scanner dialog
      this.closeScanner();
      // Process the barcode
      this.barcodeInput = barcodeStr;
      this.onBarcodeEnter();
    }
  }

  onScanError(error: any) {
    console.error('Scanner error:', error);
    // Don't show error to user unless it's a critical error
  }

  onCamerasFound(cameras: MediaDeviceInfo[]) {
    this.availableDevices = cameras;
    if (cameras.length > 0 && !this.currentDevice) {
      this.currentDevice = cameras[0];
      this.currentDeviceId = this.currentDevice.deviceId;
    }
  }

  onDeviceSelectChange(deviceId: string) {
    const device = this.availableDevices.find(d => d.deviceId === deviceId);
    if (device) {
      this.currentDevice = device;
      this.currentDeviceId = device.deviceId;
    }
  }

  closeScanner() {
    this.scannerDialog = false;
    this.scannerEnabled = false;
    this.lastScanResult = '';
    this.currentDeviceId = null;
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


  onProductSelect(product: any) {
    if (product) {
      this.addToCart(product);
      // Clear search query after selection
      this.searchQuery = '';
      this.searchSuggestions = [];
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

  // =============== Returns & Refunds Methods ===============

  async searchOrdersForReturn(event: any) {
    const query = event.query?.toLowerCase() || '';
    if (!query || query.length < 2) {
      this.returnOrderSuggestions = [];
      return;
    }

    try {
      (this.orderService as any).loadToken && (this.orderService as any).loadToken();
      const orders$ = this.orderService.getOrdersPaginated(0, 20, query, 'orderDate', 'DESC');
      const response: any = await firstValueFrom(orders$);
      this.returnOrderSuggestions = (response && response['content']) ? response['content'] : [];
    } catch (error) {
      console.error('Error searching orders:', error);
      this.returnOrderSuggestions = [];
    }
  }

  onOrderSelectForReturn(order: any) {
    if (order && order.orderItems) {
      this.selectedOrderForReturn = order;
      this.returnItems = order.orderItems.map((item: any) => ({
        ...item,
        returnQuantity: 0,
        returnReason: 'INCORRECT_ITEM',
        condition: 'NEW',
        refundAmount: 0
      }));
      this.returnDialog = true;
    }
  }

  calculateReturnItemRefund(item: any) {
    if (item.returnQuantity && item.returnQuantity > 0) {
      const unitPrice = item.unitPrice || item.sellingPrice || 0;
      item.refundAmount = unitPrice * item.returnQuantity;
    } else {
      item.refundAmount = 0;
    }
  }

  getTotalReturnAmount(): number {
    return this.returnItems.reduce((total, item) => {
      return total + (item.refundAmount || 0);
    }, 0);
  }

  async processReturn() {
    if (!this.selectedOrderForReturn) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('no_order_selected'),
        life: 3000
      });
      return;
    }

    const itemsToReturn = this.returnItems.filter(item => item.returnQuantity > 0);
    if (itemsToReturn.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('select_items_to_return'),
        life: 3000
      });
      return;
    }

    try {
      const returnedItems = itemsToReturn.map(item => ({
        orderItemId: item.orderItemId || item.id,
        returnedQuantity: item.returnQuantity,
        reason: item.returnReason || 'INCORRECT_ITEM',
        condition: item.condition || 'NEW'
      }));

      (this.orderService as any).loadToken && (this.orderService as any).loadToken();
      const return$ = this.orderService.processReturn(
        this.selectedOrderForReturn.orderId,
        returnedItems,
        'CUSTOMER_REQUEST',
        ''
      );
      
      const returnResult = await firstValueFrom(return$);
      
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('return_processed_successfully'),
        life: 3000
      });

      // Open refund dialog
      this.selectedReturn = returnResult;
      this.refundAmount = this.getTotalReturnAmount();
      this.returnDialog = false;
      this.refundDialog = true;
    } catch (error: any) {
      console.error('Error processing return:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_processing_return'),
        life: 3000
      });
    }
  }

  async processRefund() {
    if (!this.selectedReturn || this.refundAmount <= 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_refund_amount'),
        life: 3000
      });
      return;
    }

    try {
      (this.refundService as any).loadToken && (this.refundService as any).loadToken();
      
      const refund = {
        orderReturn: { returnId: this.selectedReturn.returnId },
        amount: this.refundAmount,
        refundMethod: this.refundMethod.toUpperCase(),
        notes: this.refundNotes,
        refundDate: new Date().toISOString().split('T')[0]
      };

      const refund$ = this.refundService.saveRefund(refund);
      await firstValueFrom(refund$);

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('refund_processed_successfully'),
        life: 3000
      });

      // Reset
      this.refundDialog = false;
      this.selectedReturn = null;
      this.selectedOrderForReturn = null;
      this.returnItems = [];
      this.refundAmount = 0;
      this.refundNotes = '';
      this.returnOrderSearch = '';
    } catch (error: any) {
      console.error('Error processing refund:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error.error?.message || this.translate.instant('error_processing_refund'),
        life: 3000
      });
    }
  }

  cancelReturn() {
    this.returnDialog = false;
    this.selectedOrderForReturn = null;
    this.returnItems = [];
    this.returnOrderSearch = '';
  }

  cancelRefund() {
    this.refundDialog = false;
    this.selectedReturn = null;
    this.refundAmount = 0;
    this.refundNotes = '';
  }
}


