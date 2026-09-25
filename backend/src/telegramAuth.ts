import crypto from "node:crypto";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface ValidatedInitData {
  user: TelegramUser;
  authDate: number;
}

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

// Telegram WebApp initData validation: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function validateInitData(initData: string, botToken: string): ValidatedInitData | null {
  if (!initData) return null;

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  if (!hash) return null;
  urlParams.delete("hash");

  const pairs: string[] = [];
  for (const [key, value] of urlParams.entries()) {
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (calculatedHash !== hash) return null;

  const authDate = Number(urlParams.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) return null;

  const userRaw = urlParams.get("user");
  if (!userRaw) return null;

  const user: TelegramUser = JSON.parse(userRaw);
  return { user, authDate };
}
