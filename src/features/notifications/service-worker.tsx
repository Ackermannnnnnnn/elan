"use client";

import { useEffect } from "react";
import { savePushSubscriptionAction } from "./actions";
import { currentSubscription, markDeviceSubscribed } from "./push-client";

const SYNC_KEY = "elan.push.synced";
const DAY = 86_400_000;

/**
 * Installe le service worker (application installable, notifications) et,
 * au plus une fois par jour, signale au serveur que l'abonnement de cet
 * appareil est toujours actif. Ne rend rien.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let cancelled = false;
    const run = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      } catch {
        return;
      }
      const subscription = await currentSubscription();
      if (cancelled) return;
      if (!subscription || Notification.permission !== "granted") {
        markDeviceSubscribed(false);
        return;
      }
      markDeviceSubscribed(true);
      let last = 0;
      try {
        last = Number(window.localStorage.getItem(SYNC_KEY) ?? 0);
      } catch {
        // Sans stockage, on resynchronise à chaque ouverture : sans conséquence.
      }
      if (Date.now() - last < DAY) return;
      const result = await savePushSubscriptionAction(subscription.toJSON() as never);
      if (result.ok) {
        try {
          window.localStorage.setItem(SYNC_KEY, String(Date.now()));
        } catch {
          // idem
        }
      }
    };
    // Après l'affichage : ne ralentit pas l'ouverture de la page.
    const timer = window.setTimeout(() => void run(), 1500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);
  return null;
}
