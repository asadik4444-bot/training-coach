# training-coach

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
| `CRON_SECRET`         | Bearer token used by the Vercel cron job    |

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

| Command        | Effect                                                              |
| -------------- | ------------------------------------------------------------------- |
| `/log <entry>` | Append a free-text note to today's training log                     |
| `/skip`        | Mark today as skipped — the cron will not send a plan               |
| `/swap <day>`  | Replace today's session with another weekday's plan (monday–friday) |

---

## How it works

- **Daily cron** (`/api/cron/daily`, runs 06:30 Zurich via `vercel.json`): checks skip/swap flags, fetches WHOOP recovery, picks today's plan from `plan.yml`, and sends a composed Telegram message.
- **Webhook** (`/api/telegram/webhook`): receives Telegram updates and routes `/log`, `/skip`, `/swap` to their handlers; all state is persisted in Redis with a 60-day TTL.
- **WHOOP OAuth** (`/api/auth/whoop/start` + `/callback`): one-time flow to store the refresh token.

---

## Sunday Claude Code ritual (v2 stub)

Every Sunday, run a session to:

1. Review the week's `/log` entries pulled from Redis.
2. Adjust next week's `plan.yml` based on recovery trend and subjective notes.
3. Commit updated `plan.yml` and redeploy.

_(Full v2 automation — weekly summary message + plan-update PR — is pending.)_
