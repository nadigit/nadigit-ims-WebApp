import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Table } from 'primeng/table';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  LinePriceRule,
  LinePriceRuleDocumentType,
  LinePriceConditionKind,
  LineAdjustmentKind,
  LineAdjustmentBasis,
  LineAdjustmentAmountSource
} from 'src/app/models/line-price-rule';
import { LinePriceRuleService } from 'src/app/services/line-price-rule.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ProductService } from 'src/app/services/product.service';
import { CategoryService } from 'src/app/services/category.service';
import { Category } from 'src/app/models/category';
import { Product } from 'src/app/models/product';
import { TranslationService } from 'src/app/services/translation.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

type ScopeType = 'GLOBAL' | 'PRODUCT' | 'CATEGORY';

/**
 * Manage conditional line price adjustment rules (Capability B). Generic — a rule deducts or
 * surcharges a sale line, conditionally, with the amount taken from a literal, a product attribute,
 * or the consumed batch's companion value (e.g. the entrails credit). Inert unless
 * sales.pricing.rules.mode = RULES. Mirrors the Line Options / Tax Rules CRUD conventions.
 */
@Component({
  selector: 'app-line-price-rules',
  templateUrl: './line-price-rules.component.html',
  styleUrls: ['./line-price-rules.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class LinePriceRulesComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  @ViewChild('dt') dt?: Table;

  isLoading = true;
  rules: LinePriceRule[] = [];
  isAdmin = false;
  /** False when sales.pricing.rules.mode != RULES — rules exist but are not applied. */
  rulesModeActive = false;

  dialogVisible = false;
  isEdit = false;
  submitted = false;
  saving = false;
  form: LinePriceRule = this.emptyForm();

  documentTypeOptions: { label: string; value: LinePriceRuleDocumentType }[] = [];
  conditionKindOptions: { label: string; value: LinePriceConditionKind }[] = [];
  adjustmentKindOptions: { label: string; value: LineAdjustmentKind }[] = [];
  basisOptions: { label: string; value: LineAdjustmentBasis }[] = [];
  amountSourceOptions: { label: string; value: LineAdjustmentAmountSource }[] = [];
  scopeTypeOptions: { label: string; value: ScopeType }[] = [];
  scopeType: ScopeType = 'GLOBAL';

  categoryOptions: { label: string; value: number | null }[] = [];
  selectedProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productSuggestionsLoading = false;

  validFromDate: Date | null = null;
  validToDate: Date | null = null;

  private langSub?: Subscription;

  constructor(
    private linePriceRuleService: LinePriceRuleService,
    private categoryService: CategoryService,
    private productService: ProductService,
    private appConfigService: AppConfigurationService,
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
    await this.loadRulesMode();
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  onGlobalFilter(event: Event): void {
    this.dt?.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  private async loadRulesMode(): Promise<void> {
    try {
      const obs = await this.appConfigService.getConfiguration('sales.pricing.rules.mode');
      const config: any = await firstValueFrom(obs);
      this.rulesModeActive = String(config?.value || 'OFF').toUpperCase() === 'RULES';
    } catch (e) {
      this.rulesModeActive = false;
    }
  }

  private rebuildOptions(): void {
    this.documentTypeOptions = [
      { label: this.translate.instant('line_rule_document_sale'), value: 'SALE' },
      { label: this.translate.instant('line_rule_document_both'), value: 'BOTH' }
    ];
    this.conditionKindOptions = [
      { label: this.translate.instant('line_rule_condition_always'), value: 'ALWAYS' },
      { label: this.translate.instant('line_rule_condition_suppressor_absent'), value: 'WHEN_SUPPRESSOR_ABSENT' },
      { label: this.translate.instant('line_rule_condition_option_selected'), value: 'WHEN_OPTION_SELECTED' },
      { label: this.translate.instant('line_rule_condition_option_absent'), value: 'WHEN_OPTION_ABSENT' }
    ];
    this.adjustmentKindOptions = [
      { label: this.translate.instant('line_rule_kind_deduction'), value: 'DEDUCTION' },
      { label: this.translate.instant('line_rule_kind_surcharge'), value: 'SURCHARGE' }
    ];
    this.basisOptions = [
      { label: this.translate.instant('line_rule_basis_flat'), value: 'FLAT' },
      { label: this.translate.instant('line_rule_basis_per_unit'), value: 'PER_DISPLAY_UNIT' },
      { label: this.translate.instant('line_rule_basis_per_portion'), value: 'PER_PORTION_FRACTION' },
      { label: this.translate.instant('line_rule_basis_percent'), value: 'PERCENT_OF_LINE' }
    ];
    this.amountSourceOptions = [
      { label: this.translate.instant('line_rule_source_literal'), value: 'LITERAL' },
      { label: this.translate.instant('line_rule_source_attribute'), value: 'PRODUCT_ATTRIBUTE' },
      { label: this.translate.instant('line_rule_source_batch_value'), value: 'CONSUMED_BATCH_VALUE' }
    ];
    this.scopeTypeOptions = [
      { label: this.translate.instant('line_option_scope_global'), value: 'GLOBAL' },
      { label: this.translate.instant('line_option_scope_product'), value: 'PRODUCT' },
      { label: this.translate.instant('line_option_scope_category'), value: 'CATEGORY' }
    ];
  }

  private emptyForm(): LinePriceRule {
    return {
      code: '',
      label: '',
      active: true,
      priority: 100,
      documentType: 'SALE',
      productId: null,
      categoryId: null,
      validFrom: null,
      validTo: null,
      conditionKind: 'ALWAYS',
      conditionOptionCode: null,
      adjustmentKind: 'DEDUCTION',
      basis: 'FLAT',
      amountSource: 'LITERAL',
      amount: 0,
      attributeName: null
    };
  }

  // --- conditional field visibility ---
  get showConditionOptionCode(): boolean {
    return this.form.conditionKind === 'WHEN_OPTION_SELECTED' || this.form.conditionKind === 'WHEN_OPTION_ABSENT';
  }
  get showAmount(): boolean {
    return this.form.amountSource === 'LITERAL' || this.form.amountSource === 'PRODUCT_ATTRIBUTE';
  }
  get amountRequired(): boolean {
    return this.form.amountSource === 'LITERAL';
  }
  get showAttributeName(): boolean {
    return this.form.amountSource === 'PRODUCT_ATTRIBUTE';
  }

  private parseIsoDate(value: string | null | undefined): Date | null {
    if (!value) return null;
    const parts = value.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  private formatIsoDate(value: Date | null): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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
      const obs = await this.linePriceRuleService.list();
      const data = await firstValueFrom(obs);
      this.rules = Array.isArray(data) ? [...data] : [];
      this.rules.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || (a.code || '').localeCompare(b.code || ''));
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('line_rules_error_load'),
        life: 5000
      });
      this.rules = [];
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

  scopeDisplay(rule: LinePriceRule): string {
    if (rule.productId) return `${this.translate.instant('line_option_scope_product')}: ${rule.productName || '#' + rule.productId}`;
    if (rule.categoryId) return `${this.translate.instant('line_option_scope_category')}: ${rule.categoryName || '#' + rule.categoryId}`;
    return this.translate.instant('line_option_scope_global');
  }

  /** Compact human summary of what the rule does, for the table. */
  effectDisplay(rule: LinePriceRule): string {
    const kind = this.translate.instant(rule.adjustmentKind === 'SURCHARGE' ? 'line_rule_kind_surcharge' : 'line_rule_kind_deduction');
    let amount: string;
    if (rule.amountSource === 'CONSUMED_BATCH_VALUE') {
      amount = this.translate.instant('line_rule_source_batch_value');
    } else if (rule.amountSource === 'PRODUCT_ATTRIBUTE') {
      amount = `${this.translate.instant('line_rule_source_attribute')}: ${rule.attributeName || '—'}`;
    } else {
      amount = String(rule.amount ?? 0);
    }
    const basis = this.translate.instant(
      rule.basis === 'PER_DISPLAY_UNIT' ? 'line_rule_basis_per_unit'
      : rule.basis === 'PER_PORTION_FRACTION' ? 'line_rule_basis_per_portion'
      : rule.basis === 'PERCENT_OF_LINE' ? 'line_rule_basis_percent'
      : 'line_rule_basis_flat'
    );
    return `${kind} · ${amount} · ${basis}`;
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.isEdit = false;
    this.submitted = false;
    this.form = this.emptyForm();
    this.scopeType = 'GLOBAL';
    this.selectedProduct = null;
    this.validFromDate = null;
    this.validToDate = null;
    this.dialogVisible = true;
  }

  openEdit(row: LinePriceRule): void {
    if (!this.isAdmin) return;
    this.isEdit = true;
    this.submitted = false;
    this.form = {
      linePriceRuleId: row.linePriceRuleId,
      code: row.code,
      label: row.label,
      active: row.active !== false,
      priority: row.priority ?? 100,
      documentType: row.documentType || 'SALE',
      productId: row.productId ?? null,
      categoryId: row.categoryId ?? null,
      validFrom: row.validFrom ?? null,
      validTo: row.validTo ?? null,
      conditionKind: row.conditionKind || 'ALWAYS',
      conditionOptionCode: row.conditionOptionCode ?? null,
      adjustmentKind: row.adjustmentKind || 'DEDUCTION',
      basis: row.basis || 'FLAT',
      amountSource: row.amountSource || 'LITERAL',
      amount: row.amount ?? null,
      attributeName: row.attributeName ?? null
    };
    this.scopeType = row.productId ? 'PRODUCT' : row.categoryId ? 'CATEGORY' : 'GLOBAL';
    this.selectedProduct = row.productId
      ? ({ productId: row.productId, name: row.productName || `#${row.productId}`, reference: row.productReference || undefined } as Product)
      : null;
    this.validFromDate = this.parseIsoDate(row.validFrom);
    this.validToDate = this.parseIsoDate(row.validTo);
    this.dialogVisible = true;
  }

  hideDialog(): void {
    this.dialogVisible = false;
  }

  confirmDelete(row: LinePriceRule): void {
    if (!this.isAdmin || row.linePriceRuleId == null) return;
    this.confirmationService.confirm({
      message: this.translate.instant('line_rules_delete_confirm', { label: row.label }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          const obs = await this.linePriceRuleService.remove(row.linePriceRuleId!);
          await firstValueFrom(obs);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('line_rules_deleted'),
            life: 3000
          });
          await this.refreshList();
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('line_rules_error_delete'),
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

    if (this.showConditionOptionCode && !this.form.conditionOptionCode?.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('line_rule_option_code_required'),
        life: 4000
      });
      return;
    }
    if (this.amountRequired && (this.form.amount == null || Number(this.form.amount) < 0)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('line_rule_amount_required'),
        life: 4000
      });
      return;
    }
    if (this.showAttributeName && !this.form.attributeName?.trim()) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('line_rule_attribute_required'),
        life: 4000
      });
      return;
    }

    const validFrom = this.formatIsoDate(this.validFromDate);
    const validTo = this.formatIsoDate(this.validToDate);
    if (validFrom && validTo && validTo < validFrom) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('line_rule_invalid_window'),
        life: 4000
      });
      return;
    }

    const source = this.form.amountSource || 'LITERAL';
    const payload: LinePriceRule = {
      code: this.form.code?.trim(),
      label: this.form.label.trim(),
      active: !!this.form.active,
      priority: this.form.priority != null ? Number(this.form.priority) : 100,
      documentType: this.form.documentType || 'SALE',
      productId: this.scopeType === 'PRODUCT' && this.selectedProduct?.productId != null
        ? Number(this.selectedProduct.productId) : null,
      categoryId: this.scopeType === 'CATEGORY' && this.form.categoryId != null
        ? Number(this.form.categoryId) : null,
      validFrom,
      validTo,
      conditionKind: this.form.conditionKind || 'ALWAYS',
      conditionOptionCode: this.showConditionOptionCode ? this.form.conditionOptionCode?.trim() || null : null,
      adjustmentKind: this.form.adjustmentKind || 'DEDUCTION',
      basis: this.form.basis || 'FLAT',
      amountSource: source,
      amount: source === 'CONSUMED_BATCH_VALUE' ? null : (this.form.amount != null ? Number(this.form.amount) : null),
      attributeName: source === 'PRODUCT_ATTRIBUTE' ? this.form.attributeName?.trim() || null : null
    };

    this.saving = true;
    try {
      if (this.isEdit && this.form.linePriceRuleId != null) {
        const obs = await this.linePriceRuleService.update(this.form.linePriceRuleId, payload);
        await firstValueFrom(obs);
      } else {
        const obs = await this.linePriceRuleService.create(payload);
        await firstValueFrom(obs);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('line_rules_saved'),
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
        this.translate.instant('line_rules_error_save');
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
