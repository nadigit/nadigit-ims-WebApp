import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { NotificationRecipientsService } from 'src/app/services/notification-recipients.service';
import { KeycloakService } from 'keycloak-angular';

@Component({
  selector: 'app-notification-recipients',
  templateUrl: './notification-recipients.component.html',
  styleUrls: ['./notification-recipients.component.css']
})
export class NotificationRecipientsComponent implements OnInit {
  recipients: string[] = [];
  newRecipient = '';
  bulkRecipients = '';
  showBulkInput = false;
  isLoading = false;
  isSaving = false;

  constructor(
    private notificationRecipientsService: NotificationRecipientsService,
    private messageService: MessageService,
    private translate: TranslateService,
    private keycloakService: KeycloakService,
    private location: Location
  ) { }

  goBack(): void {
    this.location.back();
  }

  ngOnInit() {
    this.loadRecipients();
  }

  async loadRecipients() {
    this.isLoading = true;
    try {
      await this.notificationRecipientsService.loadToken();
      this.notificationRecipientsService.getRecipients().subscribe({
        next: (response) => {
          this.recipients = response.recipients || [];
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading recipients:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_loading_recipients') || 'Error loading notification recipients',
            life: 3000
          });
          this.isLoading = false;
        }
      });
    } catch (error) {
      this.isLoading = false;
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  async addRecipient() {
    const email = this.newRecipient.trim();
    
    if (!email) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_enter_email') || 'Please enter an email address',
        life: 3000
      });
      return;
    }

    if (!this.isValidEmail(email)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_enter_valid_email') || 'Please enter a valid email address',
        life: 3000
      });
      return;
    }

    if (this.recipients.includes(email)) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('email_already_exists') || 'This email address is already in the list',
        life: 3000
      });
      return;
    }

    try {
      await this.notificationRecipientsService.loadToken();
      this.notificationRecipientsService.addRecipient(email).subscribe({
        next: () => {
          this.recipients.push(email);
          this.newRecipient = '';
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('recipient_added') || 'Recipient added successfully',
            life: 3000
          });
        },
        error: (error) => {
          console.error('Error adding recipient:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_adding_recipient') || 'Error adding recipient',
            life: 3000
          });
        }
      });
    } catch (error) {
      // Error handled in subscribe
    }
  }

  async removeRecipient(email: string) {
    try {
      await this.notificationRecipientsService.loadToken();
      this.notificationRecipientsService.removeRecipient(email).subscribe({
        next: () => {
          this.recipients = this.recipients.filter(r => r !== email);
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('recipient_removed') || 'Recipient removed successfully',
            life: 3000
          });
        },
        error: (error) => {
          console.error('Error removing recipient:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_removing_recipient') || 'Error removing recipient',
            life: 3000
          });
        }
      });
    } catch (error) {
      // Error handled in subscribe
    }
  }

  async replaceAllRecipients() {
    const emails = this.bulkRecipients
      .split(',')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translate.instant('warning'),
        detail: this.translate.instant('please_enter_at_least_one_email') || 'Please enter at least one email address',
        life: 3000
      });
      return;
    }

    // Validate all emails
    const invalidEmails = emails.filter(e => !this.isValidEmail(e));
    if (invalidEmails.length > 0) {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('error'),
        detail: this.translate.instant('invalid_emails_found') || `Invalid email addresses: ${invalidEmails.join(', ')}`,
        life: 5000
      });
      return;
    }

    // Remove duplicates
    const uniqueEmails = [...new Set(emails)];

    this.isSaving = true;
    try {
      await this.notificationRecipientsService.loadToken();
      this.notificationRecipientsService.setRecipients(uniqueEmails).subscribe({
        next: (response) => {
          this.recipients = response.recipients || uniqueEmails;
          this.bulkRecipients = '';
          this.showBulkInput = false;
          this.isSaving = false;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('recipients_updated') || 'Recipients updated successfully',
            life: 3000
          });
        },
        error: (error) => {
          console.error('Error updating recipients:', error);
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_updating_recipients') || 'Error updating recipients',
            life: 3000
          });
          this.isSaving = false;
        }
      });
    } catch (error) {
      this.isSaving = false;
    }
  }

  onKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.addRecipient();
    }
  }
}
