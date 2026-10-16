import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignLine, escapeHtml, finalReportMessage, formatDateTime, newCampaignMessage, resultMessage } from "./messages.js";

const TZ = "Asia/Tashkent";
const at = new Date("2026-10-17T09:00:00Z"); // Toshkentda 14:00

test("HTML belgilar ekranlanadi (Telegram parse_mode=HTML buzilmasligi uchun)", () => {
  assert.equal(escapeHtml("A & <b>"), "A &amp; &lt;b&gt;");
});

test("sana va vaqt tashkilot vaqt mintaqasida, o'zbekcha oy nomi bilan", () => {
  assert.equal(formatDateTime(at, TZ), "17-oktabr, 14:00");
  assert.equal(formatDateTime(at, "UTC"), "17-oktabr, 09:00");
});

test("topshiriq qatori: turi, nomi, vaqti, joyi", () => {
  const line = campaignLine({ kind: "MEETING", title: "Hokimiyatda <yig'ilish>", scheduledAt: at, location: "Majlislar zali" }, TZ);
  assert.equal(line, "Yig'ilish: Hokimiyatda &lt;yig'ilish&gt; · 17-oktabr, 14:00 · Majlislar zali");
});

test("natija xabari: yordam bergan xodim va izoh ko'rsatiladi", () => {
  const text = resultMessage({
    status: "NO_ANSWER",
    mahallaName: "Chashtepa",
    chairmanName: "Rais",
    callerName: "Ramazon",
    assigneeName: "Diyorbek",
    note: "rais kasalxonada",
    reached: 5,
    total: 30,
    at,
    timeZone: TZ,
  });
  assert.match(text, /^<b>Ko'tarmadi<\/b> — Chashtepa MFY/);
  assert.match(text, /Xodim: Ramazon \(Diyorbek o'rniga\), 14:00/);
  assert.match(text, /Izoh: rais kasalxonada/);
  assert.match(text, /5 \/ 30/);
});

test("natija xabari: o'z MFY'si bo'lsa 'o'rniga' yozilmaydi", () => {
  const text = resultMessage({
    status: "REACHED", mahallaName: "A", chairmanName: "R", callerName: "Ramazon", assigneeName: "Ramazon", reached: 1, total: 2, at, timeZone: TZ,
  });
  assert.doesNotMatch(text, /o'rniga/);
  assert.doesNotMatch(text, /Izoh/);
});

test("yakuniy hisobot: xodimlar bo'yicha, izohlar va yordam berganlar bilan", () => {
  const ramazon = { id: "r", fullName: "Ramazon" };
  const diyor = { id: "d", fullName: "Diyorbek" };
  const text = finalReportMessage(
    { kind: "EVENT", title: "Tadbir", scheduledAt: at },
    [
      { status: "REACHED", mahalla: { name: "A" }, assignedTo: ramazon, calledBy: ramazon },
      { status: "NO_ANSWER", note: "boshqa raqam", mahalla: { name: "B" }, assignedTo: ramazon, calledBy: ramazon },
      { status: "REACHED", mahalla: { name: "C" }, assignedTo: diyor, calledBy: ramazon },
      { status: "PENDING", mahalla: { name: "D" }, assignedTo: null },
    ],
    TZ,
  );
  assert.match(text, /Tadbir: Tadbir · 17-oktabr, 14:00/);
  assert.match(text, /Bog'lanildi: <b>2 \/ 4<\/b>/);
  assert.match(text, /<b>Ramazon<\/b> — 1 \/ 2\n {2}B — ko'tarmadi \(boshqa raqam\)/);
  assert.match(text, /<b>Biriktirilmagan<\/b> — 0 \/ 1\n {2}D — qo'ng'iroq qilinmagan/);
  assert.match(text, /<b>Yordam berganlar<\/b>\nRamazon — 1 ta MFY/);
  assert.doesNotMatch(text, / {2}A —/);
});

test("xodimga yangi topshiriq xabari", () => {
  const text = newCampaignMessage({ kind: "MEETING", title: "Hokimiyatda", description: "Hammasi kelsin", scheduledAt: at, location: "Zal" }, 10, TZ);
  assert.match(text, /^<b>Yig'ilish: Hokimiyatda<\/b>\n17-oktabr, 14:00 · Zal/);
  assert.match(text, /Hammasi kelsin/);
  assert.match(text, /Sizga 10 ta MFY biriktirilgan/);
});
