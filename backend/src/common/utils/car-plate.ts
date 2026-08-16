/** Uzbek plate: 2 digits + 1 letter + 3 digits + 2 letters (e.g. 01A123AB). */
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
