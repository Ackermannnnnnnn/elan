import "server-only";

/**
 * Configuration des notifications (Web Push, gratuit). Trois variables côté
 * serveur + une publique ; sans elles, l'application l'indique clairement et
 * n'envoie rien. Elles se génèrent avec `npm run push:setup` (docs/NOTIFICATIONS.md).
 */
export type PushConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
  /** Secret partagé avec Supabase (coffre « elan_push_secret ») pour appeler /api/push. */
  secret: string | null;
};

export function getPushConfig(): PushConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  const subject = process.env.VAPID_SUBJECT || "mailto:contact@example.com";
  const secret = process.env.PUSH_SECRET;
  return { publicKey, privateKey, subject, secret: secret && secret.length >= 32 ? secret : null };
}
