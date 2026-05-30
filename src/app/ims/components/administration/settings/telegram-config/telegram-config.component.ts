import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { TelegramConfigService } from 'src/app/services/telegram-config.service';

@Component({
  selector: 'app-telegram-config',
  templateUrl: './telegram-config.component.html',
  styleUrls: ['./telegram-config.component.css']
})
export class TelegramConfigComponent implements OnInit {
  form!: FormGroup;
  chatIds: string[] = [];
  newChatId = '';
  isLoading = false;
  isSaving = false;
  isSendingTest = false;
  showToken = false;
  botTokenConfigured = false;
  testDialog = false;
  testChatId = '';
  testMessage = '';

  constructor(
    private fb: FormBuilder,
    private telegramConfigService: TelegramConfigService,
    private messageService: MessageService,
    private translate: TranslateService,
    private location: Location
  ) {
    this.form = this.fb.group({
      enabled: [false],
      botToken: ['']
    });
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit(): void {
    this.loadConfig();
  }

  async loadConfig(): Promise<void> {
    this.isLoading = true;
    try {
      await this.telegramConfigService.loadToken();
      this.telegramConfigService.getConfig().subscribe({
        next: (cfg) => {
          this.form.patchValue({
            enabled: cfg.enabled === true,
            botToken: ''
          });
          this.chatIds = [...(cfg.chatIds || [])];
          this.botTokenConfigured = cfg.botTokenConfigured === true;
          this.isLoading = false;
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_telegram_config'),
            life: 4000
          });
          this.isLoading = false;
        }
      });
    } catch {
      this.isLoading = false;
    }
  }

  isValidChatId(id: string): boolean {
    const s = id.trim();
    if (!s) {
      return false;
    }
    if (s.startsWith('@')) {
      return s.length > 1;
    }
    return /^-?\d+$/.test(s);
  }

  addChatId(): void {
    const id = this.newChatId.trim();
    if (!this.isValidChatId(id)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('telegram_invalid_chat_id'),
        life: 4000
      });
      return;
    }
    if (this.chatIds.includes(id)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('telegram_chat_id_duplicate'),
        life: 3000
      });
      return;
    }
    this.chatIds = [...this.chatIds, id];
    this.newChatId = '';
  }

  removeChatId(id: string): void {
    this.chatIds = this.chatIds.filter(c => c !== id);
  }

  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addChatId();
    }
  }

  async save(): Promise<void> {
    this.isSaving = true;
    const token = (this.form.get('botToken')?.value || '').trim();
    const body: { enabled: boolean; chatIds: string[]; botToken?: string } = {
      enabled: !!this.form.get('enabled')?.value,
      chatIds: [...this.chatIds]
    };
    if (token) {
      body.botToken = token;
    }
    try {
      await this.telegramConfigService.loadToken();
      this.telegramConfigService.updateConfig(body).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('telegram_config_saved'),
            life: 3000
          });
          this.form.patchValue({ botToken: '' });
          this.botTokenConfigured = this.botTokenConfigured || !!token;
          this.isSaving = false;
          void this.loadConfig();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_saving_telegram_config'),
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
    this.testChatId = this.chatIds.length > 0 ? this.chatIds[0] : '';
    this.testMessage = '';
    this.testDialog = true;
  }

  get testGetUpdatesUrl(): string {
    const token = (this.form.get('botToken')?.value || '').trim();
    if (!token) {
      return '';
    }
    return `https://api.telegram.org/bot${token}/getUpdates`;
  }

  get testChatPreviewType(): 'invalid' | 'channel' | 'group' | 'private' | 'unknown' {
    const id = (this.testChatId || '').trim();
    if (!id) return 'unknown';
    if (id.startsWith('@')) return this.isValidChatId(id) ? 'channel' : 'invalid';
    if (!/^-?\d+$/.test(id)) return 'invalid';
    if (id.startsWith('-100')) return 'group';
    if (id.startsWith('-')) return 'group';
    return 'private';
  }

  get testChatPreviewLabelKey(): string {
    switch (this.testChatPreviewType) {
      case 'channel': return 'telegram_chat_preview_channel';
      case 'group': return 'telegram_chat_preview_group';
      case 'private': return 'telegram_chat_preview_private';
      case 'invalid': return 'telegram_chat_preview_invalid';
      default: return 'telegram_chat_preview_unknown';
    }
  }

  get testChatPreviewSeverity(): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (this.testChatPreviewType) {
      case 'channel': return 'info';
      case 'group': return 'success';
      case 'private': return 'success';
      case 'invalid': return 'danger';
      default: return 'secondary';
    }
  }

  async copyGetUpdatesUrl(): Promise<void> {
    const url = this.testGetUpdatesUrl;
    if (!url) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('telegram_getupdates_token_missing'),
        life: 4000
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('success'),
        detail: this.translate.instant('telegram_getupdates_url_copied'),
        life: 2500
      });
    } catch {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: url,
        life: 6000
      });
    }
  }

  async sendTest(): Promise<void> {
    const id = this.testChatId.trim();
    if (!this.isValidChatId(id)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('telegram_test_chat_required'),
        life: 4000
      });
      return;
    }
    this.isSendingTest = true;
    try {
      await this.telegramConfigService.loadToken();
      const msg = this.testMessage.trim();
      this.telegramConfigService.sendTest(id, msg || undefined).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('test_telegram_sent'),
            life: 3000
          });
          this.testDialog = false;
          this.isSendingTest = false;
        },
        error: (err: any) => {
          const backendError = err?.error || {};
          const detail = [backendError.error, backendError.hint, backendError.resolution, backendError.details]
            .filter((x: any) => typeof x === 'string' && x.trim().length > 0)
            .join(' ');
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: detail || this.translate.instant('error_sending_test_telegram'),
            life: 7000
          });
          this.isSendingTest = false;
        }
      });
    } catch {
      this.isSendingTest = false;
    }
  }
}
