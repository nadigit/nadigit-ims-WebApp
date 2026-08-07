import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { LineOptionSet, LineOption, LineOptionSelectionMode } from 'src/app/models/line-option-set';
import { LineOptionSetService } from 'src/app/services/line-option-set.service';
import { ProductService } from 'src/app/services/product.service';
import { CategoryService } from 'src/app/services/category.service';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { TranslationService } from 'src/app/services/translation.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

type ScopeType = 'GLOBAL' | 'PRODUCT' | 'CATEGORY';

/**
 * Manage sale-line option sets ("components": e.g. carcass cuts, toppings, add-ons). Generic — an
 * option set groups selectable options scoped to a product, a category, or all products, with
 * selection constraints. Mirrors the Tax Rules CRUD conventions.
 */
@Component({
  selector: 'app-line-option-sets',
  templateUrl: './line-option-sets.component.html',
  styleUrls: ['./line-option-sets.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class LineOptionSetsComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  @ViewChild('dt') dt?: Table;

  isLoading = true;
  sets: LineOptionSet[] = [];
  selectedSets: LineOptionSet[] = [];
  isAdmin = false;

  dialogVisible = false;
  isEdit = false;
  submitted = false;
  saving = false;
  form: LineOptionSet = this.emptyForm();

  selectionModeOptions: { label: string; value: LineOptionSelectionMode }[] = [];
  scopeTypeOptions: { label: string; value: ScopeType }[] = [];
  scopeType: ScopeType = 'GLOBAL';

  categoryOptions: { label: string; value: number | null }[] = [];
  selectedProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productSuggestionsLoading = false;

  private langSub?: Subscription;

  constructor(
    private lineOptionSetService: LineOptionSetService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloak: KeycloakService,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.translate.use(this.translationService.getPreferredLanguage());
    this.langSub = this.translationService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
      this.rebuildOptions();
    });
    this.rebuildOptions();
    const roles = await this.keycloak.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    await this.loadCategories();
    await this.refreshList();
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  onGlobalFilter(event: Event): void {
    this.dt?.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  private rebuildOptions(): void {
    this.selectionModeOptions = [
      { label: this.translate.instant('line_option_mode_single'), value: 'SINGLE' },
      { label: this.translate.instant('line_option_mode_multi'), value: 'MULTI' }
    ];
    this.scopeTypeOptions = [
      { label: this.translate.instant('line_option_scope_global'), value: 'GLOBAL' },
      { label: this.translate.instant('line_option_scope_product'), value: 'PRODUCT' },
      { label: this.translate.instant('line_option_scope_category'), value: 'CATEGORY' }
    ];
  }

  private emptyForm(): LineOptionSet {
    return {
      code: '',
      label: '',
      selectionMode: 'MULTI',
      minSelect: 0,
      maxSelect: null,
      active: true,
      productId: null,
      categoryId: null,
      options: []
    };
  }

  private async loadCategories(): Promise<void> {
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
    } catch (e) {
      console.error(e);
      this.categoryOptions = [{ label: '—', value: null }];
    }
  }

  async refreshList(): Promise<void> {
    try {
      const obs = await this.lineOptionSetService.list();
      const data = await firstValueFrom(obs);
      this.sets = Array.isArray(data) ? [...data] : [];
      this.sets.sort((a, b) => (a.label || '').localeCompare(b.label || ''));
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('line_options_error_load'),
        life: 5000
      });
      this.sets = [];
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

  scopeDisplay(set: LineOptionSet): string {
    if (set.productId) return `${this.translate.instant('line_option_scope_product')}: ${set.productName || '#' + set.productId}`;
    if (set.categoryId) return `${this.translate.instant('line_option_scope_category')}: ${set.categoryName || '#' + set.categoryId}`;
    return this.translate.instant('line_option_scope_global');
  }

  activeOptionCount(set: LineOptionSet): number {
    return (set.options || []).filter(o => o.active !== false).length;
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.isEdit = false;
    this.submitted = false;
    this.form = this.emptyForm();
    this.scopeType = 'GLOBAL';
    this.selectedProduct = null;
    this.addOption();
    this.dialogVisible = true;
  }

  openEdit(row: LineOptionSet): void {
    if (!this.isAdmin) return;
    this.isEdit = true;
    this.submitted = false;
    this.form = {
      lineOptionSetId: row.lineOptionSetId,
      code: row.code,
      label: row.label,
      selectionMode: row.selectionMode || 'MULTI',
      minSelect: row.minSelect ?? 0,
      maxSelect: row.maxSelect ?? null,
      active: row.active !== false,
      productId: row.productId ?? null,
      categoryId: row.categoryId ?? null,
      options: (row.options || []).map(o => ({ ...o }))
    };
    this.scopeType = row.productId ? 'PRODUCT' : row.categoryId ? 'CATEGORY' : 'GLOBAL';
    this.selectedProduct = row.productId
      ? ({ productId: row.productId, name: row.productName || `#${row.productId}`, reference: row.productReference || undefined } as Product)
      : null;
    this.dialogVisible = true;
  }

  hideDialog(): void {
    this.dialogVisible = false;
  }

  addOption(): void {
    this.form.options = this.form.options || [];
    this.form.options.push({
      code: '',
      label: '',
      sortOrder: this.form.options.length,
      defaultSelected: false,
      suppressesAdjustments: false,
      active: true
    });
  }

  removeOption(index: number): void {
    if (!this.form.options) return;
    this.form.options.splice(index, 1);
  }

  confirmDelete(row: LineOptionSet): void {
    if (!this.isAdmin || row.lineOptionSetId == null) return;
    this.confirmationService.confirm({
      message: this.translate.instant('line_options_delete_confirm', { label: row.label }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          const obs = await this.lineOptionSetService.remove(row.lineOptionSetId!);
          await firstValueFrom(obs);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('line_options_deleted'),
            life: 3000
          });
          await this.refreshList();
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('line_options_error_delete'),
            life: 5000
          });
        }
      }
    });
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (this.saving) return;
    if (!this.form.label?.trim()) return;
    if (!this.isEdit && !this.form.code?.trim()) return;

    const options = this.form.options || [];
    // Client-side guards (backend re-validates): each option needs a code and label; codes unique.
    const codes = new Set<string>();
    for (const o of options) {
      if (!o.code?.trim() || !o.label?.trim()) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('line_option_row_incomplete'),
          life: 4000
        });
        return;
      }
      const key = o.code.trim().toLowerCase();
      if (codes.has(key)) {
        this.messageService.add({
          severity: 'warn',
          summary: this.translate.instant('warning'),
          detail: this.translate.instant('line_option_duplicate_code', { code: o.code.trim() }),
          life: 4000
        });
        return;
      }
      codes.add(key);
    }

    const minSelect = Math.max(0, Number(this.form.minSelect) || 0);
    const maxSelect = this.form.maxSelect != null && this.form.maxSelect !== ('' as any)
      ? Number(this.form.maxSelect) : null;
    if (maxSelect != null && (maxSelect < 1 || maxSelect < minSelect)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('line_option_invalid_max_select'),
        life: 4000
      });
      return;
    }

    const payload: LineOptionSet = {
      code: this.form.code?.trim(),
      label: this.form.label.trim(),
      selectionMode: this.form.selectionMode || 'MULTI',
      minSelect,
      maxSelect,
      active: !!this.form.active,
      productId: this.scopeType === 'PRODUCT' && this.selectedProduct?.productId != null
        ? Number(this.selectedProduct.productId) : null,
      categoryId: this.scopeType === 'CATEGORY' && this.form.categoryId != null
        ? Number(this.form.categoryId) : null,
      options: options.map((o, i) => ({
        lineOptionId: o.lineOptionId,
        code: o.code!.trim(),
        label: o.label!.trim(),
        sortOrder: o.sortOrder != null ? Number(o.sortOrder) : i,
        defaultSelected: !!o.defaultSelected,
        suppressesAdjustments: !!o.suppressesAdjustments,
        active: o.active !== false
      }))
    };

    this.saving = true;
    try {
      if (this.isEdit && this.form.lineOptionSetId != null) {
        const obs = await this.lineOptionSetService.update(this.form.lineOptionSetId, payload);
        await firstValueFrom(obs);
      } else {
        const obs = await this.lineOptionSetService.create(payload);
        await firstValueFrom(obs);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('line_options_saved'),
        life: 3000
      });
      this.hideDialog();
      await this.refreshList();
    } catch (e: any) {
      console.error(e);
      const msg =
        e?.error?.message ||
        e?.error?.error ||
        (typeof e?.error === 'string' ? e.error : null) ||
        this.translate.instant('line_options_error_save');
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
