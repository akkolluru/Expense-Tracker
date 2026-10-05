/**
 * Safe Service Worker registration for PaisaIQ PWA.
 * Enables offline shell caching and background asset updates.
 */

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(undefined);
  }

  // Register when page load is complete for optimal First Contentful Paint
  return new Promise((resolve) => {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New content available; will be used on next page load/reload
                  console.info('[PaisaIQ PWA] New update available. Reload to activate.');
                } else {
                  // Content is cached for offline use
                  console.info('[PaisaIQ PWA] App shell cached for offline use.');
                }
              }
            });
          }
        });

        resolve(registration);
      } catch (error) {
        console.warn('[PaisaIQ PWA] Service Worker registration failed:', error);
        resolve(undefined);
      }
    });
  });
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.unregister();
  } catch (error) {
    console.warn('[PaisaIQ PWA] Service Worker unregistration failed:', error);
    return false;
  }
}
