export interface Phone {
  display: string;
  tel: string;
}

// Rais telefoni maydonida ba'zan bir nechta raqam yoki ortiqcha belgilar bo'ladi
// ("90-127-00-93," yoki "97-751-31-05   90 093-31-05"). Har birini alohida, +998 bilan qaytaramiz —
// aks holda telefon 9 xonali raqamni noto'g'ri terishi mumkin.
export function parsePhones(raw: string): Phone[] {
  const result: Phone[] = [];
  for (const part of raw.split(/[,;/]|\s{2,}/)) {
    const digits = part.replace(/\D/g, "");
    let national: string | null = null;
    if (digits.length === 9) national = digits;
    else if (digits.length === 12 && digits.startsWith("998")) national = digits.slice(3);
    if (national) {
      result.push({
        display: `${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5, 7)} ${national.slice(7)}`,
        tel: `+998${national}`,
      });
    } else if (digits.length >= 5) {
      result.push({ display: part.trim(), tel: digits });
    }
  }
  return result;
}
