import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Table } from 'primeng/table';
import { TranslateService } from '@ngx-translate/core';
import { AppConfiguration } from 'src/app/models/appConfiguration';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { currencies } from 'currencies.json';
import { Bank } from 'src/app/models/bank';
import { BankAccountService } from 'src/app/services/bank-account.service';
import { PermissionService } from 'src/app/services/permission.service';
import { KeycloakService } from 'keycloak-angular';
import { distinctUntilChanged, firstValueFrom, map, Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { ProcessModeService } from 'src/app/services/process-mode.service';
import { ActivityProfileService } from 'src/app/services/activity-profile.service';
import { BusinessActivityProfileValue } from 'src/app/models/activity-profile-context';
import { Params } from '@angular/router';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';
import { TablePageSizeService } from 'src/app/services/table-page-size.service';
import { TablePageSizeKeys } from 'src/app/utils/table-page-size.storage';


interface UploadEvent {
  originalEvent: Event;
  files: File[];
}

type AppConfigCategoryId =
  | 'general'
  | 'workflow'
  | 'sales_pos'
  | 'inventory'
  | 'purchases'
  | 'ai'
  | 'returns'
  | 'payments'
  | 'notifications_audit'
  | 'expenses'
  | 'other';

type SettingsChannelId = 'email' | 'telegram' | 'whatsapp' | 'ai' | 'notifications';

interface AppConfigSection {
  id: AppConfigCategoryId;
  icon: string;
  items: AppConfiguration[];
}

@Component({
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css', '../administration.component.css'],
  providers: [MessageService, ConfirmationService]
})
export class SettingsComponent implements OnInit, OnDestroy {
  TablePageSizeKeys = TablePageSizeKeys;

  rowsPerPageOptions = [20, 50, 100];
  valSwitch: boolean = false;
  currenciesList: any = currencies;
  printingFormats: any;
  isEditMode = false; // Flag to track edit mode
  fields: any;
  configs: AppConfiguration[] = [];
  appConfigCurrency: any = null;
  taxPercentage: number;
  refundPercentageDamaged: number;
  refundPercentageUsed: number;
  refundPercentageNew: number;

  autoOrderCompleteChecked: boolean = false;
  timezones: any[] = Intl.supportedValuesOf('timeZone').map(tz => ({ label: tz, value: tz }));
  isLoading: boolean = true;
  isLoadingBanks: boolean = true;

  autoOrderOptions: any[] = [];
  booleanOptions: any[] = [];
  processModeOptions: { label: string; value: string }[] = [];
  aiProviderOptions: { label: string; value: string }[] = [];
  aiInvoiceModeOptions: { label: string; value: string }[] = [];
  /** 0 = global parameters, 1 = integrations, 2 = banks, 3 = tax rules */
  activeTabIndex = 0;

  /** Updated after `/api/license/capabilities` loads (tax rules tab). */
  taxRulesFeatureEnabled = false;

  private licenseCapabilitiesSub?: Subscription;
  private routeTabQuerySub?: Subscription;

  canManageActivityProfile = false;
  businessProfileOptions: { label: string; value: BusinessActivityProfileValue }[] = [];
  selectedBusinessProfile: BusinessActivityProfileValue | null = null;
  originalBusinessProfile: BusinessActivityProfileValue | null = null;
  savingBusinessProfile = false;

  /** Grouped view for global parameters tab */
  configSearch = '';
  selectedConfigCategory: 'all' | AppConfigCategoryId = 'all';
  configSections: AppConfigSection[] = [];
  categoryFilterSelectOptions: { label: string; value: 'all' | AppConfigCategoryId }[] = [];

  /** 'cards' = large tiles; 'compact' = dense list with inline edit */
  parameterViewMode: 'cards' | 'compact' = 'cards';
  parameterViewModeOptions: { label: string; value: 'cards' | 'compact' }[] = [];

  /** When off, hides a curated set of niche parameters unless search is active */
  showAdvancedParameters = false;

  private readonly LS_VIEW_MODE = 'ims.settings.parameterViewMode';
  private readonly LS_ADVANCED = 'ims.settings.showAdvancedParams';

  private readonly advancedParameterKeys = new Set<string>([
    'restore.enabled',
    'sales.stock.include.approved.writeoff.quantity',
    'sales.stock.soft.reservation.enabled',
    'sales.stock.soft.reservation.ttl.minutes',
    'pricing.allow.custom.override',
    'cash.register.auto.schedule.enabled',
    'pos.credit.order.auto.delivered',
    'writeoff.auto.expired.batches',
    'writeoff.auto.approve',
    'credit.limit.includes.outstanding',
    'outstanding.balance.aging.enabled',
    'expense.require.approval',
    'warehouse.transfer.auto.apply',
    'ai.invoice.hybrid.confidence.threshold',
    'ai.invoice.max.context.chars',
  ]);

  private readonly aiSecretConfigKeys = new Set<string>([
    'ai.openai.api.key',
    'ai.anthropic.api.key',
    'ai.groq.api.key',
    'ai.google.api.key',
    'ai.openrouter.api.key',
  ]);

  private readonly aiEndpointConfigKeys = new Set<string>([
    'ai.openai.base.url',
    'ai.openai.model',
    'ai.anthropic.base.url',
    'ai.anthropic.model',
    'ai.ollama.base.url',
    'ai.ollama.model',
    'ai.groq.base.url',
    'ai.groq.model',
    'ai.google.base.url',
    'ai.google.model',
    'ai.openrouter.base.url',
    'ai.openrouter.model',
  ]);

  private readonly appConfigCategoryOrder: AppConfigCategoryId[] = [
    'general',
    'workflow',
    'sales_pos',
    'inventory',
    'purchases',
    'ai',
    'returns',
    'payments',
    'notifications_audit',
    'expenses',
    'other',
  ];

  private readonly appConfigCategoryIcons: Record<AppConfigCategoryId, string> = {
    general: 'pi pi-globe',
    workflow: 'pi pi-sitemap',
    sales_pos: 'pi pi-shopping-cart',
    inventory: 'pi pi-box',
    purchases: 'pi pi-shopping-bag',
    ai: 'pi pi-bolt',
    returns: 'pi pi-replay',
    payments: 'pi pi-wallet',
    notifications_audit: 'pi pi-bell',
    expenses: 'pi pi-money-bill',
    other: 'pi pi-ellipsis-h',
  };

  // Banks properties
  banks: Bank[] = [];
  bank: Bank = {};
  selectedBanks: Bank[] = [];
  bankDialog: boolean = false;
  deleteBankDialog: boolean = false;
  deleteBanksDialog: boolean = false;
  bankDetailsDialog: boolean = false;
  submittedBank: boolean = false;
  globalFilter: string = '';
  activeFilter: boolean | undefined = undefined;
  canAddBank: boolean = false;
  canEditBank: boolean = false;
  canDeleteBank: boolean = false;
  canReadBank: boolean = false;
  Ressource: string = 'BANKS';

  /** Unified tiles for email / messaging / notification destinations */
  readonly channelTiles: ReadonlyArray<{
    id: SettingsChannelId;
    icon: string;
    titleKey: string;
    descKey: string;
  }> = [
    { id: 'email', icon: 'pi pi-envelope', titleKey: 'email_configuration', descKey: 'email_configuration_description' },
    { id: 'telegram', icon: 'pi pi-send', titleKey: 'telegram_configuration', descKey: 'telegram_configuration_card_hint' },
    { id: 'whatsapp', icon: 'pi pi-phone', titleKey: 'whatsapp_configuration', descKey: 'whatsapp_configuration_card_hint' },
    { id: 'ai', icon: 'pi pi-bolt', titleKey: 'ai_integration_configuration', descKey: 'ai_integration_configuration_card_hint' },
    { id: 'notifications', icon: 'pi pi-bell', titleKey: 'notification_recipients', descKey: 'notification_recipients_description' },
  ];

  // Computed properties
  get isPharmacyProfileSelected(): boolean {
    return this.selectedBusinessProfile === 'PHARMACY';
  }

  get isFashionProfileSelected(): boolean {
    return this.selectedBusinessProfile === 'FASHION';
  }

  /** Display label for the currently selected profile (dropdown options). */
  get selectedProfileDisplayLabel(): string {
    if (!this.selectedBusinessProfile) {
      return '';
    }
    const opt = this.businessProfileOptions.find(o => o.value === this.selectedBusinessProfile);
    return opt?.label ?? String(this.selectedBusinessProfile);
  }

  /** Selection differs from last saved server value. */
  get businessProfileDirty(): boolean {
    return (
      this.selectedBusinessProfile != null &&
      this.selectedBusinessProfile !== this.originalBusinessProfile
    );
  }

  get profileQaChecklistItems(): Array<{ key: string; checked: boolean }> {
    return [
      {
        key: 'profile_qa_check_product_form_mode',
        checked: true,
      },
      {
        key: 'profile_qa_check_orders_mode',
        checked: true,
      },
      {
        key: 'profile_qa_check_pos_mode',
        checked: true,
      },
      {
        key: 'profile_qa_check_purchase_mode',
        checked: true,
      },
      {
        key: this.isPharmacyProfileSelected
          ? 'profile_qa_check_pharmacy_rules'
          : (this.isFashionProfileSelected ? 'profile_qa_check_fashion_rules' : 'profile_qa_check_general_rules'),
        checked: this.selectedBusinessProfile != null,
      },
    ];
  }

  get profileQaChecklistActions(): Array<{ key: string; route: string; queryParams?: Params }> {
    return [
      { key: 'profile_qa_check_product_form_mode', route: '/inventory/products' },
      { key: 'profile_qa_check_orders_mode', route: '/sales/orders' },
      { key: 'profile_qa_check_pos_mode', route: '/pos' },
      { key: 'profile_qa_check_purchase_mode', route: '/purchases' },
      {
        key: this.isPharmacyProfileSelected
          ? 'profile_qa_check_pharmacy_rules'
          : (this.isFashionProfileSelected ? 'profile_qa_check_fashion_rules' : 'profile_qa_check_general_rules'),
        route: '/administration/settings',
        queryParams: { businessProfile: 1 },
      },
    ];
  }

  async navigateProfileQaTarget(item: { route: string; queryParams?: Params }): Promise<void> {
    await this.router.navigate([item.route], {
      queryParams: item.queryParams ?? {},
    });
  }

  constructor(
    private router: Router,
    private location: Location,
    private messageService: MessageService,
    private appConfigService: AppConfigurationService,
    private translate: TranslateService,
    private bankAccountService: BankAccountService,
    private permissionService: PermissionService,
    public keycloakService: KeycloakService,
    private route: ActivatedRoute,
    private processModeService: ProcessModeService,
    private confirmationService: ConfirmationService,
    private activityProfileService: ActivityProfileService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    public pageSizeService: TablePageSizeService,
  ) {
  }

  ngOnDestroy(): void {
    this.licenseCapabilitiesSub?.unsubscribe();
  }

  /** Reload tax-rules tab visibility when `/api/license/capabilities` resolves or updates. */
  private refreshTaxRulesFeatureFromLicense(): void {
    this.taxRulesFeatureEnabled = this.licenseCapabilitiesService.isFeatureEnabled('TAX_RULE_ENGINE');
  }

  getProcessModeLabel(value: string): string {
    const v = (value || '').toUpperCase();
    const opt = this.processModeOptions.find(o => o.value === v);
    return opt ? opt.label : (value || '');
  }

  isAiSecretConfigKey(key: string | undefined): boolean {
    return !!key && this.aiSecretConfigKeys.has(key);
  }

  isAiEndpointConfigKey(key: string | undefined): boolean {
    return !!key && this.aiEndpointConfigKeys.has(key);
  }

  getAiSecretDisplaySummary(value: unknown): string {
    const s = String(value ?? '').trim();
    if (!s) {
      return this.translate.instant('ai_secret_not_set');
    }
    return this.translate.instant('ai_secret_set_masked');
  }

  getAiProviderLabel(value: string): string {
    const v = (value || '').toUpperCase();
    const opt = this.aiProviderOptions.find(o => o.value === v);
    return opt ? opt.label : (value || '');
  }

  getAiInvoiceModeLabel(value: string): string {
    const v = (value || '').toUpperCase();
    const opt = this.aiInvoiceModeOptions.find(o => o.value === v);
    return opt ? opt.label : (value || '');
  }

  private async maybeRefreshProcessMode(key: string | undefined): Promise<void> {
    if (key === 'sales.process.mode' || key === 'purchase.process.mode' || key === 'sales.pos.enabled') {
      await this.processModeService.refresh();
    }
  }

  goBack(): void {
    this.location.back();
  }

  navigateToEmailConfig(): void {
    this.router.navigate(['/administration/settings/email']);
  }

  navigateToNotificationRecipients(): void {
    this.router.navigate(['/administration/settings/email/recipients']);
  }

  navigateToTelegramConfig(): void {
    this.router.navigate(['/administration/settings/telegram']);
  }

  navigateToWhatsAppConfig(): void {
    this.router.navigate(['/administration/settings/whatsapp']);
  }

  navigateToAiIntegrationConfig(): void {
    void this.router.navigate(['/administration/settings/ai']);
  }

  navigateChannel(id: SettingsChannelId): void {
    switch (id) {
      case 'email':
        this.navigateToEmailConfig();
        break;
      case 'telegram':
        this.navigateToTelegramConfig();
        break;
      case 'whatsapp':
        this.navigateToWhatsAppConfig();
        break;
      case 'ai':
        this.navigateToAiIntegrationConfig();
        break;
      case 'notifications':
        this.navigateToNotificationRecipients();
        break;
    }
  }

  resolveConfigCategoryId(key: string | undefined): AppConfigCategoryId {
    if (!key) {
      return 'other';
    }
    const k = key;
    const generalKeys = new Set([
      'app.timezone',
      'currency',
      'tax',
      'autoOrderComplete',
      'lowStockThreshold',
      'restore.enabled',
    ]);
    if (generalKeys.has(k)) {
      return 'general';
    }
    if (k === 'sales.process.mode' || k === 'purchase.process.mode') {
      return 'workflow';
    }
    if (
      k.startsWith('sales.stock.') ||
      k.startsWith('warehouse.') ||
      k.startsWith('product.expiration') ||
      k.startsWith('writeoff.')
    ) {
      return 'inventory';
    }
    if (k.startsWith('purchase.')) {
      return 'purchases';
    }
    if (k.startsWith('ai.')) {
      return 'ai';
    }
    if (k.startsWith('return.') || k === 'returnWindow' || k === 'refundWindow') {
      return 'returns';
    }
    if (
      k.startsWith('payment.') ||
      k.startsWith('cash.register') ||
      k.startsWith('credit.') ||
      k.startsWith('outstanding.balance')
    ) {
      return 'payments';
    }
    if (k.startsWith('notification.') || k.startsWith('audit.log')) {
      return 'notifications_audit';
    }
    if (k.startsWith('expense.')) {
      return 'expenses';
    }
    if (k.startsWith('sales.') || k.startsWith('pos.') || k.startsWith('order.') || k.startsWith('pricing.')) {
      return 'sales_pos';
    }
    return 'other';
  }

  onConfigFiltersChanged(): void {
    this.rebuildCategoryFilterOptions();
    this.recomputeConfigSections();
  }

  isAdvancedParameterKey(key: string | undefined): boolean {
    return !!key && this.advancedParameterKeys.has(key);
  }

  private passesAdvancedFilter(c: AppConfiguration, searchText: string): boolean {
    const q = (searchText ?? this.configSearch ?? '').trim();
    if (q.length > 0) {
      return true;
    }
    if (this.showAdvancedParameters) {
      return true;
    }
    return !this.isAdvancedParameterKey(c.key);
  }

  onParameterViewModeChange(): void {
    try {
      localStorage.setItem(this.LS_VIEW_MODE, this.parameterViewMode);
    } catch {
      /* ignore */
    }
  }

  /**
   * Compact list only shows summaries; opening the editor switches to card layout and focuses the row.
   */
  async openCompactSettingEdit(config: AppConfiguration): Promise<void> {
    if (this.parameterViewMode === 'compact') {
      this.parameterViewMode = 'cards';
      this.onParameterViewModeChange();
      this.configs = [...this.configs];
      await new Promise<void>(resolve => setTimeout(() => resolve(), 0));
    }
    await this.toggleEditMode(config);
    const id = config.key ? `cfg-${config.key}` : '';
    if (id) {
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
    }
  }

  onShowAdvancedChange(): void {
    try {
      localStorage.setItem(this.LS_ADVANCED, this.showAdvancedParameters ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.onConfigFiltersChanged();
  }

  getConfigSummary(config: AppConfiguration): string {
    const k = config.key || '';
    const v = config.value;
    const yn = (b: boolean) => (b ? this.translate.instant('enabled') : this.translate.instant('disabled'));
    const days = () => ` ${this.translate.instant('days')}`;

    if (k === 'lowStockThreshold') {
      return `${v} ${this.translate.instant('units')}`;
    }
    if (k === 'tax') {
      return `${(parseFloat(String(v)) * 100).toFixed(2)} %`;
    }
    if (k === 'cashRegDefaultOpeningBalance') {
      return `${v} ${this.appConfigCurrency?.value ?? ''}`.trim();
    }
    if (k === 'returnWindow' || k === 'refundWindow' || k === 'product.expiration.warning.days') {
      return `${v}${days()}`;
    }
    if (k === 'notification.retention.days' || k === 'audit.log.retention.days' || k === 'credit.default.terms.days' || k === 'outstanding.balance.overdue.threshold.days') {
      return `${v}${days()}`;
    }
    if (k === 'sales.stock.soft.reservation.ttl.minutes') {
      return `${v} ${this.translate.instant('minutes')}`;
    }
    if (k === 'payment.bank.methods.minimum.amount') {
      return `${v} ${this.appConfigCurrency?.value || 'USD'}`;
    }
    if (
      k === 'cash.register.auto.open.session' ||
      k === 'payment.bank.methods.require.account' ||
      k === 'restore.enabled' ||
      k === 'pos.return.refund.immediate' ||
      k === 'writeoff.auto.expired.batches' ||
      k === 'writeoff.auto.approve' ||
      k === 'expense.require.approval' ||
      k === 'warehouse.transfer.auto.apply' ||
      k === 'sales.stock.include.approved.writeoff.quantity' ||
      k === 'sales.stock.soft.reservation.enabled' ||
      k === 'pricing.allow.custom.override' ||
      k === 'order.backoffice.auto.status.enabled' ||
      k === 'cash.register.auto.schedule.enabled' ||
      k === 'pos.credit.order.auto.delivered' ||
      k === 'sales.pos.enabled' ||
      k === 'credit.automatic.usage.enabled' ||
      k === 'credit.automatic.issuance.enabled' ||
      k === 'credit.manual.issuance.enabled' ||
      k === 'credit.limit.enforcement.enabled' ||
      k === 'credit.limit.includes.outstanding' ||
      k === 'outstanding.balance.tracking.enabled' ||
      k === 'outstanding.balance.aging.enabled'
    ) {
      return yn(String(v) === 'true');
    }
    if (k === 'autoOrderComplete') {
      return String(v) === 'active' ? this.translate.instant('enabled') : this.translate.instant('disabled');
    }
    if (k === 'sales.process.mode' || k === 'purchase.process.mode') {
      return this.getProcessModeLabel(String(v));
    }
    if (k === 'return.refund.percentage.damaged' || k === 'return.refund.percentage.used' || k === 'return.refund.percentage.new') {
      return `${(parseFloat(String(v)) * 100).toFixed(2)} %`;
    }
    if (k === 'app.timezone') {
      return String(v);
    }
    if (k === 'currency') {
      return String(v);
    }
    if (k === 'ai.integration.enabled') {
      return yn(String(v) === 'true');
    }
    if (k === 'ai.integration.provider') {
      return this.getAiProviderLabel(String(v));
    }
    if (k === 'ai.invoice.mode') {
      return this.getAiInvoiceModeLabel(String(v));
    }
    if (this.isAiSecretConfigKey(k)) {
      return this.getAiSecretDisplaySummary(v);
    }
    if (k === 'ai.invoice.hybrid.confidence.threshold') {
      const n = parseFloat(String(v));
      if (Number.isFinite(n)) {
        return `${(n * 100).toFixed(0)} %`;
      }
      return String(v ?? '');
    }
    if (k === 'ai.invoice.max.context.chars') {
      return `${v} ${this.translate.instant('ai_context_chars_unit')}`;
    }
    if (this.isAiEndpointConfigKey(k)) {
      return String(v ?? '');
    }
    return String(v ?? '');
  }

  private refreshParameterViewModeLabels(): void {
    this.parameterViewModeOptions = [
      { label: this.translate.instant('settings_view_cards'), value: 'cards' },
      { label: this.translate.instant('settings_view_compact'), value: 'compact' },
    ];
  }

  private loadParameterUiPreferences(): void {
    try {
      const vm = localStorage.getItem(this.LS_VIEW_MODE);
      if (vm === 'compact' || vm === 'cards') {
        this.parameterViewMode = vm;
      }
      const adv = localStorage.getItem(this.LS_ADVANCED);
      if (adv === '1') {
        this.showAdvancedParameters = true;
      }
    } catch {
      /* ignore */
    }
    this.refreshParameterViewModeLabels();
  }

  scrollToConfigCategory(categoryId: AppConfigCategoryId): void {
    document.getElementById(`config-cat-${categoryId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private rebuildCategoryFilterOptions(): void {
    const list = (this.configs || []).filter(
      c => !this.isAiConfigKey(c.key) && this.passesAdvancedFilter(c, ''),
    );
    const opts: { label: string; value: 'all' | AppConfigCategoryId }[] = [
      { label: `${this.translate.instant('settings_filter_all')} (${list.length})`, value: 'all' },
    ];
    for (const id of this.appConfigCategoryOrder) {
      if (id === 'other') {
        continue;
      }
      const n = list.filter(c => this.resolveConfigCategoryId(c.key) === id).length;
      if (n > 0) {
        opts.push({
          label: `${this.translate.instant('settings_cat_' + id)} (${n})`,
          value: id,
        });
      }
    }
    const otherN = list.filter(c => this.resolveConfigCategoryId(c.key) === 'other').length;
    if (otherN > 0) {
      opts.push({
        label: `${this.translate.instant('settings_cat_other')} (${otherN})`,
        value: 'other',
      });
    }
    const allowed = new Set(opts.map(o => o.value));
    if (!allowed.has(this.selectedConfigCategory)) {
      this.selectedConfigCategory = 'all';
    }
    this.categoryFilterSelectOptions = opts;
  }

  private recomputeConfigSections(): void {
    const q = (this.configSearch || '').trim().toLowerCase();
    const cat = this.selectedConfigCategory;
    const matchesSearch = (c: AppConfiguration): boolean => {
      if (!q) {
        return true;
      }
      const key = (c.key || '').toLowerCase();
      const label = this.translate.instant(c.key || '').toLowerCase();
      const hintKey = 'settings_' + (c.key || '') + '_hint';
      const hint = this.translate.instant(hintKey).toLowerCase();
      const hintUseful = hint !== hintKey.toLowerCase();
      return (
        key.includes(q) ||
        label.includes(q) ||
        (hintUseful && hint.includes(q))
      );
    };
    const matchesCategory = (c: AppConfiguration): boolean =>
      cat === 'all' || this.resolveConfigCategoryId(c.key) === cat;
    const filtered = (this.configs || []).filter(
      c => !this.isAiConfigKey(c.key) && matchesCategory(c) && matchesSearch(c) && this.passesAdvancedFilter(c, q),
    );
    const byCat = new Map<AppConfigCategoryId, AppConfiguration[]>();
    for (const id of this.appConfigCategoryOrder) {
      byCat.set(id, []);
    }
    for (const c of filtered) {
      const id = this.resolveConfigCategoryId(c.key);
      byCat.get(id)!.push(c);
    }
    this.configSections = this.appConfigCategoryOrder
      .filter(id => (byCat.get(id) || []).length > 0)
      .map(id => ({
        id,
        icon: this.appConfigCategoryIcons[id],
        items: byCat.get(id)!,
      }));
  }

  private isAiConfigKey(key: string | undefined): boolean {
    return !!key && key.startsWith('ai.');
  }

  async ngOnInit() {
    this.isLoading = true;

    const translations = await this.translate.get(['a4', 'receipt']).toPromise();

    this.printingFormats = [
      {
        label: translations['a4'],
        value: 'a4',
      },
      {
        label: translations['receipt'],
        value: 'receipt',
      },
    ];

    this.loadConfigs();
    await this.checkBankPermissions();
    await this.loadBanks();

    await this.licenseCapabilitiesService.ensureLoaded();
    this.refreshTaxRulesFeatureFromLicense();
    this.licenseCapabilitiesSub = this.licenseCapabilitiesService.capabilitiesChanged$.subscribe(() => {
      this.refreshTaxRulesFeatureFromLicense();
    });

    // Options for auto order completion (enabled / disabled)
    this.autoOrderOptions = [
      { label: this.translate.instant('enabled'), value: 'active' },
      { label: this.translate.instant('disabled'), value: 'inactive' }
    ];

    // Options for boolean settings (true/false)
    this.booleanOptions = [
      { label: this.translate.instant('enabled'), value: 'true' },
      { label: this.translate.instant('disabled'), value: 'false' }
    ];

    this.processModeOptions = [
      { label: this.translate.instant('process_mode_hybrid'), value: 'HYBRID' },
      { label: this.translate.instant('process_mode_transaction'), value: 'TRANSACTION' },
      { label: this.translate.instant('process_mode_document_chain'), value: 'DOCUMENT_CHAIN' },
    ];

    this.aiProviderOptions = [
      { label: this.translate.instant('ai_provider_OPENAI'), value: 'OPENAI' },
      { label: this.translate.instant('ai_provider_ANTHROPIC'), value: 'ANTHROPIC' },
      { label: this.translate.instant('ai_provider_OLLAMA'), value: 'OLLAMA' },
      { label: this.translate.instant('ai_provider_GROQ'), value: 'GROQ' },
      { label: this.translate.instant('ai_provider_GOOGLE'), value: 'GOOGLE' },
      { label: this.translate.instant('ai_provider_OPENROUTER'), value: 'OPENROUTER' },
    ];
    this.aiInvoiceModeOptions = [
      { label: this.translate.instant('ai_invoice_mode_OFF'), value: 'OFF' },
      { label: this.translate.instant('ai_invoice_mode_HYBRID'), value: 'HYBRID' },
      { label: this.translate.instant('ai_invoice_mode_PRIMARY'), value: 'PRIMARY' },
    ];

    this.loadParameterUiPreferences();

    // Deep-link tabs: ?tab=banks | ?tab=tax-rules | ?tab=integrations | ?tab=channels | ?tab=parameters | ?tab=global
    const applyTabQuery = (tab: string | undefined): void => {
      let nextIndex = this.activeTabIndex;
      if (tab === 'banks') {
        nextIndex = 2;
      } else if (tab === 'tax-rules' || tab === 'tax') {
        nextIndex = 3;
      } else if (tab === 'integrations' || tab === 'channels') {
        nextIndex = 1;
      } else if (tab === 'parameters' || tab === 'global') {
        nextIndex = 0;
      } else {
        return;
      }
      if (nextIndex !== this.activeTabIndex) {
        this.activeTabIndex = nextIndex;
      }
    };
    applyTabQuery(this.route.snapshot.queryParamMap.get('tab') ?? undefined);
    this.routeTabQuerySub = this.route.queryParams
      .pipe(map(params => params['tab']), distinctUntilChanged())
      .subscribe(tab => applyTabQuery(tab));

    if (this.route.snapshot.queryParamMap.get('businessProfile') === '1') {
      this.activeTabIndex = 0;
      this.messageService.add({
        severity: 'info',
        summary: this.translate.instant('business_activity_profile'),
        detail: this.translate.instant('activity_profile_setup_prompt'),
        life: 8000,
      });
      /**
       * Do not call scrollIntoView for this deep link: smooth scrolling fights the mouse wheel and
       * window.scrollY often stays 0 when the document scrolls via another root, so guards never fired.
       * Strip the param so refresh/bookmark does not keep re-applying the hint flow.
       */
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { businessProfile: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }

    try {
      const roles = await this.keycloakService.getUserRoles();
      this.canManageActivityProfile = Array.isArray(roles) && roles.includes('ADMIN');
    } catch {
      this.canManageActivityProfile = false;
    }
    if (this.canManageActivityProfile) {
      await this.activityProfileService.ensureLoaded();
      this.rebuildBusinessProfileOptions();
      this.syncBusinessProfileFormFromContext();
    }

    this.translate.onLangChange.subscribe(() => {
      if (this.canManageActivityProfile) {
        this.rebuildBusinessProfileOptions();
      }
      this.refreshParameterViewModeLabels();
      this.onConfigFiltersChanged();
    });
  }

  private rebuildBusinessProfileOptions(): void {
    this.businessProfileOptions = [
      { label: this.translate.instant('business_activity_profile_GENERAL_RETAIL'), value: 'GENERAL_RETAIL' },
      { label: this.translate.instant('business_activity_profile_FASHION'), value: 'FASHION' },
      { label: this.translate.instant('business_activity_profile_PHARMACY'), value: 'PHARMACY' },
      { label: this.translate.instant('business_activity_profile_RESTAURANT'), value: 'RESTAURANT' },
      { label: this.translate.instant('business_activity_profile_WHOLESALE'), value: 'WHOLESALE' },
    ];
  }

  private syncBusinessProfileFormFromContext(): void {
    const p = this.activityProfileService.context?.businessActivityProfile ?? null;
    this.selectedBusinessProfile = p;
    this.originalBusinessProfile = p;
  }

  saveBusinessActivityProfile(): void {
    if (!this.selectedBusinessProfile) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('business_activity_profile_required'),
        life: 4000,
      });
      return;
    }
    const changing =
      this.originalBusinessProfile != null && this.originalBusinessProfile !== this.selectedBusinessProfile;
    if (changing) {
      this.confirmationService.confirm({
        message: this.translate.instant('activity_profile_change_confirm'),
        header: this.translate.instant('activity_profile_change_confirm_header'),
        icon: 'pi pi-exclamation-triangle',
        accept: () => void this.persistBusinessActivityProfile(true),
      });
      return;
    }
    void this.persistBusinessActivityProfile(false);
  }

  private async persistBusinessActivityProfile(confirmProfileChange: boolean): Promise<void> {
    if (!this.selectedBusinessProfile) {
      return;
    }
    this.savingBusinessProfile = true;
    try {
      const ctx = await firstValueFrom(
        this.activityProfileService.patchActivityProfile(this.selectedBusinessProfile, confirmProfileChange),
      );
      this.originalBusinessProfile = this.selectedBusinessProfile;
      const presetsApplied = ctx?.initialConfigurationPresetsApplied === true;
      if (presetsApplied) {
        await this.processModeService.refresh();
        await this.loadConfigs();
      }
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: presetsApplied
          ? `${this.translate.instant('business_activity_profile_saved')} ${this.translate.instant('activity_profile_presets_applied_hint')}`
          : this.translate.instant('business_activity_profile_saved'),
        life: presetsApplied ? 8000 : 4000,
      });
      if (this.route.snapshot.queryParamMap.get('businessProfile') === '1') {
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { businessProfile: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    } catch (e: any) {
      const status = e?.status;
      this.messageService.add({
        severity: status === 409 ? 'warn' : 'error',
        summary: this.translate.instant('error'),
        detail:
          status === 409
            ? this.translate.instant('activity_profile_conflict_detail')
            : this.translate.instant('error_saving_configuration'),
        life: 6000,
      });
    } finally {
      this.savingBusinessProfile = false;
    }
  }

  // Helper method to parse float values in templates
  parseFloat(value: string | number): number {
    if (typeof value === 'number') return value;
    return parseFloat(String(value)) || 0;
  }

  onGlobalFilter(table: Table, event: Event) {
    table.filterGlobal((event.target as HTMLInputElement).value, 'contains');
  }

  clear(table: Table) {
    table.clear();
  }

  async toggleEditMode(field: AppConfiguration) {
    if (field.isEditing) {
      const outcome = await this.commitConfigEdit(field);
      if (outcome === 'pending' || outcome === 'failed') {
        this.configs = [...this.configs];
        return;
      }
      field.isEditing = false;
    } else {
      if (this.isProcessModeKey(field.key)) {
        (field as AppConfiguration & { _processModeOriginal?: string })._processModeOriginal = field.value;
      }
      field.isEditing = true;
    }
    this.configs = [...this.configs];
  }

  private isProcessModeKey(key: string | undefined): boolean {
    return key === 'sales.process.mode' || key === 'purchase.process.mode';
  }

  /**
   * Persists the current row when leaving edit mode. Process mode keys may open a confirm dialog (returns pending).
   */
  private async commitConfigEdit(field: AppConfiguration): Promise<'saved' | 'pending' | 'failed'> {
    const config = this.configs.find(c => c.key === field.key);
    if (!config) {
      return 'saved';
    }
    config.value = field.value;
    const original = (field as AppConfiguration & { _processModeOriginal?: string })._processModeOriginal;

    if (this.isProcessModeKey(config.key)) {
      const changed =
        String(config.value || '').toUpperCase() !== String(original || '').toUpperCase();
      if (changed) {
        try {
          const countsObs = await this.appConfigService.getProcessModePipelineCounts();
          const counts = await firstValueFrom(countsObs);
          const n =
            config.key === 'sales.process.mode'
              ? counts.openSalesPipelineCount
              : counts.openPurchasePipelineCount;
          if (n > 0) {
            this.confirmationService.confirm({
              message: this.translate.instant(
                config.key === 'sales.process.mode'
                  ? 'process_mode_change_confirm_sales'
                  : 'process_mode_change_confirm_purchases',
                { count: n }
              ),
              header: this.translate.instant('process_mode_change_confirm_header'),
              icon: 'pi pi-exclamation-triangle',
              acceptLabel: this.translate.instant('process_mode_change_force_accept'),
              rejectLabel: this.translate.instant('cancel'),
              accept: async () => {
                try {
                  await this.persistConfig(config, true);
                  field.isEditing = false;
                } catch {
                  /* keep edit mode */
                }
                this.configs = [...this.configs];
              },
              reject: () => {
                config.value = original ?? config.value;
                this.configs = [...this.configs];
              },
            });
            return 'pending';
          }
        } catch (e) {
          console.error(e);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('process_mode_pipeline_counts_error'),
            life: 5000,
          });
          return 'failed';
        }
      }
    }

    try {
      await this.persistConfig(config, false);
      return 'saved';
    } catch {
      return 'failed';
    }
  }

  private async persistConfig(config: AppConfiguration, forceProcessModeChange: boolean): Promise<void> {
    try {
      const obs = await this.appConfigService.saveConfiguration(config, forceProcessModeChange);
      await firstValueFrom(obs);
      if (config.key) {
        this.appConfigService.notifyConfigurationSaved(config.key);
      }
      await this.maybeRefreshProcessMode(config.key);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('configuration_updated'),
        life: 3000,
      });
      this.loadConfigs();
    } catch (err: any) {
      console.error(err);
      const msg = err?.error?.message || this.translate.instant('error_while_updating_configuration');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 6000,
      });
      throw err;
    }
  }

  async loadConfigs(): Promise<void> {
    try {
      (await this.appConfigService.getAllConfigurations()).subscribe({
        next: (params: AppConfiguration[]) => {
          // Only keep non-editable configs and exclude email-related configurations
          const nonEditableConfigs = params.filter(config =>
            config.editable && !config.key?.startsWith('email.') && !config.key?.startsWith('telegram.')
              && !config.key?.startsWith('whatsapp.')
          );

          this.configs = nonEditableConfigs.sort((a, b) => a.id - b.id);

          // Find tax config (if you need it even if editable, use original list `params`)
          const taxConfig = params.find(config => config.key === 'tax');
          const autoOrderComplete = params.find(config => config.key === 'autoOrderComplete');

          if (taxConfig) {
            this.taxPercentage = parseFloat(taxConfig.value) * 100;
          }

          // Initialize refund percentages
          const refundDamagedConfig = params.find(config => config.key === 'return.refund.percentage.damaged');
          if (refundDamagedConfig) {
            this.refundPercentageDamaged = parseFloat(refundDamagedConfig.value) * 100;
          }

          const refundUsedConfig = params.find(config => config.key === 'return.refund.percentage.used');
          if (refundUsedConfig) {
            this.refundPercentageUsed = parseFloat(refundUsedConfig.value) * 100;
          }

          const refundNewConfig = params.find(config => config.key === 'return.refund.percentage.new');
          if (refundNewConfig) {
            this.refundPercentageNew = parseFloat(refundNewConfig.value) * 100;
          }

          if (autoOrderComplete) {
            this.autoOrderCompleteChecked = autoOrderComplete.value === 'active';
          }

          this.appConfigCurrency = params.find(config => config.key === 'currency');

          this.onConfigFiltersChanged();
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading configurations:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_configurations'),
            life: 3000
          });
          this.isLoading = false;
        }
      });
    } catch (error) {
      console.error('Error loading configurations:', error);
      this.isLoading = false;
    }
  }


  trackByConfig(index: number, config: AppConfiguration): number {
    return config.id; // or config.key if that's unique
  }

  getPrintingFormatLabel(value: string): string {
    const format = this.printingFormats.find(f => f.value === value);
    return format ? format.label : value;
  }

  onTaxChange(value: number) {
    // Convert percentage (e.g., 20) back to decimal (e.g., 0.2) and update the config value
    const taxConfig = this.configs.find(config => config.key === 'tax');
    if (taxConfig) {
      // Convert the result back to string and update the value
      taxConfig.value = (value / 100).toString();
    }
  }

  onRefundPercentageChange(value: number, configKey: string) {
    // Convert percentage (e.g., 50) back to decimal (e.g., 0.5) and update the config value
    const refundConfig = this.configs.find(config => config.key === configKey);
    if (refundConfig) {
      // Convert the result back to string and update the value
      refundConfig.value = (value / 100).toString();
    }
  }

  // Banks methods
  async checkBankPermissions() {
    try {
      const profile = await this.keycloakService.loadUserProfile();
      const userId = profile.id;
      await this.permissionService.init(userId).toPromise();
      this.canAddBank = this.permissionService.canCreate(this.Ressource);
      this.canEditBank = this.permissionService.canUpdate(this.Ressource);
      this.canDeleteBank = this.permissionService.canDelete(this.Ressource);
      this.canReadBank = this.permissionService.canRead(this.Ressource);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  async loadBanks() {
    this.isLoadingBanks = true;
    try {
      const response = await firstValueFrom(await this.bankAccountService.getBanks(this.activeFilter));
      this.banks = response || [];
    } catch (error) {
      console.error('Error loading banks:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_banks'),
        life: 3000
      });
    } finally {
      this.isLoadingBanks = false;
    }
  }

  openNewBank() {
    if (!this.canAddBank) return;
    this.bank = {};
    this.submittedBank = false;
    this.bankDialog = true;
  }

  editBank(bank: Bank) {
    if (!this.canEditBank) return;
    this.bank = { ...bank };
    this.bankDialog = true;
    this.submittedBank = false;
  }

  deleteBank(bank: Bank) {
    if (!this.canDeleteBank) return;
    this.bank = { ...bank };
    this.deleteBankDialog = true;
  }

  deleteSelectedBanks() {
    if (!this.canDeleteBank) return;
    this.deleteBanksDialog = true;
  }

  async confirmDeleteBank() {
    this.deleteBankDialog = false;
    try {
      await firstValueFrom(await this.bankAccountService.deleteBank(this.bank.bankId!));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('bank_deleted'),
        life: 3000
      });
      await this.loadBanks();
      this.bank = {};
    } catch (error: any) {
      console.error('Error deleting bank:', error);
      const errorMsg = error?.error?.message || this.translate.instant('error_deleting_bank');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    }
  }

  async confirmDeleteSelectedBanks() {
    this.deleteBanksDialog = false;
    const deletePromises = this.selectedBanks.map(async bank => {
      const observable$ = await this.bankAccountService.deleteBank(bank.bankId!);
      return firstValueFrom(observable$);
    });
    
    try {
      await Promise.all(deletePromises);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('banks_deleted'),
        life: 3000
      });
      this.selectedBanks = [];
      await this.loadBanks();
    } catch (error) {
      console.error('Error deleting banks:', error);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_deleting_banks'),
        life: 3000
      });
    }
  }

  hideBankDialog() {
    this.bankDialog = false;
    this.submittedBank = false;
    this.bank = {};
  }

  async saveBank() {
    this.submittedBank = true;

    if (!this.bank.name || this.bank.name.trim() === '') {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('bank_name_required'),
        life: 3000
      });
      return;
    }

    if (this.bank.email && !this.isValidEmail(this.bank.email)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_email_format'),
        life: 3000
      });
      return;
    }

    if (this.bank.website && !this.isValidUrl(this.bank.website)) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_url_format'),
        life: 3000
      });
      return;
    }

    try {
      if (this.bank.bankId) {
        await firstValueFrom(await this.bankAccountService.updateBank(this.bank.bankId, this.bank));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('bank_updated_successfully'),
          life: 3000
        });
      } else {
        await firstValueFrom(await this.bankAccountService.createBank(this.bank));
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('successful'),
          detail: this.translate.instant('bank_created_successfully'),
          life: 3000
        });
      }
      this.bankDialog = false;
      this.bank = {};
      await this.loadBanks();
    } catch (error: any) {
      console.error('Error saving bank:', error);
      const errorMsg = error?.error?.message || this.translate.instant('error_saving_bank');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: errorMsg,
        life: 3000
      });
    }
  }

  viewBankDetails(bank: Bank) {
    if (!this.canReadBank) return;
    this.bank = { ...bank };
    this.bankDetailsDialog = true;
  }

  async onActiveFilterChange() {
    await this.loadBanks();
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

}
