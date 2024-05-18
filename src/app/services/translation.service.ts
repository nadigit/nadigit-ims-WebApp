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
  ]; // Your supported languages

  public getPreferredLanguage(): string {
    const storedLang = localStorage.getItem('preferredLanguage');
    return this.supportedLanguages?.find(l => l.value === storedLang)?.value || 'en';
  }

  // New Function to save preferred language
  public savePreferredLanguage() {
    localStorage.setItem('preferredLanguage', this.currentLang.getValue());
  }
}
