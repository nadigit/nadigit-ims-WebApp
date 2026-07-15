import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { LineOption, LineOptionSet, LineOptionSelectionMode } from 'src/app/models/line-option-set';
import { LineOptionSetService } from 'src/app/services/line-option-set.service';
import { ProductService } from 'src/app/services/product.service';
import { CategoryService } from 'src/app/services/category.service';
import { Product } from 'src/app/models/product';
import { Category } from 'src/app/models/category';
import { TranslationService } from 'src/app/services/translation.service';

/**
 * Create/edit dialog for a sale-line option set, shared between the central
 * management page and the embedded product/category attach controls.
 * When `lockProductId`/`lockCategoryId` is set the scope pickers are hidden
 * and the saved set is forced onto that entity.
 */
@Component({
  selector: 'app-line-option-set-dialog',
  templateUrl: './line-option-set-dialog.component.html',
  styleUrls: ['./line-option-set-dialog.component.css']
})
export class LineOptionSetDialogComponent implements OnInit, OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Set to edit; null means create a new one. */
  @Input() set: LineOptionSet | null = null;
  /** When present, the set is pinned to this product and scope pickers are hidden. */
  @Input() lockProductId: number | null = null;
  /** When present, the set is pinned to this category and scope pickers are hidden. */
  @Input() lockCategoryId: number | null = null;
  @Output() saved = new EventEmitter<LineOptionSet>();

  isEdit = false;
  submitted = false;
  saving = false;
  form: LineOptionSet = this.emptyForm();
  options: LineOption[] = [];

  selectionModeOptions: { label: string; value: LineOptionSelectionMode }[] = [];

  /** Free scope pickers (central page only). */
  selectedProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productSuggestionsLoading = false;
  categoryOptions: { label: string; value: number | null }[] = [];
  private categoriesLoaded = false;

  private langSub?: Subscription;

  constructor(
    private lineOptionSetService: LineOptionSetService,
    private productService: ProductService,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private translate: TranslateService,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    this.rebuildSelectionModeOptions();
    this.langSub = this.translationService.currentLanguage$.subscribe(() => {
      this.rebuildSelectionModeOptions();
    });
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.initFromInput();
    }
  }

  get scopeLocked(): boolean {
    return this.lockProductId != null || this.lockCategoryId != null;
  }

  private rebuildSelectionModeOptions(): void {
    this.selectionModeOptions = [
      { label: this.translate.instant('line_option_set_mode_single'), value: 'SINGLE' },
      { label: this.translate.instant('line_option_set_mode_multi'), value: 'MULTI' }
    ];
  }

  private emptyForm(): LineOptionSet {
    return {
      code: '',
      label: '',
      selectionMode: 'SINGLE',
      minSelect: 0,
      maxSelect: null,
      active: true,
      productId: null,
      categoryId: null
    };
  }

  private initFromInput(): void {
    this.submitted = false;
    this.saving = false;
    this.isEdit = this.set?.lineOptionSetId != null;
    if (this.set) {
      this.form = {
        lineOptionSetId: this.set.lineOptionSetId,
        code: this.set.code || '',
        label: this.set.label || '',
        selectionMode: this.set.selectionMode === 'MULTI' ? 'MULTI' : 'SINGLE',
        minSelect: this.set.minSelect ?? 0,
        maxSelect: this.set.maxSelect ?? null,
        active: this.set.active !== false,
        productId: this.set.productId ?? null,
        categoryId: this.set.categoryId ?? null
      };
      this.options = (this.set.options || []).map(o => ({ ...o }));
      this.options.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    } else {
      this.form = this.emptyForm();
      this.options = [];
    }
    if (!this.scopeLocked) {
      this.selectedProduct = this.set?.productId
        ? ({
            productId: this.set.productId,
            name: this.set.productName || `#${this.set.productId}`,
            reference: this.set.productReference || undefined
          } as Product)
        : null;
      void this.loadCategories();
    }
  }

  private async loadCategories(): Promise<void> {
    if (this.categoriesLoaded) return;
    try {
      this.categoryService.loadToken();
      const res = await firstValueFrom(this.categoryService.getCategories());
      const list = Array.isArray(res) ? (res as Category[]) : [];
      this.categoryOptions = [
        { label: '—', value: null },
        ...list
          .filter((c) => c.categoryId != null)
          .map((c) => ({ label: c.categoryName || String(c.categoryId), value: c.categoryId! }))
          .sort((a, b) => a.label.localeCompare(b.label))
      ];
      this.categoriesLoaded = true;
    } catch (e) {
      console.error(e);
      this.categoryOptions = [{ label: '—', value: null }];
    }
  }

  async searchProducts(event: any): Promise<void> {
    const query = event.query || '';
    this.productSuggestionsLoading = true;
    try {
      this.productService.loadToken();
      const response = await firstValueFrom(this.productService.searchProductsForOrder(query));
      this.productSuggestions = Array.isArray(response) ? response : [];
    } catch (e) {
      console.error('Error searching products:', e);
      this.productSuggestions = [];
    } finally {
      this.productSuggestionsLoading = false;
    }
  }

  /** Scope is product OR category — picking one clears the other. */
  onProductPicked(): void {
    if (this.selectedProduct?.productId != null) {
      this.form.categoryId = null;
    }
  }

  onCategoryPicked(): void {
    if (this.form.categoryId != null) {
      this.selectedProduct = null;
    }
  }

  addOption(): void {
    const nextOrder = this.options.reduce((max, o) => Math.max(max, o.sortOrder ?? 0), 0) + 10;
    this.options = [
      ...this.options,
      { code: '', label: '', sortOrder: nextOrder, defaultSelected: false, suppressesAdjustments: false, active: true }
    ];
  }

  removeOption(index: number): void {
    this.options = this.options.filter((_, i) => i !== index);
  }

  optionCodeDuplicated(index: number): boolean {
    const code = (this.options[index]?.code || '').trim().toLowerCase();
    if (!code) return false;
    return this.options.some((o, i) => i !== index && (o.code || '').trim().toLowerCase() === code);
  }

  get maxSelectInvalid(): boolean {
    const max = this.form.maxSelect;
    if (max == null) return false;
    return max < 1 || max < (this.form.minSelect ?? 0);
  }

  get optionsHaveMissingFields(): boolean {
    return this.options.some((o) => !o.code?.trim() || !o.label?.trim());
  }

  private optionsInvalid(): boolean {
    return this.optionsHaveMissingFields || this.options.some((_, i) => this.optionCodeDuplicated(i));
  }

  hideDialog(): void {
    this.visible = false;
    this.visibleChange.emit(false);
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (!this.form.code?.trim() || !this.form.label?.trim()) return;
    if (this.maxSelectInvalid) return;
    if (this.optionsInvalid()) return;

    const productId = this.scopeLocked
      ? this.lockProductId
      : this.selectedProduct?.productId != null
        ? Number(this.selectedProduct.productId)
        : null;
    const categoryId = this.scopeLocked
      ? this.lockCategoryId
      : this.form.categoryId != null
        ? Number(this.form.categoryId)
        : null;

    const payload: LineOptionSet = {
      code: this.form.code.trim(),
      label: this.form.label.trim(),
      selectionMode: this.form.selectionMode === 'MULTI' ? 'MULTI' : 'SINGLE',
      minSelect: this.form.minSelect != null ? Number(this.form.minSelect) : 0,
      maxSelect: this.form.maxSelect != null ? Number(this.form.maxSelect) : null,
      active: !!this.form.active,
      productId,
      categoryId,
      options: this.options.map((o, i) => ({
        lineOptionId: o.lineOptionId,
        code: (o.code || '').trim(),
        label: (o.label || '').trim(),
        sortOrder: o.sortOrder != null ? Number(o.sortOrder) : (i + 1) * 10,
        defaultSelected: !!o.defaultSelected,
        suppressesAdjustments: !!o.suppressesAdjustments,
        active: o.active !== false
      }))
    };

    this.saving = true;
    try {
      let result: LineOptionSet;
      if (this.isEdit && this.form.lineOptionSetId != null) {
        const obs = await this.lineOptionSetService.update(this.form.lineOptionSetId, payload);
        result = await firstValueFrom(obs);
      } else {
        const obs = await this.lineOptionSetService.create(payload);
        result = await firstValueFrom(obs);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('line_option_sets_saved'),
        life: 3000
      });
      this.hideDialog();
      this.saved.emit(result);
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.error?.message ||
        e?.error?.error ||
        (typeof e?.error === 'string' ? e.error : null) ||
        this.translate.instant('line_option_sets_error_save');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 6000
      });
    } finally {
      this.saving = false;
    }
  }
}
