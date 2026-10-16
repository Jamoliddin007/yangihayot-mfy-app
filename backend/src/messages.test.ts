import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, finalReportMessage, resultMessage } from "./messages.js";

test("HTML belgilar ekranlanadi (Telegram parse_mode=HTML buzilmasligi uchun)", () => {
  assert.equal(escapeHtml("A & <b>"), "A &amp; &lt;b&gt;");
});

test("natija xabari: holat, MFY, rais, xodim va umumiy son", () => {
  const text = resultMessage({
    status: "REACHED",
    mahallaName: "Chashtepa",
    chairmanName: "Rais <Ism>",
    employeeName: "Ramazon",
    reached: 5,
    total: 30,
    at: new Date("2026-10-16T04:42:00Z"),
  });
  assert.match(text, /^<b>Bog'landi<\/b> — Chashtepa MFY/);
  assert.match(text, /Rais &lt;Ism&gt;/);
  assert.match(text, /Ramazon, 09:42/); // Toshkent vaqti (UTC+5)
  assert.match(text, /5 \/ 30/);
});

test("yakuniy hisobot xodimlar bo'yicha guruhlanadi, bog'lanilganlar ro'yxatga kirmaydi", () => {
  const text = finalReportMessage("Yig'ilish", [
    { status: "REACHED", mahalla: { name: "A" }, assignedTo: { fullName: "Ramazon" } },
    { status: "NO_ANSWER", mahalla: { name: "B" }, assignedTo: { fullName: "Ramazon" } },
    { status: "PENDING", mahalla: { name: "C" }, assignedTo: null },
  ]);
  assert.match(text, /Bog'lanildi: <b>1 \/ 3<\/b>/);
  assert.match(text, /<b>Ramazon<\/b> — 1 \/ 2\n {2}B — ko'tarmadi/);
  assert.match(text, /<b>Biriktirilmagan<\/b> — 0 \/ 1\n {2}C — qo'ng'iroq qilinmagan/);
  assert.doesNotMatch(text, / {2}A —/);
});
