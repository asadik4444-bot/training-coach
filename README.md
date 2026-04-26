# training-coach

**v4 — analytics console + 90-day backfill** | [live](https://training-coach-phi.vercel.app)

Personal training assistant: fetches WHOOP recovery each morning and sends a Telegram message with the day's plan, adjusted for how recovered you are.

---

## Environment variables

| Variable              | Description                                 |
| --------------------- | ------------------------------------------- |
| `KV_REDIS_URL`        | TCP Redis URL from Vercel marketplace Redis |
| `TELEGRAM_BOT_TOKEN`  | Bot token from @BotFather                   |
| `TELEGRAM_CHAT_ID`    | Your Telegram user ID (single-user app)     |
| `WHOOP_CLIENT_ID`     | WHOOP OAuth client ID                       |
| `WHOOP_CLIENT_SECRET` | WHOOP OAuth client secret                   |
| `CRON_SECRET`         | Bearer token used by the Vercel cron jobs   |

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

| Command        | Effect                                                              |
| -------------- | ------------------------------------------------------------------- |
| `/today`       | Today's snapshot: recovery %, HRV, RHR, sleep, workout, plan        |
| `/log <entry>` | Append a free-text note to today's training log                     |
| `/skip`        | Mark today as skipped — the cron will not send a plan               |
| `/swap <day>`  | Replace today's session with another weekday's plan (monday–friday) |
| `/help`        | List all available commands                                         |

### Analytics (require /backfill for meaningful history)

| Command       | Effect                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| `/hrv [N]`    | HRV trend over last N days (default 7) — avg, range, CV, sparkline      |
| `/rhr [N]`    | RHR trend over last N days (default 7)                                  |
| `/sleep [N]`  | Sleep efficiency + duration trend over last N days (default 7)          |
| `/zones [N]`  | HR zone breakdown + Seiler polarized ratio over last N days (default 7) |
| `/load`       | Training load: acute (7d) / chronic (28d) strain + ACWR interpretation  |
| `/recent [N]` | Last N workouts with sport, strain, zone breakdown (default 5)          |

### Reports

| Command         | Effect                                                                         |
| --------------- | ------------------------------------------------------------------------------ |
| `/report`       | Week summary (same as `/report week`)                                          |
| `/report week`  | 7-day summary: recovery, HRV, RHR, sleep, strain, ACWR, zones, recommendations |
| `/report month` | 30-day summary — run `/backfill` first for full data                           |
| `/report year`  | 365-day summary with monthly breakdown table — run `/backfill` first           |

### Setup

| Command     | Effect                                                   |
| ----------- | -------------------------------------------------------- |
| `/backfill` | Pull 90 days of Whoop history into Redis (one-shot)      |
| `/setup`    | Run backfill + print onboarding guide for first-time use |

> **Note:** `/report month`, `/report year`, `/hrv 30`, and similar long-window commands
> need historical data in Redis. Run `/setup` or `/backfill` once after initial deployment.

---

## Re-linking Whoop

To re-link Whoop after token expiry or initial setup:

1. Generate a new setup secret: `openssl rand -hex 32`
2. Set it as `WHOOP_SETUP_SECRET` env var in Vercel project settings.
3. Visit `/api/auth/whoop/start?secret=<value>` in your browser to start the OAuth flow.

---

## How it works

- **Daily cron** (`/api/cron/daily`, Mon–Fri 06:00 UTC): checks skip/swap flags, fetches WHOOP recovery, picks today's plan from `plan.yml`, and sends a composed Telegram message.
- **Weekly cron** (`/api/cron/weekly`, Sun 16:00 UTC): sends a weekly summary with avg recovery, biometric trends (HRV/RHR/sleep sparklines), polarized zone analysis, ACWR, and recommendations.
- **Monthly route** (`/api/cron/monthly`, 1st of month 07:00 UTC): sends a 30-day report. Note: Vercel Hobby plan supports only 2 scheduled crons — trigger this manually or use an external scheduler (cron-job.org) until a Pro plan is active.
- **Webhook** (`/api/telegram/webhook`): receives Telegram updates and routes all commands; state is persisted in Redis.
- **Backfill** (`/api/backfill?days=N`): one-shot endpoint (Bearer auth) to pull historical Whoop data. Used by `/backfill` and `/setup` commands.
- **WHOOP OAuth** (`/api/auth/whoop/start` + `/callback`): one-time flow to store the refresh token.

---

## Sunday Claude Code ritual

Every Sunday after the weekly summary arrives, run a session to:

1. Review the week's `/log` entries and biometric trends from the summary.
2. Adjust next week's `plan.yml` based on recovery trend, ACWR, and subjective notes.
3. Commit updated `plan.yml` and redeploy.

See `docs/sunday-ritual.md` for the full prompt template.
