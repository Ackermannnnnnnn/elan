import type messages from "../../messages/fr.json";
import type { Locale } from "@/i18n/config";

// Rend les clés de traduction vérifiées à la compilation : une clé absente de
// messages/fr.json est une erreur TypeScript.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
