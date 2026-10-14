/* Offline cache for the installable web build. Bump VERSION when files change. */
const VERSION = 'touchline-v11';
const FILES = ['./', 'index.html', 'css/app.css', 'js/data.js', 'js/data-europe.js', 'js/data-world.js', 'js/engine.js', 'js/world.js', 'js/intl.js', 'js/economy.js', 'js/career.js', 'js/operations.js', 'js/feeders.js', 'js/match3d.js', 'js/press.js', 'js/extras.js', 'js/app.js', 'js/ui-world.js', 'js/ui-club.js', 'js/cloud.js', 'icon.svg', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request))); });
