/**
 * OFICJALNY SERVICE WORKER PORTALU SCORE MATCH LIGA
 * Obsługuje: Instalację na telefonie (PWA), tryb offline oraz powiadomienia Push
 */

const CACHE_NAME = 'smpl-pwa-v72';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './MASTER-SZYMON-KOMENDA.html',
  './PANEL-ADMINA.html',
  './REJESTRACJA.html',
  './manifest.json',
  './manifest.json?v=72',
  './favicon.ico',
  './css/styles.css',
  './css/styles.css?v=72',
  './css/smpl-wow-overhaul.css?v=72',
  './css/favicon-16x16.png',
  './css/favicon-32x32.png',
  './css/apple-touch-icon.png',
  './css/icon-192.png',
  './css/icon-512.png',
  './css/icon-maskable-512.png',
  './img/auth-arena-bg.jpg',
  './img/portal-stadium-bg.jpg',
  './img/hero-league-stage-banner.jpg',
  './img/hero-registration-banner.jpg',
  './img/golden-ball-bg.jpg',
  './img/match-arena-banner.jpg',
  './img/hall-of-fame-bg.jpg',
  './img/ut-card-foil-bg.jpg',
  './img/vanessa-ai-emblem.jpg',
  './img/clean-sheets-vault-bg.jpg',
  './img/h2h-rivalry-banner.jpg',
  './img/blacklist-tribunal-bg.jpg',
  './img/chat-locker-banner.jpg',
  './img/master-command-banner.jpg',
  './img/competitions-gala-banner.jpg',
  './img/wow-hero-night.jpg',
  './img/wow-hero-day.jpg',
  './img/wow-stadium-night.jpg',
  './img/wow-stadium-day.jpg',
  './img/wow-auth-tunnel.jpg',
  './img/wow-ut-foil.jpg',
  './img/wow-h2h-clash.jpg',
  './img/wow-gala-stage.jpg',
  './img/wow-vanessa-ai.jpg',
  './img/vip-preview-phone.jpg',
  './img/vip-preview-pc.jpg',
  './img/vip-preview-cert.jpg',
  './img/vip-preview-crest.jpg',
  './img/og-preview-smpl.jpg',
  './js/seed-data.js?v=72',
  './js/archive-data.js?v=72',
  './js/crests-and-media.js?v=72',
  './js/engine.js?v=72',
  './js/expansion-studio.js?v=72',
  './js/ranks.js',
  './js/ranks.js?v=72',
  './js/api-client.js?v=72',
  './js/ui-views.js?v=72',
  './js/ui-forms-admin.js?v=72',
  './js/notifications.js',
  './js/notifications.js?v=72',
  './js/ai-assistant.js?v=72',
  './js/wow-overhaul.js?v=72',
  './js/app.js?v=72'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('PWA Cache prefetch skipped some items:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('api.php') || event.request.url.includes('/api/state')) return;
  // Przepuść bezpośrednio żądania Range (206 Partial Content) oraz materiały wideo MP4/WebM
  if (event.request.headers && event.request.headers.get('range')) return;
  if (/\.(mp4|webm|m4v|mov)(\?|$)/i.test(event.request.url) || event.request.url.includes('/media/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        .then((response) => {
          if (!response || response.status === 404 || response.status >= 500) {
            return fetch('/index.html', { cache: 'no-cache', credentials: 'same-origin' })
              .then((fallbackResp) => {
                if (fallbackResp && fallbackResp.ok) {
                  const fbClone = fallbackResp.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', fbClone));
                  return fallbackResp;
                }
                return caches.match('./index.html').then((c) => c || caches.match('/') || fallbackResp);
              })
              .catch(() => caches.match('./index.html').then((c) => c || caches.match('/')));
          }
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((r) => r || caches.match('./index.html').then((c) => c || caches.match('/')))
        )
    );
    return;
  }
  // Network first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

let swNotificationsMuted = false;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SMPL_SET_NOTIF_PREF') {
    swNotificationsMuted = event.data.enabled === false;
  }
});

function resolveSwAssetUrl(relPath) {
  try {
    return new URL(relPath || './index.html', self.location.href).href;
  } catch (e) {
    return relPath || './index.html';
  }
}

// Obsługa Powiadomień Web Push (iOS Safari PWA / Android / Desktop)
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Score Match Liga', body: event.data.text() };
    }
  }

  const title = data.title || 'Score Match Liga';
  const extraData = data.data && typeof data.data === 'object' ? data.data : {};
  const targetUrl = resolveSwAssetUrl(data.url || extraData.url || './index.html');
  const targetTab = data.tab || extraData.tab || '';
  const options = {
    body: data.body || 'Nowe wydarzenie w Score Match Liga!',
    icon: resolveSwAssetUrl(data.icon || './css/icon-192.png'),
    badge: resolveSwAssetUrl(data.badge || './css/icon-192.png'),
    vibrate: [200, 100, 200],
    data: Object.assign({}, extraData, { url: targetUrl, tab: targetTab }),
    tag: data.tag || ('smpl-push-' + Date.now()),
    renotify: data.renotify !== false
  };

  event.waitUntil(
    caches
      .open('smpl-prefs-v1')
      .then((cache) => cache.match('./__smpl_notif_pref'))
      .then((resp) => (resp ? resp.text() : 'on'))
      .catch(() => 'on')
      .then((pref) => {
        if (swNotificationsMuted || pref === 'off') return;
        const notifyClients = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          windowClients.forEach((client) => {
            try {
              client.postMessage({ type: 'SMPL_PUSH_RECEIVED', data: options.data });
            } catch (e) {}
          });
        }).catch(() => {});
        return Promise.all([
          self.registration.showNotification(title, options),
          notifyClients
        ]);
      })
  );
});

// Kliknięcie w powiadomienie na telefonie (iPhone / Android / Desktop)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = (event.notification && event.notification.data) || {};
  const targetUrl = resolveSwAssetUrl(notifData.url || './index.html');
  const targetTab = notifData.tab || '';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client && 'focus' in client) {
          try {
            client.postMessage({ type: 'SMPL_NOTIF_CLICKED', url: targetUrl, tab: targetTab, data: notifData });
          } catch (e) {}
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
