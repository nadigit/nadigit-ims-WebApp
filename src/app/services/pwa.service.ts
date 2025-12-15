import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private installPromptEvent: BeforeInstallPromptEvent | null = null;
  private updateAvailableSubject = new Subject<boolean>();
  public updateAvailable$: Observable<boolean> = this.updateAvailableSubject.asObservable();

  constructor() {
    this.setupInstallPrompt();
    this.setupUpdateCheck();
  }

  private setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.installPromptEvent = e as BeforeInstallPromptEvent;
    });
  }

  private setupUpdateCheck() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // New service worker activated
        this.updateAvailableSubject.next(true);
      });

      // Check for updates periodically
      setInterval(() => {
        this.checkForUpdates();
      }, 60000); // Check every minute
    }
  }

  async checkForUpdates() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.update();
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }
  }

  canInstall(): boolean {
    return this.installPromptEvent !== null;
  }

  async promptInstall(): Promise<boolean> {
    if (!this.installPromptEvent) {
      return false;
    }

    try {
      await this.installPromptEvent.prompt();
      const choiceResult = await this.installPromptEvent.userChoice;
      this.installPromptEvent = null; // Clear after use
      return choiceResult.outcome === 'accepted';
    } catch (error) {
      console.error('Error showing install prompt:', error);
      return false;
    }
  }

  async updateServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.waiting) {
          // Tell the waiting service worker to skip waiting and activate
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          // Reload the page
          window.location.reload();
        }
      } catch (error) {
        console.error('Error updating service worker:', error);
      }
    }
  }

  async clearCache() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.active?.postMessage({ type: 'CLEAR_CACHE' });
        }
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
    }
  }

  isInstalled(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone === true ||
           document.referrer.includes('android-app://');
  }
}

