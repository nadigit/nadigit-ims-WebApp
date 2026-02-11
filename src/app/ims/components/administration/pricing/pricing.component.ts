import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { Product } from 'src/app/models/product';
import { CustomerPriceOverrideDTO, PriceListDTO, PriceListItemDTO } from 'src/app/models/pricing';
import { PricingService } from 'src/app/services/pricing.service';
import { ProductService } from 'src/app/services/product.service';
import { TranslateService } from '@ngx-translate/core';
import { TranslationService } from 'src/app/services/translation.service';

@Component({
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class PricingComponent implements OnInit {
  isLoading = true;
  priceLists: PriceListDTO[] = [];
  selectedPriceList: PriceListDTO | null = null;
  priceListItems: PriceListItemDTO[] = [];

  priceListDialog = false;
  priceListForm: PriceListDTO = this.getEmptyPriceList();
  isEditingPriceList = false;

  itemDialog = false;
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
    private translateService: TranslationService
  ) {}

  async ngOnInit() {
    this.translateService.currentLanguage$.subscribe(lang => this.translate.use(lang));
    await this.loadPriceLists();
    this.isLoading = false;
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
    try {
      const items = await firstValueFrom(
        await this.pricingService.getPriceListItems(this.selectedPriceList.id)
      );
      this.priceListItems = Array.isArray(items) ? items : [];

      // Ensure productName is populated for display, even if backend doesn't send it
      const itemsNeedingName = this.priceListItems.filter(
        i => !!i.productId && !i.productName
      );

      if (itemsNeedingName.length > 0) {
        try {
          this.productService.loadToken();
          const uniqueProductIds = Array.from(
            new Set(itemsNeedingName.map(i => i.productId))
          );

          const productMap = new Map<number, string>();
          await Promise.all(
            uniqueProductIds.map(async (id) => {
              try {
                const product: any = await firstValueFrom(this.productService.getProduct(id));
                if (product && product.name) {
                  productMap.set(id, product.name);
                }
              } catch {
                // Ignore individual product load errors
              }
            })
          );

          this.priceListItems = this.priceListItems.map(i => ({
            ...i,
            productName: i.productName || (i.productId && productMap.get(i.productId)) || i.productName
          }));
        } catch (e) {
          console.error('Error enriching price list items with product names:', e);
        }
      }
    } catch (error) {
      console.error('Error loading price list items:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_price_list_items'),
        life: 3000
      });
    }
  }

  onPriceListChange(): void {
    this.loadPriceListItems();
  }

  openNewPriceList(): void {
    this.isEditingPriceList = false;
    this.priceListForm = this.getEmptyPriceList();
    this.priceListDialog = true;
  }

  editPriceList(list: PriceListDTO): void {
    this.isEditingPriceList = true;
    this.priceListForm = { ...list };
    this.priceListDialog = true;
  }

  async savePriceList(): Promise<void> {
    if (!this.priceListForm.name?.trim()) {
      return;
    }
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
    }
  }

  openNewItem(): void {
    if (!this.selectedPriceList?.id) {
      return;
    }
    this.isEditingItem = false;
    this.itemForm = this.getEmptyItem();
    this.itemForm.priceListId = this.selectedPriceList.id;
    this.selectedProduct = null;
    this.itemDialog = true;
  }

  editItem(item: PriceListItemDTO): void {
    this.isEditingItem = true;
    this.itemForm = { ...item };
    this.selectedProduct = null;
    this.itemDialog = true;
  }

  async saveItem(): Promise<void> {
    // Validate required fields and show error messages
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
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('product_required'),
        life: 3000
      });
      return;
    }

    if (this.itemForm.minQty == null || this.itemForm.minQty < 1) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('min_qty_required'),
        life: 3000
      });
      return;
    }

    if (this.itemForm.unitPrice == null || this.itemForm.unitPrice < 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('unit_price_required'),
        life: 3000
      });
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
        detail: this.translate.instant('error_saving_price_list_item'),
        life: 3000
      });
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
    const product = event.value;
    if (!product?.productId) return;
    this.itemForm.productId = product.productId;
    this.itemForm.productName = product.name;
  }

  onProductChange(product: Product): void {
    if (product?.productId) {
      this.itemForm.productId = product.productId;
      this.itemForm.productName = product.name;
    } else if (!product) {
      // Clear the form if product is cleared
      this.itemForm.productId = null as any;
      this.itemForm.productName = '';
    }
  }

  getProductDisplay(item: PriceListItemDTO): string {
    return item.productName || `#${item.productId}`;
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
