import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { WhatsAppConfigService } from 'src/app/services/whatsapp-config.service';

@Component({
  selector: 'app-whatsapp-config',
  templateUrl: './whatsapp-config.component.html',
  styleUrls: ['./whatsapp-config.component.css']
})
export class WhatsAppConfigComponent implements OnInit {
  form!: FormGroup;
  recipientNumbers: string[] = [];
  newRecipient = '';
  isLoading = false;
  isSaving = false;
  isSendingTest = false;
  showToken = false;
  accessTokenConfigured = false;
  testDialog = false;
  testTo = '';
  testMessage = '';

  constructor(
    private fb: FormBuilder,
    private whatsAppConfigService: WhatsAppConfigService,
    private messageService: MessageService,
    private translate: TranslateService,
    private location: Location
  ) {
    this.form = this.fb.group({
      enabled: [false],
      accessToken: [''],
      phoneNumberId: [''],
      graphApiVersion: ['v21.0'],
      templateSendEnabled: [false],
      templateName: [''],
      templateLanguage: ['en'],
      templateBodyParamStyle: ['positional'],
      templateBodyParameterName: ['']
    });
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  digitsOnly(input: string): string {
    return (input || '').replace(/\D/g, '');
  }

  /** Match backend: strip {{ }} for Meta parameter_name */
  normalizedBodyParamName(raw: string): string {
    let s = (raw || '').trim();
    if (s.startsWith('{{') && s.endsWith('}}') && s.length > 4) {
      s = s.slice(2, -2).trim();
    }
    return s;
  }

  async loadConfig(): Promise<void> {
    this.isLoading = true;
    try {
      await this.whatsAppConfigService.loadToken();
      this.whatsAppConfigService.getConfig().subscribe({
        next: (cfg) => {
          this.form.patchValue({
            enabled: cfg.enabled === true,
            accessToken: '',
            phoneNumberId: cfg.phoneNumberId || '',
            graphApiVersion: cfg.graphApiVersion || 'v21.0',
            templateSendEnabled: cfg.templateSendEnabled === true,
            templateName: cfg.templateName || '',
            templateLanguage: cfg.templateLanguage || 'en',
            templateBodyParamStyle: cfg.templateBodyParamStyle === 'named' ? 'named' : 'positional',
            templateBodyParameterName: cfg.templateBodyParameterName || ''
          });
          this.recipientNumbers = [...(cfg.recipientNumbers || [])];
          this.accessTokenConfigured = cfg.accessTokenConfigured === true;
          this.isLoading = false;
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_whatsapp_config'),
            life: 4000
          });
          this.isLoading = false;
        }
      });
    } catch {
      this.isLoading = false;
    }
  }

  isValidInternationalNumber(raw: string): boolean {
    const d = this.digitsOnly(raw);
    return d.length >= 8 && d.length <= 15;
  }

  addRecipient(): void {
    const v = this.newRecipient.trim();
    if (!this.isValidInternationalNumber(v)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('whatsapp_invalid_phone'),
        life: 4000
      });
      return;
    }
    const normalized = this.digitsOnly(v);
    if (this.recipientNumbers.includes(normalized)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('whatsapp_phone_duplicate'),
        life: 3000
      });
      return;
    }
    this.recipientNumbers = [...this.recipientNumbers, normalized];
    this.newRecipient = '';
  }

  removeRecipient(num: string): void {
    this.recipientNumbers = this.recipientNumbers.filter(n => n !== num);
  }

  onRecipientKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addRecipient();
    }
  }

  async save(): Promise<void> {
    const phoneId = (this.form.get('phoneNumberId')?.value || '').trim();
    const version = (this.form.get('graphApiVersion')?.value || '').trim();
    if (!phoneId || !version) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('whatsapp_required_meta_fields'),
        life: 4000
      });
      return;
    }

    const templateOn = !!this.form.get('templateSendEnabled')?.value;
    const tmplName = (this.form.get('templateName')?.value || '').trim();
    if (templateOn && !tmplName) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('whatsapp_template_name_required'),
        life: 5000
      });
      return;
    }

    const paramStyle = (this.form.get('templateBodyParamStyle')?.value || 'positional') === 'named' ? 'named' : 'positional';
    const paramNameRaw = (this.form.get('templateBodyParameterName')?.value || '').trim();
    if (templateOn && paramStyle === 'named' && !this.normalizedBodyParamName(paramNameRaw)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('whatsapp_template_parameter_name_required'),
        life: 5000
      });
      return;
    }

    this.isSaving = true;
    const token = (this.form.get('accessToken')?.value || '').trim();
    const body: {
      enabled: boolean;
      phoneNumberId: string;
      graphApiVersion: string;
      recipientNumbers: string[];
      templateSendEnabled: boolean;
      templateName: string;
      templateLanguage: string;
      templateBodyParamStyle: string;
      templateBodyParameterName: string;
      accessToken?: string;
    } = {
      enabled: !!this.form.get('enabled')?.value,
      phoneNumberId: phoneId,
      graphApiVersion: version,
      recipientNumbers: [...this.recipientNumbers],
      templateSendEnabled: templateOn,
      templateName: tmplName,
      templateLanguage: (this.form.get('templateLanguage')?.value || 'en').trim() || 'en',
      templateBodyParamStyle: paramStyle,
      templateBodyParameterName: paramNameRaw
    };
    if (token) {
      body.accessToken = token;
    }
    try {
      await this.whatsAppConfigService.loadToken();
      this.whatsAppConfigService.updateConfig(body).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('whatsapp_config_saved'),
            life: 3000
          });
          this.form.patchValue({ accessToken: '' });
          this.accessTokenConfigured = this.accessTokenConfigured || !!token;
          this.isSaving = false;
          void this.loadConfig();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_saving_whatsapp_config'),
            life: 4000
          });
          this.isSaving = false;
        }
      });
    } catch {
      this.isSaving = false;
    }
  }

  openTestDialog(): void {
    this.testTo = '';
    this.testMessage = '';
    this.testDialog = true;
  }

  async sendTest(): Promise<void> {
    if (!this.isValidInternationalNumber(this.testTo)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('whatsapp_test_phone_required'),
        life: 4000
      });
      return;
    }
    this.isSendingTest = true;
    try {
      await this.whatsAppConfigService.loadToken();
      const msg = this.testMessage.trim();
      this.whatsAppConfigService.sendTest(this.testTo.trim(), msg || undefined).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('test_whatsapp_sent'),
            life: 3000
          });
          this.testDialog = false;
          this.isSendingTest = false;
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_sending_test_whatsapp'),
            life: 5000
          });
          this.isSendingTest = false;
        }
      });
    } catch {
      this.isSendingTest = false;
    }
  }
}
