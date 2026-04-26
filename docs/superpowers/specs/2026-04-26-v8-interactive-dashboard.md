# v8 — Interactive Dashboard (design)

**Author:** Claude Opus 4.7
**Date:** 2026-04-26
**Status:** Draft for audit

## 1. Goal

Make the web dashboard at `/` genuinely interactive: tap to filter, tap to expand, tap to act — without breaking the zero-cost / static-friendly architecture. The Telegram bot remains the primary action surface; the dashboard becomes a richer **synthesis + light action** surface.

## 2. Constraints (inherited)

- $0 incremental cost
- Zero new external dependencies (no Recharts/Tremor in v8 — keep hand-rolled)
- Mobile-first (iPhone Safari)
- Single user (signed cookie or `?key=` already gate access)
- No client-side data leakage — server still fetches secrets and biometric values, only renders pre-computed views to client
- Bundle target: <30kb gzip total client JS

## 3. What becomes interactive

### 3.1 Heatmap (90-day recovery grid)

Tap a day → inline expandable panel below the heatmap row showing:

- Recovery (% + HRV ms + RHR bpm)
- Sleep (efficiency %, total hh:mm, deep/REM minutes)
- Strain (day strain + last workout)
- /done entry (RPE / RIR / soreness / notes) if present
- /pain entries if present
- /protein y/n if logged
- /bedtime if logged

### 3.2 Trend charts (HRV / RHR / sleep / recovery)

- Tap → cycle through windows: 7d → 30d → 90d → 365d → 7d
- `<title>` SVG hover for exact values (works on desktop, harmless on mobile)
- Persist last-selected window to localStorage so it survives reload

### 3.3 TODAY card — quick-action buttons

Three buttons under the recovery readout:

- **Done ✓** — POSTs to `/api/action/done`, optimistically updates UI, shows toast
- **Skip** — POSTs to `/api/action/skip`, marks today skipped, refreshes plan line
- **Swap** — opens a small picker (Mon-Fri) → POSTs to `/api/action/swap`

Buttons hit the same handlers as the Telegram callback flow → identical state, no new logic.

### 3.4 Goals widget

- Each goal row has an inline edit pencil icon
- Tap pencil → field becomes a number input → save POSTs to `/api/action/goal`
- Progress bar updates locally on save (no full reload)

### 3.5 Refresh

- Manual refresh button in header (with last-update timestamp)
- Auto-refresh on `visibilitychange` (tab regains focus) — only if last-fetch >5 min old
- No polling — cron is the source of truth and only ticks 4× per day

## 4. Architecture

### 4.1 Component split

- `src/app/page.tsx` stays a Server Component — fetches everything from Redis, passes serialized data as props
- New client components in `src/components/`:
  - `<Heatmap>` — tappable grid + expandable detail panel
  - `<TrendChart>` — SVG line/bar with window cycling
  - `<QuickActions>` — Done/Skip/Swap buttons + toast
  - `<GoalEditor>` — inline-editable goal rows
  - `<RefreshButton>` — header refresh + last-update display
  - `<Toast>` — minimal singleton toast (no library)

### 4.2 Data flow

1. Server component reads Redis (existing kv functions)
2. Builds a serializable `DashboardData` object (snapshots, trends, goals, today's plan, recent workouts)
3. Passes to client components as props
4. Client components handle interactions via fetch() against `/api/action/*` and `/api/data/refresh`
5. After successful POST, client either optimistically updates state OR refetches via `/api/data/refresh`

### 4.3 New API routes (5)

All gated by the existing dashboard signed-cookie session check:

- `POST /api/action/done` — body `{ rpe?, rir?, soreness?, notes? }` → calls `handleDone`/`saveDoneEntry`
- `POST /api/action/skip` — calls `handleSkip(today)`
- `POST /api/action/swap` — body `{ target: "monday"|"tuesday"|... }` → calls `handleSwap`
- `POST /api/action/goal` — body `{ field: "weight"|"waist"|"hrv"|"rhr", value: number }`
- `GET /api/data/snapshot?date=YYYY-MM-DD` — returns one day's full record for heatmap detail
- `GET /api/data/refresh` — returns the same `DashboardData` object the server component built

### 4.4 Auth for write actions

Reuse the existing dashboard signed cookie — same HMAC-SHA256(DASHBOARD_SECRET, "ok") signature already on `tc_session`. New action routes verify identically.

CSRF: cookie is `SameSite=Strict; HttpOnly` — same-origin POSTs from our own page only.

### 4.5 Charts approach: hand-rolled

Stay with hand-rolled SVG. Add:

- `<TrendChart>` client component with `useState` for window selection
- `<title>` element on each data point for native browser tooltips
- Minimal CSS keyframes for "data updated" pulse on refresh

No Recharts/Tremor for v8 — saves 60-80kb gzip and lets us own the rendering.

## 5. Hydration safety

- Compute all date strings on server (Europe/Zurich) and pass as ISO strings — client doesn't recompute
- No `Math.random()` in render
- `suppressHydrationWarning` only on the "last update X minutes ago" element (relative time differs server vs client by definition)

## 6. Bundle budget

- React client runtime: ~10kb gzip (Next.js 15 base)
- Our client components: target <8kb gzip
- Total: <20kb gzip — well under 30kb target

## 7. Implementation plan (8 commits)

1. `feat(api-actions)` — 5 new POST/GET routes for client actions + signed cookie verification helper extracted to lib/auth.ts
2. `feat(toast)` — tiny Toast singleton client component
3. `feat(quick-actions)` — Done/Skip/Swap buttons in TODAY card → POSTs to API
4. `feat(heatmap-tap)` — tappable 90-day heatmap with expandable per-day detail panel
5. `feat(trend-charts)` — client TrendChart with window cycling (7→30→90→365) + localStorage persistence
6. `feat(goal-editor)` — inline goal editing
7. `feat(refresh)` — manual refresh + auto-refresh on tab focus
8. `docs(v8)` — README + CHANGELOG + dashboard guide

## 8. Risks

- **Hydration mismatch on dates** — mitigated by server-computed ISO strings + `suppressHydrationWarning` on "minutes ago" only
- **Mobile tap targets** — minimum 44×44 px per Apple HIG
- **Double-tap race** — debounce client-side + idempotent server (e.g. setSkipped is idempotent already)
- **Redis writes from client** — re-uses existing kv functions; no new write paths

## 9. Out of scope for v8

- WebSocket / SSE live updates (cron is 4×/day, polling not justified)
- Multi-user / sharing
- PWA install banner / service worker
- Offline mode (Redis required)
- Plan.yml editor (Sunday ritual handles)
- Native iOS app via APNs (complexity)

## 10. Success criteria

- All v6/v7 functionality preserved (no regression in 168 tests)
- Dashboard adds: tap-to-expand heatmap, tap-to-cycle charts, Done/Skip/Swap buttons, inline goal edit, refresh
- Bundle stays under 30kb gzip
- No new env vars required
- 8 commits, 175+ tests passing

## 11. Open questions for audit

- Is the **"Click to log RPE"** flow as discoverable as Telegram inline buttons? Should the dashboard mirror the post-workout 13:30 cron's button menu?
- Should we add a **dashboard-only feature**: a public-shareable view (no key) that shows heavily redacted progress (e.g. "training-coach.vercel.app/share/<slug>" → just the streak number)?
- Should the dashboard be installable as a **Home Screen icon** (PWA manifest)? It would feel native on iPhone with one extra commit.
- Should we add **`/done` as a button** instead of (or alongside) the post-workout Telegram cron? — closes the loop entirely on the dashboard.
- Are there any **keyboard shortcuts** worth adding for desktop power-users (e.g. `D` for Done, `S` for Skip)?
- Should the heatmap detail panel link to a **`/log` text input** so the user can add a note from the dashboard, not just Telegram?
