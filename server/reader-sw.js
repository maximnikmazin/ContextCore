const CACHE = "cc-reader-shell-v2";
const SHELL = ["/v/", "/v/manifest.webmanifest", "/v/icon.svg"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || !SHELL.includes(u.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(u.pathname);
    const hitText = hit && u.pathname === "/v/" ? hit.clone().text() : null;
    const fresh = fetch(e.request).then(async (r) => {
      if (!r.ok) return r;
      if (hitText) {
        const [a, b] = await Promise.all([hitText, r.clone().text()]);
        if (a !== b) {
          await c.put(u.pathname, r.clone());
          (await self.clients.matchAll({ type: "window" })).forEach((w) => w.postMessage("shell-updated"));
          return r;
        }
      }
      await c.put(u.pathname, r.clone());
      return r;
    }).catch(() => hit);
    if (hit) e.waitUntil(fresh.then(() => {
    }, () => {
    }));
    return hit || fresh;
  }));
});
