# Training Coach v0 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v0 of the training coach: every weekday at 08:00 Zurich, a Vercel cron pulls the user's latest Whoop recovery score and sends a fixed-text Telegram message ("Recovery: X%. Plan today: …") read from a hard-coded `plan.yml`.

**Architecture:** Next.js (App Router) on Vercel free tier hosts: (1) two OAuth routes for one-time Whoop authorization, (2) a daily cron route that reads `plan.yml` from the repo, fetches recovery via Whoop API v2, composes a Telegram message, and posts it via the existing GitHub Radar bot token. Vercel KV stores the long-lived Whoop refresh token. No database, no LLM API, no extra cost.

**Tech Stack:** Next.js 15 + TypeScript, Vercel Hobby (free) + Vercel KV (free), Whoop OAuth2 + Whoop Developer API v2, Telegram Bot API, `js-yaml` for plan parsing, Vitest for unit tests.

---

## File Structure

Files to create (all under `~/training-coach/`):

| Path                                       | Responsibility                                                |
| ------------------------------------------ | ------------------------------------------------------------- |
| `package.json`                             | Node project + scripts                                        |
| `tsconfig.json`                            | TypeScript config                                             |
| `next.config.js`                           | Next.js config                                                |
| `vercel.json`                              | Vercel cron schedule                                          |
| `.gitignore`                               | Ignore secrets + node_modules                                 |
| `.env.example`                             | Documented env-var template                                   |
| `plan.yml`                                 | Hardcoded weekly plan (read at runtime)                       |
| `src/lib/plan.ts`                          | Pure function: parse yaml + pick today's row                  |
| `src/lib/recovery.ts`                      | Pure function: classify recovery → green/yellow/red           |
| `src/lib/message.ts`                       | Pure function: compose Telegram text from recovery + plan row |
| `src/lib/telegram.ts`                      | Side-effect: POST to Telegram Bot API                         |
| `src/lib/whoop.ts`                         | OAuth flow + recovery fetch + token refresh                   |
| `src/lib/kv.ts`                            | Vercel KV wrapper for token storage                           |
| `src/app/api/auth/whoop/start/route.ts`    | GET — redirect to Whoop authorize URL                         |
| `src/app/api/auth/whoop/callback/route.ts` | GET — exchange code, persist refresh_token to KV              |
| `src/app/api/cron/daily/route.ts`          | GET — orchestrates plan → whoop → telegram                    |
| `tests/lib/plan.test.ts`                   | Unit tests for plan reader                                    |
| `tests/lib/recovery.test.ts`               | Unit tests for recovery classifier                            |
| `tests/lib/message.test.ts`                | Unit tests for message composer                               |

Pure functions (`plan`, `recovery`, `message`) are TDD'd. OAuth and side-effect code (`telegram`, `whoop`, `kv`) is exercised via the cron route during the manual end-to-end test in Task 9 — deferred TDD because mocking OAuth flows for a one-shot personal project is poor return on time.

---

## Pre-Flight

Before starting Task 1, complete these one-time external setups manually. They cannot be automated and are required before code will work.

- [ ] **Register Whoop developer app** at https://developer.whoop.com → New App. Name: "training-coach". Redirect URI: `http://localhost:3000/api/auth/whoop/callback` (we'll add the prod URL after first deploy). Scopes: `read:recovery read:cycles read:sleep read:workout offline`. Save the `client_id` and `client_secret`.
- [ ] **Locate your existing Telegram bot token** (the one shared with GitHub Radar). Obtain your personal `chat_id` by sending any message to the bot, then visiting `https://api.telegram.org/bot<TOKEN>/getUpdates` and copying the `chat.id` from the JSON.
- [ ] **Install Vercel CLI** if not already: `npm i -g vercel@latest`
- [ ] **Confirm Node 20+** is installed: `node -v`

---

## Task 1: Project scaffold

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.js`, `.gitignore`, `.env.example`, `vercel.json`

- [ ] **Step 1: Initialize Next.js project in place**

```bash
cd ~/training-coach
npm init -y
npm i next@latest react@latest react-dom@latest
npm i -D typescript @types/node @types/react vitest @vitest/ui js-yaml @types/js-yaml @vercel/kv
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.js`**

```js
/** @type {import('next').NextConfig} */
module.exports = { reactStrictMode: true };
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules
.next
.env.local
.env*.local
.vercel
*.log
.DS_Store
```

- [ ] **Step 5: Write `.env.example`**

```
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=http://localhost:3000/api/auth/whoop/callback
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
CRON_SECRET=
KV_URL=
KV_REST_API_URL=
KV_REST_API_TOKEN=
KV_REST_API_READ_ONLY_TOKEN=
```

- [ ] **Step 6: Write `vercel.json`**

```json
{
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 6 * * 1-5" }]
}
```

The schedule `0 6 * * 1-5` is 06:00 UTC Mon–Fri = 08:00 CEST (08:00 CET in winter is 07:00 — accept the 1-hour DST drift; you can revisit in Oct).

- [ ] **Step 7: Add scripts to `package.json`**

Edit `package.json`'s `"scripts"` block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold next.js + ts + vercel cron config"
```

---

## Task 2: plan.yml + plan reader (TDD)

**Files:**

- Create: `plan.yml`, `src/lib/plan.ts`, `tests/lib/plan.test.ts`

- [ ] **Step 1: Write `plan.yml` with one hardcoded week**

```yaml
week_start: 2026-04-27
days:
  monday:
    type: lift
    focus: chest
    summary: "Bench 4x8 / Incline DB 3x10 / Cable fly 3x12"
  tuesday:
    type: run
    summary: "45 min Z2 outdoor run, cap 145 bpm"
  wednesday:
    type: lift
    focus: legs
    summary: "Squat 4x6 / RDL 3x8 / Walking lunge 3x10"
  thursday:
    type: run
    summary: "30 min run with 5x3min Z3 intervals"
  friday:
    type: lift
    focus: pull
    summary: "Deadlift 3x5 / Pull-up 3xAMRAP / Row 3x10"
```

- [ ] **Step 2: Write the failing test**

Create `tests/lib/plan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickToday, parsePlan } from "../../src/lib/plan";

const yaml = `
week_start: 2026-04-27
days:
  monday:    { type: lift, focus: chest, summary: "Bench 4x8" }
  tuesday:   { type: run, summary: "45 min Z2" }
  wednesday: { type: lift, focus: legs, summary: "Squat 4x6" }
  thursday:  { type: run, summary: "Intervals" }
  friday:    { type: lift, focus: pull, summary: "Deadlift 3x5" }
`;

describe("plan", () => {
  it("parses yaml into structured plan", () => {
    const plan = parsePlan(yaml);
    expect(plan.days.monday.type).toBe("lift");
    expect(plan.days.tuesday.summary).toBe("45 min Z2");
  });

  it("picks today by 0=Sun..6=Sat weekday index", () => {
    const plan = parsePlan(yaml);
    expect(pickToday(plan, 1)?.summary).toBe("Bench 4x8"); // Monday
    expect(pickToday(plan, 2)?.summary).toBe("45 min Z2"); // Tuesday
    expect(pickToday(plan, 5)?.summary).toBe("Deadlift 3x5"); // Friday
  });

  it("returns null for weekend (Sat/Sun)", () => {
    const plan = parsePlan(yaml);
    expect(pickToday(plan, 0)).toBeNull(); // Sunday
    expect(pickToday(plan, 6)).toBeNull(); // Saturday
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL with "Cannot find module ../../src/lib/plan".

- [ ] **Step 4: Write minimal implementation**

Create `src/lib/plan.ts`:

```ts
import yaml from "js-yaml";

export type DayType = "lift" | "run";
export interface PlanDay {
  type: DayType;
  focus?: string;
  summary: string;
}
export interface Plan {
  week_start: string;
  days: Record<string, PlanDay>;
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function parsePlan(source: string): Plan {
  return yaml.load(source) as Plan;
}

export function pickToday(plan: Plan, weekdayIndex: number): PlanDay | null {
  const name = WEEKDAY_NAMES[weekdayIndex];
  return plan.days[name] ?? null;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test
```

Expected: 3/3 PASS.

- [ ] **Step 6: Commit**

```bash
git add plan.yml src/lib/plan.ts tests/lib/plan.test.ts
git commit -m "feat: add plan.yml schema + reader"
```

---

## Task 3: Recovery classifier (TDD)

**Files:**

- Create: `src/lib/recovery.ts`, `tests/lib/recovery.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/recovery.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { classifyRecovery } from "../../src/lib/recovery";

describe("classifyRecovery", () => {
  it("returns green at 67% and above", () => {
    expect(classifyRecovery(67).band).toBe("green");
    expect(classifyRecovery(95).band).toBe("green");
  });
  it("returns yellow between 34% and 66%", () => {
    expect(classifyRecovery(50).band).toBe("yellow");
    expect(classifyRecovery(34).band).toBe("yellow");
    expect(classifyRecovery(66).band).toBe("yellow");
  });
  it("returns red below 34%", () => {
    expect(classifyRecovery(20).band).toBe("red");
    expect(classifyRecovery(0).band).toBe("red");
  });
  it("attaches an emoji per band", () => {
    expect(classifyRecovery(80).emoji).toBe("🟢");
    expect(classifyRecovery(50).emoji).toBe("🟡");
    expect(classifyRecovery(10).emoji).toBe("🔴");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- recovery
```

Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/recovery.ts`:

```ts
export type Band = "green" | "yellow" | "red";

export interface Classification {
  band: Band;
  emoji: string;
  multiplier: number;
}

export function classifyRecovery(score: number): Classification {
  if (score >= 67) return { band: "green", emoji: "🟢", multiplier: 1.0 };
  if (score >= 34) return { band: "yellow", emoji: "🟡", multiplier: 0.7 };
  return { band: "red", emoji: "🔴", multiplier: 0.0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- recovery
```

Expected: 4/4 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recovery.ts tests/lib/recovery.test.ts
git commit -m "feat: classify whoop recovery into green/yellow/red"
```

---

## Task 4: Message composer (TDD)

**Files:**

- Create: `src/lib/message.ts`, `tests/lib/message.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/message.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { composeMessage } from "../../src/lib/message";

describe("composeMessage", () => {
  it("green recovery + lift day", () => {
    const msg = composeMessage(78, {
      type: "lift",
      focus: "chest",
      summary: "Bench 4x8",
    });
    expect(msg).toContain("🟢");
    expect(msg).toContain("78");
    expect(msg).toContain("Bench 4x8");
  });
  it("red recovery overrides plan with rest cue", () => {
    const msg = composeMessage(25, { type: "lift", summary: "Squat 4x6" });
    expect(msg).toContain("🔴");
    expect(msg).toMatch(/walk|mobility|rest/i);
    expect(msg).not.toContain("Squat 4x6");
  });
  it("null plan day (weekend) returns rest message", () => {
    const msg = composeMessage(70, null);
    expect(msg).toMatch(/rest|off/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- message
```

Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/message.ts`:

```ts
import { classifyRecovery } from "./recovery";
import type { PlanDay } from "./plan";

export function composeMessage(
  recoveryPct: number,
  today: PlanDay | null,
): string {
  const c = classifyRecovery(recoveryPct);
  const head = `${c.emoji} Recovery ${recoveryPct}%`;

  if (!today) return `${head}. Rest day — see you Monday.`;

  if (c.band === "red") {
    return `${head}. Skip planned ${today.type}. Z2 walk 30 min + mobility only.`;
  }

  const intensityNote =
    c.band === "yellow" ? " (yellow — 70% volume; cut last set of each)" : "";

  return `${head}. Today: ${today.summary}${intensityNote}.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: all tests PASS (plan + recovery + message).

- [ ] **Step 5: Commit**

```bash
git add src/lib/message.ts tests/lib/message.test.ts
git commit -m "feat: compose telegram message from recovery + today's plan"
```

---

## Task 5: Telegram sender

**Files:**

- Create: `src/lib/telegram.ts`

- [ ] **Step 1: Write the implementation**

Create `src/lib/telegram.ts`:

```ts
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId)
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API ${res.status}: ${body}`);
  }
}
```

- [ ] **Step 2: Manual smoke test**

Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to `.env.local`. Then run a one-off:

```bash
node --env-file=.env.local --experimental-strip-types -e "import('./src/lib/telegram.ts').then(m => m.sendTelegram('training-coach v0 smoke test ✅'))"
```

Expected: message arrives in your Telegram chat from the bot.

- [ ] **Step 3: Commit**

```bash
git add src/lib/telegram.ts
git commit -m "feat: telegram sender wrapper"
```

---

## Task 6: Vercel KV wrapper + Whoop client

**Files:**

- Create: `src/lib/kv.ts`, `src/lib/whoop.ts`

- [ ] **Step 1: Write `src/lib/kv.ts`**

```ts
import { kv } from "@vercel/kv";

const KEY = "whoop:refresh_token";

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await kv.set(KEY, refreshToken);
}

export async function loadRefreshToken(): Promise<string | null> {
  return await kv.get<string>(KEY);
}
```

- [ ] **Step 2: Write `src/lib/whoop.ts`**

```ts
import { saveRefreshToken, loadRefreshToken } from "./kv";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer/v2";

const SCOPES = "read:recovery read:cycles read:sleep read:workout offline";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok)
    throw new Error(
      `Whoop token exchange failed: ${res.status} ${await res.text()}`,
    );
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken)
    throw new Error(
      "No Whoop refresh token in KV — run /api/auth/whoop/start first",
    );
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: SCOPES,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok)
    throw new Error(`Whoop refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as TokenResponse;
  // Whoop returns a new refresh_token each time; persist it
  await saveRefreshToken(data.refresh_token);
  return data.access_token;
}

export async function fetchLatestRecovery(
  accessToken: string,
): Promise<number> {
  const res = await fetch(`${WHOOP_API}/recovery?limit=1`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok)
    throw new Error(
      `Whoop recovery fetch failed: ${res.status} ${await res.text()}`,
    );
  const data = await res.json();
  const records = data.records ?? [];
  if (records.length === 0)
    throw new Error("No recovery records returned by Whoop");
  return Math.round(records[0].score?.recovery_score ?? 0);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/kv.ts src/lib/whoop.ts
git commit -m "feat: whoop oauth + recovery fetch client"
```

---

## Task 7: OAuth routes

**Files:**

- Create: `src/app/api/auth/whoop/start/route.ts`, `src/app/api/auth/whoop/callback/route.ts`

- [ ] **Step 1: Write the OAuth start route**

Create `src/app/api/auth/whoop/start/route.ts`:

```ts
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = crypto.randomUUID();
  return NextResponse.redirect(buildAuthUrl(state));
}
```

- [ ] **Step 2: Write the OAuth callback route**

Create `src/app/api/auth/whoop/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/whoop";
import { saveRefreshToken } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code)
    return NextResponse.json({ error: "missing code" }, { status: 400 });

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveRefreshToken(tokens.refresh_token);
    return NextResponse.json({
      ok: true,
      message: "Whoop connected. You can close this tab.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/auth/whoop
git commit -m "feat: whoop oauth start + callback routes"
```

---

## Task 8: Daily cron route

**Files:**

- Create: `src/app/api/cron/daily/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/cron/daily/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday } from "@/lib/plan";
import { refreshAccessToken, fetchLatestRecovery } from "@/lib/whoop";
import { composeMessage } from "@/lib/message";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // Vercel cron sends a header `authorization: Bearer <CRON_SECRET>` when configured.
  // For Hobby tier without CRON_SECRET, we accept any GET, but log so we notice abuse.
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization");
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    // 1. Load plan
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));

    // 2. Determine today's weekday (in Europe/Zurich for stable behaviour)
    const todayDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
    );
    const weekday = todayDate.getDay();
    const todayPlan = pickToday(plan, weekday);

    // 3. Pull recovery
    const accessToken = await refreshAccessToken();
    const recoveryPct = await fetchLatestRecovery(accessToken);

    // 4. Compose + send
    const text = composeMessage(recoveryPct, todayPlan);
    await sendTelegram(text);

    return NextResponse.json({ ok: true, recoveryPct, sent: text });
  } catch (e) {
    const msg = String(e);
    // Best-effort: tell the user via Telegram that the cron broke
    try {
      await sendTelegram(`⚠️ training-coach cron error: ${msg.slice(0, 300)}`);
    } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/daily/route.ts
git commit -m "feat: daily cron route — pull recovery, compose, send"
```

---

## Task 9: Deploy to Vercel + first OAuth handshake

**Files:** none — this is the deployment + manual handshake task.

- [ ] **Step 1: Link the project to Vercel**

```bash
cd ~/training-coach
vercel link
```

Choose: existing or new scope, name: `training-coach`. Accept defaults.

- [ ] **Step 2: Add Vercel KV**

```bash
vercel env pull .env.local           # creates .env.local skeleton
# then in browser: https://vercel.com/dashboard → training-coach → Storage → Create → KV
```

After creating, click "Connect Project" → training-coach. Then:

```bash
vercel env pull .env.local
```

The file should now contain `KV_*` vars.

- [ ] **Step 3: Set remaining env vars in Vercel dashboard**

In Vercel project → Settings → Environment Variables, add (all environments):

- `WHOOP_CLIENT_ID` — from developer.whoop.com
- `WHOOP_CLIENT_SECRET` — from developer.whoop.com
- `WHOOP_REDIRECT_URI` — `https://training-coach-<your-handle>.vercel.app/api/auth/whoop/callback` (use the URL Vercel gives you)
- `TELEGRAM_BOT_TOKEN` — your existing GitHub Radar bot token
- `TELEGRAM_CHAT_ID` — your personal chat id
- `CRON_SECRET` — generate via `openssl rand -hex 32`

- [ ] **Step 4: Update Whoop app redirect URI**

In developer.whoop.com → your app → settings, add the production redirect URI from step 3 alongside the localhost one.

- [ ] **Step 5: Deploy**

```bash
vercel --prod
```

Expected: deployment URL printed. Visit it — should return Next's default 404 for `/`. That's fine; we have no homepage.

- [ ] **Step 6: One-time Whoop OAuth handshake**

Open in browser: `https://training-coach-<your-handle>.vercel.app/api/auth/whoop/start`

You'll be redirected to Whoop login → consent → back to `/api/auth/whoop/callback` which should respond with `{ "ok": true, "message": "Whoop connected. You can close this tab." }`.

- [ ] **Step 7: Manual cron trigger to verify end-to-end**

```bash
curl -H "authorization: Bearer $CRON_SECRET" \
  https://training-coach-<your-handle>.vercel.app/api/cron/daily
```

(Substitute the actual `CRON_SECRET` value from your Vercel env.)

Expected: JSON response `{ "ok": true, "recoveryPct": <some number>, "sent": "🟢 Recovery 78%. Today: ..." }` and the same text arrives in Telegram.

- [ ] **Step 8: Commit any final config changes and tag v0**

```bash
cd ~/training-coach
git add -A
git diff --cached --quiet || git commit -m "chore: vercel deployment configuration"
git tag v0
```

---

## Done When

- [ ] Tuesday 08:00 Zurich, your Telegram pings with a message that starts with `🟢/🟡/🔴 Recovery X%` and includes today's lift or run from `plan.yml`.
- [ ] You can re-run the cron manually with the curl command in Task 9 step 7 and it works.
- [ ] All unit tests pass (`npm test`).

If Tuesday morning the message does NOT arrive: check Vercel → Logs → Functions → `/api/cron/daily`. Most likely failure is OAuth token refresh — fix by re-running the OAuth handshake (Task 9 step 6).

---

## Out of Scope for v0 (these come in v1/v2)

- Green/yellow/red intensity multipliers actually changing the prescription text dynamically (currently hardcoded in message.ts — fine for v0; v1 will read multiplier from plan.yml `recovery_rules`)
- `/log`, `/skip`, `/swap` Telegram commands (v1)
- Obsidian markdown export (v1)
- Sunday weekly summary cron (v2)
- Sunday Claude Code planning ritual documentation (v2)
- Vercel cron heartbeat alerts (v2)
