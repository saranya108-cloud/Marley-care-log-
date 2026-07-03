# Marley Care Log 🐩

A local-first care log for Marley, a 15 lb adult poodle mix — meals, allergy symptoms, GI patterns, treatments, and vet-ready summaries.

This is a logging tool only. It is not medical advice.

## How to run

No build step, no dependencies, no accounts. It's a plain HTML/CSS/JS app:

- **Simplest:** open `index.html` directly in any modern browser.
- **Or serve it locally** (recommended so clipboard copy works everywhere):

  ```sh
  python3 -m http.server 8000
  # then open http://localhost:8000
  ```

All data is stored in your browser's localStorage on that device. Use **Data → Export JSON** regularly to back up.

## Features

- **Log** — add, edit, and delete entries across 11 types built around Marley's routine: meals, treats, itch/allergy symptoms (with 1–5 severity), GI/stool observations, medications, Cytopoint injections, VARL immunotherapy check-ins, grooming/baths, suspected triggers, questions for the vet, and free-form notes. Search, type, and date-range filters included.
- **Dashboard** — days since last Cytopoint with the next due date, 7-day itch severity average with a week-over-week trend, abnormal GI count, a 14-day itch severity strip, open vet questions, and recent entries.
- **Cytopoint reminders** — Marley gets an injection every 6 weeks (`CYTOPOINT_INTERVAL_DAYS` in `app.js`). A banner appears when the next shot is within a week, due today, or overdue.
- **Cytopoint cycle symptom tracker** — average itch severity per week since the last injection, so it's easy to spot the shot wearing off toward the end of the cycle. Also included in the vet summary.
- **Prescription food tracker** — record when a bag was opened and how long a bag lasts; the dashboard shows days of food left with a progress bar, a one-tap "Opened a new bag today" button (which also logs a note entry), and a reorder banner when under a week remains.
- **Vet Summary** — generates a Markdown summary for a chosen period (14/30/60/90 days or all time): symptom log with severities, GI breakdown, medications & treatments, Cytopoint history, VARL check-ins, diet notes, suspected triggers, and a checklist of questions for the vet. Copy to clipboard or download as `.md`.
- **Data** — export full JSON backups (entries + food tracker), export CSV for spreadsheets, import JSON backups (merge with duplicate detection, or replace), load sample demo data, and a guarded delete-all.
- **PWA / installable** — when served over http(s), a service worker caches the app shell so it loads offline, and you can install it to your phone's home screen ("Add to Home Screen") or desktop.

## Files

- `index.html` — app structure (four views: Dashboard, Log, Vet Summary, Data)
- `styles.css` — styling, light + dark mode, mobile-friendly layout
- `app.js` — all logic: storage, CRUD, stats, reminders, vet summary generator, export/import
- `manifest.webmanifest`, `sw.js`, `icons/` — PWA install metadata, offline service worker, app icons

## Data format

Entries are stored under the localStorage key `marley-care-log:v1`:

```json
{
  "app": "marley-care-log",
  "version": 1,
  "entries": [
    {
      "id": "…",
      "type": "symptom",
      "date": "2026-07-03",
      "time": "20:00",
      "details": "Chewing paws after the park",
      "severity": 3,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

`severity` (1–5) appears on `symptom` entries; `stool` (`normal | soft | diarrhea | mucus | constipated | vomit`) on `gi` entries. The payload also carries `"food": { "openedDate", "lastsDays" }` for the prescription food tracker. JSON exports use the same shape, so an export is also a portable backup.

## Known limitations

- Data lives in one browser profile per device; there's no sync. Move data between devices via JSON export/import.
- CSV export is one-way (import accepts JSON only).
- Reminders are in-app banners, not push notifications — you'll see them when you open the app.
- Offline/install support requires serving over http(s); opening `index.html` via `file://` still works but skips the service worker.
- The 6-week Cytopoint interval is a constant in `app.js` — edit `CYTOPOINT_INTERVAL_DAYS` if the vet changes the schedule.
