# Ride Weather

A one-screen, low-bandwidth weather nowcast for cycling in Austria, built for GitHub Pages.
A single top line shows your location (with a blue "you are here" dot when geolocated),
the current temperature, wind (direction arrow only), and a colour-coded UV index; a second
line gives a plain-English rain outlook that turns blue for rain and blinking amber for a
storm. Below are three aligned 15-minute bar charts (rain / temperature / wind with direction
arrows) covering the recent past and the next 3 hours, an auto-looping rain radar
(40 km across, 1 km resolution) over a CARTO Voyager base map, and a UV-index graph for the day.
Tap the place name to search for any location by name instead of using GPS (results outside
the coverage box are flagged); "Use my location" switches back. The light/dark toggle sits at
the bottom of the page.

Data: [GeoSphere Austria](https://www.geosphere.at/) INCA nowcast
(`nowcast-v1-15min-1km`, CC BY 4.0). Coverage is Austria and its close
surroundings (45.5–49.5° N, 8.1–17.7° E).

## Deploy to GitHub Pages

1. Create a new GitHub repository (e.g. `ride-weather`).
2. Push all files in this folder to the default branch
   (`mockup.html` is the design mockup — optional, safe to delete).
3. Repo → Settings → Pages → "Deploy from a branch" → select the branch, folder `/ (root)`.
4. Open `https://<username>.github.io/<repo>/` on your phone, allow location.
5. Install as an app: Android Chrome → menu → "Add to Home screen";
   iPhone Safari → Share → "Add to Home Screen".

No build step, no API keys, no server.

## URL parameters

| Parameter | Effect |
|---|---|
| `?nomap=1` | Skips the whole radar panel — no grid download, no tiles, no NetCDF parser. Charts get the freed space. |
| `?loc=48.30,16.32` | Use fixed coordinates instead of the geolocation prompt (handy for desktop testing). |

## How it stays fast on a weak connection

- **Priority order**: two ~1 KB API calls render everything above the radar first;
  then the ~45 KB radar grid (NetCDF, parsed in-browser); map tiles load **last**.
- **Requests per visit** (after the first): 2 API calls (~2 KB) + place name from
  localStorage cache + radar grid (~45 KB) + tiles only if not already cached.
- The app shell (HTML + NetCDF parser + icons) is pre-cached by a service worker —
  repeat opens don't touch the network for any asset.
- Map tiles are cached (capped at 120) — riding in your usual area costs no tile traffic.
- System fonts, no frameworks, no CDN scripts.

## Data sources & attribution (please keep visible)

- Weather: **© GeoSphere Austria**, CC BY 4.0 — shown in the footer.
- Base map: **© OpenStreetMap contributors © CARTO** — shown on the map panel.
- Reverse geocoding: [BigDataCloud free client API](https://www.bigdatacloud.com/) (no key).
- Place search: [Photon](https://photon.komoot.io/) by komoot (no key) — only queried
  when you search from the location picker, never on page load.
- Live flights (opt-in ✈ button): [airplanes.live](https://airplanes.live/) for aircraft
  positions (no key), one request per 15 s, only while the flights panel is open.
- UV index: [Open-Meteo](https://open-meteo.com/) (`uv_index`, no key). One small call per
  visit feeds the "UV" pill up top and the UV graph.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app — inline CSS + JS, no build step |
| `jsfive.js` | Vendored [jsfive](https://github.com/usnistgov/jsfive) 0.4.0 (pure-JS HDF5/NetCDF4 reader) |
| `sw.js` | Service worker: shell pre-cache, tile cache, never caches weather data |
| `manifest.webmanifest` | PWA install metadata |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.png` | App icons |
| `mockup.html` | The original design mockup (fake data, embedded tiles) — not used by the app |
