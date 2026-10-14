"use client";

import { BellOff, BellRing, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  deletePushSubscriptionAction,
  savePushSubscriptionAction,
  testPushAction,
} from "./actions";
import {
  currentSubscription,
  markDeviceSubscribed,
  pushSupport,
  type PushSupport,
  restAlarmPreference,
  setRestAlarmPreference,
  subscribeDevice,
  unsubscribeDevice,
} from "./push-client";

type State =
  | { kind: "loading" }
  | { kind: PushSupport | "denied" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

/** Activer / couper les notifications sur CET appareil, et envoyer un essai. */
export function PushDeviceCard() {
  const t = useTranslations("Notifications.device");
  const messages = useFormMessages();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [rest, setRest] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const support = pushSupport();
      const next: State =
        support !== "supported"
          ? { kind: support }
          : Notification.permission === "denied"
            ? { kind: "denied" }
            : await currentSubscription().then((subscription) =>
                subscription && Notification.permission === "granted"
                  ? { kind: "on", endpoint: subscription.endpoint }
                  : { kind: "off" },
              );
      if (!cancelled) {
        setState(next);
        setRest(restAlarmPreference());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      try {
        const subscription = await subscribeDevice();
        if (!subscription) {
          setState(Notification.permission === "denied" ? { kind: "denied" } : { kind: "off" });
          return;
        }
        const result = await savePushSubscriptionAction(subscription.toJSON() as never);
        if (!result.ok) {
          markDeviceSubscribed(false);
          setError(result.formError ?? "generic");
          return;
        }
        setState({ kind: "on", endpoint: subscription.endpoint });
      } catch {
        setError("pushFailed");
      }
    });

  const disable = () =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const endpoint = await unsubscribeDevice();
      if (endpoint) await deletePushSubscriptionAction(endpoint);
      setState({ kind: "off" });
    });

  const test = (endpoint: string) =>
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await testPushAction(endpoint);
      if (result.ok) setNotice(t("testSent"));
      else setError(result.formError ?? "generic");
    });

  if (state.kind === "loading") {
    return <p className="text-muted-foreground">{t("checking")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {state.kind === "notConfigured" ? <Alert>{t("notConfigured")}</Alert> : null}
      {state.kind === "unsupported" ? <Alert>{t("unsupported")}</Alert> : null}
      {state.kind === "iosInstall" ? <Alert>{t("iosInstall")}</Alert> : null}
      {state.kind === "denied" ? <Alert variant="error">{t("denied")}</Alert> : null}

      {state.kind === "off" ? (
        <>
          <p className="text-muted-foreground">{t("offText")}</p>
          <Button type="button" onClick={enable} disabled={pending} className="self-start">
            <BellRing aria-hidden="true" />
            {pending ? t("enabling") : t("enable")}
          </Button>
        </>
      ) : null}

      {state.kind === "on" ? (
        <>
          <p role="status" className="font-medium text-success">
            {t("onText")}
          </p>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-primary"
              checked={rest}
              onChange={(event) => {
                setRest(event.target.checked);
                setRestAlarmPreference(event.target.checked);
              }}
            />
            <span>
              <span className="block font-semibold">{t("rest")}</span>
              <span className="block text-sm text-muted-foreground">{t("restHint")}</span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => test(state.endpoint)}
              disabled={pending}
            >
              <Send aria-hidden="true" />
              {t("test")}
            </Button>
            <Button type="button" variant="ghost" onClick={disable} disabled={pending}>
              <BellOff aria-hidden="true" />
              {t("disable")}
            </Button>
          </div>
        </>
      ) : null}

      {notice ? (
        <p role="status" className="text-sm font-medium text-success">
          {notice}
        </p>
      ) : null}
      {error ? <Alert variant="error">{messages.error(error)}</Alert> : null}
    </div>
  );
}
