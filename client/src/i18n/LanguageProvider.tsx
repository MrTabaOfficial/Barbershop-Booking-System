import { createContext, type ReactNode, useContext, useState } from "react";
import { getLanguage, type Language, storeLanguage } from "./index.ts";

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void };

const LanguageContext = createContext<LanguageContextValue>({
  language: getLanguage(),
  setLanguage: storeLanguage,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState(getLanguage);

  function setLanguage(next: Language) {
    storeLanguage(next);
    setLanguageState(next);
  }

  return <LanguageContext value={{ language, setLanguage }}>{children}</LanguageContext>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
