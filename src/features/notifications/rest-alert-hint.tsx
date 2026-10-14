"use client";

import { BellRing, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { ROUTES } from "@/config/routes";
import { pushSupport, restAlarmEnabled, restAlarmPreference } from "./push-client";

const DISMISS_KEY = "elan.push.hint";

/**
 * Pendant une séance : si la fin de repos ne peut pas arriver téléphone
 * verrouillé (notifications non activées sur cet appareil), on le dit, une
 * fois, avec le lien pour les activer. Le minuteur à l'écran sonne de toute façon.
 */
export function RestAlertHint() {
  const t = useTranslations("Notifications.hint");
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Après la vérification d'abonnement au chargement (voir ServiceWorkerRegistrar).
    const timer = window.setTimeout(() => {
      let dismissed = false;
      try {
        dismissed = window.localStorage.getItem(DISMISS_KEY) === "0";
      } catch {
        // Sans stockage : on affiche le conseil.
      }
      const support = pushSupport();
      setShow(
        !dismissed && support !== "unsupported" && restAlarmPreference() && !restAlarmEnabled(),
      );
    }, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  if (!show) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-control bg-primary-soft px-4 py-3 text-sm text-primary-soft-foreground">
      <BellRing aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">
        {t("text")}{" "}
        <Link href={ROUTES.notifications} className="font-semibold underline underline-offset-4">
          {t("link")}
        </Link>
      </p>
      <button
        type="button"
        aria-label={t("dismiss")}
        className="-m-1 rounded-control p-1 hover:bg-black/5"
        onClick={() => {
          try {
            window.localStorage.setItem(DISMISS_KEY, "0");
          } catch {
            // Sans stockage : masqué pour cette visite seulement.
          }
          setShow(false);
        }}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
