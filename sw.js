const CACHE_NAME = 'mohamed-issa-v4';
const RUNTIME_CACHE = 'mohamed-issa-runtime-v4';

const PRECACHE_URLS = [
  '/madrasa/',
  '/madrasa/index.html',
  '/madrasa/login.html',
  '/madrasa/register.html',
  '/madrasa/admin.html',
  '/madrasa/manifest.json',
  '/madrasa/css/style.css',
  '/madrasa/js/config.js',
  '/madrasa/js/utils.js',
  '/madrasa/js/session.js',
  '/madrasa/js/auth.js',
  '/madrasa/js/courses.js',
  '/madrasa/js/player.js',
  '/madrasa/js/chat.js',
  '/madrasa/js/admin.js',
  '/madrasa/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => {
        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
          return caches.delete(cacheName);
        }
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('youtube.com')) return;
  if (url.hostname.includes('youtu.be')) return;
  if (url.hostname.includes('vimeo.com')) return;
  if (url.hostname.includes('google.com')) return;
  if (url.pathname.includes('chrome-extension')) return;

  if (request.destination === 'document' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => cache.put(request, responseClone));
          return response;
        })
        .catch(() => caches.match(request).then(c => c || caches.match('/madrasa/index.html')))
    );
  } else {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          fetch(request).then(response => {
            if (response && response.status === 200) {
              caches.open(RUNTIME_CACHE).then(cache => cache.put(request, response));
            }
          }).catch(() => {});
          return cached;
        }
        return fetch(request)
          .then(response => {
            if (!response || response.status !== 200 || response.type === 'opaque') return response;
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then(cache => cache.put(request, responseClone));
            return response;
          })
          .catch(() => caches.match('/madrasa/index.html'));
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(names => names.forEach(name => caches.delete(name)));
  }
});