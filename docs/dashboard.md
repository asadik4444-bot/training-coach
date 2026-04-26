# Dashboard Guide — v8

URL: `https://training-coach-phi.vercel.app/?key=<DASHBOARD_SECRET>`

The dashboard is a **read-only synthesis surface**. It shows what has happened.
All actions (skip, swap, log, goals) happen in Telegram — not here.

---

## PWA installation (iPhone)

1. Open the URL in Safari.
2. Tap the Share button (box with arrow).
3. Tap **Add to Home Screen**.
4. Tap **Add**.

The app installs with a custom icon and opens fullscreen (no Safari chrome).
On subsequent opens it launches directly from your home screen.

---

## Authentication

First visit: navigate to `/api/auth/dashboard?key=<DASHBOARD_SECRET>`.
This sets a 30-day HttpOnly signed cookie and redirects to `/`.
Subsequent visits work without the `?key=` parameter — the cookie is renewed
automatically within 7 days of expiry.

To generate a secret: `openssl rand -hex 32`

---

## Page structure

The page has two layers:

- **Hero view** (always visible) — TODAY card + streak bar + recovery heatmap
- **Detail view** (tap `+ full detail`) — trend charts, bedtime widget, WoW table,
  goals, training load, body comp, recent workouts

On scroll, the TODAY card collapses to a compact sticky strip showing the recovery
emoji, score, and key biometrics so you always know your status while scrolling.

---

## Pull-to-refresh

On iPhone: pull down from the top of the page. A spinning indicator appears.
Release past the threshold (~80px) to reload. This fetches fresh data from Redis.

The page also shows an **Updated HH:MM** timestamp (Zurich time) at the top so
you know when data was last fetched.

---

## Widgets

### TODAY (hero card)

- **Recovery %** — color-coded: green ≥67%, yellow 34–66%, red <34%; glow matches band
- **Coach voice** — rotating personality opener keyed to today's recovery band
- **HRV / RHR / Sleep** — today's biometric readings in one row
- **Plan** — today's session from `plan.yml` with a colored left border

On scroll the card collapses to a one-line strip: `🟢 74% · HRV 58ms · RHR 52bpm · 89%`

### Streak bar

Always visible below the hero. Shows:

- **Green streak** — consecutive days with recovery ≥67%
- **No-skip** — consecutive weekdays without a `/skip`
- **Best** — longest green streak in the 60-day window

### Recovery heatmap — 13 weeks

A 13-column × 7-row grid (91 days). Each cell is colored by recovery score:

- Green: ≥67%
- Yellow: 34–66%
- Red: <34%
- Dim: no data

**Tap any cell** to open a bottom sheet showing that day's full detail:
HRV, RHR, sleep efficiency, sleep duration, workout sport + strain.

### Trend charts (HRV / RHR / Sleep / Strain)

Each metric has a segmented pill control: **7d · 30d · 90d · 365d**

- 7d / 30d / 90d — sliced from server-prefetched 91-day data (no extra network request)
- 365d — fetched lazily on first selection; aggregated to weekly averages (~52 points)

Selected period is saved in localStorage per metric and restored on next visit.

The chart shows:

- SVG area sparkline with gradient fill
- Average and latest values
- Trend arrow (↑ ↓ →) with green/red coloring

**HRV** also shows Coefficient of Variation (CV):

- CV < 10%: stable adaptation
- CV 10–12%: moderate variability, monitor load
- CV > 12%: high variability — reduce intensity

**RHR** is lower-is-better: the trend arrow is green when RHR decreases.

### Bedtime consistency

Shows last 30 logged bedtimes (via `/bedtime HH:MM` in Telegram):

- **Average bedtime** — mean across 30 nights (post-midnight hours handled correctly)
- **Std dev** — color-coded: green < 30 min, yellow 30–60 min, red > 60 min
- **14-night sparkline** — recent pattern at a glance

### Week over week

Compares this week (days 0–6) vs last week (days 7–13) for HRV, RHR, Sleep, Strain.
Each row shows this week's average and a color-coded delta:

- ▲ green = improvement (higher HRV, higher sleep %, lower RHR)
- ▼ red = regression
- — = insufficient data

### Goals

Progress bars (▰▰▰▱▱) for each goal set via Telegram:

- `/goal hrv 50` — target HRV in ms
- `/goal rhr 50` — target RHR in bpm (lower is better)
- `/goal weight 75` — target weight in kg
- `/goal waist 80` — target waist in cm

Protein 7-day hit rate shown as a 7-segment bar.

### Training load

- **Acute 7d avg** — mean daily strain, last 7 days
- **Chronic 28d avg** — mean daily strain, last 28 days
- **ACWR** — ratio: sweet spot 0.8–1.3; >1.5 = overreaching risk
- **Polarized ratio** — Z1+Z2 min ÷ Z3–Z5 min; ≥4 = polarized (80/20 ideal)

### Streaks + Body

Side-by-side:

- **Streaks** — green recovery, best, no-skip (same as streak bar above)
- **Body** — latest weight + waist + 30-day weight delta

### Recent workouts

Last 5 sessions: date, sport, strain score.

---

## What is read-only and why

The audit established that the dashboard is a **synthesis surface only**:

| Action           | Where                      |
| ---------------- | -------------------------- |
| Mark today done  | Telegram `/done rpe 8`     |
| Skip today       | Telegram `/skip`           |
| Swap session     | Telegram `/swap wednesday` |
| Log bedtime      | Telegram `/bedtime 22:45`  |
| Log weight/waist | Telegram `/weight 79.4`    |
| Set goals        | Telegram `/goal hrv 55`    |
| Edit plan        | Edit `plan.yml`, redeploy  |

This split keeps the dashboard fast (no write paths, no forms) and keeps
Telegram as the single action surface — consistent muscle memory.
