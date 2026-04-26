# Personalized Training Stack — Design

**Date:** 2026-04-26
**Owner:** Asadbek
**Status:** Approved (Path B)

## 1. Goal

A personalized training tracking + AI-coaching system covering 5x/week M-F lunch sessions (3 lift days + 2 outdoor runs), reactive to Whoop recovery, body-recomp + endurance focused, with **zero incremental cost** beyond the existing Whoop subscription and a 6–10 hour build investment.

## 2. Constraints

- **Hardware:** Whoop band only. iPhone. No smart scale, no chest strap, no Apple Watch.
- **Subscriptions:** Whoop only ($30/mo, already paid). No Hevy Pro, no MacroFactor, no JuggernautAI, no paid LLM API.
- **Schedule:** ~1 hr at lunch, M-F. Body-part split: 3 lift (chest/back/arms, legs, mixed) + 2 runs.
- **Existing stack to leverage:** Vercel deployments (free tier), Obsidian vault, operational Telegram bot (token reused from GitHub Radar), Codex CLI + Claude Code subscriptions, Python/TS comfort.
- **Hard limits:** No daily LLM API calls (cost). Time displacement vs CFA L1 study (Aug 2026) and trading systems must be minimal.

## 3. The two halves of body recomp

| Half                                     | Tracked by this system? | Method                                                    |
| ---------------------------------------- | ----------------------- | --------------------------------------------------------- |
| Training quality (lifts, runs, recovery) | Yes — fully             | Whoop Strength Trainer + auto-detected runs + Whoop Coach |
| Fat loss (calorie deficit, body comp)    | Partially — proxy only  | Weekly waist tape + Sunday photo + how clothes fit        |

The system explicitly does NOT solve nutrition tracking. The user accepts visual-proxy body-comp tracking as sufficient.

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          User (iPhone)                          │
└──────────┬──────────────────────────┬───────────────────────────┘
           │ wears                    │ uses
           ▼                          ▼
   ┌──────────────┐           ┌──────────────┐
   │  Whoop band  │           │ Whoop app    │
   │ (sleep, HR,  │           │ (Strength    │
   │  HRV, runs)  │           │  Trainer,    │
   └──────┬───────┘           │  Coach,      │
          │                   │  Logger)     │
          │ syncs             └──────────────┘
          ▼
   ┌──────────────┐
   │ Whoop cloud  │◀────── OAuth read API
   │ (recovery,   │
   │  workouts,   │
   │  strain)     │
   └──────┬───────┘
          │ pulled by
          ▼
   ┌──────────────────────────────────────────┐
   │  Vercel cron job (Node.js, free tier)    │
   │  ┌────────────────────────────────────┐  │
   │  │ Daily 08:00 Zurich:                │  │
   │  │  1. Refresh Whoop OAuth token      │  │
   │  │  2. Pull yesterday's recovery,     │  │
   │  │     sleep, last workout strain     │  │
   │  │  3. Read today's plan from         │  │
   │  │     repo plan.yml                  │  │
   │  │  4. Apply green/yellow/red rules   │  │
   │  │     to scale intensity             │  │
   │  │  5. Compose Telegram message       │  │
   │  │  6. Append day-row to plan.yml     │  │
   │  └────────────────────────────────────┘  │
   │  Sunday 18:00 Zurich:                    │
   │  ┌────────────────────────────────────┐  │
   │  │  Generate weekly summary markdown  │  │
   │  │  Push to Obsidian vault repo       │  │
   │  │  Notify user "ready for plan"      │  │
   │  └────────────────────────────────────┘  │
   └──────────────┬───────────────────────────┘
                  │ posts to
                  ▼
   ┌──────────────────────────────────────────┐
   │  Telegram bot (existing infrastructure)  │
   │  Daily readiness message at 08:00:       │
   │     "🟢 Recovery 78%. Today: chest 4x8   │
   │      bench / 3x10 incline DB / 3x12 fly. │
   │      Z2 cap 145bpm if cardio."           │
   └──────────────────────────────────────────┘

   ┌──────────────────────────────────────────┐
   │  Sunday ritual (manual, ~10 min):        │
   │  User opens Claude Code, runs prompt:    │
   │  "Plan next week from this Obsidian      │
   │   summary + recent Whoop trends."        │
   │  Claude writes plan.yml, user reviews,   │
   │  commits to repo. Free under sub.        │
   └──────────────────────────────────────────┘
```

## 5. Components

### 5.1 plan.yml (the contract)

A single YAML file in the repo that the cron reads each morning. Format:

```yaml
week_start: 2026-04-27
days:
  monday:    {type: lift, focus: chest,    main: "bench 4x8", accessories: [...], cardio: optional Z2 20min}
  tuesday:   {type: run,  duration_min: 45, hr_zone: 2}
  wednesday: {type: lift, focus: legs,     main: "squat 4x6", accessories: [...]}
  thursday:  {type: run,  duration_min: 30, hr_zone: 3, intervals: "5x3min"}
  friday:    {type: lift, focus: pull,     main: "deadlift 3x5", accessories: [...]}
recovery_rules:
  green:  intensity_multiplier: 1.0    # recovery >= 67%
  yellow: intensity_multiplier: 0.7    # 34-66%
  red:    intensity_multiplier: 0.0    # <34%, swap to Z2 walk + mobility
```

### 5.2 Vercel cron service

- **Stack:** Next.js API routes on Vercel free tier (Hobby plan).
- **Endpoints:**
  - `GET /api/cron/daily` — invoked at 08:00 daily by Vercel cron
  - `GET /api/cron/weekly` — invoked Sunday 18:00 for weekly summary
  - `POST /api/telegram/webhook` — receives /log, /skip, /swap commands from Telegram
  - `GET /api/auth/whoop/callback` — one-time OAuth setup
- **Storage:** Vercel KV (free tier, 256MB) for OAuth tokens + last-pulled-state cache. Plan.yml lives in git, not KV.

### 5.3 Whoop OAuth integration

- One-time manual auth flow at setup.
- Refresh token stored in Vercel KV.
- Daily cron refreshes access token, fetches recovery + last workout.
- Failure mode: if refresh fails, cron sends Telegram alert "Whoop reauth needed" with the OAuth URL.

### 5.4 Telegram bot extension

- Reuses GitHub Radar bot token (per user's existing memory).
- Three new commands beyond the morning push:
  - `/log <freeform>` — appends raw text to today's session log in Obsidian
  - `/skip` — marks today done, won't auto-progress next session
  - `/swap <day>` — swaps today with another day's session

### 5.5 Obsidian integration

- Weekly markdown file generated by Sunday cron at `~/Obsidian/Asadbek/01_Projects/Training/Weeks/2026-W{NN}.md`.
- Sync mechanism: Vercel cron writes to a GitHub repo (Obsidian vault), local Obsidian syncs from GitHub (matching existing dual-laptop sync setup).
- Format:

  ```markdown
  # Week {N} — 2026-04-27 to 2026-05-03

  ## Summary

  - Lifts completed: 3/3
  - Runs completed: 2/2
  - Avg recovery: 71%
  - Sleep avg: 7h 12m

  ## Daily log

  [auto-populated rows]

  ## Notes

  [user adds reflections]
  ```

### 5.6 Sunday Claude Code ritual

**Manual, ~10 min, no automation.** Every Sunday evening:

1. User opens `~/training-coach/` in Claude Code.
2. Runs: "Read last week's Obsidian summary at `~/Obsidian/Asadbek/01_Projects/Training/Weeks/` and plan.yml history in this repo. I will paste this week's Whoop trend screenshot below. Generate next week's plan.yml respecting: 3 lift days + 2 runs, lunch sessions, body-part rotation. Apply progressive overload from last week's RPE."
3. Claude Code writes new `plan.yml`. User reviews, edits if needed, commits.
4. Vercel cron picks it up automatically Monday morning.

**Why this works for the LLM-coach requirement:** Claude Code is on subscription, not API — costs $0. The "AI coach" intelligence is concentrated in one weekly session instead of daily API calls. Daily reactivity is handled by deterministic green/yellow/red rules.

## 6. Data flow (a Tuesday morning)

1. **07:55** — user wakes up. Whoop band has logged sleep + HRV overnight.
2. **08:00** — Vercel cron fires:
   - Pulls `recovery_score` and `last_workout` from Whoop API (response in ~1s).
   - Reads `plan.yml` for "tuesday" → run, 45 min, Z2.
   - Recovery is 58% (yellow) → multiplier 0.7 → "30 min Z2 instead of 45 hard."
   - Posts to Telegram: "🟡 Recovery 58%. Today: 30-minute Z2 run, cap 145bpm. Save the hard run for Thursday."
3. **12:30** — user reads Telegram on the way to lunch run. Goes for the 30-min Z2 run wearing Whoop.
4. **13:30** — Whoop auto-detects + logs the run with HR zones.
5. **Evening** — user types `/log felt easy, no knee` to Telegram. Bot appends to Obsidian today's note.
6. **Sunday** — Vercel cron generates week summary. User runs Claude Code ritual, plans next week.

## 7. Build sequence (6–10 hours total over 1–2 weekends)

### v0 — minimum viable (3 hrs)

- [ ] Init Vercel project, add `vercel.json` cron config
- [ ] Whoop OAuth handshake (one-time, ~1 hr — known papercut)
- [ ] Daily cron pulls recovery, sends fixed-text Telegram message ("Recovery: X%. Plan today: \_\_\_.")
- [ ] Hardcoded one-week `plan.yml` to start

**Done when:** Tuesday morning Telegram pings with recovery %.

### v1 — recovery rules + commands (3 hrs)

- [ ] Implement green/yellow/red intensity multipliers in cron
- [ ] Add /log, /skip, /swap Telegram commands via webhook
- [ ] Append day-rows to a daily Obsidian markdown file (synced via existing GitHub repo)

**Done when:** poor recovery actually scales the prescription, and `/log` notes show up in Obsidian.

### v2 — Sunday ritual + weekly summary (2–4 hrs)

- [ ] Sunday cron generates weekly markdown summary (recovery avg, sessions completed, RPE trend)
- [ ] Document the Sunday Claude Code prompt in `docs/sunday-ritual.md`
- [ ] First end-to-end planning session

**Done when:** you can sustain the system without me.

## 8. What this design explicitly does NOT do

- **No nutrition tracking.** User accepts visual proxy.
- **No body composition automation.** Manual weekly waist tape + photo only.
- **No daily LLM API calls.** All "AI coaching" comes from the weekly Claude Code session under existing sub.
- **No Whoop write-back.** The Whoop API is read-only; this system is one-way ingest.
- **No replacement of Whoop's Strength Trainer.** Lift logging stays in Whoop's app — this system reads workout summaries from the API, not raw set/rep data (which the API doesn't expose anyway).
- **No mobile app.** Telegram is the entire mobile surface.
- **No webhook from Whoop.** Whoop API has none — daily polling is the only option.

## 9. Failure modes + mitigations

| Failure                               | Detection                    | Mitigation                                                           |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Whoop OAuth token expires unrefreshed | Cron fails to fetch recovery | Telegram alert with reauth URL                                       |
| Vercel cron silently stops firing     | No daily Telegram for 2 days | Add "heartbeat" check — Telegram alerts if no message 2 days running |
| Whoop API breaking change             | Cron throws exception        | Sentry on Vercel free tier, alerts to Telegram                       |
| User skips Sunday ritual              | plan.yml goes stale          | Cron warns "plan.yml older than 7 days" in Telegram                  |
| User stops following plan             | Adherence rot                | Out of scope — no system can fix this; weekly summary surfaces it    |

## 10. Success criteria

- **Week 1:** v0 deployed. Receives daily Telegram pings with recovery %.
- **Week 2:** v1 deployed. Recovery rules visibly scale prescription. /log works.
- **Week 4:** v2 deployed. First Sunday ritual completed end-to-end.
- **Week 8:** still using it. If yes — system is durable. If no — kill the project, fall back to Path A (Whoop Coach native only). Sunk cost is one weekend.
- **Week 12:** waist tape down 2cm OR mirror improvement OR strength up — at least one signal of body recomp progress.

## 11. Out of scope (deliberately)

- Hevy / MacroFactor / JuggernautAI integration
- Custom mobile app or web dashboard
- Nutrition tracking integration
- Real-time mid-set logging
- Multi-user support
- Anything that costs incremental dollars

## 12. Open questions for build phase

- **iPhone OS confirmation** still pending — only matters if we add Apple Health bridge later (not in scope for v0–v2).
- **Vercel cron timing** — Vercel free tier limits cron to once per day per project on Hobby; need to confirm Sunday + daily can coexist on same project, or split into 2 minimal projects.
- **Telegram bot token reuse** — confirm GitHub Radar bot token can host an additional command set without conflict, or if a second bot needs registration (still free).
