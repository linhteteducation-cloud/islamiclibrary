const URDU_SPECIFIC_REGEX =
  /[\u0679\u067E\u0686\u0688\u0691\u0698\u06A9\u06AF\u06BA\u06BE\u06C1-\u06C3\u06CC\u06D2\u06D3\u06F0-\u06F9]/;
const ARABIC_SCRIPT_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const MYANMAR_SCRIPT_REGEX = /[\u1000-\u109F\uA9E0-\uA9FF\uAA60-\uAA7F]/;

export type DetectedArabicUrduScript = 'urdu' | 'arabic' | 'myanmar' | null;

export function detectArabicOrUrduScript(text: string): DetectedArabicUrduScript {
  if (!text) return null;
  if (URDU_SPECIFIC_REGEX.test(text)) {
    return 'urdu';
  }
  if (ARABIC_SCRIPT_REGEX.test(text)) {
    return 'arabic';
  }
  if (MYANMAR_SCRIPT_REGEX.test(text)) {
    return 'myanmar';
  }
  return null;
}

export function getScriptFontClass(text: string): string {
  const script = detectArabicOrUrduScript(text);
  if (script === 'urdu') return 'font-urdu';
  if (script === 'arabic') return 'font-arabic';
  if (script === 'myanmar') return 'font-myanmar';
  return '';
}
