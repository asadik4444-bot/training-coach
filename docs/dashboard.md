# Visual Dashboard

URL: `https://training-coach-phi.vercel.app/?key=<DASHBOARD_SECRET>`

The dashboard is a server-rendered, mobile-first single page. No login session — just the secret key in the query string. Bookmark the full URL.

---

## Widgets

### TODAY

Shows today's biometric snapshot pulled from Redis (populated by the daily cron or `/backfill`).

- **Recovery %** — colour-coded: green ≥67%, yellow 34–66%, red <34%
- **HRV** — latest rMSSD in ms
- **RHR** — resting heart rate in bpm
- **Sleep** — efficiency % and total time in bed
- **Plan** — today's session from `plan.yml` (type + summary)

### HRV — last 30 days

SVG polyline chart of daily HRV values. Gaps (days with no scored recovery) are omitted from the line. Below the chart: rolling 30-day average, coefficient of variation (CV), and latest reading.

- CV < 10%: healthy stability
- CV 10–12%: moderate variability, monitor
- CV > 12%: high variability — reduce load

### Recovery — last 30 days

Colour-coded bar chart: one bar per day, height = recovery score (0–100).

- Green bar: ≥67% (green zone)
- Yellow bar: 34–66% (yellow zone)
- Red bar: <34% (red zone)

### Streaks

- **Green recovery** — consecutive days ending today where recovery score ≥67%. Resets at the first non-green or unscored day.
- **Best** — longest historical green run in the 30-day window.
- **No-skip days** — consecutive weekdays (Mon–Fri) without a `/skip`. Weekends are transparent (don't count, don't break).

### Body

Latest logged weight (kg) and waist (cm) from `/weight` and `/waist` Telegram commands. Delta shows change from the oldest entry in the 30-day window.

Use `/weight 79.4` and `/waist 84` in Telegram to log measurements.

### Training Load (ACWR)

- **Acute 7d avg** — mean daily strain over the last 7 days
- **Chronic 28d avg** — mean daily strain over the last 28 days
- **ACWR** — acute/chronic ratio; sweet spot is 0.8–1.3
  - <0.8: detraining
  - 0.8–1.3: optimal progression
  - 1.3–1.5: high — consider a deload day
  - > 1.5: overreaching risk
- **Polarized ratio** — low-intensity (Z1+Z2) minutes ÷ high-intensity (Z3–Z5) minutes
  - ≥4: polarized (ideal 80/20)
  - 2–4: pyramidal
  - <2: threshold — too much moderate intensity

### Recent workouts

Last 5 workouts with date, sport name, and strain score.

---

## Access & security

The page returns a 401 screen if `?key=` is missing or wrong. The secret never appears in page source — it is only compared server-side. Rotate it by updating `DASHBOARD_SECRET` in Vercel project settings and re-generating your bookmarked URL.
