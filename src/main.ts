import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err))
  .then(() => {
    if ('serviceWorker' in navigator && environment.production) {
      registerServiceWorker();
    }
  });

function registerServiceWorker() {
  navigator.serviceWorker.register('pos-sw.js', { scope: '/webconsole/' })
    .then((registration) => {
      console.log('Service Worker registered successfully:', registration.scope);
      
      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every minute
      
      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              console.log('New service worker available');
              // The PwaService will handle showing the update notification
            }
          });
        }
      });
    })
    .catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  
  // Handle controller change (new SW activated)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('New service worker activated');
    // Optionally reload the page
    // window.location.reload();
  });
}
