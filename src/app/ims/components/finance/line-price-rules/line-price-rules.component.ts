import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subscription } from 'rxjs';
import {
  LineAdjustmentAmountSource,
  LineAdjustmentBasis,
  LineAdjustmentKind,
  LinePriceConditionKind,
  LinePriceRule,
  LinePriceRuleDocumentType
} from 'src/app/models/line-price-rule';
import { LinePriceRuleService } from 'src/app/services/line-price-rule.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ProductService } from 'src/app/services/product.service';
import { CategoryService } from 'src/app/services/category.service';
import { Product } from 'src/app/models/product';
import { Category } from 'src/app/models/category';
import { TranslationService } from 'src/app/services/translation.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

/**
 * Admin page for conditional line price adjustment rules (Capability B), mirroring the
 * Tax Rules page. Rules are inert unless `sales.pricing.rules.mode` = RULES (banner shown).
 */
@Component({
  selector: 'app-line-price-rules',
  templateUrl: './line-price-rules.component.html',
  styleUrls: ['./line-price-rules.component.css', '../finance.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class LinePriceRulesComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  /** When true, hides page chrome for embedding. */
  @Input() embedded = false;

  isLoading = true;
  rules: LinePriceRule[] = [];
  isAdmin = false;
  /** False while sales.pricing.rules.mode is OFF — rules exist but are not applied. */
  rulesModeActive = false;

  dialogVisible = false;
  isEdit = false;
  submitted = false;
  form: LinePriceRule = this.emptyForm();

  documentTypeOptions: { label: string; value: LinePriceRuleDocumentType }[] = [];
  conditionKindOptions: { label: string; value: LinePriceConditionKind }[] = [];
  adjustmentKindOptions: { label: string; value: LineAdjustmentKind }[] = [];
  basisOptions: { label: string; value: LineAdjustmentBasis }[] = [];
  amountSourceOptions: { label: string; value: LineAdjustmentAmountSource }[] = [];
  categoryOptions: { label: string; value: number | null }[] = [];

  /** Product scope picker (autocomplete) */
  selectedProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productSuggestionsLoading = false;

  /** Effective-date window pickers (bound to p-calendar as Date). */
  validFromDate: Date | null = null;
  validToDate: Date | null = null;

  private langSub?: Subscription;

  constructor(
    private linePriceRuleService: LinePriceRuleService,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloak: KeycloakService,
    private appConfigService: AppConfigurationService,
    private productService: ProductService,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.translate.use(this.translationService.getPreferredLanguage());
    this.langSub = this.translationService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
      this.rebuildDropdownOptions();
    });
    this.rebuildDropdownOptions();
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

  private async loadRulesMode(): Promise<void> {
    try {
      const obs = await this.appConfigService.getConfiguration('sales.pricing.rules.mode');
      const config: any = await firstValueFrom(obs);
      this.rulesModeActive = String(config?.value || 'OFF').toUpperCase() === 'RULES';
    } catch (e) {
      this.rulesModeActive = false;
    }
  }

  private rebuildDropdownOptions(): void {
    this.documentTypeOptions = [
      { label: this.translate.instant('line_price_rule_document_sale'), value: 'SALE' },
      { label: this.translate.instant('line_price_rule_document_both'), value: 'BOTH' }
    ];
    this.conditionKindOptions = [
      { label: this.translate.instant('line_price_rule_condition_always'), value: 'ALWAYS' },
      { label: this.translate.instant('line_price_rule_condition_suppressor_absent'), value: 'WHEN_SUPPRESSOR_ABSENT' },
      { label: this.translate.instant('line_price_rule_condition_option_selected'), value: 'WHEN_OPTION_SELECTED' },
      { label: this.translate.instant('line_price_rule_condition_option_absent'), value: 'WHEN_OPTION_ABSENT' }
    ];
    this.adjustmentKindOptions = [
      { label: this.translate.instant('line_price_rule_kind_deduction'), value: 'DEDUCTION' },
      { label: this.translate.instant('line_price_rule_kind_surcharge'), value: 'SURCHARGE' }
    ];
    this.basisOptions = [
      { label: this.translate.instant('line_price_rule_basis_flat'), value: 'FLAT' },
      { label: this.translate.instant('line_price_rule_basis_per_display_unit'), value: 'PER_DISPLAY_UNIT' },
      { label: this.translate.instant('line_price_rule_basis_per_portion_fraction'), value: 'PER_PORTION_FRACTION' },
      { label: this.translate.instant('line_price_rule_basis_percent_of_line'), value: 'PERCENT_OF_LINE' }
    ];
    this.amountSourceOptions = [
      { label: this.translate.instant('line_price_rule_source_literal'), value: 'LITERAL' },
      { label: this.translate.instant('line_price_rule_source_product_attribute'), value: 'PRODUCT_ATTRIBUTE' },
      { label: this.translate.instant('line_price_rule_source_consumed_batch_value'), value: 'CONSUMED_BATCH_VALUE' }
    ];
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
        detail: this.translate.instant('line_price_rules_error_load'),
        life: 5000
      });
      this.rules = [];
    }
  }

  /** Table display: product / category the rule is scoped to, or "Global". */
  scopeDisplay(rule: LinePriceRule): string {
    if (rule.productId) {
      const name = rule.productName || `#${rule.productId}`;
      return rule.productReference ? `${name} (${rule.productReference})` : name;
    }
    if (rule.categoryId) {
      return rule.categoryName || `#${rule.categoryId}`;
    }
    return this.translate.instant('line_option_set_scope_global');
  }

  conditionDisplay(rule: LinePriceRule): string {
    const kind = this.conditionKindOptions.find(o => o.value === rule.conditionKind)?.label
      || rule.conditionKind || '';
    if ((rule.conditionKind === 'WHEN_OPTION_SELECTED' || rule.conditionKind === 'WHEN_OPTION_ABSENT')
        && rule.conditionOptionCode) {
      return `${kind}: ${rule.conditionOptionCode}`;
    }
    return kind;
  }

  adjustmentDisplay(rule: LinePriceRule): string {
    const kind = this.adjustmentKindOptions.find(o => o.value === rule.adjustmentKind)?.label
      || rule.adjustmentKind || '';
    const basis = this.basisOptions.find(o => o.value === rule.basis)?.label || rule.basis || '';
    const amount = rule.amountSource === 'PRODUCT_ATTRIBUTE'
      ? `@${rule.attributeName || '?'}`
      : rule.amountSource === 'CONSUMED_BATCH_VALUE'
        ? this.translate.instant('line_price_rule_source_consumed_batch_value')
        : rule.basis === 'PERCENT_OF_LINE'
          ? `${rule.amount ?? 0} %`
          : `${rule.amount ?? 0}`;
    return `${kind} · ${amount} · ${basis}`;
  }

  windowDisplay(rule: LinePriceRule): string {
    const from = rule.validFrom || null;
    const to = rule.validTo || null;
    if (!from && !to) return '—';
    if (from && to) return `${from} → ${to}`;
    if (from) return `${this.translate.instant('tax_rule_from')} ${from}`;
    return `${this.translate.instant('tax_rule_until')} ${to}`;
  }

  get optionCondition(): boolean {
    return this.form.conditionKind === 'WHEN_OPTION_SELECTED' || this.form.conditionKind === 'WHEN_OPTION_ABSENT';
  }

  get literalSource(): boolean {
    return this.form.amountSource === 'LITERAL' || this.form.amountSource == null;
  }

  get attributeSource(): boolean {
    return this.form.amountSource === 'PRODUCT_ATTRIBUTE';
  }

  get batchValueSource(): boolean {
    return this.form.amountSource === 'CONSUMED_BATCH_VALUE';
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.isEdit = false;
    this.submitted = false;
    this.form = this.emptyForm();
    this.selectedProduct = null;
    this.validFromDate = null;
    this.validToDate = null;
    this.dialogVisible = true;
  }

  openEdit(row: LinePriceRule): void {
    if (!this.isAdmin) return;
    this.isEdit = true;
    this.submitted = false;
    this.form = { ...row };
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
      message: this.translate.instant('line_price_rules_delete_confirm', { code: row.code }),
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
            detail: this.translate.instant('line_price_rules_deleted'),
            life: 3000
          });
          await this.refreshList();
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('line_price_rules_error_delete'),
            life: 5000
          });
        }
      }
    });
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (!this.form.code?.trim() || !this.form.label?.trim()) return;
    if (this.optionCondition && !this.form.conditionOptionCode?.trim()) return;
    if (this.literalSource && (this.form.amount == null || this.form.amount < 0)) return;
    if (this.attributeSource && !this.form.attributeName?.trim()) return;

    const validFrom = this.formatIsoDate(this.validFromDate);
    const validTo = this.formatIsoDate(this.validToDate);
    if (validFrom && validTo && validTo < validFrom) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('tax_rule_invalid_date_range'),
        life: 5000
      });
      return;
    }

    const payload: LinePriceRule = {
      code: this.form.code.trim(),
      label: this.form.label.trim(),
      active: !!this.form.active,
      priority: this.form.priority != null ? Number(this.form.priority) : 100,
      documentType: this.form.documentType || 'SALE',
      productId: this.selectedProduct?.productId != null ? Number(this.selectedProduct.productId) : null,
      categoryId: this.form.categoryId != null ? Number(this.form.categoryId) : null,
      validFrom,
      validTo,
      conditionKind: this.form.conditionKind || 'ALWAYS',
      conditionOptionCode: this.optionCondition ? this.form.conditionOptionCode?.trim() || null : null,
      adjustmentKind: this.form.adjustmentKind || 'DEDUCTION',
      basis: this.form.basis || 'FLAT',
      amountSource: this.form.amountSource || 'LITERAL',
      amount: this.literalSource && this.form.amount != null ? Number(this.form.amount) : null,
      attributeName: this.attributeSource ? this.form.attributeName?.trim() || null : null
    };

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
        detail: this.translate.instant('line_price_rules_saved'),
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
        this.translate.instant('line_price_rules_error_save');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 6000
      });
    }
  }
}
