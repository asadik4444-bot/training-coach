# training-coach

**v8 — premium PWA dashboard + read-only synthesis surface** | [live](https://training-coach-phi.vercel.app)

Personal training assistant: fetches WHOOP recovery each morning and sends a Telegram message with the day's plan, adjusted for how recovered you are.

---

## Environment variables

| Variable              | Description                                                             |
| --------------------- | ----------------------------------------------------------------------- |
| `KV_REDIS_URL`        | TCP Redis URL from Vercel marketplace Redis                             |
| `TELEGRAM_BOT_TOKEN`  | Bot token from @BotFather                                               |
| `TELEGRAM_CHAT_ID`    | Your Telegram user ID (single-user app)                                 |
| `WHOOP_CLIENT_ID`     | WHOOP OAuth client ID                                                   |
| `WHOOP_CLIENT_SECRET` | WHOOP OAuth client secret                                               |
| `CRON_SECRET`         | Bearer token used by the Vercel cron jobs                               |
| `DASHBOARD_SECRET`    | Secret key for the web dashboard — generate with `openssl rand -hex 32` |

---

## Deployment

1. Push to GitHub — Vercel auto-deploys `main`.
2. Set all env vars in the Vercel project settings.
3. Register the Telegram webhook once after deploy:

```
node --env-file=.env.local --experimental-strip-types scripts/set-telegram-webhook.ts
```

---

## Telegram commands

### Day-to-day

| Command                      | Effect                                                                      |
| ---------------------------- | --------------------------------------------------------------------------- |
| `/today`                     | Today's snapshot: weekday-adaptive — recovery, HRV, plan; Wed/Fri adds ACWR |
| `/log <entry>`               | Append a free-text note to today's training log                             |
| `/skip`                      | Mark today as skipped — the cron will not send a plan                       |
| `/swap <day>`                | Replace today's session with another weekday's plan (monday–friday)         |
| `/protein y\|n`              | Log whether you hit today's protein target; no arg shows 7-day hit rate     |
| `/bedtime HH:MM`             | Log tonight's bedtime; no arg shows 7-day average and standard deviation    |
| `/pain <area> <1–10> [note]` | Log a pain entry; severity ≥8 stops training, ≥6 downgrades intensity       |
| `/export`                    | Returns URL for the full JSON archive export                                |
| `/help`                      | List all available commands                                                 |

### Analytics (require /backfill for meaningful history)

| Command       | Effect                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `/hrv [N]`    | HRV trend over last N days (default 7) — avg, range, CV, sparkline      |
| `/rhr [N]`    | RHR trend over last N days (default 7)                                  |
| `/sleep [N]`  | Sleep efficiency + duration trend over last N days (default 7)          |
| `/zones [N]`  | HR zone breakdown + Seiler polarized ratio over last N days (default 7) |
| `/load`       | Training load: acute (7d) / chronic (28d) strain + ACWR interpretation  |
| `/recent [N]` | Last N workouts with sport, strain, zone breakdown (default 5)          |

### Body composition

| Command        | Effect                                                         |
| -------------- | -------------------------------------------------------------- |
| `/weight <kg>` | Log today's body weight (30–250 kg)                            |
| `/waist <cm>`  | Log today's waist circumference (30–200 cm)                    |
| `/body [N]`    | Body comp trend over last N days — latest + delta (default 30) |

### Session logging (v6)

| Command                        | Effect                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| `/done rpe 8`                  | Log overall RPE for today's session                               |
| `/done rpe 8 rir 2 soreness 5` | Log RPE, reps-in-reserve, and soreness (each a number)            |
| `/done bench 80x8 RPE 8`       | Free-form: activity text + structured RPE/RIR/soreness parsed out |

Stored in Redis at `done:YYYY-MM-DD` with 365-day TTL.

### Goals (v6)

| Command           | Effect                                                        |
| ----------------- | ------------------------------------------------------------- |
| `/goal weight 75` | Set weight goal (kg)                                          |
| `/goal waist 80`  | Set waist goal (cm)                                           |
| `/goal hrv 50`    | Set HRV goal (ms baseline target)                             |
| `/goal rhr 50`    | Set RHR goal (bpm — lower is fitter)                          |
| `/goals`          | Show all goals + current progress (delta from today's values) |

Goals have no TTL — persistent until overwritten.

### Streaks & calendar

| Command     | Effect                                                             |
| ----------- | ------------------------------------------------------------------ |
| `/streak`   | Current green-recovery streak, best streak, no-skip workday streak |
| `/calendar` | 90-day recovery heatmap rendered as an emoji grid                  |

### Reports

| Command         | Effect                                                                     |
| --------------- | -------------------------------------------------------------------------- |
| `/report`       | Week summary (same as `/report week`)                                      |
| `/report week`  | 7-day summary with prior-week comparison columns (Current / Previous / Δ)  |
| `/report month` | 30-day summary with prior-month comparison columns — run `/backfill` first |
| `/report year`  | 365-day summary with monthly breakdown table — run `/backfill` first       |

### Setup

| Command     | Effect                                                   |
| ----------- | -------------------------------------------------------- |
| `/backfill` | Pull 90 days of Whoop history into Redis (one-shot)      |
| `/setup`    | Run backfill + print onboarding guide for first-time use |

> **Note:** `/report month`, `/report year`, `/hrv 30`, and similar long-window commands
> need historical data in Redis. Run `/setup` or `/backfill` once after initial deployment.

---

## Deload alerts (v6)

The daily cron automatically prepends a `🛑 DELOAD SIGNAL` warning to the Telegram message
when 2 or more chronic overreaching signals are detected simultaneously:

- HRV >10% below 7-day baseline
- RHR >5 bpm above 7-day baseline
- ACWR >1.4
- 7-day cumulative sleep debt >420 min (7 hours)

When triggered: "Consider 5-7 days of reduced volume (50-60%) and easy cardio."

---

## Web dashboard

First visit: navigate to `/api/auth/dashboard?key=<DASHBOARD_SECRET>` — this sets a
30-day HttpOnly signed cookie and redirects to `/`. Subsequent visits to `/` work
without the `?key=` parameter.

Set the `DASHBOARD_SECRET` env var in Vercel project settings (generate with `openssl rand -hex 32`).

See `docs/dashboard.md` for a guide to reading each widget.

---

## Re-linking Whoop

To re-link Whoop after token expiry or initial setup:

1. Generate a new setup secret: `openssl rand -hex 32`
2. Set it as `WHOOP_SETUP_SECRET` env var in Vercel project settings.
3. Visit `/api/auth/whoop/start?secret=<value>` in your browser to start the OAuth flow.

---

## How it works

- **Daily cron** (`/api/cron/daily`, Mon–Fri 06:00 UTC): checks skip/swap/pain flags, fetches WHOOP recovery, picks today's plan from `plan.yml`, prepends coach voice opener + streak/adherence cues, sends inline keyboard with Confirm/Skip/Swap buttons, appends entry to durable archive.
- **Post-workout cron** (`/api/cron/post-workout`, Mon–Fri 11:30 UTC): sends a "How was today's session?" inline prompt (Done / Skipped / Modified / Couldn't train) after the training window. Skips if day is already marked skipped.
- **Weekly cron** (`/api/cron/weekly`, Sun 16:00 UTC): sends a weekly summary with avg recovery, biometric trends (HRV/RHR/sleep sparklines), polarized zone analysis, ACWR, and recommendations.
- **Monthly cron** (`/api/cron/monthly`, 1st of month 07:00 UTC): sends a 30-day report.
- **Webhook** (`/api/telegram/webhook`): receives Telegram text commands and `callback_query` button taps; routes all commands; state is persisted in Redis.
- **Export** (`/api/export?key=DASHBOARD_SECRET`): returns full JSON archive of all daily snapshots with no TTL.
- **Backfill** (`/api/backfill?days=N`): one-shot endpoint (Bearer auth) to pull historical Whoop data. Used by `/backfill` and `/setup` commands.
- **WHOOP OAuth** (`/api/auth/whoop/start` + `/callback`): one-time flow to store the refresh token.

---

## Sunday Claude Code ritual

Every Sunday after the weekly summary arrives, run a session to:

1. Review the week's `/log` entries and biometric trends from the summary.
2. Adjust next week's `plan.yml` based on recovery trend, ACWR, and subjective notes.
3. Commit updated `plan.yml` and redeploy.

See `docs/sunday-ritual.md` for the full prompt template.

---

## Build log — v0 through v7 (one session, 2026-04-26)

| Version | Tag  | Headline                                                                                                                                                                                                                              | Tests | Commits                                                                          |
| ------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------- | --- | --- |
| v0      | `v0` | Daily Whoop cron → Telegram readiness ping (recovery + plan from `plan.yml`)                                                                                                                                                          | 10    | 9                                                                                |
| v1      | —    | `/log` `/skip` `/swap` Telegram commands + Redis persistence                                                                                                                                                                          | 21    | 6                                                                                |
| v2      | `v2` | Sunday weekly summary cron + initial Sunday ritual docs                                                                                                                                                                               | 23    | 6                                                                                |
| v3      | `v3` | Full Whoop biometric snapshot (HRV/RHR/sleep/strain/zones) + science-grounded `decideToday` engine + ACWR + HRV-trend override                                                                                                        | 51    | 9                                                                                |
| v4      | `v4` | 14 analytics commands (`/hrv` `/rhr` `/sleep` `/zones` `/load` `/report week                                                                                                                                                          | month | year` `/recent`) + 90-day backfill + sparklines + polarized 80/20 + monthly cron | 89  | 9   |
| v5      | `v5` | Visual web dashboard at `/` (mobile-first, signed cookie auth) + `/weight` `/waist` `/body` `/streak` `/calendar`                                                                                                                     | 106   | 7                                                                                |
| v6      | `v6` | `/done` (RPE/RIR/soreness) + `/goal` `/goals` + period-comparison reports + auto-deload alerts + signed cookie session                                                                                                                | 132   | 7                                                                                |
| v7      | `v7` | Coach voice (personality openers) + Telegram inline keyboards + `/protein` `/bedtime` `/pain` (with pre-session pain gate) + durable Redis archive (no TTL) + `/export` + adaptive `/today` + redesigned dashboard with `?detail=1`   | 168   | 10                                                                               |
| v8      | `v8` | Premium PWA (manifest + apple-touch-icon) + OLED tokens + sticky TODAY + 13-week heatmap + TrendChart pills (7d/30d/90d/365d) + bedtime consistency widget + pull-to-refresh + WoW color arrows + singleton Redis + HMAC token expiry | 168   | 12                                                                               |

**Total:** 90 commits, 168 tests, 4 cron jobs (daily / post-workout / weekly / monthly), 11 API routes, 25 Telegram commands, $0/month operating cost.

### Key sources (science-grounded)

- WHOOP OAuth API v2 (recovery, sleep, cycle, workout)
- Gabbett 2016 — Acute:Chronic Workload Ratio (sweet spot 0.8–1.3)
- Seiler — polarized 80/20 endurance training
- Helms / Zourdos — RPE/RIR scale calibration
- Coffey & Hawley — concurrent training interference (hypertrophy + endurance)
- Burke et al. 2011 — binary self-monitoring beats quantitative tracking 4× on adherence
- Marco Altini / HRV4Training — RMSSD trend > composite recovery score

### Stack

- Next.js 15 + TypeScript on Vercel Hobby (free tier)
- Vercel marketplace Redis (TCP, KV-prefixed env vars)
- Whoop Developer API v2 (read-only OAuth)
- Telegram Bot API (`@whoop_trainer_bot`)
- Vitest for unit tests
- No paid LLM API; coaching intelligence concentrated in weekly Sunday Claude Code ritual

### Architecture decision log

1. Path B chosen over A/C/D: hybrid (Whoop Coach + thin custom shim). Avoided commercial app lock-in (Hevy, MacroFactor, JuggernautAI).
2. Vercel marketplace Redis (TCP) over `@vercel/kv` (REST) — `node-redis` client; `redis://default:...@redis-...redislabs.com`.
3. Plan.yml lives in repo (committed), edited weekly via Sunday Claude Code ritual. No daily LLM API call.
4. Public repo enabled CLI deploys on Hobby (private repos blocked by Vercel Hobby tier).
5. Single user gated by `TELEGRAM_CHAT_ID` check + per-route bearer secrets.
6. Dashboard auth: signed HMAC-SHA256 cookie set after first `?key=...` visit, 30-day expiry.
7. 90-day Redis TTL on biometric snapshots; durable archive in Redis with no TTL added in v7.
8. Whoop API requires ISO timestamps for `start`/`end` (not just dates) — caught and fixed in v4.
9. Auto-deload triggers when ≥2 chronic stress signals fire simultaneously (HRV decline, RHR drift, ACWR>1.4, sleep debt).
10. Body recomp tracked manually via `/weight` + `/waist` + tape measure; no scale required.
