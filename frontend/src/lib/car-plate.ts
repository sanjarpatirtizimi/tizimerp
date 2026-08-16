/** Uzbek plate: 2 raqam + 1 harf + 3 raqam + 2 harf (masalan 01A123AB). */
const PLATE_RE = /^\d{2}[A-ZА-ЯЁ]\d{3}[A-ZА-ЯЁ]{2}$/u;

export function normalizeCarPlate(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

export function isValidCarPlate(raw: string): boolean {
  if (!raw.trim()) return false;
  return PLATE_RE.test(normalizeCarPlate(raw));
}

export const CAR_PLATE_HINT = '01A123AB';
export const CAR_PLATE_HELP =
  '2 ta raqam, 1 ta harf, 3 ta raqam, 2 ta harf. Masalan: 01 A 123 AB';
