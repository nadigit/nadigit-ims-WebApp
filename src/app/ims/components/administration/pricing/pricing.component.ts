import { Component, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Product } from 'src/app/models/product';
import { PriceListDTO, PriceListItemDTO } from 'src/app/models/pricing';
import { PricingService } from 'src/app/services/pricing.service';
import { ProductService } from 'src/app/services/product.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';

@Component({
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class PricingComponent implements OnInit, OnDestroy {
  isLoading = true;
  isLoadingItems = false;
  savingPriceList = false;
  savingItem = false;
  currency: string = 'USD';
  /** TabView: 0 = price lists, 1 = tier rules */
  activeTabIndex = 0;
  private readonly destroy$ = new Subject<void>();

  priceLists: PriceListDTO[] = [];
  selectedPriceList: PriceListDTO | null = null;
  priceListItems: PriceListItemDTO[] = [];

  priceListDialog = false;
  priceListSubmitted = false;
  priceListForm: PriceListDTO = this.getEmptyPriceList();
  isEditingPriceList = false;

  itemDialog = false;
  itemSubmitted = false;
  itemForm: PriceListItemDTO = this.getEmptyItem();
  isEditingItem = false;
  selectedProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productsLoading = false;

  constructor(
    private pricingService: PricingService,
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private translateService: TranslationService,
    private configService: AppConfigurationService
  ) {}

  async ngOnInit() {
    this.translateService.currentLanguage$
      .pipe(takeUntil(this.destroy$))
      .subscribe(lang => this.translate.use(lang));
    this.configService.currency$
      .pipe(takeUntil(this.destroy$))
      .subscribe((c) => {
        if (c) this.currency = c;
      });
    await this.configService.loadCurrencyOnce();
    await this.loadPriceLists();
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadPriceLists(): Promise<void> {
    try {
      const lists = await firstValueFrom(await this.pricingService.getPriceLists());
      this.priceLists = Array.isArray(lists) ? lists : [];
      if (this.priceLists.length > 0 && !this.selectedPriceList) {
        this.selectedPriceList = this.priceLists[0];
        await this.loadPriceListItems();
      }
    } catch (error) {
      console.error('Error loading price lists:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_price_lists'),
        life: 3000
      });
    }
  }

  async loadPriceListItems(): Promise<void> {
    if (!this.selectedPriceList?.id) {
      this.priceListItems = [];
      return;
    }
    this.isLoadingItems = true;
    try {
      const items = await firstValueFrom(
        await this.pricingService.getPriceListItems(this.selectedPriceList.id)
      );
      // The backend returns productName with each item (PriceListItemDTO); the
      // table falls back to "#<id>" when it is absent (see tierProductDisplayName).
      // We intentionally do NOT resolve names per-id here: with many rules that
      // fired one getProduct() request per product in parallel and tripped the
      // API rate limiter (429).
      this.priceListItems = Array.isArray(items) ? items : [];
    } catch (error) {
      console.error('Error loading price list items:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_price_list_items'),
        life: 3000
      });
    } finally {
      this.isLoadingItems = false;
    }
  }

  async onPriceListChange(): Promise<void> {
    await this.loadPriceListItems();
  }

  openNewPriceList(): void {
    this.isEditingPriceList = false;
    this.priceListSubmitted = false;
    this.priceListForm = this.getEmptyPriceList();
    this.priceListDialog = true;
  }

  editPriceList(list: PriceListDTO): void {
    this.isEditingPriceList = true;
    this.priceListSubmitted = false;
    this.priceListForm = { ...list };
    this.priceListDialog = true;
  }

  closePriceListDialog(): void {
    this.priceListDialog = false;
    this.priceListSubmitted = false;
  }

  /** Switch to tier rules tab with this list pre-selected (fewer clicks). */
  async openTierRulesForList(list: PriceListDTO): Promise<void> {
    this.selectedPriceList = list;
    this.activeTabIndex = 1;
    await this.loadPriceListItems();
  }

  async savePriceList(): Promise<void> {
    this.priceListSubmitted = true;
    if (!this.priceListForm.name?.trim()) {
      return;
    }
    this.savingPriceList = true;
    try {
      if (this.isEditingPriceList && this.priceListForm.id) {
        await firstValueFrom(
          await this.pricingService.updatePriceList(this.priceListForm.id, this.priceListForm)
        );
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('price_list_updated'),
          life: 3000
        });
      } else {
        await firstValueFrom(await this.pricingService.createPriceList(this.priceListForm));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('price_list_created'),
          life: 3000
        });
      }
      this.priceListDialog = false;
      await this.loadPriceLists();
    } catch (error) {
      console.error('Error saving price list:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_saving_price_list'),
        life: 3000
      });
    } finally {
      this.savingPriceList = false;
    }
  }

  openNewItem(): void {
    if (!this.selectedPriceList?.id) {
      return;
    }
    this.isEditingItem = false;
    this.itemSubmitted = false;
    this.itemForm = this.getEmptyItem();
    this.itemForm.priceListId = this.selectedPriceList.id;
    this.selectedProduct = null;
    this.itemDialog = true;
  }

  editItem(item: PriceListItemDTO): void {
    this.isEditingItem = true;
    this.itemSubmitted = false;
    this.itemForm = { ...item };
    this.selectedProduct = {
      productId: item.productId,
      name: item.productName || `#${item.productId}`,
      reference: ''
    } as Product;
    this.itemDialog = true;
  }

  closeItemDialog(): void {
    this.itemDialog = false;
    this.itemSubmitted = false;
  }

  async saveItem(): Promise<void> {
    this.itemSubmitted = true;

    if (!this.itemForm.priceListId) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('price_list_required'),
        life: 3000
      });
      return;
    }

    if (!this.itemForm.productId) {
      return;
    }

    if (this.itemForm.minQty == null || this.itemForm.minQty < 1) {
      return;
    }

    if (this.itemForm.unitPrice == null || this.itemForm.unitPrice < 0) {
      return;
    }
    if (this.itemForm.maxQty != null && this.itemForm.maxQty < this.itemForm.minQty) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('max_qty_must_be_greater_or_equal_min'),
        life: 3000
      });
      return;
    }

    const overlapping = this.findOverlappingTierRuleForCurrentForm();
    if (overlapping) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('pricing_tier_rule_overlap'),
        life: 6000
      });
      return;
    }

    this.savingItem = true;
    try {
      if (this.isEditingItem && this.itemForm.id) {
        await firstValueFrom(
          await this.pricingService.updatePriceListItem(this.itemForm.id, this.itemForm)
        );
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('price_list_item_updated'),
          life: 3000
        });
      } else {
        await firstValueFrom(
          await this.pricingService.createPriceListItem(this.itemForm.priceListId, this.itemForm)
        );
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('price_list_item_created'),
          life: 3000
        });
      }
      this.itemDialog = false;
      await this.loadPriceListItems();
    } catch (error) {
      console.error('Error saving price list item:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.getPricingItemSaveErrorMessage(error),
        life: 5000
      });
    } finally {
      this.savingItem = false;
    }
  }

  confirmDeleteItem(item: PriceListItemDTO): void {
    this.confirmationService.confirm({
      message: this.translate.instant('delete_price_list_item_confirm'),
      header: this.translate.instant('confirm_delete'),
      icon: 'pi pi-exclamation-triangle',
      accept: () => this.deleteItem(item)
    });
  }

  async deleteItem(item: PriceListItemDTO): Promise<void> {
    if (!item.id) return;
    try {
      await firstValueFrom(await this.pricingService.deletePriceListItem(item.id));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('price_list_item_deleted'),
        life: 3000
      });
      await this.loadPriceListItems();
    } catch (error) {
      console.error('Error deleting price list item:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_deleting_price_list_item'),
        life: 3000
      });
    }
  }

  async searchProducts(event: any): Promise<void> {
    const query = event.query || '';
    this.productsLoading = true;
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(this.productService.searchProductsForOrder(query));
      this.productSuggestions = Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Error searching products:', error);
      this.productSuggestions = [];
    } finally {
      this.productsLoading = false;
    }
  }

  onProductSelect(event: any): void {
    const product = event?.value;
    const id = product?.productId ?? product?.id;
    if (product == null || id == null) return;
    this.itemForm.productId = Number(id);
    this.itemForm.productName = product.name || '';
  }

  onProductChange(product: Product | null): void {
    const id = product?.productId ?? (product as any)?.id;
    if (id != null) {
      this.itemForm.productId = Number(id);
      this.itemForm.productName = product!.name || '';
    } else if (!product) {
      // Clear the form if product is cleared
      this.itemForm.productId = null as any;
      this.itemForm.productName = '';
    }
  }

  formatUnitPrice(value: number | null | undefined): string {
    if (value == null || Number.isNaN(Number(value))) return '—';
    const code = (this.currency || 'USD').trim() || 'USD';
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: code,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(Number(value));
    } catch {
      return `${code} ${Number(value).toFixed(2)}`;
    }
  }

  tierProductDisplayName(item: PriceListItemDTO): string {
    return item.productName?.trim() || `#${item.productId}`;
  }

  autocompleteProductLabel(product: Product | null): string {
    if (!product) return '';
    const ref = product.reference?.trim();
    const name = product.name?.trim() || '';
    if (ref && name) return `${ref} — ${name}`;
    return name || ref || '';
  }

  /** Inclusive quantity bands [min, max] where null max means no upper bound. */
  private tierQtyRangesOverlap(
    minA: number,
    maxA: number | null | undefined,
    minB: number,
    maxB: number | null | undefined
  ): boolean {
    const high = (max: number | null | undefined) =>
      max == null ? Number.POSITIVE_INFINITY : Number(max);
    const endA = high(maxA);
    const endB = high(maxB);
    return !(endA < minB || endB < minA);
  }

  /** Another rule for the same product with an overlapping min/max band (excluding current row when editing). */
  private findOverlappingTierRuleForCurrentForm(): PriceListItemDTO | null {
    const pid = Number(this.itemForm.productId);
    const selfId = this.itemForm.id;
    const minQ = Number(this.itemForm.minQty);

    for (const other of this.priceListItems) {
      if (Number(other.productId) !== pid) continue;
      if (selfId != null && other.id != null && Number(other.id) === Number(selfId)) continue;
      if (this.tierQtyRangesOverlap(minQ, this.itemForm.maxQty, other.minQty, other.maxQty)) {
        return other;
      }
    }
    return null;
  }

  private getPricingItemSaveErrorMessage(error: any): string {
    const fallback = this.translate.instant('error_saving_price_list_item');
    if (!error) return fallback;

    const body = error.error;
    let msg = '';
    if (typeof body === 'string') {
      msg = body;
    } else if (body && typeof body === 'object') {
      msg = String((body as any).message || (body as any).detail || (body as any).error || (body as any).title || '');
      const errs = (body as any).errors;
      if (Array.isArray(errs) && errs.length) {
        msg = errs.map((e: any) => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).join('; ');
      }
    }
    if (!msg && error.message) msg = String(error.message);
    const m = msg.toLowerCase();
    if (
      m.includes('duplicate') ||
      m.includes('unique constraint') ||
      m.includes('already exists') ||
      m.includes('uq_') ||
      m.includes('violates unique') ||
      m.includes('duplicate key')
    ) {
      return this.translate.instant('pricing_tier_rule_duplicate_error');
    }
    if (m.includes('overlap') || m.includes('overlapping')) {
      return this.translate.instant('pricing_tier_rule_overlap');
    }
    return msg.trim() ? msg : fallback;
  }

  getPriceListLabel(list: PriceListDTO | null | undefined): string {
    if (!list?.name) return '';
    const key = `price_list_${list.name.toLowerCase()}`;
    const translated = this.translate.instant(key);
    return translated && translated !== key ? translated : list.name;
  }

  getPriceListDescription(list: PriceListDTO | null | undefined): string {
    if (!list?.description || !list?.name) {
      return list?.description || '';
    }
    const key = `price_list_${list.name.toLowerCase()}_desc`;
    const translated = this.translate.instant(key);
    return translated && translated !== key ? translated : list.description;
  }

  private getEmptyPriceList(): PriceListDTO {
    return {
      name: '',
      description: '',
      active: true,
      priority: 0
    };
  }

  private getEmptyItem(): PriceListItemDTO {
    return {
      priceListId: this.selectedPriceList?.id || 0,
      productId: null as any,
      productName: '',
      minQty: null as any,
      maxQty: null as any,
      unitPrice: null as any,
      active: true
    };
  }
}
