# Ride Weather — project handoff / continuation plan

Complete state of the project as of **2026-07-19 ~22:45 UTC**, written so work can continue on another computer with no other context. The repo is https://github.com/devmbm/live_weather, live at **https://devmbm.github.io/live_weather/**.

---

## 1. What this is

A mobile-first, low-bandwidth weather nowcast PWA for cycling in Austria, hosted free on GitHub Pages. Static files only — no build step, no server, no API keys. Shows: live clock, place name, current temp, natural-language rain outlook, wind; three 15-min bar charts (rain / temp / wind + direction arrows) covering past 75 min + next 3 h; an auto-looping rain radar (40 × 40 km, 1 km cells) over CARTO map tiles; and (new, in progress) an opt-in live-flights panel (100 × 100 km).

## 2. File inventory (repo root)

| File | Role |
|---|---|
| `index.html` | The entire app: inline CSS + JS (~1100 lines). Everything happens here. |
| `sw.js` | Service worker. **Currently `rw-shell-v8`** — bump this string on EVERY change to any shell asset, otherwise phones keep the old version. |
| `jsfive.js` | Vendored [jsfive 0.4.0](https://github.com/usnistgov/jsfive) ESM build — pure-JS HDF5/NetCDF4 reader for the radar grid. Dynamic-imported only when the radar loads. Don't touch. |
| `manifest.webmanifest` | PWA manifest. Theme/background `#101826` (matches icon). |
| `icon-512/192.png`, `apple-touch-icon.png`, `favicon.png` | Pixel-art "Classic Radar" icon (rainbow ramp on dark navy, comma-shaped storm, 11×11 grid). Square full-bleed on purpose — launchers apply their own corner masks. |
| `README.md` | Deploy instructions + attribution requirements. |
| `mockup.html`, `icon-designs.html`, `flights-mockup.html` | Design mockups (fake data, embedded tiles). Not used by the app; safe to keep or delete. |
| `HANDOFF.md` | This file. |

## 3. Current status — IMPORTANT

**The flights feature is fully implemented in `index.html` + `sw.js` but has NOT been smoke-tested and NOT been pushed.** Everything before it (through service-worker `v7`) is tested and live. Next session:

1. Run the smoke test (section 8) with `?loc=48.30,16.32&flights=1` → expect `data-state-flights="ok"` on `<body>`, `flightsCard` not hidden, `flightsFrame` square-sized.
2. Also load once *without* `flights=1` and confirm no airplanes.live request fires (code is gated on `flights.on`; the button is `#fltBtn` ✈ in the radar controls row).
3. Push `index.html` + `sw.js`. Cache is already bumped to v8 for this change.

## 4. Data sources (all verified live, all free, no keys)

| Source | Endpoint | Notes |
|---|---|---|
| GeoSphere point forecast | `https://dataset.api.hub.geosphere.at/v1/timeseries/forecast/nowcast-v1-15min-1km?parameters=rr,t2m,ff,dd,fx&lat_lon={lat},{lon}&start=…&end=…` | ~900 B, 13 steps of 15 min. CORS `*`. Rate limit 5/s, 240/h. Coverage 45.5–49.5°N, 8.1–17.7°E only. |
| Past 75 min | same + `&forecast_offset=5` | Returns the run from 75 min ago. Offsets 0–5 only. |
| Radar grid | `…/v1/grid/forecast/nowcast-v1-15min-1km?parameters=rr&output_format=netcdf&bbox=…` | HDF5/NetCDF4, ~45 KB for 44 km box (GeoJSON is 423 KB — never use it). Has 2D `lat`/`lon` arrays → no projection math needed. Parsed with jsfive. |
| Reverse geocoding | `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=…&longitude=…&localityLanguage=en` | Free client API, cached in localStorage per rounded coords (`rw-place:lat,lon` key). |
| Map tiles | `https://basemaps.cartocdn.com/rastertiles/{style}/{z}/{x}/{y}[@2x].png` | Styles used: `voyager_nolabels` + `voyager_only_labels` (light), `dark_nolabels` + `dark_only_labels` (dark). Attribution "© OpenStreetMap © CARTO" required (shown in panel corner). |
| Flights positions | `https://api.airplanes.live/v2/point/{lat}/{lon}/{radius_nm}` | CORS `*`, no key, fair use 1 req/s. App uses radius 39 nm, refresh 15 s, only while enabled. **adsb.lol is NOT usable — no CORS.** OpenSky CORS-locked. |
| Flight routes (unused) | `https://hexdb.io/api/v1/route/icao/{callsign}` | CORS `*`, works — user chose the Trails variant which shows no routes, so not wired in. Available if ever wanted. |

## 5. Hard-won gotchas (do not rediscover these)

1. **GeoSphere default time window**: without explicit `start`/`end` the point API starts at the *current quarter-hour* — the offset-5 run then returns nothing in the past. App always sends `start=now−2h`, `end=now+4h` (UTC, `toISOString().slice(0,16)`).
2. **Naive timestamps are UTC**: the NetCDF time axis is `minutes since 2026-07-19 19:15:00` (no timezone). JS parses that as *local* → frames were 2 h off and the radar caption stuck on "now". `parseTs()` appends `Z` to any timestamp without a timezone marker. Debug aid: `<body data-ft="19:30,19:45,…">` shows parsed frame times (UTC hh:mm).
3. **iOS Safari flex-shrink**: with `.app { min-height:100dvh; display:flex }`, Safari shrinks flex children when content overflows (desktop grows instead) → cards overlapped. Rule: `.app > * { flex-shrink: 0 }`. Never remove it; never add a shrinkable section.
4. **SW update cadence**: cache-first shell means a deployed change appears on the **second** open of the app. When testing with headless browsers, always use a **fresh `--user-data-dir`** or you'll be served the previous build and chase ghosts (this happened twice).
5. **Charts scale unity**: bar heights and the labelled gridlines must share the same 0–100% scale (bars were once ×88 while gridlines were ×100 — mismatch).
6. **Icons**: square full-bleed PNGs; never bake rounded corners (iOS shows black wedges).
7. **Server compression**: GeoSphere does NOT gzip. NetCDF over GeoJSON always.

## 6. App behavior & conventions

- **URL params**: `?loc=lat,lon` (skip geolocation), `?nomap=1` (no radar/tiles/parser at all), `?flights=1` (start with flights on).
- **Geolocation fallback**: failure/denial → centre of Vienna (48.2082, 16.3719) + sticky notice with Retry. Never a dead-end error.
- **Theme**: auto via `prefers-color-scheme`, manual override via ◐ header button → `data-theme` attr on `<html>` + localStorage `rw-theme`. CSS uses the three-block token pattern (media query with `:root:where(:not([data-theme="light"]))` + explicit `[data-theme]` blocks). `isDark()` in JS checks `data-theme` first. Canvas layers must be redrawn on theme change (hooks exist in themeBtn handler, matchMedia listener, `fullRedraw`).
- **Radar**: full-column-width 1:1 square (JS sets `side = outer.clientWidth` in `radarGeometry`); page scrolls. Loop now→+1 h (5 frames) by default, "3 h" button → 13 frames; always autoplays, 650 ms/frame; big corner caption ("now" / "in 45 min"); rain alpha 0.62 over map, 0.85 without; Map button toggles tiles (ON by default).
- **Rendering stack per map panel**: base tiles canvas → (radar: rain canvas → label tiles canvas) / (flights: label tiles canvas → planes canvas). Flights paint order *within* its canvas: names → trails above names → glyphs topmost (user-specified).
- **Flights** (`flights` module in index.html): OFF by default, ✈ button; 100 × 100 km, airplanes.live every 15 s while on (`FLT_REFRESH`), paused when `document.hidden`; airline from ICAO 3-letter callsign prefix (`AIRLINES` table, ~35 entries) else callsign, registration-style → "private"; orange (`--temp` token) = below 10 000 ft; trails = real per-refresh history (`flights.hist` keyed by hex) + synthetic back-projection from oldest point to panel edge; labels 15 px bold airline + 12 px callsign, no numbers.
- **Data budget**: normal visit ~2 KB (charts) + 45 KB (radar) + tiles (SW-cached, capped 120); flights add ~6–10 KB/15 s only while on.
- **Attribution**: GeoSphere CC BY 4.0 in footer; OSM/CARTO on map panels — keep both visible.

## 7. Deploy

`git push` to main → GitHub Pages auto-rebuilds in 1–2 min. Nothing else. Phones show the update on their second open (see gotcha 4).

## 8. Smoke-test recipe (Windows, no Node needed)

A tiny PowerShell static server + headless Edge. Serve script (`serve.ps1`, adjust `$root`):

```powershell
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://127.0.0.1:8123/"); $l.Start()
$root = "PATH\TO\live_weather"
$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript"; ".webmanifest"="application/manifest+json"; ".png"="image/png" }
while ($true) { $ctx = $l.GetContext(); try { $p = $ctx.Request.Url.AbsolutePath.TrimStart("/"); if ($p -eq "") { $p = "index.html" }
  $f = Join-Path $root $p; if (Test-Path $f) { $b = [IO.File]::ReadAllBytes($f); $e = [IO.Path]::GetExtension($f)
  if ($mime.ContainsKey($e)) { $ctx.Response.ContentType = $mime[$e] }; $ctx.Response.OutputStream.Write($b,0,$b.Length) }
  else { $ctx.Response.StatusCode = 404 } } catch {}; $ctx.Response.Close() }
```

Then (fresh profile dir every run!):

```powershell
msedge --headless=new --disable-gpu --no-first-run --user-data-dir=SOME_FRESH_DIR `
  --virtual-time-budget=27000 --dump-dom "http://127.0.0.1:8123/index.html?loc=48.30,16.32&flights=1" > dom.html
```

Check the dumped DOM for these markers (set by the app itself):

- `data-state="charts-ok"` — point data rendered (hero temp, 18 bars/chart, 5 past + "now" divider at 27.8%)
- `data-state-radar="ok"` — NetCDF parsed & drawn; `data-ft` lists plausible UTC quarter-hours
- `data-state-tiles="ok"` — CARTO tiles drawn
- `data-state-flights="ok"` — flights fetched & drawn (only with `flights=1` or after clicking ✈)
- `id="radarFrame" style="width: Npx; height: Npx"` — equal values (1:1)
- Without `flights=1`: `flightsCard` still has `hidden`, `fltBtn` `aria-pressed="false"`

`--screenshot=out.png` (with `--timeout=15000` instead of the budget flag) gives an early-load visual; the two flags don't combine reliably.

## 9. Design artifacts (claude.ai, private)

- App mockup: https://claude.ai/code/artifact/af1d461b-b8db-4bce-9875-80825fb68918 — note: correct URL is https://claude.ai/code/artifact/af1d461b-b8db-4bce-9875-80e71d42ab if this 404s, open claude.ai/code/artifacts and look for "Ride Weather"
- Icon exploration: https://claude.ai/code/artifact/88c06a79-c65b-4272-b059-00825fb68918
- Flights mockup (final Trails design, light+dark, 15 s live sim): https://claude.ai/code/artifact/1ed121b2-dad5-4e43-8970-6862ef16ab86

## 10. Backlog / ideas (none committed)

- Gust overlay as thin ticks on the wind bars (data already fetched, zero extra bandwidth).
- Flights: tap a plane for details; hexdb.io route lookup (verified working) if routes are ever wanted.
- Wider/taller radar window option (50 km, or 40 km north-south priority).
- `?flights=1` combined with install shortcut for a "plane spotting" home-screen icon.
