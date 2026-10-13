import { getRequestConfig } from "next-intl/server";
import { defaultLocale, defaultTimeZone } from "./config";

// Une seule langue pour l'instant : la locale est fixe, ce qui laisse les pages
// entièrement pré-rendues. Avec plusieurs langues, elle sera lue ici depuis le
// profil de l'utilisateur ou un cookie.
export default getRequestConfig(async () => {
  const locale = defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return { locale, messages, timeZone: defaultTimeZone };
});
