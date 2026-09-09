/* Офлайн-кэш оболочки. Прогресс пользователя в localStorage, его это не касается. */
const CACHE = 'nihao-v8';
const SHELL = ['./', './index.html', './styles.css', './app.js', './data.js', './data-hsk2.js', './data-hsk3.js', './data-hsk3b.js', './data-dialogs.js', './data-pics.js', './data-hsk4a.js', './data-hsk4b.js', './data-hsk4c.js', './data-hsk4d.js', './data-dialogs2.js', './data-culture.js', './data-tones.js', './decomp.js', './strokes.js', './hanzi-writer.min.js', './manifest.webmanifest', './icon.svg', './icon-maskable.svg', './privacy.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
