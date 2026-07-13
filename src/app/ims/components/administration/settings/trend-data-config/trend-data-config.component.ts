import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AppConfiguration } from 'src/app/models/appConfiguration';
import { AppConfigurationService } from 'src/app/services/app-configuration.service';
import { AiIntegrationService } from 'src/app/services/ai-integration.service';
import { LicenseCapabilitiesService } from 'src/app/services/license-capabilities.service';

/**
 * Enterprise integration: live market-trend data (web search providers) grounding NadiPilot's
 * assortment advice. Mirrors the AI integration page pattern; non-Enterprise licenses see an
 * upgrade notice instead of the form (the backend enforces the license at use-time too).
 */
@Component({
  selector: 'app-trend-data-config',
  templateUrl: './trend-data-config.component.html',
  styleUrls: ['../ai-integration-config/ai-integration-config.component.css'],
  providers: [MessageService],
})
export class TrendDataConfigComponent implements OnInit {
  isLoading = true;
  isSaving = false;
  isTesting = false;
  licensed = false;
  lastTestStatus: 'idle' | 'success' | 'error' = 'idle';
  lastTestMessage = '';

  provider = 'NONE';
  apiKey = '';
  maxResults = 5;

  providerOptions: { label: string; value: string }[] = [];

  private configs: AppConfiguration[] = [];

  constructor(
    private location: Location,
    private appConfigService: AppConfigurationService,
    private aiIntegrationService: AiIntegrationService,
    private licenseCapabilitiesService: LicenseCapabilitiesService,
    private messageService: MessageService,
    private translate: TranslateService,
  ) {}

  ngOnInit(): void {
    this.providerOptions = [
      { label: this.translate.instant('trend_provider_NONE'), value: 'NONE' },
      { label: this.translate.instant('trend_provider_TAVILY'), value: 'TAVILY' },
    ];
    this.licensed = this.licenseCapabilitiesService.isFeatureEnabled('MARKET_TRENDS_INTEGRATION');
    void this.load();
  }

  goBack(): void {
    this.location.back();
  }

  get isConfigured(): boolean {
    return this.provider !== 'NONE' && !!this.apiKey.trim();
  }

  private async load(): Promise<void> {
    this.isLoading = true;
    try {
      await this.appConfigService.loadToken();
      const obs = await this.appConfigService.getAllConfigurations();
      const params = await firstValueFrom(obs);
      this.configs = params || [];
      this.provider = (this.value('trends.provider') || 'NONE').toUpperCase();
      this.apiKey = this.value('trends.api.key') || '';
      const max = parseInt(this.value('trends.max.results') || '5', 10);
      this.maxResults = Number.isFinite(max) && max > 0 ? max : 5;
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('error_loading_configurations'),
        life: 4000,
      });
    } finally {
      this.isLoading = false;
    }
  }

  private value(key: string): string {
    return this.configs.find(c => c.key === key)?.value || '';
  }

  async save(): Promise<void> {
    if (!this.licensed || this.isSaving) {
      return;
    }
    this.isSaving = true;
    try {
      await this.saveOne('trends.provider', (this.provider || 'NONE').toUpperCase());
      await this.saveOne('trends.api.key', this.apiKey.trim());
      await this.saveOne('trends.max.results', String(Math.max(1, Math.min(this.maxResults || 5, 10))));
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('trends_config_saved'),
        life: 3000,
      });
    } catch (error: any) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: error?.error?.message || this.translate.instant('error_saving_configuration'),
        life: 5000,
      });
    } finally {
      this.isSaving = false;
    }
  }

  private async saveOne(key: string, value: string): Promise<void> {
    const existing = this.configs.find(c => c.key === key);
    const payload: AppConfiguration = { ...(existing || { key }), key, value, editable: true } as AppConfiguration;
    const obs = await this.appConfigService.saveConfiguration(payload, false);
    await firstValueFrom(obs);
  }

  async testConnection(): Promise<void> {
    if (this.isTesting) {
      return;
    }
    this.isTesting = true;
    this.lastTestStatus = 'idle';
    try {
      const res = await firstValueFrom(this.aiIntegrationService.testTrendsConnection());
      this.lastTestStatus = 'success';
      this.lastTestMessage = res?.message || this.translate.instant('trends_test_success');
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.lastTestMessage,
        life: 4000,
      });
    } catch (error: any) {
      this.lastTestStatus = 'error';
      this.lastTestMessage = error?.error?.message || this.translate.instant('trends_test_failed');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.lastTestMessage,
        life: 6000,
      });
    } finally {
      this.isTesting = false;
    }
  }
}
