import { en } from "./en.ts";
import { ka } from "./ka.ts";

export type Language = "en" | "ka";
export type TranslationKey = keyof typeof en;

export const LANGUAGES: { code: Language; name: string; locale: string }[] = [
  { code: "en", name: "English", locale: "en-GB" },
  { code: "ka", name: "ქართული", locale: "ka-GE" },
];

const STORAGE_KEY = "dalaki.language";
const DICTIONARIES: Record<Language, Record<TranslationKey, string>> = { en, ka };

function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "ka";
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

let current: Language = readStoredLanguage();
if (typeof document !== "undefined") {
  document.documentElement.lang = current;
}

export function getLanguage(): Language {
  return current;
}

export function getLocale(): string {
  return LANGUAGES.find((language) => language.code === current)?.locale ?? "en-GB";
}

export function storeLanguage(language: Language) {
  current = language;
  document.documentElement.lang = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Without storage the choice simply lasts until the page is reloaded.
  }
}

export function t(key: TranslationKey, values: Record<string, string | number> = {}): string {
  const text = DICTIONARIES[current][key];
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
