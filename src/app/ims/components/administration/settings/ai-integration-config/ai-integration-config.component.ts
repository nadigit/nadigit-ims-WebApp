import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AppConfiguration } from 'src/app/models/appConfiguration';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import {
  AiIntegrationService,
  AiLlmTestResult,
} from 'src/app/services/ai-integration.service';

type AiFieldKind = 'boolean' | 'provider' | 'fallbackProvider' | 'invoiceMode' | 'secret' | 'hybridThreshold' | 'maxChars' | 'integer' | 'endpoint' | 'text';

@Component({
  selector: 'app-ai-integration-config',
  templateUrl: './ai-integration-config.component.html',
  styleUrls: ['./ai-integration-config.component.css'],
  providers: [MessageService],
})
export class AiIntegrationConfigComponent implements OnInit {
  isLoading = true;
  isTestingLlm = false;
  isApplyingPreset = false;
  lastTestStatus: 'idle' | 'success' | 'error' = 'idle';
  lastTestMessage = '';
  lastTestAt = '';
  configs: AppConfiguration[] = [];

  booleanOptions: { label: string; value: string }[] = [];
  aiProviderOptions: { label: string; value: string }[] = [];
  aiFallbackProviderOptions: { label: string; value: string }[] = [];
  aiInvoiceModeOptions: { label: string; value: string }[] = [];

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

  private readonly aiBooleanConfigKeys = new Set<string>([
    'ai.integration.enabled',
    'ai.forecast.enabled',
    'ai.forecast.narrative.enabled',
  ]);

  private readonly alwaysVisibleConfigKeys = new Set<string>([
    'ai.integration.enabled',
    'ai.integration.provider',
    'ai.integration.fallback.provider',
    'ai.invoice.mode',
    'ai.invoice.hybrid.confidence.threshold',
    'ai.invoice.max.context.chars',
    'ai.forecast.enabled',
    'ai.forecast.history.days',
    'ai.forecast.horizon.days',
    'ai.forecast.top.items.limit',
    'ai.forecast.narrative.enabled',
  ]);

  private readonly providerSpecificConfigKeys: Record<string, ReadonlyArray<string>> = {
    OPENAI: ['ai.openai.api.key', 'ai.openai.base.url', 'ai.openai.model'],
    ANTHROPIC: ['ai.anthropic.api.key', 'ai.anthropic.base.url', 'ai.anthropic.model'],
    OLLAMA: ['ai.ollama.base.url', 'ai.ollama.model'],
    GROQ: ['ai.groq.api.key', 'ai.groq.base.url', 'ai.groq.model'],
    GOOGLE: ['ai.google.api.key', 'ai.google.base.url', 'ai.google.model'],
    OPENROUTER: ['ai.openrouter.api.key', 'ai.openrouter.base.url', 'ai.openrouter.model'],
  };

  private static readonly KEY_ORDER: string[] = [
    'ai.integration.enabled',
    'ai.integration.provider',
    'ai.integration.fallback.provider',
    'ai.openai.api.key',
    'ai.openai.base.url',
    'ai.openai.model',
    'ai.anthropic.api.key',
    'ai.anthropic.base.url',
    'ai.anthropic.model',
    'ai.ollama.base.url',
    'ai.ollama.model',
    'ai.groq.api.key',
    'ai.groq.base.url',
    'ai.groq.model',
    'ai.google.api.key',
    'ai.google.base.url',
    'ai.google.model',
    'ai.openrouter.api.key',
    'ai.openrouter.base.url',
    'ai.openrouter.model',
    'ai.invoice.mode',
    'ai.invoice.hybrid.confidence.threshold',
    'ai.invoice.max.context.chars',
    'ai.forecast.enabled',
    'ai.forecast.history.days',
    'ai.forecast.horizon.days',
    'ai.forecast.top.items.limit',
    'ai.forecast.narrative.enabled',
  ];

  private static readonly DEFAULT_VALUES: Record<string, string> = {
    'ai.integration.enabled': 'false',
    'ai.integration.provider': 'OPENAI',
    'ai.integration.fallback.provider': 'NONE',
    'ai.openai.api.key': '',
    'ai.openai.base.url': 'https://api.openai.com/v1',
    'ai.openai.model': 'gpt-4o-mini',
    'ai.anthropic.api.key': '',
    'ai.anthropic.base.url': 'https://api.anthropic.com/v1',
    'ai.anthropic.model': 'claude-3-5-sonnet-20241022',
    'ai.ollama.base.url': 'http://localhost:11434',
    'ai.ollama.model': 'llama3.1',
    'ai.groq.api.key': '',
    'ai.groq.base.url': 'https://api.groq.com/openai/v1',
    'ai.groq.model': 'llama-3.1-8b-instant',
    'ai.google.api.key': '',
    'ai.google.base.url': 'https://generativelanguage.googleapis.com/v1beta',
    'ai.google.model': 'gemini-1.5-flash',
    'ai.openrouter.api.key': '',
    'ai.openrouter.base.url': 'https://openrouter.ai/api/v1',
    'ai.openrouter.model': 'google/gemini-2.0-flash-exp:free',
    'ai.invoice.mode': 'HYBRID',
    'ai.invoice.hybrid.confidence.threshold': '0.5',
    'ai.invoice.max.context.chars': '24000',
    'ai.forecast.enabled': 'false',
    'ai.forecast.history.days': '90',
    'ai.forecast.horizon.days': '30',
    'ai.forecast.top.items.limit': '30',
    'ai.forecast.narrative.enabled': 'false',
  };

  readonly providerPresets: ReadonlyArray<{
    id: 'ollama_free' | 'groq_low_cost' | 'google_low_cost' | 'openrouter_free';
    provider: 'OLLAMA' | 'GROQ' | 'GOOGLE' | 'OPENROUTER';
    costTierKey: string;
    summaryKey: string;
    modelKey: string;
    applyValues: Record<string, string>;
  }> = [
    {
      id: 'ollama_free',
      provider: 'OLLAMA',
      costTierKey: 'ai_preset_cost_free_local',
      summaryKey: 'ai_preset_ollama_summary',
      modelKey: 'llama3.1',
      applyValues: {
        'ai.integration.provider': 'OLLAMA',
        'ai.ollama.base.url': 'http://localhost:11434',
        'ai.ollama.model': 'llama3.1',
      },
    },
    {
      id: 'groq_low_cost',
      provider: 'GROQ',
      costTierKey: 'ai_preset_cost_free_or_low',
      summaryKey: 'ai_preset_groq_summary',
      modelKey: 'llama-3.1-8b-instant',
      applyValues: {
        'ai.integration.provider': 'GROQ',
        'ai.groq.base.url': 'https://api.groq.com/openai/v1',
        'ai.groq.model': 'llama-3.1-8b-instant',
      },
    },
    {
      id: 'google_low_cost',
      provider: 'GOOGLE',
      costTierKey: 'ai_preset_cost_free_or_low',
      summaryKey: 'ai_preset_google_summary',
      modelKey: 'gemini-1.5-flash',
      applyValues: {
        'ai.integration.provider': 'GOOGLE',
        'ai.google.base.url': 'https://generativelanguage.googleapis.com/v1beta',
        'ai.google.model': 'gemini-1.5-flash',
      },
    },
    {
      id: 'openrouter_free',
      provider: 'OPENROUTER',
      costTierKey: 'ai_preset_cost_free_or_low',
      summaryKey: 'ai_preset_openrouter_summary',
      modelKey: 'google/gemini-2.0-flash-exp:free',
      applyValues: {
        'ai.integration.provider': 'OPENROUTER',
        'ai.openrouter.base.url': 'https://openrouter.ai/api/v1',
        'ai.openrouter.model': 'google/gemini-2.0-flash-exp:free',
      },
    },
  ];

  constructor(
    private location: Location,
    private appConfigService: AppConfigurationService,
    private aiIntegrationService: AiIntegrationService,
    private messageService: MessageService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.booleanOptions = [
      { label: this.translate.instant('enabled'), value: 'true' },
      { label: this.translate.instant('disabled'), value: 'false' },
    ];
    this.aiProviderOptions = [
      { label: this.translate.instant('ai_provider_OPENAI'), value: 'OPENAI' },
      { label: this.translate.instant('ai_provider_ANTHROPIC'), value: 'ANTHROPIC' },
      { label: this.translate.instant('ai_provider_OLLAMA'), value: 'OLLAMA' },
      { label: this.translate.instant('ai_provider_GROQ'), value: 'GROQ' },
      { label: this.translate.instant('ai_provider_GOOGLE'), value: 'GOOGLE' },
      { label: this.translate.instant('ai_provider_OPENROUTER'), value: 'OPENROUTER' },
    ];
    this.aiFallbackProviderOptions = [
      { label: this.translate.instant('ai_provider_NONE'), value: 'NONE' },
      ...this.aiProviderOptions,
    ];
    this.aiInvoiceModeOptions = [
      { label: this.translate.instant('ai_invoice_mode_OFF'), value: 'OFF' },
      { label: this.translate.instant('ai_invoice_mode_HYBRID'), value: 'HYBRID' },
      { label: this.translate.instant('ai_invoice_mode_PRIMARY'), value: 'PRIMARY' },
    ];
    void this.load();
  }

  goBack(): void {
    this.location.back();
  }

  async onTestLlmConnection(): Promise<void> {
    this.isTestingLlm = true;
    try {
      const r: AiLlmTestResult = await firstValueFrom(
        this.aiIntegrationService.testLlmConnection(),
      );
      const provider = (r?.provider || '').trim();
      const detail =
        (r?.message || '') +
        (provider ? ` (${provider})` : '') +
        (r?.responsePreview ? ` — ${r.responsePreview}` : '');
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('ai_test_llm_success_title'),
        detail: detail || this.translate.instant('ai_test_llm_success_title'),
        life: 8000,
      });
      this.lastTestStatus = 'success';
      this.lastTestMessage = detail || this.translate.instant('ai_test_llm_success_title');
      this.lastTestAt = new Date().toLocaleString();
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || this.translate.instant('ai_test_llm_error_generic');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 8000,
      });
      this.lastTestStatus = 'error';
      this.lastTestMessage = msg;
      this.lastTestAt = new Date().toLocaleString();
    } finally {
      this.isTestingLlm = false;
    }
  }

  trackByKey(_: number, c: AppConfiguration): string {
    return c.key || String(c.id);
  }

  getFieldKind(key: string | undefined): AiFieldKind {
    if (!key) {
      return 'text';
    }
    if (this.aiBooleanConfigKeys.has(key)) {
      return 'boolean';
    }
    if (key === 'ai.integration.provider') {
      return 'provider';
    }
    if (key === 'ai.integration.fallback.provider') {
      return 'fallbackProvider';
    }
    if (key === 'ai.invoice.mode') {
      return 'invoiceMode';
    }
    if (this.aiSecretConfigKeys.has(key)) {
      return 'secret';
    }
    if (key === 'ai.invoice.hybrid.confidence.threshold') {
      return 'hybridThreshold';
    }
    if (key === 'ai.invoice.max.context.chars') {
      return 'maxChars';
    }
    if (key === 'ai.forecast.history.days'
      || key === 'ai.forecast.horizon.days'
      || key === 'ai.forecast.top.items.limit') {
      return 'integer';
    }
    if (this.aiEndpointConfigKeys.has(key)) {
      return 'endpoint';
    }
    return 'text';
  }

  isAiSecretConfigKey(key: string | undefined): boolean {
    return !!key && this.aiSecretConfigKeys.has(key);
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
    if (v === 'NONE' || v === '') {
      return this.translate.instant('ai_provider_NONE');
    }
    const opt = this.aiProviderOptions.find(o => o.value === v);
    return opt ? opt.label : (value || '');
  }

  getConfigValue(key: string): string {
    return this.configs.find(c => c.key === key)?.value || '';
  }

  get displayedConfigs(): AppConfiguration[] {
    return this.configs.filter(c => this.shouldDisplayConfig(c.key));
  }

  isIntegrationEnabled(): boolean {
    return String(this.getConfigValue('ai.integration.enabled')).toLowerCase() === 'true';
  }

  getCurrentProviderValue(): string {
    const v = this.getConfigValue('ai.integration.provider');
    return (v || 'NONE').toUpperCase();
  }

  getFallbackProviderValue(): string {
    const v = this.getConfigValue('ai.integration.fallback.provider');
    return (v || 'NONE').toUpperCase();
  }

  private shouldDisplayConfig(key: string | undefined): boolean {
    if (!key) {
      return false;
    }
    if (this.alwaysVisibleConfigKeys.has(key)) {
      return true;
    }
    // The fallback provider's credentials/model must be editable too when a fallback is selected.
    const fallbackKeys = this.providerSpecificConfigKeys[this.getFallbackProviderValue()];
    if (Array.isArray(fallbackKeys) && fallbackKeys.includes(key)) {
      return true;
    }
    const provider = this.getCurrentProviderValue();
    const providerKeys = this.providerSpecificConfigKeys[provider];
    if (Array.isArray(providerKeys)) {
      return providerKeys.includes(key);
    }
    // Unknown provider fallback: keep all model-specific keys visible.
    return Object.values(this.providerSpecificConfigKeys).some(keys => keys.includes(key));
  }

  getCurrentProviderLabel(): string {
    return this.getAiProviderLabel(this.getCurrentProviderValue());
  }

  getCurrentProviderModel(): string {
    const p = this.getCurrentProviderValue();
    if (p === 'OPENAI') return this.getConfigValue('ai.openai.model');
    if (p === 'ANTHROPIC') return this.getConfigValue('ai.anthropic.model');
    if (p === 'OLLAMA') return this.getConfigValue('ai.ollama.model');
    if (p === 'GROQ') return this.getConfigValue('ai.groq.model');
    if (p === 'GOOGLE') return this.getConfigValue('ai.google.model');
    if (p === 'OPENROUTER') return this.getConfigValue('ai.openrouter.model');
    return '';
  }

  isCurrentProviderKeyConfigured(): boolean {
    const p = this.getCurrentProviderValue();
    if (p === 'OLLAMA' || p === 'NONE') {
      return true;
    }
    const map: Record<string, string> = {
      OPENAI: 'ai.openai.api.key',
      ANTHROPIC: 'ai.anthropic.api.key',
      GROQ: 'ai.groq.api.key',
      GOOGLE: 'ai.google.api.key',
      OPENROUTER: 'ai.openrouter.api.key',
    };
    const key = map[p];
    return key ? (this.getConfigValue(key) || '').trim().length > 0 : false;
  }

  isProviderConfigured(): boolean {
    const p = this.getCurrentProviderValue();
    return !!p && p !== 'NONE';
  }

  isLastTestSuccessful(): boolean {
    return this.lastTestStatus === 'success';
  }

  isAiReadinessOk(): boolean {
    return this.isIntegrationEnabled()
      && this.isProviderConfigured()
      && this.isCurrentProviderKeyConfigured()
      && this.isLastTestSuccessful();
  }

  async applyProviderPreset(presetId: 'ollama_free' | 'groq_low_cost' | 'google_low_cost' | 'openrouter_free'): Promise<void> {
    const preset = this.providerPresets.find(p => p.id === presetId);
    if (!preset || this.isApplyingPreset) {
      return;
    }
    this.isApplyingPreset = true;
    try {
      for (const [key, value] of Object.entries(preset.applyValues)) {
        const existing = this.configs.find(c => c.key === key);
        const payload: AppConfiguration = existing
          ? { ...existing, value, editable: existing.editable ?? true }
          : { key, value, editable: true };
        const obs = await this.appConfigService.saveConfiguration(payload, false);
        await firstValueFrom(obs);
      }
      await this.load();
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('successful'),
        detail: this.translate.instant('ai_preset_applied_success'),
        life: 3500,
      });
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || this.translate.instant('error_while_updating_configuration');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: msg,
        life: 5000,
      });
    } finally {
      this.isApplyingPreset = false;
    }
  }

  getAiInvoiceModeLabel(value: string): string {
    const v = (value || '').toUpperCase();
    const opt = this.aiInvoiceModeOptions.find(o => o.value === v);
    return opt ? opt.label : (value || '');
  }

  parseFloatVal(value: string | number): number {
    if (typeof value === 'number') {
      return value;
    }
    return parseFloat(String(value)) || 0;
  }

  parseIntVal(value: string | number): number {
    if (typeof value === 'number') {
      return Math.trunc(value);
    }
    const v = parseInt(String(value), 10);
    return Number.isFinite(v) ? v : 0;
  }

  async load(): Promise<void> {
    this.isLoading = true;
    try {
      await this.appConfigService.loadToken();
      const obs = await this.appConfigService.getAllConfigurations();
      const params: AppConfiguration[] = await firstValueFrom(obs);
      const aiFromDb = params.filter(c => c.editable && c.key?.startsWith('ai.'));
      const byKey = new Map<string, AppConfiguration>();
      for (const cfg of aiFromDb) {
        if (cfg.key) {
          byKey.set(cfg.key, cfg);
        }
      }

      // Ensure every expected ai.* key is visible even if missing from DB (legacy migrated envs).
      for (const key of AiIntegrationConfigComponent.KEY_ORDER) {
        if (!byKey.has(key)) {
          byKey.set(key, {
            key,
            value: AiIntegrationConfigComponent.DEFAULT_VALUES[key] ?? '',
            editable: true,
            isEditing: false,
          });
        }
      }

      const ai = Array.from(byKey.values());
      ai.sort((a, b) => this.keyOrder(a.key) - this.keyOrder(b.key));
      this.configs = ai;
    } catch (e) {
      console.error(e);
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_configurations'),
        life: 5000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  private keyOrder(key: string | undefined): number {
    if (!key) {
      return 9999;
    }
    const i = AiIntegrationConfigComponent.KEY_ORDER.indexOf(key);
    return i >= 0 ? i : 1000 + key.charCodeAt(0);
  }

  async toggleEditMode(field: AppConfiguration): Promise<void> {
    if (field.isEditing) {
      try {
        await this.persistConfig(field);
        field.isEditing = false;
      } catch {
        /* keep edit mode */
      }
    } else {
      field.isEditing = true;
    }
    this.configs = [...this.configs];
  }

  private async persistConfig(config: AppConfiguration): Promise<void> {
    const obs = await this.appConfigService.saveConfiguration(config, false);
    await firstValueFrom(obs);
    if (config.key) {
      this.appConfigService.notifyConfigurationSaved(config.key);
    }
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('successful'),
      detail: this.translate.instant('configuration_updated'),
      life: 3000,
    });
    await this.load();
  }

}
