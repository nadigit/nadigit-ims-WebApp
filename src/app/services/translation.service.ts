import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject } from 'rxjs';
import moment from 'moment';
import 'moment/locale/fr';
import 'moment/locale/es';
import 'moment/locale/ar';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {

  public supportedLanguages = [
    { label: 'English', value: 'en' },
    { label: 'Français', value: 'fr' },
    { label: 'Español', value: 'es' },
    { label: 'الْعَرَبِيَّةُ', value: 'ar' }
  ]; // Your supported languages

  private currentLang = new BehaviorSubject<string>(this.getPreferredLanguage()); // Initial language based on preference

  // Initialize RTL on service creation
  constructor(private readonly translate: TranslateService) {
    // Apply RTL on initial load
    const initialLang = this.getPreferredLanguage();
    const isRTL = initialLang === 'ar';
    if (typeof document !== 'undefined') {
      document.documentElement.lang = initialLang;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.body.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      document.body.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      if (isRTL) {
        document.body.classList.add('rtl');
        document.documentElement.classList.add('rtl');
      }
    }
  }

  public get currentLanguage$() {
    return this.currentLang.asObservable();
  }

  public setLanguage(lang: string) {
    if (this.supportedLanguages.find(l => l.value === lang)) { // Find language by value
      this.currentLang.next(lang);
      localStorage.setItem('preferredLanguage', lang);
      
      // Apply RTL/LTR direction to HTML and body
      const isRTL = lang === 'ar';
      document.documentElement.lang = lang;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.body.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      document.body.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
      
      // Add/remove RTL class to body for CSS targeting
      if (isRTL) {
        document.body.classList.add('rtl');
        document.documentElement.classList.add('rtl');
      } else {
        document.body.classList.remove('rtl');
        document.documentElement.classList.remove('rtl');
      }

      // Update Moment locale whenever language changes
      moment.locale(lang);
    } else {
      console.error(`Language "${lang}" not supported.`);
    }
  }

  public getPreferredLanguage(): string {
    const storedLang = localStorage.getItem('preferredLanguage');
    return this.supportedLanguages?.find(l => l.value === storedLang)?.value || 'en';
  }

  // New Function to save preferred language
  public savePreferredLanguage() {
    localStorage.setItem('preferredLanguage', this.currentLang.getValue());
  }

  /**
   * Synchronous lookup for the current ngx-translate language.
   * The previous implementation called an async loader without awaiting it, so it always returned the key.
   */
  public instant(key: string): string {
    return this.translate.instant(key);
  }

  public relativeTime(date: string | Date): string {
    if (!date) return '';
    const lang = this.currentLang.getValue() || 'en';
    return moment(date).locale(lang).fromNow();
  }
}
