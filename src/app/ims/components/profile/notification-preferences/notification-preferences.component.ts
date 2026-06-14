import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { NotificationPreferencesService } from 'src/app/services/notification-preferences.service';
import { NotificationPreferences } from 'src/app/models/notification-preferences';
import { KeycloakService } from 'keycloak-angular';
import { debounceTime } from 'rxjs/operators';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-notification-preferences',
  templateUrl: './notification-preferences.component.html',
  styleUrls: ['./notification-preferences.component.css']
})
export class NotificationPreferencesComponent implements OnInit {
  preferences: NotificationPreferences = {
    userId: '',
    emailNotifications: false,
    pushNotifications: false,
    workingHoursOnly: false,
    priorityOnly: false,
    mutedTypes: [],
    preferredLocale: 'en'
  };

  readonly localeOptions = [
    { label: 'English', value: 'en' },
    { label: 'الْعَرَبِيَّةُ', value: 'ar' },
    { label: 'Français', value: 'fr' },
    { label: 'Español', value: 'es' }
  ];

  notificationTypes = [
    { value: 'INVENTORY', label: 'INVENTORY' },
    { value: 'ORDER', label: 'ORDER' },
    { value: 'FINANCIAL', label: 'FINANCIAL' },
    { value: 'SYSTEM', label: 'SYSTEM' },
    { value: 'CUSTOMER_CREDIT', label: 'CUSTOMER_CREDIT' }
  ];

  isLoading = false;
  isSaving = false;
  private saveSubject = new Subject<void>();

  constructor(
    private notificationPreferencesService: NotificationPreferencesService,
    private messageService: MessageService,
    private translate: TranslateService,
    private keycloakService: KeycloakService,
    private location: Location
  ) {
    // Debounce auto-save
    this.saveSubject.pipe(debounceTime(1000)).subscribe(() => {
      this.savePreferences();
    });
  }

  goBack(): void {
    this.location.back();
  }

  async ngOnInit() {
    await this.loadPreferences();
    
    // Get user ID
    try {
      const profile = await this.keycloakService.loadUserProfile();
      this.preferences.userId = profile.id || '';
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  }

  async loadPreferences() {
    this.isLoading = true;
    try {
      await this.notificationPreferencesService.loadToken();
      this.notificationPreferencesService.getPreferences().subscribe({
        next: (prefs) => {
          this.preferences = {
            ...prefs,
            userId: prefs.userId || this.preferences.userId,
            preferredLocale: prefs.preferredLocale || this.translate.currentLang || 'en'
          };
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading preferences:', error);
          // If preferences don't exist, use defaults
          this.isLoading = false;
        }
      });
    } catch (error) {
      this.isLoading = false;
    }
  }

  onPreferenceChange() {
    this.saveSubject.next();
  }

  async savePreferences() {
    if (!this.preferences.userId) {
      return;
    }

    this.isSaving = true;
    try {
      await this.notificationPreferencesService.loadToken();
      this.notificationPreferencesService.updatePreferences(this.preferences).subscribe({
        next: (savedPrefs) => {
          this.preferences = savedPrefs;
          this.isSaving = false;
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('preferences_saved') || 'Preferences saved successfully',
            life: 2000
          });
        },
        error: (error) => {
          console.error('Error saving preferences:', error);
          this.isSaving = false;
          this.messageService.add({
            severity: 'error',
            summary: this.translate.instant('error'),
            detail: this.translate.instant('error_saving_preferences') || 'Error saving preferences',
            life: 3000
          });
        }
      });
    } catch (error) {
      this.isSaving = false;
    }
  }

  toggleMuteType(type: string) {
    const index = this.preferences.mutedTypes.indexOf(type);
    if (index > -1) {
      this.preferences.mutedTypes.splice(index, 1);
    } else {
      this.preferences.mutedTypes.push(type);
    }
    this.onPreferenceChange();
  }

  isTypeMuted(type: string): boolean {
    return this.preferences.mutedTypes.includes(type);
  }

  muteAll() {
    this.preferences.mutedTypes = this.notificationTypes.map(t => t.value);
    this.onPreferenceChange();
  }

  async unmuteAll() {
    try {
      await this.notificationPreferencesService.loadToken();
      this.notificationPreferencesService.unmuteAll().subscribe({
        next: () => {
          this.preferences.mutedTypes = [];
          this.messageService.add({
            severity: 'success',
            summary: this.translate.instant('success'),
            detail: this.translate.instant('all_types_unmuted') || 'All notification types unmuted',
            life: 2000
          });
        },
        error: (error) => {
          console.error('Error unmuting all:', error);
        }
      });
    } catch (error) {
      // Error handled
    }
  }
}
