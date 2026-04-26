const RETRY_AFTER_CAP_MS = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryAfterMs(res: Response): Promise<number> {
  try {
    const body = await res.json();
    const seconds = Number(body?.parameters?.retry_after ?? 1);
    const wait = Number.isFinite(seconds) ? seconds * 1000 : 1000;
    return Math.min(wait, RETRY_AFTER_CAP_MS);
  } catch {
    return 1000;
  }
}

async function tgRequest(url: string, init: RequestInit): Promise<void> {
  let res = await fetch(url, init);

  if (res.status === 429) {
    await delay(await retryAfterMs(res));
    res = await fetch(url, init);
    if (res.status === 429) {
      throw new Error(`Telegram API ${res.status}: ${await res.text()}`);
    }
  }

  if (!res.ok) {
    throw new Error(`Telegram API ${res.status}: ${await res.text()}`);
  }
}

export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId)
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required");

  await tgRequest(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export interface InlineButton {
  text: string;
  callback_data: string;
}

export async function sendTelegramWithButtons(
  text: string,
  rows: InlineButton[][],
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId)
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required");
  await tgRequest(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: { inline_keyboard: rows },
    }),
  });
}

export async function answerCallback(
  callbackId: string,
  text?: string,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await tgRequest(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text: text ?? "" }),
  });
}
