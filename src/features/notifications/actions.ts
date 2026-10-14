"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  deletePushSubscription,
  getPushSubscription,
  REMINDER_KINDS,
  saveReminders,
  savePushSubscription,
  setRestAlarm,
} from "@/data/notifications";
import type { ActionResult } from "@/lib/action-result";
import { getPushConfig } from "@/lib/push/config";
import { buildPayload, sendPush } from "@/lib/push/send";
import { runAction } from "@/lib/run-action";
import {
  endpointSchema,
  pushSubscriptionSchema,
  remindersSchema,
  type PushSubscriptionJson,
  type RemindersFormValues,
} from "./schemas";

/** Enregistre l'abonnement de cet appareil (aussi appelé à chaque ouverture, pour le garder actif). */
export async function savePushSubscriptionAction(
  input: PushSubscriptionJson,
): Promise<ActionResult<string>> {
  return runAction(pushSubscriptionSchema, input, async ({ endpoint, keys }) => {
    await savePushSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
  });
}

export async function deletePushSubscriptionAction(
  endpoint: string,
): Promise<ActionResult<string>> {
  return runAction(endpointSchema, endpoint, async (value) => {
    await deletePushSubscription(value);
  });
}

/** Envoie tout de suite une notification d'essai à cet appareil. */
export async function testPushAction(endpoint: string): Promise<ActionResult<string>> {
  return runAction(endpointSchema, endpoint, async (value) => {
    const config = getPushConfig();
    if (!config) return { ok: false, formError: "pushNotConfigured" };
    const target = await getPushSubscription(value);
    if (!target) return { ok: false, formError: "pushNotSubscribed" };
    const outcome = await sendPush(config, target, "test", await buildPayload("test"));
    if (outcome === "gone") {
      await deletePushSubscription(value);
      return { ok: false, formError: "pushNotSubscribed" };
    }
    if (outcome === "failed") return { ok: false, formError: "pushFailed" };
  });
}

/**
 * Essai complet de la fin de repos : une vraie alarme dans 10 secondes, qui
 * passe par la planification de Supabase (comme pendant une séance).
 */
export async function testRestAlarmAction(): Promise<ActionResult<string>> {
  return runAction(z.undefined(), undefined, async () => {
    if (!getPushConfig()) return { ok: false, formError: "pushNotConfigured" };
    await setRestAlarm({ seconds: 10, detail: null, url: "/profile/notifications", test: true });
  });
}

export async function saveRemindersAction(
  input: RemindersFormValues,
): Promise<ActionResult<string>> {
  return runAction(remindersSchema, input, async (values) => {
    await saveReminders(REMINDER_KINDS.map((kind) => ({ kind, ...values[kind] })));
    revalidatePath("/profile/notifications");
  });
}
