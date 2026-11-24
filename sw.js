/* Network first, so new deploys show up straight away; falls back to cache when offline. */
const CACHE = "kwentuhan-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "lib/qrcode.js", "favicon.svg",
  "assets/img/coca-cola-script-red.png", "assets/img/coca-cola-script-white.png", "assets/img/migs-and-lola.jpg",
  "assets/fonts/archivo-latin-standard-normal.woff2"];
self.addEventListener("install", (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {})); });
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then((res) => {
    if (res.ok && !r.url.includes("/lib/tesseract/")) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match("index.html"))));
});
