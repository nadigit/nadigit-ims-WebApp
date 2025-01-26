import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {

  private currentLang = new BehaviorSubject<string>(this.getPreferredLanguage()); // Initial language based on preference

  public get currentLanguage$() {
    return this.currentLang.asObservable();
  }

  public setLanguage(lang: string) {
    if (this.supportedLanguages.find(l => l.value === lang)) { // Find language by value
      this.currentLang.next(lang);
      localStorage.setItem('preferredLanguage', lang);
    } else {
      console.error(`Language "${lang}" not supported.`);
    }
  }

  public supportedLanguages = [
    { label: 'English', value: 'en' },
    { label: 'Français', value: 'fr' },
    { label: 'Español', value: 'sp' },
  ]; // Your supported languages

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
}
