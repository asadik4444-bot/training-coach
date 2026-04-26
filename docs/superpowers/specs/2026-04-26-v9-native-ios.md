# v9 — Native iOS SwiftUI App (free sideload)

**Date:** 2026-04-26
**Status:** Spec drafted, not yet built
**Estimated effort:** 5–7 focused days (or 2–3 weekends with Codex SwiftUI generation)
**Cost:** $0 — Apple Free Provisioning + AltStore for auto-resigning
**Target user:** Asadbek (single user on his own iPhone)

---

## 0. Why this exists

The web PWA at https://training-coach-phi.vercel.app delivers ~80% of native iOS feel. v9 closes the remaining 20%:

- **Real interactivity** native to iOS (haptics, swipe gestures, Dynamic Island, Lock Screen widgets)
- **HealthKit integration** — passive read of weight, body fat %, workout HR, heart rate variability if iPhone-connected
- **Better charts** via SwiftUI Charts (iOS 16+), free interactivity, no SVG hacks
- **Home/Lock Screen widgets** — recovery score on wallpaper, quick view at a glance
- **Live Activity** — today's plan in Dynamic Island during the workout window
- **Siri Shortcuts** — "Hey Siri, log my weight 79.4"

What v9 explicitly does NOT do:

- App Store distribution (paid program required)
- APNs push notifications (paid program required — Telegram bot already covers push)
- Multi-user / friend features

---

## 1. Distribution path (the $0 mechanism)

### Apple Free Provisioning

- Free Apple ID (already owned)
- Build via Xcode (free download from Mac App Store)
- Install on iPhone via USB cable
- **Limitation:** signing certificate expires every 7 days — must re-sign weekly

### AltStore (the auto-renewal hack)

- Free open-source tool
- Runs on your Mac in background
- When iPhone + Mac are on same Wi-Fi, it re-signs and reinstalls automatically before expiry
- Set up once, forget about it
- Repo: https://altstore.io

### Capabilities available under Free Provisioning

- ✅ HealthKit (read-only mostly works for personal use)
- ✅ Network (URLSession to your Vercel backend)
- ✅ Keychain (secure storage of dashboard secret)
- ✅ Local Notifications (scheduled, not server-pushed)
- ✅ Widgets (WidgetKit)
- ✅ Live Activities (iOS 16.1+)
- ❌ APNs server push (need $99 paid program)
- ❌ Sign in with Apple (paid only)
- ❌ App Store distribution (paid only)

---

## 2. Architecture

### Backend stays untouched

The existing Next.js API on Vercel becomes the backend for both the PWA AND the native app. The Swift app speaks JSON over HTTPS to the same routes:

- `GET /api/data/refresh?key=…` (or via cookie) — full dashboard data
- `GET /api/trend/[metric]?days=N` — trend data per metric (HRV/RHR/sleep/strain)
- `GET /api/data/snapshot?date=YYYY-MM-DD` — single day for heatmap drill-down
- `GET /api/export?key=…` — full archive export
- (Telegram + cron flows continue independently)

### Authentication

- On first launch, user pastes the dashboard secret into a settings screen
- Stored in iOS **Keychain** (encrypted, persists across reinstalls)
- Sent as `Authorization: Bearer <secret>` header on every request
- We add a tiny new endpoint: `GET /api/data/snapshot?key=…` and `GET /api/data/refresh?key=…` accepting either Bearer or `?key=` for compatibility

### Local storage

- `@AppStorage` for UI preferences (chart window, theme override)
- Core Data NOT needed — just decode JSON straight into views
- Optional: cache last 24h of dashboard data via `URLCache` for offline glance

### Notifications

- Daily/post-workout/weekly Telegram notifications continue (it's free + works)
- Add **Local Notifications** scheduled by the app for: "Open dashboard at 08:05 to see today's plan" (a soft nudge, no server required)
- NOT replacing Telegram — both ecosystems running in parallel

---

## 3. Screens to build

### 3.1 Today (default view, opens to)

- Big recovery emoji + percentage (`🟢 78%`)
- HRV / RHR / Sleep stats row
- Coach voice quote in italic
- Today's plan (lift focus or run)
- Decision flags (deload signal, ACWR warning, sleep debt, pain gate)
- Subtle haptic on first appearance

### 3.2 Trends (HRV / RHR / Sleep / Strain)

- 4 cards, each with SwiftUI Chart line
- Segmented picker `7d / 30d / 90d / 365d`
- Tap on chart → exact value + date callout (native, free)
- Animated transitions when changing window

### 3.3 Heatmap (recovery 90 days)

- 13-week × 7-day grid
- Tap a day → sheet pulls up with full snapshot
- Pinch to zoom in / out
- Native tap target hit areas

### 3.4 Goals

- Read-only display (writing goals stays in Telegram per v8 audit consensus)
- Each goal: target, current, progress ring (SwiftUI `Gauge` or custom)
- Tap → goal detail with history chart

### 3.5 Body

- Weight + waist trend
- HealthKit pull on Apple Watch users (passive)
- Latest, delta, sparkline

### 3.6 Settings

- Dashboard secret entry (one-time)
- Telegram bot link (deep link to chat)
- Force refresh
- Show last update timestamp

### 3.7 Workouts

- Last 30 sessions from /api/recent
- Tap → detail (zone breakdown, RPE if logged)

---

## 4. Widget extensions

### 4.1 Small widget — Recovery

- Just the recovery emoji + percentage
- Color background by band
- Updates every 30 minutes

### 4.2 Medium widget — Today

- Recovery + planned session + next cron time
- One tap to open app

### 4.3 Large widget — Mini heatmap

- 4-week recovery grid
- Today highlighted
- Streak count

### 4.4 Lock Screen widget

- Single recovery emoji + percentage
- Replaces the lock screen weather/calendar real estate

### 4.5 Live Activity (Dynamic Island)

- Active during 12:30–14:00 (workout window)
- Compact: 🟢 78%
- Expanded: today's plan + remaining time

---

## 5. HealthKit integration (optional but worth it)

**Read-only permissions:**

- Body weight (auto-import → bypass `/weight` typing)
- Body fat % (if user has a Body+ scale or similar)
- Resting HR from Apple Watch (cross-check Whoop)
- Workout sessions (cross-check Whoop's auto-detection)
- Sleep analysis (cross-check Whoop)

User enables in onboarding, app reads passively, syncs to Vercel backend via existing /weight + /done routes.

---

## 6. Build sequence (12 commits, target ~7 days)

1. `chore(scaffold)` — Xcode project, SwiftUI app, deployment target iOS 16+
2. `feat(auth)` — Keychain secret storage + paste-in onboarding screen
3. `feat(api-client)` — Codable structs for all backend responses + URLSession wrapper
4. `feat(today-screen)` — Today view rendering recovery + plan
5. `feat(trends-screen)` — 4 SwiftUI Charts with segmented picker
6. `feat(heatmap-screen)` — 13-week tappable grid + day sheet
7. `feat(workouts-screen)` — Recent workouts list + detail
8. `feat(body-screen)` — Weight + waist trends, optional HealthKit
9. `feat(widgets)` — Small + medium + large + Lock Screen widget extension
10. `feat(live-activity)` — Dynamic Island + Live Activity for workout window
11. `feat(local-notifications)` — Schedule local nudge at 08:05 daily
12. `chore(altstore)` — README with AltStore setup instructions for weekly auto-resign

---

## 7. Translation work (most of v8 ports 1:1)

### Direct Swift equivalents

- **Color tokens:** `extension Color { static let bg = Color(hex: 0x0A0A0F) ... }`
- **Typography:** `Font.custom("FiraSans-Regular", size: 16)` (bundle the font in app)
- **Recovery bands:** copy the same 67/34 thresholds
- **HRV/RHR/sleep computations:** server already does these, app just consumes JSON
- **Coach voice openers:** copy the same string pools
- **Decision rules:** server already runs these, app just displays results

### What's better in Swift

- Charts (native, interactive) > hand-rolled SVG
- Animations (spring physics, native) > CSS transitions
- Haptics (UIImpactFeedbackGenerator) > Web Vibration API
- Date math (DateFormatter, Calendar) > JS Date

### What's harder in Swift

- Layout (less flexible than CSS) — but SwiftUI HStack/VStack/Grid covers our needs
- Bundle font (one-time setup) vs Google Fonts CSS (instant)
- Re-signing every 7 days (AltStore solves)

---

## 8. Codex SwiftUI generation strategy

Per the user's note that there's a Codex plugin for Swift, the workflow is:

1. Hand Codex the existing v8 page.tsx + design tokens + screen mockup descriptions
2. Codex emits SwiftUI views one screen at a time
3. Open each generated file in Xcode, run on simulator, fix any layout glitches manually
4. Iterate per screen

Estimated time per screen with Codex assist: 1-2 hours of generation + 1-2 hours of polish.

7 screens × 3 hours = 21 hours of focused work + 1 day for widgets + 1 day for HealthKit + 1 day for AltStore setup = **~5-7 days realistic**.

---

## 9. Risks

- **Re-signing pain** — if AltStore breaks (relies on Apple's free dev workflow which Apple sometimes changes), back to manual 7-day cycle
- **Apple may revoke free provisioning** — has happened to other tools but typically restored
- **Bundle size** — SwiftUI is fine, but bundle Fira fonts adds ~200KB (acceptable)
- **HealthKit free entitlement** — works for personal apps under free provisioning historically; if Apple tightens, fall back to Telegram-only data input

---

## 10. Things to address from v0-v8 BEFORE / DURING v9

### Cosmetic 1-liner

- Deload alert RHR delta should be `Math.round`'d (currently prints `11.666...`)

### Codex audit deferrals (only if specific failure observed)

- Refresh-token retry/backoff if Redis save fails mid-rotation
- Sanitize Whoop error response bodies (currently leak raw body in /api/cron error path)
- Telegram retry_after on 429
- Zod validation on plan.yml
- Cycle-based "today's recovery" lookup vs `?limit=1`

### From v8 audit (incorporated already, verify)

- ✅ HMAC token has 30-day expiry
- ✅ Singleton Redis client
- ✅ Heatmap cells ≥44pt
- ✅ Pull-to-refresh
- ✅ Sticky TODAY card
- ✅ PWA installable

---

## 11. Clear next steps when we pick this back up

1. **Confirm scope** — read this doc, agree or trim
2. **Install Xcode** — Mac App Store, free
3. **Install AltStore** — https://altstore.io
4. **Create Xcode project** — SwiftUI App, iOS 16+, name "Training Coach"
5. **Embed Fira Code + Fira Sans** — drop .ttf files in `Resources/`
6. **Build first screen (Today)** — handed to Codex with this spec + v8 page.tsx
7. **Iterate per screen** with Codex generation

I (Claude) can:

- Generate detailed Codex prompts for each screen
- Review SwiftUI output before you compile
- Maintain parity between PWA and native
- Test API client logic against Vercel routes (in Node, before Swift)

You (user):

- Run Xcode locally — the only step Claude can't do
- Sign with Apple ID
- Pair iPhone, install AltStore, sideload

---

## 12. Open questions for next session

- Do you want HealthKit integration in v9.0 or defer to v9.1?
- Do you want the widget extension in v9.0 or defer to v9.1?
- Is the Live Activity (Dynamic Island) worth the complexity for personal use, or skip?
- Should the Swift app and PWA share the same dashboard secret, or separate?
- Any iOS-specific feature you want that's not on this list?

---

## 13. Pointers for future Claude session

- This spec: `~/training-coach/docs/superpowers/specs/2026-04-26-v9-native-ios.md`
- Last session handoff: `~/.claude/last_session.md`
- Memory: `~/.claude/projects/-Users-asadbekabdurashidov/memory/project_training_coach.md`
- Web bookmarks (URLs/secrets/curl): `~/training-coach/.local/bookmarks.md` (gitignored)
- v8 React/TS source to translate: `~/training-coach/src/app/page.tsx` + `~/training-coach/src/components/`
- Backend API routes (don't change in v9): `~/training-coach/src/app/api/**/route.ts`
- Design tokens: `~/training-coach/src/app/globals.css` (CSS custom properties to translate to Swift colors)
