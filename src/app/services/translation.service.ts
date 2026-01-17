import { Injectable } from '@angular/core';
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
  constructor() {
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

  // Instant translation method
  public instant(key: string): string {
    // You might need to modify this based on your actual translation storage logic
    const translations = this.getTranslations();
    return translations[key] || key; // Return the translation or the key itself if not found
  }

  private async getTranslations() {
    const lang = this.currentLang.getValue();
    // Use dynamic import to load the JSON file based on the language
    const translations = await import(`../../assets/i18n/${lang}.json`);
    return translations;
  }

  public relativeTime(date: string | Date): string {
    if (!date) return '';
    const lang = this.currentLang.getValue() || 'en';
    return moment(date).locale(lang).fromNow();
  }
}
