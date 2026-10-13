/** Langues disponibles. Pour en ajouter une : créer messages/<code>.json et l'ajouter ici. */
export const locales = ["fr"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Fuseau par défaut pour le formatage des dates côté serveur. */
export const defaultTimeZone = "Europe/Brussels";
