"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { recalculateTargetsAction } from "./actions";

/** Propose de recalculer les besoins quand le poids a nettement changé. Rien n'est modifié sans accord. */
export function RecalculateNotice({ delta }: { delta: string }) {
  const t = useTranslations("Home.recalculate");
  const messages = useFormMessages();
  const [status, setStatus] = useState<"idle" | "done" | { error: string }>("idle");
  const [pending, startTransition] = useTransition();

  if (status === "done") return <Alert variant="success">{t("done")}</Alert>;

  return (
    <Alert variant="info">
      <p>{t("message", { delta })}</p>
      {typeof status === "object" ? (
        <p className="mt-2 text-destructive">{messages.error(status.error)}</p>
      ) : null}
      <Button
        size="sm"
        className="mt-3"
        aria-disabled={pending}
        onClick={() => {
          if (pending) return;
          startTransition(async () => {
            const result = await recalculateTargetsAction();
            setStatus(result.ok ? "done" : { error: result.formError ?? "generic" });
          });
        }}
      >
        {pending ? t("pending") : t("action")}
      </Button>
    </Alert>
  );
}
