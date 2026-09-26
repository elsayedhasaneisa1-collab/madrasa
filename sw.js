// ═══════════════════════════════════════════════════════════
// Service Worker - منصة الأستاذ محمد عيسى
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'mohamed-issa-v3';
const RUNTIME_CACHE = 'mohamed-issa-runtime-v3';

// الملفات الأساسية للتخزين المؤقت
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
  '/madrasa/js/admin.js',
  '/madrasa/js/app.js'
];

// ═══════════════ التثبيت ═══════════════
self.addEventListener('install', (event) => {
  console.log('🔧 SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`⚠️ فشل تخزين: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('✅ SW: Installed');
        return self.skipWaiting();
      })
  );
});

// ═══════════════ التنشيط ═══════════════
self.addEventListener('activate', (event) => {
  console.log('🔧 SW: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('🗑️ حذف cache قديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ SW: Activated');
      return self.clients.claim();
    })
  );
});

// ═══════════════ اعتراض الطلبات ═══════════════
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // ⚠️ تجاهل الطلبات دي
  if (request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co')) return;        // Supabase
  if (url.hostname.includes('youtube.com')) return;        // يوتيوب
  if (url.hostname.includes('youtu.be')) return;
  if (url.hostname.includes('vimeo.com')) return;
  if (url.hostname.includes('google.com')) return;         // Google
  if (url.pathname.includes('chrome-extension')) return;

  // استراتيجية: Cache First للأصول، Network First للصفحات
  if (request.destination === 'document' ||
      request.destination === '' ||
      url.pathname.endsWith('.html')) {
    // Network First للصفحات
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request)
            .then(cached => cached || caches.match('/madrasa/index.html'));
        })
    );
  } else {
    // Cache First للأصول (CSS, JS, Images)
    event.respondWith(
      caches.match(request)
        .then(cached => {
          if (cached) {
            // حدّث النسخة في الخلفية
            fetch(request).then(response => {
              if (response && response.status === 200) {
                caches.open(RUNTIME_CACHE).then(cache => {
                  cache.put(request, response);
                });
              }
            }).catch(() => {});
            return cached;
          }

          return fetch(request)
            .then(response => {
              if (!response || response.status !== 200 || response.type === 'opaque') {
                return response;
              }
              const responseClone = response.clone();
              caches.open(RUNTIME_CACHE).then(cache => {
                cache.put(request, responseClone);
              });
              return response;
            })
            .catch(() => caches.match('/madrasa/index.html'));
        })
    );
  }
});

// ═══════════════ رسائل من الصفحة ═══════════════
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'CLEAR_CACHE') {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
});