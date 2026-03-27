import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { EmailConfigService } from 'src/app/services/email-config.service';
import { EmailConfig } from 'src/app/models/email-config';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-email-config',
  templateUrl: './email-config.component.html',
  styleUrls: ['./email-config.component.css']
})
export class EmailConfigComponent implements OnInit {
  emailConfigForm!: FormGroup;
  emailConfig: EmailConfig | null = null;
  isLoading = false;
  isSaving = false;
  isSendingTest = false;
  showPassword = false;
  testEmailDialog = false;
  testEmailAddress = '';
  
  commonPorts = [
    { label: '25 (Plain)', value: 25 },
    { label: '587 (TLS)', value: 587 },
    { label: '465 (SSL)', value: 465 }
  ];

  constructor(
    private fb: FormBuilder,
    private emailConfigService: EmailConfigService,
    private messageService: MessageService,
    private translate: TranslateService,
    private keycloakService: KeycloakService,
    private location: Location
  ) {
    this.initForm();
  }

  goBack(): void {
    this.location.back();
  }

  ngOnInit() {
    this.loadConfig();
  }

  initForm() {
    this.emailConfigForm = this.fb.group({
      enabled: [false],
      smtpHost: ['', [Validators.required]],
      smtpPort: [587, [Validators.required, Validators.min(1), Validators.max(65535)]],
      smtpUsername: ['', [Validators.required]],
      smtpPassword: [''], // Password is only required for new configs
      smtpFromAddress: ['', [Validators.required, Validators.email]],
      smtpFromName: ['Nadigit IMS', [Validators.required]],
      smtpAuth: [true],
      smtpStartTls: [true],
      smtpSsl: [false]
    });
  }

  async loadConfig() {
    this.isLoading = true;
    try {
      await this.emailConfigService.loadToken();
      this.emailConfigService.getConfig().subscribe({
        next: (config) => {
          this.emailConfig = config;
          this.emailConfigForm.patchValue({
            enabled: config.enabled || false,
            smtpHost: config.smtpHost || '',
            smtpPort: config.smtpPort || 587,
            smtpUsername: config.smtpUsername || '',
            smtpPassword: '', // Never load password
            smtpFromAddress: config.smtpFromAddress || '',
            smtpFromName: config.smtpFromName || 'Nadigit IMS',
            smtpAuth: config.smtpAuth !== false,
            smtpStartTls: config.smtpStartTls !== false,
            smtpSsl: config.smtpSsl || false
          });
          // Remove required validator from password field if config exists (password is optional for updates)
          const passwordControl = this.emailConfigForm.get('smtpPassword');
          if (passwordControl && config) {
            passwordControl.clearValidators();
            passwordControl.updateValueAndValidity();
          }
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading email config:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_email_config') || 'Error loading email configuration',
            life: 3000
          });
          this.isLoading = false;
        }
      });
    } catch (error) {
      this.isLoading = false;
    }
  }

  async saveConfig() {
    // Validate password only if it's a new config (no existing config)
    if (!this.emailConfig) {
      const passwordControl = this.emailConfigForm.get('smtpPassword');
      if (passwordControl && !passwordControl.value) {
        passwordControl.setValidators([Validators.required]);
        passwordControl.updateValueAndValidity();
      }
    }

    if (this.emailConfigForm.invalid) {
      this.emailConfigForm.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_fill_required_fields') || 'Please fill all required fields',
        life: 3000
      });
      return;
    }

    this.isSaving = true;
    const formValue = this.emailConfigForm.value;
    
    // If password is empty and we have existing config, don't send password
    const configToSave: EmailConfig = {
      ...formValue,
      smtpPassword: formValue.smtpPassword || (this.emailConfig?.smtpPassword || '')
    };

    try {
      await this.emailConfigService.loadToken();
      this.emailConfigService.updateConfig(configToSave).subscribe({
        next: (savedConfig) => {
          this.emailConfig = savedConfig;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('email_config_saved') || 'Email configuration saved successfully',
            life: 3000
          });
          this.isSaving = false;
          // Clear password field after save and remove required validator
          this.emailConfigForm.patchValue({ smtpPassword: '' });
          const passwordControl = this.emailConfigForm.get('smtpPassword');
          if (passwordControl) {
            passwordControl.clearValidators();
            passwordControl.updateValueAndValidity();
          }
        },
        error: (error) => {
          console.error('Error saving email config:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_saving_email_config') || 'Error saving email configuration',
            life: 3000
          });
          this.isSaving = false;
        }
      });
    } catch (error) {
      this.isSaving = false;
    }
  }

  openTestEmailDialog() {
    this.testEmailAddress = '';
    this.testEmailDialog = true;
  }

  async sendTestEmail() {
    if (!this.testEmailAddress || !this.isValidEmail(this.testEmailAddress)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_enter_valid_email') || 'Please enter a valid email address',
        life: 3000
      });
      return;
    }

    this.isSendingTest = true;
    try {
      await this.emailConfigService.loadToken();
      this.emailConfigService.sendTestEmail(this.testEmailAddress).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('test_email_sent') || 'Test email sent successfully',
            life: 3000
          });
          this.testEmailDialog = false;
          this.isSendingTest = false;
        },
        error: (error) => {
          console.error('Error sending test email:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_sending_test_email') || 'Error sending test email',
            life: 3000
          });
          this.isSendingTest = false;
        }
      });
    } catch (error) {
      this.isSendingTest = false;
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.emailConfigForm.get(fieldName);
    return !!(field && field.invalid && (field.dirty || field.touched));
  }

  showCustomPortInput(): boolean {
    const currentPort = this.emailConfigForm.get('smtpPort')?.value;
    return !this.commonPorts.find(p => p.value === currentPort);
  }
}
