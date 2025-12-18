import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Language = "en" | "vi";

const translations: Record<Language, any> = {
  en: {},
  vi: {},
};

// Load translation files
const loadTranslations = () => {
  try {
    const languagesDir = path.join(__dirname, "../languages");
    translations.en = JSON.parse(
      fs.readFileSync(path.join(languagesDir, "en.json"), "utf-8")
    );
    translations.vi = JSON.parse(
      fs.readFileSync(path.join(languagesDir, "vi.json"), "utf-8")
    );
  } catch (error) {
    console.error("Error loading translations:", error);
  }
};

loadTranslations();

export const getTranslation = (
  lang: Language,
  key: string,
  defaultValue: string = ""
): string => {
  const keys = key.split(".");
  let value: any = translations[lang] || translations.en;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      return defaultValue || key;
    }
  }

  return typeof value === "string" ? value : defaultValue || key;
};

export const detectLanguage = (req: any): Language => {
  const lang =
    req.query.lang ||
    req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ||
    "en";
  return ["en", "vi"].includes(lang) ? (lang as Language) : "en";
};

export default { getTranslation, detectLanguage };


