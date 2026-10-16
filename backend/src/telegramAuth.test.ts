import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validateInitData } from "./telegramAuth.js";

const BOT_TOKEN = "123456:TEST_TOKEN";

// Telegram'ning o'zi qanday imzolasa, testda ham shunday imzolangan initData yasaymiz
function signInitData(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dataCheckString = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = () => String(Math.floor(Date.now() / 1000));
const user = JSON.stringify({ id: 42, first_name: "Ali" });

test("to'g'ri imzolangan initData qabul qilinadi", () => {
  const result = validateInitData(signInitData({ auth_date: now(), user }), BOT_TOKEN);
  assert.equal(result?.user.id, 42);
});

test("boshqa bot token bilan imzolangan initData rad etiladi", () => {
  const initData = signInitData({ auth_date: now(), user }, "999:OTHER");
  assert.equal(validateInitData(initData, BOT_TOKEN), null);
});

test("o'zgartirilgan (soxtalashtirilgan) user rad etiladi", () => {
  const initData = signInitData({ auth_date: now(), user });
  const tampered = initData.replace("42", "43");
  assert.equal(validateInitData(tampered, BOT_TOKEN), null);
});

test("24 soatdan eski initData rad etiladi", () => {
  const old = String(Math.floor(Date.now() / 1000) - 25 * 60 * 60);
  assert.equal(validateInitData(signInitData({ auth_date: old, user }), BOT_TOKEN), null);
});

test("hash yo'q yoki noto'g'ri formatda bo'lsa rad etiladi", () => {
  assert.equal(validateInitData(`auth_date=${now()}&user=${encodeURIComponent(user)}`, BOT_TOKEN), null);
  assert.equal(validateInitData(`auth_date=${now()}&hash=zz`, BOT_TOKEN), null);
  assert.equal(validateInitData("", BOT_TOKEN), null);
});
