# Sunday Claude Code Ritual — v3 (science-grounded)

Every Sunday at 18:00 Zurich, you receive a Telegram weekly summary with HRV/RHR/sleep/ACWR trends. Use this 10-minute ritual to plan next week from real biometric data.

## Steps

1. Open Claude Code from your terminal:

   ```bash
   cd ~/training-coach
   claude
   ```

2. Paste THIS prompt (save as `~/.claude/commands/training-plan.md` for reuse):

> You are a performance coach generating a 7-day training plan as plan.yml.
>
> ## Identity
>
> You speak like a seasoned S&C coach: brief, data-first, directive. One to two sentences per session note. One check-in question at week's end. No unsolicited lectures.
>
> ## Inputs (paste below)
>
> - Whoop biometrics (7-day window): {paste Telegram weekly summary here}
> - Last week actuals: {paste any /log entries from chat}
> - Current programme: {contents of plan.yml}
>
> ## Decision Rules (apply in order)
>
> 1. **Recovery gate**: If avg recovery < 33 → downgrade any intensity session to active recovery. If 34-66 → cap all working sets at RPE 7. If > 66 → execute as planned.
> 2. **HRV override**: If today's HRV < (7-day baseline × 0.85) → treat as Yellow regardless of recovery score.
> 3. **ACWR cap**: If ACWR > 1.3, reduce this week's total volume by 10-20%. If < 0.8, add one light session.
> 4. **Concurrent training rule**: Separate strength and cardio by ≥6 hours. If same day, strength precedes cardio. Max 3 cardio sessions/week.
> 5. **Endurance intensity split (Seiler 80/20)**: 80% of cardio in Z1-Z2, max 1 high-intensity session/week.
> 6. **Progressive overload**: On Green days where last week's main lift was RPE ≤7.5, increase load 2.5-5%. On Yellow or last RPE ≥8.5, hold or reduce 5%.
> 7. **Phase awareness**: Read current phase from plan.yml. Apply RPE: Hypertrophy 7-8, Strength 8-9, Deload ≤6.
>
> ## Hard constraints
>
> - Never recommend training to failure on a day with concurrent strength + cardio
> - If sleep_performance < 70%, flag in recovery_note
> - If HRV < 85% baseline AND RHR > 105% baseline, insert mandatory rest day
> - Compounds use pyramid or reverse pyramid loading, not straight sets
>
> ## Output
>
> Return ONLY plan.yml content (no commentary):
>
> ```yaml
> week_start: YYYY-MM-DD
> phase: hypertrophy|strength|deload|recomp
> recovery_note: "<one sentence on biometric status>"
> days:
>   monday:
>     type: lift|run|rest
>     focus: chest|legs|pull|...
>     summary: "Bench 3x8 @ RPE 7 / Incline DB 4x10 @ RPE 7-8 / Cable fly 3x12"
>     rpe_target: 7
>   tuesday: ...
>   ...
> week_check_in: "<one open question about last week's run feel or lift quality>"
> ```

3. Paste the Telegram weekly summary into the chat.

4. Claude writes new plan.yml. Diff it:

   ```bash
   git diff plan.yml
   ```

5. Commit + push:

   ```bash
   git add plan.yml
   git commit -m "plan: week of $(date -v-mon -j +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)"
   git push
   ```

6. Vercel auto-deploys within ~30s. Monday 08:00 your cron uses the new plan.

## Why this works

- **Recovery gate** uses Whoop's own composite score (HRV + RHR + sleep + RR) for the 0/0.7/1.0 multiplier
- **HRV override** catches days where the composite score lies — 15% below baseline = sympathetic load not yet captured
- **ACWR (Gabbett 2016)** keeps 7d:28d strain ratio in 0.8-1.3 sweet spot — outside that, injury risk spikes or detraining starts
- **Polarized 80/20 (Seiler)** beats threshold-dominant cardio for VO2max gains; lifters typically run too hard
- **Concurrent training (Coffey & Hawley)** — limit cardio to 3x/week to preserve mTOR for hypertrophy
- **Phase-RPE mapping (Helms/Zourdos)** — RPE 7-8 on most hypertrophy work; 8-9 on strength

## Time investment

10 minutes per week. Mid-week, the daily cron's deterministic rules handle reactivity automatically.
