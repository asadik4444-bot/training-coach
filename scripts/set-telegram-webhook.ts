// Run once after deploy:
// node --env-file=.env.local --experimental-strip-types scripts/set-telegram-webhook.ts

export {};

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("Error: TELEGRAM_BOT_TOKEN is not set");
  process.exit(1);
}

const webhookUrl = "https://training-coach-phi.vercel.app/api/telegram/webhook";

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ url: webhookUrl }),
});

const body = (await res.json()) as { ok: boolean; description?: string };

if (res.ok && body.ok) {
  console.log("Webhook set successfully:", body.description ?? "OK");
} else {
  console.error("Failed to set webhook:", JSON.stringify(body));
  process.exit(1);
}
