import "server-only";
import { getTranslations } from "next-intl/server";
import webpush from "web-push";
import type { PushConfig } from "./config";
import { PUSH_DEFAULT_URL, PUSH_OPTIONS, type PushKind, type PushPayload } from "./payload";

export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** Texte de la notification, traduit (messages/fr.json, namespace Push). */
export async function buildPayload(
  kind: PushKind,
  detail?: string | null,
  url?: string | null,
): Promise<PushPayload> {
  const t = await getTranslations({ locale: "fr", namespace: "Push" });
  return {
    title: t(`${kind}.title`),
    body: detail ? t(`${kind}.bodyWithDetail`, { detail }) : t(`${kind}.body`),
    url: url ?? PUSH_DEFAULT_URL[kind],
    tag: `elan-${kind}`,
  };
}

export type SendOutcome = "sent" | "gone" | "failed";

/**
 * Envoie une notification. « gone » : l'abonnement n'existe plus (application
 * désinstallée, autorisation retirée) et peut être oublié.
 */
export async function sendPush(
  config: PushConfig,
  target: PushTarget,
  kind: PushKind,
  payload: PushPayload,
): Promise<SendOutcome> {
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
        TTL: PUSH_OPTIONS[kind].ttl,
        urgency: PUSH_OPTIONS[kind].urgency,
        timeout: 8000,
      },
    );
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.error("[push] send failed", { status: status ?? null });
    return "failed";
  }
}
