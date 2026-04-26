# Sunday Claude Code Ritual

Every Sunday at 18:00 Zurich, you'll receive a weekly summary on Telegram. Use it to plan next week.

## Steps

1. Open Claude Code from your terminal:

   ```bash
   cd ~/training-coach
   claude
   ```

2. Paste this prompt (one-time, save as a snippet):

   > Read this week's summary I'll paste below + the current `plan.yml`. Generate next week's `plan.yml` respecting:
   >
   > - Mon/Wed/Fri: lift days, body-part rotation (chest+arms, legs, pull/back)
   > - Tue/Thu: run days, alternating between Z2 (45 min easy) and Z3 intervals
   > - Apply progressive overload: if last week's RPE notes show "easy" or "could do more", increase weight 2.5kg or add a set; if "tough" or "could not finish", keep volume the same
   > - Lunchtime sessions, ~1 hour, indoor gym + outdoor running
   >   Output ONLY the new plan.yml file content — no commentary.

3. Paste the Telegram weekly summary into the chat.

4. Claude writes new `plan.yml`. Review the diff:

   ```bash
   git diff plan.yml
   ```

5. If it looks good, commit + push:

   ```bash
   git add plan.yml
   git commit -m "plan: week of $(date -v-mon -j +%Y-%m-%d)"
   git push
   ```

6. Vercel auto-deploys within ~30s. Monday 08:00 your cron will use the new plan.

## Time investment

10 minutes per week. The deterministic green/yellow/red intensity rules in the daily cron handle in-week reactivity automatically.

## If you skip the ritual

The cron will fall back to last week's plan.yml. After ~14 days of staleness, it'll add a "plan.yml is 14+ days old" warning to the morning Telegram.
