/* Ride Weather service worker
   - App shell: cache-first with background refresh (loads instantly, updates apply next open)
   - CARTO tiles: cache-first with a size cap (repeat visits in the same area cost no tile traffic)
   - GeoSphere API + geocoder: never cached (weather must be fresh) */

var SHELL_CACHE = "rw-shell-v2";
var TILE_CACHE = "rw-tiles-v1";
var TILE_LIMIT = 120;

var SHELL = [
  "./",
  "./index.html",
  "./jsfive.js",
  "./manifest.webmanifest",
  "./favicon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(SHELL_CACHE).then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== SHELL_CACHE && k !== TILE_CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trimTiles() {
  return caches.open(TILE_CACHE).then(function (c) {
    return c.keys().then(function (keys) {
      if (keys.length <= TILE_LIMIT) return;
      return Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map(function (k) {
        return c.delete(k);
      }));
    });
  });
}

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  /* live data: always straight to the network */
  if (url.hostname.indexOf("geosphere.at") !== -1 ||
      url.hostname.indexOf("bigdatacloud.net") !== -1) return;

  /* map tiles: cache-first, capped */
  if (url.hostname === "basemaps.cartocdn.com") {
    e.respondWith(
      caches.open(TILE_CACHE).then(function (c) {
        return c.match(e.request).then(function (hit) {
          if (hit) return hit;
          return fetch(e.request).then(function (resp) {
            if (resp.ok) {
              c.put(e.request, resp.clone());
              trimTiles();
            }
            return resp;
          });
        });
      })
    );
    return;
  }

  /* app shell: cache-first, refresh in the background */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.open(SHELL_CACHE).then(function (c) {
        return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
          var refresh = fetch(e.request).then(function (resp) {
            if (resp.ok) c.put(e.request, resp.clone());
            return resp;
          }).catch(function () { return hit; });
          return hit || refresh;
        });
      })
    );
  }
});
