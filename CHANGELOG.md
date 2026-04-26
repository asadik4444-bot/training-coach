# Changelog

## v8 (2026-04-26)

- `feat(perf)` — singleton Redis client with lazy connect + `Promise.all` batching in kv.ts; eliminates per-request reconnect overhead
- `fix(auth)` — HMAC session token includes 30-day expiry timestamp; middleware auto-renews tokens within 7 days of expiry
- `feat(pwa)` — `manifest.json` + `apple-touch-icon.png`; dashboard installable via iPhone Safari → Share → Add to Home Screen
- `feat(design)` — CSS custom property tokens (OLED palette: `--bg:#000`, `--primary:#1E40AF`, `--accent:#D97706`) + Fira Sans / Fira Code loaded in layout
- `feat(today-sticky)` — `StickyToday` client component: full hero card on load, collapses to compact recovery strip on scroll
- `feat(heatmap)` — `Heatmap` component: 13-week (91-day) tappable recovery grid; tap a cell opens `DayDetailSheet` bottom sheet with HRV/RHR/sleep/workout breakdown
- `feat(chart-pill)` — `TrendChart` client component: segmented 7d/30d/90d/365d pill control; 7d/30d/90d sliced from server-prefetched 91-day data (zero extra fetches); 365d fetched lazily + weekly-aggregated; period persisted in localStorage per metric; replaces static sparklines for HRV, RHR, Sleep, Strain
- `feat(bedtime)` — bedtime consistency widget: 30-day average bedtime (HH:MM), std-dev in minutes color-coded green/yellow/red, 14-night sparkline
- `feat(pull-refresh)` — `PullToRefresh` client island: touch gesture with spinning indicator; dy > 80px triggers reload; "Updated HH:MM" server-rendered timestamp in header
- `feat(polish)` — WoW table: ▲/▼ percentage delta with green/red color per metric direction; removed dead `Sparkline` component, `wowDelta` helper, unused value arrays

## v7 (2026-04-26)

- `voice.ts` — personality-driven coach messages: `opener(band)` rotates by UTC date per recovery band, `streakCue(n)`, `adherenceCue(skips)`, `deloadCelebrate()`
- Daily cron: inline keyboard buttons (Confirm / Skip / Swap Mon/Tue/Wed) via `sendTelegramWithButtons`; message prefixed with coach opener + streak/adherence cues
- Callback handler: `callback_query` routing in webhook — confirm, skip, swap, done (RPE picker), rpe:<n>
- Post-workout cron (`/api/cron/post-workout`, Mon–Fri 11:30 UTC): inline "How was today's session?" prompt after training window
- `/protein y|n` — binary protein-target hit logging (7-day history + hit-rate display)
- `/bedtime HH:MM` — bedtime logging with 7-day average + σ display
- `/pain <area> <severity> [note]` — pain log with pre-session gate: severity ≥8 → hard-stop red, ≥6 → downgrade green→yellow
- Durable archive: `appendToArchive` (no TTL) called from daily cron; `/api/export` endpoint returns full JSON
- `decideToday()` extended with optional `painSeverity` parameter (5th arg); pain gate rules added before existing band logic
- `/today` weekday-adaptive: Mon shows recovery + plan; Wed/Fri includes ACWR + trends; weekend shows rest guidance + 7d protein hit rate
- Dashboard redesign (v7): gradient hero card with coach opener quote, 90-day recovery heatmap, HRV/RHR/sleep sparklines, week-over-week comparison table, goals progress bars (▰▰▰▱▱), all behind `?detail=1`; hero + streak bar always visible

## v6 (2026-04-26)

- `/done rpe 8 rir 2 soreness 5 [notes]` — structured RPE/RIR/soreness logging with free-form notes; stored in Redis at `done:YYYY-MM-DD` (365-day TTL)
- `/goal <weight|waist|hrv|rhr> <value>` and `/goals` — set biometric + body comp targets; show current progress delta
- `/report week` and `/report month` now show prior-period comparison columns (Current / Previous / Δ) for recovery, HRV, RHR, sleep efficiency, and strain
- Daily cron: auto-deload alert (`🛑 DELOAD SIGNAL`) when 2+ chronic overreaching signals detected (HRV decline, RHR drift, ACWR >1.4, sleep debt)
- Dashboard: signed-cookie session via `/api/auth/dashboard?key=SECRET` — HttpOnly 30-day cookie, no `?key=` in URL on subsequent visits
- Fix: dashboard streak skipMap now queries actual `skipped:${date}` Redis keys instead of inferring from biometric snapshots

## v5 (2026-04)

- Visual web dashboard at `/` — HRV chart, recovery bar chart, streaks, body comp, training load, recent workouts
- `/streak` — green-recovery streak + best streak + no-skip workday streak
- `/calendar` — 90-day emoji recovery heatmap (🟢🟡🔴⬜)
- `/weight`, `/waist`, `/body` — manual body comp logging + trend
- `/setup` — one-shot backfill + onboarding guide
- Dashboard requires `?key=DASHBOARD_SECRET` (cookie auth added in v6)

## v4 (2026-04)

- `/report year` — 365-day summary with monthly breakdown
- Weekly + monthly cron routes (`/api/cron/weekly`, `/api/cron/monthly`)
- `/backfill` — pull 90 days of Whoop history; batch Redis writes
- Stale plan detection (14+ days triggers warning in daily message)
- ACWR interpretation labels (sweet spot / high / overreaching / detraining)

## v3 (2026-03)

- `/hrv`, `/rhr`, `/sleep`, `/zones`, `/load`, `/recent` — analytics commands with sparklines
- `/report [week|month]` — period summary with recommendations
- Polarized zone analysis (Seiler 80/20 ratio)
- `computeTrends` — 7-day HRV/RHR/sleep baselines + ACWR
- `decideToday` coach engine — HRV override on green, hard-stop rule, advisory flags

## v2 (2026-03)

- `/today` — daily snapshot (recovery, HRV, RHR, sleep, workout, plan)
- `/log`, `/skip`, `/swap` — day management commands
- `/help` — command reference
- Telegram webhook command router
- `plan.yml` training plan with weekday dispatch

## v1 (2026-02)

- WHOOP OAuth flow (`/api/auth/whoop/start` + `/callback`)
- Daily cron (`/api/cron/daily`) — fetch recovery, apply plan, send Telegram
- Redis KV layer (`withClient` pattern, refresh token, daily log, skip/swap flags)
- Biometric snapshot storage + 90-day backfill endpoint

## v0 (2026-02)

- Project scaffold: Next.js 15 App Router, TypeScript, Vitest, Vercel deployment
- `plan.yml` format + `parsePlan`/`pickToday` utilities
