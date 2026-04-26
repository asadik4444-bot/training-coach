# Changelog

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
