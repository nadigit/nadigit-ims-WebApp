import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { KeycloakService } from 'keycloak-angular';
import { firstValueFrom, Subscription } from 'rxjs';
import { TaxRule, TaxRuleDocumentType } from 'src/app/models/tax-rule';
import { TaxRuleService, TaxResolveLine } from 'src/app/services/tax-rule.service';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { ProductService } from 'src/app/services/product.service';
import { LocationService } from 'src/app/services/location.service';
import { Product } from 'src/app/models/product';
import { CategoryService } from 'src/app/services/category.service';
import { Category } from 'src/app/models/category';
import { TranslationService } from 'src/app/services/translation.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';

@Component({
  selector: 'app-tax-rules',
  templateUrl: './tax-rules.component.html',
  styleUrls: ['./tax-rules.component.css', '../finance.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class TaxRulesComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;
  /** When true, hides page chrome for use inside Settings (tab panel). */
  @Input() embedded = false;

  isLoading = true;
  rules: TaxRule[] = [];
  selectedRules: TaxRule[] = [];
  isAdmin = false;
  /** False when tax.calculation.mode is GLOBAL — rules exist but are not applied. */
  rulesModeActive = true;

  dialogVisible = false;
  isEdit = false;
  submitted = false;
  /** Form model bound in dialog */
  form: TaxRule = this.emptyForm();
  /** UI: rate 0–100 for display */
  ratePercent = 0;

  documentTypeOptions: { label: string; value: TaxRuleDocumentType }[] = [];
  categoryOptions: { label: string; value: number | null }[] = [];

  /** Product scope picker (autocomplete) */
  selectedProduct: Product | null = null;
  productSuggestions: Product[] = [];
  productSuggestionsLoading = false;

  /** Effective-date window pickers (bound to p-calendar as Date). */
  validFromDate: Date | null = null;
  validToDate: Date | null = null;

  /** Country scope dropdown (editable, stores ISO alpha-2 code) */
  countryOptions: { label: string; value: string }[] = [];
  private rawCountries: any[] = [];

  /** Rule simulator */
  simProduct: Product | null = null;
  simDocumentType: 'SALES' | 'PURCHASE' = 'SALES';
  simCountry: string | null = null;
  simRunning = false;
  simResult: { mode: string; appliedRate: number; line?: TaxResolveLine } | null = null;

  bulkUpdating = false;

  private langSub?: Subscription;

  constructor(
    private taxRuleService: TaxRuleService,
    private categoryService: CategoryService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService,
    private translate: TranslateService,
    private translationService: TranslationService,
    private keycloak: KeycloakService,
    private appConfigService: AppConfigurationService,
    private productService: ProductService,
    private locationService: LocationService,
    public pageSizeService: TablePageSizeService
  ) {}

  async ngOnInit(): Promise<void> {
    this.translate.use(this.translationService.getPreferredLanguage());
    this.langSub = this.translationService.currentLanguage$.subscribe((lang) => {
      this.translate.use(lang);
      this.rebuildDocumentTypeOptions();
      this.rebuildCountryOptions();
    });
    this.rebuildDocumentTypeOptions();
    this.rebuildCountryOptions();
    const roles = await this.keycloak.getUserRoles();
    this.isAdmin = roles.includes('ADMIN');
    await this.loadCategories();
    await this.refreshList();
    await this.loadTaxMode();
    this.isLoading = false;
  }

  private async loadTaxMode(): Promise<void> {
    try {
      const obs = await this.appConfigService.getConfiguration('tax.calculation.mode');
      const config: any = await firstValueFrom(obs);
      this.rulesModeActive = String(config?.value || 'GLOBAL').toUpperCase() === 'RULES';
    } catch (e) {
      // Missing config (pre-migration DB) means legacy behaviour = global rate.
      this.rulesModeActive = false;
    }
  }

  ngOnDestroy(): void {
    this.langSub?.unsubscribe();
  }

  private rebuildDocumentTypeOptions(): void {
    this.documentTypeOptions = [
      { label: this.translate.instant('tax_rule_document_sales'), value: 'SALES' },
      { label: this.translate.instant('tax_rule_document_purchase'), value: 'PURCHASE' },
      { label: this.translate.instant('tax_rule_document_both'), value: 'BOTH' }
    ];
  }

  private rebuildCountryOptions(): void {
    this.rawCountries = this.locationService.getAllCountriesWithTranslation();
    this.countryOptions = this.rawCountries
      .map(c => ({ label: c.translatedName || c.name, value: String(c.isoCode || '').toLowerCase() }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  /** Table display: map stored value (ISO code or legacy free text) to a readable country name. */
  countryDisplay(value: string | null | undefined): string {
    if (!value) return '—';
    const v = value.trim().toLowerCase();
    const byCode = this.rawCountries.find(c => String(c.isoCode || '').toLowerCase() === v);
    if (byCode) return byCode.translatedName || byCode.name;
    const byName = this.rawCountries.find(c => String(c.name || '').toLowerCase() === v);
    if (byName) return byName.translatedName || byName.name;
    return value;
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

  private emptyForm(): TaxRule {
    return {
      code: '',
      label: '',
      rate: 0,
      documentType: 'BOTH',
      priority: 100,
      active: true,
      productId: null,
      categoryId: null,
      country: null,
      validFrom: null,
      validTo: null
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

  /** Table display: the rule's effective window, or a dash when open-ended. */
  windowDisplay(rule: TaxRule): string {
    const from = rule.validFrom || null;
    const to = rule.validTo || null;
    if (!from && !to) return '—';
    if (from && to) return `${from} → ${to}`;
    if (from) return `${this.translate.instant('tax_rule_from')} ${from}`;
    return `${this.translate.instant('tax_rule_until')} ${to}`;
  }

  /** True when the rule is in effect today (respecting its window). */
  isEffectiveNow(rule: TaxRule): boolean {
    const today = this.formatIsoDate(new Date())!;
    if (rule.validFrom && today < rule.validFrom) return false;
    if (rule.validTo && today > rule.validTo) return false;
    return true;
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
      const obs = await this.taxRuleService.listTaxRules();
      const data = await firstValueFrom(obs);
      this.rules = Array.isArray(data) ? [...data] : [];
      this.rules.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || (a.code || '').localeCompare(b.code || ''));
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('tax_rules_error_load'),
        life: 5000
      });
      this.rules = [];
    }
  }

  openCreate(): void {
    if (!this.isAdmin) return;
    this.isEdit = false;
    this.submitted = false;
    this.form = this.emptyForm();
    this.ratePercent = 0;
    this.selectedProduct = null;
    this.validFromDate = null;
    this.validToDate = null;
    this.dialogVisible = true;
  }

  openEdit(row: TaxRule): void {
    if (!this.isAdmin) return;
    this.isEdit = true;
    this.submitted = false;
    this.form = {
      taxRuleId: row.taxRuleId,
      code: row.code,
      label: row.label,
      rate: row.rate,
      documentType: row.documentType || 'BOTH',
      priority: row.priority ?? 100,
      active: row.active !== false,
      productId: row.productId ?? null,
      categoryId: row.categoryId ?? null,
      country: row.country ?? null,
      validFrom: row.validFrom ?? null,
      validTo: row.validTo ?? null
    };
    this.ratePercent = Math.round(((row.rate ?? 0) * 100 + Number.EPSILON) * 100) / 100;
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

  rateDisplay(rule: TaxRule): string {
    const r = rule.rate ?? 0;
    return (r * 100).toFixed(2) + ' %';
  }

  confirmDelete(row: TaxRule): void {
    if (!this.isAdmin || row.taxRuleId == null) return;
    this.confirmationService.confirm({
      message: this.translate.instant('tax_rules_delete_confirm', { code: row.code }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          const obs = await this.taxRuleService.deleteTaxRule(row.taxRuleId!);
          await firstValueFrom(obs);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('tax_rules_deleted'),
            life: 3000
          });
          await this.refreshList();
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('tax_rules_error_delete'),
            life: 5000
          });
        }
      }
    });
  }

  deleteSelectedRules(): void {
    if (!this.isAdmin || !this.selectedRules?.length) return;
    this.confirmationService.confirm({
      message: this.translate.instant('tax_rules_delete_selected_confirm', { count: this.selectedRules.length }),
      header: this.translate.instant('confirm_label'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('yes'),
      rejectLabel: this.translate.instant('no'),
      accept: async () => {
        try {
          for (const rule of this.selectedRules) {
            if (rule.taxRuleId == null) continue;
            const obs = await this.taxRuleService.deleteTaxRule(rule.taxRuleId);
            await firstValueFrom(obs);
          }
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('tax_rules_deleted'),
            life: 3000
          });
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('tax_rules_error_delete'),
            life: 5000
          });
        } finally {
          this.selectedRules = [];
          await this.refreshList();
        }
      }
    });
  }

  /** Bulk enable/disable selected rules (e.g. activate the seeded Morocco TVA pack). */
  async setSelectedRulesActive(active: boolean): Promise<void> {
    if (!this.isAdmin || !this.selectedRules?.length || this.bulkUpdating) return;
    this.bulkUpdating = true;
    try {
      for (const rule of this.selectedRules) {
        if (rule.taxRuleId == null || rule.active === active) continue;
        // Full payload: the update endpoint clears product/category scope when ids are absent.
        const payload: TaxRule = {
          code: rule.code,
          label: rule.label,
          rate: rule.rate,
          documentType: rule.documentType || 'BOTH',
          priority: rule.priority ?? 100,
          active,
          productId: rule.productId ?? null,
          categoryId: rule.categoryId ?? null,
          country: rule.country ?? null,
          validFrom: rule.validFrom ?? null,
          validTo: rule.validTo ?? null
        };
        const obs = await this.taxRuleService.updateTaxRule(rule.taxRuleId, payload);
        await firstValueFrom(obs);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant(active ? 'tax_rules_bulk_activated' : 'tax_rules_bulk_deactivated'),
        life: 3000
      });
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('tax_rules_error_save'),
        life: 5000
      });
    } finally {
      this.bulkUpdating = false;
      this.selectedRules = [];
      await this.refreshList();
    }
  }

  /** Rule simulator: what would the engine apply for this product/context? */
  async runSimulation(): Promise<void> {
    if (!this.simProduct?.productId || this.simRunning) return;
    this.simRunning = true;
    this.simResult = null;
    try {
      const obs = await this.taxRuleService.resolveTaxRates({
        documentType: this.simDocumentType,
        country: this.simCountry || null,
        lines: [{ productId: this.simProduct.productId, netAmount: 100 }]
      });
      const res = await firstValueFrom(obs);
      this.simResult = {
        mode: res?.mode || 'GLOBAL',
        appliedRate: res?.effectiveRate ?? 0,
        line: res?.lines?.[0]
      };
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('tax_rules_sim_error'),
        life: 5000
      });
    } finally {
      this.simRunning = false;
    }
  }

  percentDisplay(rate: number | null | undefined): string {
    return ((rate ?? 0) * 100).toFixed(2) + ' %';
  }

  async save(): Promise<void> {
    this.submitted = true;
    if (!this.form.label?.trim()) return;
    if (!this.isEdit && (!this.form.code || !this.form.code.trim())) return;

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

    const rate = Math.min(100, Math.max(0, Number(this.ratePercent) || 0)) / 100;
    const payload: TaxRule = {
      code: this.form.code?.trim(),
      label: this.form.label.trim(),
      rate,
      documentType: (this.form.documentType as TaxRuleDocumentType) || 'BOTH',
      priority: this.form.priority != null ? Number(this.form.priority) : 100,
      active: !!this.form.active,
      productId: this.selectedProduct?.productId != null ? Number(this.selectedProduct.productId) : null,
      categoryId: this.form.categoryId != null ? Number(this.form.categoryId) : null,
      country: this.form.country?.trim() ? this.form.country.trim() : null,
      validFrom,
      validTo
    };

    try {
      if (this.isEdit && this.form.taxRuleId != null) {
        const obs = await this.taxRuleService.updateTaxRule(this.form.taxRuleId, payload);
        await firstValueFrom(obs);
      } else {
        const obs = await this.taxRuleService.createTaxRule(payload);
        await firstValueFrom(obs);
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('tax_rules_saved'),
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
        this.translate.instant('tax_rules_error_save');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 6000
      });
    }
  }
}
