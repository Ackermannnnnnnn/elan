"use client";

import { CalendarClock, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

export type MoveTarget = {
  date: string;
  /** Libellé court (« jeu. 15 ») et libellé complet pour les lecteurs d'écran. */
  short: string;
  long: string;
  action: () => Promise<ActionResult<string>>;
};

/**
 * Déplacer une séance depuis le planning, en deux gestes : « Déplacer », puis
 * le jour. « Autre date » ouvre le choix complet.
 */
export function QuickMove({
  name,
  targets,
  moreHref,
}: {
  name: string;
  targets: readonly MoveTarget[];
  moreHref: string;
}) {
  const t = useTranslations("Training.quickMove");
  const messages = useFormMessages();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelId = useId();

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t("open", { name })}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}
        {t("move")}
      </Button>
      {open ? (
        <span
          id={panelId}
          role="group"
          aria-label={t("choose", { name })}
          className="flex w-full flex-wrap gap-1.5"
        >
          {targets.map((target) => (
            <button
              key={target.date}
              type="button"
              disabled={pending}
              aria-label={t("to", { name, date: target.long })}
              onClick={() => {
                setError(null);
                setPendingDate(target.date);
                startTransition(async () => {
                  const result = await target.action();
                  if (result && !result.ok) setError(result.formError ?? "generic");
                  setPendingDate(null);
                });
              }}
              className="min-h-10 rounded-full border border-border-strong bg-surface px-3.5 text-sm font-medium first-letter:uppercase hover:border-primary/60 disabled:opacity-55"
            >
              {pendingDate === target.date ? "…" : target.short}
            </button>
          ))}
          <Link
            href={moreHref}
            className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("other")}
          </Link>
          {error ? (
            <span role="alert" className="w-full text-sm font-medium text-destructive">
              {messages.error(error)}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}
