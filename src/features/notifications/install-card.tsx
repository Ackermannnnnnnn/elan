"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  clearInstallPrompt,
  INSTALL_READY_EVENT,
  isIos,
  isStandalone,
  takeInstallPrompt,
} from "./push-client";

type State = "loading" | "installed" | "prompt" | "ios" | "manual";

const detect = (): State =>
  isStandalone() ? "installed" : takeInstallPrompt() ? "prompt" : isIos() ? "ios" : "manual";

/** Installer Élan sur l'écran d'accueil (application web installable, gratuite). */
export function InstallCard() {
  const t = useTranslations("Notifications.install");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setState(detect()));
    const refresh = () => setState(detect());
    const onInstalled = () => setState("installed");
    window.addEventListener(INSTALL_READY_EVENT, refresh);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(INSTALL_READY_EVENT, refresh);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (state === "loading") return <p className="text-muted-foreground">{t("checking")}</p>;
  if (state === "installed") {
    return (
      <p role="status" className="font-medium text-success">
        {t("installed")}
      </p>
    );
  }
  if (state === "prompt") {
    return (
      <Button
        type="button"
        className="self-start"
        onClick={async () => {
          const prompt = takeInstallPrompt();
          if (!prompt) return setState(detect());
          await prompt.prompt();
          const choice = await prompt.userChoice;
          clearInstallPrompt();
          setState(choice.outcome === "accepted" ? "installed" : detect());
        }}
      >
        <Download aria-hidden="true" />
        {t("button")}
      </Button>
    );
  }
  return <p className="text-muted-foreground">{state === "ios" ? t("ios") : t("manual")}</p>;
}
