/**
 * Cookie de confort indiquant que l'onboarding est terminé sur ce navigateur.
 * Il évite d'interroger la base à chaque navigation pour savoir où envoyer
 * l'utilisateur. Ce n'est PAS une protection : sans lui, `proxy.ts` vérifie en
 * base, et l'accès aux données reste gardé par la session et la RLS.
 */
export const ONBOARDED_COOKIE = "elan_onboarded";

export const ONBOARDED_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;
